'use strict';

// spirit/run/spirit/test/hubOneDecoder.js
// HUB.JS DECODES NO PACKET ITSELF (goal/G43.23, item 8; spec: ./hubOneDecoder.md). The box: "hub.js decodes packets
// itself, against the one decoder (G16.5)." The one decoder is arrivals.js envelopeOf (spirit/test/oneDecoder.js judges
// it, but only over the top-level files beside hub.js and not hub.js's packet.decode of a relay's answer). hub.js's code
// is read with its comments left out. No node, no port.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const HUB = path.join(RUN, 'spirit', 'hub.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function code(file) {
  return fs.readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, function (m) { return m.replace(/[^\n]/g, ' '); })
    .replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
}

test.startTest('hubOneDecoder.js: hub.js decodes no packet itself; the one decoder does (goal/G43.23 item 8)');

test.subHeading('the world');
const there = fs.existsSync(HUB);
ok(there, 'the world: spirit/hub.js is there', 'spirit/hub.js is not there: nothing judged');
const c = there ? code(HUB) : '';
ok(/\bpacket\.encode\(/.test(c), 'the world: hub.js\'s code, comments left out, still encodes packets (packet.encode), so the read sees code', 'hub.js\'s code holds no packet.encode: the read saw no code, nothing judged');
let envelopeOf = null;
try { envelopeOf = require(path.join(RUN, 'spirit', 'arrivals.js')).envelopeOf; } catch (e) { envelopeOf = null; }
ok(typeof envelopeOf === 'function', 'the world: the one decoder is there, arrivals.js envelopeOf', 'arrivals.js exports no envelopeOf: there is no one decoder to use');

test.subHeading('hub.js decodes no packet');
const offenders = [];
c.split('\n').forEach(function (l, i) {
  // A TextDecoder's decoder.decode is bytes, not a packet.
  const s = l.replace(/\bdecoder\.decode\(/g, '');
  if (/\bpacket\.decode\b|\.decode\s*\(|\bdecode\s*\(/.test(s)) offenders.push('hub.js:' + (i + 1) + ' ' + l.trim().slice(0, 100));
});
ok(!offenders.length, 'hub.js\'s code has no packet.decode, nor any decode of its own', offenders.length + ' decode(s) in hub.js: ' + short(offenders));

test.reportSuccessFailureCount();
process.exit(0);
