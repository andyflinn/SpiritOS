'use strict';

// spirit/run/process/js/deskClient/publishData.js
// ONE MEASUREMENT RUN PER AGENT, ITS DATA IN agents/<agent>/ — goal/G4.33.
//
//   Andy, 2026-10-04: "so one single script for all of you puts the data into the repo"; "this is desk stuff."; "it
//   will be automated under deskClient. so the deskClient scripts calls - spirit/test/measurePlatform.js?";
//   "publishData.js?"; "automated publishing will have a standing grant, attached to the script in deskClient"; to N:
//   "that's a fine number" (20). The box of goal/G4.33 holds every line.
//
// Run by the agent in its own clone, with its own node up (the node runs from <clone>/spirit/run):
//
//   node spirit/run/process/js/deskClient/publishData.js <port> [--asks N] [--only packets] [--out <dir>]
//
//   1  unless --only packets: spirit/test/measurePlatform.js --agent <agent> (harness, capacity) into agents/<agent>/
//   2  N read-only desk asks (scope.get) from this node, then their figures from its own traffic log: packets.json
//      {posts, waitMs {median, max}, flight {median, max}, retried, refusals} and packets.md; platform.md names the
//      agent, the commit and the box
//   3  unless --only packets or --out: commits agents/<agent>/ (the commit check's standing grant takes a commit whose
//      files all lie there) and posts one summary line to Desk
// The agent is the name Andy set in its profile (profile.get). The traffic log is read from a copy of
// <clone>/spirit/run/relay-state/node.db, read only: the node holds the file open, and no verb reads that log.
// Exits: 0 done; 1 a step failed (the reason printed); 2 usage.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const kernel = require('../../../js/kernel.js');

const USAGE = 'usage: node publishData.js <port of the agent\'s own node> [--asks N] [--only packets] [--out <dir>]';
const NODE_WAIT_MS = 20000;
const DEFAULT_ASKS = 20;

const argv = process.argv.slice(2);
const port = Number(argv[0]);
function flag(name) { const i = argv.indexOf(name); return i === -1 ? '' : String(argv[i + 1] || ''); }
if (!Number.isInteger(port) || port <= 0) { console.error(USAGE); process.exit(2); }
const asks = Math.max(1, Number(flag('--asks')) || DEFAULT_ASKS);
const packetsOnly = flag('--only') === 'packets';
const outArg = flag('--out');
const node = 'http://127.0.0.1:' + port;

function end(code, text) { (code ? console.error : console.log)(text); process.exit(code); }
function say(text) { console.log('publishData: ' + text); }
function git(args, cwd) { return spawnSync('git', args, { cwd: cwd, encoding: 'utf8', windowsHide: true }); }

function ask(verb, args) {
  let timer = null;
  const late = new Promise(function (resolve, reject) { timer = setTimeout(function () { reject(new Error('no answer in ' + NODE_WAIT_MS / 1000 + ' s')); }, NODE_WAIT_MS); });
  return Promise.race([kernel.core.ask(verb, args, node), late]).then(function (r) { clearTimeout(timer); return r || {}; },
    function (e) { clearTimeout(timer); end(1, 'publishData: the node on port ' + port + ' did not answer ' + verb + ': ' + ((e && e.message) || e)); });
}
function desk(verb, args) { return ask('jobs.api', { ask: { deskClient: { desk: { verb: verb, json: JSON.stringify(args) } } } }); }
function ok(r) { return r && r.status === 200 && r.body && r.body.ok !== false; }

function median(a) { if (!a.length) return 0; const s = a.slice().sort(function (x, y) { return x - y; }); return s[Math.floor(s.length / 2)]; }
function max(a) { return a.length ? Math.max.apply(null, a) : 0; }

// The node's traffic rows since `sinceIso`, closing rows only, from a read-only copy of its node.db.
function closingRows(clone, sinceIso) {
  const src = path.join(clone, 'spirit', 'run', 'relay-state', 'node.db');
  if (!fs.existsSync(src)) end(1, 'publishData: no traffic log at ' + src + ' (is the node run from this clone?)');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-publishdata-'));
  const copy = path.join(tmp, 'node.db');
  ['', '-wal', '-shm'].forEach(function (x) { if (fs.existsSync(src + x)) fs.copyFileSync(src + x, copy + x); });
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(copy, { readOnly: true });
  try {
    return db.prepare("SELECT outcome, code, ms, extra FROM traffic WHERE at >= ? AND " +
      "((dir = 'in' AND kind = 'reply') OR (dir = 'out' AND kind = 'request' AND outcome IN ('refused', 'no-answer')))").all(sinceIso)
      .map(function (r) { let x = {}; try { x = r.extra ? JSON.parse(r.extra) : {}; } catch (e) { x = {}; } return { outcome: r.outcome, code: r.code || '', ms: Number(r.ms) || 0, waitMs: x.waitMs, attempts: x.attempts }; });
  } finally {
    db.close();
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* the OS clears tmp */ }
  }
}

// agents/<agent>/README.md: the folder's front page, rewritten on every run from the files themselves, so it never
// goes stale. Each file with the date and commit it was measured at, and the studies by their dated folders.
function writeIndex(out, agent) {
  const read = function (f) { try { return JSON.parse(fs.readFileSync(path.join(out, f), 'utf8')); } catch (e) { return null; } };
  const when = function (j) { return j ? String(j.measuredAt || j.at || '').slice(0, 10) + ', `' + String(j.commit || '?').slice(0, 8) + '`' : 'not measured yet'; };
  const row = function (label, file, j) { return '| [' + label + '](' + file + ') | ' + (fs.existsSync(path.join(out, file)) ? when(j) : 'not measured yet') + ' |'; };
  const studiesDir = path.join(out, 'studies');
  let studies = [];
  try { studies = fs.readdirSync(studiesDir).filter(function (d) { return fs.statSync(path.join(studiesDir, d)).isDirectory(); }).sort(); } catch (e) { studies = []; }
  const lines = [
    '# ' + agent, '',
    'Everything this agent\'s box has measured, one folder per agent (goal/G4.33). Rewritten by `publishData.js` on every run.', '',
    '| | measured |', '|---|---|',
    row('the box', 'platform.md', read('capacity.json') || read('packets.json')),
    row('harness', 'harness.txt', read('harness.json')),
    row('capacity', 'capacity.md', read('capacity.json')),
    row('packets', 'packets.md', read('packets.json')), '',
    '## Studies', '',
  ].concat(studies.length ? studies.map(function (d) { return '- [' + d + '](studies/' + d + '/)'; }) : ['none yet']).concat(['']);
  fs.writeFileSync(path.join(out, 'README.md'), lines.join('\n'));
}

async function main() {
  const top = git(['rev-parse', '--show-toplevel'], process.cwd());
  if (top.status !== 0) end(1, 'publishData: not in a git clone');
  const clone = path.resolve(top.stdout.trim());
  const prof = await desk('profile.get', { agent: '' });
  const agent = ok(prof) ? String(prof.body.name || '') : '';
  if (!agent) end(1, 'publishData: this agent has no name at the desk yet (Andy sets it in its pane): ' + (prof && prof.text));
  const out = outArg ? path.resolve(outArg) : path.join(clone, 'agents', agent);
  fs.mkdirSync(out, { recursive: true });
  // The commit of the code being measured: the tree this script runs from (in real use the agent's clone itself).
  const commit = (git(['rev-parse', '--short', 'HEAD'], __dirname).stdout || '').trim() || 'unknown';
  say('agent ' + agent + ', commit ' + commit + ', into ' + out);

  // 1. HARNESS AND CAPACITY, the tests' own tool.
  if (!packetsOnly) {
    say('harness and capacity (minutes)');
    const m = spawnSync(process.execPath, [path.join(clone, 'spirit', 'test', 'measurePlatform.js'), '--agent', agent], { cwd: clone, stdio: 'inherit', windowsHide: true });
    if (m.status !== 0) say('measurePlatform exited ' + m.status + '; its files say what it found');
  }

  // 2. THE PACKET FIGURES: N read-only desk asks, timed by this node's own traffic rows.
  const since = new Date(Date.now() - 1000).toISOString();
  for (let i = 0; i < asks; i++) await desk('scope.get', { agent: '' });
  await new Promise(function (r) { setTimeout(r, 1500); });
  const rows = closingRows(clone, since);
  const waits = rows.filter(function (r) { return typeof r.waitMs === 'number'; });
  const refusals = {};
  rows.forEach(function (r) { if (r.outcome !== 'receipted') refusals[r.code || r.outcome] = (refusals[r.code || r.outcome] || 0) + 1; });
  const packets = {
    agent: agent, commit: commit, measuredAt: new Date().toISOString(), asks: asks,
    posts: rows.length,
    waitMs: { median: median(waits.map(function (r) { return r.waitMs; })), max: max(waits.map(function (r) { return r.waitMs; })) },
    flight: { median: median(waits.map(function (r) { return r.ms - r.waitMs; })), max: max(waits.map(function (r) { return r.ms - r.waitMs; })) },
    retried: rows.filter(function (r) { return (r.attempts || 1) > 1; }).length,
    refusals: refusals,
  };
  fs.writeFileSync(path.join(out, 'packets.json'), JSON.stringify(packets, null, 2) + '\n');
  fs.writeFileSync(path.join(out, 'packets.md'), [
    '# Packets: ' + agent, '',
    asks + ' read-only desk asks from this agent\'s node at `' + commit + '`, ' + packets.measuredAt + ', timed by its own traffic log.', '',
    '| | median | worst |', '|---|---|---|',
    '| queue wait (ms) | ' + packets.waitMs.median + ' | ' + packets.waitMs.max + ' |',
    '| flight (ms) | ' + packets.flight.median + ' | ' + packets.flight.max + ' |', '',
    packets.posts + ' posts, ' + packets.retried + ' needed more than one try, refusals: ' + (Object.keys(refusals).length ? JSON.stringify(refusals) : 'none') + '.', '',
  ].join('\n'));
  if (packetsOnly || !fs.existsSync(path.join(out, 'platform.md'))) {
    fs.writeFileSync(path.join(out, 'platform.md'), [
      '# ' + agent, '', '**Measured ' + packets.measuredAt.slice(0, 10) + ', against `' + commit + '`.**', '',
      '| | |', '|---|---|',
      '| agent | ' + agent + ' |', '| platform | ' + process.platform + ' ' + os.release() + ' |', '| node | ' + process.version + ' |',
      '| cpus | ' + os.cpus().length + ' |', '| ram | ' + Math.round(os.totalmem() / 1048576) + ' MB |', '',
    ].join('\n'));
  }
  writeIndex(out, agent);
  say('packets: ' + packets.posts + ' posts, wait ' + packets.waitMs.median + '/' + packets.waitMs.max + ' ms, flight ' + packets.flight.median + '/' + packets.flight.max + ' ms, ' + packets.retried + ' retried');

  // 3. COMMIT AND SAY SO, unless this was only a look.
  if (packetsOnly || outArg) end(0, 'publishData: written to ' + out);
  const rel = path.relative(clone, out).split(path.sep).join('/');
  git(['add', '--', rel], clone);
  const c = git(['commit', '-q', '-m', 'publish: ' + agent + ' at ' + commit + ' (agents/' + agent + '/, the standing grant of goal/G4.33)'], clone);
  if (c.status !== 0) end(1, 'publishData: the commit was refused: ' + (c.stderr || c.stdout).trim());
  const p = git(['push', '-q'], clone);
  if (p.status !== 0) end(1, 'publishData: the push failed: ' + (p.stderr || p.stdout).trim());
  await desk('chat.add', { id: 'desk/G0.0', text: 'published ' + agent + ' at ' + commit + ': wait ' + packets.waitMs.median + '/' + packets.waitMs.max + ' ms, flight ' + packets.flight.median + '/' + packets.flight.max + ' ms over ' + packets.posts + ' posts; agents/' + agent + '/' });
  end(0, 'publishData: published agents/' + agent + '/');
}

main().catch(function (e) { end(1, 'publishData: ' + ((e && e.stack) || e)); });
