#!/usr/bin/env node
'use strict';

// bash/face-owner.js
// THE OWNER'S HALF OF SETTING UP THE FACE, run on the owner's own box.
//
//   Andy, 2026-09-27, "go." on: one script for his side, run after
//   bash/face-install on spirit-3, that does the three owner steps through
//   his node's own door, so he types one line on each machine.
//
//   node bash/face-owner.js <FACE_NODE_KEY> [--node http://127.0.0.1:65432]
//                           [--face-domain face.spirit.andyflinn.com] [--name join]
//
// FACE_NODE_KEY is the key face-install printed at its end. Everything goes
// through doors this node already has, never a new verb (a new node verb
// needs Andy's yes):
//   node.card          this node's own key, for the grant row
//   peer.acquire       look the face node's key up on the relay, making a row
//   contact.accept     let it in (accept refuses a key with no row: contacts.js)
//   GET /app/appFaceApp/grants.json   what is granted already, to merge into
//   fs.save            app/appFaceApp/face-domain.json and grants.json
//                      (app/ is a writable root; neither file is the app's
//                      entry script or manifest, kernel.js fileWritable)
// appFaceApp reads both files on every question, so nothing needs a restart.

const args = process.argv.slice(2);
function flag(name, fallback) {
  const at = args.indexOf(name);
  if (at === -1) return fallback;
  const v = args[at + 1];
  args.splice(at, 2);
  return v;
}
const NODE = String(flag('--node', 'http://127.0.0.1:65432')).replace(/\/+$/, '');
const FACE_DOMAIN = String(flag('--face-domain', 'face.spirit.andyflinn.com'));
const NAME = String(flag('--name', 'join'));
const FACE_KEY = String(args[0] || '').trim();

function say(line) { console.log('==> ' + line); }
function ok(line) { console.log('    ok  ' + line); }
function die(line) { console.error('ERROR: ' + line); process.exit(1); }
// Any 2xx: peer.acquire answers 201 and fs.save 204, both success.
function good(r) { return r && r.status >= 200 && r.status < 300; }

if (!/^MCow/.test(FACE_KEY)) die('give the face node\'s key (MCow...), the one face-install printed at its end');
if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(NAME)) die('--name must be one DNS label, e.g. join');

async function verb(body) {
  let res;
  try {
    res = await fetch(NODE + '/api/spirit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
  } catch (e) {
    die('your node does not answer at ' + NODE + ' (' + e.message + '). Is it running? Use --node for another port.');
  }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { json = null; }
  return { status: res.status, json: json, text: text };
}

(async function () {
  say('your node at ' + NODE);
  const card = await verb({ verb: 'node.card' });
  const self = card.json && card.json.publicKey;
  if (!good(card) || !self) die('your node gave no key (' + card.status + ' ' + card.text + ')');
  ok('its key is ' + self.slice(0, 24) + '...');
  if (self === FACE_KEY) die('that is your own node\'s key, not the face node\'s');

  say('let the face node in');
  const acquired = await verb({ verb: 'peer.acquire', publicKey: FACE_KEY });
  if (!good(acquired)) {
    die('could not find the face node on your relay (' + acquired.status + ' ' + acquired.text + '). '
      + 'Has face-install on spirit-3 finished its join?');
  }
  const accepted = await verb({ verb: 'contact.accept', publicKey: FACE_KEY });
  if (!good(accepted)) die('could not accept the face node (' + accepted.status + ' ' + accepted.text + ')');
  ok('the face node is a contact your node listens to');

  say('face domain: ' + FACE_DOMAIN);
  const domainSaved = await verb({
    verb: 'fs.save', path: 'app/appFaceApp/face-domain.json',
    content: JSON.stringify({ faceDomain: FACE_DOMAIN }, null, 2) + '\n',
  });
  if (!good(domainSaved)) die('could not write face-domain.json (' + domainSaved.status + ' ' + domainSaved.text + ')');
  ok('app/appFaceApp/face-domain.json');

  // MERGED, NEVER REPLACED: grants.json may already hold names granted to
  // members through the exchange, and dropping them would free those names.
  // A file that does not parse is left alone and reported: appFaceApp itself
  // refuses to treat a torn grants file as empty, for the same reason.
  say('grant "' + NAME + '" to your own node');
  let doc = { names: {} };
  try {
    const got = await fetch(NODE + '/app/appFaceApp/grants.json');
    if (got.status === 200) {
      const text = await got.text();
      try { doc = JSON.parse(text); }
      catch (e) { die('app/appFaceApp/grants.json does not parse; fix it by hand, nothing was written'); }
      if (!doc || typeof doc !== 'object') doc = { names: {} };
      if (!doc.names || typeof doc.names !== 'object') doc.names = {};
    }
  } catch (e) { die('could not read grants.json from your node: ' + e.message); }
  const before = doc.names[NAME];
  if (before && before.to && before.to !== self) {
    die('"' + NAME + '" is already granted to another key (' + String(before.to).slice(0, 24)
      + '...). Nothing was changed; free it first if you mean to take it back.');
  }
  doc.names[NAME] = Object.assign({}, before || {}, { to: self });
  const grantSaved = await verb({
    verb: 'fs.save', path: 'app/appFaceApp/grants.json', content: JSON.stringify(doc, null, 2) + '\n',
  });
  if (!good(grantSaved)) die('could not write grants.json (' + grantSaved.status + ' ' + grantSaved.text + ')');
  ok('"' + NAME + '" -> your node' + (before ? ' (it already was; kept)' : ''));

  say('done. Test from anywhere:');
  console.log('    curl -sS https://' + NAME + '.' + FACE_DOMAIN + '/');
  console.log('    expect 501 last-leg-not-built naming your key: the route reached you and came back.');
}());
