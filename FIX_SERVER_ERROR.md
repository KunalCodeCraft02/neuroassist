# 🚨 FIX: "Server error during signup"

## 🔍 **What This Error Means**

When you see `"Server error during signup"`, it means an **unhandled exception** occurred in the signup route. The actual error is in the **Render logs**.

---

## 📊 **Check Render Logs First**

Go to **Render Dashboard** → Your Service → **Logs**

Look for the **ACTUAL error** before "Server error during signup". You'll see something like:

```
❌ Resend Error: Invalid API key
❌ No email provider configured!
❌ MongoDB Connection Failed
```

**Tell me what error you see in the logs!** That will tell us exactly what's wrong.

---

## 🎯 **Most Likely Cause: No Email Provider Configured**

If you see: **`❌ No email provider configured!`**

**Fix:**
1. Get Resend API key: https://resend.com/api-keys
2. Add to Render Environment:
   ```
   RESEND_API_KEY=re_your-key-here
   SENDER_EMAIL=your-email@gmail.com
   SENDER_NAME=NeuroAssist AI
   ```
3. Redeploy

---

## 📋 **Common Errors & Solutions**

### **1. "No email provider configured"**
**Cause:** `RESEND_API_KEY` not set
**Fix:** Add `RESEND_API_KEY` to Render Environment

---

### **2. "Invalid API key" or 401**
**Cause:** Wrong or expired Resend API key
**Fix:**
1. Go to https://resend.com/api-keys
2. Delete old key
3. Create new key
4. Update Render Environment
5. Redeploy

---

### **3. "Smtp port blocked" or Connection timeout**
**Cause:** Trying to use SMTP (Gmail) on Render - ports are blocked
**Fix:** Use Resend instead (HTTP API, no port blocking)
- Add `RESEND_API_KEY`
- Remove SMTP variables OR keep as backup

---

### **4. MongoDB Connection Error**
**Cause:** Database not reachable
**Check:**
1. Render Environment has `MONGODB_URI` set?
2. MongoDB Atlas allows Render IP (use 0.0.0.0/0)
3. Database credentials correct

---

### **5. "Cannot find module 'resend'"**
**Cause:** Resend package not installed
**Fix:** Redeploy on Render (will install from package.json)
Or run locally: `npm install resend`

---

## 🚀 **Quick Fix Checklist**

### **Minimum Setup Required:**

In Render Environment, you NEED these:

```bash
# Database
MONGODB_URI=mongodb+srv://...

# JWT & Session (already should have)
JWT_SECRET=64+ random chars
SESSION_SECRET=64+ random chars

# Email Provider (CHOOSE ONE):
RESEND_API_KEY=re_your-key-here  ← Recommended, no domain needed!
# OR
SENDGRID_API_KEY=SG.your-key
# OR
BREVO_API_KEY=xkeysib-your-key

# Sender details (required with any provider):
SENDER_EMAIL=your-email@gmail.com
SENDER_NAME=NeuroAssist AI
```

---

## 🧪 **Test After Fixing**

1. **Redeploy** on Render (Manual Deploy)
2. Wait 2-3 minutes
3. Check **Logs** for success:
   ```
   ✅ MongoDB Connected Successfully
   📮 Attempting email with providers: Resend
   ✅ OTP sent successfully using Resend
   ```
4. Go to `/signup`
5. Submit form
6. Check email ✅

---

## 📝 **How to Debug**

### **Step 1: Look at Render Logs**
Find the line **BEFORE** `Server error during signup`. That's the real error.

Example log:
```
❌ Resend Error: Invalid API key
   Status: 401
Server error during signup
```

In this case, API key is wrong → fix that.

---

### **Step 2: Check Environment Variables**
In Render Dashboard → Environment

Run in Render Shell:
```bash
echo $RESEND_API_KEY
echo $SENDER_EMAIL
node -e "console.log('Resend check:', process.env.RESEND_API_KEY ? 'Set' : 'NOT SET')"
```

---

### **Step 3: Test Resend Manually**
Add temporary test route in `app.js`:
```javascript
app.get('/test-otp-email', async (req, res) => {
    try {
        const sendOtp = require('./services/sendOtp');
        const result = await sendOtp('your-email@gmail.com', '123456');
        res.json({ success: result, timestamp: new Date() });
    } catch (err) {
        res.json({ error: err.message, stack: err.stack });
    }
});
```

Visit: `https://your-app.onrender.com/test-otp-email`

What does it return?

---

## 🔄 **Most Common Fix Order**

1. **Add RESEND_API_KEY** → Most important!
2. **Add SENDER_EMAIL** → Your email address
3. **Redeploy** → Render needs to restart
4. **Check logs** → Should see Resend provider
5. **Test signup** → Should work

---

## 🆘 **If Still Not Working**

**Share these details:**
1. **Screenshot** of Render Environment variables (mask secrets)
2. **Full error** from Render logs (copy/paste)
3. **What provider** appears in logs? (Resend, SendGrid, Brevo, none?)
4. **Timeline:** Was it working before? What changed?

---

## ✅ **Expected After Success**

**Render Logs:**
```
📧 Sending OTP to user@gmail.com...
📮 Attempting email with providers: Resend
🔄 Trying Resend...
✅ OTP sent successfully using Resend
```

**User sees:**
- OTP email in inbox within 30 seconds ✅
- 6-digit code in beautiful email ✅
- Can enter OTP → account created ✅

---

## 🎯 **Bottom Line**

The error "Server error during signup" is **NOT a bug** - it's a symptom.

**The real cause is in the logs. Check logs → Find actual error → Fix that specific issue.**

Most likely: **You haven't set RESEND_API_KEY yet.**

➡️ **Go to Render → Environment → Add RESEND_API_KEY → Redeploy**
