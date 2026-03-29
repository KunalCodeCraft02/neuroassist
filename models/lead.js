const mongoose = require("mongoose")

const leadSchema = new mongoose.Schema({

    botId: String,

    name: String,

    email: String,

    phone: String,

    message: String,

    source: {
        type: String,
        enum: ['chat', 'form', 'widget', 'api'],
        default: 'chat'
    },

    leadScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },

    leadStatus: {
        type: String,
        enum: ['new', 'contacted', 'qualified', 'converted', 'cold'],
        default: 'new'
    },

    interestLevel: {
        type: String,
        enum: ['high', 'medium', 'low'],
        default: 'low'
    },

    engagementScore: {
        type: Number,
        default: 0
    },

    keywordsDetected: [String],

    wantsDemo: { type: Boolean, default: false },
    askedPricing: { type: Boolean, default: false },
    sharedContact: { type: Boolean, default: true },

    utm_source: String,
    utm_medium: String,
    utm_campaign: String,

    createdAt: {
        type: Date,
        default: Date.now
    }

})

module.exports = mongoose.model("Lead", leadSchema)