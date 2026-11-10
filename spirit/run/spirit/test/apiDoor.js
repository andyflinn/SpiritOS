'use strict';

// spirit/run/spirit/test/apiDoor.js
// The tests of spirit/apiDoor.js's gate, answer(servers, ask, caller), and of no other module (spec: ./apiDoor.md).
// A member's ask is handed to answer() as the door hands it, with a stand-in for the servers that records what
// reaches them, so a refusal is the gate's and never a server's.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../..');
require(path.join(RUN, 'spirit', 'spirit.js'));
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { answer } = require(path.join(RUN, 'spirit', 'apiDoor.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

// The node's tree as a member's api ask would get it unstripped: the desk with a verb of its own. No branch carries an FS
// set since goal/G43.20.
const TREE = { desk: { 'chat.add': {} } };
function servers() {
  const reached = [];
  return { reached: reached, ask: function (ask) { reached.push(ask); return ask === 'api' ? { status: 200, body: TREE } : { status: 200, body: { ok: true } }; } };
}
function member(paths) { return { key: 'KEY-MEMBER', auth: { pathsOf: function () { return paths; } } }; }

test.startTest('apiDoor.js: the gate');

(async function () {
  test.subHeading('goal/G43.20: no FS set, and FS. names nothing of the owner\'s');
  // Andy: "those owner only FS verbs are no longer needed, because not the api ID spirit.fs or spirit.api.desk ARE the path
  // to all those files". DEBUG is the one owner verb of a server; FS. is no prefix the gate knows.
  ok(!/FS\./.test(fs.readFileSync(path.join(RUN, 'spirit', 'apiDoor.js'), 'utf8').replace(/\/\/.*$/gm, '')), 'apiDoor.js names no FS verb', 'apiDoor.js still names FS.');
  const s1 = servers();
  const own = await answer(s1, { desk: { 'chat.add': { text: 'hi' } } }, member(['desk']));
  ok(own && own.body && own.body.ok === true && s1.reached.length === 1, 'the same member\'s desk.chat.add reaches the server', 'chat.add: ' + short(own));
  const s2 = servers();
  const tree = await answer(s2, 'api', member(['desk']));
  const verbs = Object.keys((tree && tree.body && tree.body.desk) || {});
  ok(verbs.indexOf('chat.add') !== -1 && !verbs.some(function (v) { return /^FS\./.test(v); }),
    'a member granted the desk whole is served its tree', 'its tree: ' + short(tree && tree.body));

  test.subHeading('goal/G41.30: the star is the owner\'s alone');
  // Andy: "so this button will put the star on relays and puppets. AND take it away."; the star opens the owner's face
  // (spirit/faceHome.js), so no grant can give it to a peer.
  const STAR_TREE = { contact: { own: {}, get: {} } };
  const starServers = function () { const reached = []; return { reached: reached, ask: function (ask) { reached.push(ask); return ask === 'api' ? { status: 200, body: STAR_TREE } : { status: 200, body: { ok: true } }; } }; };
  for (const grants of [['contact'], ['contact.own']]) {
    const sx = starServers();
    const rx = await answer(sx, { contact: { own: { key: 'K', own: true } } }, member(grants));
    ok(rx && rx.body && rx.body.ok === false && rx.body.code === 'owner-only' && !sx.reached.length,
      'a member granted ' + grants.join(', ') + ' asking contact.own is refused owner-only, and no server is asked',
      'a member granted ' + grants.join(', ') + ' asking contact.own: ' + short(rx) + ', servers asked ' + sx.reached.length);
  }
  const sOwn = starServers();
  const ownr = await answer(sOwn, { contact: { own: { key: 'K', own: true } } }, { owner: true });
  ok(ownr && ownr.body && ownr.body.ok === true && sOwn.reached.length === 1, 'the owner reaches contact.own', 'the owner asking contact.own: ' + short(ownr));
  const sTree = starServers();
  const starTree = await answer(sTree, 'api', member(['contact']));
  const cVerbs = Object.keys((starTree && starTree.body && starTree.body.contact) || {});
  ok(cVerbs.indexOf('get') !== -1 && cVerbs.indexOf('own') === -1, 'a member granted contact is served its tree without contact.own', 'its tree: ' + short(starTree && starTree.body));
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
