'use strict';

// spirit/run/spirit/app/publishData/measure.js
// THE THREE MEASUREMENTS OF THE PLATFORM'S SUMMARY (goal/G47.1, box v170, "#### publishData"), each on lab nodes and a lab
// relay only (the box: "Every value is machine generated, on lab nodes and a lab relay only"), never the node publishData
// was started by, never a live relay:
//   "A SpiritOS node at rest uses <MB> MB of RAM." (a lab node publishData starts, its memory read from the operating
//     system 30 s after start)
//   "A call to a node on its own machine answers in <ms> ms, the slowest in <ms> ms." (100 plain card asks on 127.0.0.1,
//     nothing sealed, nothing relayed; the median and the worst)
//   "A card request through a relay takes <ms> ms, the slowest <ms> ms; sealing and signing take <ms> ms of it." (two lab
//     nodes on a lab relay, 100 card asks; the median and the worst; the seal and signature timed apart, 1000 times, on a
//     packet of the same size)
// And the relay's own memory at rest, which the members figure takes (agentReadme.summaryOf, the relay's own rule).
// No raw numbers leave here: the medians and the worst only (the box: "no iteration of a measurement is published").
// The lab is repo://lab/labNodes.js's (goal/G47.3); no production module loads a test file.
//
//   measure(say) -> { nodeAtRestMB, relayAtRestRss, loop: {median, max}, relayed: {median, max, crypto} }
//   rssOf(pid)   -> that process's resident memory in bytes, 0 when there is no such process
// Its contract and its test: ./test/measure.md and ./test/measure.js.

// The spirit object first, as the global spirit (goal/G40.1).
require('../../script.js');
const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..', '..', '..', '..');
const AT_REST_MS = 30000;
const CALLS = 100;
const CRYPTO_ROUNDS = 1000;
const UP_MS = 60000;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function median(a) { if (!a.length) return 0; const s = a.slice().sort(function (x, y) { return x - y; }); return s[Math.floor(s.length / 2)]; }
function max(a) { return a.length ? Math.max.apply(null, a) : 0; }
function freePort() { return new Promise(function (resolve) { const s = net.createServer(); s.listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { resolve(p); }); }); }); }
async function until(fn, ms) { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch (e) { /* not yet */ } await sleep(250); } return false; }
function stop(child) { return new Promise(function (r) { if (!child || child.exitCode !== null) return r(); child.once('exit', function () { r(); }); try { child.kill(); } catch (e) { r(); } setTimeout(r, 6000); }); }

// One call at a node's door, as its own pages make it.
async function call(base, verb, args) {
  const r = await fetch(base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
  let body = null;
  try { body = await r.json(); } catch (e) { body = null; }
  return { status: r.status, body: body };
}

// A PROCESS'S MEMORY, AS THE OPERATING SYSTEM HOLDS IT: its resident set, in bytes. /proc on Linux, the process list on Windows.
function rssOf(pid) {
  if (process.platform === 'win32') {
    const out = spawnSync('tasklist', ['/FI', 'PID eq ' + pid, '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true }).stdout || '';
    // The last column, its digits grouped as the locale groups them (61'668 K on a Swiss Windows).
    const m = /"([^"]+) K"\s*$/.exec(out.trim());
    return m ? Number(m[1].replace(/[^\d]/g, '')) * 1024 : 0;
  }
  try { const m = /VmRSS:\s+(\d+) kB/.exec(fs.readFileSync('/proc/' + pid + '/status', 'utf8')); return m ? Number(m[1]) * 1024 : 0; } catch (e) { return 0; }
}

// A LAB NODE, its tree reset to the files under test, its node started on a free port until it answers.
async function labNode(lab) {
  const got = await lab.handOut('node');
  const port = await freePort();
  // Its backups stay in its own tree (spirit/state/config.json's spiritHome), as every lab node's do.
  const cfgFile = path.join(got.run, 'spirit', 'state', 'config.json');
  fs.mkdirSync(path.dirname(cfgFile), { recursive: true });
  fs.writeFileSync(cfgFile, JSON.stringify({ spiritHome: path.join(got.root, '.spiritHome') }));
  const child = spawn(process.execPath, ['spirit/server/script.js', '--port', String(port)], { cwd: got.run, stdio: 'ignore', windowsHide: true });
  got.started(child.pid);
  const base = 'http://127.0.0.1:' + port;
  const up = await until(function () { return call(base, 'api', {}).then(function (r) { return r.status === 200; }); }, UP_MS);
  if (!up) { await stop(child); got.release(); throw new Error('a lab node did not come up'); }
  const card = (await call(base, 'node.card', {})).body || {};
  return { lab: got, child: child, base: base, key: String(card.publicKey || ''),
    release: async function () { await stop(child); got.release(); } };
}

// A LAB RELAY, its owner the node named, relayServer.js started on a free port until it answers.
async function labRelay(lab, ownerKey) {
  const got = await lab.handOut('relay');
  const auth = spirit.requireScript('spirit/relayAuth/script.js');
  auth.writeOwner(got.run, ownerKey);
  const port = await freePort();
  const child = spawn(process.execPath, ['spirit/server/relay/script.js'], { cwd: got.run, stdio: 'ignore', windowsHide: true, env: Object.assign({}, process.env, { PORT: String(port) }) });
  got.started(child.pid);
  const base = 'http://127.0.0.1:' + port;
  const up = await until(function () { return fetch(base + '/').then(function (r) { return r.status > 0; }); }, UP_MS);
  if (!up) { await stop(child); got.release(); throw new Error('the lab relay did not come up'); }
  return { child: child, base: base, key: auth.loadIdentity(got.run).publicKey,
    release: async function () { await stop(child); got.release(); } };
}

// A post through the node's peer.post, the answer read off its reply (as a page reads it): its body, decoded.
async function peerAsk(node, to, app, body, packet) {
  const made = packet.encode(app, body);
  const r = await call(node.base, 'peer.post', { to: to, text: made.text });
  const said = r.body || {};
  const back = typeof said.text === 'string' && said.text ? packet.decode(said.text) : null;
  return { ok: r.status === 200 && said.ok === true, body: back ? back.body : null, card: said.card || null, error: said.error || '' };
}

// SEALING AND SIGNING, TIMED APART: what a card request's two hops seal and sign (the ask and the answer), each the same
// seal and the same signature as the wire's, on packets of the same size, CRYPTO_ROUNDS times; ms per request.
function cryptoShare(askText, answerText) {
  const seal = spirit.requireScript('spirit/seal/script.js');
  const auth = spirit.requireScript('spirit/relayAuth/script.js');
  const a = auth.generateIdentity('a');
  const b = auth.generateIdentity('b');
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < CRYPTO_ROUNDS; i++) {
    seal.seal(b.sealPublicKey, a.publicKey, b.publicKey, askText);
    auth.sign(a.privateKey, auth.receiptMessage('h' + i, askText));
    seal.seal(a.sealPublicKey, b.publicKey, a.publicKey, answerText);
    auth.sign(b.privateKey, auth.receiptMessage('h' + i, answerText));
  }
  return Number(process.hrtime.bigint() - t0) / 1e6 / CRYPTO_ROUNDS;
}

async function measure(say) {
  const tell = typeof say === 'function' ? say : function () {};
  // The lab lies outside the run tree (repo://lab/), where spirit.requireScript does not reach.
  const lab = require(path.join(REPO, 'lab', 'labNodes.js'));
  const held = [];
  try {
    const a = await labNode(lab); held.push(a);
    const packet = spirit.requireScript('spirit/peer/packet/script.js');
    // 1. A NODE AT REST: its memory 30 s after it started.
    tell('a lab node at rest, ' + AT_REST_MS / 1000 + ' s');
    await sleep(AT_REST_MS);
    const nodeAtRestMB = Math.round(rssOf(a.child.pid) / 1048576);
    // 2. A CALL ON ITS OWN MACHINE: plain card asks at its door.
    const loopMs = [];
    for (let i = 0; i < CALLS; i++) {
      const t = process.hrtime.bigint();
      await call(a.base, 'node.card', {});
      loopMs.push(Number(process.hrtime.bigint() - t) / 1e6);
    }
    // 3. A CARD REQUEST THROUGH A RELAY: a second lab node, both seated on a lab relay a owns; a invites b.
    tell('two lab nodes on a lab relay');
    const r = await labRelay(lab, a.key); held.push(r);
    const b = await labNode(lab); held.push(b);
    await sleep(2000);
    const relayAtRestRss = rssOf(r.child.pid);
    const addA = await call(a.base, 'spirit.contact.add', { url: r.base, label: 'lab' });
    const claimA = await call(a.base, 'spirit.contact.claim', { key: (addA.body && addA.body.relayKey) || '', name: 'a' });
    if (claimA.status < 200 || claimA.status >= 300) throw new Error('the lab node could not take its seat: ' + JSON.stringify(claimA.body).slice(0, 200));
    // The seat taken, its stream opens a moment later: the mint is asked until the relay is reached.
    let invite = null;
    await until(function () { return peerAsk(a, r.key, 'relay', { invite: { label: 'b', days: 1 } }, packet).then(function (x) { invite = x; return !!(x.body && x.body.invite && x.body.invite.token); }); }, 20000);
    const token = invite && invite.body && invite.body.invite && invite.body.invite.token;
    if (!token) throw new Error('the lab relay minted no invite: ' + (invite.error || JSON.stringify(invite.body)).slice(0, 200));
    const addB = await call(b.base, 'spirit.contact.add', { url: r.base, label: 'lab' });
    const claimB = await call(b.base, 'spirit.contact.claim', { key: (addB.body && addB.body.relayKey) || '', name: 'b', invite: token, inviteLabel: 'b' });
    if (claimB.status < 200 || claimB.status >= 300) throw new Error('the second lab node could not take its seat: ' + JSON.stringify(claimB.body).slice(0, 200));
    // Both streams open before the first ask is timed: the first ask, which also fetches b's card, is not counted.
    await until(function () { return peerAsk(a, b.key, '', { card: true }, packet).then(function (x) { return x.ok; }); }, 30000);
    const relayedMs = [];
    let askText = '';
    let answerText = '';
    for (let i = 0; i < CALLS; i++) {
      const t = process.hrtime.bigint();
      const got = await peerAsk(a, b.key, '', { card: true }, packet);
      relayedMs.push(Number(process.hrtime.bigint() - t) / 1e6);
      if (!askText) { askText = packet.encode('', { card: true }).text; answerText = JSON.stringify({ v: 1, body: got.body || {} }); }
    }
    const crypto = cryptoShare(askText, answerText);
    return {
      nodeAtRestMB: nodeAtRestMB, relayAtRestRss: relayAtRestRss,
      loop: { median: median(loopMs), max: max(loopMs) },
      relayed: { median: median(relayedMs), max: max(relayedMs), crypto: crypto },
    };
  } finally {
    for (const h of held.reverse()) { try { await h.release(); } catch (e) { /* lab frees it when this process ends */ } }
  }
}

module.exports = { measure: measure, rssOf: rssOf };
