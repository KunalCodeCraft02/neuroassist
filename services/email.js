const SibApiV3Sdk = require("sib-api-v3-sdk");

const client = SibApiV3Sdk.ApiClient.instance;
const apiKey = client.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

async function sendEmailLead(lead, ownerEmail = null, botName = 'Unknown Bot') {

    // If ownerEmail not provided, use default
    const recipientEmail = ownerEmail || "kunalbodkhe080@gmail.com";

    const leadScore = lead.leadScore || 0;
    let scoreColor = '#ef4444'; // red
    if (leadScore >= 70) scoreColor = '#22c55e'; // green
    else if (leadScore >= 40) scoreColor = '#f97316'; // orange

    const ownerEmailTemplate = {
        sender: { email: "hyperboy022@gmail.com", name: "NeuroAssist AI" },
        to: [{ email: recipientEmail }],
        subject: `🔥 New High-Value Lead from ${botName} (Score: ${leadScore}/100)`,
        htmlContent: `
            <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #111827; color: #fff; padding: 40px; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
                <div style="text-align: center; border-bottom: 1px solid #374151; padding-bottom: 20px; margin-bottom: 30px;">
                    <h1 style="margin: 0; color: #ff7518; font-size: 28px;">🎯 New Lead Captured!</h1>
                    <p style="color: #9ca3af; margin-top: 8px; font-size: 14px;">Your AI bot just qualified a new prospect</p>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
                    <div style="background: #1f2937; padding: 20px; border-radius: 8px;">
                        <p style="color: #9ca3af; margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">🤖 Bot</p>
                        <p style="margin: 0; font-size: 18px; font-weight: 600; color: #fff;">${botName}</p>
                    </div>

                    <div style="background: #1f2937; padding: 20px; border-radius: 8px;">
                        <p style="color: #9ca3af; margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">📊 Lead Score</p>
                        <p style="margin: 0; font-size: 24px; font-weight: 800; color: ${scoreColor};">${leadScore}/100</p>
                    </div>

                    <div style="background: #1f2937; padding: 20px; border-radius: 8px;">
                        <p style="color: #9ca3af; margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">👤 Name</p>
                        <p style="margin: 0; font-size: 16px; color: #fff;">${lead.name || 'Not provided'}</p>
                    </div>

                    <div style="background: #1f2937; padding: 20px; border-radius: 8px;">
                        <p style="color: #9ca3af; margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">📧 Email</p>
                        <p style="margin: 0; font-size: 14px; color: #60a5fa;">${lead.email || 'Not provided'}</p>
                    </div>

                    <div style="grid-column: span 2; background: #1f2937; padding: 20px; border-radius: 8px;">
                        <p style="color: #9ca3af; margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">📱 Phone</p>
                        <p style="margin: 0; font-size: 16px; color: #fff;">${lead.phone || 'Not provided'}</p>
                    </div>

                    <div style="grid-column: span 2; background: #1f2937; padding: 20px; border-radius: 8px;">
                        <p style="color: #9ca3af; margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">💬 Message</p>
                        <p style="margin: 0; font-size: 14px; color: #d1d5db; line-height: 1.6;">${lead.message || 'No message'}</p>
                    </div>

                    <% if (lead.keywordsDetected && lead.keywordsDetected.length > 0) { %>
                    <div style="grid-column: span 2; background: rgba(255, 117, 24, 0.1); padding: 16px; border-radius: 8px; border: 1px solid rgba(255, 117, 24, 0.3);">
                        <p style="color: #ff7518; margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">🔍 Keywords Detected</p>
                        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                            ${lead.keywordsDetected.map(kw => `
                                <span style="background: rgba(255, 117, 24, 0.2); color: #ff7518; padding: 4px 12px; border-radius: 20px; font-size: 11px; border: 1px solid rgba(255, 117, 24, 0.3);">${kw}</span>
                            `).join('')}
                        </div>
                    </div>
                    <% } %>
                </div>

                <div style="background: linear-gradient(135deg, rgba(255, 117, 24, 0.1), rgba(255, 140, 61, 0.1)); padding: 20px; border-radius: 8px; border: 1px solid rgba(255, 117, 24, 0.2); margin-top: 20px;">
                    <p style="margin: 0; color: #ff7518; font-size: 14px; display: flex; align-items: center; gap: 8px;">
                        <i class="ri-information-line"></i>
                        <strong>Pro Tip:</strong> This lead scored <strong>${leadScore}/100</strong> based on engagement metrics and buying signals.
                    </p>
                </div>

                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #374151;">
                    <p style="color: #6b7280; font-size: 12px; margin: 0;">
                        Captured on ${new Date(lead.createdAt).toLocaleString()}
                        <br>
                        <a href="${process.env.APP_URL || 'http://localhost:3000'}/profile" style="color: #60a5fa; text-decoration: none;">View all leads →</a>
                    </p>
                </div>
            </div>
        `
    };

    try {
        await apiInstance.sendTransacEmail(ownerEmailTemplate);
        console.log("📧 Lead notification sent to:", recipientEmail);
    } catch (err) {
        console.log("❌ Owner Email Error:", err.message);
    }

    // Send auto-reply to user if they provided email
    if (lead.email && lead.email.includes('@')) {
        const userEmailTemplate = {
            sender: { email: "hyperboy022@gmail.com", name: botName },
            to: [{ email: lead.email }],
            subject: `Thanks for contacting ${botName}!`,
            htmlContent: `
                <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; color: #111827; padding: 40px; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.1);">
                    <div style="text-align: center; border-bottom: 1px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 30px;">
                        <h2 style="margin: 0; color: #ff7518; font-size: 24px;">Hello ${lead.name || 'there'}! 👋</h2>
                    </div>

                    <p style="font-size: 16px; line-height: 1.6; color: #374151;">
                        Thank you for reaching out to <strong>${botName}</strong>. We've received your message and our team will get back to you shortly (usually within 24 hours).
                    </p>

                    <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 16px; margin: 20px 0;">
                        <p style="margin: 0; color: #92400e; font-size: 14px;">
                            <i class="ri-information-line"></i>
                            <strong>Your message:</strong> "${lead.message ? lead.message.substring(0, 200) + (lead.message.length > 200 ? '...' : '') : 'No message provided'}"
                        </p>
                    </div>

                    <p style="font-size: 15px; line-height: 1.6; color: #6b7280;">
                        While you wait, feel free to browse our services or reply to this email if you have additional questions.
                    </p>

                    <div style="text-align: center; margin-top: 30px;">
                        <a href="#" style="background: #ff7518; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Visit Website</a>
                    </div>

                    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                            This is an automated message from ${botName}. <br>
                            <a href="#" style="color: #6b7280; text-decoration: none;">Unsubscribe</a>
                        </p>
                    </div>
                </div>
            `
        };

        try {
            await apiInstance.sendTransacEmail(userEmailTemplate);
            console.log("📧 Auto-reply sent to user:", lead.email);
        } catch (err) {
            console.log("❌ User Email Error:", err.message);
        }
    }
}

// Send daily summary of leads
async function sendDailyLeadsSummary(userEmail, leadStats) {
    const summaryEmail = {
        sender: { email: "hyperboy022@gmail.com", name: "NeuroAssist AI" },
        to: [{ email: userEmail }],
        subject: "📊 Your Daily Lead Summary",
        htmlContent: `
            <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #111827; color: #fff; padding: 40px; border-radius: 12px;">
                <h1 style="color: #ff7518; margin: 0 0 10px 0;">📊 Daily Lead Summary</h1>
                <p style="color: #9ca3af; margin-bottom: 30px;">Here's what happened with your bots yesterday</p>

                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px;">
                    <div style="background: #1f2937; padding: 20px; border-radius: 8px; text-align: center;">
                        <h3 style="margin: 0 0 5px 0; color: #fff; font-size: 28px;">${leadStats.totalLeads}</h3>
                        <p style="margin: 0; color: #9ca3af; font-size: 12px;">Total Leads</p>
                    </div>
                    <div style="background: #1f2937; padding: 20px; border-radius: 8px; text-align: center;">
                        <h3 style="margin: 0 0 5px 0; color: #4ade80; font-size: 28px;">${leadStats.hotLeads}</h3>
                        <p style="margin: 0; color: #9ca3af; font-size: 12px;">Hot Leads</p>
                    </div>
                    <div style="background: #1f2937; padding: 20px; border-radius: 8px; text-align: center;">
                        <h3 style="margin: 0 0 5px 0; color: #fff; font-size: 28px;">₹${leadStats.potentialRevenue || 0}</h3>
                        <p style="margin: 0; color: #9ca3af; font-size: 12px;">Est. Value</p>
                    </div>
                </div>

                <div style="background: #1f2937; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <h3 style="margin: 0 0 15px 0; font-size: 16px;">Top Performing Bots</h3>
                    ${leadStats.topBots ? leadStats.topBots.map(bot => `
                        <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #374151;">
                            <span>${bot.name}</span>
                            <span style="color: #ff7518;">${bot.leads} leads</span>
                        </div>
                    `).join('') : '<p style="color: #9ca3af;">No bot activity</p>'}
                </div>

                <p style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px;">
                    <a href="${process.env.APP_URL || 'http://localhost:3000'}/profile" style="color: #ff7518; text-decoration: none;">View full report →</a>
                </p>
            </div>
        `
    };

    try {
        await apiInstance.sendTransacEmail(summaryEmail);
        console.log("📊 Daily summary sent to:", userEmail);
    } catch (err) {
        console.log("❌ Summary Email Error:", err.message);
    }
}

module.exports = { sendEmailLead, sendDailyLeadsSummary };