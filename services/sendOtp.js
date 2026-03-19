const { Resend } = require("resend")

const resend = new Resend(process.env.RESEND_API_KEY)

async function sendOtp(email, otp){

    await resend.emails.send({

       from: "NeuroAssist <onboarding@resend.dev>",

        to: email,

        subject: "Your OTP Code",

        html: `
        <h2>Email Verification</h2>
        <p>Your OTP code is:</p>
        <h1>${otp}</h1>
        <p>This OTP will expire in 5 minutes.</p>
        `
    })

}

module.exports = sendOtp
