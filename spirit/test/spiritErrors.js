'use strict';

// spirit/test/spiritErrors.js
// EVERY ERROR THE TREE CAN SAY, AND WHAT IT MEANS.
//
//   Andy: "now that we know most of failure states, wouldn't it be time to
//   centralize the meaning of errors of status codes... looks like we have
//   a missing fundamental...."
//
// ── THE DRIFT GUARD IS THE POINT ─────────────────────────────────────
//
// A catalogue that is complete today and silently incomplete next month is
// worse than none, because callers trust it. So this suite READS THE TREE:
// every error sentence the product emits — `status: N, error: '...'` and
// `fail(res, N, '...')` — must be in spiritErrors.js, with a status the
// catalogue agrees with. A new sentence anywhere turns this red until
// somebody decides what it means.
//
// That is the same shape as cycleRequirements.js and settableCensus.js:
// the rule is not remembered, it is counted.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const errs = require('../run/js/spiritErrors');

const JS = path.join(__dirname, '..', 'run', 'js');

test.startTest('spiritErrors — what an error means, in one place');

// ── 1. THE TREE AGAINST THE CATALOGUE ────────────────────────────────

test.subHeading('Every error sentence in the tree is catalogued');

{
  const found = [];
  fs.readdirSync(JS).filter(function (f) { return /\.js$/.test(f); }).forEach(function (f) {
    const src = fs.readFileSync(path.join(JS, f), 'utf8');
    // Both ways the tree emits an error: a result object and hub's fail().
    const patterns = [
      /status:\s*(\d{3}),\s*error:\s*'([^']+)'/g,
      /fail\(res,\s*(\d{3}),\s*'([^']+)'/g,
    ];
    patterns.forEach(function (re) {
      let m;
      while ((m = re.exec(src)) !== null) {
        found.push({ file: f, status: Number(m[1]), text: m[2] });
      }
    });
  });

  // Guard against the scan itself silently finding nothing — the failure
  // mode the R21 loop taught this tree to check for.
  if (found.length > 50) {
    test.check('the scan found ' + found.length + ' error sites across the tree');
  } else {
    test.fail('the scan found only ' + found.length + ' error sites — the patterns have gone stale');
  }

  const unknown = [];
  const wrongStatus = [];
  found.forEach(function (site) {
    const c = errs.classify(site.status, site.text);
    if (c.code === 'unknown') {
      unknown.push(site.file + ': ' + site.status + ' ' + JSON.stringify(site.text));
      return;
    }
    const allowed = [c.status].concat(c.alsoStatus || []);
    if (allowed.indexOf(site.status) === -1) {
      wrongStatus.push(site.file + ': "' + site.text + '" is ' + site.status +
        ' here, catalogued as ' + c.status);
    }
  });

  if (!unknown.length) {
    test.check('every one of them has a code — nothing the tree can say is uncatalogued');
  } else {
    test.fail('uncatalogued errors — add each to spiritErrors.js with its meaning:\n  ' +
      unknown.join('\n  '));
  }

  if (!wrongStatus.length) {
    test.check('and every one is emitted with a status the catalogue agrees with');
  } else {
    test.fail('status disagrees with the catalogue:\n  ' + wrongStatus.join('\n  '));
  }
}

// ── 2. PRESENCE, WHICH IS WHY THIS EXISTS ────────────────────────────

test.subHeading('A failure says what it says about presence, and no more');

{
  // THE CASE THAT STARTED IT. Deciding what a failed post does to a
  // presence dot turned out to depend on WHICH failure — a single rule
  // would have been wrong two times out of three.
  const busy = errs.classify(503, 'target is busy', { busy: true });
  const gone = errs.classify(503, 'peer not reachable');
  const late = errs.classify(503, 'no time left', { tooLittleTime: true });

  if (busy.presence === true) {
    test.check('a busy refusal says PRESENT — they are there, and occupied');
  } else {
    test.fail('busy: ' + JSON.stringify(busy));
  }
  if (gone.presence === false) {
    test.check('"peer not reachable" says ABSENT — the relay speaking about its own member');
  } else {
    test.fail('unreachable: ' + JSON.stringify(gone));
  }
  if (late.presence === null) {
    test.check('while running out of time says nothing about anybody');
  } else {
    test.fail('no-time-left: ' + JSON.stringify(late));
  }

  // THE SAME STATUS, THREE MEANINGS. This is the ambiguity the catalogue
  // exists to remove: all three arrived as 503.
  if (busy.status === 503 && gone.status === 503 && late.status === 503 &&
      busy.code !== gone.code && gone.code !== late.code) {
    test.check('and all three arrived as 503 — the status alone could never have told them apart');
  } else {
    test.fail('status/code: ' + [busy, gone, late].map(function (c) { return c.status + ' ' + c.code; }));
  }
}

test.subHeading('What nobody catalogued claims nothing');

{
  // THE RULE ABOVE ALL THE OTHERS. A sentence added next month must not be
  // able to paint somebody red by accident.
  const u = errs.classify(503, 'a sentence nobody has written yet');
  if (u.code === 'unknown' && u.presence === null && u.retry === 'no') {
    test.check('an uncatalogued error has no opinion about presence and invites no retry');
  } else {
    test.fail('unknown: ' + JSON.stringify(u));
  }
  if (u.status === 503 && u.text === 'a sentence nobody has written yet') {
    test.check('while carrying its status and sentence through, so nothing is lost');
  } else {
    test.fail('unknown lost its detail: ' + JSON.stringify(u));
  }
}

// ── 3. HOW classify DECIDES ──────────────────────────────────────────

test.subHeading('Markers first, then the sentence, then a prefix');

{
  // A MARKER WINS OVER THE SENTENCE, because markers were added exactly
  // where the sentence could not be trusted to disambiguate.
  const m = errs.classify(503, 'peer not reachable', { busy: true });
  if (m.code === 'target-busy') {
    test.check('a `busy` marker outranks whatever the sentence says');
  } else {
    test.fail('marker lost to text: ' + m.code);
  }

  // Sentences built at runtime are matched by their fixed beginning.
  const p1 = errs.classify(504, 'gave up after 3 attempt(s)');
  const p2 = errs.classify(504, 'no answer within the 900ms the relay granted');
  if (p1.code === 'gave-up' && p2.code === 'no-answer') {
    test.check('and a sentence built at runtime is matched by the part that does not change');
  } else {
    test.fail('prefixes: ' + p1.code + ', ' + p2.code);
  }

  // What peerPost resolves, straight in.
  const a = errs.classifyAnswer({ ok: false, status: 503, error: 'peer not reachable' });
  if (a && a.code === 'peer-unreachable' && errs.classifyAnswer({ ok: true }) === null) {
    test.check('classifyAnswer reads a post\'s own result, and a success is not an error');
  } else {
    test.fail('classifyAnswer: ' + JSON.stringify(a));
  }
}

// ── 4. THE INCONSISTENCY IT FOUND, KEPT HONEST ───────────────────────

test.subHeading('The one condition with two statuses is recorded, not hidden');

{
  // "no such peer" is 404 in seven places and 403 in two. The catalogue
  // records the second as `alsoStatus` rather than pretending one of them
  // is right. If somebody reconciles the tree, this check tells them to
  // remove the exception — so it cannot outlive the thing it excuses.
  const nsp = errs.byCode('no-such-peer');
  let seen403 = 0;
  fs.readdirSync(JS).filter(function (f) { return /\.js$/.test(f); }).forEach(function (f) {
    const src = fs.readFileSync(path.join(JS, f), 'utf8');
    seen403 += (src.match(/status:\s*403,\s*error:\s*'no such peer'/g) || []).length;
  });

  if (nsp && nsp.alsoStatus.indexOf(403) !== -1 && seen403 > 0) {
    test.check('"no such peer" is still emitted as 403 in ' + seen403 +
      ' place(s), and the catalogue says so');
  } else if (nsp && nsp.alsoStatus.indexOf(403) !== -1 && seen403 === 0) {
    test.fail('"no such peer" is no longer emitted as 403 — remove alsoStatus from spiritErrors.js');
  } else {
    test.fail('no-such-peer: ' + JSON.stringify(nsp));
  }
}

// ── 5. THE CATALOGUE AGAINST ITSELF ──────────────────────────────────

test.subHeading('No sentence means two things');

{
  const owner = Object.create(null);
  const clash = [];
  errs.all().forEach(function (e) {
    e.texts.forEach(function (t) {
      if (owner[t] && owner[t] !== e.code) clash.push('"' + t + '": ' + owner[t] + ' and ' + e.code);
      owner[t] = e.code;
    });
  });
  if (!clash.length) {
    test.check('every sentence belongs to exactly one code');
  } else {
    test.fail('sentences claimed twice:\n  ' + clash.join('\n  '));
  }

  const badField = errs.all().filter(function (e) {
    return [true, false, null].indexOf(e.presence) === -1 ||
      ['no', 'yes', 'after'].indexOf(e.retry) === -1 ||
      ['caller', 'target', 'relay', 'node'].indexOf(e.fault) === -1;
  });
  if (!badField.length) {
    test.check('and every entry says presence, retry and fault in the words the rest of the tree reads');
  } else {
    test.fail('malformed entries: ' + badField.map(function (e) { return e.code; }).join(', '));
  }
}

test.reportSuccessFailureCount();
