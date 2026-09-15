'use strict';

// spirit/run/js/relayStatus.js
// WHAT A RELAY TELLS ITS OWNER ABOUT ITSELF.
//
// ── WHY ──────────────────────────────────────────────────────────────
//
//   Andy: "console exchange is not something i like to see at all. it's
//   near useless, when this sort of information could be streamed to the
//   owner-node, permitting a real-time monitor in shell for the relay
//   memory status etc...."
//
// The relay console it replaces answered eight typed words and not one
// of them changed anything — it was a read-only view, and six of the
// eight returned data /api/relay/who already hands to anyone
// unauthenticated. Its whole owner-gate existed to protect one word:
// `invites`.
//
// This is the other half of that observation. A relay that must survive
// and earn its keep (decision 0007) has, until now, had no way to tell
// anyone whether it IS surviving, short of an SSH session. Memory,
// uptime, how many peers are actually connected, how many requests are
// in flight — none of it was answerable at all, by the console or by
// anything else.
//
// ── WHAT THIS FILE IS AND IS NOT ─────────────────────────────────────
//
// It is a pure function from facts to a report. It opens no socket,
// reads no clock it was not handed, and decides nothing about who may
// see the result — relay.js does the sending and is the only thing that
// knows the owner's key.
//
// That split is deliberate. The delivery rule ("the owner's sink and no
// other") is the part that must never be got wrong, so it lives in one
// place next to the key it depends on, and the part that formats numbers
// lives here where it can be tested without a relay at all.
//
// ── 0006 ─────────────────────────────────────────────────────────────
//
// A relay stores nothing on anyone's behalf. Reporting its own condition
// stores nothing — the report is built on demand from what the process
// already holds and is not kept. But it IS a second kind of traffic on a
// stream that has only ever carried peer traffic, and a node must be
// free to ignore it entirely.

// A token is live if it has not been used and has not expired. The same
// rule the console applied, moved here with it — this is the one fact
// the console could tell an owner that nothing else can.
function liveInvites(rows, nowMs) {
  return (Array.isArray(rows) ? rows : []).filter(function (row) {
    if (!row || !row.label) return false;
    if (row.consumedAt) return false;
    var expires = Date.parse(row.expiresAt);
    return !(expires < nowMs);
  });
}

// Every input is passed in, including the clock and the process figures.
// A report that read `process` directly could only be tested by asserting
// that a number is a number.
function report(opts) {
  var o = opts || {};
  var nowMs = typeof o.now === 'number' ? o.now : Date.now();
  var snap = o.snapshot || {};
  var proc = o.proc || {};

  var peers = Array.isArray(snap.peers) ? snap.peers : [];
  var present = Array.isArray(o.present) ? o.present : [];

  // Presence is counted against the roster, not reported raw: a relay
  // that says "7 connected" out of a roster of 3 is telling its owner
  // something is wrong, and that is exactly the kind of thing a monitor
  // exists to show. So both numbers travel.
  return {
    at: new Date(nowMs).toISOString(),
    owner: snap.owner || '',
    mode: snap.mode || '',
    key: snap.relayPublicKey || '',
    version: o.version || '',

    peers: peers.length,
    present: present.length,

    // In flight right now: posts registered and not yet answered. The
    // number that says whether this relay is BUSY, as opposed to merely
    // populated — and the first figure here that could not be had from
    // the census.
    routes: typeof o.routes === 'number' ? o.routes : 0,

    // THE RING, and it is here so that its disappearance is visible.
    // When R8 deletes send/inbox this number goes to zero and then the
    // field goes, and an owner watching a monitor sees the change rather
    // than reading about it.
    messages: typeof snap.messages === 'number' ? snap.messages : 0,

    // THE ONE THING THE CONSOLE COULD TELL AN OWNER THAT NOTHING ELSE
    // CAN. Live tokens are not in the census and not on any public
    // route; without this, deleting the console would remove a
    // capability rather than relocate one.
    //
    // Labels and expiry, never the token itself. A token is a credential
    // — it is what somebody claims a row with — and a monitor is a view,
    // not a place to keep secrets where a screenshot can find them.
    invites: liveInvites(o.invites, nowMs).map(function (row) {
      return {
        label: String(row.label),
        expiresAt: String(row.expiresAt || ''),
        invitedBy: String(row.invitedBy || ''),
      };
    }),

    // WHETHER IT IS SURVIVING, which is the half decision 0007 cares
    // about and the half nothing in the system could answer.
    //
    // rss is the honest number for "how much of this box am I using" —
    // heapUsed flatters, because it ignores buffers and the sockets a
    // relay is mostly made of. Both travel, because the gap between them
    // is itself the interesting figure on a box that holds connections.
    memory: {
      rss: typeof proc.rss === 'number' ? proc.rss : 0,
      heapUsed: typeof proc.heapUsed === 'number' ? proc.heapUsed : 0,
      heapTotal: typeof proc.heapTotal === 'number' ? proc.heapTotal : 0,
    },
    uptimeSec: Math.floor(typeof proc.uptime === 'number' ? proc.uptime : 0),
  };
}

module.exports = {
  report: report,
  liveInvites: liveInvites,
};
