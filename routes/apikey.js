const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const User = require("../models/users");

// GET /api/key - Get current API key (partial for security)
router.get("/", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("apiKey apiKeyCreatedAt apiKeyLastUsed apiKeyRateLimit");

    if (!user.apiKey) {
      return res.json({
        hasApiKey: false,
        message: "No API key generated. Create one to access the API."
      });
    }

    // Return masked API key (first 6 chars + ... + last 4 chars)
    const maskedKey = user.apiKey.substring(0, 6) + '...' + user.apiKey.slice(-4);

    res.json({
      hasApiKey: true,
      apiKey: maskedKey,
      createdAt: user.apiKeyCreatedAt,
      lastUsed: user.apiKeyLastUsed,
      rateLimit: user.apiKeyRateLimit,
      documentation: "/api/docs"
    });

  } catch (err) {
    console.error("Get API key error:", err);
    res.status(500).json({
      error: "Server error",
      message: "Failed to fetch API key"
    });
  }
});

// POST /api/key/generate - Generate new API key (or regenerate)
router.post("/generate", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    // Generate new API key
    const newApiKey = user.generateApiKey();
    await user.save();

    // Log the generation
    console.log(`🔑 API key generated for user: ${user.email} at ${new Date().toISOString()}`);

    res.json({
      success: true,
      message: "New API key generated successfully",
      apiKey: newApiKey, // Full key shown only ONCE
      warning: "Save this key securely! It won't be shown again.",
      createdAt: user.apiKeyCreatedAt,
      rateLimit: user.apiKeyRateLimit
    });

  } catch (err) {
    console.error("Generate API key error:", err);
    res.status(500).json({
      error: "Server error",
      message: "Failed to generate API key"
    });
  }
});

// POST /api/key/revoke - Revoke current API key
router.post("/revoke", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user.apiKey) {
      return res.json({
        success: true,
        message: "No active API key to revoke"
      });
    }

    user.revokeApiKey();
    await user.save();

    console.log(`🗑️ API key revoked for user: ${user.email} at ${new Date().toISOString()}`);

    res.json({
      success: true,
      message: "API key revoked successfully"
    });

  } catch (err) {
    console.error("Revoke API key error:", err);
    res.status(500).json({
      error: "Server error",
      message: "Failed to revoke API key"
    });
  }
});

// POST /api/key/refresh - Alias for generate (revoke old, create new)
router.post("/refresh", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    // Revoke old key first
    user.revokeApiKey();

    // Generate new key
    const newApiKey = user.generateApiKey();
    await user.save();

    console.log(`🔄 API key refreshed for user: ${user.email} at ${new Date().toISOString()}`);

    res.json({
      success: true,
      message: "API key refreshed successfully",
      apiKey: newApiKey,
      warning: "Save this key securely! Old key is now invalid."
    });

  } catch (err) {
    console.error("Refresh API key error:", err);
    res.status(500).json({
      error: "Server error",
      message: "Failed to refresh API key"
    });
  }
});

module.exports = router;
