'use strict';

// spirit/run/spirit/element/search/file/test/list.js
// The tests of spirit/element/search/file/list.js, and of no other module (spec: ./list.md; goal/G30.20, goal/G41.16).
// The browser file runs in node on a BARE window (rule/26): nothing is on the page until the list requires it. Then the
// search element is a recorder in its place, so this tests the list and not the search under it; the row element and
// the file viewer are stand-ins; the page's data set is real, and so is the fs family's data.js (goal/G41.28),
// loaded with the fs family's api.js, as a page's spirit.requireScript('spirit/fs/api.js') loads it, the page's node known as spirit.startPage makes it known
// (spirit.nodeFacts.key, then data.homeNode). The node's fs family is the spirit object's.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
// A page script run as the page's loader runs it, in a module box (goal/G49.9).
const PAGE_LOAD = require(path.join(RUN, 'spirit', 'spirit.js')).requireScript('spirit/test/headLessChrome.js');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'spirit.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
const FILE = path.join(RUN, 'spirit', 'element', 'search', 'file', 'list.js');

const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

function hostNode() {
  const n = { innerHTML: '', kids: [], heard: {} };
  const inner = { classList: { on: true, toggle: function (c, v) { inner.classList.on = !!v; } }, addEventListener: function (t, fn) { (n.heard[t] = n.heard[t] || []).push(fn); } };
  Object.defineProperty(n, 'lastChild', { get: function () { return inner; } });
  n.inner = inner;
  return n;
}

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let required, loaded, lists, asked, D, E, F, picked, host, list, l, o, tree, flatHost, fl, fo;
// A row shows when every filter of the list lets it through, drawn or not (spirit/element/search.js).
function shows(opts, row) { return (opts.filters || []).every(function (f) { return typeof f.test !== 'function' || !!f.test(row); }); }
function drawn(opts) { return (opts.filters || []).filter(function (f) { return typeof f.when !== 'function' || f.when() !== false; }).map(function (f) { return f.name; }); }

test.run('the file list runs on a bare window, with the page\'s data set real', 0.2, async function () {
  if (!fs.existsSync(FILE)) return false;
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
    'spirit/element/search/file/row.js': function (E) { LOADER.requireScript('spirit/element/installSpiritElement.js')(global.window.spirit, 'spirit/element/search/file/row.js', { create: function (row) { return { kind: 'file', row: row }; } }); },
    'spirit/element/fstat.js': function (E) { E.fstat = { mimeOf: function (n) { return /\.png$/.test(n) ? 'image/png' : 'text/plain'; } }; },
  };
  global.window = { spirit: { escapeHtml: function (s) { return String(s); }, readyPromise: Promise.resolve({}), element: {} } };
  // goal/G43.32: the element places itself by installSpiritElement, as it runs (spirit/test/headLessChrome.js pageSpirit).
  LOADER.requireScript('spirit/test/headLessChrome.js').pageSpirit(window.spirit);
  global.spirit = global.window.spirit;
  vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', 'data.js'), 'utf8'), { filename: 'data.js' });
  D = global.window.spirit.required.spirit.data;
  // THE PAGE KNOWS ITS NODE (goal/G41.28): spirit.startPage asks node.card, keeps the key and hands it to the data set.
  const NODE_KEY = 'nOdE+key/one==';
  global.window.spirit.nodeFacts = { key: NODE_KEY };
  D.homeNode(NODE_KEY);
  // The fs family's api.js requires its companion data.js, as the real one does: the real file run once, attaching
  // itself to the data set. It answers the fs branch by that path (goal/G49.6: never by a name).
  let ran = false;
  global.window.spirit.requireScript = function (p) { required.push(String(p)); if (p === 'spirit/fs/api.js' && !ran) { ran = true; vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', 'fs', 'data.js'), 'utf8'), { filename: 'spirit/fs/data.js' }); } if (STANDS[p] && !STANDS[p].done) { STANDS[p].done = true; STANDS[p](((global.window.spirit.required.spirit = global.window.spirit.required.spirit || {}).element = global.window.spirit.required.spirit.element || {})); } return Promise.resolve(p === 'spirit/fs/api.js' ? fsFamily : true); };
  PAGE_LOAD.runAsPage(FILE);
  await settle();
  E = ((global.window.spirit.required || {}).spirit || {}).element || {};
  F = ((global.window.spirit.required.spirit.data || {}).fs || {}).data;
  // What was asked as it loaded, kept apart from what this process asks later (the runner's own reports go through the
  // same window.spirit.requireScript).
  loaded = required.slice();
  return true;
}, test.limit.quick);

// it loads what it uses itself (rule/26), and no data script
test.run('it requires its row element, the search element and the file viewer', 0.2, function () {
  if (!required) return false;
  return ['spirit/element/search/file/row.js', 'spirit/element/search.js', 'spirit/element/fstat.js'].every(function (p) { return required.indexOf(p) !== -1; }) ? true : false;
}, test.limit.quick);
// goal/G41.16, Andy: "get rid of thos FUCKING data.js scripts": what the stream means for the file tree is the fs family's
// data.js's (goal/G41.28), which only the fs api.js requires (goal/G47.1).
test.run('as it loads, it requires no data script, as only an api.js requires its data.js', 0.2, function () {
  if (!loaded) return false;
  return !loaded.some(function (p) { return /data\.js$/.test(p); }) ? true : false;
}, test.limit.quick);
test.run('it requires the fs branch\'s interface, spirit/fs/api.js, which puts the fs branch\'s data on the page', 0.2, function () {
  if (!loaded) return false;
  return loaded.indexOf('spirit/fs/api.js') !== -1 && F && typeof F.file === 'function' ? true : false;
}, test.limit.quick);
test.run('it registers spirit.required.spirit.element.search.file.list.create', 0.2, function () {
  if (!F || typeof F.file !== 'function') return false;
  return E.search.file && E.search.file.list && typeof E.search.file.list.create === 'function' ? true : false;
}, test.limit.quick);

// a view of the node's file tree
test.run('it draws one probabilitySearch into a fill box of its host', 0.2, async function () {
  if (!F || typeof F.file !== 'function') return false;
  if (!E.search.file || !E.search.file.list || typeof E.search.file.list.create !== 'function') return false;
  picked = [];
  host = hostNode();
  list = E.search.file.list.create(host, { face: 'pane', accept: '.md', pick: function (row, key) { picked.push(key); } });
  await settle();
  l = lists[0];
  if (l) o = l.o;
  return !!l && l.host === host.inner && /files-tree/.test(host.innerHTML) && /fill/.test(host.innerHTML) ? true : false;
}, test.limit.quick);
test.run('it is a view of the fs branch\'s file tree in spirit.required.spirit.data.fs.data.branch, in path order, filled as it is drawn', 0.2, function () {
  if (!l) return false;
  return typeof F.branch === 'string' && F.branch !== '' && o.data === F.branch && l.refreshes === 1 && JSON.stringify(l.sorted) === '["name","asc"]' ? true : false;
}, test.limit.quick);
test.run('its columns are name, size and changed', 0.2, function () {
  if (!l) return false;
  return JSON.stringify((o.columns || []).map(function (c) { return c.field; })) === '["name","size","changed"]' ? true : false;
}, test.limit.quick);
test.run('each row is a fileElement of its path', 0.2, function () {
  if (!l) return false;
  const el = o.element({ kind: 'file' }, 'docs/a.md');
  return el && el.kind === 'file' && el.row.path === 'docs/a.md' ? true : false;
}, test.limit.quick);
test.run('a picked file is shown by its path', 0.2, function () {
  if (!l) return false;
  return o.name({ path: 'docs/a.md' }) === 'docs/a.md' ? true : false;
}, test.limit.quick);
test.run('a pick reaches opts.pick', 0.2, function () {
  if (!l) return false;
  o.pick({ path: 'docs/a.md' }, 'docs/a.md');
  return picked.length === 1 && picked[0] === 'docs/a.md' ? true : false;
}, test.limit.quick);

// names from the mirror; fs.search only by contents
let found;
test.run('a search of names asks the node nothing: the mirror answers it', 0.2, async function () {
  if (!l) return false;
  const none = await o.search(o.args('a', { in: 'names' }), 'search');
  return asked.length === 0 && none.body && none.body.items.length === 0 ? true : false;
}, test.limit.quick);
test.run('a search by contents asks fs.search with the words as q and contents set to yes', 0.2, async function () {
  if (!l) return false;
  D.takeJob({ id: 'spirit.fs', data: { command: { op: 'createFile', path: 'docs/a.md', size: 5, modified: '2030-01-01T00:00:00Z' } } });
  found = await o.search(o.args('hello', { in: 'contents' }), 'search');
  return asked.length === 1 && asked[0].q === 'hello' && asked[0].contents === true ? true : false;
}, test.limit.quick);
test.run('each find carries its facts from the file tree and its matched line; a folder comes without its trailing slash', 0.2, function () {
  if (!found) return false;
  const items = (found.body && found.body.items) || [];
  let first = null; try { first = JSON.parse(items[0].label); } catch (e) { first = null; }
  return first && first.path === 'docs/a.md' && first.size === 5 && first.line === 3 && items[1] && JSON.parse(items[1].label).kind === 'folder' && items[1].key === 'docs' ? true : false;
}, test.limit.quick);
test.run('searched by contents a file ranks by the node\'s score, and searched by names the list ranks it', 0.2, function () {
  if (!l) return false;
  return o.score({ path: 'docs/a.md' }, { in: 'contents' }) === 0.9 && o.score({ path: 'docs/a.md' }, { in: 'names' }) === null ? true : false;
}, test.limit.quick);

// the tree: folded folders, the app's types
test.run('the tree filter is drawn as no button', 0.2, function () {
  if (!l) return false;
  tree = (o.filters || []).filter(function (f) { return f.name === 'tree'; })[0];
  return !!tree && tree.when() === false ? true : false;
}, test.limit.quick);
test.run('with no words typed a folder shows, and what is inside a folded one does not', 0.2, function () {
  if (!tree) return false;
  return tree.test({ path: 'docs', kind: 'folder' }) === 1 && tree.test({ path: 'docs/a.md', kind: 'file' }) === 0 ? true : false;
}, test.limit.quick);
test.run('a folder\'s press opens it, and is never a pick', 0.2, function () {
  if (!tree) return false;
  return o.fold({ kind: 'folder' }, 'docs') === true && tree.test({ path: 'docs/a.md', kind: 'file' }) === 1 ? true : false;
}, test.limit.quick);
test.run('opts.accept hides the files of other types, never a folder', 0.2, function () {
  if (!tree) return false;
  return tree.test({ path: 'docs/b.png', kind: 'file' }) === 0 && tree.test({ path: 'top.md', kind: 'file' }) === 1 ? true : false;
}, test.limit.quick);
test.run('a file\'s press is no fold', 0.2, function () {
  if (!tree) return false;
  return o.fold({ kind: 'file' }, 'top.md') === false ? true : false;
}, test.limit.quick);

// goal/G47.1, the box: "The file list has one always hidden option, \"flat\", set only in code by the app that draws the
// list; no button shows or flips it", "With flat on: no folder rows, never the indented tree; with an empty field every
// file the app accepts is listed, each with its path; typing narrows it", "With flat off, the default, the file list is
// as it is today".
// flat: set in code, no folders, never the tree
test.run('a list made with flat on draws its own search', 0.2, async function () {
  if (!l) return false;
  flatHost = hostNode();
  E.search.file.list.create(flatHost, { face: 'pane', accept: '.md', flat: true });
  await settle();
  const last = lists[lists.length - 1];
  const good = !!last && last !== l && last.host === flatHost.inner;
  if (last && last !== l) { fl = last; fo = fl.o; }
  return good ? true : false;
}, test.limit.quick);
test.run('flat draws no button, so its drawn filters are those of the default list', 0.2, function () {
  if (!fl) return false;
  return JSON.stringify(drawn(fo)) === JSON.stringify(drawn(o)) ? true : false;
}, test.limit.quick);
test.run('with flat on and an empty field no folder row shows', 0.2, function () {
  if (!fl) return false;
  fl.typed = '';
  return !shows(fo, { path: 'docs', kind: 'folder' }) && !shows(fo, { path: 'docs/deep', kind: 'folder' }) ? true : false;
}, test.limit.quick);
test.run('with flat on and an empty field every accepted file shows, however deep, no folder opened', 0.2, function () {
  if (!fl) return false;
  return shows(fo, { path: 'docs/deep/a.md', kind: 'file' }) && shows(fo, { path: 'top.md', kind: 'file' }) ? true : false;
}, test.limit.quick);
test.run('with flat on a file the app does not accept never shows', 0.2, function () {
  if (!fl) return false;
  return !shows(fo, { path: 'docs/b.png', kind: 'file' }) ? true : false;
}, test.limit.quick);
test.run('with flat on the list starts without the indented tree, so each row shows its path', 0.2, function () {
  if (!fl) return false;
  return !/files-tree/.test(flatHost.innerHTML) || flatHost.inner.classList.on === false ? true : false;
}, test.limit.quick);
test.run('with flat on an empty field never brings the indented tree back', 0.2, function () {
  if (!fl) return false;
  (flatHost.heard.input || []).forEach(function (fn) { fn(); });
  return flatHost.inner.classList.on === false ? true : false;
}, test.limit.quick);
test.run('with flat on and words typed no folder row shows, and the files still do', 0.2, function () {
  if (!fl) return false;
  fl.typed = 'a';
  (flatHost.heard.input || []).forEach(function (fn) { fn(); });
  return !shows(fo, { path: 'docs', kind: 'folder' }) && shows(fo, { path: 'docs/deep/a.md', kind: 'file' }) ? true : false;
}, test.limit.quick);
test.run('with flat on a file\'s press is no fold', 0.2, function () {
  if (!fl) return false;
  const r = fo.fold({ kind: 'file' }, 'top.md') === false;
  fl.typed = '';
  return r ? true : false;
}, test.limit.quick);

// flat off, the default: the list as it was
test.run('without flat the list starts as the tree, its folders shown', 0.2, function () {
  if (!l) return false;
  return /files-tree/.test(host.innerHTML) && shows(o, { path: 'docs', kind: 'folder' }) ? true : false;
}, test.limit.quick);
