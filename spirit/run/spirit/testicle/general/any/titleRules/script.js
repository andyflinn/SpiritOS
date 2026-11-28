'use strict';
// spirit/run/spirit/testicle/general/any/titleRules/script.js
// A RULE MODULE OF THE GENERAL TEST (goal/G49.27, step 2a; box v5, Andy's Go: "spirit/testicle/ is the faceless test system",
// the general rules become modules, one rule set one module). Its checks are the part titleRules(ARGS) of
// spirit/test/script-sibling-general.js, moved here unchanged in what they check and in their titles; that file is the runner
// that loads this module and calls it. Its own test: ./test/script.js. A rule module hands out { appliesTo, resource, own, forbids, checks }:
//   appliesTo(scriptPath)      whether a path handed may be one this module judges (the runner asks it before checks)
//   resource                   'none' | 'node' | 'browser' | 'relay': what its checks stand on
//   own                        true when its checks change their node, which then is one of its own
//   forbids                    the names its checks look for, which the name rules skip in its own files (Andy: "All, cw's way")
//   checks(scriptPath, tools)  says its tests, each a test.run with its title; scriptPath '' judges every script it
//                              applies to. tools: { test, run, spirit, node, forbids }, the reporter, the run root judged, its
//                              spirit object, the run's one shared scratch node ({ node }) and every module's forbids by folder.
const SPIRIT = require('../../../../script.js');

function appliesTo(scriptPath) {
  // Every path: its planted suites always, and the suites of the path handed (none for a path with no suite).
  return true;
}

function checks(scriptPath, tools) {
const ARGS = scriptPath ? [scriptPath] : [];
const test = tools.test;

// spirit/run/spirit/test/script-sibling-titleRules.js [file or folder]
// EVERY TEST ONE test.run, ITS TITLE A PLAIN AND STEADY STRING, UNIQUE IN ITS SUITE, WITH ITS SEVERITY AND TIME LIMIT (goal/G45.3,
// goal/G47.2; spec: ./script-sibling-titleRules.md). The
// box: "every test's title is a plain string; it is steady, with no count, value, path or number built into it; and it is
// unique within its suite.", "Run on a folder, it judges that folder's suites alone, so each title item's red is this test
// on its own folder." A test's title is what failed when it is red, and the key it is kept by (goal/G45.1: "A test's key is
// its description, nothing else"), so a title that changes from run to run makes a new test each run.
//
//   node spirit/test/script-sibling-titleRules.js spirit/app/desk          every suite under that folder
//   node spirit/test/script-sibling-titleRules.js spirit/app/desk/desk.js  that production file's own suite
//   node spirit/test/script-sibling-titleRules.js spirit/client/test/script.js      that suite (a file in a test/ folder)
//   node spirit/test/script-sibling-titleRules.js                          every suite of the tree
//
// A suite is a .js file in a folder named test, not one of spirit/test/'s tools. A TEST is one call to the reporter,
// test.run(title, severity, body, limit) (goal/G47.2; Andy: "Every test inside every suite has its unique (within the
// suite) title. Every test supplies its severity", "One call per test, the reporter's"): its TITLE, the words it is kept by,
// is one plain string literal, quoted or a template with no ${}, so nothing in it can change between runs; its severity a
// number literal from 0.0 to 1.0; its time limit one of the reporter's named limits,
// test.limit.quick, .slow or .long, never a number of its own. A suite says its checks through
// test.run alone: a helper ok of its own, test.check, test.fail and test.reportSuccessFailureCount are the old ways
// (goal/G47.2: "No suite keeps a helper of its own that hands the reporter a title on a pass and other words on a fail").
// The code is read, comments out; the suite is never run. What a check found belongs in what its body answers, never its
// title. This test's own titles name no file and no count: those are its details.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const RUN = tools.run;
const VENDORED_FOLDERS = SPIRIT.requireScript('spirit/fs/fileSystem/script.js').VENDORED_FOLDERS;

// The tools of spirit/test/ are no suites (spirit/testicle/testModule/script.js TOOLS).
const TOOLS = ['spirit/testicle/testReport/script.js', 'spirit/testicle/testModule/script.js', 'spirit/testicle/headLessChrome/script.js'];

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
    if (ch === '/' && (/[(,=:[!&|?{};+\-*%<>~^]$/.test(last) || last === '' || /\b(return|typeof|case|in|of)$/.test(out.replace(/\s+$/, "").slice(-8)))) { regex = true; cls = false; out += ch; i += 1; last = ch; continue; }
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
// One of the reporter's named time limits (testReport.js test.limit; Andy, 2026-11-11: "i hope you have those as
// relatively central constants"): its name; a number of its own, or anything else: null.
function namedLimit(arg) { const m = /^test\.limit\.(quick|slow|long)$/.exec(String(arg || '').trim()); return m ? m[1] : null; }
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
    out.push({ line: code.slice(0, at).split('\n').length, text: args[0].slice(0, 120), value: plainValue(args[0]), severity: plainNumber(args[1]), limit: namedLimit(args[3]) });
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
  const limit = titles.filter(function (t) { return t.limit === null; });
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
  "test.run('the count is one', 0.2, function () { return a === 1; }, test.limit.quick);",
  "test.run(\"the field is shown\", 0.4, function () { return b; }, test.limit.quick);",
  "test.run(`the row is drawn`, 0.8, async function () { return c; }, test.limit.quick);",
  "test.run('the world: ' + n + ' scripts', 0.2, function () { return true; }, test.limit.quick);",
  "test.run(`found ${n} rows`, 0.2, function () { return true; }, test.limit.quick);",
  "test.run(words, 0.2, function () { return true; }, test.limit.quick);",
  "test.run('a call with commas inside its body', 0.2, function () { return g(x, [1, 2]); }, test.limit.quick);",
  "test.run('a regular expression with a comma', 0.2, function () { return /a,b/.test(s); }, test.limit.quick);",
  "test.run('a severity that is no number', high, function () { return true; }, test.limit.quick);",
  "test.run('a severity past one', 2, function () { return true; }, test.limit.quick);",
  "test.run('no time limit', 0.2, function () { return true; });",
  "test.run('a limit of its own number', 0.2, function () { return true; }, 1000);",
  "// test.run('a comment is no test', 0.2, function () { return true; }, test.limit.quick);",
  "test.run('the count is one', 0.2, function () { return true; }, test.limit.quick);",
  "function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }",
  "test.reportSuccessFailureCount();",
].join('\n');
const P = judge(PLANTED);
const values = P.titles.map(function (t) { return t.value; });
test.run('it finds every test of a planted suite, and none in a comment', 0.2, function () {
  return P.titles.length === 13 || false;
}, test.limit.quick);
test.run('a quoted string and a plain template are plain titles', 0.2, function () {
  return (values[0] === 'the count is one' && values[1] === 'the field is shown' && values[2] === 'the row is drawn') || false;
}, test.limit.quick);
test.run('a joined string, a template with ${} and a bare name are built titles', 0.2, function () {
  return (P.built.length === 3 && P.built.every(function (t) { return /scripts|\$\{n\}|^words$/.test(t.text); })) || false;
}, test.limit.quick);
test.run('commas inside a body or a regular expression do not split its arguments', 0.2, function () {
  return (values.indexOf('a call with commas inside its body') !== -1 && values.indexOf('a regular expression with a comma') !== -1) || false;
}, test.limit.quick);
test.run('a title said twice in one suite is found', 0.2, function () {
  return (P.twice.length === 1 && P.twice[0].value === 'the count is one') || false;
}, test.limit.quick);
test.run('a severity that is no number from 0.0 to 1.0 is found', 0.2, function () {
  return (P.severity.length === 2 && P.severity.every(function (t) { return /a severity that is no number|a severity past one/.test(t.text); })) || false;
}, test.limit.quick);
test.run('a test with no time limit, or a number of its own, is found', 0.2, function () {
  return (P.limit.length === 2 && /no time limit/.test(P.limit[0].text) && /its own number/.test(P.limit[1].text)) || false;
}, test.limit.quick);
test.run('a helper ok of its own, test.check, test.fail and reportSuccessFailureCount are found as old calls', 0.2, function () {
  return JSON.stringify(P.old.map(function (o) { return o.text; })) === JSON.stringify(['function ok', 'test.check', 'test.fail', 'test.reportSuccessFailureCount']) || false;
}, test.limit.quick);

// ── THE SUITES ASKED ────────────────────────────────────────────────────────────────────────────────────────────────────
const asked = ARGS[0] ? String(ARGS[0]).replace(/\\/g, '/').replace(/^\.\//, '').replace(/^spirit\/run\//, '') : '';
const SUITES = suitesFor(asked, tree());
const results = SUITES.map(function (f) { let src = ''; try { src = fs.readFileSync(path.join(RUN, f), 'utf8'); } catch (e) { src = ''; } return { file: f, r: judge(src) }; });
test.run('there are suites to judge', 0.2, function () {
  return SUITES.length > 0 || false;
}, test.limit.quick);
test.run('every suite says its tests through test.run', 0.2, function () {
  const none = results.filter(function (x) { return !x.r.titles.length; });
  return !none.length || false;
}, test.limit.slow);
test.run('no suite keeps an old way of saying a check', 0.2, function () {
  const old = results.filter(function (x) { return x.r.old.length; });
  return !old.length || false;
}, test.limit.slow);
test.run('every title is one plain string, nothing built into it', 0.2, function () {
  const built = results.filter(function (x) { return x.r.built.length; });
  return !built.length || false;
}, test.limit.slow);
test.run('no suite says one title twice', 0.2, function () {
  const twice = results.filter(function (x) { return x.r.twice.length; });
  return !twice.length || false;
}, test.limit.slow);
test.run('every test gives its severity, a number from 0.0 to 1.0', 0.2, function () {
  const bad = results.filter(function (x) { return x.r.severity.length; });
  return !bad.length || false;
}, test.limit.slow);
test.run('every test gives its time limit, one of the reporter\'s named limits', 0.2, function () {
  const bad = results.filter(function (x) { return x.r.limit.length; });
  return !bad.length || false;
}, test.limit.slow);
}

// No name its checks look for is skipped in its files (goal/G49.27, Andy: "All, cw's way"): it forbids none by name.
const FORBIDS_NAMES = [];
module.exports = { appliesTo: appliesTo, resource: 'none', own: false, forbids: FORBIDS_NAMES, checks: checks };
