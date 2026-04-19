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

let _client: ReturnType<typeof postgres> | null = null;
let _db: DrizzleDb | null = null;

/**
 * Creates or retrieves a cached Drizzle ORM instance backed by postgres-js.
 *
 * In production the `connectionString` comes from `c.env.HYPERDRIVE.connectionString`
 * — Cloudflare Hyperdrive pools and caches connections at the edge for low latency.
 *
 * We cache the Postgres client and Drizzle instance globally in the isolate
 * to prevent connection leaks across request reuses.
 *
 * @param connectionString - A valid PostgreSQL connection string
 * @returns A ready-to-query Drizzle instance
 */
export function createDb(connectionString: string): DrizzleDb {
  if (!connectionString) {
    throw new Error(
      'A database connection string is required. ' +
      'In Workers: pass c.env.HYPERDRIVE.connectionString. ' +
      'For migrations: export DATABASE_URL before running drizzle-kit.'
    );
  }

  // If already initialised for this isolate, return the cached instance
  if (_db) return _db;

  _client = postgres(connectionString, {
    // Disable SSL for the internal connection to Hyperdrive.
    // Hyperdrive itself handles the secure upstream connection to the database.
    ssl: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 5,
    prepare: false,
  });

  _db = drizzle(_client, { schema });
  return _db;
}

/**
 * Injects the shared database instance for the current request.
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
 * Includes a global error wrapper to surface more detail during failures.
 */
export const db: DrizzleDb = new Proxy({} as DrizzleDb, {
  get(_target, prop) {
    const instance = getDb();
    const value = instance[prop as keyof DrizzleDb];

    if (typeof value === 'function') {
      return (...args: any[]) => {
        try {
          return (value as (...args: any[]) => any).apply(instance, args);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          // Detect 'Failed query' and add context if possible
          if (errorMessage.includes('Failed query')) {
            throw new Error(
              `[Database Error] ${errorMessage}. Check Hyperdrive connection and SSL settings.`
            );
          }
          throw err;
        }
      };
    }
    return value;
  },
});
