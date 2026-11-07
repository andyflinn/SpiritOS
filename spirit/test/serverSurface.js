'use strict';

// Exercises server.js's own request surface over real HTTP — the paths
// that never go through the gate predicates the way a unit test calls
// them, and so can't be covered by pathCanonicalization.js:
//
//   1. a malformed percent-escape must not take the process down (on a
//      --relay the same request arrives from the internet);
//   2. the static route's read gate, spelled in %2f, which the WHATWG URL
//      parser leaves alone (it collapses a literal '../' but not an encoded
//      one), so the raw traversal must still be refused;
//   5. A WEB PAGE ON ANOTHER SITE CANNOT MAKE THE NODE ACT. A POST with
//      Content-Type text/plain is a CORS "simple" request: a browser sends
//      it from any site with no preflight and only hides the ANSWER — the
//      verb would run. The Host check stops DNS rebinding, not this;
//   then one place in hub.js calls router.post, and an oversized body is
//   refused at the door.
//
// Runs against an isolated fake node under the OS temp dir
// (setupRelayFakes, the same copies the relay lab uses) and NEVER against
// the live checkout — case 2 needs a spirit/state/identity.json to try to
// steal, which would otherwise land in the working tree.
const fs = require('fs');
const net = require('net');
const http = require('http');
const limits = require('../run/spirit/limits.js');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const { setupRelayFakes } = require('./setupRelayFakes');

const KEY_SENTINEL = 'SENTINEL-PRIVATE-KEY-must-never-be-served';
const ENV_KEY_SENTINEL = 'SENTINEL-API-KEY-must-never-leave-the-box';
// The sentinel only proves nothing leaks: net.fetch fills no key (goal/G29.20).
const GROK_KEY_SENTINEL = 'SENTINEL-GROK-KEY-must-never-leave-the-box';
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
// `as`, when given, sends a RAW body with the caller's own headers — the
// shape a browser on another site would send (case 5). One reach for both,
// so oneDoor's roll for this file does not grow.
function request(port, method, rawPath, bodyObj, as) {
  return new Promise(function (resolve, reject) {
    const payload = as ? String(as.raw == null ? '' : as.raw) : (bodyObj == null ? '' : JSON.stringify(bodyObj));
    const req = http.request({
      hostname: '127.0.0.1',
      port: port,
      path: rawPath,
      method: method,
      headers: as ? Object.assign({ 'Content-Length': Buffer.byteLength(payload) }, as.headers || {})
        : (bodyObj == null ? {} : {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        }),
    }, function (res) {
      let chunks = '';
      res.on('data', function (c) { chunks += c; });
      res.on('end', function () { resolve({ status: res.statusCode, text: chunks }); });
    });
    req.on('error', function (err) { resolve({ status: 0, text: '', error: err.code || String(err) }); });
    req.setTimeout((as && as.waitMs) || 8000, function () { req.destroy(new Error('timeout')); });
    req.end(payload);
  });
}

// The verb used is node.card, which a key-less test node answers 409 —
// so "refused at the door" is told apart by the door's own words, not by
// the status alone.
// A request shaped the way a BROWSER on another site would send it: raw
// body, any Content-Type, and the headers the browser adds.
function requestAs(port, method, rawPath, bodyText, headers) {
  return request(port, method, rawPath, null, { raw: bodyText, headers: headers });
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

const nodeRoot = setupRelayFakes('serverSurface').andy;

// An identity for case 2 to try to steal. This node lives in the temp dir,
// so this never touches the repo. Case 2 asks for relay-state/identity.json,
// not this spirit/state/ path, so its sentinel check cannot see this file.
fs.mkdirSync(path.join(nodeRoot, 'spirit', 'state'), { recursive: true });
fs.writeFileSync(
  path.join(nodeRoot, 'spirit', 'state', 'identity.json'),
  JSON.stringify({ name: 'sentinel', publicKey: 'PUB', privateKey: KEY_SENTINEL }),
  'utf8'
);

// ── THE NODE'S RELAYS ────────────────────────────────────────────────
//
// The node's relays are rows of node.db's one table; on boot it asserts the
// one seed row, noderoutes.net (ownerBadge.ensureRelays). Nothing checked
// below depends on a relay answering. An old relays.json is not read
// (goal/G43.23), so none is planted.
fs.mkdirSync(path.join(nodeRoot, 'spirit', 'state'), { recursive: true });

let child = null;

// WHAT THE NODE SAID ON ITS WAY DOWN: its output is kept, so a failure
// names why the node died rather than reading as ECONNREFUSED.
//
// Kept to the last few kilobytes: a stack is short, and a node that is
// merely chatty must not push the real message out of reach.
let said = '';
function lastWords() {
  const tail = said.trim().split('\n').slice(-12).join('\n    ');
  return tail ? '\n    ' + tail : ' (it said nothing)';
}

function shutdown() {
  if (child) { try { child.kill(); } catch (e) { /* already gone */ } }
}

freePort()
  .then(function (port) {
    child = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], {
      cwd: nodeRoot,
      env: Object.assign({}, process.env, { ANTHROPIC_API_KEY: ENV_KEY_SENTINEL, GROK_API_KEY: GROK_KEY_SENTINEL }),
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    child.stderr.on('data', function (chunk) {
      said = (said + chunk).slice(-8192);
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
        test.check('encoded traversal to spirit/state/identity.json refused (HTTP ' + r.status + ')');
      } else {
        test.fail('encoded traversal returned HTTP ' + r.status + ' — expected 404/403');
      }
      return port;
    });
  })
  .then(function (port) {
    // Same gate, a module rather than a key: spirit/relayAuth.js is on
    // UNSERVABLE_FILES (fileSystem.js) and has no browser half at all.
    return request(port, 'GET', '/x%2f..%2fspirit%2frelayAuth.js').then(function (r) {
      if (r.status === 200 && r.text.indexOf('function verify') !== -1) {
        test.fail('encoded traversal SERVED spirit/relayAuth.js source');
      } else {
        test.check('encoded traversal to spirit/relayAuth.js refused (HTTP ' + r.status + ')');
      }
      return port;
    });
  })


  // ---- 5. a web page on another site cannot make the node act ----------
  .then(function (port) {
    test.subHeading('A page on another site cannot make the node act');
    const verb = JSON.stringify({ call: 'node.card', args: {} });
    const own = 'http://127.0.0.1:' + port;
    return requestAs(port, 'POST', '/api/spirit', verb, {
      'Content-Type': 'text/plain', Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site',
    }).then(function (r) {
      if (r.status === 403 && /another site/.test(r.text)) {
        test.check('a text/plain POST from another site — the kind a browser sends unasked — is refused 403');
      } else {
        test.fail('a cross-site POST ran: HTTP ' + r.status + ' ' + r.text.slice(0, 120));
      }
      return requestAs(port, 'POST', '/api/spirit', verb, { 'Content-Type': 'text/plain', Origin: 'null' });
    }).then(function (r) {
      if (r.status === 403 && /another site/.test(r.text)) {
        test.check('and so is one from a sandboxed frame or a file, which says Origin: null');
      } else {
        test.fail('an Origin: null POST ran: HTTP ' + r.status);
      }
      return requestAs(port, 'POST', '/api/spirit', verb, { 'Content-Type': 'text/plain', 'Sec-Fetch-Site': 'cross-site' });
    }).then(function (r) {
      if (r.status === 403 && /another site/.test(r.text)) {
        test.check('and one that says only Sec-Fetch-Site: cross-site');
      } else {
        test.fail('a cross-site POST without Origin ran: HTTP ' + r.status);
      }
      return requestAs(port, 'POST', '/api/spirit', verb, {
        'Content-Type': 'application/json', Origin: own, 'Sec-Fetch-Site': 'same-origin',
      });
    }).then(function (r) {
      if (!/another site/.test(r.text) && r.status !== 0) {
        test.check('the node\'s own shell, same origin, still reaches the verb (HTTP ' + r.status + ')');
      } else {
        test.fail('the shell\'s own call was refused: HTTP ' + r.status + ' ' + r.text.slice(0, 120));
      }
      return requestAs(port, 'POST', '/api/spirit', verb, { 'Content-Type': 'application/json' });
    }).then(function (r) {
      if (!/another site/.test(r.text) && r.status !== 0) {
        test.check('and a script on this box, which sends no Origin, is unaffected (HTTP ' + r.status + ')');
      } else {
        test.fail('a local script was refused: HTTP ' + r.status);
      }
      // A LINK CLICKED IN labMaster (127.0.0.1:65420) — same-site, another
      // port. Opening the node in a tab is not an act (2026-09-22, Andy).
      return requestAs(port, 'GET', '/', null, {
        'Sec-Fetch-Site': 'same-site', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document',
      });
    }).then(function (r) {
      if (r.status === 200) {
        test.check('a link clicked in labMaster’s panel opens the node — a navigation carries no body and reaches no verb');
      } else {
        test.fail('a link-click navigation was refused: HTTP ' + r.status);
      }
      return requestAs(port, 'POST', '/api/spirit', verb, {
        'Content-Type': 'text/plain', 'Sec-Fetch-Site': 'same-site', 'Sec-Fetch-Mode': 'navigate',
      });
    }).then(function (r) {
      if (r.status === 403 && /another site/.test(r.text)) {
        test.check('but a POST that calls itself a navigation is still refused — only GET and HEAD open a tab');
      } else {
        test.fail('a POST dressed as navigation ran: HTTP ' + r.status);
      }
      return port;
    });
  })

  // ---- one door puts things on the wire ----
  .then(function (port) {
      // ── ONE DOOR PUTS THINGS ON THE WIRE ─────────────────────────────
      //
      //   Andy: "I am aiming to close all post-path doors on node"
      //
      // The invariant:
      //
      //   NOTHING BUT handlePost MAY CALL router.post.
      //
      // Read off hub.js rather than exercised over HTTP, because it is a
      // claim about the SHAPE of that file: a second caller is a second
      // way onto the wire, whether or not anybody has wired a route to it
      // yet.
      let hubSrc = '';
      try { hubSrc = fs.readFileSync(path.join(__dirname, '..', 'run', 'spirit', 'hub.js'), 'utf8'); }
      catch (e) { hubSrc = ''; }
      const callers = [];
      hubSrc.split('\n').forEach(function (line, i) {
        if (!/router\.post\(/.test(line)) return;
        if (/^\s*(\/\/|\*)/.test(line)) return; // a mention in prose is not a call
        callers.push(i + 1);
      });

      // handlePost's own call, and no other. The line number is not the
      // claim — the COUNT is — so a refactor that moves it is fine and a
      // refactor that adds one is not.
      if (callers.length === 1) {
        test.check('exactly one place in hub.js calls router.post — the post door itself');
      } else {
        test.fail('router.post is called from ' + callers.length + ' places in hub.js (lines ' +
          callers.join(', ') + '). Every post-path door was deleted on 2026-09-15 so that ' +
          'peer.post is the only way onto the wire. A second caller is a second ' +
          'door, whether or not a route has been wired to it yet.' + lastWords());
      }
      return port;
  })

  // ── A BODY BIGGER THAN THE CAP IS REFUSED AT THE DOOR ──────────────
  //
  //   Andy: "the redundant package-size limits must be collapsed to one
  //   PAYLOAD_MAX, and the max post and reply sizes must be PAYLOAD_MAX +
  //   OVERHEAD (with headroom)."
  //
  // The payload caps in relay.js are checked after the body is whole and
  // parsed, so they bound what gets ROUTED, never what gets ACCEPTED. So
  // the body reader (serveCommon.js readJsonBody) refuses past
  // limits.BODY_MAX while reading: 413 body-too-large.
  .then(function (port) {
    test.subHeading('A body over the cap is refused before it is read');

    const over = 'x'.repeat(limits.BODY_MAX + 1024);

    return request(port, 'POST', '/api/spirit', { call: 'contact.search', args: { pad: over } })
      .then(function (r) {
        if (r.status === 413) {
          test.check('an oversized POST is answered 413, not parsed');
        } else {
          test.fail('oversized POST returned ' + r.status + ' — expected 413');
        }

        // NOT `400 Invalid JSON body`, which is what every route's own
        // catch would have said. A refusal that names the wrong fault is
        // the one somebody debugs at three in the morning.
        if (r.status === 413 && /too large/i.test(r.text)) {
          test.check('and it says the body was too large rather than malformed');
        } else if (r.status === 413) {
          test.fail('413 but the text does not say why: ' + r.text.slice(0, 60));
        }
        return port;
      });
  })

  // ---- 1. survivability. Runs LAST, since a failure kills the process ----
  .then(function (port) {
    test.subHeading('A malformed percent-escape does not take the server down');
    return request(port, 'GET', '/%zz').then(function (r) {
      if (r.status === 400) {
        test.check('GET /%zz answered 400');
      } else if (r.status === 0) {
        test.fail('GET /%zz got no response at all (' + r.error + ') — the handler threw' +
          lastWords());
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
              (after.error || 'HTTP ' + after.status) + ')' + lastWords());
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
