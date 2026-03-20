const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
    user: String,
    message: String,
    room: String,
    state: String,
    district: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Chat", chatSchema);