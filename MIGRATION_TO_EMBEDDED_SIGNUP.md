# Migration Guide: OAuth Popup → WhatsApp Embedded Signup

This guide shows how to switch from the OAuth popup approach (current) to the WhatsApp Embedded Signup approach (like whatflow-official-api), if you have or can get a `config_id`.

## Why Switch to Embedded Signup?

### Current Implementation (OAuth Popup)
✅ Works without config_id
✅ Standard OAuth flow
❌ Popup blocking concerns
❌ User sees browser popup window
❌ Auto-discovery adds complexity

### Target Implementation (Embedded Signup)
✅ Smoother UX (iframe, not popup)
✅ Meta handles business/phone creation
✅ `config_id` returns IDs directly (no auto-discovery needed)
✅ Same as whatflow-official-api (proven approach)
✅ Cleaner backend code
❌ Requires `config_id` from Meta

---

## Step 1: Get your config_id

### Option A: Create a Test App
```
Meta App Dashboard
  → My Apps
  → Create a new Test App for WhatsApp Business
  → Settings → Basic
  → Copy config_id for WhatsApp Embedded Signup
```

### Option B: Use Existing App
```
Meta App Dashboard
  → Your existing app → Settings → Basic
  → Find WhatsApp section
  → Copy config_id (if available)
```

### Option C: Check whatflow-official-api for reference
The whatflow-official-api uses these config_ids:
- **Production**: `1914360162526811`
- **Development**: `1290889029769229`

These are specific to the whatflow-official-api app and won't work for whatflow-web.

---

## Step 2: Update Frontend Configuration

### File: `frontend/.env.local`

```env
VITE_META_APP_ID=your_meta_app_id_here
VITE_META_CONFIG_ID=your_meta_config_id_here
VITE_META_SDK_VERSION=v25.0
VITE_API_URL=http://localhost:8787
```

---

## Step 3: Update MetaSignupButton.tsx

Replace with embedded signup approach:

```typescript
import { useCallback, useRef, useState } from "react";

declare global {
  interface Window {
    FB: any;
    fbAsyncInit: () => void;
  }
}

export default function MetaSignupButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionInfoRef = useRef<{ waba_id: string; phone_number_id: string } | null>(null);

  const metaAppId = import.meta.env.VITE_META_APP_ID;
  const metaConfigId = import.meta.env.VITE_META_CONFIG_ID;

  // 1. Set up message listener for WA_EMBEDDED_SIGNUP events
  useCallback(() => {
    const sessionListener = (event: MessageEvent) => {
      if (
        event.origin !== "https://www.facebook.com" &&
        event.origin !== "https://web.facebook.com"
      ) {
        return;
      }

      try {
        const data = JSON.parse(event.data);
        if (data.type === "WA_EMBEDDED_SIGNUP") {
          if (data.event === "FINISH") {
            const { phone_number_id, waba_id } = data.data;
            console.log("Embedded signup completed:", { waba_id, phone_number_id });
            sessionInfoRef.current = { waba_id, phone_number_id };
          } else if (data.event === "CANCEL") {
            setError("WhatsApp setup was cancelled");
          } else if (data.event === "ERROR") {
            setError(`Error: ${data.data?.error_message}`);
          }
        }
      } catch {
        // Non-JSON message, ignore
      }
    };

    window.addEventListener("message", sessionListener);
    return () => window.removeEventListener("message", sessionListener);
  }, []);

  // 2. Load Facebook SDK
  useCallback(() => {
    if (window.FB) return;

    window.fbAsyncInit = function () {
      window.FB.init({
        appId: metaAppId,
        version: "v25.0",
      });
    };

    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    document.body.appendChild(script);
  }, [metaAppId]);

  // 3. FB.login callback
  const fbLoginCallback = useCallback((response: any) => {
    if (response.authResponse) {
      const code = response.authResponse.code;
      const sessionInfo = sessionInfoRef.current;

      if (sessionInfo && sessionInfo.waba_id && sessionInfo.phone_number_id) {
        // Send to backend
        submitSignup(code, sessionInfo.waba_id, sessionInfo.phone_number_id);
      } else {
        setTimeout(() => {
          const delayedInfo = sessionInfoRef.current;
          if (delayedInfo) {
            submitSignup(code, delayedInfo.waba_id, delayedInfo.phone_number_id);
          } else {
            setError("WhatsApp details not captured");
          }
        }, 2000);
      }
    } else {
      setError("Login cancelled");
    }
    setLoading(false);
  }, []);

  // 4. Submit to backend
  const submitSignup = async (code: string, wabaId: string, phoneNumberId: string) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/auth/embedded-signup`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ code, wabaId, phoneNumberId }),
        }
      );

      if (response.ok) {
        setTimeout(() => window.location.reload(), 2000);
      } else if (response.status === 409) {
        setError("Phone number already connected to another team");
      } else {
        setError("Failed to connect WhatsApp");
      }
    } catch (err) {
      setError("Connection error");
    }
    setLoading(false);
  };

  // 5. Launch embedded signup
  const handleConnect = useCallback(() => {
    if (!window.FB) {
      setError("Facebook SDK not loaded");
      return;
    }
    setError(null);
    setLoading(true);
    sessionInfoRef.current = null;

    window.FB.login(fbLoginCallback, {
      config_id: metaConfigId,
      response_type: "code",
      override_default_response_type: true,
      extras: {
        version: "v3",
        setup: { /* ... Meta setup schema ... */ },
      },
    });
  }, [fbLoginCallback, metaConfigId]);

  return (
    <div>
      <button onClick={handleConnect} disabled={loading}>
        {loading ? "Connecting..." : "Connect WhatsApp"}
      </button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
```

---

## Step 4: Simplify Backend (Optional)

Since `config_id` now provides `waba_id` and `phone_number_id`, you can remove the auto-discovery logic:

### Before (Current - with auto-discovery)
```typescript
const { accessToken, wabaId, phoneNumberId } = await authService.exchangeTokenAndDiscoverBusiness(code);
```

### After (Simplified - with config_id)
```typescript
const { wabaId, phoneNumberId } = request.body; // From frontend
const { accessToken } = await authService.exchangeToken(code);
```

---

## Step 5: Test Locally

```bash
# Frontend
cd frontend && npm run dev

# Backend
cd backend && npm run dev

# Visit http://localhost:5173
# Click "Connect WhatsApp"
# See embedded signup iframe instead of popup
```

---

## Comparison: Current vs. Embedded Signup

| Aspect | Current (OAuth) | Embedded Signup |
|--------|---|---|
| **Flow** | OAuth popup | Meta iframe |
| **Requires config_id** | ❌ | ✅ |
| **IDs from** | Backend auto-discovery | Frontend (iframe event) |
| **Popup blocking** | ⚠️ Concern | ✅ No popup |
| **UX** | Good | Better |
| **Backend complexity** | Medium | Low |
| **Graph API calls** | 3-4 | 2-3 |
| **Latency** | Medium | Fast |

---

## Rollback Instructions

If you want to revert to OAuth popup approach:

1. **Remove config_id** from `frontend/.env.local`
2. **Restore original** `MetaSignupButton.tsx` from git
3. **Keep backend** as-is (auto-discovery works for both)

---

## FAQ

### Q: Can I use both approaches simultaneously?
**A:** No. Choose one based on whether you have a `config_id`.

### Q: What if I don't have a config_id?
**A:** The current OAuth popup + auto-discovery approach works fine without one. Embedded signup requires it.

### Q: Should I migrate?
**A:** If you can get a `config_id`, the embedded signup approach is cleaner and matches whatflow-official-api. Otherwise, the current implementation is solid.

### Q: How do I get a config_id for production?
**A:** Configure a WhatsApp Business Account integration in your Meta App Dashboard → WhatsApp section → Look for config_id for your business.

---

## Support References

- **whatflow-official-api approach**: See `whatflow-official-api/web/routes/_app.connections.tsx`
- **Current approach**: See `frontend/src/components/MetaSignupButton.tsx`
- **Meta docs**: https://developers.facebook.com/docs/whatsapp/embedded-signup/overview
