const http = require('http');
const fs = require('fs');
const path = require('path');
const spirit = require('./kernel');
const createRelay = require('./relay');
const relay = createRelay.createRelay();

//console.log(JSON.stringify(spirit,null,2));

// Checked before verifyStartupCwd below, on purpose — --help should work
// regardless of which directory this was launched from, not get refused
// alongside every other startup mistake.
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(
    'Usage: node js/server.js [--port <number>] [--relay]\n\n' +
    '  --port <number>   Listen on this port instead of the default (' + spirit.core.node.const.DEFAULT_SPIRIT_PORT + ').\n' +
    '                    Same effect as the PORT environment variable; --port wins if both are given.\n' +
    '  --relay           Run as a public relay: serve relay.html at / and /index.html, answer\n' +
    '                    only the mailbox routes (/api/relay/*) and 404 everything else —\n' +
    '                    Jobs, /api/fs/*, /api/proxy, /api/hub/* and the desktop shell.\n' +
    '                    Binds 0.0.0.0 (not loopback) and accepts any Host, since a relay is\n' +
    '                    meant to be reached from the internet. Do NOT pass this to a personal\n' +
    '                    node; those stay loopback-only.\n' +
    '  --help, -h        Show this message and exit.\n\n' +
    'Examples:\n' +
    '  node js/server.js\n' +
    '  node js/server.js --port 65431\n' +
    '  node js/server.js --port 65430 --relay\n' +
    '  PORT=65431 node js/server.js\n\n' +
    'Must be run from spirit/run/ (this directory\'s parent must be named "spirit") — see the startup check below if that fails.'
  );
  process.exit(0);
}

// Job spawning (jobs.js's startProcessJob) passes relative script paths
// like "process/js/lmStudioLoadModel/lmStudioLoadModel.js" straight to
// child_process.spawn without ever setting an explicit cwd, so it
// inherits whatever directory THIS process was started from. Every other
// path in the app is resolved off ROOT_DIR (__dirname-relative, always
// correct) — this is the one place actual process.cwd() matters, and
// starting the server from the wrong place (e.g. `cd js && node
// server.js` instead of `node js/server.js` from spirit/run) breaks job
// spawning silently: scripts fail in well under a second with no useful
// error, easy to mistake for a real bug in the spawned script itself.
// Fail loud and immediately instead.
(function verifyStartupCwd() {
  var cwd = process.cwd();
  var errors = [];

  var REQUIRED_DIRS = ['app', 'js', 'process'];
  var missing = REQUIRED_DIRS.filter(function (name) {
    try { return !fs.statSync(path.join(cwd, name)).isDirectory(); }
    catch (err) { return true; }
  });
  if (missing.length > 0) {
    errors.push('expected ' + missing.join('/, ') + '/ under the current directory, but ' + (missing.length > 1 ? 'they weren\'t' : 'it wasn\'t') + ' found');
  }

  // Belt and suspenders: this project's own folder is always named
  // "spirit", one level up from wherever the server actually runs
  // (spirit/run) — catches starting from some unrelated folder that
  // happens to also have app/js/process children.
  if (path.basename(path.dirname(cwd)) !== 'spirit') {
    errors.push('expected the current directory\'s parent to be named "spirit" (i.e. running from spirit/run), but it\'s "' + path.basename(path.dirname(cwd)) + '"');
  }

  if (errors.length > 0) {
    console.error(
      'Refusing to start: ' + errors.join('; ') + '. Current directory: ' + cwd + '\n' +
      'Job spawning resolves script paths relative to wherever this process was started from — ' +
      'run this as `node js/server.js` from spirit/run, not from inside js/.'
    );
    process.exit(1);
  }
})();

const ROOT_DIR = spirit.core.node.const.ROOT_DIR;
const MIME_TYPES = spirit.core.const.MIME_TYPES;

const hub = require('./hub').createHub(ROOT_DIR);


// --port <n> / --port=<n> takes precedence over PORT, for running a
// second instance ad hoc (e.g. an installer/reinstall test alongside a
// dev instance already holding the default port) without having to set
// an environment variable first.
function portFromArgs(argv) {
  const eqArg = argv.find((arg) => arg.startsWith('--port='));
  if (eqArg) return Number(eqArg.slice('--port='.length));
  const flagIndex = argv.indexOf('--port');
  if (flagIndex !== -1 && argv[flagIndex + 1] !== undefined) return Number(argv[flagIndex + 1]);
  return null;
}

const port = portFromArgs(process.argv.slice(2)) || process.env.PORT || spirit.core.node.const.DEFAULT_SPIRIT_PORT;

// First step toward the public relay/hub vision (server #3) — deliberately
// just a routing switch for now. The actual relay protocol (signed-
// challenge auth against an allowed-public-keys list, message delivery) is
// separate, later work.
//
// This started as nothing but a routing switch for GET / — everything else
// stayed reachable. It isn't that any more. Phase B narrowed a --relay
// process to the mailbox routes plus the brochure (isRelayPublicPath,
// below; relaySurface.test.js proves Jobs/fs/proxy/hub/the desktop all
// 404), and Phase F takes the last step: a --relay process binds 0.0.0.0
// and drops the loopback + Host gate, because it is meant to be reached
// from the internet.
//
// So this one flag is now the whole difference between "a personal node,
// unroutable from outside this machine" and "a public server". A personal
// node must never be started with it.
const relayMode = process.argv.slice(2).includes('--relay');
const HOME_PAGE = relayMode ? 'relay.html' : 'index.html';

// The small, fixed set of paths the page needs to boot at all, served
// unconditionally by the static route below, checked before fileServable —
// this is what lets js/kernel.js sit in kernel.js's UNSERVABLE_FILES
// (blocking the *generic* read/list capability: loadFile, scanFolder, the
// Files app, the fs-watcher) while still working as the page's own boot
// script. Both index.html and relay.html are listed unconditionally
// (not just whichever HOME_PAGE resolved to) — either is reachable by its
// own literal path regardless of mode, this just keeps both bootable.
const BOOT_ASSETS = ['index.html', 'relay.html', 'js/kernel.js', 'js/client/shell.js', 'favicon.svg'];

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

// The connection's own address, used only as a rate-limiting bucket key —
// never as authority for anything. Rate limits used to key on the name in
// the request body, which the sender chooses, so rotating it reset the
// budget; this is the one thing about a request the caller can't restate
// at will.
function clientKeyFor(req) {
  return req.socket.remoteAddress || '';
}

function handleRelayClaim(req, res) {
  readJsonBody(req).then(function (body) {
    const result = relay.claim(body && body.name, body && body.sig, clientKeyFor(req));
    res.writeHead(result.status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result.ok ? result.peer : { error: result.error }));
  }).catch(function () {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Invalid JSON body');
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

  // Bound to 'error' as well as 'close': a socket that dies without a
  // clean close (a killed browser, a dropped network) never fired 'close',
  // leaving the 20-second heartbeat writing to a dead response forever and
  // both listeners attached. Guarded so it runs once whichever fires first.
  let torndown = false;
  function teardown() {
    if (torndown) return;
    torndown = true;
    clearInterval(heartbeat);
    jobs.events.off('job-updated', onJobUpdated);
    jobs.events.off('job-deleted', onJobDeleted);
  }
  req.on('close', teardown);
  req.on('error', teardown);
  res.on('error', teardown);
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
  if (result.reason === 'not-an-app-entry-script') {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden: /api/fs/save-app-script only accepts an app entry-script path (app/<name>/<name>.js)');
    return;
  }
  if (result.reason === 'app-manifest-protected') {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden: an app\'s own manifest cannot be overwritten');
    return;
  }
  if (result.reason === 'not-an-app-manifest') {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden: /api/fs/save-app-manifest only accepts an app manifest path (app/<name>/<name>.json)');
    return;
  }
  if (result.reason === 'invalid-manifest-json') {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad request: manifest content is not valid JSON');
    return;
  }
  if (result.reason === 'file-not-found') {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
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

// The one deliberate way to write an app's own entry script — see
// spirit.core.fs.saveAppScript (kernel.js) for what's actually enforced.
// Kept as its own route rather than a flag on /api/fs/save so that route
// keeps refusing entry scripts unconditionally for every other caller.
function handleFsSaveAppScript(req, res) {
  readJsonBody(req).then((body) => {
    writeFsResult(res, spirit.core.fs.saveAppScript(body.path, body.content));
  }).catch(() => {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Invalid JSON body');
  });
}

// The one deliberate way to write an app's own manifest — see
// spirit.core.fs.saveAppManifest (kernel.js) for what's actually
// enforced (owner is force-set there, not here). Kept as its own route,
// same reasoning as handleFsSaveAppScript above.
function handleFsSaveAppManifest(req, res) {
  readJsonBody(req).then((body) => {
    writeFsResult(res, spirit.core.fs.saveAppManifest(body.path, body.content));
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

// Writes into the target file's sidecar 'client' bucket only — see
// spirit.core.fs.annotateFile (kernel.js) for why no bucket argument is
// accepted here even in principle.
function handleFsAnnotate(req, res) {
  readJsonBody(req).then((body) => {
    writeFsResult(res, spirit.core.fs.annotateFile(body.path, body.payload));
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
// Each entry pairs a variable NAME with the destination hosts it may be
// sent to. The name alone was not enough: gating which env var could be
// substituted, without gating where it went, meant any caller could post
// {"url":"https://somewhere-else","headers":{"x-api-key":"${ENV:ANTHROPIC_API_KEY}"}}
// and the server would faithfully hand the real key to a host of the
// caller's choosing. The allow-list stopped an UNRELATED variable reaching
// an arbitrary URL; it did nothing for the one variable it allowed. A
// secret is scoped by name AND by recipient or it isn't scoped.
const PROXY_ENV_SUBSTITUTION_ALLOWLIST = [
  { name: 'ANTHROPIC_API_KEY', hosts: ['api.anthropic.com'] },
];

function substituteEnvPlaceholders(value, targetHost) {
  if (typeof value !== 'string') return value;
  return value.replace(/\$\{ENV:([A-Z0-9_]+)\}/g, (match, varName) => {
    // Not allowlisted, or allowlisted but pointed somewhere it isn't meant
    // to go — leave the literal placeholder either way, and let the target
    // reject the bad auth rather than silently substituting nothing.
    const entry = PROXY_ENV_SUBSTITUTION_ALLOWLIST.find((row) => row.name === varName);
    if (!entry) return match;
    if (entry.hosts.indexOf(targetHost) === -1) return match;
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

    // Whatever host the outbound request will actually reach — the only
    // thing that decides whether a secret is allowed into these headers.
    let targetHost = '';
    try { targetHost = new URL(body.url).hostname.toLowerCase(); }
    catch (err) { /* unparseable — no host matches, so nothing substitutes; fetch fails below on its own */ }

    const fetchOptions = { method: body.method || 'GET', signal: controller.signal };
    const headers = Object.assign({}, body.body !== undefined ? { 'Content-Type': 'application/json' } : {}, body.headers || {});
    Object.keys(headers).forEach((key) => { headers[key] = substituteEnvPlaceholders(headers[key], targetHost); });
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

function isRelayPublicPath(method, pathname) {
  if (pathname === '/' || pathname === '/index.html' || pathname === '/relay.html' || pathname === '/favicon.svg') {
    return method === 'GET';
  }
  if (method === 'GET' && (pathname === '/api/relay/who' || pathname === '/api/relay/inbox')) return true;
  if (method === 'POST' && (pathname === '/api/relay/claim' || pathname === '/api/relay/send')) return true;
  return false;
}

const server = http.createServer((req, res) => {
  // Both halves of this gate are personal-node-only, and both have to be
  // skipped together for a relay — fixing only the Host half would leave
  // every external request dying on the loopback half instead, since
  // remoteAddress is now a real client IP rather than 127.0.0.1. The Host
  // half is equally meaningless there: VALID_HOSTS is built from
  // localhost:<port>, but a deployed relay is reached as
  // foo.herokuapp.com, and the platform assigns the internal port anyway.
  //
  // What stands in for this on a relay is not "nothing": isRelayPublicPath
  // (below) reduces the answerable surface to the mailbox routes and the
  // brochure, and the mailbox routes themselves are gated by the allow
  // list and signature checks in relayAuth.js. The brochure does not hide
  // those routes from curl and was never meant to — H/I/E are the gates.
  if (!relayMode && (!isLoopbackAddress(req.socket.remoteAddress) || !isValidHost(req.headers.host))) {
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

  // Both of these parse caller-controlled bytes, and both can throw:
  // decodeURIComponent on a malformed escape ('/%zz', '/%'), and the URL
  // constructor on a Host header it can't make an origin out of. An
  // uncaught throw HERE is not a bad response, it's a dead process — the
  // handler runs outside any try, so the exception unwinds straight out of
  // http's 'request' emit and ends Node.
  //
  // That mattered most on a --relay, where this runs BEFORE
  // isRelayPublicPath narrows anything: a single unauthenticated
  // `GET /%zz` from the internet took the public mailbox down, and
  // systemd's Restart=on-failure just made it a three-second outage per
  // request rather than a permanent one. Answer 400 and stay up.
  let url;
  let pathname;
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    pathname = decodeURIComponent(url.pathname);
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad request: malformed request path');
    return;
  }

  if (relayMode && !isRelayPublicPath(req.method, pathname)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  if (req.method === 'GET' && pathname === '/api/relay/who') {
    handleRelayWho(res);
    return;
  }

  if (req.method === 'GET' && pathname === '/api/relay/inbox') {
    handleRelayInbox(req, res, url);
    return;
  }
  
  if (req.method === 'GET' && pathname === '/api/hub/inbox') {
    hub.handleInbox(req, res, url);
    return;
  }
  
  function handleRelaySend(req, res) {
    readJsonBody(req).then(function (body) {
      const result = relay.send(body && body.from, body && body.to, body && body.text, body && body.sig, clientKeyFor(req));
      res.writeHead(result.status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result.ok ? result.message : { error: result.error }));
    }).catch(function () {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Invalid JSON body');
    });
  }

  function handleRelayInbox(req, res, url) {
    var result = relay.inbox(url.searchParams.get('name') || '', url.searchParams.get('sig') || '');
    res.writeHead(result.status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result.ok ? { messages: result.messages } : { error: result.error }));
  }

  function handleRelayWho(res) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ peers: relay.who() }));
  }
  
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

  if (req.method === 'GET' && pathname === '/api/fs/annotations') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(spirit.core.fs.getAnnotations(url.searchParams.get('path') || '')));
    return;
  }

  if (req.method === 'GET') {
    const isHomeRequest = pathname === '/' || pathname === '/index.html';
    const relativePath = isHomeRequest ? HOME_PAGE : pathname.replace(/^\/+/, '');
    const filePath = isHomeRequest
      ? path.join(ROOT_DIR, HOME_PAGE)
      : fsPath(ROOT_DIR, pathname);

    if (!filePath) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    // This route is a completely independent path to the filesystem from
    // kernel.js's own loadFile — it's the raw route the browser's
    // synchronous loadFile XHR hits directly. Boot assets bypass the
    // generic gate unconditionally; everything else goes through the same
    // fileServable check loadFile/scanFolder use.
    if (BOOT_ASSETS.indexOf(relativePath) === -1 && !spirit.core.fs.fileServable(relativePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
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

    if (pathname === '/api/relay/claim') {
      handleRelayClaim(req, res);
      return;
    }

    if (pathname === '/api/relay/send') {
      handleRelaySend(req, res);
      return;
    }
    
    if (pathname === '/api/hub/claim') {
      hub.handleClaim(req, res, readJsonBody);
      return;
    }

    if (pathname === '/api/hub/send') {
      hub.handleSend(req, res, readJsonBody);
      return;
    }    
    
    if (pathname === '/api/fs/save-app-script') {
      handleFsSaveAppScript(req, res);
      return;
    }

    if (pathname === '/api/fs/save-app-manifest') {
      handleFsSaveAppManifest(req, res);
      return;
    }

    if (pathname === '/api/fs/delete') {
      handleFsDelete(req, res);
      return;
    }

    if (pathname === '/api/fs/annotate') {
      handleFsAnnotate(req, res);
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

// A personal node binds 127.0.0.1 explicitly: belt-and-suspenders
// alongside the loopback + Host checks above. Without it, Node binds all
// interfaces by default, so a LAN request would still reach
// isLoopbackAddress and get rejected with a 403 — this just makes it fail
// at the TCP level instead, with the same net result. That is the whole
// reason a phone on the same wifi cannot reach :65432, and it stays true.
//
// A --relay process is the one case that genuinely needs to be reachable
// from another machine, so it binds 0.0.0.0 — required by every platform
// that health-checks the port it assigned (Heroku, Fly, a plain VPS).
// Bind loopback there and the health check fails, the dyno is killed, and
// it reads as "SpiritOS is broken" rather than as a bind mistake.
const BIND_HOST = relayMode ? '0.0.0.0' : '127.0.0.1';

// Without the handler below, a failed listen() (most commonly EADDRINUSE — another
// SpiritOS instance, or anything else, already on this port) surfaces as
// a raw unhandled 'error' event and a Node internals stack trace, same
// failure class verifyStartupCwd() above already fails loud and clear
// for instead.
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `Refusing to start: port ${port} is already in use — probably another SpiritOS instance (or anything else) already listening there.\n\n` +
      `Try a different port:\n` +
      `    node js/server.js --port ${port + 1}`
    );
  } else {
    console.error(`Refusing to start: ${err.message}`);
  }
  process.exit(1);
});

server.listen(port, BIND_HOST, () => {
  if (relayMode) {
    console.log(`Relay listening on ${BIND_HOST}:${port} — PUBLIC, no loopback or Host restriction`);
    // relayAuth.loadAllow treats a missing or unreadable allow.json as
    // mode 'open': any name claimable by anyone, any sender accepted, no
    // signature required. That is the right default for a lab relay and
    // the wrong one for a public box, and until now the two were
    // indistinguishable from the console — an open relay looked exactly
    // like a working one right up until someone else claimed your name.
    // Say which one this is.
    if (require('./relayAuth').loadAllow(ROOT_DIR).mode === 'open') {
      console.warn(
        '    WARNING: no relay-state/allow.json — this relay is OPEN. Anyone who can reach it\n' +
        '    may claim any name, send as anyone, and read any mailbox. Create relay-state/allow.json\n' +
        '    (a { "keys": [...] } list) to require signed claims and sends.'
      );
    }
  } else {
    console.log(`Server listening on http://localhost:${port}`);
  }
});
