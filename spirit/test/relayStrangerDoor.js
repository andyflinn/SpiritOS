'use strict';

// spirit/test/relayStrangerDoor.js
// goal/G22.6: A RELAY ANSWERS A STRANGER ON ITS ONE DOOR, FOR ITS PUBLIC SERVICES ONLY.
//
// Andy's decisions (goal/G22.6 box, 2026-10-13), held here as behaviour:
//   - The relay's one door accepts a signed request from a key it does not know, for its public services only (its
//     key, a claim), answers it like any reply, and is held to the address table; so a node reaches a relay only
//     through peerPost.
//   - The door first looks at packets addressed to the relay itself: one from an unknown key is read and answered if
//     it is the card ask (answered with the relay's key) or a claim, and refused otherwise.
//   - One plaintext exception stays, the card ask; there is no separate key request.
//   - The public door any curl reached is killed: /api/relay/key, /api/relay/claim, /api/version and the brochure.
//   - Partnering as a permission goes: a relay carries posts to its members from any relay, the member's one slot in
//     flight counted per sender (M5 of the October 10 review); the partner roll and the partner budget are removed.
//   - Strangers are held by one table of requesting addresses, as many entries as the relay has members: ban time
//     starting at 1000 ms, doubled for an address that asks again before it is over; a new address takes the first
//     expired slot; an address back after its ban starts again at 1 s; an IPv6 address is counted by its /64. It
//     replaces the per-address claim limit. Added 2026-10-14: the first request from an unknown address is
//     answered and puts the address into the table; with the table full and nothing expired it is rejected "busy".
//   - A stranger addresses the relay itself with an empty target (to: ""); its post has the same size limit as any.
//   - The claim keeps its inner signature.
//
// HARD LIMITS this suite keeps: relays in scratch folders under the OS temp dir, on ports the OS hands out, and the
// one child process it spawned is the only one it stops.

const os = require('os');
const fs = require('fs');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const auth = require('../run/spirit/relayAuth');
const seal = require('../run/spirit/seal');
const nodeCard = require('../run/spirit/nodeCard');
const routerTable = require('../run/spirit/router');
const { ownHome, claimOwner } = require('./ownerClaim');
const plantRun = require('./plantRun');
const rollOf = require('./rollOf');
const door = require('./relayDoor');
const { createRelay } = require('../run/spirit/relay');

let child = null;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function freePort() {
  return new Promise(function (resolve) {
    const s = net.createServer().listen(0, '127.0.0.1', function () {
      const p = s.address().port;
      s.close(function () { resolve(p); });
    });
  });
}

function short(r) {
  return (r && r.status) + ' ' + String((r && (r.text || JSON.stringify(r.json || r))) || '').slice(0, 160);
}

function claimIn(box, owner, label) {
  const id = auth.generateIdentity(label);
  const m = box.mint(owner.label || 'andy', label, 7, '');
  box.claim(label, auth.sign(id.privateKey, auth.claimMessage(label)), id.publicKey, '', m.invite.token, label,
    nodeCard.cardFrom(Object.assign({ name: label }, id)));
  return id;
}

function settleWithin(held, ms) {
  return Promise.race([held, sleep(ms).then(function () { return { timedOut: true }; })]);
}

test.startTest('Relay stranger door (goal/G22.6) — the card ask and the claim on the one door');

// ════════════════════════════════════════════════════════════════════════
// IN PROCESS: the address table, the stranger's post to a member, the slot per sender, partnering gone
// ════════════════════════════════════════════════════════════════════════

async function inProcess() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-stranger-box-'));
  const relayId = auth.generateIdentity('relay');
  auth.saveIdentity(home, relayId);
  const owner = auth.generateIdentity('andy');
  owner.label = 'andy';
  ownHome(home, owner);
  let T = 1000000;
  const box = createRelay(home, { now: function () { return T; } });
  claimOwner(box, owner, 'andy');
  const m1 = claimIn(box, owner, 'mona');
  const m2 = claimIn(box, owner, 'milo');
  const RELAY_KEY = relayId.publicKey;

  function cardAskFrom(id, addr) {
    const s = door.signedPost(id, '', door.CARD_ASK);
    return { r: box.routePost(s.body.from, s.body.to, s.body.text, s.body.sig, undefined, addr), hash: s.hash };
  }

  test.subHeading('In process: a stranger\'s card ask is answered on its own post');

  const st = auth.generateIdentity('stranger');
  const first = cardAskFrom(st, '10.0.0.1');
  let pkt = null;
  if (first.r && first.r.ok && first.r.held && typeof first.r.held.then === 'function') {
    pkt = await settleWithin(first.r.held, 3000);
  }
  if (pkt && pkt.from === RELAY_KEY && auth.receiptSignatureOk(RELAY_KEY, first.hash, String(pkt.text || ''), pkt.sig)) {
    test.check('a card ask from a key the relay does not hold, to: "", is held and answered as a reply packet the relay signed');
  } else {
    test.fail('a stranger\'s card ask was not answered on its post: ' + JSON.stringify(first.r).slice(0, 160) +
      ' / ' + JSON.stringify(pkt).slice(0, 160));
  }

  test.subHeading('In process: the address table holds strangers');

  // Three members (owner, mona, milo): three entries.
  T += 500;
  const early = cardAskFrom(st, '10.0.0.1').r;
  if (early && early.ok === false && early.status === 429 && early.retryAfterMs === 2000) {
    test.check('the same address asking again 500 ms in is refused 429, its ban doubled to 2000 ms');
  } else {
    test.fail('an early repeat from one address: ' + JSON.stringify(early).slice(0, 160));
  }
  T += 1000;
  const again = cardAskFrom(st, '10.0.0.1').r;
  if (again && again.ok === false && again.status === 429 && again.retryAfterMs === 4000) {
    test.check('asking again inside the doubled ban doubles it again: 4000 ms');
  } else {
    test.fail('a second early repeat: ' + JSON.stringify(again).slice(0, 160));
  }
  T += 4100;
  const back = cardAskFrom(st, '10.0.0.1').r;
  T += 500;
  const reset = cardAskFrom(st, '10.0.0.1').r;
  if (back && back.ok === true && reset && reset.ok === false && reset.retryAfterMs === 2000) {
    test.check('after the ban the address is served and starts again at 1 s (an early repeat doubles it to 2 s, not 8 s)');
  } else {
    test.fail('an address back after its ban: ' + JSON.stringify(back).slice(0, 120) + ' then ' + JSON.stringify(reset).slice(0, 120));
  }

  T += 10000;
  const v6a = cardAskFrom(auth.generateIdentity('v6a'), '2001:db8:aa:bb::1').r;
  T += 100;
  const v6b = cardAskFrom(auth.generateIdentity('v6b'), '2001:db8:aa:bb:ffff::9').r;
  const v6c = cardAskFrom(auth.generateIdentity('v6c'), '2001:db8:aa:cc::1').r;
  if (v6a && v6a.ok && v6b && v6b.ok === false && v6b.status === 429 && v6c && v6c.ok) {
    test.check('an IPv6 address is counted by its /64: a second address in the same /64 is early, one in another /64 is not');
  } else {
    test.fail('IPv6 by /64: ' + JSON.stringify([v6a && v6a.status, v6b && v6b.status, v6c && v6c.status]));
  }

  T += 20000;
  const fill = ['10.9.0.1', '10.9.0.2', '10.9.0.3'].map(function (a) {
    return cardAskFrom(auth.generateIdentity('f' + a), a).r;
  });
  // Andy, 2026-10-14 (goal/G22.6 box): the first request from an unknown address is answered and puts the address
  // into the table; when the table is full with nothing expired, it is rejected with "busy".
  const full = cardAskFrom(auth.generateIdentity('f4'), '10.9.0.4').r;
  T += 1001;
  const entered = cardAskFrom(auth.generateIdentity('f4b'), '10.9.0.4').r;
  T += 100;
  const held = cardAskFrom(auth.generateIdentity('f4c'), '10.9.0.4').r;
  if (fill.every(function (r) { return r && r.ok; }) && full && full.ok === false && full.status === 503 &&
      full.busy === true && full.error === 'busy') {
    test.check('as many entries as members: a fourth, new address finds no slot free or expired and is refused "busy"');
  } else {
    test.fail('a new address at a full table: ' + JSON.stringify(fill.map(function (r) { return r && r.status; })) +
      ' then ' + JSON.stringify(full).slice(0, 120));
  }
  if (entered && entered.ok === true && held && held.ok === false && held.status === 429) {
    test.check('once a slot expires the address takes it, and from then on is held to its ban');
  } else {
    test.fail('an address entered at an expired slot: ' + JSON.stringify(entered).slice(0, 120) + ' then ' +
      JSON.stringify(held).slice(0, 120));
  }

  test.subHeading('In process: a stranger reaches a member, and the member\'s slot is counted per sender');

  const heard = [];
  box.streamOpen(m1.publicKey, auth.sign(m1.privateKey, auth.streamMessage(m1.publicKey, RELAY_KEY)), {
    write: function (s) { heard.push(String(s)); return true; },
    close: function () {},
  });
  T += 60000;
  function postFrom(id, toKey, addr, words) {
    const sealed = JSON.stringify(seal.seal(m1.sealPublicKey, id.publicKey, toKey, words));
    const s = door.signedPost(id, toKey, sealed);
    return { r: box.routePost(s.body.from, s.body.to, s.body.text, s.body.sig, undefined, addr), hash: s.hash };
  }
  const s1 = auth.generateIdentity('s1');
  const s2 = auth.generateIdentity('s2');
  const one = postFrom(s1, m1.publicKey, '10.5.0.1', 'hello from s1');
  const two = postFrom(s2, m1.publicKey, '10.5.0.2', 'hello from s2');
  const reached = heard.join('').indexOf('event: request') !== -1;
  if (one.r && one.r.ok && one.r.held && reached) {
    test.check('a stranger\'s post to a member is carried to the member, and held for the answer on the stranger\'s own post');
  } else {
    test.fail('a stranger\'s post to a member: ' + JSON.stringify(one.r).slice(0, 160) + ' (member heard a request: ' + reached + ')');
  }
  if (two.r && two.r.ok) {
    test.check('a second stranger posting to the same member while the first waits is not refused busy');
  } else {
    test.fail('a second sender to a member with one request in flight: ' + JSON.stringify(two.r).slice(0, 160));
  }
  const mm = postFrom(m2, m1.publicKey, '', 'hello from milo');
  if (mm.r && mm.r.ok) {
    test.check('nor is a member posting to that member while both strangers wait');
  } else {
    test.fail('a member to a member with strangers in flight: ' + JSON.stringify(mm.r).slice(0, 160));
  }
  const replyText = 'thanks s1';
  const replied = box.routeReply(m1.publicKey, one.hash, replyText,
    auth.sign(m1.privateKey, auth.receiptMessage(one.hash, replyText)));
  const answered = one.r && one.r.held ? await settleWithin(one.r.held, 3000) : null;
  if (replied && replied.ok && answered && answered.from === m1.publicKey && answered.text === replyText &&
      auth.receiptSignatureOk(m1.publicKey, one.hash, answered.text, answered.sig)) {
    test.check('the member\'s reply settles the stranger\'s post with the member\'s own signed receipt');
  } else {
    test.fail('the member\'s reply to a stranger: ' + JSON.stringify(replied).slice(0, 100) + ' / ' + JSON.stringify(answered).slice(0, 160));
  }
  T += 60000;
  const nowhere = postFrom(auth.generateIdentity('s3'), auth.generateIdentity('nobody').publicKey, '10.5.0.3', 'x');
  if (nowhere.r && nowhere.r.ok === false && nowhere.r.status === 403) {
    test.check('a stranger\'s post for a key this relay does not hold is refused 403: only its members are carried to');
  } else {
    test.fail('a stranger posting past this relay: ' + JSON.stringify(nowhere.r).slice(0, 160));
  }

  test.subHeading('In process: partnering is gone as a permission');

  const gone = ['setPartner', 'clearPartner', 'partners'].filter(function (k) { return typeof box[k] === 'function'; });
  if (!gone.length) test.check('the relay offers no partner roll: setPartner, clearPartner and partners are gone');
  else test.fail('the relay still offers ' + gone.join(', '));
  if (routerTable.PARTNER === undefined && (routerTable.KINDS || []).indexOf('partner') === -1) {
    test.check('the router has no partner class, so no partner budget');
  } else {
    test.fail('the router still has a partner class');
  }
  const relaySrc = fs.readFileSync(path.join(__dirname, '..', 'run', 'spirit', 'relay.js'), 'utf8');
  if (!/PARTNER_FLOOR_PER_MIN|partnerHits|partnerPerMin|CLAIM_PER_MIN|claimHits/.test(relaySrc)) {
    test.check('relay.js holds no partner budget and no per-address claim limit (the address table replaced it)');
  } else {
    test.fail('relay.js still names the partner budget or the claim limit');
  }

  // Old data stays readable: a relay.db that still has a partners table opens and its roll is read.
  try { require('../run/spirit/relayStore').closeAll(); } catch (e) { /* none open */ }
  let oldOpens = false;
  try {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(path.join(home, 'relay-state', 'relay.db'));
    db.exec('CREATE TABLE IF NOT EXISTS partners (relayKey TEXT PRIMARY KEY, url TEXT, ownerKey TEXT, status TEXT, since TEXT, last TEXT)');
    db.prepare('INSERT OR REPLACE INTO partners (relayKey, url, ownerKey, status, since, last) VALUES (?, ?, ?, ?, ?, ?)')
      .run('k-old', 'https://old.example', owner.publicKey, 'partnered', '2026-09-20', '');
    db.close();
    oldOpens = rollOf(home).length === 3;
  } catch (e) { oldOpens = false; }
  try { require('../run/spirit/relayStore').closeAll(); } catch (e) { /* none open */ }
  if (oldOpens) test.check('a relay.db that still holds a partners table opens, and its roll reads whole');
  else test.fail('a relay.db with an old partners table did not open with its roll');
}

// ════════════════════════════════════════════════════════════════════════
// OVER THE WIRE: a relay in a scratch folder
// ════════════════════════════════════════════════════════════════════════

function buildRelayHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-stranger-relay-'));
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  const relayId = auth.generateIdentity('relay');
  auth.saveIdentity(home, relayId);
  const owner = auth.generateIdentity('andy');
  ownHome(home, owner);
  const box = createRelay(home);
  claimOwner(box, owner, 'andy');
  const minted = box.mint('andy', 'carol', 7);
  const minted2 = box.mint('andy', 'dave', 7);
  try { require('../run/spirit/relayStore').closeAll(); } catch (e) { /* none open */ }

  const runDir = path.join(home, 'spirit', 'run');
  plantRun.plantRunTree(runDir);
  fs.rmSync(path.join(runDir, 'relay-state'), { recursive: true, force: true });
  fs.cpSync(path.join(home, 'relay-state'), path.join(runDir, 'relay-state'), { recursive: true });
  return {
    runDir: runDir, relayId: relayId, owner: owner,
    token: minted && minted.invite && minted.invite.token,
    token2: minted2 && minted2.invite && minted2.invite.token,
  };
}

async function startRelay(runDir) {
  const port = await freePort();
  const said = [];
  const kid = spawn(process.execPath, ['spirit/server.js', '--port', String(port), '--relay'],
    { cwd: runDir, stdio: ['ignore', 'pipe', 'pipe'] });
  kid.stdout.on('data', function (b) { said.push(String(b)); });
  kid.stderr.on('data', function (b) { said.push(String(b)); });
  const base = 'http://127.0.0.1:' + port;
  const key = await door.awaitRelayDoor(base);
  return { kid: kid, base: base, key: key, said: said };
}

async function overTheWire() {
  const lab = buildRelayHome();
  const up = await startRelay(lab.runDir);
  child = up.kid;
  const BASE = up.base;
  const RELAY_KEY = lab.relayId.publicKey;
  const RELAY_SEAL = lab.relayId.sealPublicKey;

  test.subHeading('A stranger asks the relay for its key: the card ask, on the one door');

  const asked = await door.cardAsk(BASE, auth.generateIdentity('stranger'));
  if (asked.ok && asked.packet.from === RELAY_KEY) {
    test.check('a signed card ask from an unknown key, to: "", is answered with a reply packet the relay signed over the hash the stranger computed');
  } else {
    test.fail('a signed card ask from an unknown key was not answered as a signed reply: ' + short(asked) +
      ' (relay said: ' + up.said.join('').trim().slice(-200) + ')');
  }
  const said = asked.said || {};
  if (asked.ok && said.relaySealKey === RELAY_SEAL && said.ownerKey === lab.owner.publicKey &&
      typeof said.payloadMax === 'number') {
    test.check('the answer carries the relay key statement (key, seal key, signed), its owner and what it carries, so a node can pin it');
  } else {
    test.fail('the card answer does not carry the relay key statement: ' + JSON.stringify(said).slice(0, 160));
  }

  const stranger = auth.generateIdentity('stranger2');
  const unsignedBody = { from: stranger.publicKey, to: '', text: door.CARD_ASK };
  const unsigned = await (async function () { await sleep(door.GAP_MS); return door.postDoor(BASE, unsignedBody); }());
  if (unsigned.status >= 400 && !(unsigned.json && unsigned.json.from === RELAY_KEY)) {
    test.check('an unsigned card ask is refused: ' + unsigned.status);
  } else {
    test.fail('an unsigned card ask was answered: ' + short(unsigned));
  }

  const forged = door.signedPost(auth.generateIdentity('other'), '', door.CARD_ASK);
  forged.body.from = stranger.publicKey;
  await sleep(door.GAP_MS * 2);
  const badSig = await door.postDoor(BASE, forged.body);
  if (badSig.status >= 400 && !(badSig.json && badSig.json.from === RELAY_KEY)) {
    test.check('a card ask signed by a key other than its sender is refused: ' + badSig.status);
  } else {
    test.fail('a card ask with a signature by another key was answered: ' + short(badSig));
  }

  test.subHeading('Only the public services: a stranger gets nothing else from the relay');

  const searchText = JSON.stringify(seal.seal(RELAY_SEAL, stranger.publicKey, RELAY_KEY,
    JSON.stringify({ v: 1, body: { search: { q: 'a' } } })));
  await sleep(door.GAP_MS * 2);
  const search = await door.strangerPost(BASE, stranger, RELAY_KEY, searchText);
  if (search.status === 403 && search.json && search.json.error === 'your id is not a valid sender here') {
    test.check('a stranger asking a member verb (search), sealed properly, is refused 403: not a valid sender here');
  } else {
    test.fail('a stranger asking a member verb was not refused with 403 not-a-sender: ' + short(search));
  }

  test.subHeading('A stranger claims a seat on the one door, sealed to the key it learnt');

  const carol = auth.generateIdentity('carol');
  const known = asked.ok ? said : null;
  const claimed = await door.claimOnDoor(BASE, carol, { name: 'carol', invite: lab.token, inviteLabel: 'carol' }, known);
  if (claimed.status === 201 && claimed.said && claimed.said.ok === true && claimed.json.publicKey === carol.publicKey) {
    test.check('the stranger\'s sealed claim is accepted, answered signed and sealed to the card it carried');
  } else {
    test.fail('the stranger\'s claim on the one door was not accepted: ' + short(claimed));
  }
  // The owner holds a row already and needs no invite: his claim again is the 409 a node reads as "mine".
  const again = await door.claimOnDoor(BASE, lab.owner, { name: 'andy' }, known);
  if (again.status === 409 && again.json && again.json.peer && again.json.peer.publicKey === lab.owner.publicKey) {
    test.check('the owner claiming again on the door is answered 409 with his own row, on his post');
  } else {
    test.fail('the owner\'s re-claim: ' + short(again));
  }

  test.subHeading('The public door is closed: key, claim, version and the brochure');

  const closed = [
    ['GET', '/api/relay/key'], ['POST', '/api/relay/claim'], ['GET', '/api/version'],
    ['GET', '/'], ['GET', '/index.html'], ['GET', '/relay.html'], ['GET', '/favicon.svg'],
  ];
  for (const c of closed) {
    const status = await fetch(BASE + c[1], c[0] === 'POST'
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' } : undefined)
      .then(function (r) { return r.status; }, function () { return 0; });
    if (status === 404) test.check(c[0] + ' ' + c[1] + ' no longer answers: 404');
    else test.fail(c[0] + ' ' + c[1] + ' still answers: ' + status);
  }

  test.subHeading('peerPost carries both public services');

  const { createPeerPost } = require('../run/spirit/peerPost');
  const nodeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-stranger-node-'));
  fs.mkdirSync(path.join(nodeHome, 'relay-state'), { recursive: true });
  auth.saveIdentity(nodeHome, auth.generateIdentity('dave'));
  const pp = createPeerPost({ rootDir: nodeHome, request: require('../run/spirit/relayRequest').relayRequest });
  if (typeof pp.relayKey === 'function') test.check('peerPost exposes relayKey(url)');
  else test.fail('peerPost exposes no relayKey(url)');
  if (typeof pp.claim === 'function') test.check('peerPost exposes claim(url, name, invite, inviteLabel, known)');
  else test.fail('peerPost exposes no claim(url, ...)');

  if (typeof pp.relayKey === 'function') {
    let learnt = null;
    try {
      learnt = await Promise.race([pp.relayKey(BASE), sleep(20000).then(function () { return 'timeout'; })]);
    } catch (e) { learnt = String(e && e.message || e); }
    const k = learnt && typeof learnt === 'object' ? learnt.relayPublicKey : learnt;
    if (k === RELAY_KEY) test.check('peerPost.relayKey learns the relay key through the one door');
    else test.fail('peerPost.relayKey answered ' + JSON.stringify(learnt).slice(0, 160));
  }
  let daveKey = '';
  if (typeof pp.claim === 'function') {
    let got = null;
    try {
      got = await Promise.race([pp.claim(BASE, 'dave', lab.token2, 'dave', 'first-contact'),
        sleep(30000).then(function () { return 'timeout'; })]);
    } catch (e) { got = String(e && e.message || e); }
    daveKey = auth.loadIdentity(nodeHome).publicKey;
    if (got && got.ok === true && got.peer && got.peer.publicKey === daveKey && got.relayPublicKey === RELAY_KEY) {
      test.check('peerPost.claim learns the key and claims through the one door, and names the relay it filed under');
    } else {
      test.fail('peerPost.claim answered ' + JSON.stringify(got).slice(0, 200));
    }
  }

  // The seats themselves, read off the relay's disc once the relay has stopped.
  const kid = child;
  child = null;
  await new Promise(function (resolve) {
    let done = false;
    kid.once('exit', function () { if (!done) { done = true; resolve(); } });
    try { kid.kill(); } catch (e) { done = true; resolve(); }
    setTimeout(function () { if (!done) { done = true; resolve(); } }, 5000);
  });
  let rows = [];
  try { rows = rollOf(lab.runDir); } catch (e) { rows = []; }
  try { require('../run/spirit/relayStore').closeAll(); } catch (e) { /* none open */ }
  if (rows.some(function (r) { return r.publicKey === carol.publicKey; }) &&
      (!daveKey || rows.some(function (r) { return r.publicKey === daveKey; }))) {
    test.check('and the strangers hold rows on the relay\'s roll afterwards');
  } else {
    test.fail('a stranger has no row on the roll after claiming on the one door');
  }
}

async function run() {
  await inProcess();
  await overTheWire();
}

run()
  .catch(function (e) { test.fail(String(e && e.stack ? e.stack : e)); })
  .then(function () {
    if (child) { try { child.kill(); } catch (e) { /* gone */ } child = null; }
    try { require('../run/spirit/relayStore').closeAll(); } catch (e) { /* none open */ }
    test.reportSuccessFailureCount();
  });
