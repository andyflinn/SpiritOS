'use strict';

// spirit/run/process/js/desk/plugins/js/stackFrameChecks/stackFrameChecks.js
// THE STACK-FRAME CHECKS PLUGIN (goal/G22.3), the first gg plugin: it governs its private goal of stack-frame items.
//
//   Andy, 2026-10-13, in the item's box: "The stack-frame plugin sets the parameters (gate frame and target frame) and
//   generates the equivalent of a goal/G22.2 item from them.", "It governs its goal: the goal always stays open", "It
//   has a companion dialog where the gate and endpoint functions are entered.", and "It is a pluggable version of
//   goal/G0: a special goal that is always open while actually closed."
//
// DECIDED BY ANDY, not this file's to loosen: nothing closes, finishes or abandons the goal. The plugin makes the desk
// items and keeps the list of doors; the agents measure each door's suites into the list and do the work its red shows:
// it edits no test code.
//
// THE STACKS SUBSYSTEM STANDS ALONE (goal/G27.2, D9). Andy, 2026-10-17: "the stacks plugin must drive the stack checks
// exclusively", and "We will resolve a verifier conflict by excluding the stack issues from verifier runs." So the
// plugin alone runs a door's check (run, below); deskVerify runs none and only records the verdict; the rerun item
// goal/G22.3 gave the goal, whose verify.again had deskVerify rerun the whole suite, is gone, and one left from before
// is deleted when the plugin mounts.
//
// EVERY DOOR HAS ITS OWN ITEM (goal/G27.2, D8). Andy, 2026-10-17: "This chat MUST me the item chat associated with this
// door", and "a new item here is going to make their old framing obsolete." A door whose item is outside its goal, or
// shared with another door, gets a fresh item in its goal when the plugin mounts, made as make makes one, and the list
// points at it; the old item keeps its own chat and is no longer held open by the plugin.
//
// ── IT RUNS THE SHOW (goal/G22.3) ───────────────────────────────────
//
// DECIDED BY ANDY, 2026-10-13, in goal/G22.3's box: "I want this plugin to RUN the show, so you give me the complete
// toolset. add/remove rows (add with validation) and you will give me a run button/link for each one of them, or even
// better, a run-dialog", "with a way to modify a row as well.", and "put that in the dialog if you want." So the list
// is maintained here, every door under a stable id: make adds (paths and suites with it), update changes a door in
// place under the same rules and clears its last verdict (it no longer describes the door), remove strikes it.
//
// ── A DOOR RUNS HERE, deskVerify ONLY RECORDS IT (goal/G27.2) ───────
//
// DECIDED BY ANDY, 2026-10-17, in goal/G27.2's box, replacing goal/G22.3's run through deskVerify: a door being
// designed runs at once, here, and deskVerify only records its verdict ("i don't want verifier to block the
// design-a-door process", "i don't mind if our test sends the verifier a result"). So run starts the one-door suite
// itself and answers at once; runState and each door's last verdict are its own, kept under the desk's --state
// (desk.stateDir: never in git) beside when each door last changed, so a verdict older than its door's change reads as
// cleared; the verdict then goes to deskVerify's door.record.
//
// ── IT COMMITS ITS OWN LIST (goal/G22.3) ────────────────────────────
//
// DECIDED BY ANDY, 2026-10-13: "the commit function has to be there. it belongs to committing reds." After make, update
// or remove writes the list, the plugin commits that one file in the repo it lives in, "plugin/stackFrameChecks: <what
// changed>", and pushes it with pushOrigin, as deskVerify's idle chores publish under their standing grant
// (publishData: add the one file, commit --only that file, pushOrigin). With other changes staged in that repo it does
// not commit, and says so; a push that fails is said in the reply and the commit stays local. Git is spawned and
// awaited, never spawnSync, so the desk answers while it runs; the only children this file spawns are git and
// pushOrigin, and the only one it ever kills is a pushOrigin of its own past PUSH_MS.
//
// What the desk hands it (process/js/desk/desk.js, MOUNTING THE PLUGINS): its goal's key, the desk's writes (as the
// desk, or as the caller), the field rules, the id minting, its state folder, publish, and verify (one verb of this
// node's deskVerify). What it gives back: refuses and its verbs.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// The stack-frame suite in its one-door mode, which the plugin alone runs (D5, D9).
const DOOR_TEST = 'spirit/test/oneDoorStacks.js';
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
// those two lines. deskVerify runs the stack-frame suite of the checkout it measures, which reads the list of that
// checkout: on his node the desk and deskVerify run from the same clone, so the list run is this list.
//
// A SUITE NAMES A SCRATCH LIST in the suite-only value stackFrameList (as it names pluginsMore), read from the desk's own
// first argument, the manifest's values as the node hands them: a suite never writes the tree's list. The list is
// committed in the repo it lives in, so a suite puts its scratch list in a scratch work tree and nothing it does is
// committed to a real repo.
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const REPO = path.resolve(RUN, '..', '..');
const SUITES_DIR = path.join(REPO, 'spirit', 'test');
const LIST_HOME = path.join(__dirname, 'stackFrameList.json');
const VALUES = (function () {
  try { return JSON.parse(process.argv[2] || '{}') || {}; } catch (e) { return {}; }
}());
const LIST = VALUES.stackFrameList ? path.resolve(String(VALUES.stackFrameList)) : LIST_HOME;
const PUSH_ORIGIN = path.join(RUN, 'process', 'js', 'pushOrigin', 'pushOrigin.js');
const PUSH_MS = 3 * 60 * 1000;
const FILE_RE = /^spirit\/run\/((?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.js)$/;
const GATE_RE = /^(spirit\/run\/(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.js)::([A-Za-z_$][A-Za-z0-9_$]*)$/;
const SUITE_RE = /^[A-Za-z0-9_][A-Za-z0-9_.-]*\.js$/;
const PATH_RE = /^\/[A-Za-z0-9_.~%/-]*$/;
const NODE_KINDS = ['http', 'https', 'fetch'];
const FORM_MAX = 256;
const PATHS_MAX = 16;
const SUITES_MAX = 32;
// What one answer may carry (appClient.ANSWER_MAX is 8377 bytes): its violator lines and its raw paths around the gate,
// each cut to fit by BYTES (Andy's rule, 2026-10-10: every size check in bytes); what is left out is counted in
// violatorsLeft and pathsLeft, the paths the run kept but did not send among them. Since the violator lines
// (goal/G22.3) the raw paths give them 2000 of their 5000.
const PATH_BYTES = 300;
const PATHS_BYTES = 3000;
const VIOLATORS_BYTES = 2000;
// THE RUN AS ANDY READS IT (goal/G22.3): one line per violator, "hub.js:300 sealedClaim (from handleClaim) ---> GET
// /api/relay/key, bypassing createPeerPost". Andy, 2026-10-13: "much better, gimme that when i press run:". The rule
// is violators.js's header.
const { violators } = require('./violators.js');

// AN ITEM NAMED BEFORE THE IDS BECAME NUMBERS (goal/G33.4): plugin/stackFrameChecks.<n> in the list is read as this
// plugin's goal's item, by the desk's own reading (desk.idOf, set at mount); the list keeps what it says until written.
let itemIdOf = function (id) { return id; };
function readDoors() {
  let list = [];
  try { list = JSON.parse(fs.readFileSync(LIST, 'utf8')); } catch (e) { list = []; }
  return (Array.isArray(list) ? list.filter(function (d) { return d && typeof d === 'object'; }) : []).map(function (d) {
    if (typeof d.item === 'string' && d.item) d.item = itemIdOf(d.item);
    return d;
  });
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

// ── THE COMMIT OF THE LIST (goal/G22.3, Andy: "the commit function has to be there.") ──────────────────────────
// Git spawned and awaited in the list's own folder, so the desk keeps answering; its answer { status, out }.
function gitIn(dir, args) {
  return new Promise(function (resolve) {
    let kid = null;
    const out = [];
    try { kid = spawn('git', args, { cwd: dir, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { resolve({ status: 1, out: String((e && e.message) || e) }); return; }
    kid.stdout.on('data', function (d) { out.push(String(d)); });
    kid.stderr.on('data', function (d) { out.push(String(d)); });
    kid.on('error', function (e) { resolve({ status: 1, out: String((e && e.message) || e) }); });
    kid.on('close', function (code) { resolve({ status: code, out: out.join('') }); });
  });
}
function firstLine(s) { return String(s || '').trim().split('\n')[0].trim().slice(0, 300); }
// pushOrigin as its own process (it is runnable so, and its git is spawnSync, which would freeze the desk if it were
// required here): it rebases onto origin's newest and pushes, retrying a race. Killed past PUSH_MS, the only kill here.
function pushRepo(repo) {
  return new Promise(function (resolve) {
    let kid = null;
    const out = [];
    try { kid = spawn(process.execPath, [PUSH_ORIGIN, JSON.stringify({ repo: repo })], { cwd: repo, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { resolve({ ok: false, reason: String((e && e.message) || e) }); return; }
    const timer = setTimeout(function () { try { kid.kill(); } catch (e) { /* gone */ } }, PUSH_MS);
    kid.stdout.on('data', function (d) { out.push(String(d)); });
    kid.stderr.on('data', function (d) { out.push(String(d)); });
    kid.on('error', function (e) { clearTimeout(timer); resolve({ ok: false, reason: String((e && e.message) || e) }); });
    kid.on('close', function (code) {
      clearTimeout(timer);
      resolve(code === 0 ? { ok: true } : { ok: false, reason: firstLine(out.join('').replace(/^pushOrigin:\s*/, '')) || 'pushOrigin exited ' + code });
    });
  });
}
// The list file alone, committed and pushed; the answer is one line for the reply, saying what happened.
async function commitList(what) {
  const dir = path.dirname(LIST);
  const name = path.basename(LIST);
  const prefix = await gitIn(dir, ['rev-parse', '--show-prefix']);
  if (prefix.status !== 0) return 'not committed: the list is in no git repo (' + firstLine(prefix.out) + ')';
  const full = String(prefix.out).trim() + name;
  const staged = String((await gitIn(dir, ['diff', '--cached', '--name-only'])).out).split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
  const others = staged.filter(function (f) { return f !== full; });
  if (others.length) return 'not committed: other changes are staged in the repo (' + others.slice(0, 3).join(', ') + (others.length > 3 ? ' and ' + (others.length - 3) + ' more' : '') + '), and the list is committed only alone';
  const added = await gitIn(dir, ['add', '--', name]);
  if (added.status !== 0) return 'not committed: git add refused it: ' + firstLine(added.out);
  if ((await gitIn(dir, ['diff', '--cached', '--quiet', '--', name])).status === 0) return 'nothing to commit: the list is as the repo holds it';
  const made = await gitIn(dir, ['commit', '-q', '--only', '-m', 'plugin/stackFrameChecks: ' + what, '--', name]);
  if (made.status !== 0) {
    // Taken off the index again, so a refused commit leaves nothing staged behind it.
    await gitIn(dir, ['reset', '-q', '--', name]);
    return 'not committed: the commit was refused: ' + firstLine(made.out);
  }
  const hash = firstLine((await gitIn(dir, ['rev-parse', '--short', 'HEAD'])).out);
  const top = firstLine((await gitIn(dir, ['rev-parse', '--show-toplevel'])).out);
  const pushed = await pushRepo(top);
  return pushed.ok ? 'committed ' + hash + ' and pushed it' : 'committed ' + hash + ' locally; the push failed, so it is not pushed: ' + pushed.reason;
}
// One commit at a time: two quick changes never share git's index.
let committing = Promise.resolve();
function commitOne(what) {
  const next = committing.then(function () { return commitList(what); }, function () { return commitList(what); });
  committing = next.catch(function () { /* said in its reply */ });
  return next.catch(function (e) { return 'not committed: ' + ((e && e.message) || e); });
}

module.exports = function (desk) {
  const goal = desk.goal;
  if (typeof desk.idOf === 'function') itemIdOf = desk.idOf;
  // THE RERUN ITEM LEFT FROM BEFORE D9 (see the header): deleted, so nothing in the goal has deskVerify run the suite.
  const RERUN_TITLE = 'Rerun the stack-frame test';
  const st = desk.state();
  const before = st.goals[goal] ? st.goals[goal].members : [];
  before.forEach(function (id) {
    const m = st.items[id];
    if (m && !m.done && !m.closed && m.title === RERUN_TITLE) {
      try { desk.write('item.delete', { id: id }); } catch (e) { console.error('stackFrameChecks: the old rerun item ' + id + ' could not be deleted: ' + ((e && e.message) || e)); }
    }
  });

  // ── WHEN EACH DOOR LAST CHANGED (goal/G22.3) ──────────────────────
  //
  // Beside each door's newest run (runs/, below), the plugin keeps, in changed.json in its own folder under the desk's
  // --state, when each door was made, changed or struck. A run started before that describes another
  // door (Andy's "with a way to modify a row as well": a changed door's last verdict is cleared), and an id struck and
  // minted again names a new door.
  const STATE_DIR = String(desk.stateDir || '');
  const CHANGED = STATE_DIR ? path.join(STATE_DIR, 'changed.json') : '';
  let changed = Object.create(null);
  try { changed = Object.assign(Object.create(null), JSON.parse(fs.readFileSync(CHANGED, 'utf8'))); } catch (e) { changed = Object.create(null); }
  function markChanged(id) {
    changed[id] = new Date().toISOString();
    if (!CHANGED) return;
    try {
      fs.mkdirSync(STATE_DIR, { recursive: true });
      const tmp = CHANGED + '.' + process.pid + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(changed, null, 2) + '\n');
      fs.renameSync(tmp, CHANGED);
    } catch (e) { console.error('stackFrameChecks: when the door changed could not be kept: ' + ((e && e.message) || e)); }
  }
  // Said on the desk's stream (desk.publish wraps it as { plugin, data }); the UI reads the doors again.
  function say(what, id) {
    if (typeof desk.publish === 'function') desk.publish({ what: what, id: String(id || '') });
  }

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
      pathsLeft: all.length - paths.length + (Number(v.pathsLeft) || 0), why: String(v.why || '') };
  }
  // ── A DOOR RUN BY THE PLUGIN ITSELF (goal/G27.2, D5) ──────────────
  //
  //   Andy, 2026-10-17: "i also don't want to wait for the verifier to be willing to run that one door test for me. in
  //   stacks, we're actually "designing" the door, not running it for the verifiers benefit, i don't mind if our test
  //   sends the verifier a result, i don't want verifier to block the design-a-door process". This replaces goal/G22.3's
  //   ruling that every door run goes through deskVerify; the overlap with a deskVerify run on the same tree is
  //   accepted (Andy, same day).
  //
  // Run starts the stack-frame suite in its one-door mode at once (SPIRIT_STACKS_DOOR, the list the plugin keeps in
  // SPIRIT_STACKS_LIST, the verdict written to SPIRIT_STACKS_VERDICT), one run per door at a time; its verdict is kept
  // in the plugin's own folder under the desk's --state (runs/<id>.json, the newest per door), said on the stream, and
  // then handed to deskVerify as a record only (door.record), which runs nothing.
  const RUNS_DIR = STATE_DIR ? path.join(STATE_DIR, 'runs') : '';
  const live = Object.create(null);   // door id -> { startedAt } while its run is under way
  function keptRun(id) {
    if (!RUNS_DIR) return null;
    try { const v = JSON.parse(fs.readFileSync(path.join(RUNS_DIR, id + '.json'), 'utf8')); return v && typeof v === 'object' ? v : null; } catch (e) { return null; }
  }
  function keepRun(id, k) {
    if (!RUNS_DIR) return;
    try {
      fs.mkdirSync(RUNS_DIR, { recursive: true });
      const out = path.join(RUNS_DIR, id + '.json');
      fs.writeFileSync(out + '.tmp', JSON.stringify(k));
      fs.renameSync(out + '.tmp', out);
    } catch (e) { console.error('stackFrameChecks: the run of door ' + id + ' could not be kept: ' + ((e && e.message) || e)); }
  }
  function runDoor(id) {
    const startedAt = new Date().toISOString();
    live[id] = { startedAt: startedAt };
    const tmp = path.join(RUNS_DIR || require('os').tmpdir(), id + '.' + process.pid + '.verdict.json');
    try { fs.mkdirSync(path.dirname(tmp), { recursive: true }); fs.unlinkSync(tmp); } catch (e) { /* none left */ }
    let kid = null;
    try {
      kid = spawn(process.execPath, [path.join(REPO, DOOR_TEST)], { cwd: REPO, stdio: ['ignore', 'ignore', 'ignore'], windowsHide: true,
        env: Object.assign({}, process.env, { SPIRIT_STACKS_DOOR: id, SPIRIT_STACKS_VERDICT: tmp, SPIRIT_STACKS_LIST: LIST }) });
    } catch (e) { kid = null; }
    const end = function (code) {
      let v = null;
      try { v = JSON.parse(fs.readFileSync(tmp, 'utf8')); } catch (e) { v = null; }
      try { fs.unlinkSync(tmp); } catch (e) { /* none written */ }
      const verdict = v && typeof v === 'object'
        ? { ran: true, green: v.green === true, around: Number(v.around) || 0, of: Number(v.of) || 0, paths: (Array.isArray(v.paths) ? v.paths : []).map(String), why: String(v.why || '') }
        : noVerdict(kid ? 'the suite exited ' + code + ' with no verdict' : 'the suite could not be started');
      const kept = Object.assign({ door: id, startedAt: startedAt, endedAt: new Date().toISOString(), stopped: false, commit: '' }, verdict);
      delete live[id];
      keepRun(id, kept);
      say('run', id);
      if (typeof desk.verify === 'function') Promise.resolve(desk.verify('door.record', { id: id, verdict: kept })).catch(function () { /* a record only */ });
    };
    if (!kid) { end(null); return; }
    kid.on('error', function () { /* its exit says the rest */ });
    kid.on('exit', function (code) { end(code); });
  }
  // A door's newest run, the plugin's own: under way, or its kept verdict; a verdict older than the door's last change
  // read as none.
  function stateOf(id) {
    if (live[id]) return Promise.resolve(Object.assign({ running: true, queued: false, startedAt: live[id].startedAt, endedAt: '', stopped: false, commit: '', pathsLeft: 0 }, noVerdict('running')));
    const k = keptRun(id);
    if (!k) return Promise.resolve(Object.assign({ running: false, queued: false, startedAt: '', endedAt: '', stopped: false, commit: '', pathsLeft: 0 }, noVerdict('never run')));
    const s0 = { running: false, queued: false, ran: k.ran === true, green: k.green === true, around: Number(k.around) || 0, of: Number(k.of) || 0,
      paths: Array.isArray(k.paths) ? k.paths.map(String) : [], pathsLeft: 0, why: String(k.why || ''), startedAt: String(k.startedAt || ''),
      endedAt: String(k.endedAt || ''), stopped: false, commit: String(k.commit || '') };
    if (changed[id] && s0.startedAt && s0.startedAt < changed[id]) {
      return Promise.resolve(Object.assign(s0, noVerdict('the door changed after its last run'), { startedAt: '', endedAt: '', commit: '' }));
    }
    return Promise.resolve(s0);
  }
  function lastOf(id) {
    return stateOf(id).then(function (s) {
      return { running: s.running, queued: s.queued, ran: s.ran, green: s.green, around: s.around, of: s.of,
        startedAt: s.startedAt, endedAt: s.endedAt, stopped: s.stopped };
    });
  }
  function doorById(list, id, what) {
    const d = list.filter(function (x) { return x.id === id; })[0];
    if (!d) throw desk.refused('bad-request', 'the list has no door ' + JSON.stringify(id) + (what ? ' to ' + what : ''));
    return d;
  }
  // Refused while the door's own run is under way: the run would describe a door that is not in the list.
  function notRunning(id, what) {
    return stateOf(id).then(function (s) {
      if (s.running || s.queued) throw desk.refused('bad-request', 'a run of door ' + id + ' is under way: let it end before you ' + what + ' it');
    });
  }

  function refuses(verb, a, ids) {
    if (!ids.some(desk.inGoal)) return '';
    // A session names the whole goal and closes what it leaves out (goal/G4.24): its door items would be closed by it.
    if (verb === 'session.set') return 'a session over its goal would close the items it leaves out, its door items among them';
    if (verb === 'press') {
      const what = String(a.what || '');
      // Abandon on any of its items abandons the goal itself (press()), so it is refused on all of them.
      if (what === 'abandon') return 'its goal is never abandoned';
      if ((what === 'close' || what === 'done') && a.id === goal) return 'its goal always stays open, so ' + what + ' is refused';
    }
    // A DOOR'S ITEM (goal/G27.2, D4). Andy, 2026-10-17: "that item never closes unless deleted from the stacks plugin
    // directly", and "the stacks goal handles it's item addition and deletion". So while its door is in the list its
    // item takes no close, done or delete; stackFrameChecks.remove strikes the door and deletes the item itself.
    const asking = verb === 'item.delete' || (verb === 'press' && (String(a.what || '') === 'close' || String(a.what || '') === 'done'));
    const ofDoor = asking ? readDoors().filter(function (d) { return d && d.item === a.id; })[0] : null;
    if (ofDoor) return a.id + ' is the item of door ' + (ofDoor.id || '') + ': it closes only when the door is removed, from its dialog in Stacks';
    return '';
  }

  // A DOOR'S ITEM, made in its goal: its title from the short names (peerPost::post, presenceNode), obeying the label
  // rule, an open item asking the same refused; then its file list, its box and its code mark (by the desk, as the
  // plugin). The item.add is the caller's when a caller is given (make), the desk's otherwise (D8, at mount). Answers
  // { id, change }.
  function itemFor(door, doorId, caller, from) {
    const gate = door.gate;
    const endpoint = door.endpoint;
    const reached = /^node:/.test(endpoint) ? endpoint.slice(5) : shortOf(endpoint);
    const title = 'Nobody but ' + shortOf(gate.split('::')[0]) + '::' + gate.split('::')[1] + ' reaches ' + reached;
    if (desk.fieldWhy('title', title)) throw desk.refused('bad-request', desk.fieldWhy('the item\'s title, ' + JSON.stringify(title), title));
    const args = { goal: goal, title: title };
    const mint = function (s) {
      const g = s.goals[goal];
      const same = (g ? g.members : []).filter(function (id) { const m = s.items[id]; return m && !m.done && !m.closed && m.title === title; })[0];
      if (same) throw desk.refused('bad-request', same + ' asks this already: ' + title);
      args.minted = desk.nextItemId(s, goal);
    };
    if (caller) desk.writeAs('item.add', args, caller, mint); else desk.write('item.add', args, mint);
    const id = args.minted;
    const on = endpoint + (door.paths ? ' on ' + door.paths.join(', ') : '');
    desk.write('item.files.add', { id: id, paths: [ITEMS_TEST] });
    desk.write('box.write', { id: id, version: 0, text: 'every production stack reaching ' + on + ' passes through ' + gate + '.\n' +
      '- Gate: ' + gate + ', one function. Endpoint: ' + on + (door.paths ? ', Node\'s own requests on those paths.' : ', the whole module: every function it exports, and what an exported factory returns.') + '\n' +
      '- The door is ' + doorId + ' in the plugin\'s list, stackFrameList.json, ' + (door.suites && door.suites.length ? 'driven by ' + door.suites.join(', ') : 'with no suites yet: its run is an empty run until an agent measures the suites that drive it and writes them in') + '.\n' +
      '- ' + ITEMS_TEST + ' reads the list: its test for this item asserts the door is there, gated by one file::function.\n' +
      '- The door\'s dialog in Stacks runs its check alone, at once; the Stacks plugin alone runs it, never deskVerify (goal/G27.2, D9).\n' +
      '- Made by the stackFrameChecks plugin ' + (from || 'from its dialog (goal/G22.3)') + '.' });
    // A goal/G22.2 item is a code item: its red is the entry in the test file, its build the row.
    const last = desk.write('press', { id: id, what: 'code' });
    return { id: id, change: last.change };
  }

  // THE DIALOG'S ADD: a door (gate, endpoint, paths, suites) in; the door added to the list under a new id and a
  // goal/G22.2-type item out, in its goal (itemFor). Each form is checked against the tree (the file there, the function
  // in it, each suite there); a door already in the list or an open item asking the same is refused.
  function make(a, caller) {
    const list = doorsWithIds();
    const door = doorOf(desk, a, list, '');
    const now = readDoors();
    const doorId = nextDoorId(now);
    // THE DOOR, with the suites given, or none: an empty run fails in the stack-frame test, which is its red until an
    // agent measures the suites that drive it.
    const made = itemFor(door, doorId, caller);
    now.push(Object.assign({ id: doorId }, door, { item: made.id }));
    writeDoors(now);
    const on = door.endpoint + (door.paths ? ' on ' + door.paths.join(', ') : '');
    // A minted id names a new door: a verdict kept under it before describes another (an id struck and
    // minted again).
    markChanged(doorId);
    say('list', doorId);
    return commitOne('door ' + doorId + ' added, ' + door.gate + ' -> ' + on + ', for ' + made.id).then(function (said) {
      return { id: made.id, change: made.change, commit: said };
    });
  }

  // EVERY DOOR ITS OWN ITEM (goal/G27.2, D8; see the header), once at mount: a door whose item is not an open item of
  // this goal, or is the item of a door before it in the list, gets a fresh one, and the list is written and committed
  // once. A door whose item cannot be made is said and left as it is.
  // ONLY ITEMS THIS DESK KNOWS. A door naming an item this desk has never held is another desk's (a suite's scratch
  // desk mounted on the tree's own list): it is left as it is, so no such desk ever rewrites or commits the list.
  (function ownItems() {
    let list = [];
    try { list = doorsWithIds(); } catch (e) { return; }
    const s = desk.state();
    const seen = Object.create(null);
    const moved = [];
    list.forEach(function (d) {
      const it = d.item ? s.items[d.item] : null;
      if (!it) return;
      const ours = !it.done && !it.closed && desk.inGoal(d.item) && !seen[d.item];
      if (ours) { seen[d.item] = true; return; }
      try {
        const made = itemFor(d, d.id, null, 'for door ' + d.id + ', which named ' + (d.item || 'no item') + ' before every door had its own (goal/G27.2, D8)');
        moved.push(d.id + ' ' + (d.item || 'none') + ' -> ' + made.id);
        d.item = made.id;
        seen[made.id] = true;
      } catch (e) { console.error('stackFrameChecks: door ' + d.id + ' got no item of its own: ' + ((e && e.message) || e)); }
    });
    if (!moved.length) return;
    writeDoors(list);
    say('list', '');
    commitOne('every door its own item: ' + moved.join(', ')).then(function (said) { console.error('stackFrameChecks: ' + said); });
  }());

  // A DOOR CHANGED IN PLACE, under the add's rules; its id and its item stay. Its last verdict is cleared: it no longer
  // describes the door (Andy's "with a way to modify a row as well", 2026-10-13). Refused while its run is under way.
  function update(a) {
    const id = String(a.id || '');
    const first = doorsWithIds();
    doorById(first, id, 'change');
    doorOf(desk, a, first, id);
    return notRunning(id, 'change').then(function () {
      // Read again after the wait, so a write in between is not lost, and checked again against it.
      const list = doorsWithIds();
      const d = doorById(list, id, 'change');
      const door = doorOf(desk, a, list, id);
      d.gate = door.gate;
      d.endpoint = door.endpoint;
      d.suites = door.suites;
      if (door.paths) d.paths = door.paths; else delete d.paths;
      writeDoors(list);
      markChanged(id);
      say('list', id);
      return commitOne('door ' + id + ' changed, ' + door.gate + ' -> ' + door.endpoint + (door.paths ? ' on ' + door.paths.join(', ') : '') +
        (door.suites.length ? ', driven by ' + door.suites.join(', ') : ', no suites')).then(function (said) { return { id: id, commit: said }; });
    });
  }

  // A DOOR STRUCK FROM THE LIST, and its item deleted with it (D4, below).
  function remove(a) {
    const id = String(a.id || '');
    doorById(doorsWithIds(), id, 'remove');
    return notRunning(id, 'remove').then(function () {
      const list = doorsWithIds();
      const d = doorById(list, id, 'remove');
      writeDoors(list.filter(function (x) { return x.id !== id; }));
      markChanged(id);
      // ITS ITEM GOES WITH IT (goal/G27.2, D4): the stacks goal handles its items' deletion. The door is out of the list
      // first, so the gate above lets the delete through.
      const it = d.item ? desk.state().items[d.item] : null;
      if (it && !it.closed && !it.done) desk.write('item.delete', { id: d.item });
      say('list', id);
      return commitOne('door ' + id + ' removed, ' + d.gate + ' -> ' + d.endpoint + (it ? ', its item ' + d.item + ' deleted' : '')).then(function (said) { return { id: id, commit: said }; });
    });
  }

  // ONE DOOR'S CHECK, RUN HERE AT ONCE (goal/G27.2, D5): answered at once, one run per door at a time; its verdict lands
  // in runState and goes to deskVerify as a record (runDoor, above).
  function run(a) {
    const id = String(a.id || '');
    doorById(doorsWithIds(), id, 'run');
    if (live[id]) return { started: false, already: true, said: 'Door ' + id + ' is running already, since ' + live[id].startedAt + '.' };
    runDoor(id);
    say('run', id);
    return { started: true, already: false, said: 'Door ' + id + ' is running now, here; its verdict shows when it lands, and goes to deskVerify as a record.' };
  }

  // Its newest run, the plugin's own: under way, then the verdict with its violator lines.
  function runState(a) {
    const id = String(a.id || '');
    const door = doorById(doorsWithIds(), id, 'read');
    return stateOf(id).then(function (s) {
      return { id: id, running: s.running, queued: s.queued, startedAt: s.startedAt, endedAt: s.running || s.queued ? '' : s.endedAt,
        stopped: s.stopped, commit: s.commit, verdict: verdictOut(s.running || s.queued ? noVerdict('running') : s, door) };
    });
  }

  const DOOR = { id: '', gate: '', endpoint: '', paths: [''], suites: [''] };
  const VERDICT = { ran: true, green: true, around: 0, of: 0, violators: [''], violatorsLeft: 0, paths: [''], pathsLeft: 0, why: '' };
  return {
    refuses: refuses,
    verbs: {
      // commit: one line, what became of the list's commit and push (goal/G22.3).
      'stackFrameChecks.make': { request: { gate: '', endpoint: '', paths: [''], suites: [''] }, reply: { id: '', change: 0, commit: '' }, handler: make },
      'stackFrameChecks.update': { request: DOOR, reply: { id: '', commit: '' }, handler: update },
      'stackFrameChecks.remove': { request: { id: '' }, reply: { id: '', commit: '' }, handler: remove },
      'stackFrameChecks.run': { request: { id: '' }, reply: { started: true, already: false, said: '' }, handler: run },
      'stackFrameChecks.runState': { request: { id: '' }, reply: { id: '', running: true, queued: true, startedAt: '', endedAt: '', stopped: true, commit: '', verdict: VERDICT }, handler: runState },
      // THE LIST READ BACK, for its UI: every door as the list holds it (paths on a node: endpoint), with its last run
      // as the plugin keeps it.
      'stackFrameChecks.doors': { request: {}, reply: { doors: [{ id: '', gate: '', endpoint: '', suites: [''], item: '',
        last: { running: true, queued: true, ran: true, green: true, around: 0, of: 0, startedAt: '', endedAt: '', stopped: true } }] }, handler: function () {
        const list = doorsWithIds();
        return Promise.all(list.map(function (d) { return lastOf(String(d.id)); })).then(function (lasts) {
          return { doors: list.map(function (d, i) {
            const out = { id: String(d.id), gate: String(d.gate || ''), endpoint: String(d.endpoint || ''),
              suites: Array.isArray(d.suites) ? d.suites.map(String) : [], item: String(d.item || ''), last: lasts[i] };
            if (Array.isArray(d.paths)) out.paths = d.paths.map(String);
            return out;
          }) };
        });
      } },
    },
  };
};
