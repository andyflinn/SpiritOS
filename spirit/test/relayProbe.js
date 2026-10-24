'use strict';

// spirit/test/relayProbe.js
// What is this relay, and is it healthier than it was?
//
// Not a test. A test says yes or no; this takes a READING, so two of them
// can be compared. For a box alone in the jungle that is the question
// that matters — not "does it pass" but "is it stronger than before"
// (design/cleanup/2026-09-11-live-surface-tests.md).
//
// Read-only. Since goal/G22.6 a relay answers no unsigned GET: it is asked
// who it is with a card ask on its one door, signed by a key made in memory
// for this reading and written nowhere, so it can still be run by anyone,
// from anywhere. Its card asks are paced past the relay's address table
// (relayDoor.js), one a second from this address.
//
// SAFE BY DEFAULT. With no argument it prints usage and touches no
// network at all, so the harness can run it as a no-op and nothing
// reaches the internet during a test sweep.
//
//   node spirit/test/relayProbe.js https://spirit.andyflinn.com
//   node spirit/test/relayProbe.js http://127.0.0.1:65425 --json

const door = require('./relayDoor');

const TIMEOUT_MS = 10000;
const LATENCY_SAMPLES = 3;

// The capability fingerprint. A 404 means the route is not deployed;
// ANY other answer means it is there and merely declined us — which is
// exactly the distinction a deploy check needs, and it needs no
// credentials to make.
const SURFACE = [
  ['GET', '/api/relay/stream'],
  ['POST', '/api/relay/post'],
  ['POST', '/api/relay/reply'],

  // THE PUBLIC DOOR, CLOSED BY goal/G22.6 (Andy, 2026-10-13): a relay still
  // answering any of these runs code from before it.
  ['GET', '/api/version'],
  ['GET', '/api/relay/key'],
  ['POST', '/api/relay/claim'],
  ['GET', '/'],

  // ROUTES THAT SHOULD ANSWER 404 NOW, and they are on this list for
  // exactly that: a fingerprint is for telling one deploy from another,
  // and a door that has been removed is the clearest possible signal
  // about which code a box is running.
  //
  // The first four were collapsed into posts on 2026-09-13 (decision
  // 0010), which is the day the register emptied. A relay still answering
  // any of them is running code from before that.
  ['POST', '/api/relay/invite'],
  ['POST', '/api/relay/monitor'],
  ['POST', '/api/relay/remove-peer'],
  ['POST', '/api/relay/set-device'],
  // The device enrolment's own door, removed by goal/G16.2.
  ['POST', '/api/relay/device'],

  // And the ring, deleted 2026-09-15 (R8). These two moved from the live
  // list above to this one on that day, which is the whole value of
  // keeping both lists in one file: a relay answering either of them is
  // still storing other people's mail.
  ['POST', '/api/relay/send'],
  ['GET', '/api/relay/inbox'],

  // And the owner badge's route, deleted the same day (R3). It moved
  // from the live list too. A relay still answering it is running code
  // from before the badge was deleted — and is still accepting, on a
  // query string, the one signature on this wire that could not expire.
  ['GET', '/api/relay/status'],
];

function usage() {
  console.log('Usage: node spirit/test/relayProbe.js <relay-url> [--json]');
  console.log('');
  console.log('Takes a read-only reading of a relay: which commit it is running,');
  console.log('how long it has been up, who is on it, which routes exist, and how');
  console.log('fast it answers. Signs nothing, changes nothing.');
  console.log('');
  console.log('Run it before a deploy and after one, and compare.');
}

async function ask(url, method, path) {
  const began = Date.now();
  const controller = new AbortController();
  const bell = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
  try {
    const res = await fetch(url + path, {
      method: method,
      // A body only so a POST is well-formed enough to reach its route.
      // Every one of these is refused; being refused is the answer.
      headers: method === 'POST' ? { 'Content-Type': 'application/json' } : {},
      body: method === 'POST' ? '{}' : undefined,
      signal: controller.signal,
      redirect: 'manual',
    });
    let text = '';
    try { text = await res.text(); } catch (e) { text = ''; }
    return { status: res.status, ms: Date.now() - began, text: text };
  } catch (e) {
    return { status: 0, ms: Date.now() - began, text: String((e && e.message) || e) };
  } finally {
    clearTimeout(bell);
  }
}

function median(xs) {
  const s = xs.slice().sort(function (a, b) { return a - b; });
  return s[Math.floor(s.length / 2)];
}

async function main() {
  const args = process.argv.slice(2);
  const url = (args[0] || '').replace(/\/+$/, '');
  const asJson = args.indexOf('--json') !== -1;
  if (!url || url.indexOf('http') !== 0) { usage(); return; }

  const reading = { url: url, at: new Date().toISOString() };

  // A RELAY'S VERSION IS NOT PUBLIC since goal/G22.6 closed GET
  // /api/version: it reaches the relay's owner in his relay-status report.
  // A box still answering the route is running code from before that.
  const version = await ask(url, 'GET', '/api/version');
  reading.commit = version.status === 404 ? 'not public (goal/G22.6)'
    : version.status ? 'pre-G22.6 (still answers /api/version)' : 'unreachable';

  // ── `members` STOOD HERE, AND IS NOT A THING TO REPORT ───────────
  //
  // It read `GET /api/relay/who` and listed every member's label. That
  // route was a public, unsigned, unbounded read of the membership —
  // named a cheat in decision 0010 on 2026-09-17, deleted the next day —
  // and 0012 says plainly that no party may ask for an enrolment list,
  // including a probe belonging to the owner.
  //
  // What a deploy check actually needs is below: which doors answer, and
  // how fast. Neither needs to know who is on the box.
  //
  // If a relay's operator wants its roster, that is the relay reporting
  // to its owner over the owner's own stream (relay.statusToOwner) — a
  // box telling the person who runs it, unasked, rather than a door
  // anybody can knock on.
  // WHO IT IS: its card, asked on its one door (goal/G22.6).
  const said = await door.cardAsk(url);
  reading.relay = {};
  if (said.ok) {
    reading.relay = {
      label: said.said.relayLabel || '',
      owner: said.said.ownerLabel || '',
      key: (said.said.relayPublicKey || '').slice(-8),
    };
  }

  reading.surface = {};
  for (const [method, path] of SURFACE) {
    const answer = await ask(url, method, path);
    reading.surface[method + ' ' + path] = answer.status;
  }

  // Each sample a card ask, paced past the address table; the time is the
  // ask alone, not the wait before it.
  const samples = [];
  for (let n = 0; n < LATENCY_SAMPLES; n += 1) {
    await new Promise(function (r) { setTimeout(r, door.GAP_MS); });
    const began = Date.now();
    const one = await door.postDoor(url, door.signedPost(require('../run/spirit/relayAuth').generateIdentity('probe'), '', door.CARD_ASK).body);
    if (one.status) samples.push(Date.now() - began);
  }
  reading.latency = samples.length
    ? { min: Math.min.apply(null, samples), median: median(samples), max: Math.max.apply(null, samples) }
    : null;

  if (asJson) {
    console.log(JSON.stringify(reading));
    return;
  }

  console.log('relay      : ' + reading.url);
  console.log('commit     : ' + reading.commit +
    (reading.dirty ? '  DIRTY — running code that is in no commit' : '') +
    (reading.untracked ? '  (' + reading.untracked + ' file(s) missing from its copy)' : ''));
  console.log('uptime     : ' + (reading.uptimeSec == null ? '?' : reading.uptimeSec + 's'));
  // `members` STOOD HERE and named everybody on the box. See the note
  // where it was read: a probe does not get an enrolment list, and the
  // owner's roster is the relay's report to its owner, not a route.
  console.log('relay      : ' + ((reading.relay && reading.relay.label) || '(unlabelled)') +
    '  key …' + ((reading.relay && reading.relay.key) || '?') +
    '  owner ' + ((reading.relay && reading.relay.owner) || '(none)'));
  if (reading.latency) {
    console.log('latency    : ' + reading.latency.min + '/' + reading.latency.median +
      '/' + reading.latency.max + ' ms  (min/median/max of ' + LATENCY_SAMPLES + ')');
  }
  console.log('');
  console.log('surface    : 404 means not deployed; anything else means it is there');
  Object.keys(reading.surface).forEach(function (key) {
    const code = reading.surface[key];
    console.log('  ' + (code === 404 ? '--- ' : String(code) + ' ') + key);
  });
}

main().catch(function (e) {
  console.log('probe failed: ' + (e && e.stack ? e.stack : e));
});
