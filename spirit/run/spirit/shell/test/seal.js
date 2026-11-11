'use strict';

// spirit/run/spirit/shell/test/seal.js
// The tests of spirit/shell/seal.js, and of no other module (spec: ./seal.md; goal/G41.3). The browser seal runs in node on
// node's own WebCrypto, held against the node's seal (spirit/seal.js): what one seals the other opens.
// One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

const FILE = path.join(__dirname, '..', 'seal.js');
const FROM = 'MCowBQYDK2VwAyEAsealTestFromAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
const TO = 'MCowBQYDK2VwAyEAsealTestToAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

// What the tests made, for the tests after them.
const W = {};

// where it lives
test.run('face/seal.js is gone', 0.2, function () {
  return !fs.existsSync(path.join(RUN, 'face', 'seal.js')) || 'face/seal.js is still there';
}, 1000);
test.run('it loads on spirit.seal with supported, newKey, seal and open', 0.2, function () {
  if (!fs.existsSync(FILE)) return 'spirit/shell/seal.js is not there';
  const win = { crypto: globalThis.crypto, TextEncoder: TextEncoder, TextDecoder: TextDecoder, btoa: btoa, atob: atob, Uint8Array: Uint8Array, Promise: Promise, JSON: JSON, Buffer: Buffer };
  win.window = win;
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), vm.createContext(win), { filename: FILE });
  const S = win.spirit && win.spirit.seal;
  W.S = S;
  return S && ['supported', 'newKey', 'seal', 'open'].every(function (f) { return typeof S[f] === 'function'; }) ? true : 'spirit.seal: ' + (S ? Object.keys(S).join(',') : 'none');
}, 1000);
test.run('supported() is true where WebCrypto has X25519', 0.2, async function () {
  if (!W.S) return 'no spirit.seal: it did not load';
  return await W.S.supported() === true || 'supported() is not true in node';
}, 1000);

// what one seals the other opens
test.run('what the page seals to a node\'s key, the node\'s seal opens to the same text', 0.2, async function () {
  if (!W.S) return 'no spirit.seal: it did not load';
  const node = require(path.join(RUN, 'spirit', 'seal.js'));
  W.node = node;
  const pair = crypto.generateKeyPairSync('x25519');
  const nodePub = pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const nodePriv = pair.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
  const sealed = await W.S.seal(nodePub, FROM, TO, 'from the page');
  const opened = node.open(nodePriv, FROM, TO, sealed);
  const openedText = opened && typeof opened === 'object' ? opened.text : opened;
  return sealed && sealed.sealed === 1 && openedText === 'from the page' ? true : 'node opened ' + JSON.stringify(opened);
}, 1000);
test.run('what the node\'s seal seals to the page\'s key, the page opens', 0.2, async function () {
  if (!W.S || !W.node) return 'no seal on either side: the tests before failed';
  W.mine = await W.S.newKey();
  W.back = W.node.seal(W.mine.publicKey, FROM, TO, 'from the node');
  const read = await W.S.open(W.mine.privateKey, W.mine.publicKey, FROM, TO, W.back);
  return read === 'from the node' || (read && read.text === 'from the node') ? true : 'the page opened ' + JSON.stringify(read);
}, 1000);

// it opens nothing it should not
test.run('a different pair (from and to swapped) opens nothing', 0.8, async function () {
  if (!W.back) return 'nothing sealed by the node: the test before failed';
  const wrongPair = await W.S.open(W.mine.privateKey, W.mine.publicKey, TO, FROM, W.back);
  return wrongPair === null ? true : 'a wrong pair opened ' + JSON.stringify(wrongPair);
}, 1000);
test.run('one changed byte of the ciphertext opens nothing', 0.8, async function () {
  if (!W.back) return 'nothing sealed by the node: the test before failed';
  const c = Buffer.from(W.back.c, 'base64'); c[0] = c[0] ^ 1;
  const changed = await W.S.open(W.mine.privateKey, W.mine.publicKey, FROM, TO, Object.assign({}, W.back, { c: c.toString('base64') }));
  return changed === null ? true : 'a changed ciphertext opened ' + JSON.stringify(changed);
}, 1000);
