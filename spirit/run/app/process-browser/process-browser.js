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

var processFiles = null; // the file list, as last delivered by api.onFiles
var processStale = false; // a list arrived while this app was off screen
var lastProcessBrowserEntries = null; // cached {label, description, relativePath} list, independent of the search filter

// This app used to be handed the whole job map on every job event and
// keep `lastProcessBrowserJob` to tell "my job moved" from "a stats tick
// happened" — an object-identity cache, in an app, for a question the
// shell was better placed to answer. The Files app carried the same four
// lines. api.onFiles is that question answered once: it is called only
// when the list says something new, never on an unrelated job.
//
// The subscription is permanent and arrives whether or not this app is on
// screen. Re-reading every process manifest for a page nobody is looking
// at is work with no reader, so the callback records what came and stops
// there; render(), which switchTo calls on every visit, is the catch-up.

function renderProcessList() {
  var listEl = document.getElementById('process-browser-list');
  if (!listEl || !processApi) return;

  if (!lastProcessBrowserEntries) {
    if (!Array.isArray(processFiles)) {
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
    lastProcessBrowserEntries = processFiles
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

    // mount() always wipes the DOM clean, so whatever was worked out on
    // a previous visit must not be allowed to stand in for repopulating a
    // freshly-emptied container.
    lastProcessBrowserEntries = null;
    processStale = true;

    // The search box is the one control this screen offers, so it sits in
    // a panel of its own — the same shape the Jobs start form and the
    // Groups create form have. The list below is the list, as a table is
    // in those apps.
    //
    // No caption over it, unlike Jobs' three fields: there the
    // placeholders were carrying the captions and vanished the moment you
    // typed, and you could not tell which box was which. One search box
    // is not ambiguous, and a "Search" label above a box that says
    // "Search processes…" is a word that cannot do anything (§1).
    container.innerHTML =
      '<div class="stat-tile wide">' +
        '<input type="text" id="process-search" placeholder="Search processes…">' +
      '</div>' +
      '<div id="process-browser-list"></div>';

    document.getElementById('process-search').addEventListener('input', function () {
      renderProcessList();
    });

    // Once, for the life of the page. Delivered immediately with what the
    // shell already knows, so the list is there before the first rescan.
    api.onFiles(function (files, ctx) {
      processFiles = files;
      lastProcessBrowserEntries = null; // the manifests are re-read from the new list
      processStale = true;
      if (!ctx.visible) return; // this app's choice: nothing to paint for nobody
      processStale = false;
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

  // Called by switchTo on every visit, and by the shell on every job
  // event. Both are the same question — "is what is on screen out of
  // date?" — and the answer is no unless a file list arrived while this
  // app was not being looked at.
  render: function () {
    if (!processStale) return;
    processStale = false;
    renderProcessList();
  },
});
