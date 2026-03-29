
const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
    botId: String,
    name: String,
    phone: String,
    email: String, // optional email for booking
    date: String,
    time: String,
    service: String,
    source: { type: String, default: 'voice' }, // 'voice', 'vapi-call', etc.
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Booking", bookingSchema);