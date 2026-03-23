const SibApiV3Sdk = require("sib-api-v3-sdk");

const client = SibApiV3Sdk.ApiClient.instance;
const apiKey = client.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

async function sendEmailLead(lead) {

    // ===============================
    // 1️⃣ OWNER EMAIL (YOU)
    // ===============================
    const ownerEmail = {
        sender: { email: "hyperboy022@gmail.com", name: "AI Agent" },
        to: [{ email: "kunalbodkhe080@gmail.com" }], // 👉 YOUR EMAIL
        subject: "🔥 New Lead Captured",
        htmlContent: `
            <h2>New Lead</h2>
            <p><b>Name:</b> ${lead.name}</p>
            <p><b>Email:</b> ${lead.email}</p>
            <p><b>Phone:</b> ${lead.phone}</p>
            <p><b>Message:</b> ${lead.message}</p>
        `
    };

    // ===============================
    // 2️⃣ USER EMAIL (DYNAMIC 🔥)
    // ===============================
    const userEmail = {
        sender: { email: "hyperboy022@gmail.com", name: "AI Agent" },
        to: [{ email: lead.email }], // 🔥 DYNAMIC USER EMAIL
        subject: "Thanks for contacting us 🚀",
        htmlContent: `
            <h2>Hey ${lead.name || "there"} 👋</h2>
            <p>Thanks for reaching out!</p>
            <p>Our team will contact you soon.</p>
            <br/>
            <p>Meanwhile, feel free to reply to this email.</p>
        `
    };

    // ===============================
    // 🔥 SEND BOTH EMAILS
    // ===============================

    try {
        await apiInstance.sendTransacEmail(ownerEmail);
        console.log("📧 Owner email sent");
    } catch (err) {
        console.log("Owner Email Error:", err.message);
    }

    try {
        if (lead.email) {
            await apiInstance.sendTransacEmail(userEmail);
            console.log("📧 User email sent");
        }
    } catch (err) {
        console.log("User Email Error:", err.message);
    }
}

module.exports = sendEmailLead;