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
  // ---- First run ----
  //
  // A clone ships pointed at one public mailbox and nothing else, so
  // until this node has claimed a name there is exactly one thing it can
  // do: bind to a mailbox. A desktop of apps that all need one is a menu
  // of dead ends; showing one icon is the whole instruction.
  //
  // That app is Natter — the relay list is also where a claim happens
  // (packet 3), which is why the escape hatch this rule used to carry
  // could go: an unbound node cannot be sent to an app it is not shown,
  // because the app it is shown IS the one with the URL list in it.
  //
  // "Bound" is readNodeLabel() below — the same accessor the window
  // title uses, so the two can never disagree about whether this node
  // has a name.
  var NATTER_ID = 'app/natter';

  // Whether the first-run rule applies at all.
  //
  // Fails OPEN, deliberately: if the binder is not registered yet there
  // is nothing to show, and an empty desktop that never fills is worse
  // than a moment of the full one. Natter is intrinsic and declared at
  // boot, so in practice this holds from the first paint. Gating before then would paint an empty desktop — and if
  // that snapshot never came, an empty desktop with no way out. Better a
  // moment of the full desktop that then collapses to one icon than a
  // node with nothing on it.
  function firstRun() {
    if (readNodeLabel()) return false;
    return !!apps[NATTER_ID];
  }

  // One rule, asked by everything that lists apps — the desktop, the
  // Apps manager and the Spirit grid — rather than three id lists that
  // drift apart. Hidden here means not SHOWN: every app stays
  // registered, and launchApp by id keeps working, which is what viewers
  // and app-to-app jumps depend on.
  function shownOnFirstRun(id) {
    return id === NATTER_ID;
  }

  function hiddenByFirstRun(id) {
    return firstRun() && !shownOnFirstRun(id);
  }

  // An unbound node does not get a desktop with one icon on it — it gets
  // the binder, open.
  //
  // Natter is intrinsic, so its tile lives in the Spirit group, and the
  // gate hides Spirit along with everything else. The desktop of an
  // unbound node is therefore EMPTY: somebody opening 127.0.0.1:65432 on
  // a fresh clone saw a black page and had nothing to click. Drawing a
  // tile would mean a second rule about where an intrinsic app's icon
  // sits, for a tile that vanishes after the first claim; opening the
  // app needs no icon at all.
  //
  // launchApp does the lazy script fetch a click would have done, so
  // this is the same path by a different trigger.
  function openBinderIfUnbound() {
    if (!firstRun()) return;
    if (activeAppId === NATTER_ID) return; // already there; do not restack
    launchApp(NATTER_ID);
  }

  // Back and Home while unbound would land on that same empty desktop.
  // There is nowhere else to be until this node has a name, so the two
  // buttons are not drawn — the same rule as every other control that
  // could not do anything in the state it is offered in.
  function paintTitlebarChrome() {
    var nowhereElse = firstRun();
    if (closeBtn) closeBtn.style.display = nowhereElse ? 'none' : '';
    if (homeBtn) homeBtn.style.display = nowhereElse ? 'none' : '';
  }

  // ---- The window title ----
  //
  // The browser tab is the only place that says WHICH node you are
  // looking at. Testing means several of them open at once — andy, bert,
  // jim — and identical tabs reading "SpiritOS" are unusable for that.
  // So the shell owns document.title, and it reads:
  //
  //   SpiritOS                   no public label, no app open
  //   andy                       a claimed label, no app open
  //   Relay Chat                 an app, before this node claimed
  //   andy - Relay Chat          the ordinary case
  //   andy - media/dog.png       a viewer, showing what it shows
  //
  // THE WORD "spirit" USED TO LEAD EVERY ONE OF THOSE, and it went
  // (Andy): favicon.svg is a ghost in the tab already, so the brand was
  // being said twice — once in a picture and once in the eight
  // characters in front of the only part that differs between tabs. With
  // a dozen tabs open the browser truncates from the right, so those
  // eight characters were spent pushing the label out of view.
  //
  // The bare "SpiritOS" stays for a node with nothing to say: no label,
  // no app, and an empty title shows the URL instead.
  //
  // The label is the one Relay Chat claimed and stored. The shell reads
  // that file directly: reading across app folders is what a component
  // above the app layer is for, and the alternative — asking the mailbox
  // at boot — would put a network round trip in front of the first
  // paint, to answer a question a local file already answers. A stale
  // label costs nothing here; a slow boot costs every boot.
  //
  // Nothing is cached once found for good: an unbound node re-reads on
  // each paint, so claiming a name in Relay Chat titles the tab on the
  // next navigation instead of waiting for a reload. A node that already
  // has its label never reads again.
  var nodeLabel = '';

  function readNodeLabel() {
    if (nodeLabel) return nodeLabel;
    try {
      var raw = spirit.core.fs.loadFile('app/natter/session.json');
      if (raw == null) return '';
      var parsed = JSON.parse(raw);
      nodeLabel = String((parsed && parsed.label) || '').trim();
    } catch (e) {
      nodeLabel = '';
    }
    return nodeLabel;
  }

  // `detail` is whatever the screen is actually showing: an app's name,
  // or a viewer's file. Nothing else goes in — an unread count or any
  // other number that changes on its own would make the tab move while
  // somebody is reading it, and finding the right tab is the whole job.
  function paintWindowTitle(detail) {
    var label = readNodeLabel();
    var parts = [];
    if (label) parts.push(label);
    if (detail) parts.push(detail);
    document.title = parts.length ? parts.join(' - ') : 'SpiritOS';
  }

  var preferencesRaw = spirit.core.fs.loadFile('preferences.json');
  var preferences = { defaultHandlers: {}, appOverrides: {}, groups: {} };
  if (preferencesRaw != null) {
    try {
      preferences = JSON.parse(preferencesRaw);
      preferences.defaultHandlers = preferences.defaultHandlers || {};
      // Sparse, per-app user overrides — {name?, icon?, group?} — keyed by
      // app id. A key's absence means "use the app's own default for that
      // property," so nothing changes for anyone until a property is
      // actually customized. Named distinctly from defaultHandlers, which
      // is a different kind of preference (file extension -> handler app).
      preferences.appOverrides = preferences.appOverrides || {};
      // User-created group definitions ({name, icon}), keyed by a
      // shell-generated id (never the group's own name — see createGroup).
      // Membership lives in appOverrides[appId].group, not here — this is
      // just the group's own identity.
      preferences.groups = preferences.groups || {};
    } catch (e) { /* malformed — fall back to empty defaults */ }
  }

  function savePreferences() {
    spirit.core.fs.saveFile('preferences.json', JSON.stringify(preferences, null, 2));
  }

  // An app's id is its folder once it is a dynamic app: 'jobs' becomes
  // 'app/jobs' the day Jobs moves into app/jobs/. Everything the operator
  // customised is keyed by that id — appOverrides by key, defaultHandlers
  // by value — and pruneStalePreferences (below) deletes every entry
  // naming an app it cannot find, then saves. So on the first load after
  // a move, without this, the shell quietly throws away the custom names,
  // icons, group placements and "open .md with" choices for every app
  // that moved, and there is nothing to undo it with.
  //
  // One line per move, added in the same commit as the move — a map that
  // lands afterwards lands after prune has already thrown the overrides
  // away. Stats, Jobs, Apps and Processes moved (CLEANUP-PLAN steps 5.1
  // to 5.4); Files and Groups keep their index.html ids until they
  // follow.
  //
  // Entries stay forever. The operator whose preferences.json still says
  // 'stats' may be opening this shell for the first time in a year.
  var APP_ID_RENAMES = {
    stats: 'app/stats',
    jobs: 'app/jobs',
    'app-manager': 'app/apps',
    'process-browser': 'app/process-browser',
    files: 'app/files',
    'group-manager': 'app/group-manager',
  };

  // Runs at load, which is before any snapshot and therefore before
  // pruneStalePreferences can see the old keys. Takes the map as an
  // argument so a test can drive it with a non-identity one; production
  // always passes the map above.
  function migrateAppIds(renames) {
    var map = renames || APP_ID_RENAMES;
    var changed = false;

    Object.keys(map).forEach(function (oldId) {
      var newId = map[oldId];

      if (preferences.appOverrides[oldId] !== undefined) {
        // An override already stored under the new id wins — it was
        // written by the operator after the move, so it is the newer
        // intent, and re-running a migration must never undo it.
        if (preferences.appOverrides[newId] === undefined) {
          preferences.appOverrides[newId] = preferences.appOverrides[oldId];
        }
        delete preferences.appOverrides[oldId];
        changed = true;
      }

      Object.keys(preferences.defaultHandlers).forEach(function (ext) {
        if (preferences.defaultHandlers[ext] === oldId) {
          preferences.defaultHandlers[ext] = newId;
          changed = true;
        }
      });
    });

    if (changed) savePreferences();
    return changed;
  }

  migrateAppIds();

  // Deleting an app's files by any means other than the shell's own UI
  // (by hand, via Text Editor, from another tab) leaves its
  // appOverrides/defaultHandlers entries behind forever otherwise —
  // nothing else ever revisits them, since a deleted dynamic app simply
  // never gets (re)declared again, it isn't actively un-declared. Called
  // once, from onSnapshot below, after discoverDynamicApps has fully
  // populated `apps` from the fresh fs-watcher scan — not any earlier,
  // since a real still-existing dynamic app that just hasn't been
  // discovered YET would otherwise look identical to a deleted one and
  // have its overrides wrongly stripped. Deletion reaching the shell
  // through its own UI (deleteGroup, etc.) already cleans up after
  // itself; this only ever has anything to do on the rare path around it.
  //
  // An app whose ID changed is not a deleted app, and this cannot tell
  // the difference — migrateAppIds (above) runs at load, before any
  // snapshot reaches here, so by the time this runs the keys already name
  // the apps that exist.
  function pruneStalePreferences() {
    var changed = false;

    Object.keys(preferences.appOverrides).forEach(function (id) {
      if (!apps[id]) {
        delete preferences.appOverrides[id];
        changed = true;
      }
    });

    Object.keys(preferences.defaultHandlers).forEach(function (ext) {
      if (!apps[preferences.defaultHandlers[ext]]) {
        delete preferences.defaultHandlers[ext];
        changed = true;
      }
    });

    if (changed) savePreferences();
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
  // once no properties remain, keeping appOverrides sparse.
  //
  // Renaming and regrouping are both locked for built-in shell utilities
  // (Stats, Files, Processes, Jobs, Spirit, Apps, Groups, the viewers —
  // anything not dynamically-loaded, i.e. no _scriptPath). For name: a
  // written doc, support conversation, or future help screen that refers
  // to "the Jobs app" should always match what's actually on screen — a
  // cost dynamically-loaded apps (AI Chat, Text Editor, anything installed
  // later) don't carry the same way, since nothing calls them out by a
  // fixed name in core docs. For group: built-in apps' placement is
  // curated by code (Spirit's own fixed member list) — reassigning them
  // would fight that curation, and the whole point of groups is to
  // organize the open-ended, growing set of installed apps, not the small
  // fixed set the shell ships with. Both enforced here, not just left to
  // the UI, so nothing else that ever calls this can bypass either lock.
  //
  // Also rejects a name/icon that would collide with any other app's (or
  // group's — see collidesWithAnotherApp) current effective value OR true
  // default value — checked against the RESULT of applying patch (so
  // clearing back to a default is checked too), since two things showing
  // the same name or icon is confusing regardless of which one has the
  // override. group has no collision check at all — any number of apps may
  // share a group, or all be "none," with no ambiguity.
  //
  // Icon used to be the exception: the argument was that "written docs go
  // stale" is about a name in prose and nothing calls an app out by its
  // 📊, so a built-in's icon was cosmetic personalization. Andy's verdict
  // (CLEANUP-PLAN step 1) is that it is not — a shell app IS its tile on
  // a screen with no labels to read, and the five that are about to move
  // into app/<name>/ must already be locked the way they will have to be
  // afterwards. So icon is locked exactly where name is.
  //
  // Note what this lock is keyed on: `!app._scriptPath`, which stops
  // being true the moment those five get a folder. `intrinsic` is what
  // carries it then (below), and it has to be in place first — that is
  // the whole reason step 1 comes before the moves.
  function setAppOverride(id, patch) {
    var app = apps[id];
    if (patch.name !== undefined && app && !app._scriptPath) {
      return { ok: false, reason: 'core-app-name-locked' };
    }
    if (patch.icon !== undefined && app && !app._scriptPath) {
      return { ok: false, reason: 'core-app-icon-locked' };
    }
    if (patch.group !== undefined && app && !app._scriptPath) {
      return { ok: false, reason: 'core-app-group-locked' };
    }
    // An intrinsic app has no location to set: Spirit is the only one.
    // Locked here rather than only in the UI, for the same reason the
    // built-in locks above are — nothing that calls this may bypass it.
    if (patch.group !== undefined && app && app.intrinsic) {
      return { ok: false, reason: 'intrinsic-app-group-locked' };
    }
    // Name and icon stay as shipped, for the same reason a built-in's
    // name is locked: an intrinsic app is what this node IS, and a
    // renamed Natter is a mailbox list nobody can be told to open. It
    // also has to hold before the five in index.html move — their lock
    // today is `!app._scriptPath`, which dies the moment they get one
    // (CLEANUP-PLAN step 1, AGENT.md).
    if (patch.name !== undefined && app && app.intrinsic) {
      return { ok: false, reason: 'intrinsic-app-name-locked' };
    }
    if (patch.icon !== undefined && app && app.intrinsic) {
      return { ok: false, reason: 'intrinsic-app-icon-locked' };
    }
    if (patch.group && patch.group !== 'none' && !preferences.groups[patch.group]) {
      return { ok: false, reason: 'group-not-found' }; // stale/bogus group id — e.g. deleted elsewhere
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
    renderDesktop(); // reflect a name/icon/group change on the real desktop immediately, not just wherever this was called from
    return { ok: true };
  }

  // Single source of truth for "what name does the user actually see for
  // this app" — an appOverrides.name entry wins if present, otherwise the
  // app's own registered/manifest name. Used by both the icon renderer and
  // listApps() so the Apps table never shows something different from
  // what's actually on screen.
  //
  // An intrinsic app reads its shipped name, override or not — the same
  // both-sides lock effectiveGroup uses: refusing the write alone would
  // still leave a preferences.json written before the app was pinned (or
  // edited by hand) renaming it on every load.
  function effectiveName(app) {
    if (app.intrinsic || !app._scriptPath) return app.name;
    var override = preferences.appOverrides[app.id];
    return (override && override.name) || app.name;
  }

  // Same idea as effectiveName, for icon — and for a built-in, which is
  // locked by having no script path rather than by a manifest flag.
  function effectiveIcon(app) {
    if (app.intrinsic || !app._scriptPath) return app.icon;
    var override = preferences.appOverrides[app.id];
    return (override && override.icon) || app.icon;
  }

  // The Spirit app's own id — the launcher that already hosts the
  // machine-introspection apps (Stats, Processes, Jobs, Apps, Groups).
  // It is not a preferences.groups entry and never becomes one: user
  // groups are created and deleted by the operator, and this one is part
  // of the shell.
  var SPIRIT_GROUP_ID = 'spirit';

  // Where a dynamic app currently lives: null means Desktop (the default —
  // nothing stored), "none" means no icon anywhere, anything else is a
  // real preferences.groups id. Built-in apps never have this set (locked
  // in setAppOverride) so this is only ever meaningful for _scriptPath apps.
  //
  // An intrinsic app is in the Spirit group and the override is not
  // consulted at all: a stored "none" from before it was pinned, or a
  // hand-edited preferences.json, must not be able to strand it. This is
  // the read side of the same lock setAppOverride enforces on the write
  // side — both, because either alone leaves a way in.
  function effectiveGroup(app) {
    if (app.intrinsic) return SPIRIT_GROUP_ID;
    var override = preferences.appOverrides[app.id];
    return (override && override.group) || null;
  }

  // Every intrinsic app, for the Spirit app's icon grid to append to its
  // own fixed member list. Sorted by id so the grid does not reshuffle
  // between reloads on discovery order.
  function listIntrinsicApps() {
    return Object.keys(apps).filter(function (id) { return apps[id].intrinsic; }).sort();
  }

  // Every app currently assigned to this group (effectiveGroup === groupId).
  function membersOfGroup(groupId) {
    return Object.keys(apps).filter(function (id) { return effectiveGroup(apps[id]) === groupId; });
  }

  function buildAppIcon(id) {
    var app = apps[id];
    if (!app) return document.createDocumentFragment(); // shouldn't happen — callers already check

    var iconEl = document.createElement('div');
    iconEl.className = 'app-icon';
    iconEl.innerHTML = '<span class="icon">' + escapeHtml(effectiveIcon(app)) + '</span><span class="label">' + escapeHtml(effectiveName(app)) + '</span>';
    // A plain push, from the desktop and from a group grid alike. This
    // used to pass {replace: true}, which was a no-op on the desktop
    // (navStack is exactly length 1 whenever the desktop is visible, and
    // launchApp's replace branch requires length > 1) but on a group grid
    // overwrote the grid's own stack entry — so Spirit vanished the
    // moment you tapped something in it, and Back from Stats landed on
    // the desktop rather than back in Spirit.
    //
    // Andy's verdict: a group screen is a real place you can go back to,
    // Spirit included, and it is treated like any other app. That is one
    // rule for every grid, so a user's own group behaves the way Spirit
    // does rather than having its own answer.
    //
    // "Open with" is the one caller that still elides itself
    // (renderOpenWith, below) and it should: the read-only preview is a
    // step on the way to the handler, not a destination.
    iconEl.addEventListener('click', function () { launchApp(id, null); });
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
      var app = apps[id];
      if (app.hidden) return; // built-in, coded hidden — untouched by any of this
      if (hiddenByFirstRun(id)) return; // an unbound node has one thing to do
      // An intrinsic app is excluded here like any other grouped app —
      // effectiveGroup returns Spirit for it, and that is where its icon
      // is, one tap from the desktop and never at the operator's mercy.
      if (app._scriptPath && effectiveGroup(app)) return; // dynamic app assigned to a real group, or "none" — either way, not on the desktop
      desktopEl.appendChild(buildAppIcon(id)); // built-ins (non-hidden), unassigned dynamic apps, and groups themselves (always top-level)
    });
  }

  // Enumerates every registered real app (built-in + already-discovered
  // dynamic apps) — excludes groups (_isGroup), which get their own
  // management screen rather than a row here. Read-only aside from
  // resolving name/icon overrides through effectiveName()/effectiveIcon(),
  // same as the real icon rendering. The data behind the Apps list screen.
  function listApps() {
    return Object.keys(apps)
      .filter(function (id) { return !apps[id]._isGroup; })
      .filter(function (id) { return !hiddenByFirstRun(id); })
      .map(function (id) {
      var app = apps[id];
      return {
        id: app.id,
        name: effectiveName(app),
        defaultName: app.name,
        icon: effectiveIcon(app),
        defaultIcon: app.icon,
        group: effectiveGroup(app),
        hidden: !!app.hidden, // the app's own code-level default
        intrinsic: !!app.intrinsic, // part of the node, not an installed app — always on the desktop
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
  // One tile per id, first mention wins. The Spirit app builds its grid
  // from a fixed member list UNION listIntrinsicApps(), and those two
  // halves overlap the moment an app is in both — which is exactly what
  // happens as the five in index.html move into app/<name>/ and become
  // intrinsic (CLEANUP-PLAN steps 2 and 5). Deduping here rather than at
  // that one call site means every grid built on this template, user
  // groups included, gets the same guarantee, and the caller may
  // concatenate freely without knowing what is already in its list.
  function renderAppGroup(container, appIds) {
    container.innerHTML = '';
    var drawn = Object.create(null);
    // Filtered here rather than where the member list is written, so
    // index.html keeps the one list of ids and this stays the one rule
    // about showing them.
    appIds.filter(function (id) { return !hiddenByFirstRun(id); }).forEach(function (id) {
      if (!apps[id] || drawn[id]) return;
      // A HIDDEN APP HAS NO ICON HERE EITHER.
      //
      // renderDesktop has always skipped these; this grid did not, and
      // an app that is both `intrinsic` and `hidden` lands in exactly
      // this grid — effectiveGroup sends every intrinsic app to Spirit.
      // So a dialog got a tile, which is the one thing a dialog must not
      // have.
      //
      // Not cosmetic. The shell's single dialog-result slot is safe
      // because of an invariant stated at callDialog: "a hidden app is
      // only ever entered from a visible one, and only ever left by
      // replacing itself". A tile is a way in from the desktop with no
      // parent underneath, which is precisely the case that invariant
      // says cannot arise.
      if (apps[id].hidden) return;
      drawn[id] = true;
      container.appendChild(buildAppIcon(id));
    });
  }

  // A dropdown for choosing one icon out of the ICON pool, offered to
  // apps as api.ui.elements.createIconSelector.
  //
  // `excludeGlyphs` is an array of GLYPHS already spoken for. Glyphs, not
  // keys: what makes two apps collide is the picture they paint, and
  // aliases mean one picture answers to several names — Contacts and
  // Groups both showed 👥 while holding different keys. Striking a name
  // would leave its aliases to carry the collision back in.
  //
  // Every line is the glyph followed by every name it is keyed under
  // ("❌  Delete, Error, No"), which is Andy's format and the reason this
  // is not a native <select>: native type-ahead matches a prefix of the
  // whole option text, and with the glyph in front, the only typeable
  // prefix would have been the emoji. Owning the widget buys a filter
  // that reads every name on every line instead — `del` finds ❌ through
  // an alias that is not even at the head of its line. The cost is that
  // arrow keys, Enter, Escape and click-outside are ours now.
  //
  // The value is the GLYPH, not the key, because the one consumer today
  // is setAppOverride, which stores a literal glyph in
  // preferences.appOverrides. Anything that ever writes a MANIFEST needs
  // a key instead (kernel.js resolves manifest icons through ICON[...]) —
  // that is what iconIndex.keyFor is for.
  //
  // The root element is the control: it carries .value, it fires a
  // bubbling `change` when a row is picked, and the caller may set an id
  // and data-* on it. So a panel that used to delegate on an <input> keeps
  // working with no change to its handler.
  function createIconSelector(excludeGlyphs, options) {
    options = options || {};
    var iconIndex = window.spiritIconIndex;
    var choices = iconIndex.choices(spirit.core.const.ICON, excludeGlyphs);

    var root = document.createElement('div');
    root.className = 'icon-selector';

    var value = options.value || '';
    var activeIndex = -1;
    var visible = choices;

    // The current glyph is shown even when it is not on the list — a
    // shipped default need not be an ICON member (Relay Chat's manifest
    // carries a literal ☀️ that resolves to 📄), and a field that blanked
    // itself rather than showing what is actually set would be lying.
    function labelFor(glyph) {
      var found = choices.filter(function (c) { return c.glyph === glyph; })[0];
      return found ? found.label : '';
    }

    function paintField() {
      field.innerHTML =
        '<span class="icon-selector-glyph">' + escapeHtml(value) + '</span>' +
        '<span class="icon-selector-name">' + escapeHtml(labelFor(value)) + '</span>' +
        '<span class="icon-selector-caret">' + escapeHtml(spirit.core.const.ICON.POINTDOWN) + '</span>';
    }

    function paintRows() {
      visible = choices.filter(function (c) { return iconIndex.matches(c, filter.value); });
      rows.innerHTML = visible.map(function (c, i) {
        return '<button type="button" class="icon-selector-row' +
          (i === activeIndex ? ' is-active' : '') +
          '" data-glyph="' + escapeHtml(c.glyph) + '">' +
          '<span class="icon-selector-glyph">' + escapeHtml(c.glyph) + '</span>' +
          '<span class="icon-selector-name">' + escapeHtml(c.label) + '</span>' +
          '</button>';
      }).join('') || '<div class="job-log-empty">no icon answers to that</div>';
    }

    var field = document.createElement('button');
    field.type = 'button';
    field.className = 'icon-selector-field';

    var list = document.createElement('div');
    list.className = 'icon-selector-list';
    list.hidden = true;

    var filter = document.createElement('input');
    filter.type = 'text';
    filter.className = 'icon-selector-filter';
    filter.placeholder = 'type a name — delete, folder, arrow';

    var rows = document.createElement('div');
    rows.className = 'icon-selector-rows';

    list.appendChild(filter);
    list.appendChild(rows);
    root.appendChild(field);
    root.appendChild(list);

    // Closing on a click anywhere else is the one behaviour that cannot
    // live on this element, so the listener goes on the document and is
    // taken off again the moment the list shuts. A picker that left one
    // behind would keep answering clicks after the panel that made it had
    // been thrown away by the next render.
    function onDocumentClick(event) {
      if (!root.contains(event.target)) close();
    }

    function open() {
      if (!list.hidden) return;
      list.hidden = false;
      root.setAttribute('data-open', '');
      filter.value = '';
      activeIndex = -1;
      paintRows();
      filter.focus();
      document.addEventListener('click', onDocumentClick);
    }

    function close() {
      if (list.hidden) return;
      list.hidden = true;
      root.removeAttribute('data-open');
      document.removeEventListener('click', onDocumentClick);
    }

    function choose(glyph) {
      value = glyph;
      root.value = glyph;
      paintField();
      close();
      // A real bubbling change, so a delegated handler listening on the
      // table above sees exactly what it saw from the <input> this
      // replaced: event.target with .value and the caller's data-*.
      root.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function move(step) {
      if (!visible.length) return;
      activeIndex = (activeIndex + step + visible.length) % visible.length;
      paintRows();
    }

    field.addEventListener('click', function (event) {
      event.stopPropagation(); // or onDocumentClick would shut it in the same click
      if (list.hidden) open(); else close();
    });

    filter.addEventListener('input', function () {
      activeIndex = -1;
      paintRows();
    });

    rows.addEventListener('click', function (event) {
      var row = event.target.closest('[data-glyph]');
      if (row) choose(row.getAttribute('data-glyph'));
    });

    root.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { close(); field.focus(); return; }
      if (event.key === 'ArrowDown') { event.preventDefault(); move(1); return; }
      if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); return; }
      if (event.key === 'Enter') {
        event.preventDefault();
        // Enter with nothing highlighted takes the only line left, which
        // is what filtering down to one and pressing Enter obviously
        // means. With more than one still showing it means nothing, so it
        // does nothing.
        var pick = activeIndex >= 0 ? visible[activeIndex] : (visible.length === 1 ? visible[0] : null);
        if (pick) choose(pick.glyph);
      }
    });

    root.value = value;
    paintField();
    return root;
  }

  function registerApp(app) {
    apps[app.id] = app;
    if (app.hidden) return; // reachable only via launchApp(id, params) from another app, no desktop icon
    renderDesktop();
  }

  // Enumerates every user-created group with its current membership — the
  // data behind the Groups management screen.
  function listGroups() {
    return Object.keys(preferences.groups).map(function (groupId) {
      var groupDef = preferences.groups[groupId];
      var memberIds = membersOfGroup(groupId);
      return { id: groupId, name: groupDef.name, icon: groupDef.icon, memberIds: memberIds, memberCount: memberIds.length };
    });
  }

  // Group ids are proven, not claimed — generated once by the shell
  // itself and never derived from (or equal to) the group's own name,
  // which is exactly the kind of user-editable, claimed label that must
  // never double as an identifier. Renaming a group later only ever
  // changes preferences.groups[id].name; the id, and therefore every
  // member's .group reference, never moves.
  //
  // Collision-checked against the whole apps registry via the id '' —
  // a brand-new group can't equal any existing id, so this only ever
  // tests the candidate name/icon, exactly like renaming a real app does
  // (see setAppOverride) — one shared, flat namespace, not two parallel
  // rules that happen to agree.
  function createGroup(name, icon) {
    if (!name || !icon) return { ok: false, reason: 'name-and-icon-required' };

    var nameCollides = collidesWithAnotherApp('', name, function (otherApp) {
      return [effectiveName(otherApp), otherApp.name];
    }, normalizeForComparison);
    if (nameCollides) return { ok: false, reason: 'name-collision' };

    var iconCollides = collidesWithAnotherApp('', icon, function (otherApp) {
      return [effectiveIcon(otherApp), otherApp.icon];
    }, normalizeIconForComparison);
    if (iconCollides) return { ok: false, reason: 'icon-collision' };

    var groupId = 'grp_' + Date.now().toString(36);
    preferences.groups[groupId] = { name: name, icon: icon };
    savePreferences();
    registerGroupApp(groupId, preferences.groups[groupId]);
    return { ok: true, id: groupId };
  }

  // Read-only version of the same check createGroup runs above — no write
  // side effects, just "would this name/icon collide with anything in the
  // apps registry". Exists because nothing today checks a dynamically-
  // loaded app's OWN manifest-declared name/icon for collisions —
  // declareDynamicApp (below) writes manifest.name/manifest.icon straight
  // into the registry, which was fine while every manifest was hand-
  // written by someone who could just look at the desktop first. A tool
  // that generates manifests (App Builder) needs to validate BEFORE
  // writing one, not discover the collision after the fact — same
  // collidesWithAnotherApp logic, same normalizers, so this can never
  // disagree with what setAppOverride/createGroup already enforce.
  // excludeId defaults to '' (matches no real id) for a brand-new app;
  // pass an existing app's own id when checking its own current identity
  // isn't being classed as colliding with itself.
  function checkIdentityAvailable(name, icon, excludeId) {
    var id = excludeId || '';
    var nameCollides = collidesWithAnotherApp(id, name, function (otherApp) {
      return [effectiveName(otherApp), otherApp.name];
    }, normalizeForComparison);
    if (nameCollides) return { ok: false, reason: 'name-collision' };

    var iconCollides = collidesWithAnotherApp(id, icon, function (otherApp) {
      return [effectiveIcon(otherApp), otherApp.icon];
    }, normalizeIconForComparison);
    if (iconCollides) return { ok: false, reason: 'icon-collision' };

    return { ok: true };
  }

  // Renames/re-icons an existing group. Not routed through setAppOverride
  // — a group has no code-default to lock or reserve, it's a different
  // category from an app — this mutates preferences.groups directly, and
  // the already-registered pseudo-app in apps, so the change is visible
  // immediately. A group's name/icon always has SOME value (unlike an
  // app's optional override), so neither can be cleared to empty here.
  function updateGroup(groupId, patch) {
    var groupDef = preferences.groups[groupId];
    if (!groupDef) return { ok: false, reason: 'not-found' };

    if (patch.name !== undefined) {
      if (!patch.name) return { ok: false, reason: 'name-required' };
      var nameCollides = collidesWithAnotherApp(groupId, patch.name, function (otherApp) {
        return [effectiveName(otherApp), otherApp.name];
      }, normalizeForComparison);
      if (nameCollides) return { ok: false, reason: 'name-collision' };
      groupDef.name = patch.name;
      apps[groupId].name = patch.name;
    }

    if (patch.icon !== undefined) {
      if (!patch.icon) return { ok: false, reason: 'icon-required' };
      var iconCollides = collidesWithAnotherApp(groupId, patch.icon, function (otherApp) {
        return [effectiveIcon(otherApp), otherApp.icon];
      }, normalizeIconForComparison);
      if (iconCollides) return { ok: false, reason: 'icon-collision' };
      groupDef.icon = patch.icon;
      apps[groupId].icon = patch.icon;
    }

    savePreferences();
    renderDesktop();
    return { ok: true };
  }

  // Deletes a group, reverting every current member back to the Desktop
  // (clearing their .group override) rather than orphaning them — "exists
  // once or not at all" was never meant to mean "unreachable by
  // accident." Navigates home if the deleted group was the active screen,
  // since it no longer exists to render.
  function deleteGroup(groupId) {
    membersOfGroup(groupId).forEach(function (memberId) {
      var override = preferences.appOverrides[memberId];
      if (!override) return;
      delete override.group;
      if (Object.keys(override).length === 0) delete preferences.appOverrides[memberId];
    });
    delete preferences.groups[groupId];
    delete apps[groupId];
    savePreferences();
    if (activeAppId === groupId) goHome();
    renderDesktop();
  }

  // A group is not a new kind of rendering — it's data-driven registration
  // of the exact same mechanism "spirit" already uses with a hardcoded
  // member list, so it reuses buildAppIcon, launchApp's {replace:true}
  // stack behavior, and renderDesktop for free. _isGroup marks it so
  // listApps() can exclude it (it gets this own management screen, not a
  // row in the Apps table). Empty membership shows a warning instead of a
  // blank grid, with a way to populate it (straight to the Apps table) or
  // delete it outright — no confirm needed there, since an empty group has
  // nothing to lose.
  function registerGroupApp(groupId, groupDef) {
    registerApp({
      id: groupId,
      name: groupDef.name,
      icon: groupDef.icon,
      _isGroup: true,
      mount: function (container, api, params) {
        container.innerHTML = '<div id="' + groupId + '-content"></div>';
        container.addEventListener('click', function (event) {
          if (event.target.closest('[data-goto-apps]')) {
            launchApp('app/apps');
            return;
          }
          var deleteBtn = event.target.closest('[data-delete-empty-group]');
          if (deleteBtn) deleteGroup(deleteBtn.dataset.deleteEmptyGroup);
        });
      },
      render: function () {
        var el = document.getElementById(groupId + '-content');
        if (!el) return;
        var memberIds = membersOfGroup(groupId);
        if (memberIds.length === 0) {
          el.innerHTML = '<div class="stat-tile wide">' +
            '<div>This group has no apps in it yet.</div>' +
            '<button type="button" class="cancel-btn" data-goto-apps>Populate it (Apps)</button> ' +
            '<button type="button" class="cancel-btn" data-delete-empty-group="' + escapeHtml(groupId) + '">Delete this group</button>' +
            '</div>';
        } else {
          el.innerHTML = '<div class="app-group-grid" id="' + groupId + '-grid"></div>';
          renderAppGroup(document.getElementById(groupId + '-grid'), memberIds);
        }
      },
    });
  }

  // Boot: register every stored group definition as a real pseudo-app.
  Object.keys(preferences.groups).forEach(function (groupId) {
    registerGroupApp(groupId, preferences.groups[groupId]);
  });

  // Capability injection, not ambient authority: an app's mount() used to
  // reach out to the global spirit.core.fs.createScopedFs('<itsOwnName>')
  // itself — nothing stopped it from typing a DIFFERENT app's name there,
  // the same claimed-identity gap proven identity (declareDynamicApp,
  // above) already closed for the app's own id. Here the shell constructs
  // the scoped handle itself, from the same proven _scriptPath it already
  // trusts, and hands it in — the app is never given a string to name a
  // folder with, so it can't get it wrong by accident or on purpose. Also
  // shrinks what an app (or an LLM writing one) can see: api is a small,
  // flat, explicitly-passed object, not an open-ended global namespace
  // that invites guessing at siblings that were never actually documented.
  // escapeHtml and fetchExternal have no per-app scoping concern (unlike
  // fs, nothing about them differs app to app), but folding them into api
  // too — rather than leaving them as "the two exceptions, still reached
  // as globals" — closes the last crack in "everything reachable is a
  // member of api, full stop": a contract with documented carve-outs
  // invites exactly the "maybe there are other undocumented ones too"
  // guessing this design exists to avoid. fetchExternal also hides the
  // /api/proxy wire envelope entirely (method/headers/body/timeoutMs
  // nested just so) behind a plain (url, options) call, the same way
  // fs.loadFile already hides the jailed path resolver behind a bare
  // filename — one less way to get a shape subtly wrong. Every app gets
  // both; only fs is conditional on having a folder of its own.
  // Repaints app._titlebarLinks (recorded by api.addTitlebarLink, above)
  // into titleEl — called both when a link is first registered (so it
  // still shows up immediately during that first mount, same as before)
  // and by switchTo on every later visit, since titleEl itself gets
  // wiped and reset to plain text on every navigation.
  function renderTitlebarLinks(app) {
    Array.prototype.slice.call(titleEl.querySelectorAll('.titlebar-link')).forEach(function (el) { el.remove(); });
    (app._titlebarLinks || []).forEach(function (targetAppId) {
      var target = apps[targetAppId];
      if (!target) return;
      var linkEl = document.createElement('button');
      linkEl.type = 'button';
      linkEl.className = 'titlebar-link';
      linkEl.title = effectiveName(target);
      linkEl.innerHTML = escapeHtml(effectiveIcon(target));
      linkEl.addEventListener('click', function () { launchApp(targetAppId, null, {}); });
      titleEl.appendChild(linkEl);
    });
  }

  function buildApiFor(app) {
    var api = {
      escapeHtml: escapeHtml,
      fetchExternal: function (url, options) {
        options = options || {};
        return fetch('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: url,
            method: options.method || 'GET',
            headers: options.headers || {},
            body: options.body,
            timeoutMs: options.timeoutMs || 10000,
          }),
        }).then(function (res) { return res.json(); });
      },
      // The smallest possible app launcher — one small icon appended to
      // this app's own titlebar (never replacing it; titleEl already has
      // the plain app name set by switchTo before mount runs) that jumps
      // straight to another app. A normal launchApp push — Back should
      // return to the app that had this link, not skip past it. Nothing
      // to contrast with any more: icon tiles push too (buildAppIcon,
      // above), and renderOpenWith is the only caller left that replaces.
      //
      // Only recorded here (on the app itself) rather than painted once
      // and forgotten — mount() only runs once now that apps stay
      // persistently mounted, but titleEl is shared, single, page-wide
      // chrome that switchTo wipes and rebuilds on every navigation (it
      // has to, or a titlebar link would leak into whichever unrelated
      // app you switch to next). renderTitlebarLinks (below) is what
      // repaints these from the recorded list on every single visit, not
      // just the first.
      addTitlebarLink: function (targetAppId) {
        var target = apps[targetAppId];
        if (!target) return;
        app._titlebarLinks = app._titlebarLinks || [];
        if (app._titlebarLinks.indexOf(targetAppId) === -1) app._titlebarLinks.push(targetAppId);
        renderTitlebarLinks(app);
      },

      // ---- The system-app surface (CLEANUP-PLAN step 6) ----
      //
      // The apps that moved out of index.html need things no app-scoped
      // api could give them: opening another app, reading a file that is
      // not their own, editing every OTHER app's overrides. They reached
      // for `spirit.shell` and `spirit.core.fs` to get them, which works
      // — those are globals on the page — and is exactly what should not
      // become the habit. These are the same capabilities with a name
      // and a doorway.
      //
      // This is intent, not containment. Every one of these is still
      // reachable through the globals, and it always will be: the page
      // has no module boundary to enforce anything. The real jail is
      // server-side (fileServable/fileWritable, kernel.js). What this
      // buys is that an app declares what it uses, and one place says
      // what a system app is allowed to want.
      // The doorway, and now the place the dialog rule is enforced.
      //
      // A dialog can only return. That is not a permission the way
      // api.fs is one — the page has no module boundary, and a dialog
      // that wanted to could reach spirit.shell.launchApp directly. It
      // is a NAVIGATION contract, and the nav stack has no server side:
      // the shell owns it outright, so the shell is the only place the
      // rule can live. This is the shell mediating what apps would
      // otherwise contend for (AGENT.md), not inventing a refusal the
      // server does not impose (§8) — the two are different, and the
      // Open-with folder rule was the second one.
      //
      // Loud, not silent. A dialog reaching for launchApp means somebody
      // added a button that should not exist, which is a programming
      // error and not a situation a user is in. Returning quietly would
      // ship exactly the bug this project is worst at finding: a button
      // that does nothing, discoverable only by pressing it.
      launchApp: function (targetAppId, params) {
        if (app.type === 'dialog') {
          throw new Error(
            'A dialog can only return: ' + app.id + ' tried to launch ' + targetAppId + '. ' +
            'Say it with api.setDialogResult(result) and let the app underneath act on it.');
        }
        // One door per kind. A dialog is opened with callDialog, which
        // guarantees things launchApp cannot — see below — so letting it
        // through here would be a second way in that skips them.
        var target = apps[targetAppId];
        if (target && target.type === 'dialog') {
          throw new Error(
            'Open a dialog with api.callDialog(' + JSON.stringify(targetAppId) + ', params), ' +
            'which hands it its subject and gives you back what it decided.');
        }
        launchApp(targetAppId, params || null);
      },

      // Ask a dialog a question and get the answer back.
      //
      //   api.callDialog('app/contactsDetails', { key: k })
      //      .then(function (result) { ... });
      //
      // A separate verb from launchApp because it is a separate contract,
      // and because the shell knowing it is opening a DIALOG at this
      // moment is what lets it guarantee three things (Andy):
      //
      //   1. the dialog is handed its subject every time — switchTo calls
      //      open(params) whether or not the pane exists, so a dialog
      //      physically cannot show you the row it was opened on last;
      //   2. the dialog is never driven by the job tick, so no dialog
      //      needs the focus guard that a tick repaint would otherwise
      //      make every one of them need;
      //   3. the answer is a return value, so the code that opens the
      //      dialog is the code that handles what it decided — three
      //      lines apart instead of a hook at the bottom of the file.
      //
      // The promise settles whichever way the dialog leaves the stack
      // (settleDialogs). A dialog that decided nothing answers null,
      // which is what Back on an untouched screen means.
      callDialog: function (targetAppId, params) {
        if (app.type === 'dialog') {
          throw new Error('A dialog can only return: ' + app.id + ' tried to open ' + targetAppId + '.');
        }
        var target = apps[targetAppId];
        if (!target) return Promise.resolve(null);
        if (target.type !== 'dialog') {
          throw new Error(
            targetAppId + ' is a ' + target.type + ', not a dialog. ' +
            'Use api.launchApp for a screen you navigate to.');
        }
        return new Promise(function (resolve) {
          pendingDialogs[targetAppId] = resolve;
          launchApp(targetAppId, params || null);
        });
      },

      // How a dialog gets out, and the only way it can say anything.
      //
      // There is one slot rather than a stack of them, and that is safe
      // because of an invariant the shell already has: a hidden app is
      // only ever entered from a visible one, and only ever left by
      // replacing itself, so at most one is open and it is always the
      // TOP (Andy). The app that receives the result is therefore always
      // the entry directly beneath, with nothing to search and no
      // nesting to reason about. assertOneHiddenApp keeps that true.
      //
      // Back is a cancel: pressing the chrome button pops with no result
      // and the parent is told nothing, which is what a person who
      // changed their mind means by it.
      // Said as it happens, delivered when the screen is popped — by a
      // Done button, or by Back, or by anything else that pops it. Set it
      // whenever the answer changes rather than on the way out, because
      // the way out is usually Back and Back is not this app's to
      // intercept.
      setDialogResult: function (result) {
        if (app.type !== 'dialog') {
          throw new Error('setDialogResult is for dialogs; ' + app.id + ' is a ' + app.type);
        }
        app._dialogResult = result === undefined ? null : result;
      },

      // Leave now, saying this. For a dialog that has a Done button of
      // its own; everything else sets the result and lets the person
      // press Back, which answers the caller's promise just the same.
      closeDialog: function (result) {
        if (app.type !== 'dialog') {
          throw new Error('closeDialog is for dialogs; ' + app.id + ' is a ' + app.type);
        }
        if (activeAppId !== app.id) return; // already closed, or never open
        if (result !== undefined) app._dialogResult = result;
        goBack();
      },

      // The titlebar says which ROW you are looking at, not which app.
      //
      // A dialog is opened against one thing and shows only that thing,
      // so its name ("Contact") is the least useful word available; the
      // row's own identity is what tells you whose panel this is. It
      // cannot be the row itself — #app-header is one sticky flex line,
      // and four columns will not fit — so it is the identity: a mark
      // and a name.
      //
      // Only the app currently on screen may write it. A late fetch
      // resolving after somebody pressed Back must not retitle whatever
      // they went back to.
      setScreenTitle: function (text) {
        if (activeAppId !== app.id) return;
        titleEl.textContent = String(text == null ? '' : text);
        renderTitlebarLinks(app);
      },
      listApps: listApps,
      listGroups: listGroups,
      getAppOverride: getAppOverride,
      setAppOverride: setAppOverride,

      // Widgets the shell builds so every app does not build its own.
      //
      // First thing on this surface that hands back a DOM node rather
      // than data or a promise, which is a threshold worth naming: it
      // means the shell ships controls, and the next asks will be a file
      // picker and a peer picker. The rule that keeps it honest is the
      // one createIconSelector follows — the deciding is done in an
      // isomorphic module (js/iconIndex.js) that node can drive, and what
      // lives here is only the painting.
      ui: {
        elements: {
          createIconSelector: createIconSelector,
        },
      },

      // An unscoped read, deliberately: the Process Browser lists files
      // under process/, the Files app walks the whole tree, and neither
      // is doing anything api.fs (scoped to app/<name>/) can express.
      // Not a wider capability than the page already had — it is the
      // same request the shell itself makes, and the server still
      // refuses anything fileServable() refuses (relay-state, the node
      // modules, sidecars). Read only: writing outside an app's own
      // folder stays where it is.
      readProject: function (projectPath) {
        return spirit.core.fs.loadFile(projectPath);
      },

      // The file list, whenever it says something new — never on a stats
      // tick, and never twice for the same content. Called back straight
      // away with what is already known, so a freshly mounted app paints
      // now rather than at the next rescan. Returns an unsubscribe.
      onFiles: function (fn) {
        var stop = subscribeTo(fileSubscribers, app.id, fn);
        var files = currentFiles();
        if (files && typeof fn === 'function') {
          fn(files, { visible: activeAppId === app.id });
        }
        return stop;
      },

      // Every job event, with the job that moved (null on a snapshot).
      // The raw stream: use onFiles unless you want the jobs themselves.
      onJobs: function (fn) {
        var stop = subscribeTo(jobSubscribers, app.id, fn);
        if (typeof fn === 'function') fn(jobsById, null, { visible: activeAppId === app.id });
        return stop;
      },

      // For work outside a callback — a timer, a fetch that lands late.
      isVisible: function () { return activeAppId === app.id; },

      // Say something to a peer. `toId` is a public key — labels are for
      // display and a label is not an identity. `body` is a string or
      // anything JSON can carry. The node wraps it, signs the send and
      // routes it; the app never names an HTTP path and never sees a
      // signature.
      sendMessagePacket: function (packetApp, toId, body) {
        return fetch('/api/hub/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: readNodeLabel(),
            to: toId,
            app: packetApp,
            body: body,
          }),
        }).then(function (r) {
          return r.text().then(function (t) { return { status: r.status, text: t }; });
        });
      },

      onPacket: function (packetApp, handler) { return onPacketFor(packetApp, handler); },

      // Handing the poll's catch to the shell to route. Temporary seam —
      // see deliverPackets above.
      deliverPackets: function (messages) { return deliverPackets(messages); },

      // The public label this node claimed, or '' if it has not. The
      // shell reads it for the window title and hands it on rather than
      // letting each app parse another app's session file: one accessor
      // knows that shape (readNodeLabel above), and an app that needs to
      // ask its mailbox a signed question needs the name it signs as.
      nodeLabel: function () { return readNodeLabel(); },

      // "That file changed" — said by the app that changed it. Claiming
      // a name is what turns a first-run node into an ordinary one, and
      // losing it turns it back, so both the title and the app list have
      // to be repainted at that moment.
      //
      // Told rather than noticed: writing session.json does happen to
      // move the fs-watcher's file list, and the snapshot that follows
      // would repaint the desktop — but only because the file is NEW,
      // and only while that watcher is alive. A claim is not the place
      // to depend on either.
      nodeLabelChanged: function () {
        nodeLabel = '';
        paintWindowTitle(activeAppId && apps[activeAppId] ? apps[activeAppId].name : '');
        renderDesktop();
        paintTitlebarChrome();
        // Symmetrical with boot: a node that has just lost its name has
        // one thing to do again, and the desktop behind it is empty.
        openBinderIfUnbound();
      },
    };
    if (app._scriptPath) {
      var folder = app._scriptPath.match(/^app\/([^/]+)\//)[1];
      api.fs = spirit.core.fs.createScopedFs(folder);
    }
    return api;
  }

  // Switches the visible screen without touching navStack — the stack
  // bookkeeping lives in launchApp/goBack, this just mounts/unmounts.
  //
  // Each app gets its own persistent wrapper div under #app-content,
  // created and mount()ed once the first time it's opened, then only
  // ever shown/hidden afterward — never cleared and rebuilt. Before
  // this, every single navigation (including just going Home and back
  // to a screen already open) tore down and remounted the whole app,
  // discarding any in-progress DOM state for no reason.
  function switchTo(id, params) {
    if (activeAppId && apps[activeAppId] && typeof apps[activeAppId].unmount === 'function') {
      apps[activeAppId].unmount();
    }

    if (activeAppId && apps[activeAppId] && apps[activeAppId]._el) {
      apps[activeAppId]._el.hidden = true;
    }

    if (id === 'desktop') {
      activeAppId = null;
      activeParams = null;
      containerEl.className = '';
      containerEl.hidden = true;
      desktopEl.hidden = false;
      paintWindowTitle('');
      return;
    }

    var app = apps[id];
    activeAppId = id;
    activeParams = params;
    // The whole window goes greyscale for a dialog, titlebar included —
    // which is why the class goes on the container rather than on the
    // pane: the header is not inside the pane. The greys are luminance
    // matches for the colours they replace, so nothing about contrast
    // changes; see the block in index.html.
    //
    // className rather than classList.toggle: #app-container carries no
    // other class, and an assignment is the one form the test harness's
    // fake elements answer.
    containerEl.className = app.type === 'dialog' ? 'is-dialog' : '';
    titleEl.textContent = app.name;
    // A file, when there is one: the launchers are not a special case,
    // they are apps whose displayed subject happens to be a path. Full
    // path as given, not the basename — two dog.png in two folders are
    // two tabs.
    paintWindowTitle((params && params.path) || app.name);
    renderTitlebarLinks(app);
    desktopEl.hidden = true;
    containerEl.hidden = false;

    if (!app._el) {
      app._el = document.createElement('div');
      app._el.className = 'app-pane';
      // Named, because the stack rule has to reach the app's own blocks
      // and this wrapper sits between them and #app-content. Unnamed, the
      // rule landed on the pane — one 12px above the whole app and none
      // between its blocks, which is exactly what it looked like.
      contentEl.appendChild(app._el);
      app.mount(app._el, buildApiFor(app), params);
    } else if (params && params.path && typeof app.loadFile === 'function') {
      // Revisiting an already-mounted app with a file — mount() itself
      // only ever runs once now, so an app that cares which file it was
      // opened against (e.g. Text Editor, via "Open with") needs this
      // second chance to pick up a *different* file on a later visit.
      // Optional: only apps that implement loadFile are affected; every
      // other app is untouched.
      app.loadFile(params.path);
    }
    app._el.hidden = false;

    // A dialog is OPENED, never rendered.
    //
    // open(params) runs on every entry, mounted or not — which is the
    // whole reason a dialog cannot show you the last row it was opened
    // for. mount() runs once per pane and the pane is shared by every
    // subject the dialog is ever called on, and loadFile (the launchers'
    // second chance) only fires when params.path is set, so anything
    // opened on a key had no hook at all. This is that hook, generalized
    // and compulsory.
    //
    // And it is NOT followed by render, here or on the job tick
    // (renderActive). A dialog shows one subject and repaints when it
    // decides something; a tick repaint redrew identical markup from a
    // cached row every two seconds and its only observable effect was
    // destroying whatever field somebody was typing in. A dialog that
    // genuinely wants live data asks for it with api.onJobs, which is
    // opt-in and says so.
    if (app.type === 'dialog') {
      if (typeof app.open === 'function') app.open(params);
      return;
    }
    app.render(jobsById, params);
  }

  // At most one hidden app on the stack, and it is always the top.
  //
  // That is not a rule of its own — it is what two rules already produce
  // (Andy). A hidden app is only ever entered from a VISIBLE one (Files
  // and Processes push a launcher), and a launcher only ever leaves by
  // REPLACING itself: Open with, Open ⟨app⟩ and Start Job are the three
  // {replace:true} callers in the tree. Add a dialog that cannot launch
  // at all, and there is no path that puts two of them on the stack.
  //
  // Checked rather than assumed, because closeDialog LEANS on it: it
  // hands its result to the entry directly beneath, which is only the
  // right app while this holds. The day somebody adds a fourth launch
  // that forgot {replace:true}, this says so — and says which two, which
  // an enforcement that silently replaced would not.
  //
  // Complains and carries on. Refusing would swallow a navigation and
  // leave a dead button; a wrong stack entry is a slightly wrong Back.
  // The first is invisible, the second is not.
  function assertOneHiddenApp(justLaunched) {
    var open = navStack.filter(function (entry) {
      return apps[entry.id] && apps[entry.id].hidden;
    }).map(function (entry) { return entry.id; });
    if (open.length > 1) {
      console.error(
        'Two hidden apps on the nav stack (' + open.join(', ') + ') after launching ' +
        justLaunched + '. One is only ever entered from a visible app, and a launcher ' +
        'leaves by replacing itself — so one of those launches is missing {replace:true}, ' +
        'or a dialog launched something.');
    }
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

    // There was a check here refusing to launch a dynamically-loaded app
    // against a file outside its own folder. It went with the same rule
    // in renderOpenWith (above): it was the shell inventing a permission
    // the server does not impose, on a page where an app can reach
    // spirit.core.fs directly anyway. Reads are gated by fileServable and
    // writes by fileWritable, both server-side, both applied to whatever
    // the app actually asks for — which is where a refusal can mean
    // something.

    var top = navStack[navStack.length - 1];
    if (top.id === id && JSON.stringify(top.params) === JSON.stringify(params)) return; // already here

    // If this exact screen (id + params) already exists elsewhere in the
    // stack, collapse back to that occurrence instead of pushing a
    // duplicate — otherwise revisiting a screen would make the stack
    // (and the back button) walk through repeats on the way out. Two
    // Text File Launcher entries for two different files are NOT the same
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

    assertOneHiddenApp(id);
    // A launch can collapse the stack past an open dialog (the
    // de-duplication above truncates), which is the third way one can
    // leave without being popped.
    settleDialogs();

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
    // Optional, and a dialog defines none of it: the shell does not tick
    // it, so there is nothing for render to do that open does not.
    apps[id].render = behavior.render || function () {};
    apps[id].loadFile = behavior.loadFile; // optional — only apps that care which file they're opened against define this
    apps[id].open = behavior.open;         // dialogs only — called on every entry
    apps[id]._activated = true;
    pendingActivationId = null;
  }

  // One entry per open dialog: its resolve, waiting for the screen to
  // leave the stack. At most one is ever in here (assertOneHiddenApp),
  // but it is keyed by id rather than held as a single slot so that a
  // stray never resolves the wrong caller.
  var pendingDialogs = Object.create(null);

  // A dialog's promise settles when the dialog is no longer ON the
  // stack, whichever way it left: Back, Home, or a launch that collapsed
  // the stack past it. One function called from all three, because a
  // promise that never settles is a .then that never runs and nothing
  // says so — the one new failure mode this mechanism has.
  function settleDialogs() {
    Object.keys(pendingDialogs).forEach(function (id) {
      for (var i = 0; i < navStack.length; i++) {
        if (navStack[i].id === id) return; // still open
      }
      var pending = pendingDialogs[id];
      delete pendingDialogs[id];
      var app = apps[id];
      // Whatever it last said, or null for a dialog that decided nothing
      // — which is what Back on an untouched screen means.
      var result = (app && app._dialogResult !== undefined) ? app._dialogResult : null;
      if (app) app._dialogResult = undefined;
      pending(result);
    });
  }

  function goBack() {
    if (navStack.length <= 1) return; // already at the bottom of the stack
    navStack.pop();
    var top = navStack[navStack.length - 1];
    switchTo(top.id, top.params);
    // After the switch, so the caller's .then runs against a screen that
    // is already back on show and can act rather than be interrupted
    // mid-mount.
    settleDialogs();
  }

  function goHome() {
    if (navStack.length <= 1) return; // already at the bottom of the stack
    navStack.length = 1; // navStack[0] is always {id:'desktop', params:null}
    switchTo('desktop', null);
    // Home over a dialog is a leave, not a cancel of the writes it
    // already made — but it is a leave with nothing more to say.
    settleDialogs();
  }

  closeBtn.addEventListener('click', goBack);
  homeBtn.addEventListener('click', goHome);

  function renderActive() {
    if (!activeAppId || !apps[activeAppId]) return;
    // See switchTo: a dialog is never driven by the tick. This is what
    // makes the focus guard every other screen carries unnecessary in
    // one, rather than one more thing each new dialog has to remember.
    if (apps[activeAppId].type === 'dialog') return;
    apps[activeAppId].render(jobsById, activeParams);
  }

  // ---- Packets (api.sendMessagePacket / api.onPacket) ----
  //
  // One door for every app. An app says who and what; the envelope, the
  // signature and the route are the node's business
  // (ARCHITECTURAL-CONCERNS.md). Relay Chat is the only client today,
  // and the point of the door is that Chess is not a different kind of
  // thing when it arrives — it is another `app` string.
  //
  // The packet name is not the shell app id: an app declares what it is
  // called on the wire when it subscribes, so a folder can be renamed
  // without every peer's stored traffic becoming unreadable.
  var packetHandlers = Object.create(null);

  function onPacketFor(appId, handler) {
    if (typeof handler !== 'function' || !appId) return function () {};
    var name = String(appId);
    (packetHandlers[name] = packetHandlers[name] || []).push(handler);
    return function off() {
      packetHandlers[name] = (packetHandlers[name] || []).filter(function (fn) { return fn !== handler; });
    };
  }

  // Fan-in, minimal and honest about where it lives. Whoever polls the
  // mailbox hands the decoded messages here and the shell routes them by
  // `app`; today that poller is Relay Chat, because the inbox loop is
  // still its. When the packet layer grows its own poll, this is the
  // seam that moves and the handlers do not.
  //
  // A packet for an app nobody is listening to is DROPPED — not held,
  // not queued, not announced. There is no hold store yet, and inventing
  // one quietly would be inventing the part that has to be designed.
  function deliverPackets(messages) {
    var routed = [];
    (Array.isArray(messages) ? messages : []).forEach(function (message) {
      var info = message && message.packet;
      if (!info || info.legacy || !info.app) return; // legacy lines belong to whoever polls
      var listeners = packetHandlers[info.app] || [];
      if (!listeners.length) return; // nobody home: dropped on purpose
      routed.push(message);
      listeners.slice().forEach(function (fn) { fn(info.body, message); });
    });
    return routed;
  }

  // ---- Subscriptions (api.onFiles / api.onJobs) ----
  //
  // Before this, the shell broadcast: every job event repainted whichever
  // app was on screen, with no word about what had changed, so an app
  // that cared about one job had to keep an identity cache and compare
  // objects. Two apps had written the same four lines (Files, Processes)
  // and the next one would have copied them.
  //
  // The page still holds exactly ONE EventSource — the one at the foot of
  // this file. These are fan-outs from it, not new connections: an app
  // opening its own would multiply the server's sseConnections by the
  // number of apps in the page.
  //
  // A subscription is permanent and does not care whether its app is on
  // screen. Whether to DO anything while invisible is the app's decision,
  // which is why `ctx.visible` rides along with every delivery: an app
  // that only paints returns early and costs a boolean, and an app that
  // wants to keep counting while you are somewhere else simply does not.
  // The catch-up on the way back is the existing render(): switchTo calls
  // it on every visit, so "skip while hidden, repaint when shown" needs
  // nothing new.
  var fileSubscribers = [];
  var jobSubscribers = [];
  // What the last delivered file list said. The signature lives here so
  // no app has to hold one again: a reconnect re-delivers every job as a
  // fresh object with identical content, and that is not a change.
  var lastFilesJson = null;

  function currentFiles() {
    var job = findJobByType('fs-watcher');
    return (job && job.data && Array.isArray(job.data.files)) ? job.data.files : null;
  }

  function contextFor(entry) {
    return { visible: activeAppId === entry.appId };
  }

  function notifyFileSubscribers() {
    var files = currentFiles();
    if (!files) return;
    var asJson = JSON.stringify(files);
    if (asJson === lastFilesJson) return;
    lastFilesJson = asJson;
    fileSubscribers.slice().forEach(function (entry) {
      entry.fn(files, contextFor(entry));
    });
  }

  function notifyJobSubscribers(changed) {
    jobSubscribers.slice().forEach(function (entry) {
      entry.fn(jobsById, changed || null, contextFor(entry));
    });
  }

  function subscribeTo(list, appId, fn) {
    if (typeof fn !== 'function') return function () {};
    var entry = { appId: appId, fn: fn };
    list.push(entry);
    return function unsubscribe() {
      var at = list.indexOf(entry);
      if (at !== -1) list.splice(at, 1);
    };
  }

  function findJobByType(type) {
    var found = null;
    jobsById.forEach(function (job) {
      if (job.type === type) found = job;
    });
    return found;
  }

  // Delegates to the kernel's own implementation (spirit.core.util.escapeHtml)
  // rather than re-deriving one from the DOM — see kernel.js for why it
  // moved and what the DOM version got wrong about attribute values.
  // Kept as a local name because ~30 call sites in this file and
  // index.html already read that way, and because it is handed to every
  // app as api.escapeHtml.
  function escapeHtml(str) {
    return spirit.core.util.escapeHtml(str);
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
    // Every entry here is a dynamically-loaded app that declared this
    // extension (see registerExtensionHandler), and every one of them is
    // offered.
    //
    // This used to keep only handlers whose own folder the file sat in,
    // which meant media/dummy.txt — readable by anyone, writable by
    // anyone, since media is a writable root — could not be opened with
    // the one app that declares .txt. That prefix was a client-side
    // stand-in for a capability nobody had published, and it had drifted
    // stricter than both server gates.
    //
    // The server is the only jail. A path in the fs-watcher list has
    // already passed fileServable, so it is readable by construction; a
    // save is answered by fileWritable when it is attempted. The page has
    // no module boundary — an app can call spirit.core.fs itself — so a
    // rule here protected nothing and only refused working cases. See
    // AGENT.md: the shell mediates what apps would otherwise contend for,
    // and does not invent permissions the server does not impose.
    var handlers = (extensionHandlers[ext] || []).slice();
    // currentAppId (always a viewer) is never itself in
    // extensionHandlers, so even a single real handler is a genuine
    // alternative to the read-only viewer — suppress only when
    // there's truly nothing to switch to.
    if (handlers.length < 1) { container.innerHTML = ''; return; }

    var defaultId = preferences.defaultHandlers[ext];

    // The shell's own form shape (§3), which this predated: a caption
    // over its control rather than "Open with: " written inline, and the
    // buttons at the end of the row rather than separated from it by
    // literal spaces in the markup.
    //
    // Its own panel, because it is a thing to do among the readings above
    // it — and no .card inside, because the panel IS the form.
    //
    // The select grows: a handler is named "Text File Launcher", and at
    // its natural width the two buttons would crowd it.
    container.innerHTML = '<div class="stat-tile wide">' +
      '<div class="start-job-form">' +
        '<label class="field-label grow">Open with' +
          '<select id="open-with-select">' +
          handlers.map(function (h) {
            return '<option value="' + escapeHtml(h.id) + '"' + (h.id === defaultId ? ' selected' : '') + '>' + escapeHtml(h.name) + '</option>';
          }).join('') + '</select></label>' +
        '<button type="button" id="open-with-go">Open</button>' +
        (handlers.length > 1 ? '<button type="button" id="open-with-set-default">Set as default</button>' : '') +
      '</div>' +
      '</div>';

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
    code: 'text-file-launcher',
    image: 'media-launcher',
    audio: 'media-launcher',
    video: 'media-launcher',
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
    // The viewers retitle themselves after switchTo has run, so the tab
    // is told again here rather than left saying the app name.
    paintWindowTitle(path);
    document.getElementById('viewer-no-btn').addEventListener('click', goBack);
  }

  // Shared by both viewers: the info bubble a user needs to decide
  // whether this is really the file they meant to open — path is
  // always known; size/changed/created come from statFile and are
  // simply omitted if the stat call fails (e.g. a race with the file
  // being deleted) rather than showing misleading blanks.
  function fileInfoRow(label, value) {
    return '<div class="file-info-row"><span class="file-info-label">' + label +
      ':</span><span class="file-info-value">' + value + '</span></div>';
  }

  // A path that always fits, however narrow the pane (Andy: it is the most
  // vital thing in the bubble, so it must never run off the side).
  //
  // One span per directory and one for the file, with a <wbr> between
  // them. The spans are for reading — the directories dim, the filename
  // stays at full strength, so the eye lands on the part you came for.
  // They are NOT what makes it wrap: an element boundary is not a line
  // break opportunity, so <span>run/</span><span>app/</span> breaks in
  // exactly the places `run/app/` does, which is nowhere. <wbr> is the
  // break opportunity, and the browser prefers those points over any
  // other — so it folds after a slash and only splits a segment if one
  // is longer than the line, which .file-info-value's overflow-wrap
  // catches.
  //
  // Escaped per segment, then the markup added, so a filename with a <
  // in it cannot become part of the structure.
  function pathValue(path) {
    var parts = String(path == null ? '' : path).split('/');
    var file = parts.pop();
    return parts.map(function (dir) {
      return '<span class="path-dir">' + escapeHtml(dir) + '/</span><wbr>';
    }).join('') + '<span class="path-file">' + escapeHtml(file) + '</span>';
  }

  // A handful of short facts as ONE reading rather than a list of rows,
  // in a bubble of their own so they are visibly not the controls beside
  // them. Used wherever a row has already supplied the heading: a
  // mailbox report in Natter, a contact's row, an app's defaults.
  //
  // Label above value, and the label is the small bold half — you scan
  // the captions to find the one you want and then read the value at
  // reading size. That is the opposite way round from .stat-tile's
  // figure-over-caption, where the number is the thing being read.
  //
  // Here rather than hand-written in each app: it was copied into three
  // of them and the fourth was about to be, and a pattern that is going
  // everywhere should have one place to be changed. Values are escaped
  // here, so callers pass plain strings.
  function factRow(pairs) {
    return '<div class="fact-row">' + (pairs || []).map(function (pair) {
      return '<div class="fact">' +
        '<span class="fact-label">' + escapeHtml(String(pair[0])) + '</span>' +
        '<span class="fact-value">' + escapeHtml(String(pair[1])) + '</span>' +
        '</div>';
    }).join('') + '</div>';
  }

  // Two bubbles, because they answer two different questions (Andy).
  //
  // The path is the title of the screen — which file this is — so it gets
  // a bubble of its own and no caption. "Path:" in front of it was a word
  // saying what the only thing in the bubble obviously is, and it cost
  // 90px of the width that the path itself needed most.
  //
  // Everything else is a reading about that file, so it is a facts bubble
  // like every other reading in the shell. Size, Changed and Created come
  // from statFile and are simply absent when the call fails (a race with
  // the file being deleted) rather than shown as blanks — §1, and what
  // this function already did.
  // Reading an app's own entry script? Then say which app, and offer to
  // go there (Andy).
  //
  // The match is app/<name>/<name>.js — the same folder-derived shape
  // declareDynamicApp uses to work out an id, so a sibling file in the
  // folder (a helper, a test fixture) is correctly not the app. The
  // registry is asked as well as the path: a folder matching the shape is
  // only an app if the shell actually declared one from it, and a file
  // sitting where an app used to be should offer nothing.
  //
  // Its name and icon come through effectiveName/effectiveIcon, so what
  // this bubble says is what the desktop tile says — including an
  // operator's override.
  //
  // Written into a container and wired here, the way renderOpenWith is:
  // it is one button, and a delegated listener somewhere else would be a
  // second place to look.
  function renderAppOfFile(container, path) {
    var found = /^app\/([^/]+)\/\1\.js$/.exec(String(path || ''));
    var app = found && apps['app/' + found[1]];
    if (!app) { container.innerHTML = ''; return; }

    var name = effectiveName(app);
    container.innerHTML = '<div class="stat-tile wide">' +
      '<div class="start-job-form">' +
        '<span class="app-of-file">' +
          '<span class="app-of-file-icon">' + escapeHtml(effectiveIcon(app)) + '</span>' +
          escapeHtml(name) +
        '</span>' +
        '<button type="button" id="app-of-file-open">Open ' + escapeHtml(name) + '</button>' +
      '</div>' +
      '</div>';

    // {replace: true}, like picking a handler from Open with just above:
    // you were reading the source on the way to the app, so Back should
    // return to wherever you came from rather than to the file you have
    // finished with (Andy).
    //
    // Contrast an icon tile, which pushes — a group screen IS a
    // destination, and Back into it is going back to where you were.
    document.getElementById('app-of-file-open').addEventListener('click', function () {
      launchApp(app.id, null, { replace: true });
    });
  }

  function renderFileInfoBubble(path) {
    var stats = spirit.core.fs.statFile(path);
    var facts = [['MIME type', mimeTypeForName(path)]];
    if (stats) {
      facts.push(
        ['Size', spirit.core.util.formatBytes(stats.size)],
        ['Changed', new Date(stats.mtimeMs).toLocaleString()],
        ['Created', new Date(stats.birthtimeMs).toLocaleString()]
      );
    }
    return '<div class="stat-tile wide file-path">' + pathValue(path) + '</div>' +
      factRow(facts);
  }

  // Turns e.g. "spiritImageStats" / "computedAt" into "Spirit Image Stats" /
  // "Computed At" for display — annotation keys are tool-chosen camelCase
  // identifiers, not written with a human reader in mind.
  function prettifyAnnotationKey(key) {
    return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, function (c) { return c.toUpperCase(); });
  }

  // Epoch-milliseconds heuristic, same idea renderFileInfoBubble already
  // applies to mtime/birthtime — a bare "1788480690989" is unreadable.
  // Every annotation field producing an epoch-ms value so far (mtimeMs,
  // computedAt) safely clears this range for the foreseeable future.
  function looksLikeEpochMs(value) {
    return typeof value === 'number' && value > 1e11;
  }

  // Recursive, generic-on-purpose: the shell has no built-in knowledge of
  // what any particular tool's payload looks like (today: imageStats's
  // width/height/averageColor/histogram, imageCaptionClaude's
  // caption/tags/model — more tools will add more shapes later). Scalars
  // render as a row; nested objects recurse into a nested card; arrays
  // (e.g. histogram's 16-bucket lists) collapse behind a <details> with
  // raw pretty-printed JSON rather than dumping dozens of rows inline.
  function renderAnnotationValue(value) {
    if (value === null || value === undefined) return '<em>none</em>';
    if (Array.isArray(value)) {
      return '<details class="annotation-raw"><summary>' + value.length + ' value' + (value.length === 1 ? '' : 's') + '</summary><pre class="code-view">' + escapeHtml(JSON.stringify(value, null, 2)) + '</pre></details>';
    }
    if (typeof value === 'object') {
      return '<div class="stat-tile nested">' + Object.keys(value).map(function (key) {
        return fileInfoRow(escapeHtml(prettifyAnnotationKey(key)), renderAnnotationValue(value[key]));
      }).join('') + '</div>';
    }
    if (looksLikeEpochMs(value)) return escapeHtml(new Date(value).toLocaleString());
    return escapeHtml(String(value));
  }

  // Called by both Text File Launcher and Media Launcher, at the bottom of
  // their display. Returns '' (nothing rendered) when the file's sidecar
  // has no 'client' data — same "omit rather than show an empty state"
  // convention renderFileInfoBubble above uses for missing stat rows.
  function renderAnnotationsSection(path) {
    var client = (spirit.core.fs.getAnnotations(path) || {}).client;
    if (!client || Object.keys(client).length === 0) return '';
    var sections = Object.keys(client).map(function (key) {
      return '<div class="stat-tile wide"><h4>' + escapeHtml(prettifyAnnotationKey(key)) + '</h4>' + renderAnnotationValue(client[key]) + '</div>';
    }).join('');
    return '<h3>More Information</h3>' + sections;
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
  // `intrinsic` is the manifest saying this app is part of how the node
  // works, not something the operator installed: Natter is where a
  // personal node learns of any public relay at all, so a shell with no
  // way to reach it is a shell that cannot be pointed at a mailbox. An
  // intrinsic app is always reachable, in the Spirit group (see
  // effectiveGroup) — a manifest that asks to be both intrinsic and
  // hidden is asking for two contradictory things, and being reachable
  // wins. Only a hand-edited manifest can set the flag; saveAppManifest
  // refuses to write one (kernel.js), so no app and no builder can make
  // itself unremovable.
  function declareDynamicApp(manifest, scriptPath) {
    var id = 'app/' + scriptPath.match(/^app\/([^/]+)\//)[1];
    var existing = apps[id];
    // Declaring twice is normal now: an intrinsic app is declared at boot
    // from its manifest (declareIntrinsicApps, below) and again when the
    // fs-watcher snapshot arrives, and every snapshot after a dropped SSE
    // connection re-declares everything. Only the manifest-derived facts
    // are refreshed — an app that has already loaded its script keeps the
    // mount/render it supplied and the DOM it was mounted into, or a
    // reconnect would leave a live app showing "Loading …" behind a
    // wrapper nothing points at any more.
    apps[id] = {
      id: id,
      name: manifest.name,
      icon: spirit.core.const.ICON[manifest.icon] || spirit.core.const.ICON.FILE,
      intrinsic: !!manifest.intrinsic,
      // `&& !manifest.intrinsic` used to be here, and it meant an
      // intrinsic app could not be hidden. That was right while
      // "intrinsic" meant "part of the node, so always on the desktop".
      // A dialog is the first thing that is both: part of the node, and
      // a screen its parent pushes rather than anything you launch
      // (Andy). Nothing already shipped changes — every manifest in the
      // tree says hidden:false.
      hidden: !!manifest.hidden,
      // 'app' | 'launcher' | 'dialog'. What it decides is what may be
      // launched FROM here — see buildApiFor. A launcher finishes with
      // the file it was showing and steps out of its own way; a dialog
      // can only return.
      type: manifest.type || 'app',
      mount: (existing && existing._activated)
        ? existing.mount
        : function (container) { container.textContent = 'Loading ' + manifest.name + '…'; },
      render: (existing && existing._activated) ? existing.render : function () {},
      loadFile: existing && existing.loadFile,
      _scriptPath: scriptPath,
      _activated: !!(existing && existing._activated),
      _el: existing && existing._el,
      _titlebarLinks: existing && existing._titlebarLinks,
    };

    (manifest.handlesExtensions || []).forEach(function (ext) {
      registerExtensionHandler(ext, id, manifest.name);
    });

    if (!apps[id].hidden) renderDesktop();
  }

  // The intrinsic apps this node cannot afford to be missing, read at
  // boot straight from their manifests rather than waiting for the
  // fs-watcher job to report them over SSE.
  //
  // Discovery is otherwise snapshot-driven, which is fine for installed
  // apps — an app nobody can see for a second is a nuisance. It is not
  // fine for the apps that ARE the node: a watcher that never reports,
  // or a jobs stream that never connects, would leave Spirit empty and
  // Natter unreachable, so a node with a broken watcher could not be
  // pointed at a mailbox at all. Andy's decision for CLEANUP-PLAN step 4:
  // eager manifest list at boot, entry scripts still lazy.
  //
  // Only the manifest decides. A folder listed here whose manifest is
  // missing, unreadable, or not intrinsic is left to ordinary discovery —
  // this list cannot promote an app, only hurry one that is already
  // intrinsic. Each of the five adds its line here in the same commit as
  // its move, alongside its APP_ID_RENAMES entry.
  var INTRINSIC_APP_FOLDERS = ['natter', 'stats', 'jobs', 'apps', 'process-browser', 'files', 'group-manager', 'contacts'];

  function declareIntrinsicApps() {
    INTRINSIC_APP_FOLDERS.forEach(function (folder) {
      var scriptPath = 'app/' + folder + '/' + folder + '.js';
      var raw = spirit.core.fs.loadFile('app/' + folder + '/' + folder + '.json');
      if (raw == null) return; // no manifest — the watcher will find it, or it is gone
      var manifest;
      try { manifest = JSON.parse(raw); }
      catch (e) { return; } // malformed — same rule discovery already uses
      if (!manifest || !manifest.intrinsic) return;
      declareDynamicApp(manifest, scriptPath);
    });
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
    renderAppOfFile: renderAppOfFile,
    findJobByType: findJobByType,
    mimeTypeForName: mimeTypeForName,
    classifyMimeType: classifyMimeType,
    iconForFile: iconForFile,
    CATEGORY_APP_HANDLERS: CATEGORY_APP_HANDLERS,
    setViewerTitle: setViewerTitle,
    fileInfoRow: fileInfoRow,
    factRow: factRow,
    pathValue: pathValue,
    renderFileInfoBubble: renderFileInfoBubble,
    renderAnnotationsSection: renderAnnotationsSection,
    renderAppGroup: renderAppGroup,
    listApps: listApps,
    listIntrinsicApps: listIntrinsicApps,
    SPIRIT_GROUP_ID: SPIRIT_GROUP_ID,
    // Exported for the harness: a migration that cannot be exercised is a
    // migration nobody finds out about until the move it was written for.
    migrateAppIds: migrateAppIds,
    // Same reason. Which screens are on the stack, and stepping back one,
    // are the whole of what "Back" means, and until now no test could see
    // either — the {replace: true} that made Spirit disappear from its own
    // stack sat there unexamined because nothing could ask.
    goBack: goBack,
    navStackIds: function () {
      return navStack.map(function (entry) { return entry.id; });
    },
    APP_ID_RENAMES: APP_ID_RENAMES,
    INTRINSIC_APP_FOLDERS: INTRINSIC_APP_FOLDERS,
    getAppOverride: getAppOverride,
    setAppOverride: setAppOverride,
    listGroups: listGroups,
    createGroup: createGroup,
    updateGroup: updateGroup,
    deleteGroup: deleteGroup,
    checkIdentityAvailable: checkIdentityAvailable,
  };

  // Before the subscription, not from it: that is the whole point of the
  // eager read. This runs while index.html's own inline script has yet to
  // register the built-ins (it follows this file), which is harmless —
  // every registration repaints the desktop, and Spirit's grid is built
  // at render time from whatever is registered by then. What matters is
  // that it does not wait for a snapshot that may never come.
  declareIntrinsicApps();

  // First paint: the tab says which node this is before anything is
  // opened.
  paintWindowTitle('');
  paintTitlebarChrome();

  // And on a node with no name, the binder is what "opened" means.
  openBinderIfUnbound();

  // ---- Shared data subscription (page-lifetime, not app-lifetime) ----
  spirit.core.jobs.subscribe({
    onSnapshot: function (jobs) {
      jobsById.clear();
      jobs.forEach(function (job) { jobsById.set(job.id, job); });
      discoverDynamicApps(jobs);
      pruneStalePreferences();
      notifyFileSubscribers();
      notifyJobSubscribers(null);
      renderActive();
    },
    onUpdate: function (job) {
      jobsById.set(job.id, job);
      notifyFileSubscribers();
      notifyJobSubscribers(job);
      renderActive();
    },
    onDelete: function (id) {
      jobsById.delete(id);
      notifyFileSubscribers();
      notifyJobSubscribers(null);
      renderActive();
    },
  });
})();
