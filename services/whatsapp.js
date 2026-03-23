const twilio = require("twilio");

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);

async function sendWhatsAppLead(lead) {

    const msg = `
🔥 New Lead

Name: ${lead.name}
Email: ${lead.email}
Phone: ${lead.phone}
Message: ${lead.message}
`;

    await client.messages.create({
        from: process.env.TWILIO_WHATSAPP,
        to: process.env.YOUR_WHATSAPP,
        body: msg
    });
}

module.exports = sendWhatsAppLead;