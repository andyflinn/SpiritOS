'use strict';

// spirit/run/spirit/peer/door/test/script.js
// The tests of spirit/peer/door/script.js's gate, answer(servers, ask, caller), and of no other module (spec: ./script.md).
// A member's ask is handed to answer() as the door hands it, with a stand-in for the servers that records what
// reaches them, so a refusal is the gate's and never a server's.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const S = require(path.join(RUN, 'spirit', 'script.js'));
require(path.join(RUN, 'spirit', 'script.js'));
const test = S.requireScript('spirit/test/testReport.js');
const { answer } = S.requireScript('spirit/peer/door/script.js');

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
// to all those files". FS. is no prefix the gate knows (and since goal/G49.25 no verb is hard-coded the owner's).
test.run('spirit/peer/door/script.js names no FS verb', 0.2, function () {
  return !/FS\./.test(fs.readFileSync(path.join(RUN, 'spirit', 'peer', 'door', 'script.js'), 'utf8').replace(/\/\/.*$/gm, '')) || false;
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

// goal/G49.25: 😏 (spirit.contact.faceable) is no longer hard-coded the owner's; a grant decides it as any verb (Andy: "the
// only thing i'd hard-code protect from is ownership change, and the node has no verbs for that", "they go now"). Granted, by
// the branch or the exact verb, it reaches the server; not granted, it is refused not-granted and no server is asked.
// goal/G49.22: the branch is spirit.contact (was contact).
const STAR_TREE = { 'spirit.contact': { faceable: {}, get: {} } };
const starServers = function () { const reached = []; return { reached: reached, ask: function (ask) { reached.push(ask); return ask === 'api' ? { status: 200, body: STAR_TREE } : { status: 200, body: { ok: true } }; } }; };
const FACEABLE_ASK = { 'spirit.contact': { faceable: { key: 'K', faceable: true } } };
async function servedFaceable(grants) {
  const sx = starServers();
  const rx = await answer(sx, FACEABLE_ASK, member(grants));
  const served = rx && rx.body && rx.body.ok === true && sx.reached.length === 1 && sx.reached[0] === FACEABLE_ASK;
  return served ? true : false;
}
test.run('a member granted spirit.contact asking spirit.contact.faceable reaches the server', 0.8, function () { return servedFaceable(['spirit.contact']); }, test.limit.quick);
test.run('a member granted spirit.contact.faceable asking spirit.contact.faceable reaches the server', 0.8, function () { return servedFaceable(['spirit.contact.faceable']); }, test.limit.quick);
test.run('a member granted spirit.contact.get only asking spirit.contact.faceable is refused not-granted, and no server is asked', 0.8, async function () {
  const sx = starServers();
  const rx = await answer(sx, FACEABLE_ASK, member(['spirit.contact.get']));
  return (rx && rx.status === 403 && rx.body && rx.body.ok === false && rx.body.code === 'not-granted' && !sx.reached.length) ? true : false;
}, test.limit.quick);
test.run('the owner reaches spirit.contact.faceable', 0.2, async function () {
  const sOwn = starServers();
  const ownr = await answer(sOwn, { 'spirit.contact': { faceable: { key: 'K', faceable: true } } }, { owner: true });
  return (ownr && ownr.body && ownr.body.ok === true && sOwn.reached.length === 1) ? true : false;
}, test.limit.quick);
// goal/G49.25: the tree a member is served holds faceable when its grant does, and not when it does not.
test.run('a member granted spirit.contact is served its tree with spirit.contact.faceable', 0.8, async function () {
  const sTree = starServers();
  const starTree = await answer(sTree, 'api', member(['spirit.contact']));
  const cVerbs = Object.keys((starTree && starTree.body && starTree.body['spirit.contact']) || {});
  return (cVerbs.indexOf('get') !== -1 && cVerbs.indexOf('faceable') !== -1) ? true : false;
}, test.limit.quick);
test.run('a member granted spirit.contact.get only is served its tree without spirit.contact.faceable', 0.8, async function () {
  const sTree = starServers();
  const starTree = await answer(sTree, 'api', member(['spirit.contact.get']));
  const cVerbs = Object.keys((starTree && starTree.body && starTree.body['spirit.contact']) || {});
  return (cVerbs.length === 1 && cVerbs[0] === 'get') ? true : false;
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
