'use strict';

// spirit/run/spirit/console/test/command.js
// The tests of spirit/console/command.js, and of no other module (spec: ./command.md). goal/G48.2, the box: "the script
// run://spirit/console/command.js will be the consoles command processor"; "the console internal command for navigation is
// \"path\""; "the state of the console is kept in run://spirit/state/console/node.json ... the current navigation path of the
// console and a 256 rolling command history."
// It is reached as the box says it is, through the console's one door: "node spirit/console.js <words>" hands the words to
// command.js once. On a scratch node of its own; the state file is read where the box puts it, in that node's tree.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

const W = {};
const stateOf = function () { try { return JSON.parse(fs.readFileSync(path.join(W.node.run, 'spirit', 'state', 'console', 'node.json'), 'utf8')); } catch (e) { return null; } };
// The stored path: '' at the root, where the box's prompt is only "spirit: ".
const at = function () { const s = stateOf(); return s ? String(s.path || '') : null; };
// The rolling history: the one list of lines the state holds beside the path.
const history = function () {
  const s = stateOf();
  if (!s) return null;
  const k = Object.keys(s).find(function (key) { return key !== 'path' && Array.isArray(s[key]) && s[key].every(function (x) { return typeof x === 'string'; }); });
  return k ? s[k] : null;
};
const last = function () { const h = history(); return h && h.length ? h[h.length - 1] : null; };
function run(words, input) {
  const kid = spawn(process.execPath, [path.join(W.node.run, 'spirit', 'console.js')].concat(words || []), { cwd: W.node.root, stdio: ['pipe', 'pipe', 'pipe'] });
  const p = { kid: kid, out: '', ended: false, code: null };
  kid.stdout.on('data', function (d) { p.out += String(d); });
  kid.stderr.on('data', function (d) { p.out += String(d); });
  kid.on('exit', function (code) { p.ended = true; p.code = code; });
  if (input !== undefined) kid.stdin.end(input); else kid.stdin.end();
  return H.until(function () { return Promise.resolve(p.ended); }, 120000).then(function () { if (!p.ended) { try { kid.kill(); } catch (e) { /* gone */ } } return p; });
}
const go = function (line) { return run(line.split(' ')); };
// A refusal: said as an error, and the path left as it was. goal/G48.2, box v12: "errors are return in
// JSON.stringify(error,null,2) format.": what it prints is one JSON value, printed by JSON.stringify(error, null, 2).
const asError = function (out) { const t = String(out).trim(); try { const e = JSON.parse(t); return e !== null && typeof e === 'object' && t === JSON.stringify(e, null, 2); } catch (x) { return false; } };
const refused = function (p, before) { return p.ended && asError(p.out) && at() === before; };

test.run('spirit/console/command.js exists', 0.2, function () {
  return fs.existsSync(path.join(RUN, 'spirit', 'console', 'command.js')) || false;
}, test.limit.quick);
test.run('a scratch node comes up', 0.2, async function () {
  W.node = await H.scratchNode({});
  return (!!W.node && W.node.up) || false;
}, test.limit.slow);
test.after(async function () {
  try { if (W.node) await W.node.release(); } catch (e) { /* gone */ }
  try { if (W.node) H.freeTree(W.node); } catch (e) { /* left */ }
});
const up = function () { return !!W.node && W.node.up; };

// "if the prompt is \"spirit\" and the user in the loop types \"path app\", then \"app\" is stored in state as path ... the
// command log stores \"path app\""
test.run('"path app" at the root stores app as the path in spirit/state/console/node.json', 0.4, async function () {
  if (!up()) return false;
  await go('path app');
  return at() === 'app' || false;
}, test.limit.slow);
test.run('and the command log stores "path app"', 0.4, function () {
  return (up() && last() === 'path app') || false;
}, test.limit.quick);
// "\"path\" without argument shows the path stored in state"
test.run('"path" without argument shows the path stored in state, and leaves it', 0.4, async function () {
  if (!up()) return false;
  const p = await go('path');
  return (p.ended && /(^|[\s.])app\s*$/.test(p.out.trim()) && at() === 'app') || false;
}, test.limit.slow);
// "if the user then types \"path agent\", the command sent to spirit/console/command.js is \"path agent\", the command processor
// works out current-path + navigation, and stores \"app.agent\" as current path in state and logs the command as \"path
// app.agent\"."
test.run('"path agent" at app stores app.agent as the path', 0.4, async function () {
  if (!up()) return false;
  await go('path agent');
  return at() === 'app.agent' || false;
}, test.limit.slow);
test.run('and logs the command as "path app.agent", as typed from the root', 0.4, function () {
  return (up() && last() === 'path app.agent') || false;
}, test.limit.quick);
// "a path navigation to a path that doesn't exist under run://spirit/ is refused with an error, and the prompt remains"
test.run('a path to a folder that does not exist under spirit is refused with an error, and the path stays', 0.4, async function () {
  if (!up()) return false;
  const p = await go('path nope');
  return refused(p, 'app.agent') || false;
}, test.limit.slow);
// "\"path\" with \"<\" as an argument navigates to the parent"
test.run('"path <" at app.agent goes to the parent, app', 0.4, async function () {
  if (!up()) return false;
  await go('path <');
  return at() === 'app' || false;
}, test.limit.slow);
// "a path argument that is a name or a dot sequence is always validated as state-path + asked path, and is invalid if it does
// not result in a valid path inside run://spirit/"
test.run('a dot sequence counts from the path in state: "path app.agent" at app (app.app.agent) is refused, the path stays', 0.4, async function () {
  if (!up()) return false;
  const p = await go('path app.agent');
  return refused(p, 'app') || false;
}, test.limit.slow);
// "\"path\" with \"<<\" as an argument navigates to the root"
test.run('"path <<" at app goes to the root', 0.4, async function () {
  if (!up()) return false;
  await go('path <<');
  return at() === '' || false;
}, test.limit.slow);
test.run('a dot sequence at the root: "path app.agent" stores app.agent', 0.4, async function () {
  if (!up()) return false;
  await go('path app.agent');
  return at() === 'app.agent' || false;
}, test.limit.slow);
test.run('"path <<" at app.agent goes straight to the root', 0.4, async function () {
  if (!up()) return false;
  await go('path <<');
  return at() === '' || false;
}, test.limit.slow);
// "for the two special arguments \"<\" and \"<<\" the command processor ... responds with an error when the consoles root is
// already reached"
test.run('"path <" at the root is refused with an error, and the path stays the root', 0.4, async function () {
  if (!up()) return false;
  const p = await go('path <');
  return refused(p, '') || false;
}, test.limit.slow);
test.run('"path <<" at the root is refused with an error, and the path stays the root', 0.4, async function () {
  if (!up()) return false;
  const p = await go('path <<');
  return refused(p, '') || false;
}, test.limit.slow);
// THE api COMMAND (goal/G48.3, the box): "if I'm at a branch folder, this command without arguments lists all verbs, in
// simple json format, sorted by name. This is a simple list, without any detailed description. IN JSON FORMAT!!!!"; "if
// there's no branch's api.js it returns a json error."; "if the api command names a verb: it returns that verbs
// command-line-format in json, human and machine readable, with a field \"usage\" at the very bottom". Andy: "the console
// command: \"api search\" will return a JSON.stringify(search,null,2) desription. period." What the branch has is read from
// this tree's own files, by the test only: its api.js names the verbs, each <verb>.json describes one.
// The verbs an api.js names, read in a process of its own, so this test's spirit object stays its own.
const verbsOf = function (rel) {
  const r = require('child_process').spawnSync(process.execPath, ['-e', 'process.stdout.write(JSON.stringify(Object.keys(require(process.argv[1]).verbs || {}).sort()))', path.join(W.node.run, 'spirit', rel, 'api.js')], { encoding: 'utf8', timeout: 30000 });
  try { return JSON.parse(r.stdout); } catch (e) { return null; }
};
const fileOf = function (rel, verb) { try { return JSON.parse(fs.readFileSync(path.join(W.node.run, 'spirit', rel, verb + '.json'), 'utf8')); } catch (e) { return null; } };
const json = function (out) { try { return JSON.parse(String(out).trim()); } catch (e) { return undefined; } };
// One verb's answer: one JSON object holding its file's description and request as they stand, "usage" its last field, a
// line naming the verb.
const describes = function (out, verb, file) {
  const o = json(out);
  if (!o || typeof o !== 'object' || Array.isArray(o) || !file) return false;
  const keys = Object.keys(o);
  return keys[keys.length - 1] === 'usage' && typeof o.usage === 'string' && o.usage.split(' ')[0] === verb &&
    o.description === file.description && JSON.stringify(o.request) === JSON.stringify(file.request);
};
test.run('"api" at the root, where spirit has no api.js, answers a JSON error', 0.4, async function () {
  if (!up() || at() !== '') return false;
  const p = await go('api');
  return refused(p, '') || false;
}, test.limit.slow);
test.run('"api" at spirit.node lists its verbs in JSON, by name only and sorted, as its api.js names them', 0.4, async function () {
  if (!up()) return false;
  await go('path node');
  if (at() !== 'node') return false;
  const p = await go('api');
  const want = verbsOf('node');
  const got = json(p.out);
  return (!!want && want.length > 0 && Array.isArray(got) && JSON.stringify(got) === JSON.stringify(want)) || false;
}, test.limit.slow);
test.run('"api card" at spirit.node answers card.json\'s description and request in JSON, with "usage" at the very bottom', 0.4, async function () {
  if (!up() || at() !== 'node') return false;
  const p = await go('api card');
  return describes(p.out, 'card', fileOf('node', 'card')) || false;
}, test.limit.slow);
test.run('a verb\'s answer is printed as JSON.stringify(it, null, 2)', 0.4, async function () {
  if (!up() || at() !== 'node') return false;
  const p = await go('api card');
  const o = json(p.out);
  return (!!o && typeof o.usage === 'string' && String(p.out).trim() === JSON.stringify(o, null, 2)) || false;
}, test.limit.slow);
test.run('"api nope", a verb spirit.node does not have, answers a JSON error, and the path stays', 0.4, async function () {
  if (!up() || at() !== 'node') return false;
  const p = await go('api nope');
  return refused(p, 'node') || false;
}, test.limit.slow);
test.run('"api item.get" at spirit.app.desk answers item.get.json\'s description and request, its usage naming item.get and its id', 0.4, async function () {
  if (!up()) return false;
  await go('path <<');
  await go('path app.desk');
  if (at() !== 'app.desk') return false;
  const p = await go('api item.get');
  const o = json(p.out);
  return (describes(p.out, 'item.get', fileOf('app/desk', 'item.get')) && /\bid=/.test(o.usage)) || false;
}, test.limit.slow);
test.run('"api" at spirit.app.desk lists the desk branch\'s verbs, sorted', 0.4, async function () {
  if (!up() || at() !== 'app.desk') return false;
  const p = await go('api');
  const want = verbsOf('app/desk');
  return (!!want && JSON.stringify(json(p.out)) === JSON.stringify(want)) || false;
}, test.limit.slow);
test.run('"api" at spirit.app.agent.test, a folder with no api.js, answers a JSON error', 0.4, async function () {
  if (!up()) return false;
  await go('path <<');
  await go('path app.agent.test');
  if (at() !== 'app.agent.test') return false;
  const p = await go('api');
  const r = refused(p, 'app.agent.test');
  await go('path <<');
  return r || false;
}, test.limit.slow);
// "a 256 rolling command history": 300 lines given, the newest 256 kept, the oldest gone.
test.run('the command history rolls at 256: after 300 more lines it holds 256, the newest last', 0.4, async function () {
  if (!up()) return false;
  const lines = [];
  for (let i = 0; i < 150; i += 1) { lines.push('path node'); lines.push('path <<'); }
  await run([], lines.join('\n') + '\n');
  const h = history();
  return (!!h && h.length === 256 && h[h.length - 2] === 'path node' && at() === '') || false;
}, test.limit.long);
