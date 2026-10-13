#!/usr/bin/env node
'use strict';

// bash/card-ask.js <relay url>
// ASK A RELAY WHO IT IS, ON ITS ONE DOOR (goal/G22.6) — what bash/status runs.
//
// Andy's decision (goal/G22.6, 2026-10-13): "bash/status, which checked a relay with curl, checks it with a small
// node script that sends the card ask instead." The relay's public GET /api/relay/key is closed; a relay answers a
// signed card ask from a key it does not know (to: "", plain) with its key, on the post itself.
//
// The asking key is made in memory for this one ask and written nowhere. The answer is accepted only when it is the
// relay's reply over the hash this side computed and carries a key statement signed by the key that answered.
// A ban from the relay's address table (429, or 503 busy, with retryAfterMs) is waited out once, never asked through.
//
// Prints the relay's card as JSON and exits 0; exits 1 with the reason when the relay did not answer as a relay;
// 2 on usage.

const path = require('path');
const auth = require(path.join(__dirname, '..', 'spirit', 'run', 'js', 'relayAuth.js'));

const url = String(process.argv[2] || '').trim().replace(/\/+$/, '');
if (!/^https?:\/\/[^\s/]+/.test(url)) {
  console.error('usage: node bash/card-ask.js <relay url>');
  process.exit(2);
}

const TIMEOUT_MS = 8000;
const id = auth.generateIdentity('status');
const text = JSON.stringify({ v: 1, body: { card: true } });
const message = auth.postMessage(id.publicKey, '', text);
const hash = auth.requestHash(message);
const body = JSON.stringify({ from: id.publicKey, to: '', text: text, sig: auth.sign(id.privateKey, message) });

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function ask() {
  const res = await fetch(url + '/api/relay/post', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  let said = null;
  try { said = JSON.parse(await res.text()); } catch (e) { said = null; }
  return { status: res.status, said: said || {} };
}

async function main() {
  let got = await ask();
  const banned = (got.status === 429 || (got.status === 503 && got.said.busy)) && typeof got.said.retryAfterMs === 'number';
  if (banned && got.said.retryAfterMs < 30000) {
    await sleep(got.said.retryAfterMs + 100);
    got = await ask();
  }
  const pkt = got.said;
  if (got.status !== 200 || !pkt.from || !pkt.sig || typeof pkt.text !== 'string') {
    throw new Error('no reply packet (' + got.status + (pkt.error ? ': ' + pkt.error : '') + ')');
  }
  if (!auth.receiptSignatureOk(pkt.from, hash, pkt.text, pkt.sig)) throw new Error('the answer does not verify');
  const card = JSON.parse(pkt.text).body || {};
  if (card.relayPublicKey !== pkt.from ||
      !auth.relayKeySigned(card.relayPublicKey, card.relaySealKey, card.relayLabel, card.keySig)) {
    throw new Error('the answer carries no key statement signed by the key that answered');
  }
  console.log(JSON.stringify(card));
}

main().then(function () { process.exit(0); }, function (e) {
  console.error('card ask to ' + url + ' failed: ' + ((e && e.message) || e));
  process.exit(1);
});
