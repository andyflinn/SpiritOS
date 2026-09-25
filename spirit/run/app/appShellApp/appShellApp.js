'use strict';

// spirit/run/app/appShellApp/appShellApp.js
// THE GRANT MECHANISM — one verb, no face.
//
// ── WHAT THIS IS FOR ─────────────────────────────────────────────────
//
//   Andy, 2026-09-25: "the feature of the appShellApp is: the
//   granting/associating member ID's with wildcard subdomain names.
//   that's all."
//
// And the bottom underneath two things that look different:
//
//   Andy: "so the bottom is the grant mechanism that underpins the
//   installation of join into the DNS namespace as well as member
//   subdomain assignments."
//
// So `join` asks for its name the same way Alice asks for hers. THERE IS
// NO SYSTEM-FACE SPECIAL CASE and none may be added: the moment the
// installer has a shortcut, the path this suite drives stops being the
// path that is used.
//
// ── FACELESS, AND WHY THAT IS THE LOAD-BEARING PART ──────────────────
//
//   Andy: "faceless, no shortcut."
//
// No page, no stylesheet, no HTTP surface, no control panel. Not an
// omission to be filled in later — it is what makes the assertions in
// `spirit/test/appShellGrant.js` honest, because the exchange is the
// ONLY way to drive this, so a test drives exactly what the installer
// drives. `appShellGrant.js:96-118` walks this directory and goes red on
// an .html, a .css, a `createServer(`, a `.listen(` or a `require('http')`.
//
// A control panel is the obvious next convenience. It belongs in a shell
// app that talks to this one over the wire, never in this folder.
//
// ── THE EXCHANGE IS TWO PACKETS, ON PURPOSE ──────────────────────────
//
// An ask arrives; the grant leaves as a SECOND packet addressed back to
// the asker, carrying the first packet's hash. It is not a synchronous
// answer, and it may not become one: `peerPost.js:1327` keeps the answer
// hook out of app hands because an answerer that hangs holds the
// sender's connection open, and this exchange has no held connection to
// justify changing that. Ruled 2026-09-25 (Andy: "if agreed by wsl,
// that's a go"), with the synchronous case left to G17 and `join`.
//
// Andy required the packet even where it is not needed for transport:
//
//   Andy: "yes to 'the negotiation should be a packet even when both
//   ends are on the same node.'"
//
// So there is no local call path, no in-process shortcut, and no branch
// that notices both ends are the same node. Two hashes and two receipts
// in the traffic log is the observable form of that, and the suite
// asserts it rather than trusting this comment.
//
// ── THE DATASET IS THE OWNER'S, AND IT STAYS HOME ────────────────────
//
//   Andy: "A name grant persists. true. but only on the owners node."
//   Andy: "the list is reserved by the appShellApp mapping dataset on
//   the owners personal node" — and, asked whether reserved names were
//   hardcoded: "not hardcoded".
//
// So there is no RESERVED array in this file and there must not be one.
// A name is taken because somebody was granted it, and for no other
// reason. `join` reserving its subdomain is a row written by the same
// exchange at install time, which is why the installer needs no
// privilege this file does not give every member.

// THE APP ENVELOPE, WHICH ALREADY EXISTED. A first draft of this file
// invented a second one — raw `{app, verb, …}` JSON with a hand-rolled
// `re` for correlating the reply — and `packet.js` had all three: the
// shape (`:13`), what `app` means (`:146`, "which app ON THE RECIPIENT
// NODE a packet is for"), and `re` (`:262`). Caught by reading
// `arrivals.js:384`, which has been encoding packets this way all along.
const packet = require('../../js/client/packet.js');

const NAME_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const DATASET = 'grants.json';

// The envelope this app answers to. Read by THIS file, never by the
// node — `nodeApps.js` hands every booted app every admitted arrival
// and looks at none of them, which is Andy's "nothing in node and relay
// should know about apps" kept literally.
const APP = 'appShellApp';

function readGrants(api) {
  const raw = api.fs.read(DATASET);
  if (!raw) return {};
  try {
    const doc = JSON.parse(raw);
    return (doc && typeof doc.names === 'object' && doc.names) || {};
  } catch (e) {
    // A TORN OR HAND-EDITED FILE IS NOT AN EMPTY ONE. Returning {} here
    // would re-grant every name that is already out there, so this
    // refuses to answer instead — see `grant` below, which treats null
    // as "cannot say" rather than "nothing is taken".
    return null;
  }
}

function writeGrants(api, names) {
  api.fs.write(DATASET, JSON.stringify({ names: names }, null, 2) + '\n');
}

// The whole of the decision. Separated from the wire so the rule can be
// read without reading the plumbing, and so a later caller cannot reach
// the plumbing without passing through the rule.
function decide(api, name, asker) {
  if (!NAME_RE.test(String(name || ''))) {
    return { ok: false, code: 'bad-request', name: name, why: 'a name is 1-63 characters of a-z, 0-9 and -, not starting or ending with -' };
  }
  const names = readGrants(api);
  if (names === null) {
    return { ok: false, code: 'no-row', name: name, why: 'the grant dataset could not be read, and guessing would re-grant a live name' };
  }
  const held = names[name];
  if (held && held.to !== asker) {
    // THE ONE REFUSAL THIS FEATURE HAS, and it is in the catalogue
    // before this file emits it (`spiritErrors.js:513`) — a code living
    // only in the file that throws it is outside the closed set at the
    // one moment anybody needs to look it up.
    //
    // Permanent, not a reservation: `name-reserved` frees itself when
    // its invite expires, a grant does not.
    return { ok: false, code: 'name-already-granted', name: name };
  }
  if (held) {
    // The same asker asking twice gets the same answer, not a refusal.
    // An installer that retries after a lost reply must not be told the
    // name it owns is taken.
    return { ok: true, name: name, at: held.at, again: true };
  }
  const at = new Date().toISOString();
  names[name] = { to: asker, at: at };
  writeGrants(api, names);
  return { ok: true, name: name, at: at };
}

function mount(api) {
  api.subscribe(function (message) {
    const ask = packet.decode(message && message.text);
    if (!ask || ask.app !== APP) return;
    const body = ask.body;
    if (!body || body.verb !== 'grant') return;

    // THE APP-OWNER'S GATE (Andy: "app provides 1 function, app-owner
    // manages permission list"). The node's front door has already said
    // this peer may reach the node; `allows` says whether they may use
    // THIS app. Absent list means nobody — nodeApps.js.
    if (!api.allows(message.fromKey)) {
      api.log(APP + ': not on the list, so no name was granted: ' + String(message.fromKey).slice(0, 8));
      return;
    }

    const answer = decide(api, body.name, message.fromKey);

    // `re` carries the asking packet's hash, which is what makes two
    // packets one exchange. Without it a reply is just another arrival
    // and the asker cannot tell which question it answers. Carried by
    // the envelope rather than by a field of ours — see the header.
    const made = packet.encode(APP, Object.assign({ verb: 'granted' }, answer), { re: message.hash });
    const reply = made && made.text;

    // A THROW HERE REACHES NOBODY — this runs inside peerPost's arrival
    // fan-out, which swallows it (arrivals.js:200) while the sender is
    // still owed a receipt for the ASK. The ask is receipted either way;
    // it is the grant that would be lost, so it is logged rather than
    // dropped in silence.
    try {
      if (api.post) api.post('', message.fromKey, reply, null, null);
    } catch (e) {
      api.log(APP + ': the grant for "' + body.name + '" could not be posted: ' + ((e && e.message) || e));
    }
  });
}

module.exports = { mount: mount, decide: decide, NAME_RE: NAME_RE };
