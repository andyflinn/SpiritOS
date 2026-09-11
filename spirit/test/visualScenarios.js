'use strict';

// spirit/test/visualScenarios.js
// The scenarios are readable, and they still mean something.
//
// THE SUITE EXPLORES. THE SCENARIO EXHIBITS. (Andy.) The fast tests run
// hundreds of worlds in milliseconds — every ordering, every refusal,
// every mutation. A visual scenario is ONE of those worlds, built in real
// processes so a person can look at it, and it has no business slowing
// the fast tests down or constraining what they reach.
//
// So this suite READS the scenarios and never builds one. Milliseconds,
// not the forty seconds a world costs. What it catches is rot: a
// scenario that references a suite which no longer exists, a peer on a
// relay nothing defines, a field the builder would silently ignore.
// Without it a scenario fails the next time somebody tries to LOOK at
// something — six weeks later, in the middle of debugging something else.
//
// It does not check that the world is worth looking at. Nothing can.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const DIR = path.join(__dirname, 'visual');
const SUITES = __dirname;

// The vocabulary lives in scenario.js, with the builders that read it.
// It was duplicated here, and a field list kept in two places is a field
// list that agrees with itself until the day it matters: a scenario would
// have passed this check and then been half-ignored by whichever builder
// had not been told about the new field.
const scenario = require('./scenario');

test.startTest('Visual scenarios — readable, and still true');

function run() {
  let files = [];
  try {
    files = fs.readdirSync(DIR).filter(function (f) { return /\.visual\.json$/.test(f); });
  } catch (e) { files = []; }

  if (files.length) {
    test.check(files.length + ' scenario(s) found: ' +
      files.map(function (f) { return f.replace('.visual.json', ''); }).join(', '));
  } else {
    test.fail('no scenarios in spirit/test/visual');
    test.reportSuccessFailureCount();
    return;
  }

  const scenarios = [];
  files.forEach(function (file) {
    let doc = null;
    try { doc = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8')); }
    catch (e) {
      test.fail(file + ' does not parse: ' + e.message);
      return;
    }
    scenarios.push({ file: file, doc: doc });
  });
  if (scenarios.length === files.length) {
    test.check('and every one of them parses');
  }

  test.subHeading('Each says what it is for');

  // A scenario whose purpose is not written down is one nobody dares
  // delete and nobody remembers to update. These are the demands that
  // apply because somebody is going to LOOK at it — a suite's own
  // scenario owes none of them, and scenario.js keeps the two apart.
  let unexplained = [];
  scenarios.forEach(function (s) {
    scenario.exhibitProblems(s.doc).forEach(function (why) {
      unexplained.push(s.file + ': ' + why);
    });
  });
  if (!unexplained.length) {
    test.check('each carries a title, a reason, what to look at, and peers to see');
  } else {
    unexplained.slice(0, 6).forEach(function (u) { test.fail(u); });
  }

  test.subHeading('Each is anchored to suites that actually exist');

  // THE anti-drift check. `covers` names the fast tests that explore the
  // same ground. A scenario exhibiting something no suite explores is a
  // gap in the suite rather than a feature of the scenario — and a
  // scenario pointing at a deleted suite is a scenario nobody has looked
  // at since the feature moved.
  let danglers = [];
  scenarios.forEach(function (s) {
    const covers = s.doc.covers || [];
    if (!covers.length) {
      danglers.push(s.file + ' covers nothing');
      return;
    }
    covers.forEach(function (name) {
      if (!fs.existsSync(path.join(SUITES, name))) {
        danglers.push(s.file + ' -> ' + name);
      }
    });
  });
  if (!danglers.length) {
    test.check('every `covers` entry names a suite that is still here');
  } else {
    test.fail('dangling: ' + danglers.join(', '));
  }

  test.subHeading('Each describes a world both builders can make');

  // Asked of the SAME validator the builders use, so a scenario cannot
  // pass here and then be half-understood by the thing that builds it.
  let problems = [];
  scenarios.forEach(function (s) {
    scenario.problems(s.doc).forEach(function (why) {
      problems.push(s.file + ': ' + why);
    });
  });

  if (!problems.length) {
    test.check('no unknown fields, no strangers, no relay nobody defined');
  } else {
    problems.slice(0, 6).forEach(function (p) { test.fail(p); });
  }

  // And the fast builder will actually make them. Checking the
  // description parses is not the same as checking a world comes out,
  // and this costs a few milliseconds because nothing here opens a
  // socket or spawns anything.
  let unbuildable = [];
  scenarios.forEach(function (s) {
    const made = require('./world').build(s.doc);
    if (!made.ok) unbuildable.push(s.file + ': ' + made.error);
  });
  if (!unbuildable.length) {
    test.check('and every one of them builds in process, in milliseconds');
  } else {
    unbuildable.forEach(function (u) { test.fail(u); });
  }

  test.subHeading('Between them they show every state worth seeing');

  // The reason presence-colours exists. A three-colour rule exhibited in
  // two colours is a rule nobody has actually looked at, and the state
  // that goes missing is always white — because producing it needs a
  // peer to LEAVE, which is an afterthought until it is a bug report.
  const anyStopped = scenarios.some(function (s) {
    return (s.doc.peers || []).some(function (p) { return p.running === false; });
  });
  const anyRemoval = scenarios.some(function (s) {
    return (s.doc.then || []).some(function (step) { return step.remove; });
  });
  if (anyStopped) {
    test.check('a peer whose node is DOWN — the only way red appears');
  } else {
    test.fail('no scenario stops a node, so red cannot be looked at');
  }
  if (anyRemoval) {
    test.check('and a peer who LEAVES a relay — the only way white appears');
  } else {
    test.fail('no scenario removes a peer, so white cannot be looked at');
  }

  test.reportSuccessFailureCount();
}

try { run(); }
catch (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
}
