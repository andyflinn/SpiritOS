'use strict';

// relay-state/invites.json — never git.
// [
//   {
//     "token": "hex",
//     "label": "saint",
//     "expiresAt": "2026-09-20T00:00:00.000Z",
//     "invitedBy": "andy"
//   }
// ]
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
  // A SPENT TOKEN IS NOW `not found`, and that is the better answer. The
  // check that stood here said `invite already used`, which confirmed to
  // whoever held a dead token that it had been real and had been spent.
  // Saying less is correct, and it costs nothing: the row is gone, so
  // there is no second state to distinguish.
  if (!row) return { ok: false, status: 403, error: 'invite not found' };

  // DEPRECATED(D4, expires: alpha) — rows the old `consume` stamped.
  // See design/DEPRECATIONS.md (decision 0014).
  // LEGACY ROWS FROM BEFORE SPENT MEANT GONE, and this line is load-
  // bearing on exactly one day: the day a running relay takes this code.
  //
  // A box upgrading in place still has rows the old `consume` stamped
  // rather than deleted. Without this, every spent-but-not-yet-expired
  // token on that box becomes live again the moment it restarts — because
  // nothing else looks at `consumedAt` any more. Verified against a real
  // spirit-3-shaped row before it was written.
  //
  // Not residue and not a second state: no new row can ever have this
  // field. sweepExpired drains the old ones, and when the last invite
  // minted before the change has expired this can go.
  if (row.consumedAt) return { ok: false, status: 403, error: 'invite not found' };

  if (row.label !== n) return { ok: false, status: 403, error: 'invite label mismatch' };
  if (Date.parse(row.expiresAt) < Date.now()) {
    return { ok: false, status: 403, error: 'invite expired' };
  }
  return { ok: true, invite: row };
}

// SPENT IS GONE. The row is returned to the caller — claim still needs
// the label it was for — and then it is not on this box any more.
function consume(rootDir, token) {
  const rows = load(rootDir);
  const row = rows.find(function (r) { return r.token === token; });
  if (!row) return null;
  save(rootDir, rows.filter(function (r) { return r !== row; }));
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
  const rows = load(rootDir);
  const kept = rows.filter(function (r) { return r.label !== n; });
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
  // `if (r.consumedAt) return true;` stood here and was the reason this
  // function could not do its job: it protected exactly the rows that had
  // no reason left to exist.
  //
  // DEPRECATED(D4, expires: alpha) — draining the stamped rows.
  // It is now the opposite — a stamped row is a LEGACY row, from before
  // spent meant gone, and it goes on sight whatever its expiry says. That
  // is the migration: a relay upgrading in place drains its old guestbook
  // the first time anything touches this file, rather than carrying it
  // until each row times out. `match` refuses them in the meantime.
  const kept = rows.filter(function (r) {
    if (r.consumedAt) return false;
    return Date.parse(r.expiresAt) >= now;
  });
  const gone = rows.length - kept.length;
  if (gone) save(rootDir, kept);
  return gone;
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
