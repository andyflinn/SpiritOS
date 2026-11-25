'use strict';

// spirit/run/spirit/type/test/boolean-sibling-general.js [file]
// THE RULES EVERY TYPE FILE KEEPS (goal/G48.4; spec: ./boolean-sibling-general.md). Andy: "spirit/type/test/
// boolean-sibling-general.js (is that a name that reaches all type files?)": a -sibling- general test beside
// spirit/type/boolean.js judges every module in spirit/type/ and below (../../test/TEST_SYSTEM.md).
//
//   node spirit/type/test/boolean-sibling-general.js spirit/type/string/label.js     that type file
//   node spirit/type/test/boolean-sibling-general.js                                 every type file
//
// Its rules, Andy's: "isValid() must return true for default() value of the same field script."; "isValid(value) must
// throw an error if the value is null or undefined". With them, the box: "a type script.js is an object containing static
// functions ... defaultValue() ... and isValid(something)".
require('../../script.js');
const GIVEN = process.argv.slice(2).filter(function (a, i, all) { return a.indexOf('--') !== 0 && all[i - 1] !== '--test'; });
function typeRules(ARGS) {
const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
const TYPE = path.join(RUN, 'spirit', 'type');

// Every type file: each script under spirit/type/, at any depth, leaving out the test folders.
function walk(dir) {
  let out = [];
  let names = [];
  try { names = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  names.forEach(function (d) {
    if (d.isDirectory()) { if (d.name !== 'test') out = out.concat(walk(path.join(dir, d.name))); }
    else if (/\.js$/.test(d.name)) out.push(path.relative(RUN, path.join(dir, d.name)).split(path.sep).join('/'));
  });
  return out;
}
const ALL = walk(TYPE).sort();
const asked = ARGS[0] ? String(ARGS[0]).replace(/\\/g, '/').replace(/^\.\//, '').replace(/^spirit\/run\//, '') : '';
const TARGETS = asked ? ALL.filter(function (f) { return f === asked; }) : ALL;
function load(rel) { try { return require(path.join(RUN, rel)); } catch (e) { return null; } }
function throws(T, v) { try { T.isValid(v); return false; } catch (e) { return e instanceof Error; } }
const every = function (fn) { return TARGETS.length > 0 && TARGETS.every(function (rel) { const T = load(rel); return !!T && fn(T); }); };

test.run('every type file under spirit/type/ is an object holding defaultValue, isValid and ruleDescription', 0.4, function () {
  return every(function (T) { return typeof T === 'object' && typeof T.defaultValue === 'function' && typeof T.isValid === 'function' && typeof T.ruleDescription === 'function'; }) || false;
}, test.limit.quick);
test.run('for every type file, isValid answers true for its own defaultValue()', 0.4, function () {
  return every(function (T) { try { return T.isValid(T.defaultValue()) === true; } catch (e) { return false; } }) || false;
}, test.limit.quick);
test.run('for every type file, isValid throws an error for null and for undefined', 0.4, function () {
  return every(function (T) { return throws(T, null) && throws(T, undefined); }) || false;
}, test.limit.quick);
// Box v23: "the third filed is ruleDesription(), it returns a short description if what the isValid() checks." Short: a
// description as spirit.type.string.description takes it, not empty and at most 128 bytes.
test.run('for every type file, ruleDescription() answers a short description of what isValid checks: a description of 1 to 128 bytes', 0.4, function () {
  const D = load('spirit/type/string/description.js');
  if (!D) return false;
  return every(function (T) {
    if (typeof T.ruleDescription !== 'function') return false;
    let d = null;
    try { d = T.ruleDescription(); } catch (e) { return false; }
    try { return typeof d === 'string' && D.isValid(d) === true; } catch (e) { return false; }
  }) || false;
}, test.limit.quick);

// A <type>Select.js, EVERY ONE (goal/G48.4; Andy: "every <type>Select.js requires its <type>.js and takes \"\" plus whatever
// <type>.js"; "<type>Select.js requires <type>.js, when validating <type>Select.js FIRST checks for \"\", and returns true if
// the value is \"\", it otherwise it lets <type>.js handle the check."; "<type>Select.js has it's own ruleDescription() and
// defaultValue() which is usually \"\""). Its sibling is the <type>.js beside it; the values tried are the sibling's own
// default, and a number, an object and true, which no string type takes.
const SELECTS = TARGETS.filter(function (rel) { return /Select\.js$/.test(rel); });
const siblingOf = function (rel) { return rel.replace(/Select\.js$/, '.js'); };
const everySelect = function (fn) { return SELECTS.length > 0 && SELECTS.every(function (rel) { const T = load(rel), B = load(siblingOf(rel)); return !!T && !!B && fn(T, B, rel); }); };
if (!asked || /Select\.js$/.test(asked)) {
  // Q22 (Andy: "get rid of spirit.type.string.line", "description, 128 bytes for a search string is plenty"): a search's
  // words are a descriptionSelect, and line.js goes, and lineSelect.js with it.
  test.run('the search and file filters are selects: spirit/type/string/descriptionSelect.js and fileSelect.js are there', 0.4, function () {
    return (fs.existsSync(path.join(RUN, 'spirit', 'type', 'string', 'descriptionSelect.js')) && fs.existsSync(path.join(RUN, 'spirit', 'type', 'string', 'fileSelect.js'))) || false;
  }, test.limit.quick);
  test.run('spirit/type/string/line.js and lineSelect.js are gone', 0.4, function () {
    return (!fs.existsSync(path.join(RUN, 'spirit', 'type', 'string', 'line.js')) && !fs.existsSync(path.join(RUN, 'spirit', 'type', 'string', 'lineSelect.js'))) || false;
  }, test.limit.quick);
  test.run('no script of the tree names spirit.type.string.line or spirit.type.string.lineSelect', 0.4, function () {
    const files = require('child_process').execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: RUN, encoding: 'utf8' }).split('\n').filter(function (f) { return /^spirit\/.+\.(js|json)$/.test(f) && !/(^|\/)test\//.test(f); });
    if (!files.length) return false;
    return !files.some(function (f) { let c = ''; try { c = fs.readFileSync(path.join(RUN, f), 'utf8'); } catch (e) { return false; } return /spirit\.type\.string\.line(Select)?\b/.test(c); }) || false;
  }, test.limit.quick);
  test.run('every <type>Select.js has its <type>.js beside it and requires it', 0.4, function () {
    return everySelect(function (T, B, rel) { const sib = siblingOf(rel); let code = ''; try { code = fs.readFileSync(path.join(RUN, rel), 'utf8'); } catch (e) { return false; } return fs.existsSync(path.join(RUN, sib)) && code.indexOf(path.basename(sib, '.js')) !== -1 && /require(?:Script)?\(/.test(code); }) || false;
  }, test.limit.quick);
  test.run('every <type>Select.js takes "", and its defaultValue() is ""', 0.4, function () {
    return everySelect(function (T) { try { return T.isValid('') === true && T.defaultValue() === ''; } catch (e) { return false; } }) || false;
  }, test.limit.quick);
  test.run('every <type>Select.js takes what its <type>.js takes, and throws where it throws', 0.4, function () {
    return everySelect(function (T, B) {
      let ok = false;
      try { ok = B.isValid(B.defaultValue()) === true && T.isValid(B.defaultValue()) === true; } catch (e) { return false; }
      return ok && [5, {}, true].every(function (v) { return throws(B, v) && throws(T, v); });
    }) || false;
  }, test.limit.quick);
  test.run('every <type>Select.js has a ruleDescription() of its own, not its <type>.js\'s', 0.4, function () {
    return everySelect(function (T, B) { try { return typeof T.ruleDescription() === 'string' && T.ruleDescription() !== B.ruleDescription(); } catch (e) { return false; } }) || false;
  }, test.limit.quick);
}

// A <type>New.js, EVERY ONE (goal/G48.4, Q12; Andy: "similar to <type>Select.js <type>New.js expands to allowable values."):
// it requires its <type>.js beside it and takes all that takes, and more; the values tried are the sibling's own default,
// and a number, an object and true, which neither takes.
const NEWS = TARGETS.filter(function (rel) { return /New\.js$/.test(rel); });
const siblingOfNew = function (rel) { return rel.replace(/New\.js$/, '.js'); };
const everyNew = function (fn) { return NEWS.length > 0 && NEWS.every(function (rel) { const T = load(rel), B = load(siblingOfNew(rel)); return !!T && !!B && fn(T, B, rel); }); };
if (!asked || /New\.js$/.test(asked)) {
  test.run('the key type for adding is a New: spirit/type/string/IDNew.js is there', 0.4, function () {
    return fs.existsSync(path.join(RUN, 'spirit', 'type', 'string', 'IDNew.js')) || false;
  }, test.limit.quick);
  test.run('every <type>New.js has its <type>.js beside it and requires it', 0.4, function () {
    return everyNew(function (T, B, rel) { const sib = siblingOfNew(rel); let code = ''; try { code = fs.readFileSync(path.join(RUN, rel), 'utf8'); } catch (e) { return false; } return fs.existsSync(path.join(RUN, sib)) && code.indexOf(path.basename(sib, '.js')) !== -1 && /require(?:Script)?\(/.test(code); }) || false;
  }, test.limit.quick);
  test.run('every <type>New.js takes what its <type>.js takes, and throws for a number, an object and true', 0.4, function () {
    return everyNew(function (T, B) {
      let ok = false;
      try { ok = B.isValid(B.defaultValue()) === true && T.isValid(B.defaultValue()) === true; } catch (e) { return false; }
      return ok && [5, {}, true].every(function (v) { return throws(T, v); });
    }) || false;
  }, test.limit.quick);
  test.run('every <type>New.js has a ruleDescription() of its own, not its <type>.js\'s', 0.4, function () {
    return everyNew(function (T, B) { try { return typeof T.ruleDescription() === 'string' && T.ruleDescription() !== B.ruleDescription(); } catch (e) { return false; } }) || false;
  }, test.limit.quick);
}
}
if (!GIVEN.length) typeRules([]);
else GIVEN.forEach(function (one) { require('../../test/testReport.js').forScript(one, function () { typeRules([one]); }); });
