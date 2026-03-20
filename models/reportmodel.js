const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema({
    messageId: String,
    reason: String,
    reportedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Report", reportSchema);