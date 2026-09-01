(function () {
  var ICON = spirit.core.const.ICON;

  var desktopEl = document.getElementById('desktop');
  var containerEl = document.getElementById('app-container');
  var titleEl = document.getElementById('app-title');
  var contentEl = document.getElementById('app-content');
  var closeBtn = document.getElementById('app-close');
  var homeBtn = document.getElementById('app-home');

  var jobsById = new Map();
  var apps = {};
  var activeAppId = null;
  var activeParams = null;
  var navStack = [{ id: 'desktop', params: null }]; // last entry is the current screen

  // Extension -> [{id, name}] of every real handler app registered for
  // it (dynamically-loaded apps only — see declareDynamicApp below).
  // Separate from the fixed, non-configurable CATEGORY_APP_HANDLERS
  // used for the built-in viewers: this is the pluggable "what else
  // could open this file" registry behind "Open with".
  var extensionHandlers = {};

  // Default-handler choices persist here rather than in any app's own
  // data, because they're explicitly meant to be part of the personal
  // dataset this project is building toward (see preferences.json in
  // .gitignore), not ordinary app config — hence root-level, not
  // app-scoped.
  var preferencesRaw = spirit.core.fs.loadFile('preferences.json');
  var preferences = { defaultHandlers: {} };
  if (preferencesRaw != null) {
    try {
      preferences = JSON.parse(preferencesRaw);
      preferences.defaultHandlers = preferences.defaultHandlers || {};
    } catch (e) { /* malformed — fall back to empty defaults */ }
  }

  function savePreferences() {
    spirit.core.fs.saveFile('preferences.json', JSON.stringify(preferences, null, 2));
  }

  // Called once per extension a handler app declares. First
  // declaration wins the default; later ones for the same extension
  // never overwrite an existing choice — that's what the "Set as
  // default" control (renderOpenWith, below) is for.
  function registerExtensionHandler(ext, appId, appName) {
    (extensionHandlers[ext] = extensionHandlers[ext] || []).push({ id: appId, name: appName });
    if (preferences.defaultHandlers[ext] === undefined) {
      preferences.defaultHandlers[ext] = appId;
      savePreferences();
    }
  }

  function defaultHandlerId(path) {
    var ext = path.substring(path.lastIndexOf('.'));
    return preferences.defaultHandlers[ext];
  }

  function createDesktopIcon(id, name, icon) {
    var iconEl = document.createElement('div');
    iconEl.className = 'app-icon';
    iconEl.innerHTML = '<span class="icon">' + icon + '</span><span class="label">' + name + '</span>';
    iconEl.addEventListener('click', function () { launchApp(id); });
    desktopEl.appendChild(iconEl);
  }

  function registerApp(app) {
    apps[app.id] = app;
    if (app.hidden) return; // reachable only via launchApp(id, params) from another app, no desktop icon
    createDesktopIcon(app.id, app.name, app.icon);
  }

  // Switches the visible screen without touching navStack — the stack
  // bookkeeping lives in launchApp/goBack, this just mounts/unmounts.
  function switchTo(id, params) {
    if (activeAppId && apps[activeAppId] && typeof apps[activeAppId].unmount === 'function') {
      apps[activeAppId].unmount();
    }

    if (id === 'desktop') {
      activeAppId = null;
      activeParams = null;
      containerEl.hidden = true;
      desktopEl.hidden = false;
      return;
    }

    var app = apps[id];
    activeAppId = id;
    activeParams = params;
    titleEl.textContent = app.name;
    contentEl.innerHTML = '';
    desktopEl.hidden = true;
    containerEl.hidden = false;

    app.mount(contentEl, params);
    app.render(jobsById, params);
  }

  // Launching an app pushes onto the nav stack, so a later back-press
  // returns to wherever the launch happened from (desktop, or another
  // app — e.g. clicking a Stats tile that jumps into Files) rather than
  // always jumping straight to the desktop.
  function launchApp(id, params, options) {
    params = params || null;
    options = options || {};
    var appEntry = apps[id];
    if (!appEntry) return;

    var top = navStack[navStack.length - 1];
    if (top.id === id && JSON.stringify(top.params) === JSON.stringify(params)) return; // already here

    // If this exact screen (id + params) already exists elsewhere in the
    // stack, collapse back to that occurrence instead of pushing a
    // duplicate — otherwise revisiting a screen would make the stack
    // (and the back button) walk through repeats on the way out. Two
    // Code Viewer entries for two different files are NOT the same
    // screen, so they correctly stay as distinct stack entries.
    var existingIndex = -1;
    for (var i = 0; i < navStack.length; i++) {
      if (navStack[i].id === id && JSON.stringify(navStack[i].params) === JSON.stringify(params)) {
        existingIndex = i;
        break;
      }
    }

    if (existingIndex !== -1) {
      navStack.length = existingIndex + 1;
    } else if (options.replace && navStack.length > 1) {
      // Used when picking a handler from "Open with" inside a viewer:
      // the handler replaces the viewer's own stack entry rather than
      // stacking on top of it, so Back returns straight to wherever
      // the viewer was opened from, not back through the read-only
      // preview first.
      navStack[navStack.length - 1] = { id: id, params: params };
    } else {
      navStack.push({ id: id, params: params });
    }

    // Manifest-declared dynamic apps are declared (icon, id, name) at
    // discovery time but their script isn't fetched until first use —
    // do that now, then mount once it finishes loading and has called
    // activateApp to supply real mount/render.
    if (appEntry._scriptPath && !appEntry._activated) {
      var script = document.createElement('script');
      script.src = '/' + appEntry._scriptPath;
      script.onload = function () { switchTo(id, params); };
      document.body.appendChild(script);
      return;
    }

    switchTo(id, params);
  }

  // A manifest-declared app's script has nothing left to say except its
  // behavior — id/name/icon/hidden/handlesExtensions are already fully
  // known from the manifest (declareDynamicApp, below). So it never
  // calls registerApp (which stays completely unrelated to this
  // declare/activate lifecycle and is only ever used by static apps);
  // it calls this instead.
  function activateApp(id, behavior) {
    var existing = apps[id];
    if (!existing) return; // no manifest declared this id — nothing to attach to
    existing.mount = behavior.mount;
    existing.render = behavior.render;
    existing._activated = true;
  }

  function goBack() {
    if (navStack.length <= 1) return; // already at the bottom of the stack
    navStack.pop();
    var top = navStack[navStack.length - 1];
    switchTo(top.id, top.params);
  }

  function goHome() {
    if (navStack.length <= 1) return; // already at the bottom of the stack
    navStack.length = 1; // navStack[0] is always {id:'desktop', params:null}
    switchTo('desktop', null);
  }

  closeBtn.addEventListener('click', goBack);
  homeBtn.addEventListener('click', goHome);

  function renderActive() {
    if (activeAppId && apps[activeAppId]) {
      apps[activeAppId].render(jobsById, activeParams);
    }
  }

  function findJobByType(type) {
    var found = null;
    jobsById.forEach(function (job) {
      if (job.type === type) found = job;
    });
    return found;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  // "Open with": lists every real handler app registered for this
  // file's extension (never the built-in viewers themselves — they
  // aren't handlers, see the top-of-file state block). The dropdown
  // just picks a candidate; "Open" navigates to it (replacing the
  // viewer's own stack entry); "Set as default" promotes whichever
  // candidate is currently picked, without navigating — kept as a
  // separate action rather than firing on the dropdown's change event,
  // since navigating away immediately would destroy this control
  // before "Set as default" could ever apply to anything but the
  // already-current default.
  function renderOpenWith(container, currentAppId, path) {
    var ext = path.substring(path.lastIndexOf('.'));
    var handlers = extensionHandlers[ext] || [];
    // currentAppId (always a viewer) is never itself in
    // extensionHandlers, so even a single real handler is a genuine
    // alternative to the read-only viewer — suppress only when
    // there's truly nothing to switch to.
    if (handlers.length < 1) { container.innerHTML = ''; return; }

    var defaultId = preferences.defaultHandlers[ext];

    container.innerHTML = '<label>Open with: <select id="open-with-select">' +
      handlers.map(function (h) {
        return '<option value="' + escapeHtml(h.id) + '"' + (h.id === defaultId ? ' selected' : '') + '>' + escapeHtml(h.name) + '</option>';
      }).join('') + '</select></label>' +
      ' <button type="button" id="open-with-go">Open</button>' +
      (handlers.length > 1 ? ' <button type="button" id="open-with-set-default">Set as default</button>' : '');

    document.getElementById('open-with-go').addEventListener('click', function () {
      var selectedId = document.getElementById('open-with-select').value;
      launchApp(selectedId, { path: path }, { replace: true });
    });

    var setDefaultBtn = document.getElementById('open-with-set-default');
    if (setDefaultBtn) {
      setDefaultBtn.addEventListener('click', function () {
        var selectedId = document.getElementById('open-with-select').value;
        preferences.defaultHandlers[ext] = selectedId;
        savePreferences();
        renderOpenWith(container, currentAppId, path); // re-render with the updated default pre-selected
      });
    }
  }

  function mimeTypeForName(name) {
    var dot = name.lastIndexOf('.');
    var ext = dot >= 0 ? name.substring(dot).toLowerCase() : '';
    return spirit.core.const.MIME_TYPES[ext] || 'application/octet-stream';
  }

  function classifyMimeType(mimeType) {
    if (mimeType.indexOf('image/') === 0) return 'image';
    if (mimeType.indexOf('audio/') === 0) return 'audio';
    if (mimeType.indexOf('video/') === 0) return 'video';
    if (mimeType.indexOf('text/') === 0 || mimeType.indexOf('javascript') !== -1 || mimeType.indexOf('json') !== -1) return 'code';
    return null;
  }

  function iconForFile(mimeType) {
    var category = classifyMimeType(mimeType);
    if (category === 'image' || category === 'audio' || category === 'video') return ICON.VIEW;
    if (category === 'code') return ICON.CODE;
    return ICON.FILE;
  }

  var CATEGORY_APP_HANDLERS = {
    code: 'code-viewer',
    image: 'media-viewer',
    audio: 'media-viewer',
    video: 'media-viewer',
  };

  // Shared by both viewers: replaces the plain "app name" titlebar
  // with the filename plus a bail-out button, always. "Open " (making
  // it a yes/no question) only prefixes the filename when there's
  // actually something to say yes/no TO — a real handler registered
  // for this extension; with no handler, it's just the filename, no
  // question implied. The button reads as an "oops, wrong file"
  // bail-out rather than a formal decline, hence ICON.ERROR instead of
  // a "No" label — same action as the existing Back arrow either way.
  function setViewerTitle(path) {
    var ext = path.substring(path.lastIndexOf('.'));
    var hasHandler = !!(extensionHandlers[ext] && extensionHandlers[ext].length > 0);
    var filename = path.substring(path.lastIndexOf('/') + 1);

    titleEl.innerHTML = (hasHandler ? 'Open ' : '') + escapeHtml(filename) + (hasHandler ? '?' : '') +
      ' <button type="button" class="cancel-btn" id="viewer-no-btn">' + ICON.ERROR + '</button>';
    document.getElementById('viewer-no-btn').addEventListener('click', goBack);
  }

  // Shared by both viewers: the info bubble a user needs to decide
  // whether this is really the file they meant to open — path is
  // always known; size/changed/created come from statFile and are
  // simply omitted if the stat call fails (e.g. a race with the file
  // being deleted) rather than showing misleading blanks.
  function fileInfoRow(label, value) {
    return '<div class="file-info-row"><span class="file-info-label">' + label + ':</span><span>' + value + '</span></div>';
  }

  function renderFileInfoBubble(path) {
    var stats = spirit.core.fs.statFile(path);
    var rows = fileInfoRow('Path', escapeHtml(path));
    if (stats) {
      rows +=
        fileInfoRow('Size', spirit.core.util.formatBytes(stats.size)) +
        fileInfoRow('Changed', new Date(stats.mtimeMs).toLocaleString()) +
        fileInfoRow('Created', new Date(stats.birthtimeMs).toLocaleString());
    }
    return '<div class="stat-tile wide">' + rows + '</div>';
  }

  // Dynamically-loaded apps: discovery reads only each app's manifest
  // (app/<name>/<name>.json — same folder/basename convention process/
  // manifests already use) and declares it fully (icon, handler
  // registration) without touching the .js at all. The script itself
  // is fetched for the first time only when launchApp actually needs
  // it (see launchApp's lazy-load branch, above) — an app nobody uses
  // costs nothing beyond this one small JSON read. One-shot, not
  // live-reactive — a new app added while the page is already open
  // needs a reload to be discovered, same as you'd already expect for
  // a new process manifest.
  function declareDynamicApp(manifest, scriptPath) {
    apps[manifest.id] = {
      id: manifest.id,
      name: manifest.name,
      icon: spirit.core.const.ICON[manifest.icon] || spirit.core.const.ICON.FILE,
      hidden: !!manifest.hidden,
      mount: function (container) { container.textContent = 'Loading ' + manifest.name + '…'; },
      render: function () {},
      _scriptPath: scriptPath,
      _activated: false,
    };

    (manifest.handlesExtensions || []).forEach(function (ext) {
      registerExtensionHandler(ext, manifest.id, manifest.name);
    });

    if (!manifest.hidden) createDesktopIcon(manifest.id, manifest.name, apps[manifest.id].icon);
  }

  function discoverDynamicApps(jobs) {
    var fsWatcherJob = jobs.find(function (j) { return j.type === 'fs-watcher'; });
    if (!fsWatcherJob || !fsWatcherJob.data || !Array.isArray(fsWatcherJob.data.files)) return;

    var appEntryPattern = /^app\/([^/]+)\/\1\.js$/;
    fsWatcherJob.data.files.forEach(function (f) {
      if (f.kind !== 'file' || !appEntryPattern.test(f.relativePath)) return;
      var manifestRaw = spirit.core.fs.loadFile(f.relativePath.replace(/\.js$/, '.json'));
      if (manifestRaw == null) return; // no manifest, no discovery — same rule process/ already uses
      try { declareDynamicApp(JSON.parse(manifestRaw), f.relativePath); } catch (e) { /* malformed manifest — skip */ }
    });
  }

  // Minimal surface for dynamically-loaded apps (app/<name>/<name>.js,
  // injected as a plain <script> tag — see discoverDynamicApps above)
  // and for the built-in apps' own registration code, which now lives
  // in index.html as a separate top-level script with no closure access
  // to anything defined in this file. window.spirit is the only thing
  // either of them can already see, so this rides on it rather than
  // inventing a new global.
  spirit.shell = {
    registerApp: registerApp,
    launchApp: launchApp,
    escapeHtml: escapeHtml,
    activateApp: activateApp,
    renderOpenWith: renderOpenWith,
    findJobByType: findJobByType,
    mimeTypeForName: mimeTypeForName,
    classifyMimeType: classifyMimeType,
    iconForFile: iconForFile,
    CATEGORY_APP_HANDLERS: CATEGORY_APP_HANDLERS,
    setViewerTitle: setViewerTitle,
    fileInfoRow: fileInfoRow,
    renderFileInfoBubble: renderFileInfoBubble,
  };

  // ---- Shared data subscription (page-lifetime, not app-lifetime) ----
  spirit.core.jobs.subscribe({
    onSnapshot: function (jobs) {
      jobsById.clear();
      jobs.forEach(function (job) { jobsById.set(job.id, job); });
      discoverDynamicApps(jobs);
      renderActive();
    },
    onUpdate: function (job) {
      jobsById.set(job.id, job);
      renderActive();
    },
    onDelete: function (id) {
      jobsById.delete(id);
      renderActive();
    },
  });
})();
