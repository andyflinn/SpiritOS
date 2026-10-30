'use strict';

// spirit/run/shell/grants/test/grants.js
// The tests of shell/grants/grants.js, and of no other module (spec: ./grants.md; goal/G41.5, goal/G41.13, goal/G41.14,
// goal/G41.16). Since G41.16 the app is a wrapper: its Grants tab is the grants panel (shell/js/grantsPanel.js, tested in
// its own file), configured by this app for contacts and the node's grants. The browser file runs in node on a BARE
// window (rule/26): each element is put on the page only once the app requires it, a stand-in that keeps what the app
// handed it. The node is a stub that answers and keeps every ask.

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

function world() {
  const w = { required: [], calls: [], def: null, tabs: [], editors: [], panels: [] };
  const E = {
    tabContainer: { create: function (host, opts) { const t = { host: host, opts: opts || {} }; w.tabs.push(t); return t; } },
    bundleEditor: { create: function (host, opts) { const e = { host: host, opts: opts || {} }; w.editors.push(e); return e; } },
    grantsPanel: { create: function (host, cfg) { const p = { host: host, cfg: cfg || {} }; w.panels.push(p); return p; } },
  };
  const api = {
    escapeHtml: function (s) { return String(s); },
    verb: function (name, args) { w.calls.push({ name: name, args: args });
      // auth.search answers whose grant it is as name (apiAuth.js search), the stream as label.
      if (name === 'auth.search') return Promise.resolve({ status: 200, body: { ok: true, items: [{ key: 'K1\nfs.search', label: JSON.stringify({ name: 'Bob', key: 'K1', path: 'fs.search' }) }], more: false } });
      if (name === 'auth.grant' && args && args.path === 'fs.search') return Promise.resolve({ status: 409, body: { ok: false, code: 'already-granted', error: 'already granted' } });
      return Promise.resolve({ status: 200, body: { ok: true } }); },
    ui: { elements: {} },
  };
  const FILES = { 'shell/js/tabContainer.js': ['tabContainer'], 'shell/js/bundleEditor.js': ['bundleEditor'], 'shell/js/grantsPanel.js': ['grantsPanel'] };
  const page = {};
  const win = {
    spirit: { elements: page,
      require: function (p) { w.required.push(String(p)); (FILES[p] || []).forEach(function (k) { page[k] = E[k]; }); return Promise.resolve(true); },
      shell: { activateApp: function (d) { w.def = d; } }, escapeHtml: api.escapeHtml },
    document: { createElement: function (t) { return node('<' + t + '>'); } },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number,
    console: { log: function () {}, error: function () {} },
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(SRC, win, { filename: FILE });
  w.win = win; w.api = api;
  return w;
}

test.startTest('grants.js: the Grants app, a wrapper of the grants panel');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  const code = SRC.replace(/\/\/.*$/gm, '');
  test.subHeading('nothing of the old shell is left in it');
  ok(!/shellCreateListSearch|api\.ui\.elements|apiBranchSelector/.test(code), 'grants.js names no shellCreateListSearch, no api.ui.elements, no apiBranchSelector', 'grants.js still names one');

  const w = world();
  ok(w.def && typeof w.def.mount === 'function', 'it mounts through spirit.shell.activateApp', 'no activateApp with mount');
  if (!w.def) return;

  test.subHeading('a wrapper: it loads the panel, the tabs and the bundle editor, and nothing it draws itself');
  ['shell/js/grantsPanel.js', 'shell/js/tabContainer.js', 'shell/js/bundleEditor.js'].forEach(function (p) {
    ok(w.required.indexOf(p) !== -1, 'it requires ' + p, 'required: ' + short(w.required));
  });
  // goal/G41.16: "the shell app shell/grans/grants/ must be a wrapper for a new shell element: shell/js/grantsPanel.js".
  // The selectors by either shape: createContactSelector, or contactSelector.create (goal/G41.19).
  ok(!/innerHTML|createElement|probabilitySearch|grantList|[cC]ontactSelector|[bB]undleSelector|[aA]piFamilySelector/.test(code) && !w.required.some(function (p) { return /data\.js$/.test(p); }),
    'it draws nothing itself: no markup, no list, no selector of its own, no data script', 'grants.js still draws or builds something of its own');

  const app = node('container');
  await w.def.mount(app, w.api); await settle();

  test.subHeading('two tabs: Grants, the grants panel; Bundles, the bundle editor');
  const tabs = w.tabs[0];
  const names = tabs ? (tabs.opts.tabs || []).map(function (t) { return t && t.name; }) : [];
  ok(w.tabs.length === 1 && JSON.stringify(names) === '["grants","bundles"]', 'one tabContainer with the tabs grants and bundles', 'tabs: ' + short(names));
  if (!tabs || names.length !== 2) return;
  const gbox = node('grants-tab');
  await tabs.opts.tabs[0].mount(gbox); await settle();
  const bbox = node('bundles-tab');
  await tabs.opts.tabs[1].mount(bbox); await settle();
  ok(w.editors.length === 1 && w.editors[0].host === bbox && w.editors[0].opts.api === w.api, 'the Bundles tab is the bundle editor, with the app\'s api', 'editors: ' + w.editors.length);
  const p = w.panels[0];
  ok(w.panels.length === 1 && p.host === gbox && p.cfg.api === w.api, 'the Grants tab is the grants panel, in its own box, with the app\'s api', 'panels: ' + w.panels.length);
  if (!p) return;

  test.subHeading('the app configures it: contacts, and the node\'s grants');
  // Andy: "the callers (Grants and agent shell apps should boody well know how to configure the damn grantsPanel element".
  const ids = p.cfg.ids || {};
  ok(ids.table === 'loopback://api/contact/search', 'its ID table is the contacts\', loopback://api/contact/search', 'ids: ' + short(ids));
  const g = p.cfg.grants || {};
  ok(g.branch === 'grants' && g.key === 'key' && g.label === 'label', 'its grants table is the node\'s: branch grants, keyed key, labelled label', 'grants: ' + short({ branch: g.branch, key: g.key, label: g.label }));
  ok(['search', 'grant', 'revoke', 'stream'].every(function (f) { return typeof g[f] === 'function'; }), 'with search, grant, revoke and stream of its own', 'grants: ' + short(Object.keys(g)));
  if (!['search', 'grant', 'revoke', 'stream'].every(function (f) { return typeof g[f] === 'function'; })) return;
  let at = w.calls.length;
  const found = await g.search('bo');
  const s = w.calls.slice(at)[0];
  ok(s && s.name === 'auth.search' && s.args.text === 'bo' && found && Array.isArray(found.items), 'search(text) asks auth.search { text } and answers its { items, more }', 'asked ' + short(s) + ', found ' + short(found));
  // Found by cw live (goal/G41.16): the whose column of the node's grants was empty, auth.search saying it as name and the
  // panel reading its table's label field. A found grant carries whose it is in that field.
  let hit = null; try { hit = JSON.parse(found.items[0].label); } catch (e) { hit = null; }
  ok(hit && hit[g.label] === 'Bob' && hit.key === 'K1' && hit.path === 'fs.search', 'a found grant carries whose it is in the table\'s label field, label', 'found row: ' + short(hit));
  at = w.calls.length;
  const made = await g.grant('K3', 'jobs.list');
  const gr = w.calls.slice(at)[0];
  ok(gr && gr.name === 'auth.grant' && gr.args.key === 'K3' && gr.args.path === 'jobs.list' && made && made.ok !== false, 'grant(id, path) asks auth.grant { key, path } and answers ok', 'asked ' + short(gr) + ', answered ' + short(made));
  const already = await g.grant('K3', 'fs.search');
  ok(already && already.ok === false && already.code === 'already-granted', 'a refusal answers { ok: false, code, error }, in the node\'s words', 'answered ' + short(already));
  at = w.calls.length;
  await g.revoke('K3', 'jobs.list');
  const rv = w.calls.slice(at)[0];
  ok(rv && rv.name === 'auth.revoke' && rv.args.key === 'K3' && rv.args.path === 'jobs.list', 'revoke(id, path) asks auth.revoke { key, path }', 'asked ' + short(rv));
  const one = g.stream({ type: 'bundles', data: { table: 'grant', row: { key: 'K9', path: 'jobs.list', label: 'Zed' } } });
  const gone = g.stream({ type: 'bundles', data: { table: 'grant', row: { key: 'K9', path: 'jobs.list' }, gone: true } });
  ok(one && one.row.key === 'K9' && !one.gone && gone && gone.gone === true, 'stream(job): the auth tables\' job, table grant, is its grants, gone when revoked', 'stream: ' + short([one, gone]));
  ok(!g.stream({ type: 'bundles', data: { table: 'bundle', row: { id: 1 } } }) && !g.stream({ type: 'shadow', data: { row: {} } }), 'a bundle row, or another job, is none of its grants', 'stream answered a non-grant');
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
