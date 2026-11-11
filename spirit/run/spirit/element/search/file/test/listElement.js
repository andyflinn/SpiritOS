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

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

function hostNode() {
  const n = { innerHTML: '', kids: [], heard: {} };
  const inner = { classList: { on: true, toggle: function (c, v) { inner.classList.on = !!v; } }, addEventListener: function (t, fn) { (n.heard[t] = n.heard[t] || []).push(fn); } };
  Object.defineProperty(n, 'lastChild', { get: function () { return inner; } });
  n.inner = inner;
  return n;
}

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let required, lists, asked, D, managers, E, F, picked, host, list, l, o, tree, flatHost, fl, fo;
// A row shows when every filter of the list lets it through, drawn or not (spirit/element/search.js).
function shows(opts, row) { return (opts.filters || []).every(function (f) { return typeof f.test !== 'function' || !!f.test(row); }); }
function drawn(opts) { return (opts.filters || []).filter(function (f) { return typeof f.when !== 'function' || f.when() !== false; }).map(function (f) { return f.name; }); }
const NO_F = 'no file tree on the page: the fs family\'s cache manager never put one there';
const NO_LIST = 'no list element registered';
const NO_SEARCH = 'the list drew no search';

test.run('the world: the list runs on a bare window, the page\'s data set real', 0.2, async function () {
  if (!fs.existsSync(FILE)) return 'spirit/element/search/file/listElement.js is not there';
  required = [];
  lists = [];
  asked = [];
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
  D = global.window.spirit.data;
  // THE PAGE KNOWS ITS NODE (goal/G41.28): spirit.start asks node.card, keeps the key and hands it to the data set.
  const NODE_KEY = 'nOdE+key/one==';
  global.window.spirit.node = { key: NODE_KEY };
  D.homeNode(NODE_KEY);
  // spirit.cacheManager(name), as a page's: the family's manager loaded once, attaching itself to the data set.
  managers = [];
  global.window.spirit.cacheManager = function (name) {
    managers.push(String(name));
    vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', String(name), 'data.js'), 'utf8'), { filename: name + '/data.js' });
    return Promise.resolve(true);
  };
  global.window.spirit.require = function (p) { required.push(String(p)); if (STANDS[p] && !STANDS[p].done) { STANDS[p].done = true; STANDS[p](((global.window.spirit.element.spirit = global.window.spirit.element.spirit || {}).element = global.window.spirit.element.spirit.element || {})); } return Promise.resolve(true); };
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  await settle();
  E = ((global.window.spirit.element || {}).spirit || {}).element || {};
  F = ((global.window.spirit.data || {}).fs || {}).data;
  return true;
}, 1000);

// it loads what it uses itself (rule/26), and no data script
test.run('it requires its row element, the search element and the file viewer', 0.2, function () {
  if (!required) return 'the list never ran: the world failed';
  return ['spirit/element/search/file/rowElement.js', 'spirit/element/search.js', 'spirit/element/fstat.js'].every(function (p) { return required.indexOf(p) !== -1; }) ? true : 'required: ' + short(required);
}, 1000);
// goal/G41.16, Andy: "get rid of thos FUCKING data.js scripts": what the stream means for the file tree is the fs family's cache manager's (goal/G41.28).
test.run('and no data script: the file tree\'s stream is its row element\'s', 0.2, function () {
  if (!required) return 'the list never ran: the world failed';
  return !required.some(function (p) { return /data\.js$/.test(p); }) ? true : 'required: ' + short(required);
}, 1000);
test.run('it loads the fs family\'s cache manager, which puts ((spirit.data || {}).fs || {}).data on the page', 0.2, function () {
  if (!managers) return 'the list never ran: the world failed';
  return managers.indexOf('fs') !== -1 && F && typeof F.file === 'function' ? true : 'managers: ' + short(managers);
}, 1000);
test.run('it registers spirit.element.spirit.element.search.file.listElement.create', 0.2, function () {
  if (!F || typeof F.file !== 'function') return NO_F;
  return E.search.file && E.search.file.listElement && typeof E.search.file.listElement.create === 'function' ? true : 'elements: ' + short(Object.keys(E));
}, 1000);

// a view of the node's file tree
test.run('it draws one probabilitySearch into a fill box of its host', 0.2, async function () {
  if (!F || typeof F.file !== 'function') return NO_F;
  if (!E.search.file || !E.search.file.listElement || typeof E.search.file.listElement.create !== 'function') return NO_LIST;
  picked = [];
  host = hostNode();
  list = E.search.file.listElement.create(host, { face: 'pane', accept: '.md', pick: function (row, key) { picked.push(key); } });
  await settle();
  l = lists[0];
  if (l) o = l.o;
  return !!l && l.host === host.inner && /files-tree/.test(host.innerHTML) && /fill/.test(host.innerHTML) ? true : 'host: ' + short(host ? host.innerHTML.slice(0, 120) : host);
}, 1000);
test.run('it is a view of the fs family\'s file tree (spirit.data.fs.data.branch), in path order, filled as it is drawn', 0.2, function () {
  if (!l) return NO_SEARCH;
  return typeof F.branch === 'string' && F.branch !== '' && o.data === F.branch && l.refreshes === 1 && JSON.stringify(l.sorted) === '["name","asc"]' ? true : 'data ' + short(o.data) + ' (fsReads.branch ' + short(F.branch) + ')' + ', sorted ' + short(l.sorted) + ', refreshes ' + l.refreshes;
}, 1000);
test.run('its columns are name, size and changed', 0.2, function () {
  if (!l) return NO_SEARCH;
  return JSON.stringify((o.columns || []).map(function (c) { return c.field; })) === '["name","size","changed"]' ? true : 'columns: ' + short(o.columns);
}, 1000);
test.run('each row is a fileElement of its path', 0.2, function () {
  if (!l) return NO_SEARCH;
  const el = o.element({ kind: 'file' }, 'docs/a.md');
  return el && el.kind === 'file' && el.row.path === 'docs/a.md' ? true : 'element: ' + short(el);
}, 1000);
test.run('a picked file is shown by its path', 0.2, function () {
  if (!l) return NO_SEARCH;
  return o.name({ path: 'docs/a.md' }) === 'docs/a.md' ? true : 'name: ' + short(o.name({ path: 'docs/a.md' }));
}, 1000);
test.run('a pick reaches opts.pick', 0.2, function () {
  if (!l) return NO_SEARCH;
  o.pick({ path: 'docs/a.md' }, 'docs/a.md');
  return picked.length === 1 && picked[0] === 'docs/a.md' ? true : 'picked: ' + short(picked);
}, 1000);

// names from the mirror; fs.search only by contents
let found;
test.run('a search of names asks the node nothing: the mirror answers it', 0.2, async function () {
  if (!l) return NO_SEARCH;
  const none = await o.search(o.args('a', { in: 'names' }), 'search');
  return asked.length === 0 && none.body && none.body.items.length === 0 ? true : 'asked: ' + short(asked);
}, 1000);
test.run('a search by contents asks fs.search { q, contents: yes }', 0.2, async function () {
  if (!l) return NO_SEARCH;
  D.takeJob({ id: 'spirit.fs', data: { command: { op: 'createFile', path: 'docs/a.md', size: 5, modified: '2030-01-01T00:00:00Z' } } });
  found = await o.search(o.args('hello', { in: 'contents' }), 'search');
  return asked.length === 1 && asked[0].q === 'hello' && asked[0].contents === 'yes' ? true : 'asked: ' + short(asked);
}, 1000);
test.run('each find carries its facts from the file tree and its matched line; a folder comes without its trailing slash', 0.2, function () {
  if (!found) return 'no search by contents was made';
  const items = (found.body && found.body.items) || [];
  let first = null; try { first = JSON.parse(items[0].label); } catch (e) { first = null; }
  return first && first.path === 'docs/a.md' && first.size === 5 && first.line === 3 && items[1] && JSON.parse(items[1].label).kind === 'folder' && items[1].key === 'docs' ? true : 'items: ' + short(items);
}, 1000);
test.run('by contents a file ranks by the node\'s score; by names the list ranks', 0.2, function () {
  if (!l) return NO_SEARCH;
  return o.score({ path: 'docs/a.md' }, { in: 'contents' }) === 0.9 && o.score({ path: 'docs/a.md' }, { in: 'names' }) === null ? true : 'scores: ' + short([o.score({ path: 'docs/a.md' }, { in: 'contents' }), o.score({ path: 'docs/a.md' }, { in: 'names' })]);
}, 1000);

// the tree: folded folders, the app's types
const NO_TREE = 'the list has no tree filter';
test.run('the tree filter is drawn as no button', 0.2, function () {
  if (!l) return NO_SEARCH;
  tree = (o.filters || []).filter(function (f) { return f.name === 'tree'; })[0];
  return !!tree && tree.when() === false ? true : 'filters: ' + short((o.filters || []).map(function (f) { return f.name; }));
}, 1000);
test.run('no words: a folder shows, what is inside a folded one does not', 0.2, function () {
  if (!tree) return NO_TREE;
  return tree.test({ path: 'docs', kind: 'folder' }) === 1 && tree.test({ path: 'docs/a.md', kind: 'file' }) === 0 ? true : 'test: ' + short([tree.test({ path: 'docs', kind: 'folder' }), tree.test({ path: 'docs/a.md', kind: 'file' })]);
}, 1000);
test.run('a folder\'s press opens it, and is never a pick', 0.2, function () {
  if (!tree) return NO_TREE;
  return o.fold({ kind: 'folder' }, 'docs') === true && tree.test({ path: 'docs/a.md', kind: 'file' }) === 1 ? true : 'after fold: ' + tree.test({ path: 'docs/a.md', kind: 'file' });
}, 1000);
test.run('opts.accept hides the files of other types, never a folder', 0.2, function () {
  if (!tree) return NO_TREE;
  return tree.test({ path: 'docs/b.png', kind: 'file' }) === 0 && tree.test({ path: 'top.md', kind: 'file' }) === 1 ? true : 'png ' + tree.test({ path: 'docs/b.png', kind: 'file' });
}, 1000);
test.run('a file\'s press is no fold', 0.2, function () {
  if (!tree) return NO_TREE;
  return o.fold({ kind: 'file' }, 'top.md') === false ? true : 'fold of a file answered true';
}, 1000);

// goal/G47.1, the box: "The file list has one always hidden option, \"flat\", set only in code by the app that draws the
// list; no button shows or flips it", "With flat on: no folder rows, never the indented tree; with an empty field every
// file the app accepts is listed, each with its path; typing narrows it", "With flat off, the default, the file list is
// as it is today".
// flat: set in code, no folders, never the tree
const NO_FLAT = 'no list was drawn with flat on';
test.run('a list made with flat on draws its own search', 0.2, async function () {
  if (!l) return NO_SEARCH;
  flatHost = hostNode();
  E.search.file.listElement.create(flatHost, { face: 'pane', accept: '.md', flat: true });
  await settle();
  const last = lists[lists.length - 1];
  const good = !!last && last !== l && last.host === flatHost.inner;
  if (last && last !== l) { fl = last; fo = fl.o; }
  return good ? true : 'lists: ' + lists.length;
}, 1000);
test.run('flat draws no button: its drawn filters are those of the default list', 0.2, function () {
  if (!fl) return NO_FLAT;
  return JSON.stringify(drawn(fo)) === JSON.stringify(drawn(o)) ? true : 'drawn: ' + short(drawn(fo)) + ', default ' + short(drawn(o));
}, 1000);
test.run('with flat on and an empty field no folder row shows', 0.2, function () {
  if (!fl) return NO_FLAT;
  fl.typed = '';
  return !shows(fo, { path: 'docs', kind: 'folder' }) && !shows(fo, { path: 'docs/deep', kind: 'folder' }) ? true : 'a folder shows';
}, 1000);
test.run('with flat on and an empty field every accepted file shows, however deep, no folder opened', 0.2, function () {
  if (!fl) return NO_FLAT;
  return shows(fo, { path: 'docs/deep/a.md', kind: 'file' }) && shows(fo, { path: 'top.md', kind: 'file' }) ? true : 'deep ' + shows(fo, { path: 'docs/deep/a.md', kind: 'file' }) + ', top ' + shows(fo, { path: 'top.md', kind: 'file' });
}, 1000);
test.run('with flat on a file the app does not accept never shows', 0.2, function () {
  if (!fl) return NO_FLAT;
  return !shows(fo, { path: 'docs/b.png', kind: 'file' }) ? true : 'a .png shows';
}, 1000);
test.run('with flat on the list starts without the indented tree, so each row shows its path', 0.2, function () {
  if (!fl) return NO_FLAT;
  return !/files-tree/.test(flatHost.innerHTML) || flatHost.inner.classList.on === false ? true : 'host: ' + short(flatHost.innerHTML.slice(0, 160));
}, 1000);
test.run('with flat on an empty field never brings the indented tree back', 0.2, function () {
  if (!fl) return NO_FLAT;
  (flatHost.heard.input || []).forEach(function (fn) { fn(); });
  return flatHost.inner.classList.on === false ? true : 'the tree class came back on input';
}, 1000);
test.run('with flat on and words typed no folder row shows, and the files still do', 0.2, function () {
  if (!fl) return NO_FLAT;
  fl.typed = 'a';
  (flatHost.heard.input || []).forEach(function (fn) { fn(); });
  return !shows(fo, { path: 'docs', kind: 'folder' }) && shows(fo, { path: 'docs/deep/a.md', kind: 'file' }) ? true : 'folder ' + shows(fo, { path: 'docs', kind: 'folder' });
}, 1000);
test.run('with flat on a file\'s press is no fold', 0.2, function () {
  if (!fl) return NO_FLAT;
  const r = fo.fold({ kind: 'file' }, 'top.md') === false;
  fl.typed = '';
  return r ? true : 'fold of a file answered true';
}, 1000);

// flat off, the default: the list as it was
test.run('without flat the list starts as the tree, its folders shown', 0.2, function () {
  if (!l) return NO_SEARCH;
  return /files-tree/.test(host.innerHTML) && shows(o, { path: 'docs', kind: 'folder' }) ? true : 'host: ' + short(host.innerHTML.slice(0, 160));
}, 1000);
