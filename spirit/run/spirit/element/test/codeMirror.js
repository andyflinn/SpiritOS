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

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
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

test.startTest('codeMirror.js: the CodeMirror shell element, read and edit');

(async function () {
  test.subHeading('it is there, by its name');
  const there = fs.existsSync(FILE);
  ok(there, 'spirit/element/codeMirror.js exists', 'spirit/element/codeMirror.js is not there');
  const SRC = there ? fs.readFileSync(FILE, 'utf8') : '';
  const { w, win } = world();
  if (there) {
    try { vm.runInContext(SRC, win, { filename: FILE }); } catch (e) { test.fail('it threw as it loaded: ' + e.message); }
  }
  await settle();
  // goal/G43.32: it stands at its path.
  const E = ((win.spirit.element.spirit || {}).element || {}).codeMirror;
  ok(!!E && typeof E.create === 'function', 'it puts itself on window.spirit.element as codeMirror, with create', 'no window.spirit.element.spirit.element.codeMirror.create');

  test.subHeading('it loads the library itself, never through index.html (goal/G40.7)');
  let read = null;
  if (E) { try { read = await E.create({ id: 'host-1' }, { mode: 'read', text: 'alpha beta\ngamma beta', words: 'beta', path: 'notes.md' }); } catch (e) { test.fail('create threw: ' + e.message); } }
  await settle();
  ok(w.required.indexOf(CM + 'lib/codemirror.js') !== -1, 'it requires CodeMirror\'s lib/codemirror.js through spirit.require', 'required ' + short(w.required) + ', not ' + CM + 'lib/codemirror.js');
  ok(asked(w).indexOf(CM + 'mode/markdown/markdown.js') !== -1 && w.required.indexOf(CM + 'mode/markdown/markdown.js') !== -1,
    'and the mode file of the path\'s syntax (a .md file: mode/markdown/markdown.js)', 'asked: ' + short(asked(w)));
  ['lib/codemirror.css', 'theme/material-darker.css'].forEach(function (css) {
    const put = asked(w).some(function (p) { return p.replace(/^\/+/, '') === CM + css; });
    if (css === 'lib/codemirror.css') ok(put, 'its stylesheet lib/codemirror.css is put on the page', 'asked: ' + short(asked(w)));
    else ok(put, 'its stylesheet theme/material-darker.css is put on the page', 'asked: ' + short(asked(w)));
  });
  ok(there && w.required.length > 0 && !asked(w).some(function (p) { return /index\.html/.test(p); }) && !/index\.html/.test(SRC.replace(/\/\/.*$/gm, '')),
    'nothing of it reads or asks for index.html', 'index.html asked: ' + short(asked(w).filter(function (p) { return /index\.html/.test(p); })));

  test.subHeading('read mode: the text shown, not editable');
  const r = w.made[0];
  ok(!!read && read.mode === 'read' && !!r && r.cfg.readOnly === true, 'a read view is a read-only CodeMirror', 'view ' + short(read && read.mode) + ', readOnly ' + short(r && r.cfg.readOnly));
  if (r) {
    ok(r.cfg.value === 'alpha beta\ngamma beta', 'it shows the text it was given', 'value: ' + short(r.cfg.value));
    r.type('changed');
    ok(read && read.value() === 'alpha beta\ngamma beta', 'typing into a read view changes nothing', 'value after typing: ' + short(read && read.value()));
    ok(r.cfg.lineNumbers === true && r.cfg.lineWrapping === true && r.cfg.theme === 'material-darker', 'line numbers and wrapping on, the theme material-darker',
      'cfg: ' + short({ lineNumbers: r.cfg.lineNumbers, lineWrapping: r.cfg.lineWrapping, theme: r.cfg.theme }));
    ok(r.cfg.mode === 'markdown', 'a .md file is coloured as markdown', 'mode: ' + short(r.cfg.mode));
  }

  test.subHeading('the words: every match marked, the first in view');
  if (r) {
    const live = r.marks.filter(function (m) { return !m.cleared; });
    ok(live.length === 2 && live.every(function (m) { return m.o && m.o.className === 'text-view-match'; }), 'every match is marked with the class text-view-match', 'marks: ' + short(live.map(function (m) { return m.o; })));
    ok(r.cursor && r.cursor.line === 0 && r.cursor.ch === 6, 'the first match gets the cursor', 'cursor: ' + short(r.cursor));
    ok(r.scrolled.some(function (p) { return p.line === 0 && p.ch === 6; }), 'and is scrolled into view', 'scrolled: ' + short(r.scrolled));
    ok(r.refreshed > 0, 'CodeMirror is refreshed after the turn it was made in (a hidden box measures nothing)', 'refreshed ' + r.refreshed + ' times');
    const n = read ? read.mark('gamma') : -1;
    ok(n === 1 && r.marks.filter(function (m) { return !m.cleared; }).length === 1, 'mark(words) marks again, the old marks cleared, and answers how many', 'mark answered ' + n + ', live marks ' + r.marks.filter(function (m) { return !m.cleared; }).length);
  }
  let atLine = null;
  if (E) { try { atLine = await E.create({ id: 'host-2' }, { mode: 'read', text: 'one\ntwo beta\nthree\nfour', words: 'beta', line: 4, path: 'a.txt' }); } catch (e) { test.fail('create with a line threw: ' + e.message); } }
  await settle();
  const l = w.made[1];
  ok(!!atLine && !!l && l.cursor && l.cursor.line === 3, 'a line asked for wins over the first match (line 4 is put in view)', 'cursor: ' + short(l && l.cursor));
  ok(!!l && (l.cfg.mode == null || l.cfg.mode === ''), 'a .txt file has no mode', 'mode: ' + short(l && l.cfg.mode));

  test.subHeading('edit mode: the text editable, value() what was typed');
  let edit = null;
  if (E) { try { edit = await E.create({ id: 'host-3' }, { mode: 'edit', text: '{"a":1}', path: 'x.json' }); } catch (e) { test.fail('create in edit mode threw: ' + e.message); } }
  await settle();
  const e3 = w.made[2];
  ok(!!edit && edit.mode === 'edit' && !!e3 && e3.cfg.readOnly !== true, 'an edit view is an editable CodeMirror', 'view ' + short(edit && edit.mode) + ', readOnly ' + short(e3 && e3.cfg.readOnly));
  if (e3 && edit) {
    e3.type('{"a":2}');
    ok(edit.value() === '{"a":2}', 'value() answers the text as typed', 'value: ' + short(edit.value()));
    ok(e3.cfg.mode && e3.cfg.mode.name === 'javascript' && e3.cfg.mode.json === true, 'a .json file is javascript with json: true', 'mode: ' + short(e3.cfg.mode));
    ok(edit.cm === e3, 'the view hands its CodeMirror as cm', 'cm is not the CodeMirror made');
  }
  let bare = null;
  if (E) { try { bare = await E.create({ id: 'host-4' }, { path: 'y.js' }); } catch (e) { test.fail('create with no mode threw: ' + e.message); } }
  await settle();
  const b = w.made[3];
  ok(!!bare && bare.mode === 'read' && !!b && b.cfg.readOnly === true && b.cfg.value === '', 'no mode is read, and no text is the empty string', 'view ' + short(bare && bare.mode) + ', value ' + short(b && b.cfg.value));
  ok(!!b && b.cfg.mode === 'javascript' && w.required.indexOf(CM + 'mode/javascript/javascript.js') !== -1, 'a .js file is javascript, its mode file required', 'mode ' + short(b && b.cfg.mode));
  const syntax = { 'a.mjs': 'javascript', 'a.css': 'css', 'a.html': 'htmlmixed', 'a.htm': 'htmlmixed', 'a.xml': 'xml', 'a.svg': 'xml' };
  for (const p of Object.keys(syntax)) {
    let v = null;
    if (E) { try { v = await E.create({ id: p }, { mode: 'read', text: '', path: p }); } catch (e) { v = null; } }
    const c = v && v.cm;
    const coloured = !!c && c.cfg.mode === syntax[p];
    const why = p + ': ' + short(c && c.cfg.mode);
    if (p === 'a.mjs') ok(coloured, 'a .mjs file is coloured as javascript', why);
    else if (p === 'a.css') ok(coloured, 'a .css file is coloured as css', why);
    else if (p === 'a.html') ok(coloured, 'a .html file is coloured as htmlmixed', why);
    else if (p === 'a.htm') ok(coloured, 'a .htm file is coloured as htmlmixed', why);
    else if (p === 'a.xml') ok(coloured, 'an .xml file is coloured as xml', why);
    else ok(coloured, 'an .svg file is coloured as xml', why);
  }

  test.subHeading('in a fill box it takes exactly the box (rule/16; Andy, on G41.7)');
  const css = fs.readFileSync(path.join(RUN, 'spirit', 'shell', 'shell.css'), 'utf8');
  ok(/\.text-view\.fill\s*>\s*\.CodeMirror\s*\{[^}]*flex:\s*1 1 0[^}]*min-height:\s*0/.test(css), 'shell.css lets CodeMirror in a fill box take the box and scroll inside it', 'no .text-view.fill > .CodeMirror rule in shell.css');

  test.subHeading('it replaces textView.js, which goes');
  ok(!fs.existsSync(path.join(RUN, 'spirit', 'element', 'textView.js')), 'spirit/element/textView.js is gone', 'spirit/element/textView.js is still there');
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
  ok(users.length === 0, 'nothing in the tree loads textView.js or calls createTextView', 'still using it: ' + users.join(', '));
}()).catch(function (e) { test.fail('the test threw ' + (e && e.stack || e)); })
  .then(async function () {
    try { await libraryPart(); } catch (e) { test.fail('the library part threw ' + (e && e.stack || e)); }
  })
  .then(function () { test.reportSuccessFailureCount(); process.exit(process.exitCode || 0); });

// THE CodeMirror LIBRARY IN spirit/element/codeMirror/, codeMirror.js's OWN FOLDER (goal/G43.5; spec: ./codeMirror.md,
// "The CodeMirror library"). Andy, live: "ALL move the fucking library inside run::/spirit/element/codeMirror/", and "only
// access to codeMirror library is through the element!". Its 15 files stand there and shell/node_modules is gone; no
// product file but the element names the folder; on a real page the page starts with no CodeMirror, and the element draws
// from there with its sheet, its marks and its search keys, asking no other place. The rest of the element move is
// spirit/test/spirit.js, its elementMove part.
async function libraryPart() {
  const { execSync } = require('child_process');
  const REPO = path.resolve(RUN, '../..');
  const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
  function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600); }

  const tracked = execSync('git ls-files', { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean);
  const IN_RUN = tracked.filter(function (f) { return f.indexOf('spirit/run/') === 0; }).map(function (f) { return f.slice('spirit/run/'.length); });

  test.subHeading('the library: CodeMirror inside spirit/element/codeMirror/, reached only through the element (goal/G43.5)');
  // Andy, live: "ALL move the fucking library inside run::/spirit/element/codeMirror/"
  test.subHeading('the library: CodeMirror inside spirit/element/codeMirror/');
  const lib = IN_RUN.filter(function (f) { return f.indexOf('spirit/element/codeMirror/') === 0; });
  ok(lib.indexOf('spirit/element/codeMirror/lib/codemirror.js') !== -1 && lib.indexOf('spirit/element/codeMirror/LICENSE') !== -1 && lib.length === 15, 'its 15 files, licence included, stand in spirit/element/codeMirror/', 'spirit/element/codeMirror/ holds ' + lib.length + ' files');
  // Andy: "only access to codeMirror library is through the element!"
  const asking = tracked.filter(function (f) { return /\.(js|html|css)$/.test(f) && f.indexOf('spirit/run/') === 0 && !/\/test\//.test(f) && f !== 'spirit/run/spirit/element/codeMirror.js' && f.indexOf('spirit/run/spirit/element/codeMirror/') !== 0 && !/^spirit\/run\/test\//.test(f); }).filter(function (f) {
    return fs.existsSync(path.join(REPO, f)) && /element\/codeMirror\//.test(fs.readFileSync(path.join(REPO, f), 'utf8').split('\n').map(function (l) { const cut = l.search(/(^|[^:'"])\/\//); return cut === -1 ? l : l.slice(0, cut + 1); }).join('\n'));
  });
  ok(!asking.length, 'no product file but the element names the library\'s folder', 'these name it: ' + short(asking));
  ok(!IN_RUN.some(function (f) { return f.indexOf('shell/node_modules/') === 0; }) && !fs.existsSync(path.join(RUN, 'shell/node_modules')), 'shell/node_modules is gone', 'shell/node_modules still stands');

  test.subHeading('the page: "only access to codeMirror library is through the element!"');
  const chrome = H.findChrome();
  if (!chrome) { test.fail('no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name'); return; }
  const node = await H.scratchNode();
  let page = null;
  try {
    page = node.up ? await H.chromePage(chrome) : null;
    if (!page || page.error) { test.fail(page ? page.error : 'the scratch node did not come up'); return; }
    await page.send('Page.navigate', { url: node.base + '/' });
    await H.until(function () { return page.evaluate('!!(window.spirit && window.spirit.ready)').then(Boolean); }, H.WAIT);
    await H.sleep(2500);
    let at = {};
    try { at = JSON.parse(await page.evaluate('JSON.stringify({ library: typeof window.CodeMirror })')); } catch (e) { at = {}; }
    ok(at.library === 'undefined', 'the page starts with no CodeMirror on it: "only access to codeMirror library is through the element!"', 'at start window.CodeMirror is ' + short(at.library));
    await page.evaluate('Promise.resolve(window.spirit.require("spirit/element/codeMirror.js")).then(function () { return true; }, function () { return false; })');
    let cm = {};
    try { cm = JSON.parse(await page.evaluate('(function () { var d = document.body.appendChild(document.createElement("div")); return window.spirit.element.spirit.element.codeMirror.create(d, { mode: "edit", text: "one needle", words: "needle" }).then(function () { return JSON.stringify({ drawn: !!d.querySelector(".CodeMirror"), marks: d.querySelectorAll(".text-view-match").length, cssLoaded: getComputedStyle(d.querySelector(".CodeMirror")).position === "relative", search: !!(window.CodeMirror.commands && window.CodeMirror.commands.find) }); }); })()')); } catch (e) { cm = { threw: String(e) }; }
    const fromHere = await page.evaluate('performance.getEntriesByType("resource").map(function (r) { return r.name; }).filter(function (u) { return /codemirror/i.test(u); }).join(" ")').catch(function () { return ''; });
    ok(cm.drawn === true && cm.marks === 1 && cm.cssLoaded === true && cm.search === true, 'the element draws from there, its sheet, its marks and its search keys with it', 'codeMirror: ' + short(cm));
    ok(/spirit\/element\/codeMirror\/lib\/codemirror\.js/.test(fromHere) && !/shell\/node_modules/.test(fromHere), 'and the page asked the new place only', 'the page asked: ' + short(fromHere));
  } finally {
    if (page && page.kid) page.kid.kill();
    if (node.child) node.child.kill();
    try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
  }
}
