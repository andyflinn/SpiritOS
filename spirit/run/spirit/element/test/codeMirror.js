'use strict';

// spirit/run/spirit/element/test/codeMirror.js
// The tests of spirit/element/codeMirror.js, and of no other module (spec: ./codeMirror.md; goal/G41.7). The browser file
// runs in node on a window of its own: CodeMirror is a recorder standing in for the library, handed over when the
// element requires the library's path; every loader the page offers (spirit.requireScript, fstat's read, a link
// tag) writes down what it was asked for.
// Its last part, libraryPart (once codeMirror-library.js, goal/G43.5), checks the library in spirit/element/codeMirror/ on
// a real page: the one test file of codeMirror.js (spirit/run/spirit/test/TEST_SYSTEM.md).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
const VENDORED_FOLDERS = LOADER.requireScript('spirit/fs/fileSystem/script.js').VENDORED_FOLDERS;
// What it judges, by its run-root path, the one place it is named (goal/G49.6).
const SUBJECT = 'spirit/element/codeMirror.js';
const FILE = path.join(RUN, SUBJECT);
const CM = 'spirit/element/codeMirror/';

const settle = async function () {
  for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); });
  await new Promise(function (r) { setTimeout(r, 10); });
};

// A CodeMirror that keeps what it was made with and what was done to it.
function fakeCodeMirror(made) {
  return function CodeMirror(host, cfg) {
    let value = String(cfg.value == null ? '' : cfg.value);
    const cm = { host: host, cfg: cfg, marks: [], cursor: null, scrolled: [], refreshed: 0,
      getValue: function () { return value; },
      setValue: function (v) { if (cm.cfg.readOnly === true || cm.cfg.readOnly === 'nocursor') return; value = String(v); },
      type: function (v) { cm.setValue(v); },
      posFromIndex: function (i) { const before = value.slice(0, i).split('\n'); return { line: before.length - 1, ch: before[before.length - 1].length }; },
      markText: function (from, to, o) { const m = { from: from, to: to, o: o, cleared: false, clear: function () { m.cleared = true; } }; cm.marks.push(m); return m; },
      setCursor: function (p) { cm.cursor = p; },
      scrollIntoView: function (p) { cm.scrolled.push(p); },
      refresh: function () { cm.refreshed += 1; },
      setSize: function () {}, setOption: function (k, v) { cm.cfg[k] = v; }, getOption: function (k) { return cm.cfg[k]; },
    };
    made.push(cm);
    return cm;
  };
}

function world() {
  const w = { required: [], read: [], links: [], made: [] };
  const CodeMirror = fakeCodeMirror(w.made);
  const head = { appendChild: function (el) { w.links.push(el); return el; } };
  const win = {
    document: {
      head: head, body: head,
      createElement: function (t) { return { tagName: String(t).toUpperCase(), setAttribute: function (k, v) { this[k] = v; } }; },
      querySelector: function () { return null; }, querySelectorAll: function () { return []; },
    },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number,
    TextDecoder: TextDecoder, TextEncoder: TextEncoder, console: { log: function () {}, error: function () {} },
  };
  win.window = win;
  // CODEMIRROR IS ON THE PAGE BEFORE THE ELEMENT RUNS (goal/G49.15, box v16: "the vendored codeMirror will be loaded by
  // face.html with a script tag"): its library put window.CodeMirror there, as face.html's tags do.
  win.CodeMirror = CodeMirror;
  win.spirit = {
    elements: {
      fstat: { read: function (p) { w.read.push(String(p)); return Promise.resolve({ status: 200, type: 'text/css', bytes: new TextEncoder().encode('/* ' + p + ' */') }); } },
    },
    // The one marking rule, as the list has it: every place a word stands, case ignored.
    matchRanges: function (text, words) {
      const out = [];
      String(words || '').toLowerCase().split(/\s+/).filter(Boolean).forEach(function (word) {
        const low = String(text).toLowerCase(); let at = low.indexOf(word);
        while (at !== -1) { out.push([at, at + word.length]); at = low.indexOf(word, at + word.length); }
      });
      return out.sort(function (a, b) { return a[0] - b[0]; });
    },
    requireScript: function (p) {
      const q = String(p).replace(/^\/+/, '');
      w.required.push(q);
      if (q === CM + 'lib/codemirror.js') { win.CodeMirror = CodeMirror; return Promise.resolve(CodeMirror); }
      return Promise.resolve({});
    },
  };
  // goal/G43.32: codeMirror.js places itself by installSpiritElement; the recorder hands that helper to the page stand-in
  // (spirit/test/headLessChrome.js pageSpirit), and writes down only what the element asks for besides.
  const own = win.spirit.requireScript;
  LOADER.requireScript('spirit/test/headLessChrome.js').pageSpirit(win.spirit, null, { window: win, real: [SUBJECT] });
  const pageRequire = win.spirit.requireScript;
  win.spirit.requireScript = function (p) { return /installSpiritElement\.js$/.test(p) || p === SUBJECT ? pageRequire(p) : own(p); };
  vm.createContext(win);
  return { w: w, win: win };
}
function asked(w) { return w.required.concat(w.read).concat(w.links.map(function (l) { return String(l.href || ''); })); }


// What the tests share, made by the first ones.
const S = { there: false, src: '', w: null, win: null, E: null, read: null, atLine: null, edit: null, bare: null, views: {} };

test.run('spirit/element/codeMirror.js exists', 0.2, function () {
  S.there = fs.existsSync(FILE);
  S.src = S.there ? fs.readFileSync(FILE, 'utf8') : '';
  return S.there || false;
}, test.limit.quick);
test.run('it puts itself on window.spirit.required as codeMirror, with create', 0.2, async function () {
  const made = world();
  S.w = made.w; S.win = made.win;
  // Run in its world by its path, through the page stand-in (goal/G49.6).
  if (S.there) S.win.spirit.requireScript(SUBJECT);
  await settle();
  S.E = ((S.win.spirit.required.spirit || {}).element || {}).codeMirror;
  return (!!S.E && typeof S.E.create === 'function') || false;
}, test.limit.quick);

// IT LOADS NONE OF CODEMIRROR ITSELF (goal/G49.15, box v16: "the page list goes. the vendored codeMirror will be loaded by
// face.html with a script tag"): no file of spirit/element/codeMirror/ is required, read or put on the page by it.
test.run('it makes a read view with the CodeMirror face.html put on the page', 0.2, async function () {
  if (!S.E) return false;
  S.read = await S.E.create({ id: 'host-1' }, { mode: 'read', text: 'alpha beta\ngamma beta', words: 'beta', path: 'notes.md' });
  await settle();
  return (!!S.w && S.w.made.length > 0) || false;
}, test.limit.quick);
test.run('it requires, reads and puts on the page no file of spirit/element/codeMirror/', 0.2, function () {
  if (!S.w) return false;
  return !asked(S.w).some(function (p) { return String(p).replace(/^\/+/, '').indexOf(CM) === 0; }) || false;
}, test.limit.quick);
test.run('its code names no file of spirit/element/codeMirror/', 0.2, function () {
  const c = S.src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
  return (S.there && c.indexOf(CM) === -1) || false;
}, test.limit.quick);
test.run('nothing of it reads or asks for index.html', 0.2, function () {
  return (S.there && !!S.w && !asked(S.w).some(function (p) { return /index\.html/.test(p); }) && !/index\.html/.test(S.src.replace(/\/\/.*$/gm, ''))) || false;
}, test.limit.quick);

// Read mode: the text shown, not editable.
test.run('a read view is a read-only CodeMirror', 0.2, function () {
  const r = S.w && S.w.made[0];
  return (!!S.read && S.read.mode === 'read' && !!r && r.cfg.readOnly === true) || false;
}, test.limit.quick);
test.run('it shows the text it was given', 0.2, function () {
  const r = S.w && S.w.made[0];
  return (!!r && r.cfg.value === 'alpha beta\ngamma beta') || false;
}, test.limit.quick);
test.run('typing into a read view changes nothing', 0.2, function () {
  const r = S.w && S.w.made[0];
  if (!r) return false;
  r.type('changed');
  return (S.read && S.read.value() === 'alpha beta\ngamma beta') || false;
}, test.limit.quick);
test.run('a read view has line numbers and wrapping on, and the theme material-darker', 0.2, function () {
  const r = S.w && S.w.made[0];
  return (!!r && r.cfg.lineNumbers === true && r.cfg.lineWrapping === true && r.cfg.theme === 'material-darker') || false;
}, test.limit.quick);
test.run('a .md file is coloured as markdown', 0.2, function () {
  const r = S.w && S.w.made[0];
  return (!!r && r.cfg.mode === 'markdown') || false;
}, test.limit.quick);

// The words: every match marked, the first in view.
test.run('every match is marked with the class text-view-match', 0.2, function () {
  const r = S.w && S.w.made[0];
  const live = r ? r.marks.filter(function (m) { return !m.cleared; }) : [];
  return (live.length === 2 && live.every(function (m) { return m.o && m.o.className === 'text-view-match'; })) || false;
}, test.limit.quick);
test.run('the first match gets the cursor', 0.2, function () {
  const r = S.w && S.w.made[0];
  return (!!r && !!r.cursor && r.cursor.line === 0 && r.cursor.ch === 6) || false;
}, test.limit.quick);
test.run('the first match is scrolled into view', 0.2, function () {
  const r = S.w && S.w.made[0];
  return (!!r && r.scrolled.some(function (p) { return p.line === 0 && p.ch === 6; })) || false;
}, test.limit.quick);
test.run('CodeMirror is refreshed after the turn it was made in (a hidden box measures nothing)', 0.2, function () {
  const r = S.w && S.w.made[0];
  return (!!r && r.refreshed > 0) || false;
}, test.limit.quick);
test.run('mark, handed new words, marks again with the old marks cleared, and answers how many it marked', 0.2, function () {
  const r = S.w && S.w.made[0];
  if (!r || !S.read) return false;
  const n = S.read.mark('gamma');
  const live = r.marks.filter(function (m) { return !m.cleared; }).length;
  return (n === 1 && live === 1) || false;
}, test.limit.quick);
test.run('a line asked for wins over the first match (line 4 is put in view)', 0.2, async function () {
  if (!S.E) return false;
  S.atLine = await S.E.create({ id: 'host-2' }, { mode: 'read', text: 'one\ntwo beta\nthree\nfour', words: 'beta', line: 4, path: 'a.txt' });
  await settle();
  const l = S.w.made[1];
  return (!!S.atLine && !!l && !!l.cursor && l.cursor.line === 3) || false;
}, test.limit.quick);
test.run('a .txt file has no mode', 0.2, function () {
  const l = S.w && S.w.made[1];
  return (!!l && (l.cfg.mode == null || l.cfg.mode === '')) || false;
}, test.limit.quick);

// Edit mode: the text editable, value() what was typed.
test.run('an edit view is an editable CodeMirror', 0.2, async function () {
  if (!S.E) return false;
  S.edit = await S.E.create({ id: 'host-3' }, { mode: 'edit', text: '{"a":1}', path: 'x.json' });
  await settle();
  const e3 = S.w.made[2];
  return (!!S.edit && S.edit.mode === 'edit' && !!e3 && e3.cfg.readOnly !== true) || false;
}, test.limit.quick);
test.run('an edit view\'s value answers the text as typed', 0.2, function () {
  const e3 = S.w && S.w.made[2];
  if (!e3 || !S.edit) return false;
  e3.type('{"a":2}');
  return S.edit.value() === '{"a":2}' || false;
}, test.limit.quick);
test.run('a .json file is coloured as javascript with its json flag set', 0.2, function () {
  const e3 = S.w && S.w.made[2];
  return (!!e3 && !!e3.cfg.mode && e3.cfg.mode.name === 'javascript' && e3.cfg.mode.json === true) || false;
}, test.limit.quick);
test.run('the view hands its CodeMirror as cm', 0.2, function () {
  const e3 = S.w && S.w.made[2];
  return (!!S.edit && !!e3 && S.edit.cm === e3) || false;
}, test.limit.quick);
test.run('a view given no mode is a read view, and one given no text shows the empty string', 0.2, async function () {
  if (!S.E) return false;
  S.bare = await S.E.create({ id: 'host-4' }, { path: 'y.js' });
  await settle();
  const b = S.w.made[3];
  return (!!S.bare && S.bare.mode === 'read' && !!b && b.cfg.readOnly === true && b.cfg.value === '') || false;
}, test.limit.quick);
// Its mode file is face.html's, loaded before the element runs (goal/G49.15, box v16).
test.run('a .js file is coloured as javascript', 0.2, function () {
  const b = S.w && S.w.made[3];
  return (!!b && b.cfg.mode === 'javascript') || false;
}, test.limit.quick);
// Each file kind, written out: a view of an empty text at that path, and the mode it is coloured in.
const colouredAs = async function (p, mode) {
  if (!S.E) return false;
  const v = await S.E.create({ id: p }, { mode: 'read', text: '', path: p });
  const c = v && v.cm;
  return (!!c && c.cfg.mode === mode) || false;
};
test.run('a .mjs file is coloured as javascript', 0.2, function () { return colouredAs('a.mjs', 'javascript'); }, test.limit.quick);
test.run('a .css file is coloured as css', 0.2, function () { return colouredAs('a.css', 'css'); }, test.limit.quick);
test.run('a .html file is coloured as htmlmixed', 0.2, function () { return colouredAs('a.html', 'htmlmixed'); }, test.limit.quick);
test.run('a .htm file is coloured as htmlmixed', 0.2, function () { return colouredAs('a.htm', 'htmlmixed'); }, test.limit.quick);
test.run('an .xml file is coloured as xml', 0.2, function () { return colouredAs('a.xml', 'xml'); }, test.limit.quick);
test.run('an .svg file is coloured as xml', 0.2, function () { return colouredAs('a.svg', 'xml'); }, test.limit.quick);

// In a fill box it takes exactly the box (rule/16; Andy, on G41.7).
test.run('shell.css lets CodeMirror in a fill box take the box and scroll inside it', 0.2, function () {
  const css = fs.readFileSync(path.join(RUN, 'spirit', 'shell', 'shell.css'), 'utf8');
  return /\.text-view\.fill\s*>\s*\.CodeMirror\s*\{[^}]*flex:\s*1 1 0[^}]*min-height:\s*0/.test(css) || false;
}, test.limit.quick);


// THE CodeMirror LIBRARY IN spirit/element/codeMirror/, codeMirror.js's OWN FOLDER (goal/G43.5; spec: ./codeMirror.md,
// "The CodeMirror library"). Andy, live: "ALL move the fucking library inside run::/spirit/element/codeMirror/", and "only
// access to codeMirror library is through the element!". Its 15 files stand there; no
// product file but the element names the folder; on a real page the page starts with no CodeMirror, and the element draws
// from there with its sheet, its marks and its search keys, asking no other place. That no file names the library's old
// place is spirit/test/script-sibling-general.js's (goal/G47.1); textView.js, gone since, is no longer asked after.
const REPO = path.resolve(RUN, '../..');
const H = LOADER.requireScript('spirit/test/headLessChrome.js');
const L = { tracked: [], inRun: [], node: null, page: null, at: {}, cm: {}, fromHere: '' };

test.run('the library\'s 15 files, licence included, stand in spirit/element/codeMirror/', 0.2, function () {
  L.tracked = require('child_process').execSync('git ls-files', { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean);
  L.inRun = L.tracked.filter(function (f) { return f.indexOf('spirit/run/') === 0; }).map(function (f) { return f.slice('spirit/run/'.length); });
  const lib = L.inRun.filter(function (f) { return f.indexOf('spirit/element/codeMirror/') === 0; });
  return (lib.indexOf('spirit/element/codeMirror/lib/codemirror.js') !== -1 && lib.indexOf('spirit/element/codeMirror/LICENSE') !== -1 && lib.length === 15) || false;
}, test.limit.slow);
// WHO NAMES THE LIBRARY'S FOLDER (goal/G49.15, box v16: "the vendored codeMirror will be loaded by face.html with a script
// tag", which ends G43.5's "only access to codeMirror library is through the element!"): face.html, which loads it, and
// fileSystem.js's one list of vendored folders; no other product file, the element included.
test.run('no product file but face.html and fileSystem.js names the library\'s folder', 0.2, function () {
  const allowed = ['spirit/run/spirit/shell/face.html', 'spirit/run/spirit/fs/fileSystem/script.js'];
  const asking = L.tracked.filter(function (f) { return /\.(js|html|css)$/.test(f) && f.indexOf('spirit/run/') === 0 && !/\/test\//.test(f) && allowed.indexOf(f) === -1 && f.indexOf('spirit/run/spirit/element/codeMirror/') !== 0; }).filter(function (f) {
    return fs.existsSync(path.join(REPO, f)) && /element\/codeMirror\//.test(fs.readFileSync(path.join(REPO, f), 'utf8').split('\n').map(function (l) { const cut = l.search(/(^|[^:'"])\/\//); return cut === -1 ? l : l.slice(0, cut + 1); }).join('\n'));
  });
  return (L.tracked.length > 100 && !asking.length) || false;
}, test.limit.slow);
test.run('a scratch node comes up with a Chrome page on it', 0.2, async function () {
  const chrome = H.findChrome();
  if (!chrome) return false;
  L.node = await H.scratchNode();
  if (!L.node.up) return false;
  L.page = await H.chromePage(chrome);
  if (!L.page || L.page.error) return false;
  await L.page.send('Page.navigate', { url: L.node.base + '/' });
  const ready = await H.until(function () { return L.page.evaluate('!!(window.spirit && window.spirit.readyPromise)').then(Boolean); }, H.WAIT);
  await H.sleep(2500);
  return !!ready || false;
}, test.limit.long);
test.run('the page starts with CodeMirror on it, from face.html\'s script tags', 0.2, async function () {
  if (!L.page || L.page.error) return false;
  try { L.at = JSON.parse(await L.page.evaluate('JSON.stringify({ library: typeof window.CodeMirror })')); } catch (e) { L.at = {}; }
  return L.at.library === 'function' || false;
}, test.limit.slow);
test.run('the element draws from that folder, with its sheet, its marks and its search keys', 0.2, async function () {
  if (!L.page || L.page.error) return false;
  await L.page.evaluate('Promise.resolve(window.spirit.requireScript("spirit/element/codeMirror.js")).then(function () { return true; }, function () { return false; })');
  try { L.cm = JSON.parse(await L.page.evaluate('(function () { var d = document.body.appendChild(document.createElement("div")); return window.spirit.required.spirit.element.codeMirror.create(d, { mode: "edit", text: "one needle", words: "needle" }).then(function () { return JSON.stringify({ drawn: !!d.querySelector(".CodeMirror"), marks: d.querySelectorAll(".text-view-match").length, cssLoaded: getComputedStyle(d.querySelector(".CodeMirror")).position === "relative", search: !!(window.CodeMirror.commands && window.CodeMirror.commands.find) }); }); })()')); } catch (e) { L.cm = {}; }
  L.fromHere = await L.page.evaluate('performance.getEntriesByType("resource").map(function (r) { return r.name; }).filter(function (u) { return /codemirror/i.test(u); }).join(" ")').catch(function () { return ''; });
  return (L.cm.drawn === true && L.cm.marks === 1 && L.cm.cssLoaded === true && L.cm.search === true) || false;
}, test.limit.slow);
test.run('the page asked the library\'s new place only', 0.2, function () {
  return (/spirit\/element\/codeMirror\/lib\/codemirror\.js/.test(L.fromHere) && !/shell\/node_modules/.test(L.fromHere)) || false;
}, test.limit.quick);

test.after(function () {
  try { if (L.page && L.page.kid) L.page.kid.kill(); } catch (e) { /* gone */ }
  try { if (L.node && L.node.child) L.node.child.kill(); } catch (e) { /* gone */ }
  try { if (L.page && L.page.profile) fs.rmSync(L.page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (L.node && L.node.root) LOADER.requireScript('spirit/test/headLessChrome.js').freeTree(L.node); } catch (e) { /* left */ }
});

// REFRESHED WHEN IT BECOMES VISIBLE (goal/G48.5; Andy: "there's something that the codeMirror element does when it is
// activated. and it makes the text display properly aligned inside the codeMirror box. It should do the same thing when it
// becomes visible."). What CodeMirror does when activated is refresh(), its measure and redraw. The page's two ways of being told
// a box is shown, IntersectionObserver and ResizeObserver, stand in the world as recorders; a view made in a hidden box is then
// told its box shows, by whichever it watches with, and CodeMirror is refreshed once more.
test.run('a view made in a hidden box is refreshed again when its box becomes visible', 0.4, async function () {
  if (!S.E) return false;
  const watched = [];
  const Recorder = function (kind) { return function (fn) { const o = { kind: kind, fn: fn, targets: [], observe: function (t) { o.targets.push(t); }, unobserve: function () {}, disconnect: function () {} }; watched.push(o); return o; }; };
  S.win.IntersectionObserver = Recorder('intersection');
  S.win.ResizeObserver = Recorder('resize');
  const host = { id: 'host-hidden', offsetWidth: 0, offsetHeight: 0, getClientRects: function () { return []; } };
  await S.E.create(host, { mode: 'read', text: 'one\ntwo', path: 'shown.md' });
  await settle();
  const cm = S.w.made[S.w.made.length - 1];
  const before = cm ? cm.refreshed : 0;
  host.offsetWidth = 400; host.offsetHeight = 200; host.getClientRects = function () { return [{ width: 400, height: 200 }]; };
  watched.forEach(function (o) {
    const entry = { target: o.targets[0] || host, isIntersecting: true, intersectionRatio: 1, contentRect: { width: 400, height: 200 } };
    try { o.fn([entry], o); } catch (e) { /* a recorder the element does not use */ }
  });
  await settle();
  delete S.win.IntersectionObserver; delete S.win.ResizeObserver;
  return (!!cm && watched.length > 0 && cm.refreshed > before) || false;
}, test.limit.quick);
