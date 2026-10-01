'use strict';

// apiAuth/G1.6: Grants, the owner's intrinsic shell app for managing who may call which api. Red on today's code.
//   Andy: "before the switch an, intrinsic auth shellApp must be in place so andy may manage has interactive
//   access", "it will be the apiAuth module that provides the necessary loopback interface for the shell app",
//   the dropdowns "api-graph-selector [appServer-dropdown] [verb-dropdown]" and "contactSelector", "an app knows
//   it's requirements, it must provide owners with the bundle-info in an owner-only verb dependencies", "so we
//   defer pruning to be triggered by the owners auth app, who can report deprecated branches", and on its name:
//   "YES to your name" (shell/grants, shown as 'Grants').
// The contract the builder follows:
//   - shell/grants/grants.json: name 'Grants', intrinsic: true (always included, never excluded), owner 'system'.
//   - apiTreeIndex.serves(tree, path): whether a grant's path is on the owner's api tree today: 'app' when that
//     server answered, 'app.verb' when that verb is among its verbs (verbs(), so DEBUG and DEPENDENCIES never
//     are); a server that did not answer serves nothing. It is how the app tells a deprecated grant.
//   - shell/grants/grants.js: picks a contact (api.ui.elements.createContactSelector) and a path
//     (createApiBranchSelector); grants and revokes through jobs.authGrant and jobs.authRevoke; shows a key's grants
//     (jobs.authPeer) and finds them by label (jobs.authSearch); offers a server's bundle, read from its
//     DEPENDENCIES through jobs.api; and marks every grant spiritApiTreeIndex.serves says is gone, for the owner
//     to revoke. Nothing is pruned without his press.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by apiAuth/G1.6: ';
const RUN = path.join(__dirname, '..', 'run');
const APP = path.join(RUN, 'shell', 'grants');

test.startTest('apiAuth/G1.6: Grants, the owner\'s app for who may call which api');

test.subHeading('an intrinsic shell app named Grants');
let manifest = null;
try { manifest = JSON.parse(fs.readFileSync(path.join(APP, 'grants.json'), 'utf8')); } catch (e) { manifest = null; }
if (manifest && manifest.name === 'Grants' && manifest.intrinsic === true && manifest.owner === 'system') {
  test.check('shell/grants/grants.json: Grants, intrinsic, the system\'s');
} else test.fail(OWED + 'shell/grants/grants.json is ' + (manifest ? JSON.stringify(manifest).slice(0, 160) : 'missing'));

test.subHeading('apiTreeIndex.serves tells a live grant from a deprecated one');
let index = null;
try { index = require(path.join(RUN, 'js', 'client', 'apiTreeIndex.js')); } catch (e) { index = null; }
if (!index || typeof index.serves !== 'function') {
  test.fail(OWED + 'js/client/apiTreeIndex.js has no serves(tree, path)');
} else {
  const VERB = { request: {}, reply: { x: '' } };
  const tree = { desk: { 'item.get': VERB, DEBUG: VERB }, grantFace: { ok: false, code: 'app-not-running' } };
  const want = [['desk', true], ['desk.item.get', true], ['desk.DEBUG', false], ['desk.gone', false], ['grantFace', false], ['ghost', false]];
  const wrong = want.filter(function (w) { return index.serves(tree, w[0]) !== w[1]; });
  if (!wrong.length) test.check('desk and desk.item.get are served; desk.DEBUG, a gone verb, a server that did not answer and an unknown app are not');
  else test.fail(OWED + 'serves answered wrongly for ' + wrong.map(function (w) { return w[0]; }).join(', '));
}

test.subHeading('the app does its four jobs through the shell and jobs.auth');
let src = '';
try { src = fs.readFileSync(path.join(APP, 'grants.js'), 'utf8'); } catch (e) { src = ''; }
const parts = {
  'picks a contact': /createContactSelector/,
  'picks a path': /createApiBranchSelector/,
  'grants': /jobs\.authGrant/,
  'revokes': /jobs\.authRevoke/,
  'shows a key\'s grants': /jobs\.authPeer/,
  'finds by label': /jobs\.authSearch/,
  'reads a bundle': /DEPENDENCIES/,
  'marks deprecated grants': /spiritApiTreeIndex\.serves/,
};
const missing = Object.keys(parts).filter(function (k) { return !parts[k].test(src); });
if (src && !missing.length) test.check('grants.js ' + Object.keys(parts).join(', '));
else test.fail(OWED + (src ? 'grants.js does not: ' + missing.join(', ') : 'no shell/grants/grants.js'));

test.reportSuccessFailureCount();
