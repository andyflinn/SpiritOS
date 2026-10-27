'use strict';

// spirit/run/shell/apps/test/apps.js
// The tests of shell/apps/apps.js, and of no other module (spec: ./apps.md; goal/G41.1, box v14). The browser file
// runs in node on a window of its own: the search list, the file row, the installer, the navigation and the spirit
// object are stubs that keep what the app asked of them.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'apps.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 15; i++) await tick(); };

// A node whose markup makes a node per tag that carries an attribute; found by [attr="value"] or input[type="checkbox"].
function node(tag) {
  const heard = {}; let html = '';
  const n = { tag: tag || '', nodes: [], value: '', checked: false, className: '', textContent: '', hidden: false, style: {},
    get innerHTML() { return html; },
    set innerHTML(v) {
      html = String(v); n.nodes = [];
      const re = /<([a-z]+)\b([^>]*)>/gi; let m;
      while ((m = re.exec(html))) {
        const c = node(m[0]);
        const val = /\svalue="([^"]*)"/.exec(m[2]); if (val) c.value = val[1];
        c.checked = /\schecked\b/.test(m[2]);
        c.className = (/class="([^"]*)"/.exec(m[2]) || [])[1] || '';
        n.nodes.push(c);
      }
    },
    getAttribute: function (k) { const m = new RegExp('\\s' + k + '="([^"]*)"').exec(n.tag); return m ? m[1] : null; },
    querySelector: function (sel) { return n.querySelectorAll(sel)[0] || null; },
    querySelectorAll: function (sel) {
      const a = /^\[([\w-]+)="([^"]*)"\]$/.exec(sel);
      if (a) return n.nodes.filter(function (c) { return c.getAttribute(a[1]) === a[2]; });
      if (sel === 'input[type="checkbox"]') return n.nodes.filter(function (c) { return /^<input/i.test(c.tag) && /type="checkbox"/.test(c.tag); });
      return [];
    },
    addEventListener: function (t, fn) { (heard[t] = heard[t] || []).push(fn); },
    fire: function (t, e) { (heard[t] || []).slice().forEach(function (fn) { fn(e); }); },
    appendChild: function (c) { return c; },
  };
  return n;
}

const FILES = {
  'shell/icons/icons.js': {}, 'shell/icons/icons.json': {},
  'shell/agent/agent.js': {}, 'shell/agent/agent.json': {},
  'process/js/agent/agent.js': {}, 'process/js/agent/agent.json': {},
  'process/js/starter/starter.js': {}, 'process/js/starter/starter.json': {},
  'shell/notes.txt': {},
  'shell/login/login.js': {}, 'shell/login/login.json': {},
  'shell/join/join.js': {}, 'shell/join/join.json': {},
};
const MANIFESTS = {
  'shell/icons/icons.json': { name: 'Icons', runs: ['home'] },
  'shell/agent/agent.json': { name: 'Agent', server: 'agent', runs: ['home'] },
  'process/js/agent/agent.json': { label: 'Agent server', kind: 'server', operated: 'node' },
  'process/js/starter/starter.json': { label: 'Starter' },
  'shell/login/login.json': { name: 'Log in' },
  'shell/join/join.json': { name: 'Join' },
};

function world() {
  const w = { made: null, installers: [], pushed: [], required: [], writes: [], def: null, rows: [] };
  const fsApi = {
    getAnnotations: function (p) { return Promise.resolve(p === 'shell/icons/icons.js' ? { face: { app: true, intrinsic: false, name: 'Icons', icon: '🔣', description: 'the set' } }
      : { face: { home: true, intrinsic: true, name: 'Agent server' } }); },
    loadFile: function (p) { return Promise.resolve(MANIFESTS[p] ? JSON.stringify(MANIFESTS[p]) : null); },
    annotate: function (a) { w.writes.push(JSON.parse(JSON.stringify(a))); return Promise.resolve({ ok: true }); },
  };
  const E = {
    probabilitySearch: { create: function (host, opts) { w.made = { host: host, opts: opts }; return { sort: function () {}, refresh: function () {}, destroy: function () {} }; } },
    fileElement: { create: function (row) { const el = { key: row.path, row: row, fields: ['name', 'changed'], mounted: null, destroyed: false,
      mount: function (h) { el.mounted = h; return el; }, cells: function () { return []; }, apply: function () {}, destroy: function () { el.destroyed = true; } }; w.rows.push(el); return el; } },
    appInstaller: { create: function (host, o) { const i = { host: host, path: o && o.path, destroyed: false, destroy: function () { i.destroyed = true; } }; w.installers.push(i); return i; } },
    navigation: { push: function (p) { const box = node('page'); w.pushed.push({ page: p, box: box }); p.mount(box, { api: {} }); return { close: function () {} }; } },
    fieldInput: { attach: function () {} },
    iconList: { create: function () { return { destroy: function () {} }; } },
  };
  const D = { get: function (k) { return FILES[k.replace(/^files\//, '')] || null; }, branch: function (t) { return t === 'files' ? FILES : {}; }, watch: function () { return function () {}; } };
  const win = { spirit: { elements: E, data: D, fs: fsApi, ready: Promise.resolve({ fs: fsApi }),
    require: function (p) { w.required.push(String(p)); return Promise.resolve(true); },
    shell: { activateApp: function (d) { w.def = d; }, faceApp: function () {} }, escapeHtml: function (s) { return String(s); } },
    document: { createElement: function () { return node('made'); } }, setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object,
    console: { log: function () {}, error: function () {} } };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE });
  w.win = win;
  return w;
}

test.startTest('apps.js: the Apps app');

(async function () {
  const w = world();
  test.subHeading('it mounts, and loads what it uses');
  ok(w.def && typeof w.def.mount === 'function', 'it mounts through spirit.shell.activateApp', 'no activateApp with mount');
  if (!w.def) return;
  const box = node('container');
  w.def.mount(box, {}); await settle();
  ok(w.required.indexOf('shell/js/appInstaller.js') !== -1, 'it loads the app installer through spirit.require', 'required: ' + short(w.required));
  ok(!!w.made, 'it draws its list', 'no list made');
  if (!w.made) return;
  ok(/\bfill\b/.test(String((box.nodes[0] || {}).className || '')), 'into a box of a stated size (fill)', 'the list box: ' + short(box.innerHTML));

  test.subHeading('its rows: standalone shell apps and appServers only');
  const o = w.made.opts;
  const type = (o.filters || []).filter(function (f) { return f.name === 'type'; })[0];
  const rowOf = function (p) { return type ? type.test({ path: p }, 'all') : null; };
  ok(rowOf('shell/icons/icons.js') === 1, 'a shell app naming no server is a row', 'icons: ' + rowOf('shell/icons/icons.js'));
  ok(rowOf('shell/agent/agent.js') === 0, 'a shell app naming a server is no row: it goes with its server', 'the agent face app: ' + rowOf('shell/agent/agent.js'));
  ok(rowOf('process/js/agent/agent.js') === 1, 'an appServer is a row', 'the agent server: ' + rowOf('process/js/agent/agent.js'));
  ok(rowOf('process/js/starter/starter.js') === 0, 'a process that is no server is no row', 'starter: ' + rowOf('process/js/starter/starter.js'));
  ok(rowOf('shell/login/login.js') === 0 && rowOf('shell/join/join.js') === 0, 'login and Join are boot\'s own components, no rows', 'login ' + rowOf('shell/login/login.js') + ', join ' + rowOf('shell/join/join.js'));
  ok(rowOf('shell/notes.txt') === 0, 'a file that is no app is no row', 'notes.txt: ' + rowOf('shell/notes.txt'));

  test.subHeading('a filter for installable apps only (box v15)');
  const installable = (o.filters || []).filter(function (f) { return f.name === 'installable'; })[0];
  ok(!!installable && (installable.choices || []).some(function (c) { return c.value === 'only'; }), 'the list has an installable filter, its choice only', 'filters: ' + short((o.filters || []).map(function (f) { return f.name; })));
  if (installable) {
    ok(installable.test({ path: 'shell/icons/icons.js' }, 'only') === 1, 'a shell app with a button passes', 'icons: ' + installable.test({ path: 'shell/icons/icons.js' }, 'only'));
    ok(installable.test({ path: 'process/js/agent/agent.js' }, 'only') === 0, 'an intrinsic app does not: it has no button', 'the intrinsic server: ' + installable.test({ path: 'process/js/agent/agent.js' }, 'only'));
    ok(installable.test({ path: 'process/js/agent/agent.js' }, 'all') === 1, 'with all, every row passes', 'all: ' + installable.test({ path: 'process/js/agent/agent.js' }, 'all'));
  }

  test.subHeading('the installer column');
  const col = (o.columns || []).filter(function (c) { return c.field === 'installer'; })[0];
  ok(!!col, 'the list has an installer column', 'columns: ' + short((o.columns || []).map(function (c) { return c.field; })));
  const el = o.element({}, 'process/js/agent/agent.js');
  const cell = node('td');
  el.mount({ name: node('td'), changed: node('td'), installer: cell });
  const inst = w.installers.filter(function (i) { return i.host === cell; })[0];
  ok(inst && inst.path === 'process/js/agent/agent.js', 'a row mounts the app installer into its installer cell, for its script', 'installers: ' + short(w.installers.map(function (i) { return i.path; })));
  el.destroy();
  ok(inst && inst.destroyed, 'and destroys it with the row', 'the installer was not destroyed');

  test.subHeading('the details panel: no checkbox, the installer, intrinsic read-only');
  o.details({}, 'shell/icons/icons.js'); await settle();
  const page = w.pushed[w.pushed.length - 1];
  const panel = page && page.box.querySelector('[data-apps="panel"]');
  ok(!!panel, 'a press opens its panel as a page', 'pages pushed: ' + w.pushed.length);
  if (!panel) return;
  ok(panel.querySelectorAll('input[type="checkbox"]').length === 0, 'the panel has no checkbox', 'checkboxes: ' + panel.querySelectorAll('input[type="checkbox"]').length);
  const inPanel = w.installers.filter(function (i) { return i.path === 'shell/icons/icons.js'; })[0];
  ok(!!inPanel, 'it shows the app installer for the app', 'installers: ' + short(w.installers.map(function (i) { return i.path; })));
  ok(/intrinsic/i.test(panel.innerHTML), 'it says whether the app is intrinsic, as text', 'panel: ' + short(panel.innerHTML));
  const name = panel.querySelector('[data-face="name"]');
  ok(!!name, 'its name is still edited', 'no name field');
  if (!name) return;
  name.value = 'My Icons';
  panel.fire('change', { target: name });
  await settle();
  const wr = w.writes[w.writes.length - 1];
  ok(wr && wr.path === 'shell/icons/icons.js' && wr.payload.name === 'My Icons' && wr.payload.app === true && wr.payload.intrinsic === false && wr.payload.icon === '🔣',
    'a name change writes the whole face part, every other field kept', 'wrote ' + short(wr));
  o.details({}, 'process/js/agent/agent.js'); await settle();
  const sp = w.pushed[w.pushed.length - 1].box.querySelector('[data-apps="panel"]');
  const sname = sp && sp.querySelector('[data-face="name"]');
  if (sname) { sname.value = 'Agent'; sp.fire('change', { target: sname }); await settle(); }
  const ws = w.writes[w.writes.length - 1];
  ok(ws && ws.path === 'process/js/agent/agent.js' && ws.payload.home === true && ws.payload.intrinsic === true, 'a server\'s save keeps its home and its intrinsic mark', 'wrote ' + short(ws));
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
