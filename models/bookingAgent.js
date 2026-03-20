
const mongoose = require("mongoose");

const bookingAgentSchema = new mongoose.Schema({
    userId: String,
    botId: String,
    category: String,
    businessName: String,
    services: [String],
    workingDays: [String],
    startTime: String,
    endTime: String,
    slotDuration: Number,
    phoneNumber: String
});

module.exports = mongoose.model("BookingAgent", bookingAgentSchema);