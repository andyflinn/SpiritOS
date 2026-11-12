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
const HUB = path.join(RUN, 'spirit', 'hub.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function code(file) {
  return fs.readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, function (m) { return m.replace(/[^\n]/g, ' '); })
    .replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
}

// The world.
const W = {};
test.run('the world: spirit/hub.js is there', 0.2, function () {
  W.there = fs.existsSync(HUB);
  W.c = W.there ? code(HUB) : '';
  return W.there || 'spirit/hub.js is not there: nothing judged';
}, test.limit.quick);
test.run('the world: hub.js\'s code, comments left out, still encodes packets (packet.encode), so the read sees code', 0.2, function () {
  return !!/\bpacket\.encode\(/.test(W.c || '') || 'hub.js\'s code holds no packet.encode: the read saw no code, nothing judged';
}, test.limit.quick);
test.run('the world: the one decoder is there, arrivals.js envelopeOf', 0.2, function () {
  let envelopeOf = null;
  try { envelopeOf = require(path.join(RUN, 'spirit', 'arrivals.js')).envelopeOf; } catch (e) { envelopeOf = null; }
  return typeof envelopeOf === 'function' || 'arrivals.js exports no envelopeOf: there is no one decoder to use';
}, test.limit.quick);

// hub.js decodes no packet.
test.run('hub.js\'s code has no packet.decode, nor any decode of its own', 0.2, function () {
  if (!W.there) return 'spirit/hub.js is not there: the world failed';
  const offenders = [];
  W.c.split('\n').forEach(function (l, i) {
    // A TextDecoder's decoder.decode is bytes, not a packet.
    const s = l.replace(/\bdecoder\.decode\(/g, '');
    if (/\bpacket\.decode\b|\.decode\s*\(|\bdecode\s*\(/.test(s)) offenders.push('hub.js:' + (i + 1) + ' ' + l.trim().slice(0, 100));
  });
  return !offenders.length || offenders.length + ' decode(s) in hub.js: ' + short(offenders);
}, test.limit.quick);

// THE ROUTE CACHING GOES (goal/G47.1, box v69; Andy: "We can probably shut down the \"route-caching\" crap"): "A post
// carries no hints: the node sends none". chooseRoute answers where a post goes: a peer the node once heard a route for
// (planted in node.db while the store still takes one), named by no relay, goes to the first relay held, with no hints.
const PEER_KEY = 'MCowBQYDK2VwAyEAROUTEROUTEROUTEROUTEROUTEROUTEROUTEROUTEROU=';
let chosen = null;
test.run('the world: a scratch node that once heard a route for a peer; chooseRoute asked for that peer, one relay held', 0.2, function () {
  const os = require('os');
  W.routeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-hub-route-'));
  fs.mkdirSync(path.join(W.routeHome, 'spirit', 'state'), { recursive: true });
  try {
    const store = require(path.join(RUN, 'spirit', 'nodeStore.js')).open(W.routeHome);
    // Planted only while the store still takes a route: after this cycle there is nothing to plant.
    if (store.seen && typeof store.seen.putRoute === 'function') store.seen.putRoute(PEER_KEY, { via: '', at: 'https://heard.example', url: 'https://heard.example', rank: 1, told: Date.now() });
    const hub = require(HUB).createHub(W.routeHome);
    chosen = hub.chooseRoute({ relaysNaming: function () { return []; }, relaysHeld: function () { return ['https://held.example']; } }, PEER_KEY);
  } catch (e) { return 'chooseRoute could not be asked: ' + (e && e.message); }
  return (!!chosen && chosen.relayUrl === 'https://held.example') || 'chooseRoute answered ' + short(chosen);
}, test.limit.quick);
test.run('a post carries no hints: chooseRoute answers none for a peer whose route the node once heard', 0.2, function () {
  if (!chosen) return 'chooseRoute was not asked: the world failed';
  return chosen.hints === undefined || 'chooseRoute answers the hints ' + short(chosen.hints);
}, test.limit.quick);
test.after(function () { try { if (W.routeHome) fs.rmSync(W.routeHome, { recursive: true, force: true }); } catch (e) { /* scratch */ } });
