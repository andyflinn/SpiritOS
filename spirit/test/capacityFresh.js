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
// ── SINCE goal/G4.19: THE RULE, NOT GIT ──────────────────────────────
//
// This gate was a git check: a figure measured before the last commit to
// a list of files (relayStore, limits, seal, nodeCard, relayLimits) was
// stale. It fired on G4.16, a renamed require that moved nothing, and a
// gate that cries wolf is a gate nobody reads. Andy, 2026-10-04: "wouldn't
// we fix what really needs fixing, the capacity measurement, so it takes
// text field limits from fieldRules.js ?", then "fix it properly then."
// So a member row's worst size is computed from fieldRules
// (memberRowWorst.js), and a published perMemberRowBytes above it is the
// red: the README states a number the tree cannot produce.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const memberRowWorst = require('./memberRowWorst.js');

test.startTest('Published capacity figures are within the worst the rule allows');

const ROOT = path.resolve(__dirname, '..', '..');
const DIR = path.join(ROOT, 'README', 'CAPACITY');
const WORST = memberRowWorst.worstBytes();

{
  test.subHeading('Each platform\'s member row is within the worst computed from fieldRules (' + WORST + ' bytes)');

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
    const bytes = rec ? Number(rec.perMemberRowBytes) : NaN;
    if (!(bytes > 0)) {
      test.fail(name + ': capacity.json has no perMemberRowBytes, so it cannot be held to the rule');
    } else if (bytes > WORST) {
      test.fail(name + ': perMemberRowBytes=' + bytes + ' is more than the ' + WORST + ' bytes fieldRules allows a row — ' +
        'the schema grew past memberRowWorst.js: re-measure its fixed parts, then on that box:  node spirit/test/measurePlatform.js --as ' + name);
    } else {
      test.check(name + ': perMemberRowBytes=' + bytes + ', within the ' + WORST + ' the rule allows');
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
