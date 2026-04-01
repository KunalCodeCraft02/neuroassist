const Bot = require("../models/bot");

/**
 * Extract domain from a URL
 * @param {string} url - The URL to extract domain from
 * @returns {string|null} - The extracted domain or null if invalid
 */
function extractDomain(url) {
    if (!url) return null;

    try {
        // Remove protocol (http://, https://, etc.)
        let domain = url.replace(/^https?:\/\//, '');

        // Remove www.
        domain = domain.replace(/^www\./, '');

        // Remove path, query string, hash
        domain = domain.split(/[/?#]/)[0];

        // Remove port if present
        domain = domain.split(':')[0];

        return domain.toLowerCase().trim();
    } catch (err) {
        console.error("Error extracting domain:", err);
        return null;
    }
}

/**
 * Middleware to validate that the request is coming from an authorized domain
 * Checks the Referer header (or Origin header for CORS scenarios) against the bot's authorized domain
 */
async function domainAuth(req, res, next) {
    try {
        let botId = null;

        // Get botId from different possible sources
        if (req.params && req.params.botId) {
            botId = req.params.botId;
        } else if (req.params && req.params.id) {
            botId = req.params.id;  // Handle /bot/:id route
        } else if (req.body && req.body.botId) {
            botId = req.body.botId;
        } else if (req.query && req.query.botId) {
            botId = req.query.botId;
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

        // Check if bot has authorized domain set
        if (!bot.authorizedDomain) {
            return res.status(403).json({
                error: "Domain not authorized",
                message: "This bot has not been configured with an authorized domain. Please set up a website URL when creating the bot."
            });
        }

        // Get the request origin from headers
        const origin = req.headers.origin;
        const referer = req.headers.referer;

        // Determine the request domain
        let requestDomain = null;

        if (origin) {
            // For CORS/API requests (better reliability)
            requestDomain = extractDomain(origin);
        } else if (referer) {
            // For browser requests
            requestDomain = extractDomain(referer);
        } else {
            // No origin/referer - could be direct API call or privacy settings
            // In production, you might want to allow this or handle differently
            // For now, we'll reject for security
            return res.status(403).json({
                error: "Domain verification failed",
                message: "Cannot verify request origin. Please ensure your browser sends referrer information."
            });
        }

        // Compare domains
        const authorizedDomain = bot.authorizedDomain.toLowerCase();

        // Check for exact match or subdomain allowance (subdomains of authorized domain are allowed)
        const isAllowed =
            requestDomain === authorizedDomain ||
            requestDomain.endsWith('.' + authorizedDomain);

        if (!isAllowed) {
            console.log(`🔒 Domain restriction: Request from ${requestDomain} rejected for bot ${botId} (authorized: ${authorizedDomain})`);

            return res.status(403).json({
                error: "Unauthorized domain",
                message: `This bot script can only be used on ${authorizedDomain}. Unauthorized use detected on ${requestDomain}.`
            });
        }

        // Attach bot to request for use in route handlers
        req.bot = bot;
        req.botId = botId;

        next();

    } catch (err) {
        console.error("Domain auth middleware error:", err);
        return res.status(500).json({
            error: "Authentication error",
            message: "An error occurred while validating domain access"
        });
    }
}

module.exports = { domainAuth, extractDomain };
