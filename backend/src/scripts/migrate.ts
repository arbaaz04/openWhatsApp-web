import postgres from 'postgres';
import fs from 'node:fs';
import path from 'node:path';

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

    console.log('Applying migration 0003 manually...');
    
    // We execute the entire file content. 
    // Since it contains multiple statements, we use the raw executor.
    await sql.unsafe(content);

    console.log('Migration 0003 applied successfully!');
    process.exit(0);
  } catch (err: any) {
    console.error('--- MIGRATION FAILED ---');
    console.error('Error Code:', err.code);
    console.error('Message:', err.message);
    if (err.detail) console.error('Detail:', err.detail);
    if (err.hint) console.error('Hint:', err.hint);
    if (err.where) console.error('Where:', err.where);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
