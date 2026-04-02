/**
 * Multi-Provider OTP Email Service
 *
 * Supports (in priority order):
 * 1. SendGrid (SENDGRID_API_KEY) - Recommended for Render
 * 2. Resend (RESEND_API_KEY) - Modern, simple
 * 3. Brevo (BREVO_API_KEY) - Backup option
 * 4. SMTP (SMTP_HOST, SMTP_USER, SMTP_PASS) - Fallback
 */

const logger = require('../utils/logger');

// Beautiful OTP email template (works with all providers)
function createOTPEmailTemplate(email, otp, expiresInMinutes = 5) {
    return {
        subject: `🔐 Your OTP Code - NeuroAssist`,

        // HTML version - Beautiful, modern design
        html: `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>OTP Verification</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 20px;
                        margin: 0;
                    }
                    .container {
                        background: white;
                        border-radius: 16px;
                        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                        max-width: 500px;
                        width: 100%;
                        overflow: hidden;
                    }
                    .header {
                        background: linear-gradient(135deg, #ff7518 0%, #ff8c3d 100%);
                        color: white;
                        padding: 30px;
                        text-align: center;
                    }
                    .header h1 {
                        margin: 0;
                        font-size: 28px;
                        font-weight: 700;
                        letter-spacing: -0.5px;
                    }
                    .header p {
                        margin: 8px 0 0 0;
                        opacity: 0.9;
                        font-size: 14px;
                    }
                    .content {
                        padding: 40px;
                    }
                    .otp-box {
                        background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                        border: 3px dashed #f59e0b;
                        border-radius: 12px;
                        padding: 30px;
                        text-align: center;
                        margin: 30px 0;
                    }
                    .otp-code {
                        font-size: 48px;
                        font-weight: 800;
                        color: #d97706;
                        letter-spacing: 12px;
                        margin: 0;
                        font-family: 'Courier New', monospace;
                        text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
                    }
                    .expiry {
                        color: #6b7280;
                        font-size: 14px;
                        margin-top: 15px;
                    }
                    .notice {
                        background: #f9fafb;
                        border-left: 4px solid #ff7518;
                        padding: 15px;
                        margin-top: 25px;
                        border-radius: 0 8px 8px 0;
                        font-size: 13px;
                        color: #6b7280;
                    }
                    .footer {
                        background: #f9fafb;
                        padding: 20px;
                        text-align: center;
                        border-top: 1px solid #e5e7eb;
                        font-size: 12px;
                        color: #9ca3af;
                    }
                    .button {
                        display: inline-block;
                        background: #ff7518;
                        color: white;
                        padding: 12px 24px;
                        border-radius: 8px;
                        text-decoration: none;
                        margin-top: 15px;
                        font-weight: 600;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>✨ NeuroAssist</h1>
                        <p>Email Verification</p>
                    </div>
                    <div class="content">
                        <h2 style="color: #111827; margin-top: 0; margin-bottom: 10px;">Hello!</h2>
                        <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                            You requested to create an account. Use the verification code below to complete your registration:
                        </p>

                        <div class="otp-box">
                            <h1 class="otp-code">${otp}</h1>
                            <p class="expiry">Expires in ${expiresInMinutes} minutes</p>
                        </div>

                        <div class="notice">
                            <strong>🔒 Security Notice:</strong><br>
                            This code is unique to your email address. If you didn't request this verification, please ignore this email and your account will not be created.
                        </div>
                    </div>
                    <div class="footer">
                        <p>© 2024 NeuroAssist AI. All rights reserved.</p>
                        <p style="margin-top: 8px;">
                            Need help? Contact support@neuroassist.com
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `,

        // Plain text version (fallback)
        text: `
╔══════════════════════════════════════════════╗
║           ✨ NeuroAssist AI                 ║
║        Email Verification Code             ║
╚══════════════════════════════════════════════╝

Hello!

Your verification code is:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    ${otp}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏰ This code expires in ${expiresInMinutes} minutes.

🔒 If you didn't request this verification, please ignore this email.

──────────────────────────────────────────────
© 2024 NeuroAssist AI
──────────────────────────────────────────────
        `
    };
}

// ============================================
// PROVIDER 1: SENDGRID (RECOMMENDED FOR RENDER)
// ============================================
async function sendViaSendGrid(toEmail, otp) {
    try {
        const sgMail = require('@sendgrid/mail');
        const apiKey = process.env.SENDGRID_API_KEY;

        if (!apiKey) {
            throw new Error('SENDGRID_API_KEY not configured');
        }

        sgMail.setApiKey(apiKey);

        const { html, text, subject } = createOTPEmailTemplate(toEmail, otp);

        const msg = {
            to: toEmail,
            from: {
                email: process.env.SENDER_EMAIL || 'noreply@neuroassist.com',
                name: process.env.SENDER_NAME || 'NeuroAssist AI'
            },
            subject: subject,
            html: html,
            text: text,
            // Track clicks and opens (optional)
            trackSettings: {
                clickTracking: {
                    enable: true,
                    enableText: true
                },
                openTracking: true
            }
        };

        await sgMail.send(msg);
        logger.info(`✅ OTP sent via SendGrid to: ${toEmail}`);
        return { success: true, provider: 'sendgrid' };

    } catch (err) {
        logger.error('❌ SendGrid Error:', err.message);
        if (err.response) {
            logger.error('   Status:', err.response.statusCode);
            logger.error('   Body:', JSON.stringify(err.response.body));
        }
        throw err;
    }
}

// ============================================
// PROVIDER 2: RESEND (MODERN & SIMPLE)
// ============================================
async function sendViaResend(toEmail, otp) {
    try {
        const { Resend } = require('resend');
        const apiKey = process.env.RESEND_API_KEY;

        if (!apiKey) {
            throw new Error('RESEND_API_KEY not configured');
        }

        const resend = new Resend(apiKey);

        const { html, text, subject } = createOTPEmailTemplate(toEmail, otp);

        const data = {
            from: process.env.SENDER_EMAIL || 'NeuroAssist <onboarding@resend.dev>',
            to: [toEmail],
            subject: subject,
            html: html,
            text: text
        };

        await resend.emails.send(data);
        logger.info(`✅ OTP sent via Resend to: ${toEmail}`);
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

// ============================================
// PROVIDER 3: BREVO (FALLBACK)
// ============================================
async function sendViaBrevo(toEmail, otp) {
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

        const { html, text, subject } = createOTPEmailTemplate(toEmail, otp);

        const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

        sendSmtpEmail.sender = {
            email: process.env.SENDER_EMAIL || "hyperboy022@gmail.com",
            name: process.env.SENDER_NAME || "NeuroAssist"
        };

        sendSmtpEmail.to = [{ email: toEmail }];
        sendSmtpEmail.subject = subject;
        sendSmtpEmail.htmlContent = html;
        sendSmtpEmail.textContent = text;

        const result = await apiInstance.sendTransacEmail(sendSmtpEmail);

        logger.info(`✅ OTP sent via Brevo to: ${toEmail} (MessageID: ${result.messageId})`);
        return { success: true, provider: 'brevo' };

    } catch (err) {
        logger.error('❌ Brevo OTP Error:');
        if (err.response) {
            logger.error('   Status:', err.response.status);
            logger.error('   Response:', JSON.stringify(err.response.body));
        } else {
            logger.error('   Error:', err.message);
        }
        throw err;
    }
}

// ============================================
// PROVIDER 4: SMTP (LAST RESORT - May be blocked on Render)
// ============================================
async function sendViaSMTP(toEmail, otp) {
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
            secure: false, // STARTTLS
            auth: {
                user: SMTP_USER,
                pass: SMTP_PASS
            },
            // TLS options for better compatibility
            tls: {
                rejectUnauthorized: false // For self-signed certs (only if needed)
            }
        });

        const { html, text, subject } = createOTPEmailTemplate(toEmail, otp);

        await transporter.sendMail({
            from: EMAIL_FROM || SMTP_USER,
            to: toEmail,
            subject: subject,
            html: html,
            text: text
        });

        logger.info(`✅ OTP sent via SMTP to: ${toEmail}`);
        return { success: true, provider: 'smtp' };

    } catch (err) {
        logger.error('❌ SMTP Error:', err.message);
        throw err;
    }
}

// ============================================
// MAIN FUNCTION: Try providers in order
// ============================================
async function sendOtp(email, otp) {
    logger.info(`📧 Sending OTP to ${email}...`);

    // Determine available providers (in priority order)
    const providers = [];

    if (process.env.SENDGRID_API_KEY) {
        providers.push({ name: 'SendGrid', fn: sendViaSendGrid });
    }
    if (process.env.RESEND_API_KEY) {
        providers.push({ name: 'Resend', fn: sendViaResend });
    }
    if (process.env.BREVO_API_KEY || process.env.BREVO_API) {
        providers.push({ name: 'Brevo', fn: sendViaBrevo });
    }
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        providers.push({ name: 'SMTP', fn: sendViaSMTP });
    }

    if (providers.length === 0) {
        logger.error('❌ No email provider configured!');
        logger.error('   Set one of: SENDGRID_API_KEY, RESEND_API_KEY, BREVO_API_KEY, or SMTP credentials');
        return false;
    }

    logger.info(`📮 Attempting email with providers: ${providers.map(p => p.name).join(' → ')}`);

    // Try each provider until one succeeds
    for (const provider of providers) {
        try {
            logger.info(`🔄 Trying ${provider.name}...`);
            const result = await provider.fn(email, otp);
            logger.info(`✅ OTP sent successfully using ${provider.name}`);
            return result;
        } catch (err) {
            logger.warn(`⚠️  ${provider.name} failed: ${err.message}`);
            // Continue to next provider
            continue;
        }
    }

    // All providers failed
    logger.error('❌ All email providers failed. Email not sent.');
    return false;
}

module.exports = sendOtp;
