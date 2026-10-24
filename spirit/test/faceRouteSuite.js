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
// Built by claude-windows at 67af809 (spirit/run/spirit/faceRoute.js), against
// the names declared at 2223a36. Real keys from relayAuth; a fake clock, so
// "an hour" and "a minute" are tested without waiting for them.

const test = require('./testSupport.js');
const auth = require('../run/spirit/relayAuth');
// Beside the face since goal/G13.2: the cache is appFaceApp's own, not the node's.
const fr = require('../run/spirit/faceRoute');

// THE OWNER'S SIGNER IS THE TEST'S OWN SINCE goal/G19.10. Andy, 2026-10-12:
// "there shall be no test helpers inside node." answerRoute had no caller in
// the node, only here, so it lives here: it makes the signed routes the
// cache is driven with. Its message is the one faceRoute's routeMessage
// verifies, so a route signed here and kept by the cache proves the two agree.
// routeIsSigned (the holding node's check) went with it and is not kept: a
// check of a test's own copy asserts nothing about the node. The cache's
// refusals below are the node's.
const ROUTE_MS = fr.ROUTE_MS;
function routeMessage(ownerKey, name, to, until, faceKey) {
  var NL = String.fromCharCode(10);
  return 'face-route' + NL + String(ownerKey || '') + NL + String(name || '') + NL +
    String(to || '') + NL + String(Number(until) || 0) + NL + String(faceKey || '');
}
function answerRoute(rows, name, owner, sign, nowMs, faceKey) {
  var n = String(name || '');
  var row = rows && Object.prototype.hasOwnProperty.call(rows, n) ? rows[n] : null;
  if (!row || !row.to) return { route: 'none', name: n };
  if (owner && row.to === owner.publicKey) return { route: 'mine', name: n };
  var until = (nowMs == null ? Date.now() : nowMs) + ROUTE_MS;
  var face = String(faceKey || '');
  return {
    route: 'to', name: n, to: row.to, until: until, face: face,
    sig: sign(owner.privateKey, routeMessage(owner.publicKey, n, row.to, until, face)),
  };
}

test.startTest('A face name routes to the node that holds it, on the owner\'s signed word only');

const owner = auth.generateIdentity('owner');
const joe = auth.generateIdentity('joe');
const stranger = auth.generateIdentity('stranger');
const face = auth.generateIdentity('face');   // the puppet that asks
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

// ── A ROUTE THAT IS NOT THE OWNER'S WORD IS NOT A ROUTE ──────────────
//
// Since goal/G19.10 asked of the node's own code, the cache (routeIsSigned,
// which this once asked, left the node with answerRoute).
const rows = { join: { to: owner.publicKey }, joe: { to: joe.publicKey } };
const T0 = 1000000;
function cacheAt(clock) {
  return fr.createRouteCache({ ownerKey: owner.publicKey, verify: auth.verify, now: function () { return clock.t; } });
}
{
  const good = answerRoute(rows, 'joe', owner, auth.sign, T0, face.publicKey);
  const redirected = Object.assign({}, good, { to: stranger.publicKey });
  const longer = Object.assign({}, good, { until: good.until + 1 });
  const reFaced = Object.assign({}, good, { face: stranger.publicKey });
  const byStranger = answerRoute(rows, 'joe', stranger, auth.sign, T0, face.publicKey);
  const kept = [
    ['to changed', redirected], ['until changed', longer], ['face changed', reFaced], ['signed by another key', byStranger],
  ].filter(function (c) { return cacheAt({ t: T0 }).take(c[1], owner.publicKey, 'Q', 'Q'); });
  const holds = cacheAt({ t: T0 }).take(good, owner.publicKey, 'Q', 'Q');
  if (holds && !kept.length) {
    test.check('the cache keeps a route only as the owner signed it: changing where it points, how long it lasts or '
      + 'whose face it is, or signing it with another key, breaks it');
  } else {
    test.fail('cache: good taken ' + holds + '; taken anyway: ' + kept.map(function (c) { return c[0]; }).join(', '));
  }
}

// ── THE PUPPET'S CACHE TAKES ONLY THE OWNER'S ANSWER TO ITS QUESTION ──
{
  const clock = { t: T0 };
  const c = cacheAt(clock);
  const answer = answerRoute(rows, 'joe', owner, auth.sign, T0, face.publicKey);
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
  c.take(answerRoute(rows, 'joe', owner, auth.sign, T0, face.publicKey), owner.publicKey, 'Q', 'Q');
  clock.t = T0 + fr.ROUTE_MS - 1;
  const justBefore = c.lookup('joe');
  clock.t = T0 + fr.ROUTE_MS;
  const at = c.lookup('joe');
  // A route the owner signed for ten hours is still kept only one.
  const clock2 = { t: T0 };
  const c2 = cacheAt(clock2);
  c2.take(answerRoute(rows, 'joe', owner, auth.sign, T0 + 9 * fr.ROUTE_MS, face.publicKey), owner.publicKey, 'Q', 'Q');
  clock2.t = T0 + fr.ROUTE_MS;
  const capped = c2.lookup('joe');
  // The target refused: ask again.
  const clock3 = { t: T0 };
  const c3 = cacheAt(clock3);
  c3.take(answerRoute(rows, 'joe', owner, auth.sign, T0, face.publicKey), owner.publicKey, 'Q', 'Q');
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
  c.take(answerRoute(rows, 'nobody', owner, auth.sign, T0, face.publicKey), owner.publicKey, 'Q', 'Q');
  c.take(answerRoute(rows, 'join', owner, auth.sign, T0, face.publicKey), owner.publicKey, 'R', 'R');
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

// THE NODE THAT HOLDS THE NAME, AND NO WEAK CHECK BY A FORGOTTEN ARGUMENT:
// asserted of routeIsSigned until goal/G19.10 (wsl-claude's findings at
// fab98e4 and 7bc92b7). It left the node, a test helper with no caller, and
// its checks with it; they come back with the code, the day a member's node
// takes a forwarded route.

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
