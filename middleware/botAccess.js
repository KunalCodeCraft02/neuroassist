const Bot = require("../models/bot");
const { extractDomain } = require("./domainAuth");
const jwt = require("jsonwebtoken");
const { logger } = require("../utils/logger");

/**
 * Middleware to authenticate bot access via signed token OR legacy botId
 * Also validates domain restriction
 */
async function botAccess(req, res, next) {
  try {
    let botId = null;
    let token = null;

    // 1. Check for Bearer token in Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }

    // 2. Check for token in body (for POST requests)
    if (!token && req.body && req.body.token) {
      token = req.body.token;
    }

    // 3. Check for token in query (for GET requests)
    if (!token && req.query && req.query.token) {
      token = req.query.token;
    }

    // If token is provided, verify it
    if (token) {
      try {
        const secret = process.env.EMBED_SECRET || process.env.JWT_SECRET;
        const decoded = jwt.verify(token, secret);
        botId = decoded.botId;

        // Optional: check expiry if included
        if (decoded.exp && Date.now() >= decoded.exp * 1000) {
          return res.status(401).json({
            error: "Token expired",
            message: "The embed token has expired. Please regenerate."
          });
        }
      } catch (err) {
        logger.warn(`Invalid embed token from IP ${req.ip}: ${err.message}`);
        return res.status(401).json({
          error: "Invalid token",
          message: "The embed token is invalid."
        });
      }
    } else {
      // Fallback: extract botId from params/body/query (legacy mode)
      if (req.params && req.params.botId) {
        botId = req.params.botId;
      } else if (req.params && req.params.id) {
        botId = req.params.id;
      } else if (req.body && req.body.botId) {
        botId = req.body.botId;
      } else if (req.query && req.query.botId) {
        botId = req.query.botId;
      }
    }

    if (!botId) {
      return res.status(400).json({
        error: "Bot ID required",
        message: "Bot ID is missing from request"
      });
    }

    // Fetch bot from database
    const bot = await Bot.findOne({ botId });
    if (!bot) {
      return res.status(404).json({
        error: "Bot not found",
        message: "The requested bot does not exist"
      });
    }

    // Domain validation (required for both token and legacy)
    const origin = req.headers.origin || req.headers.referer;
    if (!origin) {
      // Allow if token is valid and we trust token? For now require origin
      return res.status(403).json({
        error: "Domain verification failed",
        message: "Cannot verify request origin"
      });
    }

    const requestDomain = extractDomain(origin);
    const authorizedDomain = bot.authorizedDomain;

    if (!authorizedDomain) {
      return res.status(403).json({
        error: "Domain not authorized",
        message: "This bot has not been configured with an authorized domain. Please set up a website URL."
      });
    }

    const isAllowed =
      requestDomain === authorizedDomain ||
      requestDomain.endsWith('.' + authorizedDomain);

    if (!isAllowed) {
      logger.warn(`Domain restriction: Request from ${requestDomain} rejected for bot ${botId} (authorized: ${authorizedDomain})`);
      return res.status(403).json({
        error: "Unauthorized domain",
        message: `This bot can only be used on ${authorizedDomain}.`
      });
    }

    // Attach bot and botId to request
    req.bot = bot;
    req.botId = botId;

    next();

  } catch (err) {
    logger.error("Bot access middleware error:", err);
    return res.status(500).json({
      error: "Authentication error",
      message: "An error occurred while validating bot access"
    });
  }
}

module.exports = { botAccess };
