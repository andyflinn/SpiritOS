'use strict';

// Exercises server.js's own request surface over real HTTP — the paths
// that never go through kernel.js's predicates the way a unit test calls
// them, and so can't be covered by pathCanonicalization.js:
//
//   1. a malformed percent-escape reaches decodeURIComponent and takes the
//      whole process down (server.js's `const pathname =
//      decodeURIComponent(url.pathname)`), BEFORE the relay-surface check,
//      so a --relay is exposed to it from the internet too;
//   2. the static route's read gate is spelled in %2f, which the WHATWG URL
//      parser leaves alone (it collapses a literal '../' but not an encoded
//      one) so the raw traversal reaches fileServable intact;
//   3. /api/fs/save's write gate, same non-canonical spelling as
//      pathCanonicalization.js but through the real route, proving the
//      bypass actually reaches disk rather than only the predicate;
//   4. /api/proxy substitutes ${ENV:ANTHROPIC_API_KEY} into headers for
//      ANY destination the caller names — the allow-list gates which env
//      var, never which host receives it.
//
// EXPECTED TO FAIL until those are fixed. Cases 1-3 are confirmed live
// against this tree; case 4 is confirmed by reading substituteEnvPlaceholders.
//
// Runs against an isolated fake node under the OS temp dir
// (setupRelayFakes, the same copies the relay lab uses) and NEVER against
// the live checkout — case 3 deliberately attempts a real write of a real
// app's entry script, and case 2 needs a relay-state/identity.json to try
// to steal. Both would otherwise land in the working tree.
const fs = require('fs');
const net = require('net');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const { setupRelayFakes } = require('./setupRelayFakes');

const KEY_SENTINEL = 'SENTINEL-PRIVATE-KEY-must-never-be-served';
const ENV_KEY_SENTINEL = 'SENTINEL-API-KEY-must-never-leave-the-box';
const BOOT_TIMEOUT_MS = 10000;

test.startTest('Server request surface (server.js over real HTTP)');

function freePort() {
  return new Promise(function (resolve, reject) {
    const probe = net.createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', function () {
      const port = probe.address().port;
      probe.close(function () { resolve(port); });
    });
  });
}

// Deliberately low-level: `path` is sent verbatim, so an encoded traversal
// stays encoded on the wire instead of being normalized by a URL object
// the way a fetch() would.
function request(port, method, rawPath, bodyObj) {
  return new Promise(function (resolve, reject) {
    const payload = bodyObj == null ? '' : JSON.stringify(bodyObj);
    const req = http.request({
      hostname: '127.0.0.1',
      port: port,
      path: rawPath,
      method: method,
      headers: bodyObj == null ? {} : {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, function (res) {
      let chunks = '';
      res.on('data', function (c) { chunks += c; });
      res.on('end', function () { resolve({ status: res.statusCode, text: chunks }); });
    });
    req.on('error', function (err) { resolve({ status: 0, text: '', error: err.code || String(err) }); });
    req.setTimeout(8000, function () { req.destroy(new Error('timeout')); });
    req.end(payload);
  });
}

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function waitForBoot(port) {
  const startedAt = Date.now();
  return (function poll() {
    return request(port, 'GET', '/').then(function (r) {
      if (r.status === 200) return true;
      if (Date.now() - startedAt > BOOT_TIMEOUT_MS) throw new Error('server did not boot on ' + port);
      return sleep(150).then(poll);
    });
  }());
}

// Stands in for "some host on the internet the caller names" in case 4.
function startSink() {
  return new Promise(function (resolve) {
    const seen = { headers: null };
    const sink = http.createServer(function (req, res) {
      seen.headers = req.headers;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });
    sink.listen(0, '127.0.0.1', function () {
      resolve({ port: sink.address().port, seen: seen, close: function () { sink.close(); } });
    });
  });
}

const nodeRoot = setupRelayFakes().andy;
const ENTRY_SCRIPT = path.join(nodeRoot, 'app', 'natter', 'natter.js');

// A relay identity for case 2 to try to steal. relay-state/ is gitignored
// and this node lives in the temp dir, so this never touches the repo.
fs.mkdirSync(path.join(nodeRoot, 'relay-state'), { recursive: true });
fs.writeFileSync(
  path.join(nodeRoot, 'relay-state', 'identity.json'),
  JSON.stringify({ name: 'sentinel', publicKey: 'PUB', privateKey: KEY_SENTINEL }),
  'utf8'
);

let child = null;
let sink = null;

function shutdown() {
  if (child) { try { child.kill(); } catch (e) { /* already gone */ } }
  if (sink) { try { sink.close(); } catch (e) { /* already closed */ } }
}

freePort()
  .then(function (port) {
    child = spawn(process.execPath, ['js/server.js', '--port', String(port)], {
      cwd: nodeRoot,
      env: Object.assign({}, process.env, { ANTHROPIC_API_KEY: ENV_KEY_SENTINEL }),
      stdio: 'ignore',
    });
    return waitForBoot(port).then(function () { return port; });
  })

  // ---- 2. the read gate, spelled in %2f ----
  .then(function (port) {
    test.subHeading('Static route: encoded traversal cannot reach relay-state/');
    return request(port, 'GET', '/x%2f..%2frelay-state%2fidentity.json').then(function (r) {
      if (r.text.indexOf(KEY_SENTINEL) !== -1) {
        test.fail('encoded traversal SERVED the private key (HTTP ' + r.status + ')');
      } else if (r.status === 404 || r.status === 403) {
        test.check('encoded traversal to relay-state/identity.json refused (HTTP ' + r.status + ')');
      } else {
        test.fail('encoded traversal returned HTTP ' + r.status + ' — expected 404/403');
      }
      return port;
    });
  })
  .then(function (port) {
    // Same gate, a module rather than a key: js/relayAuth.js is on
    // UNSERVABLE_FILES and has no browser half at all.
    return request(port, 'GET', '/x%2f..%2fjs%2frelayAuth.js').then(function (r) {
      if (r.status === 200 && r.text.indexOf('function verify') !== -1) {
        test.fail('encoded traversal SERVED js/relayAuth.js source');
      } else {
        test.check('encoded traversal to js/relayAuth.js refused (HTTP ' + r.status + ')');
      }
      return port;
    });
  })

  // ---- 3. the write gate, through the real route, to real disk ----
  .then(function (port) {
    test.subHeading('POST /api/fs/save cannot overwrite an app entry script');
    const before = fs.readFileSync(ENTRY_SCRIPT, 'utf8');
    return request(port, 'POST', '/api/fs/save', {
      path: 'app/./natter/natter.js',
      content: '// serverSurface.js probe — must never reach disk',
    }).then(function (r) {
      if (r.status >= 200 && r.status < 300) {
        test.fail('/api/fs/save ACCEPTED a non-canonical entry-script path (HTTP ' + r.status + ')');
      } else {
        test.check('/api/fs/save refused a non-canonical entry-script path (HTTP ' + r.status + ')');
      }
      const after = fs.readFileSync(ENTRY_SCRIPT, 'utf8');
      if (after === before) {
        test.check('the app entry script on disk is unchanged');
      } else {
        test.fail('the app entry script WAS OVERWRITTEN on disk');
        fs.writeFileSync(ENTRY_SCRIPT, before, 'utf8'); // restore for a rerun
      }
      return port;
    });
  })

  // ---- 4. the proxy's env substitution is not scoped to a destination ----
  .then(function (port) {
    test.subHeading('POST /api/proxy does not hand the API key to any host named');
    return startSink().then(function (s) {
      sink = s;
      return request(port, 'POST', '/api/proxy', {
        url: 'http://127.0.0.1:' + s.port + '/v1/messages',
        method: 'POST',
        headers: { 'x-api-key': '${ENV:ANTHROPIC_API_KEY}' },
        body: { hello: 'world' },
      }).then(function () {
        const received = (s.seen.headers && s.seen.headers['x-api-key']) || '';
        if (received === ENV_KEY_SENTINEL) {
          test.fail('the proxy sent the real ANTHROPIC_API_KEY to an unrelated host');
        } else if (received.indexOf('${ENV:') === 0 || received === '') {
          test.check('the proxy withheld the key from an unrelated host (sent ' + JSON.stringify(received) + ')');
        } else {
          test.check('the proxy did not send the real key (sent ' + JSON.stringify(received) + ')');
        }
        return port;
      });
    });
  })

  // ---- 1. survivability. Runs LAST: it currently kills the process ----
  .then(function (port) {
    test.subHeading('A malformed percent-escape does not take the server down');
    return request(port, 'GET', '/%zz').then(function (r) {
      if (r.status === 400) {
        test.check('GET /%zz answered 400');
      } else if (r.status === 0) {
        test.fail('GET /%zz got no response at all (' + r.error + ') — the handler threw');
      } else {
        test.check('GET /%zz answered HTTP ' + r.status + ' without throwing');
      }
      // The real assertion: whatever it answered, the process must still
      // be there. On a --relay this same request arrives unauthenticated
      // from the internet, before isRelayPublicPath narrows anything.
      return sleep(300).then(function () {
        return request(port, 'GET', '/').then(function (after) {
          if (after.status === 200) {
            test.check('the server is still listening afterwards');
          } else {
            test.fail('the server DIED — a single malformed request ends the process (' +
              (after.error || 'HTTP ' + after.status) + ')');
          }
        });
      });
    });
  })

  .catch(function (err) {
    test.fail('harness error: ' + (err && err.message || err));
  })
  .then(function () {
    shutdown();
    test.reportSuccessFailureCount();
    process.exit(test.failureCount > 0 ? 1 : 0);
  });
