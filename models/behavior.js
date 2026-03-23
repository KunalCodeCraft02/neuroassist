const mongoose = require("mongoose");

const behaviorSchema = new mongoose.Schema({
    botId: String,  
    userId: String,
    page: String,
    action: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Behavior", behaviorSchema);