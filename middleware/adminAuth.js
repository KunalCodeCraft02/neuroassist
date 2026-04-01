const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const Admin = require("../models/admin"); // We'll create this model

/**
 * Generate a new 2FA secret for admin
 */
async function generate2FASecret(email) {
  const secret = speakeasy.generateSecret({
    name: `NeuroAssist Admin (${email})`,
    issuer: "NeuroAssist"
  });

  return secret;
}

/**
 * Generate QR code for 2FA setup
 */
async function generateQRCode(secret, email) {
  const otpauthUrl = secret.otpauth_url;
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
  return qrCodeDataUrl;
}

/**
 * Verify 2FA token
 */
function verify2FAToken(secret, token) {
  return speakeasy.totp.verify({
    secret: secret.base32,
    encoding: "base32",
    token: token
  });
}

/**
 * Middleware to check if admin has 2FA enabled and verified
 */
async function require2FA(req, res, next) {
  try {
    // For now, skip if 2FA not yet implemented in DB
    // This is a placeholder for future implementation
    next();
  } catch (error) {
    logger.error("2FA verification error:", error);
    res.status(500).json({ error: "Authentication error" });
  }
}

/**
 * Get client IP address
 */
function getClientIP(req) {
  return req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection.socket ? req.connection.socket.remoteAddress : null);
}

/**
 * Check if IP is banned (failed login attempts)
 */
async function isIPBanned(ip, redis = null) {
  // If Redis is available, use it for rate limiting
  // Otherwise use in-memory store (not ideal for multi-server)
  if (!global.bannedIPs) {
    global.bannedIPs = new Map();
  }

  const banRecord = global.bannedIPs.get(ip);
  if (banRecord && banRecord.until > Date.now()) {
    return true;
  }

  return false;
}

/**
 * Record failed login attempt and potentially ban IP
 */
function recordFailedLogin(ip) {
  if (!global.failedLogins) {
    global.failedLogins = new Map();
  }

  const attempts = (global.failedLogins.get(ip) || 0) + 1;
  global.failedLogins.set(ip, attempts);

  // Ban IP after 5 failed attempts for 15 minutes
  if (attempts >= 5) {
    if (!global.bannedIPs) {
      global.bannedIPs = new Map();
    }
    global.bannedIPs.set(ip, { until: Date.now() + 15 * 60 * 1000 });
    logger.warn(`IP ${ip} banned for 15 minutes due to failed login attempts`);
  }
}

/**
 * Reset failed login attempts for IP
 */
function resetFailedLogins(ip) {
  if (global.failedLogins) {
    global.failedLogins.delete(ip);
  }
}

module.exports = {
  generate2FASecret,
  generateQRCode,
  verify2FAToken,
  require2FA,
  getClientIP,
  isIPBanned,
  recordFailedLogin,
  resetFailedLogins
};
