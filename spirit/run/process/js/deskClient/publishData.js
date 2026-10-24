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
//   2  N read-only desk asks (profile.get; scope.get until goal/G10.8 removed agent scopes) from this node, then their figures from its own traffic log: packets.json
//      {posts, waitMs {median, max}, flight {median, max}, retried, refusals} and packets.md; platform.md names the
//      agent, the commit and the box
//   3  the test state: testState.json and testState.md, from this node's verify.db (the newest row of each test its
//      deskVerify keeps), no suite re-run
//   4  unless --only packets or --out: commits agents/<agent>/ (the commit check's standing grant takes a commit whose
//      files all lie there) and posts one summary line to Desk
// The agent is the name Andy set in its profile (profile.get). The traffic log is read from a copy of
// <clone>/spirit/run/relay-state/node.db, read only: the node holds the file open, and no verb reads that log.
// Exits: 0 done; 1 a step failed (the reason printed); 2 usage.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const spiritObject = require('../../../face/spirit.js');

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
  // Through the spirit object (goal/G32.3): the verb by its name, as {status, body}.
  const asked = spiritObject.outcome(spiritObject.forNode(node, String(verb).split('.')[0]).then(function (s) { return s.call(verb, args); }));
  return Promise.race([asked, late]).then(function (r) { clearTimeout(timer); return r || {}; },
    function (e) { clearTimeout(timer); end(1, 'publishData: the node on port ' + port + ' did not answer ' + verb + ': ' + ((e && e.message) || e)); });
}
function desk(verb, args) { return ask('deskClient.desk', { name: verb, json: JSON.stringify(args) }); }
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

// THE TEST STATE (goal/G21.3, moved here by goal/G33.3). It was written by deskVerify's idle chores into
// agents/<agent>/ just before they ran this script; since goal/G33.3 the verifier knows no agent and no folder (the box:
// "each chore names the folders it updates and finds its own agent, so the verifier knows neither (the test-state file
// it writes today moves into the publish chore)"). So it is written here, from the newest row of each test in this
// clone's verify.db, read only; no suite is run for it.
const VERIFY_DB = path.join(__dirname, '..', 'deskVerify', 'verify.db');
function writeTestState(out, agent, commit) {
  let rows = [];
  if (fs.existsSync(VERIFY_DB)) {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(VERIFY_DB, { readOnly: true });
    try {
      rows = db.prepare('SELECT suite, title, outcome, "commit" AS commitAt, at, failure FROM results WHERE rowid IN ' +
        '(SELECT MAX(rowid) FROM results GROUP BY suite, title) ORDER BY suite, title').all();
    } finally { db.close(); }
  }
  const bySuite = Object.create(null);
  rows.forEach(function (r) {
    const s = bySuite[r.suite] || (bySuite[r.suite] = { suite: r.suite, tests: 0, green: 0, red: 0, newestAt: '' });
    s.tests += 1;
    if (r.outcome === 'red') s.red += 1; else s.green += 1;
    if (String(r.at) > s.newestAt) s.newestAt = String(r.at);
  });
  const reds = rows.filter(function (r) { return r.outcome === 'red'; })
    .map(function (r) { return { suite: r.suite, title: r.title, commit: r.commitAt, at: r.at, failure: r.failure || '' }; });
  const report = {
    agent: agent, measuredAt: new Date().toISOString(), commit: commit,
    from: 'verify.db: the newest row of each test this node\'s deskVerify keeps; no suite was run for this report',
    note: rows.length ? '' : 'no records yet',
    tests: rows.length, green: rows.length - reds.length, red: reds.length,
    suites: Object.keys(bySuite).sort().map(function (k) { return bySuite[k]; }),
    reds: reds,
  };
  fs.writeFileSync(path.join(out, 'testState.json'), JSON.stringify(report, null, 2) + '\n');
  const md = ['# Test state: ' + agent, '',
    '**Written ' + report.measuredAt.slice(0, 10) + ' by publishData at `' + report.commit + '`, from this node\'s verify.db; no suite was re-run.**', '',
    report.tests + ' tests, ' + report.green + ' green, ' + report.red + ' red.' + (report.note ? ' ' + report.note + '.' : ''), '',
    '| suite | tests | green | red | newest |', '|---|---|---|---|---|']
    .concat(report.suites.map(function (x) { return '| ' + x.suite + ' | ' + x.tests + ' | ' + x.green + ' | ' + x.red + ' | ' + x.newestAt + ' |'; }))
    .concat(['', '## Red', ''])
    .concat(reds.length ? reds.map(function (r) { return '- `' + r.suite + '` ' + r.title + ' (`' + String(r.commit).slice(0, 8) + '`, ' + r.at + ')' + (r.failure ? ': ' + r.failure.replace(/\s+/g, ' ') : ''); }) : ['none'])
    .concat(['']);
  fs.writeFileSync(path.join(out, 'testState.md'), md.join('\n'));
  return report;
}

// agents/<agent>/README.md: since goal/G33.5 written by agentReadme.js (Machine Description, Summary, Measurements),
// with summary.json beside it, from the files themselves, so it never goes stale.
function writeIndex(out, agent) { return require('./agentReadme.js').write(out, agent); }

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
  // IN A WORKTREE, NOT THE LIVE CLONE (goal/G4.33, reopened): the first publish ran the harness beside the running
  // node, and a suite disturbed the node's own sockets (wsl-claude's lost its deskClient, 0 packet posts). So the
  // harness runs in a temporary git worktree of the commit being published; its files come back into agents/<agent>/,
  // and the worktree is removed. The node's relay list is not in git, so it is carried over when the clone has one;
  // it is relay-state/relays.json since goal/G16.3, node state rather than the Natter app's file.
  if (!packetsOnly) {
    say('harness and capacity in a worktree of ' + commit + ' (minutes)');
    const tree = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-publish-tree-'));
    fs.rmSync(tree, { recursive: true, force: true });
    const added = git(['worktree', 'add', '-q', '--detach', tree, 'HEAD'], clone);
    if (added.status !== 0) end(1, 'publishData: no worktree: ' + (added.stderr || added.stdout).trim());
    try {
      const relays = path.join('spirit', 'run', 'relay-state', 'relays.json');
      if (fs.existsSync(path.join(clone, relays))) { fs.mkdirSync(path.dirname(path.join(tree, relays)), { recursive: true }); fs.copyFileSync(path.join(clone, relays), path.join(tree, relays)); }
      const m = spawnSync(process.execPath, [path.join(tree, 'spirit', 'test', 'measurePlatform.js'), '--agent', agent], { cwd: tree, stdio: 'inherit', windowsHide: true });
      if (m.status !== 0) say('measurePlatform exited ' + m.status + '; its files say what it found');
      const made = path.join(tree, 'agents', agent);
      if (fs.existsSync(made)) fs.readdirSync(made).forEach(function (f) { const from = path.join(made, f); if (fs.statSync(from).isFile()) fs.copyFileSync(from, path.join(out, f)); });
    } finally {
      git(['worktree', 'remove', '--force', tree], clone);
      git(['worktree', 'prune'], clone);
    }
  }

  // 2. THE PACKET FIGURES: N read-only desk asks, timed by this node's own traffic rows.
  const since = new Date(Date.now() - 1000).toISOString();
  for (let i = 0; i < asks; i++) await desk('profile.get', { agent: '' });
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
  // 3. THE TEST STATE, from this node's verify.db (goal/G33.3: the publish chore writes it, not the verifier).
  try {
    const rep = writeTestState(out, agent, commit);
    say('testState: ' + rep.tests + ' tests, ' + rep.red + ' red');
  } catch (e) { say('testState not written: ' + ((e && e.message) || e)); }
  writeIndex(out, agent);
  say('packets: ' + packets.posts + ' posts, wait ' + packets.waitMs.median + '/' + packets.waitMs.max + ' ms, flight ' + packets.flight.median + '/' + packets.flight.max + ' ms, ' + packets.retried + ' retried');

  // 4. COMMIT AND SAY SO, unless this was only a look.
  if (packetsOnly || outArg) end(0, 'publishData: written to ' + out);
  // ZERO POSTS IS PUBLISHED TOO (Andy, to Q16, whether a run counting 0 posts should refuse: "publish it anyway. that's
  // what happened."). The figures say what the run met; it only says so aloud.
  if (!packets.posts) say('the desk asks counted 0 posts; published as measured (is the node\'s deskClient answering?)');
  const rel = path.relative(clone, out).split(path.sep).join('/');
  // ITS ONE FOLDER AND NOTHING ELSE STAGED (goal/G19.6; Andy, 2026-10-12: "agreed to the whole thing as stated", the
  // box: "publishData commits its one file and nothing else staged."). A plain commit took whatever the agent had
  // staged in its clone and pushed it as "publish:". `--only -- <rel>` commits <rel> alone, from a temporary index, so
  // other staged work stays staged and uncommitted; the commit check's hook sees only <rel> staged, so the standing
  // grant applies to exactly what is published. The add comes first so a file new to git is known to --only.
  git(['add', '--', rel], clone);
  const c = git(['commit', '-q', '--only', '-m', 'publish: ' + agent + ' at ' + commit + ' (agents/' + agent + '/, the standing grant of goal/G4.33)', '--', rel], clone);
  if (c.status !== 0) end(1, 'publishData: the commit was refused: ' + (c.stderr || c.stdout).trim());
  // PUSH THROUGH pushOrigin (goal/G5.1): one shared place that rebases onto origin's newest, pushes, retries on a
  // race (Andy: "tries again if someone pushed meanwhile"), stops on a clash.
  const { pushOrigin } = require('../pushOrigin/pushOrigin.js');
  const pushed = await pushOrigin({ repo: clone });
  // pushOrigin's reason says what went wrong, the push itself or putting the clone's unsaved edits back (goal/G19.6).
  if (!pushed || !pushed.ok) end(1, 'publishData: pushOrigin did not finish: ' + ((pushed && pushed.reason) || 'unknown'));
  await desk('chat.add', { id: 'goal/G0', text: 'published ' + agent + ' at ' + commit + ': wait ' + packets.waitMs.median + '/' + packets.waitMs.max + ' ms, flight ' + packets.flight.median + '/' + packets.flight.max + ' ms over ' + packets.posts + ' posts; agents/' + agent + '/' });
  end(0, 'publishData: published agents/' + agent + '/');
}

main().catch(function (e) { end(1, 'publishData: ' + ((e && e.stack) || e)); });
