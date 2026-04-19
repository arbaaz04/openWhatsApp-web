import postgres from 'postgres';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const sql = postgres(url, { ssl: 'require', max: 1 });

  try {
    const migrationPath = path.join(process.cwd(), 'drizzle', '0003_webhook_migration.sql');
    console.log(`Reading migration file: ${migrationPath}`);
    const content = fs.readFileSync(migrationPath, 'utf8');

    // 1. Calculate Hash for __drizzle_migrations
    const hash = crypto.createHash('sha256').update(content).digest('hex');

    console.log('--- RECONCILIATION START ---');
    
    // 2. Execute healing migration (Multiple statements, unsafe is fine here)
    console.log('Applying healing SQL...');
    await sql.unsafe(content);
    console.log('Healing SQL applied successfully.');

    // 3. Ensure drizzle schema exists
    await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;

    // 4. Ensure __drizzle_migrations table exists (standard Drizzle schema)
    await sql`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL,
        created_at BIGINT
    )`;

    // 5. Check if THIS migration (0003) is already stamped
    // We search by the tag we used: 0003_webhook_migration
    // Drizzle Kit usually tracks by id/hash. We will check if any existing row has our hash.
    const existing = await sql`SELECT * FROM drizzle.__drizzle_migrations WHERE hash = ${hash} LIMIT 1`;

    if (existing.length === 0) {
      console.log('Stamping migration 0003 in drizzle.__drizzle_migrations...');
      await sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${Date.now()})`;
      console.log('Migration stamped successfully.');
    } else {
      console.log('Migration 0003 was already stamped.');
    }

    console.log('--- RECONCILIATION COMPLETE ---');
    process.exit(0);
  } catch (err: any) {
    console.error('!!! RECONCILIATION FAILED !!!');
    console.error('Message:', err.message);
    if (err.detail) console.error('Detail:', err.detail);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
