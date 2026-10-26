'use strict';

// spirit/run/test/spirit-child-generalRules.js <file>
// THE GENERAL RULES OF A MODULE (goal/G40.6), run once per file it judges, the file its argument. Andy: "it will assert,
// the require path rule it will assert that the spirit-object becomes a global at the top of all modules"; spirit.js
// itself is judged too: "it must establish the global spirit object early in the code, it must follow the require-path
// restrictions we discussed." Each file is its own test id: "create separate test id's for every file called with that
// general-rule assertion". A rule a file breaks fails that file's test, not the item that brought the test (Andy: "just
// getting a first fail or success, that is a success here.").
//
// THE REQUIRE RULE (goal/G40's box): "a require path that starts with ../ may only add a file name, never descend into a
// subfolder of an ancestor; any other require path starts with <module>/, the module's own children. A sibling in the
// module's own folder is legal." A package or a node built-in is not a path and is left alone; a require whose path is
// computed cannot be read here and is left alone too.
//
// THE GLOBAL EARLY: a module's first require is spirit.js, so spirit is a plain global before anything else is loaded.
// spirit.js itself makes the global: it sets it before its first require.

const fs = require('fs');
const path = require('path');
// The product test system's own reporter (goal/G40.13): nothing of spirit/run/ reaches into the old test system.
const test = require(path.join(__dirname, 'testReport.js'));

const RUN = path.join(__dirname, '..');
const REPO = path.join(RUN, '..', '..');
const arg = String(process.argv[2] || '');
let full = '';
for (const p of [path.resolve(arg), path.join(RUN, arg), path.join(REPO, arg)]) {
  if (arg && fs.existsSync(p) && fs.statSync(p).isFile()) { full = p; break; }
}
const name = full ? path.relative(REPO, full).split(path.sep).join('/') : arg;

test.startTest('spirit-child-generalRules: ' + (name || '(no file given)'));

if (!full) {
  test.fail('no module to judge: ' + JSON.stringify(arg));
} else {
  // The code without its comments, so a require named in a comment is not read as one.
  const code = fs.readFileSync(full, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
  const requires = [];
  const re = /\brequire\(\s*(['"])([^'"]+)\1\s*\)/g;
  let m;
  while ((m = re.exec(code))) requires.push({ at: m.index, path: m[2] });
  const own = path.basename(full, '.js');
  const isSpirit = path.resolve(full) === path.join(RUN, 'spirit.js');

  // ── THE GLOBAL EARLY ───────────────────────────────────────────────────
  test.subHeading('the spirit object is a global before anything else is loaded');
  const first = requires[0];
  if (isSpirit) {
    const sets = code.search(/\broot\.spirit\s*=|\bglobalThis\.spirit\s*=|\bglobal\.spirit\s*=/);
    if (sets !== -1 && (!first || sets < first.at)) test.check(name + ' sets the global spirit before its first require');
    else test.fail(name + ' sets the global spirit ' + (sets === -1 ? 'nowhere' : 'only after its first require, ' + JSON.stringify(first.path)));
  } else if (first && /(^|\/)spirit\.js$/.test(first.path) && path.resolve(path.dirname(full), first.path) === path.join(RUN, 'spirit.js')) {
    test.check(name + ' requires spirit.js first');
  } else {
    test.fail(name + ' does not require spirit.js first' + (first ? ': its first require is ' + JSON.stringify(first.path) : ': it requires nothing'));
  }

  // ── THE REQUIRE RULE ───────────────────────────────────────────────────
  test.subHeading('every require path is a child, a sibling or an ancestor\'s file');
  const bad = requires.filter(function (r) {
    const p = r.path;
    if (!/^[./]/.test(p)) return false;
    if (/^\.\.\//.test(p)) return /\//.test(p.replace(/^(\.\.\/)+/, ''));
    if (/^\.\//.test(p)) {
      const rest = p.slice(2);
      return rest.indexOf('/') !== -1 && rest.indexOf(own + '/') !== 0;
    }
    return true;
  });
  if (!bad.length) test.check(name + ': ' + requires.length + ' require path(s), none breaks the rule');
  else bad.forEach(function (r) { test.fail('require error: ' + name + ' requires ' + JSON.stringify(r.path)); });
}

test.reportSuccessFailureCount();
