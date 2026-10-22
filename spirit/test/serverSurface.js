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
//   3. fs.save's write gate, same non-canonical spelling as
//      pathCanonicalization.js but through the real route, proving the
//      bypass actually reaches disk rather than only the predicate;
//   4. net.fetch substitutes ${ENV:ANTHROPIC_API_KEY} into headers for
//      ANY destination the caller names — the allow-list gates which env
//      var, never which host receives it.
//   5. ANY WEB PAGE could make the node act (2026-09-22, found by
//      wsl-claude, confirmed on both agents' nodes). A POST with
//      Content-Type text/plain is a CORS "simple" request: a browser sends
//      it from any site with no preflight and only hides the ANSWER — the
//      verb runs. So a page Andy visited could spend his keys through
//      net.fetch, write files, start jobs, or post to peers as him. The
//      Host check stops DNS rebinding, not this.
//   6. THE OWNER'S PROXY LIST (2026-09-22, design/proxy/THE-PROXY.md):
//      relay-state/proxy.json is neither served nor writable through fs;
//      closing the gate, or one key, stops net.fetch on the next call; and
//      the proxy imposes no wait of its own — a far end slower than the old
//      10-second default is still answered.
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
const limits = require('../run/js/limits.js');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const { setupRelayFakes } = require('./setupRelayFakes');

const KEY_SENTINEL = 'SENTINEL-PRIVATE-KEY-must-never-be-served';
const ENV_KEY_SENTINEL = 'SENTINEL-API-KEY-must-never-leave-the-box';
// Andy's Grok key (grokReview, 2026-09-22): grokReview and the key fill went with goal/G29.20; the sentinel only proves nothing leaks.
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
const ENTRY_SCRIPT = path.join(nodeRoot, 'shell', 'natter', 'natter.js');

// A relay identity for case 2 to try to steal. relay-state/ is gitignored
// and this node lives in the temp dir, so this never touches the repo.
fs.mkdirSync(path.join(nodeRoot, 'relay-state'), { recursive: true });
fs.writeFileSync(
  path.join(nodeRoot, 'relay-state', 'identity.json'),
  JSON.stringify({ name: 'sentinel', publicKey: 'PUB', privateKey: KEY_SENTINEL }),
  'utf8'
);

// ── THIS NODE MUST NOT KNOW ABOUT THE REAL RELAYS ────────────────────
//
// setupRelayFakes copies every TRACKED spirit/ file, and
// app/natter/relays.json is tracked — so every fake node booted with the
// production list in it:
//
//   [{ "label": "spirit", "url": "https://spirit.andyflinn.com" }, …]
//
// `relay.status` is ownerBadge.probe, which fetches /api/relay/who from
// EVERY row. So the verb sweep below made a real HTTPS request to the
// live public relay on every run of this suite — DNS, TLS, round trip —
// and then failed with `relay.status (Error: timeout, 8013ms)` whenever
// the parallel harness made that exceed the 8s budget. One run in five,
// looking like flakiness.
//
// Two things wrong with that, and the slow one is the lesser. A unit
// suite must not depend on a machine in a data centre being up, and it
// must not send traffic to it — spirit.andyflinn.com was being probed by
// every full harness run on this laptop.
//
// setupRelayFakes' own header says local state "(relays.json,
// preferences.json, ...) is never touched", which was true when
// relays.json was untracked. It is tracked now, so that sentence is
// wrong and this is the consequence landing somewhere else.
//
// 127.0.0.1:1 is refused by the kernel with no name lookup. The list is
// non-empty on purpose, so the relay verbs below have a row to answer about.
// goal/G16.3: the node's relay list is node state, relay-state/relays.json.
fs.mkdirSync(path.join(nodeRoot, 'relay-state'), { recursive: true });
fs.writeFileSync(
  path.join(nodeRoot, 'relay-state', 'relays.json'),
  JSON.stringify([{ label: 'nowhere', url: 'https://127.0.0.1:1' }]),
  'utf8'
);

let child = null;
let sink = null;

// WHAT THE NODE SAID ON ITS WAY DOWN.
//
// This was `stdio: 'ignore'`, which meant every failure in this file read
// as ECONNREFUSED and nothing else — the suite booted a process, killed
// it, and threw away the one thing that explains why. Two separate
// crashes on 2026-09-13 each cost a manual re-run with the stderr piped
// back in by hand before they could be read.
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
    child = spawn(process.execPath, ['js/server.js', '--port', String(port)], {
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
    test.subHeading('fs.save: the write gate through the real route');
    const before = fs.readFileSync(ENTRY_SCRIPT, 'utf8');

    // ── THE SAME VACUITY THIS FILE ALREADY FELL INTO ONCE ───────────
    //
    // Case 4 kept passing when its route vanished, because "nothing
    // happened" took the "the key was withheld" branch. THIS check has
    // the identical shape: a dead route answers 405, the write never
    // happens, the file is unchanged, and both assertions go green while
    // proving nothing at all.
    //
    // So it proves the verb is REACHABLE first, with a write that is
    // supposed to succeed, and only then asks the gate. Until goal/G14.8
    // (2026-10-10) the asked write was the app entry script, which the
    // gate refused for every caller; the gate is open to it now (Andy:
    // "we only protect intrinsic apps, and they are already gated by the
    // commit hooks as "core""), so the non-canonical spelling of the entry
    // script must LAND, at the canonical place, and the refusal asked for
    // is a non-canonical spelling that escapes the writable roots.
    return request(port, 'POST', '/api/spirit', {
      verb: 'fs.save',
      path: 'shell/natter/serverSurface-probe.json',
      content: '{"written":"by serverSurface, and deleted again below"}',
    }).then(function (ok) {
      if (ok.status >= 200 && ok.status < 300) {
        test.check('fs.save is reachable and writes where it is allowed to');
      } else {
        test.fail('fs.save could not write an ALLOWED path (HTTP ' + ok.status + '), so the ' +
          'refusal below proves nothing — the verb is not wired.' + lastWords());
      }
      return request(port, 'POST', '/api/spirit', {
        verb: 'fs.delete', path: 'shell/natter/serverSurface-probe.json',
      });
    }).then(function () {
      return request(port, 'POST', '/api/spirit', {
        verb: 'fs.save',
        path: 'shell/./natter/natter.js',
        content: '// serverSurface.js probe — the fakes\' copy, restored at once',
      });
    }).then(function (r) {
      const after = fs.readFileSync(ENTRY_SCRIPT, 'utf8');
      if (r.status >= 200 && r.status < 300 && /serverSurface\.js probe/.test(after)) {
        test.check('fs.save writes an app entry script through a non-canonical spelling, at the canonical place (goal/G14.8)');
      } else {
        test.fail('fs.save of the entry script answered HTTP ' + r.status + ', on disk changed ' + (after !== before) + lastWords());
      }
      fs.writeFileSync(ENTRY_SCRIPT, before, 'utf8');
      return request(port, 'POST', '/api/spirit', {
        verb: 'fs.save',
        path: 'shell/../js/serverSurface-probe.js',
        content: '// serverSurface.js probe — must never reach disk',
      });
    }).then(function (r) {
      const escaped = fs.existsSync(path.join(nodeRoot, 'js', 'serverSurface-probe.js'));
      if (r.status === 403 && !escaped) {
        test.check('fs.save refused a non-canonical spelling that leaves the writable roots (HTTP 403)');
      } else {
        test.fail('fs.save answered HTTP ' + r.status + ' to shell/../js/, on disk ' + escaped);
        try { fs.unlinkSync(path.join(nodeRoot, 'js', 'serverSurface-probe.js')); } catch (e) { /* none */ }
      }
      return port;
    });
  })

  // ---- 4. the proxy's env substitution is not scoped to a destination ----
  .then(function (port) {
    test.subHeading('net.fetch hands no API key to this machine: it does not reach it at all');
    return startSink().then(function (s) {
      sink = s;
      // THE SINK IS ON THIS MACHINE, AND SINCE goal/G29.20 net.fetch DOES NOT REACH IT (Andy, 2026-10-18: "fetch will
      // not be able to reach ports on this machine, and agents may use it."). This section proved the key withheld from
      // an unrelated host by reading what the sink received; a sink on 127.0.0.1 now receives nothing, by the fence. So
      // it asserts the refusal by name and that nothing arrived — never "nothing happened" read as "withheld" (the trap
      // its 2026-09-15 note named): the 403 and its code are asserted first. Which key goes to which host is
      // gone with goal/G29.20: net.fetch fills no key at all.
      const ask = function (url, headers) {
        return request(port, 'POST', '/api/spirit', { verb: 'net.fetch', url: url, method: 'POST', headers: headers, body: { hello: 'world' } });
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
    const verb = JSON.stringify({ verb: 'node.card' });
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
  // THE OWNER'S PROXY LIST AND ITS VERBS STOOD HERE (proxy.search, get, close, open; relay-state/proxy.json): they went
  // with goal/G29.20 ("remove all the env logic and allow-list crap"). What stands is net.fetch's own door.
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
      return verb({ verb: 'fs.save', path: 'shell/natter/too-big.json', content: 'x'.repeat(100000) });
    }).then(function (r) {
      if (r.status === 413) test.check('and any other verb with 100 KB is still refused 413 — the packet bound stands for them');
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
    // That happened on 2026-09-13: /api/hub/invite was given
    // `answerer.relayKey`, and `answerer` is a const inside the boot
    // block. Every suite was green and the first real mint killed the
    // node. `peerRouter` sits at module scope for exactly this reason and
    // had for months — the lesson was already in the file, unasserted.
    //
    // This asks nothing about what the routes ANSWER. Each refuses for
    // its own good reason here, and a refusal is a pass. The claim is
    // only: it was reached, it answered, and the process is still alive.
    //
    // ── THE LIST CANNOT POLICE ITSELF, so it is pruned by hand ────────
    //
    // A DELETED route answers 404, which is an answer, so it passes this
    // check exactly like a live one — the suite is watching for a dead
    // PROCESS, not a dead route. `POST /api/hub/send` sat here for two
    // days after it was deleted on 2026-09-13, proving nothing about
    // nothing, and `GET /api/hub/inbox` would have joined it: both were
    // taken out on 2026-09-15 when R8 removed the second one.
    //
    // Whether a route exists at all is protocolSurface.js's question for
    // the relay side, and no equivalent register covers the loopback
    // door. That
    // is a real gap and it is named here rather than papered over.
    // PRUNED 2026-09-15, and seven of the fourteen entries were dead —
    // claim, invite, remove-peer, rename, rotate-password, status and
    // device. Four went when the post path collapsed onto peerPost, three
    // more when their namespaces folded onto /api/spirit, and every one
    // of them kept answering 404 and kept passing. The warning above was
    // already written; this is it coming true at scale.
    //
    // THE VERBS ARE HERE FOR THE SAME REASON THE ROUTES ARE. The crash
    // this guards against is a handler reaching at request time for a
    // name that is not in scope, and the claim block at the foot of
    // server.js sits INSIDE the boot block and closes over `presence`,
    // `peerRouter` and `readJsonBody` — which is precisely the shape of
    // the 2026-09-13 death. A verb nobody has posted to since it was
    // claimed is exactly as unproven as a route nobody has called.
    const LOOPBACK_CALLS = [
      // THE LIST IS ALL VERBS NOW. Not one /api/hub/* route is left on
      // this node — the fold finished on 2026-09-15 — so the pruning
      // this block's header warns about has nothing more to prune, and
      // the reachability check below is the whole of what keeps it
      // honest.
      ['POST', '/api/spirit', { verb: 'peer.post' }],
      ['POST', '/api/spirit', { verb: 'contact.search' }],
      ['POST', '/api/spirit', { verb: 'contact.get', key: 'nobody' }],
      ['POST', '/api/spirit', { verb: 'peer.acquire', publicKey: 'NOPE' }],
      // Every loopback verb, at the one door. `net.fetch` is left out on
      // purpose — it would reach the internet from a test, and it is
      // covered where its refusals are.
      //
      // IT IS NOT THE ONLY ONE, which this said until 2026-09-16.
      // relay.partnerCheck reaches the network too, and since goal/G16.3
      // so does relay.claim: a claim is what puts a relay on the node's
      // list, so it aims at a named url whether or not the node lists it.
      // Both are handed 127.0.0.1:1 below for that reason. See the note on
      // partnerCheck for what believing otherwise cost.
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
      // network asked. It was claimed and never posted (red before goal/G29.20; found clearing that item).
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
      // Reads a roll from a url this node is not on. 127.0.0.1:1 for the
      // reason partnerCheck below uses it: refused by the kernel, no DNS,
      // and the handler must ANSWER rather than throw.
      // ── THIS ONE REACHES THE NETWORK, AND SAID IT DID NOT ───────────
      //
      // The note above says net.fetch "is the only one that would reach
      // the internet from a test". That was wrong: handlePartnerCheck
      // calls relayRequest(url, 'GET', '/api/relay/who') on whatever url
      // it is handed, with no list check first — that is the whole point
      // of the verb, since a partner's relay is by definition somewhere
      // this node has never been.
      //
      // So `https://not-a-relay.example` made a real DNS lookup on every
      // run, and how long that takes is the resolver's business. Inside
      // the parallel harness it went past the 8s per-request budget and
      // this suite failed with `POST /api/spirit (Error: timeout)` —
      // twice in a row, while passing 3/3 when run alone. It reads as
      // flakiness and is a test doing I/O it disclaimed.
      //
      // 127.0.0.1:1 is refused instantly by the kernel: no DNS, no
      // waiting, and the same thing proved — handlePartnerCheck catches
      // the failure and ANSWERS rather than throwing, which is exactly
      // what this sweep exists to check.
      ['POST', '/api/spirit', { verb: 'relay.partnerCheck', publicKey: 'NOPE', url: 'https://127.0.0.1:1' }],
      ['POST', '/api/spirit', { verb: 'contact.block', publicKey: 'NOPE' }],
      ['POST', '/api/spirit', { verb: 'contact.unblock', publicKey: 'NOPE' }],
      ['POST', '/api/spirit', { verb: 'contact.accept', publicKey: 'NOPE' }],
      ['POST', '/api/spirit', { verb: 'contact.label', publicKey: 'NOPE', myLabel: 'x' }],
      // Forgetting a key this node has no row for is a 404, which is the
      // honest answer and the one this surface check wants: the verb
      // exists, it is reachable, and it refuses what it should.
      ['POST', '/api/spirit', { verb: 'contact.forget', publicKey: 'NOPE' }],
      ['POST', '/api/spirit', { verb: 'contact.senders' }],
      ['POST', '/api/spirit', { verb: 'contact.setSenders', policy: 'silent' }],
      // And the door's own refusal, which must be an answer rather than a
      // throw: a verb nobody claimed.
      // Never called anywhere in this file until 2026-09-27: the check
      // below only saw claims written as `function`, and these two are
      // claimed through proxyVerb(...). An empty host is refused, so
      // nothing on the list changes.
      ['POST', '/api/spirit', { verb: 'nope.thing' }],
    ];

    const dead = [];
    // UNREACHED, WHICH IS THE VACUITY THE LIST ABOVE COULD NOT SEE. A
    // verb the table does not hold is answered by the door itself — 400,
    // "no such verb" — and that is an answer, so it would sail through
    // the survivability check exactly as a deleted route did. So a verb
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
            // and the same path, so "POST /api/spirit (Error: timeout)"
            // identified nothing — a timeout here was reported twice as
            // an anonymous failure, and both times the next step was
            // guessing which of twenty-six calls it was. The verb is the
            // only part that differs, so it is the only part worth
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
      // nobody posts to it, which is exactly the 2026-09-13 death this
      // block exists to prevent, wearing the one disguise the block did
      // not check for.
      //
      // Found by adding `relay.roster` and watching a full green run.
      //
      // Parsed from the claim blocks rather than asked of a running
      // server, because there is no verb that lists verbs — and inventing
      // one to satisfy a test would put a door in the register to check
      // the register.
      const serverSrc = fs.readFileSync(path.join(nodeRoot, 'js', 'server.js'), 'utf8');
      const claimed = [];
      // EVERY CLAIM, WHATEVER ITS VALUE. This matched only `': function`,
      // so a verb claimed as `proxyVerb(...)` or `handleCreateJob` was
      // invisible here, and proxy.allow and proxy.remove were never called
      // while this said "the sweep names every verb" (wsl-claude, writing
      // everyVerb.js). doorContract.js's pattern.
      // SINCE goal/G30.4 a family is mounted with its verbs bare
      // (loopbackVerbs.mount('fs', dir, {'stat': ...})) and the table
      // names them fs.stat: the family from each mount block, the verbs
      // from its four-space keys.
      for (const block of serverSrc.matchAll(/loopbackVerbs\.mount\('([a-z][a-z0-9]*)',[\s\S]*?\n {2}\}, \{ wire:/g)) {
        for (const m of block[0].matchAll(/^ {4}'([a-z][a-zA-Z0-9]*)':/gm)) claimed.push(block[1] + '.' + m[1]);
      }

      // Named ANYWHERE in this suite: the proxy verbs are driven by their
      // own cases above, with arguments, rather than by the bare sweep.
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
      // ── THE DOORS THAT SHARE askRelay MUST BE HANDED THE SAME DEPS ──
      //
      // The block above deliberately asks nothing about what a route
      // ANSWERS, and that is why it could not see this one. `rename` and
      // `remove-peer` are the same door twice: both build an ordinary
      // post and hand it to `hub.askRelay`, which needs `{ router,
      // relayKey }`. `rename` was wired with `{ presence }` instead, so
      // askRelay refused at its first line — 503, "this node is not
      // connected to a relay" — on every call, for every input, on a node
      // that was connected. The verb shipped and had never once worked.
      //
      // Nothing caught it: unit tests call the handler with deps of their
      // own, `node --check` sees a valid object literal, and a 503 is an
      // answer, so the survivability check above passed it.
      //
      // WHAT MAKES IT VISIBLE is that both doors, given a url on no
      // Natter list, must refuse for the SAME reason — withChosenRelay,
      // before any network — and therefore with the same status. A door
      // handed the wrong deps never reaches that point and says 503
      // instead. Measured on the broken build: rename 503, remove-peer
      // 403. This asserts they agree, whatever the number turns out to be.
      const SAME = { url: 'https://not-on-the-list.example', label: 'x', key: 'NOPE' };
      // ── ONE DOOR PUTS THINGS ON THE WIRE ─────────────────────────────
      //
      //   Andy: "I am aiming to close all post-path doors on node"
      //
      // FOUR DOORS STOOD HERE and this checked that they agreed with each
      // other, because each built one packet body and handed it to
      // router.post and any of them could be wired wrongly on its own.
      // One was: /api/hub/rename spent a day answering 503 to every call
      // because it had been given the wrong deps, and nothing could see
      // it — which is what this check was added for.
      //
      // All four are gone. What replaces the check is the invariant it
      // was standing in for, and it is a better one, because it is about
      // the thing itself rather than about four things matching:
      //
      //   NOTHING BUT handlePost MAY CALL router.post.
      //
      // Read off hub.js rather than exercised over HTTP, because it is a
      // claim about the SHAPE of that file: a second caller is a second
      // way onto the wire, whether or not anybody has wired a route to it
      // yet. That is the failure mode the doors had — correct in
      // isolation, and one more place for the next one to be forgotten.
      let hubSrc = '';
      try { hubSrc = fs.readFileSync(path.join(__dirname, '..', 'run', 'js', 'hub.js'), 'utf8'); }
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
  // `readJsonBody` did `body += chunk` with NO limit. The payload caps in
  // relay.js are checked after the body is whole and parsed, so they
  // bounded what got ROUTED and never what got ACCEPTED — on a public
  // box, on every POST, /claim and /device included.
  //
  // Which made the memory arithmetic an intention rather than a bound:
  // "256 concurrent × 16 KB ≈ 4 MB" describes routed requests, while real
  // exposure was concurrent sockets × whatever they chose to send, at
  // roughly 3× through `+=` and JSON.parse.
  .then(function (port) {
    test.subHeading('A body over the cap is refused before it is read');

    const over = 'x'.repeat(limits.BODY_MAX + 1024);

    return request(port, 'POST', '/api/spirit', { verb: 'contact.search', pad: over })
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

  // ---- 1. survivability. Runs LAST: it currently kills the process ----
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
