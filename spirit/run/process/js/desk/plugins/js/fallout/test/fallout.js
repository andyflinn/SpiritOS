'use strict';

// spirit/run/process/js/desk/plugins/js/fallout/test/fallout.js
// The tests of process/js/desk/plugins/js/fallout/fallout.js, and of no other module (spec: ./fallout.md; goal/G41.11).
// The plugin is mounted as the desk mounts it (desk.js, MOUNTING THE PLUGINS), on a desk that keeps every write asked
// of it.

const path = require('path');
const RUN = path.resolve(__dirname, '../../../../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'fallout.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

function desk() {
  const d = { goal: 'goal/G12', writes: [], published: [],
    state: function () { return { goals: { 'goal/G12': { members: [], design: false } }, items: {} }; },
    write: function (verb, a) { d.writes.push({ verb: verb, a: a }); return { change: 1 }; },
    writeAs: function (verb, a) { d.writes.push({ verb: verb, a: a }); return { change: 1 }; },
    publish: function (x) { d.published.push(x); },
    inGoal: function (id) { return /^goal\/G12(\.|$)/.test(String(id)); },
  };
  return d;
}

test.startTest('fallout.js: the Fallout plugin, in its reduced scope');

(function () {
  let plugin = null;
  try { plugin = require(FILE); } catch (e) { test.fail('fallout.js threw as it loaded: ' + e.message); }
  ok(typeof plugin === 'function', 'it exports the plugin contract: a function of the desk', 'exports ' + typeof plugin);
  if (typeof plugin !== 'function') return;

  test.subHeading('it adds no verb to the desk (goal/G29.5)');
  const d = desk();
  const made = plugin(d);
  ok(made && typeof made === 'object' && made.verbs && typeof made.verbs === 'object' && Object.keys(made.verbs).length === 0, 'its mount answers { verbs: {} }', 'answered ' + short(made));
  ['fallout.reds', 'fallout.summary', 'fallout.history'].forEach(function (v) {
    ok(!(made.verbs && v in made.verbs), 'the deleted wrapper ' + v + ' is gone', v + ' is still served');
  });

  test.subHeading('it governs nothing and writes nothing');
  ok(made.refuses === undefined && made.handles === undefined, 'it gives the desk no refuses and no handles: every call passes', 'gave ' + short(Object.keys(made)));
  ok(d.writes.length === 0 && d.published.length === 0, 'mounting it writes nothing to the desk and publishes nothing', 'writes ' + short(d.writes) + ', published ' + short(d.published));
  let threw = null;
  let bare = null;
  try { bare = plugin(); } catch (e) { threw = e; }
  ok(!threw && bare && Object.keys(bare.verbs || {}).length === 0, 'it reads nothing of the desk: mounted with none it answers the same', 'threw ' + short(threw && threw.message));
  ok(bare !== made, 'each mount answers its own object', 'two mounts shared one answer');
}());

test.reportSuccessFailureCount();
