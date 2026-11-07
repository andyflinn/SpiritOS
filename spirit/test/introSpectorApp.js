'use strict';

// spirit/test/introSpectorApp.js
// goal/G30.5, "I want an intrinsic app: introSpector".
// The item's box (v14), in short:
//   - An intrinsic shell app, introSpector, icon ICON.GLASSES: a party dropdown (self by default, peers and relays),
//     a family dropdown and a verb dropdown; pane 1 an input form for the chosen verb with a call button; pane 2 a
//     CodeMirror pane with the reply.
//   - Picking a party sends api to it. Self: the api query belongs to the apiDoor; /api/spirit dispatches through the
//     flat apiDoor, never through jobs. A peer node: the same ask over peerPost, cut to its grants. A relay: the same
//     api query, answered for ALL members, not just the owner, in the node api's shape, cut to the caller's verbs.
//   - No families back: the dropdowns hide and the input pane says no verbs available.
//   - The form is built from the verb's request as the api answer carries it, one field per key, typed by the
//     prototype's value. Call sends through the apiDoor for self, by peerPost for a peer or a relay.
//   - The dropdowns are the existing selectors, fed with the chosen party's tree; search results cached in a
//     probability bucket (shellCreateListSearch's, which every dropdown is built on).
//   - The flat apiDoor gets its own front: /api/spirit dispatches every verb through it and it answers api itself.
//     FS on the relay stays owner only.
// NAMED HERE where the box names none:
//   - The front is door(apps).handlerFor(verb), beside door.ask: a node family verb runs its own handler as before;
//     'api' answers the flat table; 'family.verb' (the family is the part before the first dot) goes to door.ask as
//     {family: {verb: args}}, args the body without verb. server.js /api/spirit uses nodeDoor.handlerFor.
//   - The relay answers the body 'api' (a string, as a node gets it) with { relay: { <verb>: { description,
//     request, reply } } }: the owner every relay verb and the FS verbs, a member the five member verbs.
//   - A peer node is asked with peerPost('api', key, 'api'), a relay with peerPost('relay', key, 'api'); a call goes
//     as {family: {verb: args}} to a node, {verb: args} to a relay.
//   - The app keeps its form logic in two top-level functions, isFieldsOf(request) -> [{key, type, value}] and
//     isArgsOf(fields, texts) -> args, so the typing is checked without a page.
//   - appServerSelector takes options.tree, a function answering a promise of the tree it lists.
// rule/11: through testSupport only; its own scratch folders.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Readable } = require('stream');
const test = require('./testSupport.js');
const world = require('./world');

const OWED = 'OWED by goal/G30.5: ';
const RUN = path.join(__dirname, '..', 'run');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }
const code = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'); } catch (e) { return ''; } };

// A request as the loopback door gets one, and a response that keeps what was written.
function fakeReq(body) {
  const rq = Readable.from([Buffer.from(JSON.stringify(body))]);
  rq.headers = { 'content-type': 'application/json' };
  rq.method = 'POST';
  rq.url = '/api/spirit';
  return rq;
}
function fakeRes() {
  const rs = { status: 0, text: '', headersSent: false, writableEnded: false };
  rs.writeHead = function (s) { rs.status = s; rs.headersSent = true; return rs; };
  rs.setHeader = function () {};
  rs.write = function (c) { rs.text += String(c); return true; };
  rs.end = function (c) { if (c) rs.text += String(c); rs.writableEnded = true; if (rs.done) rs.done(); };
  rs.finished = new Promise(function (r) { rs.done = r; });
  return rs;
}
function run(handler, body) {
  const rs = fakeRes();
  try { handler(fakeReq(body), rs); } catch (e) { return Promise.resolve({ threw: e.message }); }
  return Promise.race([rs.finished, new Promise(function (r) { setTimeout(r, 2000); })]).then(function () {
    let parsed = null;
    try { parsed = JSON.parse(rs.text); } catch (e) { parsed = rs.text; }
    return { status: rs.status, body: parsed };
  });
}

(async function () {
  test.startTest('goal/G30.5: the introSpector app, the apiDoor front, and the relay api for every member');

  test.subHeading('1. the flat apiDoor has its own front');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'g305-'));
  const table = require('../run/spirit/verbTable').createVerbTable();
  table.mount('xfs', dir, {
    stat: { request: { path: '' }, reply: { size: 0 }, handler: function (rq, rs) { rs.writeHead(200, { 'Content-Type': 'application/json' }); rs.end(JSON.stringify({ size: 7 })); } },
  }, { wire: false, by: 'test' });
  const asked = [];
  const fakeApps = {
    apps: function () { return ['desk']; },
    ask: function (body) {
      asked.push(body);
      if (body === 'api') return Promise.resolve({ status: 200, body: { desk: { items: { request: { q: '' }, reply: {} } } } });
      if (body && body.nope) return Promise.resolve({ status: 404, body: { ok: false, code: 'app-not-served' } });
      return Promise.resolve({ status: 200, body: { from: 'apps', asked: body } });
    },
  };
  const door = table.door(fakeApps);
  const front = typeof door.handlerFor === 'function' ? door.handlerFor : null;
  if (front) test.check('the door has a front: door.handlerFor(verb)');
  else test.fail(OWED + 'the door has no handlerFor; /api/spirit cannot reach it');
  const apiAns = front && front('api') ? await run(front('api'), { verb: 'api' }) : null;
  if (apiAns && apiAns.status === 200 && apiAns.body && apiAns.body.xfs && apiAns.body.desk) test.check('POST {verb: api} answers the flat table itself: the node\'s families (xfs) beside the apps\' (desk)');
  else test.fail(OWED + '{verb: api} answered ' + short(apiAns));
  const dotted = front && front('desk.item.get') ? await run(front('desk.item.get'), { verb: 'desk.item.get', id: 'g' }) : null;
  const sentDotted = asked.filter(function (b) { return b && b.desk && b.desk['item.get']; })[0];
  if (dotted && dotted.status === 200 && sentDotted && sentDotted.desk['item.get'].id === 'g') test.check('the family is the part before the first dot: desk.item.get goes to desk as item.get');
  else test.fail(OWED + 'desk.item.get answered ' + short(dotted) + ', asked ' + short(sentDotted));
  const nodeAns = front && front('xfs.stat') ? await run(front('xfs.stat'), { verb: 'xfs.stat', path: 'a' }) : null;
  if (nodeAns && nodeAns.status === 200 && nodeAns.body && nodeAns.body.size === 7) test.check('a node family verb (xfs.stat) still runs its own handler through the front');
  else test.fail(OWED + 'xfs.stat answered ' + short(nodeAns));
  // A family that is neither the node's nor a served app's is no verb: the loopback door answers it no such verb, as
  // it answered any unclaimed verb (serverSurface, everyVerb).
  const none = front ? front('nope.x') : 'no front';
  if (none === null) test.check('a family nobody serves has no handler, so the door answers it no such verb');
  else test.fail(OWED + 'nope.x has a handler: ' + short(typeof none));
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* busy */ }
  const server = code('spirit/server.js');
  if (/nodeDoor\.handlerFor\(verb\)/.test(server) && !/loopbackVerbs\.handlerFor\(verb\)/.test(server)) test.check('server.js: /api/spirit dispatches through nodeDoor.handlerFor, not the verb table alone');
  else test.fail(OWED + 'server.js /api/spirit does not dispatch through the flat apiDoor');

  test.subHeading('2. the relay answers api for every member');
  const L = world.build({ title: 'A relay with an owner and two members', owner: 'andy', peers: [{ name: 'ann', label: 'ann' }, { name: 'bob', label: 'bob' }] });
  if (!L.ok) { test.fail('the world: ' + L.error); test.reportSuccessFailureCount(); process.exit(0); }
  const ask = function (who, body) { return (world.ask(L.box, who, body) || {}).answer || {}; };
  const MEMBER = ['card', 'face', 'removePeer', 'rename', 'search'];
  const OWNER_ONLY = ['config', 'debug', 'invite', 'monitor', 'relayLabel', 'revoke'];
  const annApi = ask(L.peer('ann'), 'api');
  const annVerbs = annApi && annApi.relay ? Object.keys(annApi.relay).sort() : null;
  if (annVerbs && JSON.stringify(annVerbs) === JSON.stringify(MEMBER.slice().sort())) test.check('a member\'s api lists exactly the five member verbs, under relay');
  else test.fail(OWED + 'a member asking api answered ' + short(annApi));
  const shaped = annApi && annApi.relay && MEMBER.every(function (v) {
    const e = annApi.relay[v];
    return e && typeof e.description === 'string' && e.request && typeof e.request === 'object' && e.reply && typeof e.reply === 'object';
  });
  if (shaped && annApi.relay.search.request.q === '') test.check('each entry has the node api\'s shape: description, request and reply, read from js/relaySelf/ (search asks {q: \'\'})');
  else test.fail(OWED + 'the member api entries are ' + short(annApi && annApi.relay));
  const ownerApi = ask(L.owner, 'api');
  const ownerVerbs = ownerApi && ownerApi.relay ? Object.keys(ownerApi.relay) : [];
  if (MEMBER.concat(OWNER_ONLY).every(function (v) { return ownerVerbs.indexOf(v) !== -1; }) && ownerVerbs.some(function (v) { return v.indexOf('FS.') === 0; }))
    test.check('the owner\'s api lists every relay verb and the FS verbs');
  else test.fail(OWED + 'the owner asking api answered ' + short(ownerVerbs));
  const bobFs = ask(L.peer('bob'), { 'FS.search': { q: '' } });
  if (bobFs.ok === false && bobFs.status === 404) test.check('FS on the relay stays owner only: a member\'s FS.search is refused as before');
  else test.fail(OWED + 'a member asking FS.search answered ' + short(bobFs));

  test.subHeading('3. the app');
  if (/INTRINSIC_APP_FOLDERS\s*=\s*\[[^\]]*'introSpector'/.test(code('spirit/client/shell.js'))) test.check('introSpector is on INTRINSIC_APP_FOLDERS');
  else test.fail(OWED + 'introSpector is not on INTRINSIC_APP_FOLDERS');
  if (/options\.tree/.test(code('spirit/element/search/api.js'))) test.check('appServerSelector takes options.tree, so it lists the chosen party\'s tree');
  else test.fail(OWED + 'appServerSelector reads only this node\'s tree');

  test.reportSuccessFailureCount();
  process.exit(0);
}()).catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
