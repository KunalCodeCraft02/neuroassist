const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
    botId: String,
    userId: String,

    customerName: String,
    phone: String,

    date: String,
    time: String,

    status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending"
    },

    source: {
        type: String,
        default: "whatsapp"
    }

}, { timestamps: true });

// prevent double booking
bookingSchema.index({ botId: 1, date: 1, time: 1 }, { unique: true });

module.exports = mongoose.model("Booking", bookingSchema);