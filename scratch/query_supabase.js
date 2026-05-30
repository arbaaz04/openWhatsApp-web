const supabaseUrl = "https://bfctfnsjobtpgolladon.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmY3RmbnNqb2J0cGdvbGxhZG9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4ODk4MjMsImV4cCI6MjA5MTQ2NTgyM30.KTxWjU9ugSBT54SEhq5WBOsGHGl76PwYwMvKgUnjm8Y";

async function run() {
  try {
    const channelsRes = await fetch(`${supabaseUrl}/rest/v1/channels?select=*`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    const conversationsRes = await fetch(`${supabaseUrl}/rest/v1/conversations?select=*`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    console.log("CHANNELS:");
    console.log(await channelsRes.json());
    console.log("\nCONVERSATIONS:");
    console.log(await conversationsRes.json());
  } catch (err) {
    console.error(err);
  }
}

run();
