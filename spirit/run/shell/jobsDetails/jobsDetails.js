// One job of the Job Monitor, as its own screen (goal/G2.11).
//
//   Andy, 2026-10-02: "the job monitor shell component. the folded
//   "consoles" need to go into jobsDetails", "the form on top should be gone."
//
// A dialog in the pattern of contactsDetails: hidden, pushed by the Jobs
// table for one row, showing that job and nothing else, launching nothing,
// and the only way out is back to the table.
//
// NO DATA BOX. Andy: "get rid of that box. it's the (relatively) static portion of the fs data."
//
// A LIVE MONITOR OF WHAT THE JOB PUBLISHES, NEVER ITS STDOUT (goal/G29.14). The item's box: "A real-time monitor of a
// capturable event stream, never stdout: an agent's file changes through fs-watcher, and what each server publishes.
// It shows what could be logged; nothing is logged or kept." The window holds the last 256 events the shell receives;
// the node does no more work. The dialog fills the page and the page itself does not scroll: the header, the rolling
// event log (a third of the height, one JSON line per event), and the Extract/analyze box (a third of the height: the
// last event clicked, JSON.stringify(object, null, 2), in a read-only CodeMirror text view). The log and the Extract
// box scroll inside themselves.
//
// LIVE THROUGH THE SHELL, NOT A STREAM OF ITS OWN. A dialog is never driven by the job tick (switchTo, renderActive),
// so this asks the shell for the jobs with api.onJobs, once at mount, kept for the pane's life: the shell mounts a
// dialog once and opens it per subject. Every job's events are heard whatever is on screen, so a reopen shows what
// came meanwhile.

var jdEscapeHtml = spirit.core.util.escapeHtml;
var jdIcon = spirit.core.const.ICON;
var jdApi = null;

var jdId = '';          // which job this screen is about
var jdJobs = null;      // the shell's live Map, as api.onJobs last handed it over
var jdView = null;      // the Extract box's read-only text view

// The canonical set lives in js/jobs.js, node-side; shell/jobs/jobs.js and app/stats keep the same copy.
var JD_TERMINAL = ['completed', 'failed', 'cancelled', 'stopped'];

var JD_STATUS_ICON = {
  pending: jdIcon.LOADING,
  running: jdIcon.RUN,
  completed: jdIcon.OK,
  failed: jdIcon.ERROR,
  cancelled: jdIcon.STOP,
  stopped: jdIcon.STOP,
  error: jdIcon.WARNING,
};

function jdJob() {
  return (jdJobs && jdId && jdJobs.get(jdId)) || null;
}

// ── THE EVENTS, THE LAST 256 PER JOB (goal/G29.14) ─────────────────────
//
// An event is what a job publishes: its `app` object, when it differs from the one heard before (a job-updated for a
// log line carries the same object again, and is no event). For fs-watcher it is the tree command each change carries
// (goal/G4.25), {op, path, at}. Kept here, in the page, oldest falling off the top; nothing is asked of the node.
var JD_WINDOW = 256;
var jdEvents = Object.create(null);    // job id -> [{at, json}]
var jdLast = Object.create(null);      // job id -> the json heard last

function jdHear(job) {
  if (!job) return;
  var obj = job.type === 'fs-watcher' ? (job.data && job.data.command) : job.app;
  if (!obj || typeof obj !== 'object') return;
  var json = '';
  try { json = JSON.stringify(obj); } catch (e) { return; }
  if (jdLast[job.id] === json) return;
  jdLast[job.id] = json;
  var lines = jdEvents[job.id] || (jdEvents[job.id] = []);
  lines.push({ at: job.updatedAt || Date.now(), json: json });
  if (lines.length > JD_WINDOW) lines.splice(0, lines.length - JD_WINDOW);
}

function jdLogHtml(job) {
  var lines = jdEvents[job.id] || [];
  if (!lines.length) return '<div class="job-log-empty">(no events heard yet)</div>';
  return lines.map(function (l, i) {
    return '<div class="job-log-entry" data-event="' + i + '" title="' + jdEscapeHtml(new Date(l.at).toLocaleTimeString()) +
      '" style="cursor:pointer;white-space:nowrap">' + jdEscapeHtml(l.json) + '</div>';
  }).join('');
}

// The rule the row had, moved and unchanged: Cancel for a one-shot process
// and for a user-operated server, never for a node-operated one, which
// lives and dies with the node (Andy: "would allow cancel for servers -
// user but not for servers - node"); Delete once the job is terminal.
function jdButtonsHtml(job) {
  var isTerminal = JD_TERMINAL.indexOf(job.status) !== -1;
  var canCancel = !isTerminal && (job.kind === 'process' ||
    (job.kind === 'server' && job.data && job.data.operated === 'user'));
  if (canCancel) return '<button type="button" class="cancel-btn" id="jd-cancel">Cancel</button>';
  if (isTerminal) return '<button type="button" class="cancel-btn" id="jd-delete">Delete</button>';
  return '';
}

function jdTitle(job) {
  if (!job) return 'Job';
  return (JD_STATUS_ICON[job.status] || '') + ' ' + (job.type || job.kind || job.id);
}

function jdRender() {
  var head = document.getElementById('jd-head');
  var log = document.getElementById('jd-log');
  if (!head || !log) return;
  var job = jdJob();
  if (jdApi && jdApi.setScreenTitle) jdApi.setScreenTitle(jdTitle(job));

  if (!job) {
    // Deleted or never there: say so rather than drawing a log that looks like a job with nothing to say yet.
    head.innerHTML = '<div class="job-log-empty">That job is no longer listed.</div>';
    log.innerHTML = '';
    return;
  }

  head.innerHTML = spirit.shell.factRow([
    ['Status', (JD_STATUS_ICON[job.status] || '') + ' ' + String(job.status || '')],
    ['Id', String(job.id)],
    ['Kind / Type', String(job.kind || '') + ' / ' + String(job.type || '') + (job.module ? ' (' + job.module + ')' : '')],
    ['Updated', job.updatedAt ? new Date(job.updatedAt).toLocaleTimeString() : ''],
  ]) + '<div class="start-job-form card">' + jdButtonsHtml(job) + '</div>';

  // Sticky scroll: rebuilding the log resets its scroll, so a log that was at the bottom is pinned back there and one
  // scrolled up to read keeps its place.
  var distanceFromBottom = log.scrollHeight - log.scrollTop - log.clientHeight;
  var stickToBottom = distanceFromBottom < 20;
  var previousScrollTop = log.scrollTop;
  log.innerHTML = jdLogHtml(job);
  log.scrollTop = stickToBottom ? log.scrollHeight : previousScrollTop;
}

// THE EXTRACT/ANALYZE BOX: the clicked event, as JSON.stringify(object, null, 2) writes it.
function jdExtract(i) {
  var line = (jdEvents[jdId] || [])[Number(i)];
  if (!line || !jdView || !jdView.cm) return;
  var pretty = line.json;
  try { pretty = JSON.stringify(JSON.parse(line.json), null, 2); } catch (e) { /* shown as it came */ }
  jdView.cm.setValue(pretty);
  if (typeof jdView.cm.refresh === 'function') jdView.cm.refresh();
}

spirit.shell.activateApp({
  // Once per pane, ever. The subject arrives in open().
  mount: function (container, api) {
    jdApi = api;
    // THE PAGE IS FULL AND DOES NOT SCROLL: the header, then the log and the Extract box, a third of the height each,
    // scrolling inside themselves.
    container.innerHTML =
      '<div id="jd-body" class="stack">' +
        '<div class="stat-tile wide" id="jd-head"></div>' +
        '<div class="stat-tile wide"><div class="job-manifest-note">Events (the last ' + JD_WINDOW + ')</div>' +
          '<div class="job-log-panel" id="jd-log" style="height:33vh;max-height:33vh;overflow:auto"></div></div>' +
        '<div class="stat-tile wide"><div class="job-manifest-note">Extract</div>' +
          '<div id="jd-extract" style="height:33vh;overflow:auto"></div></div>' +
      '</div>';

    var make = api.ui && api.ui.elements && api.ui.elements.createTextView;
    var extract = document.getElementById('jd-extract');
    if (typeof make === 'function' && extract) {
      jdView = make(extract, { text: '', readOnly: true, path: 'event.json' });
      if (jdView && jdView.cm && typeof jdView.cm.setSize === 'function') jdView.cm.setSize('100%', '100%');
    }

    // The shell's live jobs, once for the pane's life. Every job's events are heard; the screen repaints when the
    // event is about the job shown, or when the shell did not say which job moved.
    api.onJobs(function (jobsById, changed) {
      jdJobs = jobsById;
      if (changed) jdHear(changed);
      else if (jobsById && jobsById.forEach) jobsById.forEach(jdHear);
      if (!jdId) return;
      if (!changed || changed.id === jdId) jdRender();
    });

    // A click on an event line puts it in the Extract box. Delegated, because the log is repainted on every event.
    document.getElementById('jd-log').addEventListener('click', function (event) {
      var t = event && event.target;
      var line = t && typeof t.closest === 'function' ? (t.closest('[data-event]') || t) : t;
      var i = line && typeof line.getAttribute === 'function' ? line.getAttribute('data-event') : null;
      if (i !== null && i !== '') jdExtract(i);
    });

    document.getElementById('jd-head').addEventListener('click', function (event) {
      var id = event.target && event.target.id;
      if (id === 'jd-cancel') {
        // The screen stays: the next event shows the job stop.
        spirit.core.jobs.cancel(jdId).catch(function (err) { console.error('cancel failed', err); });
        return;
      }
      if (id === 'jd-delete') {
        // THE SCREEN GOES WITH THE JOB: once it is deleted there is nobody left to show, so back to the table.
        spirit.core.jobs.delete(jdId).then(function () {
          if (jdApi) jdApi.closeDialog({ changed: true, id: jdId });
        }).catch(function (err) { console.error('delete failed', err); });
      }
    });
  },

  // Every call, mounted or not — the shell guarantees it. The subject arrives here, and the Extract box is emptied.
  open: function (params) {
    jdId = (params && params.id) || '';
    if (jdView && jdView.cm) jdView.cm.setValue('');
    jdRender();
  },
});
