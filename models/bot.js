const mongoose = require("mongoose")

const botSchema = new mongoose.Schema({

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    botId: {
        type: String,
        required: true,
        unique: true
    },

    name: {
        type: String,
        required: true,
        trim: true
    },

    category: {
        type: String,
        enum: ['support', 'sales', 'general', 'booking', 'custom'],
        default: 'general'
    },

    color: {
        type: String,
        default: '#ff7518'
    },

    welcomeMessage: {
        type: String,
        default: 'Hello! How can I help you today?'
    },

    // 🏠 DOMAIN MANAGEMENT
    websiteUrl: {
        type: String,
        trim: true
    },

    authorizedDomain: {
        type: String,
        index: true
    },

    allowedSubdomains: {
        type: Boolean,
        default: true
    },

    customDomains: {
        type: [String],
        default: []
    },

    // 🤖 TRAINING & AI CONFIGURATION
    websiteContent: String,

    knowledge: [String],

    trainingData: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    contextWindow: {
        type: Number,
        default: 4096,
        min: 1024,
        max: 128000
    },

    temperature: {
        type: Number,
        min: 0.1,
        max: 1.0,
        default: 0.7
    },

    systemPrompt: {
        type: String,
        maxlength: 4000
    },

    // 📊 ANALYTICS & PRIVACY
    trackConversations: {
        type: Boolean,
        default: true
    },

    trackIPAddress: {
        type: Boolean,
        default: true
    },

    anonymizeIP: {
        type: Boolean,
        default: false
    },

    // 🎯 LEAD MANAGEMENT
    leadCaptureForm: {
        type: mongoose.Schema.Types.Mixed,
        default: {
            enabled: false,
            fields: ['name', 'email', 'phone'],
            requiredFields: ['email']
        }
    },

    autoRespondToLeads: {
        type: Boolean,
        default: true
    },

    leadNotificationEmail: {
        type: [String],
        default: []
    },

    leadWebhookURL: {
        type: String,
        trim: true
    },

    leadWebhookSecret: {
        type: String
    },

    leadQualificationEnabled: {
        type: Boolean,
        default: true
    },

    // 🔗 INTEGRATIONS
    webhookURL: {
        type: String,
        trim: true
    },

    webhookSecret: {
        type: String
    },

    calendarIntegration: {
        type: {
          calendarType: {
            type: String,
            enum: ['google', 'outlook', 'calendly', 'none']
          },
          calendarUrl: String,
          apiKey: String
        },
        default: { calendarType: 'none' }
    },

    paymentIntegration: {
        type: {
          provider: {
            type: String,
            enum: ['razorpay', 'stripe', 'paypal', 'none']
          },
          apiKey: String,
          secret: String
        },
        default: { provider: 'none' }
    },

    emailIntegration: {
        type: {
          provider: {
            type: String,
            enum: ['sendgrid', 'mailgun', 'aws-ses', 'none']
          },
          apiKey: String
        },
        default: { provider: 'none' }
    },

    // 🎨 CUSTOMIZATION
    chatPosition: {
        type: String,
        enum: ['right', 'left'],
        default: 'right'
    },

    chatColor: {
        type: String,
        default: '#ff7518'
    },

    chatAvatar: {
        type: String,
        default: ''
    },

    greetingDelay: {
        type: Number,
        default: 2,
        min: 0,
        max: 10,
        description: 'Seconds before first greeting appears'
    },

    autoOpen: {
        type: Boolean,
        default: false
    },

    autoOpenDelay: {
        type: Number,
        default: 5,
        min: 1,
        max: 30
    },

    requireEmailBeforeChat: {
        type: Boolean,
        default: false
    },

    // 📝 RESPONSE RULES
    fallbackMessage: {
        type: String,
        default: "I'm sorry, I don't have that information. Would you like to speak with a human?"
    },

    escalationKeyword: {
        type: [String],
        default: ['human', 'agent', 'speak to', 'talk to', 'representative']
    },

    businessHours: {
        type: {
          start: String,
          end: String,
          timezone: String,
          days: [Number] // 0-6, Sunday=0
        },
        default: {
          start: '09:00',
          end: '18:00',
          timezone: 'Asia/Kolkata',
          days: [1, 2, 3, 4, 5, 6] // Mon-Sat
        }
    },

    outOfHoursMessage: {
        type: String,
        default: "We're currently closed. Our business hours are 9 AM - 6 PM, Monday through Saturday. Please leave a message and we'll get back to you soon.",
    },

    // 🌍 MULTI-LANGUAGE
    defaultLanguage: {
        type: String,
        default: 'en',
        length: 2
    },

    supportedLanguages: {
        type: [String],
        default: ['en']
    },

    autoDetectLanguage: {
        type: Boolean,
        default: false
    },

    // 👥 TEAM & COLLABORATION
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    notificationEmails: {
        type: [String],
        default: []
    },

    internalNotes: {
        type: String,
        maxlength: 2000
    },

    // 📈 STATUS & VERSIONING
    status: {
        type: String,
        enum: ['active', 'paused', 'archived'],
        default: 'active',
        index: true
    },

    version: {
        type: Number,
        default: 1
    },

    // 📅 TIMESTAMPS
    updatedAt: {
        type: Date,
        default: Date.now
    }

}, {
    timestamps: true // Automatically adds createdAt and updatedAt
});

// Update updatedAt on save
botSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Index for common queries
botSchema.index({ userId: 1, status: 1 });
botSchema.index({ status: 1, createdAt: -1 });
botSchema.index({ 'leadNotificationEmail': 1 });

module.exports = mongoose.model("Bot", botSchema)

module.exports = mongoose.model("Bot", botSchema)