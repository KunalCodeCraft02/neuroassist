# 🎯 Signup Server Error - Root Cause & Fix

## ❌ **Problem Identified**

**Error Message:** `"Server error during signup"`

**Root Cause:** In `services/sendOtp.js` (line 11) and `services/email.js` (line 11), the logger was imported incorrectly:

```javascript
// ❌ WRONG - imports entire module object
const logger = require('../utils/logger');
```

This imported the module as `{ logger: [WinstonLogger], loggerStream: {...} }`, so when the code called `logger.info()`, it failed because `logger` was an object, not the Winston logger instance.

**Error Stack:**
```
TypeError: logger.info is not a function
    at sendOtp (services/sendOtp.js:367:12)
    at app.js:1064:13
```

## ✅ **The Fix**

Changed the import to properly destructure the `logger` property:

```javascript
// ✅ CORRECT - destructures the logger property
const { logger } = require('../utils/logger');
```

**Files Fixed:**
- `services/sendOtp.js` (line 11)
- `services/email.js` (line 11)

## 🚀 **What to Do Now**

### 1. **Restart Your Server**

The code changes require a server restart:

```bash
# If using nodemon (development):
# It should auto-restart. If not, restart manually:
Ctrl+C   # Stop server
npm start # Start again

# If running on Render:
# Go to Render Dashboard → Manual Deploy → Deploy latest
```

### 2. **Test Signup**

After restarting, test the signup flow:

1. Go to `http://localhost:3000/signup` (or your production URL)
2. Fill in the signup form with valid data
3. Submit
4. **Expected:** OTP email sent successfully, redirect to `/verify-otp`
5. Check your email inbox for the 6-digit OTP code

### 3. **Check Logs**

Monitor the logs to confirm email sending:

**Expected success logs:**
```
📧 Sending OTP to your-email@example.com...
📮 Attempting email with providers: Resend → SendGrid → Brevo → SMTP
🔄 Trying Resend...
✅ OTP sent successfully using Resend
```

**If using Resend:**
```
✅ OTP sent via Resend to: your-email@example.com
```

## 🔍 **If Signup Still Fails**

If you still see "Server error during signup", check the logs for the actual error:

```bash
# View recent errors
tail -f logs/error.log

# Or view all logs
tail -f logs/combined.log
```

**Common issues (not related to the code fix):**

1. **Invalid Resend API Key:**
   - Get a new API key from https://resend.com/api-keys
   - Update `.env` or Render Environment: `RESEND_API_KEY=re_your-new-key`

2. **MONGODB_URI not set:**
   - Add `MONGODB_URI` to your `.env` or Render Environment

3. **Email provider not configured:**
   - Make sure one of these is set:
     - `RESEND_API_KEY` (recommended)
     - `SENDGRID_API_KEY`
     - `BREVO_API_KEY` or `BREVO_API`
     - `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`

## 📝 **Code Quality Notes**

- The bug was a classic CommonJS destructuring mistake
- All other logger imports in the codebase are correct (checked)
- No other issues found in the signup flow

---

**Fixed by:** Claude Code
**Date:** 2025-04-06
**Status:** ✅ Complete - Ready to test
