'use strict';

// spirit/test/appServerStream.js
// goal/G33.4 (box v40, v41, v43): one app server follows another's stream through appServer itself. Andy: "the
// streamListener verb is approved", a common component "built into the appServer module rather than the application
// server itself, ... allowing appServers to be true clients to any other appServer"; "appServer also maintains the data
// set in the server's spirit object"; and "the desk server publishes its changes to the browser with the same function
// that it publishes its changes to the deskClients".
//
// WHAT IS ASSERTED, by outcome:
//   1. A server that follows another (server.follow(key)) is granted the verb on its own node: auth.grant
//      <follower>.streamListener for the sender's key.
//   2. One appServer.publish(row) on the sender reaches the sender node's pages (jobs.update) and the follower's
//      streamListener, every row, in order, the same object.
//   3. Each row the follower hears lands in its spirit.data (appServer.data) through the stream's translator.
//   4. A sender the follower does not follow is refused not-granted, and what it sent lands nowhere.
// Two real app servers, each on a pretend node; the sender's node hands its peer posts to the follower as a relay and
// the follower node's door would. rule/11: through testSupport only; its own folders, pipes and ports; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const packet = require('../run/js/client/packet.js');

const OWED = 'OWED by goal/G33.4 (streamListener): ';
const APP_SERVER = path.join(__dirname, '..', 'run', 'js', 'appServer.js');
const SPIRIT_DATA = path.join(__dirname, '..', 'run', 'shell', 'js', 'spiritData.js');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }

const SENDER_KEY = 'MCowBQYDK2VwAyEAappServerStreamTestSenderAAAAAAAAAAAAAAAAAA=';
const FOLLOWER_KEY = 'MCowBQYDK2VwAyEAappServerStreamTestFollowerAAAAAAAAAAAAAAAA=';
const STRANGER_KEY = 'MCowBQYDK2VwAyEAappServerStreamTestStrangerAAAAAAAAAAAAAAAA=';
const OWNER = { owner: true, key: FOLLOWER_KEY, label: 'owner' };

test.startTest('goal/G33.4: one app server follows another\'s stream through appServer (streamListener)');
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

// THE TWO SERVERS, written into this suite's own folder: a sender whose verb `say` publishes one row, and a follower
// that follows by `follow` and answers what its spirit.data holds by `heard`. Its translator files each row's `said`.
const lit = JSON.stringify;
fs.writeFileSync(path.join(scratch, 'sender.js'), [
  "'use strict';",
  'const appServer = require(' + lit(APP_SERVER) + ');',
  "appServer.serve({ say: { request: { text: '' }, reply: { said: true }, handler: function (a) { appServer.publish({ said: String(a.text) }); return { said: true }; } } },",
  "  { streamTo: { family: 'follower', recipients: function () { return [" + lit(FOLLOWER_KEY) + "]; }, waitMs: 4000 } });",
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
  "  follow: { request: { key: '' }, reply: { granted: true }, handler: function (a) { return server.follow(a.key).then(function (g) { return { granted: g === true }; }); } },",
  "  heard: { request: {}, reply: { data: {}, rows: [] }, handler: function () { return { data: appServer.data.branch('heard') || {}, rows: rows.slice() }; } },",
  "}, { stream: { module: 'process/js/sender', translator: " + lit(path.join(scratch, 'translator.js')) + ', onRow: function (row) { rows.push(row); } } });',
].join('\n'));

// A PRETEND NODE: an event stream, the family interfaces (testSupport.nodeApi), and the rest handed to `other`.
function pretendNode(other) {
  const streams = [];
  const server = http.createServer(function (req, res) {
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
      const na = test.nodeApi(b);
      if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; }
      const out = other(b, streams);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(out || { ok: true }));
    });
  });
  return { server: server, streams: streams };
}
// THE FOLLOWER'S FAMILY, as the follower node's apiDoor would answer api {family: 'follower'}.
const FOLLOWER_FAMILY = { family: 'follower', interface: 'module.exports = { verbs: { follow: { key: \'key\' }, heard: {}, streamListener: { json: \'text\' } } };' };
// THE SENDER'S NODE: its pages' updates written down; its peer posts to the follower go in at the follower as the sender.
const toPages = [];
const senderNode = pretendNode(function (b, streams) {
  if (b.verb === 'jobs.update') { if (b.app) toPages.push(b.app); return { ok: true }; }
  if (b.verb !== 'peer.post' || b.to !== FOLLOWER_KEY) return { ok: false };
  const hash = 'H' + Date.now() + Math.random();
  let ask = null;
  try { ask = packet.decode(b.text); } catch (e) { ask = null; }
  const body = ask && ask.body;
  const answer = body && body.api && body.api.family === 'follower' ? Promise.resolve({ status: 200, body: FOLLOWER_FAMILY })
    : client.ask(body && typeof body === 'object' ? body : {}, { key: SENDER_KEY, label: 'sender' });
  answer.then(function (r) {
    const made = packet.encode('api', r && r.body, { re: hash });
    streams.forEach(function (s) { try { s.write('event: packet\ndata: ' + JSON.stringify({ from: FOLLOWER_KEY, text: made.text }) + '\n\n'); } catch (e) { /* gone */ } });
  }, function () { /* the sender waits it out */ });
  return { ok: true, hash: hash };
});
// THE FOLLOWER'S NODE: the grants it is asked for, written down.
const grants = [];
const followerNode = pretendNode(function (b) {
  if (b.verb === 'auth.grant') { grants.push({ key: b.key, path: b.path }); return { ok: true }; }
  return { ok: true };
});

async function up(app) {
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    try { const r = await client.ask('api'); if (r.body && r.body[app] && r.body[app].ok !== false) return true; } catch (e) { /* not yet */ }
  }
  return false;
}
function start(name, nodeUrl, key) {
  kids.push(spawn(process.execPath, [path.join(scratch, name + '.js'), '{}', '--pipe', pipeOf(name), '--node', JSON.stringify({ name: name, publicKey: key })], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: name + '-job', SPIRIT_CALLBACK_URL: nodeUrl + '/' }),
  }));
  return up(name);
}
const heard = function () { return call('follower', 'heard', {}, OWNER).then(function (r) { return (r && r.body) || {}; }); };

async function main() {
  await new Promise(function (r) { senderNode.server.listen(0, '127.0.0.1', r); });
  await new Promise(function (r) { followerNode.server.listen(0, '127.0.0.1', r); });
  if (!await start('sender', 'http://127.0.0.1:' + senderNode.server.address().port, SENDER_KEY)) { test.fail('the world: the sender did not start'); return; }
  if (!await start('follower', 'http://127.0.0.1:' + followerNode.server.address().port, FOLLOWER_KEY)) { test.fail('the world: the follower did not start'); return; }

  test.subHeading('1. following grants the sender the verb on the follower\'s node');
  const f = await call('follower', 'follow', { key: SENDER_KEY }, OWNER);
  if (f.status === 200 && grants.some(function (g) { return g.key === SENDER_KEY && g.path === 'follower.streamListener'; })) test.check('follow(key) asked the node auth.grant follower.streamListener for the sender\'s key');
  else test.fail(OWED + 'follow answered ' + short(f.body) + '; the node was asked ' + short(grants));

  test.subHeading('2. one publish reaches the sender\'s pages and the follower, every row, in order');
  for (const text of ['one', 'two', 'three']) await call('sender', 'say', { text: text }, { owner: true, key: SENDER_KEY, label: 'owner' });
  let got = {};
  for (let i = 0; i < 40; i++) { await sleep(150); got = await heard(); if ((got.rows || []).length >= 3) break; }
  const pages = toPages.filter(function (o) { return o && o.said; });
  const rows = got.rows || [];
  if (rows.map(function (r) { return r.said; }).join() === 'one,two,three' && pages.map(function (r) { return r.said; }).join() === 'one,two,three' && JSON.stringify(rows) === JSON.stringify(pages)) test.check('each row went once to the pages and once to the follower, the same objects, in order');
  else test.fail(OWED + 'the follower heard ' + short(rows) + '; the pages got ' + short(pages));

  test.subHeading('3. the rows land in the follower\'s spirit.data through the translator');
  const data = got.data || {};
  if (['one', 'two', 'three'].every(function (k) { return data[k] && data[k].said === k; })) test.check('spirit.data holds heard/one, heard/two and heard/three, filed by the translator');
  else test.fail(OWED + 'the follower\'s spirit.data holds ' + short(data));

  test.subHeading('4. a sender it does not follow is refused, and lands nowhere');
  const stranger = await call('follower', 'streamListener', { json: JSON.stringify({ said: 'stranger' }) }, { key: STRANGER_KEY, label: 'stranger' });
  const after = await heard();
  const landed = (after.rows || []).some(function (r) { return r.said === 'stranger'; }) || !!(after.data || {}).stranger;
  if (stranger.status !== 200 && stranger.body && stranger.body.code === 'not-granted' && !landed) test.check('a stranger\'s row is refused not-granted and lands neither in spirit.data nor with the server');
  else test.fail(OWED + 'a stranger\'s row was answered ' + short(stranger.body) + (landed ? ', and it landed' : ''));
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
