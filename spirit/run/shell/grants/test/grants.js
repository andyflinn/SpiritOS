'use strict';

// spirit/run/shell/grants/test/grants.js
// The tests of shell/grants/grants.js, and of no other module (spec: ./grants.md; goal/G41.5, goal/G41.13, goal/G41.14).
// The browser file runs in node on a BARE window (rule/26): each element is put on the page only once the app requires
// it, a stand-in that keeps what the app handed it: the tab container, the selectors, the bundle editor and the grant
// list. The grant list and row are elements of their own (shell/js/grantSelector/, tested in their own folder); this
// tests what the app does with them. The node is a stub that answers and keeps every ask.

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

function world() {
  const w = { required: [], calls: [], def: null, tabs: [], bundles: [], ids: [], families: [], editors: [], grantLists: [], grantAnswer: null, branchesOf: {}, treeAsked: 0 };
  const E = {
    tabContainer: { create: function (host, opts) { const t = { host: host, opts: opts || {} }; w.tabs.push(t); return t; } },
    createBundleSelector: function (opts) { const b = node('bundle'); b.opts = opts; b.value = ''; b.row = null; w.bundles.push(b); return b; },
    createContactSelector: function (opts) { const c = node('contact'); c.opts = opts; c.value = ''; c.row = null; w.ids.push(c); return c; },
    // The family selector, its verb half with it (goal/G41.14): family, verb, value.
    createApiFamilySelector: function (opts) { const f = node('family'); f.opts = opts; f.family = ''; f.verb = ''; f.value = ''; w.families.push(f); return f; },
    bundleEditor: { create: function (host, opts) { const e = { host: host, opts: opts || {} }; w.editors.push(e); return e; } },
    grantList: { create: function (host, opts) { const l = { host: host, opts: opts || {}, redrawn: 0, list: { redraw: function () { l.redrawn += 1; } } }; w.grantLists.push(l); return l; } },
  };
  const api = {
    escapeHtml: function (s) { return String(s).replace(/</g, '&lt;'); },
    verb: function (name, args) {
      w.calls.push({ name: name, args: args });
      // A bundle's branches, each a family and a verb, '' for all of the family.
      if (name === 'auth.branch') return Promise.resolve({ status: 200, body: { items: (w.branchesOf[args && args.bundle] || []).map(function (b, i) { return { key: String(i + 1), label: JSON.stringify(Object.assign({ id: i + 1, bundle: args.bundle }, b)) }; }), more: false } });
      if (name === 'auth.grant' && w.grantAnswer) return Promise.resolve(w.grantAnswer(args));
      if (name === 'auth.grant') return Promise.resolve({ status: 200, body: { ok: true } });
      return Promise.resolve({ status: 200, body: {} });
    },
    ui: { elements: {} },
  };
  const FILES = { 'shell/js/tabContainer.js': ['tabContainer'], 'shell/js/bundleSelector.js': ['createBundleSelector'],
    'shell/js/contactSelector.js': ['createContactSelector'], 'shell/js/apiFamilySelector.js': ['createApiFamilySelector'],
    'shell/js/bundleEditor.js': ['bundleEditor'], 'shell/js/grantSelector/listElement.js': ['grantList'] };
  const page = {};
  const win = {
    spirit: { elements: page,
      require: function (p) { w.required.push(String(p)); (FILES[p] || []).forEach(function (k) { page[k] = E[k]; }); return Promise.resolve(true); },
      // The api tree through the one spirit object (goal/G41.14: asked as the verb 'api', a face's home path refused it).
      tree: function () { w.treeAsked += 1; return Promise.resolve(TREE); },
      shell: { activateApp: function (d) { w.def = d; } }, escapeHtml: api.escapeHtml },
    document: { createElement: function (t) { return node('<' + t + '>'); }, getElementById: function (id) { return byId[id] || null; } },
    Event: function (type) { this.type = type; },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number,
    console: { log: function () {}, error: function () {} }, confirm: function () { return true; },
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', 'client', 'apiTreeIndex.js'), 'utf8'), win, { filename: 'apiTreeIndex.js' });
  vm.runInContext(SRC, win, { filename: FILE });
  w.win = win;
  w.api = api;
  return w;
}

test.startTest('grants.js: the Grants app');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  const code = SRC.replace(/\/\/.*$/gm, '');
  test.subHeading('nothing of the old shell is left in it');
  ok(!/shellCreateListSearch/.test(code), 'grants.js names no shellCreateListSearch (goal/G40.8)', 'grants.js still names shellCreateListSearch');
  ok(!/api\.ui\.elements/.test(code), 'it takes its elements from what it loaded, not from the old shell\'s api.ui.elements', 'grants.js still reaches api.ui.elements');
  ok(!/apiBranchSelector/.test(code), 'it names apiBranchSelector no more: it is apiFamilySelector (goal/G41.14)', 'grants.js still names apiBranchSelector');

  const w = world();
  ok(w.def && typeof w.def.mount === 'function', 'it mounts through spirit.shell.activateApp', 'no activateApp with mount');
  if (!w.def) return;

  test.subHeading('it loads what it uses itself (rule/26)');
  ['shell/js/grantSelector/listElement.js', 'shell/js/tabContainer.js', 'shell/js/bundleSelector.js', 'shell/js/contactSelector.js', 'shell/js/bundleEditor.js', 'shell/js/apiFamilySelector.js'].forEach(function (p) {
    ok(w.required.indexOf(p) !== -1, 'it requires ' + p, 'required: ' + short(w.required));
  });
  // goal/G41.14, Andy: "INCLUDING COMPLETE TEST FOLDER FOR THE COMPONENTS INVOLVED!!!!": the grant list and row are shell
  // elements of their own (shell/js/grantSelector/, each with its test/); the app draws the list, and keeps no list or row
  // of its own.
  ok(!/function grElement\b|probabilitySearch\.create|rowElement\.create/.test(code) && !w.required.some(function (p) { return /data\.js$/.test(p); }),
    'it keeps no grant list or row element of its own, and loads no data script', 'grants.js builds its own list or row, or requires a data.js');

  const app = node('container');
  await w.def.mount(app, w.api); await settle();

  test.subHeading('two tabs: Grants, and Bundles (goal/G41.13)');
  const tabs = w.tabs[0];
  const names = tabs ? (tabs.opts.tabs || []).map(function (t) { return t && t.name; }) : [];
  ok(w.tabs.length === 1 && JSON.stringify(names) === '["grants","bundles"]' && (tabs.opts.tabs || []).every(function (t) { return t.label && typeof t.mount === 'function'; }),
    'the app is one tabContainer with the tabs grants and bundles, each with its label and mount', 'tabs: ' + short(names));
  if (!tabs || names.length !== 2) return;
  const box = node('grants-tab');
  await tabs.opts.tabs[0].mount(box); await settle();
  const bundlesBox = node('bundles-tab');
  tabs.opts.tabs[1].mount(bundlesBox); await settle();
  ok(w.editors.length === 1 && w.editors[0].host === bundlesBox && w.editors[0].opts.api === w.api,
    'the Bundles tab is the bundle editor, in its own box, with the app\'s api', 'editors: ' + short(w.editors.length));

  test.subHeading('the grant form, one row: grant [ID] [bundle] [Grant] (goal/G41.13)');
  ok(w.bundles.length === 1 && w.ids.length === 2 && w.families.length === 1, 'one bundle selector, two ID selectors (the form\'s and the list\'s filter), one family selector (the list\'s filter)',
    'bundle ' + w.bundles.length + ', ID ' + w.ids.length + ', family ' + w.families.length);
  const holder = function (el) { return box.nodes.findIndex(function (n) { return n.kids.indexOf(el) !== -1; }); };
  const grantAt = box.nodes.findIndex(function (n) { return /<button/.test(n.tag) && /grant/i.test(n.getAttribute('id') || n.getAttribute('data-action') || ''); });
  const formId = w.ids.filter(function (c) { const i = holder(c); return i !== -1 && i < grantAt; })[0];
  const filterId = w.ids.filter(function (c) { return c !== formId; })[0];
  const text = box.innerHTML.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  ok(formId && holder(formId) < holder(w.bundles[0]) && holder(w.bundles[0]) < grantAt && /\bgrant\b/i.test(text) && /<button[^>]*>\s*Grant\s*<\/button>/.test(box.innerHTML),
    'the row reads "grant" [ID] [bundle], then the Grant button', 'holders: id ' + (formId ? holder(formId) : 'none') + ', bundle ' + holder(w.bundles[0]) + ', Grant ' + grantAt);
  ok(filterId && holder(filterId) > grantAt && holder(w.families[0]) > grantAt, 'below it, the list\'s filters: an ID, and a family with its verb', 'holders: filter id ' + (filterId ? holder(filterId) : 'none') + ', family ' + holder(w.families[0]));

  test.subHeading('the list: the grant list element, in the one box that fills (rule/16)');
  const gl = w.grantLists[0];
  ok(w.grantLists.length === 1 && gl && /\bfill\b/.test(String(gl.host.className || '')), 'the Grants tab draws one grant list, into a fill box', 'grant lists ' + w.grantLists.length + ', host class ' + short(gl && gl.host.className));
  if (!gl) return;
  // Andy, goal/G41.14: "and what about the HUGE vertical space in the grants tab, between the search filters and the
  // search input???": a fill box takes all the space left; the heading, the form and the filters above the list take
  // only their own, so the list follows them at once.
  const fills = box.nodes.filter(function (n) { return /\bfill\b/.test(n.className || ''); }).length + box.kids.filter(function (k) { return k !== gl.host && /\bfill\b/.test(k.className || ''); }).length;
  ok(fills === 0, 'nothing above the list fills: the heading, the form and the filters take their own height, the list the rest', fills + ' other fill box(es) in the Grants tab: ' + short(box.innerHTML.slice(0, 120)));
  ok(Array.isArray(gl.opts.filters) && gl.opts.filters.length >= 2, 'the app hands the list its filters, the ID and the family', 'filters: ' + short(gl.opts.filters));

  test.subHeading('the list\'s filters narrow it');
  const pass = function (row) { return (gl.opts.filters || []).every(function (f) { return typeof f.test !== 'function' || f.test(row) > 0; }); };
  const BOB = { key: 'K1', path: 'fs.search', label: 'Bob' };
  const ANN = { key: 'K2', path: 'gone.verb', label: 'Ann' };
  ok(pass(BOB) && pass(ANN), 'nothing chosen: every grant passes', 'passed: ' + [pass(BOB), pass(ANN)].join(' '));
  if (filterId) { filterId.value = 'K1'; filterId.fire('change', { target: filterId }); }
  ok(pass(BOB) && !pass(ANN) && gl.redrawn > 0, 'the ID filter narrows to that ID\'s grants, and the list redraws', 'Bob ' + pass(BOB) + ', Ann ' + pass(ANN) + ', redrawn ' + gl.redrawn);
  if (filterId) { filterId.value = ''; filterId.fire('change', { target: filterId }); }
  const fam = w.families[0];
  fam.family = 'gone'; fam.value = 'gone'; fam.fire('change', { target: fam });
  ok(!pass(BOB) && pass(ANN), 'the family filter narrows to that family\'s paths', 'Bob ' + pass(BOB) + ', Ann ' + pass(ANN));
  fam.family = 'fs'; fam.verb = 'search'; fam.value = 'fs.search'; fam.fire('change', { target: fam });
  ok(pass(BOB) && !pass({ key: 'K1', path: 'fs.loadFile', label: 'Bob' }), 'a verb chosen narrows to that verb', 'fs.search ' + pass(BOB));
  fam.family = ''; fam.verb = ''; fam.value = ''; fam.fire('change', { target: fam });

  test.subHeading('deprecated: a report of a path no server here serves today');
  // Andy, apiAuth/G1.6: "so we defer pruning to be triggered by the owners auth app, who can report deprecated branches".
  ok(w.treeAsked >= 1, 'the app reads the api tree through the spirit object, spirit.tree()', 'spirit.tree asked ' + w.treeAsked);
  ok(typeof gl.opts.serves === 'function' && gl.opts.serves('fs.search') === true && gl.opts.serves('gone.verb') === false,
    'the list is told what the tree serves: fs.search yes, a family the node does not serve no', 'serves: ' + short(typeof gl.opts.serves === 'function' ? [gl.opts.serves('fs.search'), gl.opts.serves('gone.verb')] : gl.opts.serves));

  test.subHeading('Grant copies the bundle\'s branches to the ID, one auth.grant per branch (goal/G41.14)');
  const grantBtn = box.nodes.filter(function (n) { return /<button/.test(n.tag) && /grant/i.test(n.getAttribute('id') || n.getAttribute('data-action') || ''); })[0];
  const press = function () { if (grantBtn) grantBtn.fire('click', { target: grantBtn, preventDefault: function () {} }); };
  ok(!!grantBtn, 'the Grant button is found by its id or data-action naming grant', 'no Grant button');
  let at0 = w.calls.length;
  press(); await settle();
  ok(!w.calls.slice(at0).some(function (c) { return c.name === 'auth.grant'; }), 'with no bundle or no ID chosen, Grant asks nothing', 'calls: ' + short(w.calls.slice(at0)));
  // A bundle is a number and a label; what it reaches are its branches, read from auth.branch at the press.
  w.bundles[0].value = 7; w.bundles[0].row = { id: 7, label: 'Reader' };
  w.branchesOf[7] = [{ family: 'jobs', verb: 'list' }, { family: 'fs', verb: 'search' }, { family: 'desk', verb: '' }];
  formId.value = 'K3'; formId.row = { key: 'K3', name: 'Cat' };
  w.grantAnswer = function (a) { return a.path === 'fs.search' ? { status: 409, body: { ok: false, code: 'already-granted', error: 'already granted' } } : { status: 200, body: { key: a.key, path: a.path } }; };
  at0 = w.calls.length;
  press(); await settle();
  const read = w.calls.slice(at0).filter(function (c) { return c.name === 'auth.branch'; })[0];
  ok(read && read.args.op === 'search' && read.args.bundle === 7, 'Grant reads the chosen bundle\'s branches: auth.branch { op: search, bundle }', 'calls: ' + short(w.calls.slice(at0)));
  const grants = w.calls.slice(at0).filter(function (c) { return c.name === 'auth.grant'; });
  ok(grants.length === 3 && grants.every(function (c) { return c.args.key === 'K3'; }) && JSON.stringify(grants.map(function (c) { return c.args.path; }).sort()) === '["desk","fs.search","jobs.list"]',
    'and asks auth.grant { key, path } once per branch, the path family.verb, or the family alone for (ALL)', 'grants: ' + short(grants.map(function (c) { return c.args; })));
  ok(!/already-granted|already granted|not granted|refused/i.test(box.innerHTML.replace(/<[^>]*>/g, ' ')), 'a path the ID holds already is counted done, never said as a refusal', 'said: ' + short(box.innerHTML.replace(/<[^>]*>/g, ' ')));
  ok(!w.calls.slice(at0).some(function (c) { return c.name === 'auth.search'; }), 'and reads no grant again: each new grant arrives on the stream, one row (rule/19)', 'calls: ' + short(w.calls.slice(at0).map(function (c) { return c.name; })));
  w.grantAnswer = function () { return { status: 403, body: { ok: false, code: 'owner-only', error: 'owner only' } }; };
  press(); await settle();
  ok(/owner-only|owner only/.test(box.innerHTML), 'a grant refused for another reason says so', 'said: ' + short(box.innerHTML.replace(/<[^>]*>/g, ' ')));
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
