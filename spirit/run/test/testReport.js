'use strict';

// spirit/run/test/testReport.js
// THE PRODUCT TEST SYSTEM'S OWN REPORTER (goal/G40.13, box v22, point 1). Andy, 2026-10-26: "the new reporter prints the
// same lines as today. the verifier reads it unchanged.", "BUT, i want the product test system to be independent and
// not reach into repo:/spirit/test/ at all....".
//
// A product test requires this file and nothing of spirit/test/. It prints the lines the old reporter
// (spirit/test/testSupport.js) prints, the same marks in the same places, so the verifier and the old run-all read a
// product test as they read any suite: the heading lines, one SUCCESS or FAILURE line per assertion, and the completion
// line last, the exit code saying the same thing.
//
// WHEN THE VERIFIER STARTED THE RUN (--verify-port <port>), each result goes to the node's verifier as well, one record
// per assertion, through the one spirit object (the deskVerify family's record verb), never a fetch of its own. A test
// run by hand posts nothing. A result's key is its place: its sub-heading and its number under it, the same for its
// check and its fail, so a test that tips either way keeps its one key (goal/G27.14).
//
//   const test = require('<run>/test/testReport.js');
//   test.startTest(title); test.subHeading(title); test.check(words, detail?); test.fail(words, detail?);
//   test.comment(text); test.reportSuccessFailureCount();

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
const SUITE = path.basename(String(process.argv[1] || ''));
const RECORD = 'deskVerify.record';

// Each result to the verifier, through the spirit object: its family by its name, then its record verb. Never waited
// on; what is still in the air when the test ends keeps the process up until it lands.
let family = null;
function record(title, outcome, failure) {
  if (!VERIFY_PORT || !title) return;
  const rec = { suite: SUITE, title: String(title), outcome: outcome };
  if (outcome === 'red' && failure) rec.failure = String(failure);
  const name = RECORD.split('.')[0];
  const verb = RECORD.split('.')[1];
  try {
    // THE TEST'S OWN SPIRIT OBJECT STAYS THE GLOBAL (goal/G41.11; found: under the verifier the deskClient suite went 19
    // red: spirit.js, loaded here, writes itself onto the global object it finds, so it wrote over the stand-in the suite
    // runs on). The real one is loaded for the record alone, onto no object of the test's, and whatever the test had set
    // is put back.
    const own = globalThis.spirit;
    globalThis.spirit = undefined;
    let real = null;
    try { real = require(path.join(__dirname, '..', 'spirit.js')); } finally { globalThis.spirit = own; }
    family = family || real.require(real.familyPath(name));
    family.then(function (f) { return f[verb](rec); }).catch(function () { /* the records are a record, not the verdict */ });
  } catch (e) { /* a test whose verifier cannot be reached still reports on its lines */ }
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
  section: '',
  slot: 0,

  startTest: function (title) {
    this.counter++; this.successCount = this.failureCount = 0; this.section = String(title || ''); this.slot = 0;
    console.log('\n' + STARS);
    titleLine('#' + this.counter + ' ' + title);
    console.log(STARS + '\n');
  },
  subHeading: function (title) {
    this.section = String(title || ''); this.slot = 0;
    console.log('\n' + PAD_STARS);
    titleLine(title);
    console.log(PAD_STARS + '\n');
  },
  comment: function (text) {
    console.log(PAD_STARS + PAD_SPACES + text);
  },
  key: function () {
    this.slot = (this.slot || 0) + 1;
    return (this.section || 'untitled') + ' #' + this.slot;
  },
  check: function (str, detail) {
    this.successCount++;
    this.comment('SUCCESS #' + this.counter + '.' + this.successCount + ': ' + str + (detail ? ' — ' + detail : '') + ' ' + ICON.SUCCESS);
    record(this.key(), 'green');
  },
  fail: function (str, detail) {
    this.failureCount++;
    this.comment('FAILURE #' + this.counter + '.' + this.failureCount + ': ' + str + (detail ? ' — ' + detail : '') + ' ' + ICON.ERROR);
    record(this.key(), 'red', String(str) + (detail ? ' — ' + detail : ''));
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

module.exports = test;
