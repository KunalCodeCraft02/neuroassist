const SibApiV3Sdk = require("sib-api-v3-sdk");

// configure API key
const client = SibApiV3Sdk.ApiClient.instance;
const apiKey = client.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;

async function sendOtp(email, otp) {
    try {
        const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

        const result = await apiInstance.sendTransacEmail({
            sender: {
                email: "hyperboy022@gmail.com", 
                name: "NeuroAssist"
            },
            to: [{ email: email }],
            subject: "Your OTP Code",
            htmlContent: `
                <h2>Email Verification</h2>
                <p>Your OTP is:</p>
                <h1>${otp}</h1>
                <p>Expires in 5 minutes</p>
            `
        });

        console.log("OTP SENT ", result.messageId);

    } catch (err) {
        console.log("BREVO ERROR :", err.response?.body || err.message);
        throw err;
    }
}

module.exports = sendOtp;