# Environment Configuration Guide for Meta/WhatsApp Integration

## Overview

This guide provides all necessary environment variables and configurations needed for the Meta/WhatsApp integration in whatflow-web.

---

## Two Integration Approaches

### Approach 1: Embedded Signup with config_id ✅ RECOMMENDED
**Same as whatflow-official-api**
- Meta's WhatsApp Embedded Signup iframe (not a popup)
- `config_id` returns `waba_id` and `phone_number_id` automatically
- Better UX (smoother flow, no popup blocking)
- **Requires:** `config_id` configured in Meta App Dashboard

### Approach 2: OAuth Popup with Auto-Discovery
**Current fallback implementation**
- Standard OAuth popup flow
- Backend auto-discovers `waba_id` and `phone_number_id` via Graph API
- Works without `config_id` configuration
- **Requires:** Only `META_APP_SECRET` configured

**Choose Approach 1 if you have/can get a config_id. If not, Approach 2 works fine.**

---

## Frontend Configuration

### File: `frontend/.env.local` (Development) or `.env.production` (Production)

#### Option A: With config_id (Embedded Signup)
```env
# Meta App ID (from your Meta app dashboard)
VITE_META_APP_ID=your_meta_app_id_here

# Meta config_id for WhatsApp Embedded Signup
# Get this from: Meta App Dashboard → Settings → Basic → config_id
# OR: Test Apps → Web/Inbox Setup → Find config_id
VITE_META_CONFIG_ID=your_meta_config_id_here

# Meta SDK Version
VITE_META_SDK_VERSION=v25.0

# Backend API URL
VITE_API_URL=http://localhost:8787         # Development
# VITE_API_URL=https://your-backend.com    # Production
```

#### Option B: Without config_id (OAuth Popup)
```env
# Meta App ID (from your Meta app dashboard)
VITE_META_APP_ID=your_meta_app_id_here

# Backend API URL
VITE_API_URL=http://localhost:8787         # Development
# VITE_API_URL=https://your-backend.com    # Production
```

### Getting Your Meta App Credentials

#### App ID
1. Go to [Facebook Developers](https://developers.facebook.com)
2. Navigate to **My Apps** → Select your app
3. Copy the **App ID** from Settings → Basic page
4. Paste it into `VITE_META_APP_ID`

#### config_id (Optional - for Embedded Signup)
1. In your Meta App Dashboard → Settings → Basic
2. Look for "WhatsApp Business Platform"
3. Find the **config_id** for your test app or business app
4. **OR** find in: Test Apps → Web/Inbox Setup → WhatsApp Embedded Signup config_id
5. Paste it into `VITE_META_CONFIG_ID`

#### Getting config_id from Meta Dashboard
```
Meta App Dashboard
  → Settings → Basic
  → WhatsApp section
  → Look for "config_id" or "Configuration ID"
    (might be in Sandbox or Production based on your app)
```

---

## Backend Configuration

### File: `backend/wrangler.json`

```json
{
  "vars": {
    "ALLOWED_ORIGIN": "http://localhost:5173",
    "SUPABASE_URL": "https://your-project.supabase.co",
    "META_APP_ID": "your_meta_app_id",
    "ENVIRONMENT": "local"
  },
  "env": {
    "production": {
      "vars": {
        "ALLOWED_ORIGIN": "https://app.whatflow.io",
        "SUPABASE_URL": "https://your-project.supabase.co",
        "META_APP_ID": "your_meta_app_id",
        "ENVIRONMENT": "production"
      },
      "hyperdrive": [
        {
          "binding": "HYPERDRIVE",
          "id": "your_hyperdrive_id"
        }
      ]
    }
  }
}
```

### File: `backend/.dev.vars` (Local Secrets - **NEVER COMMIT**)

```env
# Meta OAuth credentials (from app dashboard)
META_APP_SECRET=your_meta_app_secret_here

# Webhook verification token (create any random string, use same in Meta app config)
WEBHOOK_VERIFY_TOKEN=your_webhook_token_here

# AES-256-GCM encryption key (64-char hex string = 32 bytes)
# Generate with: openssl rand -hex 32
DATA_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# Supabase JWT secret (from Supabase dashboard → Settings → API)
SUPABASE_JWT_SECRET=your_supabase_jwt_secret_here
```

### Getting Backend Secrets

#### 1. META_APP_SECRET
- Go to Meta App Dashboard → Settings → Basic
- Copy the **App Secret** (keep it private!)

#### 2. DATA_ENCRYPTION_KEY (Generate New)
```bash
# macOS/Linux
openssl rand -hex 32

# Windows (PowerShell)
[System.Random]::new().Next(16384, 32768) | ForEach-Object { "{0:X2}" -f $_ }
```
Store this 64-character hex string securely.

#### 3. WEBHOOK_VERIFY_TOKEN
Create any random string:
```bash
openssl rand -base64 32
```

#### 4. SUPABASE_JWT_SECRET
1. Go to Supabase Dashboard
2. Select your project → Settings → API
3. Copy the **JWT Secret** from the "JWT Secret" section

---

## Meta App Configuration

### Redirect URI Setup

1. Go to Meta App Dashboard → Settings → Basic
2. Under "App Domains", add: `localhost:5173` (dev) or `app.whatflow.io` (production)
3. Under "Valid OAuth Redirect URIs", add:
   - Development: `http://localhost:5173/auth/meta-callback`
   - Production: `https://app.whatflow.io/auth/meta-callback`

### Webhook Setup (Optional for Testing)

1. In Meta App → Webhooks:
   - **Callback URL**: `https://your-backend.com/api/webhooks`
   - **Verify Token**: Use the same value as `WEBHOOK_VERIFY_TOKEN`
   - **Subscribe to fields**: `messages`, `message_template_status_update`, etc.

---

## Cloudflare Worker Configuration

### Secrets (Use `wrangler secret put`)

```bash
wrangler secret put META_APP_SECRET --env production
wrangler secret put DATA_ENCRYPTION_KEY --env production
wrangler secret put SUPABASE_JWT_SECRET --env production
wrangler secret put WEBHOOK_VERIFY_TOKEN --env production
```

Or set in `backend/wrangler.toml`:

```toml
[env.production.vars]
ALLOWED_ORIGIN = "https://app.whatflow.io"
SUPABASE_URL = "https://your-project.supabase.co"
META_APP_ID = "your_meta_app_id"
ENVIRONMENT = "production"

# Required secrets (set via `wrangler secret put`)
# META_APP_SECRET
# DATA_ENCRYPTION_KEY
# SUPABASE_JWT_SECRET
# WEBHOOK_VERIFY_TOKEN
```

---

## Verification Checklist

- [ ] `VITE_META_APP_ID` set in frontend `.env.local`
- [ ] `META_APP_ID` matches in `backend/wrangler.json`
- [ ] `META_APP_SECRET` set in `backend/.dev.vars`
- [ ] `DATA_ENCRYPTION_KEY` is 64 hex characters (openssl generated)
- [ ] `WEBHOOK_VERIFY_TOKEN` set in backend
- [ ] `SUPABASE_JWT_SECRET` set in backend
- [ ] Redirect URI configured in Meta App Dashboard
- [ ] `.dev.vars` added to `.gitignore`
- [ ] All secrets rotated in production

---

## Testing the Flow

### Local Development

1. Start frontend:
   ```bash
   cd frontend && npm run dev
   ```

2. Start backend:
   ```bash
   cd backend && npm run dev
   ```

3. Visit `http://localhost:5173`
4. Click "Connect via Meta"
5. Sign in with Meta account
6. Verify phone number entry and connection

### Production Deployment

1. Build frontend:
   ```bash
   cd frontend && npm run build
   ```

2. Deploy backend:
   ```bash
   cd backend && npm run deploy
   ```

3. Verify webhook endpoint is accessible
4. Test end-to-end flow

---

## Troubleshooting

### "Meta App ID is not configured"
- Check `VITE_META_APP_ID` in frontend `.env.local`
- Ensure file is in root of `frontend/` directory

### "Token exchange failed"
- Verify `META_APP_SECRET` is correct in `.dev.vars`
- Check Meta app is not in development mode with restrictions
- Verify redirect URI matches exactly (including trailing slash)

### "No WhatsApp Business Accounts found"
- Ensure the Meta account used for OAuth has an associated WABA
- Check that the WABA is not archived or deleted
- Verify account is not in sandbox mode without proper permissions

### Webhook not receiving messages
- Verify `WEBHOOK_VERIFY_TOKEN` matches in Meta app config
- Check backend URL is publicly accessible
- Ensure `HYPERDRIVE` binding is configured for database access
- Monitor Cloudflare Worker logs for errors

---

## API Versions

- **Frontend OAuth**: `v25.0`
- **Backend Graph API**: `v25.0`
- **Encryption**: AES-256-GCM (Node.js crypto)
- **Database**: PostgreSQL (via Hyperdrive)

Update versions in:
- `frontend/src/components/MetaSignupButton.tsx` (line with `v25.0/dialog/oauth`)
- `backend/src/services/authService.ts` (Graph API calls)
- `backend/src/utils/metaApiClient.ts` (META_API_VERSION)

---

## Security Best Practices

1. **Never commit `.dev.vars`** - Add to `.gitignore`
2. **Rotate secrets regularly** - Use `wrangler secret put` for production
3. **Use HTTPS in production** - All Meta APIs require HTTPS
4. **Encrypt tokens at rest** - Already handled by `DATA_ENCRYPTION_KEY`
5. **Validate webhook signatures** - Already implemented in webhook handler
6. **Use strong encryption keys** - Generate with `openssl rand -hex 32`

---

## Next Steps

1. Configure all environment variables as described above
2. Test the OAuth flow locally
3. Deploy to production with proper secrets management
4. Monitor logs for any errors
5. Set up monitoring for webhook failures

