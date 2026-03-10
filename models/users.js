const mongoose = require("mongoose")

const userSchema = new mongoose.Schema({

    name: String,
    companyname: String,

    email: {
        type: String,
        unique: true
    },

    plan: {
        type: String,
        default: "free"
    },

    botsLimit: {
        type: Number,
        default: 2
    },



    password: String

}, { timestamps: true })

module.exports = mongoose.model("User", userSchema)  