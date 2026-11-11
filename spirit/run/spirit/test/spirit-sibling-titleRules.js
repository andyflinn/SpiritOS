'use strict';

// spirit/run/spirit/test/spirit-sibling-titleRules.js [file or folder]
// EVERY TEST'S TITLE, A PLAIN AND STEADY STRING, UNIQUE IN ITS SUITE (goal/G45.3; spec: ./spirit-sibling-titleRules.md). The
// box: "every test's title is a plain string; it is steady, with no count, value, path or number built into it; and it is
// unique within its suite.", "Run on a folder, it judges that folder's suites alone, so each title item's red is this test
// on its own folder." A test's title is what failed when it is red, and the key it is kept by (goal/G45.1: "A test's key is
// its description, nothing else"), so a title that changes from run to run makes a new test each run.
//
//   node spirit/test/spirit-sibling-titleRules.js spirit/app/desk          every suite under that folder
//   node spirit/test/spirit-sibling-titleRules.js spirit/app/desk/desk.js  that production file's own suite
//   node spirit/test/spirit-sibling-titleRules.js spirit/test/data.js      that suite (a file in a test/ folder)
//   node spirit/test/spirit-sibling-titleRules.js                          every suite of the tree
//
// A suite is a .js file in a folder named test, not one of spirit/test/'s tools. A TITLE is the words a check is kept by:
// the second argument of ok(cond, good, bad), every suite's one helper, and the first argument of test.check(words). It is
// read from the code, comments out; the suite is never run. Plain is one string literal, quoted or a template with no
// ${}: nothing joined or computed into it, so nothing in it can change between runs. What a check found belongs in its
// failure words or its detail, never its title. This test's own titles name no file and no count: those are its details.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const VENDORED_FOLDERS = require(path.join(RUN, 'spirit', 'fileSystem.js')).VENDORED_FOLDERS;

const ARGS = process.argv.slice(2).filter(function (a, i, all) { return a !== '--verify-port' && all[i - 1] !== '--verify-port'; });
function ok(cond, good, bad, detail) { if (cond) test.check(good); else test.fail(bad, detail); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600); }
// The tools of spirit/test/ are no suites (spirit/test/testModule.js TOOLS).
const TOOLS = ['spirit/test/testReport.js', 'spirit/test/testModule.js', 'spirit/test/headLessChrome.js'];

// ── READING A SUITE'S CODE ──────────────────────────────────────────────────────────────────────────────────────────────
// The code with its comments blanked out, strings and regular expressions kept, every offset where it was.
function blankComments(src) {
  let out = '', i = 0, str = '', regex = false, cls = false, last = '';
  while (i < src.length) {
    const ch = src[i], nx = src[i + 1];
    if (str) {
      out += ch;
      if (ch === '\\') { out += nx || ''; i += 2; continue; }
      if (ch === str) str = '';
      i += 1; continue;
    }
    // A regular expression's body is blanked to x's of its length, so no comma or bracket in it splits a call's arguments.
    if (regex) {
      if (ch === '\\') { out += 'xx'; i += 2; continue; }
      if (ch === '[') cls = true; else if (ch === ']') cls = false; else if (ch === '/' && !cls) { regex = false; out += ch; i += 1; continue; }
      out += ch === '\n' ? '\n' : 'x';
      i += 1; continue;
    }
    if (ch === '/' && nx === '/') { while (i < src.length && src[i] !== '\n') { out += ' '; i += 1; } continue; }
    if (ch === '/' && nx === '*') { const end = src.indexOf('*/', i + 2); const stop = end === -1 ? src.length : end + 2; out += src.slice(i, stop).replace(/[^\n]/g, ' '); i = stop; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { str = ch; out += ch; i += 1; last = ch; continue; }
    // A slash opens a regular expression where a value is expected: after an operator, a bracket, a comma or a keyword.
    if (ch === '/' && (/[(,=:[!&|?{};+\-*%<>~^]$/.test(last) || last === '' || /\b(return|typeof|case|in|of)$/.test(out.slice(-8)))) { regex = true; cls = false; out += ch; i += 1; last = ch; continue; }
    out += ch;
    if (!/\s/.test(ch)) last = ch;
    i += 1;
  }
  return out;
}
// The arguments of the call whose ( is at open, each as written, split at its top-level commas.
function argsAt(code, open) {
  const args = [];
  let depth = 0, i = open, start = open + 1, str = '', tpl = [];
  for (; i < code.length; i++) {
    const ch = code[i];
    if (str) {
      if (ch === '\\') { i += 1; continue; }
      if (str === '`' && ch === '$' && code[i + 1] === '{') { tpl.push(depth); depth += 1; str = ''; i += 1; continue; }
      if (ch === str) str = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { str = ch; continue; }
    if (ch === '(' || ch === '[' || ch === '{') { depth += 1; continue; }
    if (ch === ')' || ch === ']' || ch === '}') {
      depth -= 1;
      if (ch === '}' && tpl.length && depth === tpl[tpl.length - 1]) { tpl.pop(); str = '`'; continue; }
      if (depth === 0) { args.push(code.slice(start, i).trim()); return args; }
      continue;
    }
    if (ch === ',' && depth === 1) { args.push(code.slice(start, i).trim()); start = i + 1; }
  }
  return args;
}
// One plain string literal: its value; anything else (joined, computed, a name, a template with ${}): null.
function plainValue(arg) {
  const a = String(arg || '').trim();
  if (/^'(?:[^'\\\n]|\\.)*'$/.test(a) || /^"(?:[^"\\\n]|\\.)*"$/.test(a)) { try { return JSON.parse('"' + a.slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"').replace(/\\\\"/g, '\\"') + '"'); } catch (e) { return a.slice(1, -1); } }
  if (/^`[^`]*`$/.test(a) && a.indexOf('${') === -1) return a.slice(1, -1);
  return null;
}
// The body of every helper that says a check, function ok(cond, good, bad) { ... }, blanked: what it hands on is its caller's
// title, not one of its own.
function blankHelpers(code) {
  const re = /function\s+ok\s*\(/g;
  let m, out = code;
  while ((m = re.exec(code))) {
    const open = code.indexOf('{', m.index);
    if (open === -1) continue;
    let depth = 0, i = open, str = '';
    for (; i < code.length; i++) {
      const ch = code[i];
      if (str) { if (ch === '\\') { i += 1; continue; } if (ch === str) str = ''; continue; }
      if (ch === '"' || ch === "'" || ch === '`') { str = ch; continue; }
      if (ch === '{') depth += 1;
      else if (ch === '}') { depth -= 1; if (depth === 0) break; }
    }
    out = out.slice(0, open) + out.slice(open, i + 1).replace(/[^\n]/g, ' ') + out.slice(i + 1);
  }
  return out;
}
// The code with every string's inside blanked, its length kept: a call is looked for there, so words inside a string
// (a planted suite, a page script sent to Chrome) are never taken for checks.
function blankStrings(code) {
  let out = '', str = '';
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (str) {
      if (ch === '\\') { out += '  '; i += 1; continue; }
      if (ch === str) { str = ''; out += ch; continue; }
      out += ch === '\n' ? '\n' : ' ';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') str = ch;
    out += ch;
  }
  return out;
}
// Every title in a suite's code: { line, text (as written), value (when plain) }.
function titlesOf(src) {
  const code = blankHelpers(blankComments(src));
  const bare = blankStrings(code);
  const out = [];
  const re = /(^|[^.\w$])ok\s*\(|\btest\.check\s*\(/g;
  let m;
  while ((m = re.exec(bare))) {
    const at = m.index + m[0].length - 1;
    // A definition, function ok(...), is no check.
    if (/function\s+$/.test(code.slice(Math.max(0, m.index - 12), m.index + (m[1] || '').length))) continue;
    const args = argsAt(code, at);
    const isCheck = /test\.check/.test(m[0]);
    const arg = isCheck ? args[0] : args[1];
    if (arg === undefined) continue;
    out.push({ line: code.slice(0, at).split('\n').length, text: arg.slice(0, 120), value: plainValue(arg) });
  }
  return out;
}
// What a suite breaks: titles not plain, and titles said twice.
function judge(src) {
  const titles = titlesOf(src);
  const built = titles.filter(function (t) { return t.value === null; });
  const seen = Object.create(null);
  const twice = [];
  titles.forEach(function (t) { if (t.value === null) return; if (seen[t.value]) twice.push(t); else seen[t.value] = true; });
  return { titles: titles, built: built, twice: twice };
}

// ── WHICH SUITES ────────────────────────────────────────────────────────────────────────────────────────────────────────
function tree() {
  return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: RUN, encoding: 'utf8' })
    .split('\n').filter(Boolean).map(function (f) { return f.replace(/^spirit\/run\//, ''); })
    .filter(function (f) { try { return fs.statSync(path.join(RUN, f)).isFile(); } catch (e) { return false; } });
}
function isSuite(f) { return /\.js$/.test(f) && f.split('/').slice(0, -1).indexOf('test') !== -1 && TOOLS.indexOf(f) === -1 && !VENDORED_FOLDERS.holds(path.join(RUN, f)); }
function suitesFor(asked, files) {
  const all = files.filter(isSuite);
  if (!asked) return all;
  if (isSuite(asked)) return all.filter(function (f) { return f === asked; });
  if (/\.js$/.test(asked)) { const own = asked.replace(/([^/]+)$/, 'test/$1'); return all.filter(function (f) { return f === own; }); }
  const dir = asked.replace(/\/$/, '') + '/';
  return all.filter(function (f) { return f.indexOf(dir) === 0; });
}

test.startTest('spirit-sibling-titleRules.js: every test title plain, steady and unique in its suite (goal/G45.3)');

// ── ITS OWN READING, ON SUITES PLANTED IN MEMORY ────────────────────────────────────────────────────────────────────────
test.subHeading('it reads a title as plain only when it is one string literal');
const PLANTED = [
  "function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }",
  "ok(a === 1, 'the count is one', 'the count is ' + a);",
  "ok(b, \"the field is shown\", 'not shown');",
  "ok(c, `the row is drawn`, 'no row');",
  "ok(d, 'the world: ' + n + ' scripts', 'too few');",
  "ok(e, `found ${n} rows`, 'none');",
  "ok(f, words, 'no words');",
  "ok(g(x, [1, 2]), 'a call with commas inside its condition', 'bad');",
  "ok(/a,b/.test(s), 'a regular expression with a comma', 'bad');",
  "test.check('a check said by itself');",
  "test.check('one ' + 'joined');",
  "// ok(z, 'a comment is no check', 'bad');",
  "ok(h, 'the count is one', 'said twice');",
].join('\n');
const P = judge(PLANTED);
const values = P.titles.map(function (t) { return t.value; });
ok(P.titles.length === 11, 'it finds every check of the planted suite, and none in a comment or a definition', 'it found the wrong checks', 'found ' + short(P.titles.map(function (t) { return t.text; })));
ok(values[0] === 'the count is one' && values[1] === 'the field is shown' && values[2] === 'the row is drawn', 'a quoted string and a plain template are plain titles', 'a plain title was not read as plain', short(values.slice(0, 3)));
ok(P.built.length === 4 && P.built.every(function (t) { return /scripts|\$\{n\}|^words$|'one ' \+/.test(t.text); }), 'a joined string, a template with ${}, a bare name and a joined check are built titles', 'built titles were not told apart', short(P.built.map(function (t) { return t.text; })));
ok(values.indexOf('a call with commas inside its condition') !== -1 && values.indexOf('a regular expression with a comma') !== -1, 'commas inside a condition, a call or a regular expression do not split its arguments', 'a comma inside a condition split it', short(values));
ok(P.twice.length === 1 && P.twice[0].value === 'the count is one', 'a title said twice in one suite is found', 'a repeated title was not found', short(P.twice));

// ── THE SUITES ASKED ────────────────────────────────────────────────────────────────────────────────────────────────────
const asked = ARGS[0] ? String(ARGS[0]).replace(/\\/g, '/').replace(/^\.\//, '').replace(/^spirit\/run\//, '') : '';
const SUITES = suitesFor(asked, tree());
test.subHeading('the suites it judges');
ok(SUITES.length > 0, 'the world: there are suites to judge', 'no suite to judge: nothing was judged', (asked || 'the tree') + ': ' + SUITES.length + ' suites');
const results = SUITES.map(function (f) { let src = ''; try { src = fs.readFileSync(path.join(RUN, f), 'utf8'); } catch (e) { src = ''; } return { file: f, r: judge(src) }; });
const counted = results.reduce(function (n, x) { return n + x.r.titles.length; }, 0);
ok(counted > 0, 'the world: the suites hold checks to judge', 'the suites hold no check: nothing was judged', counted + ' titles in ' + SUITES.length + ' suites');

test.subHeading('every title is plain and steady');
const built = results.filter(function (x) { return x.r.built.length; });
const builtCount = built.reduce(function (n, x) { return n + x.r.built.length; }, 0);
ok(!built.length, 'every title is one plain string, nothing built into it', 'titles are built from values', builtCount + ' in ' + built.length + ' suites; the first: ' + short(built.slice(0, 4).map(function (x) { return x.file + ':' + x.r.built[0].line + ' ' + x.r.built[0].text; })));

test.subHeading('every title is unique within its suite');
const twice = results.filter(function (x) { return x.r.twice.length; });
const twiceCount = twice.reduce(function (n, x) { return n + x.r.twice.length; }, 0);
ok(!twice.length, 'no suite says one title twice', 'suites say a title twice', twiceCount + ' in ' + twice.length + ' suites; the first: ' + short(twice.slice(0, 4).map(function (x) { return x.file + ':' + x.r.twice[0].line + ' ' + x.r.twice[0].value; })));

test.reportSuccessFailureCount();
