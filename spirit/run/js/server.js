const http = require('http');
const fs = require('fs');
const path = require('path');
const spirit = require('./kernel');

//console.log(JSON.stringify(spirit,null,2));

const ROOT_DIR = spirit.core.node.const.ROOT_DIR;
const MIME_TYPES = spirit.core.const.MIME_TYPES;
const port = process.env.PORT || spirit.core.node.const.DEFAULT_SPIRIT_PORT;

const jobs = require('./jobs')(spirit, port);
jobs.startFsWatcherJob(ROOT_DIR);

const requestCounters = { total: 0, byMethod: {}, byStatusClass: {} };
jobs.startStatsJob({ requestCounters: requestCounters });

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

const fsPath = spirit.core.node.util.fsPath;

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function handleSseConnection(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  res.write('event: snapshot\ndata: ' + JSON.stringify({ jobs: jobs.listJobs() }) + '\n\n');

  const onJobUpdated = (job) => {
    res.write('event: job-updated\ndata: ' + JSON.stringify(job) + '\n\n');
  };
  jobs.events.on('job-updated', onJobUpdated);

  const onJobDeleted = (id) => {
    res.write('event: job-deleted\ndata: ' + JSON.stringify(id) + '\n\n');
  };
  jobs.events.on('job-deleted', onJobDeleted);

  const heartbeat = setInterval(() => {
    res.write(':\n\n');
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    jobs.events.off('job-updated', onJobUpdated);
    jobs.events.off('job-deleted', onJobDeleted);
  });
}

function handleCreateJob(req, res) {
  readJsonBody(req).then((body) => {
    const job = jobs.startProcessJob(body.command, body.args || [], { type: body.type });
    res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(job));
  }).catch(() => {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Invalid JSON body');
  });
}

function handleJobUpdate(req, res, id) {
  readJsonBody(req).then((body) => {
    const job = jobs.updateJob(id, body);
    if (!job) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(job));
  }).catch(() => {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Invalid JSON body');
  });
}

function handleCancelJob(res, id) {
  const job = jobs.cancelJob(id);
  if (!job) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(job));
}

function handleDeleteJob(res, id) {
  const deleted = jobs.deleteJob(id);
  if (!deleted) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found, or job is not yet in a terminal state');
    return;
  }
  res.writeHead(204);
  res.end();
}

function writeFsResult(res, result) {
  if (result.ok) {
    res.writeHead(204);
    res.end();
    return;
  }
  if (result.reason === 'forbidden') {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }
  if (result.reason === 'app-entry-script-protected') {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden: an app\'s own entry script cannot be overwritten');
    return;
  }
  res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Internal error');
}

function handleFsSave(req, res) {
  readJsonBody(req).then((body) => {
    writeFsResult(res, spirit.core.fs.saveFile(body.path, body.content));
  }).catch(() => {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Invalid JSON body');
  });
}

function handleFsDelete(req, res) {
  readJsonBody(req).then((body) => {
    writeFsResult(res, spirit.core.fs.deleteFile(body.path));
  }).catch(() => {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Invalid JSON body');
  });
}

// Small, explicit allowlist of env var NAMES that /api/proxy is willing to
// substitute into an outgoing header value, via a ${ENV:NAME} placeholder
// (see substituteEnvPlaceholders, below) — e.g. a caller can send
// {"headers": {"x-api-key": "${ENV:ANTHROPIC_API_KEY}"}} and the real
// secret is filled in here, server-side, right before the outbound fetch,
// so it never has to exist in browser-visible code. This is credential-
// SCOPING infrastructure, not app-specific knowledge — the proxy still
// knows nothing about what any particular API looks like or does; it just
// knows which secrets this one mechanism is allowed to touch at all, so it
// can't be used to leak an unrelated server env var to an arbitrary URL a
// caller names. Add a name here only when something genuinely needs to
// reference it this way.
const PROXY_ENV_SUBSTITUTION_ALLOWLIST = ['ANTHROPIC_API_KEY'];

function substituteEnvPlaceholders(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/\$\{ENV:([A-Z0-9_]+)\}/g, (match, varName) => {
    if (PROXY_ENV_SUBSTITUTION_ALLOWLIST.indexOf(varName) === -1) return match; // not allowlisted — leave the literal placeholder, let the target API reject the bad auth rather than silently substituting nothing
    return process.env[varName] !== undefined ? process.env[varName] : match;
  });
}

// Generic outbound-request proxy — knows nothing about LM Studio, Claude,
// or any other specific service, unlike the two hardcoded handlers this
// originally replaced. A local service (LM Studio's included) sends no
// Access-Control-Allow-Origin header, so a browser fetch() straight to it
// is silently blocked by CORS even though it's reachable (server-to-server
// requests aren't subject to CORS at all). The caller supplies the target
// url/method/headers/body/timeout and owns all response-shape parsing —
// this just forwards and relays back whatever the target actually
// returned, or a synthesized {error} on timeout/unreachable.
function handleGenericProxy(req, res) {
  readJsonBody(req).then((body) => {
    if (!body.url) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'url is required' }));
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), body.timeoutMs || 10000);

    const fetchOptions = { method: body.method || 'GET', signal: controller.signal };
    const headers = Object.assign({}, body.body !== undefined ? { 'Content-Type': 'application/json' } : {}, body.headers || {});
    Object.keys(headers).forEach((key) => { headers[key] = substituteEnvPlaceholders(headers[key]); });
    if (Object.keys(headers).length > 0) fetchOptions.headers = headers;
    if (body.body !== undefined) fetchOptions.body = JSON.stringify(body.body);

    fetch(body.url, fetchOptions)
      .then((response) => response.text().then((text) => ({ status: response.status, text })))
      .then(({ status, text }) => {
        clearTimeout(timeoutId);
        res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(text);
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.name === 'AbortError' ? 'proxy request timed out' : 'proxy target unreachable' }));
      });
  }).catch(() => {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Invalid JSON body');
  });
}

// server.listen below has no host argument, so Node binds to all network
// interfaces by default — reachable from other devices on the same LAN, not
// just this machine. That matters once any route makes outbound requests on
// the caller's behalf (the generic proxy, below): without this check,
// another device on the network could use this server to reach whatever it
// can reach. Checked first, before any routing.
function isLoopbackAddress(address) {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

// The loopback check above only proves the TCP connection came from this
// machine — it does NOT prove the request came from this app's own page.
// This check earns its keep against exactly one attack: DNS rebinding,
// where a page at (say) evil.com has that hostname's DNS re-pointed to
// 127.0.0.1 after load, so its own-origin fetch() calls land on this
// server while the browser still treats it as same-origin with evil.com —
// bypassing CORS entirely. That request's Host header still says
// "evil.com:<port>" (the attacker can't also forge it to say "localhost"
// without giving up the same-origin premise the whole trick depends on),
// so this check catches it.
// This is NOT "only our UI can talk to us" in general — a plain cross-
// origin fetch('http://localhost:<port>/...') from any other tab sends a
// correct Host: localhost:<port> and passes this check untouched. What
// stops THAT today is that this server never sends
// Access-Control-Allow-Origin, so the browser's own CORS preflight blocks
// it before the real request is ever sent (verified: OPTIONS here returns
// a plain 405, no CORS grant) — same "you don't run random pages against
// your own node" trust boundary already accepted for /api/jobs's spawn
// capability. If that stronger claim is ever wanted, the next lock is
// validating Origin/Referer, not this Host check.
const VALID_HOSTS = ['localhost:' + port, '127.0.0.1:' + port, '[::1]:' + port];
function isValidHost(hostHeader) {
  return !!hostHeader && VALID_HOSTS.indexOf(hostHeader.toLowerCase()) !== -1;
}

const server = http.createServer((req, res) => {
  if (!isLoopbackAddress(req.socket.remoteAddress) || !isValidHost(req.headers.host)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden: this server only accepts connections from localhost');
    return;
  }

  requestCounters.total++;
  requestCounters.byMethod[req.method] = (requestCounters.byMethod[req.method] || 0) + 1;
  res.on('finish', () => {
    const bucket = Math.floor(res.statusCode / 100) + 'xx';
    requestCounters.byStatusClass[bucket] = (requestCounters.byStatusClass[bucket] || 0) + 1;
  });

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);

  if (req.method === 'GET' && pathname === '/api/events') {
    handleSseConnection(req, res);
    return;
  }

  if (req.method === 'GET' && pathname === '/api/jobs') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(jobs.listJobs()));
    return;
  }

  if (req.method === 'GET' && pathname === '/api/fs/stat') {
    const stats = spirit.core.fs.statFile(url.searchParams.get('path') || '');
    if (!stats) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(stats));
    return;
  }

  if (req.method === 'GET') {
    const filePath = pathname === '/'
      ? path.join(ROOT_DIR, 'index.html')
      : fsPath(ROOT_DIR, pathname);

    if (!filePath) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    sendFile(res, filePath);
    return;
  }

  if (req.method === 'POST') {
    if (pathname === '/api/fs/save') {
      handleFsSave(req, res);
      return;
    }

    if (pathname === '/api/fs/delete') {
      handleFsDelete(req, res);
      return;
    }

    if (pathname === '/api/proxy') {
      handleGenericProxy(req, res);
      return;
    }

    if (pathname === '/api/jobs') {
      handleCreateJob(req, res);
      return;
    }

    const cancelMatch = pathname.match(/^\/api\/jobs\/([^/]+)\/cancel$/);
    if (cancelMatch) {
      handleCancelJob(res, cancelMatch[1]);
      return;
    }

    const jobIdMatch = pathname.match(/^\/api\/jobs\/([^/]+)$/);
    if (jobIdMatch) {
      handleJobUpdate(req, res, jobIdMatch[1]);
      return;
    }

    if (pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('POST accepted');
      return;
    }

    res.writeHead(405, { 'Allow': 'POST /' });
    res.end('POST only permitted at /');
    return;
  }

  if (req.method === 'DELETE') {
    const jobIdMatch = pathname.match(/^\/api\/jobs\/([^/]+)$/);
    if (jobIdMatch) {
      handleDeleteJob(res, jobIdMatch[1]);
      return;
    }
  }

  res.writeHead(405, { 'Allow': 'GET, POST, DELETE' });
  res.end('Method not allowed');
});

// Explicit 127.0.0.1 binding: belt-and-suspenders alongside the loopback +
// Host checks above. Without this, Node binds all interfaces by default,
// so a LAN request would still reach isLoopbackAddress and get rejected
// with a 403 — this just makes it fail at the TCP level instead, with the
// same net result. Revert to server.listen(port, ...) (no host) if this
// node ever needs to be reachable from another device on purpose.
server.listen(port, '127.0.0.1', () => {
  console.log(`Server listening on http://localhost:${port}`);
});
