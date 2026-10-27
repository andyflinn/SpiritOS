'use strict';

// spirit/run/shell/js/test/fileViewer.js
// The tests of shell/js/fileViewer.js, and of no other module (spec: ./fileViewer.md; goal/G41.7). The browser file runs
// in node on a window of its own: the link, the page's fetch and the spirit object's fs are stubs that keep what was
// asked of them.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'fileViewer.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

// A box whose markup makes a child per element carrying data-part; found by [data-part="name"].
function box() {
  let html = '';
  const b = { kids: [],
    get innerHTML() { return html; },
    set innerHTML(v) {
      html = String(v); b.kids = [];
      const re = /<([a-z]+)\b([^>]*)>/gi; let m;
      while ((m = re.exec(html))) { const k = box(); k.attrs = m[2]; b.kids.push(k); }
    },
    querySelector: function (sel) {
      const a = /^\[([\w-]+)="([^"]*)"\]$/.exec(sel);
      return a ? b.kids.filter(function (k) { return new RegExp('\\s' + a[1] + '="' + a[2] + '"').test(k.attrs || ''); })[0] || null : null;
    },
  };
  return b;
}

function world(o) {
  const opts = o || {};
  const w = { asked: [], fetched: [], pieces: [], shell: [] };
  const fsApi = {
    stat: function (a) { w.asked.push(['stat', a.path]); return opts.statFails ? Promise.reject(new Error('no')) : Promise.resolve({ size: 2048, mtimeMs: 1.7e12, birthtimeMs: 1.6e12 }); },
    annotations: function (a) { w.asked.push(['annotations', a.path]); return Promise.resolve(opts.annotations || null); },
  };
  const win = {
    spirit: { ready: Promise.resolve({ fs: fsApi }), MIME_TYPES: { '.md': 'text/markdown', '.png': 'image/png', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.js': 'application/javascript', '.json': 'application/json' },
      formatBytes: function (n) { return (n / 1024) + ' KB'; },
      transport: opts.link ? { file: function (p, each) { w.fetched.push(['link', p]); each(new Uint8Array([1])); return Promise.resolve({ status: 200, type: 'text/plain', bytes: new Uint8Array([1]) }); } } : null,
      shell: opts.oldShell ? { renderAppOfFile: function (h, p) { w.shell.push(['owner', p]); }, renderOpenWith: function (h, id, p) { w.shell.push(['open-with', id, p]); } } : null },
    fetch: function (url) {
      w.fetched.push(['fetch', url]);
      const parts = [new Uint8Array([104, 105]), new Uint8Array([33])];
      let i = 0;
      return Promise.resolve({ status: 200, headers: { get: function () { return 'text/plain'; } },
        body: opts.noStream ? null : { getReader: function () { return { read: function () { return Promise.resolve(i < parts.length ? { done: false, value: parts[i++] } : { done: true }); } }; } },
        arrayBuffer: function () { return Promise.resolve(new Uint8Array([104, 105, 33]).buffer); } });
    },
    encodeURI: encodeURI, Uint8Array: Uint8Array, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String, Date: Date,
    console: { log: function () {}, error: function () {} },
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE });
  w.E = win.spirit.elements.fileViewer;
  return w;
}

test.startTest('fileViewer.js: one file, shown');

(async function () {
  const w = world();
  const V = w.E;
  ok(!!V && ['create', 'read', 'mimeOf', 'kindOf', 'fStatViewer', 'annotationManager'].every(function (k) { return typeof V[k] === 'function'; }),
    'it puts fileViewer on window.spirit.elements, with create, read, mimeOf, kindOf, fStatViewer and annotationManager', 'fileViewer: ' + short(V && Object.keys(V)));
  if (!V) return;

  test.subHeading('mimeOf and kindOf');
  ok(V.mimeOf('a/b.MD') === 'text/markdown' && V.mimeOf('noext') === 'application/octet-stream', 'mimeOf reads the extension, case ignored; none is application/octet-stream', 'md ' + V.mimeOf('a/b.MD') + ', none ' + V.mimeOf('noext'));
  const kinds = { 'image/png': 'image', 'audio/mpeg': 'audio', 'video/mp4': 'video', 'text/markdown': 'code', 'application/javascript': 'code', 'application/json': 'code', 'application/octet-stream': null };
  ok(Object.keys(kinds).every(function (m) { return V.kindOf(m) === kinds[m]; }), 'kindOf: image, audio, video, code (text, javascript, json), or null', 'kinds: ' + short(Object.keys(kinds).map(function (m) { return V.kindOf(m); })));

  test.subHeading('read: through the link on a face, by the page\'s fetch at home');
  const viaLink = world({ link: true });
  const pieces = [];
  const r1 = await viaLink.E.read('/notes.md', function (p) { pieces.push(p); });
  ok(viaLink.fetched[0][0] === 'link' && viaLink.fetched[0][1] === 'notes.md' && r1.status === 200 && pieces.length === 1, 'on a face the sealed link answers it, a leading slash dropped, each piece handed on', 'fetched: ' + short(viaLink.fetched));
  const seen = [];
  const r2 = await V.read('docs/a b.md', function (p) { seen.push(p.length); });
  ok(w.fetched[0][1] === '/docs/a%20b.md' && r2.status === 200 && r2.bytes.length === 3 && short(seen) === short([2, 1]), 'at home the node\'s own GET, streamed: each chunk handed on, the bytes joined', 'fetched ' + short(w.fetched) + ', chunks ' + short(seen));
  const flat = world({ noStream: true });
  const r3 = await flat.E.read('x.md');
  ok(r3.bytes.length === 3 && r3.type === 'text/plain', 'a response with no stream is read whole', 'bytes ' + r3.bytes.length);

  test.subHeading('fStatViewer: the path and its facts');
  const s = box();
  await V.fStatViewer(s, 'docs/a.md');
  ok(/path-dir">docs\/<\/span>/.test(s.innerHTML) && /path-file">a\.md/.test(s.innerHTML), 'the path in its tile, a span a directory', 'stat: ' + short(s.innerHTML));
  ok(/MIME type/.test(s.innerHTML) && /2 KB/.test(s.innerHTML) && /Changed/.test(s.innerHTML) && /Created/.test(s.innerHTML), 'the MIME type, then size, changed and created once fs.stat answers', 'stat: ' + short(s.innerHTML));
  const sf = box();
  await world({ statFails: true }).E.fStatViewer(sf, 'docs/a.md');
  ok(/MIME type/.test(sf.innerHTML) && !/Size/.test(sf.innerHTML), 'a stat that fails leaves the MIME type alone', 'stat: ' + short(sf.innerHTML));

  test.subHeading('annotationManager: the face part, drawn');
  const n0 = box();
  await V.annotationManager(n0, 'docs/a.md');
  ok(n0.innerHTML === '', 'nothing when the file has no annotations', 'notes: ' + short(n0.innerHTML));
  const n1 = box();
  await world({ annotations: { face: { appName: 'Notes', tags: ['a', 'b'], seenAt: 1.7e12 } } }).E.annotationManager(n1, 'docs/a.md');
  ok(/More Information/.test(n1.innerHTML) && /App Name/.test(n1.innerHTML) && /2 values/.test(n1.innerHTML) && !/1700000000000/.test(n1.innerHTML),
    'its face part under More Information: names prettified, a list folded, a big number a date', 'notes: ' + short(n1.innerHTML));

  test.subHeading('create: the frame, space granted top-down (rule/16)');
  const host = box();
  const frame = V.create(host, { path: 'docs/a.md', launcherId: 'text-file-launcher' });
  await settle();
  ok(frame.path === 'docs/a.md' && typeof frame.slot === 'function', 'it answers { path, slot(name) }', 'frame: ' + short(frame));
  ok(['stat', 'owner-app', 'open-with', 'body', 'notes'].every(function (p) { return !!frame.slot(p); }), 'its slots: stat, owner-app, open-with, body, notes', 'markup: ' + short(host.innerHTML));
  ok(/^<div class="stack fill">/.test(host.innerHTML) && /data-part="body" class="fill"/.test(host.innerHTML), 'the frame is a fill column and its body a fill box, so a viewer takes what is left and scrolls inside it', 'markup: ' + short(host.innerHTML));
  ok(w.asked.some(function (a) { return a[0] === 'stat' && a[1] === 'docs/a.md'; }) && w.asked.some(function (a) { return a[0] === 'annotations'; }), 'it fills the stat and the notes', 'asked: ' + short(w.asked));
  ok(w.shell.length === 0, 'on the face no owner app and no Open with', 'shell: ' + short(w.shell));
  const old = world({ oldShell: true });
  old.E.create(box(), { path: 'docs/a.md', launcherId: 'text-file-launcher' });
  ok(short(old.shell) === short([['owner', 'docs/a.md'], ['open-with', 'text-file-launcher', 'docs/a.md']]), 'at home the old shell draws the owner app and Open with', 'shell: ' + short(old.shell));
}()).then(function () { test.reportSuccessFailureCount(); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); });
