'use strict';

// apiAuth/G1.2: the decision sequence, apiAuth's gate in apiDoor, red on today's code.
//   Andy: "apiAuth will enforce an active consent scheme: denial is the absence of authorization", "authorization may
//   happen on an app basis, (ID<>app) or a verb basis (ID<>app.verb)", "apiAuth will strip the app.DEBUG verb the
//   result of returned api trees, including all branches of the tree that don't have a match for the calling ID",
//   "even an api-call will be rejected", "A refusal result in an error", "Where: apiDoor", "no special treatment for
//   you guys!" (AGENTS is a verb like any other), DEPENDENCIES owner-only "like DEBUG", and on the caller, agreed:
//   "the caller's key is handed in with every call, and a call from your own machine counts as you."
// The contract the builder follows (G1.2's box, steps 0-6):
//   - createApiDoor(opts) takes opts.auth = { pathsOf(key) }: the paths granted to that key, each 'app' or
//     'app.verb' (G1.3's table, read through G1.4's module); it throws when the store cannot be read.
//   - answer(servers, ask, caller): caller { owner: true } for loopback and puppeteering (jobs.api passes it),
//     else { key, auth } for a member. The owner is never gated.
//   0. A stranger gets no reply (unchanged: appApiDoor.js T6). A member writing as andy stays refused (unchanged).
//   2. A member asking DEBUG or DEPENDENCIES on any server is refused not-owner, granted or not, and nothing is asked.
//   4. A member's 'api' is the tree stripped to its grants: a granted app keeps its verbs but DEBUG and DEPENDENCIES;
//      a granted verb keeps that verb alone; a member with no grant is refused not-granted, not handed {}.
//   5. A member's call runs when its app or its app.verb is granted, exactly (no prefix, no case folding); otherwise
//      refused not-granted, and the server is never asked. A granted app's missing verb is the server's to answer.
//   6. pathsOf throwing: refused store-unavailable, nothing asked. The gate fails closed.
//   appApiDoor.js builds its doors with no auth; once this lands its fakes grant 'alpha', or it reads as denied.

const test = require('./testSupport.js');
const packet = require('../run/js/client/packet');
const arrivals = require('../run/js/arrivals.js');

test.startTest('apiAuth/G1.2: the gate decides every member call by its grants');

const OWED = 'OWED by apiAuth/G1.2: ';
let apiDoor = null;
try { apiDoor = require('../run/js/apiDoor.js'); } catch (e) { apiDoor = null; }

const MEMBER = 'MCowBQYDK2VwAyEAmembermembermembermembermembermemb=';
const VERB = { request: {}, reply: { ok: true } };
const TREE = {
  desk: { 'item.get': VERB, 'items.search': VERB, 'chat.add': VERB, AGENTS: VERB, DEBUG: VERB, DEPENDENCIES: VERB },
  backup: { 'status.get': VERB, DEBUG: VERB, DEPENDENCIES: VERB },
};

const asked = [];
const posted = [];
function door(grants, broken) {
  asked.length = 0; posted.length = 0;
  return apiDoor.createApiDoor({
    servers: { ask: function (body) {
      asked.push(body);
      if (body === 'api') return Promise.resolve({ status: 200, body: JSON.parse(JSON.stringify(TREE)) });
      return Promise.resolve({ status: 200, body: { ok: true, ran: body } });
    } },
    post: function () { posted.push(Array.prototype.slice.call(arguments)); return Promise.resolve({ ok: true }); },
    encode: packet.encode,
    isKnown: function (key) { return key === MEMBER; },
    auth: { pathsOf: function (key) { if (broken) throw new Error('node.db unreadable'); return key === MEMBER ? grants.slice() : []; } },
    log: function () {},
  });
}
function reply() {
  for (const args of posted) for (const a of args) {
    if (typeof a !== 'string') continue;
    const d = packet.decode(a);
    if (d && d.app === 'api') return d.body;
  }
  return null;
}
function ask(d, body) {
  // The envelope arrives read, as arrivals.js hands it to a witness (goal/G16.5).
  const text = packet.encode('api', body).text;
  const m = { text: text, envelope: arrivals.envelopeOf(text), fromKey: MEMBER, hash: 'H' + Math.random().toString(16).slice(2) };
  return Promise.resolve(d(m)).then(function () { return new Promise(function (r) { setTimeout(r, 40); }); }).then(reply);
}
const call = function (app, verb) { const b = {}; b[app] = {}; b[app][verb] = {}; return b; };
const keys = function (o) { return Object.keys(o || {}).sort().join(','); };
const refusedAs = function (r, code) { return r && r.ok === false && r.code === code; };

(async function () {
  if (!apiDoor || typeof apiDoor.createApiDoor !== 'function') { test.fail(OWED + 'no js/apiDoor.js'); return; }

  test.subHeading('1. The owner is never gated: the whole tree, DEBUG and DEPENDENCIES included');
  const own = await apiDoor.answer({ ask: function (b) { return Promise.resolve({ status: 200, body: b === 'api' ? TREE : { ok: true } }); } }, 'api', { owner: true });
  const ob = own && own.body;
  if (ob && keys(ob.desk) === keys(TREE.desk) && keys(ob.backup) === keys(TREE.backup)) test.check('answer(servers, \'api\', {owner: true}) is the whole tree');
  else test.fail(OWED + 'the owner\'s api answered ' + JSON.stringify(ob).slice(0, 200));

  test.subHeading('2. DEBUG and DEPENDENCIES are the owner\'s alone, granted or not');
  let d = door(['desk']);
  let r = await ask(d, call('desk', 'DEBUG'));
  const debugRefused = refusedAs(r, 'not-owner') && asked.length === 0;
  d = door(['desk']);
  r = await ask(d, call('desk', 'DEPENDENCIES'));
  if (debugRefused && refusedAs(r, 'not-owner') && asked.length === 0) test.check('desk granted whole: desk.DEBUG and desk.DEPENDENCIES refused not-owner, nothing asked');
  else test.fail(OWED + 'a member asking DEPENDENCIES on a granted app answered ' + JSON.stringify(r) + ', asked ' + asked.length + ' (DEBUG refused: ' + debugRefused + ')');

  test.subHeading('4. A member\'s api is the tree stripped to its grants');
  d = door(['desk']);
  r = await ask(d, 'api');
  if (r && keys(r) === 'desk' && keys(r.desk) === 'AGENTS,chat.add,item.get,items.search') test.check('desk granted whole: desk alone, every verb but DEBUG and DEPENDENCIES (AGENTS kept: a verb like any other)');
  else test.fail(OWED + 'desk granted whole, api answered ' + JSON.stringify(r).slice(0, 220));
  d = door(['desk.item.get']);
  r = await ask(d, 'api');
  if (r && keys(r) === 'desk' && keys(r.desk) === 'item.get') test.check('desk.item.get granted: desk.item.get alone, no AGENTS, no backup');
  else test.fail(OWED + 'desk.item.get granted, api answered ' + JSON.stringify(r).slice(0, 220));
  d = door([]);
  r = await ask(d, 'api');
  if (refusedAs(r, 'not-granted')) test.check('no grant: api refused not-granted, not handed an empty tree');
  else test.fail(OWED + 'no grant, api answered ' + JSON.stringify(r).slice(0, 200));

  test.subHeading('5. A call runs only on its app or its exact app.verb');
  d = door(['desk.item.get']);
  r = await ask(d, call('desk', 'item.get'));
  const ran = asked.length === 1 && r && r.ok === true;
  d = door(['desk.item.get']);
  r = await ask(d, call('desk', 'chat.add'));
  const verbOnly = refusedAs(r, 'not-granted') && asked.length === 0;
  if (ran && verbOnly) test.check('desk.item.get granted: it runs; desk.chat.add refused not-granted, the server never asked');
  else test.fail(OWED + 'verb grant: granted ran ' + ran + ', ungranted refused untouched ' + verbOnly);
  d = door(['desk']);
  r = await ask(d, call('backup', 'status.get'));
  if (refusedAs(r, 'not-granted') && asked.length === 0) test.check('desk granted: backup.status.get refused not-granted');
  else test.fail(OWED + 'another app answered ' + JSON.stringify(r) + ', asked ' + asked.length);
  d = door(['desk.item']);
  r = await ask(d, call('desk', 'items.search'));
  const noPrefix = refusedAs(r, 'not-granted') && asked.length === 0;
  d = door(['Desk']);
  r = await ask(d, call('desk', 'item.get'));
  if (noPrefix && refusedAs(r, 'not-granted') && asked.length === 0) test.check('exact branches only: desk.item does not open desk.items.search, Desk does not open desk');
  else test.fail(OWED + 'near misses: prefix refused ' + noPrefix + ', case answered ' + JSON.stringify(r));
  d = door(['desk']);
  r = await ask(d, call('desk', 'nosuch'));
  if (asked.length === 1 && r && r.ok === true) test.check('desk granted: desk.nosuch goes to the server, whose no-such-verb it is to say');
  else test.fail(OWED + 'a granted app\'s missing verb answered ' + JSON.stringify(r) + ', asked ' + asked.length);

  test.subHeading('6. The gate fails closed');
  d = door(['desk'], true);
  r = await ask(d, call('desk', 'item.get'));
  if (refusedAs(r, 'store-unavailable') && asked.length === 0) test.check('the grants cannot be read: refused store-unavailable, nothing asked');
  else test.fail(OWED + 'an unreadable store answered ' + JSON.stringify(r) + ', asked ' + asked.length);
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
