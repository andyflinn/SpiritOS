'use strict';

// spirit/test/appServerStream.js
// goal/G33.4 (box v40, v41, v43) and goal/G33.8 (box v8): js/appServer.js gives every server both halves of a stream.
// Andy: "spirit/appServer.js should provide both, a client (streamListener) interface and a server (streamPublisher)
// interface", "Subscribe and unsubscribe are verbs of the streamPublisher in js/appServer.js, approved and granted.", "No
// subscriber list is kept beyond the grants: the server always broadcasts each publish by peerPost to its subscribers,
// restart or not, and stops sending to a client that has disappeared (unreachable) until that client subscribes again."
//
// WHAT IS ASSERTED, by outcome, between two real app servers on pretend nodes:
//   1. A follower subscribes (server.subscribe(key, family)): the publisher takes it from the caller's key, the follower's
//      node grants the publisher its streamListener, and the publisher's bootstrap rows reach it first.
//   2. One publish reaches the publisher node's pages and the subscriber, every row, in order, the same object.
//   3. Each row lands in the follower's spirit.data through the stream's translator.
//   4. A sender the follower does not follow is refused not-granted, and what it sent lands nowhere.
//   5. A row naming keys in `to` reaches those subscribers alone.
//   6. A subscriber that does not answer is skipped until it subscribes again.
//   7. unsubscribe stops the rows.
//   8. After the publisher restarts, its subscribers are the keys its node grants it to: a publish reaches the follower
//      without the follower subscribing again.
// rule/11: through testSupport only; its own folders, pipes and ports; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/spirit/appClient.js');
const packet = require('../run/spirit/client/packet.js');

const OWED = 'OWED by goal/G33.8 (stream): ';
const APP_SERVER = path.join(__dirname, '..', 'run', 'spirit', 'appServer.js');
const SPIRIT_DATA = path.join(__dirname, '..', 'run', 'shell', 'js', 'spiritData.js');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }

const SENDER_KEY = 'MCowBQYDK2VwAyEAappServerStreamTestSenderAAAAAAAAAAAAAAAAAA=';
const FOLLOWER_KEY = 'MCowBQYDK2VwAyEAappServerStreamTestFollowerAAAAAAAAAAAAAAAA=';
const STRANGER_KEY = 'MCowBQYDK2VwAyEAappServerStreamTestStrangerAAAAAAAAAAAAAAAA=';
const OWNER = { owner: true, key: FOLLOWER_KEY, label: 'owner' };
const SENDER_OWNER = { owner: true, key: SENDER_KEY, label: 'owner' };

test.startTest('goal/G33.8: appServer gives every server both halves of a stream, subscribe and listen');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-appserverstream-'));
const win = process.platform === 'win32';
const pipeOf = function (name) { return win ? appClient.pipePathFor(scratch, name, 'win32', 'process') : path.join(scratch, name + '.sock'); };
const client = appClient.createAppClient({ rootDir: scratch });
client.register('sender', pipeOf('sender'));
client.register('follower', pipeOf('follower'));
const kids = [];
const call = function (app, verb, args, caller) {
  const q = {}; q[verb] = args;
  const b = {}; b[app] = q;
  return client.ask(b, caller).then(function (r) { return r || {}; }, function (e) { return { status: 0, error: e.message }; });
};

// THE TWO SERVERS, written into this suite's own folder: a sender that publishes each row `say` names (to whom, if it
// names keys), its bootstrap one row; and a follower that subscribes by `sub` and answers what its spirit.data holds.
const lit = JSON.stringify;
fs.writeFileSync(path.join(scratch, 'sender.js'), [
  "'use strict';",
  'const appServer = require(' + lit(APP_SERVER) + ');',
  "appServer.serve({ say: { request: { text: '', to: [''] }, reply: { said: true }, handler: function (a) { const row = { said: String(a.text) }; if (Array.isArray(a.to) && a.to.length) row.to = a.to; appServer.publish(row); return { said: true }; } } },",
  "  { publisher: { family: 'follower', bootstrap: function () { return [{ said: 'boot' }]; }, waitMs: 3000 } });",
].join('\n'));
fs.writeFileSync(path.join(scratch, 'translator.js'), [
  '(function (root) {',
  '  var D = (root.spirit || {}).data;',
  "  D.translate({ onJob: function (job) { if (job && job.module === 'process/js/sender' && job.app && job.app.said) D.set('heard/' + job.app.said, job.app); } });",
  '}(globalThis));',
].join('\n'));
fs.writeFileSync(path.join(scratch, 'follower.js'), [
  "'use strict';",
  'require(' + lit(SPIRIT_DATA) + ');',
  'const appServer = require(' + lit(APP_SERVER) + ');',
  'const rows = [];',
  'const server = appServer.serve({',
  "  sub: { request: { key: '' }, reply: { subscribed: true }, handler: function (a) { return server.subscribe(a.key, 'sender').then(function (g) { return { subscribed: g === true }; }); } },",
  "  heard: { request: {}, reply: { data: {}, rows: [] }, handler: function () { return { data: appServer.data.branch('heard') || {}, rows: rows.slice() }; } },",
  "}, { stream: { module: 'process/js/sender', translator: " + lit(path.join(scratch, 'translator.js')) + ', onRow: function (row) { rows.push(row); } } });',
].join('\n'));

// THE FAMILIES, as each far node's apiDoor would answer api {family}.
const FAMILY = {
  follower: { family: 'follower', interface: "module.exports = { verbs: { sub: { key: 'key' }, heard: {}, streamListener: { json: 'text' } } };" },
  sender: { family: 'sender', interface: "module.exports = { verbs: { say: { text: 'text', to: 'list?' }, subscribe: { family: 'id' }, unsubscribe: {} } };" },
};
// A PRETEND NODE: its pages' updates, its grants (auth.search, auth.grant), and its peer posts carried to the other
// node's server as the key the post came from. `drop` makes it lose the next deliveries it carries.
function pretendNode(self, peerApp, peerKey, grants) {
  const streams = [];
  const node = { pages: [], granted: [], drop: 0, streams: streams };
  node.server = http.createServer(function (req, res) {
    if (req.method === 'GET' && req.url === '/api/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write(': open\n\n');
      streams.push(res);
      return;
    }
    let raw = '';
    req.on('data', function (c) { raw += c; });
    req.on('end', function () {
      let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
      const send = function (o) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
      { const na = test.nodeApi(b); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } }
      if (b.verb === 'jobs.update') { if (b.app) node.pages.push(b.app); send({ ok: true }); return; }
      if (b.verb === 'auth.grant') { node.granted.push({ key: b.key, path: b.path }); send({ ok: true }); return; }
      // As apiAuth.js answers it (goal/G29.7): items {key, label}, the label {name, key, path} as JSON.
      if (b.verb === 'auth.search') { send({ items: grants().map(function (g) { return { key: g.key + '\n' + g.path, label: JSON.stringify({ name: '', key: g.key, path: g.path }) }; }), more: false }); return; }
      if (b.verb !== 'peer.post' || b.to !== peerKey) { send({ ok: false }); return; }
      const hash = 'H' + Date.now() + Math.random();
      let ask = null;
      try { ask = packet.decode(b.text); } catch (e) { ask = null; }
      const body = ask && ask.body;
      send({ ok: true, hash: hash });
      if (node.drop > 0 && body && body[peerApp] && body[peerApp].streamListener) { node.drop -= 1; return; }
      const fam = body && body.api && body.api.family;
      const answer = fam ? Promise.resolve({ status: 200, body: FAMILY[fam] || { ok: false } }) : client.ask(body && typeof body === 'object' ? body : {}, { key: self, label: self === SENDER_KEY ? 'sender' : 'follower' });
      answer.then(function (r) {
        const made = packet.encode('api', r && r.body, { re: hash });
        streams.forEach(function (s) { try { s.write('event: packet\ndata: ' + JSON.stringify({ from: peerKey, text: made.text }) + '\n\n'); } catch (e) { /* gone */ } });
      }, function () { /* waited out */ });
    });
  });
  return node;
}
let senderGrants = [];
const senderNode = pretendNode(SENDER_KEY, 'follower', FOLLOWER_KEY, function () { return senderGrants; });
const followerNode = pretendNode(FOLLOWER_KEY, 'sender', SENDER_KEY, function () { return []; });

async function up(app) {
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    try { const r = await client.ask('api'); if (r.body && r.body[app] && r.body[app].ok !== false) return true; } catch (e) { /* not yet */ }
  }
  return false;
}
function start(name, node, key) {
  const kid = spawn(process.execPath, [path.join(scratch, name + '.js'), '{}', '--pipe', pipeOf(name), '--node', JSON.stringify({ name: name, publicKey: key })], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: name + '-job', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.server.address().port + '/' }),
  });
  kids.push(kid);
  return up(name).then(function (ok) { return ok ? kid : null; });
}
function stop(kid) { return new Promise(function (r) { if (!kid || kid.exitCode !== null) return r(); kid.once('exit', r); kid.kill(); setTimeout(r, 4000); }); }
const heard = function () { return call('follower', 'heard', {}, OWNER).then(function (r) { return (r && r.body) || {}; }); };
const said = function (text, to) { return call('sender', 'say', { text: text, to: to || [] }, SENDER_OWNER); };
async function heardOf(text, ms) {
  for (let i = 0; i < Math.ceil((ms || 4000) / 150); i++) { const h = await heard(); if ((h.rows || []).some(function (r) { return r.said === text; })) return true; await sleep(150); }
  return false;
}

async function main() {
  await new Promise(function (r) { senderNode.server.listen(0, '127.0.0.1', r); });
  await new Promise(function (r) { followerNode.server.listen(0, '127.0.0.1', r); });
  let senderKid = await start('sender', senderNode, SENDER_KEY);
  if (!senderKid) { test.fail('the world: the sender did not start'); return; }
  if (!await start('follower', followerNode, FOLLOWER_KEY)) { test.fail('the world: the follower did not start'); return; }

  test.subHeading('1. the follower subscribes; its node grants the publisher; the bootstrap comes first');
  const sub = await call('follower', 'sub', { key: SENDER_KEY }, OWNER);
  const booted = await heardOf('boot');
  const granted = followerNode.granted.some(function (g) { return g.key === SENDER_KEY && g.path === 'follower.streamListener'; });
  if (sub.status === 200 && sub.body.subscribed === true && granted && booted) test.check('subscribe answered subscribed, the follower\'s node granted the sender its streamListener, and the bootstrap row arrived');
  else test.fail(OWED + 'sub answered ' + short(sub.body) + '; granted ' + granted + '; bootstrap heard ' + booted);

  test.subHeading('2. one publish reaches the pages and the subscriber, every row, in order');
  for (const text of ['one', 'two', 'three']) await said(text);
  await heardOf('three');
  const rows = ((await heard()).rows || []).filter(function (r) { return ['one', 'two', 'three'].indexOf(r.said) !== -1; });
  const pages = senderNode.pages.filter(function (o) { return o && ['one', 'two', 'three'].indexOf(o.said) !== -1; });
  if (rows.map(function (r) { return r.said; }).join() === 'one,two,three' && JSON.stringify(rows) === JSON.stringify(pages)) test.check('each row went once to the pages and once to the subscriber, the same objects, in order');
  else test.fail(OWED + 'the subscriber heard ' + short(rows) + '; the pages got ' + short(pages));

  test.subHeading('3. the rows land in the follower\'s spirit.data through the translator');
  const data = (await heard()).data || {};
  if (['boot', 'one', 'two', 'three'].every(function (k) { return data[k] && data[k].said === k; })) test.check('spirit.data holds heard/boot, heard/one, heard/two and heard/three, filed by the translator');
  else test.fail(OWED + 'the follower\'s spirit.data holds ' + short(data));

  test.subHeading('4. a sender it does not follow is refused, and lands nowhere');
  const stranger = await call('follower', 'streamListener', { json: JSON.stringify({ said: 'stranger' }) }, { key: STRANGER_KEY, label: 'stranger' });
  const after = await heard();
  const landed = (after.rows || []).some(function (r) { return r.said === 'stranger'; }) || !!(after.data || {}).stranger;
  if (stranger.status !== 200 && stranger.body && stranger.body.code === 'not-granted' && !landed) test.check('a stranger\'s row is refused not-granted and lands neither in spirit.data nor with the server');
  else test.fail(OWED + 'a stranger\'s row was answered ' + short(stranger.body) + (landed ? ', and it landed' : ''));

  test.subHeading('5. a row naming keys reaches those subscribers alone');
  await said('for a stranger', [STRANGER_KEY]);
  await said('for the follower', [FOLLOWER_KEY]);
  const toFollower = await heardOf('for the follower');
  const toStranger = ((await heard()).rows || []).some(function (r) { return r.said === 'for a stranger'; });
  if (toFollower && !toStranger) test.check('a row to another key did not reach the follower; one to its key did');
  else test.fail(OWED + 'the row to the follower arrived ' + toFollower + ', the row to a stranger arrived ' + toStranger);

  test.subHeading('6. a subscriber that does not answer is skipped until it subscribes again');
  senderNode.drop = 1;
  await said('lost');
  await sleep(4000);
  await said('while away');
  const whileAway = await heardOf('while away', 2000);
  await call('follower', 'sub', { key: SENDER_KEY }, OWNER);
  await said('back again');
  const back = await heardOf('back again');
  if (!whileAway && back) test.check('after one delivery went unanswered nothing reached it, and after it subscribed again the next row did');
  else test.fail(OWED + 'while away it heard ' + whileAway + '; after subscribing again ' + back);

  test.subHeading('7. unsubscribe stops the rows');
  const unsub = await call('sender', 'unsubscribe', {}, { key: FOLLOWER_KEY, label: 'follower' });
  await said('after unsubscribe');
  const afterUnsub = await heardOf('after unsubscribe', 2000);
  if (unsub.status === 200 && !afterUnsub) test.check('unsubscribe answered ' + short(unsub.body) + ', and the next row did not reach it');
  else test.fail(OWED + 'unsubscribe answered ' + short(unsub.body) + '; the next row reached it ' + afterUnsub);

  test.subHeading('8. after a restart the publisher\'s subscribers are its grants');
  senderGrants = [{ key: FOLLOWER_KEY, label: 'follower', path: 'sender' }];
  await stop(senderKid);
  senderKid = await start('sender', senderNode, SENDER_KEY);
  if (!senderKid) { test.fail('the world: the sender did not start again'); return; }
  await sleep(1500);
  await said('after the restart');
  const restored = await heardOf('after the restart');
  if (restored) test.check('with the follower\'s key holding a grant to the sender, the restarted sender\'s publish reached it, unasked');
  else test.fail(OWED + 'after the restart the follower heard ' + short(((await heard()).rows || []).slice(-3)));
}

main().catch(function (e) { test.fail(OWED + 'the suite itself tripped: ' + (e && e.stack || e)); }).then(function () {
  kids.forEach(function (k) { try { if (k.exitCode === null) k.kill(); } catch (e) { /* gone */ } });
  [senderNode, followerNode].forEach(function (n) {
    n.streams.forEach(function (s) { try { s.end(); } catch (e) { /* gone */ } });
    try { n.server.close(); } catch (e) { /* closed */ }
  });
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
