'use strict';
// spirit/run/spirit/app/testicle/job/analyze/script.js
// THE ANALYSIS OF ONE RED, A TOOL AN AGENT RUNS (goal/G49.6, the box; Andy: "analyze, the verb goes, and analyze becomes a tool
// script at spirit/app/testicle/job/analyze/script.js", "analyze is a developer tool and maybe can be invoked directly by agents,
// so no waiting for or interrupting the server", "it can read the database directly since it only reads and run independently
// of the testicle server").
//
//   node spirit/app/testicle/job/analyze/script.js [red] [--all]
//
//   red     a red testicle row as JSON, as testicle.red hands it ({ script, suite, test, id? }); left out, the most severe red,
//           read from testicle.db itself (Andy: "when analyze is not handed an argument it analyzes the most severe red", "since
//           it already reads the testicle database itself it shouldn't ask the server for the leading red.")
//   --all   lifts the per-list and per-diff bounds
//
// Its database is its own node's, spirit/state/testicle/data/testicle.db under the run root it is started in, opened read
// only; never another node's. Its answer is one JSON object on stdout, nothing else printed there: said, red, lastGreen, blame,
// suspects, fixFirst, sameTestElsewhere, flaky, contradicts, world, unknown. Nothing red: { "red": null }, exit 0. A failure of
// the tool itself goes to stderr, exit 1, so a broken tool never looks like a clean answer.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { DatabaseSync } = require('node:sqlite');

// The run root it is started in, its working folder (the box: "under the run root it is started in"), as an agent runs it
// from its own node's spirit/run.
const RUN = process.cwd();
const DB_FILE = path.join(RUN, 'spirit', 'state', 'testicle', 'data', 'testicle.db');
// THE BOUNDS, PART BY PART, NEVER AS A WHOLE (the box, "Its output"): the tool crosses no wire, so no payload limit holds; the
// bounds are for the agent reading it. At most 20 per list, each diff cut at a line past about 1,500 bytes, each with the count
// of what was left out; --all lifts both.
const LIST_MAX = 20;
const DIFF_MAX = 1500;
// A setup check: every red after it in the same run follows from it, so it is fixed first (the box, 5).
const SETUP = /\bready\b|^the world|scratch node|chrome page/i;

function fail(message) { process.stderr.write(String(message) + '\n'); process.exit(1); }

const args = process.argv.slice(2);
const ALL = args.indexOf('--all') !== -1;
const given = args.filter(function (a) { return a !== '--all'; })[0];

if (!fs.existsSync(DB_FILE)) fail('no testicle database at ' + DB_FILE);
let db = null;
try { db = new DatabaseSync(DB_FILE, { readOnly: true }); } catch (e) { fail('the testicle database could not be opened: ' + (e && e.message)); }
db.exec('PRAGMA busy_timeout = 5000');

const Q = {
  // testicle.red's own order: the reds, the most severe first, the newest first among equals.
  reds: db.prepare('SELECT * FROM testicle WHERE current = 1 AND verified = 0 ORDER BY severity DESC, tested DESC'),
  history: db.prepare('SELECT * FROM testicle WHERE script = ? AND suite = ? AND test = ? ORDER BY id DESC'),
  suiteRow: db.prepare('SELECT * FROM suite WHERE script = ? AND suite = ?'),
  depsOf: db.prepare('SELECT requires FROM dependency WHERE script = ?'),
  scriptRowOf: db.prepare('SELECT name, hash, changed FROM script WHERE name = ?'),
  greens: db.prepare('SELECT * FROM testicle WHERE verified = 1 AND tested > ? AND tested <= ? ORDER BY tested DESC'),
};

const posix = function (p) { return String(p || '').split(path.sep).join('/').replace(/^\.?\//, ''); };
// A list at most LIST_MAX long, the count of what was left out beside it.
function bounded(list) { return ALL ? { items: list, more: 0 } : { items: list.slice(0, LIST_MAX), more: Math.max(0, list.length - LIST_MAX) }; }
// A diff as git prints it, cut at a line past DIFF_MAX bytes, the count of lines cut beside it.
function shortDiff(text) {
  const s = String(text || '').replace(/\s+$/, '');
  if (ALL || Buffer.byteLength(s, 'utf8') <= DIFF_MAX) return { diff: s, diffLinesCut: 0 };
  const lines = s.split('\n');
  let out = '';
  let kept = 0;
  for (const l of lines) { if (Buffer.byteLength(out + l + '\n', 'utf8') > DIFF_MAX) break; out += l + '\n'; kept += 1; }
  return { diff: out.replace(/\n$/, ''), diffLinesCut: lines.length - kept };
}
let REPO = null;
function git(argv) {
  if (REPO === null) { try { REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: RUN, encoding: 'utf8', windowsHide: true }).trim(); } catch (e) { REPO = ''; } }
  if (!REPO) throw new Error('no git');
  return execFileSync('git', argv, { cwd: REPO, encoding: 'utf8', windowsHide: true, maxBuffer: 1 << 26 });
}

// THE RED: the one handed, else the most severe.
let row = null;
if (given !== undefined) {
  let g = null;
  try { g = JSON.parse(given); } catch (e) { fail('the red handed is not JSON'); }
  if (!g || typeof g !== 'object' || !g.script || !g.suite || !g.test) fail('the red handed names no script, suite and test');
  const h = Q.history.all(posix(g.script), posix(g.suite), String(g.test));
  row = (Number(g.id) > 0 ? h.filter(function (r) { return Number(r.id) === Number(g.id); })[0] : null) || h.filter(function (r) { return r.current; })[0] || h[0] || null;
  if (!row) fail('no such red: ' + g.script + ' | ' + g.suite + ' | ' + g.test);
} else {
  row = Q.reds.get() || null;
  if (!row) { process.stdout.write(JSON.stringify({ red: null }) + '\n'); process.exit(0); }
}

const script = row.script;
const suite = row.suite;
const testTitle = row.test;
const history = Q.history.all(script, suite, testTitle);
const suiteRow = Q.suiteRow.get(script, suite) || {};
const unknown = [];

// 1. the red itself
const red = { script: script, suite: suite, test: testTitle, id: Number(row.id), severity: Number(row.severity), verified: !!row.verified,
  reason: suiteRow.reason || (row.verified ? '' : 'fail'), tested: Number(row.tested), judged: String(row.judged || ''), suiteHash: String(row.suiteHash || '') };
if (red.verified) unknown.push('this row is green now: it is no red');
// 2. flip or never green
const green = history.filter(function (r) { return r.verified && Number(r.tested) < red.tested; })[0] || null;
const lastGreen = green ? { id: Number(green.id), tested: Number(green.tested), judged: String(green.judged || ''), suiteHash: String(green.suiteHash || ''),
  sameHashes: String(green.judged || '') === red.judged && String(green.suiteHash || '') === red.suiteHash } : null;
if (!lastGreen) unknown.push('never green: no green of this test in its history');
// 5. what to fix first: a red setup check of the same script first, then its other current reds; and the same test red on
// other scripts, since a rule red on many points at the rule or one shared file
const reds = Q.reds.all();
const others = reds.filter(function (r) { return r.script === script && !(r.suite === suite && r.test === testTitle); });
const setup = others.filter(function (r) { return SETUP.test(String(r.test)); });
const fixFirst = bounded(setup.concat(others.filter(function (r) { return setup.indexOf(r) === -1; })).map(function (r) {
  return { script: r.script, suite: r.suite, test: r.test, severity: Number(r.severity), setup: setup.indexOf(r) !== -1 };
}));
const sameTestElsewhere = bounded(reds.filter(function (r) { return r.suite === suite && r.test === testTitle && r.script !== script; }).map(function (r) { return r.script; }));
// 6. flaky: the same script hash and suite hash, both green and red
const sameRuns = history.filter(function (r) { return String(r.judged || '') === red.judged && String(r.suiteHash || '') === red.suiteHash; });
const flaky = sameRuns.some(function (r) { return r.verified; }) && sameRuns.some(function (r) { return !r.verified; });
// 7. contradictory tests: the tests that turned green from red between the last green and the red, found from the red alone
const contradictsAll = [];
if (lastGreen) {
  for (const r of Q.greens.iterate(lastGreen.tested, red.tested)) {
    if (!ALL && contradictsAll.length > LIST_MAX) break;
    if (r.script === script && r.suite === suite && r.test === testTitle) continue;
    const before = Q.history.all(r.script, r.suite, r.test).filter(function (h) { return Number(h.tested) < Number(r.tested); })[0];
    if (before && !before.verified) contradictsAll.push({ script: r.script, suite: r.suite, test: r.test, turnedGreen: Number(r.tested) });
  }
}
const contradicts = bounded(contradictsAll);
// The look stops one past the bound, so the count left out is a floor there, and said so.
if (!ALL && contradictsAll.length > LIST_MAX) unknown.push('contradicts: the look stopped past ' + LIST_MAX + '; more may be there than contradictsMore says (--all looks at all)');
// 4. suspects: what it requires, changed after the last green, newest first
const deps = Q.depsOf.all(script).map(function (d) { return d.requires; });
if (!deps.length) unknown.push('no dependency rows for this script');
const since = lastGreen ? lastGreen.tested : 0;
const suspects = bounded(deps.map(function (p) { return Q.scriptRowOf.get(p); }).filter(function (s) { return !!s && Number(s.changed) > since; })
  .sort(function (x, y) { return Number(y.changed) - Number(x.changed); }).map(function (s) { return { script: s.name, changed: Number(s.changed) }; }));
if (lastGreen) unknown.push('the hash each required script had at the last green is not kept: a file changed and changed back is still a suspect');
// 8. where the run came from
unknown.push('the commit the run\'s world was copied from is not kept');
// 3. blame: the commits since the last green on the script, its suite and what it requires, each with its diff; 4, each suspect
// with the diff of what changed since then
let blame = bounded([]);
if (lastGreen) {
  try {
    const at = path.relative(git(['rev-parse', '--show-toplevel']).trim(), RUN).split(path.sep).join('/');
    const inRepo = function (p) { return (at ? at + '/' : '') + p; };
    const files = [script, suite].concat(deps).map(inRepo);
    const sinceArg = '--since=@' + Math.floor(lastGreen.tested / 1000);
    const log = git(['log', sinceArg, '--format=%h%x09%an%x09%cI%x09%s', '--'].concat(files));
    blame = bounded(log.split('\n').filter(Boolean).map(function (l) { const p = l.split('\t'); return { commit: p[0], author: p[1], at: p[2], subject: p.slice(3).join('\t') }; }));
    blame.items.forEach(function (b) { Object.assign(b, shortDiff(git(['show', '-U0', '--format=', b.commit, '--'].concat(files)))); });
    suspects.items.forEach(function (s) { Object.assign(s, shortDiff(git(['log', sinceArg, '-p', '-U0', '--format=', '--', inRepo(s.script)]))); });
  } catch (e) { unknown.push('git could not be asked for the commits'); }
}

// SAID FIRST, BY FIXED SENTENCES FROM THE FIELDS (the box: "so the same red always gives the same words").
function saidOf() {
  const s = [];
  const blameCount = blame.items.length + blame.more;
  if (!lastGreen) s.push('never green');
  else s.push('red since ' + blameCount + ' commit' + (blameCount === 1 ? '' : 's') + ' touching its script, its suite or what it requires' + (lastGreen.sameHashes ? ', though the last green ran against the same hashes' : ''));
  s.push(flaky ? 'flaky: the same hashes were both green and red' : 'not flaky');
  const firstSetup = fixFirst.items.filter(function (f) { return f.setup; })[0];
  if (firstSetup) s.push('fix first: the setup check "' + firstSetup.test + '" of the same script');
  const elsewhere = sameTestElsewhere.items.length + sameTestElsewhere.more;
  if (elsewhere) s.push('the same test is red on ' + elsewhere + ' other script' + (elsewhere === 1 ? '' : 's'));
  return s.join('; ');
}

const out = {
  said: saidOf(),
  red: red,
  lastGreen: lastGreen,
  blame: blame.items, blameMore: blame.more,
  suspects: suspects.items, suspectsMore: suspects.more,
  fixFirst: fixFirst.items, fixFirstMore: fixFirst.more,
  sameTestElsewhere: sameTestElsewhere.items, sameTestElsewhereMore: sameTestElsewhere.more,
  flaky: flaky,
  contradicts: contradicts.items, contradictsMore: contradicts.more,
  world: null,
  unknown: unknown,
};
process.stdout.write(JSON.stringify(out) + '\n');
process.exit(0);
