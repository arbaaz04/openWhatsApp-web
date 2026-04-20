const crypto = require('crypto');

const secret = process.env.META_APP_SECRET;
const whatsappId = process.env.WHATSAPP_ID;
const url = process.env.BACKEND_URL + '/api/webhooks';

const payload = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [{
    id: "waba_id_placeholder",
    changes: [{
      value: {
        messaging_product: "whatsapp",
        metadata: { display_phone_number: "16315551181", phone_number_id: whatsappId },
        contacts: [{ profile: { name: "Test User" }, wa_id: "16315551181" }],
        messages: [{
          from: "16315551181",
          id: "wamid.HBgLMTYzMTU1NTExODEVAgARGBIxM0U0OEY3OTU0N0IyMjlERDQA",
          timestamp: Math.floor(Date.now() / 1000).toString(),
          text: { body: "Hello from terminal test!" },
          type: "text"
        }]
      },
      field: "messages"
    }]
  }]
});

const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');

console.log('--- Simulating Webhook ---');
console.log('Target URL:', url);
console.log('Sending payload for Phone ID:', whatsappId);

fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Hub-Signature-256': signature
  },
  body: payload
}).then(async r => {
  console.log('Response Status:', r.status);
  console.log('Response Body:', await r.text());
}).catch(e => console.error('Error:', e));
