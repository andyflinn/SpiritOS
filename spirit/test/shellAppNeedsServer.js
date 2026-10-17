'use strict';

// spirit/test/shellAppNeedsServer.js
// goal/G27.16: a shell app shows only while its server runs. Red on today's tree; claude-windows wrote it and builds
// it (one agent). The item's box (Andy, goal/G27.9 chat, 2026-10-17):
//   R1. a shell app manifest may name the server it needs; the shell shows that app only while that server is
//       installed and running; when the server is uninstalled or stopped, the app is not offered.
//   R2. the link lives on the app side only.
//   R3. an app that names no server always shows, as today.
//   R4. the shell names no app and no server: it reads the field from each manifest.
//
// THE SHAPE THIS RED NAMES: the manifest field is `server`, the server's folder name under process/js (desk.json:
// "server": "desk"; deskAgentRemote.json: "server": "deskAgent"). Running is a job of type server whose module is
// process/js/<server> and whose status is running, or pending (a node-operated server between restarts, which comes
// back by itself); failed, completed or no such job is not running. A server job is kind server; its type is its display name.
// WHAT IS ASSERTED
//   1. the manifests: Desk, its two dialogs and Chatter name their servers; the Remote names none (its server may be on a puppet); Text Editor names none.
//   2. with no desk server running Desk is not on the desktop; Text Editor is (R3).
//   3. once a desk server job runs, Desk shows; the Remote, needing deskAgent, still does not.
//   4. a server restarting (pending) keeps its app; a failed one, or one gone from the jobs, takes it away.
//   5. shell.js names no app and no server for this (R4).
// rule/11: through testSupport only; no node, no port.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const spirit = require('../run/js/kernel.js');

const OWED = 'OWED by goal/G27.16: ';
const RUN_DIR = path.join(__dirname, '..', 'run');
function readRun(rel) { return fs.readFileSync(path.join(RUN_DIR, rel), 'utf8').replace(/\r\n/g, '\n'); }
function manifest(rel) { try { return JSON.parse(readRun(rel)); } catch (e) { return {}; } }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

// A shell in node, as natterIntrinsic.js boots it: only the browser things shell.js touches.
function fakeElement(tag) {
  let html = '';
  const listeners = {};
  const el = {
    tag: tag, className: '', textContent: '', hidden: false, style: {}, children: [],
    appendChild: function (child) { el.children.push(child); return child; },
    addEventListener: function (type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    fire: function (type, event) { (listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelector: function () { return fakeElement('div'); }, querySelectorAll: function () { return []; }, remove: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); el.children.length = 0; }, enumerable: true });
  return el;
}
function bootShell(appScripts) {
  const byId = {};
  ['desktop', 'app-container', 'app-title', 'app-content', 'app-close', 'app-home'].forEach(function (id) { byId[id] = fakeElement('div'); });
  const doc = { byId: byId, body: fakeElement('body'), getElementById: function (id) { return byId[id] || (byId[id] = fakeElement('div')); }, createElement: fakeElement, createDocumentFragment: function () { return fakeElement('fragment'); } };
  const subscribers = [];
  const shellSpirit = {
    core: {
      ask: function (verb) {
        if (verb === 'node.card') return { status: 200, text: '', body: { ok: true, name: 'andy' } };
        throw new Error('this fixture hands shell.js no fetch');
      },
      const: { ICON: spirit.core.const.ICON, MIME: {} },
      util: { escapeHtml: spirit.core.util.escapeHtml, formatBytes: function () { return ''; } },
      fs: {
        loadFile: function (rel) {
          if (rel === 'preferences.json') return JSON.stringify({ defaultHandlers: {}, appOverrides: {}, groups: {} });
          try { return readRun(rel); } catch (e) { return null; }
        },
        saveFile: function () { return Promise.resolve(); },
        statFile: function () { return null; }, getAnnotations: function () { return {}; }, createScopedFs: function () { return {}; },
      },
      jobs: { subscribe: function (handlers) { subscribers.push(handlers); } },
    },
  };
  new Function('spirit', 'document', readRun('js/client/shell.js'))(shellSpirit, doc);
  const watcher = { id: 'fs-watcher-1', type: 'fs-watcher', data: {} };
  subscribers.forEach(function (h) { h.onSnapshot([watcher]); });
  subscribers.forEach(function (h) {
    appScripts.forEach(function (rel) { h.onUpdate({ id: 'fs-watcher-1', type: 'fs-watcher', data: { command: { op: 'createFile', path: rel, at: '' } } }); });
    h.onUpdate({ id: 'fs-watcher-1', type: 'fs-watcher', data: { treeComplete: true } });
  });
  return {
    desktop: byId.desktop,
    update: function (job) { subscribers.forEach(function (h) { h.onUpdate(job); }); },
    remove: function (id) { subscribers.forEach(function (h) { if (h.onDelete) h.onDelete(id); }); },
  };
}
function shown(booted) { return booted.desktop.children.map(function (el) { return el.innerHTML; }).join(' | '); }
// A server job as jobs.js makes it (createJob): kind server, its display name as type (goal/G27.16: on Levant's node the
// deskAgent job reads type 'Desk Agent'), its module.
function deskServer(status) { return { id: 'server-desk', kind: 'server', type: 'Desk', module: 'process/js/desk', status: status, data: {} }; }

test.startTest('goal/G27.16: a shell app shows only while its server runs');

test.subHeading('1. the manifests name their servers');
const named = {
  'shell/desk/desk.json': 'desk', 'shell/deskDetails/deskDetails.json': 'desk', 'shell/ruleDetails/ruleDetails.json': 'desk',
  // Folded in by Andy, 2026-10-17: Chatter is the face of chatClerver.
  'shell/chatter/chatter.json': 'chatClerver',
};
const wrong = Object.keys(named).filter(function (rel) { return manifest(rel).server !== named[rel]; });
if (!wrong.length) test.check('Desk, its two dialogs and Chatter name their servers');
else test.fail(OWED + 'these manifests do not name their server: ' + wrong.map(function (r) { return r + ' reads ' + JSON.stringify(manifest(r).server); }).join('; '));
if (manifest('shell/textEditor/textEditor.json').server === undefined && manifest('shell/deskAgentRemote/deskAgentRemote.json').server === undefined) test.check('Text Editor and the Remote name none');
else test.fail(OWED + 'textEditor.json names a server: ' + short(manifest('shell/textEditor/textEditor.json').server));

const booted = bootShell(['shell/desk/desk.js', 'shell/deskAgentRemote/deskAgentRemote.js', 'shell/textEditor/textEditor.js']);
const has = function (name) { return shown(booted).indexOf(name) !== -1; };

test.subHeading('2. no desk server running');
if (has('Text Editor')) test.check('Text Editor, naming no server, is on the desktop');
else test.fail('the world: Text Editor is not on the desktop: ' + short(shown(booted)));
if (!has('>Desk<') && !/Desk(?! Agent)/.test(shown(booted).replace(/Desk Agent Remote/g, ''))) test.check('Desk is not offered while no desk server runs');
else test.fail(OWED + 'Desk is on the desktop with no desk server: ' + short(shown(booted)));

test.subHeading('3. the desk server runs');
booted.update(deskServer('running'));
const withDesk = shown(booted).replace(/Desk Agent Remote/g, '');
if (/Desk/.test(withDesk)) test.check('with the desk server running, Desk shows');
else test.fail(OWED + 'Desk is not on the desktop with its server running: ' + short(shown(booted)));
// Andy, 2026-10-17: the Remote names no server, its deskAgent may run on a puppet; it always shows.
if (has('Desk Agent Remote')) test.check('the Remote, naming no server, shows with no deskAgent here');
else test.fail(OWED + 'the Remote is hidden: ' + short(shown(booted)));

test.subHeading('4. restarting keeps it, failed or gone takes it');
booted.update(deskServer('pending'));
if (/Desk/.test(shown(booted).replace(/Desk Agent Remote/g, ''))) test.check('a desk server between restarts (pending) keeps Desk');
else test.fail(OWED + 'Desk went away while its server restarts');
booted.update(deskServer('failed'));
if (!/Desk/.test(shown(booted).replace(/Desk Agent Remote/g, ''))) test.check('a failed desk server takes Desk away');
else test.fail(OWED + 'Desk stays with its server failed: ' + short(shown(booted)));
booted.update(deskServer('running'));
booted.remove('server-desk');
if (!/Desk/.test(shown(booted).replace(/Desk Agent Remote/g, ''))) test.check('a desk server gone from the jobs takes Desk away');
else test.fail(OWED + 'Desk stays with its server gone: ' + short(shown(booted)));

test.subHeading('4b. a job whose display name is not server still counts');
booted.update({ id: 'server-desk', kind: 'server', type: 'Desk Agent', module: 'process/js/desk', status: 'running', data: {} });
if (/Desk/.test(shown(booted).replace(/Desk Agent Remote/g, ''))) test.check('a server job typed with its display name keeps its app');
else test.fail(OWED + 'a running server job typed Desk Agent was not seen: ' + short(shown(booted)));
booted.remove('server-desk');

test.subHeading('5. shell.js names no app and no server for this');
const shellSrc = readRun('js/client/shell.js');
if (/manifest\.server/.test(shellSrc) && !/['"]process\/js\/(desk|deskAgent)['"]/.test(shellSrc)) test.check('shell.js reads manifest.server and names no server');
else test.fail(OWED + 'shell.js does not read manifest.server, or names a server itself');

test.reportSuccessFailureCount();
