const Bot = require("../models/bot");
const { extractDomain } = require("./domainAuth");
const jwt = require("jsonwebtoken");
const { logger } = require("../utils/logger");

/**
 * Bot Access Middleware
 * Supports:
 * - JWT embed token
 * - Legacy botId
 * - Domain restriction
 */

async function botAccess(req, res, next) {

  try {

    let botId = null;
    let token = null;

    // ====================================
    // GET TOKEN
    // ====================================

    const authHeader =
      req.headers.authorization;

    if (
      authHeader &&
      authHeader.startsWith("Bearer ")
    ) {

      token =
        authHeader.slice(7);
    }

    // Token from body
    if (
      !token &&
      req.body &&
      req.body.token
    ) {

      token =
        req.body.token;
    }

    // Token from query
    if (
      !token &&
      req.query &&
      req.query.token
    ) {

      token =
        req.query.token;
    }

    // ====================================
    // VERIFY TOKEN
    // ====================================

    if (token) {

      try {

        const secret =

          process.env.EMBED_SECRET ||

          process.env.JWT_SECRET;

        if (!secret) {

          throw new Error(
            "JWT secret missing"
          );
        }

        const decoded =
          jwt.verify(
            token,
            secret
          );

        botId =
          decoded.botId;

        // Expiry check
        if (
          decoded.exp &&
          Date.now() >=
          decoded.exp * 1000
        ) {

          return res.status(401).json({

            error:
              "Token expired",

            message:
              "Embed token expired"
          });
        }

      } catch (err) {

        logger.warn(
          `❌ Invalid embed token: ${err.message}`
        );

        return res.status(401).json({

          error:
            "Invalid token",

          message:
            "Embed token invalid"
        });
      }

    } else {

      // ====================================
      // LEGACY BOT ID SUPPORT
      // ====================================

      if (
        req.params &&
        req.params.botId
      ) {

        botId =
          req.params.botId;

      } else if (
        req.params &&
        req.params.id
      ) {

        botId =
          req.params.id;

      } else if (
        req.body &&
        req.body.botId
      ) {

        botId =
          req.body.botId;

      } else if (
        req.query &&
        req.query.botId
      ) {

        botId =
          req.query.botId;
      }
    }

    // ====================================
    // VALIDATE BOT ID
    // ====================================

    if (!botId) {

      return res.status(400).json({

        error:
          "Bot ID required",

        message:
          "Bot ID missing"
      });
    }

    // ====================================
    // FIND BOT
    // ====================================

    const bot =
      await Bot.findOne({
        botId
      });

    if (!bot) {

      return res.status(404).json({

        error:
          "Bot not found",

        message:
          "Requested bot does not exist"
      });
    }

    // ====================================
    // DOMAIN VALIDATION
    // ====================================

    const origin =

      req.headers.origin ||

      req.headers.referer ||

      "";

    // Allow localhost testing
    const localhostAllowed =

      origin.includes("127.0.0.1") ||

      origin.includes("localhost");

    if (!localhostAllowed) {

      const requestDomain =
        extractDomain(origin);

      const authorizedDomain =
        bot.authorizedDomain;

      // Skip if no domain configured
      if (
        authorizedDomain &&
        requestDomain
      ) {

        const isAllowed =

          requestDomain ===
            authorizedDomain ||

          requestDomain.endsWith(
            "." + authorizedDomain
          );

        if (!isAllowed) {

          logger.warn(

            `❌ Domain blocked: ${requestDomain}`

          );

          return res.status(403).json({

            error:
              "Unauthorized domain",

            message:
              `Bot only allowed on ${authorizedDomain}`
          });
        }
      }
    }

    // ====================================
    // ATTACH BOT
    // ====================================

    req.bot = bot;
    req.botId = botId;

    next();

  } catch (err) {

    logger.error(
      "🔥 Bot access middleware error:",
      err
    );

    return res.status(500).json({

      error:
        "Authentication error",

      message:
        err.message
    });
  }
}

module.exports = {
  botAccess
};