'use strict';

// apiAuth/G1.8: the appServer selector, a shell element that picks a server on the owner's api tree. Red on today's code.
//   Andy: "the appServer selector (a subComponent of the api-path selector)", "these all will be shell-elements
//   invisible to the user on the shell surface.", "one item here for each of these 3 selectors", and on its source:
//   "the shell's api tree is a straight copy of the node's owner-api-tree ?", then "yes" to the selector reading
//   jobs.api 'api' itself this cycle. And: "the boot continues. and the failure is logged. and that server will not
//   be part of the apiTree".
// The contract the builder follows, in the icon selector's pattern (iconIndex.js beside createIconSelector):
//   - js/client/apiTreeIndex.js, loaded by both sides (module.exports for node, window.spiritApiTreeIndex for the
//     page, index.html loads it): servers(tree) -> the names of the servers in an 'api' answer, sorted; a branch that
//     is an error ({ok: false, ...}, a server that did not answer) is not a server.
//   - shell.js hands apps api.ui.elements.createAppServerSelector(options), beside createIconSelector: an element
//     whose root carries .value (the chosen server) and fires a bubbling change; it fills itself from the node verb
//     jobs.api with ask 'api', and lists servers(tree).

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by apiAuth/G1.8: ';
const CLIENT = path.join(__dirname, '..', 'run', 'js', 'client');

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
if (/<script src="\/js\/client\/apiTreeIndex\.js"><\/script>/.test(html)) test.check('index.html loads /js/client/apiTreeIndex.js');
else test.fail(OWED + 'index.html does not load /js/client/apiTreeIndex.js');
const shell = fs.readFileSync(path.join(CLIENT, 'shell.js'), 'utf8');
const at = shell.indexOf('function createAppServerSelector');
const handed = /elements:\s*\{[^}]*createAppServerSelector:\s*createAppServerSelector/.test(shell);
let body = '';
if (at !== -1) {
  let depth = 0;
  for (let i = shell.indexOf('{', at); i < shell.length; i++) {
    if (shell[i] === '{') depth++;
    if (shell[i] === '}') { depth--; if (depth === 0) { body = shell.slice(at, i + 1); break; } }
  }
}
if (at !== -1 && handed) test.check('shell.js defines createAppServerSelector and hands it to apps under api.ui.elements');
else test.fail(OWED + 'shell.js: createAppServerSelector defined ' + (at !== -1) + ', handed under ui.elements ' + handed);
if (body && /jobs\.api/.test(body) && /['"]api['"]/.test(body) && /spiritApiTreeIndex\.servers/.test(body) && /\bvalue\b/.test(body) && /change/.test(body)) {
  test.check('it asks jobs.api for \'api\', lists spiritApiTreeIndex.servers, and carries value and a change event');
} else test.fail(OWED + 'createAppServerSelector does not ask jobs.api \'api\', list spiritApiTreeIndex.servers, and carry value with a change event');

test.reportSuccessFailureCount();
