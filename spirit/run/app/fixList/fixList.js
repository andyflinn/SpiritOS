'use strict';

// spirit/run/app/fixList/fixList.js
// A FIX REQUEST, OFF THE WIRE AND ONTO THE OWNER'S DISC.
//
//   Andy, 2026-09-25: "make an silent app, that can place a message onto
//   owners hard-drive, into a please-fix-this-list"
//
// ── SILENT IS THE WHOLE DESIGN, NOT A MISSING FEATURE ────────────────
//
// It never answers, never asks, and has no page. That is not a smaller
// version of the appShellApp — it is a DIFFERENT SHAPE, and the
// difference is the point:
//
//   appShellApp  arrival -> decide -> POST A REPLY
//   fixList      arrival -> write
//
// The grant needs a reply, and a reply needs a relay to send it through
// and a door to send it out of — two things the booted-app seam does not
// yet supply (nodeApps.js hands an app `post`, but nothing tells it
// WHICH relay reaches a peer, and `serverSurface.js:848` has a standing
// rule that peer.post is the only way onto the wire). THIS APP NEEDS
// NEITHER. It is the half of the seam that is finished, exercised on its
// own, which is why it can work today while the grant still cannot.
//
// If a "thanks, filed" reply ever seems worth adding, it is not: a fix
// request is a note, and a note that must be acknowledged is a
// conversation. Keep it silent and the app cannot become the reason a
// sender is waiting.
//
// ── WHO MAY WRITE TO THE OWNER'S DISC, AND WHY THIS FILE DOES NOT ASK ─
//
//   Andy, 2026-09-25: "since the owner gates which peers can use that
//   app..... it's implicit permission to deposit a request on the
//   owners hard drive"
//
//   and: "concept. app provides 1 function, app-owner manages permission
//   list (contacts on app"
//
// TWO GATES, ANSWERING DIFFERENT QUESTIONS. An earlier draft of this
// file said an app must have no list at all, because the front door had
// already decided. That was one gate too few:
//
//   the front door   who may reach this node. `peerPost.js` calls
//                    onArrival only on verdict `known` or `admit`, and
//                    a held stranger reaches no app — asserted at
//                    `arrivals.js:405`. This code never sees them.
//   `api.allows`     which admitted peers may use THIS app. The
//                    app-owner's list, `allow.json` in this folder,
//                    read on every ask by `nodeApps.js`.
//
// AND THEN NO THIRD QUESTION. Being on the list IS the permission to
// deposit — that is what Andy's first sentence settles. This file does
// not weigh who may file what, or rank requests by sender, or keep its
// own notion of trust. It checks the list and writes the line.
//
// What is still this file's job is the SHAPE of what lands: bounded
// length, no newlines, and the sender's key on every line. Being allowed
// to write is not being allowed to write anything.
//
// ── WHY NOT spirit/currentIssues.md ──────────────────────────────────
//
// That file is Andy's own and it sits outside every app's scope.
// `nodeApps.js` gives a booted app `app/<name>/` and nothing else, and
// widening that for one app — or special-casing a path — is exactly the
// erosion the scope exists to prevent. So this keeps its own list. If
// the two should ever be one file, that is a decision about the
// boundary and belongs to Andy, not to this app quietly reaching past it.

// THE APP ENVELOPE ALREADY EXISTS AND THIS APP USES IT. A first draft
// invented a second one — raw `{app, verb, …}` JSON — which is exactly
// the duplication the wire probe and the SOP exist to catch, committed
// by the agent who had just written the SOP down. `packet.js:13` is the
// shape, `:146` says what `app` means ("which app ON THE RECIPIENT NODE
// a packet is for"), and it carries `re` for correlating a reply, which
// the second envelope had also reinvented. It is node-usable by
// construction, not by accident: `:306` exports for node and hangs
// `window.spiritPacket` otherwise.
const packet = require('../../js/client/packet.js');

const LIST = 'fixes.md';
const APP = 'fixList';

// A header, written once, so the file explains itself to whoever opens
// it — including Andy months from now, and including anybody who finds
// it without knowing an app put it there.
const HEADER = [
  '# Please fix this',
  '',
  'Written by `spirit/run/app/fixList/` from fix requests that arrived',
  'over the wire. Each line carries who asked and when. Delete what is',
  'done — nothing reads this file back, so editing it breaks nothing.',
  '',
].join('\n');

// Short enough to read in a list, long enough to say something. A fix
// request that needs more than this wants to be a conversation, and this
// app is deliberately not one.
const MAX = 500;

// The key is the identity; a label is display and display is not proof.
// Shortened for reading, because a full key on every line makes the list
// unreadable and the whole value here is that a person can scan it.
function shortKey(key) {
  const k = String(key || '');
  return k.length > 16 ? k.slice(0, 8) + '…' + k.slice(-4) : k;
}

// Newlines would let one request write what looks like several entries,
// and a list a person acts on must not be forgeable by its own content.
function oneLine(text) {
  return String(text).replace(/[\r\n]+/g, ' ').trim();
}

function add(api, text, from, at) {
  const body = oneLine(text).slice(0, MAX);
  if (!body) return null;
  const line = '- [' + at + '] `' + shortKey(from) + '` — ' + body;
  const had = api.fs.read(LIST);
  api.fs.write(LIST, (had || HEADER) + line + '\n');
  return line;
}

function mount(api) {
  api.subscribe(function (message) {
    // Every booted app sees every arrival and filters itself — the node
    // routes nothing (nodeApps.js). An envelope that is not ours is not
    // an error, it is somebody else's packet, and plain chat text
    // decodes as `legacy` with a null app, which is also not ours.
    const note = packet.decode(message && message.text);
    if (!note || note.app !== APP) return;
    const body = note.body;
    if (!body || body.verb !== 'fix') return;

    // THE APP-OWNER'S GATE, and the only one this file applies. Silent
    // on refusal: a peer the owner has not listed learns nothing from
    // the app, and the node has already receipted the bytes, so a
    // stranger cannot use this to find out whether the app exists.
    // Logged for the owner, who is the one person entitled to know an
    // ask was turned away.
    if (!api.allows(message.fromKey)) {
      api.log(APP + ': not on the list, so nothing was filed: ' + shortKey(message.fromKey));
      return;
    }

    // A THROW HERE REACHES NOBODY. This runs inside peerPost's arrival
    // fan-out, which swallows it (arrivals.js:200) while the sender is
    // still owed a receipt. The sender is told the bytes arrived either
    // way, so a disc that refuses the write must say so where the owner
    // will see it rather than vanishing.
    try {
      const line = add(api, body.text, message.fromKey, message.sentAt || new Date().toISOString());
      if (!line) api.log(APP + ': an empty fix request from ' + shortKey(message.fromKey) + ' was not filed');
    } catch (e) {
      api.log(APP + ': could not write the fix list: ' + ((e && e.message) || e));
    }
  });
}

module.exports = { mount: mount, add: add, oneLine: oneLine, shortKey: shortKey, LIST: LIST, MAX: MAX };
