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

// What the owner signs to mint. Days is normalized in here so the caller
// cannot sign one number and store another.
function mintMessage(label, days) {
  return 'mint\n' + String(label || '').trim() + '\n' + normalizeDays(days);
}

function add(rootDir, opts) {
  const label = String((opts && opts.label) || '').trim();
  if (!label) throw new Error('invite label required');
  const days = normalizeDays(opts && opts.days);
  const row = {
    token: (opts && opts.token) || newToken(),
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

module.exports = {
  load: load,
  add: add,
  match: match,
  consume: consume,
  newToken: newToken,
  mintMessage: mintMessage,
  normalizeDays: normalizeDays,
};
