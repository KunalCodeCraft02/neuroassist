# 🚨 FIX: OTP Not Sending - "Key not found" Error

## 🔍 **Problem Identified**

You're getting this error when trying to sign up:
```
BREVO ERROR: { message: 'Key not found', code: 'unauthorized' }
```

**Root cause:**
- Your email service (Brevo/Sendinblue) API key is **not configured** on Render
- OR variable name mismatch (`BREVO_API_KEY` vs `BREVO_API`)
- OR API key is invalid/expired

---

## ✅ **What I Fixed in Code**

### **File: `services/sendOtp.js`**
- ✅ Now supports **both** `BREVO_API_KEY` and `BREVO_API` variable names
- ✅ Better startup logging: shows if API key is loaded
- ✅ Detailed error messages when sending fails:
  - 401 → Invalid API key
  - 400 → Sender email not verified
  - 429 → Rate limit exceeded
- ✅ Clear indication of what to fix

### **File: `services/email.js`**
- ✅ Consistent variable name (`BREVO_API_KEY` or `BREVO_API`)
- ✅ Startup validation with helpful error if missing
- ✅ Better logging

### **File: `.env.example`**
- ✅ Added **BREVO_API_KEY** documentation
- ✅ Explained email service options (Brevo, SendGrid, or SMTP)
- ✅ Added critical note that email service is REQUIRED for OTP

---

## 🚀 **How to Fix on Render**

### **Step 1: Get Brevo API Key** (if you don't have one)

1. Go to **https://app.brevo.com** (formerly Sendinblue)
2. Sign up / Login to your account
3. Go to **Settings** → **API Keys** (or: https://app.brevo.com/settings/keys)
4. Click **Create a New API Key**
5. Name it: `NeuroAssist Production` (or anything)
6. Select **Permissions**: ✅ **Transactional Emails** (at minimum)
7. Click **Generate**
8. **Copy the API key immediately** (it won't show again)

---

### **Step 2: Add to Render Environment Variables**

1. Go to **Render Dashboard** → Your Service → **Environment**
2. Add new variable:

| Key | Value | Type |
|-----|-------|------|
| `BREVO_API_KEY` | `your-brevo-api-key-here` | Plain text |

3. **Save Changes**
4. **Trigger redeploy** (Manual Deploy button)

---

### **Step 3: Verify Sender Email is Verified in Brevo**

1. In Brevo Dashboard → **Settings** → **Senders & IP**
2. Check that `hyperboy022@gmail.com` is listed and **Verified**
3. If not verified:
   - Click **Add a New Sender**
   - Enter: `hyperboy022@gmail.com` (or your preferred sender email)
   - Brevo will send a verification email
   - Click the link in that email to verify
4. **Important:** The sender email must match what's in the code OR you can make it configurable (see "Optional" below)

---

### **Step 4: Redeploy & Test**

1. After adding `BREVO_API_KEY`, click **Manual Deploy** in Render
2. Wait for deployment to complete
3. Check Render Logs for:
   ```
   ✅ Brevo API configured (length: X)
   ```
4. Test OTP:
   - Go to `/signup`
   - Fill form + location
   - Submit
   - Check email inbox for OTP ✅

---

## 📊 **What the Logs Should Show**

**On Server Startup (Render Logs):**
```
✅ Brevo API configured (length: 65)
```

**When User Signs Up (Render Logs):**
```
📧 OTP sent to: user@example.com (MessageID: abc123...)
```

**If Still Failing:**
```
❌ Brevo OTP Error:
   Status: 401
   Response: {"message":"Key not found","code":"unauthorized"}
   💡 SOLUTION: Invalid or missing Brevo API key
```

---

## ⚙️ **Optional: Customize Sender Email**

Currently the sender email is hardcoded to `hyperboy022@gmail.com` in both:
- `services/sendOtp.js` (line 25)
- `services/email.js` (line 20)

To make it configurable:

### **Option A: Simple Change (Recommended)**
Edit `services/sendOtp.js` and `services/email.js`:

```javascript
sender: {
    email: process.env.SENDER_EMAIL || "hyperboy022@gmail.com",
    name: process.env.SENDER_NAME || "NeuroAssist"
}
```

Then add to Render Environment:
```
SENDER_EMAIL=your-verified-email@domain.com
SENDER_NAME=Your App Name
```

### **Option B: Keep as-is**
Just verify `hyperboy022@gmail.com` in Brevo and it will work.

---

## 🔄 **Alternative Email Services**

If you **don't want to use Brevo**, choose one:

### **Option 1: SendGrid**
Add to Render:
```
SENDGRID_API_KEY=your-sendgrid-api-key
```

The code will automatically use SendGrid instead (see `services/email.js` uses both).

### **Option 2: SMTP (Gmail, etc.)**
Add to Render:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password  # Use App Password, not regular password
EMAIL_FROM=noreply@yourdomain.com
```

---

## 🧪 **Testing Brevo Configuration**

Before testing full signup flow, test Brevo connection:

**Add test route temporarily** (in app.js):
```javascript
app.get('/test-email', async (req, res) => {
    try {
        const sendOtp = require('./services/sendOtp');
        const result = await sendOtp('test@example.com', '123456');
        res.json({ success: result });
    } catch (err) {
        res.json({ error: err.message });
    }
});
```

Visit: `https://your-app.onrender.com/test-email`

**Expected response:**
```json
{ "success": true }
```

Check Brevo Dashboard → **Activity** → you'll see the sent email.

---

## 🆘 **Troubleshooting**

### **Error: "Key not found"**
- ❌ API key not set in Render Environment
- ❌ Variable name typo (should be `BREVO_API_KEY`)
- ✅ **Fix:** Add `BREVO_API_KEY` to Render → Redeploy

### **Error: "Bad Email Address" or 422**
- ❌ Sender email not verified in Brevo
- ✅ **Fix:** Verify sender email in Brevo dashboard

### **Error: 401 Unauthorized**
- ❌ API key is expired or invalid
- ✅ **Fix:** Generate new API key from Brevo dashboard

### **Error: 429 Too Many Requests**
- ❌ Brevo plan limit exceeded (free plan: 300 emails/day)
- ✅ **Fix:** Upgrade Brevo plan or wait for quota reset

### **Email Not Arriving**
- ✅ Check Brevo Dashboard → **Activity** → Was email sent?
  - If **sent** → Check spam folder, or email might be blocked by provider
  - If **not sent** → Check Render logs for error
- ✅ Verify sender domain has proper SPF/DKIM records (advanced)
- ✅ Test with a different email address (gmail, yahoo, etc.)

---

## 📝 **Summary of Changes Made**

| File | Change |
|------|--------|
| `services/sendOtp.js` | Support both `BREVO_API_KEY` and `BREVO_API`, better error logging |
| `services/email.js` | Consistent variable, startup validation |
| `.env.example` | Added Brevo documentation, marked email as REQUIRED |

---

## ✅ **Action Checklist**

- [ ] Get Brevo API key from https://app.brevo.com/settings/keys
- [ ] Verify `hyperboy022@gmail.com` in Brevo (or customize sender email)
- [ ] Add `BREVO_API_KEY` to Render Environment Variables
- [ ] Redeploy on Render
- [ ] Check logs for "✅ Brevo API configured"
- [ ] Test signup → Should receive OTP email

---

## 🎯 **Expected After Fix**

1. User signs up → fills form → clicks submit
2. Render logs: `📧 OTP sent to: user@example.com (MessageID: ...)`
3. User receives email with 6-digit OTP ✅
4. User enters OTP → account created ✅

---

**Add BREVO_API_KEY to Render now and redeploy!**
