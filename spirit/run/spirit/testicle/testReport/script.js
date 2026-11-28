'use strict';

// spirit/run/spirit/testicle/testReport/script.js
// THE PRODUCT TEST SYSTEM'S OWN REPORTER (goal/G40.13, box v22, point 1). Andy, 2026-10-26: "the new reporter prints the
// same lines as today. the verifier reads it unchanged.", "BUT, i want the product test system to be independent and
// not reach into repo:/spirit/test/ at all....".
//
// A product test requires this file and nothing of spirit/test/. It prints the heading lines, one line per test, its title
// and its mark (✅ or ❌), and the completion line last, the exit code saying the same thing.
//
// ONE CALL PER TEST (goal/G47.2; Andy: "Every test inside every suite has its unique (within the suite) title. Every test
// supplies its severity and reports itself to testicle, with the appropriate severity if the test hangs or crashes, else
// with the default severity. Every test holds on one single string, the title, which is supplied with the report, success
// or failure."; its contract: ./test/script.md):
//   test.run(title, severity, body, limit)     limit is test.limit.quick, .slow or .long (below). body() answers true to pass, false to fail; it
//                                              may be async. A throw or a rejection fails it at 0.7; still running at its
//                                              limit, it fails as a hang at 0.7.
//   test.after(fn)                             run once every test has run, whatever they did.
// The tests run one at a time in the order given. Each is reported by itself to testicle.testicle.set of the node of the
// checkout it runs in (spirit.js reads that node's port from the checkout's spirit/state/environment.json; goal/G47.1:
// "a checkout with no node running reports nowhere and still prints its lines"): {script, suite, test, verified,
// severity}, the script the test tests and the suite scoped to run://, the title the key. `--test <title>` runs the
// tests up to and including that one, and none after (the box: "the sequence is run up to the specified test").
//
// THE PLACE KEY IS GONE (goal/G47.2, the box: "the key by place (its sub-heading and its number) goes"): every suite says
// its tests through test.run, so test.check, test.fail, test.subHeading and the place they were keyed by are no more.
// test.comment prints a note, no check.
//
//   const test = require('<run>/spirit/testicle/testReport/script.js');

const path = require('path');
// The rule a test's title keeps (goal/G47.4): product code, which a test may load.
// The description's type since goal/G49.13, when the old rules file went: '' when it takes the title, else why.
const TITLE_TYPE = require('../../type/string/description/script.js');
function titleProblem(v) { try { TITLE_TYPE.isValid(v); return ''; } catch (e) { return (e && e.message) || 'not a valid title'; } }

const STARS = '**************************************************************************';
const LINE_LENGTH = STARS.length;
const INDENT_LENGTH = 3;
const MAX_TITLE_LENGTH = LINE_LENGTH - INDENT_LENGTH * 4;
const PAD_STARS = '*'.repeat(INDENT_LENGTH);
const PAD_SPACES = ' '.repeat(INDENT_LENGTH);
const ICON = { SUCCESS: '✅', ERROR: '❌' };

// How long an ended suite waits with none of its reports to testicle landing before it gives up and exits.
const RECORD_WAIT_MS = 10000;
// One printed line of the runner's own: a script's name, or a test's title and its mark. No suite prints (no test.comment).
function line(text) { console.log(PAD_STARS + PAD_SPACES + text); }
function titleLine(title) {
  let t = String(title);
  if (t.length > MAX_TITLE_LENGTH) t = t.substring(0, MAX_TITLE_LENGTH - 3) + '...';
  const padded = PAD_SPACES + t + PAD_SPACES;
  const start = (LINE_LENGTH - padded.length) / 2;
  let line = '';
  for (let i = 0; i < start; i++) line += '*';
  line += padded;
  for (let i = line.length; i < LINE_LENGTH; i++) line += '*';
  console.log(line);
}

const test = {
  counter: 0,
  successCount: 0,
  failureCount: 0,

  // The suite's heading: the suite, the second part of every row's key (script, suite, title), and no number.
  startTest: function (suite) {
    this.counter++; this.successCount = this.failureCount = 0;
    console.log('\n' + STARS);
    titleLine(suite);
    console.log(STARS + '\n');
  },
  // The completion line, the one the readers parse, and the exit code saying the same.
  reportSuccessFailureCount: function () {
    console.log('\n');
    let result = 'Test completed.  ';
    if (this.successCount > 0) result += ICON.SUCCESS + ':' + this.successCount;
    if (this.successCount > 0 && this.failureCount > 0) result += '  ';
    if (this.failureCount > 0) result += ICON.ERROR + ':' + this.failureCount;
    titleLine(result);
    console.log('\n');
    if (this.failureCount > 0) process.exitCode = 1;
  },
};

// ── ONE CALL PER TEST (goal/G47.2) ──────────────────────────────────────────────────────────────────────────────────────
const RUN_ROOT = path.join(__dirname, '..', '..', '..');
function runRel(f) {
  const r = path.relative(RUN_ROOT, f);
  return r && r.indexOf('..') !== 0 && !path.isAbsolute(r) ? r.split(path.sep).join('/') : '';
}
// The arguments this suite was run with: the files a general test judges, and --test <title>.
const ARGV = process.argv.slice(2);
const ONLY = ARGV.indexOf('--test') !== -1 ? String(ARGV[ARGV.indexOf('--test') + 1] || '') : null;
const PLAIN_ARGS = ARGV.filter(function (a, i) { return a.indexOf('--') !== 0 && ARGV[i - 1] !== '--test'; });
// The suite, scoped to run://, and the script it tests: a general test (-child-, -sibling-) the file it judges, its argument;
// any other the module beside its test folder, <dir>/test/<name>.js testing <dir>/<name>.js.
const SUITE_FILE = runRel(path.resolve(String(process.argv[1] || ''))) || path.basename(String(process.argv[1] || ''));
const SCRIPT = (function () {
  if (/-(child|sibling)-/.test(path.posix.basename(SUITE_FILE)) && PLAIN_ARGS[0]) {
    for (const p of [path.resolve(PLAIN_ARGS[0]), path.join(RUN_ROOT, PLAIN_ARGS[0]), path.join(RUN_ROOT, '..', '..', PLAIN_ARGS[0])]) {
      const r = runRel(p);
      if (r && require('fs').existsSync(p)) return r;
    }
    return String(PLAIN_ARGS[0]);
  }
  const dir = path.posix.dirname(SUITE_FILE);
  const above = path.posix.basename(dir) === 'test' ? path.posix.dirname(dir) : dir;
  return (above === '.' ? '' : above + '/') + path.posix.basename(SUITE_FILE);
}());

// The node's testicle, through the one spirit object. THE SUITE'S OWN SPIRIT OBJECT STAYS THE GLOBAL (goal/G41.11: spirit.js,
// loaded here, writes itself onto the global object it finds, and once wrote over the stand-in a suite runs on): it is
// loaded with the suite's spirit and window hidden, and whatever the suite had set is put back. A suite with none of its own
// keeps the real one as its global (goal/G47.2: a module requiring spirit.js after a report must find it).
let testicle = null;
let reportsOut = 0;
const reportsLanded = [];
// EACH REPORT AT ONCE, NONE WAITING FOR THE ONE BEFORE (goal/G49.8; Andy: "make it smaller! make it faster! do it.", after the
// timing of script-sibling-general.js: 41 checks a script, each waiting its report's round trip): a test's report goes out the
// moment the test ends, and the next test starts without waiting for it to land. IN ORDER WHERE IT COUNTS (goal/G47.1, box
// v129: a general test's success for one script comes before any result of the next): a script's success is sent only once
// every report of its tests has landed (testicle erases a title a completed run did not report), and the run waits for that
// success before the next script's tests start. reportChain is the last success sent.
let reportChain = Promise.resolve();
const pendingOf = Object.create(null);
// NO NODE, NO REPORTS (a checkout with no node of its own, cw's build copy: every report was refused, tried three times a
// second apart, and the suite then waited out RECORD_WAIT_MS, ten seconds on every run): once the node is found not there at
// all, its door refused or no port named, the reports after are not sent. A refusal for any other cause (the testicle
// family still loading, the first report's race) is tried again, as before.
let nowhere = false;
function unreachable(e) { return !!e && (e.code === 'no-node' || (!!e.cause && e.cause.code === 'ECONNREFUSED')); }
// THE REPORTER'S OWN LOADS (goal/G47.6): what spirit.js and the testicle family pull in to report, kept apart, so a script's
// own suite never counts them as that script's dependencies (requiresOfSuite).
const reporterOwn = new Set();
function loadedNow() { return Object.keys(require.cache); }
function reportToTesticle(rec, verb, after) {
  const before = new Set(loadedNow());
  try {
    const own = globalThis.spirit;
    const ownWindow = globalThis.window;
    globalThis.spirit = undefined;
    globalThis.window = undefined;
    let real = null;
    try { real = require(path.join(__dirname, '..', '..', 'script.js')); } finally { globalThis.spirit = own !== undefined ? own : (real || undefined); globalThis.window = ownWindow; }
    testicle = testicle || real.requireScript('spirit/app/testicle/api.js');
    // ITS FAILURE CAUGHT WHERE IT IS KEPT (the test review, fix 1: "testReport.js:137 stores the report promise with no handler, and
    // :209 charges the rejection to the running test"; with no node, three passing tests gave two greens and a red): a family
    // that cannot load is asked for again by the next try (once), and its rejection is never a crash of the test that runs.
    if (testicle && typeof testicle.then === 'function') testicle.then(null, function () { /* asked for again by once */ });
    loadedNow().forEach(function (k) { if (!before.has(k)) reporterOwn.add(k); });
    reportsOut += 1;
    // TRIED AGAIN, UP TO THREE TIMES, A SECOND APART (goal/G47.1, wsl's verify: "the FIRST report of a suite process is
    // sometimes lost; every later one lands": the first goes out while spirit.js and the testicle family still load). The
    // same result sent twice moves no flip (testicle.set), so a try that landed after all does no harm.
    // A family that failed to load is asked for again on the next try.
    const once = function () {
      if (nowhere) return Promise.resolve();
      testicle = testicle || real.requireScript('spirit/app/testicle/api.js');
      if (testicle && typeof testicle.then === 'function') testicle.then(null, function () { /* handled below */ });
      return Promise.resolve(testicle).then(function (f) { return f[verb || 'testicle.set'](rec); }, function (e) { testicle = null; throw e; });
    };
    const wait = function () { return new Promise(function (r) { ownTimeout(r, 1000); }); };
    const sent = Promise.resolve(after).then(function () {
      const again = function (e) { if (unreachable(e)) { nowhere = true; return undefined; } return wait().then(once); };
      return once().catch(again).catch(again)
        .catch(function () { /* a checkout with no node reports nowhere */ });
    }).then(function () { reportsOut -= 1; });
    reportsLanded.push(sent);
    const key = String(rec.script || '');
    (pendingOf[key] = pendingOf[key] || []).push(sent);
    return sent;
  } catch (e) { /* the lines are printed whatever the node says */ }
}

// THE REPORTER'S OWN TIMERS, kept as this file loads: a suite may replace the global setTimeout to speed its own waits
// (a suite once did), and a test's time limit must not shrink with it.
const ownTimeout = setTimeout;
const ownImmediate = setImmediate;
const queue = [];
const afters = [];
let started = false;
function start() { if (!started) { started = true; ownImmediate(runAll); } }
// THE TIME LIMITS, CENTRAL (Andy, 2026-11-11, after limits measured on one machine hung the tests on another: "cw, change
// the limits, i hope you have those as relatively central constants, GO!!"). Every suite gives a test one of these, never
// a number of its own (script-sibling-general.js (titleRules) judges it): quick for a test that asks and answers, slow for one that
// starts a scratch node, a desk or a Chrome page, long for one that runs a whole world end to end. A limit catches a hang,
// not a slow machine, so each is wide; change one here and every suite follows.
test.limit = Object.freeze({ quick: 10000, slow: 60000, long: 300000 });
// A TEST OF ANOTHER SCRIPT (goal/G47.1, box v94, 1: spirit/testicle/scriptClassify/script.js, given a list of scripts, reports each one's
// "classifyable"): opts.script, scoped to run://, names the script that one result is reported for, in place of SCRIPT;
// a title is then said once per script.
// FOR ONE SCRIPT OF SEVERAL (goal/G47.1, box v94, 2: a general test "will process all scripts listed in the arguments that
// fit"): test.forScript(script, fn) runs fn, and every test.run it calls at once is reported for that script, as opts.script.
let forScript = '';
test.forScript = function (script, fn) {
  const was = forScript;
  forScript = String(script || '');
  try { fn(); } finally { forScript = was; }
};
// A RUN THAT TAKES TESTS WHILE IT RUNS (goal/G47.1, box v144: "every result reaches testicle the moment the page knows it"): a
// suite that draws one script after another holds the run open (test.hold), says each script's tests as soon as they are
// known, and lets it end (test.release); its tests run, and report, as they come. A suite that never holds runs as before:
// what it said before the first turn, then the end.
let holds = 0;
let woken = null;
function wake() { if (woken) { const w = woken; woken = null; w(); } }
test.hold = function () { holds += 1; start(); };
test.release = function () { holds = Math.max(0, holds - 1); wake(); };
test.run = function (title, severity, body, limitMs, opts) {
  const own = opts && typeof opts.script === 'string' && opts.script ? opts.script : forScript;
  queue.push({ title: title, severity: severity, body: body, limit: limitMs, script: own });
  start();
  wake();
};
test.after = function (fn) { afters.push(fn); start(); };

// The test running now, so a throw or a rejection nothing caught lands on it.
let current = null;
function settle(t, verdict) { if (current === t && !t.done) { t.done = true; t.verdict = verdict; t.resolve(); } }
// A TEST'S ONE STRING IS ITS TITLE (goal/G47.1, Andy: "A TEST ANSWERS SUCCESS OR FAILURE WITH IT's FUCKING TITLE STRING, THE
// FUCKING FAILURE STRING GETS DELETED FROM EVERY FUCKING TEST", and "THE TEST RUNNER DISREGARD ANY FUCKING MESSAGES FROM THE
// TEST AND REGISTER THE FUCKING RESULT WITH THE FUCKING TEST FUCKING TITLE"): a verdict is pass or fail, a crash or a hang a
// fail at 0.7; no text goes with it, printed or reported.
// A THROW OUTSIDE EVERY TEST ENDS THE RUN AS CRASHED (goal/G49.23, wsl's find: a suite that threw while it loaded was swallowed
// here and kept alive, so it hung until testicle's job limit, and one stale require blocked testicle's whole queue): with no
// test running, the throw counts as a failure, every hold is let go so the run ends, and its script is marked crashed.
let crashedOutside = false;
function thrown() {
  if (current) { settle(current, { pass: false, crash: true }); return; }
  if (!crashedOutside) test.failureCount++;
  crashedOutside = true;
  holds = 0;
  start();
  wake();
}
process.on('uncaughtException', thrown);
process.on('unhandledRejection', thrown);
// ASKED TO STOP, IT CLEANS UP AND ENDS BY ITSELF (goal/G48.4; Andy: "WHY THE FUCK ARE TEST RUNS STILL LITTERING SHIT ALL OVER
// THE PLACE!!!???", then "step 1 for now. and we continue."): its test.after cleanups run, then it ends, so what it started
// goes with it and nothing is left for the kill that follows. Asked by a stop message on its channel ({ stop: true }, the
// way testicle asks, on Windows too, where a process cannot catch a signal) or by SIGTERM where there is one.
let aftersRan = false;
async function runAfters() { if (aftersRan) return; aftersRan = true; for (const fn of afters) { try { await fn(); } catch (e) { /* a cleanup, not a test */ } } }
let stopping = false;
function stopAsked() { if (stopping) return; stopping = true; runAfters().then(function () { process.exit(1); }, function () { process.exit(1); }); }
process.on('SIGTERM', stopAsked);
process.on('message', function (m) { if (m && m.stop === true) stopAsked(); });

function one(t) {
  return new Promise(function (resolve) {
    t.resolve = resolve;
    current = t;
    // PAST ITS LIMIT IT HUNG, told apart from a throw (goal/G47.6, box point 1: "crashed or hung when no verdict was reached").
    const timer = ownTimeout(function () { settle(t, { pass: false, crash: true, hung: true }); }, Number(t.limit) > 0 ? Number(t.limit) : 60000);
    let answered;
    try { answered = Promise.resolve(t.body()); } catch (e) { answered = Promise.reject(e); }
    answered.then(function (v) {
      settle(t, { pass: v === true });
    }, function () { settle(t, { pass: false, crash: true }); });
  }).then(function () { current = null; });
}

// A SCRIPT'S OWN SUITE AND WHAT IT PULLED IN (goal/G47.6, box point 3: "a require that happens only later, inside a function, is
// recorded while the script's own suite runs"; wsl: "must count only for a script's own suite"): the production scripts in
// this process's module cache, run paths, the reporter's own loads, test folders and the script itself left out.
function ownSuiteOf(script) { return path.posix.join(path.posix.dirname(script), 'test', path.posix.basename(script)); }
function requiresOfSuite(script) {
  return loadedNow().filter(function (k) { return !reporterOwn.has(k); }).map(runRel)
    .filter(function (r) { return r && /\.js$/.test(r) && r !== script && !/(^|\/)test\//.test(r) && r.indexOf('node_modules/') === -1; });
}

// A title cut to the description rule's bytes, before the character that would overflow them (goal/G49.6; Andy: "cut before
// the character that causes overflow"): whole characters only, never half of one.
const TITLE_MAX_BYTES = 128;
function cutTitle(title) {
  const s = String(title).trim();
  if (Buffer.byteLength(s, 'utf8') <= TITLE_MAX_BYTES) return s;
  let out = '';
  let bytes = 0;
  for (const ch of s) {
    const b = Buffer.byteLength(ch, 'utf8');
    if (bytes + b > TITLE_MAX_BYTES) break;
    out += ch;
    bytes += b;
  }
  return out;
}
async function runAll() {
  test.startTest(SUITE_FILE);
  const seen = Object.create(null);
  // The last test to run: the queue's end, or the one asked by title; while the run is held, the queue as it grows.
  const lastOf = function () { return ONLY === null ? queue.length - 1 : queue.map(function (t) { return t.title; }).indexOf(ONLY); };
  // THE SUITE'S SUCCESS FOR EACH SCRIPT (goal/G47.1, box v129-131: "the reporter reports a suite's success or failure for a
  // script through the new verb testicle.suite.success {script, suite, success}, a general test once per script, at the time
  // it knows"; "a suite's result is NEVER assembled from testicle rows"): success when every test it ran for that script held.
  let doing = null;
  const held = Object.create(null);
  const reported = Object.create(null);
  // WHY NO VERDICT, PER SCRIPT (goal/G47.6, box point 1): hung when a test of it ran past its limit, else crashed when one threw;
  // a suite that only answered false reached its verdict, and has none.
  const reasonOf = Object.create(null);
  // A script whose suite said one title twice (goal/G49.6).
  const dupTitles = Object.create(null);
  const succeeded = function (script) {
    if (ONLY !== null || reported[script]) return;
    reported[script] = true;
    const rec = { script: script, suite: SUITE_FILE, success: held[script] !== false };
    if (!rec.success && dupTitles[script]) rec.reason = 'duplicateTitles';
    else if (!rec.success && reasonOf[script]) rec.reason = reasonOf[script];
    if (SUITE_FILE === ownSuiteOf(script)) rec.requires = JSON.stringify(requiresOfSuite(script));
    // After every report of its tests has landed (above).
    reportChain = reportToTesticle(rec, 'suite.success', Promise.all(pendingOf[script] || [])) || reportChain;
  };
  for (let i = 0; ; i++) {
    while (i > lastOf() && holds > 0) await new Promise(function (r) { woken = r; });
    if (i > lastOf()) break;
    const t = queue[i];
    // A TITLE PAST ITS BYTES IS CUT, NEVER REFUSED (goal/G49.6; Andy: "a title over 128 bytes, cut it at the reporter",
    // "cut before the character that causes overflow"): the test runs and is reported under the cut title.
    const title = cutTitle(String(t.title));
    let sev = Number(t.severity);
    const script = t.script || SCRIPT;
    // A SCRIPT DONE (goal/G47.1, box v129-131): the first test of another script ends the one before, whose success goes
    // out as that test starts, before it runs (a run stopped while it waits must find the one before already reported). A run
    // with a title (--test) ran part of its suite and reports no success at all.
    if (doing !== null && doing !== script) { succeeded(doing); await reportChain; }
    // THE SCRIPT, AS A HEADING, where it changes: the script is part of the testicle row's key (script, suite, title), so
    // the lines under it are its tests, each its title and its mark.
    if (doing !== script) { doing = script; held[script] = true; line(script); }
    const once = script + '|' + title;
    // A title said twice, a severity that is no number from 0.0 to 1.0, or no body: a fail at 0.7, as a crash is.
    // A TITLE THAT BREAKS THE DESCRIPTION RULE too (goal/G47.4, the box: "test titles are constrained BY
    // DESCRIPTION_MAX_BYTES, in spirit/fieldRules/script.js"): empty, invisible characters, or past its 128 bytes; refused, never cut.
    // TWO TESTS OF ONE TITLE, CUT OR NOT, FAIL THE SUITE, NOT A TEST (goal/G49.6; Andy: "that refusal has to be a suite level
    // failure. then you can have a new status for suites \"duplicate titles\"", "rule one wins": every test is still run and
    // reported as it ends): the suite's success for the script goes out false, its reason duplicateTitles.
    if (seen[once]) { dupTitles[script] = true; held[script] = false; }
    if (titleProblem(title) || typeof t.severity !== 'number' || !(sev >= 0 && sev <= 1) || typeof t.body !== 'function') t.verdict = { pass: false, crash: true };
    else await one(t);
    seen[once] = true;
    const v = t.verdict || { pass: false };
    const severity = v.crash ? 0.7 : (sev >= 0 && sev <= 1 ? sev : 0.7);
    // Its line: the title and its mark, nothing else.
    if (v.pass) { test.successCount++; line(title + ' ' + ICON.SUCCESS); }
    else { test.failureCount++; line(title + ' ' + ICON.ERROR); }
    if (!v.pass) held[script] = false;
    if (!v.pass && v.crash) reasonOf[script] = (v.hung || reasonOf[script] === 'hung') ? 'hung' : 'crashed';
    // ITS OWN BLOCK'S HASH (goal/G49.6, box v18: "each result row keeps the hash of its own test's block, the source of its
    // function"): the analyze tool tells a changed test from a changed suite by it.
    // Its first 32 hex digits, a word (testicle.set's rule for it: at most 32 bytes).
    const testHash = require('crypto').createHash('sha256').update(String(t.body)).digest('hex').slice(0, 32);
    reportToTesticle({ script: script, suite: SUITE_FILE, test: title, verified: !!v.pass, severity: severity, testHash: testHash });
    // EVERY RESULT REACHES TESTICLE THE MOMENT ITS TEST IS DONE (goal/G49.5; Andy: "the testicle server gets a report
    // IMMEDIATELY after completion of a test"): it is sent now, and goes out at once, never behind another report; the next
    // test no longer waits for it to land (goal/G49.8, Andy: "do it"), so 41 checks no longer cost 41 round trips.
  }
  // A throw outside every test (thrown, above) leaves the script it came in crashed, never a success.
  if (crashedOutside && doing !== null) { held[doing] = false; reasonOf[doing] = 'crashed'; }
  if (doing !== null) { succeeded(doing); await reportChain; }
  // A cleanup that throws is no test and has no title: nothing of it is printed or reported.
  await runAfters();
  test.reportSuccessFailureCount();
  // EVERY REPORT LANDS BEFORE IT EXITS, WHILE THEY STILL LAND (goal/G49.5; Andy: "the error count on all my systems is rising
  // rapidly", "the discrepancy in error count between windows and others"): the reports go one at a time, a node's round trip
  // each, and a general test's batch of 220 scripts sends ~9700, which on Windows fall minutes behind the tests. Cut at
  // RECORD_WAIT_MS from the end, the process left with most still queued, each later script's success never sent, and testicle
  // marked them all crashed with no test rows, so their reds went uncounted. It waits now while reports keep landing, and
  // gives up only when RECORD_WAIT_MS passes with none landing.
  for (;;) {
    const left = reportsOut;
    if (left <= 0) break;
    await Promise.race([Promise.all(reportsLanded), new Promise(function (r) { ownTimeout(r, RECORD_WAIT_MS); })]);
    if (reportsOut <= 0 || reportsOut >= left) break;
  }
  process.exit(test.failureCount > 0 ? 1 : 0);
}

module.exports = test;
