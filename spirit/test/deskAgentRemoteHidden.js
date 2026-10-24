'use strict';

// spirit/test/deskAgentRemoteHidden.js
// goal/G18.1: deskAgentRemote stays visible over every app. Red on today's code (af47872a); claude-windows wrote it
// and builds it. Andy, 2026-10-12: "This is NOT good, every panel in desk and desk details now shows the
// deskAgentRemote. Needs fixing ASAP", and "let's do that before anything else."
//
// THE CAUSE: the shell hides the app it leaves with _el.hidden = true (shell.js switchTo); the Remote's mount set
// container.style.display = 'flex', and an inline display beats the hidden attribute, so the Remote showed under every
// app once opened.
//
// WHAT IS ASSERTED: after mount, the container the shell hands an app carries no display of its own, in the Remote and
// in every shell app, so hidden hides it; the Remote's frame still lays out as a column, on an inner wrapper.
// rule/11: through testSupport only.

const fs = require('fs');
const vm = require('vm');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/spirit/kernel.js');

const OWED = 'OWED by goal/G18.1: ';
const SHELL = path.join(__dirname, '..', 'run', 'shell');
const APP = path.join(SHELL, 'deskAgentRemote', 'deskAgentRemote.js');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function settle() { return new Promise(function (r) { setImmediate(r); }); }
function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, disabled: false, style: {}, listeners: {}, className: '', scrollTop: 0, scrollHeight: 0,
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function () { return null; }, setAttribute: function () {}, focus: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}

test.startTest('goal/G18.1: an app the shell hides stays hidden');

(async function () {
  test.subHeading('1. no shell app sets a display on the container it is handed');
  const offenders = [];
  fs.readdirSync(SHELL).forEach(function (name) {
    const file = path.join(SHELL, name, name + '.js');
    if (!fs.existsSync(file)) return;
    fs.readFileSync(file, 'utf8').split('\n').forEach(function (l, i) {
      if (/^\s*\/\//.test(l)) return;
      if (/\bcontainer\.style\.(display|cssText)\s*=/.test(l)) offenders.push(name + '.js:' + (i + 1));
    });
  });
  if (!offenders.length) test.check('no app sets container.style.display or cssText, so the shell\'s hidden holds');
  else test.fail(OWED + 'set on the container: ' + offenders.join(', '));

  test.subHeading('2. the Remote mounted: its container carries no display, its frame is still a column');
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  let behavior = null;
  const ctx = { spirit: { shell: { activateApp: function (a) { behavior = a; } }, core: kernel.core }, document: doc, window: {}, console: console, setTimeout: setTimeout, clearTimeout: clearTimeout };
  ctx.window = ctx;
  vm.runInNewContext(fs.readFileSync(APP, 'utf8'), ctx, { filename: APP });
  const container = fakeElement('container');
  behavior.mount(container, {
    escapeHtml: kernel.core.util.escapeHtml, onPublished: function () {}, fs: { loadFile: function () { return null; } },
    verb: function () { return Promise.resolve({ status: 200, body: {} }); },
  });
  for (let i = 0; i < 6; i++) { await settle(); await sleep(10); }
  container.hidden = true;
  if (!container.style.display) test.check('the container has no inline display: hidden = true hides it');
  else test.fail(OWED + 'the container\'s style.display is ' + JSON.stringify(container.style.display));
  if (/^<div[^>]*style="[^"]*display:\s*flex[^"]*flex-direction:\s*column/.test(container.innerHTML)) test.check('the frame lays out as a column on an inner wrapper');
  else test.fail(OWED + 'the frame begins ' + JSON.stringify(container.innerHTML.slice(0, 120)));
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
