'use strict';

// spirit/run/spirit/test/apiDoor.js
// The tests of spirit/apiDoor.js's gate, answer(servers, ask, caller), and of no other module (spec: ./apiDoor.md).
// A member's ask is handed to answer() as the door hands it, with a stand-in for the servers that records what
// reaches them, so a refusal is the gate's and never a server's.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../..');
const S = require(path.join(RUN, 'spirit', 'spirit.js'));
require(path.join(RUN, 'spirit', 'spirit.js'));
const test = S.requireScript('spirit/test/testReport.js');
const { answer } = S.requireScript('spirit/apiDoor.js');

// The node's tree as a member's api ask would get it unstripped: the desk with a verb of its own. No branch carries an FS
// set since goal/G43.20.
const TREE = { desk: { 'chat.add': {} } };
function servers() {
  const reached = [];
  return { reached: reached, ask: function (ask) { reached.push(ask); return ask === 'api' ? { status: 200, body: TREE } : { status: 200, body: { ok: true } }; } };
}
function member(paths) { return { key: 'KEY-MEMBER', auth: { pathsOf: function () { return paths; } } }; }

// goal/G43.20: no FS set, and FS. names nothing of the owner's.
// Andy: "those owner only FS verbs are no longer needed, because not the api ID spirit.fs or spirit.api.desk ARE the path
// to all those files". DEBUG is the one owner verb of a server; FS. is no prefix the gate knows.
test.run('apiDoor.js names no FS verb', 0.2, function () {
  return !/FS\./.test(fs.readFileSync(path.join(RUN, 'spirit', 'apiDoor.js'), 'utf8').replace(/\/\/.*$/gm, '')) || false;
}, test.limit.quick);
test.run('the same member\'s desk.chat.add reaches the server', 0.2, async function () {
  const s1 = servers();
  const own = await answer(s1, { desk: { 'chat.add': { text: 'hi' } } }, member(['desk']));
  return (own && own.body && own.body.ok === true && s1.reached.length === 1) ? true : false;
}, test.limit.quick);
test.run('a member granted the desk whole is served its tree', 0.2, async function () {
  const s2 = servers();
  const tree = await answer(s2, 'api', member(['desk']));
  const verbs = Object.keys((tree && tree.body && tree.body.desk) || {});
  return (verbs.indexOf('chat.add') !== -1 && !verbs.some(function (v) { return /^FS\./.test(v); })) ? true : false;
}, test.limit.quick);

// goal/G41.30: the star was the owner's alone; goal/G47.4, box v33: 😏 (contact.faceable) "does what own did".
// Andy: "so this button will put the star on relays and puppets. AND take it away."; a faceable relay opens the owner's face
// (spirit/faceHome.js), so no grant can give it to a peer.
const STAR_TREE = { contact: { faceable: {}, get: {} } };
const starServers = function () { const reached = []; return { reached: reached, ask: function (ask) { reached.push(ask); return ask === 'api' ? { status: 200, body: STAR_TREE } : { status: 200, body: { ok: true } }; } }; };
async function refusedOwnerOnly(grants) {
  const sx = starServers();
  const rx = await answer(sx, { contact: { faceable: { key: 'K', faceable: true } } }, member(grants));
  const refused = rx && rx.body && rx.body.ok === false && rx.body.code === 'owner-only' && !sx.reached.length;
  return refused ? true : false;
}
test.run('a member granted contact asking contact.faceable is refused owner-only, and no server is asked', 0.8, function () { return refusedOwnerOnly(['contact']); }, test.limit.quick);
test.run('a member granted contact.faceable asking contact.faceable is refused owner-only, and no server is asked', 0.8, function () { return refusedOwnerOnly(['contact.faceable']); }, test.limit.quick);
test.run('the owner reaches contact.faceable', 0.2, async function () {
  const sOwn = starServers();
  const ownr = await answer(sOwn, { contact: { faceable: { key: 'K', faceable: true } } }, { owner: true });
  return (ownr && ownr.body && ownr.body.ok === true && sOwn.reached.length === 1) ? true : false;
}, test.limit.quick);
test.run('a member granted contact is served its tree without contact.faceable', 0.8, async function () {
  const sTree = starServers();
  const starTree = await answer(sTree, 'api', member(['contact']));
  const cVerbs = Object.keys((starTree && starTree.body && starTree.body.contact) || {});
  return (cVerbs.indexOf('get') !== -1 && cVerbs.indexOf('faceable') === -1) ? true : false;
}, test.limit.quick);

// A REGISTERED SERVER GOES BY ITS NAME (goal/G43.12, the box: "No gate changes for a caller: once a server is registered, the
// door and the grants go by its name."; moved here from ./appServer.js's mount part, goal/G47.1: it judges this gate).
{
  const NAME = 'probe';
  const reached = [];
  const probeServers = { ask: function (a) { reached.push(a); return a === 'api' ? { status: 200, body: { [NAME]: { ping: {} } } } : { status: 200, body: { ok: true } }; } };
  test.run('a member without a grant is refused, and no server is asked', 0.8, async function () {
    const stranger = await answer(probeServers, { [NAME]: { ping: {} } }, member([]));
    return (!!stranger && !!stranger.body && stranger.body.ok === false && reached.length === 0) || false;
  }, test.limit.quick);
  test.run('a member granted <name>.ping reaches it', 0.2, async function () {
    const granted = await answer(probeServers, { [NAME]: { ping: {} } }, member([NAME + '.ping']));
    return (!!granted && granted.status === 200 && reached.length === 1) || false;
  }, test.limit.quick);
}
