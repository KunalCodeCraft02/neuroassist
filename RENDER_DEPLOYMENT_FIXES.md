# Render Deployment Fixes - Complete Guide

## 🔍 Issues Fixed

### 1. Login Error - "Something went wrong"
**Root Cause:** Missing environment variables or MongoDB connection failure on Render.

**Fixes Applied:**
- ✅ Added startup validation for `MONGODB_URI`, `JWT_SECRET`, `SESSION_SECRET`
- ✅ Improved database connection with retry logic (3 attempts)
- ✅ Better error logging to Render logs
- ✅ Automatic process exit if critical config missing (fail fast)

### 2. Signup Location Not Fetching
**Root Cause:** Content Security Policy (CSP) blocked OpenStreetMap Nominatim API.

**Fixes Applied:**
- ✅ Updated CSP `connectSrc` to include `https://nominatim.openstreetmap.org`

---

## 📋 Required Environment Variables on Render

Go to Render Dashboard → Your Service → Environment tab:

### **Critical (Must Set):**

| Variable | Description | Example/Format |
|----------|-------------|----------------|
| `NODE_ENV` | Set to `production` | `production` |
| `MONGODB_URI` | Your MongoDB Atlas connection string | `mongodb+srv://user:pass@cluster.mongodb.net/neuroassist?retryWrites=true&w=majority` |
| `JWT_SECRET` | Random 64+ character string for JWT signing | Generate with: `openssl rand -base64 64` |
| `SESSION_SECRET` | Random 64+ character string for sessions | Generate with: `openssl rand -base64 64` |
| `RAZORPAY_KEY_SECRET` | Razorpay secret key | Your Razorpay key secret |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | Your Cloudinary name |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Your Cloudinary key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Your Cloudinary secret |
| `SENDGRID_API_KEY` **or** `SMTP_USER`/`SMTP_PASS` | Email service (at least one required) | Your email service credentials |
| `OPENAI_API_KEY` | OpenAI API key (if using) | `sk-...` |
| `EMBED_SECRET` | Secret for bot embed tokens (optional, defaults to JWT_SECRET) | Random 32+ char string |

### **Optional (But Recommended):**

| Variable | Description | Example |
|----------|-------------|---------|
| `ALLOWED_ORIGINS` | Comma-separated allowed CORS origins | `https://neuroassist-5z1k.onrender.com` (usually not needed if serving frontend from same domain) |
| `ADMIN_EMAIL` | Admin email for 2FA | `admin@yourdomain.com` |
| `ADMIN_PASSWORD` | Admin password (will be hashed on first run) | Strong password |
| `VAPI_API_KEY` | Vapi API key (for voice agents) | Your Vapi key |
| `VAPI_WEBHOOK_BASE_URL` | **CRITICAL for Vapi:** Your full Render URL | `https://neuroassist-5z1k.onrender.com` |

---

## 🔧 MongoDB Atlas Configuration

### **IMPORTANT: IP Whitelist**

Render's outbound IPs are dynamic. You have **2 options**:

#### **Option A: Allow All IPs (Recommended for testing)**
1. Go to MongoDB Atlas → Network Access
2. Click "Add IP Address"
3. Click "Allow Access from Anywhere" (0.0.0.0/0)
4. Save

⚠️ **Security Note:** For production, restrict to your specific IP ranges. But for Render, allowing 0.0.0.0/0 is common because Render's IPs change.

#### **Option B: Use VPC Peering** (Advanced)
Set up VPC peering between Render and MongoDB Atlas for secure private networking.

---

## 🚀 Deployment Checklist

### Before Deploying to Render:

1. ✅ **Update ALL environment variables** in Render dashboard with real values
   - ⚠️ Don't use placeholder values from `.env.example`
   - ⚠️ Generate proper secrets (minimum 64 chars for JWT_SECRET and SESSION_SECRET)

2. ✅ **MongoDB Atlas Setup:**
   - ✅ Create cluster (if not exists)
   - ✅ Whitelist Render IPs (0.0.0.0/0 for testing)
   - ✅ Create database user with readWrite permissions
   - ✅ Copy connection string to `MONGODB_URI`

3. ✅ **Verify CORS (if using custom domains):**
   - Set `ALLOWED_ORIGINS` to your domain(s)
   - Example: `https://app.yourdomain.com,https://yourdomain.com`

4. ✅ **Email Service:**
   - Configure SendGrid, SMTP, or Resend
   - Test email sending works

5. ✅ **Cloudinary:**
   - Upload a test image to verify connection

6. ✅ **Admin Account:**
   - Set `ADMIN_EMAIL` and `ADMIN_PASSWORD`
   - After deployment, run: `npm run create-admin` (via Render's Shell)

---

## 🐛 Troubleshooting

### **Issue: "Something went wrong" on login**

**Check Render Logs:**
1. Go to Render Dashboard → Your Service → Logs
2. Look for:
   - ❌ `MONGODB_URI is not set` → Set the variable
   - ❌ `MongoDB Connection Attempt ... Failed` → Check database credentials and IP whitelist
   - ❌ `JWT_SECRET must be set` → Set JWT_SECRET
   - ❌ `Server error during login` → Should have more details in logs

**Common Causes:**
1. **MONGODB_URI not set** → Render shows startup error and exits
2. **Wrong MongoDB credentials** → Check username/password in connection string
3. **IP not whitelisted** → Add Render IPs (or 0.0.0.0/0) to MongoDB Atlas
4. **JWT_SECRET too short** → Must be at least 32 characters (64+ recommended)
5. **SESSION_SECRET too short** → Must be at least 64 characters

**How to Debug:**
```bash
# In Render Shell (Dashboard → Shell)
echo $MONGODB_URI
node -e "console.log(process.env.JWT_SECRET?.length)"
```

### **Issue: Location not fetching on signup**

**Root Cause:** Should now be fixed with CSP update.

**If still failing:**
1. Open Browser DevTools (F12) → Console tab
2. Check for errors:
   - `Geolocation permission denied` → User blocked location permission
   - `Failed to fetch` → CSP or network issue blocking OpenStreetMap
   - `Nominatim API rate limit exceeded` → Too many requests (use local IP discovery or different geocoder)

**Test manually:**
- Open browser console on signup page
- Run: `navigator.geolocation.getCurrentPosition(console.log)`
- Should prompt for location permission

---

## 🔄 Redeploy After Fixes

1. Commit changes:
```bash
git add .
git commit -m "fix: Render deployment issues - CSP location, DB validation"
git push origin main
```

2. Render will auto-deploy (if connected to Git)

3. **OR** Manual deploy: Render Dashboard → Manual Deploy

4. Wait for deployment, check logs for ✅ `MongoDB Connected Successfully`

5. Test:
   - ✅ Signup with location fetch
   - ✅ Login
   - ✅ Home page loads

---

## 📊 What Was Changed

### File: `app.js`
- Updated Helmet CSP `connectSrc` to include `https://nominatim.openstreetmap.org`
- Added production validation for `MONGODB_URI` and `SESSION_SECRET`
- Added startup config summary logging

### File: `databaseconection/database.js`
- Replaced simple `mongoose.connect()` with retry logic (3 attempts)
- Added detailed error messages with troubleshooting steps
- Fail-fast exit if DB connection fails after retries

### File: `.env.example`
- Added Render-specific deployment notes
- Clarified IP whitelist requirement for MongoDB Atlas
- Updated variable descriptions

---

## 🆘 Still Having Issues?

1. **Share Render Logs:** Copy/paste the full logs from Render Dashboard
2. **Check Environment:** Screenshot of your Render Environment Variables (mask secrets)
3. **Test Locally with Production Config:**
```bash
# Copy .env to .env.production with Render values
cp .env .env.production
# Edit .env.production with your Render config
NODE_ENV=production MONGODB_URI="your-render-uri" ...
# Test locally
node app.js
```

---

## ✅ Success Indicators

After successful deployment, you should see in Render Logs:
```
✅ MongoDB Connected Successfully
🚀 Server running on port [PORT] in production mode
📧 Daily lead summaries will be sent at 9:00 AM every day
✅ Production configuration validated:
   - MongoDB URI: Set
   - JWT_SECRET: Set (length: 64+ chars)
   - SESSION_SECRET: Set (length: 64+ chars)
```
