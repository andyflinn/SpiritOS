'use strict';

// spirit/test/relayProbe.js
// What is this relay, and is it healthier than it was?
//
// Not a test. A test says yes or no; this takes a READING, so two of them
// can be compared. For a box alone in the jungle that is the question
// that matters — not "does it pass" but "is it stronger than before"
// (design/cleanup/2026-09-11-live-surface-tests.md).
//
// Read-only, and it signs nothing: everything it asks is public, so it
// needs no key and can be run by anyone, from anywhere, including after a
// deploy from a machine that is not the owner's.
//
// SAFE BY DEFAULT. With no argument it prints usage and touches no
// network at all, so the harness can run it as a no-op and nothing
// reaches the internet during a test sweep.
//
//   node spirit/test/relayProbe.js https://spirit.andyflinn.com
//   node spirit/test/relayProbe.js http://127.0.0.1:65425 --json

const TIMEOUT_MS = 10000;
const LATENCY_SAMPLES = 7;

// The capability fingerprint. A 404 means the route is not deployed;
// ANY other answer means it is there and merely declined us — which is
// exactly the distinction a deploy check needs, and it needs no
// credentials to make.
const SURFACE = [
  ['GET', '/api/version'],
  ['GET', '/api/relay/who'],
  ['GET', '/api/relay/status'],
  ['GET', '/api/relay/stream'],
  ['POST', '/api/relay/claim'],
  ['POST', '/api/relay/send'],
  ['POST', '/api/relay/invite'],
  ['POST', '/api/relay/device'],
  ['POST', '/api/relay/remove-peer'],
  ['POST', '/api/relay/post'],
  ['POST', '/api/relay/reply'],
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

  const version = await ask(url, 'GET', '/api/version');
  if (version.status === 200) {
    try {
      const v = JSON.parse(version.text);
      reading.commit = v.commit;
      reading.dirty = v.dirty;
      reading.source = v.source;
      reading.relay = v.relay;
      reading.startedAt = v.startedAt;
      reading.uptimeSec = Math.round((Date.now() - Date.parse(v.startedAt)) / 1000);
      reading.untracked = v.untracked || 0;
    } catch (e) { reading.commit = 'unparseable'; }
  } else {
    // The absence of this route is itself a version signal, and will be
    // until every box has been updated once.
    reading.commit = version.status === 404 ? 'pre-version' : 'unreachable';
  }

  const who = await ask(url, 'GET', '/api/relay/who');
  reading.members = [];
  if (who.status === 200) {
    try {
      reading.members = (JSON.parse(who.text).peers || []).map(function (p) {
        return p.publicLabel || p.name || '?';
      }).sort();
    } catch (e) { /* leave empty */ }
  }

  reading.surface = {};
  for (const [method, path] of SURFACE) {
    const answer = await ask(url, method, path);
    reading.surface[method + ' ' + path] = answer.status;
  }

  const samples = [];
  for (let n = 0; n < LATENCY_SAMPLES; n += 1) {
    const one = await ask(url, 'GET', '/api/relay/who');
    if (one.status) samples.push(one.ms);
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
  console.log('members    : ' + reading.members.length +
    (reading.members.length ? '  (' + reading.members.join(', ') + ')' : ''));
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
