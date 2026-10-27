'use strict';

// spirit/run/shell/textEditor/test/textEditor.js
// The tests of shell/textEditor/textEditor.js, and of no other module (spec: ./textEditor.md; goal/G41.7). The browser
// file runs in node on a window of its own: the files list, the codeMirror element and the node's files are recorders;
// the old shell's api.ui.elements is a trap that records any reach into it.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'textEditor.js');
const SRC = fs.readFileSync(FILE, 'utf8');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = async function () {
  for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); });
  await new Promise(function (r) { setTimeout(r, 10); });
};

// A node whose markup makes a child per element; an element with an id is found by getElementById.
const byId = {};
function node(tag) {
  const heard = {}; let html = '';
  const n = { tag: tag || '', textContent: '', kids: [],
    get innerHTML() { return html; },
    set innerHTML(v) {
      html = String(v);
      const re = /<([a-z]+)\b([^>]*)>/gi; let m;
      while ((m = re.exec(html))) { const id = /\sid="([^"]*)"/.exec(m[2]); if (id) byId[id[1]] = node(m[0]); }
    },
    appendChild: function (c) { n.kids.push(c); return c; },
    addEventListener: function (t, fn) { (heard[t] = heard[t] || []).push(fn); },
    fire: function (t, e) { (heard[t] || []).slice().forEach(function (fn) { fn(e || {}); }); },
    querySelector: function () { return null; }, querySelectorAll: function () { return []; },
  };
  return n;
}

const FILES = { 'shell/textEditor/notes.txt': 'my notes', 'docs/a.md': 'peerPost here\nand peerPost there', 'shell/x/data.json': '{}' };

function world(opts) {
  const o = opts || {};
  const w = { required: [], loaded: [], saved: [], pickers: [], views: [], reached: [], def: null };
  const files = {
    loadFile: function (p) { w.loaded.push(p); return Promise.resolve(p in FILES ? FILES[p] : null); },
    saveFile: function (p, c) { w.saved.push({ path: p, content: c }); return Promise.resolve(o.refuse ? { ok: false, reason: o.refuse } : { ok: true }); },
  };
  const E = {
    fileList: { create: function (host, args) { const p = { host: host, opts: args, said: 'peerPost', words: function () { return p.said; } }; w.pickers.push(p); return p; } },
    codeMirror: { create: function (host, args) {
      let value = String(args && args.text != null ? args.text : '');
      const v = { host: host, args: args, mode: args && args.mode, value: function () { return value; }, type: function (t) { value = t; } };
      w.views.push(v); return Promise.resolve(v);
    } },
  };
  const trap = new Proxy({}, { get: function (t, k) { w.reached.push(String(k)); return function () { return { value: function () { return ''; } }; }; } });
  const api = { escapeHtml: function (s) { return String(s).replace(/</g, '&lt;'); }, ui: { elements: trap } };
  const win = {
    document: { getElementById: function (id) { return byId[id] || null; }, createElement: function (t) { return node('<' + t + '>'); } },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number,
    console: { log: function () {}, error: function () {} },
  };
  win.window = win;
  win.spirit = {
    elements: E,
    fs: files,
    ready: Promise.resolve({ fs: files }),
    require: function (p) { w.required.push(String(p).replace(/^\/+/, '')); return Promise.resolve({}); },
    shell: { activateApp: function (d) { w.def = d; } },
    escapeHtml: api.escapeHtml,
  };
  vm.createContext(win);
  vm.runInContext(SRC, win, { filename: FILE });
  w.api = api;
  return w;
}
function lastView(w) { return w.views[w.views.length - 1] || null; }
function status() { return byId['editor-status'] ? byId['editor-status'].textContent : ''; }

test.startTest('textEditor.js: the TextEditor app, face-able');

(async function () {
  test.subHeading('nothing of the old shell (goal/G41.7)');
  const code = SRC.replace(/\/\/.*$/gm, '');
  ok(!/\.ui\.elements/.test(SRC), 'it takes its elements from what it loaded, not from the old shell\'s api.ui.elements', 'textEditor.js still reaches api.ui.elements');
  ok(!/createTextView|textView\.js/.test(SRC), 'it names no createTextView and no textView.js', 'textEditor.js still names createTextView or textView.js');
  ok(!/index\.html|discoverDynamicApps/.test(SRC), 'its comments speak of today\'s shells: no index.html, no discoverDynamicApps', 'textEditor.js still names index.html or discoverDynamicApps');
  ok(/spirit\.require/.test(code), 'it loads through spirit.require', 'no spirit.require in its code');

  const w = world();
  ok(w.def && typeof w.def.mount === 'function' && typeof w.def.loadFile === 'function', 'it mounts through spirit.shell.activateApp, with mount and loadFile', 'activateApp got ' + short(w.def && Object.keys(w.def)));
  if (!w.def) return;

  test.subHeading('it loads what it uses itself (goal/G41.3)');
  ['shell/js/files/listElement.js', 'shell/js/codeMirror.js'].forEach(function (p) {
    ok(w.required.indexOf(p) !== -1, 'it requires ' + p, 'required: ' + short(w.required));
  });

  test.subHeading('the starting file, in edit mode');
  await w.def.mount(node('container'), w.api, null); await settle();
  ok(w.loaded[0] === 'shell/textEditor/notes.txt', 'with no file handed over it opens shell/textEditor/notes.txt', 'loaded: ' + short(w.loaded));
  const v = lastView(w);
  ok(!!v && v.args.mode === 'edit', 'its text is drawn by codeMirror.create in edit mode', 'views: ' + short(w.views.map(function (x) { return x.args; })));
  if (v) ok(v.args.text === 'my notes' && v.args.path === 'shell/textEditor/notes.txt' && !v.args.words && !v.args.line, 'handed the file\'s text and path, no words, no line', 'args: ' + short(v.args));
  ok(v && v.host === byId['editor-content'], 'into the page\'s content box', 'host: ' + short(v && v.host && v.host.tag));
  ok(byId['editor-path'] && byId['editor-path'].textContent === 'shell/textEditor/notes.txt' && status() === 'loaded', 'the path is shown, the status says loaded', 'path ' + short(byId['editor-path'] && byId['editor-path'].textContent) + ', status ' + short(status()));
  ok(w.reached.length === 0, 'nothing of api.ui.elements is reached', 'reached: ' + short(w.reached));

  test.subHeading('Save writes what was typed, and says only what the node answered (rule/19)');
  if (v) v.type('my notes, edited');
  byId['editor-save'] && byId['editor-save'].fire('click');
  ok(status() === 'saving…', 'the status says saving… while the node is asked', 'status: ' + short(status()));
  await settle();
  ok(w.saved.length === 1 && w.saved[0].path === 'shell/textEditor/notes.txt' && w.saved[0].content === 'my notes, edited', 'fs.saveFile(the current path, the view\'s value())', 'saved: ' + short(w.saved));
  ok(status() === 'saved', 'then saved, once the node said ok', 'status: ' + short(status()));
  const r = world({ refuse: 'not writable' });
  await r.def.mount(node('container'), r.api, { path: 'shell/x/data.json' }); await settle();
  byId['editor-save'].fire('click'); await settle();
  ok(status() === 'save failed: not writable', 'a refusal is reported in the node\'s own words, never as saved', 'status: ' + short(status()));
  ok(r.loaded[0] === 'shell/x/data.json', 'a file handed over by Open with is the one opened', 'loaded: ' + short(r.loaded));
  const own = world();
  await own.def.mount(node('container'), own.api, { path: 'shell/textEditor/textEditor.js' }); await settle();
  byId['editor-save'].fire('click'); await settle();
  ok(own.saved.length === 0 && /refusing to save over an app's own source/.test(status()), 'an app\'s own script is refused before anything is asked', 'saved ' + short(own.saved) + ', status ' + short(status()));

  test.subHeading('a file the node does not have');
  const m = world();
  await m.def.mount(node('container'), m.api, { path: 'new/file.txt' }); await settle();
  const mv = lastView(m);
  ok(!!mv && mv.args.text === '' && mv.args.mode === 'edit' && /not found/.test(status()) && /Save to create it/.test(status()), 'opens empty and editable, the status saying Save will create it', 'view ' + short(mv && mv.args) + ', status ' + short(status()));

  test.subHeading('the picker: the files list as a dropdown');
  const p = world();
  await p.def.mount(node('container'), p.api, null); await settle();
  const pk = p.pickers[0];
  ok(!!pk && pk.opts.face === 'dropdown' && Array.isArray(pk.opts.accept) && pk.opts.accept.indexOf('text/') !== -1, 'the files list is made as a dropdown taking text types', 'pickers: ' + short(p.pickers.map(function (x) { return x.opts; })));
  if (pk && typeof pk.opts.pick === 'function') {
    pk.opts.pick({ kind: 'file', line: 2 }, 'docs/a.md'); await settle();
    const hit = lastView(p) || { args: {} };
    ok(p.loaded.indexOf('docs/a.md') !== -1 && hit.args.words === 'peerPost' && hit.args.line === 2 && hit.args.mode === 'edit', 'a file found by its contents opens with the picker\'s words, at its line', 'args: ' + short(hit && hit.args));
    const before = p.loaded.length;
    pk.opts.pick({ kind: 'folder' }, 'docs'); await settle();
    ok(p.loaded.length === before, 'a row that is not a file loads nothing', 'loaded: ' + short(p.loaded.slice(before)));
    pk.opts.pick({ kind: 'file', line: 0 }, 'docs/a.md'); await settle();
    const named = lastView(p);
    ok(!!named && named.args.path === 'docs/a.md' && !named.args.words && !named.args.line, 'a file picked by name opens unmarked', 'args: ' + short(named && named.args));
  } else test.fail('the picker has no pick');

  test.subHeading('Load, and a second Open with');
  const before = p.loaded.length;
  byId['editor-load'] && byId['editor-load'].fire('click'); await settle();
  ok(p.loaded[before] === 'docs/a.md', 'Load reads the current path again', 'loaded: ' + short(p.loaded.slice(before)));
  p.def.loadFile('shell/x/data.json'); await settle();
  ok(p.loaded[p.loaded.length - 1] === 'shell/x/data.json' && !!lastView(p) && lastView(p).args.path === 'shell/x/data.json', 'loadFile(path) opens that path', 'loaded: ' + short(p.loaded));
}()).then(function () { test.reportSuccessFailureCount(); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); });
