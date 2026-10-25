'use strict';

// spirit/run/spirit/relayRowsJob.js
// THE RELAYS THIS NODE LISTS, AS A STREAM (goal/G40.10, box v21). Andy, 2026-10-25: "why would my node not stream a
// change in relay status?", "box it.", and "about the live/realtime updates, we need to be perfectionists about that
// sort of thing". So the node keeps one permanent job, relay-rows, the way it keeps join-steps: each relay it lists,
// with its seat, verified email and face, read from this node's own records and published only when one changes. The
// email and face forms, Info and the relay details hear it and redraw; none asks again on a timer.
//
//   create(rootDir, jobs) -> { job, rows(), refresh(why) }
//     rows(): [{ url, label, claimed, seatLabel, email, emailVerified, face: { name, email } }], in the list's order.
//     refresh(why): publishes the job when rows() changed, with why as its log line; answers whether it did.
// server.js refreshes it after any relay, contact or peer verb, and on a relay's report (its status nudge), which is
// when a relay this node owns has its seat noted (relayKeys.ownerSeat).

const relayKeys = require('./relayKeys');
const ownerBadge = require('./ownerBadge');

function rows(rootDir) {
  let listed = [];
  try { listed = ownerBadge.loadRelays(rootDir); } catch (e) { listed = []; }
  return listed.map(function (r) {
    const row = relayKeys.byUrl(rootDir, r.url) || {};
    const seated = !!row.seatClaimedAt;
    const mail = relayKeys.emailOf(rootDir, r.url);
    const face = relayKeys.faceOf(rootDir, r.url);
    return {
      url: r.url, label: String(r.label || r.url),
      claimed: seated, seatLabel: seated ? String(row.seatLabel || '') : '',
      email: mail.verified ? String(mail.email || '') : '', emailVerified: !!(mail.verified && mail.email),
      face: face ? { name: String(face.name || ''), email: String(face.email || '') } : { name: '', email: '' },
    };
  });
}

function create(rootDir, jobs) {
  const job = jobs.createJob('permanent', 'relay-rows', { rows: rows(rootDir) });
  let last = JSON.stringify(job.data);
  function refresh(why) {
    const next = { rows: rows(rootDir) };
    const asJson = JSON.stringify(next);
    if (asJson === last) return false;
    last = asJson;
    jobs.updateJob(job.id, { data: next, logMessage: String(why || 'changed') });
    return true;
  }
  return { job: job, rows: function () { return rows(rootDir); }, refresh: refresh };
}

module.exports = { create: create, rows: rows };
