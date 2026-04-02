/**
 * Multi-Provider Email Service for Lead Notifications and Daily Summaries
 *
 * Supports:
 * - SendGrid (SENDGRID_API_KEY) - Recommended for Render
 * - Resend (RESEND_API_KEY) - Modern, simple
 * - Brevo (BREVO_API_KEY / BREVO_API)
 * - SMTP (SMTP_HOST, SMTP_USER, SMTP_PASS)
 */

const logger = require('../utils/logger');

// ============================================
// PROVIDER IMPLEMENTATIONS
// ============================================

async function sendViaSendGrid(toEmail, subject, html, text = null) {
    try {
        const sgMail = require('@sendgrid/mail');
        const apiKey = process.env.SENDGRID_API_KEY;

        if (!apiKey) {
            throw new Error('SENDGRID_API_KEY not configured');
        }

        sgMail.setApiKey(apiKey);

        const fromEmail = process.env.SENDER_EMAIL || process.env.EMAIL_FROM || 'noreply@neuroassist.com';
        const fromName = process.env.SENDER_NAME || 'NeuroAssist AI';

        const msg = {
            to: toEmail,
            from: { email: fromEmail, name: fromName },
            subject: subject,
            html: html,
            text: text || html.replace(/<[^>]*>/g, '')
        };

        await sgMail.send(msg);
        logger.info(`✅ Email sent via SendGrid to: ${toEmail}`);
        return { success: true, provider: 'sendgrid' };

    } catch (err) {
        logger.error('❌ SendGrid Error:', err.message);
        if (err.response) {
            logger.error('   Status:', err.response.statusCode);
            const errors = err.response.body?.errors;
            if (errors) {
                logger.error('   Details:', JSON.stringify(errors, null, 2));
            }
        }
        throw err;
    }
}

async function sendViaResend(toEmail, subject, html, text = null) {
    try {
        const { Resend } = require('resend');
        const apiKey = process.env.RESEND_API_KEY;

        if (!apiKey) {
            throw new Error('RESEND_API_KEY not configured');
        }

        const resend = new Resend(apiKey);

        const fromEmail = process.env.SENDER_EMAIL || 'onboarding@resend.dev';
        const fromName = process.env.SENDER_NAME || 'NeuroAssist AI';

        const data = {
            from: `${fromName} <${fromEmail}>`,
            to: [toEmail],
            subject: subject,
            html: html,
            text: text || html.replace(/<[^>]*>/g, '')
        };

        const result = await resend.emails.send(data);
        logger.info(`✅ Email sent via Resend to: ${toEmail} (ID: ${result.data?.id})`);
        return { success: true, provider: 'resend' };

    } catch (err) {
        logger.error('❌ Resend Error:', err.message);
        if (err.statusCode) {
            logger.error('   Status:', err.statusCode);
            logger.error('   Body:', JSON.stringify(err.body || {}));
        }
        throw err;
    }
}

async function sendViaBrevo(toEmail, subject, html, text = null) {
    try {
        const SibApiV3Sdk = require("sib-api-v3-sdk");
        const brevoApiKey = process.env.BREVO_API_KEY || process.env.BREVO_API;

        if (!brevoApiKey) {
            throw new Error('Brevo API key not configured');
        }

        const client = SibApiV3Sdk.ApiClient.instance;
        const apiKey = client.authentications["api-key"];
        apiKey.apiKey = brevoApiKey;

        const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

        const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

        sendSmtpEmail.sender = {
            email: process.env.SENDER_EMAIL || "hyperboy022@gmail.com",
            name: process.env.SENDER_NAME || "NeuroAssist"
        };

        sendSmtpEmail.to = [{ email: toEmail }];
        sendSmtpEmail.subject = subject;
        sendSmtpEmail.htmlContent = html;

        if (text) {
            sendSmtpEmail.textContent = text;
        }

        const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
        logger.info(`✅ Email sent via Brevo to: ${toEmail} (MessageID: ${result.messageId})`);
        return { success: true, provider: 'brevo' };

    } catch (err) {
        logger.error('❌ Brevo Error:');
        if (err.response) {
            logger.error('   Status:', err.response.status);
            logger.error('   Response:', JSON.stringify(err.response.body));
        } else {
            logger.error('   Error:', err.message);
        }
        throw err;
    }
}

async function sendViaSMTP(toEmail, subject, html, text = null) {
    try {
        const nodemailer = require('nodemailer');
        const {
            SMTP_HOST,
            SMTP_PORT,
            SMTP_USER,
            SMTP_PASS,
            EMAIL_FROM
        } = process.env;

        if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
            throw new Error('SMTP credentials not configured (SMTP_HOST, SMTP_USER, SMTP_PASS required)');
        }

        const transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: parseInt(SMTP_PORT) || 587,
            secure: false,
            auth: {
                user: SMTP_USER,
                pass: SMTP_PASS
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        const fromEmail = EMAIL_FROM || SMTP_USER;
        const fromName = process.env.SENDER_NAME || 'NeuroAssist AI';

        await transporter.sendMail({
            from: `${fromName} <${fromEmail}>`,
            to: toEmail,
            subject: subject,
            html: html,
            text: text || html.replace(/<[^>]*>/g, '')
        });

        logger.info(`✅ Email sent via SMTP to: ${toEmail}`);
        return { success: true, provider: 'smtp' };

    } catch (err) {
        logger.error('❌ SMTP Error:', err.message);
        throw err;
    }
}

// ============================================
// EMAIL TEMPLATE BUILDERS
// ============================================

function buildLeadEmailHTML(lead, botName, leadScore) {
    const scoreColor = leadScore >= 70 ? '#22c55e' : leadScore >= 40 ? '#f97316' : '#ef4444';
    const scoreLabel = leadScore >= 70 ? 'HOT' : leadScore >= 40 ? 'QUALIFIED' : 'COLD';

    const keywordsHTML = lead.keywordsDetected && lead.keywordsDetected.length > 0
        ? `<div class="keywords">
            ${lead.keywordsDetected.map(kw => `<span class="keyword">${kw}</span>`).join('')}
           </div>`
        : '';

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
                    min-height: 100vh;
                    padding: 20px;
                    margin: 0;
                }
                .container { max-width: 650px; margin: 0 auto; }
                .card {
                    background: rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 20px;
                    padding: 40px;
                    box-shadow: 0 25px 50px rgba(0,0,0,0.5);
                }
                .header {
                    text-align: center;
                    padding-bottom: 25px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    margin-bottom: 30px;
                }
                .badge {
                    display: inline-block;
                    background: linear-gradient(135deg, #ff7518, #ff8c3d);
                    color: white;
                    padding: 6px 16px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    margin-bottom: 12px;
                }
                h1 {
                    color: #fff;
                    font-size: 32px;
                    font-weight: 700;
                    margin: 10px 0 8px 0;
                }
                .subtitle {
                    color: #a78bfa;
                    font-size: 15px;
                }
                .score-badge {
                    display: inline-block;
                    background: linear-gradient(135deg, ${scoreColor}dd, ${scoreColor}aa);
                    color: white;
                    padding: 15px 25px;
                    border-radius: 12px;
                    text-align: center;
                    margin: 25px 0;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                }
                .score-number {
                    font-size: 48px;
                    font-weight: 800;
                    line-height: 1;
                    margin-bottom: 5px;
                }
                .score-label {
                    font-size: 12px;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    opacity: 0.9;
                }
                .grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                    margin-bottom: 25px;
                }
                .stat-box {
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 12px;
                    padding: 20px;
                }
                .stat-label {
                    color: #94a3b8;
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    margin-bottom: 8px;
                }
                .stat-value {
                    color: #fff;
                    font-size: 18px;
                    font-weight: 600;
                    word-break: break-word;
                }
                .section {
                    margin: 25px 0;
                }
                .section-title {
                    color: #a78bfa;
                    font-size: 13px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    margin-bottom: 12px;
                    font-weight: 600;
                }
                .message-box {
                    background: rgba(255, 255, 255, 0.05);
                    border-left: 4px solid #ff7518;
                    padding: 20px;
                    border-radius: 0 12px 12px 0;
                    margin: 15px 0;
                }
                .message-text {
                    color: #e2e8f0;
                    line-height: 1.6;
                    font-size: 15px;
                }
                .alert-box {
                    background: linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.05));
                    border: 1px solid rgba(34, 197, 94, 0.3);
                    color: #22c55e;
                    padding: 16px;
                    border-radius: 12px;
                    margin-top: 25px;
                    font-size: 14px;
                    line-height: 1.6;
                }
                .alert-box.hot { background: linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.1)); border-color: rgba(34, 197, 94, 0.4); }
                .alert-box.cold { background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05)); border-color: rgba(239, 68, 68, 0.3); color: #ef4444; }
                .cta-button {
                    display: inline-block;
                    background: linear-gradient(135deg, #ff7518, #ff8c3d);
                    color: white;
                    padding: 16px 32px;
                    border-radius: 12px;
                    text-decoration: none;
                    font-weight: 700;
                    margin: 25px auto 0;
                    box-shadow: 0 10px 25px rgba(255, 117, 24, 0.4);
                    text-align: center;
                }
                .footer {
                    text-align: center;
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                    color: #64748b;
                    font-size: 12px;
                }
                @media (max-width: 600px) {
                    .grid { grid-template-columns: 1fr; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="card">
                    <div class="header">
                        <span class="badge">${scoreLabel} LEAD</span>
                        <h1>🎯 New Lead Alert!</h1>
                        <p class="subtitle">Your AI bot captured a new prospect</p>
                    </div>

                    <div class="score-badge" style="background: linear-gradient(135deg, ${scoreColor}, ${scoreColor}dd);">
                        <div class="score-number" style="color: white;">${leadScore}</div>
                        <div class="score-label" style="color: rgba(255,255,255,0.9);">Lead Score</div>
                    </div>

                    <div class="grid">
                        <div class="stat-box">
                            <div class="stat-label">🤖 Bot</div>
                            <div class="stat-value">${botName}</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-label">📧 Email</div>
                            <div class="stat-value" style="font-size: 14px;">${lead.email || 'Not provided'}</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-label">👤 Name</div>
                            <div class="stat-value">${lead.name || 'Not provided'}</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-label">📱 Phone</div>
                            <div class="stat-value" style="font-size: 14px;">${lead.phone || 'Not provided'}</div>
                        </div>
                    </div>

                    <div class="section">
                        <div class="section-title">💬 Message</div>
                        <div class="message-box">
                            <p class="message-text">${lead.message || 'No message provided'}</p>
                        </div>
                    </div>

                    ${keywordsHTML ? `
                    <div class="section">
                        <div class="section-title">🔍 Detected Keywords</div>
                        ${keywordsHTML}
                    </div>
                    ` : ''}

                    <div class="alert-box ${leadScore >= 70 ? 'hot' : leadScore < 40 ? 'cold' : ''}">
                        <strong>💡 Pro Tip:</strong><br>
                        ${leadScore >= 70
                            ? 'Excellent lead! Contact within 24 hours for best conversion.'
                            : leadScore >= 40
                            ? 'Good potential. Follow up within 48 hours.'
                            : 'Needs more nurturing. Consider adding to drip campaign.'
                        }
                    </div>

                    <div style="text-align: center;">
                        <a href="${process.env.APP_URL || 'http://localhost:3000'}/profile" class="cta-button">
                            View All Leads →
                        </a>
                    </div>

                    <div class="footer">
                        <p>📍 Captured: ${new Date(lead.createdAt).toLocaleString()}</p>
                        <p>© 2024 NeuroAssist AI</p>
                        <p style="margin-top: 8px;">
                            <a href="#" style="color: #64748b; text-decoration: none;">Unsubscribe</a>
                        </p>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;
}

function buildSummaryEmailHTML(stats, userEmail) {
    const appUrl = process.env.APP_URL || 'http://localhost:3000';

    const botRows = stats.topBots && stats.topBots.length > 0
        ? stats.topBots.map(bot => `
            <div class="bot-item">
                <span style="color: #fff; font-weight: 500;">${bot.name}</span>
                <span style="color: #ff7518; font-weight: 700;">${bot.leads} leads</span>
            </div>
          `).join('')
        : '<div class="bot-item"><span style="color: #94a3b8;">No activity yet</span></div>';

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                    min-height: 100vh;
                    padding: 20px;
                    margin: 0;
                }
                .container { max-width: 600px; margin: 0 auto; }
                .card {
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 20px;
                    padding: 40px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                }
                .header {
                    text-align: center;
                    padding-bottom: 30px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    margin-bottom: 30px;
                }
                h1 {
                    background: linear-gradient(135deg, #ff7518, #ff8c3d);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    font-size: 32px;
                    font-weight: 800;
                    margin-bottom: 10px;
                }
                .subtitle {
                    color: #94a3b8;
                    font-size: 15px;
                }
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 15px;
                    margin-bottom: 30px;
                }
                .stat-card {
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 16px;
                    padding: 25px 15px;
                    text-align: center;
                    transition: transform 0.2s;
                }
                .stat-card:hover { transform: translateY(-5px); }
                .stat-number {
                    font-size: 36px;
                    font-weight: 800;
                    margin: 10px 0;
                }
                .stat-label {
                    color: #94a3b8;
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                .total { color: #fff; }
                .hot { color: #22c55e; }
                .revenue { color: #ff7518; font-size: 24px !important; }
                .section {
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 12px;
                    padding: 20px;
                    margin-bottom: 20px;
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }
                .section-title {
                    color: #a78bfa;
                    font-size: 13px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    margin-bottom: 15px;
                    font-weight: 600;
                }
                .insight-box {
                    background: linear-gradient(135deg, rgba(167, 139, 250, 0.1), rgba(167, 139, 250, 0.05));
                    border-left: 4px solid #a78bfa;
                    padding: 15px;
                    border-radius: 0 8px 8px 0;
                    margin: 15px 0;
                    font-size: 14px;
                    color: #ddd;
                }
                .cta {
                    display: block;
                    background: linear-gradient(135deg, #ff7518, #ff8c3d);
                    color: white;
                    text-decoration: none;
                    padding: 16px 32px;
                    border-radius: 12px;
                    text-align: center;
                    font-weight: 700;
                    margin: 25px auto 0;
                    box-shadow: 0 10px 30px rgba(255, 117, 24, 0.4);
                }
                .footer {
                    text-align: center;
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                    color: #64748b;
                    font-size: 12px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="card">
                    <div class="header">
                        <h1>📊 Daily Lead Summary</h1>
                        <p class="subtitle">Here's what happened with your bots yesterday</p>
                    </div>

                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-label">Total Leads</div>
                            <div class="stat-number total">${stats.totalLeads}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Hot Leads🔥</div>
                            <div class="stat-number hot">${stats.hotLeads}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">💰 Est. Value</div>
                            <div class="stat-number revenue">₹${stats.potentialRevenue || 0}</div>
                        </div>
                    </div>

                    <div class="section">
                        <div class="section-title">🏆 Top Performing Bots</div>
                        ${botRows}
                    </div>

                    <div class="insight-box">
                        <strong>📈 Key Insights:</strong><br>
                        ${stats.totalLeads === 0
                            ? 'No leads captured yesterday. Consider reviewing your bot configurations or driving more traffic.'
                            : `You received ${stats.totalLeads} lead${stats.totalLeads === 1 ? '' : 's'} yesterday (${stats.hotLeads} hot${stats.hotLeads === 1 ? '' : ''}). Average score: ${stats.avgScore || 0}/100`
                        }
                    </div>

                    <a href="${appUrl}/profile" class="cta">View Full Report →</a>

                    <div class="footer">
                        <p>© 2024 NeuroAssist AI • ${new Date().toLocaleDateString()}</p>
                        <p style="margin-top: 8px;">
                            <a href="#" style="color: #64748b; text-decoration: none;">Manage Preferences</a>
                        </p>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;
}

// ============================================
// MAIN MULTI-PROVIDER SENDER
// ============================================

function getAvailableProviders() {
    const providers = [];

    // Priority order: Resend first (recommended), then SendGrid, then Brevo, then SMTP
    if (process.env.RESEND_API_KEY) {
        providers.push({ name: 'Resend', fn: sendViaResend });
    }
    if (process.env.SENDGRID_API_KEY) {
        providers.push({ name: 'SendGrid', fn: sendViaSendGrid });
    }
    if (process.env.BREVO_API_KEY || process.env.BREVO_API) {
        providers.push({ name: 'Brevo', fn: sendViaBrevo });
    }
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        providers.push({ name: 'SMTP', fn: sendViaSMTP });
    }

    return providers;
}

async function sendWithFallback(toEmail, subject, html, text = null) {
    const providers = getAvailableProviders();

    if (providers.length === 0) {
        logger.error('❌ No email provider configured!');
        logger.error('   Set one of:');
        logger.error('   - SENDGRID_API_KEY (recommended)');
        logger.error('   - RESEND_API_KEY');
        logger.error('   - BREVO_API_KEY');
        logger.error('   - SMTP_HOST, SMTP_USER, SMTP_PASS');
        return false;
    }

    logger.info(`📮 Sending email to ${toEmail} via: ${providers.map(p => p.name).join(' → ')}`);

    for (const provider of providers) {
        try {
            const result = await provider.fn(toEmail, subject, html, text);
            return result;
        } catch (err) {
            logger.warn(`⚠️  ${provider.name} failed: ${err.message}`);
            continue;
        }
    }

    logger.error('❌ All email providers failed');
    return false;
}

// ============================================
// PUBLIC API
// ============================================

async function sendEmailLead(lead, ownerEmail = null, botName = 'Unknown Bot') {
    const recipientEmail = ownerEmail || "hyperboy022@gmail.com";
    const leadScore = lead.leadScore || 0;

    const subject = `🔥 New ${leadScore >= 70 ? 'HOT' : leadScore >= 40 ? 'Qualified' : 'Cold'} Lead from ${botName}`;
    const html = buildLeadEmailHTML(lead, botName, leadScore);
    const text = `New lead captured from ${botName}\n\nScore: ${leadScore}/100\nName: ${lead.name || 'N/A'}\nEmail: ${lead.email || 'N/A'}\nPhone: ${lead.phone || 'N/A'}\nMessage: ${lead.message || 'N/A'}\n\nView: ${process.env.APP_URL || 'http://localhost:3000'}/profile`;

    return await sendWithFallback(recipientEmail, subject, html, text);
}

async function sendDailyLeadsSummary(userEmail, leadStats) {
    const subject = "📊 Your Daily Lead Summary - NeuroAssist";
    const html = buildSummaryEmailHTML(leadStats, userEmail);
    const text = `📊 Daily Lead Summary\n\nTotal: ${leadStats.totalLeads}\nHot: ${leadStats.hotLeads}\nEst. Value: ₹${leadStats.potentialRevenue || 0}\n\nTop bots: ${leadStats.topBots?.map(b => b.name + ':' + b.leads).join(', ') || 'None'}\n\nView full report: ${process.env.APP_URL || 'http://localhost:3000'}/profile`;

    return await sendWithFallback(userEmail, subject, html, text);
}

module.exports = {
    sendEmailLead,
    sendDailyLeadsSummary
};
