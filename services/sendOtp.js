const SibApiV3Sdk = require("sib-api-v3-sdk");


const client = SibApiV3Sdk.ApiClient.instance;
const apiKey = client.authentications["api-key"];


apiKey.apiKey = process.env.BREVO_API_KEY;


if (!process.env.BREVO_API_KEY) {
    console.log(" BREVO API KEY NOT LOADED");
} else {
    console.log(" BREVO API KEY LOADED");
}

async function sendOtp(email, otp) {
    try {
        const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

      
        const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

        sendSmtpEmail.sender = {
            email: "hyperboy022@gmail.com", 
            name: "NeuroAssist"
        };

        sendSmtpEmail.to = [
            { email: email }
        ];

        sendSmtpEmail.subject = "Your OTP Code";

        sendSmtpEmail.htmlContent = `
            <h2>Email Verification</h2>
            <p>Your OTP is:</p>
            <h1>${otp}</h1>
            <p>Expires in 5 minutes</p>
        `;

  
        const result = await apiInstance.sendTransacEmail(sendSmtpEmail);

        console.log("OTP SENT:", result.messageId);

        return true;

    } catch (err) {
        console.log("BREVO ERROR:", err.response?.body || err.message);
        return false;
    }
}

module.exports = sendOtp;