const postgres = require('/Users/arbaazmurtaza/Documents/whatflow-web/backend/node_modules/postgres');
const url = process.env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL is not set in environment");
  process.exit(1);
}

const sql = postgres(url);

async function run() {
  try {
    const rows = await sql`SELECT id, channel_id, customer_number, is_window_open, last_customer_message_at FROM conversations LIMIT 10`;
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

run();
