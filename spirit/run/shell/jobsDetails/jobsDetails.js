// One job of the Job Monitor, as its own screen (goal/G2.11).
//
//   Andy, 2026-10-02: "the job monitor shell component. the folded
//   "consoles" need to go into jobsDetails", "the form on top should be gone."
//
// A dialog in the pattern of contactsDetails: hidden, pushed by the Jobs
// table for one row, showing that job and nothing else, launching nothing,
// and the only way out is back to the table. The console that used to fold
// open under the row lives here, with the actions that sat in the row.
//
// NO DATA BOX. Andy: "get rid of that box. it's the (relatively) static portion of the fs data." The
// console is what the job does; its job.data record is not drawn.
//
// LIVE THROUGH THE SHELL, NOT A STREAM OF ITS OWN. A dialog is never driven
// by the job tick (switchTo, renderActive), so this asks the shell for the
// jobs with api.onJobs — its opt-in for an app that wants live data — and
// repaints on every event about the job it shows. One subscription, taken
// at mount, kept for the pane's life: the shell mounts a dialog once and
// opens it per subject.

var jdEscapeHtml = spirit.core.util.escapeHtml;
var jdIcon = spirit.core.const.ICON;
var jdApi = null;

var jdId = '';          // which job this screen is about
var jdJobs = null;      // the shell's live Map, as api.onJobs last handed it over

// The canonical set lives in js/jobs.js, node-side; shell/jobs/jobs.js and
// app/stats keep the same copy for the same reason (see the note there).
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

// ── THE WATCHER'S CONSOLE IS ITS STREAM (goal/G2.16) ───────────────────
//
//   Andy, 2026-10-02: "jobs don't need to write logs, logs should be consumed
//   by an outside reader ... the watcher only needs to stream data", and "let's
//   just make the consoles display the usefull data, the data in the live
//   stream, we'll do it one item per job."
//
// fs-watcher writes no log line; each change arrives as a job event whose data
// carries one tree command {op, path, at} (goal/G4.25). This page is the reader:
// every such event, heard while the page lives (open or not), becomes one line —
// time, event, path — in a window of JD_WINDOW lines kept here, oldest falling
// off the top. Nothing is asked of the node, and a repeat of the same event at
// the same moment adds nothing.
var JD_WINDOW = 1000;
var jdStreams = Object.create(null);   // job id -> [{at, event, path}]

function jdHear(job) {
  if (!job || job.type !== 'fs-watcher') return;
  var c = job.data && job.data.command;
  if (!c || !c.path) return;
  var lines = jdStreams[job.id] || (jdStreams[job.id] = []);
  var last = lines[lines.length - 1];
  if (last && last.at === c.at && last.event === c.op && last.path === c.path) return;
  lines.push({ at: c.at, event: String(c.op || ''), path: String(c.path) });
  if (lines.length > JD_WINDOW) lines.splice(0, lines.length - JD_WINDOW);
}

function jdStreamHtml(job) {
  var lines = jdStreams[job.id] || [];
  if (!lines.length) return '<div class="job-log-empty">(no file events heard yet)</div>';
  return lines.map(function (l) {
    return '<div class="job-log-entry"><span class="job-log-time">' +
      new Date(l.at).toLocaleTimeString() + '</span>' + jdEscapeHtml(l.event) + ' ' + jdEscapeHtml(l.path) + '</div>';
  }).join('');
}

function jdLogHtml(job) {
  if (job.type === 'fs-watcher') return jdStreamHtml(job);
  if (!job.log || job.log.length === 0) return '<div class="job-log-empty">(no log entries yet)</div>';
  return job.log.map(function (entry) {
    return '<div class="job-log-entry"><span class="job-log-time">' +
      new Date(entry.timestamp).toLocaleTimeString() + '</span>' + jdEscapeHtml(String(entry.message)) + '</div>';
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
  var body = document.getElementById('jd-body');
  if (!body) return;
  var job = jdJob();
  if (jdApi && jdApi.setScreenTitle) jdApi.setScreenTitle(jdTitle(job));

  if (!job) {
    // Deleted or never there: say so rather than drawing a console that
    // looks like a job with nothing to say yet.
    body.innerHTML = '<div class="stat-tile wide"><div class="job-log-empty">That job is no longer listed.</div></div>';
    return;
  }

  // Sticky scroll, as the folded panel had it: rebuilding the console
  // resets its scroll, so a panel that was at the bottom is pinned back
  // there and one scrolled up to read history keeps its place.
  var panel = body.querySelector ? body.querySelector('#jd-log') : null;
  var stickToBottom = true;
  var previousScrollTop = 0;
  if (panel) {
    var distanceFromBottom = panel.scrollHeight - panel.scrollTop - panel.clientHeight;
    stickToBottom = distanceFromBottom < 20;
    previousScrollTop = panel.scrollTop;
  }

  var facts = spirit.shell.factRow([
    ['Status', (JD_STATUS_ICON[job.status] || '') + ' ' + String(job.status || '')],
    ['Id', String(job.id)],
    ['Kind / Type', String(job.kind || '') + ' / ' + String(job.type || '') + (job.module ? ' (' + job.module + ')' : '')],
    ['Updated', job.updatedAt ? new Date(job.updatedAt).toLocaleTimeString() : ''],
  ]);

  body.innerHTML =
    '<div class="stat-tile wide">' +
      facts +
      '<div class="start-job-form card">' + jdButtonsHtml(job) + '</div>' +
    '</div>' +
    '<div class="stat-tile wide">' +
      '<div class="job-manifest-note">Console</div>' +
      '<div class="job-log-panel" id="jd-log">' + jdLogHtml(job) + '</div>' +
    '</div>';

  var fresh = body.querySelector ? body.querySelector('#jd-log') : null;
  if (fresh) fresh.scrollTop = stickToBottom ? fresh.scrollHeight : previousScrollTop;
}

spirit.shell.activateApp({
  // Once per pane, ever. The subject arrives in open().
  mount: function (container, api) {
    jdApi = api;
    container.innerHTML = '<div id="jd-body" class="stack"></div>';

    // The shell's live jobs, once for the pane's life. A snapshot or any
    // job event repaints this screen when it is about the job shown — or
    // when the shell did not say which job moved.
    api.onJobs(function (jobsById, changed) {
      jdJobs = jobsById;
      // The watcher's stream is heard whatever is on screen, so a reopen shows what came meanwhile (goal/G2.16).
      if (changed) jdHear(changed);
      else if (jobsById && jobsById.forEach) jobsById.forEach(jdHear);
      if (!jdId) return;
      if (!changed || changed.id === jdId) jdRender();
    });

    // Delegated, because the panel is repainted on every event and a
    // handler bound to a button would go with it.
    document.getElementById('jd-body').addEventListener('click', function (event) {
      var id = event.target && event.target.id;
      if (id === 'jd-cancel') {
        // The screen stays: the next event shows the job stop.
        spirit.core.jobs.cancel(jdId).catch(function (err) { console.error('cancel failed', err); });
        return;
      }
      if (id === 'jd-delete') {
        // THE SCREEN GOES WITH THE JOB: once it is deleted there is nobody
        // left to show, so back to the table, which is where it is gone.
        spirit.core.jobs.delete(jdId).then(function () {
          if (jdApi) jdApi.closeDialog({ changed: true, id: jdId });
        }).catch(function (err) { console.error('delete failed', err); });
      }
    });
  },

  // Every call, mounted or not — the shell guarantees it. The subject
  // arrives here, and everything about the last one is let go of.
  open: function (params) {
    jdId = (params && params.id) || '';
    jdRender();
  },
});
