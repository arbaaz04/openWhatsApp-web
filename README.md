# Whatflow Web

Developer-first WhatsApp infrastructure aggregation layer bridging developers and the Meta WhatsApp Cloud API.

## Setup Instructions

1. Clone the repository.
2. Run \`npm install\` to install monorepo dependencies.
3. Copy \`.env.example\` to \`.env\` in both frontend and backend and populate your keys.
4. Run \`npm run dev\` to start both Vite (frontend) and Wrangler (backend).

## Architecture

- **Frontend**: React (Vite) + Tailwind CSS + shadcn/ui.
- **Backend**: Cloudflare Workers + Hono.js + Neon Postgres (Drizzle).
