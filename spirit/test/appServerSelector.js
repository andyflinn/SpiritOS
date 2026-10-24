'use strict';

// apiAuth/G1.8: the appServer selector, a shell element that picks a server on the owner's api tree. Red on today's code.
//   Andy: "the appServer selector (a subComponent of the api-path selector)", "these all will be shell-elements
//   invisible to the user on the shell surface.", "one item here for each of these 3 selectors", and on its source:
//   "the shell's api tree is a straight copy of the node's owner-api-tree ?", then "yes" to the selector reading
//   the owner's api tree itself this cycle (since goal/G30.6 the verb api on the flat apiDoor). And: "the boot continues. and the failure is logged. and that server will not
//   be part of the apiTree".
// The contract the builder follows, in the icon selector's pattern (iconIndex.js beside createIconSelector):
//   - js/client/apiTreeIndex.js, loaded by both sides (module.exports for node, window.spirit.apiTreeIndex for the
//     page, index.html loads it): servers(tree) -> the names of the servers in an 'api' answer, sorted; a branch that
//     is an error ({ok: false, ...}, a server that did not answer) is not a server.
//   - shell.js hands apps api.ui.elements.createAppServerSelector(options), beside createIconSelector: an element
//     whose root carries .value (the chosen server) and fires a bubbling change; it fills itself from the verb api
//     (spirit.core.ask('api'), goal/G30.6), and lists servers(tree).

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by apiAuth/G1.8: ';
const CLIENT = path.join(__dirname, '..', 'run', 'spirit', 'client');

test.startTest('apiAuth/G1.8: the appServer selector lists the servers on the owner\'s api tree');

test.subHeading('apiTreeIndex.servers reads the tree');
let index = null;
try { index = require(path.join(CLIENT, 'apiTreeIndex.js')); } catch (e) { index = null; }
if (!index || typeof index.servers !== 'function') {
  test.fail(OWED + 'no js/client/apiTreeIndex.js with servers(tree)');
} else {
  const VERB = { request: {}, reply: { x: '' } };
  const tree = {
    desk: { 'item.get': VERB, DEBUG: VERB },
    backup: { 'status.get': VERB, DEBUG: VERB },
    grantFace: { ok: false, code: 'app-not-running', error: 'not running' },
  };
  const got = index.servers(tree);
  if (JSON.stringify(got) === JSON.stringify(['backup', 'desk'])) test.check('servers(tree) is [backup, desk]: sorted, and grantFace, which did not answer, is not a server');
  else test.fail(OWED + 'servers(tree) answered ' + JSON.stringify(got));
  if (JSON.stringify(index.servers({})) === '[]' && JSON.stringify(index.servers(null)) === '[]') test.check('no tree, no servers');
  else test.fail(OWED + 'servers of an empty or missing tree answered ' + JSON.stringify([index.servers({}), index.servers(null)]));
}

test.subHeading('the page loads it, and the shell hands apps the element');
const html = fs.readFileSync(path.join(__dirname, '..', 'run', 'index.html'), 'utf8');
if (/<script src="\/spirit\/client\/apiTreeIndex\.js"><\/script>/.test(html)) test.check('index.html loads /spirit/client/apiTreeIndex.js');
else test.fail(OWED + 'index.html does not load /spirit/client/apiTreeIndex.js');
const shell = fs.readFileSync(path.join(CLIENT, 'shell.js'), 'utf8');
// The factories moved to shell/js/, one file per element (goal/G2.12, G2.14); the shell hands them out from there, unchanged.
const elements = fs.readFileSync(path.join(CLIENT, '..', '..', 'shell', 'js', 'appServerSelector.js'), 'utf8');
const at = elements.indexOf('function createAppServerSelector');
const handed = /elements:\s*\{[^}]*createAppServerSelector:\s*shellElements\.createAppServerSelector/.test(shell);
let body = '';
if (at !== -1) {
  let depth = 0;
  for (let i = elements.indexOf('{', at); i < elements.length; i++) {
    if (elements[i] === '{') depth++;
    if (elements[i] === '}') { depth--; if (depth === 0) { body = elements.slice(at, i + 1); break; } }
  }
}
if (at !== -1 && handed) test.check('shell/js/appServerSelector.js defines createAppServerSelector and shell.js hands it to apps under api.ui.elements');
else test.fail(OWED + 'appServerSelector.js: createAppServerSelector defined ' + (at !== -1) + ', handed under ui.elements ' + handed);
if (body && /\.tree\(\)/.test(body) && /spirit\.apiTreeIndex\.servers/.test(body) && /\bvalue\b/.test(body) && /change/.test(body)) {
  test.check('it asks the verb api (the flat apiDoor), lists spirit.apiTreeIndex.servers, and carries value and a change event');
} else test.fail(OWED + 'createAppServerSelector does not ask the verb api, list spirit.apiTreeIndex.servers, and carry value with a change event');

test.reportSuccessFailureCount();
