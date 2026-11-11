'use strict';

// spirit/run/spirit/element/search/file/test/listElement.js
// The tests of spirit/element/search/file/listElement.js, and of no other module (spec: ./listElement.md; goal/G30.20, goal/G41.16).
// The browser file runs in node on a BARE window (rule/26): nothing is on the page until the list requires it. Then the
// search element is a recorder in its place, so this tests the list and not the search under it; the row element and
// the file viewer are stand-ins; the page's data set is real, and so is the fs family's data.js (goal/G41.28),
// loaded as a page's spirit.cacheManager('fs') loads it, the page's node known as spirit.start makes it known
// (spirit.node.key, then data.homeNode). The node's fs family is the spirit object's.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(RUN, 'spirit', 'element', 'search', 'file', 'listElement.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

function hostNode() {
  const n = { innerHTML: '', kids: [], heard: {} };
  const inner = { classList: { on: true, toggle: function (c, v) { inner.classList.on = !!v; } }, addEventListener: function (t, fn) { (n.heard[t] = n.heard[t] || []).push(fn); } };
  Object.defineProperty(n, 'lastChild', { get: function () { return inner; } });
  n.inner = inner;
  return n;
}

test.startTest('files/listElement.js: the files list');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('spirit/element/search/file/listElement.js is not there'); return; }
  const required = [];
  const lists = [];
  const asked = [];
  const fsFamily = { search: function (a) { asked.push(a); return Promise.resolve({ items: [{ key: 'docs/a.md', label: JSON.stringify({ path: 'docs/a.md', score: 0.9, line: 3 }) }, { key: 'docs/', label: JSON.stringify({ path: 'docs/', score: 0.2 }) }], more: false }); } };
  const STANDS = {
    'spirit/element/search.js': function (E) { E.search = Object.assign(E.search || {}, { create: function (host, o) {
      const l = { host: host, o: o, refreshes: 0, sorted: null, typed: '', refresh: function () { l.refreshes += 1; }, redraw: function () {}, destroy: function () {},
        sort: function (f, d) { l.sorted = [f, d]; }, words: function () { return l.typed; } };
      lists.push(l); return l;
    } }); },
    'spirit/element/search/file/rowElement.js': function (E) { require(path.join(RUN, 'spirit', 'element', 'installSpiritElement.js'))(global.window.spirit, 'spirit/element/search/file/rowElement.js', { create: function (row) { return { kind: 'file', row: row }; } }); },
    'spirit/element/fstat.js': function (E) { E.fstat = { mimeOf: function (n) { return /\.png$/.test(n) ? 'image/png' : 'text/plain'; } }; },
  };
  global.window = { spirit: { escapeHtml: function (s) { return String(s); }, ready: Promise.resolve({ fs: fsFamily }), fs: fsFamily, element: {} } };
  // goal/G43.32: the element places itself by installSpiritElement, as it runs (spirit/test/headLessChrome.js pageSpirit).
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(window.spirit);
  global.spirit = global.window.spirit;
  vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', 'data.js'), 'utf8'), { filename: 'data.js' });
  const D = global.window.spirit.data;
  // THE PAGE KNOWS ITS NODE (goal/G41.28): spirit.start asks node.card, keeps the key and hands it to the data set.
  const NODE_KEY = 'nOdE+key/one==';
  global.window.spirit.node = { key: NODE_KEY };
  D.homeNode(NODE_KEY);
  // spirit.cacheManager(name), as a page's: the family's manager loaded once, attaching itself to the data set.
  const managers = [];
  global.window.spirit.cacheManager = function (name) {
    managers.push(String(name));
    vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', String(name), 'data.js'), 'utf8'), { filename: name + '/data.js' });
    return Promise.resolve(true);
  };
  global.window.spirit.require = function (p) { required.push(String(p)); if (STANDS[p] && !STANDS[p].done) { STANDS[p].done = true; STANDS[p](((global.window.spirit.element.spirit = global.window.spirit.element.spirit || {}).element = global.window.spirit.element.spirit.element || {})); } return Promise.resolve(true); };
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  await settle();
  const E = ((global.window.spirit.element || {}).spirit || {}).element || {};
  const F = ((global.window.spirit.data || {}).fs || {}).data;

  test.subHeading('it loads what it uses itself (rule/26), and no data script');
  ok(['spirit/element/search/file/rowElement.js', 'spirit/element/search.js', 'spirit/element/fstat.js'].every(function (p) { return required.indexOf(p) !== -1; }), 'it requires its row element, the search element and the file viewer', 'required: ' + short(required));
  // goal/G41.16, Andy: "get rid of thos FUCKING data.js scripts": what the stream means for the file tree is the fs family's cache manager's (goal/G41.28).
  ok(!required.some(function (p) { return /data\.js$/.test(p); }), 'and no data script: the file tree\'s stream is its row element\'s', 'required: ' + short(required));
  ok(managers.indexOf('fs') !== -1 && F && typeof F.file === 'function', 'it loads the fs family\'s cache manager, which puts ((spirit.data || {}).fs || {}).data on the page', 'managers: ' + short(managers));
  if (!F || typeof F.file !== 'function') return;
  ok(E.search.file && E.search.file.listElement && typeof E.search.file.listElement.create === 'function', 'it registers spirit.element.spirit.element.search.file.listElement.create', 'elements: ' + short(Object.keys(E)));
  if (!E.search.file || !E.search.file.listElement || typeof E.search.file.listElement.create !== 'function') return;

  test.subHeading('a view of the node\'s file tree');
  const picked = [];
  const host = hostNode();
  const list = E.search.file.listElement.create(host, { face: 'pane', accept: '.md', pick: function (row, key) { picked.push(key); } });
  await settle();
  const l = lists[0];
  ok(!!l && l.host === host.inner && /files-tree/.test(host.innerHTML) && /fill/.test(host.innerHTML), 'it draws one probabilitySearch into a fill box of its host', 'host: ' + short(host.innerHTML.slice(0, 120)));
  if (!l) return;
  const o = l.o;
  ok(typeof F.branch === 'string' && F.branch !== '' && o.data === F.branch && l.refreshes === 1 && JSON.stringify(l.sorted) === '["name","asc"]', 'it is a view of the fs family\'s file tree (spirit.data.fs.data.branch), in path order, filled as it is drawn', 'data ' + short(o.data) + ' (fsReads.branch ' + short(F.branch) + ')' + ', sorted ' + short(l.sorted) + ', refreshes ' + l.refreshes);
  ok(JSON.stringify((o.columns || []).map(function (c) { return c.field; })) === '["name","size","changed"]', 'its columns are name, size and changed', 'columns: ' + short(o.columns));
  const el = o.element({ kind: 'file' }, 'docs/a.md');
  ok(el && el.kind === 'file' && el.row.path === 'docs/a.md', 'each row is a fileElement of its path', 'element: ' + short(el));
  ok(o.name({ path: 'docs/a.md' }) === 'docs/a.md', 'a picked file is shown by its path', 'name: ' + short(o.name({ path: 'docs/a.md' })));
  o.pick({ path: 'docs/a.md' }, 'docs/a.md');
  ok(picked.length === 1 && picked[0] === 'docs/a.md', 'a pick reaches opts.pick', 'picked: ' + short(picked));

  test.subHeading('names from the mirror; fs.search only by contents');
  const none = await o.search(o.args('a', { in: 'names' }), 'search');
  ok(asked.length === 0 && none.body && none.body.items.length === 0, 'a search of names asks the node nothing: the mirror answers it', 'asked: ' + short(asked));
  D.takeJob({ id: 'spirit.fs', data: { command: { op: 'createFile', path: 'docs/a.md', size: 5, modified: '2030-01-01T00:00:00Z' } } });
  const found = await o.search(o.args('hello', { in: 'contents' }), 'search');
  const items = (found.body && found.body.items) || [];
  let first = null; try { first = JSON.parse(items[0].label); } catch (e) { first = null; }
  ok(asked.length === 1 && asked[0].q === 'hello' && asked[0].contents === 'yes', 'a search by contents asks fs.search { q, contents: yes }', 'asked: ' + short(asked));
  ok(first && first.path === 'docs/a.md' && first.size === 5 && first.line === 3 && items[1] && JSON.parse(items[1].label).kind === 'folder' && items[1].key === 'docs',
    'each find carries its facts from the file tree and its matched line; a folder comes without its trailing slash', 'items: ' + short(items));
  ok(o.score({ path: 'docs/a.md' }, { in: 'contents' }) === 0.9 && o.score({ path: 'docs/a.md' }, { in: 'names' }) === null, 'by contents a file ranks by the node\'s score; by names the list ranks', 'scores: ' + short([o.score({ path: 'docs/a.md' }, { in: 'contents' }), o.score({ path: 'docs/a.md' }, { in: 'names' })]));

  test.subHeading('the tree: folded folders, the app\'s types');
  const tree = (o.filters || []).filter(function (f) { return f.name === 'tree'; })[0];
  ok(!!tree && tree.when() === false, 'the tree filter is drawn as no button', 'filters: ' + short((o.filters || []).map(function (f) { return f.name; })));
  if (!tree) return;
  ok(tree.test({ path: 'docs', kind: 'folder' }) === 1 && tree.test({ path: 'docs/a.md', kind: 'file' }) === 0, 'no words: a folder shows, what is inside a folded one does not', 'test: ' + short([tree.test({ path: 'docs', kind: 'folder' }), tree.test({ path: 'docs/a.md', kind: 'file' })]));
  ok(o.fold({ kind: 'folder' }, 'docs') === true && tree.test({ path: 'docs/a.md', kind: 'file' }) === 1, 'a folder\'s press opens it, and is never a pick', 'after fold: ' + tree.test({ path: 'docs/a.md', kind: 'file' }));
  ok(tree.test({ path: 'docs/b.png', kind: 'file' }) === 0 && tree.test({ path: 'top.md', kind: 'file' }) === 1, 'opts.accept hides the files of other types, never a folder', 'png ' + tree.test({ path: 'docs/b.png', kind: 'file' }));
  ok(o.fold({ kind: 'file' }, 'top.md') === false, 'a file\'s press is no fold', 'fold of a file answered true');
  void list;

  // goal/G47.1, the box: "The file list has one always hidden option, \"flat\", set only in code by the app that draws the
  // list; no button shows or flips it", "With flat on: no folder rows, never the indented tree; with an empty field every
  // file the app accepts is listed, each with its path; typing narrows it", "With flat off, the default, the file list is
  // as it is today".
  test.subHeading('flat: set in code, no folders, never the tree');
  // A row shows when every filter of the list lets it through, drawn or not (spirit/element/search.js).
  function shows(opts, row) { return (opts.filters || []).every(function (f) { return typeof f.test !== 'function' || !!f.test(row); }); }
  function drawn(opts) { return (opts.filters || []).filter(function (f) { return typeof f.when !== 'function' || f.when() !== false; }).map(function (f) { return f.name; }); }
  const flatHost = hostNode();
  E.search.file.listElement.create(flatHost, { face: 'pane', accept: '.md', flat: true });
  await settle();
  const fl = lists[lists.length - 1];
  ok(!!fl && fl !== l && fl.host === flatHost.inner, 'a list made with flat on draws its own search', 'lists: ' + lists.length);
  if (!fl || fl === l) return;
  const fo = fl.o;
  ok(JSON.stringify(drawn(fo)) === JSON.stringify(drawn(o)), 'flat draws no button: its drawn filters are those of the default list', 'drawn: ' + short(drawn(fo)) + ', default ' + short(drawn(o)));
  fl.typed = '';
  ok(!shows(fo, { path: 'docs', kind: 'folder' }) && !shows(fo, { path: 'docs/deep', kind: 'folder' }), 'with flat on and an empty field no folder row shows', 'a folder shows');
  ok(shows(fo, { path: 'docs/deep/a.md', kind: 'file' }) && shows(fo, { path: 'top.md', kind: 'file' }), 'with flat on and an empty field every accepted file shows, however deep, no folder opened', 'deep ' + shows(fo, { path: 'docs/deep/a.md', kind: 'file' }) + ', top ' + shows(fo, { path: 'top.md', kind: 'file' }));
  ok(!shows(fo, { path: 'docs/b.png', kind: 'file' }), 'with flat on a file the app does not accept never shows', 'a .png shows');
  ok(!/files-tree/.test(flatHost.innerHTML) || flatHost.inner.classList.on === false, 'with flat on the list starts without the indented tree, so each row shows its path', 'host: ' + short(flatHost.innerHTML.slice(0, 160)));
  (flatHost.heard.input || []).forEach(function (fn) { fn(); });
  ok(flatHost.inner.classList.on === false, 'with flat on an empty field never brings the indented tree back', 'the tree class came back on input');
  fl.typed = 'a';
  (flatHost.heard.input || []).forEach(function (fn) { fn(); });
  ok(!shows(fo, { path: 'docs', kind: 'folder' }) && shows(fo, { path: 'docs/deep/a.md', kind: 'file' }), 'with flat on and words typed no folder row shows, and the files still do', 'folder ' + shows(fo, { path: 'docs', kind: 'folder' }));
  ok(fo.fold({ kind: 'file' }, 'top.md') === false, 'with flat on a file\'s press is no fold', 'fold of a file answered true');
  fl.typed = '';

  test.subHeading('flat off, the default: the list as it was');
  ok(/files-tree/.test(host.innerHTML) && shows(o, { path: 'docs', kind: 'folder' }), 'without flat the list starts as the tree, its folders shown', 'host: ' + short(host.innerHTML.slice(0, 160)));
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
