'use strict';

// goal/G2.16: the fs-watcher's console shows the file events from the live stream. Red on today's tree.
//   RULING (Andy, 2026-10-02, verbatim, under goal/G2.11): "the only part that interests me is the data part. jobs
//   don't need to write logs, logs should be consumed by an outside reader, if i want that. the watcher only needs
//   to stream data", then "let's just make the consoles display the usefull data, the data in the live stream,
//   we'll do it one item per job. let's make an item for fs-watcher."
//   In the tree: fs-watcher sends, on each change it settles (jobs.js:183), a job-updated whose data is the whole
//   file list plus lastEvent {eventType, filename}; it never writes a log line, so jobsDetails' console (which draws
//   job.log) shows only "job created" while the Files app, reading data.files, moves.
// The contract the builder follows (the shape in goal/G2.16's box; the arguable parts fixed here by name):
//   1. NOTHING IN THE NODE CHANGES. The page does the work: jobsDetails, opened on the fs-watcher job, draws one
//      console line per job event that carries a new data.lastEvent — the time (the job's updatedAt), the event
//      (eventType) and the path (filename) — in arrival order, newest last.
//   2. A repeated event is not a line: an update carrying the same lastEvent and the same updatedAt adds nothing.
//   3. THE WINDOW IS ON THE PAGE, 1,000 LINES. Older lines fall off the top; nothing asks the node for history.
//      The window is kept for the page's life, so closing the dialog and opening it again on the same job shows
//      the lines heard meanwhile.
//   4. Escaped: a path is shown as text, never as markup.
//   5. Other jobs keep their console as today (a process job's printed lines still show).
// Not asserted, the builder's: the exact time format, the line's wording, sticky scroll.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const spirit = require('../run/js/kernel.js');

const OWED = 'OWED by goal/G2.16: ';
const DIALOG_SCRIPT = path.join(__dirname, '..', 'run', 'shell', 'jobsDetails', 'jobsDetails.js');

function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 6; i++) await settle(); }

function fakeDocument() {
  const byId = {};
  function fakeElement(id) {
    let html = '';
    const el = { id: id, value: '', textContent: '', style: {}, dataset: {}, children: [], listeners: {}, hidden: false,
      scrollTop: 0, scrollHeight: 0, clientHeight: 0,
      addEventListener: function (ev, fn) { (el.listeners[ev] = el.listeners[ev] || []).push(fn); },
      appendChild: function (c) { el.children.push(c); return c; },
      querySelector: function () { return null; }, querySelectorAll: function () { return []; } };
    Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
    return el;
  }
  return { byId: byId, fakeElement: fakeElement, doc: { byId: byId, createElement: fakeElement,
    getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); }, querySelector: function () { return null; } } };
}
function allHtml(d, container) {
  return container.innerHTML + Object.keys(d.byId).map(function (id) { return d.byId[id].innerHTML; }).join('');
}

function mountDialog() {
  const d = fakeDocument();
  const feeds = [];
  let behavior = null;
  const shellSpirit = {
    shell: { activateApp: function (b) { behavior = b; }, factRow: function (pairs) { return '<div class="fact-row">' + (pairs || []).map(function (p) { return '<span>' + spirit.core.util.escapeHtml(String(p[0])) + ' ' + spirit.core.util.escapeHtml(String(p[1])) + '</span>'; }).join('') + '</div>'; } },
    core: { const: { ICON: spirit.core.const.ICON }, util: { escapeHtml: spirit.core.util.escapeHtml },
      jobs: { cancel: function () { return Promise.resolve({}); }, delete: function () { return Promise.resolve({}); }, subscribe: function () { return function () {}; } } },
  };
  new Function('spirit', 'document', 'window', 'console', fs.readFileSync(DIALOG_SCRIPT, 'utf8'))(shellSpirit, d.doc, {}, { error: function () {}, log: function () {} });
  const api = {
    onJobs: function (fn) { feeds.push(fn); return function () {}; },
    closeDialog: function () {}, setScreenTitle: function () {}, setScreenMark: function () {}, armUntilElsewhere: function () {},
    callDialog: function () { return Promise.resolve(null); }, escapeHtml: spirit.core.util.escapeHtml,
    launchApp: function (t) { throw new Error('launched ' + t); },
  };
  const container = d.fakeElement('container');
  behavior.mount(container, api);
  const jobs = new Map();
  return {
    open: function (id) { behavior.open({ id: id }); },
    put: function (job) { jobs.set(job.id, job); feeds.forEach(function (fn) { fn(jobs, job, { visible: true }); }); },
    html: function () { return allHtml(d, container); },
  };
}

// SINCE goal/G4.25 a change arrives as one tree command {op, path, at} and no file list; the console draws its time
// (at), its op and its path. Each event below is written as that command; the checks are unchanged.
function watcher(updatedAt, lastEvent, extra) {
  return Object.assign({ id: 'job_fs', kind: 'permanent', type: 'fs-watcher', status: 'running', createdAt: 1790000000000,
    updatedAt: updatedAt, log: [{ timestamp: 1790000000000, message: 'job created' }],
    data: lastEvent ? { command: { op: lastEvent.eventType, path: lastEvent.filename, at: updatedAt } } : {} }, extra || {});
}
// How many times a path is drawn: a line per event, the path in each.
function count(html, needle) { return html.split(needle).length - 1; }

test.startTest('goal/G2.16: the fs-watcher console shows the file events from the live stream');

(async function () {
  const page = mountDialog();
  page.put(watcher(1790000001000, null));
  page.open('job_fs');
  await settled();

  test.subHeading('1. one line per event from the stream: time, event, path, newest last');
  page.put(watcher(1790000002000, { eventType: 'change', filename: 'shell/jobs/jobs.js' }));
  page.put(watcher(1790000003000, { eventType: 'rename', filename: 'shell/new/thing.js' }));
  await settled();
  let html = page.html();
  const first = html.indexOf('shell/jobs/jobs.js');
  const second = html.indexOf('shell/new/thing.js');
  if (first !== -1 && second !== -1 && first < second) test.check('both paths are on the console, in arrival order');
  else test.fail(OWED + 'the console does not show the streamed paths in order (first ' + first + ', second ' + second + ')');
  const lineOf = function (h, p) { const i = h.indexOf(p); return i === -1 ? '' : h.slice(Math.max(0, h.lastIndexOf('<div', i)), h.indexOf('</div>', i)); };
  const l1 = lineOf(html, 'shell/jobs/jobs.js');
  if (/change/.test(l1) && new RegExp(new Date(1790000002000).toLocaleTimeString().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(l1)) test.check('a line carries the event and the time it was streamed');
  else test.fail(OWED + 'the line for shell/jobs/jobs.js lacks its event or its time: ' + JSON.stringify(l1));

  test.subHeading('2. a repeated event is not a line');
  page.put(watcher(1790000003000, { eventType: 'rename', filename: 'shell/new/thing.js' }));
  await settled();
  html = page.html();
  if (count(html, 'shell/new/thing.js') === 1) test.check('the same event at the same moment, sent again, adds nothing');
  else test.fail(OWED + 'shell/new/thing.js drawn ' + count(html, 'shell/new/thing.js') + ' times after a repeat');

  test.subHeading('3. the window lives on the page, 1,000 lines, kept across a reopen');
  for (let i = 0; i < 1005; i++) page.put(watcher(1790000010000 + i, { eventType: 'change', filename: 'f/' + i + '.txt' }));
  await settled();
  html = page.html();
  const kept = (html.match(/f\/\d+\.txt/g) || []).length;
  if (html.indexOf('f/1004.txt') !== -1 && html.indexOf('f/5.txt') !== -1 && html.indexOf('f/4.txt<') === -1 && html.indexOf('shell/jobs/jobs.js') === -1 && kept === 1000) {
    test.check('after 1,005 more events the newest 1,000 stand, the oldest fell off the top');
  } else test.fail(OWED + 'window after 1,005 events: lines with f/N.txt ' + kept + ', newest there ' + (html.indexOf('f/1004.txt') !== -1) + ', first event gone ' + (html.indexOf('shell/jobs/jobs.js') === -1));
  page.open('job_other');
  page.put(watcher(1790000020000, { eventType: 'change', filename: 'meanwhile.txt' }));
  page.open('job_fs');
  await settled();
  html = page.html();
  if (html.indexOf('meanwhile.txt') !== -1 && html.indexOf('f/1004.txt') !== -1) test.check('closed and opened again, the console still holds what was heard, including meanwhile');
  else test.fail(OWED + 'after a reopen: meanwhile ' + (html.indexOf('meanwhile.txt') !== -1) + ', earlier lines ' + (html.indexOf('f/1004.txt') !== -1));

  test.subHeading('4. a path is text, never markup');
  page.put(watcher(1790000030000, { eventType: 'change', filename: '<b>bold</b>.txt' }));
  await settled();
  html = page.html();
  if (html.indexOf('&lt;b&gt;bold&lt;/b&gt;.txt') !== -1 && html.indexOf('<b>bold</b>') === -1) test.check('escaped');
  else test.fail(OWED + 'the markup path is not shown escaped');

  test.subHeading('5. other jobs keep their console');
  page.put({ id: 'job_p', kind: 'process', type: 'counter', status: 'running', createdAt: 1, updatedAt: 2, data: { pid: 9 },
    log: [{ timestamp: 1790000040000, message: 'printed by the process' }] });
  page.open('job_p');
  await settled();
  html = page.html();
  if (html.indexOf('printed by the process') !== -1 && html.indexOf('meanwhile.txt') === -1) test.check('a process job still shows what it printed, and none of the watcher\'s lines');
  else test.fail(OWED + 'process console: its line ' + (html.indexOf('printed by the process') !== -1) + ', watcher lines leaking ' + (html.indexOf('meanwhile.txt') !== -1));
})().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
});
