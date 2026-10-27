'use strict';

// spirit/run/shell/grants/test/grants.js
// The tests of shell/grants/grants.js, and of no other module (spec: ./grants.md; goal/G41.5). The browser file runs in
// node on a window of its own: the search list, the contacts dropdown, the api-branch selector and the node are stubs
// that keep what the app asked of them; the row element is the real one (shell/js/rowElement.js).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'grants.js');
const SRC = fs.readFileSync(FILE, 'utf8');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 20; i++) await tick(); };

// A node whose markup makes a child per tag; found by #id or [attr="value"], anywhere below it.
const byId = {};
function node(tag) {
  const heard = {}; let html = '';
  const n = { tag: tag || '', nodes: [], value: '', className: '', textContent: '', hidden: false, style: {}, kids: [],
    get innerHTML() { return html; },
    set innerHTML(v) {
      html = String(v); n.nodes = [];
      const re = /<([a-z]+)\b([^>]*)>/gi; let m;
      while ((m = re.exec(html))) {
        const c = node(m[0]);
        c.className = (/class="([^"]*)"/.exec(m[2]) || [])[1] || '';
        const id = /\sid="([^"]*)"/.exec(m[2]); if (id) byId[id[1]] = c;
        n.nodes.push(c);
      }
    },
    getAttribute: function (k) { const m = new RegExp('\\s' + k + '="([^"]*)"').exec(n.tag); return m ? m[1] : null; },
    querySelector: function (sel) { return n.querySelectorAll(sel)[0] || null; },
    querySelectorAll: function (sel) {
      const all = n.nodes.concat(n.kids);
      const id = /^#([\w-]+)$/.exec(sel);
      if (id) return all.filter(function (c) { return c.getAttribute('id') === id[1]; });
      const a = /^\[([\w-]+)="([^"]*)"\]$/.exec(sel);
      if (a) return all.filter(function (c) { return c.getAttribute(a[1]) === a[2]; });
      return [];
    },
    addEventListener: function (t, fn) { (heard[t] = heard[t] || []).push(fn); },
    dispatchEvent: function (e) { (heard[e.type] || []).slice().forEach(function (fn) { fn(e); }); return true; },
    fire: function (t, e) { (heard[t] || []).slice().forEach(function (fn) { fn(e); }); },
    appendChild: function (c) { n.kids.push(c); return c; },
    contains: function () { return true; },
    isConnected: true,
  };
  return n;
}

const TREE = { fs: { search: {}, loadFile: {} }, jobs: { list: {} } };
const GRANTS = [
  { name: 'Bob', key: 'K1', path: 'fs.search' },
  { name: 'Ann', key: 'K2', path: 'gone.verb' },
];

function world() {
  const w = { lists: [], contacts: [], branches: [], required: [], calls: [], def: null };
  const E = {
    probabilitySearch: { create: function (host, opts) { const l = { host: host, opts: opts, value: '', redrawn: 0, refreshed: 0,
      redraw: function () { l.redrawn += 1; }, refresh: function () { l.refreshed += 1; }, destroy: function () {} }; w.lists.push(l); return l; } },
    contactList: { create: function (host, opts) { const c = { host: host, opts: opts, list: { value: '', row: null } }; w.contacts.push(c); return c; } },
    createApiBranchSelector: function (opts) { const b = node('branch'); b.opts = opts; b.server = ''; b.verb = ''; b.value = ''; w.branches.push(b); return b; },
    shellCreateListSearch: function (host, opts) { w.oldList = { host: host, opts: opts }; return { redraw: function () {}, refresh: function () {} }; },
  };
  const api = {
    escapeHtml: function (s) { return String(s).replace(/</g, '&lt;'); },
    verb: function (name, args) {
      w.calls.push({ name: name, args: args });
      if (name === 'api') return Promise.resolve({ status: 200, body: TREE });
      if (name === 'auth.search') return Promise.resolve({ status: 200, body: { items: GRANTS.map(function (g) { return { key: g.key, label: JSON.stringify(g) }; }), more: false } });
      if (name === 'auth.revoke' || name === 'auth.grant') return Promise.resolve({ status: 200, body: { ok: true } });
      return Promise.resolve({ status: 200, body: {} });
    },
    ui: { elements: E },
  };
  const win = {
    spirit: { elements: E,
      require: function (p) { w.required.push(String(p)); return Promise.resolve(true); },
      shell: { activateApp: function (d) { w.def = d; } }, escapeHtml: api.escapeHtml },
    document: { createElement: function (t) { return node('<' + t + '>'); }, getElementById: function (id) { return byId[id] || null; } },
    Event: function (type) { this.type = type; },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String,
    console: { log: function () {}, error: function () {} }, confirm: function () { return true; },
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(RUN, 'shell', 'js', 'rowElement.js'), 'utf8'), win, { filename: 'rowElement.js' });
  vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', 'client', 'apiTreeIndex.js'), 'utf8'), win, { filename: 'apiTreeIndex.js' });
  vm.runInContext(SRC, win, { filename: FILE });
  w.win = win;
  w.api = api;
  return w;
}

test.startTest('grants.js: the Grants app');

(async function () {
  test.subHeading('nothing of the old shell\'s list search is left in it (goal/G40.8)');
  ok(!/shellCreateListSearch/.test(SRC), 'grants.js names no shellCreateListSearch', 'grants.js still names shellCreateListSearch');
  ok(!/api\.ui\.elements/.test(SRC), 'it takes its elements from what it loaded, not from the old shell\'s api.ui.elements', 'grants.js still reaches api.ui.elements');

  const w = world();
  ok(w.def && typeof w.def.mount === 'function', 'it mounts through spirit.shell.activateApp', 'no activateApp with mount');
  if (!w.def) return;

  test.subHeading('it loads what it uses itself (goal/G41.3)');
  ['shell/js/probabilitySearch.js', 'shell/js/rowElement.js', 'shell/js/contacts/listElement.js', 'shell/js/apiBranchSelector.js'].forEach(function (p) {
    ok(w.required.indexOf(p) !== -1, 'it requires ' + p, 'required: ' + short(w.required));
  });

  const box = node('container');
  await w.def.mount(box, w.api); await settle();

  test.subHeading('the grants list: a probabilitySearch pane in a box of a stated size (rule/16)');
  ok(!w.oldList, 'no old shell list is made', 'it made a shellCreateListSearch list');
  const list = w.lists.filter(function (l) { return l.opts && l.opts.face !== 'dropdown'; })[0];
  ok(!!list, 'its list is a probabilitySearch pane', 'lists made: ' + w.lists.length);
  if (!list) return;
  ok(/\bfill\b/.test(String(list.host.className || '')) || /class="fill"/.test(box.innerHTML), 'in a fill box', 'the list host: ' + short(box.innerHTML));
  const o = list.opts;
  const fields = (o.columns || []).map(function (c) { return c.field; });
  ok(['name', 'path', 'revoke'].every(function (f) { return fields.indexOf(f) !== -1; }), 'its columns: whose, the path, and Revoke', 'columns: ' + short(fields));
  ok(typeof o.rows === 'function' && o.rows().length === 2, 'its rows are every grant the node answered', 'rows: ' + short(typeof o.rows === 'function' ? o.rows() : null));

  test.subHeading('each row a row element, with its Revoke');
  const rows = typeof o.rows === 'function' ? o.rows() : [];
  ok(typeof o.element === 'function', 'the list draws each row with an element', 'no element(row, key)');
  if (typeof o.element !== 'function' || rows.length < 2) return;
  const live = o.element(rows[0], rows[0].key);
  const gone = o.element(rows[1], rows[1].key);
  const h1 = { name: node('td'), path: node('td'), revoke: node('td') };
  const h2 = { name: node('td'), path: node('td'), revoke: node('td') };
  live.mount(h1); gone.mount(h2);
  ok(/Bob/.test(h1.name.innerHTML) && /fs\.search/.test(h1.path.innerHTML), 'a row paints whose grant it is and its path', 'painted ' + short(h1.name.innerHTML + ' | ' + h1.path.innerHTML));
  ok(/data-action="revoke"/.test(h1.revoke.innerHTML) && /Revoke/.test(h1.revoke.innerHTML), 'a row has its own Revoke, a row action', 'revoke cell: ' + short(h1.revoke.innerHTML));
  ok(!/deprecated/.test(h1.path.innerHTML) && /deprecated/.test(h2.path.innerHTML), 'a grant no server serves today says deprecated; a live one does not', 'live ' + short(h1.path.innerHTML) + ' | gone ' + short(h2.path.innerHTML));

  test.subHeading('Revoke asks the node, and the list is redrawn from its answer (rule/19)');
  const before = w.calls.filter(function (c) { return c.name === 'auth.search'; }).length;
  const tr = node('<tr data-key="' + rows[0].key + '">');
  const btn = node('<button data-action="revoke">');
  btn.closest = function (sel) { return sel === '[data-action]' ? btn : sel === '[data-key]' ? tr : null; };
  list.host.fire('click', { target: btn });
  await settle();
  const rv = w.calls.filter(function (c) { return c.name === 'auth.revoke'; })[0];
  ok(rv && rv.args.key === 'K1' && rv.args.path === 'fs.search', 'a Revoke press asks auth.revoke for that key and path', 'calls: ' + short(w.calls.map(function (c) { return c.name; })));
  ok(w.calls.filter(function (c) { return c.name === 'auth.search'; }).length > before, 'and reads the grants again, drawing only what the node answers', 'no auth.search after revoke');

  test.subHeading('the line: whose access, the api branch, Grant');
  ok(w.contacts.length === 1 && w.contacts[0].opts.face === 'dropdown', 'whose access is the contacts list as a dropdown', 'contact lists: ' + short(w.contacts.map(function (c) { return c.opts.face; })));
  ok(w.branches.length === 1, 'the server and verb are the api-branch selector', 'branch selectors: ' + w.branches.length);
  if (!w.contacts.length || !w.branches.length) return;
  w.contacts[0].list.value = 'K1';
  w.branches[0].server = 'fs'; w.branches[0].value = 'fs';
  ok(o.rows().length === 1 && o.rows()[0].peer === 'K1', 'a chosen peer narrows the list to its grants', 'rows: ' + short(o.rows()));
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
