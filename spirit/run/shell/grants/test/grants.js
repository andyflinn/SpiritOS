'use strict';

// spirit/run/shell/grants/test/grants.js
// The tests of shell/grants/grants.js, and of no other module (spec: ./grants.md; goal/G41.5, goal/G41.13, goal/G41.14). The
// browser file runs in node on a window of its own: the search list, the tab container, the bundle selector, the contact
// selector, the family selector, the bundle editor and the node are stubs that keep what the app asked of them; the row element is the real
// one (shell/js/rowElement.js).

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
  const w = { lists: [], contacts: [], families: [], required: [], calls: [], def: null, made: [], tabs: [], bundles: [], ids: [], editors: [], grantAnswer: null, branchesOf: {} };
  const E = {
    // The are-you-sure button (goal/G41.9): a recorder of every button made arming, by attach or create.
    armingButton: {
      attach: function (button, opts) { w.made.push({ how: 'attach', button: button, opts: opts || {} }); return button; },
      create: function (opts) { const b = node('<button type="button">'); w.made.push({ how: 'create', button: b, opts: opts || {} }); return b; },
    },
    probabilitySearch: { create: function (host, opts) { const l = { host: host, opts: opts, value: '', redrawn: 0, refreshed: 0,
      redraw: function () { l.redrawn += 1; }, refresh: function () { l.refreshed += 1; }, destroy: function () {} }; w.lists.push(l); return l; } },
    contactList: { create: function (host, opts) { const c = { host: host, opts: opts, list: { value: '', row: null } }; w.contacts.push(c); return c; } },
    // goal/G41.14: the family selector, apiBranchSelector renamed, its verb half with it: family, verb, value.
    createApiFamilySelector: function (opts) { const f = node('family'); f.opts = opts; f.family = ''; f.verb = ''; f.value = ''; w.families.push(f); return f; },
    shellCreateListSearch: function (host, opts) { w.oldList = { host: host, opts: opts }; return { redraw: function () {}, refresh: function () {} }; },
    // goal/G41.13: the two tabs, the bundle and ID selectors of the add-grant row, and the bundle editor.
    tabContainer: { create: function (host, opts) { const t = { host: host, opts: opts || {}, select: function () {}, selected: function () { return ''; }, destroy: function () {} }; w.tabs.push(t); return t; } },
    createBundleSelector: function (opts) { const b = node('bundle'); b.opts = opts; b.value = ''; b.row = null; w.bundles.push(b); return b; },
    createContactSelector: function (opts) { const c = node('contact'); c.opts = opts; c.value = ''; c.row = null; w.ids.push(c); return c; },
    bundleEditor: { create: function (host, opts) { const e = { host: host, opts: opts || {}, destroy: function () {} }; w.editors.push(e); return e; } },
  };
  const api = {
    escapeHtml: function (s) { return String(s).replace(/</g, '&lt;'); },
    verb: function (name, args) {
      w.calls.push({ name: name, args: args });
      if (name === 'api') return Promise.resolve({ status: 200, body: TREE });
      if (name === 'auth.search') return Promise.resolve({ status: 200, body: { items: GRANTS.map(function (g) { return { key: g.key, label: JSON.stringify(g) }; }), more: false } });
      // goal/G41.14: a bundle's branches, each a family and a verb, '' for all of the family.
      if (name === 'auth.branch') return Promise.resolve({ status: 200, body: { items: (w.branchesOf[args && args.bundle] || []).map(function (b, i) { return { key: String(i + 1), label: JSON.stringify(Object.assign({ id: i + 1, bundle: args.bundle }, b)) }; }), more: false } });
      if (name === 'auth.grant' && w.grantAnswer) return Promise.resolve(w.grantAnswer(args));
      if (name === 'auth.revoke' || name === 'auth.grant') return Promise.resolve({ status: 200, body: { ok: true } });
      return Promise.resolve({ status: 200, body: {} });
    },
    ui: { elements: {} },
  };
  // A BARE PAGE (rule/26: "there will be NOTHING pre-loaded after the relays-supplied boot scripts"): each stand-in is
  // put on the page only once the app requires its file.
  const FILES = { 'shell/js/armingButton.js': ['armingButton'], 'shell/js/probabilitySearch.js': ['probabilitySearch'],
    'shell/js/contacts/listElement.js': ['contactList'], 'shell/js/apiFamilySelector.js': ['createApiFamilySelector'],
    'shell/js/tabContainer.js': ['tabContainer'], 'shell/js/bundleSelector.js': ['createBundleSelector'],
    'shell/js/contactSelector.js': ['createContactSelector'], 'shell/js/bundleEditor.js': ['bundleEditor'] };
  const page = {};
  const win = {
    spirit: { elements: page,
      require: function (p) { w.required.push(String(p)); (FILES[p] || []).forEach(function (k) { page[k] = E[k]; }); return Promise.resolve(true); },
      shell: { activateApp: function (d) { w.def = d; } }, escapeHtml: api.escapeHtml },
    document: { createElement: function (t) { return node('<' + t + '>'); }, getElementById: function (id) { return byId[id] || null; } },
    Event: function (type) { this.type = type; },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String,
    console: { log: function () {}, error: function () {} }, confirm: function () { return true; },
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(RUN, 'shell', 'js', 'rowElement.js'), 'utf8'), win, { filename: 'rowElement.js' });
  // The page's one data set, which spirit.js brings with the client: the node's stream lands there.
  vm.runInContext(fs.readFileSync(path.join(RUN, 'shell', 'js', 'spiritData.js'), 'utf8'), win, { filename: 'spiritData.js' });
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
  ['shell/js/probabilitySearch.js', 'shell/js/rowElement.js', 'shell/js/armingButton.js', 'shell/js/tabContainer.js', 'shell/js/bundleSelector.js',
    'shell/js/contactSelector.js', 'shell/js/bundleEditor.js', 'shell/js/apiFamilySelector.js'].forEach(function (p) {
    ok(w.required.indexOf(p) !== -1, 'it requires ' + p, 'required: ' + short(w.required));
  });
  ok(!/apiBranchSelector/.test(SRC.replace(/\/\/.*$/gm, '')), 'and names apiBranchSelector no more: it is apiFamilySelector (goal/G41.14)', 'grants.js still names apiBranchSelector');

  const app = node('container');
  await w.def.mount(app, w.api); await settle();

  test.subHeading('two tabs: Grants, and Bundles (goal/G41.13)');
  const tabs = w.tabs[0];
  const names = tabs ? (tabs.opts.tabs || []).map(function (t) { return t && t.name; }) : [];
  ok(w.tabs.length === 1 && JSON.stringify(names) === '["grants","bundles"]' && (tabs.opts.tabs || []).every(function (t) { return t.label && typeof t.mount === 'function'; }),
    'the app is one tabContainer with the tabs grants and bundles, each with its label and mount', 'tabs: ' + short(names));
  if (!tabs || names.length !== 2) return;
  const box = node('grants-tab');
  tabs.opts.tabs[0].mount(box); await settle();
  const bundlesBox = node('bundles-tab');
  tabs.opts.tabs[1].mount(bundlesBox); await settle();
  ok(w.editors.length === 1 && w.editors[0].host === bundlesBox && w.editors[0].opts.api === w.api,
    'the Bundles tab is the bundle editor, in its own box, with the app\'s api (Andy: "where bundles are created and maintained with the bundle shell element")', 'editors: ' + short(w.editors.map(function (e) { return e.host === bundlesBox; })));

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
  ok((/data-action="revoke"/.test(h1.revoke.innerHTML) && /Revoke/.test(h1.revoke.innerHTML)) || w.made.some(function (m) { return /Revoke/.test(m.opts.label || ''); }),
    'a row has its own Revoke', 'revoke cell: ' + short(h1.revoke.innerHTML));
  ok(!/deprecated/.test(h1.path.innerHTML) && /deprecated/.test(h2.path.innerHTML), 'a grant no server serves today says deprecated; a live one does not', 'live ' + short(h1.path.innerHTML) + ' | gone ' + short(h2.path.innerHTML));

  test.subHeading('Revoke asks "are you sure?": an armingButton, the shell\'s two presses (goal/G41.9)');
  const code = SRC.replace(/\/\/.*$/gm, '');
  ok(!/data-armed/.test(code) && !/armUntilElsewhere/.test(code) && !/classList\.(add|remove)\(\s*['"]armed['"]/.test(code),
    'nothing of a hand-rolled confirm is in grants.js: no data-armed, no armUntilElsewhere, no armed class', 'grants.js arms by hand');
  // A raw press on the drawn Revoke, as the list delivers it: it reaches the element, never the node by itself.
  const tr = node('<tr data-key="' + rows[0].key + '">');
  const btn = node('<button data-action="revoke">');
  btn.closest = function (sel) { return sel === '[data-action]' ? btn : sel === '[data-key]' ? tr : null; };
  list.host.fire('click', { target: btn });
  await settle();
  ok(w.calls.filter(function (c) { return c.name === 'auth.revoke'; }).length === 0, 'a single press revokes nothing by the app\'s own hand', 'auth.revoke asked after one raw press');
  const revokes = w.made.filter(function (m) { return typeof m.opts.run === 'function'; });
  ok(revokes.length > 0, 'each row\'s Revoke is made an armingButton (attach or create)', 'armingButtons made: ' + w.made.length);
  ok(revokes.length > 0 && revokes.every(function (m) { return m.opts.api === w.api; }), 'handed the app\'s api, so a click elsewhere disarms it', 'api handed: ' + short(revokes.map(function (m) { return !!m.opts.api; })));

  test.subHeading('its run asks the node, and the list is redrawn from its answer (rule/19)');
  // The run of the row's Revoke: the one that asks for this row's key.
  let mine = null;
  for (const m of revokes) {
    const at = w.calls.length;
    await Promise.resolve(m.opts.run()); await settle();
    const asked = w.calls.slice(at).filter(function (c) { return c.name === 'auth.revoke'; })[0];
    if (asked && asked.args.key === 'K1') { mine = { asked: asked, after: w.calls.slice(at) }; break; }
  }
  ok(mine && mine.asked.args.path === 'fs.search', 'the row\'s run asks auth.revoke for that key and path', 'calls: ' + short(w.calls.map(function (c) { return c.name; })));
  // goal/G41.14, Andy: "WHY DOES A GRANT NOT JUST SIMPLY UPDATE AN EXISTING FUCKING ROW?", "SO THE MOTHERFUCKING GRANS
  // TABLE DOES NOT BUPLISH EITHER????", "FIX THEN NOW!!!": the revoke's row goes when the stream says so; nothing reads
  // every grant again.
  ok(mine && !mine.after.some(function (c) { return c.name === 'auth.search'; }), 'and reads no grant again: the stream takes the row out (rule/19)', 'auth.search asked after the revoke');

  test.subHeading('the grant form, one row: grant [ID] [bundle] [Grant] (goal/G41.13)');
  // Andy, on G41.13: "the grants tab should have one-row grant form: \"grant\" [idSelector] [bundleSelector] [grantButton]",
  // and "below. that the grants tab should display a probabilitySearch for grants. with the normal filters, (idSelector,
  // apiBranchSelector, apiVerbSelector)".
  ok(w.bundles.length === 1 && w.ids.length === 2 && w.families.length === 1, 'the Grants tab has one bundle selector, two ID selectors (the form\'s and the list\'s filter), and one family selector, the list\'s filter',
    'bundle selectors ' + w.bundles.length + ', ID selectors ' + w.ids.length + ', family ' + w.families.length);
  ok(w.contacts.length === 0, 'and no contacts list of the old line', 'contact lists ' + w.contacts.length);
  ok(!w.calls.some(function (c) { return /\.DEPENDENCIES$/.test(c.name); }), 'it asks no server for its DEPENDENCIES: no Grant the bundle button', 'calls: ' + short(w.calls.map(function (c) { return c.name; })));
  const holder = function (el) { return box.nodes.findIndex(function (n) { return n.kids.indexOf(el) !== -1; }); };
  const grantAt = box.nodes.findIndex(function (n) { return /<button/.test(n.tag) && /grant/i.test(n.getAttribute('id') || n.getAttribute('data-action') || ''); });
  const formId = w.ids.filter(function (c) { const i = holder(c); return i !== -1 && i < grantAt; })[0];
  const filterId = w.ids.filter(function (c) { return c !== formId; })[0];
  const text = box.innerHTML.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  ok(formId && holder(formId) < holder(w.bundles[0]) && holder(w.bundles[0]) < grantAt && /\bgrant\b/i.test(text) && /<button[^>]*>\s*Grant\s*<\/button>/.test(box.innerHTML),
    'the row reads "grant" [ID] [bundle], then the Grant button', 'holders: id ' + (formId ? holder(formId) : 'none') + ', bundle ' + holder(w.bundles[0]) + ', Grant ' + grantAt);
  ok(filterId && holder(filterId) > grantAt && holder(w.families[0]) > grantAt, 'below it, the list\'s filters: an ID, and a family with its verb',
    'holders: filter id ' + (filterId ? holder(filterId) : 'none') + ', family ' + holder(w.families[0]));
  w.ids[0] = formId || w.ids[0];
  if (!w.bundles.length || !w.ids.length) return;

  test.subHeading('Grant copies the bundle\'s branches to the ID, one auth.grant per branch (goal/G41.14)');
  const grantBtn = box.querySelectorAll('[type="button"]').concat(box.nodes).filter(function (n) { return /<button/.test(n.tag) && /grant/i.test(n.getAttribute('id') || n.getAttribute('data-action') || ''); })[0];
  const press = function () { if (grantBtn) grantBtn.fire('click', { target: grantBtn, preventDefault: function () {} }); };
  ok(!!grantBtn, 'the Grant button is found by its id or data-action naming grant', 'buttons: ' + short(box.nodes.filter(function (n) { return /<button/.test(n.tag); }).map(function (n) { return n.tag; })));
  let at0 = w.calls.length;
  press(); await settle();
  ok(!w.calls.slice(at0).some(function (c) { return c.name === 'auth.grant'; }), 'with no bundle or no ID chosen, Grant asks nothing', 'calls: ' + short(w.calls.slice(at0)));
  // A bundle is a number and a label; what it reaches are its branches, read from auth.branch at the press.
  w.bundles[0].value = 7; w.bundles[0].row = { id: 7, label: 'Reader' };
  w.branchesOf[7] = [{ family: 'jobs', verb: 'list' }, { family: 'fs', verb: 'search' }, { family: 'desk', verb: '' }];
  w.ids[0].value = 'K3'; w.ids[0].row = { key: 'K3', name: 'Cat' };
  w.grantAnswer = function (a) { return a.path === 'fs.search' ? { status: 409, body: { ok: false, code: 'already-granted', error: 'already granted' } } : { status: 200, body: { key: a.key, path: a.path } }; };
  at0 = w.calls.length;
  press(); await settle();
  const read = w.calls.slice(at0).filter(function (c) { return c.name === 'auth.branch'; })[0];
  ok(read && read.args.op === 'search' && read.args.bundle === 7, 'Grant reads the chosen bundle\'s branches: auth.branch { op: search, bundle }', 'calls: ' + short(w.calls.slice(at0)));
  const grants = w.calls.slice(at0).filter(function (c) { return c.name === 'auth.grant'; });
  ok(grants.length === 3 && grants.every(function (c) { return c.args.key === 'K3'; }) && JSON.stringify(grants.map(function (c) { return c.args.path; }).sort()) === '["desk","fs.search","jobs.list"]',
    'and asks auth.grant { key, path } once per branch, the path family.verb, or the family alone for (ALL)', 'grants: ' + short(grants.map(function (c) { return c.args; })));
  ok(!/already-granted|already granted|not granted|refused/i.test(box.innerHTML.replace(/<[^>]*>/g, ' ')), 'a path the ID holds already is counted done, never said as a refusal ("unless that row exists already")', 'said: ' + short(box.innerHTML.replace(/<[^>]*>/g, ' ')));
  ok(!w.calls.slice(at0).some(function (c) { return c.name === 'auth.search'; }), 'and reads no grant again: each new grant arrives on the stream, one row (rule/19)', 'calls: ' + short(w.calls.slice(at0).map(function (c) { return c.name; })));
  w.grantAnswer = function () { return { status: 403, body: { ok: false, code: 'owner-only', error: 'owner only' } }; };
  at0 = w.calls.length;
  press(); await settle();
  ok(/owner-only|owner only/.test(box.innerHTML), 'a grant refused for another reason says so', 'said: ' + short(box.innerHTML.replace(/<[^>]*>/g, ' ')));
  w.grantAnswer = null;

  test.subHeading('the list\'s filters narrow it');
  const narrowed = function () { const r = typeof o.rows === 'function' ? o.rows() : []; return r; };
  w.ids.forEach(function (c) { c.value = ''; });
  if (filterId) { filterId.value = 'K1'; if (typeof filterId.fire === 'function') filterId.fire('change', { target: filterId }); }
  ok(narrowed().length === 1 && narrowed()[0].peer === 'K1', 'the ID filter narrows the list to that ID\'s grants', 'rows: ' + short(narrowed()));
  if (filterId) filterId.value = '';
  const fam = w.families[0];
  fam.family = 'gone'; fam.value = 'gone'; fam.fire('change', { target: fam });
  ok(narrowed().length === 1 && narrowed()[0].path === 'gone.verb', 'the family filter narrows it to that family\'s paths', 'rows: ' + short(narrowed()));
  fam.family = 'fs'; fam.verb = 'search'; fam.value = 'fs.search'; fam.fire('change', { target: fam });
  ok(narrowed().length === 1 && narrowed()[0].path === 'fs.search', 'a verb chosen narrows it to that verb', 'rows: ' + short(narrowed()));
  fam.family = ''; fam.verb = ''; fam.value = ''; fam.fire('change', { target: fam });
  ok(narrowed().length === 2, 'nothing chosen, every grant', 'rows: ' + short(narrowed()));
  const lastCol = (o.columns || [])[(o.columns || []).length - 1];
  ok(lastCol && lastCol.field === 'revoke', 'Revoke is the rightmost column', 'columns: ' + short((o.columns || []).map(function (c) { return c.field; })));

  test.subHeading('the grants list hears every grant change (goal/G41.14)');
  // The node publishes each grant row as it changes on the auth tables' job (type bundles, table grant), { row: { key,
  // path, label } }, gone when revoked; the grant row element takes it into data.grants, keyed by key and path, and the
  // list is a view of that data, so one grant appears or goes and nothing is read again.
  const DG = w.win.spirit.data;
  ok(o.data === 'grants', 'the list is a view of data.grants', 'data: ' + short(o.data));
  DG.take({ type: 'bundles', data: { table: 'grant', row: { key: 'K9', path: 'jobs.list', label: 'Zed' } } });
  const kept = DG.get('grants/K9\njobs.list');
  ok(kept && kept.key === 'K9' && kept.path === 'jobs.list' && kept.label === 'Zed', 'a grant published lands in data.grants by its key and path', 'grants: ' + short(DG.branch('grants')));
  DG.take({ type: 'bundles', data: { table: 'grant', row: { key: 'K9', path: 'jobs.list' }, gone: true } });
  ok(DG.get('grants/K9\njobs.list') === undefined, 'a grant published gone is taken out', 'grants: ' + short(DG.branch('grants')));
  const beforeG = JSON.stringify(DG.branch('grants'));
  DG.take({ type: 'bundles', data: { table: 'bundle', row: { id: 1, label: 'not a grant' } } });
  DG.take({ type: 'shadow', data: { row: { publicKey: 'K8' } } });
  ok(JSON.stringify(DG.branch('grants')) === beforeG, 'a bundle row, or another job\'s, writes nothing in data.grants', 'grants: ' + short(DG.branch('grants')));
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
