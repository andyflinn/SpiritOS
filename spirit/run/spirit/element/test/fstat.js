'use strict';

// spirit/run/spirit/element/test/fstat.js
// The tests of spirit/element/fstat.js, and of no other module (spec: ./fstat.md; goal/G43.17). Andy's box: "It replaces
// fileViewer, which is renamed and trimmed into it, then deleted, its users naming fstat; mediaViewer goes too (Q7)", and "It
// asks nothing of the old shell (Q9)". The browser file runs in node on a window of its own: the link, the page's fetch, the
// spirit object's fs and an old shell are stubs that keep what was asked of them. What it draws, top down, is judged in a real
// Chrome by ../../app/file/test/file.js.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const VENDORED_FOLDERS = require(path.join(RUN, 'spirit', 'fileSystem.js')).VENDORED_FOLDERS;
const FILE = path.join(__dirname, '..', 'fstat.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, ''); } catch (e) { return ''; } }
function filesUnder(dir) {
  const out = [];
  (function walk(d) { (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []).forEach(function (e) { if (VENDORED_FOLDERS.holds(path.join(d, e.name)) || e.name === 'state' || e.name === 'agents') return; const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else out.push(p); }); }(dir));
  return out;
}
// The code of the tree, its comments out, its tests out: what runs.
function codeNaming(re) {
  return filesUnder(RUN).filter(function (f) { return /\.(js|html)$/.test(f) && f.split(path.sep).indexOf('test') === -1; })
    .filter(function (f) { return re.test(code(f)); }).map(function (f) { return path.relative(RUN, f); });
}

// A box whose markup makes a child per element carrying data-part; found by [data-part="name"].
function box() {
  let html = '';
  const b = { kids: [], style: {}, hidden: false,
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
    querySelectorAll: function () { return []; },
    appendChild: function (k) { b.kids.push(k); return k; },
    setAttribute: function () {}, removeAttribute: function () {}, addEventListener: function () {},
    classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } },
  };
  return b;
}

function world(o) {
  const opts = o || {};
  const w = { asked: [], fetched: [], shell: [] };
  const fsApi = {
    stat: function (a) { w.asked.push(['stat', a.path]); return opts.statFails ? Promise.reject(new Error('no')) : Promise.resolve({ size: 2048, mtimeMs: 1.7e12, birthtimeMs: 1.6e12 }); },
    annotations: function (a) { w.asked.push(['annotations', a.path]); return Promise.resolve(opts.annotations || null); },
  };
  const win = {
    spirit: { ready: Promise.resolve({ fs: fsApi }), MIME_TYPES: { '.md': 'text/markdown', '.png': 'image/png', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.js': 'application/javascript', '.json': 'application/json' },
      formatBytes: function (n) { return (n / 1024) + ' KB'; },
      require: function () { return Promise.resolve(); },
      transport: opts.link ? { file: function (p, each) { w.fetched.push(['link', p]); each(new Uint8Array([1])); return Promise.resolve({ status: 200, type: 'text/plain', bytes: new Uint8Array([1]) }); } } : null,
      // An old shell on the page: fstat asks nothing of it (Q9).
      shell: { renderAppOfFile: function (h, p) { w.shell.push(['owner', p]); }, renderOpenWith: function (h, id, p) { w.shell.push(['open-with', id, p]); }, launchApp: function () { w.shell.push(['launch']); } } },
    fetch: function (url) {
      w.fetched.push(['fetch', url]);
      const parts = [new Uint8Array([104, 105]), new Uint8Array([33])];
      let i = 0;
      return Promise.resolve({ status: 200, headers: { get: function () { return 'text/plain'; } },
        body: opts.noStream ? null : { getReader: function () { return { read: function () { return Promise.resolve(i < parts.length ? { done: false, value: parts[i++] } : { done: true }); } }; } },
        arrayBuffer: function () { return Promise.resolve(new Uint8Array([104, 105, 33]).buffer); } });
    },
    document: { createElement: function () { return box(); } },
    encodeURI: encodeURI, Uint8Array: Uint8Array, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String, Date: Date,
    console: { log: function () {}, error: function () {} },
  };
  win.window = win;
  // goal/G43.32: fstat.js places itself by installSpiritElement (spirit/test/headLessChrome.js pageSpirit), at its path.
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(win.spirit);
  vm.createContext(win);
  try { vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE }); } catch (e) { w.error = e; }
  w.E = (((win.spirit.element || {}).spirit || {}).element || {}).fstat;
  return w;
}

// What the tests make, shared by the tests after them.
let naming, media, own, w, V, kinds, viaLink, pieces, r1, seen, r2;
test.run('spirit/element/fstat.js is there', 0.2, function () {
  // the box: "It replaces fileViewer, which is renamed and trimmed into it, then deleted, its users naming fstat; mediaViewer goes too (Q7)"
  return (fs.existsSync(FILE)) ? true : 'no spirit/element/fstat.js';
}, 1000);
test.run('spirit/element/fileViewer.js is gone', 0.2, function () {
  return (!fs.existsSync(path.join(RUN, 'spirit', 'element', 'fileViewer.js'))) ? true : 'spirit/element/fileViewer.js is still there';
}, 1000);
test.run('spirit/element/mediaViewer.js is gone', 0.2, function () {
  return (!fs.existsSync(path.join(RUN, 'spirit', 'element', 'mediaViewer.js'))) ? true : 'spirit/element/mediaViewer.js is still there';
}, 1000);
test.run('no code names fileViewer', 0.2, function () {
  naming = codeNaming(/fileViewer/);
  return (!naming.length) ? true : 'naming it: ' + short(naming);
}, 1000);
test.run('no code loads the mediaViewer element', 0.2, function () {
  media = codeNaming(/spirit\/element\/mediaViewer|element\.mediaViewer\b/);
  return (!media.length) ? true : 'loading it: ' + short(media);
}, 1000);
test.run('its users load spirit/element/fstat.js', 0.2, function () {
  return (codeNaming(/spirit\/element\/fstat\.js/).length > 0) ? true : 'no code loads spirit/element/fstat.js';
}, 1000);
test.run('its code names neither the old shell, the owner app nor Open with', 0.2, function () {
  // the box: "It asks nothing of the old shell, so the app a file belongs to and Open with are not in it (Q9)"
  own = code(FILE);
  return (!!own && !/\.shell\b|renderAppOfFile|renderOpenWith|launcherId|open-with|owner-app/.test(own)) ? true : 'fstat.js names one of them';
}, 1000);
test.run('it puts fstat on window.spirit.element, with create, read, mimeOf and kindOf, as fileViewer had them', 0.2, function () {
  w = world();
  V = w.E;
  return (!w.error && !!V && ['create', 'read', 'mimeOf', 'kindOf'].every(function (k) { return typeof V[k] === 'function'; })) ? true : 'fstat: ' + short(w.error ? String(w.error) : V && Object.keys(V));
}, 1000);
test.run('mimeOf reads the extension, case ignored; none is application/octet-stream', 0.2, function () {
  // mimeOf and kindOf, as they were
  return (V.mimeOf('a/b.MD') === 'text/markdown' && V.mimeOf('noext') === 'application/octet-stream') ? true : 'md ' + V.mimeOf('a/b.MD') + ', none ' + V.mimeOf('noext');
}, 1000);
test.run('kindOf: image, audio, video, code (text, javascript, json), or null', 0.2, function () {
  kinds = { 'image/png': 'image', 'audio/mpeg': 'audio', 'video/mp4': 'video', 'text/markdown': 'code', 'application/javascript': 'code', 'application/json': 'code', 'application/octet-stream': null };
  return (Object.keys(kinds).every(function (m) { return V.kindOf(m) === kinds[m]; })) ? true : 'kinds: ' + short(Object.keys(kinds).map(function (m) { return V.kindOf(m); }));
}, 1000);
test.run('on a face the sealed link answers it, a leading slash dropped, each piece handed on', 0.2, async function () {
  // read: through the link on a face, by the page's fetch at home, as it was
  viaLink = world({ link: true });
  pieces = [];
  r1 = await viaLink.E.read('/notes.md', function (p) { pieces.push(p); });
  return (viaLink.fetched[0] && viaLink.fetched[0][0] === 'link' && viaLink.fetched[0][1] === 'notes.md' && r1.status === 200 && pieces.length === 1) ? true : 'fetched: ' + short(viaLink.fetched);
}, 1000);
test.run('at home the node\'s own GET, streamed: each chunk handed on, the bytes joined', 0.2, async function () {
  seen = [];
  r2 = await V.read('docs/a b.md', function (p) { seen.push(p.length); });
  return (w.fetched[0] && w.fetched[0][1] === '/docs/a%20b.md' && r2.status === 200 && r2.bytes.length === 3 && short(seen) === short([2, 1])) ? true : 'fetched ' + short(w.fetched) + ', chunks ' + short(seen);
}, 1000);
test.run('it asks fs.stat for the file, and no annotations: they are the node\'s only', 0.2, async function () {
  // create: the facts asked, no annotations (goal/G43.20), the old shell asked nothing
  V.create(box(), { path: 'docs/a.md' });
  await settle();
  return (w.asked.some(function (a) { return a[0] === 'stat' && a[1] === 'docs/a.md'; }) && !w.asked.some(function (a) { return a[0] === 'annotations'; })) ? true : 'asked: ' + short(w.asked);
}, 1000);
test.run('with an old shell on the page it asks it nothing: no owner app, no Open with', 0.2, function () {
  return (w.shell.length === 0) ? true : 'asked of the old shell: ' + short(w.shell);
}, 1000);
