# WhatFlow Backend

The core infrastructure layer for WhatFlow Web, built for scale, speed, and real-time multiplayer coordination on the edge.

## Architecture

We run entirely on Cloudflare Workers, keeping compute geographically close to end users. 

- **Routing & Validation**: [Hono](https://hono.dev/) combined with Zod for strict type checking and auto-generated OpenAPI documentation.
- **Real-time Engine**: WebSockets powered by [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/). Every WhatsApp channel gets a single, stateful Durable Object instance that fans out incoming webhooks to all connected clients.
- **Database**: PostgreSQL hosted on Supabase, connected to the edge runtime via [Cloudflare Hyperdrive](https://developers.cloudflare.com/hyperdrive/) for connection pooling and caching.
- **Data Access**: [Drizzle ORM](https://orm.drizzle.team/), strictly typed schemas.
- **Rate Limiting**: Native Cloudflare Rate Limiting (via standard Hono middleware logic) to protect public routes.

---

## Folder Structure

```text
src/
├── index.ts                 # Main Worker entrypoint
├── db/
│   ├── index.ts             # Drizzle client setup with Hyperdrive
│   └── schema.ts            # PostgreSQL schema definitions
├── durable_objects/
│   └── InboxSync.ts         # Live WebSocket fan-out for channels
├── middleware/              # Auth, RBAC, HMAC verification, CORS
├── repositories/            # Data access layer (DB operations)
├── routes/                  # API endpoints grouped by domain feature
├── services/                # Complex orchestration logic (auth, webhooks)
├── types/                   # Shared TypeScript interfaces
└── utils/                   # Shared helpers (logger, encryption, meta API client)
```

---

## Configuration & Secrets

You need to define several secrets and bindings for the Worker to run successfully.

### 1. Variables (`wrangler.json`)

Non-sensitive configuration. These can be pushed to version control.

| Variable | Description |
|---|---|
| `ALLOWED_ORIGIN` | The frontend domain (e.g., `https://app.whatflow.io` or `http://localhost:5173`) |
| `SUPABASE_URL` | Your Supabase project connection string |

### 2. Hyperdrive Binding (`wrangler.json`)

Connect the worker to the Supabase database. Add the generated configuration block after creating the Hyperdrive instance.

### 3. Secrets

Sensitive tokens must be uploaded securely, never hardcoded. Run `npx wrangler secret put <NAME>` for each:

| Secret | Description |
|---|---|
| `SUPABASE_JWT_SECRET` | Used to verify JWTs issued by Supabase Auth |
| `DATA_ENCRYPTION_KEY` | 32-byte (min) string used for AES-GCM column encryption (accessToken) |
| `WEBHOOK_VERIFY_TOKEN` | An arbitrary string you define; Meta uses this to verify webhook registration |
| `META_APP_ID` | Platform configuration required for the Embedded Signup token exchange |
| `META_APP_SECRET` | Platform configuration required for the Embedded Signup token exchange |

---

## Local Development

### Prerequisites

You need an active Supabase Postgres instance.

1. **Install dependencies:**  
   `npm install`

2. **Generate and push database schemas:**  
   `npm run db:push`

3. **Start the development server:**  
   `npm run dev`

### API Documentation

When running locally, Swagger UI is automatically available at:  
`http://localhost:8787/docs`

---

## Testing

The backend includes a comprehensive Vitest testing suite focusing heavily on repository boundary tests, middleware logic, and service orchestration.

- Run tests: `npm run test`
- Coverage enforcement is active (minimum 80% thresholds combined across files)

---

## Deploying to Production

When you're ready to deploy to Cloudflare:

1. Ensure your production Hyperdrive config is in `wrangler.json`.
2. Upload all required secrets to production (`npx wrangler secret put ...`).
3. Deploy the worker:

```bash
npm run deploy
```
