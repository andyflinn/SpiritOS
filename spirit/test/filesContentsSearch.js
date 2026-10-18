'use strict';

// spirit/test/filesContentsSearch.js
// goal/G29.11: words searched inside text files. Red on today's tree; claude-windows writes it and builds it (one
// agent). The item's box, in short:
//   - A filter in the file list: contents, off by default; on, the words are searched in text files as well.
//   - File contents live on the node, so the node searches them: fs.search takes contents: yes beside q (the verb
//     change approved by Andy). With it the node also reads text files up to 1 MB (larger ones are found by name only)
//     and answers each file found by its contents with label {path, line, text}: the first matching line number and
//     that line. Without it fs.search answers as today.
//   - The page asks the node only while contents is on; names and paths stay searched in the page.
//   - A row found by its contents shows its matching line, the words marked.
//   - A press on such a row opens the viewer with {path, words, line}.
//   - In the text editor: a file picked in its own file picker with contents on opens marked with the picker's words.
//
// NAMED HERE where the box names none (argue them in Desk first if the build disagrees):
//   - createNodeSearches({ jobs, rootDir, mimeTypes }): rootDir to read files from, mimeTypes the kernel's table
//     (text/*, json and javascript are text). A file matched by its name only answers {path, line: 0, text: ''}.
//   - fileSelector's filter is named contents, choices off | on; root.words() answers the picker's words, and a row
//     found by contents carries line and text in root.row.
//   - createTextView takes line: the 1-based line put in view.
// rule/11: through testSupport only; its own folders; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');

const OWED = 'OWED by goal/G29.11: ';
const RUN = path.join(__dirname, '..', 'run');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }
function code(file) { try { return fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); } catch (e) { return ''; } }
function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setTimeout(r, 5); }); }); }
function parse(s) { try { return JSON.parse(s); } catch (e) { return null; } }

test.startTest('goal/G29.11: words searched inside text files, on the node, shown and opened marked');

(async function () {
  // ── 1. the node ──
  test.subHeading('1. fs.search with contents: yes reads the text files');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-contents-'));
  const write = function (rel, text) { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
  write('notes/todo.txt', 'buy milk\nfix the shelf\nwhere did I put my screwdriver?\n');
  write('js/tools.js', 'var a = 1;\n// the Screwdriver lives here\n');
  write('media/cat.png', 'screwdriver in a picture');
  write('big/huge.txt', 'x'.repeat(1024 * 1024 + 10) + '\nscrewdriver at the end\n');
  write('screwdriver/readme.md', 'nothing to see\n');
  const tree = ['notes', 'notes/todo.txt', 'js', 'js/tools.js', 'media', 'media/cat.png', 'big', 'big/huge.txt', 'screwdriver', 'screwdriver/readme.md']
    .map(function (p) { return { name: path.basename(p), relativePath: p, kind: path.extname(p) ? 'file' : 'folder' }; });
  const searches = require('../run/js/nodeSearches.js').createNodeSearches({
    jobs: { fsTreeEntries: function () { return tree; } }, rootDir: root, mimeTypes: kernel.core.const.MIME_TYPES });
  const answer = searches.fsSearch({ q: 'screwdriver', contents: 'yes' });
  const byKey = {};
  ((answer && answer.items) || []).forEach(function (it) { byKey[it.key] = parse(it.label); });
  const todo = byKey['notes/todo.txt'];
  if (todo && todo.path === 'notes/todo.txt' && todo.line === 3 && /my screwdriver\?/.test(todo.text)) test.check('notes/todo.txt is found by its contents: line 3, and that line');
  else test.fail(OWED + 'notes/todo.txt answered ' + short(todo) + ' (all: ' + short(Object.keys(byKey)) + ')');
  if (byKey['js/tools.js'] && byKey['js/tools.js'].line === 2) test.check('case ignored: js/tools.js found at line 2 (Screwdriver)');
  else test.fail(OWED + 'js/tools.js answered ' + short(byKey['js/tools.js']));
  if (!byKey['media/cat.png']) test.check('a picture is not read: media/cat.png is not found by its bytes');
  else test.fail(OWED + 'media/cat.png was found: ' + short(byKey['media/cat.png']));
  if (!byKey['big/huge.txt']) test.check('a text file over 1 MB is not read');
  else test.fail(OWED + 'big/huge.txt was found: ' + short(byKey['big/huge.txt']));
  const named = byKey['screwdriver/'] || byKey['screwdriver'];
  if (named && named.line === 0 && named.text === '') test.check('a folder found by its name answers line 0 and no text');
  else test.fail(OWED + 'the folder screwdriver answered ' + short(named));
  const plain = searches.fsSearch({ q: 'screwdriver' });
  const plainKeys = ((plain && plain.items) || []).map(function (it) { return it.key; });
  const plainLabels = ((plain && plain.items) || []).map(function (it) { return it.label; });
  if (plainKeys.indexOf('notes/todo.txt') === -1 && plainLabels.every(function (l, i) { return l === plainKeys[i]; })) test.check('without contents it answers as before: names and paths only, the label the path');
  else test.fail(OWED + 'without contents fs.search answered ' + short(plain && plain.items));
  try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* scratch */ }

  const server = code(path.join(RUN, 'js', 'server.js'));
  if (/'fs\.search':\s*\{\s*request:\s*\{\s*q:\s*''\s*,\s*contents:\s*''\s*\}/.test(server)) test.check('the node declares fs.search {q, contents}');
  else test.fail(OWED + 'server.js declares fs.search as ' + short((/'fs\.search':[^\n]*/.exec(server) || [''])[0]));
  if (/createNodeSearches\(\{[^}]*rootDir[^}]*mimeTypes/.test(server)) test.check('the node hands the searches its run folder and the kernel\'s mimetypes');
  else test.fail(OWED + 'server.js makes the searches as ' + short((/createNodeSearches\([^\n]*/.exec(server) || [''])[0]));
  const tool = parse(fs.readFileSync(path.join(RUN, 'js', 'fs', 'search.json'), 'utf8')) || {};
  if (/contents/.test(String(tool.description))) test.check('the agents\' tool says what contents does');
  else test.fail(OWED + 'js/fs/search.json says nothing of contents: ' + short(tool.description));

  // ── 2. the file list ──
  test.subHeading('2. the file list: a contents filter that asks the node, rows showing their line');
  const asked = [];
  const win = {};
  const byId = {};
  const node = function () {
    let html = '';
    const e = { children: [], style: {}, listeners: {}, parentNode: null, hidden: false, className: '', value: '',
      appendChild: function (c) { e.children.push(c); c.parentNode = e; return c; },
      addEventListener: function (t, fn) { (e.listeners[t] = e.listeners[t] || []).push(fn); },
      dispatchEvent: function (ev) { for (let n = e; n; n = n.parentNode) (n.listeners[ev.type] || []).forEach(function (fn) { fn(ev); }); return true; },
      setAttribute: function () {}, getAttribute: function () { return null; }, focus: function () {}, contains: function () { return true; } };
    Object.defineProperty(e, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); e.children = []; } });
    return e;
  };
  const doc = { createElement: node, getElementById: function (id) { if (!byId[id]) { byId[id] = node(); byId[id].id = id; } return byId[id]; }, addEventListener: function () {} };
  const sp = { core: {
    ask: function (verb, body) {
      asked.push({ verb: verb, body: body || {} });
      const items = verb === 'fs.search' && body && body.contents === 'yes'
        ? [{ key: 'notes/todo.txt', label: JSON.stringify({ path: 'notes/todo.txt', line: 3, text: 'where did I put my screwdriver?' }) }] : [];
      return Promise.resolve({ status: 200, body: { ok: true, items: items, more: false } });
    },
    util: { escapeHtml: kernel.core.util.escapeHtml, formatBytes: kernel.core.util.formatBytes }, const: { ICON: kernel.core.const.ICON } } };
  ['probabilityStringMatch.js', 'probabilityStringObjectMatch.js', 'probabilityBucket.js'].forEach(function (f) {
    new Function('window', 'module', fs.readFileSync(path.join(RUN, 'js', f), 'utf8'))(win, undefined);
  });
  new Function('document', 'window', fs.readFileSync(path.join(RUN, 'shell', 'shared', 'js', 'listSearch.js'), 'utf8'))(doc, win);
  new Function('spirit', 'document', 'window', 'Event', fs.readFileSync(path.join(RUN, 'shell', 'js', 'fileSelector.js'), 'utf8'))(sp, doc, win, Event);
  const TREE = [{ name: 'notes', relativePath: 'notes', kind: 'folder' }, { name: 'todo.txt', relativePath: 'notes/todo.txt', kind: 'file', size: 50, modified: '2026-10-18T00:00:00.000Z' }];
  const pane = win.spiritElements.createFileSelector({ face: 'pane', files: function () { return TREE; } });
  await settle();
  const host = pane.children[0];
  const ids = function () { return (/id="(listsearch-\d+-)text"/.exec(host.innerHTML) || [])[1]; };
  const pre = ids();
  const strip = host.innerHTML;
  if (/data-filter="contents"[^>]*data-value="off"/.test(strip) && /data-filter="contents"[^>]*data-value="on"/.test(strip)) test.check('the file list draws a contents filter, off | on');
  else test.fail(OWED + 'no contents filter in ' + short(strip.slice(0, 400)));
  const text = doc.getElementById(pre + 'text');
  text.value = 'screwdriver';
  host.dispatchEvent({ type: 'input', target: text });
  await settle();
  if (!asked.some(function (a) { return a.verb === 'fs.search'; })) test.check('contents off: typing asks the node nothing');
  else test.fail(OWED + 'contents off, the node was asked ' + short(asked));
  host.dispatchEvent({ type: 'click', target: { id: '', getAttribute: function (k) { return k === 'data-filter' ? 'contents' : k === 'data-value' ? 'on' : null; }, closest: function () { return null; } } });
  await settle();
  await settle();
  const call = asked.filter(function (a) { return a.verb === 'fs.search'; }).pop();
  if (call && call.body.q === 'screwdriver' && call.body.contents === 'yes') test.check('contents on: the node is asked fs.search {q: screwdriver, contents: yes}');
  else test.fail(OWED + 'contents on, the node was asked ' + short(asked));
  const list = doc.getElementById(pre + 'list').innerHTML;
  const row = (/<tr[^>]*data-key="notes\/todo\.txt"[^>]*>([\s\S]*?)<\/tr>/.exec(list) || [])[1] || '';
  if (/where did I put my <mark>screwdriver<\/mark>\?/.test(row) && /\b3\b/.test(row)) test.check('its row shows line 3 and that line, the word marked');
  else test.fail(OWED + 'the row for notes/todo.txt draws ' + short(row || list.slice(0, 300)));
  let changed = 0;
  pane.addEventListener('change', function () { changed += 1; });
  host.dispatchEvent({ type: 'click', target: { id: '', getAttribute: function (k) { return k === 'data-key' ? 'notes/todo.txt' : null; }, closest: function () { return null; } } });
  await settle();
  if (changed === 1 && pane.value === 'notes/todo.txt' && pane.row && pane.row.line === 3 && typeof pane.words === 'function' && pane.words() === 'screwdriver') test.check('a press picks it: its row carries line 3, and words() answers the words');
  else test.fail(OWED + 'after a press: changes ' + changed + ', value ' + short(pane.value) + ', row ' + short(pane.row) + ', words ' + short(typeof pane.words === 'function' ? pane.words() : pane.words));

  // ── 3. opened marked ──
  test.subHeading('3. Files opens the viewer at the line, the editor\'s picker opens marked');
  const files = code(path.join(RUN, 'shell', 'files', 'files.js'));
  if (/launchApp\([^)]*\{[^}]*words\s*:[^}]*line\s*:/.test(files)) test.check('Files opens the viewer with {path, words, line}');
  else test.fail(OWED + 'files.js launches ' + short((/launchApp\([^\n]*/.exec(files) || [''])[0]));
  const index = fs.readFileSync(path.join(RUN, 'index.html'), 'utf8');
  if (/createTextView\([^)]*\{[\s\S]{0,200}?line\s*:/.test(index)) test.check('the viewer hands the line to its text view');
  else test.fail(OWED + 'the viewer passes no line to createTextView');
  const editor = code(path.join(RUN, 'shell', 'textEditor', 'textEditor.js'));
  if (/picker\.words\(\)/.test(editor) && /contents/.test(editor)) test.check('the editor opens a file its picker found by contents marked with the picker\'s words');
  else test.fail(OWED + 'textEditor.js: picker.words() ' + /picker\.words\(\)/.test(editor) + ', contents ' + /contents/.test(editor));

  const CM = [];
  win.CodeMirror = function (place, opts) {
    const text2 = String(opts.value || '');
    const starts = [0];
    for (let i = 0; i < text2.length; i++) if (text2[i] === '\n') starts.push(i + 1);
    const cm = { opts: opts, scrolled: [], getValue: function () { return text2; },
      posFromIndex: function (i) { let l = 0; while (l + 1 < starts.length && starts[l + 1] <= i) l++; return { line: l, ch: i - starts[l] }; },
      markText: function () { return { clear: function () {} }; }, scrollIntoView: function (w) { cm.scrolled.push(w); }, setCursor: function () {}, refresh: function () {} };
    CM.push(cm);
    return cm;
  };
  new Function('window', 'document', 'spirit', fs.readFileSync(path.join(RUN, 'shell', 'js', 'textView.js'), 'utf8'))(win, doc, sp);
  win.spiritElements.createTextView(node(), { text: 'a\nb\nc\nd\ne\n', readOnly: true, line: 4 });
  const sc = (CM[CM.length - 1] || { scrolled: [] }).scrolled[0];
  if (sc && sc.line === 3) test.check('createTextView puts line 4 in view (0-based 3) when no word is given');
  else test.fail(OWED + 'with line 4 the view scrolled to ' + short((CM[CM.length - 1] || {}).scrolled));
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(0); }, 100);
});
