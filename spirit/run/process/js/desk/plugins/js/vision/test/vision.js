'use strict';

// spirit/run/process/js/desk/plugins/js/vision/test/vision.js
// The tests of process/js/desk/plugins/js/vision/vision.js, and of no other module (spec: ./vision.md; goal/G41.11).
// The plugin is mounted as the desk mounts it (desk.js, MOUNTING THE PLUGINS), on a desk that keeps every write asked
// of it, its goal in design or not as the test says.

const path = require('path');
const RUN = path.resolve(__dirname, '../../../../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'vision.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

const GOAL = 'goal/G27';
const ITEM = 'goal/G27.4';
const ELSEWHERE = 'goal/G3.1';
function desk(goalState, writeThrows) {
  const d = { goal: GOAL, writes: [],
    state: function () { return { goals: goalState === null ? {} : { 'goal/G27': goalState }, items: {} }; },
    write: function (verb, a) { if (writeThrows) throw new Error('the desk refused it'); d.writes.push({ verb: verb, a: a }); return { change: 1 }; },
    // As the desk's own: an item of the goal, or the goal itself (desk.js inGoalOf, by number).
    inGoal: function (id) { return /^goal\/G27(\.|$)/.test(String(id)); },
  };
  return d;
}

test.startTest('vision.js: the Vision plugin');

(function () {
  let plugin = null;
  try { plugin = require(FILE); } catch (e) { test.fail('vision.js threw as it loaded: ' + e.message); }
  ok(typeof plugin === 'function', 'it exports the plugin contract: a function of the desk', 'exports ' + typeof plugin);
  if (typeof plugin !== 'function') return;

  test.subHeading('R3: its goal is put in design at mount, and only when it is not');
  const out = desk({ members: [], design: false });
  const made = plugin(out);
  ok(out.writes.length === 1 && out.writes[0].verb === 'press' && out.writes[0].a.id === GOAL && out.writes[0].a.what === 'start-design',
    'a goal out of design gets press start-design on the goal, once', 'writes ' + short(out.writes));
  const inDesign = desk({ members: [], design: true });
  plugin(inDesign);
  ok(inDesign.writes.length === 0, 'a goal already in design is written nothing', 'writes ' + short(inDesign.writes));
  const none = desk(null);
  let threw = null;
  try { plugin(none); } catch (e) { threw = e; }
  ok(!threw && none.writes.length === 0, 'a goal the state does not hold yet is written nothing, and nothing throws', 'threw ' + short(threw && threw.message));
  const errs = [];
  const realError = console.error;
  console.error = function (s) { errs.push(String(s)); };
  threw = null;
  try { plugin(desk({ members: [], design: false }, true)); } catch (e) { threw = e; } finally { console.error = realError; }
  ok(!threw && errs.some(function (s) { return /vision: its goal could not be put in design: the desk refused it/.test(s); }), 'a refused start-design is said, and the mount still stands', 'threw ' + short(threw && threw.message) + ', said ' + short(errs));

  test.subHeading('it adds no verb');
  ok(made && typeof made.refuses === 'function' && made.verbs && Object.keys(made.verbs).length === 0, 'its mount answers { refuses, verbs: {} }', 'answered ' + short(made && Object.keys(made)));
  if (!made || typeof made.refuses !== 'function') return;
  const r = made.refuses;

  test.subHeading('a call outside its goal is not its business');
  ok(r('press', { id: ELSEWHERE, what: 'done' }, [ELSEWHERE]) === '' && r('claim', { id: ELSEWHERE }, [ELSEWHERE]) === '', 'a press or claim on another goal\'s item passes', 'refused: ' + short(r('press', { id: ELSEWHERE, what: 'done' }, [ELSEWHERE])));
  ok(r('press', { id: ELSEWHERE, what: 'go' }, []) === '', 'a call naming no id passes', 'refused: ' + short(r('press', { id: ELSEWHERE, what: 'go' }, [])));

  test.subHeading('R3: the goal stays in design, and is never closed (its data scope)');
  ['end-design', 'design-complete'].forEach(function (w) {
    ok(/stays in design mode at all times/.test(r('press', { id: GOAL, what: w }, [GOAL])), w + ' on its goal is refused', w + ': ' + short(r('press', { id: GOAL, what: w }, [GOAL])));
  });
  ['close', 'done', 'abandon'].forEach(function (w) {
    ok(/its data scope and always stays open, so .* is refused/.test(r('press', { id: GOAL, what: w }, [GOAL])), w + ' on its goal is refused', w + ': ' + short(r('press', { id: GOAL, what: w }, [GOAL])));
  });
  ok(r('press', { id: GOAL, what: 'start-design' }, [GOAL]) === '', 'start-design on its goal passes', 'refused: ' + short(r('press', { id: GOAL, what: 'start-design' }, [GOAL])));

  test.subHeading('R4, R5: its items take Rename, Close and Delete, no Done, Go or code');
  ['go', 'go-all', 'done', 'code', 'claim-done'].forEach(function (w) {
    ok(/a vision item takes no .*: it offers Rename, Close and Delete/.test(r('press', { id: ITEM, what: w }, [ITEM])), w + ' on its item is refused', w + ': ' + short(r('press', { id: ITEM, what: w }, [ITEM])));
  });
  ok(/never abandoned/.test(r('press', { id: ITEM, what: 'abandon' }, [ITEM])), 'abandon on an item is refused: its goal is never abandoned', 'abandon: ' + short(r('press', { id: ITEM, what: 'abandon' }, [ITEM])));
  ok(/takes no claim/.test(r('claim', { id: ITEM, phase: 'build' }, [ITEM])), 'a claim on its item is refused: it is a conversation, not code', 'claim: ' + short(r('claim', { id: ITEM }, [ITEM])));
  ok(r('press', { id: ITEM, what: 'close' }, [ITEM]) === '' && r('item.rename', { id: ITEM, title: 'x' }, [ITEM]) === '' && r('item.delete', { id: ITEM }, [ITEM]) === '', 'close, rename and delete on its item pass', 'close ' + short(r('press', { id: ITEM, what: 'close' }, [ITEM])));
  ok(r('block', { id: ITEM, blocks: 'goal/G27.5' }, [ITEM, 'goal/G27.5']) === '' && r('box.write', { id: ITEM }, [ITEM]) === '' && r('chat.add', { id: ITEM }, [ITEM]) === '', 'R9: blocking, its box and its chat pass', 'block: ' + short(r('block', { id: ITEM }, [ITEM])));
  ok(/a vision item takes no go/.test(r('press', { id: ITEM, what: 'go' }, [ELSEWHERE, ITEM])), 'a call naming any of its items among others is its business', 'mixed ids: ' + short(r('press', { id: ITEM, what: 'go' }, [ELSEWHERE, ITEM])));
}());

test.reportSuccessFailureCount();
