'use strict';

// spirit/run/spirit/test/hub.js
// HUB.JS DECODES NO PACKET ITSELF (goal/G43.23, item 8; spec: ./hub.md). The box: "hub.js decodes packets
// itself, against the one decoder (G16.5)." The one decoder is arrivals.js envelopeOf (spirit/test/oneDecoder.js judges
// it, but only over the top-level files beside hub.js and not hub.js's packet.decode of a relay's answer). hub.js's code
// is read with its comments left out. No node, no port.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
// The spirit object first: the reporter loads it for its reports and puts the global back as it found it, so a module
// that reads the global spirit (arrivals.js) finds it only when the suite loaded it before the reporter.
require(path.join(RUN, 'spirit', 'spirit.js'));
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
// ITS TEMP FOLDERS FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"): one of its own for each
// it asks, under its suite's path, the whole of it removed when the suite ends.
const tempFolder = require('../tempFolder.js');
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/test/hub/' + name + tempAsked); }
// THE DATABASES IT OPENS ARE CLOSED BEFORE ITS TEMP FOLDER GOES (goal/G47.1, no pollution; testicle's "it leaves no temp
// folder behind", red on Andy's node 2026-11-18): Windows deletes no open file, so a database still open kept the folder.
// Every DatabaseSync opened from here on, by the test or by what it requires, is recorded and closed first.
const OPEN_DBS = [];
{
  const sqlite = require('node:sqlite');
  const RealDb = sqlite.DatabaseSync;
  sqlite.DatabaseSync = class extends RealDb { constructor() { super(...arguments); OPEN_DBS.push(this); } };
}
test.after(function () {
  OPEN_DBS.forEach(function (d) { try { d.close(); } catch (e) { /* closed */ } });
  try { fs.rmSync(tempFolder.path('spirit/test/hub'), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ }
});
const HUB = path.join(RUN, 'spirit', 'hub.js');

function code(file) {
  return fs.readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, function (m) { return m.replace(/[^\n]/g, ' '); })
    .replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
}

// The world.
const W = {};
test.run('spirit/hub.js is there', 0.2, function () {
  W.there = fs.existsSync(HUB);
  W.c = W.there ? code(HUB) : '';
  return W.there || false;
}, test.limit.quick);
test.run('hub.js\'s code, with its comments left out, still encodes packets with packet.encode, so the read sees code', 0.2, function () {
  return !!/\bpacket\.encode\(/.test(W.c || '') || false;
}, test.limit.quick);
test.run('the one decoder, arrivals.js envelopeOf, is there', 0.2, function () {
  let envelopeOf = null;
  try { envelopeOf = require(path.join(RUN, 'spirit', 'arrivals.js')).envelopeOf; } catch (e) { envelopeOf = null; }
  return typeof envelopeOf === 'function' || false;
}, test.limit.quick);

// hub.js decodes no packet.
test.run('hub.js\'s code has no packet.decode, nor any decode of its own', 0.2, function () {
  if (!W.there) return false;
  let offenders = 0;
  W.c.split('\n').forEach(function (l) {
    // A TextDecoder's decoder.decode is bytes, not a packet.
    const s = l.replace(/\bdecoder\.decode\(/g, '');
    if (/\bpacket\.decode\b|\.decode\s*\(|\bdecode\s*\(/.test(s)) offenders++;
  });
  return !offenders || false;
}, test.limit.quick);

// THE ROUTE CACHING GOES (goal/G47.1, box v69; Andy: "We can probably shut down the \"route-caching\" crap"): "A post
// carries no hints: the node sends none". chooseRoute answers where a post goes: a peer the node once heard a route for
// (planted in node.db while the store still takes one), named by no relay, goes to the first relay held, with no hints.
const PEER_KEY = 'MCowBQYDK2VwAyEAROUTEROUTEROUTEROUTEROUTEROUTEROUTEROUTEROU=';
let chosen = null;
test.run('on a scratch node that once heard a route for a peer, chooseRoute asked for that peer with one relay held sends the post to that relay', 0.2, function () {
  const os = require('os');
  W.routeHome = ownTemp('spirit-hub-route-');
  fs.mkdirSync(path.join(W.routeHome, 'spirit', 'state'), { recursive: true });
  try {
    const store = require(path.join(RUN, 'spirit', 'nodeStore.js')).open(W.routeHome);
    // Planted only while the store still takes a route: after this cycle there is nothing to plant.
    if (store.seen && typeof store.seen.putRoute === 'function') store.seen.putRoute(PEER_KEY, { via: '', at: 'https://heard.example', url: 'https://heard.example', rank: 1, told: Date.now() });
    const hub = require(HUB).createHub(W.routeHome);
    chosen = hub.chooseRoute({ relaysNaming: function () { return []; }, relaysHeld: function () { return ['https://held.example']; } }, PEER_KEY);
  } catch (e) { return false; }
  return (!!chosen && chosen.relayUrl === 'https://held.example') || false;
}, test.limit.quick);
test.run('a post carries no hints: chooseRoute answers none for a peer whose route the node once heard', 0.2, function () {
  if (!chosen) return false;
  return chosen.hints === undefined || false;
}, test.limit.quick);
test.after(function () { try { if (W.routeHome) fs.rmSync(W.routeHome, { recursive: true, force: true }); } catch (e) { /* scratch */ } });

// FORGETTING A CONTACT REVOKES ALL ITS GRANTS (goal/G47.4, Q3; Andy: "When you forget a contact, should the node revoke all
// of its grants at once?" "yes. it should."). On a scratch node with an identity of its own, a kept contact holding two
// grants is forgotten through the hub's forget, as the node's verb asks it; then the node's grants table holds none of
// that key's, and another key's grant stands.
const FORGOT_KEY = 'MCowBQYDK2VwAyEAFORGETFORGETFORGETFORGETFORGETFORGETFORGET=';
const KEPT_KEY = 'MCowBQYDK2VwAyEAKEPTKEPTKEPTKEPTKEPTKEPTKEPTKEPTKEPTKEPTKE=';
test.run('on a scratch node, forgetting a contact answers 200, forgotten', 0.2, async function () {
  try {
    W.forgetHome = ownTemp('forget');
    fs.mkdirSync(path.join(W.forgetHome, 'spirit', 'state'), { recursive: true });
    const relayAuth = require(path.join(RUN, 'spirit', 'relayAuth.js'));
    relayAuth.saveIdentity(W.forgetHome, relayAuth.generateIdentity());
    const book = require(path.join(RUN, 'spirit', 'contacts.js'));
    book.noteLabel(W.forgetHome, FORGOT_KEY, 'Gone');
    book.accept(W.forgetHome, FORGOT_KEY);
    W.store = require(path.join(RUN, 'spirit', 'nodeStore.js')).open(W.forgetHome).auth;
    W.store.grant(FORGOT_KEY, 'desk.chat', 'Gone');
    W.store.grant(FORGOT_KEY, 'jobs.list', 'Gone');
    W.store.grant(KEPT_KEY, 'desk.chat', 'Kept');
    const hub = require(HUB).createHub(W.forgetHome);
    W.answer = await new Promise(function (resolve) {
      const res = { status: 0, body: '', writeHead: function (s) { res.status = s; }, setHeader: function () {}, end: function (b) { res.body = String(b || ''); resolve(res); } };
      hub.handlePeer({}, res, function () { return Promise.resolve({ publicKey: FORGOT_KEY }); }, 'forget');
      setTimeout(function () { resolve(res); }, 2000);
    });
  } catch (e) { return false; }
  let body = null; try { body = JSON.parse(W.answer.body); } catch (e) { body = null; }
  return (W.answer.status === 200 && !!body && body.forgotten === true) || false;
}, test.limit.quick);
test.run('forgetting a contact revokes every grant of its key', 0.2, function () {
  if (!W.store) return false;
  return W.store.paths(FORGOT_KEY).length === 0 || false;
}, test.limit.quick);
test.run('forgetting a contact leaves another key\'s grants', 0.2, function () {
  if (!W.store) return false;
  return JSON.stringify(W.store.paths(KEPT_KEY)) === '["desk.chat"]' || false;
}, test.limit.quick);

// A STAR ON A NODE ONLY WHEN THE NODE SAYS IT IS OURS (goal/G47.4; Andy: "can we please only allow stars on nodes that say
// we own them??? with relays I'll accept the ambiguity...", "can we please only allow stars for nodes, only when they're
// actually owned? now."). A node's card is signed by that node and names its owner (spirit/nodeCard.js, owner). On a
// scratch node: a node whose card names this node is starred; one whose card names nobody, or another key, is refused;
// a star always comes off.
const ownCardOf = function (id, owner) {
  const fields = { name: 'a node', description: 'd', publicKey: id.publicKey, sealKey: id.sealPublicKey || 'SEAL', at: 1, owner: owner };
  return JSON.stringify({ v: 1, body: Object.assign({ ok: true }, fields, { sig: require(path.join(RUN, 'spirit', 'relayAuth.js')).sign(id.privateKey, require(path.join(RUN, 'spirit', 'nodeCard.js')).signable(fields)) }) });
};
const ownAsk = function (key, own) {
  return new Promise(function (resolve) {
    const res = { status: 0, body: '', writeHead: function (s) { res.status = s; }, setHeader: function () {}, end: function (b) { res.body = String(b || ''); resolve(res); } };
    W.ownHub.handleOwn({}, res, function () { return Promise.resolve({ key: key, own: own }); });
    setTimeout(function () { resolve(res); }, 2000);
  });
};
test.run('on a scratch node, a node whose card names this node its owner takes the star', 0.2, async function () {
  try {
    W.ownHome = ownTemp('own');
    fs.mkdirSync(path.join(W.ownHome, 'spirit', 'state'), { recursive: true });
    const relayAuth = require(path.join(RUN, 'spirit', 'relayAuth.js'));
    const me = relayAuth.generateIdentity();
    relayAuth.saveIdentity(W.ownHome, me);
    const book = require(path.join(RUN, 'spirit', 'contacts.js'));
    W.ours = relayAuth.generateIdentity(); W.free = relayAuth.generateIdentity(); W.theirs = relayAuth.generateIdentity();
    const someoneElse = relayAuth.generateIdentity().publicKey;
    const planted = [book.setCard(W.ownHome, W.ours.publicKey, ownCardOf(W.ours, me.publicKey)),
      book.setCard(W.ownHome, W.free.publicKey, ownCardOf(W.free, '')),
      book.setCard(W.ownHome, W.theirs.publicKey, ownCardOf(W.theirs, someoneElse))];
    if (!planted.every(function (p) { return p && p.ok; })) return false;
    W.ownHub = require(HUB).createHub(W.ownHome);
    const a = await ownAsk(W.ours.publicKey, true);
    let body = null; try { body = JSON.parse(a.body); } catch (e) { body = null; }
    return (a.status === 200 && !!body && body.own === true) || false;
  } catch (e) { return false; }
}, test.limit.quick);
test.run('a node whose card names no owner is refused the star', 0.2, async function () {
  if (!W.ownHub) return false;
  const a = await ownAsk(W.free.publicKey, true);
  return (a.status >= 400 && a.status < 500) || false;
}, test.limit.quick);
test.run('a node whose card names another owner is refused the star', 0.2, async function () {
  if (!W.ownHub) return false;
  const a = await ownAsk(W.theirs.publicKey, true);
  return (a.status >= 400 && a.status < 500) || false;
}, test.limit.quick);
test.run('a star always comes off', 0.2, async function () {
  if (!W.ownHub) return false;
  const off = await ownAsk(W.ours.publicKey, false);
  const offFree = await ownAsk(W.free.publicKey, false);
  return (off.status === 200 && offFree.status === 200) || false;
}, test.limit.quick);
