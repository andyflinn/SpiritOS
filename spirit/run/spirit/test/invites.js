'use strict';

// spirit/run/spirit/test/invites.js
// The tests of spirit/invites.js, and of no other module (spec: ./invites.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, box v72).
//
// The relay's invites, a waiting room and not a guestbook: add, match, consume (spent is gone), revokeInvite by label,
// sweepExpired, and the one normalizing of days and token. Run in process on a scratch root under the temp folder,
// whose relay.db relayStore opens.

const fs = require('fs');
const os = require('os');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const I = require(path.join(RUN, 'spirit', 'invites.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const FUTURE = '2099-01-01T00:00:00.000Z';
const PAST = '2001-01-01T00:00:00.000Z';
let ROOT = null;
const NO_WORLD = 'no scratch relay: the world failed';

test.run('the world: a scratch relay root, an invite added on it is listed', 0.2, function () {
  ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'nr-invites-'));
  try { I.add(ROOT, { label: 'world', token: 'world-token', expiresAt: FUTURE }); } catch (e) { ROOT = null; return 'add threw: ' + String(e && e.message); }
  const all = I.load(ROOT);
  if (!all.some(function (r) { return r.token === 'world-token'; })) { ROOT = null; return 'load: ' + short(all); }
  return true;
}, test.limit.quick);

// ── normalizeDays, normalizeToken: one rule for what is signed and what is stored ──
test.run('normalizeDays: whole days, 1 to 15; nothing, zero or junk is 7', 0.2, function () {
  const got = [undefined, 0, -3, 'x', 1, 3.9, 15, 99].map(I.normalizeDays);
  return short(got) === short([7, 7, 7, 7, 1, 3, 15, 15]) || 'normalizeDays: ' + short(got);
}, test.limit.quick);
test.run('normalizeToken trims; nothing is empty', 0.2, function () {
  const got = ['  dog  ', null, undefined, 42].map(I.normalizeToken);
  return short(got) === short(['dog', '', '', '42']) || 'normalizeToken: ' + short(got);
}, test.limit.quick);
test.run('newToken is 16 random bytes in hex, a new one each time', 0.2, function () {
  const a = I.newToken(); const b = I.newToken();
  return (/^[0-9a-f]{32}$/.test(a) && a !== b) || 'newToken: ' + short([a, b]);
}, test.limit.quick);

// ── add ──
test.run('add refuses an invite with no label', 0.2, function () {
  if (!ROOT) return NO_WORLD;
  try { I.add(ROOT, { label: '   ' }); return 'an invite with no label was added'; } catch (e) { return /invite label required/.test(String(e && e.message)) || 'threw: ' + short(e && e.message); }
}, test.limit.quick);
test.run('add stores the row it answers: the token trimmed, the label trimmed, the inviter', 0.2, function () {
  if (!ROOT) return NO_WORLD;
  const row = I.add(ROOT, { label: ' saint ', token: '  spoken  ', expiresAt: FUTURE, invitedBy: 'andy' });
  const kept = I.load(ROOT).filter(function (r) { return r.token === 'spoken'; })[0];
  return (row.token === 'spoken' && row.label === 'saint' && row.invitedBy === 'andy' && !!kept && kept.label === 'saint') || 'row ' + short(row) + ', kept ' + short(kept);
}, test.limit.quick);
test.run('add with no token mints one; with no expiry it lives the normalized days', 0.2, function () {
  if (!ROOT) return NO_WORLD;
  const t0 = Date.now();
  const row = I.add(ROOT, { label: 'minted', days: 99 });
  const ms = Date.parse(row.expiresAt) - t0;
  return (/^[0-9a-f]{32}$/.test(row.token) && ms > 15 * 86400000 - 60000 && ms <= 15 * 86400000 + 60000) || 'row ' + short(row);
}, test.limit.quick);

// ── match ──
test.run('match: the token and its label answer ok and the invite', 0.2, function () {
  if (!ROOT) return NO_WORLD;
  I.add(ROOT, { label: 'john', token: 'match-token', expiresAt: FUTURE });
  const m = I.match(ROOT, ' match-token ', ' john ');
  return (m.ok === true && m.invite && m.invite.label === 'john') || 'match: ' + short(m);
}, test.limit.quick);
test.run('match refuses, 403: none given, not found, another label, expired', 0.2, function () {
  if (!ROOT) return NO_WORLD;
  I.add(ROOT, { label: 'late', token: 'expired-token', expiresAt: PAST });
  const got = [I.match(ROOT, '', 'john'), I.match(ROOT, 'no-such', 'john'), I.match(ROOT, 'match-token', 'jane'), I.match(ROOT, 'expired-token', 'late')];
  const errs = got.map(function (m) { return m.ok === false && m.status === 403 ? m.error : 'ok?'; });
  return short(errs) === short(['invite required', 'invite not found', 'invite label mismatch', 'invite expired']) || 'match: ' + short(got);
}, test.limit.quick);

// ── consume: spent is gone (Andy: "the label must be deleted from invites, and move to the key.") ──
test.run('consume answers the row and deletes it: a spent token is then "invite not found", never "already used"', 0.2, function () {
  if (!ROOT) return NO_WORLD;
  I.add(ROOT, { label: 'claimer', token: 'spent-token', expiresAt: FUTURE });
  const row = I.consume(ROOT, 'spent-token');
  const after = I.match(ROOT, 'spent-token', 'claimer');
  const listed = I.load(ROOT).some(function (r) { return r.token === 'spent-token'; });
  return (!!row && row.label === 'claimer' && !listed && after.error === 'invite not found') || 'consumed ' + short(row) + ', listed ' + listed + ', match ' + short(after);
}, test.limit.quick);
test.run('consume of an unknown token answers null', 0.2, function () {
  if (!ROOT) return NO_WORLD;
  return I.consume(ROOT, 'never-was') === null || 'consume answered a row';
}, test.limit.quick);

// ── revokeInvite (Andy: "we need revokeInvite(label)") ──
test.run('revokeInvite removes every invite of that label, an unclaimed one too, and answers the count', 0.2, function () {
  if (!ROOT) return NO_WORLD;
  I.add(ROOT, { label: 'twin', token: 'twin-a', expiresAt: FUTURE });
  I.add(ROOT, { label: 'twin', token: 'twin-b', expiresAt: FUTURE });
  const n = I.revokeInvite(ROOT, ' twin ');
  const left = I.load(ROOT).filter(function (r) { return r.label === 'twin'; });
  return (n === 2 && left.length === 0) || 'revoked ' + n + ', left ' + short(left);
}, test.limit.quick);
test.run('revokeInvite with no label revokes nothing', 0.2, function () {
  if (!ROOT) return NO_WORLD;
  const before = I.load(ROOT).length;
  const n = I.revokeInvite(ROOT, '  ');
  return (n === 0 && I.load(ROOT).length === before) || 'revoked ' + n;
}, test.limit.quick);

// ── sweepExpired ──
test.run('sweepExpired removes the expired and keeps the live', 0.2, function () {
  if (!ROOT) return NO_WORLD;
  I.add(ROOT, { label: 'old', token: 'sweep-old', expiresAt: PAST });
  I.add(ROOT, { label: 'new', token: 'sweep-new', expiresAt: FUTURE });
  I.sweepExpired(ROOT);
  const tokens = I.load(ROOT).map(function (r) { return r.token; });
  return (tokens.indexOf('sweep-old') === -1 && tokens.indexOf('expired-token') === -1 && tokens.indexOf('sweep-new') !== -1) || 'left: ' + short(tokens);
}, test.limit.quick);
test.run('sweepExpired takes the time it is given', 0.2, function () {
  if (!ROOT) return NO_WORLD;
  I.add(ROOT, { label: 'soon', token: 'sweep-soon', expiresAt: '2050-01-01T00:00:00.000Z' });
  I.sweepExpired(ROOT, Date.parse('2060-01-01T00:00:00.000Z'));
  const tokens = I.load(ROOT).map(function (r) { return r.token; });
  return (tokens.indexOf('sweep-soon') === -1 && tokens.indexOf('sweep-new') !== -1) || 'left: ' + short(tokens);
}, test.limit.quick);
