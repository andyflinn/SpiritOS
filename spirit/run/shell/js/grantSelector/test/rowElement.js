'use strict';

// spirit/run/shell/js/grantSelector/test/rowElement.js
// The tests of shell/js/grantSelector/rowElement.js, and of no other module (spec: ./rowElement.md; goal/G41.14). The
// browser file runs in node on a BARE window (rule/26): nothing is on the page until the row requires it. The shared row
// element and the page's data set are real; the arming button is a stand-in that records what it was handed. The node's
// auth family is the spirit object's, each call recorded.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(RUN, 'shell', 'js', 'grantSelector', 'rowElement.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

// A cell as the list hands one to mount: its html set by the paint, a button in it found as a page would find it.
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

test.startTest('grantSelector/rowElement.js: one grant, as a row');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('shell/js/grantSelector/rowElement.js is not there'); return; }
  const asked = [];
  const required = [];
  const armed = [];
  const auth = { revoke: function (a) { asked.push(a); return Promise.resolve({ revoked: true }); } };
  const STANDS = {
    'shell/js/rowElement.js': function () { vm.runInThisContext(fs.readFileSync(path.join(RUN, 'shell', 'js', 'rowElement.js'), 'utf8'), { filename: 'rowElement.js' }); },
    'shell/js/armingButton.js': function (E) { E.armingButton = { attach: function (b, o) { armed.push({ button: b, o: o }); return b; } }; },
  };
  global.document = { createElement: function () { return {}; } };
  global.window = { spirit: { escapeHtml: function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }, ready: Promise.resolve({ auth: auth }), auth: auth, elements: {} } };
  global.spirit = global.window.spirit;
  vm.runInThisContext(fs.readFileSync(path.join(RUN, 'shell', 'js', 'spiritData.js'), 'utf8'), { filename: 'spiritData.js' });
  const DATA = global.window.spirit.data;
  global.window.spirit.require = function (p) { required.push(String(p)); if (STANDS[p] && !STANDS[p].done) { STANDS[p].done = true; STANDS[p](global.window.spirit.elements); } return Promise.resolve(true); };
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  await settle();
  const E = global.window.spirit.elements;

  test.subHeading('it loads what it uses itself (rule/26)');
  ok(['shell/js/rowElement.js', 'shell/js/armingButton.js'].every(function (p) { return required.indexOf(p) !== -1; }) && !required.some(function (p) { return /data\.js$/.test(p); }),
    'it requires the shared row element and the arming button through spirit.require, and no data script', 'required: ' + short(required));
  ok(E.grantElement && typeof E.grantElement.create === 'function', 'it registers spirit.elements.grantElement.create', 'elements: ' + short(Object.keys(E)));
  if (!E.grantElement || typeof E.grantElement.create !== 'function') return;

  test.subHeading('a grant row: whose, the path, Revoke');
  const el = E.grantElement.create({ key: 'K1', path: 'desk.chat<add>', label: 'Bob <b>' });
  ok(el.kind === 'grant' && el.key === 'K1\ndesk.chat<add>' && el.row.key === 'K1' && el.row.path === 'desk.chat<add>', 'it is a row element of kind grant, keyed <key>\\n<path>', 'el: ' + short({ kind: el.kind, key: el.key, row: el.row }));
  const cells = {}; (el.cells() || []).forEach(function (c) { cells[c.name] = c.html; });
  ok(JSON.stringify(Object.keys(cells)) === '["name","path","revoke"]', 'its fields are name, path and revoke, in that order: Revoke the rightmost', 'fields: ' + short(Object.keys(cells)));
  ok(/Bob &lt;b>/.test(cells.name || '') && /desk\.chat&lt;add>/.test(cells.path || '') && !/<b>|<add>/.test((cells.name || '') + (cells.path || '')), 'whose grant (its label) and the path are drawn escaped', 'cells: ' + short(cells));
  ok(/data-action="revoke"/.test(cells.revoke || '') && /Revoke/.test(cells.revoke || ''), 'revoke is a button naming its action, reading Revoke', 'revoke: ' + short(cells.revoke));

  test.subHeading('Revoke asks are-you-sure');
  const hosts = { name: cell(), path: cell(), revoke: cell() };
  el.mount(hosts);
  const rv = armed.filter(function (a) { return a.button && a.button.action === 'revoke'; })[0];
  ok(!!rv && typeof rv.o.run === 'function' && asked.length === 0, 'mounted, its Revoke is an armingButton, and nothing is asked yet', 'armed ' + armed.length + ', asked ' + short(asked));
  if (rv) { await rv.o.run(); await settle(); }
  ok(asked.length === 1 && asked[0].key === 'K1' && asked[0].path === 'desk.chat<add>', 'its second press asks auth.revoke { key, path }', 'asked: ' + short(asked));

  test.subHeading('the type\'s own element takes the node\'s grant rows from the stream (goal/G41.14)');
  // Andy: "SO THE MOTHERFUCKING GRANS TABLE DOES NOT BUPLISH EITHER????", "INCLUDING COMPLETE TEST FOLDER FOR THE
  // COMPONENTS INVOLVED!!!!". The node publishes each grant row as it changes on the auth tables' job (type bundles,
  // table grant); the row element, its kind's index (shell/js/rowElement.js, G30.18), takes it into data.grants.
  DATA.take({ type: 'bundles', data: { table: 'grant', row: { key: 'K9', path: 'jobs.list', label: 'Zed' } } });
  const kept = DATA.get('grants/K9\njobs.list');
  ok(kept && kept.key === 'K9' && kept.path === 'jobs.list' && kept.label === 'Zed', 'a grant published lands in data.grants by its key and path', 'grants: ' + short(DATA.branch('grants')));
  DATA.take({ type: 'bundles', data: { table: 'grant', row: { key: 'K9', path: 'jobs.list' }, gone: true } });
  ok(kept && DATA.get('grants/K9\njobs.list') === undefined, 'a grant published gone is taken out', 'grants: ' + short(DATA.branch('grants')));
  const before = JSON.stringify(DATA.branch('grants'));
  DATA.take({ type: 'bundles', data: { table: 'bundle', row: { id: 1, label: 'not a grant' } } });
  DATA.take({ type: 'shadow', data: { row: { publicKey: 'K8' } } });
  DATA.take({ type: 'bundles', data: { table: 'grant', row: { label: 'no key' } } });
  ok(kept && JSON.stringify(DATA.branch('grants')) === before, 'a bundle row, another job\'s, and a grant with no key or path write nothing in data.grants', 'grants: ' + short(DATA.branch('grants')));

  test.subHeading('it repaints from data.grants');
  const live = E.grantElement.create({ key: 'K2', path: 'fs.search', label: 'Ann' });
  const lh = { name: cell(), path: cell(), revoke: cell() };
  live.mount(lh);
  DATA.set('grants/K2\nfs.search', { key: 'K2', path: 'fs.search', label: 'Ann, renamed' });
  await settle();
  ok(live.row.label === 'Ann, renamed' && /Ann, renamed/.test(lh.name.innerHTML), 'its row in data.grants changed, the row repaints whose grant it is', 'row: ' + short(live.row) + ', cell ' + short(lh.name.innerHTML));
  DATA.set('grants/K3\nfs.search', { key: 'K3', path: 'fs.search', label: 'Other' });
  await settle();
  ok(live.row.label === 'Ann, renamed', 'another grant\'s row changes nothing here', 'row: ' + short(live.row));
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
