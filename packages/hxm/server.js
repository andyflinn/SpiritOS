// packages/hxm/server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const { applyTransform } = require('./src/core.js');
const { coreTypes } = require('./src/types/registry.js');

const PORT = 7777;
//const SPIRIT_FILE = path.join(__dirname, 'test', 'spirit.json');
const SPIRIT = 'spirit';
const SPIRIT_FILE = SPIRIT +'.json';
const SPIRIT_DIR = './' + SPIRIT +'/';

let core = {
  "readme": "SpiritOS is a sovereign personal operating system designed to capture, preserve, and extend a single human spirit under full individual control. Freedom first. Typing is optional but encouraged for high-quality data.",

  "info": {
    "version": "spiritos/0.1",
    "createdat": new Date().toISOString(),
    "modifiedat": new Date().toISOString(),
    "name": "SpiritOS",
    "author": "Andy Flinn",
    "_flags": { readonly: true, immutable: false, serveronly: false, nopersist: true },
    "_type": "object",
  },

  "types": coreTypes,
  _flags: { readonly: true, immutable: false, serveronly: false, nopersist: true }
};

// Load or create spirit state
let spiritState;
if (fs.existsSync(SPIRIT_FILE)) {
  spiritState = JSON.parse(fs.readFileSync(SPIRIT_FILE, 'utf-8'));
  console.log(`✅ Loaded spirit.json`);
} else {
  spiritState = {
    "core": core,
    "_flags": { readonly: false, immutable: false, serveronly: false, nopersist: false },
    "_type": "object"
  }
  
  // initialize spirit file with an empty object,
  fs.writeFileSync(SPIRIT_FILE, "{}");
  
  console.log(`✅ Created new spirit.json`);
}

const server = http.createServer((req, res) => {
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

        // === Bootstrap Request: empty object or no 'request' key ===
        if (!payload || Object.keys(payload).length === 0 || !payload.request) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            state: spiritState
          }));
          return;
        }

        // === Normal Transform Request ===
        const { request } = payload;
        const result = applyTransform(spiritState, request);

        if (result.success) {
          spiritState = result.state;
          saveSpirit();
        }

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
});