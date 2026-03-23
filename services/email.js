const SibApiV3Sdk = require("sib-api-v3-sdk");

const client = SibApiV3Sdk.ApiClient.instance;
const apiKey = client.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

async function sendEmailLead(lead) {

    const email = {
        sender: { email: "hyperboy022@gmail.com", name: "AI Agent" },
        to: [{ email: "kunalbodkhe080@gmail.com" }],
        subject: "🔥 New Lead Captured",
        htmlContent: `
            <h2>New Lead</h2>
            <p><b>Name:</b> ${lead.name}</p>
            <p><b>Email:</b> ${lead.email}</p>
            <p><b>Phone:</b> ${lead.phone}</p>
            <p><b>Message:</b> ${lead.message}</p>
        `
    };

    await apiInstance.sendTransacEmail(email);
}

module.exports = sendEmailLead;