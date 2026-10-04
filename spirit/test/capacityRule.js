'use strict';

// goal/G4.19 issue 7: the capacity figure follows the rule. Red on today's tree; claude-windows wrote it, wsl-claude
// builds it. Andy, 2026-10-04, the box of goal/G4.19: "wouldn't we fix what really needs fixing, the capacity
// measurement, so it takes text field limits from fieldRules.js ?"; "what core grants are required to fix this
// properly?"; "fix it properly then." DECIDED there: "a member row's worst size is computed from fieldRules.js (label
// 64, description 128) plus its fixed parts, so the capacity figure follows the rule and never goes stale; the
// measured figure is checked against it, and that replaces capacityFresh's git check (which fired on a renamed
// require, G4.16). The two guards that trip on currentGoal.json (appClientName, runStandsAlone) skip that file. No
// core file: test code and README/CAPACITY only."
//
// THE SHAPES, NAMED HERE where the box names none (claude-windows's picks; the builder may argue them in Desk first):
//   1  spirit/test/memberRowWorst.js (test code, no core file) exports worstBytes(): the most a relay's member row
//      can cost on disc, computed from fieldRules (MAX_BYTES, DESCRIPTION_MAX_BYTES) read when it is called, plus
//      the row's fixed parts. Raising either rule by k raises it by k at least.
//   2  It is a true worst: member rows written into a real relayStore at the rule's maxima cost no more a row than
//      it says. "At the maxima" means the worst a rule lets through: the name and the description are made of `"`,
//      visible and allowed, which JSON escapes to two bytes inside the card.
//   3  Every published README/CAPACITY/*/capacity.json's perMemberRowBytes is at most worstBytes().
//   4  capacityFresh.js keeps no git check: no merge-base and no MOVERS list in its code; it runs with no failure.
//   5  appClientName.js and runStandsAlone.js name no failure in process/js/desk/currentGoal.json.
//
// LEFT OPEN, not asserted: whether README/CAPACITY.md prints the computed figure beside the measured one; how the
// fixed parts are found (a constant, or measured from an empty-field row at run time). FOUND WHILE WRITING, not in
// the decision: appClientName.js also trips on spirit/test/contactLabel.js, whose header quotes Andy on the apps'
// namespace under the old name. His words are not changed; how that guard treats a quote is his to say.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G4.19: ';
const ROOT = path.resolve(__dirname, '..', '..');
const WORST = path.join(__dirname, 'memberRowWorst.js');
const FRESH = path.join(__dirname, 'capacityFresh.js');
const rules = require('../run/js/fieldRules.js');
const relayStore = require('../run/js/relayStore');
const auth = require('../run/js/relayAuth');
const nodeCard = require('../run/js/nodeCard');

// The lines that are code: a whole-line // comment dropped (capacityFresh's header holds a /* inside a path).
function code(file) { return fs.readFileSync(file, 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'); }
function failuresOf(file) {
  const r = spawnSync(process.execPath, [file], { cwd: ROOT, encoding: 'utf8', timeout: 120000 });
  return String(r.stdout || '').split('\n').filter(function (l) { return /FAILURE/.test(l); });
}

test.startTest('goal/G4.19 issue 7: the capacity figure follows fieldRules.js');

test.subHeading('1. memberRowWorst.worstBytes() is computed from fieldRules');
let worst = null;
try { worst = require(WORST); } catch (e) { worst = null; }
const ready = !!(worst && typeof worst.worstBytes === 'function');
const base = ready ? Number(worst.worstBytes()) : NaN;
if (ready && base > 0) test.check('memberRowWorst.worstBytes() answers ' + base + ' bytes');
else test.fail(OWED + 'no spirit/test/memberRowWorst.js exporting worstBytes()');
if (ready) {
  const label0 = rules.MAX_BYTES;
  const desc0 = rules.DESCRIPTION_MAX_BYTES;
  let byLabel = NaN;
  let byDesc = NaN;
  try {
    rules.MAX_BYTES = label0 + 100; byLabel = Number(worst.worstBytes()) - base; rules.MAX_BYTES = label0;
    rules.DESCRIPTION_MAX_BYTES = desc0 + 100; byDesc = Number(worst.worstBytes()) - base; rules.DESCRIPTION_MAX_BYTES = desc0;
  } finally { rules.MAX_BYTES = label0; rules.DESCRIPTION_MAX_BYTES = desc0; }
  if (byLabel >= 100 && byDesc >= 100) test.check('100 bytes more on the label rule moves it ' + byLabel + ', on the description rule ' + byDesc);
  else test.fail(OWED + 'worstBytes() does not follow the rule: +100 on the label moved it ' + byLabel + ', on the description ' + byDesc);
} else test.fail(OWED + 'worstBytes() cannot be checked against the rule');

test.subHeading('2. rows at the rule\'s maxima cost no more than it says');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-caprule-'));
let perRow = NaN;
try {
  const store = relayStore.open(home);
  const file = path.join(home, 'relay-state', 'relay.db');
  const name = '"'.repeat(rules.MAX_BYTES);
  const id = auth.generateIdentity(name);
  id.name = name;
  id.description = '"'.repeat(rules.DESCRIPTION_MAX_BYTES);
  const card = nodeCard.cardFrom(id);
  const ok = rules.problem(name) === '' && rules.describeProblem(id.description) === '';
  const before = fs.statSync(file).size;
  const N = 2000;
  const K = 'MCowBQYDK2VwAyEA';
  store.transaction(function () {
    for (let i = 0; i < N; i += 1) {
      store.members.put({ publicKey: K + String(i).padStart(27, '0') + '=', publicLabel: name, claimedAt: new Date().toISOString(), card: card });
    }
  });
  perRow = Math.round((fs.statSync(file).size - before) / N);
  store.close();
  if (!ok) test.fail('the maxima this suite writes are not allowed by fieldRules, so they prove nothing');
} finally {
  try { fs.rmSync(home, { recursive: true, force: true }); } catch (e) { /* busy */ }
}
if (ready && perRow > 0 && perRow <= base) test.check('a row at the maxima measured ' + perRow + ' bytes, within the computed ' + base);
else test.fail(OWED + 'a row at the maxima measured ' + perRow + ' bytes against a computed worst of ' + base);

test.subHeading('3. every published figure is within the computed worst');
const DIR = path.join(ROOT, 'README', 'CAPACITY');
const published = fs.readdirSync(DIR).filter(function (n) { return fs.existsSync(path.join(DIR, n, 'capacity.json')); }).map(function (n) {
  return { name: n, bytes: Number(JSON.parse(fs.readFileSync(path.join(DIR, n, 'capacity.json'), 'utf8')).perMemberRowBytes) };
});
if (!published.length) test.fail('no capacity.json under README/CAPACITY, so nothing is compared');
else if (ready && published.every(function (p) { return p.bytes > 0 && p.bytes <= base; })) test.check('published ' + published.map(function (p) { return p.name + ' ' + p.bytes; }).join(', ') + ', each within ' + base);
else test.fail(OWED + 'published ' + published.map(function (p) { return p.name + ' ' + p.bytes; }).join(', ') + ' against a computed worst of ' + base);

test.subHeading('4. capacityFresh keeps no git check');
const freshCode = code(FRESH);
if (!/merge-base/.test(freshCode) && !/\bMOVERS\b/.test(freshCode)) test.check('capacityFresh.js has no merge-base and no MOVERS list');
else test.fail(OWED + 'capacityFresh.js still has ' + ['merge-base', 'MOVERS'].filter(function (w) { return freshCode.indexOf(w) !== -1; }).join(' and '));
const freshFails = failuresOf(FRESH);
if (!freshFails.length) test.check('capacityFresh.js runs with no failure');
else test.fail(OWED + 'capacityFresh.js fails: ' + freshFails.map(function (l) { return l.trim().slice(0, 160); }).join(' | '));

test.subHeading('5. the guards skip currentGoal.json');
['appClientName.js', 'runStandsAlone.js'].forEach(function (suite) {
  const hits = failuresOf(path.join(__dirname, suite)).filter(function (l) { return /currentGoal\.json/.test(l); });
  if (!hits.length) test.check(suite + ' names no failure in currentGoal.json');
  else test.fail(OWED + suite + ' still trips on currentGoal.json: ' + hits[0].trim().slice(0, 160));
});

test.reportSuccessFailureCount();
