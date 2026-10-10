'use strict';

// spirit/test/oneDecoder.js
// goal/G16.5: one decoder in the node layer, and a guard that sees it (N1, N3, N5 of the review of 2026-10-10).
// Written first, red on today's code, by claude-windows; the build is the other agent's (Andy, 2026-10-11: "THERE
// ARE TWO AGENTS HERE"). Andy's rulings on the item: "Q5: Add it? yes"; on the three inline readers, "yes. we fix
// redundant code now." The rule checked is NODE-AND-RELAY.md's: the node decodes the envelope and nothing inside.
//
// WHAT IS ASSERTED
//   1. THE ONE DECODER: arrivals.js exports envelopeOf(text): for a packet, { app, re, body } read from its envelope
//      (app '' when there is none); for anything that is not a packet, null. arrivals.js is the one node file that
//      reads an envelope.
//   2. THE WITNESSES ARE HANDED IT: a witness's message carries `envelope`, the same reading, so no witness decodes;
//      a page's (subscriber's) message does not (pages keep the text as signed and decode it themselves).
//   3. THE GUARD (replacing nodeKnowsNoApps.js, whose control fails today): in spirit/run/js, kernel.js aside (its
//      decode is the loopback clients' shared one, Andy 2026-10-02), no file but arrivals.js names decode, decorate
//      or isEnvelope in code (a TextDecoder's decoder.decode is bytes, not an envelope); and in peerPost.js, nodeCard.js
//      and answerRelay.js every JSON.parse is of a relay's HTTP answer (res.text, r.text) or the node's own stored row
//      (row.body), never of a packet's text.
//   4. N3: peerPost's refusal reader takes a reply that carries an app as the app's answer, not as a node refusal: its
//      refusal check reads the envelope through envelopeOf and requires no app.
//   5. THE CONTROL the old guard lost: the shell's own decode is found where it now lives (window.spiritPacket), so a
//      green here is about code that exists; nodeKnowsNoApps.js is retired.
// rule/11: through testSupport only; no node, no ports.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const packet = require('../run/js/client/packet.js');

const OWED = 'OWED by goal/G16.5: ';
const JS = path.join(__dirname, '..', 'run', 'js');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 200); }
function code(file) {
  return fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/).map(function (l) { return l.replace(/\/\/.*$/, ''); });
}

test.startTest('goal/G16.5: one decoder in the node layer, and a guard that sees it');

const arrivalsMod = require('../run/js/arrivals.js');

// ── 1. THE ONE DECODER ──────────────────────────────────────────────────
test.subHeading('1. arrivals.js envelopeOf reads an envelope once');
const envelopeOf = arrivalsMod.envelopeOf;
if (typeof envelopeOf !== 'function') test.fail(OWED + 'arrivals.js exports no envelopeOf');
else {
  const appText = packet.encode('api', { x: 1 }, { re: 'H1' }).text;
  const plainText = JSON.stringify({ v: 1, body: { card: true } });
  const e1 = envelopeOf(appText), e2 = envelopeOf(plainText), e3 = envelopeOf('hello, not a packet');
  if (e1 && e1.app === 'api' && e1.re === 'H1' && e1.body && e1.body.x === 1) test.check('an app packet reads as { app, re, body }');
  else test.fail(OWED + 'envelopeOf(app packet) gave ' + short(e1));
  if (e2 && e2.app === '' && e2.body && e2.body.card === true) test.check('a packet with no app reads with app \'\' and its body');
  else test.fail(OWED + 'envelopeOf(app-less packet) gave ' + short(e2));
  if (e3 === null) test.check('text that is not a packet reads as null');
  else test.fail(OWED + 'envelopeOf(junk) gave ' + short(e3));
}

// ── 2. THE WITNESSES ARE HANDED IT ──────────────────────────────────────
test.subHeading('2. a witness gets the envelope; a page does not');
{
  const a = arrivalsMod.createArrivals({ traffic: null });
  let seenWitness = null, seenPage = null;
  a.witness(function (m) { seenWitness = m; });
  a.subscribe(function (m) { seenPage = m; });
  const text = packet.encode('published', { module: 'x' }).text;
  a.note({ item: 1, hash: 'H2', from: 'KEY', text: text, at: 't', relay: '' });
  if (seenWitness && seenWitness.envelope && seenWitness.envelope.app === 'published' && seenWitness.envelope.body && seenWitness.envelope.body.module === 'x') test.check('a witness\'s message carries envelope, read once by arrivals');
  else test.fail(OWED + 'the witness got ' + short(seenWitness && Object.keys(seenWitness)));
  if (seenPage && !('envelope' in seenPage) && seenPage.text === text) test.check('a page\'s message carries the text as signed and no envelope');
  else test.fail('the page got ' + short(seenPage && Object.keys(seenPage)));
}

// ── 3. THE GUARD ────────────────────────────────────────────────────────
test.subHeading('3. nothing in the node layer but arrivals.js reads an envelope');
{
  const offenders = [];
  fs.readdirSync(JS).filter(function (n) { return /\.js$/.test(n) && n !== 'arrivals.js' && n !== 'kernel.js'; }).forEach(function (n) {
    code(path.join(JS, n)).forEach(function (l, i) {
      const s = l.replace(/\bdecoder\.decode\(/g, '');
      if (/\bdecode\s*[:(]|\.decode\b|\bdecorate\b|\bisEnvelope\b/.test(s)) offenders.push(n + ':' + (i + 1) + ' ' + l.trim().slice(0, 80));
    });
  });
  if (!offenders.length) test.check('no node file but arrivals.js names decode, decorate or isEnvelope in code');
  else test.fail(OWED + offenders.length + ' envelope reader(s) outside arrivals.js: ' + offenders.slice(0, 6).join(' | '));
  const allowed = /^JSON\.parse\(\s*(res\.text|r\.text|row\.body)\s*\)/;
  const parses = [];
  ['peerPost.js', 'nodeCard.js', 'answerRelay.js'].forEach(function (n) {
    code(path.join(JS, n)).forEach(function (l, i) {
      const at = l.indexOf('JSON.parse(');
      if (at !== -1 && !allowed.test(l.slice(at))) parses.push(n + ':' + (i + 1) + ' ' + l.trim().slice(0, 80));
    });
  });
  if (!parses.length) test.check('peerPost, nodeCard and answerRelay parse only relay answers and their own rows, never a packet\'s text');
  else test.fail(OWED + parses.length + ' packet parse(s) of their own: ' + parses.join(' | '));
}

// ── 4. N3 ───────────────────────────────────────────────────────────────
test.subHeading('4. peerPost\'s refusal reader leaves an app\'s answer alone');
{
  const src = code(path.join(JS, 'peerPost.js')).join('\n');
  const body = (src.split('function refusalIn')[1] || '').split(/\n    function /)[0];
  if (body && /envelopeOf\(/.test(body) && /\.app\b/.test(body)) test.check('refusalIn reads the reply through envelopeOf and refuses to read a refusal into a reply that carries an app');
  else test.fail(OWED + 'refusalIn still parses the reply itself or never looks at its app');
}

// ── 5. THE CONTROL ──────────────────────────────────────────────────────
test.subHeading('5. the control: the shell\'s own decode is where the guard says it is');
{
  const shell = fs.readFileSync(path.join(JS, 'client', 'shell.js'), 'utf8');
  if (/window\.spiritPacket/.test(shell) && /envelope\.decode\(/.test(shell)) test.check('the shell decodes for itself, through window.spiritPacket');
  else test.fail('the control failed: the shell no longer decodes through window.spiritPacket, so this guard needs a new control');
  if (!fs.existsSync(path.join(__dirname, 'nodeKnowsNoApps.js'))) test.check('nodeKnowsNoApps.js is retired; this file is the guard');
  else test.fail(OWED + 'nodeKnowsNoApps.js still stands beside this guard');
}

test.reportSuccessFailureCount();
