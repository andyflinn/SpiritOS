'use strict';

// relay-state/invites.json — never git.
// [
//   {
//     "token": "hex",
//     "label": "saint",
//     "expiresAt": "2026-09-20T00:00:00.000Z",
//     "invitedBy": "andy",
//     "consumedAt": null
//   }
// ]
// Cycle 1: store + consume on successful claim. Mint API is cycle 2.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function invitesPath(rootDir) {
  return path.join(rootDir, 'relay-state', 'invites.json');
}

function load(rootDir) {
  try {
    const parsed = JSON.parse(fs.readFileSync(invitesPath(rootDir), 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function save(rootDir, rows) {
  fs.mkdirSync(path.join(rootDir, 'relay-state'), { recursive: true });
  fs.writeFileSync(invitesPath(rootDir), JSON.stringify(rows, null, 2));
}

function newToken() {
  return crypto.randomBytes(16).toString('hex');
}

// One rule for how long an invite lives, used by BOTH the signed mint
// message and the row that gets stored. If the two ever normalized
// differently — client signs "99 days", relay clamps to 15 and verifies
// against 15 — every mint would fail with a bad signature and the reason
// would be invisible from either end.
function normalizeDays(days) {
  var d = Math.floor(Number(days));
  if (!isFinite(d) || d <= 0) return 7;
  if (d < 1) return 1;
  if (d > 15) return 15;
  return d;
}

// A spoken token is trimmed in one place, for the same reason days is
// normalized in one place: the string that is signed has to be the string
// that is stored, or the mint verifies against a token the row does not
// contain.
function normalizeToken(token) {
  return String(token == null ? '' : token).trim();
}

// What the owner signs to mint. Days is normalized in here so the caller
// cannot sign one number and store another.
//
// The token joins the message only when there is one. Two arguments still
// mean "the relay picks the token" and still produce the cycle-2 message,
// so every signature made before A2 verifies unchanged. When Andy does
// speak a token it is inside what he signed: a signature for one token
// mints no other, and a tokenless signature mints no spoken token at all.
function mintMessage(label, days, token) {
  var base = 'mint\n' + String(label || '').trim() + '\n' + normalizeDays(days);
  var tok = normalizeToken(token);
  return tok ? base + '\n' + tok : base;
}

function add(rootDir, opts) {
  const label = String((opts && opts.label) || '').trim();
  if (!label) throw new Error('invite label required');
  const days = normalizeDays(opts && opts.days);
  const row = {
    token: normalizeToken(opts && opts.token) || newToken(),
    label: label,
    expiresAt: (opts && opts.expiresAt) || new Date(Date.now() + days * 86400000).toISOString(),
    invitedBy: (opts && opts.invitedBy) || '',
    consumedAt: null,
  };
  const rows = load(rootDir);
  rows.push(row);
  save(rootDir, rows);
  return row;
}

function match(rootDir, token, label) {
  const t = String(token || '').trim();
  const n = String(label || '').trim();
  if (!t || !n) return { ok: false, status: 403, error: 'invite required' };
  const row = load(rootDir).find(function (r) { return r.token === t; });
  if (!row) return { ok: false, status: 403, error: 'invite not found' };
  if (row.consumedAt) return { ok: false, status: 403, error: 'invite already used' };
  if (row.label !== n) return { ok: false, status: 403, error: 'invite label mismatch' };
  if (Date.parse(row.expiresAt) < Date.now()) {
    return { ok: false, status: 403, error: 'invite expired' };
  }
  return { ok: true, invite: row };
}

function consume(rootDir, token) {
  const rows = load(rootDir);
  const row = rows.find(function (r) { return r.token === token; });
  if (!row || row.consumedAt) return null;
  row.consumedAt = new Date().toISOString();
  save(rootDir, rows);
  return row;
}

// UN-INVITING HAS TO INCLUDE THE INVITE, or the name is a lie: removing
// a peer while a live invite for their label is still on the box means
// they walk straight back in with the token they already have.
//
// Only UNUSED rows, and only for that label. A caveat worth stating
// rather than hiding: labels duplicate, so revoking `john` cancels a
// pending invite for a DIFFERENT john too. That is the safe direction to
// err — an invite is cheap to reissue and a stranger who walks back in
// is not — but it is a real edge and the owner should be told the count.
function revokeLabel(rootDir, label) {
  const n = String(label || '').trim();
  if (!n) return 0;
  const rows = load(rootDir);
  const kept = rows.filter(function (r) {
    return !(r.label === n && !r.consumedAt);
  });
  const gone = rows.length - kept.length;
  if (gone) save(rootDir, kept);
  return gone;
}

// The other half of "cannot forget": an expired invite is refused for
// ever but was never removed, so invites.json only grew. Nothing
// dangerous — every row needed the owner's signature to exist — but a box
// alone in the jungle that can only accumulate is one that eventually
// cannot be read.
//
// Swept on write rather than on a timer: the only moments this file
// matters are the moments something touches it.
function sweepExpired(rootDir, nowMs) {
  const now = nowMs == null ? Date.now() : nowMs;
  const rows = load(rootDir);
  const kept = rows.filter(function (r) {
    if (r.consumedAt) return true;
    return Date.parse(r.expiresAt) >= now;
  });
  const gone = rows.length - kept.length;
  if (gone) save(rootDir, kept);
  return gone;
}

module.exports = {
  load: load,
  add: add,
  revokeLabel: revokeLabel,
  sweepExpired: sweepExpired,
  match: match,
  consume: consume,
  newToken: newToken,
  mintMessage: mintMessage,
  normalizeDays: normalizeDays,
  normalizeToken: normalizeToken,
};
