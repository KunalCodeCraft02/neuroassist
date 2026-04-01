const mongoose = require("mongoose")

const leadSchema = new mongoose.Schema({

    botId: {
        type: String,
        required: true,
        index: true
    },

    name: {
        type: String,
        default: "Unknown",
        trim: true
    },

    email: {
        type: String,
        trim: true,
        lowercase: true
    },

    phone: {
        type: String,
        trim: true
    },

    company: {
        type: String,
        trim: true
    },

    message: {
        type: String
    },

    leadScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
        index: true
    },

    leadStatus: {
        type: String,
        enum: ['new', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'converted', 'lost', 'cold'],
        default: 'new',
        index: true
    },

    interestLevel: {
        type: String,
        enum: ['high', 'medium', 'low', 'none'],
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

    tags: [{
        type: String,
        trim: true
    }],

    customFields: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    funnelStage: {
        type: String,
        enum: ['awareness', 'consideration', 'decision', 'purchase'],
        default: 'awareness'
    },

    potentialValue: {
        type: Number,
        default: 0
    },

    currency: {
        type: String,
        default: 'INR'
    },

    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true
    },

    assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    lastContactedAt: Date,
    nextFollowUpAt: Date,
    followUpReminder: {
        type: String,
        enum: ['none', 'email', 'phone', 'both'],
        default: 'none'
    },

    lastEmailSentAt: Date,
    emailsOpened: {
        type: Number,
        default: 0
    },
    emailsClicked: {
        type: Number,
        default: 0
    },

    callNotes: [{
        date: { type: Date, default: Date.now },
        notes: String,
        duration: Number,
        outcome: { type: String, enum: ['answered', 'voicemail', 'no_answer', 'declined'] }
    }],

    source: {
        type: String,
        enum: ['website', 'social_media', 'referral', 'email_campaign', 'paid_ads', 'organic', 'other'],
        default: 'website'
    },

    utm_source: String,
    utm_medium: String,
    utm_campaign: String,
    utm_content: String,
    utm_term: String,

    conversationPreview: {
        type: String,
        maxlength: 500
    },

    isAutoAssigned: {
        type: Boolean,
        default: false
    },

    automationRulesTriggered: [{
        ruleName: String,
        triggeredAt: { type: Date, default: Date.now }
    }],

    notes: [{
        content: { type: String, required: true },
        addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        createdAt: { type: Date, default: Date.now },
        isPrivate: { type: Boolean, default: false }
    }],

    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },

    updatedAt: {
        type: Date,
        default: Date.now
    },

    convertedAt: Date,
    convertedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    conversionValue: {
        type: Number,
        default: 0
    },

    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    },

    deletedAt: Date

})

// Index for common queries
leadSchema.index({ leadStatus: 1, createdAt: -1 });
leadSchema.index({ assignedTo: 1, nextFollowUpAt: 1 });
leadSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $exists: true, $ne: '' } } });
leadSchema.index({ phone: 1 }, { unique: true, partialFilterExpression: { phone: { $exists: true, $ne: '' } } });
leadSchema.index({ tags: 1 });
leadSchema.index({ leadScore: -1 });

// Update updatedAt on save
leadSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model("Lead", leadSchema)
