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
//   3. fs.save's write gate, the same non-canonical spelling as
//      pathCanonicalization.js but through the real route, to real disk;
//   4. net.fetch refuses this machine (goal/G29.20) and fills no key;
//   5. A WEB PAGE ON ANOTHER SITE CANNOT MAKE THE NODE ACT. A POST with
//      Content-Type text/plain is a CORS "simple" request: a browser sends
//      it from any site with no preflight and only hides the ANSWER — the
//      verb would run. The Host check stops DNS rebinding, not this;
//   6. net.fetch carries any size, and the door's packet bound holds for
//      the rest;
//   then every loopback verb is reached and the process survives, one
//   place in hub.js calls router.post, and an oversized body is refused
//   at the door.
//
// Runs against an isolated fake node under the OS temp dir
// (setupRelayFakes, the same copies the relay lab uses) and NEVER against
// the live checkout — case 3 deliberately writes a real app's entry
// script, and case 2 needs a spirit/state/identity.json to try to steal.
// Both would otherwise land in the working tree.
//
// IT READS WHAT THE TREE NO LONGER HAS: case 3's entry script,
// shell/textEditor/textEditor.js (the text viewer and editor apps are
// gone), and shell/natter/; the suite stops at its first read with a
// harness error.
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

// Stands in for "some host on the internet the caller names" in case 4.
// `delayMs` makes it answer late (case 6: the proxy must not cut it off).
function startSink(delayMs) {
  return new Promise(function (resolve) {
    const seen = { headers: null, bytes: 0 };
    const sink = http.createServer(function (req, res) {
      seen.headers = req.headers;
      req.on('data', function (c) { seen.bytes += c.length; });
      // Answered once the whole body is in, so `bytes` is all of it.
      req.on('end', function () {
        setTimeout(function () {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('{"ok":true}');
        }, delayMs || 0);
      });
    });
    sink.listen(0, '127.0.0.1', function () {
      resolve({ port: sink.address().port, seen: seen, close: function () { sink.close(); } });
    });
  });
}

const nodeRoot = setupRelayFakes('serverSurface').andy;
// The entry script probed is a non-intrinsic app's: since goal/G30.21 an intrinsic app's script is core and refused.
const ENTRY_SCRIPT = path.join(nodeRoot, 'shell', 'textEditor', 'textEditor.js');

// An identity for case 2 to try to steal. This node lives in the temp dir,
// so this never touches the repo. Case 2 asks for relay-state/identity.json,
// not this spirit/state/ path, so its sentinel check cannot see this file.
fs.mkdirSync(path.join(nodeRoot, 'spirit', 'state'), { recursive: true });
fs.writeFileSync(
  path.join(nodeRoot, 'spirit', 'state', 'identity.json'),
  JSON.stringify({ name: 'sentinel', publicKey: 'PUB', privateKey: KEY_SENTINEL }),
  'utf8'
);

// ── THIS NODE MUST NOT KNOW ABOUT THE REAL RELAYS ────────────────────
//
// A unit suite must not depend on, or send traffic to, a live relay. This
// writes spirit/state/relays.json with one row at 127.0.0.1:1, refused by
// the kernel with no name lookup. The node's relays are rows of node.db's
// one table; relayKeys.importOld moves a relays.json in when found, and
// copies only a url with a pinned key, so this unpinned row lists none.
fs.mkdirSync(path.join(nodeRoot, 'spirit', 'state'), { recursive: true });
fs.writeFileSync(
  path.join(nodeRoot, 'spirit', 'state', 'relays.json'),
  JSON.stringify([{ label: 'nowhere', url: 'https://127.0.0.1:1' }]),
  'utf8'
);

let child = null;
let sink = null;

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
  if (sink) { try { sink.close(); } catch (e) { /* already closed */ } }
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

  // ---- 3. the write gate, through the real route, to real disk ----
  .then(function (port) {
    test.subHeading('fs.save: the write gate through the real route');
    const before = fs.readFileSync(ENTRY_SCRIPT, 'utf8');

    // ── NO VACUOUS GREEN ───────────────────────────────────────────
    //
    // A dead route answers 405, the write never happens, the file is
    // unchanged, and a refusal check would go green while proving nothing.
    // So it proves the verb is REACHABLE first, with a write that is
    // supposed to succeed, and only then asks the gate. An app's entry
    // script is writable (goal/G14.8, Andy: "we only protect intrinsic
    // apps, and they are already gated by the commit hooks as "core""), so
    // the non-canonical spelling of the entry script must LAND, at the
    // canonical place, and the refusal asked for is a non-canonical
    // spelling that reaches core (shell/../spirit/).
    return request(port, 'POST', '/api/spirit', { call: 'fs.save', args: { path: 'shell/natter/serverSurface-probe.json', content: '{"written":"by serverSurface, and deleted again below"}' } }).then(function (ok) {
      if (ok.status >= 200 && ok.status < 300) {
        test.check('fs.save is reachable and writes where it is allowed to');
      } else {
        test.fail('fs.save could not write an ALLOWED path (HTTP ' + ok.status + '), so the ' +
          'refusal below proves nothing — the verb is not wired.' + lastWords());
      }
      return request(port, 'POST', '/api/spirit', { call: 'fs.delete', args: { path: 'shell/natter/serverSurface-probe.json' } });
    }).then(function () {
      return request(port, 'POST', '/api/spirit', { call: 'fs.save', args: { path: 'shell/./textEditor/textEditor.js', content: '// serverSurface.js probe — the fakes\' copy, restored at once' } });
    }).then(function (r) {
      const after = fs.readFileSync(ENTRY_SCRIPT, 'utf8');
      if (r.status >= 200 && r.status < 300 && /serverSurface\.js probe/.test(after)) {
        test.check('fs.save writes an app entry script through a non-canonical spelling, at the canonical place (goal/G14.8)');
      } else {
        test.fail('fs.save of the entry script answered HTTP ' + r.status + ', on disk changed ' + (after !== before) + lastWords());
      }
      fs.writeFileSync(ENTRY_SCRIPT, before, 'utf8');
      return request(port, 'POST', '/api/spirit', { call: 'fs.save', args: { path: 'shell/../spirit/serverSurface-probe.js', content: '// serverSurface.js probe — must never reach disk' } });
    }).then(function (r) {
      const escaped = fs.existsSync(path.join(nodeRoot, 'spirit', 'serverSurface-probe.js'));
      if (r.status === 403 && !escaped) {
        test.check('fs.save refused a non-canonical spelling that leaves the writable roots (HTTP 403)');
      } else {
        test.fail('fs.save answered HTTP ' + r.status + ' to shell/../spirit/, on disk ' + escaped);
        try { fs.unlinkSync(path.join(nodeRoot, 'spirit', 'serverSurface-probe.js')); } catch (e) { /* none */ }
      }
      return port;
    });
  })

  // ---- 4. net.fetch refuses this machine, and fills no key ----
  .then(function (port) {
    test.subHeading('net.fetch hands no API key to this machine: it does not reach it at all');
    return startSink().then(function (s) {
      sink = s;
      // THE SINK IS ON THIS MACHINE, AND net.fetch DOES NOT REACH IT (goal/G29.20; Andy, 2026-10-18: "fetch will
      // not be able to reach ports on this machine, and agents may use it."). So it asserts the refusal by name and
      // that nothing arrived — never "nothing happened" read as a pass: the 403 and its code are asserted first.
      // net.fetch fills no key at all.
      const ask = function (url, headers) {
        return request(port, 'POST', '/api/spirit', { call: 'net.fetch', args: { url: url, method: 'POST', headers: headers, body: { hello: 'world' } } });
      };
      return ask('http://127.0.0.1:' + s.port + '/v1/messages', { 'x-api-key': '${ENV:ANTHROPIC_API_KEY}' }).then(function (r) {
        let body = null;
        try { body = JSON.parse((r && (r.text || r.body)) || 'null'); } catch (e) { body = (r && r.body) || null; }
        if (r && r.status === 403 && body && body.code === 'this-machine') test.check('net.fetch to a port on this machine is refused 403, this-machine');
        else test.fail('net.fetch to this machine answered ' + JSON.stringify(r && { status: r.status, body: body }).slice(0, 200) + lastWords());
        if (!s.seen.headers) test.check('and the sink on this machine received nothing, so no key reached it');
        else test.fail('net.fetch reached a port on this machine, carrying ' + JSON.stringify(s.seen.headers['x-api-key'] || ''));
        return ask('http://localhost:' + s.port + '/v1/responses', { Authorization: 'Bearer ${ENV:GROK_API_KEY}' });
      }).then(function (r) {
        if (r && r.status === 403 && !s.seen.headers) test.check('and by name too: localhost is refused, the Grok key goes nowhere');
        else test.fail('net.fetch to localhost answered ' + (r && r.status) + ', sink saw ' + JSON.stringify(s.seen.headers || null) + lastWords());
        return port;
      });
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

  // ---- 6. net.fetch carries any size; the packet bound stands for the rest ----
  // No proxy list or proxy verbs (goal/G29.20: "remove all the env logic and allow-list crap"): net.fetch's own door.
  .then(function (port) {
    test.subHeading('net.fetch carries any size; every other verb keeps the packet bound');
    function verb(obj, waitMs) {
      return request(port, 'POST', '/api/spirit', null, {
        raw: JSON.stringify(obj), headers: { 'Content-Type': 'application/json' }, waitMs: waitMs,
      });
    }
    // NO SIZE LIMIT ON WHAT THE PROXY CARRIES (2026-09-22). Andy: "no limit on size for proxy request, yes". A 100 KB
    // body — six times the door's packet bound — gets past the door: aimed at this machine, it is refused by the fence
    // (403, this-machine), which is net.fetch's own answer, never the door's 413.
    return verb({ verb: 'net.fetch', url: 'http://127.0.0.1:1/big', method: 'POST', body: { blob: 'x'.repeat(100000) } }).then(function (r) {
      if (r.status === 403 && /this-machine/.test(r.text)) test.check('a 100 KB net.fetch is not refused by size: it reaches net.fetch, whose fence answers this-machine');
      else test.fail('big net.fetch: HTTP ' + r.status + ' ' + r.text.slice(0, 120));
      // fs.save and fs.load are the owner's and unbounded too (goal/G33.10, fsOwnerUnlimited.js); fs.annotate is not.
      return verb({ verb: 'fs.annotate', path: 'shell/natter/too-big.json', payload: { blob: 'x'.repeat(100000) } });
    }).then(function (r) {
      if (r.status === 413 && /too large/i.test(r.text)) test.check('and any other verb with 100 KB is still refused 413, saying too large — the packet bound stands for them');
      else test.fail('a big non-proxy verb was not refused: HTTP ' + r.status);
      return port;
    });
  })

  // ---- every hub route can be CALLED, which is not what --check proves --
  .then(function (port) {
    test.subHeading('Every hub route survives being called');

    // WHY THIS EXISTS, and it is a class of bug rather than one bug.
    //
    // A route handler is dispatched inside a request callback, long after
    // the module finished loading. So a name it reaches for that is not
    // in scope THERE is a ReferenceError that `node --check` cannot see,
    // that no unit test calling the handler directly can see, and that
    // does not exist until somebody makes the request — at which point it
    // is uncaught inside the http server and the process dies.
    //
    // This asks nothing about what the routes ANSWER. Each refuses for
    // its own good reason here, and a refusal is a pass. The claim is
    // only: it was reached, it answered, and the process is still alive.
    //
    // A verb unknown to the table is answered by the door itself, which
    // is an answer, so the list below is kept to claimed verbs (asserted
    // further down, both directions). The verb handlers in server.js close
    // over `peerRouter` and `readJsonBody`; a verb nobody has posted to is
    // exactly as unproven as a route nobody has called.
    const LOOPBACK_CALLS = [
      // THE LIST IS ALL VERBS, at the one door /api/spirit.
      ['POST', '/api/spirit', { verb: 'peer.post' }],
      ['POST', '/api/spirit', { verb: 'contact.search' }],
      ['POST', '/api/spirit', { verb: 'contact.get', key: 'nobody' }],
      ['POST', '/api/spirit', { verb: 'peer.acquire', publicKey: 'NOPE' }],
      // Every loopback verb, at the one door. `net.fetch` is left out on
      // purpose — it would reach the internet from a test, and it is
      // covered where its refusals are.
      //
      // relay.partnerCheck and relay.claim reach the network too (a claim
      // aims at a named url whether or not the node lists it), so both are
      // handed 127.0.0.1:1 below.
      ['POST', '/api/spirit', { verb: 'jobs.search' }],
      ['POST', '/api/spirit', { verb: 'jobs.get', key: 'job_1' }],
      ['POST', '/api/spirit', { verb: 'fs.search', q: 'shell/*' }],
      ['POST', '/api/spirit', { verb: 'jobs.create' }],
      ['POST', '/api/spirit', { verb: 'jobs.update' }],
      ['POST', '/api/spirit', { verb: 'jobs.cancel' }],
      ['POST', '/api/spirit', { verb: 'jobs.delete' }],
      // The flat table, answered by the flat apiDoor's own front (goal/G30.6: the jobs api verb is gone).
      ['POST', '/api/spirit', { verb: 'api' }],
      // The owner's allow-table (apiAuth/G1.4), each posted without its fields: refused bad-request, reachable,
      // and nothing granted. Its own suite is jobsAuth.js.
      ['POST', '/api/spirit', { verb: 'auth.query' }],
      ['POST', '/api/spirit', { verb: 'auth.search' }],
      ['POST', '/api/spirit', { verb: 'auth.peer' }],
      ['POST', '/api/spirit', { verb: 'auth.grant' }],
      ['POST', '/api/spirit', { verb: 'auth.revoke' }],
      ['POST', '/api/spirit', { verb: 'auth.relabel' }],
      ['POST', '/api/spirit', { verb: 'fs.stat' }],
      ['POST', '/api/spirit', { verb: 'fs.load' }],
      ['POST', '/api/spirit', { verb: 'fs.annotations' }],
      ['POST', '/api/spirit', { verb: 'fs.save' }],
      ['POST', '/api/spirit', { verb: 'fs.delete' }],
      ['POST', '/api/spirit', { verb: 'fs.annotate' }],
      // This node's own two fields. `setName` is posted with no name,
      // which its own rule refuses — a refusal proves the handler was
      // REACHABLE just as well as a success does, and this sweep asks
      // nothing else. It is left refused deliberately: the fixture's name
      // is what several checks below read.
      //
      // `setDescription` is posted with one, because an empty description
      // is LEGAL (a node that has not written one is an ordinary state),
      // so there is no refusal available to hide behind and the honest
      // thing is to exercise the write. It touches a field nothing else
      // in this suite reads.
      ['POST', '/api/spirit', { verb: 'node.card' }],
      // desk/G2.5: reads the node's DEBUG, and changes nothing.
      ['POST', '/api/spirit', { verb: 'node.debug', debug: {} }],
      ['POST', '/api/spirit', { verb: 'node.setName' }],
      ['POST', '/api/spirit', { verb: 'node.setDescription', description: 'a node in a test' }],
      // A test node rotates its own throwaway key: the write is the point,
      // and the key-less test node refuses it 409, which is also honest.
      ['POST', '/api/spirit', { verb: 'node.rotateCipher' }],
      // A command for a puppet nobody is connected to: refused as
      // unreachable, which is the wire verb's honest answer here.
      ['POST', '/api/spirit', { verb: 'owner.boxSearch' }],
      ['POST', '/api/spirit', { verb: 'owner.boxGet', key: 'no-such-box' }],
      ['POST', '/api/spirit', { verb: 'owner.command', to: 'MCowBQYDK2VwAyEA' + 'A'.repeat(43) + '=', command: 'contact.list' }],
      // goal/G16.3: a claim aims at a url the node does not list yet (the
      // claim is what lists it), so it is handed 127.0.0.1:1, refused by
      // the kernel with no name lookup — the ReferenceError this guards
      // was at the CALL, which happens either way.
      ['POST', '/api/spirit', { verb: 'relay.claim', url: 'https://127.0.0.1:1', name: 'x' }],
      ['POST', '/api/spirit', { verb: 'relay.search', name: 'x' }],
      // goal/G16.3. Posted with no key, which it refuses: reachable, and
      // the node's list is left as it was.
      ['POST', '/api/spirit', { verb: 'relay.remove' }],
      // Posted with no label, which it refuses before anything else (hub.relayAdd): reachable, nothing listed, no
      // network asked.
      ['POST', '/api/spirit', { verb: 'relay.add', url: '', label: '' }],
      ['POST', '/api/spirit', { verb: 'relay.get', key: 'https://nowhere.invalid' }],
      // goal/G30.1. Posted with no name or email, which it refuses before anything else (hub.relayFace): reachable,
      // nothing asked of any relay.
      ['POST', '/api/spirit', { verb: 'relay.face', url: '', name: '', email: '' }],
      // goal/G30.2. Posted with no url, email or code, which it refuses before anything else (hub.relayJoin):
      // reachable, nothing asked of any relay.
      ['POST', '/api/spirit', { verb: 'relay.join', url: '', email: '', code: '' }],
      // cycle 11's R6. Reads what the node already wrote as reports
      // arrived; reaches no network, so unlike its neighbour it cannot
      // time out. With no relay named it answers the list of relays that
      // have a history, which is the cheapest call that proves the door.
      ['POST', '/api/spirit', { verb: 'relay.record' }],
      // relay.partnerCheck asks the relay at whatever url it is handed for
      // its card (hub.handlePartnerCheck, through peerPost), with no list
      // check first, so it reaches the network. 127.0.0.1:1 is refused
      // instantly by the kernel: no DNS, no waiting, and the handler must
      // ANSWER rather than throw, which is what this sweep checks.
      ['POST', '/api/spirit', { call: 'relay.partnerCheck', args: { publicKey: 'NOPE', url: 'https://127.0.0.1:1' } }],
      ['POST', '/api/spirit', { verb: 'contact.block', publicKey: 'NOPE' }],
      ['POST', '/api/spirit', { verb: 'contact.unblock', publicKey: 'NOPE' }],
      ['POST', '/api/spirit', { verb: 'contact.accept', publicKey: 'NOPE' }],
      ['POST', '/api/spirit', { verb: 'contact.label', publicKey: 'NOPE', myLabel: 'x' }],
      // Forgetting a key this node has no row for is a 404, which is the
      // honest answer and the one this surface check wants: the verb
      // exists, it is reachable, and it refuses what it should.
      ['POST', '/api/spirit', { verb: 'contact.forget', publicKey: 'NOPE' }],
      // And the door's own refusal, which must be an answer rather than a
      // throw: a verb nobody claimed.
      ['POST', '/api/spirit', { verb: 'nope.thing' }],
    ];

    const dead = [];
    // UNREACHED. A verb the table does not hold is answered by the door
    // itself — 400, "no such verb" — and that is an answer, so it would
    // sail through the survivability check. So a verb
    // this suite names must be one somebody claimed, and the one entry
    // that is deliberately unclaimed is asserted to say so.
    const unreached = [];
    return LOOPBACK_CALLS.reduce(function (chain, row) {
      return chain.then(function () {
        const startedAt = Date.now();
        return request(port, row[0], row[1], row[2] || (row[0] === 'POST' ? {} : null))
          .then(function (r) {
            // Status 0 is no answer at all: the handler threw and took the
            // connection — or the process — with it.
            // NAME THE VERB. Every entry in this list is the same method
            // and the same path, so the verb is the only part worth
            // printing. Milliseconds too, because the failure this
            // catches is usually slowness rather than death.
            if (r.status === 0) {
              dead.push(((row[2] && row[2].verb) || row[0] + ' ' + row[1]) +
                ' (' + r.error + ', ' + (Date.now() - startedAt) + 'ms)');
            }
            const verb = (row[2] && row[2].verb) || '';
            if (!verb) return;
            const missing = r.status === 400 && /no such verb/.test(String(r.text || ''));
            if (verb === 'nope.thing') {
              if (!missing) unreached.push('nope.thing was ANSWERED by somebody: ' + r.status);
            } else if (missing) {
              unreached.push(verb + ' is claimed by nobody');
            }
          });
      });
    }, Promise.resolve()).then(function () {
      if (!dead.length) {
        test.check('all ' + LOOPBACK_CALLS.length + ' loopback verbs answered rather than throwing');
      } else {
        test.fail(dead.join(', ') + ' — answered nothing. A handler that reaches for a ' +
          'name not in scope at request time is invisible until the request is made.' +
          lastWords());
      }

      if (!unreached.length) {
        test.check('and every verb named here reached a handler, while an unclaimed one did not');
      } else {
        test.fail(unreached.join('; ') + ' — a verb nobody claimed is refused BY THE DOOR, ' +
          'which is an answer. Without this, deleting a claim leaves the check above green.');
      }

      // ── AND THE LIST COVERS EVERY VERB, WHICH IS THE OTHER DIRECTION ──
      //
      // The check above reads "every verb NAMED HERE reached a handler".
      // One direction. A verb that is claimed and never named is invisible
      // to this suite — it can throw on first contact for as long as
      // nobody posts to it.
      //
      // Parsed from the claim blocks rather than asked of a running
      // server, because there is no verb that lists verbs — and inventing
      // one to satisfy a test would put a door in the register to check
      // the register.
      const serverSrc = fs.readFileSync(path.join(nodeRoot, 'spirit', 'server.js'), 'utf8');
      const claimed = [];
      // EVERY CLAIM, WHATEVER ITS VALUE (a handler written as a function,
      // proxyVerb(...) or a name alike). A family is mounted with its verbs bare
      // (loopbackVerbs.mount('fs', dir, {'stat': ...})) and the table
      // names them fs.stat: the family from each mount block, the verbs
      // from its four-space keys.
      // A block never runs into the next mount: the config family is mounted empty on one line (goal/G30.20), and a
      // block reaching past it credited the next family's verbs to config.
      for (const block of serverSrc.matchAll(/loopbackVerbs\.mount\('([a-z][a-z0-9]*)',(?:(?!loopbackVerbs\.mount)[\s\S])*?\n {2}\}, \{ wire:/g)) {
        for (const m of block[0].matchAll(/^ {4}'([a-z][a-zA-Z0-9]*)':/gm)) claimed.push(block[1] + '.' + m[1]);
      }

      // Named ANYWHERE in this suite, as `verb: '<family>.<verb>'`.
      const ownSrc = fs.readFileSync(__filename, 'utf8');
      const named = [...ownSrc.matchAll(/verb: '([a-z]+\.[a-zA-Z]+)'/g)].map(function (x) { return x[1]; });
      const unnamed = claimed.filter(function (v) {
        return named.indexOf(v) === -1 && v !== 'net.fetch';
      });

      if (claimed.length < 10) {
        test.fail('only ' + claimed.length + ' verbs parsed out of server.js — the claim shape moved');
      } else if (unnamed.length === 0) {
        test.check('and the sweep names every verb the table claims (' + claimed.length + ', net.fetch aside)');
      } else {
        test.fail('claimed but never posted to: ' + unnamed.join(', ') +
          ' — add them above, or this suite is green about code it never ran');
      }
      // SAME is read by nothing: the rename and remove-peer doors whose agreement it checked are gone.
      const SAME = { url: 'https://not-on-the-list.example', label: 'x', key: 'NOPE' };
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

      return Promise.resolve().then(function () {
      return request(port, 'GET', '/api/version').then(function (after) {
        if (after.status === 200) {
          test.check('and the process is still alive after all of them');
        } else {
          test.fail('the server DIED somewhere in the hub surface (' +
            (after.error || 'HTTP ' + after.status) + ')' + lastWords());
        }
        return port;
      });
      });
    });
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

        // ── AND WITHOUT A Content-Length TO BELIEVE ──────────────────
        //
        // The header is a CLAIM. `Transfer-Encoding: chunked` carries
        // none at all, so a pre-check alone is bypassed by omitting it —
        // which is why the running total is enforced while reading and
        // the socket destroyed. Either a 413 or a dead socket is a pass
        // here; what must not happen is the whole body being accepted.
        return new Promise(function (resolve) {
          const req = http.request({
            hostname: '127.0.0.1', port: port, path: '/api/spirit', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' },
          }, function (res) {
            let t = '';
            res.on('data', function (c) { t += c; });
            res.on('end', function () { resolve({ status: res.statusCode, text: t }); });
          });
          req.on('error', function (e) { resolve({ status: 0, error: e.code || String(e) }); });
          req.setTimeout(8000, function () { req.destroy(new Error('timeout')); });
          req.write('{"verb":"contact.search","pad":"');
          req.write(over);
          req.write('"}');
          req.end();
        }).then(function (chunked) {
          if (chunked.status === 413 || chunked.status === 0) {
            test.check('and a chunked body with no Content-Length is stopped too (' +
              (chunked.status === 0 ? chunked.error : '413') + ')');
          } else {
            test.fail('chunked oversize was accepted: HTTP ' + chunked.status);
          }
          return port;
        });
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
