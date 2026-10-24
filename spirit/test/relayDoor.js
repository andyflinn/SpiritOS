'use strict';

// spirit/test/relayDoor.js
// A RELAY'S ONE DOOR, AS A SUITE KNOCKS ON IT (goal/G22.6) — for suites only.
//
// Andy's decision (goal/G22.6, 2026-10-13): the relay's public door — the one
// any curl reached without a key or a signature — is killed: GET
// /api/relay/key, POST /api/relay/claim, GET /api/version and the brochure all
// close. A relay keeps its one door (POST /api/relay/post) and its members'
// stream. A stranger reaches it with a SIGNED post: the card ask (to: "",
// plain, answered with the relay's key) or a claim (sealed to the key it
// learnt). Both are answered on the post itself, as a reply packet the relay
// signs over the hash the asker computed.
//
// Strangers are held by the relay's table of requesting ADDRESSES, ban time
// starting at 1000 ms and doubled for an address that asks again too early.
// Every suite knocks from 127.0.0.1, so every stranger request a suite makes
// goes through here: paced past the first ban, and waiting out any ban the
// relay names (retryAfterMs) instead of asking early and doubling it.
//
//   awaitRelayDoor(base)            readiness: the relay answers a card ask on
//                                   its door (replaces polling /api/version or
//                                   /api/relay/key). Resolves the key
//                                   statement, or null if it never answered.
//   relayKeyOf(base)                the relay's signed key statement, verified
//   keyStatus(base)                 one card ask as { status, text } — 200 and
//                                   the card, or what was met; for polling
//   claimOnDoor(base, id, fields)   a stranger's claim, sealed to the relay's
//                                   key; answers { status, json, text } in the
//                                   shape POST /api/relay/claim answered, so a
//                                   suite reads it as it read that route
//   claimBodyOnDoor(base, id, body) the same with the claim body given whole
//   strangerPost(base, id, to, text)  one signed stranger post, paced and
//                                   retried past a ban; { status, json, text }
//   signedPost(id, to, text)        { body, hash } — no network
//   openAnswer(id, relayKey, packet)  a claim answer opened: its body or null

const auth = require('../run/spirit/relayAuth');
const seal = require('../run/spirit/seal');
const nodeCard = require('../run/spirit/nodeCard');
const openReply = require('./openReply');

// Past the address table's first ban (relay.js, STRANGER_BAN_START_MS = 1000).
const GAP_MS = 1100;
// How long a suite keeps knocking past bans before it calls the door shut.
const PATIENCE_MS = 30000;

const CARD_ASK = JSON.stringify({ v: 1, body: { card: true } });

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// The last stranger request this process sent, per relay. One address, so one
// pace for every stranger identity a suite makes.
const lastAt = Object.create(null);

async function paced(base) {
  const wait = (lastAt[base] || 0) + GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastAt[base] = Date.now();
}

function signedPost(id, to, text) {
  const message = auth.postMessage(id.publicKey, to, text);
  return {
    body: { from: id.publicKey, to: to, text: text, sig: auth.sign(id.privateKey, message) },
    hash: auth.requestHash(message),
  };
}

async function postDoor(base, body, timeoutMs) {
  try {
    const res = await fetch(base + '/api/relay/post', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs || 10000),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) { json = null; }
    return { status: res.status, json: json, text: text };
  } catch (e) {
    return { status: 0, json: null, text: String(e && e.message || e) };
  }
}

// A refusal by the address table: too early (429) or no free slot (503 busy).
function banned(r) {
  return !!(r && r.json && (r.status === 429 || (r.status === 503 && r.json.busy)) &&
    typeof r.json.retryAfterMs === 'number');
}

// One stranger post, paced, and retried only past a ban the relay named.
async function strangerPost(base, id, to, text) {
  const started = Date.now();
  for (;;) {
    await paced(base);
    const r = await postDoor(base, signedPost(id, to, text).body);
    if (!banned(r) || Date.now() - started > PATIENCE_MS) return r;
    await sleep(r.json.retryAfterMs + 50);
    lastAt[base] = Date.now() - GAP_MS;
  }
}

// The relay's key statement off a card ask: verified as the relay's own reply
// (receipt over the hash this side computed) and as a signed key statement.
async function cardAsk(base, id) {
  const asker = id || auth.generateIdentity('door-asker');
  const s = signedPost(asker, '', CARD_ASK);
  const started = Date.now();
  let r = null;
  for (;;) {
    await paced(base);
    r = await postDoor(base, s.body);
    // Nothing reached the relay (not up yet): its table saw nothing, so the
    // pace does not count it.
    if (r.status === 0) lastAt[base] = 0;
    if (!banned(r) || Date.now() - started > PATIENCE_MS) break;
    await sleep(r.json.retryAfterMs + 50);
    lastAt[base] = Date.now() - GAP_MS;
  }
  const pkt = (r && r.json) || {};
  if (r.status !== 200 || !pkt.from || !pkt.sig ||
      !auth.receiptSignatureOk(pkt.from, s.hash, String(pkt.text || ''), pkt.sig)) {
    return { ok: false, status: r.status, text: r.text };
  }
  let said = null;
  try { said = JSON.parse(String(pkt.text || '')).body; } catch (e) { said = null; }
  if (!said || said.relayPublicKey !== pkt.from ||
      !auth.relayKeySigned(said.relayPublicKey, said.relaySealKey, said.relayLabel, said.keySig)) {
    return { ok: false, status: r.status, text: r.text };
  }
  return { ok: true, status: 200, said: said, packet: pkt };
}

async function relayKeyOf(base) {
  const got = await cardAsk(base);
  return got.ok ? got.said : null;
}

// One card ask in the { status, text } shape relayRequest answered, for a
// suite polling a relay until it is up: 200 and the card's JSON when the
// relay answered as a relay, the status it met otherwise (0: nothing there).
// Never rejects.
async function keyStatus(base) {
  const got = await cardAsk(base);
  return got.ok ? { status: 200, text: JSON.stringify(got.said) } : { status: got.status || 0, text: got.text || '' };
}

// Readiness. A connection refused is "not up yet"; any answer from the door
// is the relay up, and only a verified card answer is "ready".
async function awaitRelayDoor(base, tries) {
  const n = tries || 80;
  for (let i = 0; i < n; i += 1) {
    let up = false;
    try {
      const res = await fetch(base + '/api/relay/post', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
        signal: AbortSignal.timeout(2000),
      });
      await res.text();
      up = true;
    } catch (e) { up = false; }
    if (up) {
      const got = await cardAsk(base);
      return got.ok ? got.said : null;
    }
    await sleep(150);
  }
  return null;
}

// The claim's sealed body, opened by the claimer: the relay seals its answer to
// the card the claim carried. openReply.js is the one opener the suites share.
function openAnswer(id, relayKey, pkt) {
  return openReply.openBody(id, relayKey, String((pkt && pkt.text) || ''));
}

// A claim on the door, from a key the relay does not hold (or the owner's, or a
// member's re-claim). `fields`: { name, invite, inviteLabel, card } — card
// defaults to the claimer's own. Answers in the shape the closed route did:
// the peer on success, { error, peer? } otherwise, under the claim's status.
async function claimOnDoor(base, id, fields, known) {
  const f = fields || {};
  const name = f.name == null ? '' : f.name;
  const claim = {
    name: name,
    publicKey: id.publicKey,
    sig: f.sig || auth.sign(id.privateKey, auth.claimMessage(name)),
    card: f.card === undefined ? nodeCard.cardFrom(Object.assign({ name: name }, id)) : f.card,
  };
  if (f.invite) claim.invite = f.invite;
  if (f.inviteLabel) claim.inviteLabel = f.inviteLabel;
  if (f.publicKey) claim.publicKey = f.publicKey;
  return claimBodyOnDoor(base, id, claim, known);
}

// The same, with the claim's body given whole, as a suite builds it: posted by
// `id` (the key that signs the post), sealed to the relay's key.
async function claimBodyOnDoor(base, id, claim, known) {
  // A CLAIM CARRIES THE CLAIMER'S CARD, as every node's does (peerPost.claim):
  // the relay seals its answer to the key on it, and a stranger has no row
  // for it to be read from. A body built without one gets the claimer's own.
  if (claim && claim.card === undefined) {
    claim = Object.assign({}, claim, { card: nodeCard.cardFrom(Object.assign({ name: claim.name || '' }, id)) });
  }
  const key = known || await relayKeyOf(base);
  if (!key) return { status: 0, json: null, text: 'the relay did not answer a card ask' };
  const sealed = JSON.stringify(seal.seal(key.relaySealKey, id.publicKey, key.relayPublicKey,
    JSON.stringify({ v: 1, body: { claim: claim } })));
  const s = signedPost(id, key.relayPublicKey, sealed);
  const started = Date.now();
  let r = null;
  for (;;) {
    await paced(base);
    r = await postDoor(base, s.body);
    if (!banned(r) || Date.now() - started > PATIENCE_MS) break;
    await sleep(r.json.retryAfterMs + 50);
    lastAt[base] = Date.now() - GAP_MS;
  }
  const pkt = (r && r.json) || {};
  if (r.status !== 200 || pkt.from !== key.relayPublicKey ||
      !auth.receiptSignatureOk(pkt.from, s.hash, String(pkt.text || ''), pkt.sig)) {
    return { status: r.status, json: r.json, text: r.text };
  }
  const said = openAnswer(id, key.relayPublicKey, pkt) || {};
  const status = Number(said.status) || (said.ok ? 200 : 500);
  const json = said.ok ? (said.peer || {}) : (said.peer ? { error: said.error, peer: said.peer } : { error: said.error });
  return { status: status, json: json, text: JSON.stringify(json), said: said };
}

module.exports = {
  GAP_MS: GAP_MS,
  CARD_ASK: CARD_ASK,
  signedPost: signedPost,
  postDoor: postDoor,
  strangerPost: strangerPost,
  cardAsk: cardAsk,
  relayKeyOf: relayKeyOf,
  keyStatus: keyStatus,
  awaitRelayDoor: awaitRelayDoor,
  claimOnDoor: claimOnDoor,
  claimBodyOnDoor: claimBodyOnDoor,
  openAnswer: openAnswer,
};
