'use strict';

// spirit/run/spirit/devtool/moveScript/test/script.js
// THE TESTS OF spirit/devtool/moveScript/script.js, and of no other script (goal/G49.5; spec: ./script.md). The box:
// "it moves one script at a time, and fixes everything that names it, so a move is one command and never a sweep by hand
// again". Each check reads a scratch run root, planted here with one script, its test, its .md, a fixture of its test and
// the files that name it, after one command, `node spirit/devtool/moveScript/script.js <old> <new>`, run in that root.

require('../../../script.js');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const SPIRIT = require(path.join(RUN, 'spirit', 'script.js'));
const test = SPIRIT.requireScript('spirit/test/testReport.js');
const tempFolder = SPIRIT.requireScript('spirit/tempFolder/script.js').tempFolder;
const TOOL = path.join(RUN, 'spirit', 'devtool', 'moveScript', 'script.js');
test.after(function () { try { fs.rmSync(tempFolder.path('spirit/devtool/moveScript/test'), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });

// The planted files and the checks name the loaders by these two words, so the general rules never read the scratch
// tree's code as this test's own loads.
const REQ = 'req' + 'uire';
const RS = 'requireS' + 'cript';
function req(p) { return REQ + "('" + p + "')"; }
function rs(p) { return RS + "('" + p + "')"; }

const OLD = 'spirit/element/foo.js';
const NEW = 'spirit/element/foo/script.js';

// The scratch run root: what a move of spirit/element/foo.js to spirit/element/foo/script.js must find and fix.
// Its dotted name at its place since goal/G49.23, on the spirit object itself: spirit.element.foo (no spirit.required).
const PLANT = {
  'spirit/script.js': "'use strict';\n",
  // the script, with its own relative require
  'spirit/element/foo.js': "'use strict';\n" + req('../script.js') + ";\nwindow.spirit.element.foo = { create: function () {} };\n",
  // its test, its .md, a page fixture of its test
  'spirit/element/test/foo.js': "'use strict';\nconst FOO = " + req('../foo.js') + ";\nconst AT = /spirit\\/element\\/foo\\.js/;\n",
  'spirit/element/test/foo.md': "# foo\n\nThe tests of spirit/element/foo.js.\n",
  'spirit/element/test/foo-laid.html': "<!doctype html><script src=\"../foo.js\"></script>\n",
  // the files naming it: a require, spirit.requireScript, the dotted name, a path.join, a script tag, a doc
  'spirit/element/bar.js': "'use strict';\n" + req('./foo.js') + ";\nspirit." + rs('spirit/element/foo.js') + ";\nconst f = spirit.element.foo.create;\n",
  'spirit/server/where.js': "'use strict';\nconst path = " + req('path') + ";\nconst P = path.join(__dirname, '..', 'element', 'foo.js');\n",
  'spirit/element/page.html': "<!doctype html><script src=\"/spirit/element/foo.js\"></script>\n",
  'spirit/README.md': "The foo element is spirit/element/foo.js.\n",
  // for the refusal: an existing target
  'spirit/element/taken.js': "'use strict';\n",
  'spirit/element/taken/script.js': "'use strict';\n",
};

let asked = 0;
function plant() {
  asked += 1;
  const root = tempFolder('spirit/devtool/moveScript/test/run' + asked);
  Object.keys(PLANT).forEach(function (rel) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), PLANT[rel]);
  });
  return root;
}
// One command, run in the root. Its exit code: 0 for a move made, any other for a refusal.
function move(root, from, to) {
  try { execFileSync(process.execPath, [TOOL, from, to], { cwd: root, stdio: 'pipe', timeout: 30000 }); return 0; } catch (e) { return typeof e.status === 'number' ? e.status : -1; }
}
function read(root, rel) { try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch (e) { return null; } }
function there(root, rel) { return fs.existsSync(path.join(root, rel)); }

// One move, made once for every check that reads it.
const W = { root: null, code: null };
function moved() { if (!W.root) { W.root = plant(); W.code = move(W.root, OLD, NEW); } return W.root; }

// the move
test.run('a move is one command, and ends with exit code 0', 0.4, function () {
  const r = moved();
  return (W.code === 0 && there(r, NEW)) || false;
}, test.limit.slow);
test.run('the file itself is at its new place, and gone from its old one', 0.4, function () {
  const r = moved();
  return (there(r, NEW) && !there(r, OLD)) || false;
}, test.limit.slow);
test.run('the moved file\'s own relative require is one level deeper', 0.4, function () {
  const t = read(moved(), NEW) || '';
  return (t.indexOf(req('../../script.js')) !== -1 && t.indexOf(req('../script.js')) === -1) || false;
}, test.limit.slow);
test.run('its own test moves with it, test/<name>.js to <name>/test/script.js', 0.4, function () {
  const r = moved();
  return (there(r, 'spirit/element/foo/test/script.js') && !there(r, 'spirit/element/test/foo.js')) || false;
}, test.limit.slow);
test.run('its .md moves with its test', 0.4, function () {
  const r = moved();
  return (there(r, 'spirit/element/foo/test/script.md') && !there(r, 'spirit/element/test/foo.md')) || false;
}, test.limit.slow);
test.run('a page fixture of its test, named after it, moves with that test to <name>/test/', 0.4, function () {
  const r = moved();
  let inNew = [];
  try { inNew = fs.readdirSync(path.join(r, 'spirit/element/foo/test')); } catch (e) { inNew = []; }
  return (!there(r, 'spirit/element/test/foo-laid.html') && inNew.some(function (n) { return /-laid\.html$/.test(n); })) || false;
}, test.limit.slow);

// every reference to it
test.run('its moved test requires it at its new place', 0.4, function () {
  const t = read(moved(), 'spirit/element/foo/test/script.js') || '';
  return (t.indexOf(req('../script.js')) !== -1 && t.indexOf('foo.js') === -1) || false;
}, test.limit.slow);
test.run('the regex-escaped form in a test names its new path', 0.4, function () {
  const t = read(moved(), 'spirit/element/foo/test/script.js') || '';
  return t.indexOf('spirit\\/element\\/foo\\/script\\.js') !== -1 || false;
}, test.limit.slow);
test.run('a relative require of it names its new path', 0.4, function () {
  const t = read(moved(), 'spirit/element/bar.js') || '';
  return (t.indexOf(req('./foo/script.js')) !== -1 && t.indexOf(req('./foo.js')) === -1) || false;
}, test.limit.slow);
test.run('a spirit.requireScript of it names its new path', 0.4, function () {
  const t = read(moved(), 'spirit/element/bar.js') || '';
  return (t.indexOf(rs('spirit/element/foo/script.js')) !== -1 && t.indexOf(rs('spirit/element/foo.js')) === -1) || false;
}, test.limit.slow);
// PATHS ONLY (goal/G49.9, box v5: "a move then changes only paths: G49.5's element batch becomes paths only, and moveScript drops
// its dotted-name rewriting"; "a folder's script.js stands at its folder's own name"): spirit/element/foo/script.js stands where
// spirit/element/foo.js stood, so the move leaves every dotted name as it was.
test.run('its dotted name is left as it was where it is read, since a folder\'s script.js stands at its folder\'s name', 0.4, function () {
  const t = read(moved(), 'spirit/element/bar.js') || '';
  return (t.indexOf('spirit.element.foo.create') !== -1 && t.indexOf('foo.script') === -1) || false;
}, test.limit.slow);
test.run('its dotted name is left as it was in the moved script itself', 0.4, function () {
  const t = read(moved(), NEW) || '';
  return (t.indexOf('spirit.element.foo =') !== -1 && t.indexOf('foo.script') === -1) || false;
}, test.limit.slow);
test.run('a path.join of its pieces names its new path', 0.4, function () {
  const t = read(moved(), 'spirit/server/where.js') || '';
  return (t.indexOf("'foo.js'") === -1 && t.indexOf('script.js') !== -1) || false;
}, test.limit.slow);
test.run('a script tag naming it names its new path', 0.4, function () {
  const t = read(moved(), 'spirit/element/page.html') || '';
  return (t.indexOf('/spirit/element/foo/script.js') !== -1 && t.indexOf('/spirit/element/foo.js') === -1) || false;
}, test.limit.slow);
test.run('a doc naming it names its new path', 0.4, function () {
  const t = read(moved(), 'spirit/README.md') || '';
  return (t.indexOf('spirit/element/foo/script.js') !== -1 && t.indexOf('spirit/element/foo.js') === -1) || false;
}, test.limit.slow);
test.run('after the move no file of the tree names its old path', 0.4, function () {
  const r = moved();
  const out = [];
  (function walk(d) {
    fs.readdirSync(path.join(r, d), { withFileTypes: true }).forEach(function (e) {
      const rel = d ? d + '/' + e.name : e.name;
      if (e.isDirectory()) walk(rel); else out.push(rel);
    });
  })('');
  return (out.length > 5 && !out.some(function (rel) { return (read(r, rel) || '').indexOf('spirit/element/foo.js') !== -1; })) || false;
}, test.limit.slow);

// refused
test.run('a target that already exists is refused, and nothing is moved', 0.4, function () {
  const r = plant();
  const code = move(r, 'spirit/element/taken.js', 'spirit/element/taken/script.js');
  return (code !== 0 && there(r, 'spirit/element/taken.js') && read(r, 'spirit/element/taken/script.js') === PLANT['spirit/element/taken/script.js']) || false;
}, test.limit.slow);
// A move beside an api.js or a data.js is not refused (goal/G49.12; Andy: "DUMB RULES! ./api.js files will disappear into
// ./client/script.js or equivalent when we get to enforcing branch and app api standards....").
test.run('a refused move changes no file that names the script', 0.4, function () {
  const r = plant();
  const code = move(r, 'spirit/element/taken.js', 'spirit/element/taken/script.js');
  return code !== 0 && Object.keys(PLANT).every(function (rel) { return read(r, rel) === PLANT[rel]; }) || false;
}, test.limit.slow);
