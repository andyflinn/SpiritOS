'use strict';

// spirit/run/js/joinStepsJob.js
// WHERE THE JOIN STEPS STAND, AS A STREAM (goal/G30.1, box v40). Andy, 2026-10-20: "does the fucking new element even
// carry its own listener, that keeps the screen untouched until a streamed event actually affects it?", then "FIX IT
// RIGHT". So the node keeps one permanent job, join-steps, the way presenceNode keeps relay-presence: the facts the
// Join app's steps end on, read from this node's own records, published only when they change. The shell's tile and
// the Join app hear it and draw only then; nothing asks the node for the steps on a shell message.
//
//   create(rootDir, jobs) -> { job, facts(), refresh(why) }
//     facts(): seated (a relay row holds a seat), relayUrl (that relay, else the first listed), contact (the book holds
//              anyone but this node and the relays it knows by key), face (the face name kept on that relay's row),
//              faceUrl (https://<face>.<relay host>).
//     refresh(why): publishes the job when facts() changed, with why as its log line; answers whether it did.
// server.js refreshes it after any relay, contact or peer verb, the verbs that can take a seat, add a contact or keep
// a face.

const auth = require('./relayAuth');
const relayKeys = require('./relayKeys');
const contactBook = require('./contacts');

function facts(rootDir) {
  const out = { seated: false, relayUrl: '', contact: false, face: '', faceUrl: '' };
  let seated = [];
  try { seated = relayKeys.seatedUrls(rootDir); } catch (e) { seated = []; }
  out.seated = seated.length > 0;
  let listed = [];
  try { listed = require('./ownerBadge').loadRelays(rootDir).map(function (r) { return r.url; }); } catch (e) { listed = []; }
  out.relayUrl = String(seated[0] || listed[0] || '');
  if (out.seated) {
    let kept = null;
    try { kept = relayKeys.faceOf(rootDir, out.relayUrl); } catch (e) { kept = null; }
    out.face = kept && kept.name ? String(kept.name) : '';
    if (out.face) {
      let host = '';
      try { host = new URL(out.relayUrl).host; } catch (e) { host = ''; }
      out.faceUrl = host ? 'https://' + out.face + '.' + host : '';
    }
  }
  try {
    const me = auth.loadIdentity(rootDir).publicKey;
    const relays = relayKeys.acceptedKeys(rootDir);
    out.contact = contactBook.addressBook(rootDir).some(function (row) { return row.publicKey !== me && !relays[row.publicKey]; });
  } catch (e) { out.contact = false; }
  return out;
}

function create(rootDir, jobs) {
  const job = jobs.createJob('permanent', 'join-steps', facts(rootDir));
  let last = JSON.stringify(job.data);
  function refresh(why) {
    const next = facts(rootDir);
    const asJson = JSON.stringify(next);
    if (asJson === last) return false;
    last = asJson;
    jobs.updateJob(job.id, { data: next, logMessage: String(why || 'changed') });
    return true;
  }
  return { job: job, facts: function () { return facts(rootDir); }, refresh: refresh };
}

module.exports = { create: create, facts: facts };
