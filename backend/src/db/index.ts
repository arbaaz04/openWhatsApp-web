import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

/**
 * The concrete Drizzle ORM instance type backed by postgres-js.
 */
export type DrizzleDb = PostgresJsDatabase<typeof schema>;

/**
 * Creates a fresh Drizzle ORM instance for a single request.
 * 
 * IMPORTANT: Cloudflare Hyperdrive requires clients to be created inside the 
 * request handler to avoid stale connections.
 *
 * @param connectionString - From c.env.HYPERDRIVE.connectionString
 * @returns A ready-to-query Drizzle instance
 */
export function createDb(connectionString: string): DrizzleDb {
  if (!connectionString) {
    throw new Error('Database connection string is missing.');
  }

  const client = postgres(connectionString, {
    ssl: false, // Internal Hyperdrive hop is non-SSL
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });

  return drizzle(client, { schema });
}
