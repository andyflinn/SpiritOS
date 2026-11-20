'use strict';
// spirit/run/spirit/console/command.js
// THE CONSOLE'S COMMAND PROCESSOR (goal/G48.2, the box: "the script run://spirit/console/command.js will be the consoles
// command processor"). It is handed one line and answers what to print; the console's state, its path and its history, it
// keeps itself in spirit/state/console/node.json (the box: "the state of the console is kept in
// run://spirit/state/console/node.json ... the current navigation path of the console and a 256 rolling command history";
// Andy: "console can read state itself, it's an intrinsic part of SpiritOS."). Anything else of the tree it reaches only
// through the node's verbs (Andy: "the only way it can access files inside of run:// is through the node api's"): whether
// a path is there, it asks the node's fs stat.
//
//   run(line) -> Promise<{ ok, out, path }>   out what to print (a refusal as JSON), path the path after the line ('' at
//                                             the root)
//   state()   -> { path, history }            as the state file holds it now
//
/// ITS COMMANDS: path (goal/G48.2, the box, ### behavior), and api (goal/G48.3, below run's helpers).
// path:
//   path          shows the path stored in state
//   path <        to the parent; refused at the root
//   path <<       to the root, where the prompt is "spirit: "; refused at the root
//   path <name>   a name or a dot sequence, always the state's path plus the asked one, refused (path kept) unless that is
//                 a folder inside run://spirit/
// Each line that moved the path is logged as if typed at the root, "path app.agent" (the box: "logs the command as path
// app.agent"); the root itself as "path <<". The newest 256 are kept.
require('../spirit.js');
const fs = require('fs');
const path = require('path');

const RUN = path.resolve(__dirname, '..', '..');
const STATE = path.join(RUN, 'spirit', 'state', 'console', 'node.json');
const HISTORY_MAX = 256;
const NAME = /^[A-Za-z0-9_-]+$/;

function state() {
  let s = null;
  try { s = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch (e) { s = null; }
  const p = s && typeof s.path === 'string' ? s.path : '';
  const h = s && Array.isArray(s.history) ? s.history.filter(function (l) { return typeof l === 'string'; }) : [];
  return { path: p, history: h.slice(-HISTORY_MAX) };
}
function save(s) {
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify({ path: s.path, history: s.history.slice(-HISTORY_MAX) }, null, 2));
}
function shown(p) { return p ? 'spirit.' + p : 'spirit'; }

// Whether spirit/<the path's folders> is there, as the node's fs stat answers.
function there(p) {
  return spirit.require(spirit.familyPath('fs')).then(function (f) { return f.stat({ path: 'spirit/' + p.split('.').join('/') }); })
    .then(function () { return true; }, function () { return false; });
}

// A REFUSAL, PRINTED AS JSON (the box v12: "errors are return in JSON.stringify(error,null,2) format."): the node's own
// refusal shape, { ok: false, code, error }, and the path left as it was.
function refused(s, code, why) { return { ok: false, out: JSON.stringify({ ok: false, code: code, error: why }, null, 2), path: s.path }; }
// EVERY SUCCESSFUL COMMAND LOGGED (Andy: "a successfully run command must be logged in state and be available for re-use
// with the up-key on the keyboad, the up key isn't for navigation only, it's for every command that is successful."), as
// if typed from the root: a command run at a path is logged with that path ahead of it, "node card", "app.desk api"; a
// refused one is not logged.
function logged(s, line) {
  const l = String(line || '').trim();
  s.history.push(s.path ? s.path + ' ' + l : l);
  save(s);
}
function moved(s, to) {
  s.path = to;
  s.history.push(to ? 'path ' + to : 'path <<');
  save(s);
  return { ok: true, out: shown(to), path: to };
}

function pathCommand(s, arg) {
  if (!arg) return Promise.resolve({ ok: true, out: shown(s.path), path: s.path });
  if (arg === '<' || arg === '<<') {
    if (!s.path) return Promise.resolve(refused(s, 'at-the-root', 'already at the root: spirit'));
    return Promise.resolve(moved(s, arg === '<<' ? '' : s.path.split('.').slice(0, -1).join('.')));
  }
  const asked = arg.split('.');
  if (!asked.every(function (n) { return NAME.test(n); })) return Promise.resolve(refused(s, 'no-such-path', 'no such path: ' + arg));
  const to = (s.path ? s.path + '.' : '') + asked.join('.');
  return there(to).then(function (yes) { return yes ? moved(s, to) : refused(s, 'no-such-path', 'no such path: ' + shown(to)); });
}

// THE api COMMAND (goal/G48.3, the box: "if I'm at a branch folder, this command without arguments lists all verbs, in
// simple json format, sorted by name", "if there's no branch's api.js it returns a json error", "if the api command names
// a verb: it returns that verbs command-line-format in json, human and machine readable, with a field \"usage\" at the very
// bottom"; Andy: "the console command: \"api search\" will return a JSON.stringify(search,null,2) desription"). The branch
// at the path is spirit/<its folders>/api.js, asked whether it is there through the node's fs stat and loaded through
// spirit.require; its verbs are its own verbs table. One verb is its <verb>.json as the node's fs load serves it, with usage
/// added last: the line a person types, each argument a placeholder named by its rule in the branch's own verbs table, an
// optional one in brackets.
function apiFile(p) { return 'spirit/' + p.split('.').join('/') + '/api.js'; }
function verbsAt(p) {
  if (!p) return Promise.resolve(null);
  const file = apiFile(p);
  return spirit.require(spirit.familyPath('fs')).then(function (f) { return f.stat({ path: file }); }).then(function () {
    spirit.require(file);
    const at = file.replace(/\.js$/, '').split('/').reduce(function (o, k) { return o && o[k]; }, spirit.required);
    return at && at.verbs && typeof at.verbs === 'object' ? at.verbs : null;
  }, function () { return null; });
}
function usageOf(verb, request) {
  return [verb].concat(Object.keys(request || {}).map(function (k) {
    const rule = String(request[k]);
    const one = k + '=<' + rule.replace(/\?$/, '') + '>';
    return /\?$/.test(rule) ? '[' + one + ']' : one;
  })).join(' ');
}
function apiCommand(s, verb, line) {
  return verbsAt(s.path).then(function (verbs) {
    if (!verbs) return refused(s, 'no-branch', 'no branch here: ' + shown(s.path) + ' has no api.js');
    if (!verb) { logged(s, line); return { ok: true, out: JSON.stringify(Object.keys(verbs).sort(), null, 2), path: s.path }; }
    if (!Object.prototype.hasOwnProperty.call(verbs, verb)) return refused(s, 'no-such-verb', 'no such verb at ' + shown(s.path) + ': ' + verb);
    const file = 'spirit/' + s.path.split('.').join('/') + '/' + verb + '.json';
    return spirit.require(spirit.familyPath('fs')).then(function (f) { return f.load({ path: file }); }).then(function (r) {
      const j = JSON.parse(String((r && r.text) || ''));
      const out = Object.assign({}, j, { usage: usageOf(verb, verbs[verb]) });
      logged(s, line);
      return { ok: true, out: JSON.stringify(out, null, 2), path: s.path };
    }, function () { return refused(s, 'no-such-verb', 'no description of ' + verb + ' at ' + shown(s.path)); });
  });
}

// A LINE IN WORDS (goal/G48.3, the box, ## typing values: "a value with a space in it is put in double quotes"): split at
// the spaces outside double quotes; a word or a value wholly in quotes (text="hello all") has them taken off, while a
// value with quotes inside it, JSON like debug={"on":true}, keeps them. null when a quote is left open.
function wordsOf(line) {
  const text = String(line || '');
  const out = [];
  let word = '';
  let open = false;
  for (const c of text) {
    if (c === '"') open = !open;
    if (!open && /\s/.test(c)) { if (word) out.push(word); word = ''; continue; }
    word += c;
  }
  if (open) return null;
  if (word) out.push(word);
  return out.map(function (w) {
    const eq = w.indexOf('=');
    const name = eq > 0 && w.charAt(0) !== '"' ? w.slice(0, eq + 1) : '';
    const value = w.slice(name.length);
    return name + (/^"[^"]*"$/.test(value) ? value.slice(1, -1) : value);
  });
}
// A VALUE AS ITS ARGUMENT'S RULE SAYS (the box: "a value is read as its argument's rule in the verb's own file says: a number
// argument as a number, a yes/no argument as true or false, a list or object argument as JSON"); anything else as typed.
// The rules are type paths since goal/G48.4 (each argument of its api.js names its type by its full path, spirit.type.<...>):
// spirit.type.number.* a number, spirit.type.boolean true or false, spirit.type.object.* JSON. A list is spirit.type.string.json,
// a string of JSON, so it goes as typed.
function valueOf(rule, text) {
  const r = String(rule || '').replace(/\?$/, '');
  if (r.indexOf('spirit.type.number.') === 0) return text.trim() === '' ? text : Number(text);
  if (r === 'spirit.type.boolean') return text === 'true' ? true : text === 'false' ? false : text;
  if (r.indexOf('spirit.type.object.') === 0) { try { return JSON.parse(text); } catch (e) { return text; } }
  return text;
}
// EXECUTING A VERB (the box, ## executing verbs: "at a branch, a line typed as its usage shows ... executes that verb, and
// the console shows the json it returns, as JSON.stringify(answer,null,2)", "a verb the node refuses shows that refusal as
// a json error"): the branch bound through spirit.require, the verb asked with the arguments typed name=value.
function verbCommand(s, verbs, words, line) {
  const verb = words[0];
  const rules = verbs[verb] || {};
  const args = {};
  for (let i = 1; i < words.length; i++) {
    const eq = words[i].indexOf('=');
    if (eq < 1) return Promise.resolve(refused(s, 'bad-argument', 'not name=value: ' + words[i]));
    const name = words[i].slice(0, eq);
    if (!Object.prototype.hasOwnProperty.call(rules, name)) return Promise.resolve(refused(s, 'no-such-argument', verb + ' has no argument ' + name));
    args[name] = valueOf(rules[name], words[i].slice(eq + 1));
  }
  return Promise.resolve(spirit.require(apiFile(s.path))).then(function (branch) { return branch[verb](args); }).then(function (answer) {
    logged(s, line);
    return { ok: true, out: JSON.stringify(answer === undefined ? null : answer, null, 2), path: s.path };
  }, function (e) {
    const body = e && e.body && typeof e.body === 'object' && !Array.isArray(e.body) && Object.keys(e.body).length ? e.body : { ok: false, code: (e && e.code) || 'refused', error: (e && e.message) || String(e) };
    return { ok: false, out: JSON.stringify(body, null, 2), path: s.path };
  });
}

function run(line) {
  const words = wordsOf(line);
  const s = state();
  if (words === null) return Promise.resolve(refused(s, 'open-quote', 'a quote is left open: ' + String(line).trim()));
  if (!words.length) return Promise.resolve({ ok: true, out: '', path: s.path });
  if (words[0] === 'path' && words.length <= 2) return pathCommand(s, words[1] || '');
  if (words[0] === 'api' && words.length <= 2) return apiCommand(s, words[1] || '', line);
  // A verb of the branch at the path, typed with its arguments.
  return verbsAt(s.path).then(function (verbs) {
    if (verbs && Object.prototype.hasOwnProperty.call(verbs, words[0])) return verbCommand(s, verbs, words, line);
    return refused(s, 'no-such-command', 'no such command: ' + words.join(' '));
  });
}

module.exports = { run: run, state: state, HISTORY_MAX: HISTORY_MAX };
