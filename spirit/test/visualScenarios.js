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

// The vocabulary the builder understands. A scenario using anything else
// would be quietly ignored, which is the failure mode this list exists to
// prevent — a field somebody added in good faith that never did anything.
const TOP = ['title', 'why', 'covers', 'look', 'peers', 'knows', 'messages', 'then'];
const PEER = ['name', 'on', 'running', 'expect'];
const THEN = ['remove', 'from', 'why'];
const RELAYS = ['lab', 'live'];

function unknown(obj, allowed) {
  return Object.keys(obj || {}).filter(function (k) { return allowed.indexOf(k) === -1; });
}

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
  // delete and nobody remembers to update.
  const unexplained = scenarios.filter(function (s) {
    return !s.doc.title || !s.doc.why || !Array.isArray(s.doc.look) || !s.doc.look.length;
  });
  if (!unexplained.length) {
    test.check('each carries a title, a reason, and what to look at');
  } else {
    test.fail('unexplained: ' + unexplained.map(function (s) { return s.file; }).join(', '));
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

  test.subHeading('Each describes a world the builder can make');

  let problems = [];
  scenarios.forEach(function (s) {
    const doc = s.doc;
    const where = s.file + ': ';

    unknown(doc, TOP).forEach(function (k) {
      problems.push(where + 'unknown field `' + k + '`');
    });

    const names = [];
    (doc.peers || []).forEach(function (p) {
      unknown(p, PEER).forEach(function (k) {
        problems.push(where + 'peer `' + p.name + '` has unknown field `' + k + '`');
      });
      if (!p.name) problems.push(where + 'a peer has no name');
      if (names.indexOf(p.name) !== -1) problems.push(where + 'two peers named ' + p.name);
      names.push(p.name);
      (p.on || []).forEach(function (r) {
        if (RELAYS.indexOf(r) === -1) problems.push(where + p.name + ' is on unknown relay `' + r + '`');
      });
      if (!(p.on || []).length) problems.push(where + p.name + ' is on no relay');
    });

    if (!names.length) problems.push(where + 'no peers');

    // Everyone referenced anywhere must be somebody the world contains.
    (doc.knows || []).forEach(function (pair) {
      (pair || []).forEach(function (n) {
        if (names.indexOf(n) === -1) problems.push(where + '`knows` names a stranger: ' + n);
      });
    });
    (doc.messages || []).forEach(function (m) {
      if (names.indexOf(m && m.from) === -1) {
        problems.push(where + '`messages` from a stranger: ' + (m && m.from));
      }
    });
    (doc.then || []).forEach(function (step) {
      unknown(step, THEN).forEach(function (k) {
        problems.push(where + '`then` step has unknown field `' + k + '`');
      });
      if (names.indexOf(step.remove) === -1) {
        problems.push(where + '`then` removes a stranger: ' + step.remove);
      }
      if (RELAYS.indexOf(step.from) === -1) {
        problems.push(where + '`then` removes from unknown relay `' + step.from + '`');
      }
    });
  });

  if (!problems.length) {
    test.check('no unknown fields, no strangers, no relay nobody defined');
  } else {
    problems.slice(0, 6).forEach(function (p) { test.fail(p); });
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
