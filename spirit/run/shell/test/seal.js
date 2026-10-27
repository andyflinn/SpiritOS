'use strict';

// spirit/run/shell/test/seal.js
// The tests of shell/seal.js, and of no other module (spec: ./seal.md; goal/G41.3). The browser seal runs in node on
// node's own WebCrypto, held against the node's seal (spirit/seal.js): what one seals the other opens.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));

const FILE = path.join(__dirname, '..', 'seal.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }

test.startTest('seal.js: the node\'s seal, in the browser');

(async function () {
  test.subHeading('where it lives');
  ok(!fs.existsSync(path.join(RUN, 'face', 'seal.js')), 'face/seal.js is gone', 'face/seal.js is still there');
  if (!fs.existsSync(FILE)) { test.fail('shell/seal.js is not there'); return; }
  const win = { crypto: globalThis.crypto, TextEncoder: TextEncoder, TextDecoder: TextDecoder, btoa: btoa, atob: atob, Uint8Array: Uint8Array, Promise: Promise, JSON: JSON, Buffer: Buffer };
  win.window = win;
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), vm.createContext(win), { filename: FILE });
  const S = win.spirit && win.spirit.seal;
  ok(S && ['supported', 'newKey', 'seal', 'open'].every(function (f) { return typeof S[f] === 'function'; }), 'it loads on spirit.seal with supported, newKey, seal and open',
    'spirit.seal: ' + (S ? Object.keys(S).join(',') : 'none'));
  if (!S) return;
  ok(await S.supported() === true, 'supported() is true where WebCrypto has X25519', 'supported() is not true in node');

  test.subHeading('what one seals the other opens');
  const node = require(path.join(RUN, 'spirit', 'seal.js'));
  const pair = crypto.generateKeyPairSync('x25519');
  const nodePub = pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const nodePriv = pair.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
  const FROM = 'MCowBQYDK2VwAyEAsealTestFromAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
  const TO = 'MCowBQYDK2VwAyEAsealTestToAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
  const sealed = await S.seal(nodePub, FROM, TO, 'from the page');
  const opened = node.open(nodePriv, FROM, TO, sealed);
  const openedText = opened && typeof opened === 'object' ? opened.text : opened;
  ok(sealed && sealed.sealed === 1 && openedText === 'from the page', 'what the page seals to a node\'s key, the node\'s seal opens to the same text',
    'node opened ' + JSON.stringify(opened));
  const mine = await S.newKey();
  const back = node.seal(mine.publicKey, FROM, TO, 'from the node');
  const read = await S.open(mine.privateKey, mine.publicKey, FROM, TO, back);
  ok(read === 'from the node' || (read && read.text === 'from the node'), 'what the node\'s seal seals to the page\'s key, the page opens', 'the page opened ' + JSON.stringify(read));

  test.subHeading('it opens nothing it should not');
  const wrongPair = await S.open(mine.privateKey, mine.publicKey, TO, FROM, back);
  ok(wrongPair === null, 'a different pair (from and to swapped) opens nothing', 'a wrong pair opened ' + JSON.stringify(wrongPair));
  const c = Buffer.from(back.c, 'base64'); c[0] = c[0] ^ 1;
  const changed = await S.open(mine.privateKey, mine.publicKey, FROM, TO, Object.assign({}, back, { c: c.toString('base64') }));
  ok(changed === null, 'one changed byte of the ciphertext opens nothing', 'a changed ciphertext opened ' + JSON.stringify(changed));
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
