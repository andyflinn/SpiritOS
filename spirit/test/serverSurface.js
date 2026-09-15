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
      env: Object.assign({}, process.env, { ANTHROPIC_API_KEY: ENV_KEY_SENTINEL }),
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
    test.subHeading('fs.save cannot overwrite an app entry script');
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
    // supposed to succeed, and only then asks whether the gate refuses
    // the one that must not. A test about a gate has to know the door
    // opens.
    return request(port, 'POST', '/api/spirit', {
      verb: 'fs.save',
      path: 'app/natter/serverSurface-probe.json',
      content: '{"written":"by serverSurface, and deleted again below"}',
    }).then(function (ok) {
      if (ok.status >= 200 && ok.status < 300) {
        test.check('fs.save is reachable and writes where it is allowed to');
      } else {
        test.fail('fs.save could not write an ALLOWED path (HTTP ' + ok.status + '), so the ' +
          'refusal below proves nothing — the verb is not wired.' + lastWords());
      }
      return request(port, 'POST', '/api/spirit', {
        verb: 'fs.delete', path: 'app/natter/serverSurface-probe.json',
      });
    }).then(function () {
      return request(port, 'POST', '/api/spirit', {
        verb: 'fs.save',
        path: 'app/./natter/natter.js',
        content: '// serverSurface.js probe — must never reach disk',
      });
    }).then(function (r) {
      if (r.status >= 200 && r.status < 300) {
        test.fail('fs.save ACCEPTED a non-canonical entry-script path (HTTP ' + r.status + ')');
      } else {
        test.check('fs.save refused a non-canonical entry-script path (HTTP ' + r.status + ')');
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
    test.subHeading('net.fetch does not hand the API key to any host named');
    return startSink().then(function (s) {
      sink = s;
      // ── THE VERB, NOT THE ROUTE (2026-09-15) ────────────────────────
      //
      // This posted to /api/proxy. That route folded into the single
      // loopback door as `net.fetch`, and pointing this at the new one is
      // the mechanical half of the change.
      //
      // The half that matters: IT PASSED ANYWAY when the route vanished.
      // A 405 means the proxy never ran, the sink saw nothing, `received`
      // was '' — and '' took the "withheld the key" branch. The check
      // read "nothing happened" as "the key was withheld", which is the
      // most comfortable way for a security test to be wrong.
      //
      // So the first thing asserted now is that the sink was REACHED.
      // Without it this can only fail by leaking; with it, it also fails
      // by not happening.
      return request(port, 'POST', '/api/spirit', {
        verb: 'net.fetch',
        url: 'http://127.0.0.1:' + s.port + '/v1/messages',
        method: 'POST',
        headers: { 'x-api-key': '${ENV:ANTHROPIC_API_KEY}' },
        body: { hello: 'world' },
      }).then(function () {
        if (s.seen.headers) {
          test.check('net.fetch reached the host it was given — so what follows is about the key');
        } else {
          test.fail('net.fetch never reached the sink, so the key check below proves nothing. ' +
            'The verb is not wired, or the door refused it.' + lastWords());
        }

        const received = (s.seen.headers && s.seen.headers['x-api-key']) || '';
        if (received === ENV_KEY_SENTINEL) {
          test.fail('net.fetch sent the real ANTHROPIC_API_KEY to an unrelated host');
        } else if (received.indexOf('${ENV:') === 0 || received === '') {
          test.check('and withheld the key from an unrelated host (sent ' + JSON.stringify(received) + ')');
        } else {
          test.check('and did not send the real key (sent ' + JSON.stringify(received) + ')');
        }
        return port;
      });
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
    // the relay side, and no equivalent register covers /api/hub/*. That
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
    const HUB_ROUTES = [
      ['POST', '/api/hub/post'],
      ['POST', '/api/hub/contact'],
      ['GET', '/api/hub/who'],
      ['GET', '/api/hub/handle'],
      // Every loopback verb, at the one door. `net.fetch` is left out on
      // purpose: it is the only one that would reach the internet from a
      // test, and it is covered where its refusals are.
      ['POST', '/api/spirit', { verb: 'jobs.list' }],
      ['POST', '/api/spirit', { verb: 'jobs.create' }],
      ['POST', '/api/spirit', { verb: 'jobs.update' }],
      ['POST', '/api/spirit', { verb: 'jobs.cancel' }],
      ['POST', '/api/spirit', { verb: 'jobs.delete' }],
      ['POST', '/api/spirit', { verb: 'fs.stat' }],
      ['POST', '/api/spirit', { verb: 'fs.annotations' }],
      ['POST', '/api/spirit', { verb: 'fs.save' }],
      ['POST', '/api/spirit', { verb: 'fs.delete' }],
      ['POST', '/api/spirit', { verb: 'fs.annotate' }],
      ['POST', '/api/spirit', { verb: 'device.info' }],
      ['POST', '/api/spirit', { verb: 'device.rotate' }],
      // A url on no Natter list, so this is refused before any network is
      // touched — the ReferenceError was at the CALL, which happens
      // either way.
      ['POST', '/api/spirit', { verb: 'relay.claim', url: 'https://not-on-the-list.example', name: 'x' }],
      ['POST', '/api/spirit', { verb: 'relay.status', name: 'x' }],
      ['POST', '/api/spirit', { verb: 'contact.block', publicKey: 'NOPE' }],
      ['POST', '/api/spirit', { verb: 'contact.unblock', publicKey: 'NOPE' }],
      ['POST', '/api/spirit', { verb: 'contact.accept', publicKey: 'NOPE' }],
      ['POST', '/api/spirit', { verb: 'contact.label', publicKey: 'NOPE', myLabel: 'x' }],
      ['POST', '/api/spirit', { verb: 'contact.senders' }],
      ['POST', '/api/spirit', { verb: 'contact.setSenders', policy: 'silent' }],
      // And the door's own refusal, which must be an answer rather than a
      // throw: a verb nobody claimed.
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
    return HUB_ROUTES.reduce(function (chain, row) {
      return chain.then(function () {
        return request(port, row[0], row[1], row[2] || (row[0] === 'POST' ? {} : null))
          .then(function (r) {
            // Status 0 is no answer at all: the handler threw and took the
            // connection — or the process — with it.
            if (r.status === 0) dead.push(row[0] + ' ' + row[1] + ' (' + r.error + ')');
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
        test.check('all ' + HUB_ROUTES.length + ' hub routes answered rather than throwing');
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
          '/api/hub/post is the only way onto the wire. A second caller is a second ' +
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
