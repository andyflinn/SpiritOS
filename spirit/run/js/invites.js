'use strict';

// The relay's invites — the `invites` table in relay-state/relay.db since
// cycle 3 (relayStore.js). It was relay-state/invites.json until then; a
// relay that still has that file imports it once (D8). A row:
//
//   { "token": "hex", "label": "saint",
//     "expiresAt": "2026-09-20T00:00:00.000Z", "invitedBy": "andy" }
//
// A WAITING ROOM, NOT A GUESTBOOK.
//
//   Andy: "as soon as that label claims itself and deposits its key, the
//   label must be deleted from invites, and move to the key."
//
// It used to be a guestbook. `consume` set `consumedAt` and KEPT the row;
// `sweepExpired` then explicitly protected consumed rows from being
// swept, and `revokeLabel` skipped them too — so nothing in the tree ever
// removed a used invite. Three things followed, and the third is the one
// that matters:
//
//   the file only ever grew
//   it held a spent token, in the clear, for ever — while relayStatus
//     takes care never to put a token where a screenshot can find it
//   it was a record of WHO INVITED WHOM AND WHEN, kept on a relay
//
// That last one is decision 0006's subject exactly: a relay stores
// nothing on anyone's behalf. A social graph accumulating in a file
// nobody can see is the ring's sin, slower and in a different place.
//
// So a claimed invite is DELETED, and `consumedAt` is gone with it — a
// field that can only ever be null is residue, and the next reader would
// reasonably wonder when it gets set.
//
// Where the label goes is the other half of Andy's sentence, and it was
// always true: `claim` writes the peer row, and the label lives there.

const crypto = require('crypto');
// On disc, and read by query (cycle 3). The same store relay.js holds, so
// both see one connection.
const relayStore = require('./relayStore');

function load(rootDir) {
  return relayStore.open(rootDir).invites.all();
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

// mintMessage STOOD HERE — the bytes an owner signed to mint an invite,
// and the fourth of decision 0010's four signed formats to be written by
// hand because the protocol could not carry the request.
//
// It is a packet now (relay.answerSelf), so the label, the day count and
// the spoken token are inside what postMessage already signs. normalizeDays
// still lives in add(), which is what kept a caller from signing one number
// and storing another; nothing about that changed.
//
function add(rootDir, opts) {
  const label = String((opts && opts.label) || '').trim();
  if (!label) throw new Error('invite label required');
  const days = normalizeDays(opts && opts.days);
  const row = {
    token: normalizeToken(opts && opts.token) || newToken(),
    label: label,
    expiresAt: (opts && opts.expiresAt) || new Date(Date.now() + days * 86400000).toISOString(),
    invitedBy: (opts && opts.invitedBy) || '',
  };
  relayStore.open(rootDir).invites.add(row);
  return row;
}

function match(rootDir, token, label) {
  const t = String(token || '').trim();
  const n = String(label || '').trim();
  if (!t || !n) return { ok: false, status: 403, error: 'invite required' };
  const row = relayStore.open(rootDir).invites.get(t);
  // A SPENT TOKEN IS NOW `not found`, and that is the better answer. The
  // check that stood here said `invite already used`, which confirmed to
  // whoever held a dead token that it had been real and had been spent.
  // Saying less is correct, and it costs nothing: the row is gone, so
  // there is no second state to distinguish.
  if (!row) return { ok: false, status: 403, error: 'invite not found' };

  if (row.label !== n) return { ok: false, status: 403, error: 'invite label mismatch' };
  if (Date.parse(row.expiresAt) < Date.now()) {
    return { ok: false, status: 403, error: 'invite expired' };
  }
  return { ok: true, invite: row };
}

// SPENT IS GONE. The row is returned to the caller — claim still needs
// the label it was for — and then it is not on this box any more.
function consume(rootDir, token) {
  const store = relayStore.open(rootDir);
  const row = store.invites.get(token);
  if (!row) return null;
  store.invites.remove(token);
  return row;
}

// TAKING AN INVITATION BACK. By LABEL, and it cannot be anything else:
// an outstanding invite is for somebody who has no key here yet, so a
// label is the only handle it has. The owner's report shows label,
// expiry and inviter and NEVER the token, so a label is also the only
// handle the owner is given.
//
//   Andy: "revokeLabel is unnecessary. we need revokeInvite(label)"
//
// It was called revokeLabel, which read as "free this name in the
// namespace" — a different operation, and one that only happens when a
// row is deleted. And it was reachable only as a side effect of
// removePeer, which needs a peer row to resolve — so the one case that
// matters, an invite nobody has claimed, could not be revoked AT ALL.
//
// UN-INVITING STILL HAS TO INCLUDE THE INVITE, which is why removePeer
// remains a caller: removing a peer while a live invite for their label
// is on the box means they walk straight back in with the token they
// already have.
//
// A caveat worth stating rather than hiding: labels duplicate, so
// revoking `john` cancels a pending invite for a DIFFERENT john too. That
// is the safe direction to err — an invite is cheap to reissue and a
// stranger who walks back in is not — but it is real, and the count comes
// back so the owner can be told.
function revokeInvite(rootDir, label) {
  const n = String(label || '').trim();
  if (!n) return 0;
  return relayStore.open(rootDir).invites.removeLabel(n);
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
  // Spent invites are deleted when spent, so an expired one is the only
  // kind left to sweep. (Rows the old `consume` stamped instead of deleting
  // were D4; the one-time import (D8) does not carry them.)
  return relayStore.open(rootDir).invites.sweepExpired(new Date(now).toISOString());
}

module.exports = {
  load: load,
  add: add,
  revokeInvite: revokeInvite,
  sweepExpired: sweepExpired,
  match: match,
  consume: consume,
  newToken: newToken,
  normalizeDays: normalizeDays,
  normalizeToken: normalizeToken,
};
