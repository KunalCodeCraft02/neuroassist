const crypto = require('crypto');

/**
 * Middleware to verify Vapi webhook signatures
 * Vapi signs webhook requests with an HMAC signature
 * Documentation: https://docs.vapi.ai/api-reference/verification
 */
function verifyVapiSignature(req, res, next) {
  const signature = req.headers['x-vapi-signature'];
  const timestamp = req.headers['x-vapi-timestamp'];
  const secret = process.env.VAPI_WEBHOOK_SECRET; // Set this in .env

  if (!secret) {
    console.warn('⚠️  VAPI_WEBHOOK_SECRET not set, skipping signature verification');
    return next();
  }

  if (!signature || !timestamp) {
    console.error('❌ Missing Vapi signature headers');
    return res.status(401).json({ error: 'Missing signature headers' });
  }

  // Recreate the signature
  const payload = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(timestamp + payload)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );

  if (!isValid) {
    console.error('❌ Invalid Vapi signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
}

module.exports = { verifyVapiSignature };
