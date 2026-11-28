'use strict';
// spirit/run/spirit/testicle/general/any/typeRules/script.js
// A RULE MODULE OF THE GENERAL TEST (goal/G49.27, step 2a; box v5, Andy's Go: "spirit/testicle/ is the faceless test system",
// the general rules become modules, one rule set one module). Its checks are the part typeRules(ARGS) of
// the old -general runner of spirit/test/, moved here unchanged in what they check and in their titles; its runner now,
// which loads this module and calls it, is spirit/testicle/run/none/script.js (goal/G49.27, step 3). Its own test: ./test/script.js. A rule module hands out { appliesTo, resource, own, forbids, checks }:
//   appliesTo(scriptPath)      whether a path handed may be one this module judges (the runner asks it before checks)
//   resource                   'none' | 'node' | 'browser' | 'relay': what its checks stand on
//   own                        true when its checks change their node, which then is one of its own
//   forbids                    the names its checks look for, which the name rules skip in its own files (Andy: "All, cw's way")
//   checks(scriptPath, tools)  says its tests, each a test.run with its title; scriptPath '' judges every script it
//                              applies to. tools: { test, run, spirit, node, forbids }, the reporter, the run root judged, its
//                              spirit object, the run's one shared scratch node ({ node }) and every module's forbids by folder.
const SPIRIT = require('../../../../script.js');

function appliesTo(scriptPath) {
  // A type file is under spirit/type/; given no path, every one.
  return !scriptPath || String(scriptPath).replace(/\\/g, '/').replace(/^\.\//, '').replace(/^spirit\/run\//, '').indexOf('spirit/type/') === 0;
}

function checks(scriptPath, tools) {
const ARGS = scriptPath ? [scriptPath] : [];
const test = tools.test;
// A MODULE'S OWN FORBIDDEN NAMES ARE NOT ITS FAULT (goal/G49.27; Andy: "All, cw's way"): a rule module names what it forbids,
// in its titles, its patterns and its comments. A name rule skips exactly the names a module hands out as forbids, and only
// in that module's own files (its script.js and its test/): each such name is blanked, its length kept, before the file is
// read; every other name in those files, and every other file, is judged as any product file. tools.forbids maps each
// module's folder (spirit/testicle/general/<rule>) to its forbids; the runner hands it.
const FORBIDS = tools.forbids || {};
function unforbidden(rel, text) {
  const r = String(rel || '').replace(/^spirit\/run\//, '');
  const own = Object.keys(FORBIDS).filter(function (dir) { return r === dir + '/script.js' || r.indexOf(dir + '/test/') === 0; })[0];
  if (!own) return text;
  let t = String(text);
  FORBIDS[own].forEach(function (n) { t = t.split(n).join(String(n).replace(/[^\n]/g, ' ')); });
  return t;
}
  const fs = require('fs');
  const path = require('path');
  const RUN = tools.run;
  // The loader of the run judged (the runner hands its spirit object).
  const LOADER = tools.spirit;
  const asked = ARGS[0] ? String(ARGS[0]).replace(/\\/g, '/').replace(/^\.\//, '').replace(/^spirit\/run\//, '') : '';
  if (asked && asked.indexOf('spirit/type/') !== 0) return;
  const TYPE = path.join(RUN, 'spirit', 'type');
  // Every type file: a script.js under spirit/type/, at any depth, its test folders left out.
  const walk = function (dir) {
    let out = [];
    let names = [];
    try { names = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
    names.forEach(function (d) {
      if (d.isDirectory()) { if (d.name !== 'test') out = out.concat(walk(path.join(dir, d.name))); }
      else if (d.name === 'script.js') out.push(path.relative(RUN, path.join(dir, d.name)).split(path.sep).join('/'));
    });
    return out;
  };
  const ALL = walk(TYPE).sort();
  const TARGETS = asked ? ALL.filter(function (f) { return f === asked; }) : ALL;
  const at = function (rel) { return fs.existsSync(path.join(RUN, rel)); };
  // A type by its run-root path, through the one loader (goal/G49.9).
  const load = function (rel) { try { return LOADER.requireScript(rel); } catch (e) { return null; } };
  const throws = function (T, v) { try { T.isValid(v); return false; } catch (e) { return e instanceof Error; } };
  const nameOf = function (rel) { return rel.split('/').slice(-2)[0]; };
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
  // Box v23 (goal/G48.4): "the third filed is ruleDesription(), it returns a short description if what the isValid() checks."
  test.run('for every type file, ruleDescription() answers a short description of what isValid checks: a description of 1 to 128 bytes', 0.4, function () {
    const D = load('spirit/type/string/description/script.js');
    if (!D) return false;
    return every(function (T) {
      if (typeof T.ruleDescription !== 'function') return false;
      let d = null;
      try { d = T.ruleDescription(); } catch (e) { return false; }
      try { return typeof d === 'string' && D.isValid(d) === true; } catch (e) { return false; }
    }) || false;
  }, test.limit.quick);

  // A <type>Select, EVERY ONE (goal/G48.4; Andy: "every <type>Select.js requires its <type>.js and takes \"\" plus whatever
  // <type>.js"): spirit/type/.../<type>Select/script.js, its sibling spirit/type/.../<type>/script.js beside it.
  const SELECTS = TARGETS.filter(function (rel) { return /Select$/.test(nameOf(rel)); });
  const siblingOf = function (rel, end) { const n = nameOf(rel); return rel.replace(new RegExp(n + '/script\\.js$'), n.slice(0, -end.length) + '/script.js'); };
  const everySelect = function (fn) { return SELECTS.length > 0 && SELECTS.every(function (rel) { const T = load(rel), B = load(siblingOf(rel, 'Select')); return !!T && !!B && fn(T, B, rel); }); };
  const requiresSibling = function (rel, end) {
    const sib = siblingOf(rel, end);
    let code = '';
    try { code = fs.readFileSync(path.join(RUN, rel), 'utf8'); } catch (e) { return false; }
    return at(sib) && code.indexOf(sib) !== -1 && /require(?:Script)?\(/.test(code);
  };
  if (!asked || /Select$/.test(nameOf(asked))) {
    // Q22 (Andy: "get rid of spirit.type.string.line", "description, 128 bytes for a search string is plenty").
    test.run('the search and file filters are selects: spirit/type/string/descriptionSelect/script.js and fileSelect/script.js are there', 0.4, function () {
      return (at('spirit/type/string/descriptionSelect/script.js') && at('spirit/type/string/fileSelect/script.js')) || false;
    }, test.limit.quick);
    // Asked by its old name and its new one, so a gone type is never found only by the name nobody uses any more.
    test.run('spirit/type/string/line.js and lineSelect.js are gone', 0.4, function () {
      return !['line', 'lineSelect'].some(function (n) { return at('spirit/type/string/' + n + '.js') || at('spirit/type/string/' + n + '/script.js'); }) || false;
    }, test.limit.quick);
    test.run('no script of the tree names spirit.type.string.line or spirit.type.string.lineSelect', 0.4, function () {
      const files = require('child_process').execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: RUN, encoding: 'utf8' }).split('\n').filter(function (f) { return /^spirit\/.+\.(js|json)$/.test(f) && !/(^|\/)test\//.test(f); });
      if (!files.length) return false;
      return !files.some(function (f) { let c = ''; try { c = unforbidden(f, fs.readFileSync(path.join(RUN, f), 'utf8')); } catch (e) { return false; } return /spirit\.type\.string\.line(Select)?\b/.test(c); }) || false;
    }, test.limit.quick);
    test.run('every <type>Select.js has its <type>.js beside it and requires it', 0.4, function () {
      return everySelect(function (T, B, rel) { return requiresSibling(rel, 'Select'); }) || false;
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

  // A <type>New, EVERY ONE (goal/G48.4, Q12; Andy: "similar to <type>Select.js <type>New.js expands to allowable values.").
  const NEWS = TARGETS.filter(function (rel) { return /New$/.test(nameOf(rel)); });
  const everyNew = function (fn) { return NEWS.length > 0 && NEWS.every(function (rel) { const T = load(rel), B = load(siblingOf(rel, 'New')); return !!T && !!B && fn(T, B, rel); }); };
  if (!asked || /New$/.test(nameOf(asked))) {
    test.run('the key type for adding is a New: spirit/type/string/IDNew/script.js is there', 0.4, function () {
      return at('spirit/type/string/IDNew/script.js') || false;
    }, test.limit.quick);
    test.run('every <type>New.js has its <type>.js beside it and requires it', 0.4, function () {
      return everyNew(function (T, B, rel) { return requiresSibling(rel, 'New'); }) || false;
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

// The names its checks look for (goal/G49.27, Andy: "All, cw's way"): the name rules skip exactly these, in this module's own files.
const FORBIDS_NAMES = ['spirit.type.string.line'];
module.exports = { appliesTo: appliesTo, resource: 'none', own: false, forbids: FORBIDS_NAMES, checks: checks };
