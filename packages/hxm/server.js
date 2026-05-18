// packages/hxm/server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const { applyTransform } = require('./src/core.js');
const { coreTypes } = require('./src/types/registry.js');

const PORT = 7777;
const SPIRIT_FILE = path.join(__dirname, 'test', 'spirit.json');

// Initial structure - must match ROOT-STRUCTURE.md exactly
const initialSpirit = {
  "core": {
    "readme": "SpiritOS is a sovereign personal operating system designed to capture, preserve, and extend a single human spirit under full individual control. Freedom first. Typing is optional but encouraged for high-quality data.",

    "info": {
      "version": "spiritos/0.1",
      "createdat": new Date().toISOString(),
      "modifiedat": new Date().toISOString(),
      "name": "SpiritOS",
      "author": "Andy Flinn"
    },

    "types": {}
  },

  "identity": {
    "_type": "identity",
    "name": "andyflinn",
    "publickey": "TODO",
    "bio": "Musician, artist, and builder of digital spirits."
  },

  "media": {
    "_type": "object"
  },

  "plugins": {
    "_type": "object"
  },

  "lists": {
    "_type": "object"
  },

  "journal": {
    "_type": "object"
  }
};

// Load or create spirit.json
let spiritState;
if (fs.existsSync(SPIRIT_FILE)) {
  spiritState = JSON.parse(fs.readFileSync(SPIRIT_FILE, 'utf-8'));
  console.log(`✅ Loaded spirit.json`);
} else {
  spiritState = initialSpirit;
  spiritState.core.types = coreTypes;           // Inject core types
  fs.writeFileSync(SPIRIT_FILE, JSON.stringify(spiritState, null, 2));
  console.log(`✅ Created new spirit.json from ROOT-STRUCTURE`);
}

function saveSpirit() {
  spiritState.core.info.modifiedat = new Date().toISOString();
  fs.writeFileSync(SPIRIT_FILE, JSON.stringify(spiritState, null, 2));
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

        // Bootstrap request: empty object → return full state
        if (!payload || Object.keys(payload).length === 0 || !payload.state) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            state: spiritState
          }));
          return;
        }

        // Normal transform
        const { state, request } = payload;
        const result = applyTransform(state, request);

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
  console.log(`🚀 SpiritOS server running on http://localhost:${PORT}`);
  console.log(`   POST /   →   bootstrap or transform`);
});