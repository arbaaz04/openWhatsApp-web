# Meta Dashboard Configuration Checklist

## Critical Settings for Embedded Signup to Work

### 1. Enable "Login with JavaScript SDK" ✅ REQUIRED
This setting is **mandatory** for the embedded signup to work!

**Where to find it:**
```
Developers.facebook.com
  → My Apps
  → [Your App]
  → Settings → Basic
  → Look for "Login with JavaScript SDK" toggle
  → Set to: YES
```

**Error you'll see if disabled:**
```
SSDK Option is Not Toggled
Please toggle the "Login with Javascript SDK" Option to Yes 
in developers.facebook.com to use the JSSDK for Login.
```

---

### 2. App ID Configuration
Your app needs these credentials configured:

**Example (yours):**
```
App ID:     2780409205639333
App Secret: [your_secret_here]
Config ID:  1448882650316876  (for embedded signup)
```

---

### 3. Valid OAuth Redirect URIs
Set these in your app settings:

**Development:**
```
http://localhost:5173
http://localhost:5173/
http://localhost:5173/auth/meta-callback
```

**Production:**
```
https://yourapp.com
https://yourapp.com/
https://yourapp.com/auth/meta-callback
```

**Where to configure:**
```
Settings → Basic → Valid OAuth Redirect URIs
```

---

### 4. App Roles
Add the following roles to your app for testing:

**Settings → Roles → Test Users:**
- Create a test user with Admin role
- Or use your own account as Admin

---

### 5. WhatsApp Business Integration
Ensure WhatsApp Business Platform is enabled:

**Settings → Basic → WhatsApp section:**
- Business App: Enabled ✅
- config_id visible ✅

**Settings → Products → WhatsApp:**
- Business Account: Connected ✅
- Test Phone Numbers: Added ✅

---

### 6. Embedded Signup URL Pattern

Our implementation uses `FB.login()` with `config_id`, which internally generates URLs like:

```
https://business.facebook.com/messaging/whatsapp/onboard/
  ?app_id=2780409205639333
  &config_id=1448882650316876
  &extras={...}
```

This matches your reference URL:
```
https://business.facebook.com/messaging/whatsapp/onboard/
  ?app_id=2780409205639333
  &config_id=1448882650316876
  &extras=%7B%22sessionInfoVersion%22%3A%223%22%2C%22version%22%3A%22v4%22%7D
```

✅ **Our implementation is correct!**

---

### 7. Facebook SDK Loading

We're using Meta's recommended async IIFE pattern:

```javascript
window.fbAsyncInit = function () {
  FB.init({
    appId: '2780409205639333',
    autoLogAppEvents: true,
    xfbml: true,
    version: 'v25.0'
  });
};

// Meta's official async IIFE pattern
(function (d, s, id) {
  var js, fjs = d.getElementsByTagName(s)[0];
  if (d.getElementById(id)) return;
  js = d.createElement(s); js.id = id;
  js.src = "https://connect.facebook.net/en_US/sdk.js";
  fjs.parentNode.insertBefore(js, fjs);
}(document, 'script', 'facebook-jssdk'));
```

✅ **Matches Meta's recommendation!**

---

## Troubleshooting

### Issue: "SSDK Option is Not Toggled"
**Fix:** Go to Settings → Basic → Toggle "Login with JavaScript SDK" to YES

### Issue: Popup doesn't appear
**Fix:** Check browser console for errors, ensure app ID is correct

### Issue: Embedded signup loads but no postMessage events
**Fix:** Verify config_id is correct in `.env.local`

### Issue: "Redirect URI Mismatch"
**Fix:** Add your current URL to Valid OAuth Redirect URIs in app settings

---

## Quick Verification

Run this in browser console to verify SDK is loaded:

```javascript
// Check if SDK loaded
console.log(window.FB ? 'SDK Loaded ✅' : 'SDK NOT loaded ❌');

// Check if initialized
window.FB.XFBML?.parse?.() // If this works, SDK is ready
```

---

## Testing Flow

1. ✅ "Login with JavaScript SDK" enabled in Meta Dashboard
2. ✅ App ID: `2780409205639333`
3. ✅ Config ID: `1448882650316876`
4. ✅ Frontend env vars set
5. ✅ Click "Connect via Meta" button
6. ✅ Embedded signup opens
7. ✅ Complete WhatsApp onboarding
8. ✅ postMessage event captured
9. ✅ Backend receives code + IDs
10. ✅ Channel connected ✅

---

## Reference

- Meta Docs: https://developers.facebook.com/docs/whatsapp/embedded-signup/overview
- JavaScript SDK: https://developers.facebook.com/docs/javascript/quickstart
- Async IIFE Pattern: Meta's official recommendation for SDK loading
