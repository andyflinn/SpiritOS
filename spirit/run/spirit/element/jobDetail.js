// spirit/run/spirit/element/jobDetail.js
// ONE JOB OF THE JOB MONITOR, AN ELEMENT (goal/G43.29; Andy: "a wrapper for separate spirit/element/ files"), moved here
// from shell/jobsDetails/jobsDetails.js and working as it did, now a panel over Jobs (Q1: "a job row opens detail panel
// overtop of jobs."). Its contract and its test: ./test/jobDetail.md and ./test/jobDetail.js.
//
//   spirit.element.jobDetail.create(host, { id, title, close }) -> { destroy() }
//     id     the job it shows, and nothing else
//     title  called with { icon, label } as the job's status changes (the layer's bar)
//     close  called once the job is deleted: there is nobody left to show
//
// Andy, 2026-10-02: "the job monitor shell component. the folded "consoles" need to go into jobsDetails", "the form on top
// should be gone." It launches nothing, and the only way out is back to the list (the layer's ✕).
//
// NO DATA BOX. Andy: "get rid of that box. it's the (relatively) static portion of the fs data."
//
// A LIVE MONITOR OF WHAT THE JOB PUBLISHES, NEVER ITS STDOUT (goal/G29.14). The item's box: "A real-time monitor of a
// capturable event stream, never stdout: an agent's file changes through spirit.fs, and what each server publishes. It shows
// what could be logged; nothing is logged or kept." The window holds the last 256 events the page receives; the node does no
// more work. The header, the rolling event log (a third of the height, one JSON line per event), and the Extract/analyze box
// (a third of the height: the last event clicked, JSON.stringify(object, null, 2), in a read-only CodeMirror text view). The
// log and the Extract box scroll inside themselves.
//
// LIVE THROUGH spirit.data (goal/G41.28): the job and its last events are the jobs family's cache manager's
// (spirit.data.jobs.data, spirit/jobs/data.js), which keeps every job's events whatever is on screen, so a reopen shows what
// came meanwhile. It repaints when its job changes there.
(function () {
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): the Extract box's codeMirror and the jobs family's cache manager.
  var parts = Promise.all([S.require('spirit/element/codeMirror.js'), S.cacheManager('jobs')]);

  function esc(s) { return S.escapeHtml(String(s == null ? '' : s)); }

  // The canonical set lives in spirit/run/spirit/jobs.js (TERMINAL_STATUSES), node-side; ./jobs.js keeps the same copy.
  var TERMINAL = ['completed', 'failed', 'cancelled', 'stopped'];
  var STATUS_ICON = {
    pending: '⏳',
    running: '🏃‍♂️',
    completed: '✅',
    failed: '❌',
    cancelled: '🟠',
    stopped: '🟠',
    error: '⚠️',
  };

  function data() { return ((S.data || {}).jobs || {}).data || null; }

  // A facts bubble: the old shell's factRow markup and classes, drawn here (new code requires nothing of the old shell).
  function factRow(pairs) {
    return '<div class="fact-row">' + pairs.map(function (p) {
      return '<div class="fact"><span class="fact-label">' + esc(p[0]) + '</span><span class="fact-value">' + esc(p[1]) + '</span></div>';
    }).join('') + '</div>';
  }

  // Cancel for a one-shot process and for a user-operated server, never for a node-operated one, which lives and dies with the
  // node (Andy: "would allow cancel for servers - user but not for servers - node"); Delete once the job is terminal.
  function buttonsHtml(job) {
    var isTerminal = TERMINAL.indexOf(job.status) !== -1;
    var canCancel = !isTerminal && (job.kind === 'process' || (job.kind === 'server' && job.data && job.data.operated === 'user'));
    if (canCancel) return '<button type="button" class="cancel-btn" data-job="cancel">Cancel</button>';
    if (isTerminal) return '<button type="button" class="cancel-btn" data-job="delete">Delete</button>';
    return '';
  }

  function create(host, options) {
    var o = options || {};
    var id = String(o.id || '');
    var gone = false;
    var view = null;
    var off = null;

    host.innerHTML =
      '<div class="stack">' +
        '<div class="stat-tile wide" data-job="head"></div>' +
        '<div class="stat-tile wide"><div class="job-manifest-note" data-job="window">Events</div>' +
          '<div class="job-log-panel" data-job="log" style="height:33vh;max-height:33vh;overflow:auto"></div></div>' +
        '<div class="stat-tile wide"><div class="job-manifest-note">Extract</div>' +
          '<div data-job="extract" style="height:33vh;overflow:auto"></div></div>' +
      '</div>';
    function part(n) { return host.querySelector('[data-job="' + n + '"]'); }

    function job() { var J = data(); return J && id ? J.job(id) : null; }
    // THE EVENTS, THE LAST 256 PER JOB (goal/G29.14): as the jobs family's cache manager keeps them, oldest falling off the top;
    // nothing is asked of the node.
    function lines() { var J = data(); return J ? J.events(id) : []; }

    function logHtml() {
      var l = lines();
      if (!l.length) return '<div class="job-log-empty">(no events heard yet)</div>';
      return l.map(function (e, i) {
        return '<div class="job-log-entry" data-event="' + i + '" title="' + esc(new Date(e.at).toLocaleTimeString()) +
          '" style="cursor:pointer;white-space:nowrap">' + esc(e.json) + '</div>';
      }).join('');
    }

    function render() {
      var head = part('head');
      var log = part('log');
      if (gone || !head || !log) return;
      var j = job();
      if (typeof o.title === 'function') o.title({ icon: j ? STATUS_ICON[j.status] || '📋' : '📋', label: id });
      if (!j) {
        // Deleted or never there: say so rather than drawing a log that looks like a job with nothing to say yet.
        head.innerHTML = '<div class="job-log-empty">That job is no longer listed.</div>';
        log.innerHTML = '';
        return;
      }
      head.innerHTML = factRow([
        ['Status', (STATUS_ICON[j.status] || '') + ' ' + String(j.status || '')],
        ['Id', String(j.id)],
        ['Kind', String(j.kind || '') + (j.module ? ' (' + j.module + ')' : '')],
        ['Updated', j.updatedAt ? new Date(j.updatedAt).toLocaleTimeString() : ''],
      ]) + '<div class="start-job-form card">' + buttonsHtml(j) + '</div>';
      // Sticky scroll: rebuilding the log resets its scroll, so a log that was at the bottom is pinned back there and one
      // scrolled up to read keeps its place.
      var stick = log.scrollHeight - log.scrollTop - log.clientHeight < 20;
      var top = log.scrollTop;
      log.innerHTML = logHtml();
      log.scrollTop = stick ? log.scrollHeight : top;
    }

    // THE EXTRACT/ANALYZE BOX: the clicked event, as JSON.stringify(object, null, 2) writes it.
    function extract(i) {
      var line = lines()[Number(i)];
      if (!line || !view || !view.cm) return;
      var pretty = line.json;
      try { pretty = JSON.stringify(JSON.parse(line.json), null, 2); } catch (e) { /* shown as it came */ }
      view.cm.setValue(pretty);
      if (typeof view.cm.refresh === 'function') view.cm.refresh();
    }

    // A click on an event line puts it in the Extract box. Delegated, because the log is repainted on every event.
    part('log').addEventListener('click', function (event) {
      var t = event && event.target;
      var line = t && typeof t.closest === 'function' ? (t.closest('[data-event]') || t) : t;
      var i = line && typeof line.getAttribute === 'function' ? line.getAttribute('data-event') : null;
      if (i !== null && i !== '') extract(i);
    });

    part('head').addEventListener('click', function (event) {
      var what = event.target && typeof event.target.getAttribute === 'function' ? event.target.getAttribute('data-job') : '';
      function failed(word) { return function (e) { console.error(word + ' failed', e); }; }
      if (what === 'cancel') {
        // It stays open: the next event shows the job stop.
        Promise.resolve(S.ready).then(function (s) { return s.jobs.cancel({ id: id }); }).then(null, failed('cancel'));
        return;
      }
      if (what === 'delete') {
        // IT GOES WITH THE JOB: once it is deleted there is nobody left to show, so back to the list.
        Promise.resolve(S.ready).then(function (s) { return s.jobs.delete({ id: id }); }).then(function () {
          if (typeof o.close === 'function') o.close();
        }, failed('delete'));
      }
    });

    parts.then(function () {
      if (gone) return;
      var J = data();
      var win = part('window');
      if (win) win.textContent = 'Events (the last ' + ((J && J.eventWindow) || 256) + ')';
      // THE EXTRACT BOX ON THE CODEMIRROR ELEMENT, READ MODE (goal/G41.7).
      Promise.resolve(S.element.codeMirror.create(part('extract'), { mode: 'read', text: '', path: 'event.json' })).then(function (v) {
        if (gone) return;
        view = v;
        if (view && view.cm && typeof view.cm.setSize === 'function') view.cm.setSize('100%', '100%');
      }, function () { /* the Extract box stays empty */ });
      // It repaints when its job changes in spirit.data, or when the whole set is read again.
      if (J) off = J.watch(function (changed) { if (!changed || changed === id) render(); });
      render();
    }, function () { part('head').innerHTML = '<div class="job-log-empty">That job is no longer listed.</div>'; });

    return {
      destroy: function () {
        gone = true;
        if (typeof off === 'function') off();
        off = null;
        if (view && typeof view.destroy === 'function') view.destroy();
        view = null;
        host.innerHTML = '';
      },
    };
  }

  S.element = S.element || {};
  S.element.jobDetail = { create: create };
}());
