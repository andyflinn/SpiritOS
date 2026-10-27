'use strict';

// spirit/test/faceKeys.js
// goal/G30.10, two fixes found on spirit-3 (Andy: "ok. go fix those things..."). The box:
//   - The face learns the home node's keys (its public key and seal key) from faceHome itself, by a face request
//     answered before the door; node.card is not changed.
//   - The face shell offers spirit.shell.factRow, the old shell's fact row, so Relay Details and Contact draw in the face.
// What went wrong: the face read the seal key from node.card, which never carried one, so every face ran unsealed and
// said its browser could not seal; faceSealed.js passed because its node.card was a stand-in that had the key. Here the
// node is a real planted identity and nothing answers in its place.
// NAMED HERE where the box names none:
//   - A face request { keys: 1 } is answered by faceHome with { publicKey, sealKey } from the node's own identity,
//     without reaching the door (nodeDoor.call is not asked).
// rule/11: through testSupport only; its own scratch folders.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { PassThrough } = require('stream');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G30.10: ';
const RUN = path.join(__dirname, '..', 'run');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const code = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'); } catch (e) { return ''; } };
function settle() { return new Promise(function (r) { setTimeout(r, 30); }); }

test.startTest('goal/G30.10: the face learns the home node\'s keys from faceHome, and has factRow');

const auth = require('../run/spirit/relayAuth');
const plant = require('./plantIdentity.js');
const faceSeal = require('../run/shell/seal.js');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'g3010k-'));
plant.ensureAt(home, 'bert');
const me = auth.loadIdentity(home);

// What the home node uploads, captured: the head from the headers, the body as written.
const answers = {};
function upload(url, p, headers) {
  const pt = new PassThrough();
  const id = decodeURIComponent((/\?id=(.+)$/.exec(p) || [])[1] || '');
  const a = answers[id] = { status: Number(headers['x-spirit-status']), type: headers['x-spirit-type'], text: '' };
  pt.on('data', function (c) { a.text += c.toString('utf8'); });
  return pt;
}
const asked = [];
const node = require('../run/spirit/faceHome').createFaceHome({
  call: function (verb, body) { asked.push(verb); return Promise.resolve({ ok: true, status: 200, body: { verb: verb, name: 'bert' } }); },
  serveFile: function () {},
  upload: upload,
  identity: function () { return auth.loadIdentity(home); },
  relayKey: function () { return 'RELAY'; },
  jobs: null,
});

const done = (async function () {
  test.subHeading('1. the keys come from faceHome, from the node\'s own identity');
  let keys = null;
  try { node.request('https://relay.example', { id: 'k1', request: { keys: 1 } }); await settle(); keys = JSON.parse((answers.k1 || {}).text || 'null'); } catch (e) { keys = { threw: e.message }; }
  if (keys && keys.publicKey === me.publicKey && keys.sealKey === me.sealPublicKey && me.sealPublicKey && asked.length === 0)
    test.check('{ keys: 1 } is answered with the node\'s public key and seal key, before the door');
  else test.fail(OWED + 'the keys request got ' + short(keys) + ', the door was asked ' + short(asked));

  let sealedOk = null;
  try {
    const k = await faceSeal.newKey();
    const req = await faceSeal.seal(keys.sealKey, k.publicKey, keys.publicKey, JSON.stringify({ verb: 'node.card' }));
    node.request('https://relay.example', { id: 'k2', request: Object.assign({ k: k.publicKey }, req) });
    await settle();
    const first = String((answers.k2 || {}).text || '').split('\n').filter(Boolean)[0];
    const head = first ? await faceSeal.open(k.privateKey, k.publicKey, keys.publicKey, k.publicKey, first) : null;
    sealedOk = { head: head && JSON.parse(head.text), asked: asked.slice() };
  } catch (e) { sealedOk = { threw: e.message }; }
  if (sealedOk && sealedOk.head && sealedOk.head.status === 200 && sealedOk.asked.indexOf('node.card') !== -1)
    test.check('a request sealed to that key opens on the real node and comes back sealed');
  else test.fail(OWED + 'a request sealed to the answered key got ' + short(sealedOk));

  test.subHeading('2. the face shell asks for the keys, and offers factRow');
  const shell = code('shell/boot.js');
  if (/call\(\{\s*keys:\s*1\s*\}\)/.test(shell) && !/r\.body\.sealKey/.test(shell) && /factRow/.test(shell) && /fact-row/.test(shell))
    test.check('the face shell takes the keys from { keys: 1 }, not node.card, and its spirit.shell has the old shell\'s factRow');
  else test.fail(OWED + 'the face shell still reads the seal key from node.card, or has no factRow');
}());

done.then(function () {
  try { fs.rmSync(home, { recursive: true, force: true }); } catch (e) { /* busy */ }
  test.reportSuccessFailureCount();
  process.exit(0);
}, function (e) { test.fail('the suite threw ' + e.message); test.reportSuccessFailureCount(); process.exit(0); });
