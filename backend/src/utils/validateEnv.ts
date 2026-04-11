import { ApiError } from './errors.js';
import type { WorkerBindings } from '../types/bindings.js';

/**
 * Required bindings that must be present for the Worker to operate.
 * Any missing binding causes an immediate 503 so the failure is visible at the
 * request boundary rather than deep inside a service call.
 */
const REQUIRED_BINDINGS: ReadonlyArray<keyof WorkerBindings> = [
  'WEBHOOK_VERIFY_TOKEN',
  'META_APP_ID',
  'META_APP_SECRET',
  'DATA_ENCRYPTION_KEY',
  'ALLOWED_ORIGIN',
  'SUPABASE_JWT_SECRET',
];

/**
 * Validates that all required Cloudflare env bindings are present and non-empty.
 * Call this at the top of the request middleware chain, before DB init or routing.
 *
 * @throws {ApiError} 503 MISCONFIGURED if any required binding is absent
 */
export function validateEnv(env: WorkerBindings): void {
  const missing = REQUIRED_BINDINGS.filter(
    (key) => !env[key] || String(env[key]).trim() === ''
  );

  if (missing.length > 0) {
    throw new ApiError(
      503,
      `Worker is misconfigured. Missing required bindings: ${missing.join(', ')}`,
      'MISCONFIGURED'
    );
  }
}
