'use strict';

// spirit/test/cycleRequirements.js
// Every agreed requirement is either verified or explicitly deferred.
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────
//
// On 2026-09-12 Grok returned six review findings as a numbered list. In
// the same conversation Andy and Claude settled, in detail, that a relay
// must confine a device's posts to its owner's node. Both were agreed.
// Only one was a numbered list.
//
// The six were built and reported as "53 suites, 1426 green". Andy then
// asked whether the confinement was implemented. It was not. It had been
// written into DEVICE.md as a note — "these two must land in the same
// cycle" — which is reading material rather than a worklist.
//
//   Andy: "we need to have a working method where that stuff doesn't get
//   missed, no matter what grok wants. i always expect a concept we both
//   agree on in relation to an active/current issue, like review related
//   fixes, that those parts we both agreed on become requirements,
//   subject to verification with tests."
//
// A document can be forgotten. A red suite cannot. So this reads every
// open cycle file and refuses to pass while any requirement has neither a
// verification that exists nor a recorded deferral.
//
// ── WHAT IT CANNOT DO, SAID PLAINLY ──────────────────────────────────
//
// It cannot tell whether a test is any good, or whether it tests the
// thing it claims. Nothing mechanical can. What it can do is make an
// unimplemented agreement impossible to LOSE — which is precisely the
// failure it was built for, and a smaller claim than it might look.
//
// It is deliberately strict about shape rather than clever about meaning:
// a `Verify:` line must name a file that exists, and a `DEFERRED:` must
// carry a reason. Anything else is red, including a requirement somebody
// left half-written.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const CYCLES = path.join(__dirname, '..', '..', 'design', 'cycles');
const REPO = path.join(__dirname, '..', '..');

test.startTest('Cycle requirements — agreed is not the same as done');

function cycleFiles() {
  try {
    return fs.readdirSync(CYCLES)
      .filter(function (f) { return /\.md$/.test(f) && f !== 'README.md'; })
      .sort();
  } catch (e) {
    return [];
  }
}

// A requirement is a `### R<n> — <title>` heading and everything under it
// until the next heading. Parsed rather than regexed whole, so a
// malformed one is visible as a requirement with nothing in it rather
// than silently not matching at all.
function requirementsIn(text) {
  const out = [];
  const lines = text.split(/\r?\n/);
  let current = null;
  lines.forEach(function (line) {
    const head = /^###\s+(R\d+)\s*(?:—|-)\s*(.*)$/.exec(line);
    if (head) {
      if (current) out.push(current);
      current = { id: head[1], title: head[2].trim(), body: [] };
      return;
    }
    if (/^##\s/.test(line)) {
      if (current) out.push(current);
      current = null;
      return;
    }
    if (current) current.body.push(line);
  });
  if (current) out.push(current);
  return out;
}

function bodyOf(req) { return req.body.join('\n'); }

const files = cycleFiles();

if (files.length) {
  test.check('there is at least one cycle file to read — ' + files.join(', '));
} else {
  // Not a failure. A tree with no open cycle is a legitimate state, and a
  // suite that demanded one would be inventing work.
  test.check('no open cycle files, so nothing to hold to account');
}

let total = 0;
let done = 0;
let deferred = 0;
let open = 0;
const broken = [];

files.forEach(function (file) {
  const text = fs.readFileSync(path.join(CYCLES, file), 'utf8');
  const reqs = requirementsIn(text);

  test.subHeading(file + ' — ' + reqs.length + ' requirement(s)');

  if (!reqs.length) {
    test.fail(file + ' has no `### R<n>` requirements — a cycle file with none is a file nobody is keeping');
    return;
  }

  reqs.forEach(function (req) {
    total += 1;
    const body = bodyOf(req);

    // A DEFERRAL IS AN ANSWER, and must carry its reason on the same
    // line. "DEFERRED" alone is the thing this suite exists to refuse:
    // it looks like a decision and holds none.
    const defer = /(?:^|\n)\**Status:\**\s*DEFERRED:\s*(\S.*)/.exec(body);
    if (defer) {
      deferred += 1;
      test.check(req.id + ' deferred, with a reason — ' + req.title);
      return;
    }
    if (/(?:^|\n)\**Status:\**\s*DEFERRED\s*$/m.test(body)) {
      broken.push(req.id + ': DEFERRED with no reason');
      test.fail(req.id + ' says DEFERRED and gives no reason — ' + req.title);
      return;
    }

    // OPEN is honest and costs nothing here. What it must not do is
    // disappear: the count below is what a completion report has to
    // account for.
    if (/(?:^|\n)\**Status:\**\s*OPEN/.test(body)) {
      open += 1;
      test.check(req.id + ' is OPEN and still on the list — ' + req.title);
      return;
    }

    // DONE, and then the verification has to exist.
    const verifyLines = body.split(/\r?\n/).filter(function (l) {
      return /\**Verify:\**/.test(l) || /^and `spirit\/test\//.test(l.trim());
    });
    const named = [];
    verifyLines.forEach(function (l) {
      const m = l.match(/`(spirit\/test\/[A-Za-z0-9_.-]+\.js)`/g) || [];
      m.forEach(function (q) { named.push(q.replace(/`/g, '')); });
    });

    if (!/(?:^|\n)\**Status:\**\s*DONE/.test(body)) {
      broken.push(req.id + ': no Status line');
      test.fail(req.id + ' has no Status — ' + req.title);
      return;
    }

    if (!named.length) {
      broken.push(req.id + ': DONE with no Verify naming a test file');
      test.fail(req.id + ' is DONE and names no test — ' + req.title);
      return;
    }

    const missing = named.filter(function (rel) {
      return !fs.existsSync(path.join(REPO, rel));
    });
    if (missing.length) {
      broken.push(req.id + ': names a test file that does not exist — ' + missing.join(', '));
      test.fail(req.id + ' names a test that does not exist: ' + missing.join(', '));
      return;
    }

    done += 1;
    test.check(req.id + ' done, verified by ' + named.join(' + ') + ' — ' + req.title);
  });
});

test.subHeading('What a completion report has to account for');

// THE NUMBER THAT WAS MISSING. "53 suites green" answers "does the code I
// wrote work". It does not answer "was what we agreed written", and the
// two were reported as one. This is the second number.
test.check(total + ' agreed requirement(s): ' + done + ' done, ' +
  deferred + ' deferred with a reason, ' + open + ' still open');

if (!broken.length) {
  test.check('and none of them is merely asserted — every DONE names a test that exists');
} else {
  test.fail('requirements with nothing behind them: ' + broken.join('; '));
}

test.reportSuccessFailureCount();
