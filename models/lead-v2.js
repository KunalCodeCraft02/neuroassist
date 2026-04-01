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

    // 🔥 LEAD SCORING
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

    // 🏷️ TAGS & SEGMENTATION
    tags: [{
        type: String,
        trim: true
    }],

    customFields: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    // 📊 FUNNEL TRACKING
    funnelStage: {
        type: String,
        enum: ['awareness', 'consideration', 'decision', 'purchase'],
        default: 'awareness'
    },

    // 💰 REVENUE TRACKING
    potentialValue: {
        type: Number,
        default: 0
    },

    currency: {
        type: String,
        default: 'INR'
    },

    // 👤 ASSIGNMENT
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true
    },

    assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    // 📞 SALES ACTIVITIES
    lastContactedAt: Date,
    nextFollowUpAt: Date,
    followUpReminder: {
        type: String,
        enum: ['none', 'email', 'phone', 'both'],
        default: 'none'
    },

    // 📧 EMAIL CAMPAIGN TRACKING
    lastEmailSentAt: Date,
    emailsOpened: {
        type: Number,
        default: 0
    },
    emailsClicked: {
        type: Number,
        default: 0
    },

    // 📞 CALL LOGS (basic)
    callNotes: [{
        id: false,
        date: { type: Date, default: Date.now },
        notes: String,
        duration: Number, // in seconds
        outcome: { type: String, enum: ['answered', 'voicemail', 'no_answer', 'declined'] }
    }],

    // 🔗 SOURCE TRACKING
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

    // 🤖 BOT CONVERSATION REFERENCE
    conversationPreview: {
        type: String,
        maxlength: 500
    },

    // 📈 AUTOMATION
    isAutoAssigned: {
        type: Boolean,
        default: false
    },

    automationRulesTriggered: [{
        ruleName: String,
        triggeredAt: { type: Date, default: Date.now }
    }],

    // 📝 NOTES & ACTIVITY LOG
    notes: [{
        id: false,
        content: { type: String, required: true },
        addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        createdAt: { type: Date, default: Date.now },
        isPrivate: { type: Boolean, default: false }
    }],

    // 📅 TIMestamps
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },

    updatedAt: {
        type: Date,
        default: Date.now
    },

    // 🎯 CONVERSION TRACKING
    convertedAt: Date,
    convertedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    conversionValue: {
        type: Number,
        default: 0
    },

    // 🗑️ SOFT DELETE
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

// Cascade soft delete
leadSchema.pre('remove', async function(next) {
    if (this.isDeleted) return next();

    // Instead of actual deletion, mark as deleted
    this.isDeleted = true;
    this.deletedAt = new Date();
    await this.save();
    next();
});

module.exports = mongoose.model("Lead", leadSchema)
