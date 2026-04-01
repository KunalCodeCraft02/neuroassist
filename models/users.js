const mongoose = require("mongoose")
const crypto = require("crypto");

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
    state: String,
    district: String,
    photo: String,
    bio:String,
    skills:String,
    github:String,
    linkedin:String,
    role:String,

    password: String,

    // 🔑 API KEY FOR PROGRAMMATIC ACCESS
    apiKey: {
        type: String,
        index: true,
        sparse: true
    },

    apiKeyHashed: {
        type: String,
        index: true,
        sparse: true
    },

    apiKeyCreatedAt: {
        type: Date
    },

    apiKeyLastUsed: {
        type: Date
    },

    apiKeyRateLimit: {
        type: Number,
        default: 100, // requests per hour
        min: 10,
        max: 10000
    },

    // Rate limiting storage per endpoint
    apiRateLimits: {
        type: Map,
        of: {
            count: Number,
            reset: Date
        },
        default: {}
    }

}, { timestamps: true })

// Generate a new API key for user
userSchema.methods.generateApiKey = function() {
    const apiKey = 'nk_' + crypto.randomBytes(32).toString('hex'); // 64 chars total with prefix
    this.apiKey = apiKey; // Store plain temporarily for user to see once
    this.apiKeyHashed = crypto.createHash('sha256').update(apiKey).digest('hex');
    this.apiKeyCreatedAt = new Date();
    this.apiKeyLastUsed = null;
    return apiKey;
};

// Verify API key
userSchema.methods.verifyApiKey = function(providedKey) {
    if (!this.apiKeyHashed) return false;
    const hashed = crypto.createHash('sha256').update(providedKey).digest('hex');
    return this.apiKeyHashed === hashed;
};

// Revoke API key
userSchema.methods.revokeApiKey = function() {
    this.apiKey = null;
    this.apiKeyHashed = null;
    this.apiKeyCreatedAt = null;
    this.apiKeyLastUsed = null;
};

// Check if API key is valid (not expired, within rate limit)
userSchema.methods.isApiKeyValid = function() {
    if (!this.apiKeyHashed) return false;
    // Could add expiration logic here if needed
    return true;
};

// Increment rate limit counter
userSchema.methods.trackApiUsage = function(endpoint = 'general') {
    const key = `rate_${endpoint}`;
    const now = new Date();

    if (!this.apiRateLimits.has(key)) {
        this.apiRateLimits.set(key, {
            count: 1,
            reset: new Date(now.getTime() + 60 * 60 * 1000) // 1 hour from now
        });
    } else {
        const limit = this.apiRateLimits.get(key);
        if (now > limit.reset) {
            // Reset the counter
            this.apiRateLimits.set(key, {
                count: 1,
                reset: new Date(now.getTime() + 60 * 60 * 1000)
            });
        } else {
            limit.count += 1;
        }
    }

    return this.apiRateLimits.get(key);
};

// Check if rate limit exceeded
userSchema.methods.isRateLimited = function(endpoint = 'general') {
    const key = `rate_${endpoint}`;
    const limit = this.apiRateLimits.get(key);

    if (!limit) return false;

    const now = new Date();
    if (now > limit.reset) {
        // Reset expired limit
        this.apiRateLimits.delete(key);
        return false;
    }

    return limit.count >= this.apiKeyRateLimit;
};

module.exports = mongoose.model("User", userSchema)
  