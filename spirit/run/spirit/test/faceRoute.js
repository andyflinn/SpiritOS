'use strict';

// spirit/run/spirit/test/faceRoute.js
// The tests of spirit/faceRoute.js, and of no other module (spec: ./faceRoute.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, box v72).
//
// Where a face name lives (public-app-server/G17, the route): nameOf (which name a visitor asked for), faceLabel (one
// face name by the host parser's rule, goal/G30.1) and createRouteCache (the puppet's memory of the owner's answers, in
// RAM). Pure: a planted clock, and routes signed in process with real Ed25519 keys.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const F = require(path.join(RUN, 'spirit', 'faceRoute.js'));
const auth = require(path.join(RUN, 'spirit', 'relayAuth.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const OWNER = auth.generateIdentity('owner');
const OTHER = auth.generateIdentity('other');
const NL = String.fromCharCode(10);
// A route signed as the spec says: 'face-route', owner key, name, to, until, the face's own key, one per line.
function signed(by, ownerKey, name, to, until, face) {
  return { route: 'to', name: name, to: to, until: until, face: face, sig: auth.sign(by.privateKey, ['face-route', ownerKey, name, to, String(until), face].join(NL)) };
}
// A cache on a planted clock, the owner's key and the real verify.
function cache(clock) { return F.createRouteCache({ ownerKey: OWNER.publicKey, verify: auth.verify, now: function () { return clock.t; } }); }

// ── nameOf ──
test.run('nameOf: the one label under the face domain is the name asked for', 0.2, function () {
  return F.nameOf('join.face.spirit.x', 'face.spirit.x') === 'join' || 'nameOf: ' + short(F.nameOf('join.face.spirit.x', 'face.spirit.x'));
}, test.limit.quick);
test.run('nameOf: case, a port and a trailing dot do not change the name', 0.2, function () {
  const got = [F.nameOf('Join.Face.Spirit.X:443', 'face.spirit.x'), F.nameOf('join.face.spirit.x.', 'FACE.spirit.x.')];
  return got.every(function (x) { return x === 'join'; }) || 'nameOf: ' + short(got);
}, test.limit.quick);
test.run('nameOf: one label only, so two labels are no name (a wildcard certificate covers one)', 0.2, function () {
  return F.nameOf('a.b.face.spirit.x', 'face.spirit.x') === null || 'nameOf: ' + short(F.nameOf('a.b.face.spirit.x', 'face.spirit.x'));
}, test.limit.quick);
test.run('nameOf: the bare face domain, another domain, a lookalike suffix, and no host or domain are no name', 0.2, function () {
  const got = [F.nameOf('face.spirit.x', 'face.spirit.x'), F.nameOf('join.other.x', 'face.spirit.x'), F.nameOf('joinface.spirit.x', 'face.spirit.x'), F.nameOf('', 'face.spirit.x'), F.nameOf('join.face.spirit.x', '')];
  return got.every(function (x) { return x === null; }) || 'nameOf: ' + short(got);
}, test.limit.quick);
test.run('nameOf: a label the host parser would refuse is no name', 0.2, function () {
  return F.nameOf('bad_name.face.spirit.x', 'face.spirit.x') === null || 'nameOf: ' + short(F.nameOf('bad_name.face.spirit.x', 'face.spirit.x'));
}, test.limit.quick);

// ── faceLabel (goal/G30.1) ──
test.run('faceLabel: andy and Andy are one name, lowercased and trimmed', 0.2, function () {
  return (F.faceLabel('Andy') === 'andy' && F.faceLabel(' andy ') === 'andy') || 'faceLabel: ' + short([F.faceLabel('Andy'), F.faceLabel(' andy ')]);
}, test.limit.quick);
test.run('faceLabel: a single DNS label of a-z, 0-9 and hyphen, at most 63', 0.2, function () {
  const ok = [F.faceLabel('a'), F.faceLabel('my-face-2'), F.faceLabel('a'.repeat(63))];
  return (ok[0] === 'a' && ok[1] === 'my-face-2' && ok[2] === 'a'.repeat(63)) || 'faceLabel: ' + short(ok);
}, test.limit.quick);
test.run('faceLabel: 64 characters, a hyphen at either end, a dot, an underscore, a space, or nothing is null', 0.2, function () {
  const no = ['a'.repeat(64), '-andy', 'andy-', 'an.dy', 'an_dy', 'an dy', '', null, undefined].map(F.faceLabel);
  return no.every(function (x) { return x === null; }) || 'faceLabel: ' + short(no);
}, test.limit.quick);

// ── how long a route is kept ──
test.run('a route is kept an hour, a "no such route" a minute', 0.2, function () {
  return (F.ROUTE_MS === 3600000 && F.NONE_MS === 60000) || 'ROUTE_MS ' + F.ROUTE_MS + ', NONE_MS ' + F.NONE_MS;
}, test.limit.quick);

// ── only the owner's answer to this question counts ──
test.run('an answer from any key but the owner\'s is not taken', 0.2, function () {
  const c = cache({ t: 0 });
  const r = c.take({ route: 'owner', name: 'join', to: 'k' }, OTHER.publicKey, 'h1', 'h1');
  return (r === false && c.lookup('join') === null) || 'taken: ' + short([r, c.lookup('join')]);
}, test.limit.quick);
test.run('an answer to another question (re not the hash asked), or with no question, is not taken', 0.2, function () {
  const c = cache({ t: 0 });
  const r = [c.take({ route: 'owner', name: 'join', to: 'k' }, OWNER.publicKey, 'h2', 'h1'), c.take({ route: 'owner', name: 'join', to: 'k' }, OWNER.publicKey, '', '')];
  return (r[0] === false && r[1] === false && c.lookup('join') === null) || 'taken: ' + short(r);
}, test.limit.quick);
test.run('a cache with no owner key takes nothing', 0.2, function () {
  const c = F.createRouteCache({ verify: auth.verify });
  return c.take({ route: 'owner', name: 'join', to: 'k' }, undefined, 'h', 'h') === false || 'taken';
}, test.limit.quick);

// ── the answers ──
test.run('"none" is kept a minute, then asked again', 0.2, function () {
  const clock = { t: 1000 };
  const c = cache(clock);
  const r = c.take({ route: 'none', name: 'ghost' }, OWNER.publicKey, 'h', 'h');
  const at = c.lookup('ghost');
  clock.t += 60 * 1000;
  return (r === true && short(at) === short({ none: true }) && c.lookup('ghost') === null) || 'none: ' + short([r, at, c.lookup('ghost')]);
}, test.limit.quick);
test.run('"mine" is kept an hour', 0.2, function () {
  const clock = { t: 1000 };
  const c = cache(clock);
  c.take({ route: 'mine', name: 'me' }, OWNER.publicKey, 'h', 'h');
  clock.t += 60 * 60 * 1000 - 1;
  const still = c.lookup('me');
  clock.t += 1;
  return (short(still) === short({ mine: true }) && c.lookup('me') === null) || 'mine: ' + short([still, c.lookup('me')]);
}, test.limit.quick);
test.run('"owner": the key of the name\'s owner, taken on the owner\'s word, kept an hour', 0.2, function () {
  const clock = { t: 0 };
  const c = cache(clock);
  const ans = { route: 'owner', name: 'join', to: 'slot-owner-key' };
  const r = c.take(ans, OWNER.publicKey, 'h', 'h');
  const l = c.lookup('join');
  clock.t = F.ROUTE_MS;
  return (r === true && !!l && l.to === 'slot-owner-key' && l.route === ans && c.lookup('join') === null) || 'owner: ' + short([r, l]);
}, test.limit.quick);
test.run('"owner" with no key to go to is not taken', 0.2, function () {
  const c = cache({ t: 0 });
  return c.take({ route: 'owner', name: 'join' }, OWNER.publicKey, 'h', 'h') === false || 'taken';
}, test.limit.quick);
test.run('a signed route ("to") the owner signed is taken, and looked up with the route itself', 0.2, function () {
  const c = cache({ t: 0 });
  const ans = signed(OWNER, OWNER.publicKey, 'join', 'slot-key', 30 * 60 * 1000, 'face-key');
  const r = c.take(ans, OWNER.publicKey, 'h', 'h');
  const l = c.lookup('join');
  return (r === true && !!l && l.to === 'slot-key' && l.route === ans) || 'signed: ' + short([r, l]);
}, test.limit.quick);
test.run('a signed route is never kept longer than an hour from now, whatever it claims', 0.2, function () {
  const clock = { t: 0 };
  const c = cache(clock);
  c.take(signed(OWNER, OWNER.publicKey, 'join', 'slot-key', 10 * F.ROUTE_MS, 'face-key'), OWNER.publicKey, 'h', 'h');
  clock.t = F.ROUTE_MS;
  return c.lookup('join') === null || 'still held after an hour: ' + short(c.lookup('join'));
}, test.limit.quick);
test.run('a signed route already expired is not taken', 0.2, function () {
  const c = cache({ t: 5000 });
  return c.take(signed(OWNER, OWNER.publicKey, 'join', 'slot-key', 5000, 'face-key'), OWNER.publicKey, 'h', 'h') === false || 'taken';
}, test.limit.quick);
test.run('a route signed by another key, or changed after signing (its target, its name), is not taken', 0.2, function () {
  const c = cache({ t: 0 });
  const forged = signed(OTHER, OWNER.publicKey, 'join', 'slot-key', 60000, 'face-key');
  const moved = Object.assign(signed(OWNER, OWNER.publicKey, 'join', 'slot-key', 60000, 'face-key'), { to: 'thief-key' });
  const renamed = Object.assign(signed(OWNER, OWNER.publicKey, 'join', 'slot-key', 60000, 'face-key'), { name: 'other' });
  const r = [c.take(forged, OWNER.publicKey, 'h', 'h'), c.take(moved, OWNER.publicKey, 'h', 'h'), c.take(renamed, OWNER.publicKey, 'h', 'h')];
  return r.every(function (x) { return x === false; }) || 'taken: ' + short(r);
}, test.limit.quick);
test.run('the face\'s own key is signed in: a route handed to another face does not hold', 0.2, function () {
  const c = cache({ t: 0 });
  const copy = Object.assign(signed(OWNER, OWNER.publicKey, 'join', 'slot-key', 60000, 'face-key'), { face: 'another-face' });
  return c.take(copy, OWNER.publicKey, 'h', 'h') === false || 'a copy drove the route';
}, test.limit.quick);
test.run('a signature made over the same fields without the face-route prefix is not taken', 0.2, function () {
  const c = cache({ t: 0 });
  const ans = { route: 'to', name: 'join', to: 'slot-key', until: 60000, face: 'face-key', sig: auth.sign(OWNER.privateKey, [OWNER.publicKey, 'join', 'slot-key', '60000', 'face-key'].join(NL)) };
  return c.take(ans, OWNER.publicKey, 'h', 'h') === false || 'taken';
}, test.limit.quick);
test.run('an answer of no known kind, or with no name, is not taken', 0.2, function () {
  const c = cache({ t: 0 });
  const r = [c.take({ route: 'redirect', name: 'join', to: 'k' }, OWNER.publicKey, 'h', 'h'), c.take({ route: 'none' }, OWNER.publicKey, 'h', 'h'), c.take(null, OWNER.publicKey, 'h', 'h')];
  return r.every(function (x) { return x === false; }) || 'taken: ' + short(r);
}, test.limit.quick);

// ── storeAs, drop, a restart ──
test.run('storeAs keeps the route under the host asked about (the VPS never knows names)', 0.2, function () {
  const c = cache({ t: 0 });
  c.take({ route: 'owner', name: 'join', to: 'k' }, OWNER.publicKey, 'h', 'h', 'join.face.spirit.x');
  return (!!c.lookup('join.face.spirit.x') && c.lookup('join') === null) || 'lookup: ' + short([c.lookup('join.face.spirit.x'), c.lookup('join')]);
}, test.limit.quick);
test.run('drop forgets a route, so the next visitor asks again', 0.2, function () {
  const c = cache({ t: 0 });
  c.take({ route: 'owner', name: 'join', to: 'k' }, OWNER.publicKey, 'h', 'h');
  c.drop('join');
  return c.lookup('join') === null || 'still held: ' + short(c.lookup('join'));
}, test.limit.quick);
test.run('at restart the dance starts anew: a new cache holds nothing', 0.2, function () {
  const a = cache({ t: 0 });
  a.take({ route: 'owner', name: 'join', to: 'k' }, OWNER.publicKey, 'h', 'h');
  return cache({ t: 0 }).lookup('join') === null || 'a new cache remembers';
}, test.limit.quick);
