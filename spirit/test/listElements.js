'use strict';

// spirit/test/listElements.js
// goal/G30.20: a Media Viewer app, and one folder per object type with its row, its drop-in list (pane or dropdown)
// and its translator. Red on today's tree; claude-windows writes it and builds it (one agent). The box (v6), in short:
//   - shell/js/files/ and shell/js/contacts/, each rowElement.js, listElement.js and data.js; shared in shell/js:
//     probabilitySearch.js (pane and dropdown), rowElement.js, spiritData.js (the tree, nothing type-specific).
//   - The list-tool takes face: 'pane' or 'dropdown' (a closed field opening to the same list).
//   - A Media Viewer app (shell/mediaViewer/): the files list as a dropdown filtered to what it plays, the mediaViewer
//     element under it. The intrinsic apps are mountable wrappers.
//   - The legacy file selector is deleted, its user (textEditor) moved; grants and introSpector move off the legacy
//     contact selector, which stays for chatter until chats are their own type.
// NAMED HERE: window.spirit.elements.fileList / contactList .create(host, { face, ... }); spirit.data.translate({ onJob,
// onRename }) registers a type's translator; a data.js registers one.
// rule/11: through testSupport only.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G30.20: ';
const RUN = path.join(__dirname, '..', 'run');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const raw = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8'); } catch (e) { return ''; } };
const code = function (rel) { return raw(rel).split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'); };
const exists = function (rel) { return fs.existsSync(path.join(RUN, rel)); };

test.startTest('goal/G30.20: one folder per type, lists as panes or dropdowns, a Media Viewer app');

test.subHeading('1. one folder per object type');
const typed = ['shell/js/files/rowElement.js', 'shell/js/files/listElement.js', 'shell/js/files/data.js',
  'shell/js/contacts/rowElement.js', 'shell/js/contacts/listElement.js', 'shell/js/contacts/data.js'];
const index = raw('index.html');
const missing = typed.filter(function (f) { return !exists(f) || index.indexOf('/' + f) === -1; });
if (!missing.length) test.check('files and contacts each have rowElement, listElement and data.js, loaded by index.html');
else test.fail(OWED + 'missing or not loaded: ' + missing.join(', '));
const gone = ['shell/js/rows/fileElement.js', 'shell/js/rows/contactElement.js', 'shell/js/contactSearch.js', 'shell/js/fileSelector.js'].filter(exists);
if (!gone.length && !/createFileSelector/.test(code('spirit/client/shell.js'))) test.check('the old places are gone: rows/, contactSearch.js, the file selector and its api entry');
else test.fail(OWED + 'still there: ' + gone.join(', ') + (/createFileSelector/.test(code('spirit/client/shell.js')) ? ', createFileSelector' : ''));
const sd = code('shell/js/spiritData.js');
if (sd && !/fs-watcher|relay-presence|peer-search/.test(sd) && /translate/.test(sd) && /fs-watcher/.test(code('shell/js/files/data.js')) && /relay-presence/.test(code('shell/js/contacts/data.js')))
  test.check('spirit.data is the tree only; each type\'s translator is its data.js');
else test.fail(OWED + 'spirit.data still translates types itself, or a data.js does not');

test.subHeading('2. the list-tool doubles as a dropdown');
const ps = code('shell/js/probabilitySearch.js');
if (/face === 'dropdown'/.test(ps) && /popup/.test(ps) && /'Escape'/.test(ps)) test.check('probabilitySearch takes face: dropdown, a field that opens to the same list');
else test.fail(OWED + 'probabilitySearch has no dropdown face');

test.subHeading('3. the apps are wrappers; the legacy users moved');
const mv = code('shell/mediaViewer/mediaViewer.js');
if (exists('shell/mediaViewer/mediaViewer.json') && /fileList\.create\(/.test(mv) && /face: 'dropdown'/.test(mv) && /mediaViewer\.create\(/.test(mv))
  test.check('the Media Viewer app is the files dropdown and the mediaViewer element');
else test.fail(OWED + 'no Media Viewer app, or not the two elements');
if (/fileList\.create\(/.test(code('shell/files/files.js')) && /contactList\.create\(/.test(code('shell/contacts/contacts.js')) && /contactList\.create\(/.test(code('shell/join/join.js')))
  test.check('Files, Contacts and Join draw the list elements');
else test.fail(OWED + 'Files, Contacts or Join does not draw its list element');
const movers = { 'shell/textEditor/textEditor.js': /fileList\.create\(/, 'shell/grants/grants.js': /contactList\.create\(/, 'shell/introSpector/introSpector.js': /contactList\.create\(/ };
const stuck = Object.keys(movers).filter(function (f) { const c = code(f); return !movers[f].test(c) || /createFileSelector|createContactSelector/.test(c); });
if (!stuck.length && /createContactSelector/.test(code('shell/chatter/chatter.js'))) test.check('textEditor, grants and introSpector moved; chatter keeps the legacy contact selector for now');
else test.fail(OWED + 'not moved: ' + stuck.join(', '));

test.subHeading('4. the translators feed the one tree, in node');
let D = null;
let four = null;
try {
  const g = globalThis;
  delete require.cache[require.resolve('../run/shell/js/spiritData.js')];
  D = require('../run/shell/js/spiritData.js');
  (g.spirit = g.spirit || {}).data = D;
  require('../run/shell/js/files/data.js');
  require('../run/shell/js/contacts/data.js');
  D.take({ type: 'fs-watcher', data: { command: { op: 'createFile', path: 'media/a.mp3', size: 9, modified: 'm' } } });
  D.take({ type: 'fs-watcher', data: { treeComplete: true } });
  D.take({ type: 'relay-presence', data: { presence: { K1: { present: true, at: 1 } } } });
  D.rename({ key: 'K1', caption: 'Kay' });
  four = { file: D.get('files/media/a.mp3'), contact: D.get('contacts/K1') };
} catch (e) { four = { threw: e.message }; }
if (four && four.file && four.file.size === 9 && four.contact && four.contact.present === true && four.contact.name === 'Kay')
  test.check('a file event, presence and a rename land in the tree through their types\' translators');
else test.fail(OWED + 'the translators: ' + short(four));

test.subHeading('5. where an app runs: its manifest, and nothing else (box v8)');
const manifests = [];
['shell', 'process/js'].forEach(function (dir) {
  let names = [];
  try { names = fs.readdirSync(path.join(RUN, dir)); } catch (e) { names = []; }
  // Login's .json is no manifest but its code (goal/G41.3, Q9; Andy: "if something is a manifest is determined not by the
  // json extension."): boot runs it, nothing reads where it runs.
  names.forEach(function (n) { if (exists(dir + '/' + n + '/' + n + '.json') && dir + '/' + n !== 'shell/login') manifests.push(dir + '/' + n); });
});
const runsOf = function (m) { try { return JSON.parse(raw(m + '/' + m.split('/').pop() + '.json')).runs; } catch (e) { return null; } };
const noRuns = manifests.filter(function (m) { return !Array.isArray(runsOf(m)); });
// Since goal/G30.21 the face mark is the face part of the app's .js sidecar; its .json says home.
const faceOf = function (m) { try { return (JSON.parse(raw(m + '/' + m.split('/').pop() + '.js.sidecar.json')).face || {}).app === true; } catch (e) { return false; } };
const faced = ['shell/contacts', 'shell/files', 'shell/mediaViewer'].filter(function (m) { const r = runsOf(m) || []; return faceOf(m) && r.indexOf('home') !== -1; });
if (manifests.length > 10 && !noRuns.length && faced.length === 3) test.check('every manifest says where it runs; Contacts, Files and Media Viewer at home and on the face');
else test.fail(OWED + 'no runs in ' + noRuns.join(', ') + '; home and face: ' + faced.join(', '));
const listGone = ['spirit/includeList.js', 'process/js/desk/onboard.js', 'process/js/desk/offboard.js'].filter(exists);
const verbsLeft = ['spirit/server.js', 'spirit/jobs.js', 'spirit/client/shell.js', 'shell/boot.js', 'shell/js/textViewer.js']
  .filter(function (f) { return /searchModules|setModules|includeList/.test(code(f)); });
if (!listGone.length && !verbsLeft.length) test.check('the include list is gone: its file, its reader, config.setModules and config.searchModules, onboarding and offboarding');
else test.fail(OWED + 'still there: ' + listGone.concat(verbsLeft).join(', '));
const faceCode = code('shell/boot.js');
if (/watch\('files'/.test(faceCode) && /'fs\.annotations'/.test(faceCode) && /runs/.test(code('spirit/client/shell.js')) && /runs/.test(code('spirit/jobs.js')))
  test.check('both shells find their apps in data.files and read runs; the node starts what says home');
else test.fail(OWED + 'the face does not read data.files, or a shell or the node does not read runs');

test.reportSuccessFailureCount();
