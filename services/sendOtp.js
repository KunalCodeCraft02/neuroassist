const SibApiV3Sdk = require("sib-api-v3-sdk");


const client = SibApiV3Sdk.ApiClient.instance;
const apiKey = client.authentications["api-key"];


// Support both variable names for flexibility
const brevoApiKey = process.env.BREVO_API_KEY || process.env.BREVO_API;

apiKey.apiKey = brevoApiKey;

if (!brevoApiKey) {
    console.log("❌ BREVO API KEY NOT LOADED - Set BREVO_API_KEY or BREVO_API in environment");
} else {
    console.log("✅ BREVO API KEY LOADED (length: " + brevoApiKey.length + ")");
}

async function sendOtp(email, otp) {
    try {
        const brevoApiKey = process.env.BREVO_API_KEY || process.env.BREVO_API;

        if (!brevoApiKey) {
            console.error("❌ Cannot send OTP: Brevo API key not configured");
            console.error("   Set BREVO_API_KEY or BREVO_API environment variable");
            return false;
        }

        const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

        const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

        sendSmtpEmail.sender = {
            email: "hyperboy022@gmail.com",
            name: "NeuroAssist"
        };

        sendSmtpEmail.to = [
            { email: email }
        ];

        sendSmtpEmail.subject = "Your OTP Code - NeuroAssist";

        sendSmtpEmail.htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: #ff7518; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0;">NeuroAssist</h1>
                </div>
                <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
                    <h2 style="color: #111827; margin-top: 0;">Verify Your Email</h2>
                    <p style="color: #6b7280; font-size: 16px;">Your OTP verification code is:</p>
                    <div style="background: #fef3c7; border: 2px dashed #f59e0b; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
                        <h1 style="color: #d97706; margin: 0; font-size: 48px; letter-spacing: 8px;">${otp}</h1>
                    </div>
                    <p style="color: #6b7280; font-size: 14px;">This code expires in <strong>5 minutes</strong>.</p>
                    <p style="color: #9ca3af; font-size: 12px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 15px;">
                        If you didn't request this code, please ignore this email.
                    </p>
                </div>
            </div>
        `;

        const result = await apiInstance.sendTransacEmail(sendSmtpEmail);

        console.log("✅ OTP sent successfully to:", email, "(MessageID:", result.messageId + ")");

        return true;

    } catch (err) {
        console.error("❌ Brevo OTP Error:");

        if (err.response) {
            // HTTP error from Brevo API
            const status = err.response.status;
            const body = err.response.body;

            console.error("   Status:", status);
            console.error("   Response:", JSON.stringify(body));

            if (status === 401) {
                console.error("   💡 SOLUTION: Invalid or missing Brevo API key");
                console.error("   - Check BREVO_API_KEY or BREVO_API environment variable");
                console.error("   - Ensure API key is valid and active in Brevo dashboard");
            } else if (status === 400) {
                console.error("   💡 SOLUTION: Invalid request - check sender email is verified in Brevo");
            } else if (status === 429) {
                console.error("   💡 SOLUTION: Rate limit exceeded - upgrade Brevo plan or wait");
            } else if (status === 422) {
                console.error("   💡 SOLUTION: Invalid email address or missing required fields");
            }
        } else {
            console.error("   Error:", err.message);
        }

        return false;
    }
}

module.exports = sendOtp;