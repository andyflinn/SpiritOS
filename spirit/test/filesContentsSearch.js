'use strict';

// spirit/test/filesContentsSearch.js
// goal/G29.11: words searched inside text files. The item's box, in short:
//   THE FILTER: one filter with three mutually exclusive choices, words in: names | paths | contents; names the
//   default; contents alone is find-in-files; the page asks the node only in contents.
//   THE CONTENTS SCORE: each line scored against the whole expression; a line holding any of the words is a matched
//   line; a file's score is the average quality of its matched lines x m / (m + 10), never the file's length.
//   THE VERB (approved by Andy): fs.search takes contents: yes; the node reads text files up to 1 MB and ranks the
//   files by their contents score alone, label {path, score, line}. Without it fs.search answers as before.
//   THE LIST: no found line in the rows; every search on the shared list shows a 3em weight bar, right adjusted, as its left-most column,
//   full for the best row and proportional for the others, gone with no words; a press opens the viewer marked, its
//   first match in view; the editor's picker in contents opens marked.
//
// NAMED HERE where the box names none:
//   - createNodeSearches({ jobs, rootDir, mimeTypes }).
//   - the rank bar is a cell of class list-rank holding one element whose style width is a percentage.
//   - createTextView takes line: the 1-based line put in view.
// rule/11: through testSupport only; its own folders; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/spirit/kernel.js');

const OWED = 'OWED by goal/G29.11: ';
const RUN = path.join(__dirname, '..', 'run');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }
function code(file) { try { return fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); } catch (e) { return ''; } }
function parse(s) { try { return JSON.parse(s); } catch (e) { return null; } }

test.startTest('goal/G29.11: words searched inside text files, ranked by their contents, the rank shown as a bar');


(async function () {
  // ── 1. the node ──
  test.subHeading('1. fs.search with contents: yes ranks the text files by their contents');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-contents-'));
  const write = function (rel, text) { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
  write('notes/todo.txt', 'buy milk\nfix the shelf\nwhere did I put my screwdriver?\n');
  write('notes/many.txt', 'screwdriver one\nscrewdriver two\nno\nscrewdriver three\nscrewdriver four\nscrewdriver five\n');
  write('spirit/tools.js', 'var a = 1;\n// the Screwdriver lives here\n');
  write('media/cat.png', 'screwdriver in a picture');
  write('big/huge.txt', 'x'.repeat(1024 * 1024 + 10) + '\nscrewdriver at the end\n');
  write('screwdriver/readme.md', 'nothing to see\n');
  const tree = ['notes', 'notes/todo.txt', 'notes/many.txt', 'js', 'spirit/tools.js', 'media', 'media/cat.png', 'big', 'big/huge.txt', 'screwdriver', 'screwdriver/readme.md']
    .map(function (p) { return { name: path.basename(p), relativePath: p, kind: path.extname(p) ? 'file' : 'folder' }; });
  const searches = require('../run/spirit/nodeSearches.js').createNodeSearches({
    jobs: { fsTreeEntries: function () { return tree; } }, rootDir: root, mimeTypes: kernel.core.const.MIME_TYPES });
  const answer = searches.fsSearch({ q: 'screwdriver', contents: 'yes' });
  const order = ((answer && answer.items) || []).map(function (it) { return it.key; });
  const byKey = {};
  ((answer && answer.items) || []).forEach(function (it) { byKey[it.key] = parse(it.label); });
  const todo = byKey['notes/todo.txt'] || {};
  const many = byKey['notes/many.txt'] || {};
  if (todo.path === 'notes/todo.txt' && todo.line === 3 && typeof todo.score === 'number') test.check('notes/todo.txt is found by its contents: label {path, score, line}, line 3');
  else test.fail(OWED + 'notes/todo.txt answered ' + short(todo) + ' (all: ' + short(order) + ')');
  if (byKey['spirit/tools.js'] && byKey['spirit/tools.js'].line === 2) test.check('case ignored: js/tools.js found at line 2 (Screwdriver)');
  else test.fail(OWED + 'spirit/tools.js answered ' + short(byKey['spirit/tools.js']));
  if (order[0] === 'notes/many.txt' && many.score > todo.score) test.check('more matched lines rank higher: notes/many.txt (5 lines) first, above notes/todo.txt (1 line)');
  else test.fail(OWED + 'the order is ' + short(order) + '; scores many ' + short(many.score) + ', todo ' + short(todo.score));
  if (todo.score > 0 && todo.score <= 1 / 11 + 1e-9 && many.score <= 5 / 15 + 1e-9) test.check('a file\'s score is at most m / (m + 10): ' + todo.score.toFixed(3) + ' for 1 line, ' + many.score.toFixed(3) + ' for 5');
  else test.fail(OWED + 'scores ' + short({ todo: todo.score, many: many.score }) + ' exceed m / (m + 10)');
  if (!byKey['media/cat.png'] && !byKey['big/huge.txt']) test.check('a picture and a text file over 1 MB are never read');
  else test.fail(OWED + 'found ' + short(order));
  if (!byKey['screwdriver/'] && !byKey['screwdriver/readme.md']) test.check('contents alone: the folder named screwdriver and the file under it are not answered by their names');
  else test.fail(OWED + 'contents answered names: ' + short(order));
  const plain = searches.fsSearch({ q: 'screwdriver' });
  const plainKeys = ((plain && plain.items) || []).map(function (it) { return it.key; });
  const plainLabels = ((plain && plain.items) || []).map(function (it) { return it.label; });
  if (plainKeys.indexOf('notes/todo.txt') === -1 && plainKeys.indexOf('screwdriver/') !== -1 && plainLabels.every(function (l, i) { return l === plainKeys[i]; })) test.check('without contents it answers as before: names and paths only, the label the path');
  else test.fail(OWED + 'without contents fs.search answered ' + short(plain && plain.items));
  try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* scratch */ }

  // The fs family is mounted with its verbs bare (goal/G30.4): search inside loopbackVerbs.mount('fs', ...).
  const server = code(path.join(RUN, 'spirit', 'server.js'));
  const fsMount = (/loopbackVerbs\.mount\('fs',[\s\S]*?\n {2}\}, \{ wire:/.exec(server) || [''])[0];
  if (/'search':\s*\{\s*request:\s*\{\s*q:\s*''\s*,\s*contents:\s*''\s*\}/.test(fsMount)) test.check('the node declares fs.search {q, contents}');
  else test.fail(OWED + 'server.js declares fs.search as ' + short((/'search':[^\n]*/.exec(fsMount) || [''])[0]));
  if (/createNodeSearches\(\{[^}]*rootDir[^}]*mimeTypes/.test(server)) test.check('the node hands the searches its run folder and the kernel\'s mimetypes');
  else test.fail(OWED + 'server.js makes the searches as ' + short((/createNodeSearches\([^\n]*/.exec(server) || [''])[0]));
  const tool = parse(fs.readFileSync(path.join(RUN, 'spirit', 'fs', 'search.json'), 'utf8')) || {};
  if (/contents/.test(String(tool.description)) && /score/.test(String(tool.description))) test.check('the agents\' tool says what contents does, and that it answers a score');
  else test.fail(OWED + 'spirit/fs/search.json says ' + short(tool.description));

  // ── 2. the rank bar, every search ──
  test.subHeading('2. every search on the shared list shows its ranking as a bar');
  // Andy: "i do like to have the same color for the text highlights as the score bar has, try a pastel blue (in the
  // color scheme?)". One colour, --spirit-match, defined once in spirit/run/spirit/shell/shell.css, for the bar, the
  // list's marks and the viewer's marks.
  // The shell's styles are spirit/run/spirit/shell/shell.css (goal/G30.9).
  const idx = fs.readFileSync(path.join(RUN, 'spirit', 'shell', 'shell.css'), 'utf8');
  const token = (/--spirit-match:\s*([^;]+);/.exec(idx) || [])[1] || '';
  const rgb = (/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/.exec(token) || []).slice(1).map(Number);
  if (rgb.length === 3 && rgb[2] > rgb[0] && rgb[2] > rgb[1] && rgb[2] >= 200 && rgb[0] >= 100) test.check('--spirit-match is a pastel blue: ' + token.trim());
  else test.fail(OWED + 'index.html defines --spirit-match as ' + short(token));
  if (/(^|[\s,}])mark\s*\{[^}]*background:\s*var\(--spirit-match\)/.test(idx) && /\.text-view-match\s*\{[^}]*background:\s*var\(--spirit-match\)/.test(idx)) test.check('the list\'s marks and the viewer\'s marks take the same colour');
  else test.fail(OWED + 'mark and .text-view-match do not both use var(--spirit-match)');
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(0); }, 100);
});
