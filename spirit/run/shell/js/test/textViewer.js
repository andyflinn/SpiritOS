'use strict';

// spirit/run/shell/js/test/textViewer.js
// The tests of shell/js/textViewer.js, and of no other module (spec: ./textViewer.md; goal/G41.7). The browser file runs
// in node on a window of its own: the file viewer and the codeMirror element are recorders, the node behind
// spirit.ready answers the sidecar.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'textViewer.js');
const SRC = fs.readFileSync(FILE, 'utf8');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = async function () {
  for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); });
  await new Promise(function (r) { setTimeout(r, 10); });
};

// A box whose markup makes a child per element carrying data-part, data-job or a class.
function box(tag) {
  let html = '';
  const b = { tag: tag || 'div', kids: [], textContent: '', style: {},
    get innerHTML() { return html; },
    set innerHTML(v) {
      html = String(v); b.kids = [];
      const re = /<([a-z]+)\b([^>]*)>/gi; let m;
      while ((m = re.exec(html))) { const k = box(m[1]); k.attrs = m[2]; b.kids.push(k); }
    },
    querySelector: function (sel) {
      const a = /^\[([\w-]+)="([^"]*)"\]$/.exec(sel);
      const c = /^\.([\w-]+)$/.exec(sel);
      return b.kids.filter(function (k) {
        if (a) return new RegExp('\\s' + a[1] + '="' + a[2] + '"').test(k.attrs || '');
        if (c) return new RegExp('class="[^"]*\\b' + c[1] + '\\b').test(k.attrs || '');
        return false;
      })[0] || null;
    },
    querySelectorAll: function () { return []; },
    addEventListener: function () {},
  };
  return b;
}

const FILES = {
  'notes.md': 'alpha beta',
  'process/js/demo/demo.js': 'run();',
  'process/js/demo/demo.json': JSON.stringify({ label: 'Demo', args: [{ name: 'n', label: 'N', type: 'number', default: 3 }] }),
};

function world(opts) {
  const o = opts || {};
  const w = { required: [], read: [], frames: [], views: [], annotations: [] };
  const win = {
    document: { createElement: function (t) { return box(t); }, head: { appendChild: function () {} }, body: { appendChild: function () {} } },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number,
    TextDecoder: TextDecoder, TextEncoder: TextEncoder, DOMParser: function () { w.parsed = true; this.parseFromString = function () { return { querySelectorAll: function () { return []; } }; }; },
    console: { log: function () {}, error: function () {} },
  };
  win.window = win;
  win.spirit = {
    escapeHtml: function (s) { return String(s).replace(/</g, '&lt;'); },
    require: function (p) { w.required.push(String(p).replace(/^\/+/, '')); return Promise.resolve({}); },
    ready: Promise.resolve({ fs: { getAnnotations: function (p) { w.annotations.push(p); return Promise.resolve(o.sidecar || null); } } }),
    elements: {
      fileViewer: {
        create: function (host, args) {
          const slots = { body: box('body') };
          const f = { host: host, args: args, path: args && args.path, slot: function (n) { return slots[n]; }, slots: slots };
          w.frames.push(f); return f;
        },
        read: function (p) {
          w.read.push(String(p));
          if (o.readFails) return Promise.reject(new Error('the link is down'));
          if (!(p in FILES)) return Promise.resolve({ status: 404, bytes: new Uint8Array(0) });
          return Promise.resolve({ status: 200, bytes: new TextEncoder().encode(FILES[p]) });
        },
      },
      codeMirror: { create: function (host, args) { const v = { host: host, args: args, mode: args && args.mode, value: function () { return args.text; } }; w.views.push(v); return Promise.resolve(v); } },
      createTextView: function (host, args) { w.oldView = { host: host, args: args }; return { value: function () { return ''; } }; },
    },
  };
  vm.createContext(win);
  vm.runInContext(SRC, win, { filename: FILE });
  return { w: w, win: win };
}

test.startTest('textViewer.js: a text file, shown with the codeMirror element');

(async function () {
  test.subHeading('it loads what it draws with itself, and nothing of the old text view (goal/G41.7)');
  const a = world();
  const E = a.win.spirit.elements.textViewer;
  ok(!!E && typeof E.create === 'function', 'it puts itself on window.spirit.elements as textViewer, with create', 'no textViewer.create');
  ['shell/js/fileViewer.js', 'shell/js/codeMirror.js'].forEach(function (p) {
    ok(a.w.required.indexOf(p) !== -1, 'it requires ' + p, 'required: ' + short(a.w.required));
  });
  ok(a.w.required.indexOf('shell/js/textView.js') === -1 && !/textView\.js|createTextView/.test(SRC), 'it neither loads textView.js nor calls createTextView', 'textViewer.js still names textView.js or createTextView');
  ok(!/ensureCodeMirror/.test(SRC) && !/index\.html/.test(SRC.replace(/\/\/.*$/gm, '')), 'it has no CodeMirror loader of its own and reads no index.html', 'textViewer.js still has ensureCodeMirror or reads index.html');
  if (!E) return;

  test.subHeading('the text, in read mode, its words and line');
  const host = box('host');
  const frame = await E.create(host, { path: 'notes.md', words: 'beta', line: 0, launcherId: 'shell/textFileLauncher' });
  await settle();
  const f = a.w.frames[0];
  ok(!!f && f.host === host && f.args.path === 'notes.md' && f.args.launcherId === 'shell/textFileLauncher', 'the frame is fileViewer.create(host, { path, launcherId })', 'frames: ' + short(a.w.frames.map(function (x) { return x.args; })));
  ok(frame === f, 'the Promise answers the frame', 'answered ' + short(frame && frame.args));
  const v = a.w.views[0];
  ok(!!v && v.args.mode === 'read', 'the text is drawn by codeMirror.create in read mode', 'views: ' + short(a.w.views.map(function (x) { return x.args; })));
  if (v) {
    ok(v.args.text === 'alpha beta' && v.args.words === 'beta' && v.args.path === 'notes.md', 'handed the file\'s text, the words and the path', 'args: ' + short(v.args));
    const textBox = f && f.slots.body.querySelector('.text-view');
    ok(!!textBox && v.host === textBox, 'into the text box in the frame\'s body slot', 'host: ' + short(v.host && v.host.tag));
  }
  ok(!a.w.oldView && a.w.read.indexOf('index.html') === -1, 'no old text view made, no index.html read', 'old view ' + short(!!a.w.oldView) + ', read ' + short(a.w.read));

  await E.create(box('host'), { path: 'notes.md', words: '', line: 7 });
  await settle();
  ok(a.w.views[1] && a.w.views[1].args.line === 7, 'a line asked for is handed on', 'line: ' + short(a.w.views[1] && a.w.views[1].args.line));

  test.subHeading('a file that does not load says so');
  await E.create(box('host'), { path: 'missing.txt' });
  await settle();
  ok(a.w.views[2] && a.w.views[2].args.text === '(could not load file)', 'a file that does not answer 200 shows (could not load file)', 'text: ' + short(a.w.views[2] && a.w.views[2].args.text));
  const b = world({ readFails: true });
  let answered = null;
  try { answered = await b.win.spirit.elements.textViewer.create(box('host'), { path: 'notes.md' }); } catch (e) { answered = e; }
  await settle();
  const bf = b.w.frames[0];
  const bBox = bf && bf.slots.body.querySelector('.text-view');
  ok(answered === bf && !!bBox && /could not load file: the link is down/.test(bBox.textContent), 'a read that fails says (could not load file: why) and still answers the frame', 'answered ' + short(answered && answered.message) + ', box ' + short(bBox && bBox.textContent));

  test.subHeading('the job form, for a process script only');
  ok(a.w.read.filter(function (p) { return /\.json$/.test(p); }).length === 0, 'a plain file reads no manifest', 'read: ' + short(a.w.read));
  const c = world({ sidecar: { face: { home: true } } });
  await c.win.spirit.elements.textViewer.create(box('host'), { path: 'process/js/demo/demo.js' });
  await settle();
  const job = c.w.frames[0] && c.w.frames[0].slots.body.querySelector('[data-part="job"]');
  ok(c.w.read.indexOf('process/js/demo/demo.json') !== -1, 'a process script reads its manifest beside it', 'read: ' + short(c.w.read));
  ok(!!job && /data-arg-name="n"/.test(job.innerHTML) && /Start Job/.test(job.innerHTML), 'its args become fields, with Start Job', 'job part: ' + short(job && job.innerHTML));
  ok(c.w.annotations.indexOf('process/js/demo/demo.js') !== -1, 'whether it runs here is asked of the node\'s sidecar', 'annotations asked: ' + short(c.w.annotations));
}()).then(function () { test.reportSuccessFailureCount(); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); });
