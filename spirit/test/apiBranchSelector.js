'use strict';

// apiAuth/G1.9: the api-branch selector.
//   Andy: "api-graph-selector [appServer-dropdown] [verb-dropdown] the verb-dropdown selection chances
//   automatically depending on the selection in the appServer-dropdown", "the api-branch selector, which
//   depends on the appServer-selector". Settled in the box: "the verb dropdown will have an option
//   ( ** all verbs **)": choosing it is the app-level grant, the path is the app alone.
// What it checks:
//   - spirit/run/spirit/client/apiTreeIndex.js verbs(tree, server): the verb names of that server in an 'api'
//     answer, sorted; a server the tree does not hold, or one whose branch is an error, has no verbs. The
//     code leaves out DEBUG only (API_TREE_OWNER_VERBS); this file still expects DEPENDENCIES left out too.
//   - shell.js hands apps api.ui.elements.createApiBranchSelector(options) from spirit/element/apiBranchSelector.js.
//     That file is gone: it was renamed apiFamilySelector.js (goal/G41.14) and folded into
//     spirit/run/spirit/element/search/api.js (goal/G43.18), and search/test/apiFamily.js asserts the old name is
//     not there. This half throws ENOENT.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by apiAuth/G1.9: ';
const CLIENT = path.join(__dirname, '..', 'run', 'spirit', 'client');

test.startTest('apiAuth/G1.9: the api-branch selector picks a path, app or app.verb, never an owner verb');

test.subHeading('apiTreeIndex.verbs lists one server\'s verbs, the owner\'s two never among them');
let index = null;
try { index = require(path.join(CLIENT, 'apiTreeIndex.js')); } catch (e) { index = null; }
if (!index || typeof index.verbs !== 'function') {
  test.fail(OWED + 'spirit/client/apiTreeIndex.js has no verbs(tree, server)');
} else {
  const VERB = { request: {}, reply: { x: '' } };
  const tree = {
    desk: { 'items.search': VERB, 'item.get': VERB, 'chat.add': VERB, AGENTS: VERB, DEBUG: VERB, DEPENDENCIES: VERB },
    grantFace: { ok: false, code: 'app-not-running', error: 'not running' },
  };
  const got = index.verbs(tree, 'desk');
  if (JSON.stringify(got) === JSON.stringify(['AGENTS', 'chat.add', 'item.get', 'items.search'])) {
    test.check('verbs(tree, desk) is sorted and holds AGENTS (a verb like any other) but never DEBUG or DEPENDENCIES');
  } else test.fail(OWED + 'verbs(tree, desk) answered ' + JSON.stringify(got));
  const none = [index.verbs(tree, 'grantFace'), index.verbs(tree, 'nosuch'), index.verbs(null, 'desk')];
  if (JSON.stringify(none) === '[[],[],[]]') test.check('an error branch, an unknown server and no tree have no verbs');
  else test.fail(OWED + 'the empty cases answered ' + JSON.stringify(none));
}

test.subHeading('the shell hands apps the element, the appServer selector inside it');
const shell = fs.readFileSync(path.join(CLIENT, 'shell.js'), 'utf8');
// The old element file at spirit/run/spirit/element/apiBranchSelector.js, which no longer exists (see the header).
const elements = fs.readFileSync(path.join(CLIENT, '..', '..', 'spirit', 'element', 'apiBranchSelector.js'), 'utf8');
const at = elements.indexOf('function createApiBranchSelector');
const handed = /elements:\s*\{[^}]*createApiBranchSelector:\s*shellElements\.createApiBranchSelector/.test(shell.replace(/\n/g, ' '));
let body = '';
if (at !== -1) {
  let depth = 0;
  for (let i = elements.indexOf('{', at); i < elements.length; i++) {
    if (elements[i] === '{') depth++;
    if (elements[i] === '}') { depth--; if (depth === 0) { body = elements.slice(at, i + 1); break; } }
  }
}
if (at !== -1 && handed) test.check('spirit/element/apiBranchSelector.js defines createApiBranchSelector and shell.js hands it to apps under api.ui.elements');
else test.fail(OWED + 'apiBranchSelector.js: createApiBranchSelector defined ' + (at !== -1) + ', handed under ui.elements ' + handed);
if (body && /createAppServerSelector/.test(body) && /spirit\.apiTreeIndex\.verbs/.test(body) && /all verbs/.test(body) &&
    /\bvalue\b/.test(body) && /change/.test(body)) {
  test.check('it holds the appServer selector, fills its verbs from spirit.apiTreeIndex.verbs, offers all verbs, and carries value with a change event');
} else test.fail(OWED + 'createApiBranchSelector misses its parts: appServer selector ' + /createAppServerSelector/.test(body)
  + ', index verbs ' + /spirit\.apiTreeIndex\.verbs/.test(body) + ', all verbs ' + /all verbs/.test(body)
  + ', value ' + /\bvalue\b/.test(body) + ', change ' + /change/.test(body));

test.reportSuccessFailureCount();
