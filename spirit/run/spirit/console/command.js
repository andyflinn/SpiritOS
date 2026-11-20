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
function apiCommand(s, verb) {
  return verbsAt(s.path).then(function (verbs) {
    if (!verbs) return refused(s, 'no-branch', 'no branch here: ' + shown(s.path) + ' has no api.js');
    if (!verb) return { ok: true, out: JSON.stringify(Object.keys(verbs).sort(), null, 2), path: s.path };
    if (!Object.prototype.hasOwnProperty.call(verbs, verb)) return refused(s, 'no-such-verb', 'no such verb at ' + shown(s.path) + ': ' + verb);
    const file = 'spirit/' + s.path.split('.').join('/') + '/' + verb + '.json';
    return spirit.require(spirit.familyPath('fs')).then(function (f) { return f.load({ path: file }); }).then(function (r) {
      const j = JSON.parse(String((r && r.text) || ''));
      const out = Object.assign({}, j, { usage: usageOf(verb, verbs[verb]) });
      return { ok: true, out: JSON.stringify(out, null, 2), path: s.path };
    }, function () { return refused(s, 'no-such-verb', 'no description of ' + verb + ' at ' + shown(s.path)); });
  });
}

function run(line) {
  const words = String(line || '').trim().split(/\s+/).filter(Boolean);
  const s = state();
  if (!words.length) return Promise.resolve({ ok: true, out: '', path: s.path });
  if (words[0] === 'path' && words.length <= 2) return pathCommand(s, words[1] || '');
  if (words[0] === 'api' && words.length <= 2) return apiCommand(s, words[1] || '');
  return Promise.resolve(refused(s, 'no-such-command', 'no such command: ' + words.join(' ')));
}

module.exports = { run: run, state: state, HISTORY_MAX: HISTORY_MAX };
