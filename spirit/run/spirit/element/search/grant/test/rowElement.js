'use strict';

// spirit/run/spirit/element/search/grant/test/rowElement.js
// The tests of spirit/element/search/grant/rowElement.js, and of no other module (spec: ./rowElement.md; goal/G41.14,
// goal/G41.16). The browser file runs in node on a BARE window (rule/26): nothing is on the page until the row requires
// it. The shared row element and the page's data set are real; the arming button is a stand-in that records what it was
// handed. The grants table is the caller's, handed in as a configuration (goal/G41.16), each call recorded; two are
// tried, so nothing of either is the row's own: the node's auth grants as the Grants app configures them since
// goal/G41.28 (shell/grants/grants.js: the branch the auth family's cache manager keeps, spirit.data.auth.data.grants.branch,
// and its watch), and a second table shaped as the agent's grants by job were, its branch a whole spirit.data path
// (node/family/branch) and its watch that branch's. The auth family's data.js is loaded as a
// page's spirit.cacheManager('auth') loads it, as the Grants app asks it, the page's node known as spirit.start makes it
// known (spirit.node.key, then data.home).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(RUN, 'spirit', 'element', 'search', 'grant', 'rowElement.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

function cell() {
  const c = { kids: [], html: '' };
  Object.defineProperty(c, 'innerHTML', { get: function () { return c.html; }, set: function (v) {
    c.html = String(v); c.kids.length = 0;
    const b = /<button[^>]*data-action="([^"]+)"[^>]*>([^<]*)</.exec(c.html);
    if (b) c.kids.push({ tag: 'button', action: b[1], textContent: b[2], getAttribute: function (k) { return k === 'data-action' ? b[1] : null; } });
  } });
  c.querySelector = function (sel) { const m = /^\[data-action="([^"]+)"\]$/.exec(sel); return m ? c.kids.filter(function (k) { return k.action === m[1]; })[0] || null : null; };
  return c;
}

// A grants table as its caller describes it (goal/G41.16, Andy: "the callers (Grants and agent shell apps should boody
// well know how to configure the damn grantsPanel element"): its data branch, its rows' key and label fields, how a grant
// is revoked, and its watch, fn(id + newline + path, row), its cache manager's (goal/G41.28).
function grantsTable(o) {
  const t = { key: o.key, label: o.label, revoked: [], watch: o.watch,
    revoke: function (id, p) { t.revoked.push({ id: id, path: p }); return Promise.resolve({ ok: true }); } };
  Object.defineProperty(t, 'branch', Object.getOwnPropertyDescriptor(o, 'branch'));
  return t;
}
// As shell/grants/grants.js configures the node's grants (goal/G41.28): the auth family's branch and its watch.
const NODE = grantsTable({ get branch() { return ((global.window.spirit.data || {}).auth || {}).data ? global.window.spirit.data.auth.data.grants.branch : ''; }, key: 'key', label: 'label',
  watch: function (fn) { return global.window.spirit.data.auth.data.grants.watch(fn); } });
// A second table, its branch a whole spirit.data path of the home node, its watch that branch's.
const AGENT = grantsTable({ get branch() { return global.window.spirit.data.viewAt(null, 'agent').path('grant'); }, key: 'job_id', label: 'job',
  watch: function (fn) { const v = global.window.spirit.data.viewAt(null, 'agent'); return v.watch('grant', function (whole, row) { fn(v.row(whole, 'grant'), row); }); } });

test.startTest('grantSelector/rowElement.js: one grant, as a row, of whichever grants table it is handed');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('spirit/element/search/grant/rowElement.js is not there'); return; }
  const SRC = fs.readFileSync(FILE, 'utf8').replace(/\/\/.*$/gm, '');
  const required = [];
  const armed = [];
  const STANDS = {
    'spirit/element/rowElement.js': function () { vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', 'element', 'rowElement.js'), 'utf8'), { filename: 'rowElement.js' }); },
    'spirit/element/armingButton.js': function (E) { E.armingButton = { attach: function (b, o) { armed.push({ button: b, o: o }); return b; } }; },
  };
  global.document = { createElement: function () { return {}; } };
  global.window = { spirit: { escapeHtml: function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }, ready: Promise.resolve({}), element: {} } };
  global.spirit = global.window.spirit;
  vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', 'data.js'), 'utf8'), { filename: 'data.js' });
  const DATA = global.window.spirit.data;
  // THE PAGE KNOWS ITS NODE (goal/G41.28): spirit.start asks node.card, keeps the key and hands it to the data set.
  const NODE_KEY = 'nOdE+key/one==';
  global.window.spirit.node = { key: NODE_KEY };
  DATA.homeNode(NODE_KEY);
  // spirit.cacheManager(name), as a page's: the family's manager loaded once, attaching itself to the data set; the
  // Grants app asks the auth family's as it loads (shell/grants/grants.js).
  const managers = [];
  global.window.spirit.cacheManager = function (name) {
    managers.push(String(name));
    vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', String(name), 'data.js'), 'utf8'), { filename: name + '/data.js' });
    return Promise.resolve(true);
  };
  await global.window.spirit.cacheManager('auth');
  const A = ((global.window.spirit.data || {}).auth || {}).data;
  // The direct writes below are the auth family's own view of the home node, as its manager files them.
  const V = DATA.viewAt(null, 'auth');
  global.window.spirit.require = function (p) { required.push(String(p)); if (STANDS[p] && !STANDS[p].done) { STANDS[p].done = true; STANDS[p](global.window.spirit.element); } return Promise.resolve(true); };
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  await settle();
  const E = global.window.spirit.element;

  ok(!!A && !!A.grants && typeof A.grants.row === 'function' && typeof NODE.branch === 'string' && NODE.branch !== '' && typeof AGENT.branch === 'string' && AGENT.branch !== '' && NODE.branch !== AGENT.branch,
    'the auth family\'s cache manager is on the page, and each table names a branch of its own', 'authReads: ' + short(A && Object.keys(A)) + ', branches ' + short([NODE.branch, AGENT.branch]));
  if (!A || !A.grants) return;

  test.subHeading('it loads what it uses itself (rule/26), and knows no grants table');
  ok(['spirit/element/rowElement.js', 'spirit/element/armingButton.js'].every(function (p) { return required.indexOf(p) !== -1; }) && !required.some(function (p) { return /data\.js$/.test(p); }),
    'it requires the shared row element and the arming button, and no data script', 'required: ' + short(required));
  ok(!/auth\.|agent\.grant|'bundles'|"bundles"|job_id/.test(SRC), 'it names no table: no auth verb, no agent grant, no stream job of its own (goal/G41.16)', 'rowElement.js names a table of its own');
  ok(E.grantElement && typeof E.grantElement.create === 'function', 'it registers spirit.element.grantElement.create', 'elements: ' + short(Object.keys(E)));
  if (!E.grantElement || typeof E.grantElement.create !== 'function') return;
  // UNCONFIGURED, IT THROWS NOTHING (goal/G41.19, box v23: "throws nothing even when unconfigured"): made with no grants
  // table it is a row of nothing, and never falls back to one.
  let thrown = null; let bare = null;
  try { bare = E.grantElement.create({ key: 'K1', path: 'fs.search' }); } catch (e) { thrown = e && e.message; }
  ok(thrown === null && !!bare, 'made with no grants table, it throws nothing and is a row all the same', 'made with none: ' + (thrown ? 'it threw ' + thrown : 'nothing made'));

  for (const t of [{ name: 'the node\'s grants', g: NODE, id: 'K1', label: 'Bob <b>', row: function (x) { return { key: x.id, path: x.path, label: x.label }; } },
    { name: 'the agent\'s grants by job', g: AGENT, id: 'J1', label: 'Night <b>', row: function (x) { return { job_id: x.id, path: x.path, job: x.label }; } }]) {
    test.subHeading('a grant of ' + t.name + ': whose, the path, Revoke');
    const el = E.grantElement.create(t.row({ id: t.id, path: 'desk.chat<add>', label: t.label }), { grants: t.g });
    ok(el.kind === 'grant' && el.key === t.id + '\ndesk.chat<add>', 'it is a row element of kind grant, keyed <id>\\n<path>, the id read from the table\'s key field (' + t.g.key + ')', 'el: ' + short({ kind: el.kind, key: el.key }));
    const cells = {}; (el.cells() || []).forEach(function (c) { cells[c.name] = c.html; });
    ok(JSON.stringify(Object.keys(cells)) === '["name","path","revoke"]', 'its fields are name, path and revoke: Revoke the rightmost', 'fields: ' + short(Object.keys(cells)));
    ok(cells.name.indexOf(t.label.replace('<', '&lt;')) !== -1 && /desk\.chat&lt;add>/.test(cells.path || '') && !/<b>|<add>/.test(cells.name + cells.path), 'whose grant it is, read from the table\'s label field (' + t.g.label + '), and the path, drawn escaped', 'cells: ' + short(cells));
    const hosts = { name: cell(), path: cell(), revoke: cell() };
    armed.length = 0;
    el.mount(hosts);
    const rv = armed.filter(function (a) { return a.button && a.button.action === 'revoke'; })[0];
    ok(!!rv && t.g.revoked.length === 0, 'mounted, its Revoke is an armingButton, and nothing is revoked yet', 'armed ' + armed.length + ', revoked ' + short(t.g.revoked));
    if (rv) { await rv.o.run(); await settle(); }
    ok(t.g.revoked.length === 1 && t.g.revoked[0].id === t.id && t.g.revoked[0].path === 'desk.chat<add>', 'its second press revokes through the table it was handed: revoke(id, path)', 'revoked: ' + short(t.g.revoked));
  }

  test.subHeading('it translates no stream: a table\'s rows are its cache manager\'s (goal/G41.28)');
  // Andy, the box: "anything not using the new spiritData.js and it's buddies clientCacheManager.js must do so in this
  // item. no exceptions."
  ok(!/\.translate\s*\(|onJob|\bstream\b|events\.subscribe/.test(SRC), 'its code registers no translator and takes no stream', 'rowElement.js still translates or takes a stream');
  const unwatched = grantsTable({ branch: NODE.branch, key: 'key', label: 'label' });
  const nw = E.grantElement.create({ key: 'K5', path: 'fs.search', label: 'Eve' }, { grants: unwatched });
  const nwCells = {}; (nw.cells() || []).forEach(function (c) { nwCells[c.name] = c.html; });
  ok(!('revoke' in nwCells) || !/Revoke/.test(nwCells.revoke || ''), 'a table with no watch is no table: the row has no Revoke', 'cells: ' + short(nwCells));

  test.subHeading('it repaints from its table\'s watch');
  const live = E.grantElement.create({ key: 'K2', path: 'fs.search', label: 'Ann' }, { grants: NODE });
  const lh = { name: cell(), path: cell(), revoke: cell() };
  live.mount(lh);
  V.set('grants/K2\nfs.search', { key: 'K2', path: 'fs.search', label: 'Ann, renamed' });
  await settle();
  ok(live.row.label === 'Ann, renamed' && /Ann, renamed/.test(lh.name.innerHTML), 'its row in its branch changed: the row repaints whose grant it is', 'row: ' + short(live.row) + ', cell ' + short(lh.name.innerHTML));
  DATA.setPath(AGENT.branch + '/K2\nfs.search', { job_id: 'K2', path: 'fs.search', job: 'Other table' });
  V.set('grants/K3\nfs.search', { key: 'K3', path: 'fs.search', label: 'Other' });
  await settle();
  ok(live.row.label === 'Ann, renamed', 'another grant, or the same key in another table\'s branch, changes nothing here', 'row: ' + short(live.row));
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
