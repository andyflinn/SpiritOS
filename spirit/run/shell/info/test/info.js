'use strict';

// spirit/run/shell/info/test/info.js
// The tests of shell/info/info.js, and of no other module (spec: ./info.md; goal/G41.6). The browser file runs in node on
// a window of its own: its two field elements, the two forms, the relay family and the node are stubs that keep what the
// app asked of them.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'info.js');
const SRC = fs.readFileSync(FILE, 'utf8');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 20; i++) await tick(); };

// A node whose markup makes a child per tag; found by [attr="value"].
function node(tag) {
  const heard = {}; let html = '';
  const n = { tag: tag || '', nodes: [], value: '', className: '', textContent: '', hidden: false, style: {}, isConnected: true,
    get innerHTML() { return html; },
    set innerHTML(v) {
      html = String(v); n.nodes = [];
      const re = /<([a-z]+)\b([^>]*)>/gi; let m;
      while ((m = re.exec(html))) n.nodes.push(node(m[0]));
    },
    getAttribute: function (k) { const m = new RegExp('\\s' + k + '="([^"]*)"').exec(n.tag); return m ? m[1] : null; },
    querySelector: function (sel) {
      const a = /^\[([\w-]+)="([^"]*)"\]$/.exec(sel);
      return a ? n.nodes.filter(function (c) { return c.getAttribute(a[1]) === a[2]; })[0] || null : null;
    },
    addEventListener: function (t, fn) { (heard[t] = heard[t] || []).push(fn); },
    fire: function (t, e) { (heard[t] || []).slice().forEach(function (fn) { fn(e || {}); }); },
  };
  return n;
}

const ROWS = [
  { url: 'https://a.example', label: 'A', claimed: true, claimedLabel: 'Old', roll: { relayKey: 'RA' } },
  { url: 'https://b.example', label: 'B', claimed: false },
];

function world() {
  const w = { required: [], made: {}, sets: [], forms: [], calls: [], posts: [], dialogs: [], def: null, subs: [] };
  function field(kind) {
    return { create: function (host, opts) { const el = { host: host, opts: opts, set: function (v) { w.sets.push({ kind: kind, value: v }); }, destroy: function () {} };
      w.made[kind] = el; return el; } };
  }
  const E = {
    changeMyLabel: field('label'),
    changeMyDescription: field('description'),
    joinForm: { mount: function (host, o) { w.forms.push({ form: 'join', host: host, o: o }); } },
    faceForm: { mount: function (host, o) { w.forms.push({ form: 'face', host: host, o: o }); } },
  };
  const api = {
    escapeHtml: function (s) { return String(s); },
    verb: function (name, args) { w.calls.push({ name: name, args: args });
      if (name === 'node.card') return Promise.resolve({ status: 200, body: { ok: true, name: 'Andy', description: 'a node' } });
      return Promise.resolve({ status: 200, body: { ok: true } }); },
    peerPost: function (app, key, body) { w.posts.push({ app: app, key: key, body: body }); return Promise.resolve({ ok: true, body: { ok: true } }); },
    callDialog: function (id, p) { w.dialogs.push(id); },
  };
  const win = {
    spirit: { elements: E,
      require: function (p) { w.required.push(String(p)); return Promise.resolve(true); },
      relay: { status: function () { return Promise.resolve({ body: { rows: ROWS } }); } },
      events: { subscribe: function (h) { w.subs.push(h); return function () {}; } },
      shell: { activateApp: function (d) { w.def = d; } } },
    document: { getElementById: function () { return null; }, createElement: function (t) { return node('<' + t + '>'); } },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String,
    console: { log: function () {}, error: function () {} },
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(SRC, win, { filename: FILE });
  w.api = api;
  return w;
}

test.startTest('info.js: the Info app');

(async function () {
  test.subHeading('"What each relay calls you" is dropped, its code with it (Andy, 2026-10-27)');
  ok(!/What each relay calls you/.test(SRC), 'its words are gone', 'info.js still says "What each relay calls you"');
  ok(!/infoDrawRelays|infoPush|infoPushed|rename\s*:/.test(SRC), 'its table, its push of the name to every relay and its rename are deleted', 'info.js still holds the relay table or the rename');

  const w = world();
  ok(w.def && typeof w.def.mount === 'function', 'it mounts through spirit.shell.activateApp', 'no activateApp with mount');
  if (!w.def) return;

  test.subHeading('it loads what it uses itself (goal/G41.3)');
  ['shell/js/changeMyLabel.js', 'shell/js/changeMyDescription.js', 'shell/js/joinForm.js', 'shell/js/faceForm.js'].forEach(function (p) {
    ok(w.required.indexOf(p) !== -1, 'it requires ' + p, 'required: ' + short(w.required));
  });

  const box = node('container');
  await w.def.mount(box, w.api); await settle();
  ok(!/What each relay calls you/.test(box.innerHTML), 'its page draws no relay table', 'markup: ' + short(box.innerHTML));

  test.subHeading('its two blocks are the two shell elements, filled from the node\'s card');
  ok(!!w.made.label && w.made.label.opts.api === w.api, 'the name block is changeMyLabel, handed the app\'s api', 'made: ' + short(Object.keys(w.made)));
  ok(!!w.made.description && w.made.description.opts.api === w.api, 'the description block is changeMyDescription', 'made: ' + short(Object.keys(w.made)));
  ok(w.calls.some(function (c) { return c.name === 'node.card'; }), 'it reads node.card', 'calls: ' + short(w.calls.map(function (c) { return c.name; })));
  ok(w.sets.some(function (s) { return s.kind === 'label' && s.value === 'Andy'; }) && w.sets.some(function (s) { return s.kind === 'description' && s.value === 'a node'; }),
    'each element is set to what the node stored', 'sets: ' + short(w.sets));
  if (w.made.label && typeof w.made.label.opts.onSaved === 'function') { w.made.label.opts.onSaved('Bob'); await settle(); }
  ok(w.posts.length === 0, 'a saved name is no longer posted to every relay', 'posts: ' + short(w.posts));

  test.subHeading('the two forms and the key rotation stay');
  const join = w.forms.filter(function (f) { return f.form === 'join'; }).pop();
  const face = w.forms.filter(function (f) { return f.form === 'face'; }).pop();
  ok(!!join && !!face, 'the email form and the face form are drawn', 'forms: ' + short(w.forms.map(function (f) { return f.form; })));
  ok(join && join.o.relays.length === 1 && join.o.relays[0].url === 'https://a.example', 'over the relays this node holds a seat on', 'relays: ' + short(join && join.o.relays));
  const rotate = box.querySelector('[data-info="rotate"]');
  ok(!!rotate, 'it has the Rotate key button', 'markup: ' + short(box.innerHTML));
  if (rotate) { rotate.fire('click'); ok(w.dialogs[0] === 'shell/rotateKey', 'which opens the Rotate key page', 'dialogs: ' + short(w.dialogs)); }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
