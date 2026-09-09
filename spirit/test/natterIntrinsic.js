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

// A node that has claimed a name, which is the ordinary shell. Said
// explicitly by every fixture that is not about first run: an unbound
// node shows one app, so a test of app management on one would be
// inspecting a screen that deliberately has nothing on it.
const BOUND = 'andy';
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
  const listeners = {};
  const el = {
    tag: tag,
    className: '',
    textContent: '',
    hidden: false,
    // Real elements have one, and the shell hides chrome with it — the
    // titlebar's Back and Home while this node has no name.
    style: {},
    children: [],
    appendChild: function (child) { el.children.push(child); return child; },
    // Recorded rather than dropped: an icon tile IS its click handler —
    // which screen it pushes and whether the screen it was pressed on
    // survives on the stack is the whole of what buildAppIcon decides,
    // and a stub that discarded the listener could not ask.
    addEventListener: function (type, fn) {
      (listeners[type] = listeners[type] || []).push(fn);
    },
    fire: function (type, event) {
      (listeners[type] || []).forEach(function (fn) { fn(event || {}); });
    },
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
// `sessionLabel` defaults to a bound node, because that is the ordinary
// shell: an unbound one shows Natter and nothing else (firstRun), so a
// fixture that means to test app management must say it has a name. The
// first-run and window-title sections pass '' on purpose.
function bootShell(preferences, appScripts, deferSnapshot, sessionLabel, relaysRaw) {
  if (sessionLabel === undefined) sessionLabel = BOUND;
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
          // The label Relay Chat claimed, which the shell reads for the
          // window title. Supplied by the test rather than fetched off
          // disk: the real file is Andy's own binding, and a test that
          // reads it passes or fails depending on whose clone it runs in.
          // Natter's file since packet 3: claiming is what that app does,
          // and the shell reads this one path for the window title and
          // the first-run gate alike.
          if (rel === 'app/natter/session.json') {
            return sessionLabel ? JSON.stringify({ label: sessionLabel, boundAt: '2026-09-07T00:00:00.000Z' }) : null;
          }
          // The shipped seed, unless a test is asking what happens
          // without one. `null` here means the file is gone, which is
          // the case the escape hatch exists for.
          if (rel === 'app/natter/relays.json' && relaysRaw !== undefined) return relaysRaw;
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
    doc: doc,
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
      // The shared facts bubble (factRow, shell.js). Real output, not a
      // placeholder — the tests read what a panel actually renders.
      factRow: function (pairs) {
        return '<div class="fact-row">' + (pairs || []).map(function (pair) {
          return '<div class="fact">' +
            '<span class="fact-label">' + spirit.core.util.escapeHtml(String(pair[0])) + '</span>' +
            '<span class="fact-value">' + spirit.core.util.escapeHtml(String(pair[1])) + '</span>' +
            '</div>';
        }).join('') + '</div>';
      },

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
    [NATTER_SCRIPT, 'app/relayChat/relayChat.js'], false, BOUND);

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
    [NATTER_SCRIPT, 'app/relayChat/relayChat.js'], false, BOUND);

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
  }, [NATTER_SCRIPT, 'app/relayChat/relayChat.js'], false, BOUND);

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
    [NATTER_SCRIPT, 'app/relayChat/relayChat.js'], false, BOUND);

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
  if (natter.name === 'NATter' && natter.icon === spirit.core.const.ICON[manifest('app/natter/natter.json').icon]) {
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
  }, [NATTER_SCRIPT, 'app/relayChat/relayChat.js'], false, BOUND);

  const staleNatter = appById(stale, 'app/natter');
  if (staleNatter.name === 'NATter' && staleNatter.icon === spirit.core.const.ICON[manifest('app/natter/natter.json').icon]) {
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
    id: 'app/relay-chat',
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
  // A field with a single button under it puts the button on the field's
  // own line (§3) — stacking them spends a whole row of height on saying
  // one thing twice, which on a portrait screen is the difference between
  // seeing the next block and not. Both editable fields are wrapped, and
  // the field is the one that takes the width.
  // Id and Source are gone from both the table and the panel (Andy):
  // twice on screen for two facts nobody can act on. What is left of the
  // panel's read-only half is what a Reset would bring back, across one
  // line rather than down four.
  const facts = (ordinaryRow.match(/class="fact"/g) || []).length;
  if (/class="fact-row"/.test(ordinaryRow) && facts === 2 &&
      ordinaryRow.indexOf('file-info-row') === -1) {
    test.check('the panel reads its defaults across one line, not down a list');
  } else {
    test.fail(facts + ' facts, file-info-row present: ' + (ordinaryRow.indexOf('file-info-row') !== -1));
  }

  // Checked against a fixture that DOES carry an id and a source, so this
  // cannot pass merely because nothing was supplied. `Dynamic` is the
  // word the dropped column used; the panel explains the lock in a
  // sentence instead.
  if (ordinaryRow.indexOf('app/relay-chat') === -1 && ordinaryRow.indexOf('>Dynamic<') === -1) {
    test.check('and neither the id nor the source is anywhere on the row');
  } else {
    test.fail('id or source survived: ' + ordinaryRow);
  }

  const wrapped = (ordinaryRow.match(/<div class="start-job-form card">/g) || []).length;
  const grows = (ordinaryRow.match(/class="field-label grow"/g) || []).length;
  if (wrapped >= 2 && grows === 2) {
    test.check('and each editable field is a row, with the field taking the width');
  } else {
    test.fail('rows ' + wrapped + ', growing fields ' + grows);
  }

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
    [NATTER_SCRIPT, 'app/relayChat/relayChat.js'], false, BOUND);

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
    [NATTER_SCRIPT, 'app/relayChat/relayChat.js'], true, BOUND);

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

  // The id it names, not how it navigates — the call gained a
  // {replace: true} when starting a job stopped leaving the viewer on
  // the stack behind it.
  if (html.indexOf("launchApp('app/jobs'") !== -1 && html.indexOf("launchApp('jobs'") === -1) {
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
  if (memberIds.length === 7 && missing.length === 0) {
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
  if (html.indexOf("launchApp('app/jobs'") !== -1) {
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

  // Every app that was going to move has moved. What is left registers
  // itself here because it is not an app in that sense: two viewers with
  // no icon of their own, and the Spirit grid that holds the others.
  const stillInline = (html.match(/registerApp\(\{/g) || []).length;
  if (stillInline === 3) {
    test.check('three registerApp blocks remain: the two viewers and Spirit itself');
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
  }, [NATTER_SCRIPT, 'app/relayChat/relayChat.js'], true, BOUND);

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
    [NATTER_SCRIPT, 'app/relayChat/relayChat.js'], false, BOUND);

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

test.subHeading('The window title names the node, then the screen');

// Several nodes are open at once whenever this is being tested — andy,
// bert, jim — and identical tabs reading "SpiritOS" cannot be told
// apart. The shell owns document.title and builds it from two things:
// the label this node claimed, and whatever the screen is showing.
{
  const scripts = [NATTER_SCRIPT, 'app/relayChat/relayChat.js'];
  const prefs = { defaultHandlers: {}, appOverrides: {}, groups: {} };

  function withNotes(booted) {
    booted.shell.registerApp({
      id: 'notes', name: 'Notes', icon: '📓',
      mount: function () {}, render: function () {},
    });
    return booted;
  }

  // A node that has never claimed a name has nothing to be told apart
  // by, so it says what it is.
  const fresh = withNotes(bootShell(prefs, scripts, false, ''));
  if (fresh.doc.title === 'SpiritOS') {
    test.check('an unclaimed node is plain SpiritOS');
  } else {
    test.fail('fresh title: ' + fresh.doc.title);
  }

  fresh.shell.launchApp('notes');
  if (fresh.doc.title === 'spirit - Notes') {
    test.check('and names the app it opens, with no label to give');
  } else {
    test.fail('fresh app title: ' + fresh.doc.title);
  }

  // Claimed: the label leads, because that is the question a wall of
  // tabs is being scanned to answer.
  const bound = withNotes(bootShell(prefs, scripts, false, 'andy'));
  if (bound.doc.title === 'spirit - andy') {
    test.check('a claimed node says whose it is before anything is open');
  } else {
    test.fail('bound title: ' + bound.doc.title);
  }

  bound.shell.launchApp('notes');
  if (bound.doc.title === 'spirit - andy - Notes') {
    test.check('then node, then app');
  } else {
    test.fail('bound app title: ' + bound.doc.title);
  }

  // The launchers are not a special case: an app whose subject is a file
  // says the file. Full path, not the basename — two dog.png in two
  // folders are two tabs.
  bound.shell.setViewerTitle('media/dog.png');
  if (bound.doc.title === 'spirit - andy - media/dog.png') {
    test.check('a viewer says the file it is viewing, path and all');
  } else {
    test.fail('viewer title: ' + bound.doc.title);
  }

  // Relay Chat used to write this string itself ("Relay Chat [andy] · 3")
  // and would now be fighting the shell for it on every navigation.
  const chat = readRun('app/relayChat/relayChat.js');
  if (chat.indexOf('document.title') === -1) {
    test.check('and no app writes the tab behind the shell');
  } else {
    test.fail('Relay Chat still writes document.title');
  }
}

test.subHeading('An app can subscribe, instead of being broadcast at');

// The shell used to repaint whichever app was on screen on every job
// event, with no word about what had changed — so an app that cared
// about one job kept an object-identity cache and compared references.
// Two apps had written the same four lines. api.onFiles is that question
// answered once, in the one place that can answer it.
{
  const prefs = { defaultHandlers: {}, appOverrides: {}, groups: {} };
  const booted = bootShell(prefs, [NATTER_SCRIPT], false, 'andy');

  const seen = { notes: [], ledger: [] };
  function subscriber(id) {
    return {
      id: id, name: id, icon: '📓',
      mount: function (container, api) {
        api.onFiles(function (files, ctx) {
          seen[id].push({ count: files.length, visible: ctx.visible });
        });
      },
      render: function () {},
    };
  }
  booted.shell.registerApp(subscriber('notes'));
  booted.shell.registerApp(subscriber('ledger'));

  // Mounting subscribes, and the shell answers immediately with what it
  // already knows: an app that had to wait for the next rescan to paint
  // would be blank for as long as nothing on disk moved.
  booted.shell.launchApp('notes');
  if (seen.notes.length === 1 && seen.notes[0].count > 0 && seen.notes[0].visible === true) {
    test.check('subscribing delivers what is already known, straight away');
  } else {
    test.fail('first delivery: ' + JSON.stringify(seen.notes));
  }

  // The same list again is not news. This is the whole bug: a snapshot
  // on reconnect, or a rescan after a file was rewritten, arrives as
  // fresh objects saying exactly what the last one said.
  booted.snapshot([NATTER_SCRIPT]);
  if (seen.notes.length === 1) {
    test.check('and the same list again says nothing');
  } else {
    test.fail('re-delivered: ' + JSON.stringify(seen.notes));
  }

  // A different list is.
  booted.shell.launchApp('ledger');
  booted.snapshot([NATTER_SCRIPT, 'app/relayChat/relayChat.js']);
  const lastNotes = seen.notes[seen.notes.length - 1];
  const lastLedger = seen.ledger[seen.ledger.length - 1];
  if (seen.notes.length === 2 && seen.ledger.length === 2) {
    test.check('a list that changed reaches every subscriber, on screen or not');
  } else {
    test.fail('after a change: notes ' + JSON.stringify(seen.notes) + ' ledger ' + JSON.stringify(seen.ledger));
  }

  // Permanent, and honest about the state it arrives in. Whether to do
  // anything while invisible is the app's decision, not the shell's.
  if (lastNotes.visible === false && lastLedger.visible === true) {
    test.check('and each is told whether anybody is looking at it');
  } else {
    test.fail('visibility: notes ' + lastNotes.visible + ', ledger ' + lastLedger.visible);
  }

  // The proof app. Processes kept `lastProcessBrowserJob` to tell its own
  // job moving from a stats tick; that cache is what onFiles replaces.
  // Named by what the code does, not by a word that also appears in the
  // comment explaining why it used to: processFindJob existed only to
  // find the job behind the identity cache, and render() no longer takes
  // the job map at all.
  const proc = readRun('app/process-browser/process-browser.js');
  if (proc.indexOf('api.onFiles(') !== -1 &&
      proc.indexOf('function processFindJob') === -1 &&
      /render: function \(\)/.test(proc)) {
    test.check('and Processes asks instead of caching a job reference');
  } else {
    test.fail('Processes still reads the job map');
  }
}

test.subHeading('Open with offers what declared the extension');

// Nothing covered this, which is how it broke in silence: clicking a
// .txt in media/ opened the read-only viewer with no way out of it, even
// though app/textEditor declares .txt and media is a writable root.
//
// renderOpenWith used to keep only handlers whose own folder the file sat
// in — a client-side stand-in for a capability nobody had published, and
// stricter than both server gates. The server is the only jail: a path in
// the file list has already passed fileServable, and a save is answered
// by fileWritable when it is attempted.
{
  const prefs = { defaultHandlers: {}, appOverrides: {}, groups: {} };
  const booted = bootShell(prefs, [NATTER_SCRIPT, 'app/textEditor/textEditor.js'], false, 'andy');

  // The real manifest, so this test fails if textEditor stops declaring
  // the extension rather than passing against a fixture that agrees with
  // itself.
  const declared = manifest('app/textEditor/textEditor.json').handlesExtensions || [];
  if (declared.indexOf('.txt') !== -1) {
    test.check('the sample handler declares .txt, as this test assumes');
  } else {
    test.fail('textEditor no longer declares .txt: ' + JSON.stringify(declared));
  }

  // The file Andy clicked.
  const out = fakeElement('div');
  booted.shell.renderOpenWith(out, 'text-file-launcher', 'media/dummy.txt');
  if (out.innerHTML.indexOf('app/textEditor') !== -1 && out.innerHTML.indexOf('open-with-select') !== -1) {
    test.check('a file outside the handler own folder is still offered to it');
  } else {
    test.fail('media/dummy.txt open-with: ' + out.innerHTML);
  }

  // And the title agrees with the panel. It always asked "Open x?"
  // whenever anything declared the extension, so while the panel filtered
  // by folder the two disagreed: the titlebar put a question on screen
  // that nothing below it could answer.
  booted.shell.setViewerTitle('media/dummy.txt');
  if (booted.doc.byId['app-title'].innerHTML.indexOf('Open ') === 0) {
    test.check('and the titlebar asks the question the panel can answer');
  } else {
    test.fail('viewer title: ' + booted.doc.byId['app-title'].innerHTML);
  }

  // The app own folder was never the problem, and still works.
  const inside = fakeElement('div');
  booted.shell.renderOpenWith(inside, 'text-file-launcher', 'app/textEditor/notes.txt');
  if (inside.innerHTML.indexOf('app/textEditor') !== -1) {
    test.check('and a file inside it is offered exactly as before');
  } else {
    test.fail('own-folder open-with: ' + inside.innerHTML);
  }

  // Nobody declared .png, so there is nothing to offer and no control to
  // read and dismiss. AGENT.md: do not show chrome that cannot do
  // anything in that state.
  const none = fakeElement('div');
  booted.shell.renderOpenWith(none, 'media-launcher', 'media/001.jpg');
  if (none.innerHTML === '') {
    test.check('an extension nobody handles gets no control at all');
  } else {
    test.fail('unhandled extension offered: ' + none.innerHTML);
  }
}

test.subHeading('A file info row reads at the size of the titlebar');

// Andy's rule: what earns a place in the flow reads at reading size, and
// what does not is fine print, which belongs at the bottom of a page
// rather than shrunk in the middle of one. The bubble in both launchers
// was 13px under a 16px title.
//
// Asserted as "the same as the titlebar" rather than "16px", because the
// rule is the relationship. One row type serves the launchers, the Apps
// detail rows and the Groups panel, so this covers all three.
{
  const css = readRun('index.html');
  const title = /#app-title\s*\{[^}]*font-size:\s*(\d+)px/.exec(css);
  const row = /\.file-info-row\s*\{[^}]*font-size:\s*(\d+)px/.exec(css);
  if (title && row && title[1] === row[1]) {
    test.check('an info row is the size of the title above it');
  } else {
    test.fail('title ' + (title && title[1]) + 'px vs row ' + (row && row[1]) + 'px');
  }

  // Size only. The titlebar keeps its weight, or the block under it
  // competes with the thing it is describing.
  const rowRule = /\.file-info-row\s*\{([^}]*)\}/.exec(css);
  if (rowRule && rowRule[1].indexOf('font-weight') === -1) {
    test.check('and does not borrow its weight as well');
  } else {
    test.fail('info row rule: ' + (rowRule && rowRule[1]));
  }
}

test.subHeading('The viewer keeps one rhythm down the page');

// The info bubble, the Open with line and the preview are three blocks
// in both launchers, and they should be evenly spaced. Asserted as a
// relationship again, not a number: whatever the preview's gap is, the
// Open with line has the same one above it.
{
  const css = readRun('index.html');
  // Located by text rather than a built regex: the selectors carry '.'
  // and '#', and escaping them into a RegExp string is a knot for no
  // gain when the rule block starts at a known string and ends at the
  // next '}'.
  function gap(selector) {
    const at = css.indexOf(selector + ' {');
    if (at === -1) return null;
    const block = css.slice(at, css.indexOf('}', at));
    const found = /margin-top:\s*(\d+)px/.exec(block);
    return found ? found[1] : null;
  }
  const openWith = gap('#open-with');
  if (openWith && openWith === gap('.code-view') && openWith === gap('.media-view')) {
    test.check('Open with sits the same distance below the bubble as the preview does below it');
  } else {
    test.fail('gaps: open-with ' + openWith + ', code ' + gap('.code-view') + ', media ' + gap('.media-view'));
  }

  // renderOpenWith writes '' when nothing handles the extension, and an
  // empty div still occupies its margin — which would open a bigger gap
  // on exactly the files that have less to show.
  // Collapsed rather than margin-cancelled. §3 named the old
  // :empty{margin-top:0} as a hack that existed only because space was
  // carried downward, and this is the answer every other can-be-empty
  // block already gives (#rc-peer-strip, .job-start-error).
  if (/#open-with:empty\s*\{[^}]*display:\s*none/.test(css)) {
    test.check('and takes no space at all when there is nothing to offer');
  } else {
    test.fail('an empty Open with still holds its margin');
  }
}

test.subHeading('Every control an app puts on the page has one shape');

// Andy: rounded boxes for buttons, inputs and selects, and the app has
// to be usable on a small portrait screen. Both of those are one rule
// set rather than five near-identical copies beside five forms, which is
// what used to be here — each 6px padding, 6px radius, drifting apart an
// edit at a time.
{
  const css = readRun('index.html');

  // The copies are gone. Named by the old shared value: any control rule
  // still carrying it is one that escaped the consolidation.
  const forms = ['#process-search', '.field-label input', '#job-manifest-form input'];
  const strays = forms.filter(function (selector) {
    const at = css.indexOf(selector + ' {');
    if (at === -1) return false;
    return css.slice(at, css.indexOf('}', at)).indexOf('border-radius') !== -1;
  });
  if (strays.length === 0) {
    test.check('no form keeps a control look of its own');
  } else {
    test.fail('still styling their own controls: ' + strays.join(', '));
  }

  // A control under 16px makes iOS zoom the page on focus, which leaves
  // a portrait phone scrolled sideways in a layout nobody asked for. It
  // is also the reading size (UI_DESIGN_STYLE.md), so one number serves
  // both and neither can be lowered without noticing the other.
  const at = css.indexOf('#app-content input,');
  const block = at === -1 ? '' : css.slice(at, css.indexOf('}', at));
  const size = /font-size:\s*(\d+)px/.exec(block);
  const title = /#app-title \{[^}]*font-size:\s*(\d+)px/.exec(css);
  if (size && title && size[1] === title[1]) {
    test.check('a control is set at reading size, which is also what stops a phone zooming');
  } else {
    test.fail('control font-size ' + (size && size[1]) + ' vs title ' + (title && title[1]));
  }

  // Big enough to hit with a thumb.
  const touch = /min-height:\s*(\d+)px/.exec(block);
  if (touch && Number(touch[1]) >= 44) {
    test.check('and tall enough to hit on a portrait screen');
  } else {
    test.fail('control min-height: ' + (touch && touch[1]));
  }

  // Rounded, and the same roundness as the panels they sit in.
  const radius = /border-radius:\s*(\d+)px/.exec(block);
  const tileAt = css.indexOf('.stat-tile {');
  const tileRadius = /border-radius:\s*(\d+)px/.exec(css.slice(tileAt, css.indexOf('}', tileAt)));
  if (radius && tileRadius && radius[1] === tileRadius[1]) {
    test.check('and as round as the tile it sits in');
  } else {
    test.fail('control radius ' + (radius && radius[1]) + ' vs tile ' + (tileRadius && tileRadius[1]));
  }
}

test.subHeading('Stats counts read like a file bubble, and Chat spaces its two offers');

// Andy re-classified the three count blocks in Stats — Files by MIME
// type, Requests by method, Requests by status class — to the same style
// as the file info bubble in the launchers. One row type, one voice.
{
  const stats = readRun('app/stats/stats.js');
  if (stats.indexOf('file-info-row') !== -1 && stats.indexOf("join('<br>')") === -1) {
    test.check('a count is a label and a value on one line, not a run-on');
  } else {
    test.fail('stats counts still render their own way');
  }

  // byMethod is keyed by whatever verb a request arrived with, so the
  // string is a client's choice, and it goes into innerHTML. The <br>
  // version interpolated it raw.
  const fn = stats.slice(stats.indexOf('function statsCountsHtml'), stats.indexOf('function statsFindJob'));
  if (fn.indexOf('escapeHtml') !== -1 && /escape\(k\)/.test(fn)) {
    test.check('and a request method cannot write markup into the page');
  } else {
    test.fail('statsCountsHtml does not escape its keys');
  }

  // Add someone by handle and Invite someone to a relay are two offers,
  // not one block. Same 12px as every other gap (UI_DESIGN_STYLE.md §3),
  // and on the panel above rather than the slot below, which is empty
  // for a node that owns no mailbox.
  const css = readRun('index.html');
  // Read by splitting rather than by a built RegExp: a property name
  // interpolated into a pattern string needs its escapes doubled, and a
  // pattern that quietly stops matching returns null for both sides —
  // which compares equal and passes while asserting nothing.
  //
  // A selector may share its rule with others ("#a,\n#b { … }"), so what
  // counts as a selector position is: the next non-space character is a
  // comma or the rule's own brace. Looking only for "<selector> {" reads
  // a grouped rule as missing, which is a green test turning red for a
  // change that was correct.
  function value(selector, property) {
    let from = 0;
    for (;;) {
      const at = css.indexOf(selector, from);
      if (at === -1) return null;
      from = at + selector.length;
      const next = css.slice(from).replace(/^[ \r\n\t]+/, '')[0];
      if (next !== ',' && next !== '{') continue;
      const open = css.indexOf('{', at);
      const close = css.indexOf('}', open);
      if (open === -1 || close === -1) return null;
      const block = css.slice(open, close);
      const declAt = block.indexOf(property + ':');
      if (declAt === -1) continue;
      const decl = block.slice(declAt + property.length + 1, block.indexOf(';', declAt)).trim();
      return /^[0-9]+px$/.test(decl) ? decl : null;
    }
  }
  // Space belongs to the block that FOLLOWS it: a block carries the gap
  // above itself, never below. Then a block that is not on the page
  // contributes nothing — no trailing margin left hanging where it used
  // to be, and no :empty rule to cancel one. The panels at the foot of
  // Relay Chat are .stat-tile details, so one rule spaces every pair of
  // them and neither has to know what comes next.
  // The wrapper the rule reaches through. Every app is mounted into its
  // own div under #app-content (switchTo, shell.js), and while that div
  // was anonymous the stack rule landed on IT — one 12px above the whole
  // app and none between its blocks. Asserted on the boot the shell
  // actually does, not on the source line, so removing the class shows
  // up here rather than as a screen that quietly stops spacing itself.
  {
    const mounted = bootShell({ defaultHandlers: {}, appOverrides: {}, groups: {} },
      [NATTER_SCRIPT], false, BOUND);
    // A static app, because a manifest-declared one waits for a script
    // this harness never fetches — launchApp injects a <script> and
    // returns, so switchTo (which makes the pane) is not reached.
    mounted.shell.registerApp({
      id: 'pane-probe', name: 'Probe', icon: '🧪', hidden: true,
      mount: function () {}, render: function () {},
    });
    mounted.shell.launchApp('pane-probe');
    const panes = mounted.doc.byId['app-content'].children;
    if (panes.length && panes.every(function (el) { return el.className === 'app-pane'; })) {
      test.check('an app is mounted into a named pane, which is what the stack rule reaches through');
    } else {
      test.fail('panes: ' + JSON.stringify(panes.map(function (el) { return el.className; })));
    }
  }

  // Every fold looks clickable, by class rather than by a list of ids
  // that goes stale the moment a panel moves app. Three of the four ids
  // this replaced named panels that had already left Relay Chat, and the
  // two that arrived in Contacts had no pointer cursor at all.
  if (/details\.stat-tile > summary\s*\{[^}]*cursor:\s*pointer/.test(css) &&
      css.indexOf('#rc-add-panel') === -1 && css.indexOf('#rc-invite-panel') === -1 &&
      css.indexOf('#rc-unknown-section') === -1) {
    test.check('a fold is clickable by what it IS, and no stale panel ids are left');
  } else {
    test.fail('summary styling still names ids: ' +
      ['#rc-add-panel', '#rc-invite-panel', '#rc-unknown-section']
        .filter(function (id) { return css.indexOf(id) !== -1; }).join(', '));
  }

  // A form is its own card where it SHARES a panel with something else —
  // a reading above it, another form beside it. Asked for rather than
  // automatic, because "any form inside a panel" cannot tell that case
  // from a panel that IS the form, and the second one is two boxes
  // around one object (Andy).
  const nestedCard = /\.stat-tile\.nested\s*\{([^}]*)\}/.exec(css);
  const cardGround = nestedCard && /background:\s*([^;]+);/.exec(nestedCard[1]);
  const formBubble = /\.start-job-form\.card\s*\{([^}]*)\}/.exec(css);
  if (formBubble && cardGround && formBubble[1].indexOf(cardGround[1].trim()) !== -1) {
    test.check('and a form asked to be a card sits on that same ground');
  } else {
    test.fail('.start-job-form.card: ' + (formBubble && formBubble[1].replace(/\s+/g, ' ').trim()));
  }

  // And the panels that ARE a form do not ask. Two boxes around one
  // object is what the automatic version produced, and it is what a
  // reader sees rather than anything a size check would catch.
  const soloFormApps = [
    ['app/jobs/jobs.js', 'start-job-form'],
    ['app/group-manager/group-manager.js', 'group-manager-new-name'],
  ];
  const doubled = soloFormApps.filter(function (pair) {
    const src = readRun(pair[0]);
    const at = src.indexOf(pair[1]);
    return at !== -1 && src.lastIndexOf('start-job-form card', at) > src.lastIndexOf('stat-tile wide', at);
  });
  if (doubled.length === 0) {
    test.check('while a panel that is only a form asks for no card of its own');
  } else {
    test.fail('doubled bubbles in: ' + doubled.map(function (p) { return p[0]; }).join(', '));
  }

  // And it takes its space from above like any block. Nothing was doing
  // that inside a panel, so a form sat flush under whatever it followed.
  // A form that opens its box takes none: the box's padding is already
  // the leading edge, and a margin on top of it is that gap twice. Same
  // answer #app-content gave — who supplies the FIRST gap is the
  // container.
  if (/\.start-job-form:first-child\s*\{[^}]*margin-top:\s*0/.test(css)) {
    test.check('and none when it opens the box, whose padding is the edge');
  } else {
    test.fail('no :first-child reset on .start-job-form');
  }

  // An error line that reserves a row for a message that is not there is
  // §1 broken in CSS, and it was the bottom half of 48px of nothing under
  // the Jobs form. Collapsed when empty, like #rc-peer-strip.
  const errorRule = /\.job-start-error\s*\{([^}]*)\}/.exec(css);
  if (errorRule && !/min-height/.test(errorRule[1]) && !/margin/.test(errorRule[1]) &&
      /\.job-start-error:empty\s*\{[^}]*display:\s*none/.test(css)) {
    test.check('and an error line holds no space until there is an error');
  } else {
    test.fail('.job-start-error: ' + (errorRule && errorRule[1].replace(/\s+/g, ' ').trim()));
  }

  const blockGap = value('#open-with', 'margin-top');
  if (blockGap !== null && value('.start-job-form', 'margin-top') === blockGap) {
    test.check('and takes a block of space above it, as a block does');
  } else {
    test.fail('form margin-top: ' + value('.start-job-form', 'margin-top') +
      ' vs the block gap ' + blockGap);
  }

  // A reading is its own bubble, so it is visibly not the controls beside
  // it (Andy) — the same card-inside-a-card ground .stat-tile.nested
  // uses, at the roundness of the panel it sits in.
  const bubble = /\.fact-row\s*\{([^}]*)\}/.exec(css);
  const nested = /\.stat-tile\.nested\s*\{([^}]*)\}/.exec(css);
  const ground = nested && /background:\s*([^;]+);/.exec(nested[1]);
  if (bubble && ground && bubble[1].indexOf(ground[1].trim()) !== -1 &&
      /border-radius/.test(bubble[1]) && /padding/.test(bubble[1])) {
    test.check('a facts bubble sits on the same ground as any card inside a card');
  } else {
    test.fail('fact-row: ' + (bubble && bubble[1].replace(/\s+/g, ' ').trim()));
  }

  // The pair centres on itself, so a short caption over a long value
  // reads as one block rather than two ragged lines (Andy).
  const factBlock = /\.fact\s*\{([^}]*)\}/.exec(css);
  if (factBlock && /align-items:\s*center/.test(factBlock[1]) &&
      /text-align:\s*center/.test(factBlock[1])) {
    test.check('and a fact centres its caption and value on each other');
  } else {
    test.fail('.fact: ' + (factBlock && factBlock[1].replace(/\s+/g, ' ').trim()));
  }

  // Caption above value, and the caption is the small bold half. The
  // opposite way round from .stat-tile, where the figure is what is being
  // read and the caption only names it — so this asserts the relationship
  // rather than the numbers (§7).
  const label = /\.fact-label\s*\{([^}]*)\}/.exec(css);
  const factValue = /\.fact-value\s*\{[^}]*font-size:\s*(\d+)px/.exec(css);
  const labelSize = label && /font-size:\s*(\d+)px/.exec(label[1]);
  const title = /#app-title\s*\{[^}]*font-size:\s*(\d+)px/.exec(css);
  if (labelSize && factValue && title &&
      factValue[1] === title[1] && Number(labelSize[1]) < Number(factValue[1]) &&
      /font-weight:\s*[6-9]00/.test(label[1])) {
    test.check('its value reads at titlebar size and its caption is smaller and bold');
  } else {
    test.fail('label ' + (labelSize && labelSize[1]) + ' / value ' +
      (factValue && factValue[1]) + ' / title ' + (title && title[1]));
  }

  // Asked of the stack rule itself now. It used to be a list of seven
  // pairs naming which kinds of block space themselves from which — a
  // list that is quadratic in block types and whose omissions are
  // silent. `> * + *` says the same thing once, for every kind.
  const rhythm = value('#open-with', 'margin-top');
  if (rhythm !== null && value('#app-content > .app-pane > * + *', 'margin-top') === rhythm) {
    test.check('a block takes its space from above, at the same block spacing');
  } else {
    test.fail('stacked blocks: ' + value('#app-content > .app-pane > * + *', 'margin-top') +
      ' vs the rhythm ' + rhythm);
  }

  // And nothing carries it downward any more: a margin-bottom on a panel
  // is a gap that survives the panel.
  if (css.indexOf('#rc-add-panel { margin-bottom') === -1 &&
      css.indexOf('#rc-settings-panel,') === -1) {
    test.check('and no panel pushes the next one down from behind');
  } else {
    test.fail('a panel still carries a trailing margin');
  }
}

test.subHeading('Natter adds a relay on the shared row');

// Andy: horizontal spacing between the elements of that line, the same
// as the space between blocks — and there was none at all between the
// Add line and the list below it. The line was a tile of bare <label>s
// with no spacing rules, so a caption, its input and the next caption
// ran together.
{
  // The row is inside its own tile now, under a heading — but it is
  // still the shared row class doing the laying out, and still the
  // shared caption-over-input pair.
  const natter = readRun('app/natter/natter.js');
  if (natter.indexOf("'<div class=\"start-job-form\">'") !== -1 &&
      natter.indexOf('<label class="field-label">Private label') !== -1) {
    test.check('the Add line is the shared row, with the shared caption pairs');
  } else {
    test.fail('Natter still styles its own line');
  }

  // One spacing scale: what separates controls across a row is what
  // separates blocks down a page. Two gaps that are nearly the same read
  // as a mistake rather than a distinction.
  const css = readRun('index.html');
  function value(selector, property) {
    const at = css.indexOf(selector + ' {');
    if (at === -1) return null;
    const block = css.slice(at, css.indexOf('}', at));
    const declAt = block.indexOf(property + ':');
    if (declAt === -1) return null;
    const decl = block.slice(declAt + property.length + 1, block.indexOf(';', declAt)).trim();
    return /^[0-9]+px$/.test(decl) ? decl : null;
  }
  const rhythm = value('#open-with', 'margin-top');
  const rows = ['.start-job-form', '#rc-claim-fields'];
  const off = rows.filter(function (selector) { return value(selector, 'gap') !== rhythm; });
  if (rhythm !== null && off.length === 0) {
    test.check('and a row gaps its controls by the same block spacing');
  } else {
    test.fail('rows off the scale: ' + off.join(', ') + ' (rhythm ' + rhythm + ')');
  }

  // What follows a row takes its space FROM the row, in the §3 direction.
  // Removing the row's margin-bottom without this left a Delete, an error
  // line and a minted token flush against the row above them — they sit
  // inside a panel rather than in the pane's own stack, so nothing else
  // was going to space them.
  if (value('.start-job-form + *', 'margin-top') === rhythm) {
    test.check('and whatever follows a row takes a block of space from it');
  } else {
    test.fail('after a row: ' + value('.start-job-form + *', 'margin-top'));
  }

  // A button beside captioned fields reserves the caption's line, so a
  // wrapped row keeps an even rhythm instead of the button appearing to
  // hug the field above it. Scoped with :has(), or a row of bare inputs
  // (Jobs) would have its button pushed out of line with them.
  const captioned = /\.start-job-form:has\(\.field-label\) > button\s*\{[^}]*margin-top:\s*(\d+)px/.exec(css);
  if (captioned && Number(captioned[1]) > 0) {
    test.check('and a button beside captioned fields reserves a caption of its own');
  } else {
    test.fail('captioned-row button: ' + (captioned && captioned[1]));
  }

  // And carries NO space under itself. The list below a row still gets
  // its air, but from its own margin-top through the stack rule — a row
  // that pushed space downward would leave the gap behind on a screen
  // where the row is not drawn, which is the whole of §3 and the reason
  // #open-with:empty had to exist.
  if (value('.start-job-form', 'margin-bottom') === null) {
    test.check('and leaves no space under itself — what follows brings its own');
  } else {
    test.fail('row margin-bottom: ' + value('.start-job-form', 'margin-bottom'));
  }
}

test.subHeading('First run: one node, one mailbox, one thing to do');

// A clone ships pointed at one public mailbox, and until this node has
// claimed a name on it there is exactly one thing it can do: bind. That
// is Natter's job (packet 3), so Natter is the app a fresh node is shown
// and the rest of the shell waits behind it.
{
  const prefs = { defaultHandlers: {}, appOverrides: {}, groups: {} };
  const scripts = [NATTER_SCRIPT, 'app/relayChat/relayChat.js'];

  // The seed is a check, not a write: a fresh clone already points at
  // the one public mailbox, so nobody has to type a URL.
  const seeded = JSON.parse(readRun('app/natter/relays.json'));
  if (Array.isArray(seeded) && seeded.some(function (row) { return row.url === 'https://spirit.andyflinn.com'; })) {
    test.check('the repo ships pointed at the public mailbox');
  } else {
    test.fail('relays.json: ' + JSON.stringify(seeded));
  }

  const fresh = bootShell(prefs, scripts, false, '');
  const listed = fresh.shell.listApps().map(function (a) { return a.id; });
  if (listed.length === 1 && listed[0] === 'app/natter') {
    test.check('an unbound node lists one app, and it is the one that binds');
  } else {
    test.fail('unbound list: ' + JSON.stringify(listed));
  }

  // Natter is intrinsic, so its tile is in Spirit rather than loose on
  // the desktop — and Spirit is where an unbound node has to reach it.
  if (spiritGroupLabels(fresh).indexOf('NATter') !== -1 &&
      spiritGroupLabels(fresh).indexOf('Relay Chat') === -1) {
    test.check('and the Spirit grid holds that one and nothing else');
  } else {
    test.fail('spirit grid unbound: ' + spiritGroupLabels(fresh));
  }

  // And it is not a desktop with one icon on it — it is that app, open.
  // Natter is intrinsic, so its tile is in the Spirit group and the gate
  // hides Spirit with everything else: the desktop of an unbound node is
  // EMPTY, and somebody opening 127.0.0.1:65432 on a fresh clone saw a
  // black page with nothing to click.
  if (desktopLabels(fresh) === '') {
    test.check('the desktop of an unbound node has nothing on it');
  } else {
    test.fail('unbound desktop: ' + desktopLabels(fresh));
  }

  // The observable is the script fetch, which is the lazy load a click
  // would have done — the harness cannot execute the injected script, so
  // the title it would then paint is not visible here.
  const autoOpened = fresh.scripts.map(function (script) { return script.src || ''; });
  if (autoOpened.some(function (src) { return src.indexOf('app/natter/natter.js') !== -1; })) {
    test.check('so the shell opens the binder itself, without being clicked');
  } else {
    test.fail('nothing was opened: ' + JSON.stringify(autoOpened));
  }

  // Back and Home would land on that same empty desktop. There is
  // nowhere else to be until this node has a name.
  if (fresh.doc.byId['app-close'].style.display === 'none' &&
      fresh.doc.byId['app-home'].style.display === 'none') {
    test.check('and Back and Home are not offered, because there is nowhere else');
  } else {
    test.fail('titlebar chrome shown while unbound');
  }

  // Hidden means not shown. Everything stays registered, because
  // launchApp by id is what viewers and app-to-app jumps run on.
  let opened = false;
  fresh.shell.registerApp({
    id: 'app/stats-probe', name: 'Probe', icon: '📊', hidden: true,
    mount: function () { opened = true; }, render: function () {},
  });
  fresh.shell.launchApp('app/stats-probe');
  if (opened) {
    test.check('and an app that is not shown can still be launched by id');
  } else {
    test.fail('a hidden app could not be launched');
  }

  // Bound: the shell it has always been.
  const bound = bootShell(prefs, scripts, false, 'andy');
  const boundList = bound.shell.listApps().map(function (a) { return a.id; });
  if (boundList.length > 1 && boundList.indexOf('app/relayChat') !== -1) {
    test.check('a claimed name gives back the whole shell');
  } else {
    test.fail('bound list: ' + JSON.stringify(boundList));
  }

  // And it opens nothing on its own: a node with a name has a desktop to
  // choose from, and choosing is the user's.
  const boundOpened = bound.scripts.map(function (script) { return script.src || ''; });
  if (!boundOpened.some(function (src) { return src.indexOf('app/natter/natter.js') !== -1; }) &&
      bound.doc.byId['app-close'].style.display !== 'none') {
    test.check('a bound node is opened into nothing, and keeps its Back and Home');
  } else {
    test.fail('bound boot opened: ' + JSON.stringify(boundOpened));
  }

  // No escape hatch needed any more, and that is the point of moving the
  // claim: the app an unbound node is shown IS the one with the URL list
  // in it, so a node with no mailbox listed can add one where it stands.
  const stranded = bootShell(prefs, scripts, false, '', null);
  const strandedList = stranded.shell.listApps().map(function (a) { return a.id; });
  if (strandedList.length === 1 && strandedList[0] === 'app/natter') {
    test.check('with no mailbox listed it is still Natter, which is where one is added');
  } else {
    test.fail('stranded list: ' + JSON.stringify(strandedList));
  }

  // The gate can only be trusted if the app it shows is always there.
  // Natter is intrinsic, so it is declared at boot from its manifest —
  // before any snapshot, and whatever the fs-watcher does or does not
  // report. A first run whose one app waited on a watcher would be an
  // empty desktop with no way out of it.
  const early = bootShell(prefs, ['app/relayChat/relayChat.js'], true, '');
  const earlyList = early.shell.listApps().map(function (a) { return a.id; });
  if (earlyList.length === 1 && earlyList[0] === 'app/natter') {
    test.check('and the app it shows is declared at boot, before any snapshot');
  } else {
    test.fail('with the snapshot deferred: ' + JSON.stringify(earlyList));
  }
}

test.subHeading('Contacts is its own app');

// Packet 2: whoBook stayed the store, the view left Relay Chat. Chat is
// one reader of that book; Chess will be another, and neither is a
// reason to open a chat window to add somebody.
{
  const prefs = { defaultHandlers: {}, appOverrides: {}, groups: {} };
  const CONTACTS_SCRIPT = 'app/contacts/contacts.js';

  const manifestContacts = manifest('app/contacts/contacts.json');
  if (manifestContacts.intrinsic === true && manifestContacts.owner === 'system' &&
      manifestContacts.name === 'Contacts') {
    test.check('it ships a manifest that says intrinsic, and who owns it');
  } else {
    test.fail('contacts.json: ' + JSON.stringify(manifestContacts));
  }

  const early = bootShell(prefs, [NATTER_SCRIPT, CONTACTS_SCRIPT], true, BOUND);
  const declared = early.shell.listApps().filter(function (a) { return a.id === 'app/contacts'; })[0];
  if (declared && declared.intrinsic === true && declared.group === 'spirit') {
    test.check('declared eagerly with the snapshot deferred, and in the Spirit group');
  } else {
    test.fail('contacts app: ' + JSON.stringify(declared));
  }

  const fetched = early.scripts.map(function (script) { return script.src || ''; });
  if (!fetched.some(function (src) { return src.indexOf('contacts.js') !== -1; })) {
    test.check('and its script is not fetched until it is opened');
  } else {
    test.fail('contacts.js was loaded at boot');
  }

  const inGrid = (spiritGroupLabels(early).match(/>Contacts</g) || []).length;
  if (inGrid === 1) {
    test.check('and it appears in the Spirit grid exactly once');
  } else {
    test.fail('Contacts in the grid ' + inGrid + ' times: ' + spiritGroupLabels(early));
  }

  // The move, from the other end: the chat app must not still be able to
  // edit the book. Three of the four verbs stayed moved; blocking came
  // back (Andy), because refusing somebody is what you want in the
  // middle of a conversation with them. It goes through api.blockId, so
  // chat still names no hub path of its own — the quoted form is what
  // this asks about, since the file mentions the path in a comment
  // explaining why it does not call it.
  const chat = readRun('app/relayChat/relayChat.js');
  if (chat.indexOf('rc-add-panel') === -1 && chat.indexOf('/api/hub/peer') === -1) {
    test.check('and Relay Chat still adds, accepts, renames and blocks nobody on the node');
  } else {
    test.fail('relayChat.js still carries address-book verbs');
  }
}

test.subHeading('A group screen is a place you can go back to');

{
  // A real registered group, because that is the same template Spirit is
  // built on — registerGroupApp (shell.js) exists to say so, and its grid
  // is painted by the same renderAppGroup / buildAppIcon pair Spirit's
  // own render() calls. Testing the shared path rather than a hand-made
  // stand-in for Spirit means index.html cannot drift away from what is
  // asserted here.
  const booted = bootShell({
    defaultHandlers: {},
    appOverrides: {},
    groups: { g1: { name: 'Tools', icon: '🧰' } },
  }, [NATTER_SCRIPT, 'app/contacts/contacts.js'], false, BOUND);

  function stack() { return booted.shell.navStackIds().join(' > '); }

  // The tile the group's own grid draws, which is the thing under test:
  // renderAppGroup -> buildAppIcon -> its click handler.
  function tileFor(id) {
    const grid = fakeElement('div');
    booted.shell.renderAppGroup(grid, [id]);
    if (grid.children.length !== 1) throw new Error('no tile drawn for ' + id);
    return grid.children[0];
  }

  booted.shell.launchApp('g1');
  if (stack() === 'desktop > g1') {
    test.check('opening a group puts the group on the stack');
  } else {
    test.fail('after opening the group: ' + stack());
  }

  tileFor('app/contacts').fire('click');
  // The regression this section exists for. buildAppIcon used to pass
  // {replace: true}, which overwrote the group's own entry — so Spirit
  // vanished the moment you tapped something in it and Back skipped
  // straight home. Three deep, not two.
  if (stack() === 'desktop > g1 > app/contacts') {
    test.check('and launching from its grid leaves the group underneath, not replaced');
  } else {
    test.fail('after the tile click: ' + stack());
  }

  booted.shell.goBack();
  if (stack() === 'desktop > g1') {
    test.check('so Back lands on the group, not the desktop');
  } else {
    test.fail('after Back: ' + stack());
  }

  booted.shell.goBack();
  if (stack() === 'desktop') {
    test.check('and Back again leaves the group for the desktop');
  } else {
    test.fail('after the second Back: ' + stack());
  }

  // The desktop was never affected either way: replace needed a stack
  // deeper than one, and the desktop is only ever visible at exactly
  // one. Asserted so the claim "desktop behaviour is unchanged" is
  // something the harness holds rather than something a comment says.
  tileFor('app/natter').fire('click');
  if (stack() === 'desktop > app/natter') {
    test.check('and a tile pressed from the desktop still just pushes');
  } else {
    test.fail('from the desktop: ' + stack());
  }

  // Revisiting a screen already on the stack still collapses back to it
  // rather than stacking a duplicate — the other half of launchApp, and
  // the half that has to keep working now that every grid pushes. The
  // stack is desktop > app/natter here, so opening the group and then
  // going back to Natter must land on the entry already there rather
  // than making a second one.
  booted.shell.launchApp('g1');
  booted.shell.launchApp('app/natter');
  if (stack() === 'desktop > app/natter') {
    test.check('and re-entering a screen already open collapses back to it');
  } else {
    test.fail('after re-entering Natter: ' + stack());
  }

  // The rule, stated as one sentence: A VIEWER STEPS OUT OF ITS OWN WAY,
  // and nothing else does. Three callers elide themselves and all three
  // are a launcher finishing with the file it was showing —
  //
  //   Open with       another handler for the same file
  //   Open <app>      the app whose source you were reading
  //   Start Job       the job the form on that script just started
  //
  // — so Back returns to whatever opened the launcher (Processes, Files)
  // rather than to a file you are done with. Everything else pushes, and
  // a group screen pushing is what makes Back into it mean going back to
  // where you were.
  //
  // Counted across both files, so a fourth has to be a decision.
  const shellSrc = readRun('js/client/shell.js');
  const shellReplaces = shellSrc.match(/launchApp\([^)]*\{ replace: true \}\)/g) || [];
  const viewerReplaces = readRun('index.html').match(/launchApp\([^)]*\{ replace: true \}\)/g) || [];
  const replaceCalls = shellReplaces.concat(viewerReplaces);
  if (replaceCalls.length === 3) {
    test.check('and exactly three callers replace their own entry, every one of them a viewer');
  } else {
    test.fail('callers passing replace: ' + replaceCalls.length + ' — ' + replaceCalls.join(' | '));
  }
}

test.subHeading('A viewer says which file, then what is known about it');

{
  const shellSrc2 = readRun('js/client/shell.js');
  const css2 = readRun('index.html');
  const body = shellSrc2.slice(shellSrc2.indexOf('function renderFileInfoBubble'),
    shellSrc2.indexOf('function prettifyAnnotationKey'));

  // The path is the title of the screen, so it has a bubble of its own
  // and no caption: "Path:" was a word saying what the only thing in the
  // bubble obviously is, and it took 90px of the width the path needed
  // most (Andy).
  if (/class="stat-tile wide file-path"/.test(body) && body.indexOf("'Path'") === -1 &&
      body.indexOf('fileInfoRow') === -1) {
    test.check('the path is its own bubble, with no caption in front of it');
  } else {
    test.fail('info bubble: ' + body.replace(/\s+/g, ' ').slice(0, 200));
  }

  // Everything else is a reading about that file, so it is a facts bubble
  // like every other reading in the shell.
  const wanted = ['MIME type', 'Size', 'Changed', 'Created'];
  const missingFacts = wanted.filter(function (label) { return body.indexOf("'" + label + "'") === -1; });
  if (/factRow\(/.test(body) && missingFacts.length === 0) {
    test.check('and the rest is one facts bubble: ' + wanted.join(', '));
  } else {
    test.fail('facts: ' + (missingFacts.length ? 'missing ' + missingFacts.join(', ') : 'no factRow'));
  }

  // Size, Changed and Created come from statFile and are absent when it
  // fails — a race with the file being deleted — rather than shown as
  // blanks. The MIME type is worked out from the name, so it is always
  // there. §1, and what this function already did before the split.
  const guarded = body.indexOf('if (stats)');
  const mimeAt = body.indexOf("'MIME type'");
  if (guarded !== -1 && mimeAt !== -1 && mimeAt < guarded) {
    test.check('and a file whose stat call fails still says which file it is');
  } else {
    test.fail('stat guard at ' + guarded + ', mime at ' + mimeAt);
  }

  // Both launchers, not one: they share renderFileInfoBubble and they
  // share the wrapper problem. Each writes its whole page into a div so a
  // later loadFile can replace it, and while that div said nothing the
  // stack rule stopped at the pane's only child — the two bubbles sat
  // flush, and so did the annotation cards below them.
  const wrappers = ['cv-body', 'mv-body'].filter(function (id) {
    return css2.indexOf('<div id="' + id + '" class="stack">') !== -1;
  });
  if (wrappers.length === 2 && /\.stack > \* \+ \*/.test(css2)) {
    test.check('and both launchers say their wrapper holds blocks, so the rule reaches inside');
  } else {
    test.fail('stacked wrappers: ' + wrappers.join(', '));
  }

  // The bubble echoes the titlebar, which shows the same path — so it
  // reads at the same size and the weight does the telling apart (§2).
  const pathSize = /\.file-path\s*\{[^}]*font-size:\s*(\d+)px/.exec(css2);
  const titleSize = /#app-title\s*\{[^}]*font-size:\s*(\d+)px/.exec(css2);
  const fileWeight = /\.path-file\s*\{[^}]*font-weight:\s*(\d+)/.exec(css2);
  if (pathSize && titleSize && pathSize[1] === titleSize[1] && fileWeight) {
    test.check('reading at the titlebar size, with the filename carrying the weight');
  } else {
    test.fail('path ' + (pathSize && pathSize[1]) + ' vs title ' + (titleSize && titleSize[1]));
  }
}

test.subHeading('A path always fits, however narrow the pane');

{
  const css3 = readRun('index.html');
  const shellSrc3 = readRun('js/client/shell.js');
  const fnBody = shellSrc3.slice(shellSrc3.indexOf('function pathValue'),
    shellSrc3.indexOf('function renderFileInfoBubble'));
  const pathValue = new Function('escapeHtml', fnBody + '; return pathValue;')(
    spirit.core.util.escapeHtml);

  // A break opportunity after every slash, and none anywhere else. The
  // spans do NOT provide this — an element boundary is not a line break
  // opportunity — so if <wbr> ever goes, the path stops folding and
  // nothing else says so.
  const out = pathValue('spirit/run/app/relayChat/relayChat.js');
  if ((out.match(/<wbr>/g) || []).length === 4) {
    test.check('a four-deep path offers a break after each of its slashes');
  } else {
    test.fail('breaks: ' + out);
  }

  if (/class="path-dir">spirit\//.test(out) && /class="path-file">relayChat\.js</.test(out)) {
    test.check('and its directories and its filename are told apart');
  } else {
    test.fail('segments: ' + out);
  }

  const bare = pathValue('notes.txt');
  if (bare.indexOf('<wbr>') === -1 && bare.indexOf('path-dir') === -1) {
    test.check('while a bare filename gets no directory and no break');
  } else {
    test.fail('bare: ' + bare);
  }

  // The markup is built AFTER escaping, per segment, so a filename cannot
  // become part of the structure.
  const nasty = pathValue('media/<script>alert(1)</script>.txt');
  if (nasty.indexOf('<script') === -1 && nasty.indexOf('&lt;script') !== -1) {
    test.check('and a filename with markup in it stays a filename');
  } else {
    test.fail('escaping: ' + nasty);
  }

  // min-width:0 is what actually lets it shrink — a flex item refuses to
  // go below min-content otherwise, and for a path with no spaces that is
  // the whole string. overflow-wrap:anywhere rather than break-word,
  // because only `anywhere` affects min-content sizing.
  const valueRule = /\.file-info-value, \.fact-value\s*\{([^}]*)\}/.exec(css3);
  if (valueRule && /min-width:\s*0/.test(valueRule[1]) &&
      /overflow-wrap:\s*anywhere/.test(valueRule[1])) {
    test.check('and the value may shrink, with somewhere to break when it must');
  } else {
    test.fail('value rule: ' + (valueRule && valueRule[1].replace(/\s+/g, ' ').trim()));
  }
}

test.subHeading('The process form obeys the same rules as every other form');

{
  const html4 = readRun('index.html');
  const form = html4.slice(html4.indexOf('var argsHtml ='), html4.indexOf('job-manifest-note"></div>'));

  // Captioned fields, through the shared class rather than a private copy
  // of it. #job-manifest-form label was byte-for-byte .field-label under
  // an id — the duplication §9 was written against, and .field-label's own
  // comment says it was made FROM this form and this form never followed.
  const privateCopy = /#job-manifest-form label\s*\{/.test(html4);
  if (/class="field-label"/.test(form) && !privateCopy) {
    test.check('its fields use the shared caption class, not a private copy under an id');
  } else {
    test.fail('field-label in form: ' + /class="field-label"/.test(form) +
      ', private copy still in css: ' + privateCopy);
  }

  if (/class="start-job-form card"/.test(form) &&
      form.indexOf('start-job-form card') < form.indexOf('start-manifest-job')) {
    test.check('and it is a row that wraps, with Start at the end of it');
  } else {
    test.fail('form shape: ' + form.replace(/\s+/g, ' ').slice(0, 160));
  }

  // The heading was a bare <h3>, whose default top margin was the space
  // above the panel nobody asked for. One class for the three panels that
  // want a heading, and it carries no margin of its own.
  const headingRule = /\.panel-heading\s*\{([^}]*)\}/.exec(html4);
  if (/class="panel-heading"/.test(form) && headingRule && /margin:\s*0/.test(headingRule[1]) &&
      html4.indexOf('.natter-mint-heading {') === -1) {
    test.check('and its heading brings no margin, through the class all three panels share');
  } else {
    test.fail('panel-heading: ' + (headingRule && headingRule[1].replace(/\s+/g, ' ').trim()));
  }

  const noteRule = /\.job-manifest-note\s*\{([^}]*)\}/.exec(html4);
  if (noteRule && !/min-height/.test(noteRule[1]) &&
      /\.job-manifest-note:empty\s*\{[^}]*display:\s*none/.test(html4)) {
    test.check('and its note collapses until there is a message');
  } else {
    test.fail('.job-manifest-note: ' + (noteRule && noteRule[1].replace(/\s+/g, ' ').trim()));
  }
}

test.subHeading('index.html calls nothing it has not taken off spirit.shell');

{
  // index.html's inline script is a separate top-level script with no
  // closure access to shell.js — window.spirit is all it can see — so it
  // pulls each function it uses into a local first. Add a shell function,
  // call it from there, forget the local, and you get a ReferenceError at
  // the moment that code runs: the viewer renders its file bubble and
  // then stops, half a screen drawn, nothing in the console anybody was
  // watching. That is how renderAppOfFile shipped.
  const html = readRun('index.html');
  const shellSrc = readRun('js/client/shell.js');

  // What the shell offers, off its own export block.
  const exportBlock = shellSrc.slice(shellSrc.indexOf('spirit.shell = {'),
    shellSrc.indexOf('};', shellSrc.indexOf('spirit.shell = {')));
  const exported = (exportBlock.match(/^\s*([A-Za-z_][A-Za-z0-9_]*):/gm) || [])
    .map(function (line) { return line.replace(/[\s:]/g, ''); });

  // What index.html took a local for.
  const imported = (html.match(/var\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*spirit\.shell\./g) || [])
    .map(function (line) { return /var\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(line)[1]; });

  // Calls through the global are fine and are not what this asks about,
  // so they are removed before looking for bare ones.
  const bare = html.replace(/spirit\.shell\.[A-Za-z0-9_]+/g, '');
  const missing = exported.filter(function (name) {
    return imported.indexOf(name) === -1 &&
      new RegExp('(^|[^.\\w])' + name + '\\s*\\(').test(bare);
  });

  if (exported.length > 5 && missing.length === 0) {
    test.check('every shell function it calls bare is one it took a local for — ' +
      exported.length + ' offered, ' + imported.length + ' taken');
  } else {
    test.fail('called without a local: ' + (missing.join(', ') || '(export block not found)'));
  }
}

test.subHeading("A file that IS an app says so, and offers the way back");

{
  const booted = bootShell({ defaultHandlers: {}, appOverrides: {}, groups: {} },
    [NATTER_SCRIPT, 'app/contacts/contacts.js'], false, BOUND);

  function bubbleFor(path) {
    const box = fakeElement('div');
    booted.shell.renderAppOfFile(box, path);
    return box.innerHTML;
  }

  // The entry script of a declared app: its icon, its name, and one way
  // back to it.
  const natter = bubbleFor('app/natter/natter.js');
  const app = appById(booted, 'app/natter');
  if (natter.indexOf(app.name) !== -1 && natter.indexOf(app.icon) !== -1 &&
      /id="app-of-file-open"/.test(natter)) {
    test.check('an app entry script shows the app, by the name and icon the desktop shows');
  } else {
    test.fail('bubble: ' + natter);
  }

  // A form like every other: the identity takes the width, the button
  // ends the row, and the panel IS the form so there is no card in it.
  if (/class="start-job-form"/.test(natter) && /class="stat-tile wide"/.test(natter) &&
      natter.indexOf('start-job-form card') === -1) {
    test.check('and it is one bubble with the button at the end of the row');
  } else {
    test.fail('shape: ' + natter);
  }

  // A sibling in the same folder is not the app. The match is the same
  // folder-derived shape declareDynamicApp uses to work out an id, so a
  // helper or a fixture living beside the entry script offers nothing.
  const sibling = bubbleFor('app/natter/helper.js');
  if (sibling === '') {
    test.check('while a sibling file in that folder is not the app, and offers nothing');
  } else {
    test.fail('sibling: ' + sibling);
  }

  // The registry is asked as well as the path. A folder matching the
  // shape is only an app if the shell declared one from it — a file
  // sitting where an app used to be must offer nothing to open.
  const gone = bubbleFor('app/ghost/ghost.js');
  if (gone === '') {
    test.check('and a path that looks like an app but is not declared offers nothing');
  } else {
    test.fail('undeclared: ' + gone);
  }

  // Pressing it takes the viewer off the stack with it: you were reading
  // the source on the way to the app, so Back should return to wherever
  // you came from rather than to the file you have finished with (Andy).
  {
    booted.shell.registerApp({
      id: 'stack-probe', name: 'Probe', icon: 'P', hidden: true,
      mount: function () {}, render: function () {},
    });
    booted.shell.launchApp('stack-probe');
    const before = booted.shell.navStackIds().join(' > ');

    const box = fakeElement('div');
    booted.shell.renderAppOfFile(box, 'app/natter/natter.js');
    booted.doc.byId['app-of-file-open'].fire('click');
    const after = booted.shell.navStackIds().join(' > ');

    if (before === 'desktop > stack-probe' && after === 'desktop > app/natter') {
      test.check('and pressing it puts the app where the viewer was, not on top of it');
    } else {
      test.fail('stack: ' + before + '  ->  ' + after);
    }
  }

  // Nothing else in the tree is mistaken for one — process scripts share
  // the same <name>/<name>.<ext> convention on purpose.
  const outside = ['process/js/probe/probe.js', 'media/dummy.txt', 'app/natter/natter.json']
    .filter(function (p) { return bubbleFor(p) !== ''; });
  if (outside.length === 0) {
    test.check('nor is a process script, which shares the same naming convention');
  } else {
    test.fail('claimed: ' + outside.join(', '));
  }
}

test.subHeading('Open with is a form like the others');

{
  const shellSrc5 = readRun('js/client/shell.js');
  const owBody = shellSrc5.slice(shellSrc5.indexOf('var defaultId = preferences.defaultHandlers'),
    shellSrc5.indexOf('open-with-go'));

  // A caption over its control rather than written inline beside it, and
  // the buttons at the end of a row rather than separated from it by
  // literal spaces in the markup (§3).
  //
  // The old form is matched as the SOURCE STRING it was — quote and all —
  // not as the phrase. The comment above renderOpenWith's markup explains
  // what it stopped doing and names the old wording, so a check looking
  // for the prose finds the explanation and fails. §7 exists for this.
  if (/class="field-label grow">Open with/.test(owBody) &&
      /class="start-job-form"/.test(owBody) && owBody.indexOf("'<label>Open with") === -1) {
    test.check('its caption sits over the control, in a row that wraps');
  } else {
    test.fail('open-with markup: ' + owBody.replace(/\s+/g, ' ').slice(-200));
  }

  if (/class="stat-tile wide"/.test(owBody) && owBody.indexOf('start-job-form card') === -1) {
    test.check('and it is one bubble, not a bubble inside a bubble');
  } else {
    test.fail('panelling: ' + owBody.replace(/\s+/g, ' ').slice(-200));
  }
}

test.subHeading('The Processes screen offers one control and one list');

{
  const src = readRun('app/process-browser/process-browser.js');
  const css = readRun('index.html');

  // The search box is the one control this screen offers, so it sits in a
  // panel — the shape the Jobs and Groups forms have. Read as an
  // ordering, because the markup is built by concatenation and a regex
  // across it would be asserting the source's formatting.
  const panelAt = src.indexOf('<div class="stat-tile wide">');
  const searchAt = src.indexOf('id="process-search"');
  const listAt = src.indexOf('id="process-browser-list"');
  if (panelAt !== -1 && panelAt < searchAt && searchAt < listAt) {
    test.check('the search box has a panel of its own, above the list');
  } else {
    test.fail('search is not panelled: ' + [panelAt, searchAt, listAt].join(','));
  }

  // And no caption over it. Jobs needed three, because its placeholders
  // were the captions and left the moment you typed; one search box is
  // not ambiguous, and a word that cannot do anything is §1.
  if (src.indexOf('field-label') === -1) {
    test.check('and no caption over it — one search box is not ambiguous');
  } else {
    test.fail('a caption was added to the search box');
  }

  // §3: the box does not push the list down. The list is a block in the
  // pane's stack and carries its own space above it.
  const searchRule = /#process-search\s*\{([^}]*)\}/.exec(css);
  if (searchRule && !/margin-bottom/.test(searchRule[1])) {
    test.check('and pushes nothing down: the list brings its own space');
  } else {
    test.fail('#process-search: ' + (searchRule && searchRule[1].replace(/\s+/g, ' ').trim()));
  }

  // §2: the description is the sentence saying what a process DOES, which
  // is why the list is worth reading. Fine print belongs at the foot of a
  // page, not shrunk in the middle of one — so it reads at the size the
  // titlebar does and is told apart by weight and dimming instead.
  const desc = /\.process-entry-desc\s*\{[^}]*font-size:\s*(\d+)px/.exec(css);
  const title = /#app-title\s*\{[^}]*font-size:\s*(\d+)px/.exec(css);
  if (desc && title && desc[1] === title[1]) {
    test.check('and a process description reads at the size of the titlebar');
  } else {
    test.fail('description ' + (desc && desc[1]) + 'px vs title ' + (title && title[1]) + 'px');
  }
}

test.subHeading('The Jobs screen offers one action and one table');

{
  const src = readRun('app/jobs/jobs.js');
  const css = readRun('index.html');

  // The form is the one thing this screen asks you to do, so it sits in
  // a panel of its own with its error under it — the shape the Groups
  // create form has. A bare row at the top of a pane read as chrome.
  // Read as an ordering rather than a shape: the markup is built by
  // string concatenation across many lines, so a regex spanning it would
  // be matching the source's formatting rather than the page's.
  const panelAt = src.indexOf('<div class="stat-tile wide">');
  const formAt = src.indexOf('start-job-form"');
  const errorAt = src.indexOf('job-start-error"');
  const tableAt = src.indexOf('<table class="jobs-table">');
  if (panelAt !== -1 && panelAt < formAt && formAt < errorAt && errorAt < tableAt) {
    test.check('the start form and its error share a panel of their own');
  } else {
    test.fail('start form is not panelled');
  }

  // A column of one clipped line — enough to say something happened,
  // never enough to read (Andy). Opening the row shows the whole log,
  // which is what the column made you want.
  //
  // Matched on the header cell and the class, not on the words: the
  // comment above this check names the column it removed, and a grep for
  // the prose finds itself. That is the fourth time today.
  const leftovers = [['jobs.js', src], ['index.html', css]]
    .filter(function (pair) {
      return pair[1].indexOf('<th>Last log</th>') !== -1 ||
        pair[1].indexOf('job-last-log') !== -1;
    })
    .map(function (pair) { return pair[0]; });
  if (leftovers.length === 0) {
    test.check('and Last log is gone from the header, the row and the stylesheet');
  } else {
    test.fail('last-log leftovers in: ' + leftovers.join(', '));
  }

  // Captions over the inputs, as every other form in the shell has. A
  // placeholder is the caption hidden inside the box, and it leaves the
  // moment you type in it.
  const jobFields = (src.match(/class="field-label/g) || []).length;
  const bare = /<input type="text" id="job-command"/.test(src) &&
    src.indexOf('<label class="field-label">Command') === -1;
  if (jobFields === 3 && !bare) {
    test.check('and all three inputs are captioned, not left to their placeholders');
  } else {
    test.fail(jobFields + ' captions, bare command input: ' + bare);
  }

  // A column removed is two numbers to keep in step: the header and
  // every colspan under it. Read rather than assumed, because a colspan
  // that is one too wide only shows as a panel bleeding past the table.
  const headers = (src.match(/<th>/g) || []).length;
  const spans = (src.match(/colspan="(\d+)"/g) || []).map(function (m) {
    return Number(/\d+/.exec(m)[0]);
  });
  if (headers === 5 && spans.length && spans.every(function (n) { return n === headers; })) {
    test.check('and every colspan still matches the ' + headers + ' columns above it');
  } else {
    test.fail(headers + ' headers vs colspans ' + JSON.stringify(spans));
  }
}

test.subHeading('Sibling folds are one exclusive group, in every app');

{
  // UI_DESIGN_STYLE.md §3: opening one fold closes its siblings, done by
  // the browser through <details name="…">. Checked across the whole
  // tree rather than per app, because the way this rule fails is that
  // somebody adds a SECOND fold to an app that had one and never learns
  // there was a rule. Contacts is the only app with siblings today; this
  // is here for the app that grows a second one.
  const fs = require('fs');
  const path = require('path');
  const RUN = path.join(__dirname, '..', 'run');

  // Two kinds of <details> are not accordions and are exempt by name:
  // the Files tree, where exclusive folders would collapse the path you
  // came down, and an annotation's raw-JSON disclosure, which is a value
  // on a data card rather than a panel.
  // Matched only where a string literal OPENS one. Plain /<details/
  // also finds the sentence in files.js that explains why a rebuilt fold
  // comes back closed — a check a comment can fail is a check a comment
  // can also silently pass.
  function panelFolds(src) {
    return (src.match(/['\"]<details[^>]*>/g) || []).filter(function (tag) {
      return tag.indexOf('data-path') === -1 && tag.indexOf('annotation-raw') === -1;
    });
  }

  const files = fs.readdirSync(path.join(RUN, 'app'))
    .map(function (folder) { return ['app/' + folder, path.join(RUN, 'app', folder, folder + '.js')]; })
    .filter(function (pair) { return fs.existsSync(pair[1]); })
    .concat([['js/client/shell.js', path.join(RUN, 'js', 'client', 'shell.js')]]);

  const offenders = [];
  let grouped = 0;
  files.forEach(function (pair) {
    const folds = panelFolds(fs.readFileSync(pair[1], 'utf8'));
    if (folds.length < 2) return;
    const names = folds.map(function (tag) {
      const found = /name="([^"]+)"/.exec(tag);
      return found ? found[1] : '';
    });
    if (names.some(function (n) { return !n; }) || new Set(names).size !== 1) {
      offenders.push(pair[0] + ' ' + JSON.stringify(names));
    } else {
      grouped += 1;
    }
  });

  if (offenders.length === 0) {
    test.check('every app with more than one panel fold groups them — ' + grouped + ' such app(s)');
  } else {
    test.fail('ungrouped folds: ' + offenders.join('; '));
  }

  // And the exemptions are real rather than assumed: the tree still
  // builds folds, and they still carry no group.
  const tree = fs.readFileSync(path.join(RUN, 'app', 'files', 'files.js'), 'utf8');
  const treeFolds = (tree.match(/['\"]<details[^>]*>/g) || []);
  if (treeFolds.length && treeFolds.every(function (t) { return t.indexOf('name=') === -1; })) {
    test.check('and the Files tree is left alone — a folder is not a panel');
  } else {
    test.fail('tree folds: ' + JSON.stringify(treeFolds));
  }
}

test.reportSuccessFailureCount();
