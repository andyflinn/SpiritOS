'use strict';

// spirit/run/spirit/element/search/grant/grantsPanel/test/script.js
// The tests of spirit/element/search/grant/grantsPanel/script.js, and of no other module (spec: ./script.md; goal/G41.16). The browser file
// runs in node on a BARE window (rule/26): each element is put on the page only once the panel requires it, a stand-in
// that keeps what the panel handed it: the selectors and the grant list (tested in their own folders). The panel knows no
// table: its caller hands it the ID table and the grants table (Andy: "the callers (Grants and agent shell apps should
// boody well know how to configure the damn grantsPanel element"); here a grants table shaped as the agent's is, so
// nothing of the node's auth grants can be the panel's own. The node's bundles and api tree are stubs. It asks its verbs
// through the spirit object (goal/G43.24; Andy: "every fucking element gets the interfaces it needs"), so no api.verb is
// handed: the families stand as spirit.js binds them, each verb a function answering its body or throwing its refusal,
// and every family's FS verbs under FS; the auth family on spirit.readyPromise, a server's family through
// spirit.requireScript of its api.js path. Then the table it offers by name, grantsPanel.nodeGrants (moved here from the
// Grants app), over the real auth branch's data.js, which its api.js requires.
// This is the one test file of its script (spirit/test/TEST_SYSTEM.md): the authSource and noWarning parts, once files of
// their own, are sections at its end, run after the checks above and counted with them. One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'spirit.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6).
const SUBJECT = 'spirit/element/search/grant/grantsPanel/script.js';
const FILE = path.join(RUN, SUBJECT);
const SRC = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8') : '';

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
      // Its rows as a grants table answers them (goal/G47.4): { key, label } with the row as JSON in label, every one at once.
      // w.searchCap set, it answers that many at most and says more, as one packet does.
      search: function (text) {
        w.calls.push({ name: 'grants.search', args: text });
        // Best first, as the node's search ranks by the text (cw): a row holding more of its words comes first, ties as
        // the table holds them.
        const words = String(text || '').split(/[^\w]+/).filter(Boolean);
        const score = function (r) { const s = r.job_id + ' ' + r.path + ' ' + r.job; return words.filter(function (x) { return s.indexOf(x) !== -1; }).length; };
        const ranked = w.grantRows.map(function (r, i) { return { r: r, i: i, s: score(r) }; }).sort(function (a, b) { return b.s - a.s || a.i - b.i; });
        const all = ranked.map(function (x) { return { key: x.r.job_id + '\n' + x.r.path, label: JSON.stringify(x.r) }; });
        const items = w.searchCap ? all.slice(0, w.searchCap) : all;
        return Promise.resolve({ items: items, more: items.length < all.length });
      },
      grant: function (id, p) { w.calls.push({ name: 'grants.grant', args: { id: id, path: p } }); return Promise.resolve(w.grantAnswer ? w.grantAnswer(id, p) : { ok: true }); },
      // A revoked grant is gone from the table, as the node's is.
      revoke: function (id, p) {
        w.calls.push({ name: 'grants.revoke', args: { id: id, path: p } });
        w.grantRows = w.grantRows.filter(function (r) { return !(r.job_id === id && r.path === p); });
        return Promise.resolve({ ok: true });
      },
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
  const w = { required: [], calls: [], bundles: [], ids: [], families: [], grantLists: [], grantAnswer: null, branchesOf: {}, treeAsked: 0, tree: null, busy: [], arming: [], grantRows: [], rowForms: [], grantWatchers: [], warnings: {}, confirms: [], confirmAnswer: true, ran: {} };
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
      f.root.appendChild(f.span); f.root.appendChild(f.button); c.appendChild(f.root); w.rowForms.push(f);
      // A press calls press, the mounter's request, and keeps what it answers, as the real one's busyButton waits on it.
      f.answers = [];
      f.button.addEventListener('click', function () { if (typeof f.opts.press === 'function') f.answers.push(f.opts.press()); });
      return f;
    } },
    // The arming button (goal/G41.9), tested in its own folder: a stand-in that keeps the button and its options; the first
    // press arms it, the second disarms it and runs, keeping what run answers.
    armingButton: { attach: function (button, opts) {
      const a = { button: button, opts: opts || {}, armed: false, answers: [] };
      w.arming.push(a);
      button.addEventListener('click', function () {
        if (!a.armed) { a.armed = true; return; }
        a.armed = false;
        if (typeof a.opts.run === 'function') a.answers.push(a.opts.run());
      });
      return button;
    } },
    'search.grant': { create: function (host, opts) { const l = { host: host, opts: opts || {}, redrawn: 0, list: { redraw: function () { l.redrawn += 1; } } }; w.grantLists.push(l); return l; } },
  });
  // The auth family, the node's own (spirit.readyPromise holds it): its bundles' branches, the one dictionary both kinds of grant
  // are made from; and its grant verbs, the node's grants table, nodeGrants' (below).
  const auth = family(w, 'auth', {
    branch: function (args) { return { status: 200, body: { items: (w.branchesOf[args && args.bundle] || []).map(function (b, i) { return { key: String(i + 1), label: JSON.stringify(Object.assign({ id: i + 1, bundle: args.bundle }, b)) }; }), more: false } }; },
    // auth.search answers whose grant it is as name (apiAuth.js search), the stream as label.
    search: function () { return { status: 200, body: { ok: true, items: [{ key: 'K1\nfs.search', label: JSON.stringify({ name: 'Bob', key: 'K1', path: 'fs.search' }) }, { key: 'K2\njobs.list', label: 'not json' }], more: true } }; },
    grant: function (args) { return args.path === 'fs.search' ? { status: 409, body: { ok: false, code: 'already-granted', error: 'already granted' } } : { status: 200, body: { ok: true } }; },
    revoke: function () { return { status: 200, body: { ok: true } }; },
  });
  // The node's own families on spirit.readyPromise; a server's family (jobs here) bound through spirit.requireScript of spirit/app/<name>/api.js.
  const families = { fs: family(w, 'fs', { search: function () { return { status: 200, body: {} }; } }) };
  const servers = { jobs: family(w, 'jobs', { list: function () { return { status: 200, body: {} }; } }) };
  // ITS PARTS ARE requireScript's ANSWERS (goal/G49.9, box v5: "a test hands its stand-ins as requireScript's answers ... never by
  // writing them into spirit.required"; Andy: "spirit.requireScript must allways return either an object or a function... or
  // fail/throw"): each element the panel draws with is the stand-in its path answers.
  const FILES = { 'spirit/element/search/bundle/script.js': function () { return E.search.bundle; }, 'spirit/element/search/contact/script.js': function () { return E.search.contact; },
    'spirit/element/search/api/script.js': function () { return E.search.api; }, 'spirit/element/search/grant/script.js': function () { return E.search.grant; },
    'spirit/element/busyButton/script.js': function () { return E.busyButton; }, 'spirit/element/rowForm/script.js': function () { return E.rowForm; },
    'spirit/element/armingButton/script.js': function () { return E.armingButton; } };
  const page = {};
  const companionOf = function (p) {
    const m = /^spirit\/(.+)\/api\.js$/.exec(String(p));
    const companion = m ? 'spirit/' + m[1] + '/data.js' : '';
    // By its path, through the page stand-in, which runs it in this window (goal/G49.6).
    if (companion && !w.ran[companion] && fs.existsSync(path.join(RUN, companion))) { w.ran[companion] = true; pageRequire(companion); }
  };
  const appApi = function (name) { return 'spirit/app/' + String(name || '') + '/api.js'; };
  const win = {
    // The page knows its node: spirit.required.spirit.data files nothing before it does (goal/G41.28, Q10).
    spirit: { required: page, nodeFacts: { key: 'KEY+GRANTS/PANEL==' },
      requireScript: function (p) {
        w.required.push(String(p));
        const server = Object.keys(servers).filter(function (k) { return appApi(k) === p; })[0];
        if (server) return Promise.resolve(servers[server]);
        // The node's own branches by their api.js paths (goal/G49.6: never by a name): auth, and fs.
        if (p === 'spirit/fs/api.js') return Promise.resolve(families.fs);
        if (p === 'spirit/auth/api.js') { companionOf(p); return Promise.resolve(auth); }
        // A branch's api.js: its real companion data.js run once on this window over the real data set, as the real api.js
        // requires it (goal/G47.1), so the server jobs the test hands spirit.required.spirit.data reach the panel as the page's would, and
        // the auth tables' grants reach nodeGrants.
        companionOf(p);
        return Promise.resolve(FILES[p] ? FILES[p]() : {});
      },
     
      apiTree: function () { w.treeAsked += 1; return Promise.resolve(w.tree || TREE); },
      // The spirit object's outcome as spirit.js has it: a call's answer as { status, body }, 0 when nothing answered.
      callOutcome: function (c) { return Promise.resolve(c).then(function (body) { return { status: 200, body: body }; }, function (e) { return { status: (e && e.status) || 0, body: (e && e.body) || null }; }); },
      escapeHtml: function (s) { return String(s).replace(/</g, '&lt;'); } },
    document: { createElement: function (t) { return node('<' + t + '>'); }, getElementById: function (id) { return byId[id] || null; } },
    Event: function (type) { this.type = type; },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number,
    console: { log: function () {}, error: function () {} },
    confirm: function (t) { w.confirms.push(String(t)); return w.confirmAnswer; },
  };
  win.window = win;
  win.spirit.readyPromise = Promise.resolve(win.spirit);
  // goal/G43.32: grantsPanel.js places itself by installSpiritElement; the recorder hands that helper to the page stand-in
  // (spirit/test/headLessChrome.js pageSpirit).
  const recorder = win.spirit.requireScript;
  // The files of the tree it loads as they are, by their paths, through the page's requireScript (goal/G49.6).
  const REAL = [SUBJECT, 'spirit/client/apiTreeIndex.js', 'spirit/data.js'];
  LOADER.requireScript('spirit/test/headLessChrome.js').pageSpirit(win.spirit, null, { window: win, real: function (p) { return REAL.indexOf(p) !== -1 || /^spirit\/.+\/data\.js$/.test(p); } });
  const pageRequire = win.spirit.requireScript;
  win.spirit.requireScript = function (p) { return /installSpiritElement\.js$/.test(p) || REAL.indexOf(String(p)) !== -1 ? pageRequire(p) : recorder(p); };
  vm.createContext(win);
  win.spirit.requireScript('spirit/client/apiTreeIndex.js');
  win.spirit.requireScript('spirit/data.js');
  win.spirit.required.spirit.data.homeNode(win.spirit.nodeFacts.key);
  if (SRC) pageRequire(SUBJECT);
  w.win = win; w.page = page;
  return w;
}

// THE ELEMENT NAMES SINCE goal/G43.18: a stand-in keyed by its place, 'search.contact' and so on, nested where the page has it.
function nestSearch(o) { Object.keys(o).forEach(function (k) { if (k !== 'search' && k.indexOf('search.') !== 0) return; var v = o[k]; delete o[k]; var ks = k.split('.'); var at = o; ks.slice(0, -1).forEach(function (p) { at = at[p] = at[p] || {}; }); var last = ks[ks.length - 1]; at[last] = Object.assign(at[last] || {}, v); }); return o; }

// What the world and the tests make, for the tests after them.
let w, E, GP, code, unset, box, cfg, rf, inSpan, filterId, filterApi, formId, gl, sels, D, dep, grantBtn, press, at0, gb, gbusy, gReq, gSettled, g, A, found;
const pass = function (r) { return sels.every(function (f) { return typeof f.test !== 'function' || f.test(r) > 0; }); };
const NIGHT = { job_id: 'J1', path: 'fs.search', job: 'Night' };
const DAY = { job_id: 'J2', path: 'gone.verb', job: 'Day' };
const said = function () { return box.innerHTML.replace(/<[^>]*>/g, ' '); };

test.run('the grants panel runs on a bare window', 0.2, async function () {
  if (!SRC) return false;
  code = SRC.replace(/\/\/.*$/gm, '');
  w = world();
  await settle();
  // goal/G43.32: the elements stand at their paths, spirit.required.spirit.element.
  E = ((w.page.spirit || {}).element || {});
  // Since goal/G43.32 the panel stands in the grant search: spirit.required.spirit.element.search.grant.grantsPanel.
  GP = ((E.search || {}).grant || {}).grantsPanel;
  return true;
}, test.limit.quick);

// a shell element that loads what it uses itself (rule/26), and knows no table
test.run('it requires spirit/element/search/contact/script.js', 0.2, function () {
  if (!w) return false;
  return w.required.indexOf('spirit/element/search/contact/script.js') !== -1 ? true : false;
}, test.limit.quick);
test.run('it requires spirit/element/search/bundle/script.js', 0.2, function () {
  if (!w) return false;
  return w.required.indexOf('spirit/element/search/bundle/script.js') !== -1 ? true : false;
}, test.limit.quick);
test.run('it requires spirit/element/search/api/script.js', 0.2, function () {
  if (!w) return false;
  return w.required.indexOf('spirit/element/search/api/script.js') !== -1 ? true : false;
}, test.limit.quick);
test.run('it requires spirit/element/search/grant/script.js', 0.2, function () {
  if (!w) return false;
  return w.required.indexOf('spirit/element/search/grant/script.js') !== -1 ? true : false;
}, test.limit.quick);
test.run('it requires no data script', 0.2, function () {
  if (!w) return false;
  return !w.required.some(function (p) { return /data\.js$/.test(p); }) ? true : false;
}, test.limit.quick);
// The grants table and the ID table are its caller's; the node's bundles (auth.bundle, auth.branch) are the one
// dictionary both kinds of grant are made from, so a bundle's branches are the panel's to read.
// The panel itself, create(): the node's grants table beside it (nodeGrants, below) is one its caller picks by name.
// goal/G43.32: create() runs up to where the script places itself, as it ran up to E.grantsPanel = before.
test.run('the panel names no grants or ID table: no auth grant verb, not nodeGrants, no agent verb, no loopback location, no branch', 0.2, function () {
  if (!code) return false;
  // create's code ends where the script hands itself out, module.exports, as the loader places it (goal/G49.9, box v5;
  // Andy: "spirit.requireScript must allways return either an object or a function... or fail/throw").
  const end = code.indexOf('module.exports');
  const made = end > code.indexOf('function create(') ? code.slice(code.indexOf('function create('), end) : '';
  return made.length > 0 && !/auth\.(grant|revoke|search)\b|nodeGrants|data\.auth|agent\.|loopback:\/\/|contact\.search|job_id|'grants'|"grants"/.test(made) ? true : false;
}, test.limit.quick);
// Andy: "every fucking element gets the interfaces it needs".
test.run('it asks its verbs through the spirit object, with no api.verb and no api.escapeHtml', 0.2, function () {
  if (!code) return false;
  return !/\.verb\s*\(|\bapi\.(verb|escapeHtml)\b/.test(code) ? true : false;
}, test.limit.quick);
// Since goal/G47.4 (no deprecated) it follows no server jobs, so the job branch's interface is not its to load (cw).
test.run('it requires the auth branch\'s interface, spirit/auth/api.js, with its parts, and not the job branch\'s', 0.2, function () {
  if (!w) return false;
  return w.required.indexOf('spirit/auth/api.js') !== -1 && w.required.indexOf('spirit/job/api.js') === -1 ? true : false;
}, test.limit.quick);
test.run('it registers spirit.required.spirit.element.search.grant.grantsPanel.create', 0.2, function () {
  if (!w) return false;
  return GP && typeof GP.create === 'function' ? true : false;
}, test.limit.quick);
// Unconfigured, it mounts and says so, throwing nothing (goal/G41.19, box v23: "throws nothing even when unconfigured
// (it says it is not configured)").
test.run('made without its ID table or its grants table, it throws nothing', 0.2, async function () {
  if (!GP || typeof GP.create !== 'function') return false;
  unset = [];
  [[{}, /ID table/], [{ ids: config(w).ids }, /grants table/], [{ grants: config(w).grants }, /ID table/]].forEach(function (c) {
    const host = node('x'); let threw = false; let made = null;
    try { made = GP.create(host, Object.assign({}, c[0])); } catch (e) { threw = (e && e.message) !== null; }
    const said = host.kids.map(function (k) { return String(k.textContent || ''); }).join(' ');
    unset.push({ threw: threw, fits: host.kids.length === 1 && /^not configured: /.test(said) && c[1].test(said) && /\bjob-manifest-note\b/.test(host.kids[0].className),
      empties: !!made && typeof made.destroy === 'function' && (made.destroy(), host.innerHTML === '') });
  });
  await settle();
  return unset.every(function (u) { return u.threw === false; }) ? true : false;
}, test.limit.quick);
test.run('it says, in one note, "not configured: " and the table it lacks, and draws nothing else', 0.2, function () {
  if (!unset) return false;
  return unset.every(function (u) { return u.fits; }) && w.grantLists.length === 0 && w.bundles.length === 0 && w.ids.length === 0 && w.families.length === 0 ? true
    : false;
}, test.limit.quick);
test.run('the unconfigured panel\'s destroy empties the host', 0.2, function () {
  if (!unset) return false;
  return unset.every(function (u) { return u.empties; }) ? true : false;
}, test.limit.quick);

// the grant form, a rowForm: ➕ [ID] [bundle] [Grant] (goal/G41.27)
// Andy, on G41.27: "grantsPanel:\n\n➕ [choose an ID… ▾][choose a bundle… ▾][Grant]". The box: "new shell element:
// rowForm",
// "spirit.element.spirit.element.rowForm.create(container, { icon, button }) -> { root, span, button }", "The mounter drops
// its form elements into span and wires the button itself (a busyButton or a click)." Since goal/G47.1 (Q20) it hands the
// rowForm its request as press.
test.run('it makes one bundle selector, three ID selectors (form, filter, delete row) and two api selectors (filter, delete row)', 0.2, async function () {
  if (!GP || typeof GP.create !== 'function') return false;
  box = node('panel');
  cfg = config(w);
  GP.create(box, Object.assign({}, cfg));
  await settle();
  // The grant form is the ➕ one: the panel makes a second rowForm, the ❌ delete row (goal/G47.4).
  rf = w.rowForms.filter(function (f) { return f.opts.icon === '➕'; })[0];
  // Where a selector stands in the form's span: itself, or the slot it was made in.
  inSpan = function (el) { if (!rf) return -1; return rf.span.kids.findIndex(function (k) { return k === el || k === el.container || (k.kids || []).indexOf(el) !== -1; }); };
  // The filters are the selectors in neither row form's span.
  const inAForm = function (el) { return w.rowForms.some(function (f) { return f.span.kids.some(function (k) { return k === el || k === el.container || (k.kids || []).indexOf(el) !== -1; }); }); };
  // The filter's ID selector says every ID when none is chosen; the form's has no such choice.
  filterId = w.ids.filter(function (c) { return !!c.opts.all && !inAForm(c); })[0];
  filterApi = w.families.filter(function (f) { return !inAForm(f); })[0];
  formId = w.ids.filter(function (c) { return c !== filterId && inSpan(c) !== -1; })[0];
  // Since goal/G47.4 the delete row holds an ID selector and an api selector of its own.
  return w.bundles.length === 1 && w.ids.length === 3 && w.families.length === 2 ? true : false;
}, test.limit.quick);
test.run('each selector is made with a container of its own, by its create with that container and options', 0.2, function () {
  if (!box) return false;
  const parts = w.bundles.concat(w.ids, w.families);
  return parts.every(function (x) { return x.container && x.container.kids.indexOf(x) !== -1; }) ? true : false;
}, test.limit.quick);
test.run('both ID selectors search the ID table it was handed: its location, key and label fields', 0.2, function () {
  if (!box) return false;
  return w.ids.every(function (c) { return c.opts.table === cfg.ids.table && c.opts.key === cfg.ids.key && c.opts.label === cfg.ids.label; }) ? true : false;
}, test.limit.quick);
test.run('it loads the rowForm itself', 0.2, function () {
  if (!w) return false;
  return w.required.indexOf('spirit/element/rowForm/script.js') !== -1 ? true : false;
}, test.limit.quick);
test.run('its grant form is one rowForm, its icon ➕ and its button Grant', 0.2, function () {
  if (!box) return false;
  return w.rowForms.filter(function (f) { return f.opts.icon === '➕'; }).length === 1 && !!rf && rf.opts.button === 'Grant' ? true : false;
}, test.limit.quick);
test.run('its span holds the ID selector, then the bundle selector, and nothing else', 0.2, function () {
  if (!box) return false;
  return !!formId && inSpan(formId) !== -1 && inSpan(formId) < inSpan(w.bundles[0]) && rf.span.kids.length === 2 ? true
    : false;
}, test.limit.quick);
test.run('the word "grant" at its start is gone, ➕ in its place, and it draws no Grant button of its own', 0.2, function () {
  if (!box) return false;
  const text = box.innerHTML.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  return !/\bgrant\b/i.test(text) && !/<button[^>]*>\s*Grant\s*<\/button>/.test(box.innerHTML) ? true : false;
}, test.limit.quick);
test.run('the rowForm\'s button is the Grant, the grant its press', 0.2, function () {
  if (!box) return false;
  return !!rf && typeof rf.opts.press === 'function' ? true : false;
}, test.limit.quick);

// its selectors go into the search's 🪣 row: no filter line of its own (goal/G41.26)
// Andy, on G41.26: "any searchSelector in our system must go into the probabilitySearch's selectorRow, so that the
// user-can see, which elements belong to the search.", and "do it for all probabilitySearch object in the new
// face-shell. go." The shape (cw, under that go): the grant panel hands its ID and family selectors to the 🪣 row, its
// own filter line goes, and its deprecated becomes a plain 🗜 toggle.
test.run('it draws no filter line of its own, and no deprecated button', 0.2, function () {
  if (!box) return false;
  const html = box.innerHTML;
  return filterId && filterApi && !/data-grants="filters"/.test(html) && !/data-grants="deprecated"/.test(html) ? true : false;
}, test.limit.quick);
// the list: the grant list, of the same grants table, the one box that fills (rule/16)
test.run('one grant list, handed the grants table it was given, in a fill box', 0.2, function () {
  if (!box) return false;
  gl = w.grantLists[0];
  if (gl) sels = Array.isArray(gl.opts.selectors) ? gl.opts.selectors : [];
  return w.grantLists.length === 1 && gl && gl.opts.grants === cfg.grants && /\bfill\b/.test(String(gl.host.className || '')) ? true
    : false;
}, test.limit.quick);
// WHAT IT NEEDS, IT REQUIRES ITSELF (goal/G43.24): mounted with no api, it hands the grant list none.
test.run('it hands the grant list no api: its rows\' arming buttons hear a click elsewhere themselves', 0.2, function () {
  if (!gl) return false;
  return !('api' in gl.opts) ? true : false;
}, test.limit.quick);
test.run('nothing above the list fills: the heading, the form and the filters take their own height', 0.2, function () {
  if (!gl) return false;
  const fills = box.nodes.filter(function (n) { return /\bfill\b/.test(n.className || ''); }).length + box.kids.filter(function (k) { return k !== gl.host && /\bfill\b/.test(k.className || ''); }).length;
  return fills === 0 ? true : false;
}, test.limit.quick);
test.run('it hands the grant list its selectors: the ID filter, then the branch selector, each named with its test', 0.2, function () {
  if (!gl) return false;
  return sels.length === 2 && sels[0].element === filterId && sels[1].element === filterApi && sels.every(function (x) { return typeof x.test === 'function' && !!x.name; }) ? true
    : false;
}, test.limit.quick);

// the selectors narrow it, by the grants table's own key field
test.run('with nothing chosen, every grant passes', 0.2, function () {
  if (!gl) return false;
  return pass(NIGHT) && pass(DAY) ? true : false;
}, test.limit.quick);
test.run('the ID filter narrows to that ID\'s grants, read from the table\'s key field', 0.2, function () {
  if (!gl) return false;
  if (!filterId) return false;
  filterId.value = 'J1'; filterId.fire('change', { target: filterId });
  const r = pass(NIGHT) && !pass(DAY) ? true : false;
  filterId.value = ''; filterId.fire('change', { target: filterId });
  return r;
}, test.limit.quick);
test.run('the branch filter narrows to that branch\'s paths', 0.2, function () {
  if (!gl) return false;
  const fam = filterApi;
  if (!fam) return false;
  fam.family = 'gone'; fam.value = 'gone'; fam.fire('change', { target: fam });
  return !pass(NIGHT) && pass(DAY) ? true : false;
}, test.limit.quick);
test.run('a verb chosen narrows to that verb', 0.2, function () {
  if (!gl) return false;
  const fam = filterApi;
  if (!fam) return false;
  fam.family = 'fs'; fam.verb = 'search'; fam.value = 'fs.search'; fam.fire('change', { target: fam });
  const r = pass(NIGHT) && !pass({ job_id: 'J1', path: 'fs.loadFile', job: 'Night' }) ? true : false;
  fam.family = ''; fam.verb = ''; fam.value = ''; fam.fire('change', { target: fam });
  return r;
}, test.limit.quick);

// NO DEPRECATED (goal/G47.4; Andy: "get rid of that deprecated filter and the field in the database if it's there as well,
// what the hell is it even for?"). It was no field: the panel read the node's api tree and hid a grant no server served
// today. It goes: no filter of it, nothing handed to the list to judge it by, no tree read and no servers followed for it.
test.run('it hands the grant list no deprecated filter', 0.2, function () {
  if (!gl) return false;
  return !(gl.opts.filters || []).some(function (f) { return f && /deprecated/i.test(String(f.name || '') + String(f.word || '')); }) ? true : false;
}, test.limit.quick);
test.run('it hands the grant list nothing that judges whether a server serves a path', 0.2, function () {
  if (!gl) return false;
  return !('serves' in gl.opts) ? true : false;
}, test.limit.quick);
test.run('it reads no api tree', 0.2, function () {
  if (!gl) return false;
  return w.treeAsked === 0 ? true : false;
}, test.limit.quick);
test.run('a server job changing reads nothing', 0.2, async function () {
  if (!gl) return false;
  D = w.win.spirit.required.spirit.data;
  const asked0 = w.treeAsked;
  const calls0 = w.calls.length;
  D.takeJob({ id: 'spirit.app.gone', kind: 'server', status: 'running', module: 'spirit.app.gone', data: {} });
  await settle();
  return w.treeAsked === asked0 && w.calls.length === calls0 ? true : false;
}, test.limit.quick);
test.run('grantsPanel.js names no deprecated', 0.2, function () {
  return !/deprecated/i.test(code || '') ? true : false;
}, test.limit.quick);

// the grants app, goal/G47.4 (box): "the dropdown filters are include ID (contact), branch (not fucking family) and verb (if a
// branch is selected)", "for any dropdown the default is (unselected==ALL)", "the search therefore must find any user that
// has grants for any branch/verb combination", "every row still has a revoke button.", "sticky, at the bottom, a rowForm:
// ❌ \"Delete all Grants you see\" [Delete-armingButton]". Andy, on its chat: "the more i modify the search, the more records
// will be cached i'll be able to zero in on things i can delete.. if i delete the first few of your grants invisible ones
// will become visible, right now i cant even fucking find ANYTHING." The verb half showing only once a branch is chosen is
// the api selector's, tested in its own folder.
test.run('its branch filter says every branch when none is chosen, and never branch', 0.2, function () {
  const fam = filterApi;
  if (!fam) return false;
  const words = Object.keys(fam.opts || {}).map(function (k) { return fam.opts[k]; }).filter(function (v) { return typeof v === 'string'; });
  return /\bevery branch\b/i.test(String(fam.opts.all || '')) && !words.some(function (v) { return /family/i.test(v); }) ? true : false;
}, test.limit.quick);
// The search must find any user (box): a filter chosen asks the grants table's search again, so what comes is cached and
// the exact filter picks from it.
let searched;
test.run('choosing an ID asks the grants table\'s search again, with that ID in its text', 0.2, async function () {
  if (!filterId) return false;
  const at = w.calls.length;
  filterId.value = 'J7'; filterId.fire('change', { target: filterId });
  await settle();
  searched = w.calls.slice(at).filter(function (c) { return c.name === 'grants.search'; });
  filterId.value = ''; filterId.fire('change', { target: filterId });
  await settle();
  return searched.some(function (c) { return String(c.args).indexOf('J7') !== -1; }) ? true : false;
}, test.limit.quick);
test.run('choosing a branch asks the grants table\'s search again, with that branch in its text', 0.2, async function () {
  const fam = filterApi;
  if (!fam) return false;
  const at = w.calls.length;
  fam.family = 'desk'; fam.verb = ''; fam.value = 'desk'; fam.fire('change', { target: fam });
  await settle();
  const s = w.calls.slice(at).filter(function (c) { return c.name === 'grants.search'; });
  fam.family = ''; fam.value = ''; fam.fire('change', { target: fam });
  await settle();
  return s.some(function (c) { return String(c.args).indexOf('desk') !== -1; }) ? true : false;
}, test.limit.quick);
test.run('choosing a verb asks the grants table\'s search again, with its branch and that verb in its text', 0.2, async function () {
  const fam = filterApi;
  if (!fam) return false;
  const at = w.calls.length;
  fam.family = 'desk'; fam.verb = 'chat'; fam.value = 'desk.chat'; fam.fire('change', { target: fam });
  await settle();
  const s = w.calls.slice(at).filter(function (c) { return c.name === 'grants.search'; });
  fam.family = ''; fam.verb = ''; fam.value = ''; fam.fire('change', { target: fam });
  await settle();
  return s.some(function (c) { const t = String(c.args); return t.indexOf('desk') !== -1 && t.indexOf('chat') !== -1; }) ? true : false;
}, test.limit.quick);

// the delete row, sticky at the bottom (box): "a rowForm for delete: ❌ [ID-dropdown] [branch-dropdown] [verb-dropdown]
// [Delete-armingButton]. It acts on what is chosen in it, not on what the list shows", "only a contact selected: every
// grant of that contact is revoked", "a contact and a branch selected: every grant of that branch is revoked for that
// contact", "all three selected: only the one grant row for that contact, branch and verb.", "No new verb: the node revokes
// one exact grant, so the panel searches the chosen contact, branch and verb, revokes each match, and asks again until none
// is left." The branch and verb dropdowns are the api selector's two halves (its verb half shows once a branch is chosen).
// Here the grants table answers at most two rows at a time, saying more, and a revoked grant is gone from it, so one
// search alone cannot find every grant of a contact.
let del, delArm, delAt, delId, delApi;
const ROWS = [{ job_id: 'J1', path: 'fs.search', job: 'Night' }, { job_id: 'J1', path: 'jobs.list', job: 'Night' },
  { job_id: 'J2', path: 'fs.loadFile', job: 'Day' }, { job_id: 'J1', path: 'fs.loadFile', job: 'Night' }, { job_id: 'J1', path: 'gone.verb', job: 'Night' }];
const revoked = function () { return w.calls.slice(delAt).filter(function (c) { return c.name === 'grants.revoke'; }).map(function (c) { return c.args.id + ' ' + c.args.path; }).sort(); };
const inDel = function (el) { return !!del && del.span.kids.some(function (k) { return k === el || k === el.container || (k.kids || []).indexOf(el) !== -1; }); };
// Chooses in the delete row: a contact, a branch and a verb ('' for none), then two presses, arming and confirming.
const deleteWith = async function (id, branch, verb) {
  w.grantRows = ROWS.map(function (r) { return Object.assign({}, r); });
  w.searchCap = 2;
  delId.value = id; delId.row = id ? { key: id, name: id } : null; delId.fire('change', { target: delId });
  delApi.family = branch; delApi.verb = verb; delApi.value = branch ? (verb ? branch + '.' + verb : branch) : ''; delApi.fire('change', { target: delApi });
  await settle();
  delAt = w.calls.length;
  del.button.fire('click', { target: del.button }); del.button.fire('click', { target: del.button });
  for (let i = 0; i < 5; i++) await settle();
  const r = revoked();
  w.grantRows = []; w.searchCap = 0;
  delId.value = ''; delId.row = null; delApi.family = ''; delApi.verb = ''; delApi.value = '';
  return r;
};
test.run('it makes a second rowForm, its icon ❌', 0.2, function () {
  if (!w) return false;
  del = w.rowForms.filter(function (f) { return f.opts.icon === '❌'; })[0];
  return !!del ? true : false;
}, test.limit.quick);
test.run('its span holds an ID selector of the ID table it was handed, then an api selector, its branch and verb dropdowns', 0.2, function () {
  if (!del) return false;
  delId = w.ids.filter(inDel)[0];
  delApi = w.families.filter(inDel)[0];
  const at = function (el) { return del.span.kids.findIndex(function (k) { return k === el || k === el.container || (k.kids || []).indexOf(el) !== -1; }); };
  return !!delId && !!delApi && delId.opts.table === cfg.ids.table && at(delId) < at(delApi) && del.span.kids.length === 2 ? true : false;
}, test.limit.quick);
test.run('its button says Delete', 0.2, function () {
  if (!del) return false;
  return del.opts.button === 'Delete' ? true : false;
}, test.limit.quick);
test.run('it loads the arming button itself', 0.2, function () {
  if (!w) return false;
  return w.required.indexOf('spirit/element/armingButton/script.js') !== -1 ? true : false;
}, test.limit.quick);
test.run('its Delete is an arming button, and no press of the rowForm', 0.2, function () {
  if (!del) return false;
  delArm = w.arming.filter(function (a) { return a.button === del.button; })[0];
  return !!delArm && typeof delArm.opts.run === 'function' && typeof del.opts.press !== 'function' ? true : false;
}, test.limit.quick);
test.run('it stands at the bottom, below the grant list', 0.2, function () {
  if (!del || !gl) return false;
  const at = function (n) { return box.kids.lastIndexOf(n); };
  const delAtBox = Math.max(at(del.root), at(del.container));
  return delAtBox !== -1 && delAtBox === box.kids.length - 1 && at(gl.host) !== -1 && at(gl.host) < delAtBox ? true : false;
}, test.limit.quick);
test.run('the first press arms it and revokes nothing', 0.2, async function () {
  if (!delArm || !delId) return false;
  w.grantRows = ROWS.map(function (r) { return Object.assign({}, r); });
  delId.value = 'J1'; delId.row = { key: 'J1', name: 'J1' }; delId.fire('change', { target: delId });
  await settle();
  delAt = w.calls.length;
  del.button.fire('click', { target: del.button });
  await settle();
  const r = delArm.armed === true && revoked().length === 0;
  if (delArm.armed) { delArm.armed = false; }
  w.grantRows = [];
  delId.value = ''; delId.row = null;
  return r ? true : false;
}, test.limit.quick);
test.run('only a contact chosen, the second press revokes every grant of that contact, past the first answer, and no other', 0.2, async function () {
  if (!delArm || !delId || !delApi) return false;
  const r = await deleteWith('J1', '', '');
  return JSON.stringify(r) === JSON.stringify(['J1 fs.loadFile', 'J1 fs.search', 'J1 gone.verb', 'J1 jobs.list']) ? true : false;
}, test.limit.quick);
test.run('a contact and a branch chosen, it revokes every grant of that branch for that contact, and no other', 0.2, async function () {
  if (!delArm || !delId || !delApi) return false;
  const r = await deleteWith('J1', 'fs', '');
  return JSON.stringify(r) === JSON.stringify(['J1 fs.loadFile', 'J1 fs.search']) ? true : false;
}, test.limit.quick);
test.run('all three chosen, it revokes only that one grant', 0.2, async function () {
  if (!delArm || !delId || !delApi) return false;
  const r = await deleteWith('J1', 'fs', 'search');
  return JSON.stringify(r) === JSON.stringify(['J1 fs.search']) ? true : false;
}, test.limit.quick);
test.run('it acts on what is chosen in it, not on what the list\'s filters choose', 0.2, async function () {
  if (!delArm || !delId || !delApi || !filterId) return false;
  filterId.value = 'J2'; filterId.fire('change', { target: filterId });
  await settle();
  const r = await deleteWith('J1', 'fs', 'search');
  filterId.value = ''; filterId.fire('change', { target: filterId });
  await settle();
  return JSON.stringify(r) === JSON.stringify(['J1 fs.search']) ? true : false;
}, test.limit.quick);

// Grant: the bundle's branches, through the grants table it was handed
test.run('with no bundle or no ID chosen, Grant asks nothing', 0.2, async function () {
  if (!box) return false;
  D = w.win.spirit.required.spirit.data;
  grantBtn = rf ? rf.button : null;
  press = function () { if (grantBtn) grantBtn.fire('click', { target: grantBtn, preventDefault: function () {} }); };
  at0 = w.calls.length;
  press(); await settle();
  return !w.calls.slice(at0).some(function (c) { return c.name === 'grants.grant'; }) ? true : false;
}, test.limit.quick);
test.run('Grant reads the chosen bundle\'s branches by asking auth.branch to search that bundle', 0.2, async function () {
  if (!press) return false;
  if (!formId || !w.bundles[0]) return false;
  w.bundles[0].value = 7; w.bundles[0].row = { id: 7, label: 'Reader' };
  w.branchesOf[7] = [{ family: 'jobs', verb: 'list' }, { family: 'fs', verb: 'search' }, { family: 'desk', verb: '' }];
  formId.value = 'J3'; formId.row = { key: 'J3', name: 'Cat' };
  w.grantAnswer = function (id, p) { return p === 'fs.search' ? { ok: false, code: 'already-granted', error: 'already granted' } : { ok: true }; };
  at0 = w.calls.length;
  press(); await settle();
  const read = w.calls.slice(at0).filter(function (c) { return c.name === 'auth.branch'; })[0];
  return read && read.args.op === 'search' && read.args.bundle === 7 ? true : false;
}, test.limit.quick);
test.run('Grant grants each branch through the grants table it was handed, by id and path: branch.verb, or the branch alone for (ALL)', 0.2, function () {
  if (!press) return false;
  const grants = w.calls.slice(at0).filter(function (c) { return c.name === 'grants.grant'; });
  return grants.length === 3 && grants.every(function (c) { return c.args.id === 'J3'; }) && JSON.stringify(grants.map(function (c) { return c.args.path; }).sort()) === '["desk","fs.search","jobs.list"]' ? true
    : false;
}, test.limit.quick);
test.run('nothing is granted, or read, past the table it was handed', 0.2, function () {
  if (!press) return false;
  return !w.calls.slice(at0).some(function (c) { return /^auth\.(grant|search)$/.test(c.name) || /^agent\./.test(c.name); }) ? true : false;
}, test.limit.quick);
test.run('a path the ID holds already is counted done, never said as a refusal', 0.2, function () {
  if (!press) return false;
  return !/already-granted|already granted|not granted|refused/i.test(said()) ? true : false;
}, test.limit.quick);
test.run('Grant reads no grant again', 0.2, function () {
  if (!press) return false;
  return !w.calls.slice(at0).some(function (c) { return c.name === 'grants.search'; }) ? true : false;
}, test.limit.quick);
// Andy: "EVERY FUCKING ELEMENT is verified to make sure when it changes shit it listens to fucking update via the spirit
// object": the grants it sent come back through the grants table's own watch, and the panel says they arrived.
test.run('a grant it sent, arriving through the grants table\'s watch, is said as arrived', 0.2, async function () {
  if (!press) return false;
  const said0 = box.innerHTML;
  w.grantWatchers.slice().forEach(function (fn) { fn('J3\njobs.list', { job_id: 'J3', path: 'jobs.list' }); });
  await settle();
  return w.grantWatchers.length > 0 && /arrived/.test(said()) && box.innerHTML !== said0 ? true : false;
}, test.limit.quick);
test.run('a grant refused for another reason says so', 0.2, async function () {
  if (!press) return false;
  w.grantAnswer = function () { return { ok: false, code: 'owner-only', error: 'owner only' }; };
  press(); await settle();
  return /owner-only|owner only/.test(box.innerHTML) ? true : false;
}, test.limit.quick);
// ONE FAILED PATH STOPS NO OTHER (goal/G47.5; Andy: "when i tried to grant the faulty bundle, the grant-loop seemed to have
// exited the loop when it encountered a non-existing verb.... it should have registered the rest...."): the bundle's first
// path (jobs.list) fails outright, its grant throwing; the paths after it are granted all the same, and the failed one said.
let failAt = 0;
test.run('a grant that fails outright on one path still grants every other path of the bundle', 0.2, async function () {
  if (!press) return false;
  w.grantAnswer = function (id, p) { if (p === 'jobs.list') return Promise.reject(new Error('no such verb')); return { ok: true }; };
  failAt = w.calls.length;
  press(); await settle();
  const asked = w.calls.slice(failAt).filter(function (c) { return c.name === 'grants.grant'; }).map(function (c) { return c.args.path; });
  return (asked.indexOf('jobs.list') !== -1 && asked.indexOf('fs.search') !== -1 && asked.indexOf('desk') !== -1) ? true : false;
}, test.limit.quick);
test.run('the path that failed is said as not granted, and only it', 0.2, function () {
  if (!press) return false;
  const t = said();
  const r = /not granted[^<]*jobs\.list/.test(t) && t.indexOf('fs.search') === -1 ? true : false;
  w.grantAnswer = null;
  return r;
}, test.limit.quick);

// no warning before a grant (goal/G43.27)
// Andy: "compare that to giving a linux user root authority, he then can fuck up the whole system, not our problem."
let conf0;
test.run('Grant reads no <verb>.warning.txt', 0.2, async function () {
  if (!press) return false;
  w.warnings['jobs.list'] = 'it lists every job';
  w.confirmAnswer = false;
  at0 = w.calls.length;
  conf0 = w.confirms.length;
  press(); await settle();
  const read1 = w.calls.slice(at0).filter(function (c) { return /\.FS\.loadFile$/.test(c.name) && /\.warning\.txt$/.test(String((c.args && c.args.path) || '')); });
  return read1.length === 0 ? true : false;
}, test.limit.quick);
test.run('the owner is asked nothing before the grant', 0.2, function () {
  if (conf0 === undefined) return false;
  return w.confirms.slice(conf0).length === 0 ? true : false;
}, test.limit.quick);
test.run('the grant goes out at once', 0.2, function () {
  if (conf0 === undefined) return false;
  const r = w.calls.slice(at0).some(function (c) { return c.name === 'grants.grant'; }) ? true : false;
  w.warnings = {};
  if (w.bundles[0]) { w.bundles[0].value = 7; w.bundles[0].row = { id: 7, label: 'Reader' }; }
  return r;
}, test.limit.quick);
test.run('grantsPanel.js holds no warning reading and no confirm', 0.2, function () {
  return !/warning\.txt|window\.confirm/.test(fs.readFileSync(path.join(RUN, 'spirit', 'element', 'search', 'grant', 'grantsPanel', 'script.js'), 'utf8').replace(/\/\/[^\n]*/g, '')) ? true : false;
}, test.limit.quick);
// That no <verb>.warning.txt is left in the tree, spirit/auth/grant.warning.txt among them, is the general test's,
// spirit/test/spirit-sibling-general.js (goal/G47.1). The noWarning part once at the end of this file said the same as the
// two checks above, and is folded into them.

// Grant waits, busy, until every grant is answered (goal/G41.23; box: "first users: Ask in the agent's Update model list, and
// Grant in the grants panel"). Since goal/G47.1 (Q20; Andy: "mark the button busy from press until the mounter's answer
// comes") the grant is the rowForm's press, and the rowForm's own busyButton waits on it: a second one attached to the same
// button was cleared by the first at once.
test.run('it attaches no busyButton of its own: the rowForm\'s waits on its press', 0.2, function () {
  if (!w) return false;
  return w.busy.length === 0 ? true : false;
}, test.limit.quick);
// The panel may draw its form again when it says something: its Grant button is found again.
// Since goal/G41.27 it is the rowForm's button.
test.run('its Grant is handed to the rowForm as press, the grant its request', 0.2, function () {
  if (!box) return false;
  gb = rf ? rf.button : null;
  gbusy = rf && typeof rf.opts.press === 'function' ? rf : null;
  return !!gbusy ? true : false;
}, test.limit.quick);
let letGo = null;
test.run('a press grants, and the request it hands the button is still waiting while the grant is not answered', 0.2, async function () {
  if (!gbusy) return false;
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
    : false;
}, test.limit.quick);
test.run('the request settles once every grant is answered, so the button is plain again', 0.2, async function () {
  if (!gbusy) return false;
  w.grantAnswer = null;
  for (let i = 0; i < 5 && letGo; i++) { const go = letGo; letGo = null; go({ ok: true }); await settle(); }
  return gSettled ? true : false;
}, test.limit.quick);

// grantsPanel.nodeGrants: the node's own grants table, one a caller picks by name (goal/G43.24)
// goal/G43.24: "Still its own: the panel's data source, auth.search and auth.grant / auth.revoke over the auth cache
// (GR_GRANTS). It moves into grantsPanel."
test.run('grantsPanel.nodeGrants\'s branch is spirit.required.spirit.data.auth.data.grants.branch, keyed by key, labelled by label', 0.2, function () {
  if (!GP) return false;
  g = GP.nodeGrants;
  A = ((w.win.spirit.required.spirit.data || {}).auth || {}).data;
  return !!g && !!A && g.branch === A.grants.branch && g.key === 'key' && g.label === 'label' ? true : false;
}, test.limit.quick);
test.run('grantsPanel.nodeGrants has search, grant, revoke and watch, and no stream of its own', 0.2, function () {
  if (!g || !A) return false;
  return ['search', 'grant', 'revoke', 'watch'].every(function (f) { return typeof g[f] === 'function'; }) && !('stream' in g) ? true : false;
}, test.limit.quick);
test.run('the panel takes nodeGrants as a grants table, and configured with it says nothing is missing', 0.2, async function () {
  if (!g || !A) return false;
  const panelOk = node('ok');
  GP.create(panelOk, { ids: { table: 'loopback://api/contact/search' }, grants: g });
  await settle();
  return !/not configured/.test(panelOk.kids.map(function (k) { return k.textContent; }).join(' ')) ? true : false;
}, test.limit.quick);
test.run('the search of nodeGrants asks spirit\'s auth.search with the text and answers its items and more', 0.2, async function () {
  if (!g || !A) return false;
  const at = w.calls.length;
  found = await g.search('bo');
  const s = w.calls.slice(at)[0];
  return s && s.name === 'auth.search' && s.args.text === 'bo' && found && Array.isArray(found.items) && found.more === true ? true : false;
}, test.limit.quick);
// Found by cw live (goal/G41.16): auth.search says whose grant it is as name, and the panel reads its table's label field.
test.run('a found grant carries whose it is in the table\'s label field, label', 0.2, function () {
  if (!found || !Array.isArray(found.items)) return false;
  let hit = null; try { hit = JSON.parse(found.items[0].label); } catch (e) { hit = null; }
  return hit && hit[g.label] === 'Bob' && hit.key === 'K1' && hit.path === 'fs.search' ? true : false;
}, test.limit.quick);
test.run('a row it cannot read is handed on as it came', 0.2, function () {
  if (!found || !Array.isArray(found.items)) return false;
  return found.items[1] && found.items[1].label === 'not json' ? true : false;
}, test.limit.quick);
test.run('the grant of nodeGrants asks auth.grant with the key and the path and answers ok true', 0.2, async function () {
  if (!g || !A) return false;
  const at = w.calls.length;
  const madeG = await g.grant('K3', 'jobs.list');
  const gr = w.calls.slice(at)[0];
  return gr && gr.name === 'auth.grant' && gr.args.key === 'K3' && gr.args.path === 'jobs.list' && madeG && madeG.ok === true ? true : false;
}, test.limit.quick);
test.run('a refused grant answers ok false with its code and error, in the node\'s words', 0.2, async function () {
  if (!g || !A) return false;
  const already = await g.grant('K3', 'fs.search');
  return already && already.ok === false && already.code === 'already-granted' && already.error === 'already granted' ? true : false;
}, test.limit.quick);
test.run('the revoke of nodeGrants asks auth.revoke with the key and the path and answers ok true', 0.2, async function () {
  if (!g || !A) return false;
  const at = w.calls.length;
  const rvd = await g.revoke('K3', 'jobs.list');
  const rv = w.calls.slice(at)[0];
  return rv && rv.name === 'auth.revoke' && rv.args.key === 'K3' && rv.args.path === 'jobs.list' && rvd && rvd.ok === true ? true : false;
}, test.limit.quick);
// WHO ASKS FOR A CHANGE LISTENS FOR IT (goal/G41.27, G41.28): a grant the node's auth job hands comes back through watch.
let heard, off;
test.run('the watch of nodeGrants hears a grant in spirit.required.spirit.data.auth as <key>\\n<path> with its row, once revoked none', 0.2, function () {
  if (!g || !A) return false;
  D = w.win.spirit.required.spirit.data;
  heard = [];
  off = g.watch(function (k, row) { heard.push({ k: k, row: row }); });
  D.takeJob({ id: 'spirit.auth', data: { table: 'grant', row: { key: 'K9', path: 'jobs.list', label: 'Zed' } } });
  D.takeJob({ id: 'spirit.auth', data: { table: 'grant', row: { key: 'K9', path: 'jobs.list' }, gone: true } });
  return heard.length === 2 && heard[0].k === 'K9\njobs.list' && heard[0].row && heard[0].row.label === 'Zed' && heard[1].k === 'K9\njobs.list' && !heard[1].row ? true : false;
}, test.limit.quick);
test.run('its release ends the watch', 0.2, function () {
  if (!heard) return false;
  if (typeof off === 'function') off();
  D.takeJob({ id: 'spirit.auth', data: { table: 'grant', row: { key: 'K8', path: 'jobs.list', label: 'Yan' } } });
  return typeof off === 'function' && heard.length === 2 ? true : false;
}, test.limit.quick);

// ── THE AUTHSOURCE PART (once its own file; one test file per script: spirit/test/TEST_SYSTEM.md) ──
// GRANTS' DATA SOURCE IS grantsPanel'S (goal/G43.24, requirement 6; spec: ./script.md, section "authSource"). The box: "Still its
// own: the panel's data source, auth.search and auth.grant / auth.revoke over the auth cache (GR_GRANTS). It moves into
// grantsPanel." Andy: "no i want those apps to basically be wrappers for spirit/element/ things....". grantsPanel.js read as
// it is, comments stripped.
// authSource: Grants' data source is grantsPanel's (goal/G43.24); the box, 6: Grants' data source "moves into grantsPanel"
function codeOf(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'); } catch (e) { return ''; } }
let panel = '';
test.run('spirit/element/search/grant/grantsPanel/script.js is there', 0.2, function () {
  panel = codeOf(path.join(RUN, 'spirit', 'element', 'search', 'grant', 'grantsPanel', 'script.js'));
  return panel.length > 0 ? true : false;
}, test.limit.quick);
test.run('Grants\' data source has moved into grantsPanel, which asks auth.search', 0.2, function () {
  return /'spirit\/auth\/api\.js',\s*'search'/.test(panel) ? true : false;
}, test.limit.quick);
test.run('Grants\' data source has moved into grantsPanel, which asks auth.grant', 0.2, function () {
  return /'spirit\/auth\/api\.js',\s*'grant'/.test(panel) ? true : false;
}, test.limit.quick);
test.run('Grants\' data source has moved into grantsPanel, which asks auth.revoke', 0.2, function () {
  return /'spirit\/auth\/api\.js',\s*'revoke'/.test(panel) ? true : false;
}, test.limit.quick);
test.run('grantsPanel holds the auth cache it reads, spirit.required.spirit.data.auth', 0.2, function () {
  const holds = /\bdata\.auth\b|require(?:Script)?\s*\(\s*['"]spirit\/auth\/api\.js['"]/.test(panel);
  return holds ? true : false;
}, test.limit.quick);
