
const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
    botId: String,
    name: String,
    phone: String,
    date: String,
    time: String,
    service: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Booking", bookingSchema);