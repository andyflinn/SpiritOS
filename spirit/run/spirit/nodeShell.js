'use strict';

// spirit/run/spirit/nodeShell.js
// THE SHELL THE NODE NAMES (goal/G43.18, box v29, "The shell"; Andy: "boot should solve transport issues only, then load
// whichever shell the node has configured", and the RULE: "A shell must be able to replace itself"). The verb node.shell,
// reviewed by wsl: node.shell({ at }) answers { name }, the current shell; node.shell({ at, name }) sets it and answers
// { name }. at is home or face.
//
//   shell(rootDir, body) -> { ok, status, name } or { ok: false, status, code, error }
//
// KEPT IN A FILE OF ITS OWN, spirit/state/shell.json, { home, face } (box v29; wsl: config.json is the relay's limits file).
// NO SHELL CHOSEN IS THE SHELL APP (Q12): no file, or no name in it for that place, is "shell", spirit/app/shell/.
// A SHELL IS NAMED BY ITS OWN <name>.json ALONE (box v29: "<name>.json alone says whether an app may be a shell"; Andy: "the
// allow row goes"): a name that is no app, or whose <name>.json does not say shell:true:true, is refused with the reason, and
// the shell stays.

const fs = require('fs');
const path = require('path');

const PLACES = ['home', 'face'];
const DEFAULT = 'shell';

function fileOf(rootDir) { return path.join(rootDir, 'spirit', 'state', 'shell.json'); }
function kept(rootDir) {
  try { const v = JSON.parse(fs.readFileSync(fileOf(rootDir), 'utf8')); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch (e) { return {}; }
}
// Why an app may not be a shell, or '' when it may.
function notAShell(rootDir, name) {
  if (!/^[A-Za-z0-9_-]+$/.test(name)) return 'no app ' + JSON.stringify(name);
  let own = null;
  try { own = JSON.parse(fs.readFileSync(path.join(rootDir, 'spirit', 'app', name, name + '.json'), 'utf8')); } catch (e) { return 'no app ' + name; }
  return own && own.shell && own.shell.true === true ? '' : 'app ' + name + ' is no shell: its ' + name + '.json does not say shell:true:true';
}
function current(rootDir, at) {
  const n = kept(rootDir)[at];
  return typeof n === 'string' && n ? n : DEFAULT;
}

function shell(rootDir, body) {
  const b = body || {};
  const at = String(b.at || '');
  if (PLACES.indexOf(at) === -1) return { ok: false, status: 400, code: 'bad-place', error: 'at is home or face, not ' + JSON.stringify(at) };
  if (b.name === undefined || b.name === null || b.name === '') return { ok: true, status: 200, name: current(rootDir, at) };
  const name = String(b.name);
  const why = notAShell(rootDir, name);
  if (why) return { ok: false, status: 400, code: 'not-a-shell', error: why };
  const all = Object.assign(kept(rootDir), { [at]: name });
  fs.mkdirSync(path.dirname(fileOf(rootDir)), { recursive: true });
  fs.writeFileSync(fileOf(rootDir), JSON.stringify(all, null, 2) + '\n');
  return { ok: true, status: 200, name: name };
}

module.exports = { shell: shell, current: current, PLACES: PLACES, DEFAULT: DEFAULT };
