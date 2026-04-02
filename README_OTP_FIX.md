# ⚡ QUICK FIX - OTP Email Not Sending

## 🎯 Problem
```
BREVO ERROR: { message: 'Key not found', code: 'unauthorized' }
OTP sent but email not arriving
```

## ✅ Solution: Switch to SendGrid (Works on Render!)

### **3-Minute Setup:**

#### **1. Get SendGrid API Key**
1. Go to **https://app.sendgrid.com/settings/api-keys**
2. Click **"Create API Key"**
3. Name: `NeuroAssist`
4. Restrict access → ✅ **Mail Send**
5. Create → **COPY KEY** (starts with `SG.`)

#### **2. Verify Sender Email**
1. Go to **https://app.sendgrid.com/settings/sender-auth**
2. **"Verify a Single Sender"**
3. From Name: `NeuroAssist AI`
4. From Email: `noreply@neuroassist.com` (or your email)
5. Create Template → Send test to yourself
6. **Check inbox** → Click verification link ✅

#### **3. Add to Render**
Render Dashboard → Service → Environment

Add:
```bash
SENDGRID_API_KEY=SG.your-copied-key
SENDER_EMAIL=noreply@neuroassist.com  # Must match verified sender
SENDER_NAME=NeuroAssist AI
```

Click **Save Changes**

---

## 🚀 Deploy & Test

**1. Manual Deploy** (Render Dashboard)
Wait 2-3 mins

**2. Check Logs**
Look for:
```
✅ OTP sent successfully using SendGrid
```

**3. Test**
- Visit `/signup`
- Submit form
- Check email inbox ✅
- Should see beautiful OTP template

---

## 📊 What You Get

✅ **Beautiful Email Template** (Purple gradient, orange brand)
✅ **Works on Render** (HTTP API, no SMTP blocking)
✅ **Automatic Fallback** (if SendGrid fails, tries Resend/Brevo)
✅ **Free Tier** (100 emails/day)

---

## 🆘 If It Fails

| Error | Fix |
|-------|-----|
| `No email provider configured` | SENDGRID_API_KEY not set → Add it |
| `401 Invalid API key` | Wrong key → Generate new from SendGrid |
| `403 Sender not verified` | Complete Step 2 above |
| Email not arriving | Check spam, verify sender domain |

---

**That's it! SendGrid setup takes 5 minutes and solves the email problem.**

Need details? Read `EMAIL_PROVIDERS_GUIDE.md`
