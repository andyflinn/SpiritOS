'use strict';

// spirit/test/agentNodeRows.js
// AN AGENT'S NODE IS RUN BY labMaster, NOT SPAWNED BY THE AGENT.
//
//   Andy, 2026-09-23: "why does he access node starting through anything
//   but labMaster?"
//
// He was asking about the agents, and nothing said they should: ANDY's
// node has gone through labMaster since update rule 6, while an agent's
// node was spawned directly by a platform start script. So the control
// plane knew about every node on the box except the two that post to
// each other all day.
//
// ── WHY IT IS WORTH A KIND OF ITS OWN ────────────────────────────────
//
// An agent row is a node labMaster RUNS but did not MAKE. Its home is the
// agent's own clone, which existed before the row and outlives it. That
// makes three things true, and this suite holds all three:
//
//   it is never cloned      — the home is given, and must already work
//   it is never swept       — its port sits outside the lab range
//   it is never destroyed   — recycle and delete refuse, as for the work row
//
// And the point that is not about tidiness: an agent stops SPAWNING
// PROCESSES. It asks labMaster over HTTP like anything else, which
// removes the capability rather than granting it — and with it the
// auto-mode exception each agent needed to start its own node, which was
// costing Andy a prompt every time.

const path = require('path');
const test = require('./testSupport.js');
// A HARNESS labMaster, ALWAYS. handleCreate writes the table to disk, so
// requiring the module on its default port would put a test row into
// Andy's own labMaster — which this suite did exactly once, and the row
// (agent-one, 45900) had to be swept out of his table by hand.
process.env.LAB_MASTER_PORT = process.env.LAB_MASTER_PORT || '45420';
const labMaster = require('./labMaster/labMaster.js');

test.startTest('An agent node is a labMaster row, not a spawned process');

// The module exports its decision function so this can be asserted
// without a listening server, a port, or a real clone being started.
const create = labMaster.handleCreate;
const REAL_HOME = path.join(__dirname, "..", "run").split(String.fromCharCode(92)).join("/");

if (typeof create !== 'function') {
  test.fail('labMaster does not expose handleCreate — the suite cannot reach the decision');
  test.reportSuccessFailureCount();
} else {
  test.subHeading('An agent row brings its own home');

  const made = create({ name: 'agent-one', type: 'avatar', kind: 'agent', port: 45900, home: REAL_HOME });
  if (made.status === 201 && made.node && made.node.kind === 'agent' && made.node.home === REAL_HOME) {
    test.check('created against a home that already exists, with no clone made for it');
  } else {
    test.fail('an agent row was refused: ' + JSON.stringify(made));
  }

  test.subHeading('…and it must be a home that actually holds a node');

  const nowhere = create({ name: 'agent-ghost', type: 'avatar', kind: 'agent', port: 45901, home: '/nowhere/spirit/run' });
  if (nowhere.status === 400 && /no js\/server\.js/.test(nowhere.error || '')) {
    test.check('a home with no js/server.js is refused, naming the path');
  } else {
    test.fail('a home that holds nothing was accepted: ' + JSON.stringify(nowhere));
  }

  const homeless = create({ name: 'agent-homeless', type: 'avatar', kind: 'agent', port: 45902 });
  if (homeless.status === 400 && /own home/.test(homeless.error || '')) {
    test.check('and an agent row with no home at all is refused');
  } else {
    test.fail('a homeless agent row was accepted: ' + JSON.stringify(homeless));
  }

  test.subHeading('An agent keeps out of the lab range, so a sweep can never reach it');

  const intruder = create({ name: 'agent-intruder', type: 'avatar', kind: 'agent', port: 65410, home: REAL_HOME });
  if (intruder.status === 400 && /lab range/.test(intruder.error || '')) {
    test.check('65410 is refused — lab ports belong to nodes that may be wiped');
  } else {
    test.fail('an agent took a lab port: ' + JSON.stringify(intruder));
  }

  const work = create({ name: 'agent-work', type: 'avatar', kind: 'agent', port: 65432, home: REAL_HOME });
  if (work.status === 403) {
    test.check('and 65432 is refused — that is Andy\'s own node');
  } else {
    test.fail('an agent row took the work port: ' + JSON.stringify(work));
  }

  test.subHeading('An agent\'s clone is the agent\'s: never recycled, never deleted');

  const row = labMaster.findNode('agent-one');
  const recycled = row ? labMaster.handleRecycle(row) : null;
  const deleted = row ? labMaster.handleDelete(row) : null;
  if (recycled && recycled.status === 403) {
    test.check("recycle refuses — wiping an agent clone is not labMaster to do");
  } else {
    test.fail('an agent clone could be recycled: ' + JSON.stringify(recycled));
  }

  // Deleting is the row, never the clone. The first version refused this
  // too, which was the wrong half of the rule: a test row that leaked into
  // the real table could then never be swept, and one did.
  if (deleted && deleted.status === 200 && deleted.wiped === false && deleted.kept) {
    test.check('delete removes the row and leaves the clone where it is');
  } else {
    test.fail('delete did the wrong thing: ' + JSON.stringify(deleted));
  }

  test.reportSuccessFailureCount();
}
