'use strict';

// spirit/run/spirit/element/test/nodeInfo-parts.js
// ALL OF INFO IS IN ONE ELEMENT, nodeInfo.js (goal/G43.24, requirement 6, Q2; spec: ./nodeInfo-parts.md). The box: "the page
// layout, the relays ... (relay.status), the card ... (node.card), the rotate button ... They move into one new element,
// spirit/element/nodeInfo.js (Q2)". Andy: "no i want those apps to basically be wrappers for spirit/element/ things....".
// nodeInfo.js read as it is, comments stripped.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'); } catch (e) { return ''; } }

test.startTest('nodeInfo-parts.js: all of Info is in one element, nodeInfo.js (goal/G43.24)');

test.subHeading('the box, 6: "They move into one new element, spirit/element/nodeInfo.js (Q2)"');
const nodeInfo = code(path.join(RUN, 'spirit', 'element', 'nodeInfo.js'));
ok(nodeInfo.length > 0, 'Q2: spirit/element/nodeInfo.js is there', 'no spirit/element/nodeInfo.js');
ok(/\brelay\W{1,4}status\b/.test(nodeInfo), 'nodeInfo asks relay.status, the relays this node holds a seat on', 'nodeInfo.js asks no relay.status');
ok(/\bnode\W{1,4}card\b/.test(nodeInfo), 'nodeInfo puts the card into the node cache (node.card)', 'nodeInfo.js asks no node.card');
ok(/Rotate this node/.test(nodeInfo), 'nodeInfo draws the rotate button', 'nodeInfo.js draws no rotate button');

test.reportSuccessFailureCount();
process.exit(0);
