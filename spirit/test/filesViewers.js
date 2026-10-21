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
  const filesApp = code('shell/files/files.js');
  if (/spiritElements\.probabilitySearch\.create\(/.test(filesApp) && /spiritElements\.fileElement/.test(filesApp) && !/createFileSelector/.test(filesApp) && /'fs\.search'|verb: 'search'/.test(filesApp))
    test.check('Files lists through probabilitySearch over fs.search with fileElement rows');
  else test.fail(OWED + 'Files still uses the file selector, or not the list-tool with file rows');
  const face = code('face/shell.js');
  if (/FIRST_APPS = \[[^\]]*shell\/files\/files\.js/.test(face) && /spiritTransport = \{[^}]*file:/.test(face))
    test.check('the face starts with Files, and its transport reads a file piece by piece');
  else test.fail(OWED + 'the face has no Files at the start, or no file() on its transport');

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
}());

done.then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the suite threw ' + e.message); test.reportSuccessFailureCount(); process.exit(0); });
