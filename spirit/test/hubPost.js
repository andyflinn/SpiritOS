'use strict';

// spirit/test/hubPost.js
// /api/hub/post, driven as a function.
//
// ── WHY THIS SUITE EXISTS AT ALL ─────────────────────────────────────
//
// Until 2026-09-13 this route was the only /api/hub/* one written out
// inside server.js's route table. Every other hub verb named a handler
// in hub.js and could therefore be called, and tested, as a function.
// This one could only be reached by making an HTTP request — so the
// rules it enforces were only ever exercised live, by hand.
//
// And they are rules, not plumbing. Three decisions live here:
//
//   1. is this node attached to a relay at all
//   2. WHICH relay to post through, and what `via` overrides
//   3. what "not reachable" means, and what the caller is told
//
// (2) is the interesting one: a peer reachable two ways is reachable,
// and choosing between them is a routing decision that had no business
// sitting in a web server's switch statement.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const hubMod = require('../run/js/hub');
const hub = hubMod.createHub(process.cwd());
const os = require('os');
const seenPeers = require('../run/js/seenPeers');

test.startTest('hub.handlePost — the router verb, callable without a server');

// A response, recorded. Only what the handler touches.
function fakeRes() {
  const res = {
    status: 0,
    headers: null,
    body: '',
    writeHead: function (status, headers) { res.status = status; res.headers = headers; },
    end: function (text) { res.body = text == null ? '' : String(text); },
    json: function () { try { return JSON.parse(res.body); } catch (e) { return null; } },
  };
  return res;
}

// readJsonBody, as server.js passes it: a function of req returning a
// promise of the parsed body.
function bodyOf(obj) {
  return function () {
    return obj === undefined ? Promise.reject(new Error('bad json')) : Promise.resolve(obj);
  };
}

function presenceNaming(map) {
  return { relaysNaming: function (key) { return map[key] || []; } };
}

const PEER = 'PEERKEYAAA';
const RELAY_A = 'https://a.example';
const RELAY_B = 'https://b.example';

function run() {
  // -------------------------------------------------------------------
  test.subHeading('When there is no relay to post through');
  // -------------------------------------------------------------------

  const noRelay = fakeRes();
  return hub.handlePost({}, noRelay, bodyOf({ to: PEER, text: 'hi' }), {})
    .then(function () {
      // 503 and not 500: nothing is broken, this node simply is not
      // attached to anything yet. A caller can act on that.
      if (noRelay.status === 503 && /not connected to a relay/.test(noRelay.body)) {
        test.check('an unattached node refuses with 503 and says why');
      } else {
        test.fail('got ' + noRelay.status + ' ' + noRelay.body);
      }

      // -----------------------------------------------------------------
      test.subHeading('Choosing a relay');
      // -----------------------------------------------------------------

      const sent = [];
      const router = {
        post: function (url, to, text) {
          sent.push({ url: url, to: to, text: text });
          return Promise.resolve({ ok: true, status: 200, hash: 'h1', text: 'ack' });
        },
      };
      const deps = {
        router: router,
        presence: presenceNaming({ [PEER]: [RELAY_A, RELAY_B] }),
      };

      const plain = fakeRes();
      return hub.handlePost({}, plain, bodyOf({ to: PEER, text: 'hello' }), deps)
        .then(function () {
          // THE ROUTING RULE, asserted rather than assumed. Two relays
          // name this peer; the first is taken. Nothing in the system
          // said so out loud before this check existed.
          if (sent.length === 1 && sent[0].url === RELAY_A && sent[0].to === PEER) {
            test.check('with two relays naming the peer, the first is used and the app is not asked');
          } else {
            test.fail('posted ' + JSON.stringify(sent));
          }

          if (plain.status === 200 && plain.json() && plain.json().hash === 'h1') {
            test.check("and the peer's answer comes back to the caller, hash and all");
          } else {
            test.fail('caller got ' + plain.status + ' ' + plain.body);
          }

          const viaB = fakeRes();
          return hub.handlePost({}, viaB, bodyOf({ to: PEER, text: 'hello', via: RELAY_B }), deps)
            .then(function () {
              // `via` is how the cost of each road gets MEASURED rather
              // than guessed at — the reason it exists at all.
              if (sent.length === 2 && sent[1].url === RELAY_B) {
                test.check('`via` names a specific relay, and that is the one used');
              } else {
                test.fail('posted ' + JSON.stringify(sent));
              }

              const viaNowhere = fakeRes();
              return hub.handlePost({}, viaNowhere,
                bodyOf({ to: PEER, text: 'hello', via: 'https://nope.example' }), deps)
                .then(function () {
                  // An unreachable CHOICE is refused like any other
                  // unreachable peer. It must not quietly fall back to a
                  // relay the caller did not name — a measurement that
                  // silently took the other road measures nothing.
                  if (viaNowhere.status === 503 && sent.length === 2) {
                    test.check('a `via` no relay matches is refused, never silently rerouted');
                  } else {
                    test.fail('got ' + viaNowhere.status + ', posts=' + sent.length);
                  }

                  // ---------------------------------------------------
                  test.subHeading('When the peer is not there');
                  // ---------------------------------------------------

                  const absent = fakeRes();
                  return hub.handlePost({}, absent, bodyOf({ to: 'NOBODY', text: 'hello' }), deps)
                    .then(function () {
                      // Decision 0006 at the node's own door: deliver or
                      // refuse, and refuse AT ONCE. No queue, no hold, no
                      // 202 that means nothing.
                      if (absent.status === 503 && /not reachable right now/.test(absent.body)) {
                        test.check('a peer no relay names is refused at once, and told so plainly');
                      } else {
                        test.fail('got ' + absent.status + ' ' + absent.body);
                      }
                      if (sent.length === 2) {
                        test.check('and nothing left this node for them');
                      } else {
                        test.fail('posts=' + sent.length);
                      }

                      // ---------------------------------------------------
                      test.subHeading('When the far end refuses');
                      // ---------------------------------------------------

                      const refusing = {
                        router: {
                          post: function () {
                            return Promise.resolve({ ok: false, status: 403, error: 'no' });
                          },
                        },
                        presence: presenceNaming({ [PEER]: [RELAY_A] }),
                      };
                      const refused = fakeRes();
                      return hub.handlePost({}, refused, bodyOf({ to: PEER, text: 'hi' }), refusing)
                        .then(function () {
                          // The far end's own status, carried through
                          // rather than flattened to 502. A node that
                          // reported every refusal the same way would
                          // make "blocked" and "relay down" look alike.
                          if (refused.status === 403) {
                            test.check("a refusal keeps the far end's own status rather than becoming 502");
                          } else {
                            test.fail('got ' + refused.status + ' ' + refused.body);
                          }

                          // ---------------------------------------------------
                          test.subHeading('Bad input');
                          // ---------------------------------------------------

                          const bad = fakeRes();
                          return hub.handlePost({}, bad, bodyOf(undefined), deps)
                            .then(function () {
                              if (bad.status === 400) {
                                test.check('an unparseable body is 400, not a crash');
                              } else {
                                test.fail('got ' + bad.status + ' ' + bad.body);
                              }
                              return theChooserAttachesHints().then(function () {
                                noAppNamesTheRing();
                                test.reportSuccessFailureCount();
                              });
                            });
                        });
                    });
                });
            });
        });
    });
}

// ---------------------------------------------------------------------
// THE OTHER HALF OF THE CHOOSER — WHICH HINTS, IN WHICH ORDER.
// ---------------------------------------------------------------------
//
// Written 2026-09-26 as the BEFORE/AFTER CONTROL for extracting the relay
// chooser out of handlePost, which Andy approved: "yes, we want that
// ortho- thinggie". spiritos-f6 asked the right question before starting
// — whether any assertion pins WHICH relay and WHICH hints for a given
// roll — and the honest answer was no.
//
// THE GAP THIS CLOSES. Everything above stubs presence as `relaysNaming`
// alone, with no `detail()` and no shadow routes. So the hints branch
// (hub.js:1223, `if (!where.length && !wanted)`) was only ever entered
// EMPTY — which is why "a peer no relay names is refused at once" passes:
// with no connected relay it falls through to the 503 below it. The whole
// second half of the chooser was unexercised, and nothing else in the
// tree reaches it: hubPost.js is the ONLY suite that calls handlePost,
// routeHints.js and partnerAvailability.js never touch hub at all,
// routeStash.js uses only hub.shadow and hintWire.js only hub.relayRequest.
//
// So an extraction preserving relaysNaming ordering and `via` — which the
// checks above do pin — could change hint content, hint ORDER, or the
// empty case, and the entire harness would stay green.
//
// WHAT IT PINS, each one a thing a refactor could silently change:
//   the relay is `connected[0]`, not one that merely names the peer
//   the hints are the shadow's routes, best-ranked-first
//   they arrive as router.post's FOURTH argument (sendPacket, hub.js:2085)
//   and with no routes that argument is UNDEFINED, not an empty array
//
// A NOTE FOR WHOEVER COPIES THIS FIXTURE: the router above captures only
// three arguments, so a copy of it cannot see hints at all and every
// assertion here would pass vacuously. This one takes four on purpose.
function theChooserAttachesHints() {
  test.subHeading('Choosing a relay when none of them names the peer');

  // Its own root, so the shadow is this suite's and not the checkout's —
  // `createHub(process.cwd())` above reads the real one.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-hints-'));
  const onRoot = hubMod.createHub(root);
  const AT_BETTER = 'RELAYKEY-PROVED';
  const AT_WORSE = 'RELAYKEY-ARRIVED';

  // Noted WORSE FIRST, so an implementation that simply kept insertion
  // order would fail the ordering check rather than pass it by luck.
  const shadow = hubMod.shadow(root);
  shadow.note(PEER, { at: AT_WORSE, via: 'MINE', rank: seenPeers.ARRIVED });
  shadow.note(PEER, { at: AT_BETTER, via: 'MINE', rank: seenPeers.PROVED });

  const sent = [];
  function depsWith(connected) {
    return {
      router: {
        // FOUR arguments. Three is how this check becomes vacuous.
        post: function (url, to, text, hints) {
          sent.push({ url: url, to: to, hints: hints });
          return Promise.resolve({ ok: true, status: 200, hash: 'h9', text: 'ack' });
        },
      },
      presence: {
        relaysNaming: function () { return []; },
        detail: function () { return connected; },
      },
    };
  }

  // TWO CONNECTED RELAYS, because with one the check below cannot tell
  // `connected[0]` from `connected[connected.length - 1]` — and a mutation
  // test proved it could not: reversing that index left this suite green
  // until a second relay was added here.
  const res = fakeRes();
  return onRoot.handlePost({}, res, bodyOf({ to: PEER, text: 'hello' }),
    depsWith({ [RELAY_A]: {}, [RELAY_B]: {} }))
    .then(function () {
      if (sent.length === 1 && sent[0].url === RELAY_A) {
        test.check('no relay names the peer, so the packet goes through the FIRST of the two '
          + 'connected relays — which of them partners with the hinted one is the relays\' '
          + 'knowledge, not this node\'s');
      } else {
        test.fail('posted ' + JSON.stringify(sent));
      }

      const hints = sent.length ? sent[0].hints : null;
      if (Array.isArray(hints) && hints.length === 2
          && hints[0] === AT_BETTER && hints[1] === AT_WORSE) {
        test.check('and the route hints ride along BEST-RANKED FIRST, proved before arrived — '
          + 'noted in the opposite order here, so insertion order would fail this');
      } else {
        test.fail('hints were ' + JSON.stringify(hints) + ', wanted ['
          + AT_BETTER + ', ' + AT_WORSE + ']');
      }

      // ── AND THE EMPTY CASE IS UNDEFINED, NOT [] ──────────────────────
      //
      // `hints.length ? hints : undefined` (hub.js:1247). An empty array
      // would put an empty `hints` field on the wire, which is a claim
      // that this node knows of no route — different from saying nothing.
      const bare = hubMod.createHub(fs.mkdtempSync(path.join(os.tmpdir(), 'hub-nohints-')));
      const seen = [];
      const res2 = fakeRes();
      return bare.handlePost({}, res2, bodyOf({ to: 'NOROUTESKEY', text: 'x' }), {
        router: {
          post: function (url, to, text, hints) {
            seen.push({ had: arguments.length, hints: hints });
            return Promise.resolve({ ok: true, status: 200, hash: 'h', text: '' });
          },
        },
        presence: {
          relaysNaming: function () { return []; },
          detail: function () { return { [RELAY_A]: {} }; },
        },
      }).then(function () {
        if (seen.length === 1 && seen[0].hints === undefined) {
          test.check('with no route known, the hints argument is UNDEFINED rather than an '
            + 'empty list — saying nothing, not claiming to know of no route');
        } else {
          test.fail('expected undefined hints, got ' + JSON.stringify(seen));
        }
      });
    });
}

// ---------------------------------------------------------------------
// ONE DOOR, AND THE OTHER ONE HAS NO CALLERS LEFT.
// ---------------------------------------------------------------------
//
// The point of the contract: one way for an app to post to a peer. Every
// well-behaved app goes through api.sendMessagePacket and names no path
// at all, so this checks the two that reached for the wire directly —
// Relay Chat and Natter — plus the shell's own door.
//
// Only the WRITE half. /api/hub/inbox is the ring's read half and it is
// still wired, because retiring it is R8: chat's poll also drives contact
// acquisition and peerStats, which the router path does not do yet.
function noAppNamesTheRing() {
  test.subHeading('No app reaches for the ring to write');

  const RUN = path.join(__dirname, '..', 'run');
  const looked = [];
  const named = [];

  function scan(dir, depth) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
      if (e.name === 'node_modules') return;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (depth > 0) scan(full, depth - 1); return; }
      if (!/\.(js|html)$/.test(e.name)) return;
      const rel = path.relative(RUN, full).split(path.sep).join('/');
      // hub.js implements it and server.js routes it; both are the
      // system layer and are R8's business, not an app's.
      if (rel === 'js/hub.js' || rel === 'js/server.js') return;
      looked.push(rel);
      if (fs.readFileSync(full, 'utf8').indexOf('/api/hub/send') !== -1) named.push(rel);
    });
  }
  scan(path.join(RUN, 'app'), 4);
  scan(path.join(RUN, 'js'), 3);

  if (!named.length && looked.length > 20) {
    test.check('nothing above the boundary names /api/hub/send — ' + looked.length + ' files scanned');
  } else if (!looked.length) {
    test.fail('the scan found no files at all, so it proves nothing');
  } else {
    named.forEach(function (f) { test.fail(f + ' still posts to /api/hub/send'); });
  }
}

run().catch(function (err) {
  test.fail('hubPost suite threw: ' + (err && err.stack || err));
  test.reportSuccessFailureCount();
});
