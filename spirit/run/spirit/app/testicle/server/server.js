'use strict';
require('../../../spirit.js');

// spirit/run/spirit/app/testicle/testicle.js
// TESTICLE'S SERVER (goal/G47.1, the server cycle). Its contract and its test: ./test/testicle.md and ./test/testicle.js.
//
// The box (goal/G47.1): "This cycle builds testicle's server, which keeps the first two tables of testicle.db, file and
// suite, in sync with run:// by itself", "on any change of a product file it makes sure that file has its row, and a suite
// row for every suite that concerns it", "When a suite or a product file is changed or added, the server adjusts the two
// tables file and suite by itself", "A product file or a suite that has not changed has no row in the database yet:
// nothing is read at start", "A removed file's row is marked deleted", "Any change in files is reflected in the database
// 1 second after it occurs", "The suites that concern a file: its own test/<name>.js, and the general tests that would
// include that production file if they were run without a file argument", "The server takes a file's suites from
// testModule.js, run as its own process, ...: run with no file, it keeps the file's own test and the
// general tests' entries that name that file. testModule.js does not move.", "The testicle server will serve one first
// verb, \"busy\": it returns true if it is doing any work, false if it is idle." The columns are goal/G45.1's box.
//
// WHAT IT DOES:
//   - it follows run:// through the node's one file tree (spirit/fs.js, goal/G49.2), no watcher of its own;
//   - a changed .js in a test/ folder is a suite, any other .js a product file; the node's state, .git and vendored
//     code are never watched, and a file that is no script is let go;
//   - the changes of one moment are taken together: testModule.js is run once, as its own process (a test file is run,
//     never loaded: spirit-sibling-general.js (testReachRules)), and the rows are written in one transaction.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile, execFileSync, spawn } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
// Every status line and every result's icon, worded in one place (goal/G47.1; ./words.js).
const appServer = spirit.require('spirit/server/app.js');
const { VENDORED_FOLDERS } = spirit.require('spirit/fs/fileSystem.js');
const { createProbabilityBucket } = spirit.require('spirit/listLimiter.js');
const { probabilityStringObjectMatch } = spirit.require('spirit/search/object.js');
const limits = spirit.require('spirit/limits.js');
// What one search answer holds once its frame is counted (as the agent's tables count it, rowTable.js).
const SEARCH_ROOM = limits.ANSWER_MAX - Buffer.byteLength(JSON.stringify({ items: [], more: false }), 'utf8');

const argv = process.argv;
function arg(name) { const at = argv.indexOf(name); return at !== -1 ? argv[at + 1] : ''; }

// ITS STATE IS THE NODE'S TO NAME (desk/G1 D5): spirit/state/testicle/data/, handed over as --state.
const STATE = arg('--state');
if (!STATE) {
  console.error('testicle: no --state; the node that starts this names its state folder');
  process.exit(2);
}
fs.mkdirSync(STATE, { recursive: true });
// run://, the tree it keeps: three folders above this one.
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const TEST_MODULE = path.join(RUN, 'spirit', 'test', 'testModule.js');

// THE TWO TABLES OF testicle.db (goal/G45.1's box), script and suite. A boolean is 0 or 1; changed is a numeric UTC timestamp.
// NO TABLE MADE BEFORE IS MENDED: none is renamed, and no column is added, dropped or renamed (Andy, goal/G47.1: "old
// files or tables should not be mended, THE SHOULD BE FUCKING KILLED AND ELIMINATED FOREVER!"). An old testicle.db is
// deleted by hand, on his word.
const db = new DatabaseSync(path.join(STATE, 'testicle.db'));
// A WRITE WAITS FOR A READER, never fails on it: a reader of testicle.db (its test, a backup) holding it for a moment made
// a job's end throw "database is locked", and that suite was never judged.
db.exec('PRAGMA busy_timeout = 5000');
db.exec('CREATE TABLE IF NOT EXISTS script (name TEXT PRIMARY KEY, hash TEXT NOT NULL DEFAULT \'\', deleted INTEGER NOT NULL DEFAULT 0, changed INTEGER NOT NULL, ' +
  'reClassify INTEGER NOT NULL DEFAULT 1, browserOnly INTEGER NOT NULL DEFAULT 0, nodeOnly INTEGER NOT NULL DEFAULT 0)');
db.exec('CREATE TABLE IF NOT EXISTS suite (script TEXT NOT NULL, suite TEXT NOT NULL, test INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0, ' +
  'hash TEXT NOT NULL DEFAULT \'\', outcome TEXT NOT NULL DEFAULT \'\', changed INTEGER NOT NULL, PRIMARY KEY (script, suite))');
// THE REASON OF A RED (goal/G47.6, box point 1: "The suite table is not mended; it gains one field, reason, shown as the
// explanation of a suite's red: crashed or hung when no verdict was reached."): added to a table made before it, nothing else
// of it touched. '' when the verdict was reached.
if (!db.prepare('PRAGMA table_info(suite)').all().some(function (c) { return c.name === 'reason'; })) db.exec("ALTER TABLE suite ADD COLUMN reason TEXT NOT NULL DEFAULT ''");
// HOW LONG ITS LAST RUN TOOK (goal/G48.4, Andy: "do we time a test or a suite record the runtime?", "can those measurements
// contribute to returning more results faster?", then "go! test and build."): ms, the milliseconds a suite row's last run took
// for its script, 0 for one never timed; added to a table made before it, as reason was, nothing else of it touched.
if (!db.prepare('PRAGMA table_info(suite)').all().some(function (c) { return c.name === 'ms'; })) db.exec('ALTER TABLE suite ADD COLUMN ms INTEGER NOT NULL DEFAULT 0');
// THE DEPENDENCY TABLE (goal/G47.6, box point 3: "They are kept in a new table of testicle's, dependency, one row per script
// and each file in its chain, replaced each time the classifier classifies that script."): requires is a file the script's
// load pulled in (script.classify), or its own suite pulled in while it ran (suite.success).
db.exec('CREATE TABLE IF NOT EXISTS dependency (script TEXT NOT NULL, requires TEXT NOT NULL, PRIMARY KEY (script, requires))');
// THREE FIELDS ON THE SCRIPT TABLE (goal/G47.1, box v79, 3): reClassify "this script needs re-classification.",
// browserOnly "this script file is an ui-element and runs in the browser only", nodeOnly "this script file runs on node.js
// only"; both false, it runs on both, and classification never sets both. "a script seen for the first time starts with
// reClassify true" (Andy: "yes, of course."). "when the server (always) processes file changes, and the hash of the
// script changes, \"reClassify\" must be set to \"true\". That field can only be reset to false by classification".
// The fields are in the table as it is made, above.
const Q = {
  script: db.prepare('SELECT * FROM script WHERE name = ?'),
  putScript: db.prepare('INSERT INTO script (name, hash, deleted, changed, reClassify) VALUES (?, ?, 0, ?, 1) ON CONFLICT(name) DO UPDATE SET ' +
    'reClassify = CASE WHEN script.hash <> excluded.hash THEN 1 ELSE script.reClassify END, hash = excluded.hash, deleted = 0, changed = excluded.changed'),
  goneScript: db.prepare('INSERT INTO script (name, hash, deleted, changed) VALUES (?, \'\', 1, ?) ON CONFLICT(name) DO UPDATE SET deleted = 1, changed = excluded.changed'),
  // A suite row flagged test: the suite needs running (goal/G45.1). Its outcome is kept: nothing runs a suite yet.
  putSuite: db.prepare('INSERT INTO suite (script, suite, test, deleted, hash, outcome, changed) VALUES (?, ?, 1, 0, ?, \'\', ?) ' +
    'ON CONFLICT(script, suite) DO UPDATE SET test = 1, deleted = 0, hash = excluded.hash, changed = excluded.changed'),
  goneSuitesOfScript: db.prepare('UPDATE suite SET deleted = 1, changed = ? WHERE script = ? AND deleted = 0'),
  goneRowsOfSuite: db.prepare('UPDATE suite SET deleted = 1, changed = ? WHERE suite = ? AND deleted = 0'),
  suitesOfScript: db.prepare('SELECT * FROM suite WHERE script = ? ORDER BY suite'),
  redRows: db.prepare("SELECT script, suite FROM suite WHERE deleted = 0 AND test = 0 AND outcome = 'red'"),
  // EVERY SUITE, EACH ONCE (goal/G47.1, the box: "The testicle search can search by a suite alone"): flagged if any of its
  // rows is, deleted only when all of them are.
  everySuite: db.prepare("SELECT suite, MAX(test) AS test, MIN(deleted) AS deleted, MAX(changed) AS changed, CASE WHEN SUM(outcome = 'red') > 0 THEN 'red' WHEN SUM(outcome = 'green') = COUNT(*) THEN 'green' ELSE '' END AS outcome FROM suite GROUP BY suite ORDER BY suite"),
  rowsOfSuite: db.prepare('SELECT * FROM suite WHERE suite = ?'),
  suiteRow: db.prepare('SELECT * FROM suite WHERE script = ? AND suite = ?'),
};

// THE TABLE testicle (goal/G45.1's box; goal/G47.1, the test-table cycle; renamed from test in the rename cycle, the box:
// "The testicle test table is renamed \"testicle\""; Andy: "no fucking data-rescue missions!", so an older table test is
// left as it is, never moved over). One row per flip: a test's history is its rows, its
// status now its current one. The box: "If the test does not flip, the current row is only updated with the last checked
// date, and, if it exists, the hash of the product file", "If the test flips, a new active row is created; this will keep
// change history", "The server applies the severity to the row only if the new severity is higher than the old one" (on a
// flip the old one is the row it replaces: a test's severity never goes down). "One index over the current rows, by
// verified, then severity from high to low" (G45.1): every test search reads the current rows alone.
// ONE DATE, NO FLIPPED (goal/G48.4, Andy: "FLIPPED IS KILLED NOW!!!", "the \"date\" is changed on every report, if the test
// flips a new row is made current....", "you KILL IT IN THE MOTHERFUCKING DATABASE, TOO"): tested is a row's one date, set
// by every report; a row is named by its id, a number the table gives it, since a date that changes names nothing.
db.exec('CREATE TABLE IF NOT EXISTS testicle (id INTEGER PRIMARY KEY, script TEXT NOT NULL, suite TEXT NOT NULL, test TEXT NOT NULL, ' +
  'current INTEGER NOT NULL DEFAULT 1, verified INTEGER NOT NULL, tested INTEGER NOT NULL, judged TEXT NOT NULL DEFAULT \'\', ' +
  'severity REAL NOT NULL DEFAULT 0, suiteHash TEXT NOT NULL DEFAULT \'\')');
// BOTH HASHES ON A TEST ROW (goal/G47.1, the box: "A testicle row carries both hashes it ran against, the script's and the
// suite's"): judged is the script's, suiteHash the suite's.
db.exec('CREATE INDEX IF NOT EXISTS testicle_current ON testicle (verified, severity DESC, tested DESC) WHERE current = 1');
const T = {
  current: db.prepare('SELECT * FROM testicle WHERE script = ? AND suite = ? AND test = ? AND current = 1'),
  add: db.prepare('INSERT INTO testicle (script, suite, test, current, verified, tested, judged, severity, suiteHash) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?)'),
  tested: db.prepare('UPDATE testicle SET tested = ?, judged = ?, severity = MAX(severity, ?), suiteHash = ? WHERE id = ?'),
  retire: db.prepare('UPDATE testicle SET current = 0 WHERE id = ?'),
  // The current rows in the index's order: the failed first, then most severe first, the newest report first among equals
  // (goal/G47.1, the box: "Every test search answers its failed tests first, then by severity").
  currents: db.prepare('SELECT * FROM testicle WHERE current = 1 ORDER BY verified, severity DESC, tested DESC'),
  reds: db.prepare('SELECT * FROM testicle WHERE current = 1 AND verified = 0 ORDER BY severity DESC, tested DESC'),
  row: db.prepare('SELECT * FROM testicle WHERE id = ?'),
  // A test's history: every row of it, the newest first.
  history: db.prepare('SELECT * FROM testicle WHERE script = ? AND suite = ? AND test = ? ORDER BY id DESC'),
  // The current rows of one script and suite: what its status is judged from.
  ofSuite: db.prepare('SELECT * FROM testicle WHERE script = ? AND suite = ? AND current = 1'),
  // Every title of one script and suite, with when it was last tested, and every row of one title (eraseUnreported).
  titlesOf: db.prepare('SELECT test, MAX(tested) AS last FROM testicle WHERE script = ? AND suite = ? GROUP BY test'),
  rowsOf: db.prepare('SELECT * FROM testicle WHERE script = ? AND suite = ? AND test = ?'),
  erase: db.prepare('DELETE FROM testicle WHERE script = ? AND suite = ? AND test = ?'),
  // One suite's title, of every script (testicle.title): whether a title is there, its rows, and their rename.
  titleInSuite: db.prepare('SELECT 1 AS there FROM testicle WHERE suite = ? AND test = ? LIMIT 1'),
  ofTitle: db.prepare('SELECT * FROM testicle WHERE suite = ? AND test = ?'),
  retitle: db.prepare('UPDATE testicle SET test = ? WHERE suite = ? AND test = ?'),
};
// The rule a test's title keeps (goal/G47.4, the box: "test titles are constrained BY DESCRIPTION_MAX_BYTES, in
// spirit/fieldRules.js").
function fieldRules() { return spirit.require('spirit/fieldRules.js'); }
// A SUITE ROW'S STATUS, THE SERVER'S ALONE (goal/G47.1, the box: "A suite row's status, for its script: \"needs running\"
// when it never ran; \"still red\" when it ran, but has failed tests in it for that script; \"green\" if all tests in the
// suite passed", "\"needs running\" clears when the server has a full, successful report from the suite in its database for
// that script", "The flag is the server's alone; no suite reports anything new and no suite touches the flag", "Full: every
// row of that script and suite in the testicle table was tested after the flag was set; then \"green\" if every one passed,
// \"still red\" if one failed"). Its outcome column holds 'green' or 'red' once judged; the flag, test, says needs running.
const judgeSuite = db.prepare('UPDATE suite SET test = 0, outcome = ?, changed = ?, reason = \'\' WHERE script = ? AND suite = ?');
const setReason = db.prepare('UPDATE suite SET reason = ? WHERE script = ? AND suite = ?');
const setMs = db.prepare('UPDATE suite SET ms = ? WHERE script = ? AND suite = ?');
const D = {
  drop: db.prepare('DELETE FROM dependency WHERE script = ?'),
  add: db.prepare('INSERT OR IGNORE INTO dependency (script, requires) VALUES (?, ?)'),
  dependents: db.prepare('SELECT DISTINCT script FROM dependency WHERE requires = ?'),
  // A FILE GONE FROM THE TREE TAKES ITS DEPENDENCY ROWS WITH IT, both ways (goal/G47.1, Andy: "classification must bring with
  // it a complete reconciliation of the dataset in its tables", then "yes. that's what i say."): every row naming a file no
  // longer on disc, as a script or as required, goes whenever the tree's shape changed, at start too (dropStale).
  named: db.prepare('SELECT script AS name FROM dependency UNION SELECT requires FROM dependency'),
  gone: db.prepare('DELETE FROM dependency WHERE script = ? OR requires = ?'),
};
// On disc, whatever the scope: in debug mode a script of the scope still requires spirit/spirit.js.
function dropStale() { D.named.all().forEach(function (r) { let on = false; try { on = fs.statSync(path.join(RUN, r.name)).isFile(); } catch (e) { on = false; } if (!on) D.gone.run(r.name, r.name); }); }
// The files a script requires, as sent: run paths of production scripts, each once, never the script itself.
// A list comes as JSON in a string (goal/G48.4, Q6, Andy: lists are "spirit.type.string.json").
function requiresOf(script, sent) {
  let list = null;
  try { list = typeof sent === 'string' ? JSON.parse(sent) : null; } catch (e) { list = null; }
  if (!Array.isArray(list)) return [];
  const out = [];
  list.forEach(function (p) {
    const r = posix(String(p || '')).replace(/^\.?\//, '');
    if (!/\.js$/.test(r) || r === script || r.indexOf('..') !== -1 || isSuite(r) || out.indexOf(r) !== -1) return;
    out.push(r);
  });
  return out;
}
function statusOf(test, outcome) { return test ? 'needs running' : outcome === 'red' ? 'still red' : outcome === 'green' ? 'green' : 'needs running'; }
// A test row as the verbs and the stream carry it: its key its full key, script|suite|test|id, its booleans booleans
// (goal/G47.1, the box: "the page keeps test rows by their full key ... and shows a test's current row"; the key's last part
// the row's id since goal/G48.4 killed flipped), so a flipped test's replaced row and its current row are two rows wherever
// they are kept.
function testServed(r) {
  return { key: r.script + '|' + r.suite + '|' + r.test + '|' + Number(r.id), id: Number(r.id), script: r.script, suite: r.suite, test: r.test, current: !!r.current,
    verified: !!r.verified, tested: Number(r.tested), judged: r.judged, suiteHash: String(r.suiteHash || ''), severity: Number(r.severity) };
}

function posix(p) { return String(p).split(path.sep).join('/'); }
function hashOf(rel) { try { return crypto.createHash('sha256').update(fs.readFileSync(path.join(RUN, rel))).digest('hex'); } catch (e) { return ''; } }
// In debug mode a file outside its scope is not there (DEBUG, below).
function there(rel) { if (!inScope(posix(rel))) return false; try { return fs.statSync(path.join(RUN, rel)).isFile(); } catch (e) { return false; } }
// Never watched: the node's state (this database among it), .git, and vendored code, as testModule.js skips them.
function ignored(full) {
  const rel = posix(path.relative(RUN, path.resolve(full)));
  if (!rel || rel.indexOf('..') === 0) return false;
  return rel.split('/').some(function (part) { return part === 'state' || part === 'app-state' || part === '.git'; }) || VENDORED_FOLDERS.holds(path.join(RUN, rel)) || !onTheWay(rel);
}
// A suite is a .js in a test/ folder; any other .js is a product file.
function isSuite(rel) { return path.posix.basename(path.posix.dirname(rel)) === 'test'; }
// A product file's own test, ./test/<name>.js, and back.
function ownTestOf(file) { return path.posix.join(path.posix.dirname(file), 'test', path.posix.basename(file)); }
function fileOfOwnTest(suite) { return path.posix.join(path.posix.dirname(path.posix.dirname(suite)), path.posix.basename(suite)); }

// THE QUEUE AND ITS ONE RUNNER (goal/G47.1, the queue cycle, the box: "The flags are the queue: every suite row flagged
// \"needs running\" is owed one run, and there is no second list, so nothing is queued twice", "One runner: one suite
// process at a time, never two. It starts 1 second after the last file change event; a new event pushes the start back",
// "A job is one suite for one script, one process each", "General tests first", "A press of 🏃‍♂️ puts its suite and script
// at the head of the queue, never a second run beside the running one", "Nobody but testicle starts runs", "Rows already
// flagged when the server starts: the runner starts 1 second after the server starts"). A suite runs as its own process in
// this checkout, so its reporter reports to this node: a general test given the script, an own test nothing, --test <title>
// when a title was asked.
const QUIET_MS = 1000;
// THE ONE JOB LIMIT, 120 MINUTES FOR EVERY RUN (goal/G47.1, Andy: "the timelimit on long runs is stupid, testicle can already
// stop long run... so make the mimit 120 minutes...."; it was 2 minutes a script): past it the job is killed and its tests
// failed. A classifying run and a general test's run of many scripts have the same one limit.
const JOB_LIMIT_MS = 120 * 60 * 1000;
const flaggedRows = db.prepare('SELECT script, suite, outcome, ms FROM suite WHERE test = 1 AND deleted = 0');
let job = null;          // { script, suite, title, scriptHash, suiteHash, started, kid, timer, killed }
const front = [];        // [{ script, suite, title }], pressed: run first, the newest press first
let quiet = null;
function isGeneral(suite) { return /-(child|sibling)-/.test(path.posix.basename(suite)); }
// THE PREFERENCES (goal/G47.1, box v79, 2 and 4): "spirit/state/testicle/data/preferences.json", the one preference
// interactive, "true by default": "interactive: all actions and runs are controlled by the user through the UI or through
// api calls", "auto: the default mode until now: the server auto-processes everything". Either way "the server will flag
// changed suites AND scripts always, in both modes": interactive holds back only the runner's own picks from the flags; a
// press (🏃‍♂️, or testicle.run) runs as before. A file that cannot be read, or holds no boolean, is the default.
const PREFS_FILE = path.join(STATE, 'preferences.json');
const PREFS_DEFAULT = { interactive: true };
function readPrefs() {
  try {
    const p = JSON.parse(fs.readFileSync(PREFS_FILE, 'utf8'));
    return { interactive: typeof (p && p.interactive) === 'boolean' ? p.interactive : PREFS_DEFAULT.interactive };
  } catch (e) { return Object.assign({}, PREFS_DEFAULT); }
}
let prefs = readPrefs();
// DEBUG MODE (goal/G47.1, box v143: "testicle has a debug mode, set only by ./test/testicle.js (a preference it writes on its
// scratch node, no verb): in it testicle operates as if run://spirit/app/testicle/ were ALL the testables of the whole node";
// Andy: "the testicle tests set the testicle server to \"debug\""): debug true in preferences.json, read once at start, never
// set nor answered by a verb. In it a file outside spirit/app/testicle/ is not there (there) and never watched (ignored), so
// testicle's scripts, its general suites and the classifier's scripts are only testicle's own; the classifier itself,
// spirit/test/scriptClassify.js, is still used ("still used, but in debug mode only called with scripts in
// spirit/app/testicle/"). With no debug set, as on Andy's node and an agent's, the whole tree, as before.
const DEBUG_SCOPE = 'spirit/app/testicle/';
const DEBUG = (function () { try { return JSON.parse(fs.readFileSync(PREFS_FILE, 'utf8')).debug === true; } catch (e) { return false; } }());
function inScope(rel) { return !DEBUG || rel === CLASSIFY || String(rel).indexOf(DEBUG_SCOPE) === 0; }
// A folder on the way to the scope, or in it, is walked and watched; in debug mode nothing else.
// IN DEBUG MODE IT NEVER RECURSES (goal/G47.1, Q8, Andy: "testicle MUST not recurse... and not run it's own tests just the
// dummies..."): a suite of testicle's own, a test under its folder but not temp/, never runs; the three dumb general tests
// (test/testicle-sibling-*.js) and the planted temp/ worlds do. Its own test of testicle would otherwise run testicle's whole
// suite again, and hold the node and a lab node busy for an hour.
function ownSuite(suite) {
  const s = String(suite || '');
  return DEBUG && s.indexOf(DEBUG_SCOPE) === 0 && s.indexOf(DEBUG_SCOPE + 'temp/') !== 0 && /(^|\/)test\//.test(s) &&
    !/^spirit\/app\/testicle\/test\/testicle-sibling-(general|node|browser)\.js$/.test(s);
}
// The classifier too, and the folders on the way to it (goal/G47.1, found by testicle.js's "when the classifier changes, a
// script classified before reads reClassify true again"): inScope counts it in, but in debug mode its change was never heard,
// spirit/test/ being off the way to the scope; nothing else of spirit/test/ is.
function onTheWay(rel) {
  return !DEBUG || !rel || DEBUG_SCOPE.indexOf(rel + '/') === 0 || String(rel).indexOf(DEBUG_SCOPE) === 0 || rel === CLASSIFY || CLASSIFY.indexOf(rel + '/') === 0;
}
if (DEBUG) console.error('testicle: debug mode, its scope ' + DEBUG_SCOPE);
// A file change, a press or the start: the runner waits for one quiet second, a new event pushing it back.
function soon() {
  if (quiet) clearTimeout(quiet);
  quiet = setTimeout(function () { quiet = null; nextJob(); }, QUIET_MS);
}
// THE CLASSIFIER (goal/G47.1, box v94, 1): "spirit/test/scriptClassify.js is a \"special\" general test under its own name,
// with its suite row, always automatically executed by the server", "the testicle server continues classifying until all
// scripts are classified before moving to actual testing", "the server will classify scripts automatically, interactive
// or not (auto)", "if after a classifying run more scripts have changed, another classifying run will start". One run takes
// every script whose reClassify is set, as a list; nothing else runs while one is owed. "a script that cannot be classified
// gets an error row in the testicle table: script the script, suite spirit/test/scriptClassify.js, test \"classifyable\",
// failed. That row prevents it from being tested in any other way: the runner starts no other suite for a script whose
// classifyable row is red. No flag on the script row."
const CLASSIFY = 'spirit/test/scriptClassify.js';
// The classifier's one test title (spirit/test/scriptClassify.js), a plain sentence (goal/G47.1, Andy: "THE TITLE HAS TO BE
// COMPREHENSIBLE FUCKING ENGLISH").
const CLASSIFYABLE = 'it loads, so it can be classified';
// "its severity is 0.8": what a run that never classified a script fails it with.
const CLASSIFY_SEVERITY = 0.8;
// THE CLASSIFIER'S TOOL DOWN (goal/G47.6, box point 1: "The script is spared only when the test proves its tool never reached
// it"): a classifying run that ends with TOOL_DOWN could get no scratch node or no Chrome, so the scripts it judged nothing
// for stay unjudged and waiting (classifyEnded), and the next classifying run waits CLASSIFY_RETRY_MS, so a missing tool is
// not booted again and again. The exit code is spirit/test/scriptClassify.js's TOOL_DOWN.
const TOOL_DOWN = 3;
const CLASSIFY_RETRY_MS = 60000;
let classifyAfter = 0;
const toClassify = db.prepare('SELECT name, hash FROM script WHERE reClassify = 1 AND deleted = 0 ORDER BY name');
const setClass = db.prepare('UPDATE script SET browserOnly = ?, nodeOnly = ?, reClassify = ?, changed = ? WHERE name = ?');
const classified = db.prepare('UPDATE script SET reClassify = 0, changed = ? WHERE name = ? AND hash = ? AND reClassify = 1');
const reclassify = db.prepare('UPDATE script SET reClassify = 1, changed = ? WHERE name = ? AND deleted = 0');
// The scripts whose current classifyable row was judged by other bytes of the classifier than these.
const classifiedBy = db.prepare('SELECT DISTINCT script FROM testicle WHERE suite = ? AND current = 1 AND suiteHash <> ?');
function blocked(script) { const r = T.current.get(script, CLASSIFY, CLASSIFYABLE); return !!r && !r.verified; }
// WHICH KIND JUDGES WHICH SCRIPT (goal/G47.1, box v94, 2: "node only scripts are tested by -general AND -node general tests.
// browser only scripts are tested by -general and -browser general tests. if a script is NOT browser only AND NOT node only,
// it will be tested by all 3 categories."): a -node general test never runs for a browser-only script, a -browser one never
// for a node-only one, and such a suite row is never shown (Andy: "why do you display -sibling-node suites for elements?
// just so they disappear when touched?"): the moment a script is classified its unfitting rows are marked deleted, streamed,
// their test rows current no more (pruneUnfit); a write never makes one for a script whose class rules it out; at start
// every classified script is swept once; the runner, meeting one, drops it too. A script's next change brings its rows
// back, and the class then standing decides again.
const dropRow = db.prepare('UPDATE suite SET deleted = 1, changed = ? WHERE script = ? AND suite = ? AND deleted = 0');
function fits(script, suite) {
  const kind = (/-(?:child|sibling)-(node|browser)\.js$/.exec(path.posix.basename(suite)) || [])[1];
  if (!kind) return true;
  const sr = Q.script.get(script);
  if (!sr) return true;
  return kind === 'node' ? !sr.browserOnly : !sr.nodeOnly;
}
function unfit(script, suite) {
  if (fits(script, suite)) return false;
  if (dropRow.run(Date.now(), script, suite).changes) {
    tell('suite', suiteServed(Q.suiteRow.get(script, suite)), 'deleted');
    T.ofSuite.all(script, suite).forEach(function (t) {
      T.retire.run(t.id);
      tell('testicle', testServed(T.row.get(t.id)), 'updated');
    });
  }
  return true;
}
// Every live suite row of one script its class rules out, dropped.
function pruneUnfit(script) { Q.suitesOfScript.all(script).forEach(function (r) { if (!r.deleted) unfit(script, r.suite); }); }
function chooseJob() {
  if (there(CLASSIFY) && Date.now() >= classifyAfter) {
    const owed = toClassify.all().filter(function (r) { return there(r.name); });
    if (owed.length) {
      const hashes = Object.create(null);
      owed.forEach(function (r) { hashes[r.name] = r.hash; });
      return { classify: true, script: '', suite: CLASSIFY, title: '', scripts: owed.map(function (r) { return r.name; }), hashes: hashes };
    }
  }
  while (front.length) {
    const f = front.shift();
    // A STOPPED BATCH RE-ASSEMBLED (box v130: "a run aborted (stopped or killed): the server RE-ASSEMBLES a new run at once, fresh
    // from the flags as they stand"): its suite's rows still flagged, the scripts that reported their success left out.
    if (f.resume) { const again = batchOf(f.suite); if (again) return again; continue; }
    if (there(f.script) && there(f.suite) && !ownSuite(f.suite) && !blocked(f.script) && !unfit(f.script, f.suite)) return f;
  }
  // Interactive: only what was pressed runs; the flagged rows wait for a press, or for auto.
  if (prefs.interactive) return null;
  const rows = flaggedRows.all().filter(function (r) { return r.suite !== CLASSIFY && there(r.script) && there(r.suite) && !ownSuite(r.suite) && !blocked(r.script) && !unfit(r.script, r.suite); });
  // General tests first, "because they tend to get most coverage fastest" (Andy); THEN THE REDS, THEN THE QUICKEST (goal/G48.4,
  // Andy: "we want fixing-work to appear as fast as possible at the top of the queue", "we want the most results as quickly as
  // possible", then "go! test and build."): a row last judged red before one that was not, then the shorter last run first, a
  // row never timed (ms 0) counting as quick, so new work is not held back; then by name, so the order is stable.
  const red = function (r) { return r.outcome === 'red' ? 1 : 0; };
  rows.sort(function (a, b) { return (isGeneral(b.suite) - isGeneral(a.suite)) || (red(b) - red(a)) || ((Number(a.ms) || 0) - (Number(b.ms) || 0)) || (a.suite < b.suite ? -1 : a.suite > b.suite ? 1 : 0) || (a.script < b.script ? -1 : a.script > b.script ? 1 : 0); });
  if (!rows.length) return null;
  // A GENERAL TEST IS HANDED A LIST (goal/G47.1, box v94, 2: "else it will process all scripts listed in the arguments that
  // fit"; Andy: "optimizing the testicle server so it gives the general tests a LIST instead of calling them one-by-one"):
  // every flagged script of that one suite, in one run, each with its hash as the run starts.
  if (isGeneral(rows[0].suite)) return batchOf(rows[0].suite);
  return { script: rows[0].script, suite: rows[0].suite, title: '' };
}
// One general test's run of every script still flagged for it, each with its hash as the run starts; null when none is.
function batchOf(suite) {
  const mine = flaggedRows.all().filter(function (r) { return r.suite === suite && there(r.script) && there(r.suite) && !ownSuite(r.suite) && !blocked(r.script) && !unfit(r.script, r.suite); })
    .sort(function (a, b) { return a.script < b.script ? -1 : a.script > b.script ? 1 : 0; });
  if (!mine.length) return null;
  const hashes = Object.create(null);
  mine.forEach(function (r) { const sr = Q.script.get(r.script); hashes[r.script] = (sr && sr.hash) || hashOf(r.script); });
  return { batch: true, script: '', suite: suite, title: '', scripts: mine.map(function (r) { return r.script; }), hashes: hashes };
}
// WHY THE RUNNER WAITS, WRITTEN DOWN (goal/G47.1; Andy saw classifying start only when he turned interactive off, and
// nothing said why): while scripts are owed a class, each time the runner does not start it says why on its stderr, a
// reason said once until it changes.
let waitedFor = '';
// NOTHING LOITERS, BEFORE AND AFTER EVERY RUN (goal/G47.1; Andy: "testicle can double ensure that no fucking lab nodes or
// headless chromes are loitering about before AND after ever fucking run.", "but noooo, it has to an elaborate design with
// as many failure points as possible!"): before every job, and when the runner has nothing left to choose, every process
// still holding or running on a node of this tree's lab (repo://lab/node/<name>.lock and .pid) is ended with all it started,
// those files go, and every headless Chrome on a profile of this tree's (spirit/test/headLessChrome's temp route) is ended.
// Testicle is the one run on its tree; nothing else is asked. Only the node and Chrome it hands its own runs are spared.
let idle = true;
const LAB_NODES = path.join(RUN, '..', '..', 'lab', 'node');
function sweep(when) {
  const records = [];
  try {
    fs.readdirSync(LAB_NODES).filter(function (f) { return /\.(lock|pid)$/.test(f) && f !== '.lab.lock'; }).forEach(function (f) {
      const at = path.join(LAB_NODES, f);
      let pid = 0; try { pid = Number(fs.readFileSync(at, 'utf8').trim()) || 0; } catch (e) { pid = 0; }
      records.push({ f: f, at: at, pid: pid });
    });
  } catch (e) { /* no lab on this tree */ }
  let profiles = '';
  try { profiles = spirit.require('spirit/tempFolder.js').path('spirit/test/headLessChrome'); } catch (e) { profiles = ''; }
  const chromes = profiles ? chromesOn(profiles) : [];
  // TESTICLE'S OWN NODE AND CHROME ARE SPARED, their records too: swept before every suite (wsl's red, "while the runner stays
  // busy, a stray left on a lab node during one suite is ended before the next suite runs"), the world it hands its runs lives
  // across them, until the runner has nothing left to choose.
  const spare = (records.length || chromes.length) && world && world.kid && world.kid.pid ? treeOf(world.kid.pid) : [];
  const spared = function (pid) { return pid === process.pid || spare.indexOf(pid) !== -1; };
  let pids = [];
  records.forEach(function (r) {
    if (r.pid && spared(r.pid)) return;
    if (r.pid && pids.indexOf(r.pid) === -1) pids.push(r.pid);
    try { fs.rmSync(r.at, { force: true }); } catch (e) { logError('sweep ' + when + ': ' + r.f, e); }
  });
  chromes.forEach(function (p) { if (!spared(p) && pids.indexOf(p) === -1) pids.push(p); });
  pids = pids.filter(alive);
  if (!pids.length) return;
  logError('sweep ' + when + ': ending ' + pids.length + ' loitering process(es): ' + pids.join(' '), null);
  pids.forEach(endTree);
}
// A process and every process descending from it, by parent id.
function treeOf(root) {
  let pairs = [];
  try {
    if (process.platform === 'linux') {
      pairs = fs.readdirSync('/proc').filter(function (d) { return /^\d+$/.test(d); }).map(function (d) {
        try { const st = fs.readFileSync('/proc/' + d + '/stat', 'utf8'); return [Number(d), Number(st.slice(st.lastIndexOf(')') + 2).split(' ')[1])]; } catch (e) { return null; }
      }).filter(Boolean);
    } else {
      const list = process.platform === 'win32'
        ? ['powershell', ['-NoProfile', '-NonInteractive', '-Command', 'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId) $($_.ParentProcessId)" }']]
        : ['ps', ['-A', '-o', 'pid=,ppid=']];
      pairs = execFileSync(list[0], list[1], { encoding: 'utf8', windowsHide: true, timeout: 30000, maxBuffer: 1 << 24 }).split(/\r?\n/)
        .map(function (l) { const m = /^\s*(\d+)\s+(\d+)/.exec(l); return m ? [Number(m[1]), Number(m[2])] : null; }).filter(Boolean);
    }
  } catch (e) { pairs = []; }
  const out = [root];
  for (let i = 0; i < out.length; i++) pairs.forEach(function (p) { if (p[1] === out[i] && out.indexOf(p[0]) === -1) out.push(p[0]); });
  return out;
}
function alive(pid) { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } }
// A process and all it started: taskkill /T on Windows; elsewhere its descendants by parent id, then itself.
function endTree(pid) {
  if (process.platform === 'win32') { try { execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 30000 }); } catch (e) { /* gone */ } return; }
  let kids = [];
  try { kids = execFileSync('ps', ['-A', '-o', 'pid=,ppid='], { encoding: 'utf8', timeout: 30000 }).split('\n').map(function (l) { return /^\s*(\d+)\s+(\d+)/.exec(l); }).filter(Boolean); } catch (e) { kids = []; }
  (function down(p) { kids.filter(function (m) { return Number(m[2]) === p; }).forEach(function (m) { down(Number(m[1])); try { process.kill(Number(m[1]), 'SIGKILL'); } catch (e) { /* gone */ } }); }(pid));
  try { process.kill(pid, 'SIGKILL'); } catch (e) { /* gone */ }
}
// Every process whose command line names a folder under that profile route: the Chromes of this tree's tests.
function chromesOn(profiles) {
  const want = path.resolve(profiles).toLowerCase();
  if (process.platform === 'linux') {
    try {
      return fs.readdirSync('/proc').filter(function (d) { return /^\d+$/.test(d); }).filter(function (d) {
        try { return fs.readFileSync('/proc/' + d + '/cmdline', 'utf8').split('\0').join(' ').toLowerCase().indexOf(want) !== -1; } catch (e) { return false; }
      }).map(Number);
    } catch (e) { return []; }
  }
  const list = process.platform === 'win32'
    ? ['powershell', ['-NoProfile', '-NonInteractive', '-Command', 'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId) $($_.CommandLine)" }']]
    : ['ps', ['-A', '-o', 'pid=,args=']];
  let out = '';
  try { out = execFileSync(list[0], list[1], { encoding: 'utf8', windowsHide: true, timeout: 30000, maxBuffer: 1 << 24 }); } catch (e) { return []; }
  return out.split(/\r?\n/).map(function (l) { const m = /^\s*(\d+)\s+(.*)$/.exec(l); return m && m[2].toLowerCase().split('/').join(path.sep).indexOf(want) !== -1 ? Number(m[1]) : 0; }).filter(Boolean);
}
function waits(why) {
  if (why === waitedFor) return;
  waitedFor = why;
  let owed = 0;
  try { owed = toClassify.all().length; } catch (e) { owed = -1; }
  if (owed) logError('runner waits, ' + owed + ' scripts owed a class: ' + why, null);
}
function nextJob() {
  if (job || quiet) { waits(job ? 'a job runs' : 'the quiet second'); return; }
  // NEVER WHILE A CHANGE IS STILL BEING WRITTEN (wsl's verify: rho killed, its row left flagged and run again): a job
  // started then takes the hashes from before the write, the write lands, and its end reads that as a change during the
  // run. The write's end calls for the quiet second again (apply), and the job starts after it.
  if (working || timer || pending.size) { waits(working ? 'a write runs' : timer ? 'a write is due' : pending.size + ' changes pending'); return; }
  const n = chooseJob();
  if (!n) { waits('nothing chosen'); dropWorld(); if (!idle) { idle = true; sweep('after the run'); } told(); return; }
  idle = false;
  sweep('before the run');
  if (n.classify) logError('runner: classifying ' + n.scripts.length + ' scripts (' + (prefs.interactive ? 'interactive' : 'auto') + ')', null);
  // THE TWO HASHES, TAKEN AT THE START (the box: "When a run starts, the server remembers the two hashes as they stand, and
  // until that run ends tags every result of it with them").
  const many = !!(n.classify || n.batch);
  const sr = many ? null : Q.script.get(n.script);
  const ur = many ? null : Q.suiteRow.get(n.script, n.suite);
  const j = { script: n.script, suite: n.suite, title: n.title || '', scriptHash: (sr && sr.hash) || (many ? '' : hashOf(n.script)),
    suiteHash: (ur && ur.hash) || hashOf(n.suite), started: Date.now(), kid: null, timer: null, killed: false,
    classify: !!n.classify, batch: !!n.batch, scripts: n.scripts || [], hashes: n.hashes || null, done: 0, seen: Object.create(null),
    reported: Object.create(null) };
  // A classifying run and a general test's run are given their scripts; any other run its script, when it is a general
  // test, and the title asked.
  const args = [n.suite].concat(many ? j.scripts : []);
  if (!many && n.suite !== ownTestOf(n.script)) args.push(n.script);
  if (j.title) args.push('--test', j.title);
  if (j.batch) j.scripts.forEach(function (s) { killed.delete(s + '|' + j.suite); });
  else if (!j.classify) killed.delete(j.script + '|' + j.suite);
  job = j;
  told();
  let done = false;
  const end = function () {
    if (done) return;
    done = true;
    j.endedAt = Date.now();
    clearTimeout(j.timer);
    if (job === j) job = null;
    // Its temp folder judged once the run has ended (judgeStray), before the run is judged whole.
    judgeStray(j);
    judgeLeftovers(j);
    try { jobEnded(j); } catch (e) { logError('jobEnded ' + j.script + ' ' + j.suite, e); }
    // The next job at once, before busy is told: busy goes false only when nothing is left to run, never between two jobs
    // (the box: "whenever it goes back to listening for events it sets busy false").
    try { nextJob(); } catch (e) { logError('nextJob', e); }
    told();
  };
  // EVERY SUITE RUN HANDED ONE NODE AND ONE CHROME (goal/G47.1, Q10: testicle's UI tests "share one node and one Chrome that
  // testicle hands them"): named to the run in SPIRIT_MOUNT_BASE, SPIRIT_MOUNT_RUN and SPIRIT_CHROME_PORT; a test that asks
  // for it (headLessChrome's scratchNode({ shared: true }), and every chromePage) takes them in place of booting its own. The
  // classifier keeps its own. A job stopped or killed before its run has started ends there.
  const launch = function (extra) {
    if (done) return;
    if (j.killed || j.stopped) { end(); return; }
    // What the run folder holds before the run (judgeLitter).
    if (!j.classify) j.runNames = runNames();
    j.mark = String(process.pid) + '-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    j.launchedAt = Date.now();
    j.kid = spawn(process.execPath, args, { cwd: RUN, env: Object.assign({}, process.env, extra || {}, { [RUN_MARK]: j.mark }), stdio: ['ignore', 'ignore', 'ignore', 'ipc'], windowsHide: true });
    j.kid.on('error', end);
    j.kid.on('exit', function (code) { j.exitCode = code; end(); });
  };
  if (j.classify) launch(null);
  else handWorld().then(function (w) { launch(w.env); }, function () { launch(null); });
  j.timer = setTimeout(function () { j.timedOut = true; killJob(j); }, JOB_LIMIT_MS);
}
// THE NODE AND THE CHROME TESTICLE HANDS ITS RUNS: booted at the first suite run, the two side by side, and let go when the
// runner has nothing left to choose, so a lab node is held only while testicle works.
let world = null;
let worldBoot = null;
// The node and the Chrome are a test tool's, so they come as a process of it, never required (the box: "no production module
// loads or requires any test file"): spirit/test/headLessChrome.js --world, which prints where they are and holds them until
// its input closes.
const WORLD_TOOL = 'spirit/test/headLessChrome.js';
function handWorld() {
  if (world) return Promise.resolve(world);
  if (!worldBoot) {
    worldBoot = new Promise(function (resolve) {
      const kid = spawn(process.execPath, [WORLD_TOOL, '--world'], { cwd: RUN, stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
      let out = '';
      let said = false;
      const say = function (env) { if (said) return; said = true; world = { kid: kid, env: env }; resolve(world); };
      kid.stdout.on('data', function (d) {
        out += d;
        const m = /@@WORLD (.*)\r?\n/.exec(out);
        if (!m) return;
        let w = null; try { w = JSON.parse(m[1]); } catch (e) { w = null; }
        const env = {};
        if (w && w.base) { env.SPIRIT_MOUNT_BASE = w.base; env.SPIRIT_MOUNT_RUN = w.run; }
        if (w && w.chromePort) env.SPIRIT_CHROME_PORT = w.chromePort;
        say(env);
      });
      kid.on('error', function (e) { logError('runner: no node and Chrome to hand out', e); say({}); });
      kid.on('exit', function () { if (world && world.kid === kid) { world = null; worldBoot = null; } say({}); });
    });
  }
  return worldBoot;
}
function dropWorld() {
  if (!world) return;
  const w = world;
  world = null;
  worldBoot = null;
  // Its input closed, it lets its node and its Chrome go and ends.
  try { if (w.kid) w.kid.stdin.end(); } catch (e) { logError('runner: ending its node and Chrome', e); }
}
// PAST THE LIMIT (the box: "A job that runs past 2 minutes is killed, and every test of that suite and script the server
// knows is failed, tagged with the run's two hashes, so it is not queued again until the script or the suite changes").
// A RESULT OF A KILLED RUN THAT COMES LATE (wsl's red, rho: its first result reached the server only after the kill) is a
// test of that run too, and failed with it: killed keeps the run's hashes per suite and script until a run of it starts
// again or a change moves them.
const killed = new Map();   // script|suite -> { scriptHash, suiteHash }
// A KILL THROWS OUT NOTHING REPORTED (goal/G47.1, box v154; Andy: "i don't understand why any kill of a run, regardless of
// cause, would throw out any results duly reported?", "A suite that succeeds against a script and it's hash, MUST remain as
// success in the suite table. otherwise the run exceeding 120 minutes will NEVER pass", "I'd agree to failing the suite
// currently running"). Once a run was one suite on one script, and its kill failed every test it knew of; a general test's
// run of many scripts then failed every one of them, those already through included. Now: a script whose success came in
// this run is left as it reported; the script the run was on is failed, in the tests that gave no answer in this run, and
// its suite row (jobEnded); a script not yet started is not judged, it stays flagged and a new run is built for it at once.
// The script the run is on: the last one a result came from, unless its success is in; else the first not through, in the
// order the run was handed them.
function scriptAt(j) {
  if (!j.batch) return j.reported[j.script] ? '' : j.script;
  if (j.last && j.last.script && !j.reported[j.last.script]) return j.last.script;
  for (const s of j.scripts) if (!j.reported[s]) return s;
  return '';
}
function killJob(j) {
  if (job !== j) { logError('killJob: the job had already ended', null); return; }
  j.killed = true;
  // A classifying run killed: its end fails every script it had not classified (jobEnded).
  if (j.classify) { if (j.kid) killTree(j, 'killJob'); return; }
  const at = scriptAt(j);
  j.killedAt = at;
  // A script removed while the run went takes no failure either (as testicle.set refuses it, wsl's red 3f6832e6).
  if (at && there(at)) {
    const scriptHash = j.batch ? j.hashes[at] : j.scriptHash;
    killed.set(at + '|' + j.suite, { scriptHash: scriptHash, suiteHash: j.suiteHash });
    try {
      T.ofSuite.all(at, j.suite).filter(function (r) { return !(Number(r.tested) >= j.started); })
        .forEach(function (r) { setResult(at, j.suite, r.test, false, Number(r.severity) || 0, scriptHash, j.suiteHash); });
    } catch (e) { logError('killJob: failing ' + at + ' ' + j.suite, e); }
  }
  logError('runner: killed ' + j.suite + (j.batch ? ' (' + j.scripts.length + ' scripts) at ' + (at || 'no script') : ' for ' + j.script) + ' past ' + JOB_LIMIT_MS + ' ms', null);
  // The scripts not yet through, built into a new run from the flags (batchOf), behind what is queued.
  if (j.batch) front.push({ resume: true, script: '', suite: j.suite, title: '' });
  if (j.kid) killTree(j, 'killJob');
}
// WHAT GOES WRONG, SAID ON STDERR AND KEPT NOWHERE (goal/G47.1, Q16; Andy, of testicle.err among the unread logs: "ALL
// OF THEM. KILL THEM. NOBODY READ THAT SHIT, THEY SHOULD NOT EXIST."): every error the runner meets is said on its
// stderr, and an error nothing caught is said there before the process ends.
function logError(where, e) {
  const line = new Date().toISOString() + ' ' + where + (e ? ': ' + ((e && e.stack) || e) : '') + '\n';
  console.error('testicle: ' + line.trim());
}
process.on('uncaughtException', function (e) { logError('uncaught', e); process.exit(1); });
// A JOB ENDED: a whole run (no title asked) that left its suite row flagged is judged now, so the flag never queues the
// same run twice: green or still red by its rows when they are full, still red when it was killed or its report fell
// short ("a suite that hangs before any test reported fails too, with no test rows needed"). A row flagged again during
// the run (a change after it started) stays flagged and comes round again ("the running job is not killed, the suite comes
// round again behind it").
// A TITLE AS ITS SUITE WRITES IT (goal/G47.4, testicle.title): a quoted string, '...' or "...", its backslashes and its own
// quote escaped. Found exactly once among both, or the rename is refused.
function literalsOf(title) {
  const t = String(title).replace(/\\/g, '\\\\');
  return ["'" + t.replace(/'/g, "\\'") + "'", '"' + t.replace(/"/g, '\\"') + '"'];
}
function countOf(text, piece) { let n = 0; let i = text.indexOf(piece); while (i !== -1) { n += 1; i = text.indexOf(piece, i + piece.length); } return n; }
const REPO_ROOT = path.resolve(RUN, '..', '..');
function git(args) {
  return new Promise(function (resolve, reject) {
    execFile('git', args, { cwd: REPO_ROOT, windowsHide: true, maxBuffer: 1 << 24 }, function (e, out, err) { if (e) reject(new Error(String(err || e.message).trim())); else resolve(String(out)); });
  });
}
// The rename itself: the suite's literal, then its spec's mentions, committed by path and pushed; then every row of that
// suite and title, of every script, takes the new title, each told (the old key deleted, the new added).
function renameTitle(script, suite, old, title) {
  const suiteFile = path.join(RUN, suite);
  const specFile = suiteFile.replace(/\.js$/, '.md');
  const rel = function (f) { return posix(path.relative(REPO_ROOT, f)); };
  const text = fs.readFileSync(suiteFile, 'utf8');
  const olds = literalsOf(old);
  const found = olds.map(function (l) { return countOf(text, l); });
  if (found[0] + found[1] !== 1) throw refused('not-found-once');
  if (literalsOf(title).some(function (l) { return text.indexOf(l) !== -1; })) throw refused('duplicate-title');
  const form = found[0] === 1 ? 0 : 1;
  const spec = fs.existsSync(specFile) ? fs.readFileSync(specFile, 'utf8') : null;
  const files = [rel(suiteFile)].concat(spec !== null ? [rel(specFile)] : []);
  let committed = '';
  const putBack = function () {
    fs.writeFileSync(suiteFile, text);
    if (spec !== null) fs.writeFileSync(specFile, spec);
  };
  return git(['status', '--porcelain', '--'].concat(files)).then(function (dirty) {
    if (dirty.trim()) throw refused('suite-has-edits');
    fs.writeFileSync(suiteFile, text.replace(olds[form], literalsOf(title)[form]));
    if (spec !== null && spec.indexOf(old) !== -1) fs.writeFileSync(specFile, spec.split(old).join(title));
    return git(['add', '--'].concat(files))
      .then(function () { return git(['commit', '-q', '-m', 'testicle.title, ' + suite + ': "' + old + '" is now "' + title + '"', '--'].concat(files)); })
      .then(function () { return git(['rev-parse', 'HEAD']); })
      .then(function (sha) { committed = sha.trim(); return git(['rev-parse', '--abbrev-ref', 'HEAD']); })
      .then(function (b) {
        const target = b.trim() === 'HEAD' ? 'master' : b.trim();
        // Origin moved meanwhile: taken first, then pushed again; anything that still fails puts it all back.
        return git(['push', '-q', 'origin', 'HEAD:refs/heads/' + target]).catch(function () {
          return git(['fetch', '-q', 'origin']).then(function () { return git(['rebase', '-q', 'origin/' + target]); })
            .then(function () { return git(['rev-parse', 'HEAD']); })
            .then(function (sha) { committed = sha.trim(); return git(['push', '-q', 'origin', 'HEAD:refs/heads/' + target]); });
        });
      })
      .catch(function (e) {
        logError('testicle.title: push failed, put back', e);
        return git(['rebase', '--abort']).catch(function () {})
          .then(function () { return committed ? git(['rev-parse', 'HEAD']) : ''; })
          .then(function (head) { return committed && head.trim() === committed ? git(['reset', '-q', '--soft', 'HEAD~1']) : null; })
          .then(function () { return git(['reset', '-q', '--'].concat(files)).catch(function () {}); })
          .then(function () { putBack(); throw refused('push-failed'); });
      });
  }).then(function () {
    const rows = T.ofTitle.all(suite, old);
    db.exec('BEGIN');
    try { T.retitle.run(title, suite, old); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
    rows.forEach(function (r) {
      tell('testicle', testServed(r), 'deleted');
      tell('testicle', testServed(T.row.get(Number(r.id))), 'added');
    });
    return { renamed: rows.length };
  });
}
// THE TITLES A COMPLETED RUN DID NOT REPORT (goal/G47.4, the box: "the testicle should know all tests titles that were
// actually run for this script/suite combination, and therefore kill all testicle rows that were NOT run", "no point keeping
// history for something that unstable"): every title of the script and suite not tested since the run started goes, every
// row of it, its history too, each told deleted.
function eraseUnreported(script, suite, started) {
  T.titlesOf.all(script, suite).filter(function (t) { return Number(t.last) < started; }).forEach(function (t) {
    const rows = T.rowsOf.all(script, suite, t.test);
    T.erase.run(script, suite, t.test);
    rows.forEach(function (r) { tell('testicle', testServed(r), 'deleted'); });
  });
}
function jobEnded(j) {
  // STOPPED FOR A TOP RED'S FIX (box v128): its results untouched, its rows left flagged, so it comes round again.
  if (j.stopped) return;
  if (j.classify) return classifyEnded(j);
  // A general test's run of several scripts: each script's row judged as its own run's would be. Killed, only the script
  // it was on is judged (killJob): the ones through are judged already, the ones not started stay flagged for the new run.
  if (j.batch) {
    j.scripts.filter(function (s) { return !j.killed || s === j.killedAt; }).forEach(function (s) {
      try { jobEnded({ script: s, suite: j.suite, title: '', scriptHash: j.hashes[s], suiteHash: j.suiteHash, killed: j.killed, timedOut: j.timedOut, started: j.started }); }
      catch (e) { logError('jobEnded ' + s + ' ' + j.suite, e); }
    });
    return;
  }
  if (j.title) return;
  const row = Q.suiteRow.get(j.script, j.suite);
  const sr = Q.script.get(j.script);
  // Changed during the run: the script's or the suite's hash is no longer the one the run started with.
  if (!row || row.deleted || !sr || row.hash !== j.suiteHash || sr.hash !== j.scriptHash) {
    if (j.killed) logError('jobEnded: killed ' + j.script + ' ' + j.suite + ' left flagged: ' + (!row ? 'no suite row' : row.deleted ? 'deleted' : !sr ? 'no script row' : 'hashes moved'), null);
    return;
  }
  // A test a whole run no longer reports is erased when its verdict comes (eraseUnreported, in suite.success), not here.
  // ITS SUCCESS CAME (testicle.suite.success, box v129-131): the row is set and its flag cleared. Still flagged, the run gave
  // none (killed, crashed, or its report fell short): still red. Never summed from its test rows (box v131: "a suite's result
  // is NEVER assembled from testicle rows, anywhere").
  if (!row.test) return;
  judgeSuite.run('red', Date.now(), j.script, j.suite);
  // No verdict reached: past the job limit it hung, else it ended before it said (goal/G47.6, box point 1).
  setReason.run(j.timedOut ? 'hung' : 'crashed', j.script, j.suite);
  tell('suite', suiteServed(Q.suiteRow.get(j.script, j.suite)), 'updated');
}
// A CLASSIFYING RUN ENDED (box v94, 1: "the classify failing: not classifyable"): every script of it whose bytes are still
// the ones it started with is classified now. One it reported nothing for (the run crashed, hung, or found no Chrome) is
// failed "classifyable" here, tagged with the run's hashes; then its reClassify is cleared, so it waits for its next change.
// A script changed during the run keeps reClassify, and the next run takes it.
// THE CLASSIFIER'S ROW IN THE SCRIPT TAB (Andy: "I LIKE SEING THAT TEST FUCKING LISTED IN THE SCRIPT TAG AND SEEING IT
// GREEN"): made, brought back, or given the classifier's bytes as they are, when a result of it comes; judged from that
// result's testicle.suite.success (or red when the run gave none), so it shows green or still red. The runner never runs it as a suite (chooseJob); a press of it asks
// a class for that script (run).
function classifierRow(script, suiteHash) {
  const was = Q.suiteRow.get(script, CLASSIFY);
  if (was && !was.deleted && was.hash === suiteHash) return;
  Q.putSuite.run(script, CLASSIFY, suiteHash, Date.now());
  tell('suite', suiteServed(Q.suiteRow.get(script, CLASSIFY)), was && !was.deleted ? 'updated' : 'added');
}
function classifyEnded(j) {
  const now = Date.now();
  const toolDown = j.exitCode === TOOL_DOWN;
  if (toolDown) { classifyAfter = now + CLASSIFY_RETRY_MS; setTimeout(function () { try { nextJob(); } catch (e) { logError('nextJob', e); } }, CLASSIFY_RETRY_MS + 100); }
  j.scripts.forEach(function (name) {
    const sr = Q.script.get(name);
    if (!sr || sr.deleted || sr.hash !== j.hashes[name]) return;
    const row = T.current.get(name, CLASSIFY, CLASSIFYABLE);
    const unjudged = !row || Number(row.tested) < j.started || row.judged !== j.hashes[name];
    // Its tool never reached it: no result, and it keeps reClassify.
    if (unjudged && toolDown) return;
    if (unjudged) {
      classifierRow(name, j.suiteHash);
      setResult(name, CLASSIFY, CLASSIFYABLE, false, CLASSIFY_SEVERITY, j.hashes[name], j.suiteHash);
      judgeSuite.run('red', now, name, CLASSIFY);
      tell('suite', suiteServed(Q.suiteRow.get(name, CLASSIFY)), 'updated');
    }
    if (classified.run(now, name, j.hashes[name]).changes) tell('script', served(Q.script.get(name)), 'updated');
  });
}
// THE RUN FOLDER HOLDS SPIRIT AND NOTHING ELSE (goal/G47.1, the box, no pollution: "The run folder holds spirit and nothing
// else. Guard: after each suite, testicle finds nothing new in the run folder; red on the suite that made it"; Andy:
// "name-space pollution is 0.7"). Its names are taken when a run starts; each time the run says a script is through
// (suite.success), what is new there since is that script's and that suite's: its test LITTER red, else green. The names
// are taken again then, so the next script of a general run is not blamed for the same folder.
const LITTER = 'it leaves nothing new in the run folder';
const LITTER_SEVERITY = 0.7;
function runNames() { try { return fs.readdirSync(RUN).sort(); } catch (e) { return []; } }
function judgeLitter(j, script, scriptHash) {
  if (!j || j.classify || !j.runNames) return;
  const now = runNames();
  const fresh = now.filter(function (n) { return j.runNames.indexOf(n) === -1; });
  j.runNames = now;
  try { setResult(script, j.suite, LITTER, !fresh.length, LITTER_SEVERITY, scriptHash, j.suiteHash); }
  catch (e) { logError('judgeLitter ' + script + ' ' + j.suite, e); }
}
// A TEST'S TEMP FOLDER IS GONE AFTER IT (goal/G47.1, the box, no pollution: "A temp folder is cleaned by its owner: ... a
// test's in its own after. Guard: after each suite, testicle finds its temp folder gone; red if not"; Q31, Andy: the tests
// take their temp folders from spirit/tempFolder.js). A suite's folder is the helper's for its route, the suite's path
// without .js, on this node. When a run of one script's suite has ended, after hooks and all, that folder still there is
// red for that script and suite: STRAY. A general suite's run over many scripts is not judged: its one folder is the
// suite's, and blaming each script it judged for it would be wrong.
const STRAY = 'it leaves no temp folder behind';
const STRAY_SEVERITY = 0.7;
function judgeStray(j) {
  if (!j || j.classify || j.batch || j.stopped || !j.script || !/\.js$/.test(j.suite)) return;
  let left = false;
  try { left = fs.existsSync(spirit.require('spirit/tempFolder.js').path(j.suite.replace(/\.js$/, ''))); }
  catch (e) { logError('judgeStray ' + j.script + ' ' + j.suite, e); return; }
  try { setResult(j.script, j.suite, STRAY, !left, STRAY_SEVERITY, j.scriptHash, j.suiteHash); }
  catch (e) { logError('judgeStray ' + j.script + ' ' + j.suite, e); }
}
// A SUITE LEAVES NO PROCESS BEHIND (goal/G47.6; Andy: "what about having reds for proccesses that are def dangling by aborted
// suites????"; cw: "once a suite run has ended, killed or not, testicle looks for processes that run started that are still
// alive a few seconds later; if there are any, the suite is red on a test like 'it leaves no process behind', and they are
// ended", "The kill itself takes the whole tree"). A run's processes: on Linux every process whose environment carries the
// run's mark (RUN_MARK, set at its start and inherited by what it starts, a detached one too); elsewhere every process
// descending from the suite's own by parent id, which an orphan keeps on Windows. A general suite's run over many scripts is
// judged by no script, as STRAY is not; a run stopped for another is ended whole and not judged.
const RUN_MARK = 'SPIRIT_TESTICLE_RUN';
const LEFTOVER = 'it leaves no process behind';
const LEFTOVER_SEVERITY = 0.7;
const LEFTOVER_WAIT_MS = 3000;
function processesOf(j) {
  return new Promise(function (resolve) {
    if (!j || !j.kid || !j.kid.pid) return resolve([]);
    if (process.platform === 'linux') {
      const want = RUN_MARK + '=' + j.mark;
      let out = [];
      try {
        out = fs.readdirSync('/proc').filter(function (d) { return /^\d+$/.test(d) && Number(d) !== process.pid; }).filter(function (d) {
          try { return fs.readFileSync('/proc/' + d + '/environ', 'utf8').split('\0').indexOf(want) !== -1; } catch (e) { return false; }
        }).map(Number);
      } catch (e) { out = []; }
      return resolve(out);
    }
    // A PROCESS ID COMES BACK ON WINDOWS (andy's node: nodeStore's suite, which starts nothing, was red on LEFTOVER): once the
    // suite has ended, a new process may get its id, and that one's children read as the suite's. So each process comes with
    // the time it was made, and only one made while the suite ran (from its start to its end) counts as its child; what
    // descends from such a child counts if made after the suite started. Elsewhere ps gives no such time here, and the mark
    // decides on Linux.
    const list = process.platform === 'win32'
      ? ['powershell', ['-NoProfile', '-NonInteractive', '-Command', 'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId) $($_.ParentProcessId) $(([DateTimeOffset]$_.CreationDate).ToUnixTimeMilliseconds())" }']]
      : ['ps', ['-A', '-o', 'pid=,ppid=']];
    execFile(list[0], list[1], { windowsHide: true, timeout: 30000, maxBuffer: 1 << 24 }, function (err, stdout) {
      if (err) return resolve([]);
      const kids = Object.create(null);
      const made = Object.create(null);
      String(stdout || '').split(/\r?\n/).forEach(function (l) {
        const m = /^\s*(\d+)\s+(\d+)(?:\s+(\d+))?\s*$/.exec(l);
        if (!m) return;
        (kids[m[2]] = kids[m[2]] || []).push(Number(m[1]));
        if (m[3]) made[m[1]] = Number(m[3]);
      });
      const from = (Number(j.launchedAt) || 0) - 1000;
      const until = (Number(j.endedAt) || Date.now()) + 1000;
      const fits = function (c, direct) { const t = made[c]; if (t === undefined) return process.platform !== 'win32'; return t >= from && (!direct || t <= until); };
      const out = [];
      (function down(pid, direct) { (kids[pid] || []).forEach(function (c) { if (out.indexOf(c) === -1 && c !== process.pid && fits(String(c), direct)) { out.push(c); down(String(c), false); } }); }(String(j.kid.pid), true));
      resolve(out);
    });
  });
}
function endPids(pids) { pids.forEach(function (p) { try { process.kill(p, 'SIGKILL'); } catch (e) { /* gone */ } }); }
// A STOP OR A KILL TAKES THE TREE: what the run started is found while the suite still runs, then all of it ended.
// ASKED FIRST, KILLED ONLY AFTER (goal/G48.4; Andy: "WHY THE FUCK ARE TEST RUNS STILL LITTERING SHIT ALL OVER THE PLACE!!!???",
// then "step 1 for now. and we continue."): the run is sent a stop message on its channel, so its test.after cleanups run and
// it ends by itself (testReport.js); what is still alive STOP_GRACE_MS later, or once it ended, is killed. A message, never a
// signal: on Windows a process cannot catch one, and it would die with its cleanups unrun.
const STOP_GRACE_MS = 5000;
function killTree(j, who) {
  processesOf(j).then(function (pids) { askThenEnd(j, pids, who); }, function () { askThenEnd(j, [], who); });
}
function askThenEnd(j, pids, who) {
  const kid = j.kid;
  const over = function () { return kid.exitCode !== null || kid.signalCode !== null; };
  let done = false;
  const finish = function () {
    if (done) return;
    done = true;
    endPids(pids.filter(alive));
    if (!over()) { try { kid.kill('SIGKILL'); } catch (e) { logError(who + ': the kill', e); } }
  };
  if (over()) { finish(); return; }
  kid.once('exit', function () { setTimeout(finish, 500); });
  try { if (kid.connected) kid.send({ stop: true }); } catch (e) { logError(who + ': the stop message', e); }
  setTimeout(finish, STOP_GRACE_MS);
}
function judgeLeftovers(j) {
  if (!j || j.classify || j.batch || j.stopped || !j.script || !/\.js$/.test(j.suite) || !j.kid) return;
  setTimeout(function () {
    processesOf(j).then(function (pids) {
      if (pids.length) { logError('runner: ' + j.suite + ' for ' + j.script + ' left ' + pids.length + ' process(es) running: ' + pids.join(' '), null); endPids(pids); }
      // Its script or suite gone in the wait: no result is made current under a deleted row (goal/G47.1, the reconciliation:
      // "results current only under a live suite row"; wsl's red found this one written after cR.js was deleted).
      const row = Q.suiteRow.get(j.script, j.suite);
      if (!row || row.deleted) return;
      try { setResult(j.script, j.suite, LEFTOVER, !pids.length, LEFTOVER_SEVERITY, j.scriptHash, j.suiteHash); }
      catch (e) { logError('judgeLeftovers ' + j.script + ' ' + j.suite, e); }
    });
  }, LEFTOVER_WAIT_MS);
}
// ONE TEST'S RESULT WRITTEN (testicle.set's, and a killed job's failures): no flip, the current row tested again; a flip, the
// current row retired and a new one made (goal/G47.1, the test-table cycle), each tagged with the two hashes. On a flip the
// replaced row, current false now, is published too, before the new current row ("on a flip, the replaced row turning
// current false is published too, beside the new current row"). Answers the current row as served.
function setResult(script, suite, name, verified, severity, scriptHash, suiteHash) {
  const now = Date.now();
  const was = T.current.get(script, suite, name);
  const same = !!was && !!was.verified === !!verified;
  let id = 0;
  db.exec('BEGIN');
  try {
    if (same) { id = Number(was.id); T.tested.run(now, scriptHash, severity, suiteHash, id); }
    else {
      if (was) T.retire.run(Number(was.id));
      id = Number(T.add.run(script, suite, name, verified ? 1 : 0, now, scriptHash, was ? Math.max(severity, Number(was.severity) || 0) : severity, suiteHash).lastInsertRowid);
    }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  if (was && !same) tell('testicle', testServed(T.row.get(Number(was.id))), 'updated');
  const out = testServed(T.row.get(id));
  tell('testicle', out, same ? 'updated' : 'added');
  return out;
}
// A press of 🏃‍♂️, or an agent's testicle.run: to the head of the queue, never twice.
// A FIX OF A TOP RED RUNS FIRST (goal/G47.1, box v128: "a change to one of the 10 scripts holding the most severe current
// reds (each script counted once, not each test row) stops the running suite and runs that script's red suites first, most
// severe first (the changed script classified again first). the stopped run goes back flagged, its results untouched, never
// marked green. any other change waits its turn; the run continues."; Andy: "if the changed file is not a top 10 fix, the
// run may as well continue...."). The stop is the server's own (it started the run), never an answer the test must wait for.
const TOP_SCRIPTS = 10;
const topScripts = db.prepare('SELECT script, MAX(severity) AS worst FROM testicle WHERE current = 1 AND verified = 0 GROUP BY script ORDER BY worst DESC, script LIMIT ' + TOP_SCRIPTS);
const redSuitesOf = db.prepare('SELECT suite, MAX(severity) AS worst FROM testicle WHERE current = 1 AND verified = 0 AND script = ? GROUP BY suite ORDER BY worst DESC, suite');
function topFix(rel) {
  if (isSuite(rel) || !topScripts.all().some(function (r) { return r.script === rel; })) return;
  // Its red suites at the head of the queue, the most severe first (the classifier, owed first, runs before them all).
  const suites = redSuitesOf.all(rel).map(function (r) { return r.suite; }).filter(function (s) { return s !== CLASSIFY; });
  for (let k = suites.length - 1; k >= 0; k--) {
    for (let i = front.length - 1; i >= 0; i--) if (front[i].script === rel && front[i].suite === suites[k]) front.splice(i, 1);
    front.unshift({ script: rel, suite: suites[k], title: '' });
  }
  // The running suite stopped, unless it is that script's own run.
  if (job && job.script !== rel) stopJob(job, rel + ' holds a top red and changed');
}
// THE RUNNING JOB STOPPED (box v128, v130): its results untouched, its rows left flagged; its end (jobEnded) judges nothing, and
// the next run is assembled fresh from the flags, without the scripts that already reported their success.
function stopJob(j, why) {
  if (!j || job !== j || j.killed || j.stopped) return;
  j.stopped = true;
  clearTimeout(j.timer);
  logError('runner: stopped ' + (j.classify ? 'classifying' : j.suite + (j.batch ? ' (' + j.scripts.length + ' scripts)' : ' for ' + j.script)) + ': ' + why, null);
  // A run whose process has not started yet (it waits for its node and Chrome) has none to kill: launch sees it stopped.
  if (j.kid) killTree(j, 'stopJob');
  // QUEUED AGAIN, BEHIND WHAT STOPPED IT (box v130), in interactive as in auto: a batch to be assembled fresh from its flags, a
  // single run as it was; a classifying run needs none, its scripts still owe their class.
  if (j.batch) front.push({ resume: true, script: '', suite: j.suite, title: '' });
  else if (!j.classify) front.push({ script: j.script, suite: j.suite, title: j.title || '' });
}
function press(script, suite, title) {
  for (let i = front.length - 1; i >= 0; i--) if (front[i].script === script && front[i].suite === suite) front.splice(i, 1);
  front.unshift({ script: script, suite: suite, title: title || '' });
  // A PRESS RUNS FIRST, AS A TOP-10 FIX DOES (goal/G47.1, box v130: "a press stops the running suite and runs it first"): the
  // running job stopped, unless it is this very run.
  if (job && !(job.script === script && job.suite === suite)) stopJob(job, 'a press of ' + suite + ' for ' + script);
  if (!job && !quiet) nextJob();
}

// THE PAIRS testModule.js NAMES, run as its own process with no file: "<test> <file>" for a general test and the file it
// judges, "<test>" for a test that is no general one.
function pairs() {
  return new Promise(function (resolve, reject) {
    execFile(process.execPath, [TEST_MODULE], { cwd: RUN, encoding: 'utf8', maxBuffer: 1 << 26 }, function (err, out) {
      if (err) return reject(err);
      const byFile = Object.create(null);
      const bySuite = Object.create(null);
      const tests = Object.create(null);
      String(out).split('\n').filter(Boolean).forEach(function (l) {
        const p = l.split(' ');
        // In debug mode only the pairs inside its scope: its general tests testicle's own three and the planted worlds'.
        if (!inScope(p[0]) || (p[1] && !inScope(p[1]))) return;
        tests[p[0]] = true;
        if (!p[1]) return;
        (byFile[p[1]] = byFile[p[1]] || []).push(p[0]);
        (bySuite[p[0]] = bySuite[p[0]] || []).push(p[1]);
      });
      resolve({ byFile: byFile, bySuite: bySuite, tests: tests });
    });
  });
}

// ONE MOMENT'S CHANGES, WRITTEN TOGETHER.
function apply(changed, P) {
  const now = Date.now();
  const hashes = Object.create(null);
  const hash = function (rel) { if (!(rel in hashes)) hashes[rel] = hashOf(rel); return hashes[rel]; };
  // A file's row made or brought up to date, as it stands on disc.
  // What it wrote, published once the transaction stands (goal/G47.1, the UI cycle: "the server, of course, publishes
  // changes"): every file row and every suite row it touched, as they then stand.
  const files = new Set();
  const written = new Map();
  // The test rows this write retires, streamed once it stands.
  const retired = [];
  // A write that owes a class (the classifier changed) wakes the runner too, with no suite row written.
  let wake = false;
  // Whether each row was there before this write, so its publish says added or updated (deleted, by its own flag).
  const had = Object.create(null);
  const before = function (k, get) { if (!(k in had)) had[k] = !!get(); };
  const touched = function (file, suite) { before('suite|' + file + '|' + suite, function () { return Q.suiteRow.get(file, suite); }); written.set(file + '|' + suite, [file, suite]); };
  const fileUp = function (file) { before('script|' + file, function () { return Q.script.get(file); }); Q.putScript.run(file, hash(file), now); files.add(file); };
  // A row its script's class rules out is never made (box v94, 2; pruneUnfit).
  const suiteUp = function (file, suite) { if (!fits(file, suite)) return; touched(file, suite); Q.putSuite.run(file, suite, hash(suite), now); };
  // A SUITE'S OWN EVENT flags a row only when it is new, was deleted, or the suite's bytes changed: an event with the same
  // bytes (one a run's own reading can cause) never flags it again (wsl's verify: rho's row "flagged again DURING its run,
  // rho.js not touched then", so a killed suite was owed another run, forever). A script's change flags its suites always.
  const suiteChanged = function (file, suite) { const was = Q.suiteRow.get(file, suite); return !was || !!was.deleted || was.hash !== hash(suite); };
  // A SCRIPT'S ROW AND EVERY SUITE ROW IT IS OWED: its own test and each general test that judges it, then its classifier row.
  const scriptUp = function (rel) {
    fileUp(rel);
    const suites = (P.byFile[rel] || []).slice();
    const own = ownTestOf(rel);
    if (there(own) && suites.indexOf(own) === -1) suites.push(own);
    suites.forEach(function (suite) { suiteUp(rel, suite); });
    // ITS CLASSIFIER ROW, AT ONCE (box v94, 1: "a \"special\" general test under its own name, with its suite row"; the
    // box: the rows stand one second after a change): made with the script's own rows, not when the class comes back
    // (classifierRow then only judges it). Never run as a suite (chooseJob).
    if (there(CLASSIFY)) { touched(rel, CLASSIFY); Q.putSuite.run(rel, CLASSIFY, hash(CLASSIFY), now); }
  };
  // A FILE ADDED TO THE TREE OR TAKEN FROM IT (goal/G47.1; Andy, of a general test's red that stood after its cause was
  // fixed in three other files: "AND? WHAT THE FUCK ARE YOU DOING NOTHING FOR???"): a general test judges the whole tree
  // too ("every production script has its own test"), and files that answer under each script it is handed. So when the
  // tree's files change, every general test's red row runs again; a changed file's contents run its own rows as before.
  let shaped = false;
  db.exec('BEGIN');
  try {
    changed.forEach(function (rel) {
      // A file that is no script, added or taken away (the watcher passes no other event of it): only the tree changed.
      if (!/\.js$/.test(rel)) { shaped = true; return; }
      if (isSuite(rel)) {
        if (!there(rel) || !Q.rowsOfSuite.all(rel).length) shaped = true;
        if (!there(rel)) {
          Q.rowsOfSuite.all(rel).forEach(function (r) { touched(r.script, r.suite); });
          Q.goneRowsOfSuite.run(now, rel);
          // A row of the script table under a suite's name (a test file once judged as a script), gone with it.
          const asScript = Q.script.get(rel);
          if (asScript && !asScript.deleted) { before('script|' + rel, function () { return asScript; }); Q.goneScript.run(rel, now); files.add(rel); }
          return;
        }
        // THE CLASSIFIER CHANGED (goal/G47.1; Andy: "THIS FUCKING HAPPENS ANDY-FUCKING-TIME a script or the Classifier
        // changes."): every script whose classifyable row was judged by other bytes of it (the suiteHash it carries), or
        // whose classifier row in the script tab holds other bytes, is classified again, its row there flagged with the
        // bytes as they are now; so a class or a red from an older classifier never stands. Unchanged, nothing moves, at
        // start too. That row is shown (Andy: "I LIKE SEING THAT TEST FUCKING LISTED IN THE SCRIPT TAG AND SEEING IT
        // GREEN"), never run as a suite (chooseJob, run).
        if (rel === CLASSIFY) {
          const stale = new Set(classifiedBy.all(rel, hash(rel)).map(function (r) { return r.script; }));
          Q.rowsOfSuite.all(rel).forEach(function (r) { if (!r.deleted && r.hash !== hash(rel)) stale.add(r.script); });
          stale.forEach(function (name) {
            if (!Q.script.get(name)) return;
            touched(name, rel);
            Q.putSuite.run(name, rel, hash(rel), now);
            before('script|' + name, function () { return Q.script.get(name); });
            if (reclassify.run(now, name).changes) files.add(name);
          });
          if (stale.size) wake = true;
          return;
        }
        // The files it concerns: the one it is the own test of, and every file a general test judges. (Named apart from
        // the write's own files: one name for both made every use of files above this line in the block throw, and the
        // whole write roll back, at every start with a changed classifier or a removed test.)
        const concerned = (P.bySuite[rel] || []).slice();
        const own = fileOfOwnTest(rel);
        if (there(own) && concerned.indexOf(own) === -1) concerned.push(own);
        // A SCRIPT WITH NO ROW YET GETS ALL ITS ROWS HERE (goal/G47.1, found by testicle.js's "at once after it is classified"):
        // its own test written before it made its row with that one suite, and the script's own change then found the same
        // bytes and stopped, so it never got its general suites until it changed again.
        concerned.forEach(function (file) { if (!Q.script.get(file)) scriptUp(file); if (suiteChanged(file, rel)) suiteUp(file, rel); });
        return;
      }
      const known = Q.script.get(rel);
      if (!there(rel) || !known || known.deleted) shaped = true;
      if (!there(rel)) { before('script|' + rel, function () { return Q.script.get(rel); }); Q.goneScript.run(rel, now); files.add(rel); Q.suitesOfScript.all(rel).forEach(function (r) { touched(r.script, r.suite); }); Q.goneSuitesOfScript.run(now, rel); return; }
      const row = Q.script.get(rel);
      if (row && !row.deleted && row.hash === hash(rel)) return; // the same bytes: nothing changed
      scriptUp(rel);
      // WHAT DEPENDS ON IT RUNS AGAIN (goal/G47.6, box point 3: "a changed file re-runs the own suites of every script that
      // depends on it, at any depth"; "Who re-runs when a file changes is one lookup, every script whose rows name it, with no
      // walk"): each such script's own suite flagged. "A change to spirit.js, which all 255 depend on, goes to a quiet-hours
      // sweep instead of running everything": it flags none here.
      if (rel !== 'spirit/spirit.js') D.dependents.all(rel).forEach(function (d) { const own = ownTestOf(d.script); if (d.script !== rel && there(d.script) && there(own)) suiteUp(d.script, own); });
    });
    if (shaped) Q.redRows.all().forEach(function (r) { if (isGeneral(r.suite) && there(r.script) && there(r.suite)) suiteUp(r.script, r.suite); });
    if (shaped) dropStale();
    // A SUITE THAT NO LONGER EXISTS, WITH ALL ITS TEST RESULTS (goal/G47.1, box v95, 5: "prune suites that no longer exist
    // (mark as deleted, and not show them again), including all their test results"): every current test row of a suite row
    // now deleted is current no more, so no search shows it. IN THE SAME WRITE AS THE DELETE (goal/G48.5): retired after the
    // commit, a node stopped between the two kept a deleted script's reds current, counted and shown, for good.
    written.forEach(function (p) {
      const r = Q.suiteRow.get(p[0], p[1]);
      if (!r || !r.deleted) return;
      T.ofSuite.all(p[0], p[1]).forEach(function (t) { T.retire.run(t.id); retired.push(t.id); });
    });
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  files.forEach(function (file) { const r = Q.script.get(file); if (r) tell('script', served(r), r.deleted ? 'deleted' : had['script|' + file] ? 'updated' : 'added'); });
  written.forEach(function (p) { const r = Q.suiteRow.get(p[0], p[1]); if (r) tell('suite', suiteServed(r), r.deleted ? 'deleted' : had['suite|' + p[0] + '|' + p[1]] ? 'updated' : 'added'); });
  retired.forEach(function (id) { tell('testicle', testServed(T.row.get(id)), 'updated'); });
  // Whatever wrote it, a file change, a script.get or a testicle.set, a flag written wakes the runner (wsl's gap).
  if (written.size || wake) soon();
}

// WHAT IT STREAMS (goal/G47.1, the box: "busy is streamed by the server: whenever it wakes it sets busy true and streams it;
// whenever it goes back to listening for events it sets busy false and streams it", "busy stays the one answer it is today
// ..., streamed each time it changes; the page never asks testicle.busy", and the monitor row's "last change: a row added,
// deleted or updated in any of its three tables"):
//   { testicle: { table, row, change, busy } }   a row written, change 'added', 'updated' or 'deleted', busy as it stands
//   { testicle: { busy } }                       busy turned, true on waking, false back to listening
// Every row carries busy too, so a page that opens late finds it in the last thing the job published.
function busyNow() { return working || !!timer || pending.size > 0 || getting > 0 || !!job; }
// WHAT RUNS, AS THE STATUS BAR SHOWS IT (goal/G47.4, the box, ### status bar: row 1 "<suites owed>: <suite file name>", row 2
// "<tests reported>: <script file name>"; during classification row 1 the classifier's file name and row 2 "<n> of <total>"
// and the script; "the doing text goes: nothing reads it"), carried on every message beside busy, as JSON; '' when no run
// is active, so the bar's rows are empty then.
//   { suite, scripts, started, tested, script }       a suite runs: its scripts, the tests it reported, the script it last reported for
//   { classifier, total, classified, script }         the classifier runs: its file, how many it classifies, how many it said, the last
function runningNow() {
  if (!job) return '';
  if (job.classify) return JSON.stringify({ classifier: job.suite, total: job.scripts.length, classified: job.done || 0, script: job.lastClassified || '' });
  return JSON.stringify({ suite: job.suite, scripts: job.batch ? job.scripts.slice() : [job.script], started: job.started, tested: job.tested || 0, script: (job.last && job.last.script) || (job.batch ? job.scripts[0] : job.script) || '' });
}
// WHAT IS OWED (goal/G47.4, the box, ### status bar: "suites owed is the number of suites marked needs running, in the current
// run or not ... a general suite counts once"; wsl's shape, a message of its own, { testicle: { owed: { suites,
// classifications } } }, "sent when either changes"; box v55: "a page that connects to testicle's stream is sent the current
// suites-owed and classifications-owed numbers once"). Sent only when a number moved, never riding the other messages. The
// last one is kept in testicle's job's data too, which the node hands a page in the snapshot it connects with (job.js keeps
// a job's data merged, its app object replaced by the next publish): that is the once on connect.
const owedSuites = db.prepare('SELECT COUNT(DISTINCT suite) AS n FROM suite WHERE test = 1 AND deleted = 0');
const owedClassifications = db.prepare('SELECT COUNT(*) AS n FROM script WHERE reClassify = 1 AND deleted = 0');
// THE NUMBER OF REDS (goal/G48.4, Andy: "what's the cost of streaming the number of reds, and displaying it in a large, RED box
// at the right windows edge of the status bar????", then "NOW! including test."): the current test rows that failed, counted
// by the reds index, sent beside owed, the same way: when it moved, and kept in the job's data for a page that connects.
const redCount = db.prepare('SELECT COUNT(*) AS n FROM testicle WHERE current = 1 AND verified = 0');
// THE TWO LEADERS OF THE REDS (goal/G48.4, Andy: "would knowledge of the largest contributors to the reds help in prioritizing
// a fixing strategy?", "when idle, the status bar could show the most relevant information regarding these priorities", then
// "agreed on the how of streaming the info... then go!"): the test, a title in its suite, red for the most scripts, and the
// script with the most reds, each with its count; counted from the current reds when their number moves, sent beside it.
const topTest = db.prepare('SELECT suite, test, COUNT(*) AS n FROM testicle WHERE current = 1 AND verified = 0 GROUP BY suite, test ORDER BY n DESC, MAX(severity) DESC LIMIT 1');
const topScript = db.prepare('SELECT script, COUNT(*) AS n FROM testicle WHERE current = 1 AND verified = 0 GROUP BY script ORDER BY n DESC, MAX(severity) DESC LIMIT 1');
function leadersNow() {
  const t = topTest.get();
  const s = topScript.get();
  return { test: t ? { suite: t.suite, test: t.test, n: Number(t.n) } : null, script: s ? { script: s.script, n: Number(s.n) } : null };
}
let owedTold = '';
let leadersAt = -1;
let leaders = { test: null, script: null };
function owedNow() { return { suites: Number(owedSuites.get().n) || 0, classifications: Number(owedClassifications.get().n) || 0 }; }
function toldOwed() {
  let o = null;
  let reds = 0;
  try {
    o = owedNow();
    reds = Number(redCount.get().n) || 0;
    if (reds !== leadersAt) { leaders = leadersNow(); leadersAt = reds; }
  } catch (e) { return; }
  const top = leaders;
  const s = JSON.stringify([o, reds, top]);
  if (s === owedTold) return;
  owedTold = s;
  // The job's data first, then the message: every job event after carries the new numbers, none the old.
  const say = function () { if (owedTold === s) appServer.publish({ testicle: { owed: o, reds: reds, leaders: top } }); };
  Promise.resolve(spirit.job.report({ data: { owed: o, reds: reds, leaders: top } })).then(say, say);
}
let busyTold = false;
let runningTold = '';
function told() {
  const b = busyNow();
  const r = runningNow();
  if (b !== busyTold || r !== runningTold) {
    busyTold = b;
    runningTold = r;
    appServer.publish({ testicle: { busy: b, running: r } });
  }
  toldOwed();
}
function tell(table, row, change) { appServer.publish({ testicle: { table: table, row: row, change: change, busy: busyNow(), running: runningNow() } }); toldOwed(); }

// THE QUEUE: what changed since the last write, and whether a write is under way. busy is either, or a script.get making
// rows.
const pending = new Set();
let working = false;
let timer = null;
let getting = 0;
function kick() {
  if (working || timer || !pending.size) { told(); return; }
  // The changes of one moment taken together: a save is often several events.
  timer = setTimeout(function () {
    timer = null;
    working = true;
    const changed = Array.from(pending);
    pending.clear();
    pairs().then(function (P) { apply(changed, P); }).then(null, function (e) {
      logError('the write of a moment', e);
    }).then(function () { working = false; kick(); if (!working && !timer && !pending.size) soon(); });
  }, 50);
  told();
}

// THE NODE'S ONE TREE, NO WATCHER OF ITS OWN (goal/G49.2; Andy: "go on the five!", "the shared dataset needs to be complete,
// period."): every change of the run folder comes from spirit/fs.js, the node's file tree as this process receives it, and
// is passed on as the watcher passed it: add, change or unlink of a file, a path the server does not ignore.
const tree = spirit.require('spirit/fs.js');
const held = new Set();
function onFile(event, rel) {
  if (!rel || ignored(path.join(RUN, rel))) return;
  // Any other file counts only by being added or taken away: the tree changed, so the general tests' reds run again (apply).
  const script = /.js$/.test(rel);
  if (!script && event === 'change') return;
  pending.add(rel);
  if (script) { try { topFix(rel); } catch (e) { logError('topFix ' + rel, e); } }
  kick();
  // The runner waits for a quiet second after the last change (the box: "a new event pushes the start back").
  soon();
}
let scanned = false;
function whole() {
  if (!tree.ready()) return;
  const files = tree.files();
  Object.keys(files).forEach(function (p) { if (files[p].kind === 'file') held.add(p); });
  if (!scanned) { scanned = true; startScan(); }
}
tree.watch(function (rel, row) {
  // The tree whole (or forgotten and whole again): the start scan once, then every file it holds is known.
  if (!rel) {
    whole();
    return;
  }
  if (!scanned) return;
  if (row && row.kind !== 'file') return;
  if (!row) { if (held.delete(rel)) onFile('unlink', rel); return; }
  const event = held.has(rel) ? 'change' : 'add';
  held.add(rel);
  onFile(event, rel);
});
// THE TABLES NEVER STALE (goal/G47.1, box v95, 5): "the testicle server is non-intrinsic: it is NOT always on", "the server
// MUST do everything it can to reflect the current state of the tree", "the server, when starting up, must prune suites
// that no longer exist ... including all their test results", "must of course, add new suites!", "on start, before even
// classifying, must make sure that script, suite and testicle tables reflect the current state", "all these adjustments
// streamed". At start every script of the tree, every name its script table holds and every suite its suite table holds
// is taken as changed, once, through the same write a change makes: a script or suite new or changed while the server was
// down gets its rows, flagged; one gone is marked deleted, its test rows current no more. Nothing runs before that write
// (nextJob waits for it), so classifying comes after.
function treeScripts() {
  const files = tree.files();
  return Object.keys(files).filter(function (p) { return files[p].kind === 'file' && /.js$/.test(p) && !ignored(path.join(RUN, p)); }).sort();
}
// Every script already classified, swept once: its rows that its class rules out leave the tables (pruneUnfit).
db.prepare('SELECT name FROM script WHERE deleted = 0 AND reClassify = 0 AND (browserOnly = 1 OR nodeOnly = 1)').all().forEach(function (r) { pruneUnfit(r.name); });
// Run once the node's tree has come whole (tree.watch above), so the scan sees every script.
function startScan() {
  // A SCRIPT LEFT NOT CLASSIFYABLE IS TRIED AGAIN AT EVERY START (a fault of the classifier or of the server, since fixed,
  // reaches it so, without the script itself changing; Andy's node kept three such reds after their fix): few, cheap.
  db.prepare('UPDATE script SET reClassify = 1 WHERE deleted = 0 AND name IN (SELECT script FROM testicle WHERE suite = ? AND current = 1 AND verified = 0)').run(CLASSIFY);
  const names = new Set(treeScripts());
  db.prepare('SELECT name FROM script WHERE deleted = 0').all().forEach(function (r) { names.add(r.name); });
  db.prepare('SELECT DISTINCT suite FROM suite WHERE deleted = 0').all().forEach(function (r) { names.add(r.suite); });
  names.forEach(function (n) { pending.add(n); });
  // Dependency rows of files already gone before this start (goal/G47.1, the reconciliation): no change event names them.
  dropStale();
  // TEST ROWS OF A SUITE ROW ALREADY DELETED ARE CURRENT NO MORE (goal/G48.5; box v95, 5): a node stopped between the
  // delete and the retire, before the two shared one write, left a deleted script's reds current; each start retires them.
  db.prepare('UPDATE testicle SET current = 0 WHERE current = 1 AND EXISTS (SELECT 1 FROM suite s WHERE s.script = testicle.script AND s.suite = testicle.suite AND s.deleted = 1)').run();
  kick();
}
whole();
// Rows already flagged at the start: the runner starts 1 second after the server starts.
soon();

// A script row as a verb answers it: its deleted a boolean.
function served(row) {
  return { name: row.name, hash: row.hash, deleted: !!row.deleted, changed: Number(row.changed), reClassify: !!row.reClassify,
    browserOnly: !!row.browserOnly, nodeOnly: !!row.nodeOnly };
}
// A suite row as a search and the stream carry it: its key script|suite, its status "needs running" while it is flagged.
function suiteServed(r) { return { key: r.script + '|' + r.suite, script: r.script, suite: r.suite, test: !!r.test, status: statusOf(r.test, r.outcome), deleted: !!r.deleted, outcome: r.outcome, reason: r.reason || '', changed: Number(r.changed) }; }
// Test rows, already in the order they are answered in, as one search answer: the bucket keeps that order (a row's seat
// falls with its place), cut to what one answer holds, more saying it was cut.
// ONE ANSWER, NEVER IN PARTS (Andy: no paging; goal/G47.1, Q17): the most severe first, as many as one answer holds,
// more saying some were left out; the asker narrows its search to see the rest.
function mostSevereFirst(rows) {
  const bucket = createProbabilityBucket(Infinity);
  rows.forEach(function (row, i) { bucket.seatFor(1 - i / (rows.length + 1), { key: row.key, label: JSON.stringify(row) }); });
  const out = bucket.serialize(null, SEARCH_ROOM);
  return { items: out.items, more: !!out.more };
}
function refused(code) { return Object.assign(new Error(code), { refusal: code }); }

appServer.serve({
  // goal/G47.1, the run cycle, the box: "A new testicle verb, run {script, suite, testicle}"; the queue cycle: "A press of
  // 🏃‍♂️ puts its suite and script at the head of the queue", "an agent uses the same verb the UI uses". Answered at once. The script a production script, the suite a suite, both on disc; testicle, a test's title, optional.
  run: {
    request: { script: '', suite: '' }, reply: {},
    accepts: function (a) {
      if (!a || typeof a !== 'object' || Array.isArray(a) || typeof a.script !== 'string' || typeof a.suite !== 'string') return false;
      return Object.keys(a).every(function (k) { return k === 'script' || k === 'suite' || (k === 'testicle' && typeof a[k] === 'string'); });
    },
    handler: function (a) {
      const script = posix(String(a.script || '')).replace(/^\.?\//, '');
      const suite = posix(String(a.suite || '')).replace(/^\.?\//, '');
      if (!/\.js$/.test(script) || isSuite(script) || script.indexOf('..') !== -1 || ignored(path.join(RUN, script))) throw refused('not-a-production-script');
      if (!/\.js$/.test(suite) || !isSuite(suite) || suite.indexOf('..') !== -1) throw refused('not-a-suite');
      if (!there(script) || !there(suite)) throw refused('no-such-file');
      // THE CLASSIFIER IS NO SUITE TO PRESS (Andy: "scriptClassify NEVER runs as a normal, general TEST."): asked for, the
      // script is owed a class, and the runner classifies it next, as it would after a change.
      if (suite === CLASSIFY) {
        if (reclassify.run(Date.now(), script).changes) tell('script', served(Q.script.get(script)), 'updated');
        soon();
        return { started: true };
      }
      press(script, suite, String(a.testicle || ''));
      return { started: true };
    },
  },
  // goal/G47.1, box v79, 4: "one new verb for now \"preferences\", it will manage getting and setting preferences,
  // multiplexed, right now it will support testicle.preferences.interactive (true by default)". {} answers them all; a name
  // given sets it and answers them all; a name it does not know, or a value of the wrong type, is refused. A set is kept in
  // preferences.json and published, { testicle: { preferences } }, so every page follows it. Set to auto, the flagged rows
  // are run; a run already going finishes either way.
  preferences: {
    request: {}, reply: { interactive: true },
    accepts: function (a) {
      if (!a || typeof a !== 'object' || Array.isArray(a)) return false;
      return Object.keys(a).every(function (k) { return k === 'interactive' && typeof a[k] === 'boolean'; });
    },
    handler: function (a) {
      if (typeof a.interactive === 'boolean' && a.interactive !== prefs.interactive) {
        const next = Object.assign({}, prefs, { interactive: a.interactive });
        // Debug mode, set in the file by its test, stays there; no verb answers it.
        fs.writeFileSync(PREFS_FILE, JSON.stringify(Object.assign(DEBUG ? { debug: true } : {}, next), null, 2) + '\n');
        prefs = next;
        appServer.publish({ testicle: { preferences: Object.assign({}, prefs), busy: busyNow() } });
        if (!prefs.interactive) soon();
      }
      return Object.assign({}, prefs);
    },
  },
  // goal/G47.1, box v94, 1: "spirit/test/scriptClassify.js will use a new verb testicle.script.classify (arguments: script,
  // browserOnly and nodeOnly)", "testicle.script.classify is a new testicle verb, testicle's own interface, not the
  // node's". Sets the script row's two flags; both at once says nothing, and is refused. Its reClassify is cleared, unless
  // the classifying run under way started on other bytes of it: then the next run takes it again. Answers the script row.
  'script.classify': {
    request: { script: '', browserOnly: false, nodeOnly: false }, reply: { name: '', hash: '', deleted: false, changed: 0 },
    // requires may be left out (goal/G47.6, Andy: "both new arguments to the two existing verbs are approved."); it comes
    // as a list in JSON, one string (goal/G48.4, Q6, Andy: lists are "spirit.type.string.json").
    accepts: function (a) {
      if (!a || typeof a !== 'object' || Array.isArray(a) || typeof a.script !== 'string' || typeof a.browserOnly !== 'boolean' || typeof a.nodeOnly !== 'boolean') return false;
      return Object.keys(a).every(function (k) { return k === 'script' || k === 'browserOnly' || k === 'nodeOnly' || (k === 'requires' && typeof a[k] === 'string'); });
    },
    handler: function (a) {
      const name = posix(String(a.script || '')).replace(/^\.?\//, '');
      // Any script with a row of its own, a tool of the test system in a test folder among them (testReport.js and
      // testModule.js have tests of their own, so rows): refused, those stayed not classifyable on Andy's node for ever.
      if (!/\.js$/.test(name) || name.indexOf('..') !== -1 || ignored(path.join(RUN, name))) throw refused('not-a-production-script');
      if (a.browserOnly === true && a.nodeOnly === true) throw refused('bad-request');
      const row = Q.script.get(name);
      if (!row || row.deleted) throw refused('no-such-file');
      const stale = !!(job && job.classify && job.hashes && job.hashes[name] !== undefined && job.hashes[name] !== row.hash);
      setClass.run(a.browserOnly === true ? 1 : 0, a.nodeOnly === true ? 1 : 0, stale ? 1 : 0, Date.now(), name);
      // WHAT ITS LOAD PULLED IN, its rows replaced (goal/G47.6, box point 3); a classifier that sends none leaves them.
      if (typeof a.requires === 'string') { D.drop.run(name); requiresOf(name, a.requires).forEach(function (r) { D.add.run(name, r); }); }
      const now = served(Q.script.get(name));
      tell('script', now, 'updated');
      // Classified: the rows its class rules out leave at once, never shown (Andy: "why do you display -sibling-node suites
      // for elements?").
      pruneUnfit(name);
      return now;
    },
  },
  // goal/G47.1, the box: "busy": true if it is doing any work, false if it is idle.
  busy: {
    request: {}, reply: false,
    handler: function () { return busyNow(); },
  },
  // goal/G47.1, the verbs cycle, the box: "If the argument (a filename, scoped to run://) is not a production script, it
  // returns the error \"not a production script\"", "If the file does not exist, it returns the error \"no such file\", so
  // the caller can tell the difference", "If the file does not have its file and suite rows, they are created
  // automatically", "It creates them with the same code the server uses when it discovers a file change and no record
  // exists: the suites are flagged \"needs testing\"", "The server then returns the file row." Named script.get since the
  // rename (the box: "the verb testicle.file.get becomes testicle.script.get, its argument still name").
  'script.get': {
    request: { name: '' }, reply: { name: '', hash: '', deleted: false, changed: 0 },
    handler: function (a) {
      const name = posix(String(a.name || '')).replace(/^\.?\//, '');
      if (!/\.js$/.test(name) || isSuite(name) || name.indexOf('..') !== -1 || ignored(path.join(RUN, name))) throw refused('not-a-production-script');
      if (!there(name)) throw refused('no-such-file');
      const row = Q.script.get(name);
      // ITS OWN SUITE'S ROW, MADE IF MISSING (the box: "If the file does not have its file and suite rows, they are created
      // automatically"; wsl's verify: after script.get of lambda.js its own suite row was not there): flagged, and the runner
      // told.
      const own = ownTestOf(name);
      if (row && there(own) && !Q.suiteRow.get(name, own)) {
        Q.putSuite.run(name, own, hashOf(own), Date.now());
        tell('suite', suiteServed(Q.suiteRow.get(name, own)), 'added');
        soon();
      }
      if (row) return served(row);
      getting += 1;
      told();
      return pairs().then(function (P) { apply([name], P); return served(Q.script.get(name)); })
        .finally(function () { getting -= 1; told(); });
    },
  },
  // goal/G47.1, the verbs cycle, the box: "A standard table search response", "The file row owns its suite rows: the suite
  // table's key is file and suite. So suite.search takes the production file and answers that file's suite rows only, each
  // suite once, with its filename and its status; the words narrow among them", "The suite search returns both: the
  // filename AND its status \"needs running\"", "suite.search takes {script, text}". Ranked over the whole row as it is served (goal/G41.28), as the agent's
  // tables search; with no words, all of them, by name.
  // NO SCRIPT, EVERY SUITE (goal/G47.1, the box: "with the script selector blank (all scripts), the suite selector lists every
  // suite, each once, and suite.search given no script answers that list"; Andy: "the testicle search must be able to search
  // for test with the fucking script filter blank AND a suite selected!!!"): each suite once, its script '', keyed |suite.
  'suite.search': {
    request: { script: '', text: '' }, reply: { items: [], more: false },
    // script may be left out: no script, every suite.
    accepts: function (a) {
      if (!a || typeof a !== 'object' || Array.isArray(a) || typeof a.text !== 'string') return false;
      return Object.keys(a).every(function (k) { return k === 'text' || (k === 'script' && typeof a[k] === 'string'); });
    },
    handler: function (a) {
      const words = String(a.text || '').trim();
      const bucket = createProbabilityBucket(Infinity);
      const script = String(a.script || '');
      let n = 0;
      (script ? Q.suitesOfScript.all(script) : Q.everySuite.all().map(function (r) { return Object.assign({ script: '', outcome: '' }, r); })).forEach(function (r) {
        // A DELETED ROW IS NOT SHOWN (goal/G47.1, Andy: "MAKE SURE SUITES DON'T SHOW UP WHEN THEY'RE NO APPLICATBLE TO A
        // SCRIPT"; pruneUnfit: "never shown"): a suite its script's class rules out, or one gone from disc, stays deleted
        // in the table and out of every answer.
        if (r.deleted) return;
        const row = suiteServed(r);
        const score = words ? Number(probabilityStringObjectMatch(words, row)) || 0 : 1;
        n += 1;
        if (score > 0) bucket.seatFor(score * (1 - 1e-9) + 1e-9 / (1 + n), { key: row.key, label: JSON.stringify(row) });
      });
      const out = bucket.serialize(null, SEARCH_ROOM);
      return { items: out.items, more: !!out.more };
    },
  },
  // goal/G47.1, the test-table cycle, the box: "Every test.set happens by itself, no bundling", "test.set MUST carry
  // severity: {script, suite, test, verified, severity}", "When a test row is set, and a script row is missing, the server
  // needs to auto-create the script/suite rows for that test". A script whose row is missing, or whose bytes changed since
  // its row, gets its rows by the same write a change makes; then the test's row. "This cycle does not clear a suite's
  // needs-testing flag."
  // A SUITE'S SUCCESS FOR A SCRIPT (goal/G47.1, box v129-131; Andy: "replace the last tweark with the reporter reporting
  // fucking success/failure of the suite through a new verb testicle.suite.success", "any suite, including general ones know
  // at the TIME if it was a success"): {script, suite, success}, sent by the reporter once a suite is through with a script
  // (a general test once per script). The suite row is set at once, green or red, its flag cleared; it is the one thing that
  // writes a suite row's outcome ("a suite's result is NEVER assembled from testicle rows, anywhere"). A script changed since
  // the run began keeps its flag, so the run comes round again. A partial run (--test) sends none.
  'suite.success': {
    request: { script: '', suite: '', success: false }, reply: {},
    // reason and requires may be left out (goal/G47.6, Andy: "both new arguments to the two existing verbs are approved.").
    accepts: function (a) {
      if (!a || typeof a !== 'object' || Array.isArray(a) || typeof a.script !== 'string' || typeof a.suite !== 'string' || typeof a.success !== 'boolean') return false;
      return Object.keys(a).every(function (k) { return k === 'script' || k === 'suite' || k === 'success' || (k === 'reason' && typeof a[k] === 'string') || (k === 'requires' && typeof a[k] === 'string'); });
    },
    handler: function (a) {
      const script = posix(String(a.script || '')).replace(/^\.?\//, '');
      const suite = posix(String(a.suite || '')).replace(/^\.?\//, '');
      const toolWithRow = isSuite(script) && !!Q.script.get(script);
      if (!/\.js$/.test(script) || (isSuite(script) && !toolWithRow) || script.indexOf('..') !== -1 || ignored(path.join(RUN, script))) throw refused('not-a-production-script');
      if (!suite || typeof a.success !== 'boolean') throw refused('bad-request');
      if (!there(script)) throw refused('no-such-file');
      // The hash the run took at its start, when this comes from the run going.
      const ran = job && job.batch && job.suite === suite && job.hashes && job.hashes[script] !== undefined ? job.hashes[script]
        : job && job.script === script && job.suite === suite ? job.scriptHash : null;
      const sr = Q.script.get(script);
      if (ran && sr && sr.hash !== ran) return {};
      if (suite === CLASSIFY) classifierRow(script, job && job.classify ? job.suiteHash : hashOf(suite));
      else if (there(suite) && !Q.suiteRow.get(script, suite)) Q.putSuite.run(script, suite, hashOf(suite), Date.now());
      if (!Q.suiteRow.get(script, suite)) throw refused('no-such-file');
      // Said by the run going: a kill of it leaves this script as it reported (killJob).
      if (ran && job && job.suite === suite && job.reported) job.reported[script] = true;
      // What the run left in the run folder, judged for this script (judgeLitter).
      if (ran && job && job.suite === suite) judgeLitter(job, script, ran);
      judgeSuite.run(a.success ? 'green' : 'red', Date.now(), script, suite);
      // ITS RUN TIMED (goal/G48.4): from the run's start, or in a general test's run of many scripts from the verdict of the
      // script before it, to this verdict; only a verdict of the run going is timed.
      if (ran && job && job.suite === suite) {
        const now = Date.now();
        setMs.run(Math.max(0, now - (job.lastVerdict || job.started || now)), script, suite);
        job.lastVerdict = now;
      }
      // WHY A RED REACHED NO VERDICT (goal/G47.6, box point 1): crashed or hung, as the reporter knows it; '' otherwise.
      const broke = !a.success && (a.reason === 'crashed' || a.reason === 'hung');
      if (broke) setReason.run(a.reason, script, suite);
      // A COMPLETED RUN SHEDS THE TITLES IT DID NOT REPORT (goal/G47.4, the box: "titles that did not report for a completed
      // run of a script/suite combination, will be completely erased from the data base", "killed or crashed run of a
      // script/suite deletes no testicle rows"): the verdict of the run testicle started, not crashed or hung.
      if (ran && job && job.suite === suite && job.started && !job.killed && !broke && suite !== CLASSIFY) eraseUnreported(script, suite, job.started);
      // WHAT ITS OWN SUITE PULLED IN WHILE IT RAN (goal/G47.6, box point 3: a require made only later, inside a function; wsl:
      // "must count only for a script's own suite"): added to its rows; a general test's are never counted.
      if (suite === ownTestOf(script)) requiresOf(script, a.requires).forEach(function (r) { D.add.run(script, r); });
      tell('suite', suiteServed(Q.suiteRow.get(script, suite)), 'updated');
      return {};
    },
  },
  // A TEST'S TITLE CHANGED (goal/G47.4, the box: "a new verb testicle.title will change a testicle title, the script, suite
  // AND oldTitle arguments must match an existing row exactly, and the new title must be valid and not exceed
  // max_title_length", "testicle will refuse a title change if it would lead to a duplicate within the suite, or if the
  // string can not be found excatcly once as a literal in the suite file", "the title will be naturally replaced in the suite
  // file itself", "testicle will update all testicle rows for that suite/title (for all scripts)", "the changes in the suite
  // file, if successfull will immediatelly pushed to Origin"; "test titles are constrained BY DESCRIPTION_MAX_BYTES"). The
  // suite and its spec beside it are committed alone, by path, and pushed; a push that fails puts the file and its spec back
  // and the rows stay as they were, so the file, the rows and origin never disagree.
  'testicle.title': {
    request: { script: '', suite: '', oldTitle: '', title: '' }, reply: {},
    handler: function (a) {
      const script = posix(String(a.script || '')).replace(/^\.?\//, '');
      const suite = posix(String(a.suite || '')).replace(/^\.?\//, '');
      const old = String(a.oldTitle || '');
      if (!script || !suite || !old || script.indexOf('..') !== -1 || suite.indexOf('..') !== -1 || !/\.js$/.test(suite) || !isSuite(suite)) throw refused('bad-request');
      if (!T.rowsOf.all(script, suite, old).length) throw refused('no-such-test');
      const bad = fieldRules().describeProblem(a.title);
      if (bad) throw Object.assign(refused('bad-title'), { extra: { why: bad } });
      const title = fieldRules().normalize(a.title);
      if (title === old) throw refused('same-title');
      if (T.titleInSuite.get(suite, title)) throw refused('duplicate-title');
      if (!there(suite)) throw refused('no-such-file');
      return renameTitle(script, suite, old, title);
    },
  },
  'testicle.set': {
    request: { script: '', suite: '', test: '', verified: false, severity: 0 }, reply: {},
    handler: function (a) {
      const script = posix(String(a.script || '')).replace(/^\.?\//, '');
      const suite = posix(String(a.suite || '')).replace(/^\.?\//, '');
      const name = String(a.test || '');
      // A script in a test folder with a row of its own (a tool of the test system with a test of its own: testReport.js,
      // testModule.js) takes results as any script does; refused, its classifier result and its own tests' went nowhere.
      const toolWithRow = isSuite(script) && !!Q.script.get(script);
      if (!/\.js$/.test(script) || (isSuite(script) && !toolWithRow) || script.indexOf('..') !== -1 || ignored(path.join(RUN, script))) throw refused('not-a-production-script');
      if (!suite || !name) throw refused('bad-request');
      // A RESULT OF A SUITE THAT DOES NOT APPLY TO THE SCRIPT IS REFUSED (goal/G47.1, Andy: "MAKE SURE SUITES DON'T SHOW UP WHEN
      // THEY'RE NO APPLICATBLE TO A SCRIPT"; wsl's red cac1e222): a -browser suite's for a node-only script, a -node suite's for
      // a browser-only one, refused before any row is made, so neither a test row nor a suite row of it stands.
      if (!fits(script, suite)) throw refused('not-applicable');
      const severity = Math.max(0, Math.min(1, Number(a.severity) || 0));
      // A result of the running suite is what it is running now (runningNow: tested, script), told at once.
      if (job && !job.classify && job.suite === suite && (job.batch ? job.scripts.indexOf(script) !== -1 : job.script === script)) { job.tested = (job.tested || 0) + 1; job.last = { script: script, test: name, ok: a.verified === true }; told(); }
      const row = Q.script.get(script);
      // A FILE NOT ON DISC TAKES NO RESULT, its row deleted or never made (wsl's red, 3f6832e6: a classifier run begun before
      // two files were removed reported 2 s after, and their rows stood live and red for hours; the box: "A removed file's
      // row is marked deleted").
      if (!there(script)) throw refused('no-such-file');
      const stale = !row || (there(script) && row.hash !== hashOf(script));
      getting += 1;
      told();
      return Promise.resolve(stale && there(script) ? pairs().then(function (P) { apply([script], P); }) : null).then(function () {
        // ITS SUITE ROW, MADE IF MISSING (goal/G47.1, the box: "When a test row is set, and a script row is missing, the server
        // needs to auto-create the script/suite rows for that test"): a suite on disc whose row for this script is not there
        // gets it, flagged, so its status can be judged from the tests that follow.
        // The classifier gets none (Andy: "scriptClassify NEVER runs as a normal, general TEST."): its result is its
        // classifyable test row alone.
        if (suite === CLASSIFY) classifierRow(script, job && job.classify ? job.suiteHash : hashOf(suite));
        else if (there(suite) && !Q.suiteRow.get(script, suite)) {
          Q.putSuite.run(script, suite, hashOf(suite), Date.now());
          tell('suite', suiteServed(Q.suiteRow.get(script, suite)), 'added');
          // A flag written here wakes the runner as a file change does (wsl's gap: "every flagged row is owed one run").
          soon();
        }
        // THE TWO HASHES IT IS TAGGED WITH (the box: "until that run ends tags every result of it with them"): the running job's
        // for its own script and suite; any other result, the script and suite rows' hashes as they stand.
        // A classifying run's result: tagged with that script's hash as the run started, and the classifier's.
        const asClassified = job && job.classify && suite === CLASSIFY && job.hashes && job.hashes[script] !== undefined ? job : null;
        // A general test's run of several scripts: tagged with that script's hash as the run started, and the suite's.
        const inBatch = job && job.batch && job.suite === suite && job.hashes[script] !== undefined ? job : null;
        const listed = asClassified || inBatch;
        const own = listed || (job && job.script === script && job.suite === suite ? job : null);
        let scriptHash = listed ? listed.hashes[script] : own ? own.scriptHash : ((Q.script.get(script) || {}).hash || hashOf(script));
        let suiteHash = own ? own.suiteHash : ((Q.suiteRow.get(script, suite) || {}).hash || hashOf(suite));
        // Late from a killed run, its hashes still standing: failed, as every test of that run is.
        const late = own ? null : killed.get(script + '|' + suite);
        const isLate = !!late && late.scriptHash === scriptHash && late.suiteHash === suiteHash;
        if (late && !isLate) killed.delete(script + '|' + suite);
        const out = setResult(script, suite, name, isLate ? false : !!a.verified, severity, scriptHash, suiteHash);
        // A classifying run's count moves with each script it has said its class of (runningNow), and is told.
        if (asClassified && !asClassified.seen[script]) { asClassified.seen[script] = true; asClassified.done += 1; asClassified.lastClassified = script; told(); }
        return out;
      }).finally(function () { getting -= 1; told(); });
    },
  },
  // goal/G47.1, the test-table cycle, the box: "test.search will only return \"current\" test rows for the script/suite
  // combination supplied to the search. The other cases are handled accordingly: no script in the search query searches
  // tests for any script; the same for suite", "Most severe first applies to all test searches." script and suite may each
  // be left out; the words narrow among the rows, matched over the whole row as it is served.
  // THE ONE EXCEPTION, A TEST'S HISTORY (goal/G47.1, the search cycle; Andy, amending the ruling above: "test.search will
  // return only current test rows by default, unless a valid test-Title is supplied, in which case all rows will be show
  // that match: \"script, suite AND title\""): given a test with its script and its suite, every row of that one test,
  // current or not, newest flip first. A test without its script and suite is no valid title, and refused.
  'testicle.search': {
    request: { text: '' }, reply: { items: [], more: false },
    accepts: function (a) {
      if (!a || typeof a !== 'object' || Array.isArray(a) || typeof a.text !== 'string') return false;
      if (a.test !== undefined && (typeof a.script !== 'string' || typeof a.suite !== 'string' || typeof a.test !== 'string' || !a.test)) return false;
      if (a.result !== undefined && a.result !== 'red' && a.result !== 'green') return false;
      return Object.keys(a).every(function (k) { return (k === 'text') || k === 'result' || k === 'from' || ((k === 'script' || k === 'suite' || k === 'test') && typeof a[k] === 'string'); });
    },
    // goal/G47.1, the box: "Red, green, the script and the suite go to the server with the words, so the server narrows
    // before it cuts an answer", "the page asks for the following answers while the server says there are more": result,
    // red or green, left out for both; from, the rows already held.
    handler: function (a) {
      const words = String(a.text || '').trim();
      const kept = function (row) {
        return (a.result === undefined || row.verified === (a.result === 'green')) && (!words || (Number(probabilityStringObjectMatch(words, row)) || 0) > 0);
      };
      if (a.test !== undefined) return mostSevereFirst(T.history.all(a.script, a.suite, a.test).map(testServed).filter(kept));
      const rows = T.currents.all().filter(function (r) { return (a.script === undefined || r.script === a.script) && (a.suite === undefined || r.suite === a.suite); })
        .map(testServed).filter(kept);
      // WITH WORDS, THE BEST MATCH FIRST (goal/G47.1; testicle.js: "cut and full: of the rows that match, as many as the answer
      // holds are in it"): an answer cut by its room held the most severe of the rows the words touched at all, so a test
      // matching every word fell below ones matching one. The match orders them, the most severe first among equals.
      if (words) {
        const score = new Map(rows.map(function (r) { return [r, Number(probabilityStringObjectMatch(words, r)) || 0]; }));
        rows.sort(function (x, y) { return score.get(y) - score.get(x); });
      }
      return mostSevereFirst(rows);
    },
  },
  // goal/G47.1, the box: "The new verb \"red\" is shorthand for: search all failed, current tests, most severe first", "The
  // verb red is testicle.red, the one simple verb G45 named for any peer to get the latest reds." It takes nothing.
  red: {
    request: {}, reply: { items: [], more: false },
    handler: function () { return mostSevereFirst(T.reds.all().map(testServed)); },
  },
// No peer user: the owner's own test status (apiAuth/G1.10).
}, {
  // ITS ROWS ON THE NODE'S JOB STREAM (goal/G47.1, the UI cycle), as the agent's tables publish theirs: { testicle: { table,
  // row, change, busy } }, and busy alone when it turns (tell and told, above). A page starts with no rows and asks
  // suite.search for what it shows.
  // No branch named (goal/G47.5): each subscriber names its own, and appServer keeps it (clientListeners.json).
  publisher: { bootstrap: function () { return []; } },
  codes: {
  'not-a-production-script': { status: 400, text: 'not a production script' },
  'no-such-file': { status: 404, text: 'no such file' },
  // A -browser suite's result for a node-only script, a -node suite's for a browser-only one (testicle.set, above).
  'not-applicable': { status: 409, text: 'this suite does not apply to this script' },
  // testicle.title's refusals (goal/G47.4, the box: "else the request is refused").
  'no-such-test': { status: 404, text: 'no row of that script, suite and title' },
  'bad-title': { status: 400, text: 'the title breaks the description rule' },
  'same-title': { status: 400, text: 'the new title is the old one' },
  'duplicate-title': { status: 409, text: 'that title is already in the suite' },
  'not-found-once': { status: 409, text: 'the title is not written exactly once in its suite file' },
  'suite-has-edits': { status: 409, text: 'the suite file or its spec has edits of its own' },
  'push-failed': { status: 409, text: 'the change could not be pushed, and was put back' },
} });
