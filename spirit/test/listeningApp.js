'use strict';

// AN APP THAT LISTENS IS MOUNTED AT PAGE LOAD, AND MISSES NOTHING.
//
//   Andy, 2026-09-27: "they must keep their own logs", then "lets do it
//   all" on the question of whether Desk mounts at page load.
//
// The node counts a packet delivered once any page takes it
// (arrivals.js), and the shell dropped a packet for an app that had not
// mounted yet. So an app that keeps its own log (Desk) lost whatever came
// before it was opened, the node's replayed backlog included. A manifest
// may now say `"listens": ["agents"]`, and the shell:
//
//   - loads that app's script at page load and mounts it into a hidden pane;
//   - holds a packet for a listed name until the app's handler subscribes,
//     then hands them over, in order, once;
//   - still drops a packet for a name nobody listens for;
//   - loads the script once, even when the app is opened while it loads.
//
// Driven the way clientLayer.js drives the real shell.js: small document,
// fs and jobs stubs, with the script "load" fired by hand.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel');
const packet = require('../run/js/client/packet');

const SHELL = path.join(__dirname, '..', 'run', 'js', 'client', 'shell.js');

function fakeElement(tag) {
  let html = '';
  const attrs = {};
  const el = {
    tag: tag, className: '', textContent: '', hidden: false, style: {}, children: [],
    appendChild: function (child) { el.children.push(child); return child; },
    addEventListener: function () {},
    querySelector: function () { return fakeElement('div'); },
    querySelectorAll: function () { return []; },
    setAttribute: function (k, v) { attrs[k] = String(v); },
    getAttribute: function (k) { return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null; },
    remove: function () {},
  };
  Object.defineProperty(el, 'innerHTML', {
    get: function () { return html; },
    set: function (v) { html = String(v); el.children.length = 0; },
    enumerable: true,
  });
  return el;
}

const DESK_MANIFEST = { name: 'Desk', icon: 'THREAD', hidden: false, intrinsic: true, listens: ['agents'] };

function bootShell(manifest) {
  const byId = {};
  ['desktop', 'app-container', 'app-title', 'app-content', 'app-close', 'app-home']
    .forEach(function (id) { byId[id] = fakeElement('div'); });
  const doc = {
    body: fakeElement('body'),
    currentScript: null,
    getElementById: function (id) { return byId[id] || (byId[id] = fakeElement('div')); },
    createElement: fakeElement,
    createDocumentFragment: function () { return fakeElement('fragment'); },
  };
  const subscribers = [];
  const shellSpirit = {
    core: {
      ask: test.browserAsk(function () { return Promise.resolve({ status: 200, text: function () { return Promise.resolve('{}'); } }); }),
      const: { ICON: kernel.core.const.ICON, MIME: {} },
      util: { escapeHtml: function (s) { return String(s); }, formatBytes: function () { return ''; } },
      fs: {
        loadFile: function (rel) {
          if (rel === 'preferences.json') return JSON.stringify({ apps: {}, groups: {} });
          if (rel === 'app/natter/session.json') return JSON.stringify({ label: 'me', boundAt: '2026-09-13T00:00:00.000Z' });
          if (rel === 'app/desk/desk.json') return JSON.stringify(manifest);
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
  new Function('spirit', 'document', 'fetch', 'window', fs.readFileSync(SHELL, 'utf8'))(
    shellSpirit, doc, function () {}, { spiritPacket: packet });
  const wired = subscribers.filter(function (h) { return typeof h.onPacket === 'function'; })[0];
  const scripts = function () { return doc.body.children.filter(function (c) { return c.tag === 'script'; }); };
  return {
    shell: shellSpirit.shell,
    doc: doc,
    scripts: scripts,
    content: byId['app-content'],
    arrive: function (app, body, hash) {
      wired.onPacket({ hash: hash, fromKey: 'K', text: packet.encode(app, body).text, sentAt: '2026-09-27T06:00:00Z' });
    },
    // The browser running the injected script: it calls activateApp with
    // itself as document.currentScript, then fires onload.
    load: function (script, behavior) {
      doc.currentScript = script;
      shellSpirit.shell.activateApp(behavior);
      doc.currentScript = null;
      script.onload();
    },
  };
}

test.startTest('An app that listens is mounted at page load, and misses nothing');

test.subHeading('The script loads at page load, before anyone opens the app');
(function () {
  const page = bootShell(DESK_MANIFEST);
  const s = page.scripts();
  if (s.length === 1 && /app\/desk\/desk\.js$/.test(s[0].src) && s[0].getAttribute('data-app-id') === 'app/desk') {
    test.check('Desk\'s script was injected at boot, stamped with its id');
  } else {
    test.fail('scripts at boot: ' + JSON.stringify(s.map(function (x) { return x.src; })));
  }
  const quiet = bootShell({ name: 'Desk', icon: 'THREAD', hidden: false, intrinsic: true });
  if (!quiet.scripts().length) test.check('an app that declares no `listens` is still loaded only when opened');
  else test.fail('a non-listening app was loaded at boot');
})();

test.subHeading('What arrives before it mounts is held, then handed over once, in order');
(function () {
  const page = bootShell(DESK_MANIFEST);
  page.arrive('agents', { text: 'first' }, 'h1');
  page.arrive('agents', { text: 'second' }, 'h2');
  page.arrive('chess', { move: 'e4' }, 'h3');
  const got = [];
  let mounts = 0;
  let pane = null;
  page.load(page.scripts()[0], {
    mount: function (el, api) {
      mounts += 1;
      pane = el;
      api.onPacket('agents', function (body, message) { got.push(body.text + '@' + message.hash); });
      api.onPacket('chess', function (body) { got.push('chess:' + body.move); });
    },
  });
  if (got.join(',') === 'first@h1,second@h2') {
    test.check('both held packets reached the handler, in arrival order, with their hashes');
  } else {
    test.fail('handler got ' + JSON.stringify(got));
  }
  if (pane && pane.hidden === true && page.content.children.indexOf(pane) !== -1 && mounts === 1) {
    test.check('it mounted once, into a hidden pane in the page');
  } else {
    test.fail('pane ' + JSON.stringify(pane && { hidden: pane.hidden }) + ' mounts ' + mounts);
  }
  if (got.indexOf('chess:e4') === -1) test.check('a packet for a name nobody listens for was dropped, not held');
  else test.fail('an unlisted packet was held');

  page.arrive('agents', { text: 'third' }, 'h4');
  if (got.join(',') === 'first@h1,second@h2,third@h4') test.check('a live arrival afterwards goes straight to the handler, and nothing is handed over twice');
  else test.fail('after a live arrival the handler got ' + JSON.stringify(got));

  // Opening it now shows the pane it already has.
  page.shell.launchApp('app/desk');
  if (mounts === 1 && pane.hidden === false && page.scripts().length === 1) test.check('opening it shows that pane: no second script, no second mount');
  else test.fail('open after background mount: mounts ' + mounts + ' hidden ' + pane.hidden + ' scripts ' + page.scripts().length);
})();

test.subHeading('Opened while its script is still loading: one load, one mount');
(function () {
  const page = bootShell(DESK_MANIFEST);
  page.shell.launchApp('app/desk');
  let mounts = 0;
  if (page.scripts().length === 1) test.check('the open waited for the load already in flight');
  else test.fail('opening during the load injected ' + page.scripts().length + ' scripts');
  page.load(page.scripts()[0], { mount: function () { mounts += 1; } });
  if (mounts === 1) test.check('and the app mounted exactly once');
  else test.fail('mounted ' + mounts + ' times');
})();

test.subHeading('What is held is bounded');
(function () {
  const page = bootShell(DESK_MANIFEST);
  for (let i = 0; i < 510; i += 1) page.arrive('agents', { n: i }, 'h' + i);
  const got = [];
  page.load(page.scripts()[0], { mount: function (el, api) { api.onPacket('agents', function (body) { got.push(body.n); }); } });
  if (got.length === 500 && got[0] === 10 && got[499] === 509) test.check('past 500 the oldest goes first, so a script that never loads cannot grow the page without end');
  else test.fail('held ' + got.length + ' from ' + got[0] + ' to ' + got[got.length - 1]);
})();

test.reportSuccessFailureCount();

module.exports = test;
