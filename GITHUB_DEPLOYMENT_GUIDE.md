# GitHub → Cloudflare Deployment Guide

## Environment Variables Flow

### Backend (Cloudflare Workers)
Runtime secrets - set in Cloudflare dashboard or GitHub Actions:
```
META_APP_ID          → Backend (same value as frontend VITE_META_APP_ID)
META_APP_SECRET      → Backend (secret, never in frontend)
DATA_ENCRYPTION_KEY  → Backend
SUPABASE_JWT_SECRET  → Backend
```

### Frontend (Vite Build-time)
Build-time variables - must be set BEFORE `npm run build`:
```
VITE_META_APP_ID     → Frontend (same as backend's META_APP_ID - it's public)
VITE_META_CONFIG_ID  → Frontend (frontend-specific, for embedded signup)
VITE_META_SDK_VERSION → v25.0 (optional, has default)
VITE_API_URL         → Backend URL
```

## GitHub Actions Setup

### Add These to GitHub Secrets

```
Settings → Secrets and variables → Actions
```

**Shared:**
- `META_APP_ID` (used by both backend + frontend)
- `META_APP_SECRET` (backend only)
- `DATA_ENCRYPTION_KEY` (backend only)
- `SUPABASE_JWT_SECRET` (backend only)

**Frontend-specific:**
- `VITE_META_CONFIG_ID` (frontend only)

**URLs:**
- `VITE_API_URL` (e.g., `https://backend.whatflow.io`)

### GitHub Actions Workflow Example

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      # Frontend Build (with VITE_* env vars)
      - name: Build Frontend
        env:
          VITE_META_APP_ID: ${{ secrets.META_APP_ID }}
          VITE_META_CONFIG_ID: ${{ secrets.VITE_META_CONFIG_ID }}
          VITE_META_SDK_VERSION: v25.0
          VITE_API_URL: ${{ secrets.VITE_API_URL }}
        run: |
          cd frontend
          npm ci
          npm run build
      
      # Backend Deploy (with META_* env vars)
      - name: Deploy Backend to Cloudflare
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        run: |
          cd backend
          npm ci
          npx wrangler deploy \
            --env production \
            --var META_APP_ID=${{ secrets.META_APP_ID }} \
            --var META_APP_SECRET=${{ secrets.META_APP_SECRET }} \
            --var DATA_ENCRYPTION_KEY=${{ secrets.DATA_ENCRYPTION_KEY }} \
            --var SUPABASE_JWT_SECRET=${{ secrets.SUPABASE_JWT_SECRET }}
```

## Summary

| Var | Backend | Frontend | Source |
|-----|---------|----------|--------|
| `META_APP_ID` / `VITE_META_APP_ID` | ✅ | ✅ | GitHub Secret |
| `META_APP_SECRET` | ✅ | ❌ | GitHub Secret |
| `VITE_META_CONFIG_ID` | ❌ | ✅ | GitHub Secret |
| `DATA_ENCRYPTION_KEY` | ✅ | ❌ | GitHub Secret |
| `SUPABASE_JWT_SECRET` | ✅ | ❌ | GitHub Secret |
| `VITE_API_URL` | ❌ | ✅ | GitHub Secret |

## Key Points

✅ App ID is public (used in client-side SDK)  
✅ App Secret is private (backend only)  
✅ config_id is for embedded signup (frontend-specific)  
✅ All secrets safe - never committed to repo  
✅ Build-time vars (VITE_*) embedded in bundle at build time  
✅ Runtime vars (backend) injected by Cloudflare at runtime  

## Local Development

Create `frontend/.env.local`:
```env
VITE_META_APP_ID=922773537294163
VITE_META_CONFIG_ID=1448882650316876
VITE_META_SDK_VERSION=v25.0
VITE_API_URL=http://localhost:8787
```

Create `backend/.dev.vars`:
```env
META_APP_ID=922773537294163
META_APP_SECRET=your_secret_here
DATA_ENCRYPTION_KEY=your_key_here
SUPABASE_JWT_SECRET=your_jwt_here
```

Then run:
```bash
cd frontend && npm run dev    # Port 5173
cd backend && npm run dev     # Port 8787
```
