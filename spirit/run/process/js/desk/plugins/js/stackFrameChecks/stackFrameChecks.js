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
// What the desk hands it (process/js/desk/desk.js, MOUNTING THE PLUGINS): its goal's key, the desk's writes (as the
// desk, or as the caller), the field rules and the id minting. What it gives back: refuses, handles and one verb.

const fs = require('fs');
const path = require('path');

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
// THE SHAPE (its .json says it too): an array of { gate, endpoint, paths?, suites, item }.
//   gate      "spirit/run/<file>.js::<function>"
//   endpoint  "spirit/run/<file>.js", or "node:http+https+fetch" (any of the three, joined by +) with paths
//   paths     a node: endpoint's path prefixes, e.g. ["/api/relay/"]
//   suites    the suites that drive it, measured by an agent: empty until then, and an empty run is its red
//   item      the desk item that asked for it
// make adds a door of a module endpoint only: a node: endpoint needs its paths, and is written in by an agent.
//
// A SUITE NAMES A SCRATCH LIST in the suite-only value stackFrameList (as it names pluginsMore), read from the desk's
// own first argument, the manifest's values as the node hands them: a suite never writes the tree's list.
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const LIST = (function () {
  let values = {};
  try { values = JSON.parse(process.argv[2] || '{}') || {}; } catch (e) { values = {}; }
  return values.stackFrameList ? path.resolve(String(values.stackFrameList)) : path.join(__dirname, 'stackFrameList.json');
}());
const FILE_RE = /^spirit\/run\/((?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.js)$/;
const GATE_RE = /^(spirit\/run\/(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.js)::([A-Za-z_$][A-Za-z0-9_$]*)$/;
const FORM_MAX = 256;

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
// What is wrong with an endpoint, '' when it is a whole module of spirit/run that is there.
function endpointWhy(endpoint) {
  if (endpoint.length > FORM_MAX) return 'the endpoint is ' + endpoint.length + ' characters, the limit is ' + FORM_MAX;
  if (/::/.test(endpoint)) return 'the endpoint ' + endpoint + ' names a function: an endpoint is a whole module, spirit/run/<file>.js, every function it exports watched';
  if (/^node:/.test(endpoint)) return 'a node: endpoint needs its paths, so an agent writes it into the list; here the endpoint is a module, spirit/run/<file>.js';
  const m = FILE_RE.exec(endpoint);
  if (!m) return 'the endpoint ' + JSON.stringify(endpoint) + ' is not spirit/run/<file>.js';
  if (!fs.existsSync(path.join(RUN, m[1]))) return 'the endpoint\'s file ' + endpoint + ' is not there';
  return '';
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

  // THE DIALOG'S VERB: a gate (file::function) and an endpoint (a whole module) in; the door added to the list and a
  // goal/G22.2-type item out, in its goal. Each form is checked against the tree (the file there, the function in it);
  // the title, made of the short names (peerPost::post, presenceNode), obeys the label rule; a door already in the list
  // or an open item asking the same is refused. Five writes: the item (by the caller), the door into the list with that
  // item, then the item's file list, its box and its code mark (by the desk, as the plugin).
  function make(a, caller) {
    const gate = String(a.gate || '').trim();
    const endpoint = String(a.endpoint || '').trim();
    if (!gate) throw desk.refused('bad-request', 'a gate is needed: spirit/run/<file>.js::<function>, the function every production stack reaching the endpoint passes through');
    if (!endpoint) throw desk.refused('bad-request', 'an endpoint is needed: spirit/run/<file>.js, the whole module the gate stands in front of');
    const gw = gateWhy(gate);
    if (gw) throw desk.refused('bad-request', gw);
    const ew = endpointWhy(endpoint);
    if (ew) throw desk.refused('bad-request', ew);
    if (gate.split('::')[0] === endpoint) throw desk.refused('bad-request', 'the gate is in the endpoint\'s own module: a gate stands in front of it, in another');
    if (readDoors().some(function (d) { return d.gate === gate && d.endpoint === endpoint; })) {
      throw desk.refused('bad-request', 'the list has this door already: ' + gate + ' -> ' + endpoint);
    }
    const title = 'Nobody but ' + shortOf(gate.split('::')[0]) + '::' + gate.split('::')[1] + ' reaches ' + shortOf(endpoint);
    if (desk.fieldWhy('title', title)) throw desk.refused('bad-request', desk.fieldWhy('the item\'s title, ' + JSON.stringify(title), title));
    const args = { goal: goal, title: title };
    desk.writeAs('item.add', args, caller, function (s) {
      const g = s.goals[goal];
      const same = (g ? g.members : []).filter(function (id) { const m = s.items[id]; return m && !m.done && !m.closed && m.title === title; })[0];
      if (same) throw desk.refused('bad-request', same + ' asks this already: ' + title);
      args.minted = desk.nextItemId(s, goal);
    });
    const id = args.minted;
    // THE DOOR, with no suites: an empty run fails in the stack-frame test, which is its red until an agent measures
    // the suites that drive it.
    const list = readDoors();
    list.push({ gate: gate, endpoint: endpoint, suites: [], item: id });
    writeDoors(list);
    desk.write('item.files.add', { id: id, paths: [ITEMS_TEST] });
    desk.write('box.write', { id: id, version: 0, text: 'every production stack reaching ' + endpoint + ' passes through ' + gate + '.\n' +
      '- Gate: ' + gate + ', one function. Endpoint: ' + endpoint + ', the whole module: every function it exports, and what an exported factory returns.\n' +
      '- The door is in the plugin\'s list, stackFrameList.json, with no suites yet: ' + RERUN_TEST + ' fails it as an empty run until an agent measures the suites that drive it and writes them in.\n' +
      '- ' + ITEMS_TEST + ' reads the list: its test for this item asserts the door is there, gated by one file::function.\n' +
      '- ' + RERUN_TEST + ' holds its verdict, and ' + rerun + ' reruns it.\n' +
      '- Made by the stackFrameChecks plugin from its dialog (goal/G22.3).' });
    // A goal/G22.2 item is a code item: its red is the entry in the test file, its build the row.
    const last = desk.write('press', { id: id, what: 'code' });
    return { id: id, change: last.change };
  }

  return {
    refuses: refuses,
    handles: handles,
    verbs: {
      'stackFrameChecks.make': { request: { gate: '', endpoint: '' }, reply: { id: '', change: 0 }, handler: make },
      // THE LIST READ BACK, for its UI: every door as the list holds it (paths on a node: endpoint).
      'stackFrameChecks.doors': { request: {}, reply: { doors: [{ gate: '', endpoint: '', suites: [''], item: '' }] }, handler: function () {
        return { doors: readDoors().map(function (d) {
          const out = { gate: String(d.gate || ''), endpoint: String(d.endpoint || ''),
            suites: Array.isArray(d.suites) ? d.suites.map(String) : [], item: String(d.item || '') };
          if (Array.isArray(d.paths)) out.paths = d.paths.map(String);
          return out;
        }) };
      } },
    },
  };
};
