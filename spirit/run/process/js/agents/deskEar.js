'use strict';

// spirit/run/process/js/agents/deskEar.js
// THE AGENT'S DESK LISTENER: exits on the next thing meant for this agent, so the agent wakes.
//
//   Andy, 2026-10-01: "ideally agents just listen do desk in a loop. this loop ends only when i close vscode.",
//   then "just put that listener script in the repo, at an appropriate place and notify wsl to pull/sync, reread
//   the rep's md's and use the listener script." The loop is AGENT.md's (Since Desk, idle means listening to Desk).
//
// WHY IT EXITS. An agent thinks only when a turn starts: when Andy types in its window or a background job of its
// own finishes. So the agent runs this in the background with --once; it prints what arrived and exits, the exit
// wakes the agent, the agent answers in Desk and starts it again.
//
// WHAT IT ASKS (apiAuth/G1.12). Desk's `changes { n, line }` over peerPost, through agents.js's deskAsk, from
// wherever the agent is: the records after change n and the lines after rowid line. Andy: "dsek needs an interface
// for that. desk can't serve agents at different locations otherwise". It asks when Desk's bare `changed` nudge
// reaches the agent's own node, and every 30 s besides, for a missed nudge and for the other agent's writes, which
// nudge nobody.
//
// WHAT IT PRINTS. Andy's records (every press but seen, his chat), the other agent's chat writes, and the lines
// Desk keeps (his Team and direct lines, the agents' lines to him), less his direct lines to the other agent (the
// peer key on the line says who it was for).
//
//   node deskEar.js --self <claude-windows|wsl-claude> [--once]      (AGENTS_NODE and AGENTS_CONTROL set, as for agents.js)
//
// Where it stopped is kept in <AGENTS_ROOT>/relay-state/deskEar.<self>.json, so a restart misses nothing.

const fs = require('fs');
const path = require('path');
const agents = require('./agents.js');

function arg(name) { const i = process.argv.indexOf(name); return i !== -1 ? String(process.argv[i + 1] || '') : ''; }
const ONCE = process.argv.indexOf('--once') !== -1;
const POLL_MS = 30000;
const BIG = Number.MAX_SAFE_INTEGER;

let cfg;
try { cfg = agents.config(); } catch (e) { console.error('deskEar: ' + e.message); process.exit(2); }
cfg.self = arg('--self') || cfg.self;
if (!cfg.control) { console.error('deskEar: AGENTS_CONTROL is not set: no node of Andy\'s to ask'); process.exit(2); }
const STATE = path.join(cfg.root, 'relay-state', 'deskEar.' + cfg.self + '.json');

// This agent's own key, to tell a line meant for it from one meant for the other agent.
let selfKey = '';
try { selfKey = String(JSON.parse(fs.readFileSync(path.join(cfg.root, 'relay-state', 'identity.json'), 'utf8')).publicKey || ''); } catch (e) { selfKey = ''; }

let st = {};
try { st = JSON.parse(fs.readFileSync(STATE, 'utf8')) || {}; } catch (e) { st = {}; }
function save() { try { fs.writeFileSync(STATE, JSON.stringify({ n: st.n, line: st.line })); } catch (e) { /* the next pass tries again */ } }

function ask(n, line) {
  return agents.deskAsk(cfg, 'changes', JSON.stringify({ n: n, line: line })).then(function (b) {
    if (!b || b.ok === false || !Array.isArray(b.records)) throw new Error('changes refused: ' + JSON.stringify(b).slice(0, 200));
    return b;
  });
}

// A FIRST RUN STARTS AT NOW, not at the beginning: each cursor is found by halving, the smallest value after
// which nothing more is answered (some thirty asks each, once).
function lastOf(which) {
  let lo = 0;
  let hi = 1;
  const after = function (v) { return (which === 'n' ? ask(v, BIG) : ask(BIG, v)).then(function (b) { return (which === 'n' ? b.records : b.lines).length > 0; }); };
  function grow() { return after(hi).then(function (more) { if (!more) return null; lo = hi; hi = hi * 2; return grow(); }); }
  function halve() {
    if (lo >= hi) return Promise.resolve(hi);
    const mid = Math.floor((lo + hi) / 2);
    return after(mid).then(function (more) { if (more) lo = mid + 1; else hi = mid; return halve(); });
  }
  return grow().then(halve);
}

function printable(b) {
  const out = [];
  b.records.forEach(function (r) {
    if (r.by === 'andy') {
      if (r.verb === 'press' && /"what":"seen"/.test(r.body)) return;
      out.push('DESK andy ' + r.verb + ' ' + String(r.body).slice(0, 4000));
    } else if (r.by && r.by !== cfg.self && r.verb === 'chat.add') {
      out.push('DESK ' + r.by + ' chat.add ' + String(r.body).slice(0, 4000));
    }
  });
  (b.lines || []).forEach(function (l) {
    const sender = String(l.from || '');
    if (sender === cfg.self) return;
    // His direct line to the other agent is not this agent's; his Team lines come once per recipient.
    if (sender === 'andy' && selfKey && l.peer && l.peer !== selfKey) return;
    if (sender === 'andy' || /claude/.test(sender)) {
      out.push('LINE ' + sender + ' ' + (l.kind || '') + (l.todo ? ' todo ' + l.todo : '') + ': ' + String(l.text || '').slice(0, 4000));
    }
  });
  return out;
}

let busy = false;
let again = false;
function pass() {
  if (busy) { again = true; return; }
  busy = true;
  const out = [];
  function step() {
    return ask(st.n, st.line).then(function (b) {
      printable(b).forEach(function (l) { if (out.indexOf(l) === -1) out.push(l); });
      st.n = b.n; st.line = b.line;
      save();
      if (b.more) return step();
      return null;
    });
  }
  step().then(function () {
    busy = false;
    if (out.length) { out.forEach(function (l) { console.log(l); }); if (ONCE) process.exit(0); }
    if (again) { again = false; pass(); }
  }, function (e) {
    busy = false;
    console.error('deskEar: ' + e.message);
  });
}

const ready = (typeof st.n === 'number' && typeof st.line === 'number')
  ? Promise.resolve()
  : Promise.all([lastOf('n'), lastOf('line')]).then(function (c) { st.n = c[0]; st.line = c[1]; save(); });

ready.then(function () {
  // Desk's nudge, or any packet for this agent on its own node: ask now.
  agents.listen(cfg, function (line) { if (!/^listening on/.test(line)) pass(); }).catch(function (e) { console.error('deskEar: the node stream: ' + e.message); });
  setInterval(pass, POLL_MS);
  pass();
}, function (e) { console.error('deskEar: could not find where Desk stands: ' + e.message); process.exit(1); });
