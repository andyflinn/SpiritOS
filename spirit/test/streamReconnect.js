'use strict';

// THE PAGE HEARS AGAIN AFTER ITS NODE RESTARTS.
//   Andy, 2026-09-30, cut off from both agents after his node restarted for a tag: "why don't you respond on desk?
//   this should work without a hickup." and "do it. i can't tell you from desk". His Desk page kept sending (its
//   writes are requests) and heard nothing: the page's one event stream (kernel.js jobs.subscribe) had closed, and
//   nothing reopened it or said so.
// The contract:
//   Kernel  jobs.subscribe reports the stream down (handlers.onConnection(false)) on an error, reopens it itself if
//           the browser has given up on it (readyState CLOSED), and on the first open after being down calls
//           handlers.onConnection(true) and handlers.onReconnect(). Still one EventSource made in the file.
//   Shell   while down, #app-offline shows; an app can ask api.onReconnect(fn) and is called once it is back.
//   Desk    on reconnect asks items.search and its chats again, so what was missed is drawn.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');
const packet = require('../run/js/client/packet');

const KERNEL = path.join(__dirname, '..', 'run', 'js', 'kernel.js');
const SHELL = path.join(__dirname, '..', 'run', 'js', 'client', 'shell.js');
const DESK = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const INDEX = path.join(__dirname, '..', 'run', 'index.html');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }

test.startTest('the page hears again after its node restarts');

(async function () {
  test.subHeading('the kernel reopens a stream the browser gave up on, and says so');
  const made = [];
  function FakeSource(url) {
    const self = this;
    self.url = url; self.readyState = 0; self.listeners = {};
    self.addEventListener = function (t, fn) { (self.listeners[t] = self.listeners[t] || []).push(fn); };
    self.close = function () { self.readyState = 2; };
    made.push(self);
  }
  const win = {};
  new Function('process', 'window', 'EventSource', 'XMLHttpRequest', 'document', fs.readFileSync(KERNEL, 'utf8'))(
    undefined, win, FakeSource, function () {}, { addEventListener: function () {} });
  const seen = [];
  const base = made.length;
  win.spirit.core.jobs.subscribe({
    onConnection: function (up) { seen.push(up ? 'up' : 'down'); },
    onReconnect: function () { seen.push('reconnect'); },
  });
  const first = made[base];
  if (first && first.onopen) first.onopen();
  // The node restarts: the browser reports an error and gives up.
  first.readyState = 2;
  if (first.onerror) first.onerror({});
  await sleep(2600);
  const second = made[base + 1];
  if (second && second.onopen) second.onopen();
  if (made.length === base + 2 && seen.indexOf('down') !== -1 && seen.slice(-2).join(',') === 'up,reconnect') test.check('a closed stream is reopened; down, then up and reconnect are reported');
  else test.fail('streams made ' + (made.length - base) + ', reported ' + JSON.stringify(seen));
  const src = fs.readFileSync(KERNEL, 'utf8');
  if ((src.match(/\bnew\s+EventSource\b/g) || []).length === 1) test.check('kernel.js still makes one EventSource');
  else test.fail('kernel.js now has ' + (src.match(/\bnew\s+EventSource\b/g) || []).length + ' EventSource constructions');

  test.subHeading('the shell shows the stream down, and hands apps the reconnect');
  if (/<[^>]*id="app-offline"[^>]*hidden/.test(fs.readFileSync(INDEX, 'utf8'))) test.check('index.html has #app-offline, hidden at first');
  else test.fail('index.html has no hidden #app-offline');
  const byId = {};
  function el(id) {
    let html = '';
    const e = { id: id, hidden: false, textContent: '', style: {}, className: '', children: [], listeners: {},
      appendChild: function (c) { e.children.push(c); return c; }, remove: function () {},
      addEventListener: function (t, fn) { (e.listeners[t] = e.listeners[t] || []).push(fn); },
      querySelector: function () { return el('q'); }, querySelectorAll: function () { return []; }, setAttribute: function () {}, removeAttribute: function () {} };
    Object.defineProperty(e, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); } });
    return e;
  }
  const doc = { body: el('body'), getElementById: function (id) { return byId[id] || (byId[id] = el(id)); },
    createElement: el, createDocumentFragment: function () { return el('f'); } };
  doc.getElementById('app-offline').hidden = true;
  let handlers = null;
  const fakeFetch = function () { return Promise.resolve({ status: 200, text: function () { return Promise.resolve('{}'); }, json: function () { return Promise.resolve({}); } }); };
  const shellSpirit = { core: {
    ask: test.browserAsk(fakeFetch), const: { ICON: kernel.core.const.ICON, MIME: {} },
    util: { escapeHtml: function (s) { return String(s); }, formatBytes: function () { return ''; } },
    fs: { loadFile: function (rel) {
      if (rel === 'preferences.json') return JSON.stringify({ apps: {}, groups: {} });
      if (rel === 'shell/natter/session.json') return JSON.stringify({ label: 'me', boundAt: '2026-09-13T00:00:00.000Z' });
      return null; }, saveFile: function () { return Promise.resolve(); }, statFile: function () { return null; },
      getAnnotations: function () { return {}; }, createScopedFs: function () { return {}; } },
    jobs: { subscribe: function (h) { handlers = h; } } } };
  new Function('spirit', 'document', 'fetch', 'window', fs.readFileSync(SHELL, 'utf8'))(shellSpirit, doc, fakeFetch, { spiritPacket: packet });
  let api = null;
  shellSpirit.shell.registerApp({ id: 'hearer', name: 'Hearer', icon: 'FILE', mount: function (e, a) { api = a; }, render: function () {} });
  shellSpirit.shell.launchApp('hearer');
  await settle();
  let heard = 0;
  if (api && typeof api.onReconnect === 'function') api.onReconnect(function () { heard += 1; });
  if (handlers && handlers.onConnection) handlers.onConnection(false);
  const downShown = !doc.getElementById('app-offline').hidden;
  if (handlers && handlers.onConnection) handlers.onConnection(true);
  if (handlers && handlers.onReconnect) handlers.onReconnect();
  await settle();
  if (downShown && doc.getElementById('app-offline').hidden) test.check('#app-offline shows while the stream is down and hides once it is back');
  else test.fail('#app-offline shown while down ' + downShown + ', hidden after ' + doc.getElementById('app-offline').hidden);
  if (heard === 1) test.check('an app that asked api.onReconnect is called once the stream is back');
  else test.fail('api.onReconnect ' + (api && typeof api.onReconnect) + ', called ' + heard + ' times');

  test.subHeading('Desk asks again on reconnect');
  const asked = [];
  let reconnect = null;
  let b = null;
  const dById = {};
  const ddoc = { getElementById: function (id) { return dById[id] || (dById[id] = el(id)); } };
  new Function('spirit', 'document', 'window', fs.readFileSync(DESK, 'utf8'))({ shell: { activateApp: function (x) { b = x; } }, core: kernel.core }, ddoc, {});
  b.mount(el('c'), {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) { const a = body && body.ask && body.ask.desk; if (a) asked.push(Object.keys(a)[0]); return Promise.resolve({ status: 200, body: { items: [], more: false, json: '' } }); },
    onPublished: function () {}, onPacket: function () {}, onReconnect: function (fn) { reconnect = fn; },
    peerPost: function () { return Promise.resolve({ ok: true }); }, callDialog: function () { return new Promise(function () {}); },
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  await settle();
  const before = { s: asked.filter(function (v) { return v === 'items.search'; }).length, l: asked.filter(function (v) { return v === 'log.search'; }).length };
  if (reconnect) reconnect();
  await settle();
  const s2 = asked.filter(function (v) { return v === 'items.search'; }).length;
  const l2 = asked.filter(function (v) { return v === 'log.search'; }).length;
  if (reconnect && s2 === before.s + 1 && l2 > before.l) test.check('on reconnect Desk asks items.search and its chats again');
  else test.fail('Desk on reconnect: listened ' + !!reconnect + ', items.search ' + before.s + ' -> ' + s2 + ', log.search ' + before.l + ' -> ' + l2);
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
