const mongoose = require("mongoose")

const botSchema = new mongoose.Schema({

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    botId: {
        type: String,
        required: true
    },

    name: String,

    category: String,

    color: String,

    welcomeMessage: String,
    
    websiteUrl: String,
    websiteContent: String,
    whatsappNumber: String,

    knowledge: [String],

    createdAt: {
        type: Date,
        default: Date.now
    }

})

module.exports = mongoose.model("Bot", botSchema)