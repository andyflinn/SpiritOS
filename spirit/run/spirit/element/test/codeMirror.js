'use strict';

// spirit/run/spirit/element/test/codeMirror.js
// The tests of spirit/element/codeMirror.js, and of no other module (spec: ./codeMirror.md; goal/G41.7). The browser file
// runs in node on a window of its own: CodeMirror is a recorder standing in for the library, handed over when the
// element requires the library's path; every loader the page offers (spirit.require, fstat's read, a link
// tag) writes down what it was asked for.
// Its last part, libraryPart (once codeMirror-library.js, goal/G43.5), checks the library in spirit/element/codeMirror/ on
// a real page: the one test file of codeMirror.js (spirit/run/spirit/test/TEST_SYSTEM.md).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const VENDORED_FOLDERS = require(path.join(RUN, 'spirit', 'fileSystem.js')).VENDORED_FOLDERS;
const FILE = path.join(__dirname, '..', 'codeMirror.js');
const CM = 'spirit/element/codeMirror/';

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
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
    require: function (p) {
      const q = String(p).replace(/^\/+/, '');
      w.required.push(q);
      if (q === CM + 'lib/codemirror.js') { win.CodeMirror = CodeMirror; return Promise.resolve(CodeMirror); }
      return Promise.resolve({});
    },
  };
  // goal/G43.32: codeMirror.js places itself by installSpiritElement; the recorder hands that helper to the page stand-in
  // (spirit/test/headLessChrome.js pageSpirit), and writes down only what the element asks for besides.
  const own = win.spirit.require;
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(win.spirit);
  const pageRequire = win.spirit.require;
  win.spirit.require = function (p) { return /installSpiritElement\.js$/.test(p) ? pageRequire(p) : own(p); };
  vm.createContext(win);
  return { w: w, win: win };
}
function asked(w) { return w.required.concat(w.read).concat(w.links.map(function (l) { return String(l.href || ''); })); }


// What the tests share, made by the first ones.
const S = { there: false, src: '', w: null, win: null, E: null, read: null, atLine: null, edit: null, bare: null, views: {} };

test.run('spirit/element/codeMirror.js exists', 0.2, function () {
  S.there = fs.existsSync(FILE);
  S.src = S.there ? fs.readFileSync(FILE, 'utf8') : '';
  return S.there || 'spirit/element/codeMirror.js is not there';
}, 1000);
test.run('it puts itself on window.spirit.element as codeMirror, with create', 0.2, async function () {
  const made = world();
  S.w = made.w; S.win = made.win;
  if (S.there) vm.runInContext(S.src, S.win, { filename: FILE });
  await settle();
  S.E = ((S.win.spirit.element.spirit || {}).element || {}).codeMirror;
  return (!!S.E && typeof S.E.create === 'function') || 'no window.spirit.element.spirit.element.codeMirror.create';
}, 2000);

// It loads the library itself, never through index.html (goal/G40.7).
test.run('it requires CodeMirror\'s lib/codemirror.js through spirit.require', 0.2, async function () {
  if (!S.E) return 'no element: the world failed';
  S.read = await S.E.create({ id: 'host-1' }, { mode: 'read', text: 'alpha beta\ngamma beta', words: 'beta', path: 'notes.md' });
  await settle();
  return S.w.required.indexOf(CM + 'lib/codemirror.js') !== -1 || 'required ' + short(S.w.required) + ', not ' + CM + 'lib/codemirror.js';
}, 2000);
test.run('and the mode file of the path\'s syntax (a .md file: mode/markdown/markdown.js)', 0.2, function () {
  return (asked(S.w).indexOf(CM + 'mode/markdown/markdown.js') !== -1 && S.w.required.indexOf(CM + 'mode/markdown/markdown.js') !== -1) || 'asked: ' + short(asked(S.w));
}, 1000);
test.run('its stylesheet lib/codemirror.css is put on the page', 0.2, function () {
  return asked(S.w).some(function (p) { return p.replace(/^\/+/, '') === CM + 'lib/codemirror.css'; }) || 'asked: ' + short(asked(S.w));
}, 1000);
test.run('its stylesheet theme/material-darker.css is put on the page', 0.2, function () {
  return asked(S.w).some(function (p) { return p.replace(/^\/+/, '') === CM + 'theme/material-darker.css'; }) || 'asked: ' + short(asked(S.w));
}, 1000);
test.run('nothing of it reads or asks for index.html', 0.2, function () {
  return (S.there && S.w.required.length > 0 && !asked(S.w).some(function (p) { return /index\.html/.test(p); }) && !/index\.html/.test(S.src.replace(/\/\/.*$/gm, ''))) || 'index.html asked: ' + short(asked(S.w).filter(function (p) { return /index\.html/.test(p); }));
}, 1000);

// Read mode: the text shown, not editable.
test.run('a read view is a read-only CodeMirror', 0.2, function () {
  const r = S.w && S.w.made[0];
  return (!!S.read && S.read.mode === 'read' && !!r && r.cfg.readOnly === true) || 'view ' + short(S.read && S.read.mode) + ', readOnly ' + short(r && r.cfg.readOnly);
}, 1000);
test.run('it shows the text it was given', 0.2, function () {
  const r = S.w && S.w.made[0];
  return (!!r && r.cfg.value === 'alpha beta\ngamma beta') || 'value: ' + short(r && r.cfg.value);
}, 1000);
test.run('typing into a read view changes nothing', 0.2, function () {
  const r = S.w && S.w.made[0];
  if (!r) return 'no read view: the world failed';
  r.type('changed');
  return (S.read && S.read.value() === 'alpha beta\ngamma beta') || 'value after typing: ' + short(S.read && S.read.value());
}, 1000);
test.run('line numbers and wrapping on, the theme material-darker', 0.2, function () {
  const r = S.w && S.w.made[0];
  return (!!r && r.cfg.lineNumbers === true && r.cfg.lineWrapping === true && r.cfg.theme === 'material-darker') || 'cfg: ' + short(r && { lineNumbers: r.cfg.lineNumbers, lineWrapping: r.cfg.lineWrapping, theme: r.cfg.theme });
}, 1000);
test.run('a .md file is coloured as markdown', 0.2, function () {
  const r = S.w && S.w.made[0];
  return (!!r && r.cfg.mode === 'markdown') || 'mode: ' + short(r && r.cfg.mode);
}, 1000);

// The words: every match marked, the first in view.
test.run('every match is marked with the class text-view-match', 0.2, function () {
  const r = S.w && S.w.made[0];
  const live = r ? r.marks.filter(function (m) { return !m.cleared; }) : [];
  return (live.length === 2 && live.every(function (m) { return m.o && m.o.className === 'text-view-match'; })) || 'marks: ' + short(live.map(function (m) { return m.o; }));
}, 1000);
test.run('the first match gets the cursor', 0.2, function () {
  const r = S.w && S.w.made[0];
  return (!!r && !!r.cursor && r.cursor.line === 0 && r.cursor.ch === 6) || 'cursor: ' + short(r && r.cursor);
}, 1000);
test.run('and is scrolled into view', 0.2, function () {
  const r = S.w && S.w.made[0];
  return (!!r && r.scrolled.some(function (p) { return p.line === 0 && p.ch === 6; })) || 'scrolled: ' + short(r && r.scrolled);
}, 1000);
test.run('CodeMirror is refreshed after the turn it was made in (a hidden box measures nothing)', 0.2, function () {
  const r = S.w && S.w.made[0];
  return (!!r && r.refreshed > 0) || 'refreshed ' + (r ? r.refreshed : 'no view') + ' times';
}, 1000);
test.run('mark(words) marks again, the old marks cleared, and answers how many', 0.2, function () {
  const r = S.w && S.w.made[0];
  if (!r || !S.read) return 'no read view: the world failed';
  const n = S.read.mark('gamma');
  const live = r.marks.filter(function (m) { return !m.cleared; }).length;
  return (n === 1 && live === 1) || 'mark answered ' + n + ', live marks ' + live;
}, 1000);
test.run('a line asked for wins over the first match (line 4 is put in view)', 0.2, async function () {
  if (!S.E) return 'no element: the world failed';
  S.atLine = await S.E.create({ id: 'host-2' }, { mode: 'read', text: 'one\ntwo beta\nthree\nfour', words: 'beta', line: 4, path: 'a.txt' });
  await settle();
  const l = S.w.made[1];
  return (!!S.atLine && !!l && !!l.cursor && l.cursor.line === 3) || 'cursor: ' + short(l && l.cursor);
}, 2000);
test.run('a .txt file has no mode', 0.2, function () {
  const l = S.w && S.w.made[1];
  return (!!l && (l.cfg.mode == null || l.cfg.mode === '')) || 'mode: ' + short(l && l.cfg.mode);
}, 1000);

// Edit mode: the text editable, value() what was typed.
test.run('an edit view is an editable CodeMirror', 0.2, async function () {
  if (!S.E) return 'no element: the world failed';
  S.edit = await S.E.create({ id: 'host-3' }, { mode: 'edit', text: '{"a":1}', path: 'x.json' });
  await settle();
  const e3 = S.w.made[2];
  return (!!S.edit && S.edit.mode === 'edit' && !!e3 && e3.cfg.readOnly !== true) || 'view ' + short(S.edit && S.edit.mode) + ', readOnly ' + short(e3 && e3.cfg.readOnly);
}, 2000);
test.run('value() answers the text as typed', 0.2, function () {
  const e3 = S.w && S.w.made[2];
  if (!e3 || !S.edit) return 'no edit view: the world failed';
  e3.type('{"a":2}');
  return S.edit.value() === '{"a":2}' || 'value: ' + short(S.edit.value());
}, 1000);
test.run('a .json file is javascript with json: true', 0.2, function () {
  const e3 = S.w && S.w.made[2];
  return (!!e3 && !!e3.cfg.mode && e3.cfg.mode.name === 'javascript' && e3.cfg.mode.json === true) || 'mode: ' + short(e3 && e3.cfg.mode);
}, 1000);
test.run('the view hands its CodeMirror as cm', 0.2, function () {
  const e3 = S.w && S.w.made[2];
  return (!!S.edit && !!e3 && S.edit.cm === e3) || 'cm is not the CodeMirror made';
}, 1000);
test.run('no mode is read, and no text is the empty string', 0.2, async function () {
  if (!S.E) return 'no element: the world failed';
  S.bare = await S.E.create({ id: 'host-4' }, { path: 'y.js' });
  await settle();
  const b = S.w.made[3];
  return (!!S.bare && S.bare.mode === 'read' && !!b && b.cfg.readOnly === true && b.cfg.value === '') || 'view ' + short(S.bare && S.bare.mode) + ', value ' + short(b && b.cfg.value);
}, 2000);
test.run('a .js file is javascript, its mode file required', 0.2, function () {
  const b = S.w && S.w.made[3];
  return (!!b && b.cfg.mode === 'javascript' && S.w.required.indexOf(CM + 'mode/javascript/javascript.js') !== -1) || 'mode ' + short(b && b.cfg.mode);
}, 1000);
// Each file kind, written out: a view of an empty text at that path, and the mode it is coloured in.
const colouredAs = async function (p, mode) {
  if (!S.E) return 'no element: the world failed';
  const v = await S.E.create({ id: p }, { mode: 'read', text: '', path: p });
  const c = v && v.cm;
  return (!!c && c.cfg.mode === mode) || p + ': ' + short(c && c.cfg.mode);
};
test.run('a .mjs file is coloured as javascript', 0.2, function () { return colouredAs('a.mjs', 'javascript'); }, 2000);
test.run('a .css file is coloured as css', 0.2, function () { return colouredAs('a.css', 'css'); }, 2000);
test.run('a .html file is coloured as htmlmixed', 0.2, function () { return colouredAs('a.html', 'htmlmixed'); }, 2000);
test.run('a .htm file is coloured as htmlmixed', 0.2, function () { return colouredAs('a.htm', 'htmlmixed'); }, 2000);
test.run('an .xml file is coloured as xml', 0.2, function () { return colouredAs('a.xml', 'xml'); }, 2000);
test.run('an .svg file is coloured as xml', 0.2, function () { return colouredAs('a.svg', 'xml'); }, 2000);

// In a fill box it takes exactly the box (rule/16; Andy, on G41.7).
test.run('shell.css lets CodeMirror in a fill box take the box and scroll inside it', 0.2, function () {
  const css = fs.readFileSync(path.join(RUN, 'spirit', 'shell', 'shell.css'), 'utf8');
  return /\.text-view\.fill\s*>\s*\.CodeMirror\s*\{[^}]*flex:\s*1 1 0[^}]*min-height:\s*0/.test(css) || 'no .text-view.fill > .CodeMirror rule in shell.css';
}, 1000);

// It replaces textView.js, which goes.
test.run('spirit/element/textView.js is gone', 0.2, function () {
  return !fs.existsSync(path.join(RUN, 'spirit', 'element', 'textView.js')) || 'spirit/element/textView.js is still there';
}, 1000);
test.run('nothing in the tree loads textView.js or calls createTextView', 0.2, function () {
  const users = [];
  (function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
      const p = path.join(dir, e.name);
      if (VENDORED_FOLDERS.holds(p) || e.name === 'state' || e.name === 'test' || e.name.charAt(0) === '.') return;
      if (e.isDirectory()) return walk(p);
      if (!/\.(js|html)$/.test(e.name)) return;
      const text = fs.readFileSync(p, 'utf8');
      if (/createTextView/.test(text) || /src="\/?spirit\/element\/textView\.js"/.test(text) || /require\(\s*['"]\/?spirit\/element\/textView\.js/.test(text) || /'spirit\/element\/textView\.js'\]/.test(text)) users.push(path.relative(RUN, p));
    });
  }(RUN));
  return users.length === 0 || 'still using it: ' + users.join(', ');
}, 5000);

// THE CodeMirror LIBRARY IN spirit/element/codeMirror/, codeMirror.js's OWN FOLDER (goal/G43.5; spec: ./codeMirror.md,
// "The CodeMirror library"). Andy, live: "ALL move the fucking library inside run::/spirit/element/codeMirror/", and "only
// access to codeMirror library is through the element!". Its 15 files stand there and shell/node_modules is gone; no
// product file but the element names the folder; on a real page the page starts with no CodeMirror, and the element draws
// from there with its sheet, its marks and its search keys, asking no other place. The rest of the element move is
// spirit/test/spirit.js, its elementMove part.
const REPO = path.resolve(RUN, '../..');
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const L = { tracked: [], inRun: [], node: null, page: null, at: {}, cm: {}, fromHere: '' };
const longShort = function (x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600); };

test.run('its 15 files, licence included, stand in spirit/element/codeMirror/', 0.2, function () {
  L.tracked = require('child_process').execSync('git ls-files', { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean);
  L.inRun = L.tracked.filter(function (f) { return f.indexOf('spirit/run/') === 0; }).map(function (f) { return f.slice('spirit/run/'.length); });
  const lib = L.inRun.filter(function (f) { return f.indexOf('spirit/element/codeMirror/') === 0; });
  return (lib.indexOf('spirit/element/codeMirror/lib/codemirror.js') !== -1 && lib.indexOf('spirit/element/codeMirror/LICENSE') !== -1 && lib.length === 15) || 'spirit/element/codeMirror/ holds ' + lib.length + ' files';
}, 3000);
// Andy: "only access to codeMirror library is through the element!"
test.run('no product file but the element names the library\'s folder', 0.2, function () {
  const asking = L.tracked.filter(function (f) { return /\.(js|html|css)$/.test(f) && f.indexOf('spirit/run/') === 0 && !/\/test\//.test(f) && f !== 'spirit/run/spirit/element/codeMirror.js' && f.indexOf('spirit/run/spirit/element/codeMirror/') !== 0 && !/^spirit\/run\/test\//.test(f); }).filter(function (f) {
    return fs.existsSync(path.join(REPO, f)) && /element\/codeMirror\//.test(fs.readFileSync(path.join(REPO, f), 'utf8').split('\n').map(function (l) { const cut = l.search(/(^|[^:'"])\/\//); return cut === -1 ? l : l.slice(0, cut + 1); }).join('\n'));
  });
  return !asking.length || 'these name it: ' + longShort(asking);
}, 5000);
test.run('shell/node_modules is gone', 0.2, function () {
  return (!L.inRun.some(function (f) { return f.indexOf('shell/node_modules/') === 0; }) && !fs.existsSync(path.join(RUN, 'shell/node_modules'))) || 'shell/node_modules still stands';
}, 1000);
test.run('the world: a scratch node, and a Chrome page on it', 0.2, async function () {
  const chrome = H.findChrome();
  if (!chrome) return 'no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name';
  L.node = await H.scratchNode();
  if (!L.node.up) return 'the scratch node did not come up';
  L.page = await H.chromePage(chrome);
  if (!L.page || L.page.error) return L.page ? String(L.page.error) : 'no page';
  await L.page.send('Page.navigate', { url: L.node.base + '/' });
  const ready = await H.until(function () { return L.page.evaluate('!!(window.spirit && window.spirit.ready)').then(Boolean); }, H.WAIT);
  await H.sleep(2500);
  return !!ready || 'the page never had its spirit';
}, 60000);
test.run('the page starts with no CodeMirror on it: "only access to codeMirror library is through the element!"', 0.2, async function () {
  if (!L.page || L.page.error) return 'no page: the world failed';
  try { L.at = JSON.parse(await L.page.evaluate('JSON.stringify({ library: typeof window.CodeMirror })')); } catch (e) { L.at = {}; }
  return L.at.library === 'undefined' || 'at start window.CodeMirror is ' + longShort(L.at.library);
}, 5000);
test.run('the element draws from there, its sheet, its marks and its search keys with it', 0.2, async function () {
  if (!L.page || L.page.error) return 'no page: the world failed';
  await L.page.evaluate('Promise.resolve(window.spirit.require("spirit/element/codeMirror.js")).then(function () { return true; }, function () { return false; })');
  try { L.cm = JSON.parse(await L.page.evaluate('(function () { var d = document.body.appendChild(document.createElement("div")); return window.spirit.element.spirit.element.codeMirror.create(d, { mode: "edit", text: "one needle", words: "needle" }).then(function () { return JSON.stringify({ drawn: !!d.querySelector(".CodeMirror"), marks: d.querySelectorAll(".text-view-match").length, cssLoaded: getComputedStyle(d.querySelector(".CodeMirror")).position === "relative", search: !!(window.CodeMirror.commands && window.CodeMirror.commands.find) }); }); })()')); } catch (e) { L.cm = { threw: String(e) }; }
  L.fromHere = await L.page.evaluate('performance.getEntriesByType("resource").map(function (r) { return r.name; }).filter(function (u) { return /codemirror/i.test(u); }).join(" ")').catch(function () { return ''; });
  return (L.cm.drawn === true && L.cm.marks === 1 && L.cm.cssLoaded === true && L.cm.search === true) || 'codeMirror: ' + longShort(L.cm);
}, 15000);
test.run('and the page asked the new place only', 0.2, function () {
  return (/spirit\/element\/codeMirror\/lib\/codemirror\.js/.test(L.fromHere) && !/shell\/node_modules/.test(L.fromHere)) || 'the page asked: ' + longShort(L.fromHere);
}, 1000);

test.after(function () {
  try { if (L.page && L.page.kid) L.page.kid.kill(); } catch (e) { /* gone */ }
  try { if (L.node && L.node.child) L.node.child.kill(); } catch (e) { /* gone */ }
  try { if (L.page && L.page.profile) fs.rmSync(L.page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (L.node && L.node.root) fs.rmSync(L.node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
});
