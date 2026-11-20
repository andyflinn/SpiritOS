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
// ITS ONE COMMAND, path (the box, ### behavior):
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

function run(line) {
  const words = String(line || '').trim().split(/\s+/).filter(Boolean);
  const s = state();
  if (!words.length) return Promise.resolve({ ok: true, out: '', path: s.path });
  if (words[0] === 'path' && words.length <= 2) return pathCommand(s, words[1] || '');
  return Promise.resolve(refused(s, 'no-such-command', 'no such command: ' + words.join(' ')));
}

module.exports = { run: run, state: state, HISTORY_MAX: HISTORY_MAX };
