# 📧 Email Provider Setup Guide - Multiple Options for Render

## 🎯 **Why Multiple Providers?**

Render **does not block HTTP APIs**, but some email services use SMTP which can be problematic. That's why we now support:

| Provider | Type | Best For Render? | Free Tier | Setup Difficulty |
|----------|------|-----------------|-----------|------------------|
| **SendGrid** | HTTP API | ✅ **YES** | 100 emails/day | ⭐ Easy |
| **Resend** | HTTP API | ✅ **YES** | 100 emails/day | ⭐⭐ Easy |
| **Brevo** | HTTP API | ✅ Yes | 300 emails/day | ⭐⭐ Medium |
| **SMTP** | SMTP | ⚠️ Maybe | - | ⭐⭐⭐ Hard |

---

## 🥇 **RECOMMENDED: SendGrid (Easiest for Render)**

### Why SendGrid?
- ✅ Pure HTTP API - no SMTP blocking
- ✅ Excellent deliverability
- ✅ Free tier: 100 emails/day
- ✅ Simple setup
- ✅ Best for production

### Setup Steps:

#### **1. Create SendGrid Account**
1. Go to **https://signup.sendgrid.com/**
2. Sign up (free)
3. Verify your email

#### **2. Create API Key**
1. Go to **https://app.sendgrid.com/settings/api-keys**
2. Click **"Create API Key"**
3. Name: `NeuroAssist Render`
4. Select **"Restricted Access"** (recommended) or Full Access
5. Under **"Mail Send"**, check ✅ **"Mail Send"** permission
6. Click **"Create & View"**
7. **COPY THE KEY** immediately (looks like: `SG.xxxxxxxx`)
8. Click **Done**

#### **3. Verify Sender Identity** (REQUIRED!)
SendGrid blocks emails from unverified senders.

**Option A: Single Sender Verification** (Easiest)
1. Go to **https://app.sendgrid.com/settings/sender-auth**
2. Click **"Verify a Single Sender"**
3. Fill in:
   - From Name: `NeuroAssist AI` (or your app name)
   - From Email: `noreply@neuroassist.com` (or your domain)
4. Click **"Create Template"** → Send test email
5. Check inbox → Click verification link
6. Wait 5 mins

**Option B: Domain Authentication** (Better for production)
If you have a custom domain (e.g., `yourdomain.com`):
1. Go to **https://app.sendgrid.com/settings/domain-auth**
2. Click **"Get Started"**
3. Add your domain
4. Follow DNS instructions (add CNAME records)
5. Wait for verification

#### **4. Add to Render Environment**
Render Dashboard → Your Service → Environment:

Add these variables:
```bash
SENDGRID_API_KEY=SG.your-actual-key-here
SENDER_EMAIL=noreply@yourdomain.com  # Must match verified sender
SENDER_NAME=NeuroAssist AI
```

Click **Save Changes**

#### **5. Redeploy**
- Click **Manual Deploy** in Render
- Wait 2-3 mins
- Check logs for: `✅ OTP sent successfully using SendGrid`

#### **Test:**
1. Sign up at `/signup`
2. Submit form
3. Should receive OTP email within 30 seconds ✅

---

## 🥈 **Resend - Modern Alternative**

### Why Resend?
- ✅ Designed for developers
- ✅ Beautiful API
- ✅ Excellent deliverability
- ✅ Free tier: 100 emails/day
- ✅ Webhook support

### Setup Steps:

#### **1. Create Resend Account**
1. Go to **https://resend.com/**
2. Sign up
3. Verify email

#### **2. Get API Key**
1. Go to **https://resend.com/api-keys**
2. Click **"Create API Key"**
3. Name: `NeuroAssist Render`
4. Copy the key (looks like: `re_xxxxxxxx`)

#### **3. Add Domain or Verify Email**
**For production (recommended):**
1. Go to **https://resend.com/domains**
2. Click **"Add Domain"**
3. Enter your domain (e.g., `neuroassist.com`)
4. Add DNS records as instructed
5. Wait for verification

**For testing:**
Resend's default `onboarding@resend.dev` is pre-verified, but emails come from Resend branding (not your brand).

#### **4. Add to Render Environment**
```bash
RESEND_API_KEY=re_your-actual-key-here
SENDER_EMAIL=noreply@yourdomain.com  # Your verified domain email
SENDER_NAME=NeuroAssist AI
```

#### **5. Redeploy & Test**
- Manual Deploy
- Test OTP flow
- Check Render logs

---

## 🥉 **Brevo (Sendinblue) - Backup Option**

### Why Brevo?
✅ Already integrated in your code
✅ Good free tier: 300 emails/day
⚠️ Requires sender verification
⚠️ Slightly more complex

### Setup Steps:

#### **1. Create Brevo Account**
1. Go to **https://app.brevo.com/**
2. Sign up
3. Verify email

#### **2. Get API Key**
1. Go to **https://app.brevo.com/settings/keys**
2. Click **"Create a New API Key"**
3. Name: `NeuroAssist`
4. **Permissions:** ✅ **Transactional Emails** (required!)
5. Click **Generate**
6. **COPY KEY** (looks like: `xkeysib-xxxxxxxx`)
7. Click **OK**

#### **3. Verify Sender Email**
This is **CRITICAL** - emails won't send without it!

1. Go to **https://app.brevo.com/settings/sender**
2. Check if `hyperboy022@gmail.com` or your desired sender is verified
3. **If not verified:**
   - Click **"Add a New Sender"**
   - Enter:
     - Email: `hyperboy022@gmail.com` (or your email)
     - Name: `NeuroAssist AI`
   - Click **Send Verification Email**
   - Check inbox
   - Click verification link **immediately**
   - Wait 5-10 minutes

**Important:** The sender email must match what's in your code OR what you set in `SENDER_EMAIL` env variable.

#### **4. Add to Render Environment**
```bash
BREVO_API_KEY=xkeysib-your-actual-key-here
SENDER_EMAIL=hyperboy022@gmail.com  # Must be verified in Brevo
SENDER_NAME=NeuroAssist AI
```

#### **5. Redeploy & Test**
- Manual Deploy
- Check logs: `✅ OTP sent successfully using Brevo`

---

## ⚠️ **SMTP - Last Resort (Not Recommended)**

### Why SMTP?
❌ Render may block outbound SMTP (ports 25, 465, 587)
❌ More complex
❌ Less reliable
✅ Only use if other options don't work

### Setup (Gmail Example):

#### **1. Enable 2-Factor Authentication on Gmail**
1. Go to **myaccount.google.com/security**
2. Enable 2-Step Verification
3. Click **"App Passwords"**
4. Generate password for "Mail" app
5. Copy the 16-character password

#### **2. Add SMTP Credentials to Render**
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=youremail@gmail.com
SMTP_PASS=your-16-char-app-password  # NOT your regular password!
EMAIL_FROM=youremail@gmail.com
```

#### **3. Issues with SMTP on Render**
- ❌ Port 587 might be blocked
- ❌ Google might block "less secure apps"
- ❌ Unreliable delivery

**If SMTP fails, switch to SendGrid or Resend instead!**

---

## 🎨 **What Changed - Beautiful Email Templates**

### OTP Email Template
Modern, responsive design:
- ✅ Purple gradient background
- ✅ Orange branding (#ff7518)
- ✅ Large, clear OTP code
- ✅ Professional header/footer
- ✅ Mobile responsive

### Lead Notification Emails
Beautiful cards with:
- ✅ Lead score color coding (green/red/orange)
- ✅ Dark theme matching your app
- ✅ Keyword badges
- ✅ Pro-tip section
- ✅ Call-to-action button

### Daily Summary
Clean dashboard-style:
- ✅ Stats cards with icons
- ✅ Top bots leaderboard
- ✅ Insights section
- ✅ Mobile friendly

---

## 🔄 **How Fallback Works**

If you configure **multiple** providers, the system tries in order:

```
SENDGRID_API_KEY → Resend → Brevo → SMTP
```

First provider that succeeds wins. If one fails, automatically tries next.

**Example:** If SendGrid rate-limits (429), it automatically tries Resend.

---

## 📊 **Provider Comparison**

| Feature | SendGrid | Resend | Brevo | SMTP |
|---------|----------|--------|-------|------|
| **Works on Render** | ✅ Yes | ✅ Yes | ✅ Yes | ⚠️ Maybe |
| **Free emails/day** | 100 | 100 | 300 | - |
| **Setup time** | 5 min | 5 min | 10 min | 15 min |
| **Deliverability** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| **API key auth** | ✅ | ✅ | ✅ | ❌ (SMTP) |
| **Domain verify** | Optional* | Recommended | Optional | N/A |
| **Tracking** | ✅ | ✅ | ✅ | ❌ |
| **Webhooks** | ✅ | ✅ | ✅ | ❌ |

*SendGrid: Can verify single sender (no domain) for testing

---

## ✅ **RECOMMENDATION**

### **For Render Production:**
1. **Use SendGrid** (primary) - Most reliable
2. **Add Resend** as backup - If SendGrid fails
3. **Configure both** for maximum uptime

### **Environment Variables to Set:**

```bash
# At minimum (choose ONE):
SENDGRID_API_KEY=SG.your-key-here
# OR
RESEND_API_KEY=re_your-key-here
# OR
BREVO_API_KEY=xkeysib-your-key-here

# Required:
SENDER_EMAIL=noreply@yourdomain.com
SENDER_NAME=NeuroAssist AI

# Optional (for fallback):
SMTP_HOST=...
SMTP_USER=...
SMTP_PASS=...
```

---

## 🧪 **Testing Each Provider**

### **Test SendGrid:**
```bash
# In Render Shell:
node -e "const sendOtp = require('./services/sendOtp'); sendOtp('your-email@test.com', '123456')"
```
Check logs for: `✅ OTP sent via SendGrid`

### **Check Render Logs:**
```
📮 Sending OTP to user@email.com...
🔄 Trying SendGrid...
✅ OTP sent successfully using SendGrid
```

---

## 🆘 **Troubleshooting**

### **"Provider failed: Invalid API key"**
- ❌ API key is wrong or expired
- ✅ Generate new API key from provider dashboard
- ✅ Update Render Environment Variable
- ✅ Redeploy

### **"Sender email not verified"**
- ❌ You haven't verified the sender email/domain
- ✅ Complete sender verification in provider dashboard
- ✅ Use `SENDER_EMAIL` that is verified

### **"Rate limit exceeded"**
- ❌ Free tier limit reached (SendGrid: 100/day, Resend: 100/day)
- ✅ Wait 24 hours for reset
- ✅ Upgrade to paid plan
- ✅ Add another provider as backup

### **"Email not arriving but status 200"**
- ✅ Check spam folder
- ✅ Verify sender domain has proper SPF/DKIM (advanced)
- ✅ Check provider's activity log
- ✅ Try different email (Gmail vs Outlook)

### **SMTP Connection Refused**
- ⚠️ Render blocking SMTP port
- ✅ Switch to SendGrid or Resend instead

---

## 📝 **Summary of Changes**

| File | Changed |
|------|---------|
| `services/sendOtp.js` | ✅ Complete rewrite - supports 4 providers, beautiful templates |
| `services/email.js` | ✅ Complete rewrite - multi-provider, beautiful HTML templates |
| `package.json` | ✅ Added `@sendgrid/mail` dependency |
| `.env.example` | ✅ Updated with all provider options, clear docs |

---

## 🚀 **Next Steps**

1. **Choose provider:** SendGrid (best) or Resend (also great)
2. **Setup:** Follow steps above for chosen provider
3. **Verify sender:** Critical step!
4. **Add to Render:** Set environment variables
5. **Redeploy:** Manual Deploy in Render Dashboard
6. **Test:** Sign up → Check email ✅

---

**I recommend SendGrid - it's the most reliable on Render and easiest to set up!**

**Need help?** Check Render Logs for specific error messages - they'll tell you exactly what's wrong.
