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
  const files = ['server.js', 'elementTable.js', 'elementRow.js'];
  ok(files.every(function (f) { return fs.existsSync(path.join(DIR, f)); }), 'it has server.js, elementTable.js and elementRow.js',
    'missing: ' + short(files.filter(function (f) { return !fs.existsSync(path.join(DIR, f)); })));
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

  test.subHeading('the page: elementTable.js');
  const w = { tables: [], calls: [], searches: [], required: [], answer: null };
  global.window = { spirit: { familyPath: familyPath, elements: {
    agentTable: { create: function (c, o) { w.tables.push({ c: c, o: o }); return { refresh: function () {}, destroy: function () {} }; } },
    agentDetail: {
      titleRow: function (look, words) { return '<div class="agent-title">' + (look && look.icon || '') + words.join(' ') + '</div>'; },
      fieldLine: function (l, i) { return '<div>' + l + i + '</div>'; },
      stretch: 'width:100%',
      search: function (host, o, more) { const s = { host: host, o: o, more: more, value: '', row: null, destroy: function () { s.destroyed = true; } }; w.searches.push(s); return s; },
      whyOf: function (e) { return String((e && e.body && e.body.extra && e.body.extra.why) || (e && e.message) || 'refused'); },
    },
  } } };
  global.spirit = global.window.spirit;
  const family = { grant: function (a) { w.calls.push(a); const r = w.answer ? w.answer(a) : a; return r instanceof Error ? Promise.reject(r) : Promise.resolve(r); } };
  global.window.spirit.require = function (p) { w.required.push(String(p)); return Promise.resolve(p === AGENT ? family : true); };
  ['elementTable.js', 'elementRow.js'].forEach(function (f) { vm.runInThisContext(fs.readFileSync(path.join(DIR, f), 'utf8'), { filename: path.join(DIR, f) }); });
  const E = global.window.spirit.elements;
  ok(E.grantTable && typeof E.grantTable.create === 'function' && E.grantRow && typeof E.grantRow.create === 'function',
    'they register spirit.elements.grantTable and grantRow', 'elements: ' + short(Object.keys(E)));
  if (!E.grantTable || !E.grantRow) return;
  const api = { stub: true };
  const detail = { open: function () {}, look: function (t2) { return { icon: '🔑', name: 'Grant', title: 'Grants, by job', table: t2 }; } };
  const listBox = { innerHTML: '' };
  E.grantTable.create(listBox, api, detail);
  await settle();
  ok(w.required.indexOf('process/js/agent/table/tableElement.js') !== -1 && w.required.indexOf('process/js/agent/table/grant/elementRow.js') !== -1,
    'elementTable.js requires the shared element and its own row element', 'required: ' + short(w.required));
  const o = w.tables[0] && w.tables[0].o;
  ok(w.tables.length === 1 && w.tables[0].c === listBox && o.table === 'grant' && o.api === api && o.detail === detail, 'it builds on agentTable, in its box, for the grant table, with the page\'s api and detail pane',
    'agentTable: ' + short(o && { table: o.table }));
  ok(o && JSON.stringify(o.matched({ job: 'Reader', path: 'files.read' })) === JSON.stringify({ job: 'Reader', path: 'files read' }), 'a grant is matched by its job and the words of its path',
    'matched: ' + short(o && o.matched({ job: 'Reader', path: 'files.read' })));
  const opens = [];
  o.add(function (key, added, r) { opens.push([key, added, r]); });
  ok(JSON.stringify(opens) === JSON.stringify([['', true, null]]) && w.calls.length === 0, 'its Add opens an empty editor and asks the server nothing: a grant is made from a job and a path',
    'opened: ' + short(opens) + ', calls ' + short(w.calls));

  test.subHeading('the page: elementRow.js, a new grant');
  const ed = box('editor');
  o.row(ed, '', true, null);
  await settle();
  ok(/Add/.test(ed.innerHTML) && ed.innerHTML.indexOf('🔑') !== -1 && the(ed, 'path') && the(ed, 'add'), 'with no grant it is the Add form: the title says Add, a path to type, an Add button',
    'editor: ' + short(ed.innerHTML));
  const pick = w.searches[w.searches.length - 1];
  ok(pick && pick.host === the(ed, 'job') && pick.o.table === 'job' && pick.o.api === api && pick.more.face === 'dropdown', 'the job is picked from a dropdown search of the job table, the one table search',
    'search: ' + short(pick && { table: pick.o.table, face: pick.more && pick.more.face }));
  the(ed, 'add').click(); await settle();
  ok(w.calls.length === 0 && the(ed, 'note').textContent === 'Pick a job first.', 'Add with no job picked asks nothing and says to pick one', 'note: ' + short(the(ed, 'note').textContent));
  pick.value = 'KJ'; pick.row = { label: 'Reader' };
  the(ed, 'add').click(); await settle();
  ok(w.calls.length === 0 && the(ed, 'note').textContent === 'Type the path first.', 'Add with no path asks nothing and says to type it', 'note: ' + short(the(ed, 'note').textContent));
  the(ed, 'path').value = ' files.read ';
  w.answer = function () { return refused('job has no row KJ'); };
  the(ed, 'add').click(); await settle();
  ok(w.calls.length === 1 && JSON.stringify(w.calls[0]) === JSON.stringify({ op: 'add', job_id: 'KJ', path: 'files.read' }), 'Add calls grant { op: add, job_id, path }, the path trimmed', 'calls: ' + short(w.calls));
  ok(the(ed, 'note').textContent === 'Not added: job has no row KJ', 'a refused Add says the server\'s reason', 'note: ' + short(the(ed, 'note').textContent));
  w.answer = null;
  the(ed, 'add').click(); await settle();
  ok(/Change/.test(ed.innerHTML) && ed.innerHTML.indexOf('Reader') !== -1 && ed.innerHTML.indexOf('files.read') !== -1 && the(ed, 'delete'),
    'a grant added is shown from the server\'s answer: Change, its job, its path, a Delete button', 'editor: ' + short(ed.innerHTML));

  test.subHeading('the page: elementRow.js, a grant shown');
  const ed2 = box('editor2');
  w.calls.length = 0;
  E.grantRow.create(ed2, api, { job_id: 'KJ', job: 'Reader', path: 'files.read' }, detail);
  ok(/Change/.test(ed2.innerHTML) && ed2.innerHTML.indexOf('Reader') !== -1 && !the(ed2, 'path'), 'a grant opened from the list shows its job and its path, with nothing to type', 'editor2: ' + short(ed2.innerHTML));
  w.answer = function () { return refused('job KJ holds no grant files.read'); };
  the(ed2, 'delete').click(); await settle();
  ok(w.calls.length === 1 && JSON.stringify(w.calls[0]) === JSON.stringify({ op: 'delete', job_id: 'KJ', path: 'files.read' }) && the(ed2, 'note').textContent === 'Not deleted: job KJ holds no grant files.read',
    'Delete calls grant { op: delete, job_id, path }; refused, it says the server\'s reason', 'calls ' + short(w.calls) + ', note ' + short(the(ed2, 'note') && the(ed2, 'note').textContent));
  w.answer = null;
  the(ed2, 'delete').click(); await settle();
  ok(/Deleted\./.test(ed2.innerHTML) && the(ed2, 'add'), 'taken, it says Deleted. and is the Add form again', 'editor2: ' + short(ed2.innerHTML));
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* the scratch folder is the system's to clear */ }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
