'use strict';

// spirit/test/filesViewers.js
// goal/G30.16: Files and the viewers as shell elements, on the face as at home. Red on today's tree; claude-windows
// writes it and builds it (one agent). The box (v11), in short:
//   - The text and media viewers move out of the old shell as shell elements: fileViewer, and textViewer and
//     mediaViewer on it; fileViewer brings fStatViewer (fs.stat) and annotationManager (fs.annotations). The old inline
//     viewers are deleted. CodeMirror loads when a textViewer first needs it, on the face as at home.
//   - The Files app's list is a probabilitySearch over fs.search with fileElement rows.
//   - On the face the mediaViewer plays as the sealed pieces arrive; the pieces stay while the viewer is open.
// NAMED HERE: window.spiritElements.fileViewer.read(path, onPiece) -> Promise<{ status, type, bytes }>, through
// window.spiritTransport.file(path, onPiece) on a face and the node's own GET at home; fileViewer/textViewer/mediaViewer
// .create(host, { path, ... }); the face's transport gains file(); Files is one of the face's first apps.
// rule/11: through testSupport only.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G30.16: ';
const RUN = path.join(__dirname, '..', 'run');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const raw = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8'); } catch (e) { return ''; } };
const exists = function (rel) { return fs.existsSync(path.join(RUN, rel)); };
const code = function (rel) { return raw(rel).split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'); };

test.startTest('goal/G30.16: Files and the viewers as shell elements');

const done = (async function () {
  test.subHeading('1. three viewer elements, asynchronous, loaded by index.html');
  const files = ['shell/js/fileViewer.js', 'shell/js/textViewer.js', 'shell/js/mediaViewer.js'];
  const all = files.map(code).join('\n');
  const index = raw('index.html');
  if (files.every(function (f) { return code(f).length > 0 && index.indexOf('/' + f) !== -1; }))
    test.check('fileViewer, textViewer and mediaViewer exist and index.html loads them');
  else test.fail(OWED + 'missing or not loaded: ' + files.filter(function (f) { return !code(f) || index.indexOf('/' + f) === -1; }).join(', '));
  if (all && !/fs\.loadFile\(|fs\.statFile\(|fs\.getAnnotations\(/.test(all) && /'fs\.stat'/.test(all) && /'fs\.annotations'/.test(all))
    test.check('the viewers ask fs.stat and fs.annotations, and use none of the synchronous reads');
  else test.fail(OWED + 'the viewers still read synchronously, or ask neither fs.stat nor fs.annotations');

  test.subHeading('2. the old inline viewers are gone');
  if (!/function codeViewerLoadFile|function mediaViewerLoadFile/.test(index) && /spiritElements\.textViewer/.test(index) && /spiritElements\.mediaViewer/.test(index))
    test.check('index.html keeps the two launchers only as the elements, their inline bodies deleted');
  else test.fail(OWED + 'index.html still draws the viewers inline, or its launchers do not use the elements');

  test.subHeading('3. Files: the list-tool with file rows, on the face too');
  // Since goal/G30.20 the Files app wraps the files list element, which holds what this asserted.
  const filesApp = code('shell/js/files/listElement.js');
  if (/fileList\.create\(/.test(code('shell/files/files.js')) && /probabilitySearch\.create\(/.test(filesApp) && /fileElement\.create\(/.test(filesApp) && !/createFileSelector/.test(filesApp) && /'fs\.search'|verb: 'search'/.test(filesApp))
    test.check('Files lists through probabilitySearch over fs.search with fileElement rows');
  else test.fail(OWED + 'Files still uses the file selector, or not the list-tool with file rows');
  const face = code('face/shell.js');
  // Since box v18 the face's apps are the home node's data (config.searchModules), no list in the relay's file.
  if (!/FIRST_APPS/.test(face) && /'config\.searchModules'/.test(face) && /spiritTransport = \{[^}]*file:/.test(face))
    test.check('the face lists its apps from the home node, and its transport reads a file piece by piece');
  else test.fail(OWED + 'the face keeps its own app list, or has no file() on its transport');

  test.subHeading('4. read() streams through the transport on a face');
  const pieces = [new Uint8Array([1, 2]), new Uint8Array([3])];
  const window = { spiritElements: {}, spiritTransport: { file: function (p, onPiece) {
    pieces.forEach(function (x) { onPiece(x); });
    return Promise.resolve({ status: 200, type: 'video/webm', bytes: new Uint8Array([1, 2, 3]) });
  } } };
  const ctx = vm.createContext({ window: window, spirit: { core: { ask: function () { return Promise.resolve({ status: 200, body: {} }); } } }, console: console, Promise: Promise, Uint8Array: Uint8Array, document: { createElement: function () { return {}; } } });
  let got = null;
  try {
    vm.runInContext(raw('shell/js/fileViewer.js'), ctx, { filename: 'fileViewer.js' });
    const seen = [];
    const r = await window.spiritElements.fileViewer.read('media/a.webm', function (p) { seen.push(p.length); });
    got = { seen: seen.join(','), status: r.status, size: r.bytes.length };
  } catch (e) { got = { threw: e.message }; }
  if (got && got.seen === '2,1' && got.status === 200 && got.size === 3) test.check('each piece is handed on as it arrives, then the whole');
  else test.fail(OWED + 'fileViewer.read: ' + short(got));

  // ── 5. The faceless layer (box v14-v16), in node, no page ─────────────────────────────────────────────────────────
  test.subHeading('5. one data tree: set and delete the only writes, watch by path, translators, no cap');
  let D = null;
  // Each type's translator is its data.js since goal/G30.20, registered on the tree.
  try {
    ['../run/shell/js/spiritData.js', '../run/shell/js/files/data.js', '../run/shell/js/contacts/data.js'].forEach(function (m) { delete require.cache[require.resolve(m)]; });
    D = require('../run/shell/js/spiritData.js');
    globalThis.spiritData = D;
    require('../run/shell/js/files/data.js');
    require('../run/shell/js/contacts/data.js');
  } catch (e) { D = { threw: e.message }; }
  let five = null;
  try {
    const heard = [];
    const one = [];
    D.watch('files', function (p) { heard.push(p); });
    D.watch('files/a/b.txt', function (p, v) { one.push(v && v.size); });
    // The tree arrives quietly (no watcher told), then one word to the branch; then each change is told by path.
    D.take({ type: 'fs-watcher', data: { command: { op: 'createDirectory', path: 'a' } } });
    D.take({ type: 'fs-watcher', data: { command: { op: 'createFile', path: 'a/b.txt', size: 3, modified: 'm1' } } });
    const quietCount = heard.length;
    D.take({ type: 'fs-watcher', data: { treeComplete: true } });
    D.take({ type: 'fs-watcher', data: { command: { op: 'changeFile', path: 'a/b.txt', size: 5, modified: 'm2' } } });
    D.take({ type: 'fs-watcher', data: { command: { op: 'deleteDirectory', path: 'a' } } });
    // Contacts: a search answer and presence land in the same entry; a rename too.
    D.seat('contacts', [{ key: 'K1', label: JSON.stringify({ name: 'ann', book: true }) }]);
    D.take({ type: 'relay-presence', data: { presence: { K1: { present: true, at: 1 } } } });
    D.rename({ key: 'K1', caption: 'Annie' });
    const k1 = D.get('contacts/K1');
    // No cap (box v17): the page's copy is dropped on every refresh, so nothing is shed while it lives.
    for (let i = 0; i < 3000; i++) D.set('contacts/X' + i, { name: 'x'.repeat(400) });
    five = { quietCount: quietCount, heard: heard.length, one: one.join(','), gone: D.get('files/a/b.txt') === undefined && D.get('files/a') === undefined,
      k1: k1, kept: !!D.get('contacts/K1') && !!D.get('contacts/X0') && !!D.get('contacts/X2999'), ready: D.ready('files') };
  } catch (e) { five = { threw: e.message, D: short(D) }; }
  if (five && five.quietCount === 0 && five.ready && five.one === '5,' && five.gone) test.check('the tree fills quietly, says so once, then tells each change by path; a folder\'s delete takes its contents');
  else test.fail(OWED + 'data.files: ' + short(five));
  if (five && five.k1 && five.k1.name === 'Annie' && five.k1.present === true && five.k1.book === true) test.check('a search answer, presence and a rename land in one contact entry');
  else test.fail(OWED + 'data.contacts: ' + short(five && five.k1));
  if (five && five.kept) test.check('no cap in the browser: 3000 contacts later, the first is still there');
  else test.fail(OWED + 'something was shed: ' + short(five));
  const views = code('shell/js/probabilitySearch.js') + code('shell/js/files/listElement.js') + code('shell/js/contacts/listElement.js');
  if (/data: 'files'/.test(views) && /data: 'contacts'/.test(views) && !/self\.feed/.test(views) && !exists('shell/js/fileTree.js'))
    test.check('Files and Contacts are views of the tree; the list-tool has no feed of its own; no second file tree');
  else test.fail(OWED + 'the lists are not views of the tree');
}());

done.then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the suite threw ' + e.message); test.reportSuccessFailureCount(); process.exit(0); });
