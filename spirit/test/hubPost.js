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

const test = require('./testSupport.js');
const hub = require('../run/js/hub').createHub(process.cwd());

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
                              test.reportSuccessFailureCount();
                            });
                        });
                    });
                });
            });
        });
    });
}

run().catch(function (err) {
  test.fail('hubPost suite threw: ' + (err && err.stack || err));
  test.reportSuccessFailureCount();
});
