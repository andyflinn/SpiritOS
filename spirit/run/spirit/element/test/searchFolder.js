'use strict';

// spirit/run/spirit/element/test/searchFolder.js
// The tests of goal/G43.18, the search elements of spirit/element/ renamed into spirit/element/search/ (spec: ./searchFolder.md).
// Andy, the box: "Every search element in spirit/element/ becomes spirit/element/search/<name>.js, with its companion folder
// spirit/element/search/<name>/ holding its list and row elements, the same pattern for all", and "renaming only". The tree read
// as it is: what is there, what is gone, and what the code names; and each one loaded on a page. That nothing else changed is the moved elements' own suites.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const VENDORED_FOLDERS = require(path.join(RUN, 'spirit', 'fileSystem.js')).VENDORED_FOLDERS;
const E = path.join(RUN, 'spirit', 'element');
const SEARCH = path.join(E, 'search');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
function there(rel) { return fs.existsSync(path.join(RUN, rel)); }
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, ''); } catch (e) { return ''; } }
function filesUnder(dir) {
  const out = [];
  (function walk(d) { (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []).forEach(function (e) { if (VENDORED_FOLDERS.holds(path.join(d, e.name)) || e.name === 'relay-state' || e.name === 'state' || e.name === 'agents') return; const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else out.push(p); }); }(dir));
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
  // Andy: "contactDetails.js should really be spirit/run/spirit/element/search/contact/detailElement.js"
  'spirit/element/contactDetails',
  // Andy: "spirit/run/spirit/element/relayPanel.js really should be  spirit/run/spirit/element/search/contact/relayPanel.js"
  'spirit/element/relayPanel.js',
  // app: its list and row, today in spirit/app/appSelector/.
  'spirit/app/appSelector/listElement.js', 'spirit/app/appSelector/rowElement.js',
];
const THERE = [
  'spirit/element/search.js',
  'spirit/element/search/api.js', 'spirit/element/search/api/verb.js',
  'spirit/element/search/app.js', 'spirit/element/search/app/rowElement.js',
  'spirit/element/search/contact.js', 'spirit/element/search/contact/listElement.js', 'spirit/element/search/contact/rowElement.js',
  'spirit/element/search/contact/detailElement.js', 'spirit/element/search/contact/relayPanel.js',
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

// "renaming only": what loaded before still loads. A real Chrome on a scratch node's face.html, each file required through
// spirit.require and answered within its time. Folding apiFamilySelector into search/api.js made it and search/api/verb.js
// require each other, and neither ever loaded: the agent's bundle opened no tab (Andy: "the bundles fail to pop into a tab,
// when i click on a bundle, no network activity, no console activity.").
(async function () {
  test.subHeading('the box: "renaming only": every one of them loads on a page');
  const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'test', 'headLessChrome.js'));
  const node = await scratchNode();
  const chrome = await chromePage(findChrome());
  try {
    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    for (const p of THERE) {
      const got = await chrome.evaluate('window.spirit.ready.then(function () { return Promise.race([window.spirit.require(' + JSON.stringify(p) + ').then(function () { return "loaded"; }, function (e) { return "refused: " + e; }), new Promise(function (r) { setTimeout(function () { r("never answered"); }, 8000); })]); })');
      ok(got === 'loaded', p + ' loads', p + ': ' + short(got));
    }
  } finally {
    if (chrome && chrome.kid) chrome.kid.kill();
    if (node.child) node.child.kill();
    try { if (chrome && chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(process.exitCode || 0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(1); });
