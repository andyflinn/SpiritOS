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

// EACH RULE ONE TEST, OVER EVERY SEARCH JUDGED (goal/G47.2): a title is steady, so no search's name is built into it; the
// searches that break a rule are named in what its test answers.
// What a rule finds wrong in search n, or '' when n keeps it.
function eachSearch(why) {
  if (!TARGETS.length) return 'no search to judge';
  const bad = TARGETS.map(why).filter(Boolean);
  return !bad.length || bad.join('; ');
}
const partWhy = function (f) { return f + ': ' + (isFile(f) ? 'places no create by its path' : 'is not there'); };

// The searches.
test.run('the world: eight or more searches, valued exempt', 0.2, function () {
  return NAMES.length >= 8 || 'only ' + short(NAMES) + ': nothing to judge';
}, 1000);
test.run('the job branch has its search, spirit/element/search/job.js', 0.4, function () {
  return NAMES.indexOf('job') !== -1 || 'no search of the job branch: ' + SEARCH + '/job.js';
}, 1000);
test.run('the job list and its detail no longer stand in spirit/element/', 0.4, function () {
  const astray = ['spirit/element/job.js', 'spirit/element/jobDetail.js'].filter(isFile);
  return !astray.length || short(astray) + ' still stand';
}, 1000);
// Each search: SEARCH/<n>.js, its selector, and SEARCH/<n>/ holding its listElement, rowElement and detailElement.
test.run('its selector is an element placed by its path', 0.4, function () {
  return eachSearch(function (n) { const sel = SEARCH + '/' + n + '.js'; return isFile(sel) && placesItself(sel) ? '' : partWhy(sel); });
}, 1000);
test.run('its listElement is placed by its path', 0.4, function () {
  return eachSearch(function (n) { const f = SEARCH + '/' + n + '/listElement.js'; return isFile(f) && placesItself(f) ? '' : partWhy(f); });
}, 1000);
test.run('its rowElement is placed by its path', 0.4, function () {
  return eachSearch(function (n) { const f = SEARCH + '/' + n + '/rowElement.js'; return isFile(f) && placesItself(f) ? '' : partWhy(f); });
}, 1000);
// Only where there is a search to judge by it: a detail where one opens, none where none does.
if (TARGETS.some(function (n) { return NO_DETAIL.indexOf(n) === -1; })) {
  test.run('its detailElement is placed by its path', 0.4, function () {
    return eachSearch(function (n) { const f = SEARCH + '/' + n + '/detailElement.js'; return NO_DETAIL.indexOf(n) !== -1 || (isFile(f) && placesItself(f)) ? '' : partWhy(f); });
  }, 1000);
}
if (TARGETS.some(function (n) { return NO_DETAIL.indexOf(n) !== -1; })) {
  test.run('it has no detail, since none is ever opened', 0.4, function () {
    return eachSearch(function (n) { const f = SEARCH + '/' + n + '/detailElement.js'; return NO_DETAIL.indexOf(n) === -1 || !isFile(f) ? '' : f + ': stands, though no ' + n + ' row ever opens a detail'; });
  }, 1000);
}
// ONE LIST, SHARED BY POPUP AND LIST MODES (Andy: "all, any search-unit has ONE list shared by popup and list modes."): the
// selector requires its listElement and draws it, and makes no list of its own: no probabilitySearch, no rows.
test.run('its selector draws its own listElement.js', 0.4, function () {
  return eachSearch(function (n) {
    const sel = SEARCH + '/' + n + '.js'; const dir = SEARCH + '/' + n; const c = code(sel);
    return new RegExp("['\"]" + dir.replace(/\//g, '\\/') + "\\/listElement\\.js['\"]").test(c) && new RegExp('\\.search\\.' + n + '\\.listElement\\.create\\(').test(c)
      ? '' : sel + ': it does not draw ' + dir + '/listElement.js';
  });
}, 1000);
test.run('and its selector makes no list of its own', 0.4, function () {
  return eachSearch(function (n) {
    const sel = SEARCH + '/' + n + '.js';
    return !/\.element\.search\.create\(|createElement\(['"](button|tr|li)['"]\)/.test(code(sel)) ? '' : sel + ': it makes a list of its own beside its listElement.js';
  });
}, 1000);

// A LIST'S PANELS STAND IN ITS SEARCH (Andy: "wsl, can you generalize the concept: if a detail panel is used for a list it
// should reside in that lists search-system", "the contact list already knows the difference between contact types. so should
// the detail panel.", and "wsl, assert this in the tests, it means that grant and relay \"panels\" move to their spot in the
// search-element-tree."). Judged on every search, whatever file was asked.
// Beside the searches, in spirit/element/ itself, no panel and no detail of a list: panel.js is the generic stack, no list's.
test.run('no list\'s panel or detail stands beside the searches in spirit/element/', 0.4, function () {
  const loose = TREE.filter(function (f) { return (/^spirit\/element\/[^/]+\.js$/).test(f) && (/(Panel|Detail|Details)\.js$/).test(f); });
  return !loose.length || short(loose) + ' still stand in spirit/element/';
}, 1000);
const GRANTS = SEARCH + '/grant/grantsPanel.js';
test.run('the grants panel stands in the grant search, placed by its path', 0.4, function () {
  return (isFile(GRANTS) && placesItself(GRANTS)) || partWhy(GRANTS);
}, 1000);
// One detail for every kind of contact: a relay's blocks are drawn by the contact detail, and the row opens nothing else.
const RELAY = SEARCH + '/contact/relayPanel.js';
test.run('no second contact detail: the relay panel is gone into the contact detail', 0.4, function () {
  return !isFile(RELAY) || RELAY + ' still stands';
}, 1000);
test.run('a contact row opens the contact detail alone, whatever the contact is', 0.4, function () {
  return (!/relayPanel/.test(code(SEARCH + '/contact/rowElement.js')) && /contact\/detailElement\.js/.test(code(SEARCH + '/contact/rowElement.js'))) ||
    SEARCH + '/contact/rowElement.js still opens relayPanel, or not the contact detail';
}, 1000);
