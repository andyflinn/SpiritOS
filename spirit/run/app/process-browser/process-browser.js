// The fourth of the five to leave index.html (CLEANUP-PLAN step 5.4).
// Same app: the same search box, the same manifest-labelled list, the
// same "open it with whatever viewer handles that type" click. Its id
// changed with its folder, 'process-browser' to 'app/process-browser' —
// see APP_ID_RENAMES and INTRINSIC_APP_FOLDERS in js/client/shell.js and
// the Spirit group's member list in index.html, both updated in this
// same commit.
//
// It moved ahead of step 6, by Andy's decision, so it still reaches for
// two globals that step 6 is meant to replace with `api` methods:
//
//   - spirit.core.fs.loadFile on process/<lang>/<name>/<name>.json,
//     which is an unscoped read by nature — this app's whole job is
//     listing files that are not its own. api.fs is scoped to
//     app/process-browser/ and always will be (AGENT.md: scoped by
//     convention, the jail is server-side fileWritable).
//   - spirit.shell for the viewer lookup and the launch.
//
// Both are the same calls index.html made, from a different file. They
// are not to be "fixed" by inventing a private route here; step 6 is
// where a system app's api surface gets decided.

var PROCESS_ICON = spirit.core.const.ICON;
var processEscapeHtml = spirit.core.util.escapeHtml;

var lastProcessBrowserJob = null;
var lastProcessBrowserEntries = null; // cached {label, description, relativePath} list, independent of the search filter

// The shell hands render() the job map it already keeps, so this app
// needs no subscription of its own — same as app/stats/stats.js.
function processFindJob(jobsById, type) {
  var found = null;
  if (!jobsById || typeof jobsById.forEach !== 'function') return null;
  jobsById.forEach(function (job) {
    if (job && job.type === type) found = job;
  });
  return found;
}

function renderProcessList() {
  var listEl = document.getElementById('process-browser-list');
  if (!listEl) return;

  if (!lastProcessBrowserEntries) {
    var job = lastProcessBrowserJob;
    if (!job || !job.data || !Array.isArray(job.data.files)) {
      listEl.textContent = 'waiting for file list…';
      return;
    }
    // A script's own file always shares its basename with its
    // enclosing folder (process/<lang>/<name>/<name>.<ext> — same
    // convention app/<name>/<name>.js already relies on), which
    // correctly excludes sibling assets living in the same folder
    // (a test fixture, an npm package.json, etc.) that the old
    // shape-only check let through. .json is still excluded
    // separately since a manifest shares that same basename.
    lastProcessBrowserEntries = job.data.files
      .filter(function (f) { return f.kind === 'file' && /^process\/[^/]+\/([^/]+)\/\1\.[^/.]+$/.test(f.relativePath) && !/\.json$/.test(f.relativePath); })
      .map(function (f) {
        var manifestRaw = spirit.core.fs.loadFile(f.relativePath.replace(/\.[^.]+$/, '.json'));
        var manifest = null;
        try { manifest = manifestRaw ? JSON.parse(manifestRaw) : null; } catch (e) {}
        return {
          relativePath: f.relativePath,
          label: (manifest && manifest.label) || f.name,
          description: (manifest && manifest.description) || '',
        };
      });
  }

  var query = (document.getElementById('process-search').value || '').toLowerCase();
  var filtered = lastProcessBrowserEntries.filter(function (e) {
    return !query || e.label.toLowerCase().indexOf(query) !== -1 ||
      e.description.toLowerCase().indexOf(query) !== -1 ||
      e.relativePath.toLowerCase().indexOf(query) !== -1;
  });

  listEl.innerHTML = filtered.map(function (e) {
    return '<div class="process-entry" data-process-path="' + processEscapeHtml(e.relativePath) + '">' +
      '<div class="process-entry-label">' + processEscapeHtml(e.label) + '</div>' +
      (e.description ? '<div class="process-entry-desc">' + processEscapeHtml(e.description) + '</div>' : '') +
      '</div>';
  }).join('') || '(no matching processes)';
}

spirit.shell.activateApp({
  mount: function (container) {
    // Force the next render() to actually populate the list — mount()
    // always wipes the DOM clean, so a cache hit from a previous visit
    // (same fs-watcher job reference, nothing changed on disk) must
    // not be allowed to skip repopulating a freshly-emptied container.
    lastProcessBrowserJob = null;
    lastProcessBrowserEntries = null;

    container.innerHTML =
      '<input type="text" id="process-search" placeholder="Search processes…">' +
      '<div id="process-browser-list"></div>';

    document.getElementById('process-search').addEventListener('input', function () {
      renderProcessList();
    });

    document.getElementById('process-browser-list').addEventListener('click', function (event) {
      var entry = event.target.closest('[data-process-path]');
      if (!entry) return;
      var mimeType = spirit.shell.mimeTypeForName(entry.dataset.processPath);
      var handlerId = spirit.shell.CATEGORY_APP_HANDLERS[spirit.shell.classifyMimeType(mimeType)];
      if (!handlerId) {
        alert('No viewer registered yet for this file type (' + mimeType + ').');
        return;
      }
      // The viewer is what offers "start this as a job" and jumps to
      // Jobs afterwards; this app only ever opens the file.
      spirit.shell.launchApp(handlerId, { path: entry.dataset.processPath });
    });
  },

  render: function (jobsById) {
    var job = processFindJob(jobsById, 'fs-watcher');
    if (job === lastProcessBrowserJob) return; // fs-watcher data unchanged — skip re-scanning/re-fetching manifests
    lastProcessBrowserJob = job;
    lastProcessBrowserEntries = null;
    renderProcessList();
  },
});
