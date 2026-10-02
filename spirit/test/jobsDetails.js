'use strict';

// goal/G2.11: the Job Monitor keeps rows only; a job's console and its actions live in a jobsDetails dialog; the
// start form is gone. Red on today's tree.
//   RULING (Andy, 2026-10-02, verbatim, under goal/G2): "next. the job monitor shell component. the folded
//   \"consoles\" need to go into jobsDetails", "the form on top should be gone."
//   In the tree: shell/jobs/jobs.js draws a start-job form at the top (id start-job-form, jobs.js:157) and folds
//   each job's log under its row (job-log-row / job-log-panel, jobs.js:77), with Cancel and Delete in the row;
//   there is no shell/jobsDetails.
// The contract the builder follows (the shape in goal/G2.11's box; the arguable parts fixed here by name):
//   1. THE LIST. shell/jobs/jobs.js mounts no form at all (no start-job-form, no input) and draws one row per job
//      (data-job-row="<id>", as today) and nothing under it: no job-log-row, no job-log-panel, no Cancel or Delete
//      in a row. A click on a row asks the shell for the dialog — api.callDialog('shell/jobsDetails', {id}) — and
//      that is all it does: the list launches nothing and folds nothing.
//   2. THE DIALOG, in the pattern of shell/contactsDetails. shell/jobsDetails/jobsDetails.json says type "dialog",
//      hidden, intrinsic, owner system. jobsDetails.js is mounted once and opened per job: mount(container, api),
//      then open({id}) on every call. It takes its live jobs through api.onJobs — the shell's opt-in for a dialog
//      that wants live data (shell.js, api.onJobs: fn(jobsById, changed, context)) — never a second stream.
//   3. THE CONSOLE. It shows the job it was opened with and no other: its status, its kind and type, every log
//      line (escaped), and its data. A later job event repaints it without a reopen; opening it for another job
//      shows that job and nothing of the first.
//   4. THE ACTIONS, the rule unchanged and only moved (Andy: "would allow cancel for servers - user but not for
//      servers - node"): Cancel (id jd-cancel) for a running process and for a user-operated server; Delete (id
//      jd-delete) once the job is terminal; neither for a node-operated server that is running. Cancel calls
//      spirit.core.jobs.cancel(id); Delete calls spirit.core.jobs.delete(id) and, when it succeeds, closes the
//      dialog (api.closeDialog) — there is nobody left to show.
//   5. A dialog launches nothing (the stub throws, as the shell does).
// Not asserted, the builder's: the sticky scroll of the console, the screen title, the wording of the labels, and
// registering the folder with the shell's intrinsic apps.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const spirit = require('../run/js/kernel.js');

const OWED = 'OWED by goal/G2.11: ';
const RUN_DIR = path.join(__dirname, '..', 'run');
const LIST_SCRIPT = path.join(RUN_DIR, 'shell', 'jobs', 'jobs.js');
const DIALOG_SCRIPT = path.join(RUN_DIR, 'shell', 'jobsDetails', 'jobsDetails.js');
const DIALOG_MANIFEST = path.join(RUN_DIR, 'shell', 'jobsDetails', 'jobsDetails.json');

function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 8; i++) await settle(); }

// A document that hands out an element for any id asked, each with its own markup and listeners.
function fakeDocument() {
  const byId = {};
  function fakeElement(id) {
    let html = '';
    const el = { id: id, value: '', textContent: '', style: {}, dataset: {}, children: [], listeners: {}, hidden: false,
      scrollTop: 0, scrollHeight: 0, clientHeight: 0,
      addEventListener: function (ev, fn) { (el.listeners[ev] = el.listeners[ev] || []).push(fn); },
      appendChild: function (c) { el.children.push(c); return c; },
      querySelector: function () { return null; }, querySelectorAll: function () { return []; },
      reset: function () {}, focus: function () {} };
    Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
    return el;
  }
  const doc = { byId: byId, activeElement: null, createElement: fakeElement,
    getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); },
    querySelector: function () { return null; } };
  return { doc: doc, fakeElement: fakeElement };
}
// Everything painted, wherever the app chose to paint it.
function allHtml(d, container) {
  return container.innerHTML + Object.keys(d.doc.byId).map(function (id) { return d.doc.byId[id].innerHTML; }).join('');
}
// A click, delivered to every click listener the app bound — delegated or direct, it is the app's choice.
function click(d, container, target) {
  const event = { target: target, preventDefault: function () {}, stopPropagation: function () {} };
  [container].concat(Object.keys(d.doc.byId).map(function (id) { return d.doc.byId[id]; })).forEach(function (el) {
    (el.listeners.click || []).forEach(function (fn) { fn(event); });
  });
}
function button(id) { return { id: id, dataset: {}, closest: function () { return null; } }; }
function rowOf(jobId) {
  return { id: '', dataset: {}, closest: function (sel) { return sel === '[data-job-row]' ? { dataset: { jobRow: jobId } } : null; } };
}

function job(id, over) {
  return Object.assign({ id: id, kind: 'process', type: 'counter', status: 'running', createdAt: 1790000000000, updatedAt: 1790000001000,
    data: { pid: 4242 }, log: [{ timestamp: 1790000000500, message: 'first line of ' + id }] }, over || {});
}
function jobsMap(list) { const m = new Map(); list.forEach(function (j) { m.set(j.id, j); }); return m; }

// Either app, loaded as the shell loads it: the real script, a stub spirit, a stub document.
function load(script, d, calls) {
  let behavior = null;
  const shellSpirit = {
    shell: { activateApp: function (b) { behavior = b; }, fileInfoRow: function (l, v) { return '<div>' + l + v + '</div>'; }, factRow: function (l, v) { return '<div>' + l + v + '</div>'; } },
    core: {
      const: { ICON: spirit.core.const.ICON },
      util: { escapeHtml: spirit.core.util.escapeHtml, formatBytes: spirit.core.util.formatBytes },
      jobs: {
        start: function (o) { calls.started.push(o); return Promise.resolve({}); },
        cancel: function (id) { calls.cancelled.push(id); return Promise.resolve({}); },
        delete: function (id) { calls.deleted.push(id); return Promise.resolve({}); },
        subscribe: function () { calls.streams += 1; return function () {}; },
      },
    },
  };
  new Function('spirit', 'document', 'window', 'console', fs.readFileSync(script, 'utf8'))(shellSpirit, d.doc, {}, { error: function () {}, log: function () {} });
  return behavior;
}
function newCalls() { return { started: [], cancelled: [], deleted: [], streams: 0, dialogs: [], closed: [], launched: [], feeds: [] }; }
function apiFor(calls) {
  return {
    callDialog: function (id, params) { calls.dialogs.push({ id: id, params: params }); return Promise.resolve(null); },
    closeDialog: function (r) { calls.closed.push(r || null); },
    setDialogResult: function () {}, setScreenTitle: function () {}, setScreenMark: function () {}, armUntilElsewhere: function () {},
    escapeHtml: spirit.core.util.escapeHtml,
    onJobs: function (fn) { calls.feeds.push(fn); return function () {}; },
    // The shell throws when a dialog launches; the list has no reason to launch either.
    launchApp: function (target) { calls.launched.push(target); throw new Error('launched ' + target); },
  };
}

test.startTest('goal/G2.11: Job Monitor rows only, the console in a jobsDetails dialog, no start form');

(async function () {
  test.subHeading('1. the list: no form, rows only, a click opens the dialog');
  {
    const d = fakeDocument();
    const calls = newCalls();
    const container = d.fakeElement('container');
    let tripped = null;
    try {
      const list = load(LIST_SCRIPT, d, calls);
      list.mount(container, apiFor(calls));
      list.render(jobsMap([job('job_7'), job('job_8', { status: 'completed' })]));
      await settled();
    } catch (e) { tripped = e; }
    if (tripped) test.fail(OWED + 'the list tripped: ' + (tripped.stack || tripped));
    const html = allHtml(d, container);
    if (html.indexOf('start-job-form') === -1 && html.indexOf('<form') === -1 && html.indexOf('<input') === -1) test.check('no start form: the list mounts no form and no input');
    else test.fail(OWED + 'the list still mounts a form or an input');
    const rows = (html.match(/data-job-row="/g) || []).length;
    if (rows === 2) test.check('one row per job');
    else test.fail('rows drawn: ' + rows + ' of 2');
    if (html.indexOf('data-job-id=') === -1 && html.indexOf('data-delete-job-id=') === -1 && !/>\s*(Cancel|Delete)\s*</.test(html)) test.check('no Cancel or Delete in a row: the actions live in the dialog');
    else test.fail(OWED + 'a row still carries Cancel or Delete');
    click(d, container, rowOf('job_7'));
    await settled();
    const after = allHtml(d, container);
    if (after.indexOf('job-log-row') === -1 && after.indexOf('job-log-panel') === -1 && after.indexOf('first line of job_7') === -1) test.check('a click folds nothing open: no console under a row');
    else test.fail(OWED + 'the list still unfolds a console under the row');
    const asked = calls.dialogs;
    if (asked.length === 1 && asked[0].id === 'shell/jobsDetails' && asked[0].params && asked[0].params.id === 'job_7') test.check('the click asks the shell for the dialog: callDialog(shell/jobsDetails, {id: job_7}), once');
    else test.fail(OWED + 'dialogs asked for after a row click: ' + JSON.stringify(asked));
    if (calls.launched.length === 0 && calls.started.length === 0) test.check('and the list launches nothing and starts nothing');
    else test.fail(OWED + 'launched ' + JSON.stringify(calls.launched) + ', started ' + JSON.stringify(calls.started));
  }

  test.subHeading('2. the dialog exists and says what it is');
  let manifest = null;
  try { manifest = JSON.parse(fs.readFileSync(DIALOG_MANIFEST, 'utf8')); } catch (e) { manifest = null; }
  if (manifest && manifest.type === 'dialog' && manifest.hidden === true && manifest.intrinsic === true && manifest.owner === 'system') test.check('shell/jobsDetails/jobsDetails.json: a hidden, intrinsic, system-owned dialog');
  else test.fail(OWED + 'jobsDetails.json reads ' + JSON.stringify(manifest));
  if (!fs.existsSync(DIALOG_SCRIPT)) {
    test.fail(OWED + 'there is no shell/jobsDetails/jobsDetails.js — the console, the live repaint and the actions are all owed with it');
    return;
  }

  const d = fakeDocument();
  const calls = newCalls();
  const container = d.fakeElement('container');
  const dialog = load(DIALOG_SCRIPT, d, calls);
  const api = apiFor(calls);
  let jobs = jobsMap([
    job('job_7', { data: { pid: 4242, note: 'seven-data' }, log: [{ timestamp: 1, message: 'seven one' }, { timestamp: 2, message: 'seven <b>two</b>' }] }),
    job('job_8', { status: 'completed', log: [{ timestamp: 3, message: 'eight only' }] }),
    job('job_9', { kind: 'server', type: 'desk', data: { operated: 'node' }, log: [] }),
    job('job_10', { kind: 'server', type: 'face', data: { operated: 'user' }, log: [] }),
  ]);
  function feed(changed) { calls.feeds.forEach(function (fn) { fn(jobs, changed || null, { visible: true }); }); }
  dialog.mount(container, api);
  if (typeof dialog.open !== 'function') { test.fail(OWED + 'the dialog has no open(params): it is mounted once and opened per job'); return; }

  test.subHeading('3. the console: the one job, its log and its data, live');
  dialog.open({ id: 'job_7' });
  feed();
  await settled();
  let html = allHtml(d, container);
  if (calls.feeds.length === 1 && calls.streams === 0) test.check('live jobs come through api.onJobs, asked once — no second stream');
  else test.fail(OWED + 'onJobs subscriptions ' + calls.feeds.length + ', own streams ' + calls.streams);
  if (html.indexOf('seven one') !== -1 && html.indexOf('seven &lt;b&gt;two&lt;/b&gt;') !== -1 && html.indexOf('<b>two</b>') === -1) test.check('every log line of the job, escaped');
  else test.fail(OWED + 'the console of job_7 does not show its log, escaped');
  if (html.indexOf('seven-data') !== -1 && html.indexOf('running') !== -1 && html.indexOf('counter') !== -1) test.check('its data, its status and its type');
  else test.fail(OWED + 'the dialog does not show job_7\'s data, status and type');
  if (html.indexOf('eight only') === -1) test.check('and nothing of any other job');
  else test.fail(OWED + 'another job\'s log is on the screen');
  const seven = jobs.get('job_7');
  jobs.set('job_7', Object.assign({}, seven, { log: seven.log.concat([{ timestamp: 4, message: 'seven three, live' }]) }));
  feed(jobs.get('job_7'));
  await settled();
  html = allHtml(d, container);
  if (html.indexOf('seven three, live') !== -1) test.check('a later job event repaints the console without a reopen');
  else test.fail(OWED + 'a new log line did not reach the open dialog');

  test.subHeading('4. the actions, moved and unchanged');
  const hasCancel = function (h) { return h.indexOf('id="jd-cancel"') !== -1; };
  const hasDelete = function (h) { return h.indexOf('id="jd-delete"') !== -1; };
  if (hasCancel(html) && !hasDelete(html)) test.check('a running process offers Cancel and no Delete');
  else test.fail(OWED + 'job_7 (running process): cancel ' + hasCancel(html) + ', delete ' + hasDelete(html));
  click(d, container, button('jd-cancel'));
  await settled();
  if (calls.cancelled.length === 1 && calls.cancelled[0] === 'job_7' && calls.closed.length === 0) test.check('Cancel cancels that job, and the dialog stays to show it stop');
  else test.fail(OWED + 'after Cancel: cancelled ' + JSON.stringify(calls.cancelled) + ', closed ' + calls.closed.length);

  dialog.open({ id: 'job_9' });
  feed();
  await settled();
  html = allHtml(d, container);
  if (!hasCancel(html) && !hasDelete(html)) test.check('a node-operated server that is running offers neither');
  else test.fail(OWED + 'job_9 (server, node): cancel ' + hasCancel(html) + ', delete ' + hasDelete(html));
  dialog.open({ id: 'job_10' });
  feed();
  await settled();
  html = allHtml(d, container);
  if (hasCancel(html) && !hasDelete(html)) test.check('a user-operated server offers Cancel');
  else test.fail(OWED + 'job_10 (server, user): cancel ' + hasCancel(html) + ', delete ' + hasDelete(html));

  dialog.open({ id: 'job_8' });
  feed();
  await settled();
  html = allHtml(d, container);
  if (html.indexOf('eight only') !== -1 && html.indexOf('seven one') === -1) test.check('opened for another job it shows that job and nothing of the first');
  else test.fail(OWED + 'after reopening for job_8 the screen is not job_8\'s alone');
  if (hasDelete(html) && !hasCancel(html)) test.check('a terminal job offers Delete and no Cancel');
  else test.fail(OWED + 'job_8 (completed): cancel ' + hasCancel(html) + ', delete ' + hasDelete(html));
  click(d, container, button('jd-delete'));
  await settled();
  if (calls.deleted.length === 1 && calls.deleted[0] === 'job_8' && calls.closed.length === 1) test.check('Delete deletes that job and closes the dialog — nobody is left to show');
  else test.fail(OWED + 'after Delete: deleted ' + JSON.stringify(calls.deleted) + ', closed ' + calls.closed.length);

  test.subHeading('5. a dialog launches nothing');
  if (calls.launched.length === 0 && calls.started.length === 0 && calls.dialogs.length === 0) test.check('nothing launched, nothing started, no dialog opened from the dialog');
  else test.fail(OWED + 'launched ' + JSON.stringify(calls.launched) + ', started ' + calls.started.length + ', dialogs ' + calls.dialogs.length);
})().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  // The list's render throttle holds a one-second timer; the checks are done, so the suite does not wait for it.
  setTimeout(function () { process.exit(process.exitCode || 0); }, 50);
});
