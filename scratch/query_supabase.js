const supabaseUrl = "https://bfctfnsjobtpgolladon.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmY3RmbnNqb2J0cGdvbGxhZG9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4ODk4MjMsImV4cCI6MjA5MTQ2NTgyM30.KTxWjU9ugSBT54SEhq5WBOsGHGl76PwYwMvKgUnjm8Y";

async function run() {
  const url = `${supabaseUrl}/rest/v1/messages?select=*`;
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    if (!res.ok) {
      console.error("HTTP error:", res.status, await res.text());
      return;
    }
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(err);
  }
}

run();
