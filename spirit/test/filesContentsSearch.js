'use strict';

// spirit/test/filesContentsSearch.js
// goal/G29.11: words searched inside text files. Red on today's tree; claude-windows writes it and builds it (one
// agent). The item's box (v4), in short:
//   THE FILTER: one filter with three mutually exclusive choices, words in: names | paths | contents; names the
//   default; contents alone is find-in-files; the page asks the node only in contents.
//   THE CONTENTS SCORE: each line scored against the whole expression; a line holding any of the words is a matched
//   line; a file's score is the average quality of its matched lines x m / (m + 10), never the file's length.
//   THE VERB (approved by Andy): fs.search takes contents: yes; the node reads text files up to 1 MB and ranks the
//   files by their contents score alone, label {path, score, line}. Without it fs.search answers as before.
//   THE LIST: no found line in the rows; every search on the shared list shows a 3em weight bar, right adjusted, as its left-most column,
//   full for the best row and proportional for the others, gone with no words; a press opens the viewer marked, its
//   first match in view; the editor's picker in contents opens marked.
//
// NAMED HERE where the box names none (argue them in Desk first if the build disagrees):
//   - createNodeSearches({ jobs, rootDir, mimeTypes }).
//   - the rank bar is a cell of class list-rank holding one element whose style width is a percentage.
//   - fileSelector's root.words() answers the words; a row found by contents carries line in root.row.
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

test.startTest('goal/G29.11: words searched inside text files, ranked by their contents, the rank shown as a bar');

// A small page: elements by id, events bubbling along parentNode.
function page() {
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
  const win = {};
  ['probabilityStringMatch.js', 'probabilityStringObjectMatch.js', 'probabilityBucket.js'].forEach(function (f) {
    new Function('window', 'module', fs.readFileSync(path.join(RUN, 'js', f), 'utf8'))(win, undefined);
  });
  new Function('document', 'window', fs.readFileSync(path.join(RUN, 'shell', 'shared', 'js', 'listSearch.js'), 'utf8'))(doc, win);
  return { doc: doc, win: win, node: node };
}
function rowsIn(html) {
  const out = [];
  const re = /<tr[^>]*\bdata-key="([^"]*)"[^>]*>([\s\S]*?)<\/tr>/g;
  let m;
  while ((m = re.exec(html))) out.push({ key: m[1], html: m[2], first: (/<td[^>]*>[\s\S]*?<\/td>/.exec(m[2]) || [''])[0] });
  return out;
}
function barWidth(cell) { const m = /class="[^"]*\blist-rank\b[^"]*"[\s\S]*?width:\s*([0-9.]+)%/.exec(cell); return m ? Number(m[1]) : null; }

(async function () {
  // ── 1. the node ──
  test.subHeading('1. fs.search with contents: yes ranks the text files by their contents');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-contents-'));
  const write = function (rel, text) { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
  write('notes/todo.txt', 'buy milk\nfix the shelf\nwhere did I put my screwdriver?\n');
  write('notes/many.txt', 'screwdriver one\nscrewdriver two\nno\nscrewdriver three\nscrewdriver four\nscrewdriver five\n');
  write('js/tools.js', 'var a = 1;\n// the Screwdriver lives here\n');
  write('media/cat.png', 'screwdriver in a picture');
  write('big/huge.txt', 'x'.repeat(1024 * 1024 + 10) + '\nscrewdriver at the end\n');
  write('screwdriver/readme.md', 'nothing to see\n');
  const tree = ['notes', 'notes/todo.txt', 'notes/many.txt', 'js', 'js/tools.js', 'media', 'media/cat.png', 'big', 'big/huge.txt', 'screwdriver', 'screwdriver/readme.md']
    .map(function (p) { return { name: path.basename(p), relativePath: p, kind: path.extname(p) ? 'file' : 'folder' }; });
  const searches = require('../run/js/nodeSearches.js').createNodeSearches({
    jobs: { fsTreeEntries: function () { return tree; } }, rootDir: root, mimeTypes: kernel.core.const.MIME_TYPES });
  const answer = searches.fsSearch({ q: 'screwdriver', contents: 'yes' });
  const order = ((answer && answer.items) || []).map(function (it) { return it.key; });
  const byKey = {};
  ((answer && answer.items) || []).forEach(function (it) { byKey[it.key] = parse(it.label); });
  const todo = byKey['notes/todo.txt'] || {};
  const many = byKey['notes/many.txt'] || {};
  if (todo.path === 'notes/todo.txt' && todo.line === 3 && typeof todo.score === 'number') test.check('notes/todo.txt is found by its contents: label {path, score, line}, line 3');
  else test.fail(OWED + 'notes/todo.txt answered ' + short(todo) + ' (all: ' + short(order) + ')');
  if (byKey['js/tools.js'] && byKey['js/tools.js'].line === 2) test.check('case ignored: js/tools.js found at line 2 (Screwdriver)');
  else test.fail(OWED + 'js/tools.js answered ' + short(byKey['js/tools.js']));
  if (order[0] === 'notes/many.txt' && many.score > todo.score) test.check('more matched lines rank higher: notes/many.txt (5 lines) first, above notes/todo.txt (1 line)');
  else test.fail(OWED + 'the order is ' + short(order) + '; scores many ' + short(many.score) + ', todo ' + short(todo.score));
  if (todo.score > 0 && todo.score <= 1 / 11 + 1e-9 && many.score <= 5 / 15 + 1e-9) test.check('a file\'s score is at most m / (m + 10): ' + todo.score.toFixed(3) + ' for 1 line, ' + many.score.toFixed(3) + ' for 5');
  else test.fail(OWED + 'scores ' + short({ todo: todo.score, many: many.score }) + ' exceed m / (m + 10)');
  if (!byKey['media/cat.png'] && !byKey['big/huge.txt']) test.check('a picture and a text file over 1 MB are never read');
  else test.fail(OWED + 'found ' + short(order));
  if (!byKey['screwdriver/'] && !byKey['screwdriver/readme.md']) test.check('contents alone: the folder named screwdriver and the file under it are not answered by their names');
  else test.fail(OWED + 'contents answered names: ' + short(order));
  const plain = searches.fsSearch({ q: 'screwdriver' });
  const plainKeys = ((plain && plain.items) || []).map(function (it) { return it.key; });
  const plainLabels = ((plain && plain.items) || []).map(function (it) { return it.label; });
  if (plainKeys.indexOf('notes/todo.txt') === -1 && plainKeys.indexOf('screwdriver/') !== -1 && plainLabels.every(function (l, i) { return l === plainKeys[i]; })) test.check('without contents it answers as before: names and paths only, the label the path');
  else test.fail(OWED + 'without contents fs.search answered ' + short(plain && plain.items));
  try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* scratch */ }

  const server = code(path.join(RUN, 'js', 'server.js'));
  if (/'fs\.search':\s*\{\s*request:\s*\{\s*q:\s*''\s*,\s*contents:\s*''\s*\}/.test(server)) test.check('the node declares fs.search {q, contents}');
  else test.fail(OWED + 'server.js declares fs.search as ' + short((/'fs\.search':[^\n]*/.exec(server) || [''])[0]));
  if (/createNodeSearches\(\{[^}]*rootDir[^}]*mimeTypes/.test(server)) test.check('the node hands the searches its run folder and the kernel\'s mimetypes');
  else test.fail(OWED + 'server.js makes the searches as ' + short((/createNodeSearches\([^\n]*/.exec(server) || [''])[0]));
  const tool = parse(fs.readFileSync(path.join(RUN, 'js', 'fs', 'search.json'), 'utf8')) || {};
  if (/contents/.test(String(tool.description)) && /score/.test(String(tool.description))) test.check('the agents\' tool says what contents does, and that it answers a score');
  else test.fail(OWED + 'js/fs/search.json says ' + short(tool.description));

  // ── 2. the rank bar, every search ──
  test.subHeading('2. every search on the shared list shows its ranking as a bar');
  const p1 = page();
  const box1 = p1.node();
  p1.win.spiritElements.shellCreateListSearch(box1, { rows: function () { return [{ key: 'a', name: 'alpha gate' }, { key: 'b', name: 'beta door' }, { key: 'c', name: 'gamma gate keeper' }]; },
    paint: function (row, mark) { return '<td>' + mark(row.name) + '</td>'; } });
  await settle();
  const pre1 = (/id="(listsearch-\d+-)text"/.exec(box1.innerHTML) || [])[1];
  const plainRows = rowsIn(p1.doc.getElementById(pre1 + 'list').innerHTML);
  if (plainRows.length && plainRows.every(function (r) { return barWidth(r.first) === null; })) test.check('with no words there is no rank column');
  else test.fail(OWED + 'with no words the rows read ' + short(plainRows.map(function (r) { return r.first; })));
  const t1 = p1.doc.getElementById(pre1 + 'text');
  t1.value = 'gate';
  box1.dispatchEvent({ type: 'input', target: t1 });
  await settle();
  const ranked = rowsIn(p1.doc.getElementById(pre1 + 'list').innerHTML);
  const widths = ranked.map(function (r) { return barWidth(r.first); });
  if (widths.length === 3 && widths[0] === 100 && widths.every(function (w, i) { return w !== null && (i === 0 || w <= widths[i - 1]); }) && /width:\s*3em/.test(ranked[0].first) && /margin-left:\s*auto|text-align:\s*right/.test(ranked[0].first)) test.check('words typed: the left-most column is a 3em bar, right adjusted, full (100%) for the best row, shorter down the list: ' + widths.join(', '));
  else test.fail(OWED + 'with words the first cells read ' + short(ranked.map(function (r) { return r.first; })));
  // Andy, 2026-10-18, twice: "i don't see the bars", "score bars STILL NOT SEEN", though the column's tooltips showed. A
  // bar drawn only as a background colour is dropped by contrast themes; the marks, which he sees, are yellow. So the
  // bar is drawn as a solid border, in the marks' yellow, 0.8em tall.
  // Then, at his window width (955 px), every bar measured 0 px: rows that never wrap squeezed the table and the empty
  // cell gave its width up. The cell holds a fixed box the bar sits in, so it cannot be squeezed. Andy, 2026-10-18,
  // seeing them: "i'm sure 3em is wide enough, don't want to waste too much horizontal space".
  if (/<td[^>]*class="list-rank"[^>]*min-width:\s*3em[^>]*>\s*<div[^>]*style="[^"]*width:\s*3em/.test(ranked[0].first)) test.check('the rank cell holds a fixed 3em box (min-width 3em): no row can squeeze it to nothing');
  else test.fail(OWED + 'the rank cell is ' + short(ranked[0].first));
  const barTag = (/<div[^>]*border-top[^>]*>/.exec(ranked[0].first) || [''])[0];
  // Andy, 2026-10-18: "does it really have to be THAT loud a color.... something a little more subtle?" The viewer's
  // soft gold for its matches (rgba(255, 213, 79, 0.45), index.html .text-view-match), still a solid bar.
  if (/border-top:\s*0\.8em\s+solid\s+rgba\(255,\s*213,\s*79,\s*0\.45\)/.test(barTag) && !/background:/.test(barTag)) test.check('the bar is a solid border in the viewer\'s soft gold, 0.8em tall, no background-only drawing');
  else test.fail(OWED + 'the bar is drawn ' + short(barTag));

  // Andy, 2026-10-18: "whenever the search expression changes even by one character, the list (in dropdowns) should
  // snap to the highest ranking (top) row", then "in the dropdown, the list REALLY should snap to the top with every
  // change in the search-term." Every list: the best row current, the list scrolled to its top.
  const list1 = p1.doc.getElementById(pre1 + 'list');
  list1.scrollTop = 400;
  t1.value = 'gat';
  box1.dispatchEvent({ type: 'input', target: t1 });
  await settle();
  const snapped = rowsIn(list1.innerHTML);
  const current = (/<tr[^>]*data-key="([^"]*)"[^>]*class="current"/.exec(list1.innerHTML) || [])[1];
  if (list1.scrollTop === 0 && snapped.length && current === snapped[0].key) test.check('a change of the words snaps the list: the top row current (' + current + '), scrolled to the top');
  else test.fail(OWED + 'after a change of the words: scrollTop ' + list1.scrollTop + ', current ' + short(current) + ', top row ' + short(snapped[0] && snapped[0].key));

  // ── 3. the file list ──
  test.subHeading('3. the file list: words in names | paths | contents, contents asking the node');
  const p2 = page();
  const asked = [];
  const sp = { core: {
    ask: function (verb, body) {
      asked.push({ verb: verb, body: body || {} });
      const items = verb === 'fs.search' && body && body.contents === 'yes'
        ? [{ key: 'notes/many.txt', label: JSON.stringify({ path: 'notes/many.txt', score: 0.8, line: 1 }) },
          { key: 'notes/todo.txt', label: JSON.stringify({ path: 'notes/todo.txt', score: 0.2, line: 3 }) }] : [];
      return Promise.resolve({ status: 200, body: { ok: true, items: items, more: false } });
    },
    util: { escapeHtml: kernel.core.util.escapeHtml, formatBytes: kernel.core.util.formatBytes }, const: { ICON: kernel.core.const.ICON } } };
  new Function('spirit', 'document', 'window', 'Event', fs.readFileSync(path.join(RUN, 'shell', 'js', 'fileSelector.js'), 'utf8'))(sp, p2.doc, p2.win, Event);
  const TREE = [{ name: 'notes', relativePath: 'notes', kind: 'folder' },
    { name: 'a-screwdriver.txt', relativePath: 'notes/a-screwdriver.txt', kind: 'file', size: 9 },
    { name: 'many.txt', relativePath: 'notes/many.txt', kind: 'file', size: 50 },
    { name: 'todo.txt', relativePath: 'notes/todo.txt', kind: 'file', size: 50 }];
  const pane = p2.win.spiritElements.createFileSelector({ face: 'pane', files: function () { return TREE; } });
  await settle();
  const host = pane.children[0];
  const pre = (/id="(listsearch-\d+-)text"/.exec(host.innerHTML) || [])[1];
  const strip = host.innerHTML;
  if (/data-filter="in"[^>]*data-value="names"/.test(strip) && /data-filter="in"[^>]*data-value="paths"/.test(strip) && /data-filter="in"[^>]*data-value="contents"/.test(strip) && !/data-filter="contents"/.test(strip)) test.check('one filter, words in: names | paths | contents, mutually exclusive');
  else test.fail(OWED + 'the filters read ' + short((strip.match(/data-filter="[^"]*"[^>]*data-value="[^"]*"/g) || []).join(' ')));
  const text = p2.doc.getElementById(pre + 'text');
  text.value = 'screwdriver';
  host.dispatchEvent({ type: 'input', target: text });
  await settle();
  if (!asked.some(function (a) { return a.verb === 'fs.search'; })) test.check('in names: typing asks the node nothing');
  else test.fail(OWED + 'in names the node was asked ' + short(asked));
  host.dispatchEvent({ type: 'click', target: { id: '', getAttribute: function (k) { return k === 'data-filter' ? 'in' : k === 'data-value' ? 'contents' : null; }, closest: function () { return null; } } });
  await settle();
  await settle();
  const call = asked.filter(function (a) { return a.verb === 'fs.search'; }).pop();
  if (call && call.body.q === 'screwdriver' && call.body.contents === 'yes') test.check('in contents: the node is asked fs.search {q: screwdriver, contents: yes}');
  else test.fail(OWED + 'in contents the node was asked ' + short(asked));
  const rows = rowsIn(p2.doc.getElementById(pre + 'list').innerHTML);
  const keys = rows.map(function (r) { return r.key; });
  if (keys[0] === 'notes/many.txt' && keys[1] === 'notes/todo.txt' && keys.indexOf('notes/a-screwdriver.txt') > 1) test.check('in contents the node\'s scores rank the files: many.txt, todo.txt, then the rest (a name match counts for nothing)');
  else test.fail(OWED + 'in contents the rows rank ' + short(keys));
  const w0 = barWidth(rows[0] && rows[0].first);
  const w1 = barWidth(rows[1] && rows[1].first);
  if (w0 === 100 && w1 === 25) test.check('the bar shows it: 100% for many.txt (0.8), 25% for todo.txt (0.2)');
  else test.fail(OWED + 'the bars read ' + short([w0, w1]));
  if (rows.every(function (r) { return !/file-selector-line|where did I put/.test(r.html); })) test.check('no found line in the rows');
  else test.fail(OWED + 'a row still shows a found line');
  let changed = 0;
  pane.addEventListener('change', function () { changed += 1; });
  host.dispatchEvent({ type: 'click', target: { id: '', getAttribute: function (k) { return k === 'data-key' ? 'notes/todo.txt' : null; }, closest: function () { return null; } } });
  await settle();
  if (changed === 1 && pane.value === 'notes/todo.txt' && pane.row && pane.row.line === 3 && typeof pane.words === 'function' && pane.words() === 'screwdriver') test.check('a press picks it: its row carries line 3, and words() answers the words');
  else test.fail(OWED + 'after a press: changes ' + changed + ', value ' + short(pane.value) + ', row ' + short(pane.row) + ', words ' + short(typeof pane.words === 'function' ? pane.words() : pane.words));

  // ── 4. opened marked ──
  test.subHeading('4. Files opens the viewer marked, the editor\'s picker opens marked');
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
  p2.win.CodeMirror = function (place, opts) {
    const text2 = String(opts.value || '');
    const starts = [0];
    for (let i = 0; i < text2.length; i++) if (text2[i] === '\n') starts.push(i + 1);
    const cm = { opts: opts, scrolled: [], getValue: function () { return text2; },
      posFromIndex: function (i) { let l = 0; while (l + 1 < starts.length && starts[l + 1] <= i) l++; return { line: l, ch: i - starts[l] }; },
      markText: function () { return { clear: function () {} }; }, scrollIntoView: function (w) { cm.scrolled.push(w); }, setCursor: function () {}, refresh: function () {} };
    CM.push(cm);
    return cm;
  };
  new Function('window', 'document', 'spirit', fs.readFileSync(path.join(RUN, 'shell', 'js', 'textView.js'), 'utf8'))(p2.win, p2.doc, sp);
  p2.win.spiritElements.createTextView(p2.node(), { text: 'a\nb\nc\nd\ne\n', readOnly: true, line: 4 });
  const sc = (CM[CM.length - 1] || { scrolled: [] }).scrolled[0];
  if (sc && sc.line === 3) test.check('createTextView puts line 4 in view (0-based 3)');
  else test.fail(OWED + 'with line 4 the view scrolled to ' + short((CM[CM.length - 1] || {}).scrolled));
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(0); }, 100);
});
