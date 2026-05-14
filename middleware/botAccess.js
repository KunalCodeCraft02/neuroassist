const Bot = require("../models/bot");
const { extractDomain } = require("./domainAuth");
const jwt = require("jsonwebtoken");
const { logger } = require("../utils/logger");

/**
 * ============================================
 * BOT ACCESS MIDDLEWARE
 * ============================================
 * Supports:
 * - JWT token
 * - Legacy botId
 * - Domain restriction
 */

async function botAccess(req, res, next) {

  try {

    let botId = null;
    let token = null;

    // ====================================
    // CORS HEADERS
    // ====================================

    res.header(
      "Access-Control-Allow-Origin",
      "*"
    );

    res.header(
      "Access-Control-Allow-Headers",
      "*"
    );

    res.header(
      "Access-Control-Allow-Methods",
      "*"
    );

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

        console.log(
          "✅ TOKEN BOT ID:",
          botId
        );

      } catch (err) {

        console.log(
          "❌ TOKEN ERROR:"
        );

        console.log(err);

        return res.status(401).json({

          error:
            "Invalid token",

          message:
            err.message
        });
      }

    } else {

      // ====================================
      // LEGACY BOT ID
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

      console.log(
        "❌ BOT ID MISSING"
      );

      return res.status(400).json({

        error:
          "Bot ID required",

        message:
          "Bot ID missing"
      });
    }

    // CLEAN BOT ID
    botId =
      String(botId).trim();

    console.log(
      "🔍 SEARCHING BOT:",
      botId
    );

    // ====================================
    // DEBUG DATABASE
    // ====================================

    const allBots =
      await Bot.find({})
        .select("botId name");

    console.log(
      "📦 DATABASE BOTS:"
    );

    console.log(allBots);

    // ====================================
    // FIND BOT
    // ====================================

    const bot =
      await Bot.findOne({

        botId: botId

      });

    console.log(
      "🤖 FOUND BOT:"
    );

    console.log(bot);

    if (!bot) {

      return res.status(404).json({

        error:
          "Bot not found",

        message:
          `Requested bot does not exist: ${botId}`
      });
    }

    // ====================================
    // DOMAIN VALIDATION
    // ====================================

    const origin =

      req.headers.origin ||

      req.headers.referer ||

      "";

    console.log(
      "🌍 REQUEST ORIGIN:",
      origin
    );

    // Allow localhost
    const localhostAllowed =

      origin.includes("127.0.0.1") ||

      origin.includes("localhost");

    if (!localhostAllowed) {

      const requestDomain =
        extractDomain(origin);

      const authorizedDomain =
        bot.authorizedDomain;

      console.log(
        "🌍 REQUEST DOMAIN:",
        requestDomain
      );

      console.log(
        "🔐 AUTHORIZED DOMAIN:",
        authorizedDomain
      );

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

          console.log(
            "❌ DOMAIN BLOCKED"
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

    req.botId = bot.botId;

    console.log(
      "✅ BOT ACCESS GRANTED:",
      bot.botId
    );

    next();

  } catch (err) {

    console.log(
      "🔥 BOT ACCESS ERROR:"
    );

    console.log(err);

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