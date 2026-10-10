'use strict';

// spirit/test/faceRouteSuite.js
// WHERE A FACE NAME LIVES: THE NAME IN A HOST, THE OWNER'S SIGNED ANSWER,
// AND THE PUPPET'S ROUTES IN RAM (public-app-server/G17, THE ROUTE).
//
//   Andy, 2026-09-27: "so the owner.node.ID is the boot-route, for every
//   other name segment", "it's like an HTTP redirect then the node gives the
//   puppet a signed reply, allowing the appFaceApp to cache that route in RAM
//   for future use", and "at restart, the dance starts anew....".
//
// Built by claude-windows at 67af809 (spirit/run/js/faceRoute.js), against
// the names declared at 2223a36. Real keys from relayAuth; a fake clock, so
// "an hour" and "a minute" are tested without waiting for them.

const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
// Beside the face since goal/G13.2: the cache is appFaceApp's own, not the node's.
const fr = require('../run/process/js/appFaceApp/faceRoute');

test.startTest('A face name routes to the node that holds it, on the owner\'s signed word only');

const owner = auth.generateIdentity('owner');
const joe = auth.generateIdentity('joe');
const stranger = auth.generateIdentity('stranger');
const face = auth.generateIdentity('face');   // the puppet that asks
const bob = auth.generateIdentity('bob');
const FACE = 'face.spirit.example';

// ── THE NAME IN A HOST ────────────────────────────────────────────────
{
  const cases = [
    ['join.face.spirit.example', 'join'], ['JOIN.Face.Spirit.Example', 'join'], ['join.face.spirit.example:443', 'join'],
    ['join.face.spirit.example.', 'join'], ['face.spirit.example', null], ['a.b.face.spirit.example', null],
    ['join.face.spirit.other', null], ['evilface.spirit.example', null], ['-x.face.spirit.example', null], ['', null],
  ];
  const wrong = cases.filter(function (c) { return fr.nameOf(c[0], FACE) !== c[1]; });
  if (!wrong.length) {
    test.check('the name is the one label before the face domain, case and port and trailing dot ignored; the bare '
      + 'face domain, two labels, another domain, a look-alike suffix and a malformed label are no name');
  } else {
    test.fail('nameOf got wrong: ' + wrong.map(function (c) { return JSON.stringify(c[0]) + ' -> ' + JSON.stringify(fr.nameOf(c[0], FACE)); }).join(', '));
  }
}

// ── THE OWNER'S ANSWER: MINE, A SIGNED ROUTE, OR NONE ─────────────────
const rows = { join: { to: owner.publicKey }, joe: { to: joe.publicKey } };
const T0 = 1000000;
{
  const mine = fr.answerRoute(rows, 'join', owner, auth.sign, T0, face.publicKey);
  const to = fr.answerRoute(rows, 'joe', owner, auth.sign, T0, face.publicKey);
  const none = fr.answerRoute(rows, 'nobody', owner, auth.sign, T0, face.publicKey);
  const inherited = fr.answerRoute(rows, 'toString', owner, auth.sign, T0, face.publicKey);
  if (mine.route === 'mine' && to.route === 'to' && to.to === joe.publicKey && to.until === T0 + fr.ROUTE_MS
      && fr.routeIsSigned(to, owner.publicKey, auth.verify, { selfKey: joe.publicKey, fromKey: face.publicKey, now: T0 }) && none.route === 'none' && inherited.route === 'none') {
    test.check('the owner answers "mine" for its own name, a route signed by its key for joe\'s, valid an hour, and '
      + '"none" for a name it never granted, including one that only an object\'s prototype has (toString)');
  } else {
    test.fail('answers: mine ' + JSON.stringify(mine) + ', to ' + JSON.stringify(to && { route: to.route, until: to.until })
      + ', none ' + JSON.stringify(none) + ', toString ' + JSON.stringify(inherited));
  }
}

// ── A ROUTE THAT IS NOT THE OWNER'S WORD IS NOT A ROUTE ──────────────
{
  const good = fr.answerRoute(rows, 'joe', owner, auth.sign, T0, face.publicKey);
  const redirected = Object.assign({}, good, { to: stranger.publicKey });
  const longer = Object.assign({}, good, { until: good.until + 1 });
  const byStranger = fr.answerRoute(rows, 'joe', stranger, auth.sign, T0, face.publicKey);
  const at = { selfKey: joe.publicKey, fromKey: face.publicKey, now: T0 };
  const holds = fr.routeIsSigned(good, owner.publicKey, auth.verify, at);
  const refused = [
    ['to changed', redirected], ['until changed', longer], ['signed by another key', byStranger],
  ].filter(function (c) { return fr.routeIsSigned(c[1], owner.publicKey, auth.verify, at); });
  if (holds && !refused.length) {
    test.check('a route verifies only as the owner signed it: changing where it points or how long it lasts, or '
      + 'signing it with another key, breaks it');
  } else {
    test.fail('routeIsSigned: good ' + holds + '; accepted anyway: ' + refused.map(function (c) { return c[0]; }).join(', '));
  }
}

// ── THE PUPPET'S CACHE TAKES ONLY THE OWNER'S ANSWER TO ITS QUESTION ──
function cacheAt(clock) {
  return fr.createRouteCache({ ownerKey: owner.publicKey, verify: auth.verify, now: function () { return clock.t; } });
}
{
  const clock = { t: T0 };
  const c = cacheAt(clock);
  const answer = fr.answerRoute(rows, 'joe', owner, auth.sign, T0, face.publicKey);
  const forged = Object.assign({}, answer, { to: stranger.publicKey });
  const fromStranger = c.take(answer, stranger.publicKey, 'Q1', 'Q1');
  const wrongHash = c.take(answer, owner.publicKey, 'Q2', 'Q1');
  const noHash = c.take(answer, owner.publicKey, undefined, undefined);
  const forgedTaken = c.take(forged, owner.publicKey, 'Q1', 'Q1');
  const before = c.lookup('joe');
  const taken = c.take(answer, owner.publicKey, 'Q1', 'Q1');
  const after = c.lookup('joe');
  if (!fromStranger && !wrongHash && !noHash && !forgedTaken && before === null && taken && after && after.to === joe.publicKey) {
    test.check('the cache refuses a route from another node, one answering a different question or none, and one '
      + 'whose target was changed after signing; the owner\'s signed answer to its own question is kept');
  } else {
    test.fail('take: stranger ' + fromStranger + ', wrong hash ' + wrongHash + ', no hash ' + noHash + ', forged '
      + forgedTaken + ', before ' + JSON.stringify(before) + ', good ' + taken + ', after ' + JSON.stringify(after));
  }
}

// ── AN HOUR, NEVER LONGER; DROPPED WHEN THE TARGET REFUSES ────────────
{
  const clock = { t: T0 };
  const c = cacheAt(clock);
  c.take(fr.answerRoute(rows, 'joe', owner, auth.sign, T0, face.publicKey), owner.publicKey, 'Q', 'Q');
  clock.t = T0 + fr.ROUTE_MS - 1;
  const justBefore = c.lookup('joe');
  clock.t = T0 + fr.ROUTE_MS;
  const at = c.lookup('joe');
  // A route the owner signed for ten hours is still kept only one.
  const clock2 = { t: T0 };
  const c2 = cacheAt(clock2);
  c2.take(fr.answerRoute(rows, 'joe', owner, auth.sign, T0 + 9 * fr.ROUTE_MS, face.publicKey), owner.publicKey, 'Q', 'Q');
  clock2.t = T0 + fr.ROUTE_MS;
  const capped = c2.lookup('joe');
  // The target refused: ask again.
  const clock3 = { t: T0 };
  const c3 = cacheAt(clock3);
  c3.take(fr.answerRoute(rows, 'joe', owner, auth.sign, T0, face.publicKey), owner.publicKey, 'Q', 'Q');
  c3.drop('joe');
  const dropped = c3.lookup('joe');
  if (justBefore && justBefore.to && at === null && capped === null && dropped === null) {
    test.check('a route lives until its hour is up and not a millisecond past it, is never kept longer than an hour '
      + 'whatever it claims, and is forgotten the moment its target refuses');
  } else {
    test.fail('lifetimes: 1 ms before ' + JSON.stringify(justBefore) + ', at the hour ' + JSON.stringify(at)
      + ', a 10 h claim after 1 h ' + JSON.stringify(capped) + ', after drop ' + JSON.stringify(dropped));
  }
}

// ── "NO SUCH ROUTE" FOR A MINUTE; "MINE" KEPT; A RESTART FORGETS ──────
{
  const clock = { t: T0 };
  const c = cacheAt(clock);
  c.take(fr.answerRoute(rows, 'nobody', owner, auth.sign, T0, face.publicKey), owner.publicKey, 'Q', 'Q');
  c.take(fr.answerRoute(rows, 'join', owner, auth.sign, T0, face.publicKey), owner.publicKey, 'R', 'R');
  const noneNow = c.lookup('nobody');
  const mineNow = c.lookup('join');
  clock.t = T0 + fr.NONE_MS;
  const noneAfter = c.lookup('nobody');
  const restarted = cacheAt({ t: T0 }).lookup('join');
  if (noneNow && noneNow.none && mineNow && mineNow.mine && noneAfter === null && restarted === null) {
    test.check('"no such route" is remembered for one minute and then asked again, "mine" is remembered, and a new '
      + 'cache (a restart) knows nothing: "at restart, the dance starts anew"');
  } else {
    test.fail('none now ' + JSON.stringify(noneNow) + ', mine ' + JSON.stringify(mineNow) + ', none after a minute '
      + JSON.stringify(noneAfter) + ', after restart ' + JSON.stringify(restarted));
  }
}

// ── THE NODE THAT HOLDS THE NAME: ONLY A LIVE ROUTE, FOR IT, FROM ITS FACE ─
//
// wsl-claude's finding at fab98e4, go from claude-windows: routeIsSigned
// checked the signature alone, so a route stayed good for ever (a name taken
// back kept routing to whoever replayed it), a route for joe verified at bob,
// and anyone holding a copy could drive joe's app process. Now the route
// carries the asking puppet's key ('face'), inside what the owner signs.
{
  const good = fr.answerRoute(rows, 'joe', owner, auth.sign, T0, face.publicKey);
  const ok = fr.routeIsSigned(good, owner.publicKey, auth.verify, { selfKey: joe.publicKey, fromKey: face.publicKey, now: T0 + 1 });
  const expired = fr.routeIsSigned(good, owner.publicKey, auth.verify, { selfKey: joe.publicKey, fromKey: face.publicKey, now: good.until });
  const atBob = fr.routeIsSigned(good, owner.publicKey, auth.verify, { selfKey: bob.publicKey, fromKey: face.publicKey, now: T0 + 1 });
  const copied = fr.routeIsSigned(good, owner.publicKey, auth.verify, { selfKey: joe.publicKey, fromKey: stranger.publicKey, now: T0 + 1 });
  const reFaced = fr.routeIsSigned(Object.assign({}, good, { face: stranger.publicKey }), owner.publicKey, auth.verify,
    { selfKey: joe.publicKey, fromKey: stranger.publicKey, now: T0 + 1 });
  if (ok && good.face === face.publicKey && !expired && !atBob && !copied && !reFaced) {
    test.check('the node holding the name takes a route only while it is live, only if it names that node, and only '
      + 'from the puppet it was issued to: expired, shown to another node, presented by someone else, or with the face '
      + 'swapped after signing, it fails');
  } else {
    test.fail('THE HOLDING NODE ACCEPTS WHAT IT SHOULD NOT: good ' + ok + ' (face ' + (good.face ? 'carried' : 'MISSING') + '), '
      + 'expired ' + expired + ', at bob ' + atBob + ', from a copier ' + copied + ', face swapped ' + reFaced
      + '. A replayed, misdirected or copied route drives the app process');
  }
}

// ── NO WAY TO GET THE WEAK CHECK BY FORGETTING AN ARGUMENT ─────────────
//
// wsl-claude, at 7bc92b7: routeIsSigned without 'at' still answered the
// signature alone, so a holding-node caller that forgot 'at' would silently
// get the check that let replayed and copied routes through. Split at
// 3bef2806: routeSignatureHolds is the cache's signature-only question, and
// routeIsSigned refuses without selfKey and fromKey.
{
  const good = fr.answerRoute(rows, 'joe', owner, auth.sign, T0, face.publicKey);
  const bare = fr.routeIsSigned(good, owner.publicKey, auth.verify);
  const halfSelf = fr.routeIsSigned(good, owner.publicKey, auth.verify, { selfKey: joe.publicKey, now: T0 + 1 });
  const halfFrom = fr.routeIsSigned(good, owner.publicKey, auth.verify, { fromKey: face.publicKey, now: T0 + 1 });
  const cacheSays = typeof fr.routeSignatureHolds === 'function' && fr.routeSignatureHolds(good, owner.publicKey, auth.verify);
  if (bare === false && halfSelf === false && halfFrom === false && cacheSays === true) {
    test.check('the holding node\'s check refuses when it is not told who it is and who presented the route, and the '
      + 'signature-only question lives apart, as routeSignatureHolds, for the cache');
  } else {
    test.fail('without at ' + bare + ', only selfKey ' + halfSelf + ', only fromKey ' + halfFrom
      + ', routeSignatureHolds ' + cacheSays + '. Forgetting an argument must not buy the weak check');
  }
}

// ── THE OWNER'S PLAIN ANSWER: "THE OWNER OF THIS NAME IS <KEY>" ─────────
//
//   Andy: "the owner, of appFaceApp simple responds with the key of the
//   subdomain owner, or an error", and of the face comparing keys: "why on
//   earth would the appFaceApp actually need that knowledge for?". Since
//   7d75563 the face takes route 'owner' on the owner's word and the
//   question's hash, and forwards to that key, whoever it is. Filed under
//   the name it ASKED about (storeAs), so an answer naming another name
//   cannot plant a route for it.
{
  const clock = { t: T0 };
  const c = cacheAt(clock);
  const answer = { route: 'owner', name: 'join', to: joe.publicKey };
  const fromStranger = c.take(answer, stranger.publicKey, 'Q', 'Q', 'join');
  const wrongHash = c.take(answer, owner.publicKey, 'Q2', 'Q', 'join');
  const noKey = c.take({ route: 'owner', name: 'join' }, owner.publicKey, 'Q', 'Q', 'join');
  const planted = c.take({ route: 'owner', name: 'other', to: stranger.publicKey }, owner.publicKey, 'P', 'P', 'join');
  const plantedOther = c.lookup('other');
  const kept = c.lookup('join');
  clock.t = T0 + fr.ROUTE_MS;
  const later = c.lookup('join');
  if (!fromStranger && !wrongHash && !noKey && planted && plantedOther === null && kept && kept.to === stranger.publicKey
      && later === null) {
    test.check('the owner\'s plain "owner is <key>" answer is kept only from the owner\'s key with the question\'s hash '
      + 'and a key in it, filed under the name that was asked (an answer naming "other" plants nothing for "other"), '
      + 'and lasts an hour');
  } else {
    test.fail('owner route: stranger ' + fromStranger + ', wrong hash ' + wrongHash + ', no key ' + noKey + ', filed '
      + planted + ', planted for other ' + JSON.stringify(plantedOther) + ', kept ' + JSON.stringify(kept)
      + ', after an hour ' + JSON.stringify(later));
  }
}

test.reportSuccessFailureCount();
