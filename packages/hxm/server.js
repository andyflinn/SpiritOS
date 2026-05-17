// packages/hxm/server.js
const http = require('http');
const { applyTransform } = require('./src/core.js');

const PORT = 7777;

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/transform') {
    let body = '';

    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { state, request } = JSON.parse(body);
        const result = applyTransform(state, request);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: "Not found" }));
  }
});

server.listen(PORT, () => {
  console.log(`🚀 hxm server running on http://localhost:${PORT}`);
});