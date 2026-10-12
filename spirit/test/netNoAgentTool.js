'use strict';

// spirit/test/netNoAgentTool.js
// goal/G19.9: net.fetch is no tool for agents. Red on today's tree (1d20c70b); claude-windows wrote it and builds it (one
// agent). Andy, 2026-10-12: "node fetch should NOT be allowed to agents. i saw that one coming when we used it for
// testing the hello-world for tool-calls. a test should assedt that that verb never has a fetch.json in its folder.",
// and at the review pass: "correct, except that is asserted by a test/suite ensuring a js/net/fetch.json is not allowed
// to exists. we won't need production code for that, if an end user hacks inside of run/js/* that's not our problem."
// The verb itself stays the node's; what makes it a tool is its description, and that is what may never exist.
//
// WHAT IS ASSERTED
//   1. spirit/run/js/net/fetch.json does not exist.
//   2. spirit/run/js/net/AGENTS.md, the namespace described to agents, does not exist either: with no verb to describe
//      it would only mislead.
//   3. no agent's tool namespaces name net (every TOOL_NAMESPACES under spirit/run/process).
//   4. the verb net.fetch is still the node's own (js/server.js claims it).
// rule/11: reads files only.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G19.9: ';
const RUN = path.join(__dirname, '..', 'run');
const NET = path.join(RUN, 'js', 'net');

test.startTest('goal/G19.9: net.fetch is never described to an agent');

test.subHeading('1. no fetch.json');
if (!fs.existsSync(path.join(NET, 'fetch.json'))) test.check('spirit/run/js/net/fetch.json does not exist');
else test.fail(OWED + 'spirit/run/js/net/fetch.json exists, so net.fetch can be handed to an agent as a tool');

test.subHeading('2. no namespace description for agents');
if (!fs.existsSync(path.join(NET, 'AGENTS.md'))) test.check('spirit/run/js/net/AGENTS.md does not exist');
else test.fail(OWED + 'spirit/run/js/net/AGENTS.md still describes net to agents');

test.subHeading('3. no agent lists net');
const listing = [];
(function walk(dir) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  entries.forEach(function (e) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    if (!/\.js$/.test(e.name)) return;
    const m = /TOOL_NAMESPACES\s*=\s*\[([^\]]*)\]/.exec(fs.readFileSync(p, 'utf8'));
    if (m && /['"]net['"]/.test(m[1])) listing.push(path.relative(RUN, p));
  });
}(path.join(RUN, 'process')));
if (!listing.length) test.check('no TOOL_NAMESPACES under spirit/run/process names net');
else test.fail(OWED + 'net is a tool namespace in ' + listing.join(', '));

test.subHeading('4. the verb stays the node\'s');
if (/'net\.fetch'\s*:/.test(fs.readFileSync(path.join(RUN, 'js', 'server.js'), 'utf8'))) test.check('js/server.js still claims net.fetch for the node');
else test.fail('net.fetch is no longer claimed by js/server.js; the ruling keeps the verb');

test.reportSuccessFailureCount();
