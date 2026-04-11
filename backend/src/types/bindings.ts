/**
 * Shared Cloudflare Worker environment bindings.
 *
 * This is the single source of truth for what bindings the Worker expects.
 * Import this type in any route or service that needs to access env bindings —
 * do not redeclare inline or cast to Record<string, unknown>.
 *
 * Production values are set via `wrangler secret put` or the CF dashboard.
 * Local dev values go in `.dev.vars` (gitignored).
 */
export interface WorkerBindings {
  DATABASE_URL: string;
  WEBHOOK_VERIFY_TOKEN: string;
  META_APP_ID: string;
  META_APP_SECRET: string;
  /** AES-256-GCM key — 64-char hex string (32 bytes). Used to encrypt access tokens at rest. */
  DATA_ENCRYPTION_KEY: string;
  /** Frontend origin allowed by the CORS middleware. Example: https://app.whatflow.io */
  ALLOWED_ORIGIN: string;
  INBOX_SYNC: DurableObjectNamespace;
  RATE_LIMITER?: {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  };
  // Optional telemetry sink — set these to forward ERROR/WARN logs externally
  TELEMETRY_URL?: string;
  TELEMETRY_TOKEN?: string;
}
