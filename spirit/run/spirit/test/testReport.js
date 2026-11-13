'use strict';

// spirit/run/spirit/test/testReport.js
// THE PRODUCT TEST SYSTEM'S OWN REPORTER (goal/G40.13, box v22, point 1). Andy, 2026-10-26: "the new reporter prints the
// same lines as today. the verifier reads it unchanged.", "BUT, i want the product test system to be independent and
// not reach into repo:/spirit/test/ at all....".
//
// A product test requires this file and nothing of spirit/test/. It prints the lines the old reporter
// (spirit/test/testSupport.js) printed, the same marks in the same places: the heading lines, one SUCCESS or FAILURE line
// per test, and the completion line last, the exit code saying the same thing.
//
// ONE CALL PER TEST (goal/G47.2; Andy: "Every test inside every suite has its unique (within the suite) title. Every test
// supplies its severity and reports itself to testicle, with the appropriate severity if the test hangs or crashes, else
// with the default severity. Every test holds on one single string, the title, which is supplied with the report, success
// or failure."; its contract: ./test/testReport.md):
//   test.run(title, severity, body, limit)     limit is test.limit.quick, .slow or .long (below). body() answers true to pass; false, or a string saying what went wrong, to
//                                              fail; it may be async. A throw or a rejection fails it at 0.7, the error as
//                                              its detail; still running at its limit, it fails as a hang at 0.7.
//   test.after(fn)                             run once every test has run, whatever they did.
// The tests run one at a time in the order given. Each is reported by itself to testicle.testicle.set of the node of the
// checkout it runs in (spirit.js reads that node's port from the checkout's spirit/state/environment.json; goal/G47.1:
// "a checkout with no node running reports nowhere and still prints its lines"): {script, suite, test, verified,
// severity}, the script the test tests and the suite scoped to run://, the title the key. `--test <title>` runs the
// tests up to and including that one, and none after (the box: "the sequence is run up to the specified test").
//
// THE PLACE KEY IS GONE (goal/G47.2, the box: "the key by place (its sub-heading and its number) goes"): every suite says
// its tests through test.run, so test.check, test.fail, test.subHeading and the place they were keyed by are no more.
// test.comment prints a note, no check. A run started with --verify-port also hands each result to deskVerify.record,
// under its title, so Desk's Verify keeps working until testicle runs suites (goal/G47.1, the next cycle; agreed with cw
// in the item's chat).
//
//   const test = require('<run>/spirit/test/testReport.js');

const path = require('path');

const STARS = '**************************************************************************';
const LINE_LENGTH = STARS.length;
const INDENT_LENGTH = 3;
const MAX_TITLE_LENGTH = LINE_LENGTH - INDENT_LENGTH * 4;
const PAD_STARS = '*'.repeat(INDENT_LENGTH);
const PAD_SPACES = ' '.repeat(INDENT_LENGTH);
const ICON = { SUCCESS: '✅', ERROR: '❌' };

// The verifier's port, only when it started the run.
const VERIFY_PORT = (function () {
  const at = process.argv.indexOf('--verify-port');
  const p = at !== -1 ? Number(process.argv[at + 1]) : 0;
  return Number.isInteger(p) && p > 0 ? p : 0;
}());
// A TEST IS SENT BY THE MODULE IT TESTS, /<path>/<module> (goal/G41.19; Andy: "The test names (what is sent to
// deskVerify) must ALWAYS start with the module tested: "/<path>/<module-no-extension>, so when i look in desk->fallout
// i have an instant idea which thing failed"): <path>/test/<module>.js is /<path>/<module>, and a general test
// (-child- or -sibling-) is sent by the file it judges, its argument. A file outside spirit/run keeps its bare name.
const SUITE = (function () {
  const run = path.join(__dirname, '..', '..');
  const runRel = function (f) {
    const r = path.relative(run, f);
    return r && r.indexOf('..') !== 0 && !path.isAbsolute(r) ? r.split(path.sep).join('/') : '';
  };
  const file = path.resolve(String(process.argv[1] || ''));
  const rel = runRel(file);
  if (!rel) return path.basename(file);
  const judged = String(process.argv[2] || '');
  if (/-(child|sibling)-/.test(path.basename(rel)) && judged && judged.indexOf('--') !== 0) {
    for (const p of [path.resolve(judged), path.join(run, judged), path.join(run, '..', '..', judged)]) {
      const r = runRel(p);
      if (r && require('fs').existsSync(p)) return '/' + r.replace(/\.js$/, '');
    }
  }
  const dir = path.posix.dirname(rel);
  const above = path.posix.basename(dir) === 'test' ? path.posix.dirname(dir) : dir;
  return '/' + (above === '.' ? '' : above + '/') + path.posix.basename(rel).replace(/\.js$/, '');
}());
const RECORD = 'deskVerify.record';

// Each result to the verifier, through the spirit object: its family by its name, then its record verb. Never waited
// on; what is still in the air when the test ends keeps the process up until it lands.
// A TEST THAT ENDS ITS OWN PROCESS WAITS FOR ITS RECORDS (goal/G41.19; found: the shell's general test failed at once and
// called process.exit, and its red never reached the verifier). While records are in the air, process.exit waits for
// them, at most RECORD_WAIT_MS, then exits with the code it was given.
const RECORD_WAIT_MS = 10000;
let family = null;
let inTheAir = 0;
let exitWith = null;
if (VERIFY_PORT) {
  const exitNow = process.exit.bind(process);
  process.exit = function (code) {
    if (!inTheAir) return exitNow(code);
    if (exitWith !== null) return;
    exitWith = { code: code, now: exitNow };
    setTimeout(function () { exitNow(code); }, RECORD_WAIT_MS);
  };
}
function landed() {
  inTheAir--;
  if (!inTheAir && exitWith) exitWith.now(exitWith.code);
}
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

  startTest: function (title) {
    this.counter++; this.successCount = this.failureCount = 0;
    console.log('\n' + STARS);
    titleLine('#' + this.counter + ' ' + title);
    console.log(STARS + '\n');
  },
  comment: function (text) {
    console.log(PAD_STARS + PAD_SPACES + text);
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
const RUN_ROOT = path.join(__dirname, '..', '..');
function runRel(f) {
  const r = path.relative(RUN_ROOT, f);
  return r && r.indexOf('..') !== 0 && !path.isAbsolute(r) ? r.split(path.sep).join('/') : '';
}
// The arguments this suite was run with: the file a general test judges, and --test <title>; --verify-port is the verifier's.
const ARGV = process.argv.slice(2);
const ONLY = ARGV.indexOf('--test') !== -1 ? String(ARGV[ARGV.indexOf('--test') + 1] || '') : null;
const PLAIN_ARGS = ARGV.filter(function (a, i) { return a.indexOf('--') !== 0 && ARGV[i - 1] !== '--test' && ARGV[i - 1] !== '--verify-port'; });
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
function reportToTesticle(rec) {
  try {
    const own = globalThis.spirit;
    const ownWindow = globalThis.window;
    globalThis.spirit = undefined;
    globalThis.window = undefined;
    let real = null;
    try { real = require(path.join(__dirname, '..', 'spirit.js')); } finally { globalThis.spirit = own !== undefined ? own : (real || undefined); globalThis.window = ownWindow; }
    testicle = testicle || real.require(real.familyPath('testicle'));
    reportsOut += 1;
    // TRIED AGAIN, UP TO THREE TIMES, A SECOND APART (goal/G47.1, wsl's verify: "the FIRST report of a suite process is
    // sometimes lost; every later one lands": the first goes out while spirit.js and the testicle family still load). The
    // same result sent twice moves no flip (testicle.set), so a try that landed after all does no harm.
    // A family that failed to load is asked for again on the next try.
    const once = function () {
      testicle = testicle || real.require(real.familyPath('testicle'));
      return Promise.resolve(testicle).then(function (f) { return f['testicle.set'](rec); }, function (e) { testicle = null; throw e; });
    };
    const wait = function () { return new Promise(function (r) { ownTimeout(r, 1000); }); };
    reportsLanded.push(once().catch(function () { return wait().then(once); }).catch(function () { return wait().then(once); })
      .catch(function () { /* a checkout with no node reports nowhere */ }).then(function () { reportsOut -= 1; }));
  } catch (e) { /* the lines are printed whatever the node says */ }
}

// THE REPORTER'S OWN TIMERS, kept as this file loads: a suite may replace the global setTimeout to speed its own waits
// (spirit/app/desk/test/deskLoop.js does), and a test's time limit must not shrink with it.
const ownTimeout = setTimeout;
const ownImmediate = setImmediate;
const queue = [];
const afters = [];
let started = false;
function start() { if (!started) { started = true; ownImmediate(runAll); } }
// THE TIME LIMITS, CENTRAL (Andy, 2026-11-11, after limits measured on one machine hung the tests on another: "cw, change
// the limits, i hope you have those as relatively central constants, GO!!"). Every suite gives a test one of these, never
// a number of its own (spirit-sibling-general.js (titleRules) judges it): quick for a test that asks and answers, slow for one that
// starts a scratch node, a desk or a Chrome page, long for one that runs a whole world end to end. A limit catches a hang,
// not a slow machine, so each is wide; change one here and every suite follows.
test.limit = Object.freeze({ quick: 10000, slow: 60000, long: 300000 });
// A TEST OF ANOTHER SCRIPT (goal/G47.1, box v94, 1: spirit/test/scriptClassify.js, given a list of scripts, reports each one's
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
test.run = function (title, severity, body, limitMs, opts) {
  const own = opts && typeof opts.script === 'string' && opts.script ? opts.script : forScript;
  queue.push({ title: title, severity: severity, body: body, limit: limitMs, script: own });
  start();
};
test.after = function (fn) { afters.push(fn); start(); };

// The test running now, so a throw or a rejection nothing caught lands on it.
let current = null;
function settle(t, verdict) { if (current === t && !t.done) { t.done = true; t.verdict = verdict; t.resolve(); } }
process.on('uncaughtException', function (e) { if (current) settle(current, { pass: false, crash: true, detail: 'it crashed: ' + (e && e.message || e) }); });
process.on('unhandledRejection', function (e) { if (current) settle(current, { pass: false, crash: true, detail: 'it crashed: ' + (e && e.message || e) }); });

function one(t) {
  return new Promise(function (resolve) {
    t.resolve = resolve;
    current = t;
    const timer = ownTimeout(function () { settle(t, { pass: false, crash: true, detail: 'it hung: no answer in ' + t.limit + ' ms' }); }, Number(t.limit) > 0 ? Number(t.limit) : 60000);
    let answered;
    try { answered = Promise.resolve(t.body()); } catch (e) { answered = Promise.reject(e); }
    answered.then(function (v) {
      if (v === true) settle(t, { pass: true });
      else settle(t, { pass: false, detail: typeof v === 'string' ? v : '' });
    }, function (e) { settle(t, { pass: false, crash: true, detail: 'it crashed: ' + (e && e.message || e) }); });
  }).then(function () { current = null; });
}

async function runAll() {
  test.startTest(SUITE_FILE);
  const seen = Object.create(null);
  const last = ONLY === null ? queue.length - 1 : queue.map(function (t) { return t.title; }).indexOf(ONLY);
  for (let i = 0; i <= last; i++) {
    const t = queue[i];
    const title = String(t.title);
    let sev = Number(t.severity);
    const script = t.script || SCRIPT;
    const once = script + '|' + title;
    if (seen[once]) { t.verdict = { pass: false, crash: true, detail: 'this title is said a second time in its suite' }; }
    else if (typeof t.severity !== 'number' || !(sev >= 0 && sev <= 1)) { t.verdict = { pass: false, crash: true, detail: 'its severity is no number from 0.0 to 1.0: ' + String(t.severity) }; }
    else if (typeof t.body !== 'function') { t.verdict = { pass: false, crash: true, detail: 'it has no body to run' }; }
    else await one(t);
    seen[once] = true;
    const v = t.verdict || { pass: false, detail: 'it gave no answer' };
    const severity = v.crash ? 0.7 : (sev >= 0 && sev <= 1 ? sev : 0.7);
    if (v.pass) { test.successCount++; test.comment('SUCCESS #' + test.counter + '.' + test.successCount + ': ' + title + ' ' + ICON.SUCCESS); }
    else { test.failureCount++; test.comment('FAILURE #' + test.counter + '.' + test.failureCount + ': ' + title + (v.detail ? ' — ' + v.detail : '') + ' ' + ICON.ERROR); }
    reportToTesticle({ script: script, suite: SUITE_FILE, test: title, verified: !!v.pass, severity: severity });
    if (VERIFY_PORT) recordTitled(title, v.pass ? 'green' : 'red', v.pass ? '' : title + (v.detail ? ' — ' + v.detail : ''));
  }
  for (const fn of afters) { try { await fn(); } catch (e) { test.comment('test.after threw: ' + (e && e.message || e)); } }
  test.reportSuccessFailureCount();
  await Promise.race([Promise.all(reportsLanded), new Promise(function (r) { ownTimeout(r, RECORD_WAIT_MS); })]);
  process.exit(test.failureCount > 0 ? 1 : 0);
}
// A test.run result to deskVerify, under its title, while Desk's Verify still reads them (see the head of this file).
function recordTitled(title, outcome, failure) {
  if (!VERIFY_PORT) return;
  const rec = { suite: SUITE, title: SUITE + ' ' + String(title), outcome: outcome };
  if (outcome === 'red' && failure) rec.failure = String(failure);
  try {
    const own = globalThis.spirit;
    const ownWindow = globalThis.window;
    globalThis.spirit = undefined;
    globalThis.window = undefined;
    let real = null;
    try { real = require(path.join(__dirname, '..', 'spirit.js')); } finally { globalThis.spirit = own !== undefined ? own : (real || undefined); globalThis.window = ownWindow; }
    family = family || real.require(real.familyPath(RECORD.split('.')[0]));
    inTheAir++;
    family.then(function (f) { return f[RECORD.split('.')[1]](rec); }).catch(function () { /* a record, not the verdict */ }).then(landed);
  } catch (e) { /* the lines are printed whatever the verifier says */ }
}

module.exports = test;
