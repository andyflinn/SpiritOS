'use strict';

// desk/G3.5: dialogs close with a black X at the right of the title bar.
//   Andy: "I now want the dialog to show a black closing X in the app titlebar at the very right side, with the exact
//   same function as the back arrow had, and drop the back arrow on the left. for dialogs." "The reason: when i exit
//   out of i dialog, i don't want my mouse pointer to be right on top of the back-button for the app."
// The contract the builder follows (claude-windows's picks where the box names no shape):
//   index.html's #app-header ends with <button id="app-dialog-close" title="Close">, after #app-title, so it sits at
//   the far right. With a dialog on top the shell hides #app-close (display none) and shows #app-dialog-close; a
//   click on it does what Back did (goBack: the dialog pops and its caller's promise settles). With an app on top,
//   #app-close shows as before and #app-dialog-close is hidden. Home is not touched.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');
const packet = require('../run/js/client/packet');

const OWED = 'OWED by desk/G3.5: ';
const SHELL = path.join(__dirname, '..', 'run', 'js', 'client', 'shell.js');
const INDEX = path.join(__dirname, '..', 'run', 'index.html');

function fakeElement(tag) {
  let html = '';
  const el = {
    tag: tag, className: '', textContent: '', hidden: false, style: {}, children: [], listeners: {},
    appendChild: function (child) { el.children.push(child); return child; },
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type) { (el.listeners[type] || []).forEach(function (fn) { fn({ preventDefault: function () {} }); }); },
    querySelector: function () { return fakeElement('div'); },
    querySelectorAll: function () { return []; },
    setAttribute: function () {}, removeAttribute: function () {}, remove: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); el.children.length = 0; }, enumerable: true });
  return el;
}
function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }

test.startTest('desk/G3.5: a dialog closes with an X at the right of the title bar');

test.subHeading('the X is in the title bar, after the title, so at the far right');
const html = fs.readFileSync(INDEX, 'utf8');
const header = (html.match(/<div id="app-header">[\s\S]*?<\/div>\s*<div id="app-content">/) || [''])[0];
const titleAt = header.indexOf('id="app-title"');
const xAt = header.search(/<button[^>]*id="app-dialog-close"/);
if (xAt !== -1 && titleAt !== -1 && xAt > titleAt && /id="app-dialog-close"[^>]*title="Close"|title="Close"[^>]*id="app-dialog-close"/.test(header)) {
  test.check('#app-dialog-close, titled Close, comes after #app-title in #app-header');
} else test.fail(OWED + 'no #app-dialog-close after #app-title in #app-header: ' + JSON.stringify(header.replace(/\s+/g, ' ').slice(0, 300)));

// The real shell.js on a fake document (as clientLayer.js mounts it).
const byId = {};
['desktop', 'app-container', 'app-title', 'app-content', 'app-close', 'app-home', 'app-dialog-close']
  .forEach(function (id) { byId[id] = fakeElement('div'); });
const doc = {
  body: fakeElement('body'),
  getElementById: function (id) { return byId[id] || (byId[id] = fakeElement('div')); },
  createElement: fakeElement,
  createDocumentFragment: function () { return fakeElement('fragment'); },
};
const fakeFetch = function () { return Promise.resolve({ status: 200, text: function () { return Promise.resolve('{}'); }, json: function () { return Promise.resolve({}); } }); };
const shellSpirit = {
  core: {
    ask: test.browserAsk(fakeFetch),
    const: { ICON: kernel.core.const.ICON, MIME: {} },
    util: { escapeHtml: function (s) { return String(s); }, formatBytes: function () { return ''; } },
    fs: {
      loadFile: function (rel) {
        if (rel === 'preferences.json') return JSON.stringify({ apps: {}, groups: {} });
        if (rel === 'shell/natter/session.json') return JSON.stringify({ label: 'me', boundAt: '2026-09-13T00:00:00.000Z' });
        return null;
      },
      saveFile: function () { return Promise.resolve(); }, statFile: function () { return null; },
      getAnnotations: function () { return {}; }, createScopedFs: function () { return {}; },
    },
    jobs: { subscribe: function () {} },
  },
};
new Function('spirit', 'document', 'fetch', 'window', fs.readFileSync(SHELL, 'utf8'))(shellSpirit, doc, fakeFetch, { spiritPacket: packet });

let hostApi = null;
shellSpirit.shell.registerApp({ id: 'host', name: 'Host', icon: 'FILE', mount: function (el, api) { hostApi = api; }, render: function () {} });
shellSpirit.shell.registerApp({ id: 'dlg', name: 'Dialog', icon: 'FILE', type: 'dialog', mount: function () {}, open: function () {}, render: function () {} });

const back = byId['app-close'];
const x = byId['app-dialog-close'];
const shown = function (el) { return el.style.display !== 'none' && !el.hidden; };

(async function () {
  shellSpirit.shell.launchApp('host');
  await settle();
  test.subHeading('an app on top: Back as before, no X');
  if (shown(back) && !shown(x)) test.check('with an app on top, Back shows and the X is hidden');
  else test.fail(OWED + 'with an app on top: Back shown ' + shown(back) + ', X shown ' + shown(x));

  test.subHeading('a dialog on top: no Back, the X instead');
  let settled = false;
  const answer = hostApi.callDialog('dlg', {}).then(function () { settled = true; });
  await settle();
  if (!shown(back) && shown(x)) test.check('with a dialog on top, Back is hidden and the X shows');
  else test.fail(OWED + 'with a dialog on top: Back shown ' + shown(back) + ', X shown ' + shown(x));

  test.subHeading('the X does what Back did');
  x.fire('click');
  await settle();
  await Promise.race([answer, settle()]);
  if (settled && shown(back) && !shown(x)) test.check('a click on the X closes the dialog, settles its caller, and Back returns');
  else test.fail(OWED + 'after a click on the X: caller settled ' + settled + ', Back shown ' + shown(back) + ', X shown ' + shown(x));
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
