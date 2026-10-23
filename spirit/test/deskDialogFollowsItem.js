'use strict';

// goal/G24.7: THE ITEM DIALOG FOLLOWS THE ITEM IT IS OPENED ON.
//   The box: "The item dialog shows the item it is opened on, its buttons press that item, and a change to that item
//   redraws it, with no refresh by Andy." Seen 2026-10-14: Code pressed twice in the goal/G23.2 dialog went to
//   goal/G23.1, which reset its phase to red although deskVerify had passed it; since then Andy refreshes before every
//   press. "Test: open one item's dialog, then another's; every press and every redraw goes to the item now open, never
//   the one before."
//
// THE CAUSE, READ AT 2580acda. deskDetails.js is right for the plain sequence: open() sets ddId and clears every fact
// (deskDetails.js:624-641), ddPress reads ddId at the click (:63), ddTake drops a publish for another item (:398). Section
// 1 holds that, green. What breaks it is the shell, on a stream that comes back:
//   - the node sends the whole tree again on every page stream, ending in treeComplete (server.js:249-260), so every
//     reconnect (each restart of his node) runs discoverDynamicApps, which re-declares every app (shell.js:3018-3021);
//   - declareDynamicApp rebuilds the entry and carries mount, render, loadFile, _activated and _el over, but not
//     `open` (shell.js:2815-2848), which activateApp set once (shell.js:1866);
//   - so the next callDialog finds the script activated (no reload, shell.js:1807) and the pane mounted (no mount,
//     shell.js:1669), and switchTo's `if (typeof app.open === 'function') app.open(params)` (shell.js:1707) skips: the
//     pane is shown as it was, on the item opened before. Its title, its Code ✓, its box are that item's, ddId is that
//     item's id, so his presses go there, and a publish for that item redraws it. A refresh reloads the script, and
//     activateApp sets `open` again: hence "he refreshes before every press".
// Section 2 is Andy's sequence through that path, and it is red until the dialog follows its item again.
//
// Driven the way listeningApp.js drives the real shell.js (small document, fs and jobs stubs, the script "load" fired
// by hand), with the real deskDetails.js evaluated as the browser would evaluate the script the shell injected. The
// desk app that opens the dialog is a stand-in doing what desk.js's deskOpenRow does (desk.js:1097-1105): callDialog
// shell/deskDetails with { id }, and open the row a result names. The desk server is a stand-in answering desk.<verb>
// by name (goal/G30.6) as desk.js does: item.get, item.box, item.checks, item.chat, and a press that publishes the item it pressed.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel');
const packet = require('../run/js/client/packet');

const OWED = 'OWED by goal/G24.7: ';
const SHELL = path.join(__dirname, '..', 'run', 'js', 'client', 'shell.js');
const DETAILS = path.join(__dirname, '..', 'run', 'shell', 'deskDetails', 'deskDetails.js');
const DETAILS_MANIFEST = fs.readFileSync(path.join(__dirname, '..', 'run', 'shell', 'deskDetails', 'deskDetails.json'), 'utf8');
const DESK_MANIFEST = JSON.stringify({ name: 'Desk', icon: 'THREAD', hidden: false, intrinsic: false });
const DD = 'shell/deskDetails';

const A = 'goal/G100.1';   // the item opened first (goal/G23.1 in his sequence): a code item
const B = 'goal/G100.2';   // the item opened next (goal/G23.2): not a code item

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
async function settled() { for (let i = 0; i < 6; i++) await sleep(10); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

function fakeElement(tag) {
  let html = '';
  const attrs = {};
  const el = {
    tag: tag, id: '', className: '', textContent: '', hidden: false, value: '', disabled: false, style: {}, children: [],
    listeners: {},
    appendChild: function (child) { el.children.push(child); return child; },
    removeChild: function () {}, replaceChild: function () {}, remove: function () {},
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).slice().forEach(function (fn) { fn(event || {}); }); },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    setAttribute: function (k, v) { attrs[k] = String(v); },
    getAttribute: function (k) { return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null; },
    focus: function () {},
  };
  Object.defineProperty(el, 'innerHTML', {
    get: function () { return html; },
    set: function (v) { html = String(v); el.children.length = 0; },
    enumerable: true,
  });
  return el;
}

// A click on one of the dialog's buttons, as the browser hands it to #dd-body's listener.
function clickOn(id) {
  return { target: { id: id, closest: function () { return null; }, getAttribute: function () { return null; } }, preventDefault: function () {} };
}

// ── THE DESK SERVER, STAND-IN ───────────────────────────────────────────
function deskStandIn() {
  const items = {};
  items[A] = { id: A, title: 'First', goal: 'goal/G100', status: 'running', code: true, buttons: ['done'], blocked: [], blocking: [], claims: 1 };
  items[B] = { id: B, title: 'Second', goal: 'goal/G100', status: 'ready', code: false, buttons: ['go'], blocked: [], blocking: [], claims: 0 };
  const desk = { items: items, change: 10, presses: [], publish: null };
  desk.answer = function (ask) {
    const verb = Object.keys(ask)[0];
    const a = ask[verb] || {};
    const it = items[a.id];
    if (verb === 'item.get') return it ? { ok: true, item: JSON.stringify(it), version: 1, change: desk.change } : { ok: false, code: 'no-such-item' };
    if (verb === 'item.box') return { ok: true, box: 'the box of ' + a.id, version: 1 };
    if (verb === 'item.checks') return { ok: true, checks: [] };
    if (verb === 'item.chat') return { ok: true, chat: [], chatMore: false };
    if (verb === 'press') {
      desk.presses.push({ id: a.id, what: a.what });
      if (!it) return { ok: false, code: 'no-such-item' };
      if (a.what === 'code') it.code = !it.code;   // as desk.js press() does (desk.js:1042-1045)
      desk.changed(a.id);
      return { ok: true, change: desk.change };
    }
    return { ok: true };
  };
  // A change to one item, published as the desk server publishes it: the next change number and the item's facts.
  desk.changed = function (id, patch) {
    if (patch) Object.assign(items[id], patch);
    desk.change += 1;
    if (desk.publish) desk.publish({ change: desk.change, item: JSON.parse(JSON.stringify(items[id])) });
  };
  return desk;
}

// ── THE PAGE: the real shell.js, the stand-in desk app, the real deskDetails.js ──
function bootPage(desk) {
  const byId = {};
  const doc = {
    body: fakeElement('body'),
    currentScript: null,
    getElementById: function (id) { if (!byId[id]) { byId[id] = fakeElement('div'); byId[id].id = id; } return byId[id]; },
    createElement: fakeElement,
    createDocumentFragment: function () { return fakeElement('fragment'); },
    addEventListener: function () {},
  };
  const win = test.withSpirit({ 'spirit.packet': packet, 'spirit.limits': require('../run/js/limits.js'), addEventListener: function () {} });
  const subscribers = [];
  const shellSpirit = {
    core: {
      ask: function (verb, args) {
        // The desk's verbs by name (desk.<verb>, goal/G30.6), folded back to {desk: {verb: args}}.
        const asked = test.foldAsk(Object.assign({}, args, { verb: verb }));
        const body = asked && asked.desk ? desk.answer(asked.desk) : {};
        return Promise.resolve({ status: 200, text: JSON.stringify(body), body: body });
      },
      const: { ICON: kernel.core.const.ICON, MIME: {} },
      util: { escapeHtml: kernel.core.util.escapeHtml, formatBytes: function () { return ''; } },
      fs: {
        loadFile: function (rel) {
          if (rel === 'preferences.json') return JSON.stringify({ apps: {}, groups: {} });
          if (rel === 'shell/natter/session.json') return JSON.stringify({ label: 'me', boundAt: '2026-09-13T00:00:00.000Z' });
          if (rel === 'shell/desk/desk.json') return DESK_MANIFEST;
          if (rel === 'shell/deskDetails/deskDetails.json') return DETAILS_MANIFEST;
          return null;
        },
        saveFile: function () { return Promise.resolve(); },
        statFile: function () { return null; },
        getAnnotations: function () { return {}; },
        createScopedFs: function () { return {}; },
      },
      jobs: { subscribe: function (handlers) { subscribers.push(handlers); } },
    },
  };
  new Function('spirit', 'document', 'fetch', 'window', fs.readFileSync(SHELL, 'utf8'))(shellSpirit, doc, function () {}, win);
  const jobsWire = subscribers.filter(function (h) { return typeof h.onUpdate === 'function'; })[0];
  let deskJob = { id: 'job_desk', kind: 'server', type: 'Desk server', module: 'process/js/desk', status: 'running', data: {}, log: [], app: { change: desk.change } };

  // THE TREE, as the node sends it on every page stream (server.js:249-260): a snapshot whose fs-watcher job carries
  // no file list, one command per entry, then treeComplete.
  function stream() {
    jobsWire.onSnapshot([{ id: 'fs-watcher-1', type: 'fs-watcher', data: {} }, deskJob]);
    ['shell', 'shell/desk', 'shell/deskDetails'].forEach(function (p) { jobsWire.onUpdate({ id: 'fs-watcher-1', type: 'fs-watcher', data: { command: { op: 'createDirectory', path: p, at: '' } } }); });
    ['shell/desk/desk.js', 'shell/deskDetails/deskDetails.js'].forEach(function (p) { jobsWire.onUpdate({ id: 'fs-watcher-1', type: 'fs-watcher', data: { command: { op: 'createFile', path: p, at: '' } } }); });
    jobsWire.onUpdate({ id: 'fs-watcher-1', type: 'fs-watcher', data: { treeComplete: true } });
  }
  stream();
  desk.publish = function (app) {
    deskJob = Object.assign({}, deskJob, { app: app });
    jobsWire.onUpdate(deskJob);
  };

  const scriptFor = function (id) { return doc.body.children.filter(function (c) { return c.tag === 'script' && c.getAttribute('data-app-id') === id; }); };
  // The browser running an injected script: activateApp with the script as document.currentScript, then onload.
  function run(script, evaluate) {
    doc.currentScript = script;
    evaluate();
    doc.currentScript = null;
    script.onload();
  }

  // The Desk app, stand-in: it mounts, keeps its api, and opens a row as deskOpenRow does (desk.js:1097-1105).
  let deskApi = null;
  shellSpirit.shell.launchApp('shell/desk');
  run(scriptFor('shell/desk')[0], function () {
    shellSpirit.shell.activateApp({ mount: function (el, api) { deskApi = api; }, render: function () {} });
  });
  const opens = [];   // every open() the shell called on the dialog, with its params
  function openRow(id) {
    deskApi.callDialog(DD, { id: id }).then(function (result) { if (result && result.open) openRow(result.open); });
    const pending = scriptFor(DD).filter(function (s) { return !s.ran; });
    pending.forEach(function (script) {
      script.ran = true;
      run(script, function () {
        // The real deskDetails.js, evaluated as the page evaluates it. Its behaviour goes to the real activateApp; open
        // is only counted on the way, so the suite can say whether the shell called it.
        const real = shellSpirit.shell.activateApp;
        const counting = { activateApp: function (behavior) {
          const open = behavior.open;
          behavior.open = function (params) { opens.push(params && params.id); return open.apply(this, arguments); };
          return real(behavior);
        } };
        new Function('spirit', 'document', 'window', fs.readFileSync(DETAILS, 'utf8'))(
          { shell: Object.assign({}, shellSpirit.shell, counting), core: kernel.core }, doc, win);
      });
    });
  }

  return {
    doc: doc,
    opens: opens,
    scripts: function () { return scriptFor(DD).length; },
    openRow: openRow,
    back: function () { shellSpirit.shell.goBack(); },
    stream: stream,
    stack: function () { return shellSpirit.shell.navStackIds(); },
    title: function () { return doc.getElementById('app-title').textContent; },
    buttons: function () { return doc.getElementById('dd-name-row').innerHTML; },
    // The box is the panel every open shows first (#dd-panel, goal/G30.8; #dd-box before it).
    box: function () { return doc.getElementById('dd-panel').innerHTML; },
    press: function (button) { doc.getElementById('dd-body').fire('click', clickOn(button)); },
  };
}

const codeShown = function (html) { const m = /id="dd-code">(Code[^<]*)</.exec(html); return m ? m[1] : null; };

// His sequence: open A's dialog, leave it, (the stream comes back), open B's, press Code twice and Go, then the desk
// publishes a change to A and a change to B. Each claim is one check, so the red names exactly what goes wrong.
async function sequence(label, reconnect, owed) {
  const fail = function (what, detail) { test.fail(owed + what, detail); };
  const desk = deskStandIn();
  const page = bootPage(desk);

  page.openRow(A);
  await settled();
  if (page.title().indexOf(A + ' — First') === 0 && codeShown(page.buttons()) === 'Code ✓') test.check(label + ': the world: A\'s dialog shows A, with Code ✓');
  else { test.fail(label + ': the world did not land: title ' + short(page.title()) + ', code ' + short(codeShown(page.buttons()))); return; }

  page.back();
  if (reconnect) page.stream();   // his node restarted: the page stream comes back with the tree and treeComplete
  page.openRow(B);
  await settled();
  if (page.scripts() === 1 && page.stack().join(',') === 'desktop,shell/desk,shell/deskDetails') test.check(label + ': B\'s dialog is on screen, over the Desk, from the one script');
  else test.fail(label + ': stack ' + short(page.stack()) + ', scripts ' + page.scripts());

  if (page.opens[page.opens.length - 1] === B) test.check(label + ': the shell called the dialog\'s open() for B');
  else fail(label + ': the shell did not call open() for B; the opens it made: ' + short(page.opens) + ' (declareDynamicApp drops `open` on a re-declare, shell.js:2815-2848)');

  if (page.title().indexOf(B + ' — Second') === 0) test.check(label + ': the title names B');
  else fail(label + ': B\'s dialog is titled ' + short(page.title()));
  if (codeShown(page.buttons()) === 'Code') test.check(label + ': the facts drawn are B\'s: Code unchecked, as the desk has it');
  else fail(label + ': B\'s dialog shows ' + short(codeShown(page.buttons())) + ' while the desk has B unchecked (the facts drawn are not B\'s)');
  if (/the box of goal\/G100\.2/.test(page.box())) test.check(label + ': the box drawn is B\'s');
  else fail(label + ': B\'s dialog shows the box ' + short(page.box().replace(/<[^>]+>/g, '').slice(0, 80)));

  desk.presses.length = 0;
  page.press('dd-code');
  await settled();
  page.press('dd-code');
  await settled();
  const coded = desk.presses.slice();
  if (coded.length === 2 && coded.every(function (p) { return p.id === B && p.what === 'code'; })) test.check(label + ': Code pressed twice in B\'s dialog pressed B, twice');
  else fail(label + ': Code pressed twice in B\'s dialog went to ' + short(coded));
  // A press is made only on a button the dialog drew: B offers Go; a dialog drawing another item's buttons has none.
  desk.presses.length = 0;
  if (/id="dd-go"/.test(page.buttons())) { page.press('dd-go'); await settled(); }
  if (desk.presses.length === 1 && desk.presses[0].id === B && desk.presses[0].what === 'go') test.check(label + ': Go, which B offers, is drawn and presses B');
  else fail(label + ': B offers Go; the dialog drew [' + page.buttons().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() + '] and Go pressed ' + short(desk.presses));
  const all = coded.concat(desk.presses);
  if (all.every(function (p) { return p.id !== A; })) test.check(label + ': nothing pressed in B\'s dialog reached A');
  else fail(label + ': presses made in B\'s dialog reached A: ' + short(all.filter(function (p) { return p.id === A; })));

  desk.changed(A, { title: 'First, renamed' });
  await settled();
  if (page.title().indexOf('First, renamed') === -1) test.check(label + ': a change to A does not redraw B\'s dialog as A');
  else fail(label + ': a change to A redrew B\'s dialog as A: ' + short(page.title()));

  desk.changed(B, { title: 'Second, renamed', code: true });
  await settled();
  if (page.title().indexOf(B + ' — Second, renamed') === 0 && codeShown(page.buttons()) === 'Code ✓') test.check(label + ': a change to B redraws B\'s dialog, title and Code ✓');
  else fail(label + ': a change to B left the dialog at ' + short(page.title()) + ', ' + short(codeShown(page.buttons())));
}

test.startTest('goal/G24.7: the item dialog follows the item it is opened on');

(async function () {
  test.subHeading('1. A, then B, on one page stream: the dialog follows B (deskDetails.js on its own is right)');
  await sequence('one stream', false, 'deskDetails.js: ');

  test.subHeading('2. A, then B, after the page stream came back (his node restarted): Andy\'s two misdirected Code presses');
  await sequence('after a reconnect', true, OWED);
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
});

module.exports = test;
