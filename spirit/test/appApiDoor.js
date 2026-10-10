'use strict';

// spirit/test/appApiDoor.js
// THE MEMBER'S SIDE OF 'api' — appPair/G1.3, written FIRST, red on today's code.
//
//   Andy, 2026-09-29: go on appPair/G1.3. Decided: a member asks with an
//   ordinary packet, app 'api' ("peerPost is the wire to the api
//   introspection"); only members reach it, "the front door still holds"
//   (T6); the answer is flat (D11).
//
// The shape, claude-windows' and agreed: a new js/apiDoor.js,
// createApiDoor({servers, post, encode, isKnown, log}) returning
// function(message), registered as an arrivals witness. isKnown(fromKey) is
// the front door's 'known', minus its acquire branch (Andy: "why not just an
// exemption for aquire?"): a stranger admitted only to acquire gets nothing. It reads packets of
// app 'api' only (app-less ones are puppetDoor's, nodeApps.js), asks
// servers.ask(body) (appApi.js holds that half), and posts
// encode('api', answer, {re: message.hash}) back to message.fromKey. A
// non-member gets no reply at all. Driven with fakes and the real wire
// encode/decode, the way ownerPost.js drives its door.

const path = require('path');
const test = require('./testSupport.js');
const packet = require('../run/js/client/packet');
const arrivals = require('../run/js/arrivals.js');

test.startTest('appPair/G1.3: a member asks the node for api by packet, and only a member is answered');

const OWED = 'OWED by appPair/G1.3: ';
let apiDoor = null;
try { apiDoor = require('../run/js/apiDoor.js'); } catch (e) { apiDoor = null; }
const has = apiDoor && typeof apiDoor.createApiDoor === 'function';

const MEMBER = 'MCowBQYDK2VwAyEAmembermembermembermembermembermemb=';
const STRANGER = 'MCowBQYDK2VwAyEAstrangerstrangerstrangerstrangersx=';
const TREE = { alpha: { greet: { request: { name: '' }, reply: { text: '' } } } };

const asked = [];
const posted = [];
function world() {
  asked.length = 0; posted.length = 0;
  if (!has) return null;
  return apiDoor.createApiDoor({
    servers: { ask: function (body) {
      asked.push(body);
      if (body === 'api') return Promise.resolve({ status: 200, body: TREE });
      return Promise.resolve({ status: 200, body: { text: 'hi Andy' } });
    } },
    post: function () { posted.push(Array.prototype.slice.call(arguments)); return Promise.resolve({ ok: true }); },
    encode: packet.encode,
    isKnown: function (key) { return key === MEMBER; },
    // Since apiAuth/G1.2 the door gates every member by its grants (apiGate.js);
    // this suite is about the wire, so its member holds the whole fake app.
    auth: { pathsOf: function (key) { return key === MEMBER ? ['alpha'] : []; } },
    log: function () {},
  });
}
function arrive(door, from, app, body, hash) {
  const text = app === null ? JSON.stringify(body) : packet.encode(app, body).text;
  // The envelope arrives read, as arrivals.js hands it to a witness (goal/G16.5).
  const m = { text: text, envelope: arrivals.envelopeOf(text), fromKey: from, hash: hash || 'H' + Math.random().toString(16).slice(2) };
  return Promise.resolve(door ? door(m) : null).then(function () {
    return new Promise(function (r) { setTimeout(r, 50); });
  }).then(function () { return m; });
}
// The reply among a post's arguments: the one string that decodes as a packet.
function replyOf(args) {
  for (let i = 0; i < args.length; i++) {
    if (typeof args[i] !== 'string') continue;
    const d = packet.decode(args[i]);
    if (d && d.app) return { to: args.indexOf(MEMBER) !== -1 ? MEMBER : args.indexOf(STRANGER) !== -1 ? STRANGER : null, packet: d };
  }
  return null;
}
const same = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };

(async function () {
  let door = world();
  let m = await arrive(door, MEMBER, 'api', 'api');
  test.subHeading('T1 over the wire: a member\'s \'api\' packet gets the tree back, flat, as an answer to it');
  const r = posted.length === 1 ? replyOf(posted[0]) : null;
  if (has && asked.length === 1 && asked[0] === 'api' && r && r.to === MEMBER && r.packet.app === 'api' &&
      r.packet.re === m.hash && same(r.packet.body, TREE)) {
    test.check('one ask of the app servers, one packet back to the member: app api, re its hash, body the tree as is');
  } else {
    test.fail(OWED + (has ? 'asked ' + JSON.stringify(asked) + ', posted ' + posted.length + ' ' + JSON.stringify(r && r.packet) : 'no js/apiDoor.js with createApiDoor'));
  }

  door = world();
  m = await arrive(door, MEMBER, 'api', { alpha: { greet: { name: 'Andy' } } });
  test.subHeading('T8 over the wire: a member\'s call is handed on as it came, and its reply comes back flat');
  const c = posted.length === 1 ? replyOf(posted[0]) : null;
  if (has && asked.length === 1 && same(asked[0], { alpha: { greet: { name: 'Andy' } } }) && c && c.packet.re === m.hash &&
      same(c.packet.body, { text: 'hi Andy' })) {
    test.check('{alpha: {greet: {name: "Andy"}}} reached the app servers unchanged; {text: "hi Andy"} came back');
  } else {
    test.fail(OWED + 'call: asked ' + JSON.stringify(asked) + ', reply ' + JSON.stringify(c && c.packet));
  }

  door = world();
  await arrive(door, STRANGER, 'api', 'api');
  test.subHeading('T6: a non-member asking api gets nothing: the front door still holds');
  if (has && asked.length === 0 && posted.length === 0) {
    test.check('a key that is not a member asked api: no app server was asked and nothing was posted back');
  } else {
    test.fail(OWED + (has ? 'a stranger caused ' + asked.length + ' ask(s) and ' + posted.length + ' post(s)' : 'no js/apiDoor.js with createApiDoor'));
  }

  door = world();
  await arrive(door, MEMBER, 'contacts', 'api');
  await arrive(door, MEMBER, null, { verb: 'contact.list' });
  test.subHeading('Only app \'api\': another app\'s packet and an app-less one (puppetDoor\'s) are left alone');
  if (has && asked.length === 0 && posted.length === 0) {
    test.check('a packet for app contacts and an app-less packet: neither asked the app servers nor answered');
  } else {
    test.fail(OWED + (has ? 'packets not for api caused ' + asked.length + ' ask(s) and ' + posted.length + ' post(s)' : 'no js/apiDoor.js'));
  }

  // AN ANSWER IS NEVER A QUESTION. Found by hand on wsl-claude's node,
  // 2026-09-29: an 'api' asked of itself came back as an 'api' packet with
  // re, the door took it for a new request, answered it, and the two
  // answers bounced forever (about 9 log rows a second). Two nodes on the
  // same code would do it to each other. A packet that carries re is a
  // reply, and the door leaves it alone.
  door = world();
  if (has) {
    const replyText = packet.encode('api', { ok: false, code: 'bad-request', error: 'x' }, { re: 'H-original' }).text;
    await Promise.resolve(door({ text: replyText, envelope: arrivals.envelopeOf(replyText), fromKey: MEMBER, hash: 'H-reply' }));
    const treeReply = packet.encode('api', TREE, { re: 'H-original-2' }).text;
    await Promise.resolve(door({ text: treeReply, envelope: arrivals.envelopeOf(treeReply), fromKey: MEMBER, hash: 'H-reply-2' }));
    await new Promise(function (r) { setTimeout(r, 50); });
  }
  test.subHeading('A reply is never answered: a packet of app api that carries re is left alone');
  if (has && asked.length === 0 && posted.length === 0) {
    test.check('two api packets carrying re (an error and a tree) from a known sender: nothing asked, nothing posted');
  } else {
    test.fail(OWED + (has ? 'a reply caused ' + asked.length + ' ask(s) and ' + posted.length + ' post(s): replies would bounce forever' : 'no js/apiDoor.js'));
  }
})().catch(function (e) {
  test.fail(OWED + 'the run broke: ' + e.message);
}).then(function () { test.reportSuccessFailureCount(); });
