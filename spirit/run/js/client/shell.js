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
  var preferences = { defaultHandlers: {}, appOverrides: {} };
  if (preferencesRaw != null) {
    try {
      preferences = JSON.parse(preferencesRaw);
      preferences.defaultHandlers = preferences.defaultHandlers || {};
      // Sparse, per-app user overrides — {name?, icon?} so far — keyed by
      // app id. A key's absence means "use the app's own default for that
      // property," so nothing changes for anyone until a property is
      // actually customized. Named distinctly from defaultHandlers, which
      // is a different kind of preference (file extension -> handler app).
      preferences.appOverrides = preferences.appOverrides || {};
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

  // Raw override object for one app — {} if nothing's been customized.
  // For an edit UI to read current values from (e.g. pre-filling a "custom
  // name" input), distinct from effectiveName()/listApps() which resolve
  // the value actually shown.
  function getAppOverride(id) {
    return preferences.appOverrides[id] || {};
  }

  // Strips punctuation/whitespace down to single-space-separated tokens,
  // lowercased — "LM-Chat" and "LM Chat" both normalize to "lm chat" and
  // so count as the same name, while genuinely different word order/
  // content ("AI Chat" vs "Chat AI") still doesn't. Confirmed live: a user
  // was able to name two apps "LM-Chat" and "LM Chat" before this existed,
  // which read as the same name at a glance despite being distinct strings.
  function normalizeForComparison(value) {
    return String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  // Icons are glyphs, not words — stripping "non-alphanumeric" characters
  // (normalizeForComparison's approach) would reduce nearly every emoji to
  // an empty string and make everything collide with everything. Just trim
  // stray whitespace and compare the glyph itself.
  function normalizeIconForComparison(value) {
    return String(value).trim();
  }

  // True if `candidateValue` (normalized via `normalize`) matches ANY of
  // the values valuesFor(otherApp) returns, for some OTHER app — i.e.
  // would collide if `id` adopted it. valuesFor should return both an
  // app's CURRENT effective value and its true default/registered value,
  // not just the former: otherwise an app's own default name/icon isn't
  // reserved for it while overridden away from it, so a second app could
  // grab "Foo" while its rightful owner is temporarily showing "Bar" — and
  // that owner's later "Reset to default" would then itself collide,
  // unable to reclaim its own identity. `normalize` is passed in rather
  // than hardcoded since name and icon need different rules (see
  // normalizeForComparison vs normalizeIconForComparison, above/below).
  function collidesWithAnotherApp(id, candidateValue, valuesFor, normalize) {
    var normalized = normalize(candidateValue);
    return Object.keys(apps).some(function (otherId) {
      if (otherId === id) return false;
      return valuesFor(apps[otherId]).some(function (v) {
        return normalize(v) === normalized;
      });
    });
  }

  // Merges patch into an app's override object; a property set to '' or
  // null clears that one property (reverting just it to default) rather
  // than clearing the whole override. Removes the app's entry entirely
  // once no properties remain, keeping appOverrides sparse. Note for
  // boolean properties (visible): false is a real, meaningful value, not
  // "unset" — only '' or null clears, so `{visible: false}` correctly
  // persists an explicit "hidden" choice rather than being mistaken for a
  // reset-to-default.
  //
  // Renaming is locked for built-in shell utilities (Stats, Files,
  // Processes, Jobs, Spirit, Apps, the viewers — anything not
  // dynamically-loaded, i.e. no _scriptPath). Letting a user rename these
  // would make any written documentation, support conversation, or future
  // help screen that refers to "the Jobs app" silently stop matching what's
  // actually on screen — a cost dynamically-loaded apps (AI Chat, Text
  // Editor, anything installed later) don't carry the same way, since
  // nothing calls them out by a fixed name in core docs. Enforced here,
  // not just left to the UI, so nothing else that ever calls this can
  // bypass it either.
  //
  // Also rejects a name/icon that would collide with any other app's
  // current effective value OR true default value — checked against the
  // RESULT of applying patch (so clearing back to a default is checked
  // too, not just setting a new custom one), since two apps showing the
  // same name or icon is confusing regardless of which one has the
  // override. Icon isn't locked to dynamic apps the way name is — the
  // "written docs/support text goes stale" argument for the name lock is
  // specifically about a fixed name being referenced in prose; nothing
  // calls an app out by "the 📊 icon" the same way, so customizing a
  // built-in's icon is just cosmetic personalization, not a documentation
  // hazard.
  function setAppOverride(id, patch) {
    var app = apps[id];
    if (patch.name !== undefined && app && !app._scriptPath) {
      return { ok: false, reason: 'core-app-name-locked' };
    }

    var current = preferences.appOverrides[id] || {};
    var merged = {};
    Object.keys(current).forEach(function (key) { merged[key] = current[key]; });
    Object.keys(patch).forEach(function (key) {
      if (patch[key] === null || patch[key] === '') {
        delete merged[key];
      } else {
        merged[key] = patch[key];
      }
    });

    if (patch.name !== undefined && app) {
      var resultingName = merged.name || app.name;
      var nameCollides = collidesWithAnotherApp(id, resultingName, function (otherApp) {
        return [effectiveName(otherApp), otherApp.name];
      }, normalizeForComparison);
      if (nameCollides) return { ok: false, reason: 'name-collision' };
    }

    if (patch.icon !== undefined && app) {
      var resultingIcon = merged.icon || app.icon;
      var iconCollides = collidesWithAnotherApp(id, resultingIcon, function (otherApp) {
        return [effectiveIcon(otherApp), otherApp.icon];
      }, normalizeIconForComparison);
      if (iconCollides) return { ok: false, reason: 'icon-collision' };
    }

    if (Object.keys(merged).length === 0) {
      delete preferences.appOverrides[id];
    } else {
      preferences.appOverrides[id] = merged;
    }
    savePreferences();
    renderDesktop(); // reflect a name/icon change on the real desktop immediately, not just wherever this was called from
    return { ok: true };
  }

  // Single source of truth for "what name does the user actually see for
  // this app" — an appOverrides.name entry wins if present, otherwise the
  // app's own registered/manifest name. Used by both the icon renderer and
  // listApps() so the Apps table never shows something different from
  // what's actually on screen.
  function effectiveName(app) {
    var override = preferences.appOverrides[app.id];
    return (override && override.name) || app.name;
  }

  // Same idea as effectiveName, for icon.
  function effectiveIcon(app) {
    var override = preferences.appOverrides[app.id];
    return (override && override.icon) || app.icon;
  }

  // Same idea again, for visibility — but unlike name/icon, false is a
  // real, meaningful value (not "unset"), so this checks typeof rather
  // than truthiness: an explicit override.visible === false must win over
  // the app's own default, not get treated as absent.
  function effectiveVisible(app) {
    var override = preferences.appOverrides[app.id];
    if (override && typeof override.visible === 'boolean') return override.visible;
    return !app.hidden;
  }

  function buildAppIcon(id) {
    var app = apps[id];
    if (!app) return document.createDocumentFragment(); // shouldn't happen — callers already check

    var iconEl = document.createElement('div');
    iconEl.className = 'app-icon';
    iconEl.innerHTML = '<span class="icon">' + escapeHtml(effectiveIcon(app)) + '</span><span class="label">' + escapeHtml(effectiveName(app)) + '</span>';
    // {replace: true} is a no-op for a real desktop icon click — navStack
    // is always exactly length 1 whenever the desktop is actually visible,
    // and launchApp's replace branch requires length > 1 — but it's exactly
    // right for a grouping app's icon grid (e.g. "spirit"): same stack
    // behavior as picking a handler from "Open with" (renderOpenWith,
    // above) — the launched app replaces the group screen's own stack
    // entry, so Back skips the group menu and returns to wherever it was
    // opened from, rather than back through it.
    iconEl.addEventListener('click', function () { launchApp(id, null, { replace: true }); });
    return iconEl;
  }

  // Rebuilds the whole desktop icon grid from the current app registry +
  // overrides, rather than the old approach of appending one icon once at
  // registration time and never revisiting it. That additive approach
  // meant a name/icon override set via the Apps table never reached the
  // real desktop until a full page reload — this app might not even be
  // the active screen right now (desktop can be hidden behind the app
  // container), but rebuilding it while hidden is harmless and it'll be
  // correct whenever the user navigates home. Cheap enough to call after
  // every registration and every successful override save; the icon grid
  // is small and each icon is a plain DOM element with no state to lose.
  function renderDesktop() {
    desktopEl.innerHTML = '';
    Object.keys(apps).forEach(function (id) {
      if (effectiveVisible(apps[id])) desktopEl.appendChild(buildAppIcon(id));
    });
  }

  // Enumerates every registered app (built-in + already-discovered dynamic
  // apps), regardless of its own hidden flag — read-only aside from
  // resolving name/icon overrides through effectiveName()/effectiveIcon(),
  // same as the real icon rendering. The data behind the Apps list screen;
  // a future user-controlled visibility toggle would build on this.
  function listApps() {
    return Object.keys(apps).map(function (id) {
      var app = apps[id];
      return {
        id: app.id,
        name: effectiveName(app),
        defaultName: app.name,
        icon: effectiveIcon(app),
        defaultIcon: app.icon,
        visible: effectiveVisible(app),
        hidden: !!app.hidden, // the app's own code-level default, distinct from `visible` (post-override)
        dynamic: !!app._scriptPath,
      };
    });
  }

  // Reusable grouping template: renders the same icon grid the real
  // desktop uses, scoped to an arbitrary container and an arbitrary list
  // of already-registered app ids. This is the mechanism behind a
  // launcher app like "spirit" that hosts a sub-view of other intrinsic
  // apps (Stats/Processes/Jobs, hidden from the real desktop) rather than
  // each such grouping app hand-rolling its own icon grid. Unregistered
  // or not-yet-registered ids are silently skipped rather than throwing.
  function renderAppGroup(container, appIds) {
    container.innerHTML = '';
    appIds.forEach(function (id) {
      if (!apps[id]) return;
      container.appendChild(buildAppIcon(id));
    });
  }

  function registerApp(app) {
    apps[app.id] = app;
    if (app.hidden) return; // reachable only via launchApp(id, params) from another app, no desktop icon
    renderDesktop();
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
    // activateApp to supply real mount/render. pendingActivationId records
    // which app this particular injected script is for, so activateApp
    // (below) never has to trust anything the script itself claims about
    // its own identity — proven identity (the shell knows what it just
    // injected), not claimed identity (the script stating an id).
    if (appEntry._scriptPath && !appEntry._activated) {
      pendingActivationId = id;
      var script = document.createElement('script');
      script.src = '/' + appEntry._scriptPath;
      script.onload = function () { switchTo(id, params); };
      document.body.appendChild(script);
      return;
    }

    switchTo(id, params);
  }

  // Set by launchApp immediately before injecting a dynamic app's script,
  // read (and cleared) by activateApp when that script's own top-level
  // code calls it during that same synchronous execution.
  var pendingActivationId = null;

  // A manifest-declared app's script has nothing left to say except its
  // behavior — id/name/icon/hidden/handlesExtensions are already fully
  // known from the manifest (declareDynamicApp, below), and its identity
  // is proven by which script the shell itself just injected (see
  // launchApp/pendingActivationId), not by anything the script states
  // about itself — hence no id parameter here. So it never calls
  // registerApp (which stays completely unrelated to this declare/
  // activate lifecycle and is only ever used by static apps); it calls
  // this instead.
  function activateApp(behavior) {
    var id = pendingActivationId;
    if (!id || !apps[id]) return; // called outside a pending script load — nothing to attach to
    apps[id].mount = behavior.mount;
    apps[id].render = behavior.render;
    apps[id]._activated = true;
    pendingActivationId = null;
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
  //
  // The id is derived from scriptPath's own folder ("app/aiChat"), not
  // read from manifest.id — an app's manifest can no longer claim to be
  // whatever id it likes; its identity is the one fact the shell already
  // observed directly via the fs-watcher. manifest.id, if a manifest still
  // has one, is simply ignored.
  function declareDynamicApp(manifest, scriptPath) {
    var id = 'app/' + scriptPath.match(/^app\/([^/]+)\//)[1];
    apps[id] = {
      id: id,
      name: manifest.name,
      icon: spirit.core.const.ICON[manifest.icon] || spirit.core.const.ICON.FILE,
      hidden: !!manifest.hidden,
      mount: function (container) { container.textContent = 'Loading ' + manifest.name + '…'; },
      render: function () {},
      _scriptPath: scriptPath,
      _activated: false,
    };

    (manifest.handlesExtensions || []).forEach(function (ext) {
      registerExtensionHandler(ext, id, manifest.name);
    });

    if (!manifest.hidden) renderDesktop();
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
    renderAppGroup: renderAppGroup,
    listApps: listApps,
    getAppOverride: getAppOverride,
    setAppOverride: setAppOverride,
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
