const http = require('http');
const fs = require('fs');
const path = require('path');
const spirit = require('./kernel');

console.log(JSON.stringify(spirit,null,2));

const rootDir = process.cwd();

const MIME_TYPES = spirit.core.const.MIME_TYPES;

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}

function safeJoin(baseDir, requestPath) {
  const safePath = path.normalize(requestPath).replace(/^\/+/, '');
  const joined = path.join(baseDir, safePath);
  const relative = path.relative(baseDir, joined);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }

  return joined;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);

  if (req.method === 'GET') {
    const filePath = pathname === '/'
      ? path.join(rootDir, 'index.html')
      : safeJoin(rootDir, pathname);

    if (!filePath) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    sendFile(res, filePath);
    return;
  }

  if (req.method === 'POST') {
    if (pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('POST accepted');
      return;
    }

    res.writeHead(405, { 'Allow': 'POST /' });
    res.end('POST only permitted at /');
    return;
  }

  res.writeHead(405, { 'Allow': 'GET, POST' });
  res.end('Method not allowed');
});

const port = process.env.PORT || 7777;
server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
