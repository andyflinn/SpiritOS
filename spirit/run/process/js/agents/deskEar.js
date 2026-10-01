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
// WHAT IT READS. Andy's desk.db, read-only: his records (every press but seen, his chat), the other agent's chat
// writes, and the lines Desk keeps (his Team and direct lines, the agents' lines to him). A direct line he sent to
// the other agent is left out (the peer key on the line says who it was for). It reads the file rather than asking
// the desk server: a gap, named, until Desk can tell an agent what changed since a change number.
//
//   node deskEar.js --db <Andy's desk.db> --self <claude-windows|wsl-claude> [--once]
//
// Where it stopped is kept in <AGENTS_ROOT>/relay-state/deskEar.<self>.json, so a restart misses nothing.

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

function arg(name) { const i = process.argv.indexOf(name); return i !== -1 ? String(process.argv[i + 1] || '') : ''; }
const DB = arg('--db') || process.env.DESK_DB || '';
const SELF = arg('--self') || process.env.AGENTS_SELF || '';
const ONCE = process.argv.indexOf('--once') !== -1;
const ROOT = process.env.AGENTS_ROOT || path.join(__dirname, '..', '..', '..');
if (!DB || !SELF) {
  console.error('deskEar: needs --db <path to the desk server\'s database> and --self <agent name>');
  process.exit(2);
}
const STATE = path.join(ROOT, 'relay-state', 'deskEar.' + SELF + '.json');

// This agent's own key, to tell a line meant for it from one meant for the other agent.
let selfKey = '';
try { selfKey = String(JSON.parse(fs.readFileSync(path.join(ROOT, 'relay-state', 'identity.json'), 'utf8')).publicKey || ''); } catch (e) { selfKey = ''; }

let st = {};
try { st = JSON.parse(fs.readFileSync(STATE, 'utf8')) || {}; } catch (e) { st = {}; }
function save() { try { fs.writeFileSync(STATE, JSON.stringify(st)); } catch (e) { /* the next pass tries again */ } }

function open() { return new DatabaseSync(DB, { readOnly: true }); }
try {
  const db = open();
  if (st.n === undefined) st.n = db.prepare('select max(n) m from records').get().m || 0;
  if (st.line === undefined) st.line = db.prepare('select max(rowid) m from lines').get().m || 0;
  db.close();
  save();
} catch (e) { /* busy or not there yet: the loop below retries */ }

function pass() {
  const out = [];
  try {
    const db = open();
    if (st.n === undefined) st.n = 0;
    if (st.line === undefined) st.line = 0;
    db.prepare('select n, verb, by, body from records where n > ? order by n').all(st.n).forEach(function (r) {
      st.n = r.n;
      if (r.by === 'andy') {
        if (r.verb === 'press' && /"what":"seen"/.test(r.body)) return;
        out.push('DESK andy ' + r.verb + ' ' + String(r.body).slice(0, 4000));
      } else if (r.by && r.by !== SELF && r.verb === 'chat.add') {
        out.push('DESK ' + r.by + ' chat.add ' + String(r.body).slice(0, 4000));
      }
    });
    db.prepare('select rowid, sender, todo, kind, body, line from lines where rowid > ? order by rowid').all(st.line).forEach(function (r) {
      st.line = r.rowid;
      if (r.sender === SELF) return;
      let peer = '';
      try { peer = String(JSON.parse(r.line).peer || ''); } catch (e) { peer = ''; }
      // His direct line to the other agent is not this agent's; his Team lines come once per recipient.
      if (r.sender === 'andy' && selfKey && peer && peer !== selfKey) return;
      if (r.sender === 'andy' || /claude/.test(String(r.sender))) {
        out.push('LINE ' + r.sender + ' ' + (r.kind || '') + (r.todo ? ' todo ' + r.todo : '') + ': ' + String(r.body || '').slice(0, 4000));
      }
    });
    db.close();
  } catch (e) { /* busy: next pass */ }
  save();
  return out;
}

setInterval(function () {
  const out = pass();
  if (!out.length) return;
  const seen = {};
  out.forEach(function (l) { if (!seen[l]) { seen[l] = true; console.log(l); } });
  if (ONCE) process.exit(0);
}, 3000);
