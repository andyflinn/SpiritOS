'use strict';

// spirit/test/cycleCitations.js
// A REQUIREMENT IS CITED WITH ITS CYCLE (ANDYS_RULES_FOR_AGENTS.md, cycle
// rule 13).
//
//   Andy, 2026-09-22: "so you want to institue a reference system for
//   agents, and bundle related decision-request to me in english?" —
//   "yes."
//
// Every cycle numbers its requirements from R1, so a bare "R16" names a
// different requirement in different cycles. The gap cycle found it
// (A-CORRESPONDENT-NODE.md cited another cycle's R16 two sections from the
// queue's) and set a gate for it at the end of its cycle 8; this is what
// that gate decided.
//
// ── WHAT COUNTS AS BARE ──────────────────────────────────────────────
//
// An R-number that more than one cycle defines, on a line that names no
// cycle — neither the word "cycle" nor a cycle's tag (TAGS, below). An
// R-number only one cycle defines is not ambiguous and is not counted.
//
// ── A TALLY, THE SHAPE oneDoor.js USES ──────────────────────────────
//
// 290 were bare, in 84 files, when the rule was made. Fixing them by hand means working
// out, for each, which cycle it meant — slow, and a wrong guess is worse
// than a bare number. So each file's count may FALL and may never RISE, a
// file not in the tally must have none, and the old ones are fixed when
// that code is touched anyway. When a count falls, lower it here in the
// same commit: a tally that is not lowered is room for the next one.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const REPO = path.join(__dirname, '..', '..');
const CYCLES = path.join(REPO, 'design', 'cycles');

// A cycle's short name, for citing: "gap R13", "governor R2".
const TAGS = ['gap', 'governor', 'hints', 'disc', 'labels', 'transport', 'defence', 'app-building'];

// What is scanned: code, tests and the documents that cite requirements.
// The cycle files themselves are where the numbers are defined, and are
// read as their own cycle's context.
const ROOTS = ['spirit/run/js', 'spirit/run/app', 'spirit/run/process', 'spirit/test', 'design', 'README'];
const FILES = ['AGENT.md', 'CLAUDE.md', 'ANDYS_RULES_FOR_AGENTS.md', 'DICTIONARY.md'];
// `grok`: design/reviews/grok/ holds Grok's replies VERBATIM — an outside
// voice's words are quoted, never corrected, so its citations are not ours
// to fix (2026-09-22, the first API review).
const SKIP_DIRS = ['node_modules', 'cycles', 'brains', 'relay-state', 'visual', 'grok'];

// ── THE TALLY, AS FOUND ON 2026-09-22 ───────────────────────────────
// file -> bare citations allowed. May only go down.
const TALLY = {
  'AGENT.md': 1,
  'ANDYS_RULES_FOR_AGENTS.md': 1,
  'DICTIONARY.md': 4,
  'README/CAPACITY.md': 1,
  'design/README.md': 2,
  'design/andy/relayStorage.md': 6,
  'design/andy/spiritNodeAPI.md': 5,
  'design/decisions/0010-fix-the-protocol-or-name-the-cheat.md': 8,
  'design/decisions/0018-the-route-cache-belongs-to-the-machine.md': 1,
  'design/decisions/0021-choosing-is-a-mark-on-what-the-machine-remembers.md': 1,
  'design/principles/A-CORRESPONDENT-NODE.md': 2,
  'design/principles/NODE-AND-RELAY.md': 1,
  'design/relay/CAPACITY.md': 3,
  'design/relay/PARTNERS.md': 1,
  'design/relay/REQUEST-BUDGET.md': 1,
  'design/relay/WHAT-A-NODE-KNOWS.md': 1,
  'design/shell/OBJECT-PRESENTATION.md': 1,
  'spirit/run/app/contacts/contacts.js': 1,
  'spirit/run/app/info/info.js': 1,
  'spirit/run/app/natter/natter.js': 5,
  'spirit/run/app/natterDetails/natterDetails.js': 7,
  'spirit/run/js/client/shell.js': 2,
  'spirit/run/js/hub.js': 10,
  'spirit/run/js/nodeStore.js': 2,
  'spirit/run/js/ownerBadge.js': 5,
  'spirit/run/js/peerPost.js': 6,
  'spirit/run/js/presenceNode.js': 1,
  'spirit/run/js/relay.js': 35,
  'spirit/run/js/relayAuth.js': 5,
  'spirit/run/js/relayServer.js': 4,
  'spirit/run/js/relayStatus.js': 1,
  'spirit/run/js/relayStore.js': 1,
  'spirit/run/js/server.js': 6,
  'spirit/run/js/spiritErrors.js': 1,
  'spirit/run/js/trafficLog.js': 4,
  'spirit/test/arrivals.js': 2,
  'spirit/test/chatPeople.js': 10,
  'spirit/test/contacts.js': 1,
  'spirit/test/cycleA.js': 5,
  'spirit/test/deviceDisplace.js': 2,
  'spirit/test/deviceEnrol.js': 2,
  'spirit/test/deviceInbox.js': 1,
  'spirit/test/devicePeers.js': 3,
  'spirit/test/hubPost.js': 2,
  'spirit/test/inviteMint.js': 1,
  'spirit/test/invites.js': 2,
  'spirit/test/labMaster/STATE.md': 1,
  'spirit/test/labPersistence.js': 1,
  'spirit/test/labPopulate.js': 3,
  'spirit/test/labWorld.js': 1,
  'spirit/test/labelIsOwned.js': 1,
  'spirit/test/liveFanOut.js': 1,
  'spirit/test/liveFrontDoor.js': 4,
  'spirit/test/liveRelay.js': 1,
  'spirit/test/memberBroadcast.js': 1,
  'spirit/test/natterBind.js': 2,
  'spirit/test/natterDetails.js': 15,
  'spirit/test/nodeStore.js': 5,
  'spirit/test/ownerLog.js': 5,
  'spirit/test/partnerGate.js': 2,
  'spirit/test/partnerTunnel.js': 1,
  'spirit/test/partnerWire.js': 1,
  'spirit/test/playPopulate.js': 1,
  'spirit/test/postQueue.js': 32,
  'spirit/test/presenceStream.js': 2,
  'spirit/test/protocolSurface.js': 1,
  'spirit/test/queueUnderLoad.js': 3,
  'spirit/test/relayGates.js': 1,
  'spirit/test/relayMeter.js': 1,
  'spirit/test/relayMonitor.js': 3,
  'spirit/test/relayProbe.js': 2,
  'spirit/test/relayStore.js': 8,
  'spirit/test/removePeer.js': 2,
  'spirit/test/routeHints.js': 3,
  'spirit/test/routeStash.js': 1,
  'spirit/test/scenario.js': 1,
  'spirit/test/seenPeers.js': 2,
  'spirit/test/serverSurface.js': 1,
  'spirit/test/shutdownWire.js': 1,
  'spirit/test/streamSig.js': 4,
  'spirit/test/targetBusy.js': 2,
  'spirit/test/world.js': 3,
  'spirit/test/worldBuilder.js': 2,
};

function ambiguousIds() {
  const owners = {};
  fs.readdirSync(CYCLES).filter(function (f) { return f.endsWith('.md') && f !== 'README.md'; })
    .forEach(function (f) {
      const s = fs.readFileSync(path.join(CYCLES, f), 'utf8');
      (s.match(/^### (R\d+)\b/gm) || []).forEach(function (h) {
        const r = h.slice(4);
        (owners[r] = owners[r] || new Set()).add(f);
      });
    });
  const out = new Set();
  Object.keys(owners).forEach(function (r) { if (owners[r].size > 1) out.add(r); });
  return out;
}

function walk(rel, into) {
  const abs = path.join(REPO, rel);
  let st;
  try { st = fs.statSync(abs); } catch (e) { return; }
  if (st.isFile()) { into.push(rel); return; }
  fs.readdirSync(abs).forEach(function (name) {
    if (SKIP_DIRS.indexOf(name) !== -1) return;
    const child = rel + '/' + name;
    const cst = fs.statSync(path.join(REPO, child));
    if (cst.isDirectory()) walk(child, into);
    else if (/\.(js|md|html|json)$/.test(name)) into.push(child);
  });
}

const NAMES_A_CYCLE = new RegExp('cycle|\\b(' + TAGS.join('|') + ')\\b', 'i');

function bareIn(file, ambiguous) {
  const text = fs.readFileSync(path.join(REPO, file), 'utf8');
  let n = 0;
  text.split(/\r?\n/).forEach(function (line) {
    if (NAMES_A_CYCLE.test(line)) return;
    (line.match(/\bR\d{1,2}\b/g) || []).forEach(function (id) { if (ambiguous.has(id)) n += 1; });
  });
  return n;
}

function count() {
  const ambiguous = ambiguousIds();
  const files = [];
  ROOTS.forEach(function (r) { walk(r, files); });
  FILES.forEach(function (f) { if (fs.existsSync(path.join(REPO, f))) files.push(f); });
  const found = {};
  files.forEach(function (f) {
    if (f === 'spirit/test/cycleCitations.js') return;
    const n = bareIn(f, ambiguous);
    if (n) found[f] = n;
  });
  return { ambiguous: ambiguous, found: found };
}

module.exports = { count: count, TAGS: TAGS };

if (require.main === module) {
  if (process.argv.includes('--print')) {
    const r = count();
    console.log(JSON.stringify(r.found, Object.keys(r.found).sort(), 2));
    process.exit(0);
  }

  test.startTest('A requirement is cited with its cycle');

  const r = count();
  if (r.ambiguous.size > 0) {
    test.check(r.ambiguous.size + ' R-numbers are defined by more than one cycle, so a bare one is ambiguous');
  } else {
    test.fail('no ambiguous R-numbers found — the cycle files were not read');
  }

  const rose = [];
  const fell = [];
  Object.keys(r.found).forEach(function (f) {
    const allowed = TALLY[f] || 0;
    if (r.found[f] > allowed) rose.push(f + ': ' + r.found[f] + ' (tally ' + allowed + ')');
    else if (r.found[f] < allowed) fell.push(f + ': ' + r.found[f] + ' (tally ' + allowed + ')');
  });
  Object.keys(TALLY).forEach(function (f) {
    if (!r.found[f]) fell.push(f + ': 0 (tally ' + TALLY[f] + ')');
  });

  if (!rose.length) {
    test.check('no file cites more bare R-numbers than the tally allows — name the cycle: "gap R13"');
  } else {
    test.fail('bare R-numbers added — name the cycle beside the number ("gap R13", "cycle 3\'s R5"):\n  ' + rose.join('\n  '));
  }
  if (!fell.length) {
    test.check('and the tally is exact: every count that fell has been lowered');
  } else {
    test.fail('counts fell — lower the tally in the same commit, so the room is not reused:\n  ' + fell.join('\n  '));
  }

  const total = Object.keys(r.found).reduce(function (a, f) { return a + r.found[f]; }, 0);
  test.comment(total + ' bare citations left in ' + Object.keys(r.found).length + ' files');
  test.reportSuccessFailureCount();
}
