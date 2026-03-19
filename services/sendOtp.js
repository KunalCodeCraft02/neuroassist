const SibApiV3Sdk = require('sib-api-v3-sdk');

const client = SibApiV3Sdk.ApiClient.instance;
const apiKey = client.authentications['api-key'];

apiKey.apiKey = process.env.BREVO_API_KEY;

async function sendOtp(email, otp) {

    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

    const sendSmtpEmail = {
        to: [{ email: email }],
        sender: { email: "hyperboy022@gmail.com", name: "NeuroAssist" },
        subject: "Your OTP Code",
        htmlContent: `
            <h2>Email Verification</h2>
            <p>Your OTP code is:</p>
            <h1>${otp}</h1>
            <p>This OTP will expire in 5 minutes.</p>
        `
    };

    await apiInstance.sendTransacEmail(sendSmtpEmail);
}

module.exports = sendOtp;