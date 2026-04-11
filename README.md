# WhatFlow

**Developer-first WhatsApp Business infrastructure on the edge.**

WhatFlow is an open-source, multi-tenant backend that lets teams connect their WhatsApp Business accounts, receive and reply to messages in real time, and build automations — all running on Cloudflare's global edge network.

---

## What it does

| Capability | Detail |
|---|---|
| 📨 **Receive messages** | Verified Meta webhook with HMAC-SHA256 signature check |
| 💬 **Send messages** | Text, images, documents, video, audio, interactive buttons, list pickers, CTA URL buttons, and Flows |
| ⚡ **Real-time inbox** | WebSocket-based live inbox via Cloudflare Durable Objects with reconnect sync |
| 🔐 **Auth** | Supabase HS256 JWT verification, RBAC (admin / developer / subordinate) |
| 🏢 **Multi-tenant** | Teams, channels, and conversations isolated at the database level |
| 🔒 **Secure by default** | AES-256-GCM encrypted access tokens, strict CORS, security headers, rate limiting |
| 🔗 **WhatsApp Embedded Signup** | OAuth token exchange and phone number provisioning |

---

## Monorepo layout

```
whatflow-web/
├── backend/      Cloudflare Worker (Hono + Drizzle + Supabase)
├── frontend/     React app (Vite)  — in development
└── .github/
    └── workflows/ci.yml   CI: lint → audit → test
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | Cloudflare Workers (edge, globally distributed) |
| Framework | [Hono](https://hono.dev) + [@hono/zod-openapi](https://github.com/honojs/middleware/tree/main/packages/zod-openapi) |
| Database | Supabase Postgres via [Cloudflare Hyperdrive](https://developers.cloudflare.com/hyperdrive/) |
| ORM | [Drizzle ORM](https://orm.drizzle.team) |
| Real-time | Cloudflare Durable Objects (Hibernation API) |
| Auth | Supabase (JWT issued by Supabase Auth) |
| Encryption | AES-256-GCM (Web Crypto API) |
| Messaging API | Meta WhatsApp Cloud API v25.0 |

---

## Quick start

### Prerequisites

- Node.js ≥ 20
- A [Cloudflare account](https://dash.cloudflare.com)
- A [Supabase project](https://supabase.com)
- A [Meta Developer App](https://developers.facebook.com) with WhatsApp Business API access

### 1. Clone and install

```bash
git clone https://github.com/your-org/whatflow-web.git
cd whatflow-web
npm install
```

### 2. Set up the backend

See [`backend/README.md`](./backend/README.md) for the full setup guide including database migrations, Cloudflare secrets, and local development.

### 3. Run locally

```bash
# Backend (Wrangler dev server)
cd backend && npm run dev

# Frontend (Vite dev server) — coming soon
cd frontend && npm run dev
```

---

## CI

Every push to `main` and every pull request runs three independent jobs:

| Job | What it checks |
|---|---|
| **Lint** | ESLint with `typescript-eslint` strict rules |
| **Security Audit** | `npm audit --audit-level=high` — fails on high/critical CVEs |
| **Tests** | Vitest with 80 % coverage threshold enforcement |

---

## Contributing

Contributions are welcome. Please open an issue first for significant changes so the approach can be discussed. All PRs must pass lint, audit, and tests before they can be merged.

---

## License

MIT
