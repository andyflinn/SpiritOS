'use strict';

// spirit/test/textViewCodeMirror.js
// goal/G29.12: the file display and the text editor on CodeMirror 5, the search words marked. Red on today's tree;
// claude-windows writes it and builds it (one agent). The item's box, in short:
//   - A file display and the text editor, both on CodeMirror 5: a file opens with given words, every match marked, the
//     first in view; the text editor edits and saves on the same CodeMirror, its plain text area gone.
//   - CodeMirror 5 is copied, licence included, into spirit/run/shell/node_modules/codemirror/: served as any file
//     (fileServable), kept out of the tree and Files as every node_modules is. No build step.
//   - .gitignore gains a second exception for spirit/run/shell/node_modules.
//   - The text launcher takes the words with the path; every match is marked the way the shared list marks a match, and
//     the first is scrolled into view.
//
// NAMED HERE where the box names none (argue them in Desk first if the build disagrees):
//   - one shell element, shell/js/textView.js: window.spiritElements.createTextView(container, { text, words,
//     readOnly, path }) answers { value(), cm }, on window.CodeMirror; it marks each match with className
//     'text-view-match' and scrolls the first into view. The launcher and the editor both make one.
//   - the text launcher (index.html) passes params.words through; the editor (shell/textEditor) saves view.value().
// No browser in the harness: the page is faked and window.CodeMirror is a stand-in that records what is asked of it,
// so what is asserted is what textView asks CodeMirror to do. The real page is looked at by hand after the build.
// rule/11: through testSupport only; its own folders; never 65432.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');

const OWED = 'OWED by goal/G29.12: ';
const REPO = path.resolve(__dirname, '..', '..');
const RUN = path.join(__dirname, '..', 'run');
const CM = path.join(RUN, 'shell', 'node_modules', 'codemirror');
const VIEW = path.join(RUN, 'shell', 'js', 'textView.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }
function code(file) { try { return fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); } catch (e) { return ''; } }
function tracked(rel) { return spawnSync('git', ['ls-files', '--', rel], { cwd: REPO, encoding: 'utf8' }).stdout.trim(); }

test.startTest('goal/G29.12: the file display and the text editor on CodeMirror 5, the search words marked');

// A stand-in for CodeMirror 5: the calls textView makes, kept. Positions are {line, ch}, as CodeMirror's are.
function fakeCodeMirror() {
  const made = [];
  function CodeMirror(place, opts) {
    let text = String((opts && opts.value) || '');
    const lineStarts = function () { const out = [0]; for (let i = 0; i < text.length; i++) if (text[i] === '\n') out.push(i + 1); return out; };
    const cm = {
      opts: opts || {}, marks: [], scrolled: [], place: place,
      getValue: function () { return text; },
      setValue: function (v) { text = String(v); cm.marks = []; },
      posFromIndex: function (i) { const s = lineStarts(); let line = 0; while (line + 1 < s.length && s[line + 1] <= i) line++; return { line: line, ch: i - s[line] }; },
      indexFromPos: function (p) { return lineStarts()[p.line] + p.ch; },
      markText: function (from, to, o) { const m = { from: from, to: to, className: o && o.className, clear: function () { cm.marks = cm.marks.filter(function (x) { return x !== m; }); } }; cm.marks.push(m); return m; },
      getAllMarks: function () { return cm.marks.slice(); },
      scrollIntoView: function (where) { cm.scrolled.push(where); },
      setCursor: function (p) { cm.cursor = p; },
      setOption: function (k, v) { cm.opts[k] = v; },
      refresh: function () { cm.refreshed = (cm.refreshed || 0) + 1; },
      on: function () {},
    };
    made.push(cm);
    return cm;
  }
  CodeMirror.made = made;
  return CodeMirror;
}
function fakeElement() {
  let html = '';
  const e = { children: [], style: {}, appendChild: function (c) { e.children.push(c); return c; }, setAttribute: function () {}, addEventListener: function () {} };
  Object.defineProperty(e, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); e.children = []; } });
  return e;
}

(async function () {
  test.subHeading('1. CodeMirror 5 in the tree, served, licensed, kept out of Files');
  const pkg = (function () { try { return JSON.parse(fs.readFileSync(path.join(CM, 'package.json'), 'utf8')); } catch (e) { return {}; } }());
  const licence = fs.existsSync(CM) && fs.readdirSync(CM).some(function (f) { return /^licen[cs]e/i.test(f); });
  const main = ['lib/codemirror.js', 'lib/codemirror.css'].every(function (f) { return fs.existsSync(path.join(CM, f)); });
  if (/^5\./.test(String(pkg.version || '')) && licence && main) test.check('spirit/run/shell/node_modules/codemirror holds CodeMirror ' + pkg.version + ', lib/codemirror.js and .css, and its licence');
  else test.fail(OWED + 'codemirror: version ' + short(pkg.version) + ', licence ' + licence + ', lib files ' + main);
  if (tracked('spirit/run/shell/node_modules/codemirror/lib/codemirror.js')) test.check('it is committed: git tracks lib/codemirror.js');
  else test.fail(OWED + 'git does not track spirit/run/shell/node_modules/codemirror/lib/codemirror.js');
  const ignore = fs.readFileSync(path.join(REPO, '.gitignore'), 'utf8');
  if (/^!\/spirit\/run\/shell\/node_modules\/\s*$/m.test(ignore)) test.check('.gitignore lets spirit/run/shell/node_modules in, as it lets spirit/run/node_modules');
  else test.fail(OWED + '.gitignore has no exception for spirit/run/shell/node_modules');
  if (kernel.core.fs.fileServable('shell/node_modules/codemirror/lib/codemirror.js')) test.check('fileServable serves shell/node_modules/codemirror/lib/codemirror.js');
  else test.fail(OWED + 'fileServable refuses shell/node_modules/codemirror/lib/codemirror.js');
  const index = fs.readFileSync(path.join(RUN, 'index.html'), 'utf8');
  const at = function (s) { return index.indexOf(s); };
  if (at('/shell/node_modules/codemirror/lib/codemirror.css') !== -1 && at('/shell/node_modules/codemirror/lib/codemirror.js') !== -1 && at('/shell/js/textView.js') > at('/shell/node_modules/codemirror/lib/codemirror.js')) test.check('index.html loads CodeMirror\'s css and js, then textView.js');
  else test.fail(OWED + 'index.html: codemirror.css at ' + at('/shell/node_modules/codemirror/lib/codemirror.css') + ', codemirror.js at ' + at('/shell/node_modules/codemirror/lib/codemirror.js') + ', textView.js at ' + at('/shell/js/textView.js'));

  // Andy, 2026-10-18: "does the editor have tools like search, replace?", then "add them here." CodeMirror 5's own
  // add-ons, after its core, in the order they need each other: dialog, searchcursor, search, jump-to-line.
  const ADDONS = ['addon/dialog/dialog.js', 'addon/search/searchcursor.js', 'addon/search/search.js', 'addon/search/jump-to-line.js'];
  const missing = ADDONS.concat(['addon/dialog/dialog.css']).filter(function (f) { return !fs.existsSync(path.join(CM, f)) || !tracked('spirit/run/shell/node_modules/codemirror/' + f); });
  if (!missing.length) test.check('the search add-ons are in the tree and committed: dialog (with its css), searchcursor, search, jump-to-line');
  else test.fail(OWED + 'add-ons missing or not committed: ' + short(missing));
  const order = ['lib/codemirror.js'].concat(ADDONS).map(function (f) { return at('/shell/node_modules/codemirror/' + f); });
  if (order.every(function (n, i) { return n !== -1 && (i === 0 || n > order[i - 1]); }) && at('/shell/node_modules/codemirror/addon/dialog/dialog.css') !== -1) test.check('index.html loads them after CodeMirror, in order, and the dialog\'s css');
  else test.fail(OWED + 'index.html places them at ' + short(order) + ', dialog.css at ' + at('/shell/node_modules/codemirror/addon/dialog/dialog.css'));

  test.subHeading('2. textView marks every match and scrolls to the first');
  const CodeMirror = fakeCodeMirror();
  const win = { CodeMirror: CodeMirror };
  if (fs.existsSync(VIEW)) new Function('window', 'document', 'spirit', fs.readFileSync(VIEW, 'utf8'))(win, { createElement: fakeElement }, { core: { util: { escapeHtml: kernel.core.util.escapeHtml } } });
  const make = win.spiritElements && win.spiritElements.createTextView;
  if (typeof make !== 'function') { test.fail(OWED + 'no window.spiritElements.createTextView (shell/js/textView.js)'); }
  else {
    const TEXT = 'first line\nthe Screwdriver is here\nno match\na screwdriver and another SCREWDRIVER';
    const view = make(fakeElement(), { text: TEXT, words: 'screwdriver', readOnly: true, path: 'notes.txt' });
    const cm = CodeMirror.made[CodeMirror.made.length - 1] || { marks: [], scrolled: [], opts: {} };
    const spans = cm.marks.filter(function (m) { return m.className === 'text-view-match'; })
      .map(function (m) { return TEXT.slice(cm.indexFromPos(m.from), cm.indexFromPos(m.to)); });
    if (spans.length === 3 && spans.every(function (s) { return s.toLowerCase() === 'screwdriver'; })) test.check('every match of the words is marked, case ignored: 3 marks');
    else test.fail(OWED + 'the marks cover ' + short(spans));
    const first = cm.scrolled[0];
    const line = first && (first.line !== undefined ? first.line : first.from && first.from.line);
    if (line === 1) test.check('the first match is scrolled into view (line 2)');
    else test.fail(OWED + 'scrolled into view: ' + short(cm.scrolled));
    if (cm.opts.readOnly === true || cm.opts.readOnly === 'nocursor') test.check('a display is read only');
    else test.fail(OWED + 'the display opened with readOnly ' + short(cm.opts.readOnly));
    if (view && typeof view.value === 'function' && view.value() === TEXT) test.check('value() answers the text');
    else test.fail(OWED + 'value() answers ' + short(view && typeof view.value === 'function' ? view.value() : view));
    // Andy, 2026-10-18: "when the file viewer/launcher is called, it shows almost nothing". The launcher stays mounted
    // and the shell hands it the next file while its pane is still hidden; CodeMirror built in a hidden box draws no
    // lines until it is refreshed. So a view refreshes itself once the page is drawn, and puts the first match in view
    // again then.
    const before = cm.refreshed || 0;
    const scrolledBefore = cm.scrolled.length;
    await new Promise(function (r) { setTimeout(r, 50); });
    if ((cm.refreshed || 0) > before && cm.scrolled.length > scrolledBefore) test.check('once the page is drawn the view refreshes itself and puts the first match in view again');
    else test.fail(OWED + 'after the page was drawn: refreshed ' + (cm.refreshed || 0) + ' time(s), scrolled ' + cm.scrolled.length);
    make(fakeElement(), { text: 'two words here, words', words: 'two here', readOnly: false });
    const cm2 = CodeMirror.made[CodeMirror.made.length - 1] || { marks: [] };
    if (cm2.marks.filter(function (m) { return m.className === 'text-view-match'; }).length === 2) test.check('several words: each is marked where it stands');
    else test.fail(OWED + 'two words gave ' + cm2.marks.length + ' marks');
  }

  test.subHeading('3. the text launcher and the text editor make one');
  const launcher = (/function codeViewerLoadFile[\s\S]*?\n {8}\}/.exec(index) || [''])[0];
  if (/createTextView\s*\(/.test(launcher) && !/<pre class="code-view">/.test(launcher)) test.check('the text launcher shows the file in a textView, its <pre> gone');
  else test.fail(OWED + 'the text launcher draws ' + short(launcher.slice(0, 200)));
  if (/params\.words|words\s*:/.test((/id: 'text-file-launcher'[\s\S]*?render:/.exec(index) || [''])[0] + launcher)) test.check('it takes the words with the path');
  else test.fail(OWED + 'the text launcher takes no words');
  const editor = code(path.join(RUN, 'shell', 'textEditor', 'textEditor.js'));
  if (/createTextView\s*\(/.test(editor) && !/<textarea/.test(editor) && /\.value\(\)/.test(editor)) test.check('the text editor edits in a textView, its textarea gone, and saves its value()');
  else test.fail(OWED + 'textEditor.js: createTextView ' + /createTextView\s*\(/.test(editor) + ', textarea ' + /<textarea/.test(editor) + ', value() ' + /\.value\(\)/.test(editor));
  if (/createTextView\s*:\s*spiritElements\.createTextView/.test(code(path.join(RUN, 'js', 'client', 'shell.js')))) test.check('apps get it as api.ui.elements.createTextView');
  else test.fail(OWED + 'shell.js hands apps no createTextView');
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(0); }, 100);
});
