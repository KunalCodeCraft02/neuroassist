# ⚡ RESEND QUICK START - Get OTP Working in 5 Minutes

## 🎯 **Why Resend?**

✅ **No domain verification needed** - Use your Gmail directly
✅ **Works perfectly on Render** - Pure HTTP API
✅ **Free tier:** 100 emails/day
✅ **Beautiful email templates** already built into code
✅ **Automatic fallback** to other providers if Resend fails

---

## 📋 **Setup Steps (3 Minutes)**

### **Step 1: Get Resend API Key**

1. Go to **https://resend.com/api-keys**
2. Click **"Create API Key"**
3. Name it: `NeuroAssist Render`
4. **COPY THE KEY** (starts with `re_`)
5. Keep this page open

---

### **Step 2: Add to Render Environment**

1. Go to **Render Dashboard** → Your Service
2. Click **Environment** tab
3. Add these **3 variables**:

| Key | Value | Where to get it |
|-----|-------|-----------------|
| `RESEND_API_KEY` | `re_xxxxxxxx` | From Step 1 |
| `SENDER_EMAIL` | `your-email@gmail.com` | Your personal email |
| `SENDER_NAME` | `NeuroAssist AI` | Your brand name |

**Example:**
```
RESEND_API_KEY=re_AbCdEfGhIjKlMnOpQrStUvWxYz123456
SENDER_EMAIL=kunalbodkhe080@gmail.com
SENDER_NAME=NeuroAssist AI
```

4. Click **Save Changes**

---

### **Step 3: Redeploy**

1. Render Dashboard → **Manual Deploy**
2. Wait 2-3 minutes
3. Check **Logs** for:
   ```
   ✅ Production configuration validated
   📮 Attempting email with providers: Resend
   ```

---

### **Step 4: Test OTP**

1. Go to your app: `https://your-app.onrender.com/signup`
2. Fill all fields + location
3. Click **Submit**
4. Check your email inbox (and spam folder)
5. You should receive a **beautiful OTP email** ✅

---

## 📧 **What You'll See in Your Inbox**

From: `NeuroAssist AI <your-email@gmail.com>`
Subject: `🔐 Your OTP Code - NeuroAssist`

```
╔══════════════════════════════════════════════╗
║           ✨ NeuroAssist AI                 ║
║        Email Verification Code             ║
╚══════════════════════════════════════════════╝

Hello!

Your verification code is:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    123456
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏰ This code expires in 5 minutes.

🔒 If you didn't request this verification, please ignore this email.
```

---

## ✅ **Success Indicators**

### **Render Logs:**
```
📧 Sending OTP to kunalbodkhe080@gmail.com...
📮 Attempting email with providers: Resend
🔄 Trying Resend...
✅ OTP sent successfully using Resend
```

### **Your Email:**
- ✅ Received within 30 seconds
- ✅ Beautiful purple gradient design
- ✅ Large, clear 6-digit OTP code
- ✅ From your own email address

---

## 🆘 **Troubleshooting**

### **Error: "RESEND_API_KEY not configured"**
- ❌ You didn't add `RESEND_API_KEY` to Render
- ✅ Go to Render Environment → Add it → Save → Redeploy

### **Error: "Invalid API key" or 401**
- ❌ API key copied incorrectly
- ✅ Go to resend.com/api-keys → Create new key → Copy exactly
- ✅ Update Render → Redeploy

### **Email sent but not received**
- ✅ Check **Spam** folder
- ✅ Check that `SENDER_EMAIL` matches your actual email
- ✅ Resend should accept it - check Resend dashboard activity log
- ✅ Try a different email address (Gmail vs Outlook)

### **"No email provider configured" in logs**
- ✅ Make sure `RESEND_API_KEY` is set in Render Environment
- ✅ After saving, you must **Redeploy** (saving doesn't restart)

---

## 🎯 **That's It!**

**Resend is the easiest option:**
- ✅ No domain verification
- ✅ No complex setup
- ✅ Works immediately
- ✅ Beautiful emails

---

## 🔄 **Optional: Add Backup Provider**

Once Resend is working, you can add SendGrid as backup:

1. Get SendGrid API key
2. Add `SENDGRID_API_KEY` to Render
3. System will use Resend first, fallback to SendGrid if Resend fails

---

## 📝 **Summary**

1. **Get API key:** resend.com/api-keys
2. **Add to Render:** `RESEND_API_KEY`, `SENDER_EMAIL`, `SENDER_NAME`
3. **Redeploy:** Manual Deploy
4. **Test:** Signup → Check email ✅

---

**Total time: 5 minutes. Go do it now! 🚀**

Need help? Check Render logs - they'll show exactly what's happening.
