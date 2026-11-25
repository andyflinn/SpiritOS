'use strict';

// spirit/run/spirit/invites/test/script.js
// The tests of spirit/invites/script.js, and of no other module (spec: ./script.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, box v72).
//
// The relay's invites, a waiting room and not a guestbook: add, match, consume (spent is gone), revokeInvite by label,
// sweepExpired, and the one normalizing of days and token. Run in process on a scratch root under the temp folder,
// whose relay.db relayStore opens.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
const S = require(path.join(RUN, 'spirit', 'script.js'));
const test = S.requireScript('spirit/test/testReport.js');
// ITS TEMP FOLDERS FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"): one of its own for each
// it asks, under its suite's path, the whole of it removed when the suite ends.
const tempFolder = require('../../tempFolder/script.js');
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/test/invites/' + name + tempAsked); }
// ITS STORES CLOSED BEFORE ITS FOLDER GOES (goal/G49.7, as spirit/relay/processor/test/script.js does it, goal/G48.4; Andy, of the 0.7s: "it leaves no temp folder behind"): on Windows a
// folder holding an open database cannot be removed, and nodeStore keeps each store it opened open; every one under the
// suite's folder (a node.db or a relay.db at <root>/spirit/state) is closed first.
function closeStoresUnder(top) {
  const NS = S.requireScript('spirit/nodeStore/script.js');
  (function walk(dir, depth) {
    let names = [];
    try { names = fs.readdirSync(dir); } catch (e) { return; }
    if (names.indexOf('node.db') !== -1 && path.basename(dir) === 'state') { try { NS.open(path.dirname(path.dirname(dir))).close(); } catch (e) { /* closed */ } }
    // A relay's own store too (relay.db beside it), which relayStore keeps open the same way.
    // Through every copy of relayStore this process loaded (a relay made on a scratch tree loads that tree's own), so it is
    // the store that relay holds open.
    if (names.indexOf('relay.db') !== -1 && path.basename(dir) === 'state') {
      Object.keys(require.cache).filter(function (k) { return /[\\/]relayStore\.js$/.test(k); }).forEach(function (k) {
        try { require.cache[k].exports.open(path.dirname(path.dirname(dir))).close(); } catch (e) { /* closed */ }
      });
    }
    if (depth > 6) return;
    names.forEach(function (n) { const p = path.join(dir, n); try { if (fs.statSync(p).isDirectory()) walk(p, depth + 1); } catch (e) { /* gone */ } });
  }(top, 0));
}
test.after(function () { const top = tempFolder.path('spirit/test/invites'); closeStoresUnder(top); try { fs.rmSync(top, { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
const I = S.requireScript('spirit/invites/script.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const FUTURE = '2099-01-01T00:00:00.000Z';
const PAST = '2001-01-01T00:00:00.000Z';
let ROOT = null;

test.run('an invite added on a scratch relay root is listed', 0.2, function () {
  ROOT = ownTemp('nr-invites-');
  try { I.add(ROOT, { label: 'world', token: 'world-token', expiresAt: FUTURE }); } catch (e) { ROOT = null; return false; }
  const all = I.load(ROOT);
  if (!all.some(function (r) { return r.token === 'world-token'; })) { ROOT = null; return false; }
  return true;
}, test.limit.quick);

// ── normalizeDays, normalizeToken: one rule for what is signed and what is stored ──
test.run('normalizeDays keeps whole days from 1 to 15 and makes nothing, zero or junk 7', 0.2, function () {
  const got = [undefined, 0, -3, 'x', 1, 3.9, 15, 99].map(I.normalizeDays);
  return short(got) === short([7, 7, 7, 7, 1, 3, 15, 15]) || false;
}, test.limit.quick);
test.run('normalizeToken trims a token and makes nothing empty', 0.2, function () {
  const got = ['  dog  ', null, undefined, 42].map(I.normalizeToken);
  return short(got) === short(['dog', '', '', '42']) || false;
}, test.limit.quick);
test.run('newToken is 16 random bytes in hex, a new one each time', 0.2, function () {
  const a = I.newToken(); const b = I.newToken();
  return (/^[0-9a-f]{32}$/.test(a) && a !== b) || false;
}, test.limit.quick);

// ── add ──
test.run('add refuses an invite with no label', 0.2, function () {
  if (!ROOT) return false;
  try { I.add(ROOT, { label: '   ' }); return false; } catch (e) { return /invite label required/.test(String(e && e.message)) || false; }
}, test.limit.quick);
test.run('add stores the row it answers: the token trimmed, the label trimmed, the inviter', 0.2, function () {
  if (!ROOT) return false;
  const row = I.add(ROOT, { label: ' saint ', token: '  spoken  ', expiresAt: FUTURE, invitedBy: 'andy' });
  const kept = I.load(ROOT).filter(function (r) { return r.token === 'spoken'; })[0];
  return (row.token === 'spoken' && row.label === 'saint' && row.invitedBy === 'andy' && !!kept && kept.label === 'saint') || false;
}, test.limit.quick);
test.run('add with no token mints one, and with no expiry the invite lives the normalized days', 0.2, function () {
  if (!ROOT) return false;
  const t0 = Date.now();
  const row = I.add(ROOT, { label: 'minted', days: 99 });
  const ms = Date.parse(row.expiresAt) - t0;
  return (/^[0-9a-f]{32}$/.test(row.token) && ms > 15 * 86400000 - 60000 && ms <= 15 * 86400000 + 60000) || false;
}, test.limit.quick);

// ── match ──
test.run('match of the token and its label answers ok and the invite', 0.2, function () {
  if (!ROOT) return false;
  I.add(ROOT, { label: 'john', token: 'match-token', expiresAt: FUTURE });
  const m = I.match(ROOT, ' match-token ', ' john ');
  return (m.ok === true && m.invite && m.invite.label === 'john') || false;
}, test.limit.quick);
test.run('match refuses with 403 a token not given, not found, under another label, or expired', 0.2, function () {
  if (!ROOT) return false;
  I.add(ROOT, { label: 'late', token: 'expired-token', expiresAt: PAST });
  const got = [I.match(ROOT, '', 'john'), I.match(ROOT, 'no-such', 'john'), I.match(ROOT, 'match-token', 'jane'), I.match(ROOT, 'expired-token', 'late')];
  const errs = got.map(function (m) { return m.ok === false && m.status === 403 ? m.error : null; });
  return short(errs) === short(['invite required', 'invite not found', 'invite label mismatch', 'invite expired']) || false;
}, test.limit.quick);

// ── consume: spent is gone (Andy: "the label must be deleted from invites, and move to the key.") ──
test.run('consume answers the row and deletes it: a spent token is then "invite not found", never "already used"', 0.2, function () {
  if (!ROOT) return false;
  I.add(ROOT, { label: 'claimer', token: 'spent-token', expiresAt: FUTURE });
  const row = I.consume(ROOT, 'spent-token');
  const after = I.match(ROOT, 'spent-token', 'claimer');
  const listed = I.load(ROOT).some(function (r) { return r.token === 'spent-token'; });
  return (!!row && row.label === 'claimer' && !listed && after.error === 'invite not found') || false;
}, test.limit.quick);
test.run('consume of an unknown token answers null', 0.2, function () {
  if (!ROOT) return false;
  return I.consume(ROOT, 'never-was') === null || false;
}, test.limit.quick);

// ── revokeInvite (Andy: "we need revokeInvite(label)") ──
test.run('revokeInvite removes every invite of that label, an unclaimed one too, and answers the count', 0.2, function () {
  if (!ROOT) return false;
  I.add(ROOT, { label: 'twin', token: 'twin-a', expiresAt: FUTURE });
  I.add(ROOT, { label: 'twin', token: 'twin-b', expiresAt: FUTURE });
  const n = I.revokeInvite(ROOT, ' twin ');
  const left = I.load(ROOT).filter(function (r) { return r.label === 'twin'; });
  return (n === 2 && left.length === 0) || false;
}, test.limit.quick);
test.run('revokeInvite with no label revokes nothing', 0.2, function () {
  if (!ROOT) return false;
  const before = I.load(ROOT).length;
  const n = I.revokeInvite(ROOT, '  ');
  return (n === 0 && I.load(ROOT).length === before) || false;
}, test.limit.quick);

// ── sweepExpired ──
test.run('sweepExpired removes the expired and keeps the live', 0.2, function () {
  if (!ROOT) return false;
  I.add(ROOT, { label: 'old', token: 'sweep-old', expiresAt: PAST });
  I.add(ROOT, { label: 'new', token: 'sweep-new', expiresAt: FUTURE });
  I.sweepExpired(ROOT);
  const tokens = I.load(ROOT).map(function (r) { return r.token; });
  return (tokens.indexOf('sweep-old') === -1 && tokens.indexOf('expired-token') === -1 && tokens.indexOf('sweep-new') !== -1) || false;
}, test.limit.quick);
test.run('sweepExpired takes the time it is given', 0.2, function () {
  if (!ROOT) return false;
  I.add(ROOT, { label: 'soon', token: 'sweep-soon', expiresAt: '2050-01-01T00:00:00.000Z' });
  I.sweepExpired(ROOT, Date.parse('2060-01-01T00:00:00.000Z'));
  const tokens = I.load(ROOT).map(function (r) { return r.token; });
  return (tokens.indexOf('sweep-soon') === -1 && tokens.indexOf('sweep-new') !== -1) || false;
}, test.limit.quick);
