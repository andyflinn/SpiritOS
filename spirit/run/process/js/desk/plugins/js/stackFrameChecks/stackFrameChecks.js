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
// The plugin makes the desk items; the agents still write each item's red entry and its row: it edits no test code.
//
// What the desk hands it (process/js/desk/desk.js, MOUNTING THE PLUGINS): its goal's key, the desk's writes (as the
// desk, or as the caller), the field rules and the id minting. What it gives back: refuses, handles and one verb.

const RERUN_TEST = 'spirit/test/oneDoorStacks.js';
const ITEMS_TEST = 'spirit/test/stackFrameTestItems.js';

module.exports = function (desk) {
  const goal = desk.goal;
  // THE RERUN ITEM, under a fixed id: the first item of its goal, made on the first mount, found by its id after.
  const rerun = goal + '.1';
  const st = desk.state();
  if (!st.items[rerun]) {
    desk.write('item.add', { goal: goal, title: 'Rerun the stack-frame test', minted: rerun });
    desk.write('item.files.add', { id: rerun, paths: [RERUN_TEST] });
    desk.write('box.write', { id: rerun, version: 0, text: 'every verify.again on this item reruns ' + RERUN_TEST +
      ', the stack-frame test: one test per row of spirit/test/tools/wirePaths.js BOTTOMS that names a door.\n' +
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

  // THE DIALOG'S VERB: a gate and an endpoint in, a goal/G22.2-type item out, in its goal. Both obey the label rule (they
  // name functions, as the box says), and so does the title made of them; an open item asking the same is refused.
  // Four records: the item (by the caller), then its file list, its box and its code mark (by the desk, as the plugin).
  function make(a, caller) {
    const fr = desk.fieldRules;
    const gate = fr.normalize(String(a.gate || ''));
    const endpoint = fr.normalize(String(a.endpoint || ''));
    if (!gate) throw desk.refused('bad-request', 'a gate is needed: the function every production stack reaching the endpoint passes through');
    if (!endpoint) throw desk.refused('bad-request', 'an endpoint is needed: the function the gate stands in front of');
    if (desk.fieldWhy('gate', gate)) throw desk.refused('bad-request', desk.fieldWhy('gate', gate));
    if (desk.fieldWhy('endpoint', endpoint)) throw desk.refused('bad-request', desk.fieldWhy('endpoint', endpoint));
    if (gate === endpoint) throw desk.refused('bad-request', 'the gate and the endpoint are one function: a gate stands in front of something else');
    const title = 'Nobody but ' + gate + ' reaches ' + endpoint;
    if (desk.fieldWhy('title', title)) throw desk.refused('bad-request', desk.fieldWhy('the item\'s title, ' + JSON.stringify(title), title));
    const args = { goal: goal, title: title };
    desk.writeAs('item.add', args, caller, function (s) {
      const g = s.goals[goal];
      const same = (g ? g.members : []).filter(function (id) { const m = s.items[id]; return m && !m.done && !m.closed && m.title === title; })[0];
      if (same) throw desk.refused('bad-request', same + ' asks this already: ' + title);
      args.minted = desk.nextItemId(s, goal);
    });
    const id = args.minted;
    desk.write('item.files.add', { id: id, paths: [ITEMS_TEST] });
    desk.write('box.write', { id: id, version: 0, text: 'every production stack reaching ' + endpoint + ' passes through ' + gate + '.\n' +
      '- Gate: ' + gate + '. Endpoint: ' + endpoint + '.\n' +
      '- The red: an entry for this item in ' + ITEMS_TEST + ', asserting that spirit/test/tools/wirePaths.js BOTTOMS has the row; red until the row is added.\n' +
      '- The row: in BOTTOMS, its door the gate and its watch the endpoint; ' + RERUN_TEST + ' holds its verdict, and ' + rerun + ' reruns it.\n' +
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
    },
  };
};
