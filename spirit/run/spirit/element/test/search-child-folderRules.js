'use strict';

// spirit/run/spirit/element/test/search-child-folderRules.js [file]
// EVERY SEARCH, THE SAME SHAPE (goal/G43.32; spec: ./search-child-folderRules.md). Andy: "cw, we certainly want, in this
// item, uniformity, in the search elements and their folders, contain list, row an detail elements.", "all the others
// should adhere to the directory structure, as implied by MANY design decisions.", and of valued: "values doesn't count",
// "no need to fix valued in this item, it's kind of deprecated already." A -child- general test beside
// spirit/element/search.js (../../test/TEST_SYSTEM.md): it judges search.js and search/ and below.
//
//   node spirit/element/test/search-child-folderRules.js spirit/element/search/contact.js     the search the file is of
//   node spirit/element/test/search-child-folderRules.js                                      every search
//
// Judged on disc, from the files and their code with comments left out. What each element places on a page is judged by
// spirit/test/spirit-sibling-generalRules.js.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

const ARGS = process.argv.slice(2).filter(function (a, i, all) { return a !== '--verify-port' && all[i - 1] !== '--verify-port'; });
function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
function code(rel) { let t = ''; try { t = fs.readFileSync(path.join(RUN, rel), 'utf8'); } catch (e) { return ''; } return t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); }
function isFile(rel) { try { return fs.statSync(path.join(RUN, rel)).isFile(); } catch (e) { return false; } }

const SEARCH = 'spirit/element/search';
// The one exempt (Andy: "values doesn't count").
const EXEMPT = ['valued'];
const TREE = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: RUN, encoding: 'utf8' })
  .split('\n').filter(Boolean).map(function (f) { return f.replace(/^spirit\/run\//, ''); }).filter(isFile);
// Every search: a .js in search/ itself, or a folder there holding scripts (a folder with no selector beside it is a
// search too, and red).
const NAMES = Array.from(new Set(TREE.map(function (f) {
  const m = new RegExp('^' + SEARCH + '/([^/]+?)(\\.js$|/(?!test/)[^/]+\\.js$)').exec(f);
  return m ? m[1] : '';
}).filter(function (n) { return n && n !== 'test' && EXEMPT.indexOf(n) === -1; }))).sort();
const asked = ARGS[0] ? String(ARGS[0]).replace(/\\/g, '/').replace(/^\.\//, '').replace(/^spirit\/run\//, '') : '';
const askedName = (new RegExp('^' + SEARCH + '/([^/.]+)').exec(asked) || [])[1] || '';
const TARGETS = askedName && EXEMPT.indexOf(askedName) === -1 && askedName !== 'test' ? NAMES.filter(function (n) { return n === askedName; }) : NAMES;

// An element: it places a create through installSpiritElement, by its own path.
function placesItself(rel) { const c = code(rel); return /\binstallSpiritElement\s*\(/.test(c) && /\bcreate\b/.test(c) && c.indexOf("'" + rel + "'") !== -1; }
const PARTS = ['listElement', 'rowElement', 'detailElement'];
// NO DETAIL WHERE NONE OPENS (Andy: "branch and icon: if no details are ever openened, there needs to be now detail panel.").
// suite: a suite row in testicle's file detail opens nothing (goal/G47.1, the UI cycle), so by the same words it has none.
const NO_DETAIL = ['branch', 'icon', 'suite'];

function rules(n) {
  const sel = SEARCH + '/' + n + '.js';
  const dir = SEARCH + '/' + n;
  test.subHeading(dir);
  ok(isFile(sel) && placesItself(sel), 'its selector is an element placed by its path', sel + ': ' + (isFile(sel) ? 'places no create by its path' : 'is not there'));
  PARTS.forEach(function (p) {
    const f = dir + '/' + p + '.js';
    if (p === 'detailElement' && NO_DETAIL.indexOf(n) !== -1) { ok(!isFile(f), 'it has no detail, since none is ever opened', f + ': stands, though no ' + n + ' row ever opens a detail'); return; }
    const placed = isFile(f) && placesItself(f);
    const placedWhy = f + ': ' + (isFile(f) ? 'places no create by its path' : 'is not there');
    if (p === 'listElement') ok(placed, 'its listElement is placed by its path', placedWhy);
    else if (p === 'rowElement') ok(placed, 'its rowElement is placed by its path', placedWhy);
    else if (p === 'detailElement') ok(placed, 'its detailElement is placed by its path', placedWhy);
  });
  // ONE LIST, SHARED BY POPUP AND LIST MODES (Andy: "all, any search-unit has ONE list shared by popup and list modes."): the
  // selector requires its listElement and draws it, and makes no list of its own: no probabilitySearch, no rows.
  const c = code(sel);
  ok(new RegExp("['\"]" + dir.replace(/\//g, '\\/') + "\\/listElement\\.js['\"]").test(c) && new RegExp('\\.search\\.' + n + '\\.listElement\\.create\\(').test(c),
    'its selector draws its own listElement.js', sel + ': it does not draw ' + dir + '/listElement.js');
  ok(!/\.element\.search\.create\(|createElement\(['"](button|tr|li)['"]\)/.test(c), 'and its selector makes no list of its own', sel + ': it makes a list of its own beside its listElement.js');
}

test.startTest('search-child-folderRules.js: every search, the same shape, judged on ' + (askedName ? SEARCH + '/' + askedName : 'every search') + ' (goal/G43.32)');
test.subHeading('the searches');
ok(NAMES.length >= 8, 'the world: eight or more searches, valued exempt', 'only ' + short(NAMES) + ': nothing to judge');
ok(NAMES.indexOf('job') !== -1, 'the job branch has its search, spirit/element/search/job.js', 'no search of the job branch: ' + SEARCH + '/job.js');
const astray = ['spirit/element/job.js', 'spirit/element/jobDetail.js'].filter(isFile);
ok(!astray.length, 'the job list and its detail no longer stand in spirit/element/', short(astray) + ' still stand');
TARGETS.forEach(rules);

// A LIST'S PANELS STAND IN ITS SEARCH (Andy: "wsl, can you generalize the concept: if a detail panel is used for a list it
// should reside in that lists search-system", "the contact list already knows the difference between contact types. so should
// the detail panel.", and "wsl, assert this in the tests, it means that grant and relay \"panels\" move to their spot in the
// search-element-tree."). Judged on every search, whatever file was asked.
test.subHeading('a list\'s panels stand in its search');
// Beside the searches, in spirit/element/ itself, no panel and no detail of a list: panel.js is the generic stack, no list's.
const loose = TREE.filter(function (f) { return /^spirit\/element\/[^/]+\.js$/.test(f) && /(Panel|Detail|Details)\.js$/.test(f); });
ok(!loose.length, 'no list\'s panel or detail stands beside the searches in spirit/element/', short(loose) + ' still stand in spirit/element/');
const GRANTS = SEARCH + '/grant/grantsPanel.js';
ok(isFile(GRANTS) && placesItself(GRANTS), 'the grants panel stands in the grant search, placed by its path', GRANTS + ': ' + (isFile(GRANTS) ? 'places no create by its path' : 'is not there'));
// One detail for every kind of contact: a relay's blocks are drawn by the contact detail, and the row opens nothing else.
const RELAY = SEARCH + '/contact/relayPanel.js';
ok(!isFile(RELAY), 'no second contact detail: the relay panel is gone into the contact detail', RELAY + ' still stands');
ok(!/relayPanel/.test(code(SEARCH + '/contact/rowElement.js')) && /contact\/detailElement\.js/.test(code(SEARCH + '/contact/rowElement.js')),
  'a contact row opens the contact detail alone, whatever the contact is', SEARCH + '/contact/rowElement.js still opens relayPanel, or not the contact detail');
test.reportSuccessFailureCount();
