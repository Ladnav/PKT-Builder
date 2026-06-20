import https from 'https';

const url = 'https://apnvtfsmzjlwbdvrxclt.supabase.co/rest/v1/rooms';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwbnZ0ZnNtempsd2JkdnJ4Y2x0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3OTA1NzUsImV4cCI6MjA5NzM2NjU3NX0.9j8w_dkZkc6G1C6gXXtMfMPaQNrCcgJH0Iva1yBX7CI';

const data = JSON.stringify({
  code: 'TEST24',
  host_id: '8ca53bd1-912b-45c1-92be-3c9edc5ef3ed', // Invalid user ID, but we want to see the error message
  mode: 'type',
  status: 'waiting',
  max_players: 8,
  settings: { size: 8, turnTimer: 45, shinies: true, weather: false, synergy: false, items: false }
});

const req = https.request(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Prefer': 'return=representation'
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', body);
  });
});

req.on('error', console.error);
req.write(data);
req.end();
