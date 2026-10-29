'use strict';

// spirit/run/shell/js/grantSelector/test/rowElement.js
// The tests of shell/js/grantSelector/rowElement.js, and of no other module (spec: ./rowElement.md; goal/G41.14,
// goal/G41.16). The browser file runs in node on a BARE window (rule/26): nothing is on the page until the row requires
// it. The shared row element and the page's data set are real; the arming button is a stand-in that records what it was
// handed. The grants table is the caller's, handed in as a configuration (goal/G41.16), each call recorded; two are
// tried, shaped as the node's auth grants and the agent's grants by job are, so nothing of either is the row's own.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(RUN, 'shell', 'js', 'grantSelector', 'rowElement.js');

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
// is revoked, and which stream rows are its grants.
function grantsTable(o) {
  const t = { branch: o.branch, key: o.key, label: o.label, revoked: [],
    revoke: function (id, p) { t.revoked.push({ id: id, path: p }); return Promise.resolve({ ok: true }); },
    stream: o.stream };
  return t;
}
const NODE = grantsTable({ branch: 'grants', key: 'key', label: 'label',
  stream: function (job) { const d = job && job.type === 'bundles' ? job.data : null; return d && d.table === 'grant' ? { row: d.row, gone: d.gone === true } : null; } });
const AGENT = grantsTable({ branch: 'agent.grant', key: 'job_id', label: 'job',
  stream: function (job) { const a = job && job.module === 'process/js/agent' && job.app && job.app.agent; return a && a.table === 'grant' ? { row: a.row, gone: a.removed === true } : null; } });

test.startTest('grantSelector/rowElement.js: one grant, as a row, of whichever grants table it is handed');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('shell/js/grantSelector/rowElement.js is not there'); return; }
  const SRC = fs.readFileSync(FILE, 'utf8').replace(/\/\/.*$/gm, '');
  const required = [];
  const armed = [];
  const STANDS = {
    'shell/js/rowElement.js': function () { vm.runInThisContext(fs.readFileSync(path.join(RUN, 'shell', 'js', 'rowElement.js'), 'utf8'), { filename: 'rowElement.js' }); },
    'shell/js/armingButton.js': function (E) { E.armingButton = { attach: function (b, o) { armed.push({ button: b, o: o }); return b; } }; },
  };
  global.document = { createElement: function () { return {}; } };
  global.window = { spirit: { escapeHtml: function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }, ready: Promise.resolve({}), elements: {} } };
  global.spirit = global.window.spirit;
  vm.runInThisContext(fs.readFileSync(path.join(RUN, 'shell', 'js', 'spiritData.js'), 'utf8'), { filename: 'spiritData.js' });
  const DATA = global.window.spirit.data;
  global.window.spirit.require = function (p) { required.push(String(p)); if (STANDS[p] && !STANDS[p].done) { STANDS[p].done = true; STANDS[p](global.window.spirit.elements); } return Promise.resolve(true); };
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  await settle();
  const E = global.window.spirit.elements;

  test.subHeading('it loads what it uses itself (rule/26), and knows no grants table');
  ok(['shell/js/rowElement.js', 'shell/js/armingButton.js'].every(function (p) { return required.indexOf(p) !== -1; }) && !required.some(function (p) { return /data\.js$/.test(p); }),
    'it requires the shared row element and the arming button, and no data script', 'required: ' + short(required));
  ok(!/auth\.|agent\.grant|'bundles'|"bundles"|job_id/.test(SRC), 'it names no table: no auth verb, no agent grant, no stream job of its own (goal/G41.16)', 'rowElement.js names a table of its own');
  ok(E.grantElement && typeof E.grantElement.create === 'function', 'it registers spirit.elements.grantElement.create', 'elements: ' + short(Object.keys(E)));
  if (!E.grantElement || typeof E.grantElement.create !== 'function') return;
  let refused = null;
  try { E.grantElement.create({ key: 'K1', path: 'fs.search' }); } catch (e) { refused = e && e.message; }
  ok(refused !== null, 'made with no grants table, it is refused: it never falls back to one', 'made with none: no refusal');

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

  test.subHeading('it takes each table\'s grant rows from the stream, into that table\'s own branch');
  // The data type's code is its row element (G30.18): it reads only the stream rows its table says are its grants, and
  // keeps them in its table's branch, so the node's grants and the agent's never mix on one page.
  E.grantElement.create({ key: 'K0', path: 'fs.search' }, { grants: NODE });
  E.grantElement.create({ job_id: 'J0', path: 'fs.search' }, { grants: AGENT });
  DATA.take({ type: 'bundles', data: { table: 'grant', row: { key: 'K9', path: 'jobs.list', label: 'Zed' } } });
  DATA.take({ module: 'process/js/agent', data: {}, app: { agent: { table: 'grant', row: { job_id: 'J9', path: 'jobs.list', job: 'Night' } } } });
  ok(DATA.get('grants/K9\njobs.list') && DATA.get('grants/K9\njobs.list').label === 'Zed', 'a node grant lands in data.grants/<key>\\n<path>', 'grants: ' + short(DATA.branch('grants')));
  ok(DATA.get('agent.grant/J9\njobs.list') && DATA.get('agent.grant/J9\njobs.list').job === 'Night', 'an agent grant lands in data.agent.grant/<job_id>\\n<path>', 'agent.grant: ' + short(DATA.branch('agent.grant')));
  ok(!DATA.get('grants/J9\njobs.list') && !DATA.get('agent.grant/K9\njobs.list'), 'neither lands in the other\'s branch', 'grants ' + short(DATA.branch('grants')) + ', agent.grant ' + short(DATA.branch('agent.grant')));
  DATA.take({ type: 'bundles', data: { table: 'grant', row: { key: 'K9', path: 'jobs.list' }, gone: true } });
  DATA.take({ module: 'process/js/agent', data: {}, app: { agent: { table: 'grant', row: { job_id: 'J9', path: 'jobs.list' }, removed: true } } });
  ok(DATA.get('grants/K9\njobs.list') === undefined && DATA.get('agent.grant/J9\njobs.list') === undefined, 'a grant told gone is taken out of its branch', 'grants ' + short(DATA.branch('grants')) + ', agent.grant ' + short(DATA.branch('agent.grant')));
  const before = JSON.stringify([DATA.branch('grants'), DATA.branch('agent.grant')]);
  DATA.take({ type: 'bundles', data: { table: 'bundle', row: { id: 1, label: 'not a grant' } } });
  DATA.take({ type: 'shadow', data: { row: { publicKey: 'K8' } } });
  DATA.take({ type: 'bundles', data: { table: 'grant', row: { label: 'no key' } } });
  ok(JSON.stringify([DATA.branch('grants'), DATA.branch('agent.grant')]) === before, 'a row its tables do not call a grant, or a grant with no id or path, writes nothing', 'branches: ' + before);

  test.subHeading('it repaints from its table\'s branch');
  const live = E.grantElement.create({ key: 'K2', path: 'fs.search', label: 'Ann' }, { grants: NODE });
  const lh = { name: cell(), path: cell(), revoke: cell() };
  live.mount(lh);
  DATA.set('grants/K2\nfs.search', { key: 'K2', path: 'fs.search', label: 'Ann, renamed' });
  await settle();
  ok(live.row.label === 'Ann, renamed' && /Ann, renamed/.test(lh.name.innerHTML), 'its row in its branch changed: the row repaints whose grant it is', 'row: ' + short(live.row) + ', cell ' + short(lh.name.innerHTML));
  DATA.set('agent.grant/K2\nfs.search', { job_id: 'K2', path: 'fs.search', job: 'Other table' });
  DATA.set('grants/K3\nfs.search', { key: 'K3', path: 'fs.search', label: 'Other' });
  await settle();
  ok(live.row.label === 'Ann, renamed', 'another grant, or the same key in another table\'s branch, changes nothing here', 'row: ' + short(live.row));
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
