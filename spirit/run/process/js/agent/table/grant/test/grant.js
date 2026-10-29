'use strict';

// spirit/run/process/js/agent/table/grant/test/grant.js
// The tests of process/js/agent/table/grant/, its server.js, elementTable.js and elementRow.js, and of no other module
// (spec: ./grant.md; goal/G41.4). What the tables share is tested in ../../test/, and the one interface to a grant
// table in spirit/test/authTableInterface.js. The server is made on a scratch agent.db as agent.js makes it, beside the
// job table its grants name; the page files run in node on a window of their own, the shared elements and the agent
// server's interface stubs that keep what they were handed.

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../../../..');
require(path.join(RUN, 'spirit.js'));
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { DatabaseSync } = require('node:sqlite');
const familyPath = require(path.join(RUN, 'spirit.js')).familyPath;

const DIR = path.join(__dirname, '..');
const AGENT = familyPath('agent');
function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function call(verb, a) { try { return verb.handler(a); } catch (e) { return { refusal: e.refusal || 'threw', why: (e.extra && e.extra.why) || e.message }; } }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 10; i++) await tick(); };

// A box: its markup makes a part per id, each with its tag's value and its own listeners; a new markup makes new parts.
function box(name) {
  let html = '';
  const b = { name: name, parts: {},
    get innerHTML() { return html; },
    set innerHTML(v) {
      html = String(v); b.parts = {};
      const re = /<([a-z]+)\b[^>]*>/gi; let m;
      while ((m = re.exec(html))) { const id = /\bid="([^"]+)"/.exec(m[0]); if (id) b.parts[id[1]] = part(m[0]); }
    },
    querySelector: function (sel) { return sel.charAt(0) === '#' ? b.parts[sel.slice(1)] || null : null; },
  };
  return b;
}
function part(tag) {
  const heard = {};
  const n = { tag: tag, value: '', textContent: '',
    addEventListener: function (type, fn) { (heard[type] = heard[type] || []).push(fn); },
    click: function () { (heard.click || []).slice().forEach(function (fn) { fn({}); }); } };
  return n;
}
function the(b, end) { const k = Object.keys(b.parts).filter(function (id) { return id.slice(-end.length - 1) === '-' + end; })[0]; return k ? b.parts[k] : null; }
function refused(why) { const e = new Error('refused'); e.body = { extra: { why: why } }; return e; }

test.startTest('grant/: the grant table');

(async function () {
  test.subHeading('its files');
  // goal/G41.16: the agent app's grant tool is the grants panel (shell/js/grantsPanel.js), with the grant list and row of
  // shell/js/grantSelector/ (Andy: "could we then show the grants element in the left pane, connected to the
  // grants-by-job table?"). So the agent's own grant page files go; its server stays.
  ok(fs.existsSync(path.join(DIR, 'server.js')), 'it has server.js', 'there is no grant/server.js');
  ok(!fs.existsSync(path.join(DIR, 'elementTable.js')) && !fs.existsSync(path.join(DIR, 'elementRow.js')), 'and no page files of its own: elementTable.js and elementRow.js are gone, the grants panel draws the grants by job',
    'still there: ' + short(['elementTable.js', 'elementRow.js'].filter(function (f) { return fs.existsSync(path.join(DIR, f)); })));
  if (!fs.existsSync(path.join(DIR, 'server.js'))) return;

  test.subHeading('server.js: the table in agent.db, keyed as node\'s grants are');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-grant-'));
  const dbFile = path.join(scratch, 'agent.db');
  const db = new DatabaseSync(dbFile);
  const published = [];
  const ctx = { db: db, dbFile: dbFile, tables: {}, publish: function (x) { published.push(x); } };
  ctx.tables.job = require(path.join(DIR, '..', 'job', 'server.js'))(ctx);
  const t = ctx.tables.grant = require(path.join(DIR, 'server.js'))(ctx);
  ok(t && t.verb && typeof t.verb.handler === 'function' && typeof t.dropJob === 'function', 'server.js(ctx) answers its verb and dropJob', 'answered: ' + short(t && Object.keys(t)));
  // Andy, box v22: "an grant/auth table, keyed by job-ID, structured exactly like the auth table in node".
  const cols = db.prepare('PRAGMA table_info("grant")').all();
  const pk = cols.filter(function (c) { return c.pk; }).sort(function (a, b) { return a.pk - b.pk; }).map(function (c) { return c.name; });
  ok(cols.length === 2 && JSON.stringify(pk) === '["job_id","path"]', 'the grant table is (job_id, path), both its primary key, and nothing else', 'columns: ' + short(cols.map(function (c) { return c.name; })) + ', key ' + short(pk));

  test.subHeading('server.js: add, get, delete');
  const job = call(ctx.tables.job.verb, { op: 'add', label: 'Reader', icon: '📖' });
  published.length = 0;
  const added = call(t.verb, { op: 'add', job_id: job.id, path: 'files.read' });
  ok(added.job_id === job.id && added.path === 'files.read', 'add {job_id, path} answers { job_id, path }', 'add: ' + short(added));
  const p0 = published[0] && published[0].agent;
  ok(published.length === 1 && p0.table === 'grant' && p0.row.job_id === job.id && p0.row.path === 'files.read' && !p0.removed, 'and publishes { agent: { table: grant, row } }', 'published: ' + short(published));
  // goal/G41.16: the grants panel shows a grant by its job's label (its grants table's label field, job), straight from the
  // stream: the published row carries it, as the search answers it.
  ok(p0 && p0.row.job === 'Reader', 'the published row carries the job\'s label, job, as the search answers it (goal/G41.16)', 'published row: ' + short(p0 && p0.row));
  call(t.verb, { op: 'add', job_id: job.id, path: 'files.list' });
  const got = call(t.verb, { op: 'get', job_id: job.id });
  ok(got.job_id === job.id && JSON.stringify((got.paths || []).slice().sort()) === '["files.list","files.read"]', 'get {job_id} answers that job\'s paths', 'get: ' + short(got));
  const gone = require(path.join(RUN, 'spirit', 'relayAuth.js')).generateIdentity('').publicKey;
  ok(call(t.verb, { op: 'add', job_id: gone, path: 'files.read' }).refusal === 'no-such-row', 'a grant to a job that is not there is refused no-such-row', 'add answered');
  ok(call(t.verb, { op: 'add', job_id: job.id }).refusal === 'bad-request', 'a grant with no path is refused', 'add answered');
  ok(call(t.verb, { op: 'add', job_id: job.id, path: 'x', verb: 'grant' }).refusal === 'no-such-argument', 'an argument it does not declare is refused no-such-argument', 'add answered');
  ok(call(t.verb, { op: 'set', job_id: job.id, path: 'x' }).refusal === 'bad-request', 'it has no set: a grant is there or not', 'set answered');

  test.subHeading('server.js: search shows each grant by its job\'s icon and its label');
  const found = call(t.verb, { op: 'search', text: '' });
  const item = (found.items || []).filter(function (i) { return i.key === job.id + '|files.read'; })[0];
  let row = null; try { row = JSON.parse(item.label); } catch (e) { row = null; }
  ok(found.items && found.items.length === 2 && typeof found.more === 'boolean', 'search with no words answers { items, more }, every grant', 'search: ' + short(found));
  ok(row && row.job_id === job.id && row.job === 'Reader' && row.path === 'files.read' && row.icon === '📖' && row.label === 'Reader: files.read',
    'each keyed <job_id>|<path>, its row { job_id, job, path, icon, label }: the job\'s label and icon, the label "job: path"', 'item: ' + short(item));
  const hit = call(t.verb, { op: 'search', text: 'list' });
  ok(hit.items.length >= 1 && hit.items[0].key === job.id + '|files.list', 'a search of a word of the path ranks that grant first', 'search list: ' + short(hit.items.map(function (i) { return i.key; })));

  test.subHeading('server.js: delete, and a job deleted takes its grants');
  published.length = 0;
  const del = call(t.verb, { op: 'delete', job_id: job.id, path: 'files.list' });
  ok(del.job_id === job.id && del.path === 'files.list' && JSON.stringify(call(t.verb, { op: 'get', job_id: job.id }).paths) === '["files.read"]',
    'delete {job_id, path} takes that grant away, the others kept', 'delete: ' + short(del));
  ok(published.length === 1 && published[0].agent.removed === true && published[0].agent.row.path === 'files.list', 'and publishes it removed', 'published: ' + short(published));
  ok(call(t.verb, { op: 'delete', job_id: job.id, path: 'files.list' }).refusal === 'no-such-row', 'a second delete of it is refused no-such-row', 'delete answered');
  published.length = 0;
  call(ctx.tables.job.verb, { op: 'delete', id: job.id });
  ok(call(t.verb, { op: 'get', job_id: job.id }).paths.length === 0 && published.some(function (x) { return x.agent.table === 'grant' && x.agent.removed && x.agent.row.path === 'files.read'; }),
    'deleting the job drops its grants, each published removed', 'published: ' + short(published));

}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
