'use strict';

// spirit/test/capacityFresh.js
// THE PUBLISHED NUMBERS MUST BE MEASURED AFTER THE THING THAT MOVES THEM.
//
//   Andy, 2026-09-23: "core improvements WILL move the numbers we document
//   in the README tree of the repo" — and, on why he wants them tracked at
//   all: "when software is hardened there can be marked reduction in speed,
//   increase of resource use etc... i want to track things like that. It's
//   all secure now is worth less when it reduces a relays capacity by a
//   factor of 5...."
//
// ── THE DRIFT THIS EXISTS FOR, MEASURED BEFORE IT WAS CAUGHT ─────────
//
// `README/CAPACITY/*/capacity.json` publishes `perMemberRowBytes = 197` on
// both platforms — Windows at `60e2610`, Ubuntu at `27374ee`. Cycle 10
// then added a signed card to every member row. Measured at `7f66806`:
// **575 bytes a member**, which is the published figure understated by
// 2.9x, and a relay's roll at a fixed disc limit cut by 58%:
//
//     lab     1 MB    4,302 members  ->  1,822
//     spirit  64 MB   275,361        ->  116,612
//
// Nothing was wrong with the measuring harness — `measurePlatform.js`
// already records the figure. What was missing is anything that NOTICES
// the schema moved underneath a published number. A figure nobody
// re-measures is a claim, and this repo does not publish claims.
//
// ── WHY THIS IS RED AND NOT YELLOW ───────────────────────────────────
//
// Yellow is work nobody has written yet. This is something that USED to
// hold and no longer does: the README states a number that the tree no
// longer produces. That is the definition of red, and it stays red until
// somebody re-measures — which is the pressure the gate exists to apply.
//
// It goes red on BOTH platforms at once and can only be cleared on each
// box by its own agent, which is the point: the Ubuntu figure is
// wsl-claude's to produce and the Windows figure is this side's.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const test = require('./testSupport.js');

test.startTest('Published capacity figures were measured after what moves them');

const ROOT = path.resolve(__dirname, '..', '..');
const DIR = path.join(ROOT, 'README', 'CAPACITY');

// THE FILES WHOSE CHANGES MOVE THESE NUMBERS, named rather than guessed.
// A new entry here is how a future cycle says "this moves capacity" — and
// leaving one out is the only way this gate can miss drift, so the list
// is short and every line says what it governs.
const MOVERS = [
  'spirit/run/js/relayStore.js',  // the schema: what a member, partner or route row costs
  'spirit/run/js/limits.js',      // the payload ceiling and the stream event cap
  'spirit/run/js/seal.js',        // wire inflation: sealing grows every body
  'spirit/run/js/nodeCard.js',    // the card is what sits on the member row
  'spirit/run/js/relayLimits.js', // the ceilings the figures are read against
];

function git(args) {
  return String(execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' })).trim();
}

let lastMove = '';
let movedBy = '';
try {
  // The most recent commit touching ANY mover. `--` keeps a path that
  // looks like a revision from being read as one.
  lastMove = git(['log', '-1', '--format=%H', '--'].concat(MOVERS));
  movedBy = lastMove ? git(['log', '-1', '--format=%h %ad %s', '--date=short', lastMove]) : '';
} catch (e) {
  lastMove = '';
}

if (!lastMove) {
  // NOT A PASS AND NOT A FAILURE. Without git history there is nothing to
  // compare against, and a gate that quietly succeeds when it cannot
  // check is worse than one that says so.
  test.fail('no git history available — capacity freshness cannot be checked here');
  test.reportSuccessFailureCount();
} else {

  test.subHeading('Each platform\'s figures are newer than the last change that moves them');

  let platforms = [];
  try {
    platforms = fs.readdirSync(DIR).filter(function (n) {
      return fs.existsSync(path.join(DIR, n, 'capacity.json'));
    }).sort();
  } catch (e) { platforms = []; }

  if (!platforms.length) {
    test.fail('no capacity.json found under README/CAPACITY — nothing is published to check');
  }

  platforms.forEach(function (name) {
    let rec = null;
    try { rec = JSON.parse(fs.readFileSync(path.join(DIR, name, 'capacity.json'), 'utf8')); }
    catch (e) { rec = null; }

    if (!rec || !rec.commit) {
      test.fail(name + ': capacity.json has no `commit`, so its age cannot be established');
      return;
    }

    // STALE means: the measurement's commit is an ANCESTOR of the last
    // change that moves the numbers. Ancestry rather than dates, because
    // a clock is not an ordering and a rebase moves dates.
    let stale = false;
    let known = true;
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', rec.commit, lastMove],
        { cwd: ROOT, stdio: 'ignore' });
      stale = true;
    } catch (e) {
      // Exit 1 is "not an ancestor" — fresh. Anything else means the
      // commit is not in this clone, which is not the same as fresh.
      stale = false;
      try { git(['cat-file', '-e', rec.commit + '^{commit}']); }
      catch (e2) { known = false; }
    }

    if (!known) {
      test.fail(name + ': measured at ' + String(rec.commit).slice(0, 8) +
        ', which is not a commit in this clone — the figure cannot be trusted or cleared');
      return;
    }

    if (stale) {
      test.fail(name + ': measured at ' + String(rec.commit).slice(0, 8) +
        ' (' + String(rec.measuredAt || '?').slice(0, 10) + '), ' +
        'perMemberRowBytes=' + rec.perMemberRowBytes + ' — but capacity moved since:\n' +
        '        ' + movedBy + '\n' +
        '        re-measure on that box:  node spirit/test/measurePlatform.js --as ' + name);
    } else {
      test.check(name + ': measured at ' + String(rec.commit).slice(0, 8) +
        ', newer than the last change that moves capacity');
    }
  });

  // ── TWO KINDS OF NUMBER, AND ONLY ONE MAY BE COMPARED ACROSS BOXES ──
  //
  //   Andy, 2026-09-26: "wsl complains because his measurements are on a
  //   noisy box. true. too bad, what we want to do is distinguish the
  //   flaky measurements from the computes ones"
  //
  // Until now every figure was treated alike, so a busy laptop read as a
  // regression and a real regression read as noise. `capacityKinds.js`
  // declares which figures depend on the box; this asserts the ones that
  // cannot.
  test.subHeading('Figures that cannot depend on the box are identical on every box');

  const kinds = require('./capacityKinds.js');
  const rows = [];
  platforms.forEach(function (name) {
    try { rows.push({ name: name, rec: JSON.parse(fs.readFileSync(path.join(DIR, name, 'capacity.json'), 'utf8')) }); }
    catch (e) { /* the staleness pass above already failed for this one */ }
  });

  // ── THE CONTROLS, AND THIS ASSERTION IS USELESS WITHOUT THEM ────────
  //
  // "every box-independent figure agrees" is TRUE OF AN EMPTY LIST and
  // TRUE OF A SINGLE PUBLISHED BOX. Either would make this pass for ever
  // while checking nothing, which is the shape that has cost this suite
  // family three separate afternoons.
  if (!kinds.SAME_ON_ANY_BOX.length) {
    test.fail('capacityKinds declares no box-independent figures, so the comparison below ' +
      'would pass while checking nothing');
  }
  if (rows.length < 2) {
    test.fail('only ' + rows.length + ' platform(s) published, so nothing can be compared across ' +
      'boxes — this assertion cannot mean anything until a second box publishes');
  }

  if (kinds.SAME_ON_ANY_BOX.length && rows.length >= 2) {
    const disagreed = [];
    kinds.SAME_ON_ANY_BOX.forEach(function (field) {
      const seen = rows.map(function (r) { return { name: r.name, v: r.rec[field] }; })
        .filter(function (x) { return x.v !== undefined; });
      if (seen.length < 2) return;
      const first = seen[0].v;
      const odd = seen.filter(function (x) { return x.v !== first; });
      if (odd.length) {
        disagreed.push(field + ': ' + seen.map(function (x) { return x.name + '=' + x.v; }).join(', '));
      }
    });
    if (!disagreed.length) {
      test.check('all ' + kinds.SAME_ON_ANY_BOX.length + ' box-independent figures agree across ' +
        rows.length + ' boxes — these are properties of the schema, so a disagreement would be a ' +
        'defect rather than weather');
    } else {
      test.fail('FIGURES THAT CANNOT DEPEND ON THE BOX DISAGREE ACROSS BOXES. Either a schema ' +
        'change landed on one box and not the other, or one of these is not box-independent and ' +
        'capacityKinds.js is wrong: ' + disagreed.join('; '));
    }

    // AND NOTHING BOX-DEPENDENT IS COMPARED. Said as a check rather than
    // left implicit, because the value of the split is the comparison
    // that STOPS: a laptop's RAM differing from a desktop's is not news.
    test.check('and the ' + kinds.MEASURED_ON_THIS_BOX.length + ' box-dependent figures are not ' +
      'compared across boxes at all — a busy box is no longer a regression');
  }

  // EVERY PUBLISHED FIELD IS CLASSIFIED, or the split silently stops
  // covering what it was built for.
  const unclassified = [];
  rows.forEach(function (r) {
    Object.keys(r.rec).forEach(function (k) {
      if (typeof r.rec[k] !== 'number') return;
      if (!kinds.kindOf(k) && unclassified.indexOf(k) === -1) unclassified.push(k);
    });
  });
  if (!unclassified.length) {
    test.check('and every numeric figure published is declared as one kind or the other');
  } else {
    test.fail('published numeric figures nobody has classified, so they are neither asserted nor ' +
      'excused: ' + unclassified.join(', ') + ' — add them to capacityKinds.js');
  }

  test.reportSuccessFailureCount();
}
