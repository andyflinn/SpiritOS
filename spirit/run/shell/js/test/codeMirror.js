'use strict';

// spirit/run/shell/js/test/codeMirror.js
// The tests of shell/js/codeMirror.js, and of no other module (spec: ./codeMirror.md; goal/G41.7). The browser file
// runs in node on a window of its own: CodeMirror is a recorder standing in for the library, handed over when the
// element requires the library's path; every loader the page offers (spirit.require, the file viewer's read, a link
// tag) writes down what it was asked for.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'codeMirror.js');
const CM = 'shell/node_modules/codemirror/';

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
      fileViewer: { read: function (p) { w.read.push(String(p)); return Promise.resolve({ status: 200, type: 'text/css', bytes: new TextEncoder().encode('/* ' + p + ' */') }); } },
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
  vm.createContext(win);
  return { w: w, win: win };
}
function asked(w) { return w.required.concat(w.read).concat(w.links.map(function (l) { return String(l.href || ''); })); }

test.startTest('codeMirror.js: the CodeMirror shell element, read and edit');

(async function () {
  test.subHeading('it is there, by its name');
  const there = fs.existsSync(FILE);
  ok(there, 'shell/js/codeMirror.js exists', 'shell/js/codeMirror.js is not there');
  const SRC = there ? fs.readFileSync(FILE, 'utf8') : '';
  const { w, win } = world();
  if (there) {
    try { vm.runInContext(SRC, win, { filename: FILE }); } catch (e) { test.fail('it threw as it loaded: ' + e.message); }
  }
  const E = win.spirit.elements.codeMirror;
  ok(!!E && typeof E.create === 'function', 'it puts itself on window.spirit.elements as codeMirror, with create', 'no window.spirit.elements.codeMirror.create');

  test.subHeading('it loads the library itself, never through index.html (goal/G40.7)');
  let read = null;
  if (E) { try { read = await E.create({ id: 'host-1' }, { mode: 'read', text: 'alpha beta\ngamma beta', words: 'beta', path: 'notes.md' }); } catch (e) { test.fail('create threw: ' + e.message); } }
  await settle();
  ok(w.required.indexOf(CM + 'lib/codemirror.js') !== -1, 'it requires ' + CM + 'lib/codemirror.js through spirit.require', 'required: ' + short(w.required));
  ok(asked(w).indexOf(CM + 'mode/markdown/markdown.js') !== -1 && w.required.indexOf(CM + 'mode/markdown/markdown.js') !== -1,
    'and the mode file of the path\'s syntax (a .md file: mode/markdown/markdown.js)', 'asked: ' + short(asked(w)));
  ['lib/codemirror.css', 'theme/material-darker.css'].forEach(function (css) {
    ok(asked(w).some(function (p) { return p.replace(/^\/+/, '') === CM + css; }), 'its stylesheet ' + css + ' is put on the page', 'asked: ' + short(asked(w)));
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
    ok(!!c && c.cfg.mode === syntax[p], p + ' is coloured as ' + syntax[p], p + ': ' + short(c && c.cfg.mode));
  }

  test.subHeading('in a fill box it takes exactly the box (rule/16; Andy, on G41.7)');
  const css = fs.readFileSync(path.join(RUN, 'shell.css'), 'utf8');
  ok(/\.text-view\.fill\s*>\s*\.CodeMirror\s*\{[^}]*flex:\s*1 1 0[^}]*min-height:\s*0/.test(css), 'shell.css lets CodeMirror in a fill box take the box and scroll inside it', 'no .text-view.fill > .CodeMirror rule in shell.css');

  test.subHeading('it replaces textView.js, which goes');
  ok(!fs.existsSync(path.join(RUN, 'shell', 'js', 'textView.js')), 'shell/js/textView.js is gone', 'shell/js/textView.js is still there');
  const users = [];
  (function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
      if (e.name === 'node_modules' || e.name === 'relay-state' || e.name === 'test' || e.name.charAt(0) === '.') return;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return walk(p);
      if (!/\.(js|html)$/.test(e.name)) return;
      const text = fs.readFileSync(p, 'utf8');
      if (/createTextView/.test(text) || /src="\/?shell\/js\/textView\.js"/.test(text) || /require\(\s*['"]\/?shell\/js\/textView\.js/.test(text) || /'shell\/js\/textView\.js'\]/.test(text)) users.push(path.relative(RUN, p));
    });
  }(RUN));
  ok(users.length === 0, 'nothing in the tree loads textView.js or calls createTextView', 'still using it: ' + users.join(', '));
}()).then(function () { test.reportSuccessFailureCount(); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); });
