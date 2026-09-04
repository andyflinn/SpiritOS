// claim.js
const arg = process.argv[2];

if (!arg) {
  console.error('Usage: node claim.js <name>');
  process.exit(1);
}

fetch('http://localhost:65430/api/relay/claim', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: arg })
})
  .then(async (res) => {
    const text = await res.text();
    console.log(text);
  })
  .catch((err) => {
    console.error('Request failed:', err.message);
  });