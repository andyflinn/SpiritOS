// packages/hxm/client/cli-network.js

const http = require('http');
const fs = require('fs');

const args = process.argv.slice(2);

if (args.length !== 1) {
  console.error("Usage: node client/cli-network.js <request.json>");
  console.error("Example: node client/cli-network.js test/delete-request.json");
  process.exit(1);
}

const [requestFile] = args;

try {
  const request = JSON.parse(fs.readFileSync(requestFile, 'utf-8'));

  console.log("=== Sending Request ===");
  console.dir(request, { depth: null });

  const payload = JSON.stringify({ request });   // Note: no 'state' key

  const options = {
    hostname: 'localhost',
    port: 7777,
    path: '/',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const result = JSON.parse(data);
        console.log("\n=== Server Response ===");
        console.dir(result, { depth: null });

        if (result.success) {
          console.log("\n✅ Request successful.");
        } else {
          console.error("\n❌ Request failed.");
        }
      } catch (e) {
        console.error("Failed to parse server response:");
        console.error(data);
      }
    });
  });

  req.on('error', (e) => {
    console.error("Connection error:", e.message);
    console.error("Is the server running?");
  });

  req.write(payload);
  req.end();

} catch (err) {
  console.error("Error reading request file:", err.message);
  process.exit(1);
}