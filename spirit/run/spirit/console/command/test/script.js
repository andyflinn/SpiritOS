'use strict';

// spirit/run/spirit/console/command/test/script.js
// The tests of spirit/console/command/script.js, and of no other module (spec: ./script.md). goal/G48.2, the box: "the script
// run://spirit/console/command/script.js will be the consoles command processor"; "the console internal command for navigation is
// \"path\""; "the state of the console is kept in run://spirit/state/console/node.json ... the current navigation path of the
// console and a 256 rolling command history."
// It is reached as the box says it is, through the console's one door: "node spirit/console/script.js <words>" hands the words to
// command.js once. On a scratch node of its own; the state file is read where the box puts it, in that node's tree.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
const H = LOADER.requireScript('spirit/test/headLessChrome.js');

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
  const kid = spawn(process.execPath, [path.join(W.node.run, 'spirit', 'console', 'script.js')].concat(words || []), { cwd: W.node.root, stdio: ['pipe', 'pipe', 'pipe'] });
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

test.run('spirit/console/command/script.js exists', 0.2, function () {
  return fs.existsSync(path.join(RUN, 'spirit', 'console', 'command', 'script.js')) || false;
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
// "if the user then types \"path agent\", the command sent to spirit/console/command/script.js is \"path agent\", the command processor
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
// The verbs an api.js names, read in a process of its own, so this test's spirit object stays its own. The spirit branch
// (goal/G49.23, box v22 Part 2: the node branch's verbs are the spirit branch's, spirit/node/ gone), rel '', is
// spirit/script.js, its verbs spirit.verbs.
const verbsOf = function (rel) {
  const r = require('child_process').spawnSync(process.execPath, ['-e', 'process.stdout.write(JSON.stringify(Object.keys(require(process.argv[1]).verbs || {}).sort()))', rel ? path.join(W.node.run, 'spirit', rel, 'api.js') : path.join(W.node.run, 'spirit', 'script.js')], { encoding: 'utf8', timeout: 30000 });
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
// The spirit branch at the root, spirit, where spirit.nodeFacts' verbs stood at node (goal/G49.23, box v22 Part 2).
test.run('"api" at the root, the spirit branch, lists its verbs in JSON, by name only and sorted, as spirit.verbs names them', 0.4, async function () {
  if (!up()) return false;
  await go('path <<');
  if (at() !== '') return false;
  const p = await go('api');
  const want = verbsOf('');
  const got = json(p.out);
  return (!!want && want.length > 0 && Array.isArray(got) && JSON.stringify(got) === JSON.stringify(want)) || false;
}, test.limit.slow);
test.run('"api card" at the root, the spirit branch, answers spirit/card.json\'s description and request in JSON, with "usage" at the very bottom', 0.4, async function () {
  if (!up() || at() !== '') return false;
  const p = await go('api card');
  return describes(p.out, 'card', fileOf('', 'card')) || false;
}, test.limit.slow);
test.run('a verb\'s answer is printed as JSON.stringify(it, null, 2)', 0.4, async function () {
  if (!up() || at() !== '') return false;
  const p = await go('api card');
  const o = json(p.out);
  return (!!o && typeof o.usage === 'string' && String(p.out).trim() === JSON.stringify(o, null, 2)) || false;
}, test.limit.slow);
test.run('"api nope", a verb the spirit branch does not have, answers a JSON error, and the path stays', 0.4, async function () {
  if (!up() || at() !== '') return false;
  const p = await go('api nope');
  return refused(p, '') || false;
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
// WHAT IT LISTS IS WHAT THE CONSOLE OFFERS (goal/G48.8; Andy: "wsl, let the verb list be checked by a general test like
// app-child-general"): which verbs those are, an app's api.js verbs and its server's auto-verbs, is judged for every app by
// spirit/test/app-child-general.js (rule 8); here "api" prints that same list, sorted.
test.run('"api" at spirit.app.desk prints the verbs the console offers there, sorted', 0.4, async function () {
  if (!up() || at() !== 'app.desk') return false;
  const p = await go('api');
  let offered = null;
  try { offered = await LOADER.requireScript('spirit/console/command/script.js').verbsAt('app.desk'); } catch (e) { offered = null; }
  const want = offered && typeof offered === 'object' ? Object.keys(offered).sort() : null;
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
// EXECUTING VERBS (goal/G48.3, box v7, ## executing verbs): "at a branch, a line typed as its usage shows ... executes that
// verb, and the console shows the json it returns, as JSON.stringify(answer,null,2)."; "a verb the node refuses shows that
// refusal as a json error, as every other console error." ## typing values: "a value with a space in it is put in double
// quotes"; "a value is read as its argument's rule in the verb's own file says: a number argument as a number, a yes/no
// argument as true or false, a list or object argument as JSON". What the node holds is asked over its own door, by the test.
async function call(verb, args) {
  try {
    const r = await fetch(W.node.base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
    return { status: r.status, body: await r.json() };
  } catch (e) { return { status: 0, body: null }; }
}
const answered = function (p) { const o = json(p.out); return p.ended && !!o && typeof o === 'object' && o.ok !== false && String(p.out).trim() === JSON.stringify(o, null, 2) ? o : null; };
// spirit.card, node.card at node before goal/G49.23 (box v22 Part 2); the spirit branch is the root.
test.run('at the root, "card" executes spirit.card and shows its answer as JSON.stringify(answer, null, 2)', 0.4, async function () {
  if (!up()) return false;
  await go('path <<');
  if (at() !== '') return false;
  const p = await go('card');
  const o = answered(p);
  const want = await call('spirit.card');
  return (!!o && want.status === 200 && JSON.stringify(o) === JSON.stringify(want.body)) || false;
}, test.limit.slow);
test.run('a value with a space, put in double quotes, arrives whole: setDescription description="said in four words"', 0.4, async function () {
  if (!up() || at() !== '') return false;
  const p = await run(['setDescription', 'description="said in four words"']);
  const card = await call('spirit.card');
  return (!!answered(p) && card.status === 200 && card.body.description === 'said in four words') || false;
}, test.limit.slow);
// A DOUBLE QUOTE IN A VALUE (goal/G48.8, wsl: "a quoted value cannot hold a double quote, there is no escape"; Andy: "cw, fix
// the console. push it"): typed \" inside the quotes, it arrives as a double quote.
test.run('a double quote typed \\" inside a quoted value arrives as one: setDescription description="a \\"quoted\\" word"', 0.4, async function () {
  if (!up() || at() !== '') return false;
  const p = await run(['setDescription', 'description="a \\"quoted\\" word"']);
  const card = await call('spirit.card');
  return (!!answered(p) && card.status === 200 && card.body.description === 'a "quoted" word') || false;
}, test.limit.slow);
test.run('an object argument is read as JSON: debug debug={"on":...} sets the node\'s debug flag', 0.4, async function () {
  if (!up() || at() !== '') return false;
  const before = await call('spirit.debug', { debug: {} });
  if (before.status !== 200 || typeof before.body.debug !== 'boolean') return false;
  const want = !before.body.debug;
  const p = await run(['debug', 'debug={"on":' + want + '}']);
  const after = await call('spirit.debug', { debug: {} });
  return (!!answered(p) && after.body.debug === want) || false;
}, test.limit.slow);
// The bundle table is a branch of its own since goal/G49.21, spirit.bundle, its verbs add and get with no op.
test.run('a number argument is read as a number: at spirit.bundle, get id=<the id add answered>', 0.4, async function () {
  if (!up()) return false;
  await go('path <<');
  await go('path bundle');
  if (at() !== 'bundle') return false;
  const made = answered(await go('add label=zzConsole'));
  if (!made || typeof made.id !== 'number') return false;
  const got = answered(await go('get id=' + made.id));
  return (!!got && got.label === 'zzConsole' && got.id === made.id) || false;
}, test.limit.slow);
test.run('a verb the node refuses shows the refusal as a JSON error, and the path stays: get id=987654 at spirit.bundle', 0.4, async function () {
  if (!up() || at() !== 'bundle') return false;
  const p = await go('get id=987654');
  const o = json(p.out);
  return (refused(p, 'bundle') && o.ok === false) || false;
}, test.limit.slow);
test.run('a yes/no argument is read as true or false: at spirit.contact, search keep=true answers', 0.4, async function () {
  if (!up()) return false;
  await go('path <<');
  await go('path contact');
  if (at() !== 'contact') return false;
  const o = answered(await go('search keep=true'));
  await go('path <<');
  return (!!o && Array.isArray(o.items)) || false;
}, test.limit.slow);
// "a 256 rolling command history": 300 lines given, the newest 256 kept, the oldest gone.
test.run('the command history rolls at 256: after 300 more lines it holds 256, the newest last', 0.4, async function () {
  if (!up()) return false;
  const lines = [];
  // A folder that is there, spirit/node/ gone since goal/G49.23.
  for (let i = 0; i < 150; i += 1) { lines.push('path app'); lines.push('path <<'); }
  await run([], lines.join('\n') + '\n');
  const h = history();
  return (!!h && h.length === 256 && h[h.length - 2] === 'path app' && at() === '') || false;
}, test.limit.long);

// ── THE WAIT (goal/G48.6) ──────────────────────────────────────────────────────────────────────────────────────────────
// The box: "an array of wait events will be maintained in spirit/state/console/node.json", with "wait", "wait add
// <event-description>" and "wait remove <event-description-string>"; "wait reads node.db's log on its own node ... through
// the log's one reader, arrivals in spirit/trafficLog/script.js"; "arrivals hands delivered inbound rows only, so the agent's own
// outgoing calls ... never wake a wait"; "a stream's delivery to a server's listener carries a bundle ... each of its entries
// is matched on its own"; "wait add api=<branch>.<verb> <field>=<value> ..."; the read-pointer: "a wake reads every row past
// it once", "the first wait starts at the newest row"; the commands: "it blocks until a wait-row matches or the configured
// timeout passes. A match prints its rows, one JSON line each with its wait-row, and ends 0; a timeout prints that nothing
// came and ends with a code of its own; with no wait-row configured it is refused and ends 1", "one wait at a time per node",
// "wait list shows the configured wait-rows", "wait timeout <seconds> sets the timeout".
// What arrives is written into the scratch node's log by the log's own writer (trafficLog's note), each payload an envelope
// made by the node's packet encoder, as a peer's call lands; no app of the tree is named, the branch is a made-up zzwait.
const packetCodec = LOADER.requireScript('spirit/peer/packet/script.js');
let nodeLog = null;
const arrive = function (body, dir) {
  if (!nodeLog) nodeLog = LOADER.requireScript('spirit/trafficLog/script.js').createTrafficLog({ rootDir: W.node.run });
  const e = packetCodec.encode('api', body);
  return nodeLog.note({ dir: dir || 'in', kind: 'request', peer: 'KEY-ZZWAITPEER', hash: e.envelope.id, outcome: 'delivered', payload: e.text });
};
const PING = 'api=zzwait.ping x=1';
const LISTEN = 'api=zzwait.listener by=andy';
const TIMEOUT_S = 3;
// A wait started now, its end awaited later; what arrives meanwhile is written after a second.
const waitWith = async function (whileWaiting) {
  const p = run(['wait']);
  if (whileWaiting) { await H.sleep(1000); whileWaiting(); }
  return p;
};
const timedOut = function (p) { return p.ended && p.code !== 0 && p.code !== 1 && p.code !== null && String(p.out).trim() !== ''; };
const woke = function (p, row) {
  if (!(p.ended && p.code === 0)) return false;
  return String(p.out).split('\n').some(function (l) { try { JSON.parse(l); } catch (e) { return false; } return l.indexOf(row) !== -1; });
};
test.run('wait with no wait-row configured is refused and ends 1', 0.4, async function () {
  if (!up()) return false;
  await go('path <<');
  const p = await go('wait');
  // Refused as a wait with nothing to wait on, not as a command the console does not know.
  return (p.ended && p.code === 1 && p.out.indexOf('no-such-command') === -1) || false;
}, test.limit.slow);
test.run('wait add api=zzwait.ping x=1 is then shown by wait list', 0.4, async function () {
  if (!up()) return false;
  await go('wait add ' + PING);
  const p = await go('wait list');
  return (p.ended && p.out.indexOf(PING) !== -1) || false;
}, test.limit.slow);
test.run('the first wait starts at the newest row: a match that came before it does not wake it, and it times out', 0.4, async function () {
  if (!up()) return false;
  await go('wait timeout ' + TIMEOUT_S);
  arrive({ zzwait: { ping: { x: 1 } } });
  const t0 = Date.now();
  const p = await waitWith();
  W.waitMs = Date.now() - t0;
  return timedOut(p) || false;
}, test.limit.slow);
test.run('wait timeout 3 ends a wait with nothing coming after about 3 s, with a code of its own', 0.4, function () {
  return (typeof W.waitMs === 'number' && W.waitMs >= TIMEOUT_S * 1000 && W.waitMs < TIMEOUT_S * 1000 + 15000) || false;
}, test.limit.quick);
test.run('a delivered call matching api=zzwait.ping x=1 wakes the wait: one JSON line naming its wait-row, and it ends 0', 0.4, async function () {
  if (!up()) return false;
  const p = await waitWith(function () { arrive({ zzwait: { ping: { x: 1 } } }); });
  return woke(p, PING) || false;
}, test.limit.slow);
test.run('the row one wait read does not wake the next', 0.4, async function () {
  if (!up()) return false;
  return timedOut(await waitWith()) || false;
}, test.limit.slow);
test.run('a delivered call of zzwait.ping with x=2 does not wake it', 0.4, async function () {
  if (!up()) return false;
  return timedOut(await waitWith(function () { arrive({ zzwait: { ping: { x: 2 } } }); })) || false;
}, test.limit.slow);
test.run('an outgoing call of zzwait.ping with x=1 does not wake it', 0.4, async function () {
  if (!up()) return false;
  return timedOut(await waitWith(function () { arrive({ zzwait: { ping: { x: 1 } } }, 'out'); })) || false;
}, test.limit.slow);
test.run('a match that came while no wait ran wakes the next wait', 0.4, async function () {
  if (!up()) return false;
  arrive({ zzwait: { ping: { x: 1 } } });
  return woke(await waitWith(), PING) || false;
}, test.limit.slow);
const bundle = function (bys) { return JSON.stringify(bys.map(function (by, i) { return { run: 'zzrun', n: i + 1, row: { by: by, text: 'line ' + (i + 1) } }; })); };
test.run('a listener\'s bundle is matched on each entry\'s row: api=zzwait.listener by=andy wakes on a bundle holding one', 0.4, async function () {
  if (!up()) return false;
  await go('wait add ' + LISTEN);
  return woke(await waitWith(function () { arrive({ zzwait: { listener: { json: bundle(['bob', 'andy', 'bob']) } } }); }), LISTEN) || false;
}, test.limit.slow);
test.run('a bundle whose entries are all by bob does not wake api=zzwait.listener by=andy', 0.4, async function () {
  if (!up()) return false;
  return timedOut(await waitWith(function () { arrive({ zzwait: { listener: { json: bundle(['bob', 'bob']) } } }); })) || false;
}, test.limit.slow);
test.run('one wait at a time: a second wait while one runs is refused and ends 1', 0.4, async function () {
  if (!up()) return false;
  const first = run(['wait']);
  await H.sleep(1000);
  const second = await go('wait');
  const one = await first;
  // The first a real wait, ended by its timeout; the second refused as a second wait, not as an unknown command.
  return (timedOut(one) && second.ended && second.code === 1 && second.out.indexOf('no-such-command') === -1) || false;
}, test.limit.slow);
// A WAIT WRITES ITS POINTER ALONE (goal/G48.8, cw's fix, 200159f0: "it read the whole state once at its start and wrote it
// back when it moved"): a wait-row added while a wait runs is still there once that wait has ended.
test.run('a wait-row added while a wait runs is still in wait list once that wait has ended', 0.4, async function () {
  if (!up()) return false;
  const first = run(['wait']);
  await H.sleep(1000);
  await go('wait add api=zzwait.later z=1');
  // A row that matches nothing arrives meanwhile, so the wait reads the log and moves its pointer while it runs.
  arrive({ zzwait: { ping: { x: 3 } } });
  const one = await first;
  const p = await go('wait list');
  const kept = p.ended && p.out.indexOf('api=zzwait.later z=1') !== -1;
  await go('wait remove api=zzwait.later z=1');
  return (timedOut(one) && kept) || false;
}, test.limit.slow);
test.run('wait remove takes the stored string out of wait list', 0.4, async function () {
  if (!up()) return false;
  await go('wait remove ' + PING);
  const p = await go('wait list');
  return (p.ended && p.out.indexOf(PING) === -1 && p.out.indexOf(LISTEN) !== -1) || false;
}, test.limit.slow);

// THE VERB'S FUNCTION (goal/G48.8, wsl: "at spirit.app, active key=desk active=true is refused, branch[verb] is not a
// function"; Andy: "cw, fix the console. push it"): a branch whose api.js names a function for a verb (spirit.app: active is
// activeApp) answers it from the console. The key is the app's id, spirit.app.icons (goal/G49.19).
test.run('at spirit.app, "active key=spirit.app.icons active=true" answers ok, through the function its api.js names', 0.4, async function () {
  if (!up()) return false;
  await go('path <<');
  await go('path app');
  const p = await go('active key=spirit.app.icons active=true');
  await go('path <<');
  const o = json(p.out);
  return (p.ended && p.code === 0 && !!o && o.ok === true) || false;
}, test.limit.slow);
