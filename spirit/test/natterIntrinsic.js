'use strict';

// Cycle — Natter is an intrinsic shell app.
//
// Natter is how a personal node learns of any public relay at all. A
// shell that cannot reach it, or an App Builder that can overwrite it,
// is a node that can be talked out of having a mailbox. So:
//
//   - the manifest says "intrinsic": true and keeps "owner": "system";
//   - the shell always draws it, and refuses the Location override that
//     is how a user takes an ordinary app off the desktop;
//   - saveAppScript and saveAppManifest — the two deliberate exceptions
//     to "nothing may write an app's own files" — refuse it, reading the
//     flag from what is on disk rather than from the content offered;
//   - Relay Chat stays an ordinary app, and the last-relay lock stays.
//
// The shell half is browser code, so shell.js is loaded here with small
// document/spirit stubs and driven through its real discovery path,
// rather than asserting on its source. See CYCLE-NATTER-INTRINSIC.md.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const spirit = require('../run/js/kernel.js');

const RUN_DIR = path.join(__dirname, '..', 'run');
const NATTER_SCRIPT = 'app/natter/natter.js';
const NATTER_MANIFEST = 'app/natter/natter.json';

function readRun(rel) {
  return fs.readFileSync(path.join(RUN_DIR, rel), 'utf8');
}

function manifest(rel) {
  return JSON.parse(readRun(rel));
}

// ---------------------------------------------------------------------
// A shell, in node: only the handful of browser things shell.js touches.
// ---------------------------------------------------------------------

function fakeElement(tag) {
  let html = '';
  const el = {
    tag: tag,
    className: '',
    textContent: '',
    hidden: false,
    children: [],
    appendChild: function (child) { el.children.push(child); return child; },
    addEventListener: function () {},
    querySelector: function () { return fakeElement('div'); },
  };
  // Setting innerHTML drops the children, as it does in a browser — the
  // desktop is rebuilt that way (innerHTML = '' then appendChild), and a
  // stub that only appended would show every render ever done.
  Object.defineProperty(el, 'innerHTML', {
    get: function () { return html; },
    set: function (v) { html = String(v); el.children.length = 0; },
    enumerable: true,
  });
  return el;
}

function fakeDocument() {
  const byId = {};
  ['desktop', 'app-container', 'app-title', 'app-content', 'app-close', 'app-home'].forEach(function (id) {
    byId[id] = fakeElement('div');
  });
  return {
    byId: byId,
    body: fakeElement('body'),
    getElementById: function (id) { return byId[id] || (byId[id] = fakeElement('div')); },
    createElement: fakeElement,
    createDocumentFragment: function () { return fakeElement('fragment'); },
  };
}

// Boots the real shell.js against the real app manifests on disk, with
// preferences supplied by the test rather than by preferences.json.
function bootShell(preferences, appScripts) {
  const doc = fakeDocument();
  const saved = { preferences: null };
  const subscribers = [];
  const shellSpirit = {
    core: {
      const: { ICON: spirit.core.const.ICON, MIME: {} },
      util: {
        escapeHtml: spirit.core.util.escapeHtml,
        formatBytes: function () { return ''; },
      },
      fs: {
        loadFile: function (rel) {
          if (rel === 'preferences.json') return JSON.stringify(preferences);
          try { return readRun(rel); } catch (e) { return null; }
        },
        saveFile: function (rel, content) {
          if (rel === 'preferences.json') saved.preferences = JSON.parse(content);
          return Promise.resolve();
        },
        statFile: function () { return null; },
        getAnnotations: function () { return {}; },
        createScopedFs: function () { return {}; },
      },
      jobs: {
        subscribe: function (handlers) { subscribers.push(handlers); },
      },
    },
  };

  const src = fs.readFileSync(path.join(RUN_DIR, 'js', 'client', 'shell.js'), 'utf8');
  new Function('spirit', 'document', src)(shellSpirit, doc);

  // The one snapshot the shell discovers apps from: an fs-watcher job
  // listing entry scripts, exactly as jobs.js delivers it.
  subscribers.forEach(function (h) {
    h.onSnapshot([{
      id: 'fs-watcher-1',
      type: 'fs-watcher',
      data: {
        files: appScripts.map(function (rel) {
          return { kind: 'file', relativePath: rel };
        }),
      },
    }]);
  });

  return {
    shell: shellSpirit.shell,
    desktop: doc.byId.desktop,
    saved: saved,
  };
}

function desktopLabels(booted) {
  return booted.desktop.children.map(function (el) { return el.innerHTML; }).join(' | ');
}

// What the Spirit app's own icon grid would contain: its fixed built-in
// members plus whatever the shell reports as intrinsic (index.html).
function spiritGroupLabels(booted) {
  const grid = fakeElement('div');
  booted.shell.renderAppGroup(grid, ['stats', 'process-browser', 'jobs', 'app-manager', 'group-manager']
    .concat(booted.shell.listIntrinsicApps()));
  return grid.children.map(function (el) { return el.innerHTML; }).join(' | ');
}

function appById(booted, id) {
  return booted.shell.listApps().filter(function (a) { return a.id === id; })[0] || null;
}

// The Apps panel's own row renderer, lifted out of index.html's inline
// script with its handful of dependencies stubbed. Refusing the write is
// half the job; the other half is that the panel must not offer the
// control at all, and that lives in markup no other test can see.
function appManagerRow(app) {
  const src = fs.readFileSync(path.join(RUN_DIR, 'index.html'), 'utf8');
  const start = src.indexOf('function locationLabel');
  const end = src.indexOf('function renderAppManagerTable');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('renderAppManagerRow could not be found in index.html — this test needs updating with it');
  }
  const shellStub = { shell: { SPIRIT_GROUP_ID: 'spirit' } };
  const render = new Function('spirit', 'ICON', 'escapeHtml', 'fileInfoRow', 'getAppOverride',
    'var expandedAppId = "EXPANDED";' + src.slice(start, end) + '\nreturn renderAppManagerRow;'
  )(
    shellStub,
    { POINTDOWN: 'v', POINTRIGHT: '>' },
    spirit.core.util.escapeHtml,
    function (k, v) { return k + '=' + v + ';'; },
    function () { return {}; }
  );
  const row = {};
  Object.keys(app).forEach(function (k) { row[k] = app[k]; });
  row.id = 'EXPANDED'; // expanded, so the edit panel is rendered
  return render(row, {}, []);
}

test.startTest('Natter is intrinsic — always in the shell, never overwritten');

{
  const m = manifest(NATTER_MANIFEST);
  if (m.intrinsic === true && m.owner === 'system') {
    test.check('natter.json declares intrinsic and stays owned by the system');
  } else {
    test.fail('manifest: ' + JSON.stringify(m));
  }

  if (m.hidden === false) {
    test.check('and it is not hidden');
  } else {
    test.fail('hidden: ' + JSON.stringify(m.hidden));
  }

  // Relay Chat is a normal app and is meant to stay one — this cycle
  // pins Natter only.
  const rc = manifest('app/relayChat/relayChat.json');
  if (!rc.intrinsic) {
    test.check('Relay Chat is not intrinsic');
  } else {
    test.fail('relayChat manifest: ' + JSON.stringify(rc));
  }
}

test.subHeading('The two App Builder exceptions refuse it');

{
  const scriptBefore = readRun(NATTER_SCRIPT);
  const manifestBefore = readRun(NATTER_MANIFEST);

  const script = spirit.core.fs.saveAppScript(NATTER_SCRIPT, '// pwned\n');
  if (!script.ok && script.reason === 'intrinsic-app') {
    test.check('saveAppScript refuses the intrinsic entry script');
  } else {
    test.fail('saveAppScript: ' + JSON.stringify(script));
  }

  // The manifest write is the more interesting one: it would have forced
  // owner:'user', which is exactly how Natter would stop being the
  // node's own app.
  const written = spirit.core.fs.saveAppManifest(NATTER_MANIFEST, JSON.stringify({
    name: 'NATter', icon: 'GLOBE', hidden: true, intrinsic: false,
  }));
  if (!written.ok && written.reason === 'intrinsic-app') {
    test.check('saveAppManifest refuses the intrinsic manifest');
  } else {
    test.fail('saveAppManifest: ' + JSON.stringify(written));
  }

  if (readRun(NATTER_SCRIPT) === scriptBefore && readRun(NATTER_MANIFEST) === manifestBefore) {
    test.check('neither file changed on disk');
  } else {
    test.fail('a refused write still reached the disk');
  }

  // The flag is read from disk, never from the content offered: a caller
  // cannot clear it by simply not sending it.
  const clearing = spirit.core.fs.saveAppManifest(NATTER_MANIFEST, JSON.stringify({ name: 'NATter' }));
  if (!clearing.ok && clearing.reason === 'intrinsic-app' && manifest(NATTER_MANIFEST).intrinsic === true) {
    test.check('a manifest that simply omits the flag does not clear it');
  } else {
    test.fail('clearing: ' + JSON.stringify(clearing));
  }

  // And the ordinary guard is unchanged: saveFile never writes either
  // file, intrinsic or not.
  const viaSaveFile = spirit.core.fs.saveFile(NATTER_SCRIPT, '// pwned\n');
  if (!viaSaveFile.ok && readRun(NATTER_SCRIPT) === scriptBefore) {
    test.check('saveFile still refuses an app entry script, as it always did');
  } else {
    test.fail('saveFile: ' + JSON.stringify(viaSaveFile));
  }
}

test.subHeading('An ordinary app is still writable through them');

{
  // The lock has to be about intrinsic, not about app/ — App Builder must
  // still work. Written into a throwaway app folder and removed again.
  const probeDir = path.join(RUN_DIR, 'app', 'zzIntrinsicProbe');
  try {
    fs.mkdirSync(probeDir, { recursive: true });
    const okManifest = spirit.core.fs.saveAppManifest(
      'app/zzIntrinsicProbe/zzIntrinsicProbe.json',
      JSON.stringify({ name: 'Probe', icon: 'FILE' })
    );
    const okScript = spirit.core.fs.saveAppScript('app/zzIntrinsicProbe/zzIntrinsicProbe.js', '// probe\n');

    if (okManifest.ok && okScript.ok) {
      test.check('a non-intrinsic app is written by both, unchanged from before this cycle');
    } else {
      test.fail('probe writes: ' + JSON.stringify({ manifest: okManifest, script: okScript }));
    }

    const stored = JSON.parse(fs.readFileSync(path.join(probeDir, 'zzIntrinsicProbe.json'), 'utf8'));
    if (stored.owner === 'user') {
      test.check('and it is still stamped owner:user by the kernel');
    } else {
      test.fail('probe owner: ' + JSON.stringify(stored));
    }

    // Pin the probe the only way anything can be pinned — by what is on
    // disk — and the same two calls that just succeeded are refused. That
    // is the proof the guard reads the manifest rather than the name
    // "natter". (This route can pin an app nobody had pinned yet; it can
    // never unpin one, which is the direction that matters.)
    const pinning = spirit.core.fs.saveAppManifest(
      'app/zzIntrinsicProbe/zzIntrinsicProbe.json',
      JSON.stringify({ name: 'Probe', icon: 'FILE', intrinsic: true })
    );
    const afterScript = spirit.core.fs.saveAppScript('app/zzIntrinsicProbe/zzIntrinsicProbe.js', '// again\n');
    const afterManifest = spirit.core.fs.saveAppManifest(
      'app/zzIntrinsicProbe/zzIntrinsicProbe.json',
      JSON.stringify({ name: 'Probe', icon: 'FILE' })
    );
    if (pinning.ok && !afterScript.ok && afterScript.reason === 'intrinsic-app' &&
        !afterManifest.ok && afterManifest.reason === 'intrinsic-app') {
      test.check('the guard is the manifest on disk, not the name "natter"');
    } else {
      test.fail('after pinning: ' + JSON.stringify({ pinning: pinning, script: afterScript, manifest: afterManifest }));
    }
  } finally {
    fs.rmSync(probeDir, { recursive: true, force: true });
  }
}

test.subHeading('The shell always draws it');

{
  const booted = bootShell({ defaultHandlers: {}, appOverrides: {}, groups: {} },
    [NATTER_SCRIPT, 'app/relayChat/relayChat.js']);

  const natter = appById(booted, 'app/natter');
  if (natter && natter.intrinsic === true) {
    test.check('the shell reports Natter as intrinsic');
  } else {
    test.fail('listApps: ' + JSON.stringify(booted.shell.listApps()));
  }

  const relayChat = appById(booted, 'app/relayChat');
  if (relayChat && relayChat.intrinsic === false) {
    test.check('and Relay Chat as an ordinary app');
  } else {
    test.fail('relayChat: ' + JSON.stringify(relayChat));
  }

  if (natter && natter.group === booted.shell.SPIRIT_GROUP_ID) {
    test.check('its location is the Spirit group');
  } else {
    test.fail('group: ' + JSON.stringify(natter));
  }

  if (spiritGroupLabels(booted).indexOf('NATter') !== -1) {
    test.check('and its icon is in the Spirit grid, beside Stats and Jobs');
  } else {
    test.fail('spirit grid: ' + spiritGroupLabels(booted));
  }

  // One home, not two: a grouped app is not also loose on the desktop.
  if (desktopLabels(booted).indexOf('NATter') === -1) {
    test.check('so it is not a second time on the desktop root');
  } else {
    test.fail('desktop: ' + desktopLabels(booted));
  }

  // Relay Chat is ungrouped and stays where it was.
  if (desktopLabels(booted).indexOf('Relay Chat') !== -1) {
    test.check('Relay Chat is untouched on the desktop');
  } else {
    test.fail('relayChat desktop: ' + desktopLabels(booted));
  }
}

test.subHeading('And there is no way to take it off');

{
  const booted = bootShell({ defaultHandlers: {}, appOverrides: {}, groups: {} },
    [NATTER_SCRIPT, 'app/relayChat/relayChat.js']);

  const refused = booted.shell.setAppOverride('app/natter', { group: 'none' });
  if (!refused.ok && refused.reason === 'intrinsic-app-group-locked') {
    test.check('setting its Location to None is refused');
  } else {
    test.fail('override: ' + JSON.stringify(refused));
  }

  // Not just None — no group at all, including a real user group and a
  // clear-back-to-Desktop, which is the other way out of Spirit.
  const made = booted.shell.createGroup('Andy stuff', '📦');
  const intoGroup = booted.shell.setAppOverride('app/natter', { group: made.id });
  const toDesktop = booted.shell.setAppOverride('app/natter', { group: '' });
  if (!intoGroup.ok && intoGroup.reason === 'intrinsic-app-group-locked' &&
      !toDesktop.ok && toDesktop.reason === 'intrinsic-app-group-locked') {
    test.check('a user group and a reset to Desktop are refused the same way');
  } else {
    test.fail('other moves: ' + JSON.stringify({ intoGroup: intoGroup, toDesktop: toDesktop }));
  }

  if (spiritGroupLabels(booted).indexOf('NATter') !== -1 && desktopLabels(booted).indexOf('NATter') === -1) {
    test.check('and it is still in Spirit afterwards');
  } else {
    test.fail('after refusal — spirit: ' + spiritGroupLabels(booted) + ' desktop: ' + desktopLabels(booted));
  }

  // The same lock has to hold against a preferences.json that already
  // moved it — hand-edited, or written before the app was pinned. This is
  // the reload Andy checks: nothing stored can strand it.
  const stale = bootShell({
    defaultHandlers: {},
    appOverrides: { 'app/natter': { group: 'none' } },
    groups: {},
  }, [NATTER_SCRIPT, 'app/relayChat/relayChat.js']);

  const staleNatter = appById(stale, 'app/natter');
  if (staleNatter.group === stale.shell.SPIRIT_GROUP_ID && spiritGroupLabels(stale).indexOf('NATter') !== -1) {
    test.check('a preferences file that already said "none" is ignored on reload');
  } else {
    test.fail('stale prefs: ' + JSON.stringify(staleNatter) + ' spirit: ' + spiritGroupLabels(stale));
  }

  // Relay Chat, by contrast, is the operator's to move — otherwise this
  // whole test would pass on a shell where nobody can move anything.
  const moved = stale.shell.setAppOverride('app/relayChat', { group: 'none' });
  if (moved.ok && desktopLabels(stale).indexOf('Relay Chat') === -1) {
    test.check('Relay Chat can still be taken off the desktop');
  } else {
    test.fail('relayChat move: ' + JSON.stringify(moved) + ' desktop: ' + desktopLabels(stale));
  }
}

test.subHeading('Name and icon stay as shipped');

{
  const booted = bootShell({ defaultHandlers: {}, appOverrides: {}, groups: {} },
    [NATTER_SCRIPT, 'app/relayChat/relayChat.js']);

  // The lock a built-in has had all along, arriving by a different route:
  // theirs is "no _scriptPath", which stops being true the moment the
  // five in index.html move into app/. Intrinsic is what has to carry it
  // then, so it has to be true now (CLEANUP-PLAN step 1).
  const renamed = booted.shell.setAppOverride('app/natter', { name: 'Mailboxes' });
  const reIconed = booted.shell.setAppOverride('app/natter', { icon: '💀' });
  if (!renamed.ok && renamed.reason === 'intrinsic-app-name-locked' &&
      !reIconed.ok && reIconed.reason === 'intrinsic-app-icon-locked') {
    test.check('a custom name and a custom icon are both refused');
  } else {
    test.fail('rename/re-icon: ' + JSON.stringify({ name: renamed, icon: reIconed }));
  }

  // Clearing is a write too — '' means "reset this property", and on an
  // app that has no override to reset it is just another way in.
  const cleared = booted.shell.setAppOverride('app/natter', { name: '' });
  if (!cleared.ok && cleared.reason === 'intrinsic-app-name-locked') {
    test.check('and so is a reset-to-default');
  } else {
    test.fail('clear: ' + JSON.stringify(cleared));
  }

  const natter = appById(booted, 'app/natter');
  if (natter.name === 'NATter' && natter.icon === spirit.core.const.ICON.GLOBE) {
    test.check('the shell still reports the shipped name and icon');
  } else {
    test.fail('after refusals: ' + JSON.stringify(natter));
  }

  // Refusing the write is half a lock. A preferences.json written before
  // the app was pinned — or edited by hand — must not rename it either.
  const stale = bootShell({
    defaultHandlers: {},
    appOverrides: { 'app/natter': { name: 'Mailboxes', icon: '💀' } },
    groups: {},
  }, [NATTER_SCRIPT, 'app/relayChat/relayChat.js']);

  const staleNatter = appById(stale, 'app/natter');
  if (staleNatter.name === 'NATter' && staleNatter.icon === spirit.core.const.ICON.GLOBE) {
    test.check('a stored name/icon override is ignored on reload');
  } else {
    test.fail('stale override: ' + JSON.stringify(staleNatter));
  }

  if (spiritGroupLabels(stale).indexOf('NATter') !== -1 && spiritGroupLabels(stale).indexOf('Mailboxes') === -1) {
    test.check('so the Spirit grid draws the shipped name, not the stored one');
  } else {
    test.fail('spirit grid: ' + spiritGroupLabels(stale));
  }

  // Relay Chat is still the operator's to rename — the lock is about
  // being intrinsic, not about being an app.
  const rcRenamed = stale.shell.setAppOverride('app/relayChat', { name: 'Chat' });
  if (rcRenamed.ok && appById(stale, 'app/relayChat').name === 'Chat') {
    test.check('Relay Chat can still be renamed');
  } else {
    test.fail('relayChat rename: ' + JSON.stringify(rcRenamed));
  }
}

test.subHeading('The Apps panel offers no control it would refuse');

{
  const intrinsicRow = appManagerRow({
    name: 'NATter', defaultName: 'NATter', icon: '🌐', defaultIcon: '🌐',
    group: 'spirit', dynamic: true, intrinsic: true,
  });

  const controls = ['app-manager-name-input', 'app-manager-icon-input', 'app-manager-group-input'];
  const offered = controls.filter(function (id) { return intrinsicRow.indexOf(id) !== -1; });
  if (offered.length === 0) {
    test.check('an intrinsic row has no name, icon or Location control');
  } else {
    test.fail('still offered: ' + offered.join(', '));
  }

  // Nor a Reset to default, which is the same write by another button.
  if (intrinsicRow.indexOf('data-reset-app-name') === -1 && intrinsicRow.indexOf('data-reset-app-icon') === -1) {
    test.check('and no Reset to default buttons');
  } else {
    test.fail('reset buttons present: ' + intrinsicRow);
  }

  if (intrinsicRow.indexOf('Intrinsic shell app') !== -1) {
    test.check('it says why, in one note');
  } else {
    test.fail('no note: ' + intrinsicRow);
  }

  // And the panel is otherwise untouched: an ordinary app still gets all
  // three, or this test would pass on a panel that renders nothing.
  const ordinaryRow = appManagerRow({
    name: 'Relay Chat', defaultName: 'Relay Chat', icon: '📄', defaultIcon: '📄',
    group: null, dynamic: true, intrinsic: false,
  });
  const ordinaryOffered = controls.filter(function (id) { return ordinaryRow.indexOf(id) !== -1; });
  if (ordinaryOffered.length === 3) {
    test.check('an ordinary app still gets name, icon and Location');
  } else {
    test.fail('ordinary row offers only: ' + ordinaryOffered.join(', '));
  }

  // The five in index.html reach the same lock by the other route: no
  // script path. Their icon was the one control still on offer, which is
  // what Andy found in the Apps app.
  const builtInRow = appManagerRow({
    name: 'Jobs', defaultName: 'Jobs', icon: '⚙️', defaultIcon: '⚙️',
    group: null, dynamic: false, intrinsic: false,
  });
  const builtInOffered = controls.filter(function (id) { return builtInRow.indexOf(id) !== -1; });
  if (builtInOffered.length === 0) {
    test.check('a built-in row offers no icon control either');
  } else {
    test.fail('built-in still offers: ' + builtInOffered.join(', '));
  }

  if (builtInRow.indexOf('data-reset-app-icon') === -1 && builtInRow.indexOf('Built-in shell utility') !== -1) {
    test.check('and says so in its own note, with no Reset button');
  } else {
    test.fail('built-in note: ' + builtInRow);
  }
}

test.subHeading('The Spirit grid draws one tile per id');

{
  const booted = bootShell({ defaultHandlers: {}, appOverrides: {}, groups: {} },
    [NATTER_SCRIPT, 'app/relayChat/relayChat.js']);

  function tiles(ids) {
    const grid = fakeElement('div');
    booted.shell.renderAppGroup(grid, ids);
    return grid.children.map(function (el) { return el.innerHTML; });
  }

  // The shape index.html builds: a fixed member list, union every
  // intrinsic app. Today they do not overlap; as the five move into
  // app/<name>/ and become intrinsic, they will — and an app in both
  // halves must not get two tiles.
  const overlapping = ['app/natter', 'app/relayChat'].concat(booted.shell.listIntrinsicApps());
  const drawn = tiles(overlapping);
  const natterTiles = drawn.filter(function (html) { return html.indexOf('NATter') !== -1; });
  if (overlapping.filter(function (id) { return id === 'app/natter'; }).length === 2 && natterTiles.length === 1) {
    test.check('an id named twice in the list draws one tile');
  } else {
    test.fail('list ' + JSON.stringify(overlapping) + ' drew ' + JSON.stringify(drawn));
  }

  if (drawn.length === 2) {
    test.check('and the other member is still drawn, once');
  } else {
    test.fail('grid: ' + JSON.stringify(drawn));
  }

  // First mention wins, so a fixed list keeps its curated order and the
  // intrinsic half only ever appends what is not already there.
  const ordered = tiles(['app/relayChat', 'app/natter', 'app/relayChat']);
  if (ordered.length === 2 && ordered[0].indexOf('Relay Chat') !== -1 && ordered[1].indexOf('NATter') !== -1) {
    test.check('first mention wins, so the curated order survives');
  } else {
    test.fail('order: ' + JSON.stringify(ordered));
  }

  // Unchanged from before: an id nothing has registered is skipped, not
  // drawn as an empty tile and not thrown over.
  if (tiles(['app/natter', 'not-an-app', 'app/natter']).length === 1) {
    test.check('an unregistered id is still skipped');
  } else {
    test.fail('unknown id: ' + JSON.stringify(tiles(['app/natter', 'not-an-app', 'app/natter'])));
  }
}

test.subHeading('Built-ins are locked by having no folder — until they get one');

{
  const booted = bootShell({ defaultHandlers: {}, appOverrides: {}, groups: {} },
    [NATTER_SCRIPT, 'app/relayChat/relayChat.js']);

  // Registered exactly as index.html registers the five: no script path,
  // no manifest, no intrinsic flag.
  booted.shell.registerApp({
    id: 'jobs', name: 'Jobs', icon: '⚙️', hidden: true,
    mount: function () {}, render: function () {},
  });

  const icon = booted.shell.setAppOverride('jobs', { icon: '💀' });
  const name = booted.shell.setAppOverride('jobs', { name: 'Tasks' });
  const group = booted.shell.setAppOverride('jobs', { group: 'none' });
  if (!icon.ok && icon.reason === 'core-app-icon-locked' &&
      !name.ok && name.reason === 'core-app-name-locked' &&
      !group.ok && group.reason === 'core-app-group-locked') {
    test.check('a built-in refuses icon as it already refused name and group');
  } else {
    test.fail('built-in patches: ' + JSON.stringify({ icon: icon, name: name, group: group }));
  }

  // Read side too: a preferences.json written before the icon was locked
  // must not keep repainting it.
  const stale = bootShell({
    defaultHandlers: {},
    appOverrides: { jobs: { icon: '💀', name: 'Tasks' } },
    groups: {},
  }, [NATTER_SCRIPT]);
  stale.shell.registerApp({
    id: 'jobs', name: 'Jobs', icon: '⚙️', hidden: true,
    mount: function () {}, render: function () {},
  });
  const listed = stale.shell.listApps().filter(function (a) { return a.id === 'jobs'; })[0];
  if (listed && listed.name === 'Jobs' && listed.icon === '⚙️') {
    test.check('and a stored override for one is ignored on reload');
  } else {
    test.fail('stale built-in: ' + JSON.stringify(listed));
  }
}

test.reportSuccessFailureCount();
