'use strict';

// spirit/run/spirit/element/search/grant/test/grantsPanel.js
// The tests of spirit/element/search/grant/grantsPanel.js, and of no other module (spec: ./grantsPanel.md; goal/G41.16). The browser file
// runs in node on a BARE window (rule/26): each element is put on the page only once the panel requires it, a stand-in
// that keeps what the panel handed it: the selectors and the grant list (tested in their own folders). The panel knows no
// table: its caller hands it the ID table and the grants table (Andy: "the callers (Grants and agent shell apps should
// boody well know how to configure the damn grantsPanel element"); here a grants table shaped as the agent's is, so
// nothing of the node's auth grants can be the panel's own. The node's bundles and api tree are stubs. It asks its verbs
// through the spirit object (goal/G43.24; Andy: "every fucking element gets the interfaces it needs"), so no api.verb is
// handed: the families stand as spirit.js binds them, each verb a function answering its body or throwing its refusal,
// and every family's FS verbs under FS; the auth family on spirit.ready, a server's family through
// spirit.require(spirit.familyPath(name)). Then the table it offers by name, grantsPanel.nodeGrants (moved here from the
// Grants app), over the real auth family's cache manager.
// This is the one test file of its script (spirit/test/TEST_SYSTEM.md): the authSource and noWarning parts, once files of
// their own, are sections at its end, run after the checks above and counted with them. One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'grantsPanel.js');
const SRC = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8') : '';

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
      // Its own watch, as the auth cache manager hands it (goal/G41.28): fn(id + newline + path, row), answering its release.
      watch: function (fn) { w.grantWatchers.push(fn); return function () { w.grantWatchers = w.grantWatchers.filter(function (x) { return x !== fn; }); }; } },
  };
}

// A family as spirit.js binds it (spirit/spirit.js, bind): each verb a function of its args, answering the body on a 2xx or
// throwing { status, body }. No FS set rides on a family (goal/G43.20).
function family(w, name, verbs) {
  const f = {};
  const call = function (verb, fn) { return function (args) {
    w.calls.push({ name: name + '.' + verb, args: args });
    const a = fn(args || {});
    return Promise.resolve(a).then(function (r) { if (r && r.status >= 200 && r.status < 300) return r.body; throw { status: r && r.status, body: r && r.body }; });
  }; };
  Object.keys(verbs).forEach(function (v) { f[v] = call(v, verbs[v]); });
  return f;
}

function world() {
  const w = { required: [], calls: [], bundles: [], ids: [], families: [], grantLists: [], grantAnswer: null, branchesOf: {}, treeAsked: 0, tree: null, busy: [], rowForms: [], grantWatchers: [], warnings: {}, confirms: [], confirmAnswer: true, managers: [] };
  const E = nestSearch({
    // The shell's element shape (goal/G41.19): create(container, options) appends the control and answers it.
    'search.bundle': { create: function (c, opts) { const b = node('bundle'); b.container = c; b.opts = opts; b.value = ''; b.row = null; w.bundles.push(b); c.appendChild(b); return b; } },
    'search.contact': { create: function (c, opts) { const x = node('contact'); x.container = c; x.opts = opts || {}; x.value = ''; x.row = null; w.ids.push(x); c.appendChild(x); return x; } },
    'search.api': { create: function (c, opts) { const f = node('family'); f.container = c; f.opts = opts; f.family = ''; f.verb = ''; f.value = ''; w.families.push(f); c.appendChild(f); return f; } },
    // The busyButton (goal/G41.23), tested in its own folder: a stand-in that keeps the button and the request it is
    // handed, and runs the request on a press, keeping what it answers.
    busyButton: { attach: function (button, opts) {
      const a = { button: button, opts: opts || {}, answers: [] };
      w.busy.push(a);
      button.addEventListener('click', function () { if (typeof a.opts.run === 'function') a.answers.push(a.opts.run()); });
      return button;
    } },
    // The one-row form (goal/G41.27), tested in its own folder: a stand-in answering { root, span, button } as the real
    // one does, its root appended to the container it is given.
    rowForm: { create: function (c, opts) {
      const f = { container: c, opts: opts || {}, root: node('<div>'), span: node('<span>'), button: node('<button>') };
      f.root.appendChild(f.span); f.root.appendChild(f.button); c.appendChild(f.root); w.rowForms.push(f); return f;
    } },
    'search.grant': { create: function (host, opts) { const l = { host: host, opts: opts || {}, redrawn: 0, list: { redraw: function () { l.redrawn += 1; } } }; w.grantLists.push(l); return l; } },
  });
  // The auth family, the node's own (spirit.ready holds it): its bundles' branches, the one dictionary both kinds of grant
  // are made from; and its grant verbs, the node's grants table, nodeGrants' (below).
  const auth = family(w, 'auth', {
    branch: function (args) { return { status: 200, body: { items: (w.branchesOf[args && args.bundle] || []).map(function (b, i) { return { key: String(i + 1), label: JSON.stringify(Object.assign({ id: i + 1, bundle: args.bundle }, b)) }; }), more: false } }; },
    // auth.search answers whose grant it is as name (apiAuth.js search), the stream as label.
    search: function () { return { status: 200, body: { ok: true, items: [{ key: 'K1\nfs.search', label: JSON.stringify({ name: 'Bob', key: 'K1', path: 'fs.search' }) }, { key: 'K2\njobs.list', label: 'not json' }], more: true } }; },
    grant: function (args) { return args.path === 'fs.search' ? { status: 409, body: { ok: false, code: 'already-granted', error: 'already granted' } } : { status: 200, body: { ok: true } }; },
    revoke: function () { return { status: 200, body: { ok: true } }; },
  });
  // The node's own families on spirit.ready; a server's family (jobs here) bound through spirit.require(familyPath).
  const families = { fs: family(w, 'fs', { search: function () { return { status: 200, body: {} }; } }) };
  const servers = { jobs: family(w, 'jobs', { list: function () { return { status: 200, body: {} }; } }) };
  const FILES = { 'spirit/element/search/bundle.js': ['search'], 'spirit/element/search/contact.js': ['search'],
    'spirit/element/search/api.js': ['search'], 'spirit/element/search/grant.js': ['search'], 'spirit/element/busyButton.js': ['busyButton'], 'spirit/element/rowForm.js': ['rowForm'] };
  const page = {};
  const familyPath = function (name) { return 'spirit/app/' + String(name || '') + '/api.js'; };
  const win = {
    // The page knows its node: spirit.data files nothing before it does (goal/G41.28, Q10).
    spirit: { element: page, node: { key: 'KEY+GRANTS/PANEL==' },
      require: function (p) {
        w.required.push(String(p));
        const server = Object.keys(servers).filter(function (k) { return familyPath(k) === p; })[0];
        if (server) return Promise.resolve(servers[server]);
        // goal/G43.32: what the panel draws with stands where an element now finds it, spirit.element.spirit.element.
        (FILES[p] || []).forEach(function (k) { const at = ((page.spirit = page.spirit || {}).element = page.spirit.element || {}); at[k] = E[k]; });
        return Promise.resolve(true);
      },
      familyPath: familyPath,
      tree: function () { w.treeAsked += 1; return Promise.resolve(w.tree || TREE); },
      // A family's cache (goal/G41.28): the family's own manager, run on this window over the real data set, so the
      // server jobs the test hands spirit.data reach the panel as the page's would, and the auth tables' grants reach
      // nodeGrants.
      cacheManager: function (name) {
        w.managers.push(String(name));
        vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', String(name), 'data.js'), 'utf8'), win, { filename: name + '/data.js' });
        return Promise.resolve(true);
      },
      // The spirit object's outcome as spirit.js has it: a call's answer as { status, body }, 0 when nothing answered.
      outcome: function (c) { return Promise.resolve(c).then(function (body) { return { status: 200, body: body }; }, function (e) { return { status: (e && e.status) || 0, body: (e && e.body) || null }; }); },
      escapeHtml: function (s) { return String(s).replace(/</g, '&lt;'); } },
    document: { createElement: function (t) { return node('<' + t + '>'); }, getElementById: function (id) { return byId[id] || null; } },
    Event: function (type) { this.type = type; },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number,
    console: { log: function () {}, error: function () {} },
    confirm: function (t) { w.confirms.push(String(t)); return w.confirmAnswer; },
  };
  win.window = win;
  win.spirit.ready = Promise.resolve(Object.assign({ auth: auth }, families));
  // goal/G43.32: grantsPanel.js places itself by installSpiritElement; the recorder hands that helper to the page stand-in
  // (spirit/test/headLessChrome.js pageSpirit).
  const recorder = win.spirit.require;
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(win.spirit);
  const pageRequire = win.spirit.require;
  win.spirit.require = function (p) { return /installSpiritElement\.js$/.test(p) ? pageRequire(p) : recorder(p); };
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', 'client', 'apiTreeIndex.js'), 'utf8'), win, { filename: 'apiTreeIndex.js' });
  vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', 'data.js'), 'utf8'), win, { filename: 'data.js' });
  win.spirit.data.homeNode(win.spirit.node.key);
  if (SRC) vm.runInContext(SRC, win, { filename: FILE });
  w.win = win; w.page = page;
  return w;
}

// THE ELEMENT NAMES SINCE goal/G43.18: a stand-in keyed by its place, 'search.contact' and so on, nested where the page has it.
function nestSearch(o) { Object.keys(o).forEach(function (k) { if (k !== 'search' && k.indexOf('search.') !== 0) return; var v = o[k]; delete o[k]; var ks = k.split('.'); var at = o; ks.slice(0, -1).forEach(function (p) { at = at[p] = at[p] || {}; }); var last = ks[ks.length - 1]; at[last] = Object.assign(at[last] || {}, v); }); return o; }

// What the world and the tests make, for the tests after them.
let w, E, GP, code, unset, box, cfg, rf, inSpan, filterId, formId, gl, sels, D, dep, grantBtn, press, at0, gb, gbusy, gReq, gSettled, g, A, found;
const NO_GP = 'no grantsPanel.create registered: the world failed';
const NO_GL = 'no grant list was drawn';
const NO_G = 'no grantsPanel.nodeGrants, or no auth cache on the page';
const pass = function (r) { return sels.every(function (f) { return typeof f.test !== 'function' || f.test(r) > 0; }); };
const NIGHT = { job_id: 'J1', path: 'fs.search', job: 'Night' };
const DAY = { job_id: 'J2', path: 'gone.verb', job: 'Day' };
const said = function () { return box.innerHTML.replace(/<[^>]*>/g, ' '); };

test.run('the world: the panel runs on a bare window', 0.2, async function () {
  if (!SRC) return 'spirit/element/search/grant/grantsPanel.js is not there';
  code = SRC.replace(/\/\/.*$/gm, '');
  w = world();
  await settle();
  // goal/G43.32: the elements stand at their paths, spirit.element.spirit.element.
  E = ((w.page.spirit || {}).element || {});
  // Since goal/G43.32 the panel stands in the grant search: spirit.element.spirit.element.search.grant.grantsPanel.
  GP = ((E.search || {}).grant || {}).grantsPanel;
  return true;
}, test.limit.quick);

// a shell element that loads what it uses itself (rule/26), and knows no table
test.run('it requires spirit/element/search/contact.js', 0.2, function () {
  if (!w) return NO_GP;
  return w.required.indexOf('spirit/element/search/contact.js') !== -1 ? true : 'required: ' + short(w.required);
}, test.limit.quick);
test.run('it requires spirit/element/search/bundle.js', 0.2, function () {
  if (!w) return NO_GP;
  return w.required.indexOf('spirit/element/search/bundle.js') !== -1 ? true : 'required: ' + short(w.required);
}, test.limit.quick);
test.run('it requires spirit/element/search/api.js', 0.2, function () {
  if (!w) return NO_GP;
  return w.required.indexOf('spirit/element/search/api.js') !== -1 ? true : 'required: ' + short(w.required);
}, test.limit.quick);
test.run('it requires spirit/element/search/grant.js', 0.2, function () {
  if (!w) return NO_GP;
  return w.required.indexOf('spirit/element/search/grant.js') !== -1 ? true : 'required: ' + short(w.required);
}, test.limit.quick);
test.run('and no data script', 0.2, function () {
  if (!w) return NO_GP;
  return !w.required.some(function (p) { return /data\.js$/.test(p); }) ? true : 'required: ' + short(w.required);
}, test.limit.quick);
// The grants table and the ID table are its caller's; the node's bundles (auth.bundle, auth.branch) are the one
// dictionary both kinds of grant are made from, so a bundle's branches are the panel's to read.
// The panel itself, create(): the node's grants table beside it (nodeGrants, below) is one its caller picks by name.
// goal/G43.32: create() runs up to where the script places itself, as it ran up to E.grantsPanel = before.
test.run('the panel names no grants table and no ID table: no auth grant verb, not nodeGrants, no agent verb, no loopback location, no branch (goal/G41.16)', 0.2, function () {
  if (!code) return 'no grantsPanel.js read: the world failed';
  const made = code.slice(code.indexOf('function create('), code.indexOf("window.spirit.require('spirit/element/installSpiritElement.js')"));
  return made.length > 0 && !/auth\.(grant|revoke|search)\b|nodeGrants|data\.auth|agent\.|loopback:\/\/|contact\.search|job_id|'grants'|"grants"/.test(made) ? true : (made.length ? 'create() names a table of its own' : 'no function create( in grantsPanel.js: nothing judged');
}, test.limit.quick);
// Andy: "every fucking element gets the interfaces it needs".
test.run('it asks its verbs through the spirit object: no api.verb, no api.escapeHtml (goal/G43.24)', 0.2, function () {
  if (!code) return 'no grantsPanel.js read: the world failed';
  return !/\.verb\s*\(|\bapi\.(verb|escapeHtml)\b/.test(code) ? true : 'grantsPanel.js still asks through the api it was handed';
}, test.limit.quick);
test.run('it loads the jobs family\'s cache manager and the auth family\'s, with its parts', 0.2, function () {
  if (!w) return NO_GP;
  return w.managers.indexOf('job') !== -1 && w.managers.indexOf('auth') !== -1 ? true : 'managers: ' + short(w.managers);
}, test.limit.quick);
test.run('it registers spirit.element.spirit.element.search.grant.grantsPanel.create', 0.2, function () {
  if (!w) return NO_GP;
  return GP && typeof GP.create === 'function' ? true : 'elements: ' + short(Object.keys(E));
}, test.limit.quick);
// Unconfigured, it mounts and says so, throwing nothing (goal/G41.19, box v23: "throws nothing even when unconfigured
// (it says it is not configured)").
test.run('made without its ID table or its grants table, it throws nothing', 0.2, async function () {
  if (!GP || typeof GP.create !== 'function') return NO_GP;
  unset = [];
  [[{}, /ID table/], [{ ids: config(w).ids }, /grants table/], [{ grants: config(w).grants }, /ID table/]].forEach(function (c) {
    const host = node('x'); let threw = null; let made = null;
    try { made = GP.create(host, Object.assign({}, c[0])); } catch (e) { threw = e && e.message; }
    const said = host.kids.map(function (k) { return String(k.textContent || ''); }).join(' ');
    unset.push({ threw: threw, said: said, fits: host.kids.length === 1 && /^not configured: /.test(said) && c[1].test(said) && /\bjob-manifest-note\b/.test(host.kids[0].className),
      empties: !!made && typeof made.destroy === 'function' && (made.destroy(), host.innerHTML === '') });
  });
  await settle();
  return unset.every(function (u) { return u.threw === null; }) ? true : 'threw: ' + short(unset.map(function (u) { return u.threw; }));
}, test.limit.quick);
test.run('it says, in one note, "not configured: " and the table it lacks, and draws nothing else', 0.2, function () {
  if (!unset) return NO_GP;
  return unset.every(function (u) { return u.fits; }) && w.grantLists.length === 0 && w.bundles.length === 0 && w.ids.length === 0 && w.families.length === 0 ? true
    : 'said: ' + short(unset.map(function (u) { return u.said; })) + ', lists ' + w.grantLists.length + ', selectors ' + (w.bundles.length + w.ids.length + w.families.length);
}, test.limit.quick);
test.run('and its destroy empties the host', 0.2, function () {
  if (!unset) return NO_GP;
  return unset.every(function (u) { return u.empties; }) ? true : 'destroy: ' + short(unset.map(function (u) { return u.empties; }));
}, test.limit.quick);

// the grant form, a rowForm: ➕ [ID] [bundle] [Grant] (goal/G41.27)
// Andy, on G41.27: "grantsPanel:\n\n➕ [choose an ID… ▾][choose a bundle… ▾][Grant]". The box: "new shell element:
// rowForm",
// "spirit.element.spirit.element.rowForm.create(container, { icon, button }) -> { root, span, button }", "The mounter drops
// its form elements into span and wires the button itself (a busyButton or a click)."
test.run('one bundle selector, two ID selectors (the form\'s and the filter), one family selector', 0.2, async function () {
  if (!GP || typeof GP.create !== 'function') return NO_GP;
  box = node('panel');
  cfg = config(w);
  GP.create(box, Object.assign({}, cfg));
  await settle();
  rf = w.rowForms[0];
  // Where a selector stands in the form's span: itself, or the slot it was made in.
  inSpan = function (el) { if (!rf) return -1; return rf.span.kids.findIndex(function (k) { return k === el || k === el.container || (k.kids || []).indexOf(el) !== -1; }); };
  // The filter's ID selector says every ID when none is chosen; the form's has no such choice.
  filterId = w.ids.filter(function (c) { return !!c.opts.all; })[0];
  formId = w.ids.filter(function (c) { return c !== filterId; })[0];
  return w.bundles.length === 1 && w.ids.length === 2 && w.families.length === 1 ? true : 'bundle ' + w.bundles.length + ', ID ' + w.ids.length + ', family ' + w.families.length;
}, test.limit.quick);
test.run('each made with a container of its own, <name>.create(container, options)', 0.2, function () {
  if (!box) return NO_GP;
  const parts = w.bundles.concat(w.ids, w.families);
  return parts.every(function (x) { return x.container && x.container.kids.indexOf(x) !== -1; }) ? true : 'containers: ' + short(parts.map(function (x) { return !!x.container; }));
}, test.limit.quick);
test.run('both ID selectors search the ID table it was handed: its location, key and label fields', 0.2, function () {
  if (!box) return NO_GP;
  return w.ids.every(function (c) { return c.opts.table === cfg.ids.table && c.opts.key === cfg.ids.key && c.opts.label === cfg.ids.label; }) ? true : 'ID selectors: ' + short(w.ids.map(function (c) { return c.opts; }));
}, test.limit.quick);
test.run('it loads the rowForm itself (rule/26)', 0.2, function () {
  if (!w) return NO_GP;
  return w.required.indexOf('spirit/element/rowForm.js') !== -1 ? true : 'required: ' + short(w.required);
}, test.limit.quick);
test.run('its grant form is one rowForm, its icon ➕ and its button Grant', 0.2, function () {
  if (!box) return NO_GP;
  return w.rowForms.length === 1 && rf.opts.icon === '➕' && rf.opts.button === 'Grant' ? true : 'rowForms: ' + short(w.rowForms.map(function (f) { return f.opts; }));
}, test.limit.quick);
test.run('its span holds the ID selector, then the bundle selector, and nothing else', 0.2, function () {
  if (!box) return NO_GP;
  return !!formId && inSpan(formId) !== -1 && inSpan(formId) < inSpan(w.bundles[0]) && rf.span.kids.length === 2 ? true
    : 'span: ID at ' + (formId ? inSpan(formId) : 'none') + ', bundle at ' + inSpan(w.bundles[0]) + ', of ' + (rf ? rf.span.kids.length : 0);
}, test.limit.quick);
test.run('the word "grant" at its start is gone, ➕ in its place, and it draws no Grant button of its own', 0.2, function () {
  if (!box) return NO_GP;
  const text = box.innerHTML.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  return !/\bgrant\b/i.test(text) && !/<button[^>]*>\s*Grant\s*<\/button>/.test(box.innerHTML) ? true : 'panel says: ' + short(text);
}, test.limit.quick);
test.run('the rowForm\'s button is the Grant, a busyButton (goal/G41.23)', 0.2, function () {
  if (!box) return NO_GP;
  return !!rf && w.busy.some(function (a) { return a.button === rf.button; }) ? true : 'busyButtons: ' + w.busy.length;
}, test.limit.quick);

// its selectors go into the search's 🪣 row: no filter line of its own (goal/G41.26)
// Andy, on G41.26: "any searchSelector in our system must go into the probabilitySearch's selectorRow, so that the
// user-can see, which elements belong to the search.", and "do it for all probabilitySearch object in the new
// face-shell. go." The shape (cw, under that go): the grant panel hands its ID and family selectors to the 🪣 row, its
// own filter line goes, and its deprecated becomes a plain 🗜 toggle.
test.run('it draws no filter line of its own, and no deprecated button', 0.2, function () {
  if (!box) return NO_GP;
  const html = box.innerHTML;
  return filterId && w.families[0] && !/data-grants="filters"/.test(html) && !/data-grants="deprecated"/.test(html) ? true : 'panel: ' + short(html.slice(html.indexOf('data-grants="said"')));
}, test.limit.quick);
// the list: the grant list, of the same grants table, the one box that fills (rule/16)
test.run('one grant list, handed the grants table it was given, in a fill box', 0.2, function () {
  if (!box) return NO_GP;
  gl = w.grantLists[0];
  if (gl) sels = Array.isArray(gl.opts.selectors) ? gl.opts.selectors : [];
  return w.grantLists.length === 1 && gl && gl.opts.grants === cfg.grants && /\bfill\b/.test(String(gl.host.className || '')) ? true
    : 'grant lists ' + w.grantLists.length + ', same table ' + (gl && gl.opts.grants === cfg.grants) + ', host ' + short(gl && gl.host.className);
}, test.limit.quick);
// WHAT IT NEEDS, IT REQUIRES ITSELF (goal/G43.24): mounted with no api, it hands the grant list none.
test.run('it hands the grant list no api: its rows\' arming buttons hear a click elsewhere themselves', 0.2, function () {
  if (!gl) return NO_GL;
  return !('api' in gl.opts) ? true : 'grant list handed: ' + short(Object.keys(gl.opts));
}, test.limit.quick);
test.run('nothing above the list fills: the heading, the form and the filters take their own height', 0.2, function () {
  if (!gl) return NO_GL;
  const fills = box.nodes.filter(function (n) { return /\bfill\b/.test(n.className || ''); }).length + box.kids.filter(function (k) { return k !== gl.host && /\bfill\b/.test(k.className || ''); }).length;
  return fills === 0 ? true : fills + ' other fill box(es): ' + short(box.innerHTML.slice(0, 120));
}, test.limit.quick);
test.run('it hands the grant list its selectors: the ID filter, then the family selector, each named with its test', 0.2, function () {
  if (!gl) return NO_GL;
  return sels.length === 2 && sels[0].element === filterId && sels[1].element === w.families[0] && sels.every(function (x) { return typeof x.test === 'function' && !!x.name; }) ? true
    : 'selectors: ' + short(sels.map(function (x) { return { name: x.name, id: x.element === filterId, family: x.element === w.families[0] }; }));
}, test.limit.quick);

// the selectors narrow it, by the grants table's own key field
test.run('nothing chosen: every grant passes', 0.2, function () {
  if (!gl) return NO_GL;
  return pass(NIGHT) && pass(DAY) ? true : 'passed: ' + [pass(NIGHT), pass(DAY)].join(' ');
}, test.limit.quick);
test.run('the ID filter narrows to that ID\'s grants, read from the table\'s key field', 0.2, function () {
  if (!gl) return NO_GL;
  if (!filterId) return 'no ID filter was drawn';
  filterId.value = 'J1'; filterId.fire('change', { target: filterId });
  const r = pass(NIGHT) && !pass(DAY) ? true : 'Night ' + pass(NIGHT) + ', Day ' + pass(DAY);
  filterId.value = ''; filterId.fire('change', { target: filterId });
  return r;
}, test.limit.quick);
test.run('the family filter narrows to that family\'s paths', 0.2, function () {
  if (!gl) return NO_GL;
  const fam = w.families[0];
  if (!fam) return 'no family selector was drawn';
  fam.family = 'gone'; fam.value = 'gone'; fam.fire('change', { target: fam });
  return !pass(NIGHT) && pass(DAY) ? true : 'Night ' + pass(NIGHT) + ', Day ' + pass(DAY);
}, test.limit.quick);
test.run('a verb chosen narrows to that verb', 0.2, function () {
  if (!gl) return NO_GL;
  const fam = w.families[0];
  if (!fam) return 'no family selector was drawn';
  fam.family = 'fs'; fam.verb = 'search'; fam.value = 'fs.search'; fam.fire('change', { target: fam });
  const r = pass(NIGHT) && !pass({ job_id: 'J1', path: 'fs.loadFile', job: 'Night' }) ? true : 'fs.search ' + pass(NIGHT);
  fam.family = ''; fam.verb = ''; fam.value = ''; fam.fire('change', { target: fam });
  return r;
}, test.limit.quick);

// deprecated: a report, following the stream, its filter off by default
test.run('the tree is read through spirit.tree(), and the list told what it serves', 0.2, function () {
  if (!gl) return NO_GL;
  return w.treeAsked >= 1 && typeof gl.opts.serves === 'function' && gl.opts.serves('fs.search') === true && gl.opts.serves('gone.verb') === false ? true
    : 'tree asked ' + w.treeAsked + ', serves ' + short(typeof gl.opts.serves === 'function' ? [gl.opts.serves('fs.search'), gl.opts.serves('gone.verb')] : null);
}, test.limit.quick);
test.run('a server job changed: the tree is read again, and the grant it now serves is no longer deprecated', 0.2, async function () {
  if (!gl) return NO_GL;
  if (typeof gl.opts.serves !== 'function') return 'the list was told nothing it serves';
  D = w.win.spirit.data;
  const asked0 = w.treeAsked;
  w.tree = Object.assign({}, TREE, { gone: { verb: {} } });
  D.takeJob({ id: 'spirit.app.gone', kind: 'server', status: 'running', module: 'spirit.app.gone', data: {} });
  await settle();
  const r = w.treeAsked > asked0 && gl.opts.serves('gone.verb') === true ? true : 'serves gone.verb ' + gl.opts.serves('gone.verb');
  w.tree = TREE;
  D.takeJob({ id: 'spirit.app.gone', kind: 'server', status: 'exited', module: 'spirit.app.gone', data: {} });
  await settle();
  return r;
}, test.limit.quick);
test.run('deprecated is a plain toggle of the search, its button drawn in the 🗜 row, off at first: a grant no server serves is left out', 0.2, function () {
  if (!gl) return NO_GL;
  dep = (gl.opts.filters || []).filter(function (f) { return f && f.name === 'deprecated'; })[0];
  return !!dep && dep.toggle === true && (typeof dep.when !== 'function' || dep.when([]) !== false) && dep.test(DAY, undefined) === 0 && dep.test(NIGHT, undefined) === 1 ? true
    : 'deprecated: ' + short(dep && { toggle: dep.toggle, hidden: typeof dep.when === 'function' && dep.when([]) === false, off: dep.test(DAY, undefined), served: dep.test(NIGHT, undefined) });
}, test.limit.quick);
test.run('its toggle on, the deprecated grants are listed', 0.2, function () {
  return dep && dep.test(DAY, true) === 1 ? true : 'Day ' + (dep && dep.test(DAY, true));
}, test.limit.quick);

// Grant: the bundle's branches, through the grants table it was handed
const NO_FORM = 'no grant form was drawn';
test.run('with no bundle or no ID chosen, Grant asks nothing', 0.2, async function () {
  if (!box) return NO_GP;
  D = w.win.spirit.data;
  grantBtn = rf ? rf.button : null;
  press = function () { if (grantBtn) grantBtn.fire('click', { target: grantBtn, preventDefault: function () {} }); };
  at0 = w.calls.length;
  press(); await settle();
  return !w.calls.slice(at0).some(function (c) { return c.name === 'grants.grant'; }) ? true : 'calls: ' + short(w.calls.slice(at0));
}, test.limit.quick);
test.run('Grant reads the chosen bundle\'s branches: auth.branch { op: search, bundle }', 0.2, async function () {
  if (!press) return NO_FORM;
  if (!formId || !w.bundles[0]) return 'no ID or no bundle selector to choose in';
  w.bundles[0].value = 7; w.bundles[0].row = { id: 7, label: 'Reader' };
  w.branchesOf[7] = [{ family: 'jobs', verb: 'list' }, { family: 'fs', verb: 'search' }, { family: 'desk', verb: '' }];
  formId.value = 'J3'; formId.row = { key: 'J3', name: 'Cat' };
  w.grantAnswer = function (id, p) { return p === 'fs.search' ? { ok: false, code: 'already-granted', error: 'already granted' } : { ok: true }; };
  at0 = w.calls.length;
  press(); await settle();
  const read = w.calls.slice(at0).filter(function (c) { return c.name === 'auth.branch'; })[0];
  return read && read.args.op === 'search' && read.args.bundle === 7 ? true : 'calls: ' + short(w.calls.slice(at0));
}, test.limit.quick);
test.run('and grants each through the grants table it was handed, grant(id, path): family.verb, or the family alone for (ALL)', 0.2, function () {
  if (!press) return NO_FORM;
  const grants = w.calls.slice(at0).filter(function (c) { return c.name === 'grants.grant'; });
  return grants.length === 3 && grants.every(function (c) { return c.args.id === 'J3'; }) && JSON.stringify(grants.map(function (c) { return c.args.path; }).sort()) === '["desk","fs.search","jobs.list"]' ? true
    : 'grants: ' + short(grants.map(function (c) { return c.args; }));
}, test.limit.quick);
test.run('nothing is granted, or read, past the table it was handed', 0.2, function () {
  if (!press) return NO_FORM;
  return !w.calls.slice(at0).some(function (c) { return /^auth\.(grant|search)$/.test(c.name) || /^agent\./.test(c.name); }) ? true : 'calls: ' + short(w.calls.slice(at0).map(function (c) { return c.name; }));
}, test.limit.quick);
test.run('a path the ID holds already is counted done, never said as a refusal', 0.2, function () {
  if (!press) return NO_FORM;
  return !/already-granted|already granted|not granted|refused/i.test(said()) ? true : 'said: ' + short(said());
}, test.limit.quick);
test.run('and reads no grant again (rule/19)', 0.2, function () {
  if (!press) return NO_FORM;
  return !w.calls.slice(at0).some(function (c) { return c.name === 'grants.search'; }) ? true : 'calls: ' + short(w.calls.slice(at0).map(function (c) { return c.name; }));
}, test.limit.quick);
// Andy: "EVERY FUCKING ELEMENT is verified to make sure when it changes shit it listens to fucking update via the spirit
// object": the grants it sent come back through the grants table's own watch, and the panel says they arrived.
test.run('a grant it sent, arriving through the grants table\'s watch, is said as arrived', 0.2, async function () {
  if (!press) return NO_FORM;
  const said0 = box.innerHTML;
  w.grantWatchers.slice().forEach(function (fn) { fn('J3\njobs.list', { job_id: 'J3', path: 'jobs.list' }); });
  await settle();
  return w.grantWatchers.length > 0 && /arrived/.test(said()) && box.innerHTML !== said0 ? true : 'watchers ' + w.grantWatchers.length + ', said: ' + short(said());
}, test.limit.quick);
test.run('a grant refused for another reason says so', 0.2, async function () {
  if (!press) return NO_FORM;
  w.grantAnswer = function () { return { ok: false, code: 'owner-only', error: 'owner only' }; };
  press(); await settle();
  return /owner-only|owner only/.test(box.innerHTML) ? true : 'said: ' + short(said());
}, test.limit.quick);

// no warning before a grant (goal/G43.27)
// Andy: "compare that to giving a linux user root authority, he then can fuck up the whole system, not our problem."
let conf0;
test.run('Grant reads no <verb>.warning.txt', 0.2, async function () {
  if (!press) return NO_FORM;
  w.warnings['jobs.list'] = 'it lists every job';
  w.confirmAnswer = false;
  at0 = w.calls.length;
  conf0 = w.confirms.length;
  press(); await settle();
  const read1 = w.calls.slice(at0).filter(function (c) { return /\.FS\.loadFile$/.test(c.name) && /\.warning\.txt$/.test(String((c.args && c.args.path) || '')); });
  return read1.length === 0 ? true : 'warnings read: ' + short(read1);
}, test.limit.quick);
test.run('the owner is asked nothing before the grant', 0.2, function () {
  if (conf0 === undefined) return NO_FORM;
  return w.confirms.slice(conf0).length === 0 ? true : 'asked: ' + short(w.confirms.slice(conf0));
}, test.limit.quick);
test.run('the grant goes out at once', 0.2, function () {
  if (conf0 === undefined) return NO_FORM;
  const r = w.calls.slice(at0).some(function (c) { return c.name === 'grants.grant'; }) ? true : 'calls: ' + short(w.calls.slice(at0).map(function (c) { return c.name; }));
  w.warnings = {};
  if (w.bundles[0]) { w.bundles[0].value = 7; w.bundles[0].row = { id: 7, label: 'Reader' }; }
  return r;
}, test.limit.quick);
test.run('grantsPanel.js holds no warning reading and no confirm', 0.2, function () {
  return !/warning\.txt|window\.confirm/.test(fs.readFileSync(path.join(RUN, 'spirit', 'element', 'search', 'grant', 'grantsPanel.js'), 'utf8').replace(/\/\/[^\n]*/g, '')) ? true : 'grantsPanel.js still reads warnings or confirms';
}, test.limit.quick);
test.run('spirit/auth/grant.warning.txt is gone', 0.2, function () {
  return !fs.existsSync(path.join(RUN, 'spirit', 'auth', 'grant.warning.txt')) ? true : 'spirit/auth/grant.warning.txt is still there';
}, test.limit.quick);

// Grant is a busyButton, waiting until every grant is answered (goal/G41.23)
// Box: "first users: Ask in the agent's Update model list, and Grant in the grants panel".
test.run('it loads the busyButton itself (rule/26)', 0.2, function () {
  if (!w) return NO_GP;
  return w.required.indexOf('spirit/element/busyButton.js') !== -1 ? true : 'required: ' + short(w.required);
}, test.limit.quick);
// The panel may draw its form again when it says something: its Grant button is found again.
// Since goal/G41.27 it is the rowForm's button.
test.run('its Grant button is made a busyButton, the grant its request', 0.2, function () {
  if (!box) return NO_GP;
  gb = rf ? rf.button : null;
  gbusy = w.busy.filter(function (a) { return a.button === gb; }).pop() || null;
  return !!gbusy && typeof gbusy.opts.run === 'function' ? true : 'busyButtons: ' + w.busy.length + (gbusy ? ', the Grant one with no request' : ', none on the Grant button');
}, test.limit.quick);
let letGo = null;
test.run('a press grants, and the request it hands the button is still waiting while the grant is not answered', 0.2, async function () {
  if (!gbusy) return 'no busyButton on the Grant button';
  w.grantAnswer = function () { return new Promise(function (r) { letGo = r; }); };
  const before = gbusy.answers.length;
  const at1 = w.calls.length;
  gb.fire('click', { target: gb, preventDefault: function () {} });
  await settle();
  gReq = gbusy.answers[before];
  gSettled = false;
  Promise.resolve(gReq).then(function () { gSettled = true; }, function () { gSettled = true; });
  await settle();
  const asked = w.calls.slice(at1).filter(function (c) { return c.name === 'grants.grant'; }).length;
  return asked === 1 && !!gReq && typeof gReq.then === 'function' && !gSettled ? true
    : 'grants asked ' + asked + ', the request answered ' + (gReq && typeof gReq.then === 'function' ? (gSettled ? 'a promise already settled' : 'a promise') : short(gReq));
}, test.limit.quick);
test.run('and it settles once every grant is answered, so the button is plain again', 0.2, async function () {
  if (!gbusy) return 'no busyButton on the Grant button';
  w.grantAnswer = null;
  for (let i = 0; i < 5 && letGo; i++) { const go = letGo; letGo = null; go({ ok: true }); await settle(); }
  return gSettled ? true : 'still waiting after the answers';
}, test.limit.quick);

// grantsPanel.nodeGrants: the node's own grants table, one a caller picks by name (goal/G43.24)
// goal/G43.24: "Still its own: the panel's data source, auth.search and auth.grant / auth.revoke over the auth cache
// (GR_GRANTS). It moves into grantsPanel."
test.run('grantsPanel.nodeGrants: its branch the auth family\'s cache (spirit.data.auth.data.grants.branch), keyed key, labelled label', 0.2, function () {
  if (!GP) return NO_GP;
  g = GP.nodeGrants;
  A = ((w.win.spirit.data || {}).auth || {}).data;
  return !!g && !!A && g.branch === A.grants.branch && g.key === 'key' && g.label === 'label' ? true : 'nodeGrants ' + short(g && { branch: g.branch, key: g.key, label: g.label }) + ', auth cache ' + !!A;
}, test.limit.quick);
test.run('with search, grant, revoke and watch, and no stream of its own', 0.2, function () {
  if (!g || !A) return NO_G;
  return ['search', 'grant', 'revoke', 'watch'].every(function (f) { return typeof g[f] === 'function'; }) && !('stream' in g) ? true : 'nodeGrants: ' + short(Object.keys(g));
}, test.limit.quick);
test.run('the panel takes it as a grants table: configured with it, it says nothing is missing', 0.2, async function () {
  if (!g || !A) return NO_G;
  const panelOk = node('ok');
  GP.create(panelOk, { ids: { table: 'loopback://api/contact/search' }, grants: g });
  await settle();
  return !/not configured/.test(panelOk.kids.map(function (k) { return k.textContent; }).join(' ')) ? true : 'said: ' + short(panelOk.kids.map(function (k) { return k.textContent; }));
}, test.limit.quick);
test.run('search(text) asks spirit\'s auth.search { text } and answers its { items, more }', 0.2, async function () {
  if (!g || !A) return NO_G;
  const at = w.calls.length;
  found = await g.search('bo');
  const s = w.calls.slice(at)[0];
  return s && s.name === 'auth.search' && s.args.text === 'bo' && found && Array.isArray(found.items) && found.more === true ? true : 'asked ' + short(s) + ', found ' + short(found);
}, test.limit.quick);
// Found by cw live (goal/G41.16): auth.search says whose grant it is as name, and the panel reads its table's label field.
test.run('a found grant carries whose it is in the table\'s label field, label', 0.2, function () {
  if (!found || !Array.isArray(found.items)) return 'search found nothing';
  let hit = null; try { hit = JSON.parse(found.items[0].label); } catch (e) { hit = null; }
  return hit && hit[g.label] === 'Bob' && hit.key === 'K1' && hit.path === 'fs.search' ? true : 'found row: ' + short(hit);
}, test.limit.quick);
test.run('a row it cannot read is handed on as it came', 0.2, function () {
  if (!found || !Array.isArray(found.items)) return 'search found nothing';
  return found.items[1] && found.items[1].label === 'not json' ? true : 'row: ' + short(found.items[1]);
}, test.limit.quick);
test.run('grant(id, path) asks auth.grant { key, path } and answers { ok: true }', 0.2, async function () {
  if (!g || !A) return NO_G;
  const at = w.calls.length;
  const madeG = await g.grant('K3', 'jobs.list');
  const gr = w.calls.slice(at)[0];
  return gr && gr.name === 'auth.grant' && gr.args.key === 'K3' && gr.args.path === 'jobs.list' && madeG && madeG.ok === true ? true : 'asked ' + short(gr) + ', answered ' + short(madeG);
}, test.limit.quick);
test.run('a refusal answers { ok: false, code, error }, in the node\'s words', 0.2, async function () {
  if (!g || !A) return NO_G;
  const already = await g.grant('K3', 'fs.search');
  return already && already.ok === false && already.code === 'already-granted' && already.error === 'already granted' ? true : 'answered ' + short(already);
}, test.limit.quick);
test.run('revoke(id, path) asks auth.revoke { key, path } and answers { ok: true }', 0.2, async function () {
  if (!g || !A) return NO_G;
  const at = w.calls.length;
  const rvd = await g.revoke('K3', 'jobs.list');
  const rv = w.calls.slice(at)[0];
  return rv && rv.name === 'auth.revoke' && rv.args.key === 'K3' && rv.args.path === 'jobs.list' && rvd && rvd.ok === true ? true : 'asked ' + short(rv) + ', answered ' + short(rvd);
}, test.limit.quick);
// WHO ASKS FOR A CHANGE LISTENS FOR IT (goal/G41.27, G41.28): a grant the node's auth job hands comes back through watch.
let heard, off;
test.run('watch(fn): a grant kept in spirit.data.auth is heard as <key>\\n<path> with its row, and once revoked with none', 0.2, function () {
  if (!g || !A) return NO_G;
  D = w.win.spirit.data;
  heard = [];
  off = g.watch(function (k, row) { heard.push({ k: k, row: row }); });
  D.takeJob({ id: 'spirit.auth', data: { table: 'grant', row: { key: 'K9', path: 'jobs.list', label: 'Zed' } } });
  D.takeJob({ id: 'spirit.auth', data: { table: 'grant', row: { key: 'K9', path: 'jobs.list' }, gone: true } });
  return heard.length === 2 && heard[0].k === 'K9\njobs.list' && heard[0].row && heard[0].row.label === 'Zed' && heard[1].k === 'K9\njobs.list' && !heard[1].row ? true : 'heard: ' + short(heard);
}, test.limit.quick);
test.run('its release ends the watch', 0.2, function () {
  if (!heard) return NO_G;
  if (typeof off === 'function') off();
  D.takeJob({ id: 'spirit.auth', data: { table: 'grant', row: { key: 'K8', path: 'jobs.list', label: 'Yan' } } });
  return typeof off === 'function' && heard.length === 2 ? true : 'heard after release: ' + short(heard.slice(2));
}, test.limit.quick);

// ── THE AUTHSOURCE PART (once its own file; one test file per script: spirit/test/TEST_SYSTEM.md) ──
// GRANTS' DATA SOURCE IS grantsPanel'S (goal/G43.24, requirement 6; spec: ./grantsPanel.md, section "authSource"). The box: "Still its
// own: the panel's data source, auth.search and auth.grant / auth.revoke over the auth cache (GR_GRANTS). It moves into
// grantsPanel." Andy: "no i want those apps to basically be wrappers for spirit/element/ things....". grantsPanel.js read as
// it is, comments stripped.
// authSource: Grants' data source is grantsPanel's (goal/G43.24); the box, 6: Grants' data source "moves into grantsPanel"
function codeOf(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'); } catch (e) { return ''; } }
let panel = '';
test.run('the world: spirit/element/search/grant/grantsPanel.js is there', 0.2, function () {
  panel = codeOf(path.join(RUN, 'spirit', 'element', 'search', 'grant', 'grantsPanel.js'));
  return panel.length > 0 ? true : 'no grantsPanel.js: nothing judged';
}, test.limit.quick);
test.run('Grants\' data source moves into grantsPanel: it asks auth.search', 0.2, function () {
  return /\bauth\W{1,4}search\b/.test(panel) ? true : 'grantsPanel.js asks no auth.search';
}, test.limit.quick);
test.run('Grants\' data source moves into grantsPanel: it asks auth.grant', 0.2, function () {
  return /\bauth\W{1,4}grant\b/.test(panel) ? true : 'grantsPanel.js asks no auth.grant';
}, test.limit.quick);
test.run('Grants\' data source moves into grantsPanel: it asks auth.revoke', 0.2, function () {
  return /\bauth\W{1,4}revoke\b/.test(panel) ? true : 'grantsPanel.js asks no auth.revoke';
}, test.limit.quick);
test.run('grantsPanel holds the auth cache it reads (spirit.data.auth)', 0.2, function () {
  const holds = /\bdata\.auth\b|cacheManager\s*\(\s*['"]auth['"]/.test(panel);
  return holds ? true : 'grantsPanel.js reads no auth cache';
}, test.limit.quick);

// ── THE NOWARNING PART (once its own file; one test file per script: spirit/test/TEST_SYSTEM.md) ──
// NO WARNING ON A GRANT (goal/G43.27, requirement 7; spec: ./grantsPanel.md, section "noWarning"). Andy: "compare that to giving a linux
// user root authority, he then can fuck up the whole system, not our problem.": grantsPanel reads no <verb>.warning.txt, and
// none is left, spirit/auth/grant.warning.txt among them. The tree read as it is, comments stripped.
// noWarning: no warning on a grant (goal/G43.27); 7. no warning on a grant
const { execSync } = require('child_process');
const REPO = path.resolve(RUN, '..', '..');
function stripped(text) { return String(text).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1'); }
// Line ends aside: a Windows checkout (autocrlf) holds CRLF where git holds LF.
function readRun(rel) { const f = path.join(RUN, rel); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n') : ''; }
let tracked = [];
let gp = '';
test.run('the world: more than a hundred tracked files on disk are read', 0.2, function () {
  tracked = execSync('git ls-files', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean).filter(function (f) { return fs.existsSync(path.join(REPO, f)); });
  return tracked.length > 100 ? true : 'only ' + tracked.length + ' tracked files read: nothing judged';
}, test.limit.quick);
test.run('with no warning on a grant, spirit/auth/grant.warning.txt is gone', 0.2, function () {
  return !fs.existsSync(path.join(RUN, 'spirit', 'auth', 'grant.warning.txt')) ? true : 'spirit/auth/grant.warning.txt is still there';
}, test.limit.quick);
test.run('the world: grantsPanel.js is read', 0.2, function () {
  gp = stripped(readRun('spirit/element/search/grant/grantsPanel.js'));
  return gp.length > 1000 ? true : 'no grantsPanel.js: nothing judged';
}, test.limit.quick);
test.run('grantsPanel reads no <verb>.warning.txt', 0.2, function () {
  if (!gp) return 'no grantsPanel.js read';
  return !/warning\.txt|\.FS\.loadFile/.test(gp) ? true : 'grantsPanel still reads one';
}, test.limit.quick);
test.run('no <verb>.warning.txt is left', 0.2, function () {
  const warns = tracked.filter(function (f) { return /\.warning\.txt$/.test(f); });
  return !warns.length ? true : warns.length + ' are: ' + short(warns);
}, test.limit.quick);
