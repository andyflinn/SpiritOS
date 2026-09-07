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
    querySelectorAll: function () { return []; },
    remove: function () {},
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
// `deferSnapshot` leaves the shell where a real page is between load and
// the first fs-watcher message: apps registered by index.html exist,
// discovery and pruneStalePreferences have not run yet. That is the slot
// migrateAppIds occupies in production, and the only way to exercise the
// ordering from outside.
function bootShell(preferences, appScripts, deferSnapshot) {
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
  // listing entry scripts, exactly as jobs.js delivers it. Also what
  // drives pruneStalePreferences, which is why a test can re-fire it.
  function snapshot(scripts) {
    subscribers.forEach(function (h) {
      h.onSnapshot([{
        id: 'fs-watcher-1',
        type: 'fs-watcher',
        data: {
          files: scripts.map(function (rel) {
            return { kind: 'file', relativePath: rel };
          }),
        },
      }]);
    });
  }

  if (!deferSnapshot) snapshot(appScripts);

  return {
    shell: shellSpirit.shell,
    desktop: doc.byId.desktop,
    saved: saved,
    snapshot: snapshot,
    // Entry scripts are injected into document.body — one appended child
    // per script the shell decided to fetch.
    scripts: doc.body.children,
  };
}

function desktopLabels(booted) {
  return booted.desktop.children.map(function (el) { return el.innerHTML; }).join(' | ');
}

// The Spirit app's fixed member list, read out of index.html rather than
// copied here — this list is repointed by every move (step 5), and a
// copy would keep passing while naming apps that no longer exist.
function spiritMemberIds() {
  const found = readRun('index.html').match(/renderAppGroup\(grid, \[([^\]]*)\]/);
  if (!found) throw new Error("the Spirit app's member list could not be found in index.html");
  return found[1].split(',').map(function (s) { return s.trim().replace(/^'|'$/g, ''); });
}

// What the Spirit app's own icon grid would contain: its fixed members
// plus whatever the shell reports as intrinsic.
function spiritGroupLabels(booted) {
  const grid = fakeElement('div');
  booted.shell.renderAppGroup(grid, spiritMemberIds().concat(booted.shell.listIntrinsicApps()));
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
  // Moved out of index.html in CLEANUP-PLAN step 5.3 — it is an app now,
  // and its row renderer moved with it.
  const src = readRun('app/apps/apps.js');
  const start = src.indexOf('function locationLabel');
  const end = src.indexOf('function renderAppManagerTable');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('renderAppManagerRow could not be found in app/apps/apps.js — this test needs updating with it');
  }
  const shellStub = {
    shell: {
      SPIRIT_GROUP_ID: 'spirit',
      getAppOverride: function () { return {}; },
      fileInfoRow: function (k, v) { return k + '=' + v + ';'; },
    },
    core: { const: { ICON: { POINTDOWN: 'v', POINTRIGHT: '>' } }, util: { escapeHtml: spirit.core.util.escapeHtml } },
  };
  const render = new Function('spirit', 'APPS_ICON', 'appsEscapeHtml',
    'var expandedAppId = "EXPANDED";' + src.slice(start, end) + '\nreturn renderAppManagerRow;'
  )(
    shellStub,
    { POINTDOWN: 'v', POINTRIGHT: '>' },
    spirit.core.util.escapeHtml
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

  // Every distinct registered id in the list gets exactly one tile — the
  // list itself grows as apps move and become intrinsic, so count the
  // unique ids rather than a fixed number.
  const unique = overlapping.filter(function (id, i) { return overlapping.indexOf(id) === i; });
  if (drawn.length === unique.length) {
    test.check('and every other member is drawn, once each');
  } else {
    test.fail('ids ' + JSON.stringify(unique) + ' drew ' + JSON.stringify(drawn));
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

test.subHeading('Spirit is not empty before the first snapshot');

{
  // A node whose fs-watcher never reports — a failed job, a jobs stream
  // that never connects — must still reach Natter, or it cannot be
  // pointed at a mailbox at all. Deferred snapshot is exactly that node.
  const booted = bootShell({ defaultHandlers: {}, appOverrides: {}, groups: {} },
    [NATTER_SCRIPT, 'app/relayChat/relayChat.js'], true);

  if (booted.shell.INTRINSIC_APP_FOLDERS.indexOf('natter') !== -1) {
    test.check('natter is on the eager boot list');
  } else {
    test.fail('boot list: ' + JSON.stringify(booted.shell.INTRINSIC_APP_FOLDERS));
  }

  const natter = appById(booted, 'app/natter');
  if (natter && natter.intrinsic === true && spiritGroupLabels(booted).indexOf('NATter') !== -1) {
    test.check('it is declared and in the Spirit grid with no snapshot at all');
  } else {
    test.fail('before snapshot: ' + JSON.stringify(natter) + ' grid: ' + spiritGroupLabels(booted));
  }

  // Eager is about the MANIFEST. The entry script is still not fetched
  // until the tile is opened — first paint must not pull every app's
  // code, which is the other half of the decision.
  if (booted.scripts.length === 0) {
    test.check('and its entry script has not been fetched');
  } else {
    test.fail('scripts injected at boot: ' + JSON.stringify(booted.scripts));
  }

  // Ordinary apps are still the watcher's business — the boot list is a
  // short-cut for the apps that are the node, not a second registry.
  if (!appById(booted, 'app/relayChat')) {
    test.check('an ordinary app still waits for the snapshot');
  } else {
    test.fail('relayChat declared before the snapshot');
  }

  booted.snapshot([NATTER_SCRIPT, 'app/relayChat/relayChat.js']);
  if (appById(booted, 'app/relayChat') && spiritGroupLabels(booted).split('NATter').length === 2) {
    test.check('and when the snapshot arrives, it lands — Natter still once');
  } else {
    test.fail('after snapshot: ' + spiritGroupLabels(booted));
  }
}

test.subHeading('Stats has moved out of index.html');

{
  const STATS_SCRIPT = 'app/stats/stats.js';
  const manifest = JSON.parse(readRun('app/stats/stats.json'));

  if (manifest.intrinsic === true && manifest.owner === 'system') {
    test.check('app/stats has a manifest, intrinsic and system-owned');
  } else {
    test.fail('stats manifest: ' + JSON.stringify(manifest));
  }

  const html = readRun('index.html');
  if (html.indexOf("id: 'stats'") === -1 && html.indexOf('function tileHtml') === -1) {
    test.check('and index.html no longer registers it, helpers and all');
  } else {
    test.fail('index.html still carries the Stats app');
  }

  // The three places that know an id, moved together: without any one of
  // them, the move is a Stats nobody can reach, a Spirit tile that draws
  // nothing, or an operator's overrides pruned on first load.
  const booted = bootShell({ defaultHandlers: {}, appOverrides: {}, groups: {} },
    [NATTER_SCRIPT, STATS_SCRIPT], true);

  if (booted.shell.APP_ID_RENAMES.stats === 'app/stats') {
    test.check('the rename map carries stats → app/stats');
  } else {
    test.fail('renames: ' + JSON.stringify(booted.shell.APP_ID_RENAMES));
  }

  if (booted.shell.INTRINSIC_APP_FOLDERS.indexOf('stats') !== -1) {
    test.check('the boot list carries it, so it survives a dead watcher');
  } else {
    test.fail('boot list: ' + JSON.stringify(booted.shell.INTRINSIC_APP_FOLDERS));
  }

  if (spiritMemberIds().indexOf('app/stats') !== -1) {
    test.check("and the Spirit group names it by its new id");
  } else {
    test.fail("Spirit member list: " + JSON.stringify(spiritMemberIds()));
  }

  const stats = appById(booted, 'app/stats');
  if (stats && stats.intrinsic === true && stats.group === booted.shell.SPIRIT_GROUP_ID) {
    test.check('it is declared before any snapshot, in the Spirit group');
  } else {
    test.fail('stats app: ' + JSON.stringify(stats));
  }

  const grid = spiritGroupLabels(booted);
  if (grid.indexOf('Stats') !== -1 && grid.split('Stats').length === 2) {
    test.check('and draws exactly one tile there');
  } else {
    test.fail('spirit grid: ' + grid);
  }

  // Same locks the rest of the intrinsic set has: it can no longer be
  // renamed by having no script path, so the flag has to carry it.
  const renamed = booted.shell.setAppOverride('app/stats', { name: 'Vitals' });
  const moved = booted.shell.setAppOverride('app/stats', { group: 'none' });
  if (!renamed.ok && renamed.reason === 'intrinsic-app-name-locked' &&
      !moved.ok && moved.reason === 'intrinsic-app-group-locked') {
    test.check('and it is locked as an intrinsic app, not as a built-in');
  } else {
    test.fail('locks: ' + JSON.stringify({ name: renamed, group: moved }));
  }

  // The operator's own customisations from before the move.
  const carried = bootShell({
    defaultHandlers: {},
    appOverrides: { stats: { name: 'Vitals' } },
    groups: {},
  }, [NATTER_SCRIPT, STATS_SCRIPT], true);
  const prefs = carried.saved.preferences;
  if (prefs && prefs.appOverrides['app/stats'] && prefs.appOverrides.stats === undefined) {
    test.check('a stored override under the old id is carried across at boot');
  } else {
    test.fail('carried: ' + JSON.stringify(prefs && prefs.appOverrides));
  }

  // ...and then ignored, because an intrinsic app shows its shipped name.
  // Carrying it still matters: the flag could come off, and a silently
  // deleted preference cannot come back.
  if (appById(carried, 'app/stats').name === 'Stats') {
    test.check('though the shipped name is what it shows, being intrinsic');
  } else {
    test.fail('name: ' + JSON.stringify(appById(carried, 'app/stats')));
  }
}

test.subHeading('Jobs has moved out of index.html');

{
  const JOBS_SCRIPT = 'app/jobs/jobs.js';
  const manifest = JSON.parse(readRun('app/jobs/jobs.json'));
  const html = readRun('index.html');

  if (manifest.intrinsic === true && manifest.owner === 'system') {
    test.check('app/jobs has a manifest, intrinsic and system-owned');
  } else {
    test.fail('jobs manifest: ' + JSON.stringify(manifest));
  }

  if (html.indexOf("id: 'jobs'") === -1 && html.indexOf('function renderJobRow') === -1) {
    test.check('and index.html no longer registers it, table and all');
  } else {
    test.fail('index.html still carries the Jobs app');
  }

  const booted = bootShell({ defaultHandlers: {}, appOverrides: {}, groups: {} },
    [NATTER_SCRIPT, 'app/stats/stats.js', JOBS_SCRIPT], true);

  if (booted.shell.APP_ID_RENAMES.jobs === 'app/jobs' &&
      booted.shell.INTRINSIC_APP_FOLDERS.indexOf('jobs') !== -1) {
    test.check('the rename map and the boot list both carry it');
  } else {
    test.fail('lists: ' + JSON.stringify({
      renames: booted.shell.APP_ID_RENAMES,
      boot: booted.shell.INTRINSIC_APP_FOLDERS,
    }));
  }

  const jobs = appById(booted, 'app/jobs');
  const grid = spiritGroupLabels(booted);
  if (jobs && jobs.intrinsic === true && grid.indexOf('Jobs') !== -1 && grid.split('Jobs').length === 2) {
    test.check('it is declared before any snapshot and draws one Spirit tile');
  } else {
    test.fail('jobs app: ' + JSON.stringify(jobs) + ' grid: ' + grid);
  }

  // This is the first move where OTHER code names the moved app. Three
  // sites did, and a missed one is a dead tile with no error anywhere:
  // renderAppGroup skips ids it cannot find, and launchApp returns on
  // one it does not know.
  if (spiritMemberIds().indexOf('app/jobs') !== -1) {
    test.check("the Spirit member list names it by its new id");
  } else {
    test.fail('Spirit member list: ' + JSON.stringify(spiritMemberIds()));
  }

  if (html.indexOf("launchApp('app/jobs')") !== -1 && html.indexOf("launchApp('jobs')") === -1) {
    test.check("the Process Browser's start-and-watch launch was repointed");
  } else {
    test.fail('index.html still launches the old jobs id');
  }

  const statsSrc = readRun('app/stats/stats.js');
  if (statsSrc.indexOf("'app/jobs'") !== -1 && statsSrc.indexOf("false, 'jobs'") === -1) {
    test.check("and the Stats app's Active jobs tile points at the new id");
  } else {
    test.fail('stats tile still points at the old jobs id');
  }

  // Every id the Spirit grid names must resolve to a registered app once
  // discovery has run — the check that would have caught a missed
  // rename, whichever of the five moves next.
  booted.snapshot([NATTER_SCRIPT, 'app/stats/stats.js', JOBS_SCRIPT]);
  booted.shell.registerApp({ id: 'process-browser', name: 'Processes', icon: '⚙', hidden: true, mount: function () {}, render: function () {} });
  booted.shell.registerApp({ id: 'app-manager', name: 'Apps', icon: '▦', hidden: true, mount: function () {}, render: function () {} });
  booted.shell.registerApp({ id: 'group-manager', name: 'Groups', icon: '◫', hidden: true, mount: function () {}, render: function () {} });

  const memberIds = spiritMemberIds();
  const known = booted.shell.listApps().map(function (a) { return a.id; });
  const missing = memberIds.filter(function (id) { return known.indexOf(id) === -1; });
  if (memberIds.length === 5 && missing.length === 0) {
    test.check('every id in the Spirit member list resolves to a real app');
  } else {
    test.fail('unresolved Spirit members: ' + JSON.stringify(missing) + ' of ' + JSON.stringify(memberIds));
  }
}

test.subHeading('Apps has moved out of index.html');

{
  const APPS_SCRIPT = 'app/apps/apps.js';
  const manifest = JSON.parse(readRun('app/apps/apps.json'));
  const html = readRun('index.html');

  if (manifest.intrinsic === true && manifest.owner === 'system') {
    test.check('app/apps has a manifest, intrinsic and system-owned');
  } else {
    test.fail('apps manifest: ' + JSON.stringify(manifest));
  }

  if (html.indexOf("id: 'app-manager'") === -1 && html.indexOf('function renderAppManagerTable') === -1) {
    test.check('and index.html no longer registers it, edit panel and all');
  } else {
    test.fail('index.html still carries the Apps app');
  }

  const booted = bootShell({ defaultHandlers: {}, appOverrides: {}, groups: {} },
    [NATTER_SCRIPT, 'app/stats/stats.js', 'app/jobs/jobs.js', APPS_SCRIPT], true);

  if (booted.shell.APP_ID_RENAMES['app-manager'] === 'app/apps' &&
      booted.shell.INTRINSIC_APP_FOLDERS.indexOf('apps') !== -1) {
    test.check('the rename map and the boot list both carry it');
  } else {
    test.fail('lists: ' + JSON.stringify({
      renames: booted.shell.APP_ID_RENAMES,
      boot: booted.shell.INTRINSIC_APP_FOLDERS,
    }));
  }

  const appsApp = appById(booted, 'app/apps');
  const grid = spiritGroupLabels(booted);
  if (appsApp && appsApp.intrinsic === true && grid.indexOf('Apps') !== -1) {
    test.check('it is declared before any snapshot and sits in the Spirit grid');
  } else {
    test.fail('apps app: ' + JSON.stringify(appsApp) + ' grid: ' + grid);
  }

  // Its id is not only in the Spirit list this time: the Groups app's
  // empty-state link into Apps lives in shell.js itself.
  const shellSrc = readRun('js/client/shell.js');
  if (shellSrc.indexOf("launchApp('app/apps')") !== -1 && shellSrc.indexOf("launchApp('app-manager')") === -1) {
    test.check("the shell's own \"go to Apps\" link was repointed");
  } else {
    test.fail('shell.js still launches the old app-manager id');
  }

  // Same guard as the last move, which is what makes it worth having:
  // every id the Spirit list names must resolve once discovery has run.
  booted.snapshot([NATTER_SCRIPT, 'app/stats/stats.js', 'app/jobs/jobs.js', APPS_SCRIPT]);
  ['process-browser', 'group-manager'].forEach(function (id) {
    booted.shell.registerApp({ id: id, name: id, icon: '▦', hidden: true, mount: function () {}, render: function () {} });
  });
  const known = booted.shell.listApps().map(function (a) { return a.id; });
  const missing = spiritMemberIds().filter(function (id) { return known.indexOf(id) === -1; });
  if (missing.length === 0) {
    test.check('every id in the Spirit member list still resolves');
  } else {
    test.fail('unresolved: ' + JSON.stringify(missing));
  }
}

test.subHeading('Processes has moved out of index.html');

{
  const PROCESS_SCRIPT = 'app/process-browser/process-browser.js';
  const MOVED_SCRIPTS = [NATTER_SCRIPT, 'app/stats/stats.js', 'app/jobs/jobs.js', 'app/apps/apps.js', PROCESS_SCRIPT];
  const manifest = JSON.parse(readRun('app/process-browser/process-browser.json'));
  const html = readRun('index.html');

  if (manifest.intrinsic === true && manifest.owner === 'system') {
    test.check('app/process-browser has a manifest, intrinsic and system-owned');
  } else {
    test.fail('processes manifest: ' + JSON.stringify(manifest));
  }

  if (html.indexOf("id: 'process-browser'") === -1 && html.indexOf('function renderProcessList') === -1) {
    test.check('and index.html no longer registers it, list and all');
  } else {
    test.fail('index.html still carries the Processes app');
  }

  const booted = bootShell({ defaultHandlers: {}, appOverrides: {}, groups: {} }, MOVED_SCRIPTS, true);

  if (booted.shell.APP_ID_RENAMES['process-browser'] === 'app/process-browser' &&
      booted.shell.INTRINSIC_APP_FOLDERS.indexOf('process-browser') !== -1) {
    test.check('the rename map and the boot list both carry it');
  } else {
    test.fail('lists: ' + JSON.stringify({
      renames: booted.shell.APP_ID_RENAMES,
      boot: booted.shell.INTRINSIC_APP_FOLDERS,
    }));
  }

  const processes = appById(booted, 'app/process-browser');
  const grid = spiritGroupLabels(booted);
  if (processes && processes.intrinsic === true && grid.indexOf('Processes') !== -1) {
    test.check('it is declared before any snapshot and sits in the Spirit grid');
  } else {
    test.fail('processes app: ' + JSON.stringify(processes) + ' grid: ' + grid);
  }

  // It opens a script through the viewer, and the viewer is what offers
  // "start as a job" and jumps to Jobs. Both of those launches stay on
  // spirit.shell until step 6 — what matters here is that the Jobs id
  // they name is the moved one.
  if (html.indexOf("launchApp('app/jobs')") !== -1) {
    test.check("the viewer's start-and-watch launch still names app/jobs");
  } else {
    test.fail('the launch into Jobs is missing or misnamed');
  }

  const src = readRun(PROCESS_SCRIPT);
  if (/\.readProject\(/.test(src) && src.indexOf('spirit.core.fs.loadFile') === -1) {
    test.check('its unscoped manifest read goes through api.readProject (step 6)');
  } else {
    test.fail('the process manifest read is not on the api surface');
  }

  booted.snapshot(MOVED_SCRIPTS);
  booted.shell.registerApp({ id: 'group-manager', name: 'Groups', icon: '◫', hidden: true, mount: function () {}, render: function () {} });
  const known = booted.shell.listApps().map(function (a) { return a.id; });
  const missing = spiritMemberIds().filter(function (id) { return known.indexOf(id) === -1; });
  if (missing.length === 0) {
    test.check('every id in the Spirit member list still resolves');
  } else {
    test.fail('unresolved: ' + JSON.stringify(missing));
  }

  // Four of the five are out; only Files and Groups still register
  // themselves in index.html.
  const stillInline = (html.match(/registerApp\(\{/g) || []).length;
  if (stillInline === 5) {
    test.check('five registerApp blocks remain: Files, the two viewers, Groups, and Spirit itself');
  } else {
    test.fail('registerApp blocks left in index.html: ' + stillInline);
  }
}

test.subHeading('The system-app api surface');

{
  // The api object is built per app and handed to mount, so the only
  // honest way to see it is to be mounted: open the tile, let the
  // "script" activate, fire its onload, and keep what mount was given.
  const booted = bootShell({ defaultHandlers: {}, appOverrides: {}, groups: {} },
    [NATTER_SCRIPT, 'app/process-browser/process-browser.js'], true);

  let handed = null;
  booted.shell.launchApp('app/natter');
  booted.shell.activateApp({ mount: function (container, api) { handed = api; }, render: function () {} });
  booted.scripts[0].onload();

  const named = ['launchApp', 'listApps', 'listGroups', 'getAppOverride', 'setAppOverride', 'readProject'];
  const missing = named.filter(function (m) { return !handed || typeof handed[m] !== 'function'; });
  if (missing.length === 0) {
    test.check('an app is handed launchApp, listApps, listGroups, getAppOverride, setAppOverride and readProject');
  } else {
    test.fail('missing from api: ' + missing.join(', '));
  }

  // What was already there stays there — this is an addition, not a
  // replacement, and api.fs is still the scoped one.
  if (typeof handed.escapeHtml === 'function' && typeof handed.fetchExternal === 'function' &&
      typeof handed.addTitlebarLink === 'function' && handed.fs) {
    test.check('beside the api it already had, api.fs included');
  } else {
    test.fail('api lost something: ' + Object.keys(handed).join(', '));
  }

  // readProject reads a file that is not the app's own — the whole
  // reason it exists, since api.fs cannot express it.
  const read = handed.readProject('app/natter/natter.json');
  if (read && JSON.parse(read).intrinsic === true) {
    test.check("readProject reads a path outside the app's own folder");
  } else {
    test.fail('readProject returned: ' + JSON.stringify(read));
  }

  // The registry methods are the shell's own, not copies: what
  // setAppOverride refuses through spirit.shell it refuses through api.
  const refused = handed.setAppOverride('app/natter', { name: 'Mailboxes' });
  if (!refused.ok && refused.reason === 'intrinsic-app-name-locked') {
    test.check('setAppOverride through api honours the same locks');
  } else {
    test.fail('api.setAppOverride: ' + JSON.stringify(refused));
  }

  if (handed.listApps().some(function (a) { return a.id === 'app/natter'; }) &&
      Array.isArray(handed.listGroups()) &&
      typeof handed.getAppOverride('app/natter') === 'object') {
    test.check('listApps, listGroups and getAppOverride answer as the shell does');
  } else {
    test.fail('registry methods disagree with the shell');
  }

  // And launchApp actually navigates: opening Processes through the api
  // fetches its entry script, exactly as a desktop tile would.
  const before = booted.scripts.length;
  handed.launchApp('app/process-browser');
  if (booted.scripts.length === before + 1) {
    test.check('launchApp through api opens another app');
  } else {
    test.fail('scripts fetched: ' + before + ' → ' + booted.scripts.length);
  }
}

test.subHeading('A re-declared app keeps the behaviour it loaded');

{
  const booted = bootShell({ defaultHandlers: {}, appOverrides: {}, groups: {} },
    [NATTER_SCRIPT], true);

  // Opening a tile is what fetches the script, and the script is what
  // supplies mount/render (through activateApp). Driven here the way the
  // shell drives it, so what is asserted is behaviour and not a poke at
  // the registry.
  booted.shell.launchApp('app/natter');
  const fetched = booted.scripts.length;
  let mountCalls = 0;
  booted.shell.activateApp({ mount: function () { mountCalls++; }, render: function () {} });

  if (fetched === 1) {
    test.check('opening the tile is what fetches the entry script');
  } else {
    test.fail('scripts after open: ' + fetched);
  }

  // A snapshot re-declares every app it sees — which, on a dropped SSE
  // connection, includes apps the operator already has open.
  booted.snapshot([NATTER_SCRIPT]);

  if (booted.scripts.length === fetched) {
    test.check('a re-declared app is not re-fetched');
  } else {
    test.fail('re-fetched: ' + booted.scripts.length + ' scripts');
  }

  // The script finishing its load is what mounts the app, and it must
  // mount the behaviour activateApp supplied — not the "Loading …"
  // placeholder a fresh declaration would have put back.
  booted.scripts[0].onload();
  if (mountCalls === 1) {
    test.check('and it mounts with the behaviour its script supplied');
  } else {
    test.fail('mount calls: ' + mountCalls);
  }

  const after = appById(booted, 'app/natter');
  if (after.name === 'NATter' && after.intrinsic === true) {
    test.check('while the manifest facts are refreshed from disk');
  } else {
    test.fail('manifest facts: ' + JSON.stringify(after));
  }
}

test.subHeading('An app that changes id keeps what the operator customised');

{
  // Today the map is empty and this is a no-op — nothing has moved
  // (CLEANUP-PLAN step 3 lands before step 5). What is under test is the
  // mechanism the moves will use, and the ordering: the rewrite happens
  // at load, before any snapshot, and pruneStalePreferences runs from a
  // snapshot. An id that changed is not a deleted app, but prune cannot
  // tell the difference — it would delete every override and handler
  // choice belonging to a moved app, and save.
  const empty = bootShell({
    defaultHandlers: { '.md': 'jobs' },
    appOverrides: { jobs: { icon: '💀' } },
    groups: {},
  }, [NATTER_SCRIPT]);

  // The map names exactly the apps that have moved, old id to new. It
  // only ever grows, one line per move, in that move's own commit — an
  // entry removed later is an operator's preferences silently pruned.
  // Every value is a folder id. The folder need not be the old id —
  // 'app-manager' became 'app/apps', because 'app-manager' was a poor
  // name for a folder and the rename map is exactly what makes that
  // free.
  const renames = empty.shell.APP_ID_RENAMES;
  const wellFormed = Object.keys(renames).every(function (oldId) {
    return /^app\/[^/]+$/.test(renames[oldId]) && renames[oldId] !== oldId;
  });
  if (wellFormed && renames.stats === 'app/stats') {
    test.check('the rename map names the moved apps, old id to folder id');
  } else {
    test.fail('map: ' + JSON.stringify(renames));
  }

  // Deferred, so the migration runs where it runs in production: after
  // preferences are read, before the first snapshot prunes anything.
  // 'ledger' is nobody's app and never will be: an id that has really
  // moved is migrated at load by the production map, leaving an explicit
  // call nothing to do, and this must test the mechanism rather than
  // whichever apps happen to have moved by now.
  const booted = bootShell({
    defaultHandlers: { '.md': 'ledger', '.txt': 'app/relayChat' },
    appOverrides: { ledger: { icon: '💀', name: 'Tasks' }, 'app/relayChat': { name: 'Chat' } },
    groups: {},
  }, [NATTER_SCRIPT, 'app/relayChat/relayChat.js'], true);

  const moved = booted.shell.migrateAppIds({ ledger: 'app/ledger' });
  const prefs = booted.saved.preferences;
  if (moved && prefs && prefs.appOverrides['app/ledger'] && prefs.appOverrides['app/ledger'].icon === '💀' &&
      prefs.appOverrides.ledger === undefined) {
    test.check("an override moves from 'ledger' to 'app/ledger'");
  } else {
    test.fail('overrides: ' + JSON.stringify(prefs && prefs.appOverrides));
  }

  if (prefs.defaultHandlers['.md'] === 'app/ledger') {
    test.check('and a default-handler choice pointing at it is repointed');
  } else {
    test.fail('handlers: ' + JSON.stringify(prefs.defaultHandlers));
  }

  if (prefs.appOverrides['app/relayChat'].name === 'Chat' && prefs.defaultHandlers['.txt'] === 'app/relayChat') {
    test.check('an id that did not move is untouched');
  } else {
    test.fail('untouched: ' + JSON.stringify(prefs));
  }

  // The point of the whole exercise: what was migrated survives the
  // prune that follows on the next snapshot.
  booted.shell.registerApp({
    id: 'app/ledger', name: 'Ledger', icon: '⚙️', hidden: true,
    mount: function () {}, render: function () {},
  });
  booted.snapshot([NATTER_SCRIPT, 'app/relayChat/relayChat.js']);
  const afterPrune = booted.saved.preferences;
  if (afterPrune.appOverrides['app/ledger'] && afterPrune.defaultHandlers['.md'] === 'app/ledger') {
    test.check('and it survives the prune on the next snapshot');
  } else {
    test.fail('after prune: ' + JSON.stringify(afterPrune));
  }

  // An override written under the new id after the move is the newer
  // intent; re-running the migration must not put the old one back.
  const both = bootShell({
    defaultHandlers: {},
    appOverrides: { ledger: { name: 'Old' }, 'app/ledger': { name: 'New' } },
    groups: {},
  }, [NATTER_SCRIPT], true);
  both.shell.migrateAppIds({ ledger: 'app/ledger' });
  const merged = both.saved.preferences;
  if (merged.appOverrides['app/ledger'].name === 'New' && merged.appOverrides.ledger === undefined) {
    test.check('a newer override under the new id wins, and the old key goes');
  } else {
    test.fail('merge: ' + JSON.stringify(merged.appOverrides));
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
