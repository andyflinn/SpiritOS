'use strict';

// spirit/run/spirit/app/publishData/publishData.js (it was spirit/app/deskClient/publishData.js until goal/G43.21)
// ONE MEASUREMENT RUN PER PLATFORM, ITS DATA IN platform/<platform>/ (windows, wsl or ubuntu) — goal/G4.33, goal/G47.1.
//
//   Andy, 2026-10-04: "so one single script for all of you puts the data into the repo"; to N: "that's a fine number"
//   (20). The box of goal/G4.33 holds every line. It is no longer automated under deskClient: it is run by hand (below).
//
// Run in a clone, with that clone's node up (the node runs from <clone>/spirit/run):
//
//   node spirit/run/spirit/app/publishData/publishData.js [<port>] [--asks N] [--only packets] [--out <dir>]
//
// Since goal/G43.21 Andy starts it with Run in its app detail (Andy, the box: "the Andy user on each box will run those scripts
// when he feels like it"); the port is then the starting node's own.
//
//   1  (gone: the harness and capacity step went with the old harness, Andy's "KILL!" commit e9c6cb8c)
//   2  N read-only desk asks (profile.get; scope.get until goal/G10.8 removed agent scopes) from this node, then their figures from its own traffic log: packets.json
//      {posts, waitMs {median, max}, flight {median, max}, retried, refusals} and packets.md; platform.md names the
//      agent, the commit and the box
//   3  the test state: testState.json and testState.md, from this node's testicle.db (the current result of each test
//      its testicle keeps), no suite re-run
//   4  unless --only packets or --out: commits platform/<platform>/ (the commit check's standing grant takes a commit whose
//      files all lie there); no summary goes to Desk (goal/G43.22)
// The platform is this machine's (platformName, below), never an agent's name. The traffic log is read from a copy of
// <clone>/spirit/run/spirit/state/node.db, read only: the node holds the file open, and no verb reads that log.
// Exits: 0 done; 1 a step failed (the reason printed); 2 usage.

// The spirit object first, as the global spirit (goal/G40.1).
require('../../../spirit/spirit.js');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const USAGE = 'usage: node publishData.js [<port of the agent\'s own node>] [--asks N] [--only packets] [--out <dir>]';
const NODE_WAIT_MS = 20000;
const DEFAULT_ASKS = 20;

const argv = process.argv.slice(2);
// THE PORT OF THE NODE THAT STARTS IT (goal/G43.21): Run in the app detail hands no argument, and the node hands every job it
// starts its own address, SPIRIT_CALLBACK_URL (spirit/job.js). A port given first still wins.
const fromNode = (/:(\d+)\//.exec(String(process.env.SPIRIT_CALLBACK_URL || '')) || [])[1];
const port = /^\d+$/.test(String(argv[0] || '')) ? Number(argv[0]) : Number(fromNode);
function flag(name) { const i = argv.indexOf(name); return i === -1 ? '' : String(argv[i + 1] || ''); }
if (!Number.isInteger(port) || port <= 0) { console.error(USAGE); process.exit(2); }
const asks = Math.max(1, Number(flag('--asks')) || DEFAULT_ASKS);
const packetsOnly = flag('--only') === 'packets';
const outArg = flag('--out');

function end(code, text) { (code ? console.error : console.log)(text); process.exit(code); }
function say(text) { console.log('publishData: ' + text); }
function git(args, cwd) { return spawnSync('git', args, { cwd: cwd, encoding: 'utf8', windowsHide: true }); }

function ask(verb, args) {
  let timer = null;
  const late = new Promise(function (resolve, reject) { timer = setTimeout(function () { reject(new Error('no answer in ' + NODE_WAIT_MS / 1000 + ' s')); }, NODE_WAIT_MS); });
  // Through the spirit object (goal/G32.3): the verb by its name, as {status, body}.
  // Every ask here is a deskClient verb: its family bound on the one spirit object (goal/G40.6).
  const asked = spirit.outcome(spirit.require(spirit.familyPath('deskClient')).then(function (c) { return c[String(verb).split('.').slice(1).join('.')](args); }));
  return Promise.race([asked, late]).then(function (r) { clearTimeout(timer); return r || {}; },
    function (e) { clearTimeout(timer); end(1, 'publishData: the node on port ' + port + ' did not answer ' + verb + ': ' + ((e && e.message) || e)); });
}
function desk(verb, args) { return ask('deskClient.desk', { name: verb, json: JSON.stringify(args) }); }

function median(a) { if (!a.length) return 0; const s = a.slice().sort(function (x, y) { return x - y; }); return s[Math.floor(s.length / 2)]; }
function max(a) { return a.length ? Math.max.apply(null, a) : 0; }

// The node's traffic rows since `sinceIso`, closing rows only, from a read-only copy of its node.db.
function closingRows(clone, sinceIso) {
  const src = path.join(clone, 'spirit', 'run', 'spirit', 'state', 'node.db');
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

// THE TEST STATE (goal/G21.3; goal/G47.1, Andy: "all, publish Data uses testicle data."): written from the current
// result of each test in this clone's testicle.db, read only; no suite is run for it. testicle keeps it in its state,
// spirit/state/testicle/data/. One row a script and suite (a general suite judges many scripts, each its own row).
const TESTICLE_DB = path.join(__dirname, '..', '..', 'state', 'testicle', 'data', 'testicle.db');
function writeTestState(out, agent, commit) {
  let rows = [];
  if (fs.existsSync(TESTICLE_DB)) {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(TESTICLE_DB, { readOnly: true });
    try {
      rows = db.prepare('SELECT script, suite, test, verified, severity, tested FROM testicle WHERE current = 1 ORDER BY script, suite, test').all();
    } finally { db.close(); }
  }
  const at = function (ms) { const n = Number(ms); return n > 0 ? new Date(n).toISOString() : ''; };
  const bySuite = Object.create(null);
  rows.forEach(function (r) {
    const k = r.script + '|' + r.suite;
    const s = bySuite[k] || (bySuite[k] = { script: r.script, suite: r.suite, tests: 0, green: 0, red: 0, newestAt: '' });
    s.tests += 1;
    if (Number(r.verified) === 1) s.green += 1; else s.red += 1;
    if (at(r.tested) > s.newestAt) s.newestAt = at(r.tested);
  });
  const reds = rows.filter(function (r) { return Number(r.verified) !== 1; })
    .map(function (r) { return { script: r.script, suite: r.suite, title: r.test, severity: Number(r.severity) || 0, at: at(r.tested) }; });
  const report = {
    agent: agent, measuredAt: new Date().toISOString(), commit: commit,
    from: 'testicle.db: the current result of each test this node\'s testicle keeps; no suite was run for this report',
    note: rows.length ? '' : 'no records yet',
    tests: rows.length, green: rows.length - reds.length, red: reds.length,
    suites: Object.keys(bySuite).sort().map(function (k) { return bySuite[k]; }),
    reds: reds,
  };
  fs.writeFileSync(path.join(out, 'testState.json'), JSON.stringify(report, null, 2) + '\n');
  const md = ['# Test state: ' + agent, '',
    '**Written ' + report.measuredAt.slice(0, 10) + ' by publishData at `' + report.commit + '`, from this node\'s testicle.db; no suite was re-run.**', '',
    report.tests + ' tests, ' + report.green + ' green, ' + report.red + ' red.' + (report.note ? ' ' + report.note + '.' : ''), '',
    '| script | suite | tests | green | red | newest |', '|---|---|---|---|---|---|']
    .concat(report.suites.map(function (x) { return '| ' + x.script + ' | ' + x.suite + ' | ' + x.tests + ' | ' + x.green + ' | ' + x.red + ' | ' + x.newestAt + ' |'; }))
    .concat(['', '## Red', ''])
    .concat(reds.length ? reds.map(function (r) { return '- `' + r.script + '` `' + r.suite + '` ' + r.title + ' (severity ' + r.severity + ', ' + r.at + ')'; }) : ['none'])
    .concat(['']);
  fs.writeFileSync(path.join(out, 'testState.md'), md.join('\n'));
  return report;
}

// platform/<platform>/README.md: since goal/G33.5 written by agentReadme.js (Machine Description, Summary, Measurements),
// with summary.json beside it, from the files themselves, so it never goes stale.
function writeIndex(out, agent) { return spirit.require('spirit/app/publishData/agentReadme.js').write(out, agent); }

// The files a run writes into its platform folder, and so the only ones it commits.
const PUBLISHED = ['packets.json', 'packets.md', 'platform.md', 'testState.json', 'testState.md', 'README.md', 'summary.json'];
// windows on Windows; wsl on a Linux whose kernel says Microsoft (WSL); ubuntu on any other Linux; else the platform's own name.
function platformName() {
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'linux') {
    let v = '';
    try { v = fs.readFileSync('/proc/version', 'utf8'); } catch (e) { v = ''; }
    return /microsoft/i.test(v + ' ' + os.release()) ? 'wsl' : 'ubuntu';
  }
  return process.platform;
}

async function main() {
  const top = git(['rev-parse', '--show-toplevel'], process.cwd());
  if (top.status !== 0) end(1, 'publishData: not in a git clone');
  const clone = path.resolve(top.stdout.trim());
  // The reports name the agent that measured, as Andy set it in its pane.
  const prof = await desk('profile.get', { agent: '' });
  const agent = prof && prof.status === 200 && prof.body && prof.body.ok !== false ? String(prof.body.name || '') : '';
  if (!agent) end(1, 'publishData: this agent has no name at the desk yet (Andy sets it in its pane): ' + (prof && prof.text));
  // THE FOLDER NAMES THE PLATFORM, NOT THE AGENT (goal/G47.1, box v104: "make sure publisData simply writes to folders
  // identifying the platform, NOT the agent, the platforms will be \"windows\", \"wsl\" and \"ubuntu\""; box v105: "the
  // folders: repo://platform/windows/, repo://platform/wsl/, repo://platform/ubuntu/, depending on where publishData
  // runs....").
  const platform = platformName();
  const out = outArg ? path.resolve(outArg) : path.join(clone, 'platform', platform);
  fs.mkdirSync(out, { recursive: true });
  // The commit of the code being measured: the tree this script runs from (in real use the agent's clone itself).
  const commit = (git(['rev-parse', '--short', 'HEAD'], __dirname).stdout || '').trim() || 'unknown';
  say('agent ' + agent + ', commit ' + commit + ', into ' + out);

  // THE HARNESS STEP WENT WITH THE OLD HARNESS (Andy's commit "KILL!", e9c6cb8c, removed spirit/test/ and its
  // measurePlatform.js with it): the test state comes from testicle (step 3).

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
  {
    fs.writeFileSync(path.join(out, 'platform.md'), [
      '# ' + agent, '', '**Measured ' + packets.measuredAt.slice(0, 10) + ', against `' + commit + '`.**', '',
      '| | |', '|---|---|',
      '| agent | ' + agent + ' |', '| platform | ' + process.platform + ' ' + os.release() + ' |', '| node | ' + process.version + ' |',
      '| cpus | ' + os.cpus().length + ' |', '| ram | ' + Math.round(os.totalmem() / 1048576) + ' MB |', '',
    ].join('\n'));
  }
  // 3. THE TEST STATE, from this node's testicle.db (goal/G47.1: "publish Data uses testicle data.").
  try {
    const rep = writeTestState(out, agent, commit);
    say('testState: ' + rep.tests + ' tests, ' + rep.red + ' red');
  } catch (e) { say('testState not written: ' + ((e && e.message) || e)); }
  writeIndex(out, agent);
  say('packets: ' + packets.posts + ' posts, wait ' + packets.waitMs.median + '/' + packets.waitMs.max + ' ms, flight ' + packets.flight.median + '/' + packets.flight.max + ' ms, ' + packets.retried + ' retried');

  // 4. COMMIT AND SAY SO, unless this was only a look.
  if (packetsOnly || outArg) end(0, 'publishData: written to ' + out);
  // ZERO POSTS IS PUBLISHED TOO (Andy, to Q16, whether a run counting 0 posts should refuse: "publish it anyway. that's
  // what happened."). The figures say what the run met.
  if (!packets.posts) say('the desk asks counted 0 posts; published as measured (is the node\'s deskClient answering?)');
  const rel = path.relative(clone, out).split(path.sep).join('/');
  // ITS ONE FOLDER AND NOTHING ELSE STAGED (goal/G19.6; Andy, 2026-10-12: "agreed to the whole thing as stated", the
  // box: "publishData commits its one file and nothing else staged."). A plain commit took whatever the agent had
  // staged in its clone and pushed it as "publish:". `--only -- <rel>` commits <rel> alone, from a temporary index, so
  // other staged work stays staged and uncommitted; the commit check's hook sees only <rel> staged, so the standing
  // grant applies to exactly what is published. The add comes first so a file new to git is known to --only.
  // ONLY THE FILES IT WROTE (goal/G47.1, box v105): platform/<platform>/ also holds Andy's own tools for that machine
  // (platform/README.md), and an edit of his there is never published as "publish:".
  const wrote = PUBLISHED.filter(function (f) { return fs.existsSync(path.join(out, f)); }).map(function (f) { return rel + '/' + f; });
  git(['add', '--'].concat(wrote), clone);
  const c = git(['commit', '-q', '--only', '-m', 'publish: ' + agent + ' at ' + commit + ' (platform/' + platform + '/, the standing grant of goal/G4.33)', '--'].concat(wrote), clone);
  if (c.status !== 0) end(1, 'publishData: the commit was refused: ' + (c.stderr || c.stdout).trim());
  // PUSH THROUGH pushOrigin (goal/G5.1): one shared place that rebases onto origin's newest, pushes, retries on a
  // race (Andy: "tries again if someone pushed meanwhile"), stops on a clash.
  const { pushOrigin } = spirit.require('spirit/app/pushOrigin/pushOrigin.js');
  const pushed = await pushOrigin({ repo: clone });
  // pushOrigin's reason says what went wrong, the push itself or putting the clone's unsaved edits back (goal/G19.6).
  if (!pushed || !pushed.ok) end(1, 'publishData: pushOrigin did not finish: ' + ((pushed && pushed.reason) || 'unknown'));
  // NO SUMMARY TO THE DESK (goal/G43.22; Andy: "publishData summary is no longer needed, i only check on github.").
  end(0, 'publishData: published platform/' + platform + '/');
}

main().catch(function (e) { end(1, 'publishData: ' + ((e && e.stack) || e)); });
