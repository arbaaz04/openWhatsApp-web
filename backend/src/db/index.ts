import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

/**
 * The concrete Drizzle ORM instance type backed by postgres-js.
 * Used throughout repositories and services for type-safe query building.
 */
export type DrizzleDb = PostgresJsDatabase<typeof schema>;

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

// ---------------------------------------------------------------------------
// Factory — pure function, no side effects at module load time.
// ---------------------------------------------------------------------------

/**
 * Creates a configured Drizzle ORM instance backed by postgres-js.
 *
 * In production the `connectionString` comes from `c.env.HYPERDRIVE.connectionString`
 * — Cloudflare Hyperdrive pools and caches connections at the edge for low latency.
 *
 * For drizzle-kit migrations (run outside the Worker), set `DATABASE_URL` in your
 * environment and pass `process.env.DATABASE_URL` directly to this function.
 *
 * @param connectionString - A valid PostgreSQL connection string
 * @returns A ready-to-query Drizzle instance scoped to this request
 */
export function createDb(connectionString: string): DrizzleDb {
  if (!connectionString) {
    throw new Error(
      'A database connection string is required. ' +
      'In Workers: pass c.env.HYPERDRIVE.connectionString. ' +
      'For migrations: export DATABASE_URL before running drizzle-kit.'
    );
  }

  const client = postgres(connectionString, {
    ssl: 'require',
    // One logical connection per Worker invocation — Hyperdrive handles pooling
    // at the edge, so we don't need more than one per isolate.
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    // Disable prepare — required for Supabase Transaction mode pooler (pgBouncer/Supavisor)
    // which does not support extended query protocol over the same connection.
    prepare: false,
  });

  return drizzle(client, { schema });
}

// ---------------------------------------------------------------------------
// Module-level singleton with explicit lifecycle management.
// ---------------------------------------------------------------------------
let _db: DrizzleDb | null = null;

/**
 * Injects the shared database instance for the current request.
 * Called once per request in the index.ts middleware chain.
 * Idempotent — safe to call on every Worker request.
 */
export function setDb(instance: DrizzleDb): void {
  _db = instance;
}

/**
 * Returns the active database instance.
 * @throws {Error} if setDb() has not been called — surfaces missing init immediately.
 */
export function getDb(): DrizzleDb {
  if (!_db) {
    throw new Error(
      'Database not initialised. Call setDb(createDb(connectionString)) before making queries.'
    );
  }
  return _db;
}

/**
 * Lazy proxy — resolves to the active DB instance at call-time, not at import-time.
 * Used by repositories so module import order does not matter.
 */
export const db: DrizzleDb = new Proxy({} as DrizzleDb, {
  get(_target, prop) {
    return getDb()[prop as keyof DrizzleDb];
  },
});
