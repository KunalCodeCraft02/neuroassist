const mongoose = require("mongoose")

const leadSchema = new mongoose.Schema({

    botId: String,

    name: String,
    email: String,
    phone: String,
    message: String,

    createdAt: {
        type: Date,
        default: Date.now
    }

})

module.exports = mongoose.model("Lead", leadSchema)