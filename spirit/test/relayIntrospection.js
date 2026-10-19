'use strict';

// spirit/test/relayIntrospection.js
// goal/G30.3, "Introspection for the relay": the relay's own verbs in a declared table, answered through the same
// pieces the node uses, with what a caller may call decided by category. Red on today's tree; claude-windows writes
// it and builds it (one agent). The item's box (v9), in short:
//   - The relay builds its verbs with appServer's createAppServer (each verb: request, reply, handler) and adds the
//     AGENTS family through introSpector.family, closed while its folder has no AGENTS.md. Its member posts go
//     through apiDoor.answer, whose pathsOf(key) the relay answers by category: the owner's key every verb, a
//     member's key the member verbs, any other none. The verbs know nothing of keys, owners or members; the relay
//     holds the one table of which category may call which verbs. Nothing is stored per member.
//   - introSpector, appClient, appServer and apiDoor stay exactly as they are and appear in no core grant here.
//   - Cards are objects on the wire: a node hands its card as {v, body}, not its JSON text, in the card verb, a claim
//     and a join (Andy: "card ARE fucking objects. make it so."). A flag day.
//   - Each verb declares reply {} (appServer reserves ok, and every relay answer carries it); answers stay as today.
//   - Changed by design: a member asking an owner verb is refused not-granted where it got 404 no such peer. A body
//     naming two verbs is refused at the door already (one verb per request), and stays so.
// NAMED HERE where the box names none:
//   - A self post whose body is the string 'api' asks for the table; the answer is {relay: {verb: {request, reply}}}.
//   - The member verbs are card, face, removePeer, rename and search; the owner's are those and config, debug,
//     invite, monitor, relayLabel and revoke.
//   - nodeCard.cardObject(rootDir) answers this node's card as the object; peerPost (claim and join) and presenceNode
//     (the card hand-over) send it.
// The shared files' staying unchanged is guarded by the commit hook's core grants (Andy names them), not here.
// rule/11: through testSupport only; its own scratch folders.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const world = require('./world');
const nodeCard = require('../run/js/nodeCard');

const OWED = 'OWED by goal/G30.3: ';
const RUN = path.join(__dirname, '..', 'run');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }
const code = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'); } catch (e) { return ''; } };

test.startTest('goal/G30.3: the relay answers api, and what a caller may call is decided by category');

const L = world.build({ title: 'A relay with an owner and two members', owner: 'andy', peers: [{ name: 'ann', label: 'ann' }, { name: 'bob', label: 'bob' }] });
if (!L.ok) { test.fail('the world: ' + L.error); test.reportSuccessFailureCount(); process.exit(0); }
const owner = L.owner;
const ann = L.peer('ann');
const bob = L.peer('bob');
const ask = function (who, body) { return (world.ask(L.box, who, body) || {}).answer || {}; };
const MEMBER = ['card', 'face', 'removePeer', 'rename', 'search'];
const OWNER_ONLY = ['config', 'debug', 'invite', 'monitor', 'relayLabel', 'revoke'];
const verbsOf = function (a) { return a && a.relay && typeof a.relay === 'object' ? Object.keys(a.relay).sort() : null; };

test.subHeading('1. api, by category');
const annApi = ask(ann, 'api');
const annVerbs = verbsOf(annApi);
if (annVerbs && annVerbs.join(',') === MEMBER.slice().sort().join(',')) test.check('a member\'s api lists exactly the member verbs: ' + MEMBER.join(', '));
else test.fail(OWED + 'a member\'s api answered ' + short(annApi));
const ownerApi = ask(owner, 'api');
const ownerVerbs = verbsOf(ownerApi);
if (ownerVerbs && MEMBER.concat(OWNER_ONLY).every(function (v) { return ownerVerbs.indexOf(v) !== -1; })) test.check('the owner\'s api lists the member verbs and ' + OWNER_ONLY.join(', '));
else test.fail(OWED + 'the owner\'s api answered ' + short(ownerApi));
const shape = ownerApi && ownerApi.relay && ownerApi.relay.rename;
if (shape && shape.request && typeof shape.request.label === 'string') test.check('each verb in the table carries its request prototype (rename: {label})');
else test.fail(OWED + 'the table\'s rename entry is ' + short(shape));
if (ownerVerbs && !ownerVerbs.some(function (v) { return /^AGENTS/.test(v); })) test.check('no AGENTS verb is listed: the relay\'s folder has no AGENTS.md, so agents are closed out');
else test.fail(OWED + 'the owner\'s api lists ' + short(ownerVerbs));

test.subHeading('2. the gate');
const minted = ask(ann, { invite: { label: 'carol', days: 7 } });
if (minted.ok === false && minted.code === 'not-granted') test.check('a member asking an owner verb (invite) is refused not-granted');
else test.fail(OWED + 'a member asking invite answered ' + short(minted));
const renamed = ask(ann, { rename: { label: 'annie' } });
if (renamed.ok === true) test.check('a member\'s own verb still answers (rename to annie)');
else test.fail(OWED + 'ann renaming herself answered ' + short(renamed));
const evict = ask(ann, { removePeer: { key: bob.publicKey } });
if (evict.ok === false && evict.status === 404) test.check('a member removing somebody else is refused as before (404), bob stays');
else test.fail(OWED + 'ann removing bob answered ' + short(evict));
const unknown = ask(owner, { frob: {} });
if (unknown.ok === false && (unknown.code === 'no-such-verb' || unknown.code === 'not-granted')) test.check('a verb nobody declared is refused by name (' + unknown.code + ')');
else test.fail(OWED + 'an unknown verb answered ' + short(unknown));
const misfit = ask(ann, { rename: { label: 5 } });
if (misfit.ok === false && misfit.code === 'no-such-argument') test.check('a body that does not fit the verb\'s request is refused no-such-argument');
else test.fail(OWED + 'rename {label: 5} answered ' + short(misfit));
// ALREADY SO at the door (one verb per request, 400), and it stays so.
const two = world.ask(L.box, ann, { rename: { label: 'ann' }, search: { q: 'a' } }) || {};
if ((two.sent && two.sent.ok === false && two.sent.status === 400) || (two.answer && two.answer.ok === false)) test.check('a body naming two verbs is still refused (one verb per request)');
else test.fail(OWED + 'two verbs in one body answered ' + short(two));

test.subHeading('3. cards are objects');
const newer = JSON.parse(nodeCard.cardFrom(Object.assign({ name: 'bob', cardAt: 7 }, bob)));
const took = ask(bob, { card: newer });
if (took.ok === true && took.card === 'taken') test.check('a member hands its card as an object and it is taken');
else test.fail(OWED + 'a card object answered ' + short(took));
const asText = ask(bob, { card: nodeCard.cardFrom(Object.assign({ name: 'bob', cardAt: 8 }, bob)) });
if (asText.ok === false && asText.code === 'no-such-argument') test.check('a card as JSON text is refused no-such-argument');
else test.fail(OWED + 'a card as text answered ' + short(asText));
if (typeof nodeCard.cardObject === 'function') test.check('nodeCard.cardObject answers this node\'s card as an object');
else test.fail(OWED + 'nodeCard has no cardObject');
const pp = code('js/peerPost.js');
const pn = code('js/presenceNode.js');
if (!/card:\s*nodeCard\.describe\(/.test(pp) && !/describe\(rootDir\)/.test((pp.split('function join(')[1] || '').split('\n  function ')[0]) &&
    /cardObject\(/.test(pp) && /cardObject\(/.test(pn))
  test.check('peerPost (claim, join) and presenceNode (the hand-over) send the card object');
else test.fail(OWED + 'a node still sends its card as text (peerPost cardObject ' + /cardObject\(/.test(pp) + ', presenceNode ' + /cardObject\(/.test(pn) + ')');

test.subHeading('4. the pieces');
const relayJs = code('js/relay.js');
if (/createAppServer\(/.test(relayJs) && /require\('\.\/apiDoor'\)/.test(relayJs) && /\.family\(/.test(relayJs)) test.check('relay.js builds its verbs with createAppServer, adds introSpector.family and answers through apiDoor');
else test.fail(OWED + 'relay.js does not use createAppServer, introSpector.family and apiDoor');

test.reportSuccessFailureCount();
process.exit(0);
