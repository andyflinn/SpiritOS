'use strict';

// spirit/test/liveFrontDoor.js
// goal/G43.23, restored from 885f1ab5^ on today's harness (Andy's box: bring back "the front-door wiring"). The front
// door, proved with real peers on real processes: three scratch nodes (spirit/run/test/headLessChrome.js scratchNode),
// each joined by the relay's own join to one scratch relay (scratchFaceRelay, its mails kept), never a live relay nor
// Andy's node nor an agent's.
//
// ── WHY THIS EXISTS, AND IT IS NOT REDUNDANT ─────────────────────────
//
// frontDoor.js proves the same rules in process, and it is where the edge cases live. This proves the one thing it
// cannot: that the rules are WIRED. On 2026-09-12 a bug shipped that every suite missed: hub.frontDoor admits a relay as
// a party only if its key is pinned; the pin was established by answerRelay, which frontDoor ran before, so nothing was
// ever pinned. A suite that drives each module cannot see the wiring between two of them. This one drives nothing: it
// posts from one real node to another through a real relay and reads what the receiving node wrote down.
//
// ── WHAT THE EVIDENCE IS ─────────────────────────────────────────────
//
// The receiving node's own traffic log (trafficLog, node.db). `outcome` on an inbound request IS the front door's
// verdict: delivered ('known', handed to the apps), ignored (a stranger, goal/G43.17: always), refused (over the
// stranger's floor, peerPost's UNKNOWN_PER_MIN: not filed, not receipted). Who the node listens to is its contacts,
// asked of it (contact.get), since contacts are rows of node.db's seen (goal/G40.11).
//
// DROPPED from the old suite, its subject gone: the per-peer numbers (peerStats, gone with goal/G43.14's "the peer
// counters go").

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const RUN = path.join(__dirname, '..', 'run');
const { scratchNode, scratchFaceRelay, sleep, until } = require(path.join(RUN, 'test', 'headLessChrome.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }

// The node's own loopback door, as its owner.
async function home(N, call, args) {
  try {
    const r = await fetch(N.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args || {} }) });
    const text = await r.text();
    return { status: r.status, text: text, body: parsed(text) || {} };
  } catch (e) {
    return { status: 0, text: String(e && e.message), body: {} };
  }
}
const runOf = function (N) { return path.join(N.root, 'spirit', 'run'); };

// A real join: the node adds the relay and asks, the relay mails, the node confirms with the mail's code.
async function join(N, R, mail) {
  const added = await home(N, 'relay.add', { url: R.base, label: 'scratch' });
  if (added.status !== 200) return 'relay.add answered ' + added.status + ' ' + short(added.text);
  const from = R.mailed.length;
  const asked = await home(N, 'relay.join', { url: R.base, email: mail });
  if (asked.status >= 300) return 'relay.join answered ' + asked.status + ' ' + short(asked.text);
  await until(function () { return R.mailed.slice(from).some(function (m) { return m.to === mail; }); }, 8000);
  const m = R.mailed.slice(from).filter(function (x) { return x.to === mail; })[0];
  const code = m && ((/[?&]join=([A-Za-z0-9_-]+)/.exec(m.text)) || [])[1];
  if (!code) return 'the relay mailed no join code to ' + mail;
  const done = await home(N, 'relay.join', { url: R.base, email: mail, code: code });
  if (done.status >= 300) return 'the confirm answered ' + done.status + ' ' + short(done.text);
  return '';
}

// What a node wrote down about its own WAN traffic, through the log (trafficLog's read answers the rows wherever they
// live). Missing reads as nothing, the honest answer for a node that has had none.
function traffic(N) {
  try { return require(path.join(RUN, 'spirit', 'trafficLog.js')).createTrafficLog({ rootDir: runOf(N) }).read(); } catch (e) { return []; }
}
function inbound(N, fromKey) {
  return traffic(N).filter(function (e) { return e && e.dir === 'in' && e.kind === 'request' && (!fromKey || e.peer === fromKey); });
}
function keyOf(N) {
  try { return JSON.parse(fs.readFileSync(path.join(runOf(N), 'spirit', 'state', 'identity.json'), 'utf8')).publicKey || ''; } catch (e) { return ''; }
}
function descriptionOf(N) {
  try { return String(JSON.parse(fs.readFileSync(path.join(runOf(N), 'spirit', 'state', 'identity.json'), 'utf8')).description || ''); } catch (e) { return ''; }
}
// The receiving node's own answer about a key: its contact row, or none.
async function contactOf(N, key) {
  const r = await home(N, 'contact.get', { key: key });
  return r.status === 200 && r.body.person ? r.body.person : null;
}
const post = function (from, to, text) { return home(from, 'peer.post', { to: to, text: text }); };
const CARD_ASK = JSON.stringify({ v: 1, body: { card: true } });

test.startTest('The front door: real peers, real relay, real processes');

const nodes = [];
let R = null;

(async function () {
  R = await scratchFaceRelay({ members: [] });
  if (!R.up) { test.fail('the world: the scratch relay did not come up: nothing judged'); return; }
  const names = ['alfa', 'bravo', 'charlie'];
  for (const name of names) {
    const N = await scratchNode();
    N.name = name;
    nodes.push(N);
    if (!N.up || !N.root) { test.fail('the world: the scratch node ' + name + ' did not come up: nothing judged'); return; }
    const why = await join(N, R, name + '@example.org');
    if (why) { test.fail('the world: ' + name + ' could not join the scratch relay: ' + why + ': nothing judged'); return; }
  }
  const [alfa, bravo, charlie] = nodes;
  const alfaKey = keyOf(alfa);
  const bravoKey = keyOf(bravo);
  const charlieKey = keyOf(charlie);
  if (alfaKey && bravoKey && charlieKey && new Set([alfaKey, bravoKey, charlieKey]).size === 3) test.check('three nodes and a relay are up, each with an identity of its own, each a member by the relay\'s join');
  else { test.fail('keys: ' + [alfaKey, bravoKey, charlieKey].map(function (k) { return !!k; }).join(',')); return; }

  // Streams take a moment to settle, and a post to a peer the relay does not yet see present is refused for the wrong
  // reason.
  await sleep(2500);

  // ── AND EACH DESCRIBED ITSELF ON THE WAY UP ──
  //   Andy: "on boot: the node should fill the description 'this node described for the first time [date / time
  //   string]'." The function's own suite proves it; this proves server.js calls it, on a process that really booted.
  const described = nodes.map(descriptionOf);
  if (described.every(function (d) { return /^this node described for the first time /.test(d); })) test.check('and each wrote itself a description on the way up, rather than booting blank');
  else test.fail('descriptions: ' + short(described));

  // ── AND A SEARCH SAYS WHO IS HOME ──
  //   Andy: "the search might need a filter argument (onlineOnly = true)… discuss?" Asked of a real node against a real
  //   relay, the only place the shaping can be caught. Since goal/G43.17 the network tier of contact.search streams its
  //   rows as the 'peer-search' job (hub.networkSearch), each { key, label } with the row as json.
  let seenRows = [];
  for (let i = 0; i < 20 && !seenRows.length; i++) {
    await home(alfa, 'contact.search', { q: '' });
    await sleep(400);
    const jobs = await home(alfa, 'jobs.search', { q: 'peer-search' });
    // The job hub.networkSearch made: kind permanent, type peer-search (spirit/jobs.js createJob), asked by its id.
    for (const it of (jobs.body.items || [])) {
      const got = await home(alfa, 'jobs.get', { key: it.key });
      const job = got.body && got.body.job;
      if (!job || job.type !== 'peer-search') continue;
      const item = job.data && job.data.item;
      const row = item ? parsed(item.label) : null;
      if (row && (item.key === bravoKey || item.key === charlieKey)) seenRows = [Object.assign({ key: item.key }, row)];
    }
  }
  if (seenRows.length) test.check('a member searching its own relay gets rows back, a fellow member among them');
  else test.fail('search: no peer-search row naming bravo or charlie on alfa');
  // A BOOLEAN ON EVERY ROW, and the truth: these nodes are up and streaming, so the relay says so.
  if (seenRows.length && seenRows.every(function (r) { return typeof r.present === 'boolean'; })) test.check('and every row says whether the relay sees that peer connected');
  else test.fail('presence missing from a row: ' + short(seenRows));
  if (seenRows.some(function (r) { return r.present === true; })) test.check('and says TRUE of somebody, which a hardcoded false would not');
  else test.fail('nobody present among ' + seenRows.length + ' rows: ' + short(seenRows));

  test.subHeading('A stranger with a perfect signature, and a node that has not heard of them');
  // NOTHING HAS BEEN FAKED HERE. alfa and bravo are both on the relay and neither has acquired the other. THE CARD COMES
  // FIRST, BECAUSE IT HAS TO (cycle 10, R5; Andy: "if you can't get the card, you can't post anyways."): holding
  // somebody's card is not being introduced to them.
  const card = await post(alfa, bravoKey, CARD_ASK);
  if (card.status === 200 && card.body.card && card.body.card.ok) test.check('alfa asks bravo for its card and gets one, the only unsealed post there is');
  else test.fail('card: ' + card.status + ' ' + short(card.body));
  const first = await post(alfa, bravoKey, 'unsolicited hello');
  // THE SENDER IS NOT TOLD: a stranger being ignored is not owed the difference between "ignored" and "unreachable".
  if (first.status === 200 && first.body.ok) test.check('alfa\'s post is receipted, so it cannot tell it was ignored');
  else test.fail('post: ' + first.status + ' ' + short(first.body));
  await sleep(600);
  const ignored = inbound(bravo, alfaKey).filter(function (e) { return e.outcome === 'ignored'; });
  if (ignored.length === 1) test.check('and bravo wrote it down as ignored: the door judged it, and said so');
  else test.fail('bravo logged: ' + short(inbound(bravo, alfaKey)));
  if (ignored.length && ignored[0].payload === undefined) test.check('and kept no payload, so being ignored costs bravo nothing but a line');
  else test.fail('the ignored entry kept a payload: ' + short(ignored[0]));
  // NOT A CONTACT: the row that would make alfa heard next time.
  const asStranger = await contactOf(bravo, alfaKey);
  if (!asStranger || asStranger.keep !== true) test.check('and alfa is no contact of bravo\'s: being ignored makes nobody heard');
  else test.fail('alfa became a contact by being ignored: ' + short(asStranger));

  test.subHeading('And the same stranger, once bravo accepts him');
  // THROUGH THE REAL VERB (goal/G43.17: no setting lets a stranger in; the owner accepts a person).
  const set = await home(bravo, 'contact.accept', { publicKey: alfaKey });
  if (set.status === 200 && set.body.keep === true) test.check('bravo accepts alfa, and the node confirms alfa is kept');
  else test.fail('accept: ' + set.status + ' ' + short(set.body));
  const second = await post(alfa, bravoKey, 'hello again');
  await sleep(600);
  const delivered = inbound(bravo, alfaKey).filter(function (e) { return e.outcome === 'delivered'; });
  if (second.status === 200 && delivered.length === 1) test.check('the same key, the same post, now delivered: the door is the only thing that changed');
  else test.fail('after accept: ' + short(inbound(bravo, alfaKey)));
  if (delivered.length && delivered[0].payload === 'hello again') test.check('and this one is kept whole, because bravo chose to hear it');
  else test.fail('delivered payload: ' + short(delivered[0] && delivered[0].payload));
  const row = await contactOf(bravo, alfaKey);
  if (row && row.keep === true) test.check('and alfa now has a kept row, which is what listening means');
  else test.fail('row: ' + short(row));

  // ── THE LOG, READ BACK AS A TABLE ──
  // The read surface rests on this: both posts are in bravo's log; only the delivered one is an arrival, and a reader
  // that could not tell them apart would hand an unaccepted stranger's line to an app and walk the front door back.
  const log = require(path.join(RUN, 'spirit', 'trafficLog.js')).createTrafficLog({ rootDir: runOf(bravo) });
  const mine = log.arrivals({}).filter(function (r) { return r.peer === alfaKey; });
  if (mine.length === 1) test.check('bravo\'s log reads back as a table with the one line it agreed to hear');
  else test.fail('arrivals: ' + short(mine));
  const texts = mine.map(function (r) { return r.payload; });
  if (texts.length === 1 && /hello again/.test(String(texts[0]))) test.check('and the post it IGNORED is absent from that table, though both are in its log');
  else test.fail('table carried: ' + short(texts));
  const one = mine[0] ? log.byHash(mine[0].hash) : null;
  const hit = Array.isArray(one) ? one.filter(function (r) { return r && r.hash === mine[0].hash; })[0] : one;
  if (hit && hit.hash === mine[0].hash) test.check('and one row comes back by its hash alone');
  else test.fail('byHash: ' + short(one));

  test.subHeading('A contact is not rationed; a stranger is');
  // ALFA IS A CONTACT NOW, so the floor does not apply: ten posts that would have spent a stranger's whole budget.
  const before = inbound(bravo, alfaKey).length;
  for (let n = 0; n < 10; n += 1) await post(alfa, bravoKey, 'x'.repeat(4000));
  await sleep(1200);
  const after = inbound(bravo, alfaKey);
  const grew = after.length - before;
  const refusedFromAlfa = after.filter(function (e) { return e.outcome === 'refused'; }).length;
  if (grew === 10 && refusedFromAlfa === 0) test.check('ten 4KB posts from a contact all land, 40KB, and the floor never looks at them');
  else test.fail('contact posts: ' + grew + ' of 10 landed, ' + refusedFromAlfa + ' refused');
  // AND THE STRANGER: charlie, whom bravo never accepted. The card first, like any sender; it buys no introduction.
  await post(charlie, bravoKey, CARD_ASK);
  for (let n = 0; n < 9; n += 1) await post(charlie, bravoKey, 'knock ' + n);
  await sleep(1200);
  const fromCharlie = inbound(bravo, charlieKey);
  const charlieIgnored = fromCharlie.filter(function (e) { return e.outcome === 'ignored'; }).length;
  const charlieRefused = fromCharlie.filter(function (e) { return e.outcome === 'refused'; }).length;
  if (charlieIgnored === 6 && charlieRefused >= 1) test.check('while a stranger gets six a minute and is then refused outright: ' + charlieIgnored + ' ignored, ' + charlieRefused + ' refused');
  else test.fail('charlie: ' + charlieIgnored + ' ignored, ' + charlieRefused + ' refused of 9');
  // Over the floor NOTHING is filed: a stranger cannot make bravo store their bytes by sending enough of them.
  const overFloor = fromCharlie.filter(function (e) { return e.outcome === 'refused'; });
  if (overFloor.length && overFloor.every(function (e) { return e.payload === undefined; })) test.check('and nothing over the floor is stored: refused before the log, payload and all');
  else test.fail('a refused entry kept a payload, or none was refused');

  test.subHeading('And the relay is known, which is what lets an enrolment through');
  // THE BUG THAT MOTIVATED THIS FILE: bravo holds a stream to the relay, so by the time anything can be posted down it
  // the relay's key must already be pinned, at stream-open, not lazily by the code the door would have blocked. The pin
  // lives in node.db's seen table, asked through relayKeys, the one reader.
  let pinnedKey = '';
  try { pinnedKey = require(path.join(RUN, 'spirit', 'relayKeys.js')).pinned(runOf(bravo), R.base) || ''; } catch (e) { pinnedKey = ''; }
  if (R.relayKey && pinnedKey === R.relayKey) test.check('bravo pinned the relay\'s own key by holding a stream to it, before any offer could arrive');
  else test.fail('pinned: ' + (pinnedKey ? 'another key' : 'nothing') + ', the relay\'s key ' + (R.relayKey ? 'known' : 'unknown'));
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(async function () {
  // THIS PROCESS OPENED THE NODES' node.db to read their logs, and Windows will not remove an open file: closed first.
  for (const N of nodes) { try { require(path.join(RUN, 'spirit', 'nodeStore.js')).open(runOf(N)).close(); } catch (e) { /* no store */ } }
  for (const N of nodes) { try { if (N.child) N.child.kill(); } catch (e) { /* gone */ } }
  try { if (R) R.stop(); } catch (e) { /* gone */ }
  await sleep(800);
  for (const N of nodes) { try { if (N.root) fs.rmSync(N.root, { recursive: true, force: true }); } catch (e) { /* scratch */ } }
  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(0); }, 300);
});
