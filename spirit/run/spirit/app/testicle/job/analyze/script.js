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
// bounds are for the agent reading it. At most 5 per list by default (Andy: "Lists at most 5 by default in place of 20, --all for
// the rest"), each diff cut at a line past about 1,500 bytes, each with the count of what was left out; --all lifts both.
const LIST_MAX = 5;
const DIFF_MAX = 1500;
// A setup check: every red after it in the same run follows from it, so it is fixed first (the box, 5).
const SETUP = /\bready\b|^the world|scratch node|chrome page/i;

function fail(message) { process.stderr.write(String(message) + '\n'); process.exit(1); }

const args = process.argv.slice(2);
const ALL = args.indexOf('--all') !== -1;
const given = args.filter(function (a) { return a !== '--all'; })[0];

if (!fs.existsSync(DB_FILE)) fail('no testicle database at ' + DB_FILE);
let db = null;
// A busy timeout of 5 s on the open itself (the box v20), so a server write makes it wait, never fail.
try { db = new DatabaseSync(DB_FILE, { readOnly: true, timeout: 5000 }); } catch (e) { fail('the testicle database could not be opened: ' + (e && e.message)); }
db.exec('PRAGMA busy_timeout = 5000');

const Q = {
  // testicle.red's own order: the reds, the most severe first, the newest first among equals.
  reds: db.prepare('SELECT * FROM testicle WHERE current = 1 AND verified = 0 ORDER BY severity DESC, tested DESC'),
  history: db.prepare('SELECT * FROM testicle WHERE script = ? AND suite = ? AND test = ? ORDER BY id DESC'),
  byId: db.prepare('SELECT * FROM testicle WHERE id = ?'),
  suiteRow: db.prepare('SELECT * FROM suite WHERE script = ? AND suite = ?'),
  depsOf: db.prepare('SELECT requires FROM dependency WHERE script = ?'),
  requirersOf: db.prepare('SELECT script FROM dependency WHERE requires = ?'),
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
  if (!g || typeof g !== 'object') fail('the red handed is no row');
  // Handed its id alone, the rest of the row is read from testicle.db (the box v18).
  if (!g.script && !g.suite && !g.test && Number(g.id) > 0) {
    const byId = Q.byId.get(Number(g.id));
    if (!byId) fail('no such red: id ' + g.id);
    g = byId;
  }
  if (!g.script || !g.suite || !g.test) fail('the red handed names no script, suite and test');
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
  reason: suiteRow.reason || (row.verified ? '' : 'fail'), tested: Number(row.tested), judged: String(row.judged || ''), suiteHash: String(row.suiteHash || ''),
  testHash: String(row.testHash || '') };
if (red.verified) unknown.push('this row is green now: it is no red');
// THE TEST'S OWN HASH (the box v18, Andy: "i opt for the new testHash field"): two rows are compared by their testHash, the hash
// of the test's own block; a row from before testHash has none, and for it the suite's hash stands in.
function byTestHash(a, b) { return !!String(a.testHash || '') && !!String(b.testHash || ''); }
function sameTest(a, b) { return byTestHash(a, b) ? String(a.testHash) === String(b.testHash) : String(a.suiteHash || '') === String(b.suiteHash || ''); }
// 2. flip or never green
const green = history.filter(function (r) { return r.verified && Number(r.tested) < red.tested; })[0] || null;
const lastGreen = green ? { id: Number(green.id), tested: Number(green.tested), judged: String(green.judged || ''), suiteHash: String(green.suiteHash || ''),
  testHash: String(green.testHash || ''), sameHashes: String(green.judged || '') === red.judged && sameTest(green, red) } : null;
if (!lastGreen) unknown.push('never green: no green of this test in its history');
// 5. what to fix first: a red setup check of the same script alone (the box v18: "the only thing to fix first ...; the script's
// other current reds are a count beside it, never a list, so no red points at another in a circle"); and the same test red on
// other scripts, since a rule red on many points at the rule or one shared file
const reds = Q.reds.all();
const others = reds.filter(function (r) { return r.script === script && !(r.suite === suite && r.test === testTitle); });
const setup = others.filter(function (r) { return SETUP.test(String(r.test)); });
const fixFirst = bounded(setup.map(function (r) { return { script: r.script, suite: r.suite, test: r.test, severity: Number(r.severity), setup: true }; }));
const otherReds = others.length - setup.length;
// The other scripts whose same test went red within a second of this red (the box v20).
const together = reds.filter(function (r) { return r.suite === suite && r.test === testTitle && r.script !== script && Math.abs(Number(r.tested) - Number(row.tested)) <= 1000; }).map(function (r) { return r.script; });
const sameTestElsewhere = bounded(reds.filter(function (r) { return r.suite === suite && r.test === testTitle && r.script !== script; }).map(function (r) { return r.script; }));
// What it requires (the dependency table), read here since a contradicting test must share a file with the red.
const deps = Q.depsOf.all(script).map(function (d) { return d.requires; });
// 7. contradictory tests: the tests that turned green from red between the last green and the red, found from the red alone;
// one counts only when it took turns at least twice (the box v17: "a single flip is a fix"): its verdict changed twice or more.
function turnsOf(rows) { let n = 0; for (let i = 1; i < rows.length; i++) if (!!rows[i].verified !== !!rows[i - 1].verified) n += 1; return n; }
const contradictsAll = [];
if (lastGreen) {
  for (const r of Q.greens.iterate(lastGreen.tested, red.tested)) {
    if (!ALL && contradictsAll.length > LIST_MAX) break;
    if (r.script === script && r.suite === suite && r.test === testTitle) continue;
    // It shares a file with the red (the box v18): the same script, or one in the red script's dependency rows.
    if (r.script !== script && deps.indexOf(r.script) === -1) continue;
    const its = Q.history.all(r.script, r.suite, r.test).slice().sort(function (a, b) { return Number(a.tested) - Number(b.tested); });
    const before = its.filter(function (h) { return Number(h.tested) < Number(r.tested); }).pop();
    if (before && !before.verified && turnsOf(its) >= 2) contradictsAll.push({ script: r.script, suite: r.suite, test: r.test, turnedGreen: Number(r.tested) });
  }
}
const contradicts = bounded(contradictsAll);
// The look stops one past the bound, so the count left out is a floor there, and said so.
if (!ALL && contradictsAll.length > LIST_MAX) unknown.push('contradicts: the look stopped past ' + LIST_MAX + '; more may be there than contradictsMore says (--all looks at all)');
// 4. suspects: what it requires, changed after the last green, newest first; never green, none (the box v18: "since there is no
// green to be after")
if (!deps.length) unknown.push('no dependency rows for this script');
const since = lastGreen ? lastGreen.tested : 0;
const suspects = bounded((lastGreen ? deps : []).map(function (p) { return Q.scriptRowOf.get(p); }).filter(function (s) { return !!s && Number(s.changed) > since; })
  .sort(function (x, y) { return Number(y.changed) - Number(x.changed); }).map(function (s) { return { script: s.name, changed: Number(s.changed) }; }));
if (lastGreen) unknown.push('the hash each required script had at the last green is not kept: a file changed and changed back is still a suspect');
// 8. where the run came from
unknown.push('the commit the run\'s world was copied from is not kept');
// The scripts that require this one and that its own suite pulled in (the dependency table read the other way), changed
// after the last green: a fault there shows in this red when the test loads them.
const requirers = Q.requirersOf.all(script).map(function (d) { return d.script; }).filter(function (p) { return deps.indexOf(p) !== -1; });
const requiringChanged = requirers.map(function (p) { return Q.scriptRowOf.get(p); }).filter(function (s) { return !!s && Number(s.changed) > since; }).map(function (s) { return s.name; });
// 6. flaky: the same script hash and test hash (the suite's for a row without one), both green and red, and nothing it requires
// or that requires it changed after the green: "nothing changed, so it is the machine, a timing or the order, never the code"
const sameRuns = history.filter(function (r) { return String(r.judged || '') === red.judged && sameTest(r, red); });
const flaky = sameRuns.some(function (r) { return r.verified; }) && sameRuns.some(function (r) { return !r.verified; }) && !suspects.items.length && !requiringChanged.length;
// 3. blame: where the fault lies, not who made it (Andy: "a fix is a fix and does not need to be done by the person/agent who
// caused the problem"), one verdict against the last green, its evidence beside it; the commits since the green that touched
// the script, its suite or what it requires stay as the evidence, each with its diff, without author (we commit as one account).
function whereOf() {
  const elsewhereCount = sameTestElsewhere.items.length + sameTestElsewhere.more;
  // First the run (the box v18): one that hung or crashed (the suite row's reason) is its own verdict, ahead of every check.
  const runReason = String(suiteRow.reason || '');
  if (runReason === 'hung' || runReason === 'crashed') return { where: 'not in this test: the run ' + runReason, because: 'the suite row\'s reason is ' + runReason + ', so every red of that run follows from it', scripts: [] };
  // ONE RUN RED ON SEVERAL SCRIPTS AT ONE MOMENT (the box v20): the same test red on 2 or more other scripts within a second of
  // it is one run cut off, as a classifier's at a restart, which keeps no reason.
  if (together.length >= 2) return { where: 'not in this test: one run red on all', because: 'the same test went red on ' + together.length + ' other scripts within a second of it: one run cut off', scripts: together };
  if (!lastGreen) return { where: 'not known', because: 'never green', scripts: [] };
  // Then the hashes (wsl's red fd4995f6: a changed script with its own test unchanged is in the script, though a setup check
  // and the same test elsewhere are red too); then a setup check, the same test elsewhere, what requires or is required, flaky.
  const scriptChanged = lastGreen.judged !== red.judged;
  // The test's own hash in place of the suite's (the box v18); the suite's for a row without one.
  const which = byTestHash(lastGreen, red) ? 'test' : 'suite';
  const suiteChanged = !sameTest(lastGreen, red);
  if (scriptChanged && !suiteChanged) return { where: 'in the script', because: 'the script\'s hash changed since the last green, the ' + which + '\'s did not', scripts: [script] };
  if (suiteChanged && !scriptChanged) return { where: 'in the test', because: 'the ' + which + '\'s hash changed since the last green, the script\'s did not', scripts: [suite] };
  if (scriptChanged && suiteChanged) return { where: 'not known', because: 'both the script\'s and the ' + which + '\'s hash changed since the last green', scripts: [] };
  if (fixFirst.items.some(function (x) { return x.setup; })) return { where: 'not in this script', because: 'a setup check of its run is red too', scripts: [] };
  if (elsewhereCount >= 3) return { where: 'not in this script', because: 'the same test is red on ' + elsewhereCount + ' other scripts: the test, a general rule or a file they share', scripts: [] };
  if (requiringChanged.length) return { where: 'in a script requiring it', because: 'neither hash changed; a script that requires it and that the test loads changed after the green', scripts: requiringChanged };
  const required = suspects.items.map(function (s) { return s.script; });
  if (required.length) return { where: 'in a script it requires', because: 'neither hash changed; a file it requires changed after the green (by change time only)', scripts: required };
  if (flaky) return { where: 'not in this script', because: 'flaky: red with the same hashes as a green', scripts: [] };
  return { where: 'not known', because: 'neither hash changed, and nothing it requires changed after the green', scripts: [] };
}
let changes = bounded([]);
if (lastGreen) {
  try {
    const at = path.relative(git(['rev-parse', '--show-toplevel']).trim(), RUN).split(path.sep).join('/');
    const inRepo = function (p) { return (at ? at + '/' : '') + p; };
    const files = [script, suite].concat(deps).map(inRepo);
    const sinceArg = '--since=@' + Math.floor(lastGreen.tested / 1000);
    const log = git(['log', sinceArg, '--format=%h%x09%an%x09%cI%x09%s', '--'].concat(files));
    // Each commit by its first line, cut at about 120 characters (the box v18).
    changes = bounded(log.split('\n').filter(Boolean).map(function (l) { const p = l.split('\t'); const subject = p.slice(3).join('\t'); return { commit: p[0], at: p[2], subject: subject.length > 120 ? subject.slice(0, 120) + '…' : subject }; }));
    changes.items.forEach(function (b) { Object.assign(b, shortDiff(git(['show', '-U0', '--format=', b.commit, '--'].concat(files)))); });
    suspects.items.forEach(function (s) { Object.assign(s, shortDiff(git(['log', sinceArg, '-p', '-U0', '--format=', '--', inRepo(s.script)]))); });
  } catch (e) { unknown.push('git could not be asked for the commits'); }
}
const blame = Object.assign(whereOf(), { changes: changes.items });
// The box v19, 9: whenever a verdict rests on testHash, that a helper the test calls outside its own block can change without it.
if (lastGreen && byTestHash(lastGreen, red) && /^in /.test(blame.where)) unknown.push('the verdict rests on testHash: a helper the test calls outside its own block can change without it');

// SAID FIRST, BY FIXED SENTENCES FROM THE FIELDS (the box: "so the same red always gives the same words").
function saidOf() {
  const s = [];
  const changeCount = changes.items.length + changes.more;
  s.push('fault: ' + blame.where + ', because ' + blame.because);
  if (lastGreen) s.push('red since ' + changeCount + ' commit' + (changeCount === 1 ? '' : 's') + ' touching its script, its suite or what it requires');
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
  blame: blame, blameMore: changes.more,
  suspects: suspects.items, suspectsMore: suspects.more,
  fixFirst: fixFirst.items, fixFirstMore: fixFirst.more, otherReds: otherReds,
  sameTestElsewhere: sameTestElsewhere.items, sameTestElsewhereMore: sameTestElsewhere.more,
  flaky: flaky,
  contradicts: contradicts.items, contradictsMore: contradicts.more,
  world: null,
  unknown: unknown,
};
process.stdout.write(JSON.stringify(out) + '\n');
process.exit(0);
