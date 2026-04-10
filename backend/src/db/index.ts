import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

/**
 * Initializes the Neon HTTP Database Connection
 * Requires DATABASE_URL to be set in environment bindings
 * 
 * @param {string} databaseUrl - The Neon Postgres connection string
 * @returns Configured Drizzle ORM instance
 */
export function initializeDb(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}
