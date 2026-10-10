'use strict';

// spirit/test/receiptBindsReply.js
// goal/G16.1: the receipt binds the reply text, and a forwarded reply is verified before its route is announced (S1,
// S2 of the review of 2026-10-10), with S7 and the 0011 hash low folded in. Written first, red on today's tree, by
// claude-windows; the build is the other agent's. Andy, 2026-10-10: "flag day. we don't maintain backward compatibility
// before alpha, maybe not even before beta, the data stored in the SpiritOS is never in danger." and "i agree on the
// shape". The review's repro: "receipt verifies with forged text: true".
//
// WHAT IS ASSERTED
//   1. relayAuth.receiptMessage(hash, text, atMs) carries the sha256 of the reply text, so two texts give two messages
//      and the empty text (the bare receipt) has its own; receiptSignatureOk(publicKey, hash, text, sig, atMs) checks
//      the text it is handed.
//   2. A receipt signed for a text verifies with that text and fails with the text swapped (the review's repro).
//   3. relay.js: deliverForwardedReply checks the reply's receipt against its own text before announceRoute, and a
//      reply that fails is answered to the asker as the relay's error, with no route announced (S2).
//   4. relay.js: the onward budget of a forward is the budget this relay granted, never more than the router's ceiling,
//      and a forwarded reply that settles nothing deletes its carrying entry (S7).
//   5. peerPost.js: a reply answered on the post itself settles under the hash the asker computed, not one the wire
//      supplied (decision 0011).
// rule/11: through testSupport only; no node, no ports.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth.js');

const OWED = 'OWED by goal/G16.1: ';
const JS = path.join(__dirname, '..', 'run', 'js');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 200); }
function code(file) {
  return fs.readFileSync(path.join(JS, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/).map(function (l) { return l.replace(/\/\/.*$/, ''); }).join('\n');
}
function fnBody(src, name) {
  const at = src.indexOf('function ' + name + '(');
  if (at === -1) return '';
  let depth = 0, started = false;
  for (let i = src.indexOf('{', at); i < src.length; i++) {
    if (src[i] === '{') { depth++; started = true; }
    else if (src[i] === '}') { depth--; if (started && depth === 0) return src.slice(at, i + 1); }
  }
  return '';
}

test.startTest('goal/G16.1: the receipt binds the reply text; a forwarded reply is verified');

// ── 1 and 2. THE RECEIPT ────────────────────────────────────────────────
test.subHeading('1. the receipt message carries the reply text\'s hash');
const H = crypto.createHash('sha256').update('the request', 'utf8').digest('hex');
const AT = Date.UTC(2026, 9, 11, 12, 0, 0);
const sha = function (t) { return crypto.createHash('sha256').update(String(t), 'utf8').digest('hex'); };
let m1 = '', m2 = '', m0 = '';
try { m1 = auth.receiptMessage(H, 'the answer', AT); m2 = auth.receiptMessage(H, 'a forged answer', AT); m0 = auth.receiptMessage(H, '', AT); } catch (e) { m1 = 'threw ' + e.message; }
if (m1 && m1 !== m2 && m1.indexOf(sha('the answer')) !== -1) test.check('two reply texts give two receipt messages, each carrying its text\'s sha256');
else test.fail(OWED + 'receiptMessage(hash, text, at) gave ' + short(m1) + ' and ' + short(m2));
if (m0 && m0.indexOf(sha('')) !== -1 && m0 !== m1) test.check('the bare receipt (empty text) carries the empty text\'s hash, so it is still a receipt');
else test.fail(OWED + 'the bare receipt gave ' + short(m0));

test.subHeading('2. a receipt verifies with its own text and fails with the text swapped');
{
  const pair = crypto.generateKeyPairSync('ed25519');
  const pub = pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const priv = pair.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
  let sig = '';
  try { sig = auth.sign(priv, auth.receiptMessage(H, 'the answer', AT)); } catch (e) { sig = ''; }
  let ok = false, forged = true;
  try { ok = auth.receiptSignatureOk(pub, H, 'the answer', sig, AT); forged = auth.receiptSignatureOk(pub, H, 'FORGED BY RELAY', sig, AT); } catch (e) { ok = false; }
  if (ok === true) test.check('the receipt verifies with the text it was signed for');
  else test.fail(OWED + 'receiptSignatureOk(pub, hash, text, sig, at) did not verify its own text');
  if (forged === false) test.check('and fails with the text swapped (the review\'s repro, closed)');
  else test.fail(OWED + 'a receipt still verifies with forged text: ' + forged);
}

// ── 3. S2 ───────────────────────────────────────────────────────────────
test.subHeading('3. a forwarded reply is verified before its route is announced');
{
  const relay = code('relay.js');
  const fwd = fnBody(relay, 'deliverForwardedReply');
  const verifyAt = fwd.search(/receiptSignatureOk\(/);
  const announceAt = fwd.indexOf('announceRoute(');
  if (fwd && verifyAt !== -1 && announceAt !== -1 && verifyAt < announceAt && /reply\.text/.test(fwd.slice(verifyAt, announceAt))) test.check('deliverForwardedReply checks the receipt against the reply\'s own text before announceRoute');
  else test.fail(OWED + 'deliverForwardedReply announces a route without checking the receipt against the reply text');
  if (fwd && /relayErrorToAsker\(/.test(fwd.slice(verifyAt === -1 ? 0 : verifyAt, announceAt === -1 ? fwd.length : announceAt))) test.check('a reply that fails is answered to the asker as the relay\'s error');
  else test.fail(OWED + 'a forwarded reply that fails its check is not answered to the asker as the relay\'s error');
}

// ── 4. S7 ───────────────────────────────────────────────────────────────
test.subHeading('4. the onward budget is the granted one; a stray forwarded reply leaves no carrying entry');
{
  const relay = code('relay.js');
  const carry = fnBody(relay, 'carryToPartner');
  const onward = (carry.match(/var onward[\s\S]*?;/) || [''])[0];
  if (/Math\.min\(/.test(onward) && /(DEFAULT_TTL_MS|ttlCeiling|routerTable\.\w*TTL\w*|routes\.ttlMs|ceiling)/i.test(onward)) test.check('the onward budget is the smaller of the asked budget and the router\'s ceiling');
  else test.fail(OWED + 'the onward budget is still the asked budget: ' + short(onward.replace(/\s+/g, ' ')));
  const fwd = fnBody(relay, 'deliverForwardedReply');
  const noMatch = (fwd.match(/if\s*\(\s*!matched\.ok\s*\)\s*\{?[\s\S]*?return false;?/) || [''])[0];
  if (/delete\s+carrying\[/.test(noMatch)) test.check('a forwarded reply that settles nothing deletes its carrying entry');
  else test.fail(OWED + 'a late forwarded reply leaves carrying[innerHash] behind: ' + short(noMatch.replace(/\s+/g, ' ')));
}

// ── 5. 0011 ─────────────────────────────────────────────────────────────
test.subHeading('5. peerPost settles a reply under the hash it computed');
{
  const pp = code('peerPost.js');
  const branch = (pp.match(/if\s*\(body && body\.hash && body\.from && body\.sig && typeof body\.text === 'string'\)\s*\{[\s\S]*?onReply\(\{[\s\S]*?\}\);/) || [''])[0];
  if (branch && /onReply\(\{\s*hash:\s*hash\b/.test(branch)) test.check('a reply answered on the post itself settles under the asker\'s own hash');
  else test.fail(OWED + 'the reply on the post settles under the wire\'s hash: ' + short(branch.replace(/\s+/g, ' ')));
}

test.reportSuccessFailureCount();
