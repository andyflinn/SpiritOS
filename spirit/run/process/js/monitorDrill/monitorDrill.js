'use strict';

// spirit/run/process/js/monitorDrill/monitorDrill.js
// A SERIES OF BATCHES ANDY CAN WATCH, AND ASK FOR AGAIN.
//
//   Andy, 2026-09-23: "a series of batch test that you can run without me
//   over spirit 3, where i can optionally set filters, and tell you run it
//   again! watching with different filters"
//
// The Relay Monitor's traffic console is a pane that can only be judged
// by watching something move through it (design/relay/RELAY-MONITOR.md).
// This is the something: real posts through spirit.andyflinn.com, in
// named phases with different shapes, run from an agent's own node and
// repeatable on his word — so he can set one filter, say "again", and
// see the same traffic through a different lens.
//
//   node process/js/monitorDrill/monitorDrill.js            the whole series
//   node process/js/monitorDrill/monitorDrill.js --phase 3  one of them
//   node process/js/monitorDrill/monitorDrill.js --list      what they are
//   node process/js/monitorDrill/monitorDrill.js --dry-run   nothing sent
//
// ── WHAT IT WILL AND WILL NOT DO ON A LIVE RELAY ────────────────────
//
// It posts, and that is all. It does not mint, claim, revoke, remove,
// rename another member or restart anything: those are membership acts on
// Andy's own relay and belong to him, not to a drill he asked to be
// repeatable. What it produces is TRAFFIC — accepted and refused — which
// is exactly what the console draws.
//
// Bounded the same way `agents.js chatter` is: well under the relay's 600
// posts a minute per member (relay.js, MEMBER_PER_MIN), and every post is
// written to both nodes' PERMANENT traffic logs, which is why the texts
// are short and the phases are small.
//
// It obeys the halt: the agents program refuses to send while Andy has
// stopped the network, and this goes through that same door.

const path = require('path');
const agents = require(path.join(__dirname, '..', 'agents', 'agents.js'));

// ── THE PHASES ───────────────────────────────────────────────────────
//
// Each has a SHAPE he can recognise on the screen without reading a word
// of payload — which is the whole claim of the console: *"just seeing
// your back and forth with it's timing tells me things."*
const PHASES = [
  {
    name: 'quiet',
    what: 'nothing at all, for ten seconds — so the pane has a floor to compare against',
    run: async function (ctx) { await ctx.sleep(10000); return 0; },
  },
  {
    name: 'trickle',
    what: 'one post every two seconds, six of them — a conversation\'s pace',
    run: function (ctx) { return ctx.burst(6, 2000, 'trickle'); },
  },
  {
    name: 'burst',
    what: 'twenty posts, 200 ms apart — what a working exchange looks like',
    run: function (ctx) { return ctx.burst(20, 200, 'burst'); },
  },
  {
    name: 'refusals',
    what: 'six posts to a key that is on no relay — the console\'s refused lines',
    run: function (ctx) { return ctx.burst(6, 500, 'to-nobody', ctx.nowhere); },
  },
  {
    // ── THE ONE THAT PROVES A FILTER ────────────────────────────────
    //
    //   Andy, 2026-09-23: "test batches of packets sent crosswise in one
    //   test batch so i can test filters over the same set of packets,
    //   while also being able to see packet counts per id etc...."
    //
    // Every other phase produces traffic to look at. This one produces
    // EVIDENCE: one interleaved batch across every peer, with a
    // DIFFERENT COUNT for each, so the count alone says which filter is
    // in force. Filter by the second node and see seven; by the first and
    // see twelve; by nobody and see all of them.
    //
    // That is the whole test, and it is arithmetic rather than
    // impression: if the drill says twelve and the pane shows eleven,
    // the filter is broken and the number says so.
    //
    // Interleaved on purpose. Sent in blocks, a filter could pass by
    // showing a contiguous run; mixed in time, only a filter that reads
    // each packet's identity can reproduce the count.
    name: 'crosswise',
    what: 'one interleaved batch to every peer, a different count each — filter by any of them and check the number',
    run: async function (ctx) {
      const plan = ctx.peers.map(function (p, i) { return { to: p, want: 12 - i * 5 > 0 ? 12 - i * 5 : 3 }; });
      plan.push({ to: ctx.nowhere, want: 4, label: 'nobody (refused)' });
      // Round-robin, so nothing arrives in a block.
      const queue = [];
      plan.forEach(function (row) {
        for (let i = 1; i <= row.want; i += 1) queue.push(row);
      });
      for (let i = queue.length - 1; i > 0; i -= 1) {
        const j = (i * 7 + 3) % (i + 1); // deterministic shuffle: same order every run
        const t = queue[i]; queue[i] = queue[j]; queue[j] = t;
      }
      let sent = 0;
      for (let i = 0; i < queue.length; i += 1) {
        sent += await ctx.burst(1, 0, 'crosswise', queue[i].to);
        await ctx.sleep(250);
      }
      ctx.tally(plan);
      return sent;
    },
  },
  {
    name: 'mixed',
    what: 'fifteen posts at an uneven pace, some refused — the shape of a real hour',
    run: async function (ctx) {
      let sent = 0;
      for (let i = 1; i <= 15; i += 1) {
        const doomed = i % 4 === 0;
        sent += await ctx.burst(1, 0, doomed ? 'mixed-refused' : 'mixed', doomed ? ctx.nowhere : undefined);
        await ctx.sleep(i % 3 === 0 ? 1500 : 300);
      }
      return sent;
    },
  },
];

// A key nobody holds: the refusals are the relay saying "no such peer",
// which is a real answer to a real post and the one way to make the
// console's refused lines appear without troubling anybody.
const NOWHERE = 'MCowBQYDK2VwAyEA' + 'A'.repeat(27) + '=';

function flags(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dry-run') out.dryRun = true;
    else if (argv[i] === '--list') out.list = true;
    else if (argv[i].startsWith('--')) { out[argv[i].slice(2)] = argv[i + 1]; i += 1; }
  }
  return out;
}

function stamp() { return new Date().toISOString().slice(11, 19); }

async function main() {
  const f = flags(process.argv.slice(2));
  const cfg = agents.config();
  const to = f.to || Object.keys(cfg.peers)[0];

  if (f.list || !to) {
    if (!to && !f.list) console.log('no peer to post to — set AGENTS_PEERS, or pass --to <name|key>\n');
    PHASES.forEach(function (p, i) { console.log((i + 1) + '. ' + p.name + ' — ' + p.what); });
    return;
  }

  const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  // Every peer this node knows, so the crosswise phase has more than one
  // identity to discriminate between — Andy: "i want to be able to filter
  // by either one of you or any of your local persistent nodes, that i
  // have a choice of ID's to filter by".
  const peers = Object.keys(cfg.peers).length ? Object.keys(cfg.peers) : [to];
  const ctx = {
    sleep: sleep,
    nowhere: NOWHERE,
    peers: peers,
    // WHAT WAS SENT, PER IDENTITY, PRINTED WHERE HE CAN SEE IT. The
    // number on the screen either matches this or the filter is wrong;
    // there is no third outcome and nothing to interpret.
    tally: function (plan) {
      console.log('');
      console.log('    what this batch sent — filter by one and the pane should show exactly this:');
      plan.forEach(function (row) {
        const name = row.label || row.to;
        const key = cfg.peers[row.to] || row.to;
        const tail = row.to === NOWHERE ? '(a key nobody holds)'
          : (key && key !== name ? String(key).slice(-10) : '');
        console.log('      ' + String(row.want).padStart(3) + '  ' + name + (tail ? '   ' + tail : ''));
      });
      console.log('      ' + String(plan.reduce(function (n, r) { return n + r.want; }, 0)).padStart(3) +
        '  total, unfiltered');
      console.log('');
    },
    burst: async function (n, every, tag, target) {
      let ok = 0;
      for (let i = 1; i <= n; i += 1) {
        if (f.dryRun) { ok += 1; }
        else {
          const r = await agents.send(cfg, target || to, 'note',
            'drill ' + tag + ' ' + i + '/' + n + ' from ' + cfg.self);
          if (r && r.ok) ok += 1;
        }
        if (i < n && every) await sleep(every);
      }
      return ok;
    },
  };

  const only = f.phase ? Number(f.phase) : null;
  const chosen = only ? [PHASES[only - 1]].filter(Boolean) : PHASES;
  if (!chosen.length) { console.log('no such phase: ' + f.phase); process.exitCode = 1; return; }

  console.log(stamp() + '  drill starts — ' + chosen.length + ' phase(s), to ' + to +
    (f.dryRun ? '  [DRY RUN, nothing is sent]' : ''));
  for (let i = 0; i < chosen.length; i += 1) {
    const p = chosen[i];
    console.log(stamp() + '  ' + p.name + ' — ' + p.what);
    const sent = await p.run(ctx);
    console.log(stamp() + '  ' + p.name + ' done: ' + sent + ' post(s)');
    if (i < chosen.length - 1) await sleep(3000);
  }
  console.log(stamp() + '  drill ends. Say "again" and it runs the same series.');
}

main().catch(function (e) {
  console.error('drill failed: ' + String(e && e.message ? e.message : e));
  process.exitCode = 1;
});

module.exports = { PHASES: PHASES, NOWHERE: NOWHERE };
