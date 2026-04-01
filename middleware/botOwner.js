const Bot = require("../models/bot");

/**
 * Middleware to verify that the logged-in user owns the bot
 * Usage: app.get("/route/:botId", auth, botOwner, async (req, res) => { ... })
 */
module.exports = async function botOwner(req, res, next) {
  try {
    const { botId } = req.params;

    if (!botId) {
      return res.status(400).json({
        error: "Bot ID required",
        message: "Bot ID is missing from request"
      });
    }

    // Validate ObjectId format
    if (!/^[0-9a-fA-F]{24}$/.test(botId)) {
      return res.status(400).json({
        error: "Invalid Bot ID",
        message: "The provided bot ID is invalid"
      });
    }

    // Verify bot exists and belongs to current user
    const bot = await Bot.findOne({
      botId: botId,
      userId: req.user.id
    });

    if (!bot) {
      logger = require("../utils/logger").logger;
      logger.warn(`Access denied: User ${req.user.id} attempted to access bot ${botId} that they don't own`);
      return res.status(403).json({
        error: "Access denied",
        message: "You don't have permission to access this bot"
      });
    }

    // Attach bot to request for convenience
    req.bot = bot;
    next();
  } catch (err) {
    const logger = require("../utils/logger").logger;
    logger.error("Bot ownership middleware error:", err);
    return res.status(500).json({
      error: "Authentication error",
      message: "An error occurred while verifying bot ownership"
    });
  }
};
