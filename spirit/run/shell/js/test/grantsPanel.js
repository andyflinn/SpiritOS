'use strict';

// spirit/run/shell/js/test/grantsPanel.js
// The tests of shell/js/grantsPanel.js, and of no other module (spec: ./grantsPanel.md; goal/G41.16). The browser file
// runs in node on a BARE window (rule/26): each element is put on the page only once the panel requires it, a stand-in
// that keeps what the panel handed it: the selectors and the grant list (tested in their own folders). The panel knows no
// table: its caller hands it the ID table and the grants table (Andy: "the callers (Grants and agent shell apps should
// boody well know how to configure the damn grantsPanel element"); here a grants table shaped as the agent's is, so
// nothing of the node's auth grants can be the panel's own. The node's bundles and api tree are stubs.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'grantsPanel.js');
const SRC = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8') : '';

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
// The caller's configuration: the ID table, as the contact selector takes it, and the grants table those IDs are granted
// in, every call recorded.
function config(w) {
  return {
    ids: { table: 'loopback://api/agent/job', key: 'id', label: 'label' },
    grants: { branch: 'agent.grant', key: 'job_id', label: 'job',
      search: function (text) { w.calls.push({ name: 'grants.search', args: text }); return Promise.resolve({ items: [], more: false }); },
      grant: function (id, p) { w.calls.push({ name: 'grants.grant', args: { id: id, path: p } }); return Promise.resolve(w.grantAnswer ? w.grantAnswer(id, p) : { ok: true }); },
      revoke: function (id, p) { w.calls.push({ name: 'grants.revoke', args: { id: id, path: p } }); return Promise.resolve({ ok: true }); },
      stream: function () { return null; } },
  };
}

function world() {
  const w = { required: [], calls: [], bundles: [], ids: [], families: [], grantLists: [], grantAnswer: null, branchesOf: {}, treeAsked: 0, tree: null };
  const E = {
    createBundleSelector: function (opts) { const b = node('bundle'); b.opts = opts; b.value = ''; b.row = null; w.bundles.push(b); return b; },
    createContactSelector: function (opts) { const c = node('contact'); c.opts = opts || {}; c.value = ''; c.row = null; w.ids.push(c); return c; },
    createApiFamilySelector: function (opts) { const f = node('family'); f.opts = opts; f.family = ''; f.verb = ''; f.value = ''; w.families.push(f); return f; },
    grantList: { create: function (host, opts) { const l = { host: host, opts: opts || {}, redrawn: 0, list: { redraw: function () { l.redrawn += 1; } } }; w.grantLists.push(l); return l; } },
  };
  const api = {
    escapeHtml: function (s) { return String(s).replace(/</g, '&lt;'); },
    verb: function (name, args) {
      w.calls.push({ name: name, args: args });
      // A bundle's branches: the node's bundles, the one dictionary both kinds of grant are made from.
      if (name === 'auth.branch') return Promise.resolve({ status: 200, body: { items: (w.branchesOf[args && args.bundle] || []).map(function (b, i) { return { key: String(i + 1), label: JSON.stringify(Object.assign({ id: i + 1, bundle: args.bundle }, b)) }; }), more: false } });
      return Promise.resolve({ status: 200, body: {} });
    },
  };
  const FILES = { 'shell/js/bundleSelector.js': ['createBundleSelector'], 'shell/js/contactSelector.js': ['createContactSelector'],
    'shell/js/apiFamilySelector.js': ['createApiFamilySelector'], 'shell/js/grantSelector/listElement.js': ['grantList'] };
  const page = {};
  const win = {
    spirit: { elements: page,
      require: function (p) { w.required.push(String(p)); (FILES[p] || []).forEach(function (k) { page[k] = E[k]; }); return Promise.resolve(true); },
      tree: function () { w.treeAsked += 1; return Promise.resolve(w.tree || TREE); },
      escapeHtml: api.escapeHtml },
    document: { createElement: function (t) { return node('<' + t + '>'); }, getElementById: function (id) { return byId[id] || null; } },
    Event: function (type) { this.type = type; },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number,
    console: { log: function () {}, error: function () {} }, confirm: function () { return true; },
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', 'client', 'apiTreeIndex.js'), 'utf8'), win, { filename: 'apiTreeIndex.js' });
  vm.runInContext(fs.readFileSync(path.join(RUN, 'shell', 'js', 'spiritData.js'), 'utf8'), win, { filename: 'spiritData.js' });
  if (SRC) vm.runInContext(SRC, win, { filename: FILE });
  w.win = win; w.api = api; w.page = page;
  return w;
}

test.startTest('grantsPanel.js: grants of whichever ID table its caller hands it');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  if (!SRC) { test.fail('shell/js/grantsPanel.js is not there'); return; }
  const code = SRC.replace(/\/\/.*$/gm, '');
  const w = world();
  await settle();
  const E = w.page;

  test.subHeading('a shell element that loads what it uses itself (rule/26), and knows no table');
  ['shell/js/contactSelector.js', 'shell/js/bundleSelector.js', 'shell/js/apiFamilySelector.js', 'shell/js/grantSelector/listElement.js'].forEach(function (p) {
    ok(w.required.indexOf(p) !== -1, 'it requires ' + p, 'required: ' + short(w.required));
  });
  ok(!w.required.some(function (p) { return /data\.js$/.test(p); }), 'and no data script', 'required: ' + short(w.required));
  // The grants table and the ID table are its caller's; the node's bundles (auth.bundle, auth.branch) are the one
  // dictionary both kinds of grant are made from, so a bundle's branches are the panel's to read.
  ok(!/auth\.(grant|revoke|search)\b|agent\.|loopback:\/\/|contact\.search|job_id|'grants'|"grants"/.test(code), 'it names no grants table and no ID table: no auth grant verb, no agent verb, no loopback location, no branch (goal/G41.16)', 'grantsPanel.js names a table of its own');
  ok(E.grantsPanel && typeof E.grantsPanel.create === 'function', 'it registers spirit.elements.grantsPanel.create', 'elements: ' + short(Object.keys(E)));
  if (!E.grantsPanel || typeof E.grantsPanel.create !== 'function') return;
  const refusals = [];
  [{}, { ids: config(w).ids }, { grants: config(w).grants }].forEach(function (c) {
    try { E.grantsPanel.create(node('x'), Object.assign({ api: w.api }, c)); refusals.push(null); } catch (e) { refusals.push(e && e.message); }
  });
  ok(refusals.every(function (r) { return r !== null; }) && w.grantLists.length === 0, 'made without its ID table or its grants table, it is refused, and draws nothing', 'refusals: ' + short(refusals) + ', lists ' + w.grantLists.length);

  const box = node('panel');
  const cfg = config(w);
  E.grantsPanel.create(box, Object.assign({ api: w.api }, cfg));
  await settle();

  test.subHeading('the grant form, one row: grant [ID] [bundle] [Grant]');
  ok(w.bundles.length === 1 && w.ids.length === 2 && w.families.length === 1, 'one bundle selector, two ID selectors (the form\'s and the filter), one family selector', 'bundle ' + w.bundles.length + ', ID ' + w.ids.length + ', family ' + w.families.length);
  ok(w.ids.every(function (c) { return c.opts.table === cfg.ids.table && c.opts.key === cfg.ids.key && c.opts.label === cfg.ids.label; }), 'both ID selectors search the ID table it was handed: its location, key and label fields', 'ID selectors: ' + short(w.ids.map(function (c) { return c.opts; })));
  const holder = function (el) { return box.nodes.findIndex(function (n) { return n.kids.indexOf(el) !== -1; }); };
  const grantAt = box.nodes.findIndex(function (n) { return /<button/.test(n.tag) && /grant/i.test(n.getAttribute('id') || n.getAttribute('data-action') || n.getAttribute('data-grants') || ''); });
  const formId = w.ids.filter(function (c) { const i = holder(c); return i !== -1 && i < grantAt; })[0];
  const filterId = w.ids.filter(function (c) { return c !== formId; })[0];
  const text = box.innerHTML.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  ok(formId && holder(formId) < holder(w.bundles[0]) && holder(w.bundles[0]) < grantAt && /\bgrant\b/i.test(text) && /<button[^>]*>\s*Grant\s*<\/button>/.test(box.innerHTML),
    'the row reads "grant" [ID] [bundle], then the Grant button', 'holders: id ' + (formId ? holder(formId) : 'none') + ', bundle ' + holder(w.bundles[0]) + ', Grant ' + grantAt);

  test.subHeading('the filter line, below it: [ID] [family] [deprecated]');
  const html = box.innerHTML;
  const rowStart = html.indexOf('data-grants="filters"');
  const row = rowStart === -1 ? '' : html.slice(rowStart, html.indexOf('</div>', rowStart));
  ok(filterId && holder(filterId) > grantAt && holder(w.families[0]) > grantAt && /data-grants="filter-id"/.test(row) && /data-grants="filter-family"/.test(row) && /<button[^>]*data-grants="deprecated"/.test(row),
    'one filter line under the form: the ID filter, the family selector and the deprecated button', 'filter row: ' + short(row));

  test.subHeading('the list: the grant list, of the same grants table, the one box that fills (rule/16)');
  const gl = w.grantLists[0];
  ok(w.grantLists.length === 1 && gl && gl.opts.grants === cfg.grants && /\bfill\b/.test(String(gl.host.className || '')), 'one grant list, handed the grants table it was given, in a fill box', 'grant lists ' + w.grantLists.length + ', same table ' + (gl && gl.opts.grants === cfg.grants) + ', host ' + short(gl && gl.host.className));
  if (!gl) return;
  const fills = box.nodes.filter(function (n) { return /\bfill\b/.test(n.className || ''); }).length + box.kids.filter(function (k) { return k !== gl.host && /\bfill\b/.test(k.className || ''); }).length;
  ok(fills === 0, 'nothing above the list fills: the heading, the form and the filters take their own height', fills + ' other fill box(es): ' + short(box.innerHTML.slice(0, 120)));

  test.subHeading('the filters narrow it, by the grants table\'s own key field');
  const pass = function (r) { return (gl.opts.filters || []).every(function (f) { return !f || f.name === 'deprecated' || typeof f.test !== 'function' || f.test(r) > 0; }); };
  const NIGHT = { job_id: 'J1', path: 'fs.search', job: 'Night' };
  const DAY = { job_id: 'J2', path: 'gone.verb', job: 'Day' };
  ok(pass(NIGHT) && pass(DAY), 'nothing chosen: every grant passes', 'passed: ' + [pass(NIGHT), pass(DAY)].join(' '));
  filterId.value = 'J1'; filterId.fire('change', { target: filterId });
  ok(pass(NIGHT) && !pass(DAY) && gl.redrawn > 0, 'the ID filter narrows to that ID\'s grants, read from the table\'s key field, and the list redraws', 'Night ' + pass(NIGHT) + ', Day ' + pass(DAY) + ', redrawn ' + gl.redrawn);
  filterId.value = ''; filterId.fire('change', { target: filterId });
  const fam = w.families[0];
  fam.family = 'gone'; fam.value = 'gone'; fam.fire('change', { target: fam });
  ok(!pass(NIGHT) && pass(DAY), 'the family filter narrows to that family\'s paths', 'Night ' + pass(NIGHT) + ', Day ' + pass(DAY));
  fam.family = 'fs'; fam.verb = 'search'; fam.value = 'fs.search'; fam.fire('change', { target: fam });
  ok(pass(NIGHT) && !pass({ job_id: 'J1', path: 'fs.loadFile', job: 'Night' }), 'a verb chosen narrows to that verb', 'fs.search ' + pass(NIGHT));
  fam.family = ''; fam.verb = ''; fam.value = ''; fam.fire('change', { target: fam });

  test.subHeading('deprecated: a report, following the stream, its filter off by default');
  ok(w.treeAsked >= 1 && typeof gl.opts.serves === 'function' && gl.opts.serves('fs.search') === true && gl.opts.serves('gone.verb') === false,
    'the tree is read through spirit.tree(), and the list told what it serves', 'tree asked ' + w.treeAsked + ', serves ' + short(typeof gl.opts.serves === 'function' ? [gl.opts.serves('fs.search'), gl.opts.serves('gone.verb')] : null));
  const D = w.win.spirit.data;
  const asked0 = w.treeAsked;
  w.tree = Object.assign({}, TREE, { gone: { verb: {} } });
  D.take({ id: 'job_78', kind: 'server', type: 'gone', status: 'running', module: 'process/js/gone', data: {} });
  await settle();
  ok(w.treeAsked > asked0 && gl.opts.serves('gone.verb') === true, 'a server job changed: the tree is read again, and the grant it now serves is no longer deprecated', 'serves gone.verb ' + gl.opts.serves('gone.verb'));
  w.tree = TREE;
  D.take({ id: 'job_78', kind: 'server', type: 'gone', status: 'exited', module: 'process/js/gone', data: {} });
  await settle();
  const dep = (gl.opts.filters || []).filter(function (f) { return f && f.name === 'deprecated'; })[0];
  ok(!!dep && dep.toggle === true && typeof dep.when === 'function' && dep.when([]) === false && dep.test(DAY, undefined) === 0 && dep.test(NIGHT, undefined) === 1,
    'the deprecated filter is a toggle the list draws no button for, off at first: a grant no server serves is left out', 'deprecated: ' + short(dep && { off: dep.test(DAY, undefined), served: dep.test(NIGHT, undefined) }));
  const btn = box.querySelector('[data-grants="deprecated"]');
  if (btn) btn.fire('click', { target: btn });
  await settle();
  ok(dep && dep.test(DAY, undefined) === 1, 'its button pressed, the deprecated grants are listed', 'Day ' + (dep && dep.test(DAY, undefined)));
  const btn2 = box.querySelector('[data-grants="deprecated"]');
  if (btn2) btn2.fire('click', { target: btn2 });

  test.subHeading('Grant: the bundle\'s branches, through the grants table it was handed');
  const grantBtn = box.nodes.filter(function (n) { return /<button/.test(n.tag) && /grant/i.test(n.getAttribute('id') || n.getAttribute('data-action') || n.getAttribute('data-grants') || ''); })[0];
  const press = function () { if (grantBtn) grantBtn.fire('click', { target: grantBtn, preventDefault: function () {} }); };
  let at0 = w.calls.length;
  press(); await settle();
  ok(!w.calls.slice(at0).some(function (c) { return c.name === 'grants.grant'; }), 'with no bundle or no ID chosen, Grant asks nothing', 'calls: ' + short(w.calls.slice(at0)));
  w.bundles[0].value = 7; w.bundles[0].row = { id: 7, label: 'Reader' };
  w.branchesOf[7] = [{ family: 'jobs', verb: 'list' }, { family: 'fs', verb: 'search' }, { family: 'desk', verb: '' }];
  formId.value = 'J3'; formId.row = { key: 'J3', name: 'Cat' };
  w.grantAnswer = function (id, p) { return p === 'fs.search' ? { ok: false, code: 'already-granted', error: 'already granted' } : { ok: true }; };
  at0 = w.calls.length;
  press(); await settle();
  const read = w.calls.slice(at0).filter(function (c) { return c.name === 'auth.branch'; })[0];
  ok(read && read.args.op === 'search' && read.args.bundle === 7, 'Grant reads the chosen bundle\'s branches: auth.branch { op: search, bundle }', 'calls: ' + short(w.calls.slice(at0)));
  const grants = w.calls.slice(at0).filter(function (c) { return c.name === 'grants.grant'; });
  ok(grants.length === 3 && grants.every(function (c) { return c.args.id === 'J3'; }) && JSON.stringify(grants.map(function (c) { return c.args.path; }).sort()) === '["desk","fs.search","jobs.list"]',
    'and grants each through the grants table it was handed, grant(id, path): family.verb, or the family alone for (ALL)', 'grants: ' + short(grants.map(function (c) { return c.args; })));
  ok(!w.calls.slice(at0).some(function (c) { return /^auth\.(grant|search)$/.test(c.name) || /^agent\./.test(c.name); }), 'nothing is granted, or read, past the table it was handed', 'calls: ' + short(w.calls.slice(at0).map(function (c) { return c.name; })));
  ok(!/already-granted|already granted|not granted|refused/i.test(box.innerHTML.replace(/<[^>]*>/g, ' ')), 'a path the ID holds already is counted done, never said as a refusal', 'said: ' + short(box.innerHTML.replace(/<[^>]*>/g, ' ')));
  ok(!w.calls.slice(at0).some(function (c) { return c.name === 'grants.search'; }), 'and reads no grant again: each new grant arrives on the stream (rule/19)', 'calls: ' + short(w.calls.slice(at0).map(function (c) { return c.name; })));
  w.grantAnswer = function () { return { ok: false, code: 'owner-only', error: 'owner only' }; };
  press(); await settle();
  ok(/owner-only|owner only/.test(box.innerHTML), 'a grant refused for another reason says so', 'said: ' + short(box.innerHTML.replace(/<[^>]*>/g, ' ')));
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
