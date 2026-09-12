'use strict';

// spirit/test/runStandsAlone.js
// THE PRODUCT MUST WORK WITH THE TEST FOLDER DELETED.
//
//   Andy: "Are we agreed that node and relay must be fully operational,
//   even if the test folder was completely deleted?"
//
// The dependency runs one way only. `spirit/test/` reaches into
// `spirit/run/` freely — that is what every suite in this directory does.
// Nothing under `spirit/run/` may reach back.
//
// ── WHY A CHECK AND NOT A NOTE ───────────────────────────────────────
//
// It was already true in code when this was written. The only violation
// in the tree was a STRING: relayLabPing.json's description read
// "Requires the three temp nodes from spirit/test (relay :65430, andy
// :65431)" — a manifest, so it was a button in the Processes app that
// could not work, and the sentence a user read was the one place the
// product declared a dependency on the harness.
//
// That is the shape this guards against, and it is why the rule needs a
// suite rather than a paragraph: a single `require('../../test/…')`
// added in haste would break nothing, fail nothing, and ship.
//
// ── FALSE NEGATIVES ONLY ─────────────────────────────────────────────
//
// Comments are excepted — a comment may cite a suite as the place a rule
// is proven, and several do. Stripping them is approximate: a `//` inside
// a string (`http://…`) truncates that line early, so a real reference
// AFTER one on the same line would be missed.
//
// That is the safe direction and it is chosen on purpose (ROUTER.md §4):
// this suite may fail to notice a violation, and must never invent one.
// A test that cries wolf about `https://` gets deleted by the third
// person who trips over it, and then the rule has nothing at all.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const RUN_DIR = path.join(__dirname, '..', 'run');

test.startTest('run/ stands alone — the product does not need the harness');

// node_modules is somebody else's code, vendored under a process script.
// It is not ours to hold to this rule and scanning it would only find
// other people's test fixtures.
const SKIP_DIRS = ['node_modules'];

function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.indexOf(entry.name) !== -1) return;
      walk(path.join(dir, entry.name), out);
      return;
    }
    if (/\.(js|json|html)$/.test(entry.name)) out.push(path.join(dir, entry.name));
  });
  return out;
}

// Rough, and deliberately so — see the header. Block comments first, then
// line comments, so a `//` inside a /* */ does not confuse the second pass.
function withoutComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ');
}

// Every way a file could name the harness. Separate patterns rather than
// one clever alternation, so a failure says WHICH shape was found.
const FORBIDDEN = [
  { what: 'the path spirit/test', re: /spirit[\\/]test/ },
  { what: "a require or read of ../test/", re: /\.\.[\\/]test[\\/]/ },
  { what: 'the labMaster control plane', re: /labMaster/ },
  { what: 'labPopulate or labWorld', re: /lab(Populate|World)/ },
];

// ONE EXEMPTION, and it is named rather than pattern-matched.
//
// buildStamp asks git what changed, and excludes the test folder from
// that question with the pathspec ':!spirit/test' — so it NAMES the
// directory in order to ignore it. Deleting spirit/test does not break
// it: git is perfectly happy excluding a path that is not there.
//
// Listed as an exact file so that a second file cannot quietly inherit
// the exemption by adopting the same string.
const EXEMPT = { 'js/buildStamp.js': ':!spirit/test' };

const files = walk(RUN_DIR, []);

test.subHeading('Scanned ' + files.length + ' file(s) under spirit/run/');

const offences = [];

files.forEach(function (full) {
  const rel = path.relative(RUN_DIR, full).split(path.sep).join('/');
  const raw = fs.readFileSync(full, 'utf8');

  // JSON has no comments, so a manifest is read whole — which is the
  // point: relayLabPing's violation lived in a description string, not
  // in code.
  const body = /\.json$/.test(rel) ? raw : withoutComments(raw);

  FORBIDDEN.forEach(function (rule) {
    if (!rule.re.test(body)) return;
    if (EXEMPT[rel] && body.indexOf(EXEMPT[rel]) !== -1) {
      // The exempt string is present; make sure it is the ONLY match, so
      // the exemption cannot cover a second, real reference in the same
      // file.
      const withoutExempt = body.split(EXEMPT[rel]).join(' ');
      if (!rule.re.test(withoutExempt)) return;
    }
    const line = body.split(/\r?\n/).filter(function (l) { return rule.re.test(l); })[0] || '';
    offences.push(rel + ' — ' + rule.what + ': ' + line.trim().slice(0, 120));
  });
});

if (!offences.length) {
  test.check('nothing under spirit/run/ names the harness, in code or in a manifest string');
} else {
  offences.forEach(function (o) { test.fail(o); });
}

// The exemption is asserted rather than assumed. If buildStamp stops
// using that pathspec, this suite should stop carrying an exception for
// it — an exemption nobody needs is a hole nobody is watching.
(function theExemptionIsStillEarned() {
  const rel = 'js/buildStamp.js';
  let src = '';
  try { src = fs.readFileSync(path.join(RUN_DIR, rel), 'utf8'); }
  catch (e) { src = ''; }
  if (src.indexOf(EXEMPT[rel]) !== -1) {
    test.check("buildStamp still needs its ':!spirit/test' pathspec, so the one exemption is still earned");
  } else {
    test.fail('buildStamp no longer uses ' + EXEMPT[rel] + ' — remove the exemption from this suite');
  }
})();

// AND THE SUITE CAN ACTUALLY FAIL. Every check above passes against a
// scanner that matches nothing at all — a broken regex, a walk that
// returned no files, a comment-stripper that ate the whole file. This
// feeds it the exact string relayLabPing.json carried and insists it is
// caught.
(function theScannerIsNotAsleep() {
  const planted = 'Requires the three temp nodes from spirit/test (relay :65430)';
  const caught = FORBIDDEN.some(function (rule) { return rule.re.test(planted); });
  if (caught && files.length > 20) {
    test.check('and the scanner catches the sentence that was actually in the tree, across ' + files.length + ' real files');
  } else {
    test.fail('the scanner did not catch a known violation (caught=' + caught + ', files=' + files.length + ')');
  }
})();

test.reportSuccessFailureCount();
