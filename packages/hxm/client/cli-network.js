// packages/hxm/client/cli-network.js

const http = require('http');
const fs = require('fs');

const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error("Usage: node client/cli-network.js <state.json> <request.json>");
  process.exit(1);
}

const [stateFile, requestFile] = args;

const current = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
const request = JSON.parse(fs.readFileSync(requestFile, 'utf-8'));

const payload = JSON.stringify({ state: current, request: request });

const options = {
  hostname: 'localhost',
  port: 7777,
  path: '/transform',
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

      if (result.success) {
        console.log("=== New State from Server ===");
        console.dir(result.state, { depth: null });
        console.log("\n✅ Server transform successful.");
      } else {
        console.error("\n❌ Server transform failed:");
        console.error(result.error);
        process.exit(1);
      }
    } catch (e) {
      console.error("Failed to parse server response");
      console.error(data);
    }
  });
});

req.on('error', (e) => {
  console.error("Connection error:", e.message);
});

req.write(payload);
req.end();