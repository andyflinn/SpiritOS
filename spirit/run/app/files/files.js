// The fifth of the shell apps to leave index.html (CLEANUP-PLAN). Same
// app: the same tree, the same open folders, the same click that opens a
// file with whatever handles it. Its id changed with its folder, 'files'
// to 'app/files' — see APP_ID_RENAMES and INTRINSIC_APP_FOLDERS in
// js/client/shell.js, and the Spirit group's member list in index.html,
// all updated in this same commit. An id that moves without its rename
// map is an operator's overrides thrown away by pruneStalePreferences.
//
// Intrinsic, so it sits in the Spirit group and its name, icon and place
// are locked. That is the existing rule for an intrinsic app, not a new
// one: Files therefore leaves the main desktop and is one tap away
// inside Spirit, beside Stats, Jobs, Apps and Processes.
//
// The two launchers it opens — text-file-launcher and media-launcher —
// stay in index.html. This app reaches them through api.launchApp, the
// doorway step 6 gave a system app, rather than through spirit.shell.
//
// Still on spirit.shell, because step 6 did not name them: the viewer
// lookup itself (mimeTypeForName, classifyMimeType, iconForFile,
// CATEGORY_APP_HANDLERS) and findJobByType. app/process-browser carries
// the same list for the same reason — "which app opens this file" is the
// same kind of question as "open this app" — and they wait for a sitting
// that opens them.
//
// `api` arrives at mount and render never gets one, so it is kept here,
// exactly as Processes does.

var filesEscapeHtml = spirit.core.util.escapeHtml;
var filesIcon = spirit.core.const.ICON;
var filesApi = null; // handed in at mount, kept for the click handler

// Reference-equality cache: the fs-watcher job this tree was last built
// from. The watcher only speaks when the list has actually changed
// (js/jobs.js), so this is now a cheap second line rather than the only
// one. api.onFiles would replace it outright — that conversion was left
// for its own sitting, because this one moves a file and changes
// nothing.
var lastFilesJob = null;

function filesBuildTree(files) {
  var byPath = new Map();
  files.forEach(function (entry) { byPath.set(entry.fullPath, entry); });

  var roots = [];
  var childrenByPath = new Map();

  files.forEach(function (entry) {
    if (byPath.has(entry.parentPath)) {
      if (!childrenByPath.has(entry.parentPath)) childrenByPath.set(entry.parentPath, []);
      childrenByPath.get(entry.parentPath).push(entry);
    } else {
      roots.push(entry);
    }
  });

  return { roots: roots, childrenByPath: childrenByPath };
}

// Which folders were open before the last rebuild, by relative path. A
// <details> built fresh is a <details> that is closed, so without this
// every genuine change to the tree — one new file anywhere — costs you
// every folder you had opened to get where you were. Read off the DOM
// rather than kept in a variable: the DOM is where the clicks landed.
function filesOpenTreePaths(treeEl) {
  var open = new Set();
  Array.prototype.slice.call(treeEl.querySelectorAll('details[open]')).forEach(function (el) {
    if (el.dataset.path) open.add(el.dataset.path);
  });
  return open;
}

function filesRenderTreeNode(entry, childrenByPath, openPaths) {
  if (entry.kind === 'folder') {
    var kids = childrenByPath.get(entry.fullPath) || [];
    var kidsHtml = kids.map(function (k) { return filesRenderTreeNode(k, childrenByPath, openPaths); }).join('');
    var isOpen = openPaths && openPaths.has(entry.relativePath);
    return '<details data-path="' + filesEscapeHtml(entry.relativePath) + '"' + (isOpen ? ' open' : '') + '>' +
      '<summary>' + filesIcon.FOLDER + ' ' + filesEscapeHtml(entry.name) + '</summary>' +
      '<div class="tree-children">' + kidsHtml + '</div></details>';
  }

  var mimeType = spirit.shell.mimeTypeForName(entry.name);
  return '<div class="file-row" data-name="' + filesEscapeHtml(entry.name) + '" data-path="' +
    filesEscapeHtml(entry.relativePath) + '" data-mime="' + filesEscapeHtml(mimeType) + '">' +
    spirit.shell.iconForFile(mimeType) + ' ' + filesEscapeHtml(entry.name) + '</div>';
}

function filesShowDetail(name, path, mimeType) {
  var detailEl = document.getElementById('file-detail');
  if (!detailEl) return;
  detailEl.innerHTML = '<div class="stat-tile wide">' +
    '<div class="label">Name</div><div class="rows">' + filesEscapeHtml(name) + '</div>' +
    '<div class="label">Path</div><div class="rows">' + filesEscapeHtml(path) + '</div>' +
    '<div class="label">MIME type</div><div class="rows">' + filesEscapeHtml(mimeType) + '</div>' +
    '</div>';
}

spirit.shell.activateApp({
  mount: function (container, api) {
    filesApi = api;

    // See the Processes app for why this must reset on every fresh
    // mount, not just persist: mount() always wipes the tree's DOM, so a
    // stale cache hit from a previous visit would leave it empty.
    lastFilesJob = null;

    container.innerHTML = '<div id="file-tree"></div><div id="file-detail"></div>';
    document.getElementById('file-tree').addEventListener('click', function (event) {
      var row = event.target.closest('.file-row');
      if (!row) return;
      var handlerId = spirit.shell.CATEGORY_APP_HANDLERS[spirit.shell.classifyMimeType(row.dataset.mime)];
      if (handlerId) {
        // Through api, not the global: opening another app is exactly
        // what step 6 gave a system app a doorway for.
        filesApi.launchApp(handlerId, { path: row.dataset.path });
        return;
      }
      filesShowDetail(row.dataset.name, row.dataset.path, row.dataset.mime);
    });
  },

  render: function () {
    var treeEl = document.getElementById('file-tree');
    if (!treeEl) return;

    var job = spirit.shell.findJobByType('fs-watcher');
    if (job === lastFilesJob) return; // unchanged (e.g. an unrelated stats tick) — leave the tree, and its open folders, alone
    lastFilesJob = job;

    if (!job || !job.data || !Array.isArray(job.data.files)) {
      treeEl.textContent = 'waiting for file list…';
      return;
    }

    var openPaths = filesOpenTreePaths(treeEl);
    var tree = filesBuildTree(job.data.files);
    treeEl.innerHTML = tree.roots.map(function (r) {
      return filesRenderTreeNode(r, tree.childrenByPath, openPaths);
    }).join('') || '(empty)';
  },
});
