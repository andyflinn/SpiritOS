'use strict';

// spirit/run/process/js/desk/plugins/js/stackFrameChecks/stackFrameChecks.js
// THE STACK-FRAME CHECKS PLUGIN (goal/G22.3), the first gg plugin: it governs its private goal of stack-frame items.
//
//   Andy, 2026-10-13, in the item's box: "The stack-frame plugin sets the parameters (gate frame and target frame) and
//   generates the equivalent of a goal/G22.2 item from them.", "It governs its goal: the goal always stays open, and its
//   rerun item (as goal/G22.1) always stays open, whether a Done button is ever seen or not.", "It has a companion dialog
//   where the gate and endpoint functions are entered.", and "It is a pluggable version of goal/G0: a special goal that
//   is always open while actually closed."
//
// DECIDED BY ANDY, not this file's to loosen: nothing closes, finishes, abandons or deletes the goal or its rerun item,
// and the rerun item's file list stays spirit/test/oneDoorStacks.js alone, so a verify.again on it reruns that suite.
// The plugin makes the desk items and keeps the list of doors; the agents measure each door's suites into the list and
// do the work its red shows: it edits no test code.
//
// ── IT RUNS THE SHOW (goal/G22.3) ───────────────────────────────────
//
// DECIDED BY ANDY, 2026-10-13, in goal/G22.3's box: "I want this plugin to RUN the show, so you give me the complete
// toolset. add/remove rows (add with validation) and you will give me a run button/link for each one of them, or even
// better, a run-dialog", "with a way to modify a row as well.", and "put that in the dialog if you want." So the list
// is maintained here, every door under a stable id: make adds (paths and suites with it), update changes a door in
// place under the same rules and clears its last verdict (it no longer describes the door), remove strikes it. run
// starts one door's check at once and never blocks the desk; runState reads it; stop ends it, killing only the child
// this plugin spawned. One run at a time per door. The last verdict per door is kept in this plugin's own folder under
// the desk's --state (desk.stateDir: never in git), and every change is published for the UI.
//
// What the desk hands it (process/js/desk/desk.js, MOUNTING THE PLUGINS): its goal's key, the desk's writes (as the
// desk, or as the caller), the field rules, the id minting, its state folder and publish. What it gives back: refuses,
// handles and its verbs.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const RERUN_TEST = 'spirit/test/oneDoorStacks.js';
const ITEMS_TEST = 'spirit/test/stackFrameTestItems.js';

// ── THE LIST OF DOORS IS THE PLUGIN'S (goal/G22.3) ──────────────────
//
// DECIDED BY ANDY, 2026-10-13, in goal/G22.3's box, not this file's to loosen: "The plugin keeps the doors in
// spirit/run/process/js/desk/plugins/js/stackFrameChecks/stackFrameList.json, which the stack-frame test reads to know
// which checks to run." THE GATE IS NARROW: one file::function, and a whole module named as the gate is cheating. THE
// ENDPOINT IS WIDE: a whole module, every function it exports (and what an exported factory returns), so no side door
// is missed; for what lies outside our code, such as a relay, Node's own (http, https request, global fetch), filtered
// to the relay's paths.
//
// THE SHAPE (its .json says it too): an array of { id, gate, endpoint, paths?, suites, item }.
//   id        the door's own, stable: d1, d2 ..., minted here, never reused while the list holds it
//   gate      "spirit/run/<file>.js::<function>"
//   endpoint  "spirit/run/<file>.js", or "node:http+https+fetch" (any of the three, joined by +) with paths
//   paths     a node: endpoint's path prefixes, e.g. ["/api/relay/"]; a module endpoint takes none
//   suites    the suites that drive it, file names of spirit/test that are there; empty until measured, and an empty
//             run is its red
//   item      the desk item that asked for it
//
// THE LIST'S HOME IS ONE CONSTANT HERE, LIST_HOME, and one in spirit/test/tools/wirePaths.js, LIST: moving the list is
// those two lines. A run hands the list it used to the runner as SPIRIT_STACKS_LIST, so the two never disagree in a run.
//
// A SUITE NAMES A SCRATCH LIST in the suite-only value stackFrameList, and a scratch runner in stackFrameRunner (as it
// names pluginsMore), read from the desk's own first argument, the manifest's values as the node hands them: a suite
// never writes the tree's list, and never runs the probe through this plugin.
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const REPO = path.resolve(RUN, '..', '..');
const SUITES_DIR = path.join(REPO, 'spirit', 'test');
const LIST_HOME = path.join(__dirname, 'stackFrameList.json');
const VALUES = (function () {
  try { return JSON.parse(process.argv[2] || '{}') || {}; } catch (e) { return {}; }
}());
const LIST = VALUES.stackFrameList ? path.resolve(String(VALUES.stackFrameList)) : LIST_HOME;
// THE RUNNER: oneDoorStacks.js in its one-door mode (SPIRIT_STACKS_DOOR names the door, SPIRIT_STACKS_VERDICT the file
// its verdict is written to), or a suite's scratch runner.
const RUNNER = VALUES.stackFrameRunner ? path.resolve(String(VALUES.stackFrameRunner)) : path.join(REPO, RERUN_TEST);
const FILE_RE = /^spirit\/run\/((?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.js)$/;
const GATE_RE = /^(spirit\/run\/(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.js)::([A-Za-z_$][A-Za-z0-9_$]*)$/;
const SUITE_RE = /^[A-Za-z0-9_][A-Za-z0-9_.-]*\.js$/;
const PATH_RE = /^\/[A-Za-z0-9_.~%/-]*$/;
const NODE_KINDS = ['http', 'https', 'fetch'];
const FORM_MAX = 256;
const PATHS_MAX = 16;
const SUITES_MAX = 32;
// What one answer may carry (appClient.ANSWER_MAX is 8377 bytes): a run's tail, its violator lines and its raw paths
// around the gate, each cut to fit by BYTES (Andy's rule, 2026-10-10: every size check in bytes); what is left out is
// counted in violatorsLeft and pathsLeft, and the whole list stays in the runs file. Since the violator lines
// (goal/G22.3) the raw paths give them 2000 of their 5000.
const TAIL_BYTES = 1500;
const PATH_BYTES = 300;
const PATHS_BYTES = 3000;
const VIOLATORS_BYTES = 2000;
const KEPT_PATHS = 500;
// THE RUN AS ANDY READS IT (goal/G22.3): one line per violator, "hub.js:300 sealedClaim (from handleClaim) ---> GET
// /api/relay/key, bypassing createPeerPost". Andy, 2026-10-13: "much better, gimme that when i press run:". The rule
// is violators.js's header.
const { violators } = require('./violators.js');

function readDoors() {
  let list = [];
  try { list = JSON.parse(fs.readFileSync(LIST, 'utf8')); } catch (e) { list = []; }
  return Array.isArray(list) ? list.filter(function (d) { return d && typeof d === 'object'; }) : [];
}
// Written whole, through a file beside it, so the stack-frame test never reads half a list.
function writeDoors(list) {
  const tmp = LIST + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2) + '\n');
  fs.renameSync(tmp, LIST);
}
// The next free id: d<n>, n one past the highest the list holds.
function nextDoorId(list) {
  let n = 0;
  list.forEach(function (d) { const m = /^d(\d+)$/.exec(String(d.id || '')); if (m) n = Math.max(n, Number(m[1])); });
  return 'd' + (n + 1);
}
// The list, every door with its id: a door written by hand without one gets one, written back once.
function doorsWithIds() {
  const list = readDoors();
  let minted = false;
  list.forEach(function (d) { if (typeof d.id !== 'string' || !/^d\d+$/.test(d.id)) { d.id = nextDoorId(list); minted = true; } });
  if (minted) writeDoors(list);
  return list;
}
function shortOf(file) { return path.basename(String(file), '.js'); }
// What is wrong with a gate, '' when it is one file::function in a file of spirit/run that holds that function.
function gateWhy(gate) {
  if (gate.length > FORM_MAX) return 'the gate is ' + gate.length + ' characters, the limit is ' + FORM_MAX;
  if (FILE_RE.test(gate)) return 'the gate ' + gate + ' is a whole module: a whole module as the gate is cheating, name one function, ' + gate + '::<function>';
  const g = GATE_RE.exec(gate);
  if (!g) return 'the gate ' + JSON.stringify(gate) + ' is not spirit/run/<file>.js::<function>';
  const file = path.join(RUN, g[1].slice('spirit/run/'.length));
  let src = '';
  try { src = fs.readFileSync(file, 'utf8'); } catch (e) { return 'the gate\'s file ' + g[1] + ' is not there'; }
  if (!new RegExp('(^|[^A-Za-z0-9_$])' + g[2].replace(/\$/g, '\\$') + '([^A-Za-z0-9_$]|$)').test(src)) return 'the gate\'s function ' + g[2] + ' is not in ' + g[1];
  return '';
}
// What is wrong with an endpoint and its paths, '' when it is a whole module of spirit/run that is there with no paths,
// or node:<kinds> with at least one request path.
function endpointWhy(endpoint, paths) {
  if (endpoint.length > FORM_MAX) return 'the endpoint is ' + endpoint.length + ' characters, the limit is ' + FORM_MAX;
  if (/::/.test(endpoint)) return 'the endpoint ' + endpoint + ' names a function: an endpoint is a whole module, spirit/run/<file>.js, every function it exports watched';
  if (/^node:/.test(endpoint)) {
    const kinds = endpoint.slice(5).split('+');
    const bad = kinds.filter(function (k) { return NODE_KINDS.indexOf(k) === -1; });
    if (bad.length) return 'the endpoint ' + endpoint + ' names ' + bad.join(', ') + ': Node\'s own are ' + NODE_KINDS.join(', ') + ', joined by +';
    if (new Set(kinds).size !== kinds.length) return 'the endpoint ' + endpoint + ' names a kind twice';
    if (!paths.length) return 'a node: endpoint needs its paths, the request paths it counts (the relay\'s: /api/relay/)';
    return pathsWhy(paths);
  }
  const m = FILE_RE.exec(endpoint);
  if (!m) return 'the endpoint ' + JSON.stringify(endpoint) + ' is not spirit/run/<file>.js or node:<kinds>';
  if (!fs.existsSync(path.join(RUN, m[1]))) return 'the endpoint\'s file ' + endpoint + ' is not there';
  if (paths.length) return 'paths belong to a node: endpoint; the module endpoint ' + endpoint + ' takes none';
  return '';
}
function pathsWhy(paths) {
  if (paths.length > PATHS_MAX) return paths.length + ' paths, the limit is ' + PATHS_MAX;
  for (const p of paths) {
    if (!PATH_RE.test(p) || Buffer.byteLength(p, 'utf8') > FORM_MAX) return 'the path ' + JSON.stringify(p) + ' is no request path: it starts with / and holds no space';
  }
  if (new Set(paths).size !== paths.length) return 'a path is named twice';
  return '';
}
// Each suite a file name of spirit/test that is there: no folder, no way out of it.
function suitesWhy(suites) {
  if (suites.length > SUITES_MAX) return suites.length + ' suites, the limit is ' + SUITES_MAX;
  for (const s of suites) {
    if (!SUITE_RE.test(s)) return 'the suite ' + JSON.stringify(s) + ' is not a file name of spirit/test, <name>.js';
    let file = false;
    try { file = fs.statSync(path.join(SUITES_DIR, s)).isFile(); } catch (e) { file = false; }
    if (!file) return 'the suite ' + s + ' is not there in spirit/test';
  }
  if (new Set(suites).size !== suites.length) return 'a suite is named twice';
  return '';
}
function sameDoor(d, gate, endpoint, paths) {
  return d.gate === gate && d.endpoint === endpoint && JSON.stringify(d.paths || []) === JSON.stringify(paths);
}
// One door's values from a request, trimmed and checked against the tree: { gate, endpoint, paths, suites }, or a
// refusal with its why. except is the id of the door being changed, so a door is never its own duplicate.
function doorOf(desk, a, list, except) {
  const gate = String(a.gate || '').trim();
  const endpoint = String(a.endpoint || '').trim();
  const paths = (Array.isArray(a.paths) ? a.paths : []).map(function (p) { return String(p).trim(); }).filter(Boolean);
  const suites = (Array.isArray(a.suites) ? a.suites : []).map(function (s) { return String(s).trim(); }).filter(Boolean);
  if (!gate) throw desk.refused('bad-request', 'a gate is needed: spirit/run/<file>.js::<function>, the function every production stack reaching the endpoint passes through');
  if (!endpoint) throw desk.refused('bad-request', 'an endpoint is needed: spirit/run/<file>.js, the whole module the gate stands in front of, or node:<kinds> with its paths');
  const why = gateWhy(gate) || endpointWhy(endpoint, paths) || suitesWhy(suites);
  if (why) throw desk.refused('bad-request', why);
  if (gate.split('::')[0] === endpoint) throw desk.refused('bad-request', 'the gate is in the endpoint\'s own module: a gate stands in front of it, in another');
  if (list.some(function (d) { return d.id !== except && sameDoor(d, gate, endpoint, paths); })) {
    throw desk.refused('bad-request', 'the list has this door already: ' + gate + ' -> ' + endpoint + (paths.length ? ' on ' + paths.join(', ') : ''));
  }
  const out = { gate: gate, endpoint: endpoint, suites: suites };
  if (paths.length) out.paths = paths;
  return out;
}

module.exports = function (desk) {
  const goal = desk.goal;
  // THE RERUN ITEM, under a fixed id: the first item of its goal, made on the first mount, found by its id after.
  const rerun = goal + '.1';
  const st = desk.state();
  if (!st.items[rerun]) {
    desk.write('item.add', { goal: goal, title: 'Rerun the stack-frame test', minted: rerun });
    desk.write('item.files.add', { id: rerun, paths: [RERUN_TEST] });
    desk.write('box.write', { id: rerun, version: 0, text: 'every verify.again on this item reruns ' + RERUN_TEST +
      ', the stack-frame test: one test per door of the plugin\'s list, stackFrameList.json beside it.\n' +
      '- It always stays open, whether a Done button is ever seen or not: the stackFrameChecks plugin refuses its Done, Close and Delete (goal/G22.3).\n' +
      '- Its file list is ' + RERUN_TEST + ' alone.' });
  }

  // ── THE RUNS, AND THE LAST VERDICT PER DOOR (goal/G22.3) ──────────
  //
  // Kept in runs.json in the plugin's own folder under the desk's --state, { <door id>: { runId, startedAt, endedAt,
  // stopped, exit, verdict, tail } }, written whole at each start and end. A run the desk did not see end (it stopped
  // or was killed while one ran) reads as ended with that said, never as running. live holds the children this process
  // spawned, by door: stop kills that child and nothing else.
  const STATE_DIR = String(desk.stateDir || '');
  const RUNS = STATE_DIR ? path.join(STATE_DIR, 'runs.json') : '';
  const live = Object.create(null);
  let runs = Object.create(null);
  try { runs = Object.assign(Object.create(null), JSON.parse(fs.readFileSync(RUNS, 'utf8'))); } catch (e) { runs = Object.create(null); }
  Object.keys(runs).forEach(function (id) {
    const r = runs[id];
    if (r && !r.endedAt) { r.endedAt = new Date().toISOString(); r.verdict = { ran: false, green: false, around: 0, of: 0, paths: [], why: 'the desk stopped while it ran' }; }
  });
  function saveRuns() {
    if (!RUNS) return;
    try {
      fs.mkdirSync(STATE_DIR, { recursive: true });
      const tmp = RUNS + '.' + process.pid + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(runs, null, 2) + '\n');
      fs.renameSync(tmp, RUNS);
    } catch (e) { console.error('stackFrameChecks: the runs could not be kept: ' + ((e && e.message) || e)); }
  }
  // Said on the desk's stream (desk.publish wraps it as { plugin, data }); the UI reads the doors and the run again.
  function say(what, id) {
    if (typeof desk.publish === 'function') desk.publish({ what: what, id: String(id || ''), running: !!live[id] });
  }
  // A child this process spawned, killed when the desk exits, so no run outlives the desk that started it.
  process.on('exit', function () { Object.keys(live).forEach(function (id) { try { live[id].child.kill(); } catch (e) { /* gone */ } }); });

  function noVerdict(why) { return { ran: false, green: false, around: 0, of: 0, paths: [], why: why }; }
  // As many of a list as fit total bytes, each cut to one bytes.
  function fit(all, one, total) {
    const out = [];
    let used = 0;
    for (const p of all) {
      let q = p;
      while (Buffer.byteLength(q, 'utf8') > one) q = q.slice(0, q.length - 8);
      const b = Buffer.byteLength(q, 'utf8');
      if (used + b > total) break;
      out.push(q);
      used += b;
    }
    return out;
  }
  // The verdict as one answer carries it: its violator lines (goal/G22.3), formatted from every kept path with the door
  // as it is now, then the raw paths, each list cut to fit and the rest counted.
  function verdictOut(v, door) {
    v = v || noVerdict('never run');
    const all = Array.isArray(v.paths) ? v.paths.map(String) : [];
    let lines = [];
    try { lines = door && all.length ? violators(door, all, { root: REPO }) : []; } catch (e) { lines = []; }
    const said = fit(lines, PATH_BYTES, VIOLATORS_BYTES);
    const paths = fit(all, PATH_BYTES, PATHS_BYTES);
    return { ran: !!v.ran, green: !!v.green, around: Number(v.around) || 0, of: Number(v.of) || 0,
      violators: said, violatorsLeft: lines.length - said.length, paths: paths,
      pathsLeft: all.length - paths.length, why: String(v.why || '') };
  }
  function lastOf(id) {
    const r = runs[id];
    const v = r && r.verdict ? r.verdict : null;
    return { running: !!live[id], ran: !!(v && v.ran), green: !!(v && v.green), around: v ? Number(v.around) || 0 : 0,
      of: v ? Number(v.of) || 0 : 0, startedAt: r ? String(r.startedAt || '') : '', endedAt: r ? String(r.endedAt || '') : '',
      stopped: !!(r && r.stopped) };
  }
  function tailOf(buf) {
    return buf.length > TAIL_BYTES ? buf.subarray(buf.length - TAIL_BYTES).toString('utf8') : buf.toString('utf8');
  }
  function doorById(list, id, what) {
    const d = list.filter(function (x) { return x.id === id; })[0];
    if (!d) throw desk.refused('bad-request', 'the list has no door ' + JSON.stringify(id) + (what ? ' to ' + what : ''));
    return d;
  }
  function notRunning(id, what) {
    if (live[id]) throw desk.refused('bad-request', 'a run of door ' + id + ' is under way since ' + live[id].startedAt + ': stop it or let it end before you ' + what + ' it');
  }

  function refuses(verb, a, ids) {
    if (!ids.some(desk.inGoal)) return '';
    // A session names the whole goal and closes what it leaves out (goal/G4.24): the rerun item would be closed by it.
    if (verb === 'session.set') return 'a session over its goal would close the items it leaves out, its rerun item ' + rerun + ' among them';
    if (verb === 'press') {
      const what = String(a.what || '');
      // Abandon on any of its items abandons the goal itself (press()), so it is refused on all of them.
      if (what === 'abandon') return 'its goal is never abandoned';
      if ((what === 'close' || what === 'done') && a.id === goal) return 'its goal always stays open, so ' + what + ' is refused';
      if ((what === 'close' || what === 'done') && a.id === rerun) return 'its rerun item ' + rerun + ' always stays open, so ' + what + ' is refused';
    }
    if (verb === 'item.delete' && a.id === rerun) return 'its rerun item ' + rerun + ' always stays open, so it is never deleted';
    if (verb === 'item.files.add' && a.id === rerun) return 'the file list of its rerun item ' + rerun + ' is ' + RERUN_TEST + ' alone, so a verify.again reruns that suite';
    return '';
  }

  // A RERUN ON ITS RERUN ITEM, taken by the plugin (as goal/G22.1). The desk's own verify.again takes a code item with
  // a verify pass only; this item is neither, and its whole purpose is the rerun: the record is what deskVerify's
  // watcher reads, and it runs the item's file list.
  function handles(verb, a, caller) {
    if (verb !== 'verify.again' || a.id !== rerun) return undefined;
    return { change: desk.writeAs('verify.again', { id: rerun }, caller).change };
  }

  // THE DIALOG'S ADD: a door (gate, endpoint, paths, suites) in; the door added to the list under a new id and a
  // goal/G22.2-type item out, in its goal. Each form is checked against the tree (the file there, the function in it,
  // each suite there); the title, made of the short names (peerPost::post, presenceNode), obeys the label rule; a door
  // already in the list or an open item asking the same is refused. Five writes: the item (by the caller), the door into
  // the list with that item, then the item's file list, its box and its code mark (by the desk, as the plugin).
  function make(a, caller) {
    const list = doorsWithIds();
    const door = doorOf(desk, a, list, '');
    const gate = door.gate;
    const endpoint = door.endpoint;
    const reached = /^node:/.test(endpoint) ? endpoint.slice(5) : shortOf(endpoint);
    const title = 'Nobody but ' + shortOf(gate.split('::')[0]) + '::' + gate.split('::')[1] + ' reaches ' + reached;
    if (desk.fieldWhy('title', title)) throw desk.refused('bad-request', desk.fieldWhy('the item\'s title, ' + JSON.stringify(title), title));
    const args = { goal: goal, title: title };
    desk.writeAs('item.add', args, caller, function (s) {
      const g = s.goals[goal];
      const same = (g ? g.members : []).filter(function (id) { const m = s.items[id]; return m && !m.done && !m.closed && m.title === title; })[0];
      if (same) throw desk.refused('bad-request', same + ' asks this already: ' + title);
      args.minted = desk.nextItemId(s, goal);
    });
    const id = args.minted;
    // THE DOOR, with the suites given, or none: an empty run fails in the stack-frame test, which is its red until an
    // agent measures the suites that drive it.
    const now = readDoors();
    const doorId = nextDoorId(now);
    now.push(Object.assign({ id: doorId }, door, { item: id }));
    writeDoors(now);
    const on = endpoint + (door.paths ? ' on ' + door.paths.join(', ') : '');
    desk.write('item.files.add', { id: id, paths: [ITEMS_TEST] });
    desk.write('box.write', { id: id, version: 0, text: 'every production stack reaching ' + on + ' passes through ' + gate + '.\n' +
      '- Gate: ' + gate + ', one function. Endpoint: ' + on + (door.paths ? ', Node\'s own requests on those paths.' : ', the whole module: every function it exports, and what an exported factory returns.') + '\n' +
      '- The door is ' + doorId + ' in the plugin\'s list, stackFrameList.json, ' + (door.suites.length ? 'driven by ' + door.suites.join(', ') : 'with no suites yet: ' + RERUN_TEST + ' fails it as an empty run until an agent measures the suites that drive it and writes them in') + '.\n' +
      '- ' + ITEMS_TEST + ' reads the list: its test for this item asserts the door is there, gated by one file::function.\n' +
      '- ' + RERUN_TEST + ' holds its verdict, and ' + rerun + ' reruns it; the Stacks tab runs it alone.\n' +
      '- Made by the stackFrameChecks plugin from its dialog (goal/G22.3).' });
    // A goal/G22.2 item is a code item: its red is the entry in the test file, its build the row.
    const last = desk.write('press', { id: id, what: 'code' });
    say('list', doorId);
    return { id: id, change: last.change };
  }

  // A DOOR CHANGED IN PLACE, under the add's rules; its id and its item stay. Its last verdict is cleared: it no longer
  // describes the door (Andy's "with a way to modify a row as well", 2026-10-13). Refused while it runs.
  function update(a) {
    const id = String(a.id || '');
    const list = doorsWithIds();
    const d = doorById(list, id, 'change');
    notRunning(id, 'change');
    const door = doorOf(desk, a, list, id);
    d.gate = door.gate;
    d.endpoint = door.endpoint;
    d.suites = door.suites;
    if (door.paths) d.paths = door.paths; else delete d.paths;
    writeDoors(list);
    delete runs[id];
    saveRuns();
    say('list', id);
    return { id: id };
  }

  // A DOOR STRUCK FROM THE LIST, with its last verdict. Its item stays: it is the desk's record of the work asked.
  function remove(a) {
    const id = String(a.id || '');
    const list = doorsWithIds();
    doorById(list, id, 'remove');
    notRunning(id, 'remove');
    writeDoors(list.filter(function (x) { return x.id !== id; }));
    delete runs[id];
    saveRuns();
    say('list', id);
    return { id: id };
  }

  // ONE DOOR'S CHECK, STARTED AT ONCE: the runner is spawned and the answer goes back before it does anything. Its
  // output is kept to a tail; its verdict is the file it writes, read when it ends.
  function run(a) {
    const id = String(a.id || '');
    const list = doorsWithIds();
    doorById(list, id, 'run');
    notRunning(id, 'start a second run of');
    if (!STATE_DIR) throw desk.refused('bad-request', 'the desk handed this plugin no state folder to keep its runs in');
    if (!fs.existsSync(RUNNER)) throw desk.refused('bad-request', 'the runner ' + path.relative(REPO, RUNNER).replace(/\\/g, '/') + ' is not there: the stack-frame suites are not in this tree');
    fs.mkdirSync(STATE_DIR, { recursive: true });
    const startedAt = new Date().toISOString();
    const runId = id + '-' + Date.now().toString(36);
    const verdictFile = path.join(STATE_DIR, 'verdict-' + runId + '.json');
    const child = spawn(process.execPath, [RUNNER], {
      cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
      env: Object.assign({}, process.env, { SPIRIT_STACKS_DOOR: id, SPIRIT_STACKS_VERDICT: verdictFile, SPIRIT_STACKS_LIST: LIST }),
    });
    const held = { child: child, runId: runId, startedAt: startedAt, out: Buffer.alloc(0), stopped: false };
    live[id] = held;
    runs[id] = { runId: runId, startedAt: startedAt, endedAt: '', stopped: false, exit: null, verdict: null, tail: '' };
    const keep = function (chunk) {
      held.out = Buffer.concat([held.out, chunk]);
      if (held.out.length > TAIL_BYTES * 2) held.out = held.out.subarray(held.out.length - TAIL_BYTES);
    };
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    let ended = false;
    const end = function (code, why) {
      if (ended) return;
      ended = true;
      if (live[id] === held) delete live[id];
      let v = null;
      try { v = JSON.parse(fs.readFileSync(verdictFile, 'utf8')); } catch (e) { v = null; }
      try { fs.unlinkSync(verdictFile); } catch (e) { /* none written */ }
      const verdict = held.stopped ? noVerdict('stopped before its verdict') :
        v && typeof v === 'object' ? { ran: true, green: !!v.green, around: Number(v.around) || 0, of: Number(v.of) || 0,
          paths: (Array.isArray(v.paths) ? v.paths : []).slice(0, KEPT_PATHS).map(String), why: String(v.why || '') } :
          noVerdict(why || 'the runner exited ' + code + ' with no verdict');
      // A door struck or changed while it ran keeps no verdict: it would describe a door that is not in the list.
      if (runs[id] && runs[id].runId === runId) {
        runs[id] = { runId: runId, startedAt: startedAt, endedAt: new Date().toISOString(), stopped: held.stopped,
          exit: code === null || code === undefined ? null : Number(code), verdict: verdict, tail: tailOf(held.out) };
        saveRuns();
      }
      say('run', id);
    };
    child.on('error', function (e) { end(null, 'the runner did not start: ' + ((e && e.message) || e)); });
    child.on('close', function (code) { end(code, ''); });
    saveRuns();
    say('run', id);
    return { started: true, runId: runId };
  }

  // A RUN UNDER WAY, STOPPED: the child this plugin spawned is killed, and only it.
  function stop(a) {
    const id = String(a.id || '');
    doorById(doorsWithIds(), id, 'stop');
    const held = live[id];
    if (!held) throw desk.refused('bad-request', 'no run of door ' + id + ' is under way to stop');
    held.stopped = true;
    try { held.child.kill(); } catch (e) { /* gone already: close says so */ }
    return { stopped: true };
  }

  function runState(a) {
    const id = String(a.id || '');
    const door = doorById(doorsWithIds(), id, 'read');
    const r = runs[id];
    const held = live[id];
    return { id: id, running: !!held, startedAt: r ? String(r.startedAt || '') : '', endedAt: held ? '' : r ? String(r.endedAt || '') : '',
      stopped: !!(r && r.stopped), runId: r ? String(r.runId || '') : '',
      tail: held ? tailOf(held.out) : r ? String(r.tail || '') : '',
      verdict: verdictOut(held ? noVerdict('running') : r && r.verdict, door) };
  }

  const DOOR = { id: '', gate: '', endpoint: '', paths: [''], suites: [''] };
  const VERDICT = { ran: true, green: true, around: 0, of: 0, violators: [''], violatorsLeft: 0, paths: [''], pathsLeft: 0, why: '' };
  return {
    refuses: refuses,
    handles: handles,
    verbs: {
      'stackFrameChecks.make': { request: { gate: '', endpoint: '', paths: [''], suites: [''] }, reply: { id: '', change: 0 }, handler: make },
      'stackFrameChecks.update': { request: DOOR, reply: { id: '' }, handler: update },
      'stackFrameChecks.remove': { request: { id: '' }, reply: { id: '' }, handler: remove },
      'stackFrameChecks.run': { request: { id: '' }, reply: { started: true, runId: '' }, handler: run },
      'stackFrameChecks.stop': { request: { id: '' }, reply: { stopped: true }, handler: stop },
      'stackFrameChecks.runState': { request: { id: '' }, reply: { id: '', running: true, startedAt: '', endedAt: '', stopped: true, runId: '', tail: '', verdict: VERDICT }, handler: runState },
      // THE LIST READ BACK, for its UI: every door as the list holds it (paths on a node: endpoint), with its last run.
      'stackFrameChecks.doors': { request: {}, reply: { doors: [{ id: '', gate: '', endpoint: '', suites: [''], item: '',
        last: { running: true, ran: true, green: true, around: 0, of: 0, startedAt: '', endedAt: '', stopped: true } }] }, handler: function () {
        return { doors: doorsWithIds().map(function (d) {
          const out = { id: String(d.id), gate: String(d.gate || ''), endpoint: String(d.endpoint || ''),
            suites: Array.isArray(d.suites) ? d.suites.map(String) : [], item: String(d.item || ''), last: lastOf(d.id) };
          if (Array.isArray(d.paths)) out.paths = d.paths.map(String);
          return out;
        }) };
      } },
    },
  };
};
