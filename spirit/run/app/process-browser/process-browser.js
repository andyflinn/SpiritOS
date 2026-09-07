// The fourth of the five to leave index.html (CLEANUP-PLAN step 5.4).
// Same app: the same search box, the same manifest-labelled list, the
// same "open it with whatever viewer handles that type" click. Its id
// changed with its folder, 'process-browser' to 'app/process-browser' —
// see APP_ID_RENAMES and INTRINSIC_APP_FOLDERS in js/client/shell.js and
// the Spirit group's member list in index.html, both updated in this
// same commit.
//
// It moved ahead of step 6 and reached for globals in the meantime.
// Step 6 gave those capabilities a doorway, and this app is the proof:
//
//   - api.readProject reads process/<lang>/<name>/<name>.json. That is
//     an unscoped read by nature — this app's whole job is listing files
//     that are not its own, which api.fs (scoped to
//     app/process-browser/) cannot express and should not.
//   - api.launchApp opens the viewer for a script.
//
// Still on spirit.shell, because step 6 did not name them: the viewer
// lookup itself (mimeTypeForName, classifyMimeType,
// CATEGORY_APP_HANDLERS). They are the obvious next three — "which app
// opens this file" is the same kind of question as "open this app" —
// but they wait for a sitting that opens them.
//
// `api` arrives at mount and render never gets one, so it is kept here.
// Every app that needs api outside mount does the same; worth a shell
// change one day, not this one.

var processEscapeHtml = spirit.core.util.escapeHtml;
var processApi = null; // handed in at mount, kept for render's sake

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
  if (!listEl || !processApi) return;

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
        var manifestRaw = processApi.readProject(f.relativePath.replace(/\.[^.]+$/, '.json'));
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
  mount: function (container, api) {
    processApi = api;

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
      api.launchApp(handlerId, { path: entry.dataset.processPath });
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
