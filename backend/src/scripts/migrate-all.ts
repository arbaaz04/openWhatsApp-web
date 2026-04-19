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
    const drizzleDir = path.join(process.cwd(), 'drizzle');
    const files = fs.readdirSync(drizzleDir)
      .filter(f => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    console.log(`Found ${files.length} migration files.`);

    // 1. Ensure drizzle infrastructure
    await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
    await sql`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL,
        created_at BIGINT
    )`;

    // 2. Clear out any old hashes that might conflict if we had a messy history
    // (Optional, but let's stick to checking if the file prefix was already applied)
    const applied = await sql`SELECT hash FROM drizzle.__drizzle_migrations`;
    const appliedHashes = new Set(applied.map(r => r.hash));

    for (const file of files) {
      const content = fs.readFileSync(path.join(drizzleDir, file), 'utf8');
      const hash = crypto.createHash('sha256').update(content).digest('hex');

      if (appliedHashes.has(hash)) {
        console.log(`Skipping ${file} (already applied)`);
        continue;
      }

      console.log(`Applying ${file}...`);
      try {
        await sql.unsafe(content);
        await sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${Date.now()})`;
        console.log(`Successfully applied ${file}`);
      } catch (err: any) {
        console.error(`!!! FAILED to apply ${file} !!!`);
        console.error('Error Code:', err.code);
        console.error('Message:', err.message);
        if (err.detail) console.error('Detail:', err.detail);
        if (err.where) console.error('Where:', err.where);
        process.exit(1);
      }
    }

    console.log('--- ALL MIGRATIONS COMPLETE ---');
    process.exit(0);
  } catch (err: any) {
    console.error('Fatal execution error:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
