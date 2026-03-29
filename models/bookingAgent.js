
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
    phoneNumber: String, // Customer-facing Vapi phone number
    vapiAssistantId: String, // Vapi assistant ID
    twilioPhoneNumber: { type: String, default: null } // Deprecated - for backwards compatibility
});

module.exports = mongoose.model("BookingAgent", bookingAgentSchema);