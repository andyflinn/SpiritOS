'use strict';

// spirit/test/measureCapacity.js
// WHAT A BOX ACTUALLY HOLDS — measured, on demand.
//
//   Andy: "the README.md should contain a summary of what the capacity of
//   a relay with 100 MBytes of RAM and 1 Gigabyte of DISC is for members
//   and partners, and the capacity of a node with 1 MBytes of RAM and 10
//   Megabytes of DISC are capable of."
//   Andy: "let's keep honest score. it will be impressive. so this should
//   include minimum requirements" — "and something automated to calculate
//   these numbers."
//
//   node spirit/test/measureCapacity.js            print the tables
//   node spirit/test/measureCapacity.js --row       one line, for the history table
//   node spirit/test/measureCapacity.js --save      write README/CAPACITY/<platform>/
//
// ── A SECOND PLATFORM IS THE POINT, NOT A NICETY ─────────────────
//
//   Andy: "our buddy on WSL should repeat all our measurements for his
//   tagged os, and be permitted to contribute it to
//   ./measurements/ubuntu-24.05/ so that our CAPACITY.md can illustrate
//   the differences." — "or under README/CAPACITY/"
//
// Every figure here is the machine it was taken on. The relays that
// matter run on Linux and the numbers in README/CAPACITY.md were taken on
// Windows — so the document is honest about one box and silent about the
// one people will deploy. `--save` writes a machine-readable drop beside
// that document, named for the platform, so two boxes can be set next to
// each other instead of one being assumed to speak for both.
//
// ── WHY THIS IS A TOOL AND NOT A SUITE ───────────────────────────────
//
// It spawns two servers, enrols eight hundred members, holds eight hundred
// sockets and writes eleven thousand rows. That is a minute of wall clock
// and a lot of file handles — not something to put in front of every
// commit, and nothing here is a pass/fail claim. `visualScenarios.js` made
// the same split for the same reason: the suite explores, the tool
// exhibits.
//
// WHAT IT PROTECTS AGAINST is the other failure: a measured number written
// into a document once, and then quietly wrong for six months because the
// platform moved. Re-run it and the document can be corrected against
// something rather than re-guessed.
//
// ── THE METHOD, AND WHY EACH CHOICE ──────────────────────────────────
//
// RSS, NOT heapUsed. A held connection's cost is mostly NOT on the V8
// heap — socket buffers are the kernel's. heapUsed gives a flattering
// number that answers the wrong question; RSS answers "will this box run
// out". On Windows that is WorkingSet64.
//
// A SLOPE, NOT A DIFFERENCE. GC timing makes any single before-and-after
// reading meaningless, so streams are opened in steps and the line is
// taken across them. The first step always reads high — it pays for
// allocator growth the later ones reuse — which is exactly why the
// marginal figure comes from the last segment.
//
// DISC IS THE FILE, NOT AN ESTIMATE. Rows are written to real databases
// and the file size is differenced, because a label is free-form and a row
// is not a fixed size.

const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn, execSync, execFileSync } = require('child_process');

const REPO = path.join(__dirname, '..', '..');
const auth = require('../run/js/relayAuth');
const hub = require('../run/js/hub');
const plantRun = require('./plantRun');
const buildStamp = require('../run/js/buildStamp');
const sseClient = require('../run/js/sseClient');
const relayStore = require('../run/js/relayStore');
const nodeStore = require('../run/js/nodeStore');
const { claimOwner } = require('./ownerClaim');
const { createRelay } = require('../run/js/relay');

// Below 49152, outside Windows' ephemeral range — see presenceWire.js:41.
const RELAY_PORT = 48795;
const NODE_PORT = 48796;
const STEPS = [0, 100, 200, 400, 800];

const kids = [];
const streams = [];
function cleanup() {
  streams.forEach(function (s) { try { s.close(); } catch (e) { /* gone */ } });
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
}
process.on('exit', cleanup);

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function mb(bytes) { return Math.round(bytes / 1024 / 1024); }

// Resident pages, asked of the operating system rather than of the
// process itself — a process cannot see the kernel's share of its own
// sockets.
// ── WHAT THE KERNEL SPENDS, WHICH IS NOT IN A PROCESS'S RSS ───────
//
//   Andy: "for every possible live member, we must leave space for the
//   OS's socket usage etc, which i estimate will be proportional to
//   max-live-streams."
//
// He was right and RSS could not see it: a socket's buffers belong to the
// kernel, not to the process holding the handle. Windows keeps them in
// non-paged pool; Linux accounts TCP memory in pages at
// /proc/net/sockstat. Neither is a per-process figure, so both are read
// as a delta across the same steps and both carry the machine's own noise.
//
// THE TWO ARE NOT THE SAME MEASUREMENT and must not be averaged. Windows'
// counter is every driver on the box; Linux's is the TCP stack alone,
// which is narrower and cleaner. That is one of the things a second
// platform is FOR.
function kernelSocketBytes() {
  try {
    if (process.platform === 'win32') {
      return parseInt(String(execSync(
        'powershell -NoProfile -Command "(Get-CimInstance Win32_PerfRawData_PerfOS_Memory).PoolNonpagedBytes"',
        { encoding: 'utf8' })).trim(), 10);
    }
    // "TCP: inuse N orphan N tw N alloc N mem N" — `mem` is in pages.
    const line = String(fs.readFileSync('/proc/net/sockstat', 'utf8'))
      .split(/\r?\n/).find(function (l) { return l.indexOf('TCP:') === 0; }) || '';
    const m = /mem (\d+)/.exec(line);
    return m ? Number(m[1]) * 4096 : 0;
  } catch (e) { return 0; }
}

function rssOf(pid) {
  try {
    if (process.platform === 'win32') {
      return parseInt(String(execSync(
        'powershell -NoProfile -Command "(Get-Process -Id ' + pid + ').WorkingSet64"',
        { encoding: 'utf8' }
      )).trim(), 10);
    }
    return parseInt(String(execFileSync('ps', ['-o', 'rss=', '-p', String(pid)],
      { encoding: 'utf8' })).trim(), 10) * 1024;
  } catch (e) { return 0; }
}

// ── ONE READING IS NOT A MEASUREMENT ─────────────────────────
//
// The first version of this took one sample per step and two runs
// disagreed by 15% — 52 KB against 60 KB per stream — with one step even
// reading LOWER than the step before it. That is GC, not the sockets, and
// a number that moves that much between runs is not a number.
//
// A median of three spaced samples, because a mean is dragged by the
// single collection that happens to land inside the window and a median
// is not.
async function settledRss(pid) {
  const seen = [];
  for (let i = 0; i < 3; i += 1) {
    await sleep(800);
    seen.push(rssOf(pid));
  }
  seen.sort(function (x, y) { return x - y; });
  return seen[1];
}

async function waitUp(base, tries) {
  for (let n = 0; n < (tries || 60); n += 1) {
    await sleep(200);
    try {
      const r = await hub.relayRequest(base, 'GET', '/api/relay/key', null);
      if (r.status === 200) return true;
    } catch (e) { /* not yet */ }
  }
  return false;
}

// ── DISC, BY DIFFERENCING A REAL FILE ────────────────────────────────
function discPerRow() {
  const K = 'MCowBQYDK2VwAyEA';
  const out = {};

  const rh = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-cap-relay-'));
  const rstore = relayStore.open(rh);
  const rfile = path.join(rh, 'relay-state', 'relay.db');
  out.emptyRelayDb = fs.statSync(rfile).size;
  const M = 5000;
  rstore.transaction(function () {
    for (let i = 0; i < M; i += 1) {
      rstore.members.put({
        publicKey: K + String(i).padStart(27, '0') + '=',
        publicLabel: 'member-name-' + i,
        claimedAt: new Date().toISOString(),
      });
    }
  });
  const afterMembers = fs.statSync(rfile).size;
  out.perMember = Math.round((afterMembers - out.emptyRelayDb) / M);

  const P = 1000;
  rstore.transaction(function () {
    for (let i = 0; i < P; i += 1) {
      rstore.partners.put({
        relayKey: K + String(500000 + i).padStart(27, '0') + '=',
        url: 'https://relay-' + i + '.example.com',
        ownerKey: K + String(i).padStart(27, '0') + '=',
        status: 'partnered', since: new Date().toISOString(), last: '',
      });
    }
  });
  out.perPartner = Math.round((fs.statSync(rfile).size - afterMembers) / P);
  rstore.close();

  const nh = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-cap-node-'));
  const nstore = nodeStore.open(nh);
  const nfile = path.join(nh, 'relay-state', 'node.db');
  out.emptyNodeDb = fs.statSync(nfile).size;
  const S = 5000;
  for (let i = 0; i < S; i += 1) {
    nstore.seen.put(K + String(i).padStart(27, '0') + '=', {
      at: K + String(900000 + (i % 50)).padStart(27, '0') + '=',
      url: 'https://relay-' + (i % 50) + '.example.com',
      label: 'person-' + i, seen: Date.now(),
    });
  }
  out.perShadowRow = Math.round((fs.statSync(nfile).size - out.emptyNodeDb) / S);
  nstore.close();

  // ── AND THE ONE FILE THAT ONLY GROWS ────────────────────────
  //
  // Everything else a node keeps is bounded — the cache by its cap, the
  // rest by how many people there are. The traffic log is permanent by
  // decision ("the log should be permanent. period." — Andy), so on any
  // disc large enough to matter it is the only number that decides when
  // the disc fills.
  //
  // Written through the real logger rather than by composing a line here,
  // so the measurement includes whatever the logger actually writes.
  const th = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-cap-log-'));
  fs.mkdirSync(path.join(th, 'relay-state'), { recursive: true });
  const traffic = require('../run/js/trafficLog').createTrafficLog({ rootDir: th });
  // A FLOOR, NOT THE FIGURE. These entries are composed here, so they
  // carry a short relay URL and no label; a working node's log measured
  // 438 bytes an entry across 695 real ones. The synthetic number is kept
  // because it moves when the logger's shape moves, which is what this
  // tool is for — but the claims in README/CAPACITY.md use the real one.
  const E = 2000;
  for (let i = 0; i < E; i += 1) {
    traffic.note({
      dir: i % 2 ? 'in' : 'out', kind: i % 2 ? 'reply' : 'request',
      peer: K + String(i % 40).padStart(27, '0') + '=',
      relay: 'https://spirit.example.com',
      hash: 'a'.repeat(64), bytes: 240, status: 200,
    });
  }
  const logFile = path.join(th, 'relay-state', 'traffic.jsonl');
  out.perLogEntry = fs.existsSync(logFile)
    ? Math.round(fs.statSync(logFile).size / E) : 0;
  try { fs.rmSync(th, { recursive: true, force: true }); } catch (e) { /* held */ }

  try { fs.rmSync(rh, { recursive: true, force: true }); } catch (e) { /* held */ }
  try { fs.rmSync(nh, { recursive: true, force: true }); } catch (e) { /* held */ }
  return out;
}

// What a clone actually costs, counted from what git ships rather than
// from the working tree — which also holds media, lab nodes and state.
function shippedBytes() {
  try {
    const listed = String(execSync('git ls-files spirit/run package.json README.md',
      { cwd: REPO, encoding: 'utf8' })).trim().split('\n');
    let total = 0;
    listed.forEach(function (rel) {
      if (!rel) return;
      try { total += fs.statSync(path.join(REPO, rel)).size; } catch (e) { /* gone */ }
    });
    return { files: listed.length, bytes: total };
  } catch (e) { return { files: 0, bytes: 0 }; }
}

// ── RAM, BY RUNNING THE THING ────────────────────────────────────────
function bareNodeRss() {
  const kid = spawn(process.execPath, ['-e', 'setTimeout(function(){}, 10000)'],
    { stdio: 'ignore' });
  kids.push(kid);
  return new Promise(function (done) {
    setTimeout(function () {
      const rss = rssOf(kid.pid);
      try { kid.kill(); } catch (e) { /* gone */ }
      done(rss);
    }, 1200);
  });
}

async function plantedRelay(memberCount) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-cap-live-'));
  const box = createRelay(home);
  auth.saveIdentity(home, auth.generateIdentity('relay'));
  const owner = auth.generateIdentity('owner');
  claimOwner(box, owner, 'owner', 'fx-owner');

  const ids = [];
  for (let i = 0; i < memberCount; i += 1) {
    const name = 'm' + i;
    const id = auth.generateIdentity(name);
    const minted = box.mint('owner', name, 7, '');
    box.claim(name, auth.sign(id.privateKey, auth.claimMessage(name)),
      id.publicKey, 'fx-' + name, minted.invite.token, name);
    ids.push(id);
  }

  const runDir = path.join(home, 'spirit', 'run');
  plantRun.plantRunTree(runDir);
  fs.rmSync(path.join(runDir, 'relay-state'), { recursive: true, force: true });
  fs.cpSync(path.join(home, 'relay-state'), path.join(runDir, 'relay-state'), { recursive: true });
  const stamp = buildStamp.fromGit(REPO);
  if (stamp) buildStamp.write(runDir, stamp);
  return { home: home, runDir: runDir, ids: ids };
}

async function main() {
  const rowOnly = process.argv.slice(2).includes('--row');
  const save = process.argv.slice(2).includes('--save');
  const commit = (function () {
    try { return String(execSync('git rev-parse --short HEAD', { cwd: REPO, encoding: 'utf8' })).trim(); }
    catch (e) { return 'unknown'; }
  }());

  console.log('measuring — this spawns servers and holds sockets, so give it a minute\n');

  const bare = await bareNodeRss();
  const disc = discPerRow();
  const shipped = shippedBytes();

  // A personal node at rest, which is the number a person installing this
  // actually needs.
  const nodeRun = path.join(REPO, 'spirit', 'run');
  const nodeKid = spawn(process.execPath, ['js/server.js', '--port', String(NODE_PORT)],
    { cwd: nodeRun, stdio: ['ignore', 'ignore', 'pipe'] });
  kids.push(nodeKid);
  await sleep(3000);
  const nodeRss = await settledRss(nodeKid.pid);
  try { nodeKid.kill(); } catch (e) { /* gone */ }

  // A relay, then streams against it.
  const w = await plantedRelay(STEPS[STEPS.length - 1]);
  const kid = spawn(process.execPath, ['js/server.js', '--port', String(RELAY_PORT), '--relay'],
    { cwd: w.runDir, stdio: ['ignore', 'ignore', 'pipe'] });
  kids.push(kid);
  let why = '';
  kid.stderr.on('data', function (b) { why += String(b); });
  const base = 'http://127.0.0.1:' + RELAY_PORT;
  if (!(await waitUp(base))) {
    console.log('the relay did not start: ' + (why.trim() || '(nothing on stderr)'));
    cleanup();
    process.exit(1);
  }

  const points = [];
  let opened = 0;
  for (const target of STEPS) {
    while (opened < target) {
      const id = w.ids[opened];
      streams.push(sseClient.connect({
        url: base + '/api/relay/stream?key=' + encodeURIComponent(id.publicKey),
        headers: function () {
          return { 'X-Spirit-Sig': auth.sign(id.privateKey, auth.streamMessage(id.publicKey)) };
        },
        onEvent: function () { /* held open */ },
      }));
      opened += 1;
      if (opened % 50 === 0) await sleep(120);
    }
    await sleep(1500);   // sockets accepted
    points.push({
      n: opened,
      rss: await settledRss(kid.pid),
      kernel: kernelSocketBytes(),
    });
  }

  const first = points[0];
  const a = points[points.length - 2];
  const b = points[points.length - 1];
  const perStream = Math.round((b.rss - a.rss) / (b.n - a.n));
  const relayFixed = first.rss;

  // ── WHAT IT ALL MEANS FOR THE TWO BOXES IN THE QUESTION ───────────
  const HUNDRED_MB = 100 * 1024 * 1024;
  const spiritShare = relayFixed - bare;
  const headroom = HUNDRED_MB - relayFixed;
  const streamsAt100 = headroom > 0 ? Math.floor(headroom / perStream) : 0;
  const membersOnGb = Math.floor(1024 * 1024 * 1024 / disc.perMember);
  const partnersOnGb = Math.floor(1024 * 1024 * 1024 / disc.perPartner);
  const peersOn10Mb = Math.floor(10 * 1024 * 1024 / disc.perShadowRow);

  const out = [];
  const say = function (line) { out.push(line); };

  say('');
  say('measured ' + new Date().toISOString().slice(0, 10) + ', against `' + commit + '`');
  say('on ' + process.platform + ', Node ' + process.version);
  say('');
  say('| minimum to run | |');
  say('|---|---|');
  say('| Node.js | **22.13 or later** (`node:sqlite`, which both stores need) |');
  say('| dependencies | **none** — built-ins only, no `npm install` |');
  say('| RAM, personal node | **' + mb(nodeRss) + ' MB** at rest |');
  say('| RAM, relay | **' + mb(relayFixed) + ' MB** at rest, before any connection |');
  say('| disc, the install | **' + Math.round(shipped.bytes / 1024) + ' KB** in ' + shipped.files + ' files |');
  say('');
  say('| fixed cost | RSS |');
  say('|---|---|');
  say('| bare `node`, nothing loaded | **' + mb(bare) + ' MB** |');
  say('| a personal node at rest | **' + mb(nodeRss) + ' MB** |');
  say('| a relay at rest, 0 streams | **' + mb(relayFixed) + ' MB** |');
  say('| — of which SpiritOS | ~' + mb(spiritShare) + ' MB |');
  say('');
  say('| streams | RSS | over baseline | per stream |');
  say('|---|---|---|---|');
  points.forEach(function (pt) {
    say('| ' + pt.n + ' | ' + mb(pt.rss) + ' MB | ' +
      (pt.n ? Math.round((pt.rss - first.rss) / 1024 / 1024) + ' MB' : '—') + ' | ' +
      (pt.n ? Math.round((pt.rss - first.rss) / pt.n / 1024) + ' KB' : '—') + ' |');
  });
  say('');
  // The two outer segments, so the spread is visible rather than hidden
  // behind one confident figure.
  const early = Math.round((points[2].rss - points[1].rss) / (points[2].n - points[1].n));
  say('**~' + Math.round(perStream / 1024) + ' KB per held stream in the process**, from the slope of' +
    ' the last segment (the 100→200 segment reads ' + Math.round(early / 1024) +
    ' KB, which is the spread to expect).');
  if (b.kernel && first.kernel) {
    const perKernel = Math.round((b.kernel - first.kernel) / b.n);
    say('');
    say('**And ~' + Math.round(perKernel / 1024) + ' KB more in the kernel**, which no RSS figure' +
      ' can see — ' + (process.platform === 'win32'
        ? 'non-paged pool, system-wide, so every driver on the box is in it'
        : '/proc/net/sockstat TCP `mem`, the TCP stack alone') +
      '. **On loopback both endpoints are local**, so a real relay holding one end per' +
      ' member spends nearer half of it.');
    say('');
    say('So the figure a ceiling should be derived from is the **total**, ~' +
      Math.round((perStream + perKernel) / 1024) + ' KB — not the process cost alone,' +
      ' or an owner\'s `ramLimitMB` quietly means something other than what they set.');
  }
  say('`STREAMS_PER_MB = 16` implies ' + Math.round(65536 / 1024) + ' KB, so the guess is ' +
    Math.round((65536 - perStream) / 655.36) + '% ' + (perStream < 65536 ? 'pessimistic' : 'optimistic') + '.');
  say('');
  say('| disc | bytes per row |');
  say('|---|---|');
  say('| relay: a member | **' + disc.perMember + '** |');
  say('| relay: a partner | **' + disc.perPartner + '** |');
  say('| node: a remembered peer | **' + disc.perShadowRow + '** |');
  say('| node: one logged exchange | **' + disc.perLogEntry +
    '** synthetic — a real one averages **438**, see below |');
  say('| an empty `relay.db` / `node.db` | ' + Math.round(disc.emptyRelayDb / 1024) + ' KB / ' +
    Math.round(disc.emptyNodeDb / 1024) + ' KB |');
  say('');
  say('| the two boxes | |');
  say('|---|---|');
  say('| relay, 100 MB RAM | **~' + streamsAt100 + ' members connected at once** (' +
    mb(headroom) + ' MB headroom / ' + Math.round(perStream / 1024) + ' KB) |');
  say('| relay, 1 GB disc | **~' + (membersOnGb / 1000000).toFixed(1) + 'M member rows**, or ~' +
    (partnersOnGb / 1000000).toFixed(1) + 'M partner rows |');
  say('| node, 1 MB RAM | **not possible** — bare Node.js is ' + mb(bare) + ' MB |');
  say('| node, 10 MB disc | **~' + peersOn10Mb.toLocaleString('en-GB') + ' remembered peers** |');
  // 438 B is the measured cost of a REAL entry (695 of them on a working
  // node), not the synthetic one above.
  const REAL_LOG_ENTRY = 438;
  const exchangesOnGb = Math.floor(1024 * 1024 * 1024 / REAL_LOG_ENTRY);
  say('| node, 1 GB disc | **~' + (exchangesOnGb / 1000000).toFixed(1) +
    'M logged exchanges** kept for ever — the cache cap (20 MB) is ' +
    Math.round(20 * 1024 * 1024 / (1024 * 1024 * 1024) * 100) + '% of it |');
  say('');

  if (save) {
    // Named for the OS rather than the runner, because that is what the
    // numbers are about. `os.version()` carries the distribution on Linux
    // and the build on Windows.
    const slug = (process.platform === 'win32' ? 'windows' : 'linux') + '-' +
      String(os.release()).replace(/[^0-9.]/g, '').split('.').slice(0, 2).join('.');
    const dir = path.join(REPO, 'README', 'CAPACITY', slug);
    fs.mkdirSync(dir, { recursive: true });
    const facts = {
      measuredAt: new Date().toISOString(),
      commit: commit,
      platform: process.platform,
      release: os.release(),
      version: (function () { try { return os.version(); } catch (e) { return ''; } }()),
      node: process.version,
      cpus: os.cpus().length,
      totalRamBytes: os.totalmem(),
      bareNodeRss: bare,
      relayAtRestRss: relayFixed,
      nodeAtRestRss: nodeRss,
      perStreamProcessBytes: perStream,
      perStreamKernelBytes: (b.kernel && first.kernel)
        ? Math.round((b.kernel - first.kernel) / b.n) : null,
      kernelCounter: process.platform === 'win32'
        ? 'PoolNonpagedBytes (system-wide)' : '/proc/net/sockstat TCP mem',
      streamSteps: points.map(function (pt) {
        return { n: pt.n, rss: pt.rss, kernel: pt.kernel || null };
      }),
      perMemberRowBytes: disc.perMember,
      perPartnerRowBytes: disc.perPartner,
      perShadowRowBytes: disc.perShadowRow,
      perLogEntryBytesSynthetic: disc.perLogEntry,
      installBytes: shipped.bytes,
      installFiles: shipped.files,
      // SAID IN THE FILE, not only in the README: a figure taken on
      // loopback has both endpoints on one box, so the kernel share is an
      // upper bound for a relay that holds one end per member.
      caveats: [
        'loopback: both socket endpoints are on this machine',
        'idle streams only; an active stream costs more',
        'the kernel counter is not per-process and carries the machine own noise',
      ],
    };
    fs.writeFileSync(path.join(dir, 'capacity.json'), JSON.stringify(facts, null, 2) + '\n');
    // ── A PAGE THAT STANDS ALONE ─────────────────────────────────────
    //
    //   Andy: "the measurement pages per platform must associate date and
    //   commit-level."
    //
    // A file that will be read on its own, months later, beside another
    // platform's, has to say WHAT MACHINE and WHICH TREE without anybody
    // having to work it out. The commit is the load-bearing half: numbers
    // measured three cycles ago are a different claim from today's, and
    // nothing else on the page would show it.
    const head = [
      '# Capacity on `' + slug + '`',
      '',
      '**Measured ' + facts.measuredAt.slice(0, 10) + ', against `' + commit + '`.**',
      '',
      '| | |',
      '|---|---|',
      '| platform | ' + process.platform + ' ' + os.release() + ' |',
      '| version | ' + (facts.version || '—') + ' |',
      '| node | ' + process.version + ' |',
      '| cpus / ram | ' + os.cpus().length + ' / ' + mb(os.totalmem()) + ' MB |',
      '| measured at | ' + facts.measuredAt + ' |',
      '| tree | `' + commit + '` |',
      '',
      '*Read [the conventions](../README.md) before comparing this with',
      'another platform — the kernel column in particular is not the same',
      'quantity on two operating systems.*',
      '',
      '---',
      '',
    ];
    fs.writeFileSync(path.join(dir, 'capacity.md'),
      head.concat(out).join('\n') + '\n');
    console.log('written: README/CAPACITY/' + slug + '/capacity.json');
    console.log('         README/CAPACITY/' + slug + '/capacity.md');
    console.log('');
    console.log(out.join(String.fromCharCode(10)));
  } else if (rowOnly) {
    // ── "TAG THE TREE" ─────────────────────────────────────────────
    //
    //   Andy: "that looks very impressive. lets keep track of this every
    //   time i say 'tag the tree'."
    //
    // One line, in the order the history table's columns run, so drift
    // between two points in the tree is a line to read rather than two
    // documents to compare.
    //
    // The platform and Node's version travel with every row, because
    // these are not portable numbers: the RSS figures are Windows
    // WorkingSet64, and the floor under all of them is whatever that
    // runtime costs.
    console.log('| ' + [
      new Date().toISOString().slice(0, 10),
      '`' + commit + '`',
      process.platform + ' / ' + process.version,
      Math.round(perStream / 1024) + ' KB',
      mb(bare) + ' MB',
      mb(relayFixed) + ' MB',
      mb(nodeRss) + ' MB',
      disc.perMember + ' / ' + disc.perShadowRow + ' B',
      Math.round(shipped.bytes / 1024) + ' KB',
    ].join(' | ') + ' |');
  } else {
    console.log(out.join('\n'));
  }

  cleanup();
  await sleep(300);
  try { fs.rmSync(w.home, { recursive: true, force: true }); } catch (e) { /* held */ }
  process.exit(0);
}

main().catch(function (e) {
  console.log('failed: ' + (e && e.stack ? e.stack : e));
  cleanup();
  process.exit(1);
});
