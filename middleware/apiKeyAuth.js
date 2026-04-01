const User = require("../models/users");
const crypto = require("crypto");

/**
 * Middleware to authenticate API requests using user's API key
 * Supports both header and query param authentication
 *
 * Header: Authorization: Bearer <api_key>
 * Query: ?api_key=<api_key>
 */
module.exports = async function apiKeyAuth(req, res, next) {
  try {
    let apiKey = null;

    // 1. Check Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.slice(7).trim();
    }

    // 2. Check query parameter
    if (!apiKey && req.query && req.query.api_key) {
      apiKey = req.query.api_key;
    }

    // 3. Check custom header (X-API-Key)
    if (!apiKey && req.headers['x-api-key']) {
      apiKey = req.headers['x-api-key'];
    }

    if (!apiKey) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "API key required. Provide in Authorization: Bearer <key> or ?api_key=<key>"
      });
    }

    // Hash the provided key for comparison
    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    // Find user by hashed API key
    const user = await User.findOne({
      apiKeyHashed: apiKeyHash,
      isDeleted: false
    });

    if (!user) {
      return res.status(401).json({
        error: "Invalid API key",
        message: "The provided API key is invalid"
      });
    }

    // Check if API key is active
    if (!user.apiKey || !user.apiKeyHashed) {
      return res.status(401).json({
        error: "API key disabled",
        message: "Your API key has been revoked. Please generate a new one."
      });
    }

    // Check rate limiting if endpoint has specific limits
    const endpoint = req.path; // Could normalize this
    if (user.isRateLimited(endpoint)) {
      return res.status(429).json({
        error: "Rate limit exceeded",
        message: `Too many requests. Limit: ${user.apiKeyRateLimit} per hour.`
      });
    }

    // Track usage
    user.trackApiUsage(endpoint);
    user.apiKeyLastUsed = new Date();
    await user.save();

    // Attach user to request for downstream handlers
    req.apiUser = user;
    req.apiKey = apiKey; // Store original key (not hashed) for logging/audit if needed

    next();
  } catch (err) {
    console.error("API key authentication error:", err);
    return res.status(500).json({
      error: "Authentication error",
      message: "An error occurred while validating API key"
    });
  }
};

/**
 * Rate limit check middleware (optional, can be used separately)
 */
module.exports.rateLimit = async function checkRateLimit(req, res, next) {
  if (req.apiUser) {
    const endpoint = req.path;
    if (req.apiUser.isRateLimited(endpoint)) {
      return res.status(429).json({
        error: "Rate limit exceeded",
        remaining: 0,
        reset: req.apiUser.apiRateLimits.get(`rate_${endpoint}`)?.reset
      });
    }
  }
  next();
};
