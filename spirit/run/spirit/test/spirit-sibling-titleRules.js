'use strict';

// spirit/run/spirit/test/spirit-sibling-titleRules.js [file or folder]
// EVERY TEST ONE test.run, ITS TITLE A PLAIN AND STEADY STRING, UNIQUE IN ITS SUITE, WITH ITS SEVERITY AND TIME LIMIT (goal/G45.3,
// goal/G47.2; spec: ./spirit-sibling-titleRules.md). The
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
// A suite is a .js file in a folder named test, not one of spirit/test/'s tools. A TEST is one call to the reporter,
// test.run(title, severity, body, limitMs) (goal/G47.2; Andy: "Every test inside every suite has its unique (within the
// suite) title. Every test supplies its severity", "One call per test, the reporter's"): its TITLE, the words it is kept by,
// is one plain string literal, quoted or a template with no ${}, so nothing in it can change between runs; its severity a
// number literal from 0.0 to 1.0; its time limit a number literal of milliseconds. A suite says its checks through
// test.run alone: a helper ok of its own, test.check, test.fail and test.reportSuccessFailureCount are the old ways
// (goal/G47.2: "No suite keeps a helper of its own that hands the reporter a title on a pass and other words on a fail").
// The code is read, comments out; the suite is never run. What a check found belongs in what its body answers, never its
// title. This test's own titles name no file and no count: those are its details.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const VENDORED_FOLDERS = require(path.join(RUN, 'spirit', 'fileSystem.js')).VENDORED_FOLDERS;

const ARGS = process.argv.slice(2).filter(function (a, i, all) { return a !== '--verify-port' && all[i - 1] !== '--verify-port'; });
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
// A plain number literal: its value; anything else: null.
function plainNumber(arg) { const a = String(arg || '').trim(); return /^\d+(\.\d+)?$|^\.\d+$/.test(a) ? Number(a) : null; }
// Every test in a suite's code, one test.run(title, severity, body, limitMs) each (goal/G47.2): { line, text (the title as
// written), value (when plain), severity, limit (when number literals) }.
function testsOf(src) {
  const code = blankComments(src);
  const bare = blankStrings(code);
  const out = [];
  const re = /\btest\.run\s*\(/g;
  let m;
  while ((m = re.exec(bare))) {
    const at = m.index + m[0].length - 1;
    const args = argsAt(code, at);
    if (args[0] === undefined) continue;
    out.push({ line: code.slice(0, at).split('\n').length, text: args[0].slice(0, 120), value: plainValue(args[0]), severity: plainNumber(args[1]), limit: plainNumber(args[3]) });
  }
  return out;
}
// The old ways of saying a check, each a reason a suite is not yet on test.run (goal/G47.2: "No suite keeps a helper of its
// own that hands the reporter a title on a pass and other words on a fail"): a helper ok of its own, test.check, test.fail,
// and test.reportSuccessFailureCount, the end the reporter now says itself.
function oldCallsOf(src) {
  const bare = blankStrings(blankComments(src));
  const out = [];
  const re = /\bfunction\s+ok\s*\(|\btest\.(check|fail|reportSuccessFailureCount)\s*\(/g;
  let m;
  while ((m = re.exec(bare))) out.push({ line: bare.slice(0, m.index).split('\n').length, text: m[0].replace(/\s*\($/, '') });
  return out;
}
// What a suite breaks: no test at all, an old call, a title not plain, a title said twice, a severity not a number from 0.0
// to 1.0, a time limit not a number of milliseconds.
function judge(src) {
  const titles = testsOf(src);
  const built = titles.filter(function (t) { return t.value === null; });
  const seen = Object.create(null);
  const twice = [];
  titles.forEach(function (t) { if (t.value === null) return; if (seen[t.value]) twice.push(t); else seen[t.value] = true; });
  const severity = titles.filter(function (t) { return t.severity === null || t.severity < 0 || t.severity > 1; });
  const limit = titles.filter(function (t) { return t.limit === null || !(t.limit > 0); });
  return { titles: titles, built: built, twice: twice, old: oldCallsOf(src), severity: severity, limit: limit };
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

// ── ITS OWN READING, ON SUITES PLANTED IN MEMORY ────────────────────────────────────────────────────────────────────────
const PLANTED = [
  "test.run('the count is one', 0.2, function () { return a === 1 || 'the count is ' + a; }, 1000);",
  "test.run(\"the field is shown\", 0.4, function () { return b; }, 500);",
  "test.run(`the row is drawn`, 0.8, async function () { return c; }, 2000);",
  "test.run('the world: ' + n + ' scripts', 0.2, function () { return true; }, 1000);",
  "test.run(`found ${n} rows`, 0.2, function () { return true; }, 1000);",
  "test.run(words, 0.2, function () { return true; }, 1000);",
  "test.run('a call with commas inside its body', 0.2, function () { return g(x, [1, 2]); }, 1000);",
  "test.run('a regular expression with a comma', 0.2, function () { return /a,b/.test(s); }, 1000);",
  "test.run('a severity that is no number', high, function () { return true; }, 1000);",
  "test.run('a severity past one', 2, function () { return true; }, 1000);",
  "test.run('no time limit', 0.2, function () { return true; });",
  "// test.run('a comment is no test', 0.2, function () { return true; }, 1000);",
  "test.run('the count is one', 0.2, function () { return true; }, 1000);",
  "function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }",
  "test.reportSuccessFailureCount();",
].join('\n');
const P = judge(PLANTED);
const values = P.titles.map(function (t) { return t.value; });
test.run('it finds every test of a planted suite, and none in a comment', 0.2, function () {
  return P.titles.length === 12 || 'found ' + short(P.titles.map(function (t) { return t.text; }));
}, 1000);
test.run('a quoted string and a plain template are plain titles', 0.2, function () {
  return (values[0] === 'the count is one' && values[1] === 'the field is shown' && values[2] === 'the row is drawn') || short(values.slice(0, 3));
}, 1000);
test.run('a joined string, a template with ${} and a bare name are built titles', 0.2, function () {
  return (P.built.length === 3 && P.built.every(function (t) { return /scripts|\$\{n\}|^words$/.test(t.text); })) || short(P.built.map(function (t) { return t.text; }));
}, 1000);
test.run('commas inside a body or a regular expression do not split its arguments', 0.2, function () {
  return (values.indexOf('a call with commas inside its body') !== -1 && values.indexOf('a regular expression with a comma') !== -1) || short(values);
}, 1000);
test.run('a title said twice in one suite is found', 0.2, function () {
  return (P.twice.length === 1 && P.twice[0].value === 'the count is one') || short(P.twice);
}, 1000);
test.run('a severity that is no number from 0.0 to 1.0 is found', 0.2, function () {
  return (P.severity.length === 2 && P.severity.every(function (t) { return /a severity that is no number|a severity past one/.test(t.text); })) || short(P.severity.map(function (t) { return t.text; }));
}, 1000);
test.run('a test with no time limit is found', 0.2, function () {
  return (P.limit.length === 1 && /no time limit/.test(P.limit[0].text)) || short(P.limit.map(function (t) { return t.text; }));
}, 1000);
test.run('a helper ok of its own, test.check, test.fail and reportSuccessFailureCount are found as old calls', 0.2, function () {
  return JSON.stringify(P.old.map(function (o) { return o.text; })) === JSON.stringify(['function ok', 'test.check', 'test.fail', 'test.reportSuccessFailureCount']) || short(P.old);
}, 1000);

// ── THE SUITES ASKED ────────────────────────────────────────────────────────────────────────────────────────────────────
const asked = ARGS[0] ? String(ARGS[0]).replace(/\\/g, '/').replace(/^\.\//, '').replace(/^spirit\/run\//, '') : '';
const SUITES = suitesFor(asked, tree());
const results = SUITES.map(function (f) { let src = ''; try { src = fs.readFileSync(path.join(RUN, f), 'utf8'); } catch (e) { src = ''; } return { file: f, r: judge(src) }; });
const first = function (list, part, show) { return short(list.slice(0, 4).map(function (x) { return x.file + ':' + show(x.r[part][0]); })); };
const count = function (list, part) { return list.reduce(function (n, x) { return n + x.r[part].length; }, 0); };

test.run('the world: there are suites to judge', 0.2, function () {
  return SUITES.length > 0 || 'no suite to judge in ' + (asked || 'the tree');
}, 1000);
test.run('every suite says its tests through test.run', 0.2, function () {
  const none = results.filter(function (x) { return !x.r.titles.length; });
  return !none.length || none.length + ' of ' + SUITES.length + ' suites hold no test.run; the first: ' + short(none.slice(0, 6).map(function (x) { return x.file; }));
}, 5000);
test.run('no suite keeps an old way of saying a check', 0.2, function () {
  const old = results.filter(function (x) { return x.r.old.length; });
  return !old.length || count(old, 'old') + ' in ' + old.length + ' suites; the first: ' + first(old, 'old', function (o) { return o.line + ' ' + o.text; });
}, 5000);
test.run('every title is one plain string, nothing built into it', 0.2, function () {
  const built = results.filter(function (x) { return x.r.built.length; });
  return !built.length || count(built, 'built') + ' in ' + built.length + ' suites; the first: ' + first(built, 'built', function (t) { return t.line + ' ' + t.text; });
}, 5000);
test.run('no suite says one title twice', 0.2, function () {
  const twice = results.filter(function (x) { return x.r.twice.length; });
  return !twice.length || count(twice, 'twice') + ' in ' + twice.length + ' suites; the first: ' + first(twice, 'twice', function (t) { return t.line + ' ' + t.value; });
}, 5000);
test.run('every test gives its severity, a number from 0.0 to 1.0', 0.2, function () {
  const bad = results.filter(function (x) { return x.r.severity.length; });
  return !bad.length || count(bad, 'severity') + ' in ' + bad.length + ' suites; the first: ' + first(bad, 'severity', function (t) { return t.line + ' ' + t.text; });
}, 5000);
test.run('every test gives its time limit, a number of milliseconds', 0.2, function () {
  const bad = results.filter(function (x) { return x.r.limit.length; });
  return !bad.length || count(bad, 'limit') + ' in ' + bad.length + ' suites; the first: ' + first(bad, 'limit', function (t) { return t.line + ' ' + t.text; });
}, 5000);
