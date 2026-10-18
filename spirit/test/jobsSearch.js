'use strict';

// spirit/test/jobsSearch.js
// goal/G29.14: Jobs searched on the shared list, the shared progressBar, and Jobs Details as a live monitor of the
// events a job publishes. Red on today's tree; claude-windows writes it and builds it (one agent). The item's box (v9):
//   JOBS: the shared list, filters on row 1, the search on row 2, then the rows. Words match name, type, module and id;
//   with no words the rows are sorted by id and stand still (box v10). Kind filter, one choice: all, node, servers,
//   transient (node: the node's own jobs). Column headings are the shared list's own; a left-most column holds one green
//   dot, on the most recent update. Status filter: one
//   toggle per status the list holds, each in or out (a multi-toggle filter in listSearch.js, usable by every list).
//   Columns: rank bar, status, name (module, else type), kind, progress, updated.
//   PROGRESS BAR: progressBar, one shared shell element drawn from (done, total, text); total 0 indeterminate; it knows
//   nothing of processes. The shell app hooks it up: Jobs feeds it from each process's {job} events (goal/G29.15), and
//   a server between jobs shows idle, no bar.
//   JOBS DETAILS: a real-time monitor of a capturable event stream, never stdout; the last 256 events the shell
//   receives; the dialog fills the page and does not scroll: the header, the rolling event log (1/3 of the height, one
//   JSON line per event), the Extract/analyze box (1/3 of the height: the last event clicked, JSON.stringify(object,
//   null, 2) in a read-only CodeMirror textView); the log and the box scroll inside themselves.
//
// NAMED HERE where the box names none (argued in Desk first if the build disagrees):
//   - shell/shared/js/progressBar.js sets window.spiritElements.progressBar(done, total, text) -> html, handed to apps
//     as api.ui.elements.progressBar; index.html loads it.
//   - a shared-list filter with multi: true is a row of toggles, every one on at the start; its choices may be a
//     function of the rows held; test(row, off) gets the object of the values turned off.
//   - Jobs hears each job event through api.onJobs(fn(jobsById, changed)), as Jobs Details does.
//   - An event is what a job publishes, its `app` object, when it differs from the one before; for fs-watcher, its
//     tree command. Jobs Details draws them in jd-log, each line with data-event (its place in the window), and the
//     Extract box in jd-extract.
// rule/11: through testSupport only.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');

const OWED = 'OWED by goal/G29.14: ';
const RUN = path.join(__dirname, '..', 'run');
const read = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8'); } catch (e) { return ''; } };
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }

test.startTest('goal/G29.14: Jobs on the shared list, the shared progressBar, Jobs Details as a live event monitor');

// A small DOM: getElementById makes what it is asked for; listeners fire by hand.
function page() {
  const byId = {};
  const node = function (id) {
    let html = '';
    const e = { id: id || '', style: {}, listeners: {}, value: '', hidden: false, attrs: {}, scrollTop: 0, scrollHeight: 0, clientHeight: 0,
      addEventListener: function (t, fn) { (e.listeners[t] = e.listeners[t] || []).push(fn); },
      fire: function (t, ev) { (e.listeners[t] || []).slice().forEach(function (fn) { fn(ev || {}); }); },
      setAttribute: function (k, v) { e.attrs[k] = String(v); }, getAttribute: function (k) { return e.attrs[k] === undefined ? null : e.attrs[k]; },
      querySelector: function () { return null; }, querySelectorAll: function () { return []; }, focus: function () {}, contains: function () { return true; } };
    Object.defineProperty(e, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); } });
    return e;
  };
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = node(id)); }, addEventListener: function () {}, querySelector: function () { return null; } };
  return { doc: doc, node: node, byId: byId };
}
// A press on something drawn: a target that answers its attributes and the row it sits in.
function target(attrs, rowKey) {
  return { id: attrs.id || '', getAttribute: function (k) { return attrs[k] === undefined ? null : String(attrs[k]); },
    closest: function () { return rowKey == null ? null : { getAttribute: function (k) { return k === 'data-key' ? rowKey : null; } }; } };
}

const win = {};
['probabilityStringMatch.js', 'probabilityStringObjectMatch.js', 'probabilityBucket.js'].forEach(function (f) {
  new Function('window', 'module', fs.readFileSync(path.join(RUN, 'js', f), 'utf8'))(win, undefined);
});
const p = page();
function loadInto(rel) {
  const src = read(rel);
  if (!src) return false;
  new Function('document', 'window', src)(p.doc, win);
  return true;
}
loadInto('shell/shared/js/listSearch.js');
const hasBar = loadInto('shell/shared/js/progressBar.js');

(async function () {
  // ── 1. the shared progressBar ─────────────────────────────────────────
  test.subHeading('1. progressBar: one shared element, drawn from (done, total, text)');
  const bar = win.spiritElements && win.spiritElements.progressBar;
  if (hasBar && typeof bar === 'function') test.check('shell/shared/js/progressBar.js sets window.spiritElements.progressBar');
  else test.fail(OWED + 'no progressBar in shell/shared/js');
  const known = typeof bar === 'function' ? String(bar(3, 10, 'image 3')) : '';
  if (/<progress[^>]*\bvalue="3"[^>]*>|<progress[^>]*\bmax="10"[^>]*\bvalue="3"/.test(known) && /max="10"/.test(known) && /image 3/.test(known)) test.check('(3, 10, "image 3") draws a bar at 3 of 10 with its text');
  else test.fail(OWED + 'progressBar(3, 10) drew ' + short(known));
  const unknown = typeof bar === 'function' ? String(bar(1, 0, 'counting')) : '';
  if (/<progress/.test(unknown) && !/\bvalue=/.test(unknown) && /counting/.test(unknown)) test.check('total 0 draws an indeterminate bar: a progress tag with no value');
  else test.fail(OWED + 'progressBar(1, 0) drew ' + short(unknown));
  if (/progressBar:\s*spiritElements\.progressBar/.test(read('js/client/shell.js'))) test.check('apps get it as api.ui.elements.progressBar');
  else test.fail(OWED + 'shell.js does not hand progressBar to apps');
  if (/<script src="\/shell\/shared\/js\/progressBar\.js"><\/script>/.test(read('index.html'))) test.check('index.html loads it');
  else test.fail(OWED + 'index.html does not load progressBar.js');

  // ── 2. the shared list's toggle filter ────────────────────────────────
  test.subHeading('2. the shared list: a multi filter is a row of toggles, every one on at the start');
  const make = win.spiritElements && win.spiritElements.shellCreateListSearch;
  const box = p.node('box');
  const ROWS = [{ key: 'a', state: 'red' }, { key: 'b', state: 'green' }, { key: 'c', state: 'green' }];
  let toggles = null;
  try {
    toggles = make(box, {
      rows: function () { return ROWS; },
      filters: [{ name: 'state', multi: true,
        choices: function (rows) { return rows.map(function (r) { return r.state; }).filter(function (s, i, a) { return a.indexOf(s) === i; }).sort().map(function (s) { return { value: s, word: s }; }); },
        test: function (row, off) { return off && off[row.state] ? 0 : 1; } }],
      paint: function (row) { return '<td>' + row.key + '</td>'; },
    });
  } catch (e) { test.fail(OWED + 'the list would not take a multi filter: ' + (e && e.message || e)); }
  const pre = Object.keys(p.byId).filter(function (k) { return /^listsearch-\d+-list$/.test(k); }).map(function (k) { return k.replace(/list$/, ''); }).pop() || '';
  const listed = function () { return ((p.byId[pre + 'list'] || {}).innerHTML || '').match(/data-key="[^"]*"/g) || []; };
  const strip = function () { return (p.byId[pre + 'filters'] || {}).innerHTML || ''; };
  if (toggles && /data-value="green"/.test(strip()) && /data-value="red"/.test(strip()) && listed().length === 3) test.check('one toggle per value the rows hold (green, red), every row shown');
  else test.fail(OWED + 'the strip is ' + short(strip()) + ', rows ' + short(listed()));
  box.fire('click', { target: target({ 'data-filter': 'state', 'data-value': 'green' }) });
  if (listed().join() === 'data-key="a"') test.check('pressing green turns it off: only the red row is left');
  else test.fail(OWED + 'after pressing green the rows are ' + short(listed()));
  box.fire('click', { target: target({ 'data-filter': 'state', 'data-value': 'red' }) });
  if (toggles && /data-value="red"/.test(strip()) && !listed().length) test.check('pressing red too turns it off as well: each toggle is its own, in or out');
  else test.fail(OWED + 'after pressing red the rows are ' + short(listed()));
  box.fire('click', { target: target({ 'data-filter': 'state', 'data-value': 'green' }) });
  if (listed().length === 2 && !listed().some(function (k) { return /"a"/.test(k); })) test.check('pressing green again turns it back on');
  else test.fail(OWED + 'after pressing green again the rows are ' + short(listed()));

  // ── 3. Jobs ───────────────────────────────────────────────────────────
  test.subHeading('3. Jobs: the shared list, its filters, its columns, its progress');
  const T = Date.parse('2026-10-18T10:00:00Z');
  const job = function (id, kind, type, status, at, more) { return Object.assign({ id: id, kind: kind, type: type, status: status, createdAt: T, updatedAt: T + at * 1000, log: [], data: {} }, more || {}); };
  const JOBS = new Map();
  [job('job_1', 'server', 'desk', 'running', 5, { module: 'process/js/desk' }),
    job('job_2', 'server', 'deskVerify', 'running', 9, { module: 'process/js/deskVerify' }),
    job('job_3', 'process', 'imageStats', 'completed', 2, { module: 'process/js/imageStats' }),
    job('job_4', 'process', 'wordpressScanner', 'running', 7, { module: 'process/js/wordpressScanner' }),
    job('job_10', 'permanent', 'server-stats', 'running', 11)].forEach(function (j) { JOBS.set(j.id, j); });
  const sp = { core: { util: { escapeHtml: kernel.core.util.escapeHtml }, const: { ICON: kernel.core.const.ICON }, jobs: {} },
    shell: { activateApp: function (x) { sp.app = x; }, factRow: function (rows) { return rows.map(function (r) { return '<div>' + r[0] + ': ' + r[1] + '</div>'; }).join(''); } } };
  const heard = [];
  const dialogs = [];
  const views = [];
  const api = { escapeHtml: kernel.core.util.escapeHtml, onJobs: function (fn) { heard.push(fn); return function () {}; },
    callDialog: function (id, params) { dialogs.push({ id: id, params: params }); return new Promise(function () {}); },
    setScreenTitle: function () {}, closeDialog: function () {},
    ui: { elements: Object.assign({}, win.spiritElements, { createTextView: function (c, o) {
      const v = { opts: o, texts: [String((o && o.text) || '')], cm: { setValue: function (t) { v.texts.push(String(t)); }, refresh: function () {} }, value: function () { return v.texts[v.texts.length - 1]; }, mark: function () { return 0; } };
      views.push(v);
      return v;
    } }) } };
  const jobsBox = p.node('jobs');
  try {
    new Function('spirit', 'document', 'window', read('shell/jobs/jobs.js'))(sp, p.doc, win);
    sp.app.mount(jobsBox, api);
  } catch (e) { test.fail(OWED + 'Jobs did not mount: ' + (e && e.stack || e)); }
  const hear = function (changed) { heard.slice().forEach(function (fn) { fn(JOBS, changed); }); };
  const publish = function (id, app) { const j = JOBS.get(id); j.app = app; j.updatedAt += 1; hear(j); };
  hear(null);
  try { if (sp.app && sp.app.render) sp.app.render(JOBS); } catch (e) { test.fail(OWED + 'Jobs did not render: ' + (e && e.message || e)); }
  const jpre = Object.keys(p.byId).filter(function (k) { return /^listsearch-\d+-list$/.test(k) && k !== pre + 'list'; }).map(function (k) { return k.replace(/list$/, ''); }).pop() || '';
  const jlist = function () { return (p.byId[jpre + 'list'] || {}).innerHTML || ''; };
  const order = function () { return (jlist().match(/data-key="(job_\d+)"/g) || []).map(function (s) { return s.slice(10, -1); }); };
  const jstrip = function () { return (p.byId[jpre + 'filters'] || {}).innerHTML || ''; };
  const redraw = function () { try { sp.app.render(JOBS); } catch (e) { /* said by the checks */ } };

  if (jpre && order().length === 5) test.check('the jobs stand on the shared list');
  else test.fail(OWED + 'no shared list in Jobs, or not every job on it: ' + short(order()));
  if (order().join() === 'job_1,job_2,job_3,job_4,job_10') test.check('with no words the rows are sorted by id, job_10 after job_4');
  else test.fail(OWED + 'with no words the order is ' + short(order()));
  if (/data-value="[^"]*"[^>]*>[^<]*all/i.test(jstrip()) && />[^<]*node</i.test(jstrip()) && /servers/i.test(jstrip()) && /transient/i.test(jstrip())) test.check('the kind filter offers all, node, servers, transient');
  else test.fail(OWED + 'the filters read ' + short(jstrip()));
  const kindValue = function (word) { const m = new RegExp('data-filter="([^"]+)" data-value="([^"]*)"[^>]*>[^<]*' + word, 'i').exec(jstrip()); return m ? { 'data-filter': m[1], 'data-value': m[2] } : null; };
  const servers = kindValue('servers');
  if (servers) jobsBox.fire('click', { target: target(servers) });
  if (order().join() === 'job_1,job_2') test.check('servers shows the two app servers only');
  else test.fail(OWED + 'servers shows ' + short(order()));
  const transient = kindValue('transient');
  if (transient) jobsBox.fire('click', { target: target(transient) });
  if (order().join() === 'job_3,job_4') test.check('transient shows the two processes only');
  else test.fail(OWED + 'transient shows ' + short(order()));
  const nodeKind = kindValue('node');
  if (nodeKind) jobsBox.fire('click', { target: target(nodeKind) });
  if (order().join() === 'job_10') test.check('node shows the node\'s own job, server-stats, alone');
  else test.fail(OWED + 'node shows ' + short(order()));
  const all = kindValue('all');
  if (all) jobsBox.fire('click', { target: target(all) });
  const completed = kindValue('completed');
  if (/running/.test(jstrip()) && completed) test.check('a toggle for each status the list holds: running, completed');
  else test.fail(OWED + 'no status toggles in ' + short(jstrip()));
  if (completed) jobsBox.fire('click', { target: target(completed) });
  if (order().indexOf('job_3') === -1 && order().length === 4) test.check('completed turned off leaves the completed job out');
  else test.fail(OWED + 'with completed off the rows are ' + short(order()));
  if (completed) jobsBox.fire('click', { target: target(completed) });

  const text = p.byId[jpre + 'text'];
  if (text) { text.value = 'wordpress'; jobsBox.fire('input', { target: { id: jpre + 'text' } }); }
  if (order()[0] === 'job_4' && /list-rank/.test(jlist()) && /<mark>/i.test(jlist())) test.check('words rank the rows: wordpress puts the wordpressScanner on top, its rank bar drawn, the word marked');
  else test.fail(OWED + 'wordpress gave ' + short(order()));
  if (text) { text.value = 'job_3'; jobsBox.fire('input', { target: { id: jpre + 'text' } }); }
  if (order()[0] === 'job_3') test.check('the id is matched too');
  else test.fail(OWED + 'job_3 gave ' + short(order()));
  if (text) { text.value = ''; jobsBox.fire('input', { target: { id: jpre + 'text' } }); }

  const head = (/<thead>[\s\S]*?<\/thead>/.exec(jlist()) || [''])[0];
  if (/Status[\s\S]*Name[\s\S]*Kind[\s\S]*Progress[\s\S]*Updated/.test(head)) test.check('the list has column headings: Status, Name, Kind, Progress, Updated');
  else test.fail(OWED + 'no column headings in the list: ' + short(head || jlist().slice(0, 200)));
  const rowOf = function (id) { return (new RegExp('<tr data-key="' + id + '"[\\s\\S]*?</tr>').exec(jlist()) || [''])[0]; };
  if (/deskVerify/.test(rowOf('job_2')) && /server/.test(rowOf('job_2')) && /running/.test(rowOf('job_2'))) test.check('a row shows its status, its name (the module) and its kind');
  else test.fail(OWED + 'job_2\'s row is ' + short(rowOf('job_2')));
  if (rowOf('job_2') && !/<progress/.test(rowOf('job_2'))) test.check('a server between jobs shows no bar');
  else test.fail(OWED + 'an idle server draws a bar: ' + short(rowOf('job_2')));
  publish('job_2', { job: { state: 'start', name: 'item goal/G1.2' } });
  publish('job_2', { job: { state: 'progress', name: 'item goal/G1.2', done: 2, total: 5, text: 'suite b' } });
  redraw();
  if (/<progress[^>]*max="5"/.test(rowOf('job_2')) && /value="2"/.test(rowOf('job_2')) && /suite b/.test(rowOf('job_2'))) test.check('its {job} events draw the shared bar in its row: 2 of 5, suite b');
  else test.fail(OWED + 'after start and progress job_2\'s row is ' + short(rowOf('job_2')));
  publish('job_2', { doing: 'item', id: 'goal/G1.2' });
  redraw();
  if (/value="2"/.test(rowOf('job_2'))) test.check('an app object of its own between them leaves the bar as it was');
  else test.fail(OWED + 'another publish took the bar away: ' + short(rowOf('job_2')));
  publish('job_2', { job: { state: 'end', name: 'item goal/G1.2', result: { outcome: 'passed' } } });
  redraw();
  if (rowOf('job_2') && !/<progress/.test(rowOf('job_2'))) test.check('its end takes the bar away: idle again');
  else test.fail(OWED + 'after end job_2\'s row is ' + short(rowOf('job_2')));
  publish('job_4', { job: { state: 'progress', name: '', done: 3, total: 10, text: 'page 3' } });
  redraw();
  if (/value="3"/.test(rowOf('job_4')) && /page 3/.test(rowOf('job_4'))) test.check('a transient process IS its job: its progress alone draws the bar');
  else test.fail(OWED + 'job_4\'s row is ' + short(rowOf('job_4')));
  if (order().join() === 'job_1,job_2,job_3,job_4,job_10') test.check('updates moved no row: the order is still by id');
  else test.fail(OWED + 'after updates the order is ' + short(order()));
  const dots = (jlist().match(/job-latest/g) || []).length;
  if (dots === 1 && /job-latest/.test(rowOf('job_4'))) test.check('one green dot, on job_4, the most recent update');
  else test.fail(OWED + 'dots: ' + dots + ', on job_4 ' + /job-latest/.test(rowOf('job_4')));
  const stats = JOBS.get('job_10');
  stats.data = { cpu: 1 };
  stats.updatedAt += 100;
  hear(stats);
  redraw();
  if ((jlist().match(/job-latest/g) || []).length === 1 && /job-latest/.test(rowOf('job_10'))) test.check('server-stats ticks: the dot hops to its row');
  else test.fail(OWED + 'after a server-stats tick the dot is not on job_10 alone');
  jobsBox.fire('click', { target: target({}, 'job_4') });
  if (dialogs.length && dialogs[dialogs.length - 1].id === 'shell/jobsDetails' && dialogs[dialogs.length - 1].params.id === 'job_4') test.check('a row still opens its job in Jobs Details');
  else test.fail(OWED + 'a press opened ' + short(dialogs));

  // ── 4. Jobs Details ───────────────────────────────────────────────────
  test.subHeading('4. Jobs Details: the last 256 events, one JSON line each; the clicked one in the Extract box');
  const dp = page();
  const dsp = { core: sp.core, shell: { activateApp: function (x) { dsp.app = x; }, factRow: sp.shell.factRow } };
  const dheard = [];
  const dapi = Object.assign({}, api, { onJobs: function (fn) { dheard.push(fn); return function () {}; } });
  const dbox = dp.node('details');
  try {
    new Function('spirit', 'document', 'window', read('shell/jobsDetails/jobsDetails.js'))(dsp, dp.doc, win);
    dsp.app.mount(dbox, dapi);
    dsp.app.open({ id: 'job_1' });
  } catch (e) { test.fail(OWED + 'Jobs Details did not mount: ' + (e && e.stack || e)); }
  const dhear = function (changed) { dheard.slice().forEach(function (fn) { fn(JOBS, changed); }); };
  const j1 = JOBS.get('job_1');
  j1.log = [{ timestamp: T, message: 'STDOUT-LINE-NEVER-SHOWN' }];
  for (let i = 0; i < 300; i++) { j1.app = { n: i, said: 'event ' + i }; j1.updatedAt += 1; dhear(j1); }
  j1.log.push({ timestamp: T, message: 'STDOUT-LINE-NEVER-SHOWN' });
  j1.updatedAt += 1;
  dhear(j1);
  const log = (dp.byId['jd-log'] || {}).innerHTML || '';
  const lines = log.match(/data-event="\d+"/g) || [];
  if (lines.length === 256) test.check('300 events heard, 256 lines kept: the window holds the last 256');
  else test.fail(OWED + 'the log holds ' + lines.length + ' lines: ' + short(log));
  if (/&quot;n&quot;:299|"n":299/.test(log) && /&quot;n&quot;:44,|"n":44,/.test(log) && !/&quot;n&quot;:43,|"n":43,/.test(log)) test.check('the newest is event 299, the oldest kept is 44: the first 44 fell off the top');
  else test.fail(OWED + 'the window is not the last 256 events');
  if (!/STDOUT-LINE-NEVER-SHOWN/.test(log + ((dp.byId['jd-body'] || {}).innerHTML || ''))) test.check('never stdout: a log line adds nothing, and no log line is shown');
  else test.fail(OWED + 'the job\'s log still shows');
  if (/\{&quot;n&quot;:299,&quot;said&quot;:&quot;event 299&quot;\}|\{"n":299,"said":"event 299"\}/.test(log)) test.check('each event is one JSON line, as JSON.stringify writes it');
  else test.fail(OWED + 'event 299 is not drawn as one JSON line');
  const logStyle = JSON.stringify((dp.byId['jd-log'] || {}).style) + ' ' + read('shell/jobsDetails/jobsDetails.js');
  if (/jd-log[^>]*33vh|33vh[\s\S]{0,200}jd-log|jd-log[\s\S]{0,300}33vh/.test(logStyle) && /jd-extract[\s\S]{0,300}33vh|33vh[\s\S]{0,200}jd-extract/.test(logStyle)) test.check('the log and the Extract box each take a third of the page height');
  else test.fail(OWED + 'jd-log and jd-extract are not a third of the page height each');
  // The line that holds event 250, read inside that one line (its text, never the next line's).
  const at = (/data-event="(\d+)"[^>]*>[^<]*?(?:&quot;n&quot;:250|"n":250)/.exec(log) || [])[1];
  const logEl = dp.byId['jd-log'];
  if (logEl) logEl.fire('click', { target: target({ 'data-event': at == null ? '' : at }) });
  dbox.fire('click', { target: target({ 'data-event': at == null ? '' : at }) });
  const pretty = JSON.stringify({ n: 250, said: 'event 250' }, null, 2);
  const view = views[views.length - 1];
  if (view && view.opts && view.opts.readOnly === true && view.value() === pretty) test.check('a click on event 250 shows it in the Extract box, JSON.stringify(object, null, 2), read-only CodeMirror');
  else test.fail(OWED + 'the Extract box shows ' + short(view ? { readOnly: view.opts && view.opts.readOnly, text: view.value() } : 'no text view'));
  const watcher = job('job_9', 'permanent', 'fs-watcher', 'running', 1);
  JOBS.set('job_9', watcher);
  dsp.app.open({ id: 'job_9' });
  watcher.data = { command: { op: 'createFile', path: 'shell/x.js', at: 'T1' } };
  dhear(watcher);
  if (/createFile/.test((dp.byId['jd-log'] || {}).innerHTML || '') && /shell\/x\.js/.test((dp.byId['jd-log'] || {}).innerHTML || '')) test.check('fs-watcher\'s events are its tree commands: an agent\'s file changes');
  else test.fail(OWED + 'the watcher\'s command is not in the log: ' + short((dp.byId['jd-log'] || {}).innerHTML));
  // The node's own jobs report through their data (box v10): server-stats every tick, relay-presence on a change.
  const ticks = job('job_11', 'permanent', 'server-stats', 'running', 1);
  JOBS.set('job_11', ticks);
  dsp.app.open({ id: 'job_11' });
  [{ cpu: 0.1, rss: 10 }, { cpu: 0.2, rss: 10 }, { cpu: 0.2, rss: 10 }, { cpu: 0.3, rss: 11 }].forEach(function (d) { ticks.data = d; ticks.updatedAt += 1; dhear(ticks); });
  const statsLog = (dp.byId['jd-log'] || {}).innerHTML || '';
  if ((statsLog.match(/data-event="/g) || []).length === 3 && /0\.3/.test(statsLog)) test.check('server-stats\' data is its event: three ticks that changed it, three lines (the repeat adds none)');
  else test.fail(OWED + 'server-stats\' log holds ' + short(statsLog));
  const presence = job('job_12', 'permanent', 'relay-presence', 'running', 1, { data: { presence: {} } });
  JOBS.set('job_12', presence);
  dsp.app.open({ id: 'job_12' });
  presence.data = { presence: { 'wss://relay.example': { state: 'connected' } } };
  presence.updatedAt += 1;
  dhear(presence);
  if (/relay\.example/.test((dp.byId['jd-log'] || {}).innerHTML || '')) test.check('relay-presence\'s data is its event too');
  else test.fail(OWED + 'relay-presence\'s change is not in the log');
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
