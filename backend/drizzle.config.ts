import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit configuration for schema migrations.
 *
 * Usage:
 *   Generate migration files:  npx drizzle-kit generate
 *   Apply to database:         npx drizzle-kit migrate
 *   Push schema directly:      npx drizzle-kit push (dev only — skips migration files)
 *
 * Production workflow:
 *   1. Edit schema.ts
 *   2. Run `npx drizzle-kit generate` — creates a SQL file in ./drizzle/
 *   3. Commit the migration file alongside the schema change
 *   4. Run `npx drizzle-kit migrate` in your deploy pipeline (or a one-off CF Worker)
 *
 * The DATABASE_URL must be set in your environment before running any drizzle-kit command.
 * For local dev: export DATABASE_URL="postgres://..."
 */
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? (() => { throw new Error('DATABASE_URL is not set'); })(),
  },
  verbose: true,
  strict: true,
});
