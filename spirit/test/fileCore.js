'use strict';

// fileTransfer goal/G1.3: what the node and appServer must offer before a fileServer can run.
//   Andy: "let's make an item with the core modification needed. other items will depend on that".
//   The no-rush scheme, G1.2: "agreed. scheme approved.", "same for responses.", "got it. so i agree on the same
//   no-rush marker riding next the the fileServer replyPost".
//   spirit.peerPost, G1.3: "should be done via the spirit object, no?"; transport's R12 is not the way: "don't like it: in a
//   file download between peer, the peer streams a request to the replier, and awaits a peerReply-by-post with
//   correct hash, your implying changes to the relay as well."
//   Runtime verbs: no republished announce, "nah, files added or dropped are implicitly know to the user."
//   And over all of it: "keep in mind. no adding unwanted junk without permission."
// The contract (the shapes argued in goal/G1.3):
//   A. peer.post takes an optional kind. 'background' reaches the scheduler as how.kind; without it nothing
//      changes; any other value is refused before anything is posted.
//   B. A verb declared with background: true has its answers marked: appServer's route answers kind 'background'
//      beside status and body, the pipe carries it (X-Spirit-Kind), appClient hands it back, and the door posts
//      that answer with how {kind: 'background'} as post's fourth argument. Nothing new travels between peers.
//   C. createAppServer's server gains addVerb(name, {request, reply, handler}) and dropVerb(name). addVerb runs
//      the whole start-up check and refuses a name it already has; the api answer shows the change at once;
//      dropVerb removes only a verb added at runtime, never a fixed one, DEBUG or DEPENDENCIES.
//   D. the spirit object carries peerPost(peer, app, body, how): one post through the node's peer.post,
//      then the answer-post whose re matches that post's hash, read off the node's event stream, resolves with
//      its body. A refused post resolves {ok: false, code: 'not-posted'} at once; no answer within how.waitMs
//      (default 30 s) resolves {ok: false, code: 'no-answer'}. how.node names the node, else the origin of
//      SPIRIT_CALLBACK_URL; how.kind rides to peer.post. D is not asserted here: peerPost is spirit.js's
//      (spirit/run/spirit/spirit.js), not kernel.js's.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');

const RUN = path.join(__dirname, '..', 'run');
const OWED = 'OWED by fileTransfer goal/G1.3: ';
const appServer = require('../run/spirit/appServer.js');
const appClient = require('../run/spirit/appClient.js');
const apiDoor = require('../run/spirit/apiDoor.js');
const hub = require('../run/spirit/hub').createHub(process.cwd());
const packet = require('../run/spirit/client/packet.js');
const arrivals = require('../run/spirit/arrivals.js');

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
    // Since goal/G19.14 the router answers which relays name a key (peerPost holds the streams).
    router: {
      post: function (url, to, text, hints, how) { seen.push(how); return Promise.resolve({ ok: true, status: 200, hash: 'h', text: '' }); },
      relaysNaming: function () { return ['https://a.example']; },
    },
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

(async function () {
  await partA();
  await partB();
  await partC();
})().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(0); }, 200);
});
