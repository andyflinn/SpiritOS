// packages/hxm/server.js
const http = require('http');
const { applyTransform } = require('./src/core.js');
const { coreTypes } = require('./src/types/registry.js');

const PORT = 7777;

const server = http.createServer((req, res) => {
  // CORS support for browser testing
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/') {
    let body = '';

    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);

        // Bootstrap request: empty object → return types + current state
        if (!payload || Object.keys(payload).length === 0 || !payload.state) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            types: coreTypes,
            state: (payload && payload.state) ? payload.state : {}
          }));
          return;
        }

        // Normal transform request
        const { state, request } = payload;
        const result = applyTransform(state, request);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));

      } catch (err) {
        console.error("[Server] Error:", err.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: "Only POST / is supported" }));
  }
});

server.listen(PORT, () => {
  console.log(`🚀 SpiritOS hxm server running on http://localhost:${PORT}`);
  console.log(`   Only endpoint: POST /`);
});