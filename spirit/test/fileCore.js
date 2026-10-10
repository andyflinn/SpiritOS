'use strict';

// fileTransfer goal/G1.3: what the node and appServer must offer before a fileServer can run. Red on today's tree.
//   Andy: "let's make an item with the core modification needed. other items will depend on that".
//   The no-rush scheme, G1.2: "agreed. scheme approved.", "same for responses.", "got it. so i agree on the same
//   no-rush marker riding next the the fileServer replyPost".
//   spirit.peerPost, G1.3: "should be done via the spirit object, no?"; transport's R12 is not the way: "don't like it: in a
//   file download between peer, the peer streams a request to the replier, and awaits a peerReply-by-post with
//   correct hash, your implying changes to the relay as well."
//   Runtime verbs: no republished announce, "nah, files added or dropped are implicitly know to the user."
//   And over all of it: "keep in mind. no adding unwanted junk without permission."
// The contract the builder follows (the shapes this red fixes are argued in goal/G1.3 before building):
//   A. peer.post takes an optional kind. 'background' reaches the scheduler as how.kind; without it nothing
//      changes; any other value is refused before anything is posted.
//   B. A verb declared with background: true has its answers marked: appServer's route answers kind 'background'
//      beside status and body, the pipe carries it (X-Spirit-Kind), appClient hands it back, and the door posts
//      that answer with how {kind: 'background'} as post's fourth argument. Nothing new travels between peers.
//   C. createAppServer's server gains addVerb(name, {request, reply, handler}) and dropVerb(name). addVerb runs
//      the whole start-up check and refuses a name it already has; the api answer shows the change at once;
//      dropVerb removes only a verb added at runtime, never a fixed one, DEBUG or DEPENDENCIES.
//   D. kernel.js's spirit object carries peerPost(peer, app, body, how): one post through the node's peer.post,
//      then the answer-post whose re matches that post's hash, read off the node's event stream, resolves with
//      its body. A refused post resolves {ok: false, code: 'not-posted'} at once; no answer within how.waitMs
//      (default 30 s) resolves {ok: false, code: 'no-answer'}. how.node names the node, else the origin of
//      SPIRIT_CALLBACK_URL; how.kind rides to peer.post.
//   E. agents.js asks through spirit.peerPost: its own copy of the post-and-wait knot is gone.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const test = require('./testSupport.js');

const RUN = path.join(__dirname, '..', 'run');
const OWED = 'OWED by fileTransfer goal/G1.3: ';
const appServer = require('../run/js/appServer.js');
const appClient = require('../run/js/appClient.js');
const apiDoor = require('../run/js/apiDoor.js');
const hub = require('../run/js/hub').createHub(process.cwd());
const packet = require('../run/js/client/packet.js');
const arrivals = require('../run/js/arrivals.js');
const spirit = require('../run/js/kernel.js');

function fakeRes() {
  const res = { status: 0, body: '', writeHead: function (s) { res.status = s; }, end: function (b) { res.body = b || ''; } };
  return res;
}
function bodyOf(obj) { return function () { return Promise.resolve(obj); }; }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

test.startTest('fileTransfer goal/G1.3: the core a fileServer stands on');

async function partA() {
  test.subHeading('A. peer.post takes the no-rush word');
  const seen = [];
  const deps = {
    router: { post: function (url, to, text, hints, how) { seen.push(how); return Promise.resolve({ ok: true, status: 200, hash: 'h', text: '' }); } },
    presence: { relaysNaming: function () { return ['https://a.example']; } },
  };
  await hub.handlePost({}, fakeRes(), bodyOf({ to: 'PEERKEYAAA', text: 'plain' }), deps);
  await hub.handlePost({}, fakeRes(), bodyOf({ to: 'PEERKEYAAA', text: 'slow', kind: 'background' }), deps);
  const odd = fakeRes();
  await hub.handlePost({}, odd, bodyOf({ to: 'PEERKEYAAA', text: 'odd', kind: 'urgent' }), deps);
  const plainKind = seen[0] && seen[0].kind;
  if (seen.length >= 2 && !plainKind && seen[1] && seen[1].kind === 'background') test.check('kind background reaches the scheduler; a post without it is as before');
  else test.fail(OWED + 'the scheduler was handed ' + JSON.stringify(seen));
  if (seen.length === 2 && odd.status >= 400) test.check('a kind other than background is refused, and nothing is posted');
  else test.fail(OWED + 'kind urgent answered ' + odd.status + ' after ' + seen.length + ' posts');
}

async function partB() {
  test.subHeading('B. a server marks its answers background, and the door posts them so');
  const verbs = {
    slow: { request: {}, reply: { done: true }, background: true, handler: function () { return { done: true }; } },
    fast: { request: {}, reply: { done: true }, handler: function () { return { done: true }; } },
  };
  let s = null;
  try { s = appServer.createAppServer(verbs); } catch (e) { s = null; }
  if (!s) { test.fail(OWED + 'createAppServer refuses a verb declared background: true'); }
  else {
    const slow = await s.route({ slow: {} });
    const fast = await s.route({ fast: {} });
    if (slow && slow.kind === 'background' && fast && !fast.kind) test.check('route answers kind background for a background verb, nothing for the rest');
    else test.fail(OWED + 'route answered ' + JSON.stringify([slow && slow.kind, fast && fast.kind]));

    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-filecore-'));
    const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'kinds', 'win32', 'process') : path.join(scratch, 'kinds.sock');
    await new Promise(function (r) { s.listen(pipe, r); });
    const client = appClient.createAppClient({ rootDir: scratch });
    client.register('kinds', pipe);
    const viaPipe = await client.ask({ kinds: { slow: {} } }).catch(function () { return null; });
    s.close();
    if (viaPipe && viaPipe.kind === 'background') test.check('the pipe carries the mark: appClient hands back kind background');
    else test.fail(OWED + 'appClient handed back ' + JSON.stringify(viaPipe && { status: viaPipe.status, kind: viaPipe.kind }));
  }

  const posted = [];
  const door = apiDoor.createApiDoor({
    servers: { ask: function () { return Promise.resolve({ status: 200, body: { ok: true }, kind: 'background' }); } },
    post: function (relay, key, text, how) { posted.push(how); return Promise.resolve(); },
    encode: packet.encode,
    isKnown: function () { return true; },
    auth: { pathsOf: function () { return ['files']; } },
  });
  const ask = packet.encode('api', { files: { info: {} } });
  await door({ text: ask.text, envelope: arrivals.envelopeOf(ask.text), fromKey: 'PEERKEYAAA', relay: 'https://a.example', hash: 'H0' });
  await sleep(50);
  if (posted.length === 1 && posted[0] && posted[0].kind === 'background') test.check('the door posts a background answer with how {kind: background}');
  else test.fail(OWED + 'the door posted with ' + JSON.stringify(posted));
}

async function partC() {
  test.subHeading('C. a running appServer adds and drops verbs');
  const s = appServer.createAppServer({ fixed: { request: {}, reply: { done: true }, handler: function () { return { done: true }; } } });
  if (typeof s.addVerb !== 'function' || typeof s.dropVerb !== 'function') {
    test.fail(OWED + 'the server createAppServer returns has no addVerb and dropVerb');
    return;
  }
  const NAME = 'verb-' + 'A'.repeat(43);
  let added = null;
  try { added = s.addVerb(NAME, { request: { command: '', data: '' }, reply: { command: '', data: '' }, handler: function (a) { return { command: a.command, data: '' }; } }); } catch (e) { added = e; }
  const api = (await s.route('api')).body || {};
  const call = await s.route({ [NAME]: { command: 'info', data: '' } });
  if (api[NAME] && call.status === 200 && call.body.command === 'info') test.check('an added verb is in the api at once and answers');
  else test.fail(OWED + 'after addVerb the api ' + (api[NAME] ? 'lists' : 'lacks') + ' it, and a call answered ' + call.status);

  let twice = null, bad = null;
  try { s.addVerb(NAME, { request: {}, reply: {}, handler: function () { return {}; } }); } catch (e) { twice = e; }
  try { s.addVerb('9bad', { request: {}, reply: {}, handler: function () { return {}; } }); } catch (e) { bad = e; }
  if (twice && bad) test.check('addVerb refuses a name it already has, and a name the start-up check would refuse');
  else test.fail(OWED + 'addVerb took ' + (!twice ? 'a duplicate name' : '') + (!bad ? ' a bad name' : ''));

  let fixedDrop = null;
  try { s.dropVerb('fixed'); } catch (e) { fixedDrop = e; }
  s.dropVerb(NAME);
  const after = (await s.route('api')).body || {};
  const gone = await s.route({ [NAME]: { command: 'info', data: '' } });
  if (fixedDrop && after.fixed && !after[NAME] && gone.body && gone.body.code === 'no-such-verb') test.check('dropVerb removes a runtime verb at once and refuses to remove a fixed one');
  else test.fail(OWED + 'dropVerb: fixed ' + (fixedDrop ? 'kept' : 'dropped') + ', runtime ' + (after[NAME] ? 'still listed' : 'gone') + ', a call answered ' + JSON.stringify(gone.body && gone.body.code));
}

async function partD() {
  test.subHeading('D. spirit.peerPost: post, then the answer that comes back by re');
  if (typeof spirit.peerPost !== 'function') { test.fail(OWED + 'kernel.js\'s spirit object has no peerPost'); return; }
  const PEER = 'MCowBQYDK2VwAyEAfileCorePeerAAAAAAAAAAAAAAAAAAAAAAAAA=';
  let mode = 'answer';
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
      if (mode === 'refuse') { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: 'no relay' })); return; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, hash: 'HASH-' + posts.length }));
      if (mode === 'answer') {
        const made = packet.encode('api', { command: 'info', data: '{"bytes":3}' }, { re: 'HASH-' + posts.length });
        setTimeout(function () {
          streams.forEach(function (s) { s.write('event: packet\ndata: ' + JSON.stringify({ from: PEER, text: made.text }) + '\n\n'); });
        }, 50);
      }
    });
  });
  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  const url = 'http://127.0.0.1:' + node.address().port;
  try {
    const got = await Promise.race([spirit.peerPost(PEER, 'api', { files: { info: {} } }, { node: url, kind: 'background', waitMs: 2000 }), sleep(4000)]);
    if (got && got.command === 'info' && got.data === '{"bytes":3}') test.check('it resolves with the body of the answer whose re is its post\'s hash');
    else test.fail(OWED + 'spirit.peerPost resolved ' + JSON.stringify(got));
    if (posts[0] && posts[0].verb === 'peer.post' && posts[0].to === PEER && posts[0].kind === 'background') test.check('it posts through peer.post, with how.kind riding along');
    else test.fail(OWED + 'the node was asked ' + JSON.stringify(posts[0]));

    mode = 'silent';
    const silent = await Promise.race([spirit.peerPost(PEER, 'api', { files: { info: {} } }, { node: url, waitMs: 300 }), sleep(3000)]);
    if (silent && silent.ok === false && silent.code === 'no-answer') test.check('no answer within waitMs resolves no-answer');
    else test.fail(OWED + 'a silent peer resolved ' + JSON.stringify(silent));

    mode = 'refuse';
    const t0 = Date.now();
    const refused = await Promise.race([spirit.peerPost(PEER, 'api', { files: { info: {} } }, { node: url, waitMs: 5000 }), sleep(4000)]);
    if (refused && refused.ok === false && refused.code === 'not-posted' && Date.now() - t0 < 2000) test.check('a refused post resolves not-posted at once');
    else test.fail(OWED + 'a refused post resolved ' + JSON.stringify(refused) + ' after ' + (Date.now() - t0) + ' ms');
  } finally {
    streams.forEach(function (s) { try { s.end(); } catch (e) { /* gone */ } });
    node.close();
  }
}

// Part E read agents.js (it asks through spirit.peerPost, its own knot gone); the agents app is gone (goal/G3.2).

(async function () {
  await partA();
  await partB();
  await partC();
  await partD();
})().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(0); }, 200);
});
