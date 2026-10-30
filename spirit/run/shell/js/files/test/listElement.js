'use strict';

// spirit/run/shell/js/files/test/listElement.js
// The tests of shell/js/files/listElement.js, and of no other module (spec: ./listElement.md; goal/G30.20, goal/G41.16).
// The browser file runs in node on a BARE window (rule/26): nothing is on the page until the list requires it. Then the
// search element is a recorder in its place, so this tests the list and not the search under it; the row element and
// the file viewer are stand-ins; the page's data set is real. The node's fs family is the spirit object's.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(RUN, 'shell', 'js', 'files', 'listElement.js');

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
  if (!fs.existsSync(FILE)) { test.fail('shell/js/files/listElement.js is not there'); return; }
  const required = [];
  const lists = [];
  const asked = [];
  const fsFamily = { search: function (a) { asked.push(a); return Promise.resolve({ items: [{ key: 'docs/a.md', label: JSON.stringify({ path: 'docs/a.md', score: 0.9, line: 3 }) }, { key: 'docs/', label: JSON.stringify({ path: 'docs/', score: 0.2 }) }], more: false }); } };
  const STANDS = {
    'shell/js/probabilitySearch.js': function (E) { E.probabilitySearch = { create: function (host, o) {
      const l = { host: host, o: o, refreshes: 0, sorted: null, typed: '', refresh: function () { l.refreshes += 1; }, redraw: function () {}, destroy: function () {},
        sort: function (f, d) { l.sorted = [f, d]; }, words: function () { return l.typed; } };
      lists.push(l); return l;
    } }; },
    'shell/js/files/rowElement.js': function (E) { E.fileElement = { create: function (row) { return { kind: 'file', row: row }; } }; },
    'shell/js/fileViewer.js': function (E) { E.fileViewer = { mimeOf: function (n) { return /\.png$/.test(n) ? 'image/png' : 'text/plain'; } }; },
  };
  global.window = { spirit: { escapeHtml: function (s) { return String(s); }, ready: Promise.resolve({ fs: fsFamily }), fs: fsFamily, elements: {} } };
  global.spirit = global.window.spirit;
  vm.runInThisContext(fs.readFileSync(path.join(RUN, 'shell', 'shared', 'js', 'spiritData.js'), 'utf8'), { filename: 'spiritData.js' });
  const D = global.window.spirit.data;
  global.window.spirit.require = function (p) { required.push(String(p)); if (STANDS[p] && !STANDS[p].done) { STANDS[p].done = true; STANDS[p](global.window.spirit.elements); } return Promise.resolve(true); };
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  await settle();
  const E = global.window.spirit.elements;

  test.subHeading('it loads what it uses itself (rule/26), and no data script');
  ok(['shell/js/files/rowElement.js', 'shell/js/probabilitySearch.js', 'shell/js/fileViewer.js'].every(function (p) { return required.indexOf(p) !== -1; }), 'it requires its row element, the search element and the file viewer', 'required: ' + short(required));
  // goal/G41.16, Andy: "get rid of thos FUCKING data.js scripts": what the stream means for the file tree is the row element's.
  ok(!required.some(function (p) { return /data\.js$/.test(p); }), 'and no data script: the file tree\'s stream is its row element\'s', 'required: ' + short(required));
  ok(E.fileList && typeof E.fileList.create === 'function', 'it registers spirit.elements.fileList.create', 'elements: ' + short(Object.keys(E)));
  if (!E.fileList || typeof E.fileList.create !== 'function') return;

  test.subHeading('a view of data.files, the node\'s tree');
  const picked = [];
  const host = hostNode();
  const list = E.fileList.create(host, { face: 'pane', accept: '.md', pick: function (row, key) { picked.push(key); } });
  await settle();
  const l = lists[0];
  ok(!!l && l.host === host.inner && /files-tree/.test(host.innerHTML) && /fill/.test(host.innerHTML), 'it draws one probabilitySearch into a fill box of its host', 'host: ' + short(host.innerHTML.slice(0, 120)));
  if (!l) return;
  const o = l.o;
  ok(o.data === 'files' && l.refreshes === 1 && JSON.stringify(l.sorted) === '["name","asc"]', 'it is a view of data.files, in path order, filled as it is drawn', 'data ' + short(o.data) + ', sorted ' + short(l.sorted) + ', refreshes ' + l.refreshes);
  ok(JSON.stringify((o.columns || []).map(function (c) { return c.field; })) === '["name","size","changed"]', 'its columns are name, size and changed', 'columns: ' + short(o.columns));
  const el = o.element({ kind: 'file' }, 'docs/a.md');
  ok(el && el.kind === 'file' && el.row.path === 'docs/a.md', 'each row is a fileElement of its path', 'element: ' + short(el));
  ok(o.name({ path: 'docs/a.md' }) === 'docs/a.md', 'a picked file is shown by its path', 'name: ' + short(o.name({ path: 'docs/a.md' })));
  o.pick({ path: 'docs/a.md' }, 'docs/a.md');
  ok(picked.length === 1 && picked[0] === 'docs/a.md', 'a pick reaches opts.pick', 'picked: ' + short(picked));

  test.subHeading('names from the mirror; fs.search only by contents');
  const none = await o.api.verb('fs.search', o.args('a', { in: 'names' }));
  ok(asked.length === 0 && none.body && none.body.items.length === 0, 'a search of names asks the node nothing: the mirror answers it', 'asked: ' + short(asked));
  D.set('files/docs/a.md', { kind: 'file', size: 5, modified: '2030-01-01T00:00:00Z' });
  const found = await o.api.verb('fs.search', o.args('hello', { in: 'contents' }));
  const items = (found.body && found.body.items) || [];
  let first = null; try { first = JSON.parse(items[0].label); } catch (e) { first = null; }
  ok(asked.length === 1 && asked[0].q === 'hello' && asked[0].contents === 'yes', 'a search by contents asks fs.search { q, contents: yes }', 'asked: ' + short(asked));
  ok(first && first.path === 'docs/a.md' && first.size === 5 && first.line === 3 && items[1] && JSON.parse(items[1].label).kind === 'folder' && items[1].key === 'docs',
    'each find carries its facts from data.files and its matched line; a folder comes without its trailing slash', 'items: ' + short(items));
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
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
