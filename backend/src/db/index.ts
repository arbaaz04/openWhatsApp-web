import { neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type DrizzleDb = NeonHttpDatabase<typeof schema>;

// ---------------------------------------------------------------------------
// Factory — pure function, no side effects at module load time.
// Call this once from the Worker fetch handler (or test setup) and pass the
// result to setDb() so all repositories share the same instance.
// ---------------------------------------------------------------------------

/**
 * Creates a configured Drizzle ORM instance backed by Neon serverless HTTP.
 *
 * @param databaseUrl - The Neon connection string (must be non-empty)
 * @returns A ready-to-query Drizzle instance
 * @throws {Error} if databaseUrl is empty — fail fast, not silently
 */
export function createDb(databaseUrl: string): DrizzleDb {
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is required but was not provided. ' +
      'Set the binding in wrangler.json (production) or .dev.vars (local dev).'
    );
  }
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}

// ---------------------------------------------------------------------------
// Module-level singleton with explicit lifecycle management.
// Repositories call getDb() — they never import a pre-initialised instance.
// ---------------------------------------------------------------------------
let _db: DrizzleDb | null = null;

/**
 * Injects the shared database instance.
 * Must be called before any repository function executes.
 * Idempotent — safe to call on every Worker request (Cloudflare reuses isolates).
 */
export function setDb(instance: DrizzleDb): void {
  _db = instance;
}

/**
 * Returns the active database instance.
 * @throws {Error} if setDb() was never called — surfaces configuration errors immediately.
 */
export function getDb(): DrizzleDb {
  if (!_db) {
    throw new Error(
      'Database not initialised. Call setDb(createDb(databaseUrl)) before making queries.'
    );
  }
  return _db;
}

// Convenience re-export used by repositories — forwards to getDb() at call-time,
// not at import-time, so module load order does not matter.
export const db: DrizzleDb = new Proxy({} as DrizzleDb, {
  get(_target, prop) {
    return getDb()[prop as keyof DrizzleDb];
  },
});
