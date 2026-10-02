'use strict';

// goal/G2.6: the agents' own retry — no Desk change. Red on today's tree.
//   Both agents (goal/G2.2 note 3): "target is busy" is the relay refusing a second post to a node while one is
//   in flight; nobody at the desk is busy. The node already holds and retries a busy post when asked — peer.post's
//   patienceMs (puppets/G2, Andy's go: "a busy agent gets retried instead of your line coming back undelivered")
//   — so the hand-rolled retry loops around every desk write go, and the word rides from agents.js to the node.
// The contract the builder follows (the shape this red fixes, argued in goal/G2.6 before building):
//   1. hub's peer.post keeps honouring patienceMs: it reaches the scheduler as how.patienceMs (holds today).
//   2. spirit.peerPost forwards how.patienceMs into the peer.post it sends, beside kind.
//   3. agents.js's deskAsk sends every desk write with patience: a number of at least 10 seconds and at most
//      the hub's cap (10 minutes), so a busy post is held by the node and lands, and no caller loops by hand.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const test = require('./testSupport.js');
const hub = require('../run/js/hub').createHub(process.cwd());
const packet = require('../run/js/client/packet.js');
const spirit = require('../run/js/kernel.js');
const agents = require('../run/process/js/agents/agents.js');

const OWED = 'OWED by goal/G2.6: ';
const CONTROL = 'MCowBQYDK2VwAyEAagentsPatienceControlAAAAAAAAAAAAAAAA=';

function fakeRes() { const r = { status: 0, writeHead: function (s) { r.status = s; }, end: function () {} }; return r; }
function bodyOf(obj) { return function () { return Promise.resolve(obj); }; }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

test.startTest('goal/G2.6: the agents\' own retry — patience rides to the node, no Desk change');

// A pretend node: it records every peer.post body and answers each ask by re on the stream.
const posts = [];
const streams = [];
const node = http.createServer(function (req, res) {
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
    posts.push(b);
    const hash = 'H' + posts.length;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, hash: hash }));
    const made = packet.encode('api', { change: posts.length }, { re: hash });
    setTimeout(function () {
      streams.forEach(function (s) { try { s.write('event: packet\ndata: ' + JSON.stringify({ from: CONTROL, text: made.text }) + '\n\n'); } catch (e) { /* gone */ } });
    }, 30);
  });
});

(async function () {
  test.subHeading('1. the node honours patience, as it has since puppets/G2');
  const seen = [];
  const deps = {
    router: { post: function (url, to, text, hints, how) { seen.push(how); return Promise.resolve({ ok: true, status: 200, hash: 'h', text: '' }); } },
    presence: { relaysNaming: function () { return ['https://a.example']; } },
  };
  await hub.handlePost({}, fakeRes(), bodyOf({ to: 'PEERKEYAAA', text: 'held', patienceMs: 5000 }), deps);
  if (seen[0] && seen[0].patienceMs === 5000) test.check('peer.post with patienceMs 5000 reaches the scheduler as how.patienceMs');
  else test.fail(OWED + 'the scheduler was handed ' + JSON.stringify(seen[0]));

  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  const url = 'http://127.0.0.1:' + node.address().port;

  test.subHeading('2. spirit.peerPost forwards how.patienceMs');
  await Promise.race([spirit.peerPost(CONTROL, 'api', { desk: { 'item.get': { id: 'x' } } }, { node: url, patienceMs: 4000, waitMs: 2000 }), sleep(3000)]);
  const direct = posts[posts.length - 1] || {};
  if (direct.verb === 'peer.post' && direct.patienceMs === 4000) test.check('the peer.post it sends carries patienceMs 4000');
  else test.fail(OWED + 'spirit.peerPost posted ' + JSON.stringify(direct));

  test.subHeading('3. every desk write from agents.js goes with patience');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-agentspatience-'));
  const cfg = { root: scratch, node: url, control: CONTROL, self: 'wsl-claude' };
  await Promise.race([agents.deskAsk(cfg, 'chat.add', JSON.stringify({ id: 'goal/G0', text: 'a line' })), sleep(3000)]);
  const write = posts[posts.length - 1] || {};
  const p = Number(write.patienceMs);
  if (write.verb === 'peer.post' && write.to === CONTROL && p >= 10000 && p <= 10 * 60 * 1000) {
    test.check('deskAsk posts with patienceMs ' + p + ': the node holds a busy post, nobody loops by hand');
  } else test.fail(OWED + 'deskAsk posted ' + JSON.stringify({ verb: write.verb, patienceMs: write.patienceMs }) + ' — no patience, so a busy desk comes back as not posted: target is busy');
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
})().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  streams.forEach(function (s) { try { s.end(); } catch (e) { /* gone */ } });
  try { node.close(); } catch (e) { /* closed */ }
  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(0); }, 200);
});
