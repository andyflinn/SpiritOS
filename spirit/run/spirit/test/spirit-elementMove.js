'use strict';

// spirit/run/spirit/test/spirit-elementMove.js
// THE ELEMENT MOVE (spec: ./spirit-elementMove.md; goal/G43.5). Andy, the box: "We are ONLY moving the contents of
// "run://shell/js/" to "run://spirit/element/"", "all elements will keep their name during this move.", "on the browsers,
// spirit object, these elements will live in "spirit.element" (SINGLULAR)", and "all UI code in the product tree that
// references the moved element files, must be changed to correct those references. both file-location AND the home in
// spirit.element (singular)": "uncluding tests", "including the contents of shell/ that remains", "including, new code in
// spirit/app". "shell/shared/ will not be moved or touched." The lists below are what shell/js held when the item began.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const RUN = path.resolve(__dirname, '../..');
const REPO = path.resolve(RUN, '../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const H = require(path.join(RUN, 'test', 'headLessChrome.js'));
const VENDORED_FOLDERS = require(path.join(RUN, 'spirit', 'fileSystem.js')).VENDORED_FOLDERS;

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600); }

// Every tracked file shell/js held, by its path under it.
const MOVED_FILES = [
  'apiFamilySelector.js', 'apiVerbSelector.js', 'appHeader/appHeader.js',
  'appHeader/test/appHeader-pinned.html', 'appHeader/test/appHeader.js', 'appHeader/test/appHeader.md',
  'appInstaller.js', 'appServerSelector.js', 'armingButton.js', 'branchEditor.js', 'branchSelector.js',
  'branchSelector/listElement.js', 'branchSelector/rowElement.js', 'branchSelector/test/listElement.js',
  'branchSelector/test/listElement.md', 'branchSelector/test/rowElement.js',
  'branchSelector/test/rowElement.md', 'bundleEditor.js', 'bundleSelector.js',
  'bundleSelector/listElement.js', 'bundleSelector/rowElement.js', 'bundleSelector/test/listElement.js',
  'bundleSelector/test/listElement.md', 'bundleSelector/test/rowElement.js',
  'bundleSelector/test/rowElement.md', 'busyButton.js', 'changeMyDescription.js', 'changeMyLabel.js',
  'codeMirror.js', 'contactDetails/contactDetails.js', 'contactDetails/test/contactDetails.js',
  'contactDetails/test/contactDetails.md', 'contactLabel.js', 'contactSelector.js',
  'contacts/listElement.js', 'contacts/rowElement.js', 'contacts/test/listElement.js',
  'contacts/test/listElement.md', 'contacts/test/rowElement.js', 'contacts/test/rowElement.md',
  'faceForm.js', 'fieldInput.js', 'fileViewer.js', 'files/listElement.js', 'files/rowElement.js',
  'files/test/listElement.js', 'files/test/listElement.md', 'files/test/rowElement-words.html',
  'files/test/rowElement.js', 'files/test/rowElement.md', 'grantSelector/listElement.js',
  'grantSelector/rowElement.js', 'grantSelector/test/listElement.js', 'grantSelector/test/listElement.md',
  'grantSelector/test/rowElement.js', 'grantSelector/test/rowElement.md', 'grantsPanel.js', 'icon.js',
  'iconSelector.js', 'icons/listElement.js', 'icons/rowElement.js', 'joinForm.js', 'joinSteps.js',
  'mediaViewer.js', 'probabilitySearch.js', 'progressBar.js', 'relayPanel.js', 'rowElement.js', 'rowForm.js',
  'tabContainer.js', 'test/apiFamilySelector.js', 'test/apiFamilySelector.md', 'test/apiVerbSelector.js',
  'test/apiVerbSelector.md', 'test/appInstaller.js', 'test/appInstaller.md', 'test/appServerSelector.js',
  'test/appServerSelector.md', 'test/armingButton.js', 'test/armingButton.md', 'test/branchEditor.js',
  'test/branchEditor.md', 'test/branchSelector.js', 'test/branchSelector.md', 'test/bundleEditor.js',
  'test/bundleEditor.md', 'test/bundleSelector.js', 'test/bundleSelector.md', 'test/busyButton-pressed.html',
  'test/busyButton.js', 'test/busyButton.md', 'test/changeMyDescription.js', 'test/changeMyDescription.md',
  'test/changeMyLabel.js', 'test/changeMyLabel.md', 'test/codeMirror.js', 'test/codeMirror.md',
  'test/contactLabel.js', 'test/contactLabel.md', 'test/contactSelector.js', 'test/contactSelector.md',
  'test/faceForm-laid.html', 'test/faceForm.js', 'test/faceForm.md', 'test/fileViewer.js',
  'test/fileViewer.md', 'test/grantsPanel.js', 'test/grantsPanel.md', 'test/icon-sized.html', 'test/icon.js',
  'test/icon.md', 'test/joinForm-laid.html', 'test/joinForm.js', 'test/joinForm.md',
  'test/probabilitySearch.js', 'test/probabilitySearch.md', 'test/probabilitySearchBubble-laid.html',
  'test/probabilitySearchBubble.js', 'test/probabilitySearchBubble.md', 'test/relayPanel.js',
  'test/relayPanel.md', 'test/relayRowStream.js', 'test/relayRowStream.md', 'test/rowElement.js',
  'test/rowElement.md', 'test/rowForm-laid.html', 'test/rowForm.js', 'test/rowForm.md',
  'test/tabContainer.js', 'test/tabContainer.md', 'test/textViewer.js', 'test/textViewer.md',
  'test/workBench-contained.html', 'test/workBench.js', 'test/workBench.md', 'textViewer.js', 'workBench.js',
];
// What each of those puts on the page, read from a real browser when the item began.
const MOVED_NAMES = [
  'apiFamilySelector', 'apiVerbSelector', 'appHeader', 'appInstaller', 'appServerSelector', 'armingButton',
  'branchEditor', 'branchElement', 'branchList', 'branchSelector', 'bundleEditor', 'bundleElement',
  'bundleList', 'bundleSelector', 'busyButton', 'changeMyDescription', 'changeMyLabel', 'codeMirror',
  'contactDetails', 'contactElement', 'contactLabel', 'contactList', 'contactSelector', 'faceForm',
  'fieldInput', 'fileElement', 'fileList', 'fileViewer', 'grantElement', 'grantList', 'grantsPanel', 'icon',
  'iconElement', 'iconList', 'iconSelector', 'joinForm', 'joinSteps', 'mediaViewer', 'probabilitySearch',
  'progressBar', 'relayPanel', 'rowElement', 'rowForm', 'tabContainer', 'textViewer', 'workBench',
];
// The modules among the files, each loaded on a real page below.
const MODULES = [
  'apiFamilySelector.js', 'apiVerbSelector.js', 'appHeader/appHeader.js', 'appInstaller.js',
  'appServerSelector.js', 'armingButton.js', 'branchEditor.js', 'branchSelector.js',
  'branchSelector/listElement.js', 'branchSelector/rowElement.js', 'bundleEditor.js', 'bundleSelector.js',
  'bundleSelector/listElement.js', 'bundleSelector/rowElement.js', 'busyButton.js', 'changeMyDescription.js',
  'changeMyLabel.js', 'codeMirror.js', 'contactDetails/contactDetails.js', 'contactLabel.js',
  'contactSelector.js', 'contacts/listElement.js', 'contacts/rowElement.js', 'faceForm.js', 'fieldInput.js',
  'fileViewer.js', 'files/listElement.js', 'files/rowElement.js', 'grantSelector/listElement.js',
  'grantSelector/rowElement.js', 'grantsPanel.js', 'icon.js', 'iconSelector.js', 'icons/listElement.js',
  'icons/rowElement.js', 'joinForm.js', 'joinSteps.js', 'mediaViewer.js', 'probabilitySearch.js',
  'progressBar.js', 'relayPanel.js', 'rowElement.js', 'rowForm.js', 'tabContainer.js', 'textViewer.js',
  'workBench.js',
];

const tracked = execSync('git ls-files', { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean);
const IN_RUN = tracked.filter(function (f) { return f.indexOf('spirit/run/') === 0; }).map(function (f) { return f.slice('spirit/run/'.length); });

// A line as it stands in the tree, his own words aside: a double-quoted part of a comment or of a document is a quote, and
// "Andy's words are never rewritten"; everything else counts, code in full.
function judged(file, line) {
  if (/\.(md|txt)$/.test(file)) return line.replace(/"[^"]*"/g, '""');
  const cut = line.search(/(^|[^:'"])\/\//);
  if (cut === -1) return line;
  return line.slice(0, cut + 1) + line.slice(cut + 1).replace(/"[^"]*"/g, '""');
}
// Not the product: what the desk writes, what is published, and this suite's own lists.
function out(file) {
  return /^(agents|design)\//.test(file) ||
    /spirit\/test\/spirit-elementMove\.(js|md)$|spirit\/element\/test\/codeMirror-library\.(js|md)$|shell\/shared\/js\/test\/deskRunStatus-home\.(js|md)$/.test(file) || VENDORED_FOLDERS.holds(file) || /(^|\/)brains\//.test(file) ||
    !/\.(js|json|html|md|css|txt)$/.test(file) || file.indexOf('spirit/') !== 0;
}
const OLD_PATH = /\bshell\/js\b|\bshell\/node_modules\b|['"]shell['"]\s*,\s*['"]js['"]/;
const NAMES = MOVED_NAMES.join('|');
const OLD_HOME = new RegExp('\\belements\\s*\\.\\s*(' + NAMES + ')\\b|\\belements\\s*\\[\\s*[\'"](' + NAMES + ')[\'"]');
const ALIAS = /\b([A-Za-z_]\w*)\s*=\s*[^;\n]*\.elements\b/;

test.startTest('spirit-elementMove.js: shell/js into spirit/element, its elements on spirit.element (goal/G43.5)');

(async function () {
  test.subHeading('the files: "We are ONLY moving the contents of "run://shell/js/" to "run://spirit/element/""');
  const left = IN_RUN.filter(function (f) { return f.indexOf('shell/js/') === 0; });
  ok(!left.length, 'shell/js holds no tracked file', left.length + ' tracked files are still in shell/js, the first: ' + short(left.slice(0, 5)));
  ok(!fs.existsSync(path.join(RUN, 'shell', 'js')), 'the folder shell/js is gone', 'the folder shell/js still stands');
  const missing = MOVED_FILES.filter(function (f) { return IN_RUN.indexOf('spirit/element/' + f) === -1; });
  ok(!missing.length, 'all ' + MOVED_FILES.length + ' files stand at spirit/element/, each under its own name and folder', missing.length + ' of ' + MOVED_FILES.length + ' are not at spirit/element/, the first: ' + short(missing.slice(0, 5)));

  // The library, CodeMirror inside spirit/element/codeMirror/, is that element's own folder: spirit/element/test/codeMirror-library.js.

  test.subHeading('the references: "both file-location AND the home in spirit.element (singular)", tests and documents too');
  const oldPath = []; const oldHome = [];
  tracked.filter(function (f) { return !out(f); }).forEach(function (f) {
    const full = path.join(REPO, f);
    if (!fs.existsSync(full)) return;
    const text = fs.readFileSync(full, 'utf8');
    const alias = ALIAS.exec(text);
    const viaAlias = alias ? new RegExp('\\b' + alias[1] + '\\s*\\.\\s*(' + NAMES + ')\\b') : null;
    text.split('\n').forEach(function (raw, i) {
      const line = judged(f, raw);
      if (OLD_PATH.test(line)) oldPath.push(f + ':' + (i + 1));
      if (OLD_HOME.test(line) || (viaAlias && viaAlias.test(line))) oldHome.push(f + ':' + (i + 1));
    });
  });
  ok(!oldPath.length, 'no code, test or document names shell/js', oldPath.length + ' lines name shell/js, the first: ' + short(oldPath.slice(0, 12)));
  ok(!oldHome.length, 'no code, test or document reaches a moved element through spirit.elements', oldHome.length + ' lines do, the first: ' + short(oldHome.slice(0, 12)));
  // THE OTHER WAY ROUND (found live: Andy, "contact detail don't load in contacts"): contactDetails reached navigation, which did
  // not move, through spirit.element, so the page threw when a contact was opened. Nothing names an element there unless spirit/element/ defines it.
  // What spirit/element/ defines today: what moved, and what has been added there since (goal/G43.6, valued).
  const DEFINED = new Set(MOVED_NAMES);
  IN_RUN.filter(function (f) { return /^spirit\/element\/.*\.js$/.test(f) && !/\/test\//.test(f) && f.indexOf('spirit/element/codeMirror/') !== 0; }).forEach(function (f) {
    const full = path.join(RUN, f);
    if (!fs.existsSync(full)) return;
    const re = /\b(?:E|element)\.([A-Za-z_]\w*)\s*=[^=]/g;
    const text = fs.readFileSync(full, 'utf8');
    let d = null;
    while ((d = re.exec(text))) DEFINED.add(d[1]);
  });
  const notMoved = [];
  tracked.filter(function (f) { return !out(f) && /\.(js|html)$/.test(f); }).forEach(function (f) {
    const full = path.join(REPO, f);
    if (!fs.existsSync(full)) return;
    fs.readFileSync(full, 'utf8').split('\n').forEach(function (raw, i) {
      const cut = raw.search(/(^|[^:'"])\/\//);
      const line = cut === -1 ? raw : raw.slice(0, cut + 1);
      const re = /\bspirit\.element\.([A-Za-z_]\w*)/g;
      let m = null;
      while ((m = re.exec(line))) { if (!DEFINED.has(m[1])) notMoved.push(f + ':' + (i + 1) + ' ' + m[1]); }
    });
  });
  ok(!notMoved.length, 'no code reaches through spirit.element for an element spirit/element/ does not define', notMoved.length + ' lines do: ' + short(notMoved.slice(0, 12)));

  test.subHeading('the page: "these elements will live in "spirit.element" (SINGLULAR) and not on spirit.elementS!!!!"');
  const chrome = H.findChrome();
  if (!chrome) { test.fail('no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name'); return; }
  const node = await H.scratchNode();
  let page = null;
  try {
    page = node.up ? await H.chromePage(chrome) : null;
    if (!page || page.error) { test.fail(page ? page.error : 'the scratch node did not come up'); return; }
    await page.send('Page.navigate', { url: node.base + '/index.html' });
    await H.until(function () { return page.evaluate('!!(window.spirit && window.spirit.ready)').then(Boolean); }, H.WAIT);
    await H.sleep(2500);
    let at = {};
    try { at = JSON.parse(await page.evaluate('JSON.stringify({ element: typeof window.spirit.element })')); } catch (e) { at = {}; }
    ok(at.element === 'object', 'the page has spirit.element when it starts', 'spirit.element is ' + short(at.element));
    const load = 'var fails = []; ' + JSON.stringify(MODULES.map(function (m) { return 'spirit/element/' + m; })) +
      '.reduce(function (p, f) { return p.then(function () { return Promise.resolve(window.spirit.require(f)).then(null, function (e) { fails.push(f + ": " + e); }); }); }, Promise.resolve())' +
      '.then(function () { return new Promise(function (r) { setTimeout(r, 1500); }); }).then(function () { var E = window.spirit.element || {}; var O = window.spirit.elements || {}; var N = ' + JSON.stringify(MOVED_NAMES) + ';' +
      ' return JSON.stringify({ fails: fails, absent: N.filter(function (n) { return !E[n]; }), onOld: N.filter(function (n) { return !!O[n]; }) }); })';
    let r = {};
    try { r = JSON.parse(await page.evaluate(load)); } catch (e) { r = { threw: String(e) }; }
    ok(Array.isArray(r.fails) && !r.fails.length, 'every moved module loads from its new place', 'loading: ' + short(r.threw || r.fails));
    ok(Array.isArray(r.absent) && !r.absent.length, 'all ' + MOVED_NAMES.length + ' elements stand on spirit.element under their names', 'not on spirit.element: ' + short(r.threw || r.absent));
    ok(Array.isArray(r.onOld) && !r.onOld.length, 'and none of them on spirit.elements', 'still on spirit.elements: ' + short(r.onOld));
    // The element drawing from spirit/element/codeMirror/ is spirit/element/test/codeMirror-library.js; deskRunStatus staying on
    // spirit.elements is shell/shared/js/test/deskRunStatus-home.js.
  } finally {
    if (page && page.kid) page.kid.kill();
    if (node.child) node.child.kill();
    try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(process.exitCode || 0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(1); });
