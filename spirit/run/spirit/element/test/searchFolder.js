'use strict';

// spirit/run/spirit/element/test/searchFolder.js
// The tests of goal/G43.18, the search elements of spirit/element/ renamed into spirit/element/search/ (spec: ./searchFolder.md).
// Andy, the box: "Every search element in spirit/element/ becomes spirit/element/search/<name>.js, with its companion folder
// spirit/element/search/<name>/ holding its list and row elements, the same pattern for all", and "renaming only". The tree read
// as it is: what is there, what is gone, and what the code names. That nothing else changed is the moved elements' own suites.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const E = path.join(RUN, 'spirit', 'element');
const SEARCH = path.join(E, 'search');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
function there(rel) { return fs.existsSync(path.join(RUN, rel)); }
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, ''); } catch (e) { return ''; } }
function filesUnder(dir) {
  const out = [];
  (function walk(d) { (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []).forEach(function (e) { if (e.name === 'node_modules' || e.name === 'relay-state' || e.name === 'state' || e.name === 'agents') return; const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else out.push(p); }); }(dir));
  return out;
}

// The list, with the remarks: each search element today, and where it goes.
const GONE = [
  'spirit/element/probabilitySearch.js',
  // "appServerSelector.js ... becomes search/api.js", "apiFamilySelector.js ... folds into search/api.js", "apiVerbSelector.js is the
  // verb dropdown filter: search/api/verb.js"
  'spirit/element/appServerSelector.js', 'spirit/element/apiFamilySelector.js', 'spirit/element/apiVerbSelector.js',
  'spirit/element/contactSelector.js', 'spirit/element/contact',
  'spirit/element/files',
  'spirit/element/iconSelector.js', 'spirit/element/icons',
  'spirit/element/bundleSelector.js', 'spirit/element/bundleSelector',
  'spirit/element/branchSelector.js', 'spirit/element/branchSelector',
  'spirit/element/grantSelector',
  'spirit/element/valued.js',
  // app: its list and row, today in spirit/app/appSelector/.
  'spirit/app/appSelector/listElement.js', 'spirit/app/appSelector/rowElement.js',
];
const THERE = [
  'spirit/element/search.js',
  'spirit/element/search/api.js', 'spirit/element/search/api/verb.js',
  'spirit/element/search/app.js', 'spirit/element/search/app/rowElement.js',
  'spirit/element/search/contact.js', 'spirit/element/search/contact/listElement.js', 'spirit/element/search/contact/rowElement.js',
  // "files/ and grantSelector/ ...: their listElement becomes search/file.js and search/grant.js, their rowElement stays in the folder."
  'spirit/element/search/file.js', 'spirit/element/search/file/rowElement.js',
  'spirit/element/search/icon.js', 'spirit/element/search/icon/listElement.js', 'spirit/element/search/icon/rowElement.js',
  'spirit/element/search/bundle.js', 'spirit/element/search/bundle/listElement.js', 'spirit/element/search/bundle/rowElement.js',
  'spirit/element/search/branch.js', 'spirit/element/search/branch/listElement.js', 'spirit/element/search/branch/rowElement.js',
  'spirit/element/search/grant.js', 'spirit/element/search/grant/rowElement.js',
  'spirit/element/search/valued.js',
];
// An old path as code names it: the module path a require or a script tag carries.
const OLD = GONE.map(function (p) { return p.replace(/\.js$/, ''); });

test.startTest('searchFolder.js: the search elements in spirit/element/search/ (goal/G43.18)');

test.subHeading('the box: "spirit/element/probabilitySearch.js becomes spirit/element/search.js", and every one of the list after it');
const missing = THERE.filter(function (p) { return !there(p); });
ok(!missing.length, 'all ' + THERE.length + ' are there: search.js, and api, app, contact, file, icon, bundle, branch, grant and valued under search/', 'missing ' + missing.length + ': ' + short(missing));
THERE.forEach(function (p) { ok(there(p), p + ' is there', 'no ' + p); });

test.subHeading('the old names go');
GONE.forEach(function (p) { ok(!there(p), p + ' is gone', p + ' is still there'); });

test.subHeading('the box: "the same pattern for all": under search/ a <name>.js and its <name>/ folder, each name a word');
const top = fs.existsSync(SEARCH) ? fs.readdirSync(SEARCH, { withFileTypes: true }).filter(function (d) { return d.name !== 'test'; }) : [];
const odd = top.filter(function (d) { return d.isDirectory() ? !/^[a-z]+$/.test(d.name) || !fs.existsSync(path.join(SEARCH, d.name + '.js')) : !/^[a-z]+\.js$/.test(d.name); }).map(function (d) { return d.name; });
ok(top.length > 0 && !odd.length, 'every name under search/ is a word, and every folder sits beside its <name>.js', top.length ? 'off the pattern: ' + short(odd) : 'no spirit/element/search/');

test.subHeading('the box: "The apps and elements that require them name the new paths"');
const own = path.resolve(__filename);
const scripts = filesUnder(RUN).concat(filesUnder(path.join(REPO, 'spirit', 'test')))
  .filter(function (f) { return /\.(js|html|css)$/.test(f) && path.resolve(f) !== own; });
const naming = [];
scripts.forEach(function (f) {
  const c = code(f);
  OLD.forEach(function (o) { if (new RegExp(o.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '(?![A-Za-z])').test(c)) naming.push(path.relative(REPO, f) + ': ' + o); });
});
ok(scripts.length > 100 && !naming.length, 'no code names an old path, in ' + scripts.length + ' scripts and their tests', naming.length + ' still name one, the first: ' + short(naming.slice(0, 8)));
// "apiVerbSelector.js is the verb dropdown filter: search/api/verb.js, which branch names too."
const verbUsers = ['spirit/element/search/api.js', 'spirit/element/search/branch.js', 'spirit/element/search/branch/listElement.js']
  .filter(function (p) { return /spirit\/element\/search\/api\/verb\.js/.test(code(path.join(RUN, p))); });
ok(verbUsers.indexOf('spirit/element/search/api.js') !== -1 && verbUsers.some(function (p) { return /branch/.test(p); }), 'api and branch both load the one verb filter, search/api/verb.js', 'loading it: ' + short(verbUsers));

test.reportSuccessFailureCount();
