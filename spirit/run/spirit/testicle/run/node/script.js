'use strict';
// spirit/run/spirit/testicle/run/node/script.js [<script or folder> ...]
// THE RUNNER OF THE RESOURCE node (goal/G49.27, step 3; the box, Andy's Go: "one runner per resource starts it once and runs
// every module needing it, each pulled in by spirit.requireScript"; "a module that changes its node (grants, files, contacts)
// says so (own: true), and gets a node of its own; every other module shares one"). Its contract: ./test/script.md.
//
// The rule modules are found as the none runner finds them (../none/script.js found: every folder of spirit/testicle/general/
// holding script.js, no central list); this one runs those whose resource is 'node'. ONE SCRATCH NODE FOR THE WHOLE RUN (goal/
// G47.1; Andy: "are the tests not ordered in the general test so that all tests requiring a scratch node can use the same
// one?"): started once, before any module runs, as a step of its own (the box: "setup is its own timed step with its own
// limit: a node or Chrome that does not come up is red as that, by name"), and handed to every module that shares it
// (tools.node); the node testicle hands its run (SPIRIT_MOUNT_BASE) is taken in place of one of its own. A module with own:
// true gets an empty holder and starts its own. Handed nothing, every module judges all it applies to; handed scripts, each
// script judged by every module it fits, reported for it.
const SPIRIT = require('../../../script.js');
const NONE = SPIRIT.requireScript('spirit/testicle/run/none/script.js');
const H = SPIRIT.requireScript('spirit/testicle/headLessChrome/script.js');
const REPORTER = SPIRIT.requireScript('spirit/testicle/testReport/script.js');

// The run's one node, booted: { node } holds it, true when it came up. scratch(opts) starts it (scratchNode by default).
async function bootNode(ONE, scratch) {
  ONE.node = await (scratch || H.scratchNode)({ shared: true });
  return !!(ONE.node && ONE.node.up);
}
// Its node let go once, by whoever lets it go first (a module that took it, or this runner at the run's end).
async function letGo(ONE) {
  const n = ONE.node;
  if (!n || n.letGo || typeof n.release !== 'function') return;
  n.letGo = true;
  try { await n.release(); } catch (e) { /* freed when this process ends */ }
}

// main(argv, opts): the run. opts, for its own test: { list, the modules as found() gives them; test, the reporter; scratch,
// what starts the node }; by default the modules found, testReport and scratchNode.
async function main(argv, opts) {
  const o = opts || {};
  const test = o.test || REPORTER;
  const list = o.list || NONE.found();
  const given = NONE.givenOf(argv);
  const ONE = { node: null };
  const tools = { test: test, run: NONE.RUN, spirit: SPIRIT, node: ONE, forbids: NONE.forbidsOf(list) };
  test.hold();
  if (NONE.needed('node', list, given, false)) {
    const up = await NONE.timed(function () { return bootNode(ONE, o.scratch); }, test.limit.slow);
    test.run('the shared scratch node comes up', 0.2, function () { return up || false; }, test.limit.quick);
  }
  await NONE.runModules('node', list, given, tools, 'script');
  // After every module's own cleanup (registered as their checks ran).
  test.after(function () { return letGo(ONE); });
  test.release();
}

module.exports = { main: main, bootNode: bootNode, letGo: letGo };

if (require.main === module) main(process.argv.slice(2));
