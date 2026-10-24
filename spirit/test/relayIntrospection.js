'use strict';

// spirit/test/relayIntrospection.js
// goal/G30.3, "Introspection for the relay". Red on today's tree; claude-windows writes it and builds it (one agent).
// The item's box (v12), in short:
//   - The only new component on the relay is introSpector (Andy, 2026-10-19: "The only new component relay needs is
//     introSpector"). No appServer, no appClient, no verb table, no apiDoor in the relay: "THERE IS ABSOLUTELY NO
//     NEED FOR FUCKING APP SERVER IN FUCKING RELAY".
//   - A folder of the relay's own holds AGENTS.md and one verb file per relay verb with its description. The relay
//     calls introSpector.family on it and answers AGENTS, AGENTS.introspect and AGENTS.<verb> as self posts, beside
//     its existing verbs, which stay dispatched as they are. Everything stays synchronous.
//   - Categories, not grants: the relay holds the one table of which category may call which verbs, owner all of
//     them, member a short list. It cuts AGENTS.introspect and AGENTS.<verb> to the caller's category. A member asking
//     an owner verb is refused: with DEBUG on, not-granted with the reason; with DEBUG off, the plain no such peer a
//     verb nobody declared gets (Andy, 2026-10-20: "give good information in DEBUG mode, otherwise just refuse").
//     The category question is wholly internal to the relay.
//   - A stranger has no introspection; it keeps the card and the four public posts.
//   - Otherwise no behaviour change: the existing relay suites stay green.
// NAMED HERE where the box names none:
//   - The folder is spirit/run/spirit/relaySelf/ (js/relay/ is the node's own relay verbs).
//   - The member verbs are card, face, removePeer, rename and search; the owner's are those and config, debug,
//     invite, monitor, relayLabel and revoke.
//   - The DEBUG refusal is { ok: false, status: 403, code: 'not-granted', error }.
// rule/11: through testSupport only; its own scratch folders.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const world = require('./world');

const OWED = 'OWED by goal/G30.3: ';
const RUN = path.join(__dirname, '..', 'run');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }
const code = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'); } catch (e) { return ''; } };

test.startTest('goal/G30.3: the relay answers its introspection, cut by category, through introSpector alone');

const L = world.build({ title: 'A relay with an owner and two members', owner: 'andy', peers: [{ name: 'ann', label: 'ann' }, { name: 'bob', label: 'bob' }] });
if (!L.ok) { test.fail('the world: ' + L.error); test.reportSuccessFailureCount(); process.exit(0); }
const owner = L.owner;
const ann = L.peer('ann');
const bob = L.peer('bob');
// world.ask is synchronous: an answer only counts if it came back in the same call, as every relay answer does today.
const ask = function (who, body) { return (world.ask(L.box, who, body) || {}).answer || {}; };
const MEMBER = ['card', 'face', 'removePeer', 'rename', 'search'];
const OWNER_ONLY = ['config', 'debug', 'invite', 'monitor', 'relayLabel', 'revoke'];
const keysOf = function (a) { return a && Array.isArray(a.items) ? a.items.map(function (i) { return i.key; }).sort() : null; };

test.subHeading('1. the folder');
const SELF = path.join(RUN, 'spirit', 'relaySelf');
const files = (function () { try { return fs.readdirSync(SELF); } catch (e) { return []; } }());
const described = MEMBER.concat(OWNER_ONLY).filter(function (v) {
  try { return typeof JSON.parse(fs.readFileSync(path.join(SELF, v + '.json'), 'utf8')).description === 'string'; } catch (e) { return false; }
});
if (files.indexOf('AGENTS.md') !== -1 && described.length === MEMBER.length + OWNER_ONLY.length) test.check('spirit/relaySelf/ holds AGENTS.md and a description file for each of the ' + described.length + ' relay verbs');
else test.fail(OWED + 'spirit/relaySelf/ holds ' + short(files) + ', described ' + short(described));

// THE FOLDER IS READ THROUGH FS (goal/G30.4: the AGENTS verbs are gone). FS is an owner verb on the relay; members get
// nothing of it (Andy, 2026-10-20: "don't build shit nobody asked for.").
test.subHeading('2. the owner reads the folder through FS; a member does not');
const ownerList = ask(owner, { 'FS.search': { q: '' } });
const ownerFiles = ownerList && Array.isArray(ownerList.items) ? ownerList.items.map(function (i) { return i.key; }) : null;
if (ownerFiles && MEMBER.concat(OWNER_ONLY).every(function (v) { return ownerFiles.indexOf(v + '.json') !== -1; }) && ownerFiles.indexOf('AGENTS.md') !== -1)
  test.check('the owner\'s FS.search lists AGENTS.md and the file of every relay verb');
else test.fail(OWED + 'the owner\'s FS.search answered ' + short(ownerList));
const ownerInvite = ask(owner, { 'FS.loadJsonValue': { path: 'invite.json' } });
if (ownerInvite && ownerInvite.value && typeof ownerInvite.value.description === 'string') test.check('the owner\'s FS.loadJsonValue reads invite.json, its description');
else test.fail(OWED + 'FS.loadJsonValue answered ' + short(ownerInvite));
const ownerRules = ask(owner, { 'FS.loadFile': { path: 'AGENTS.md' } });
if (typeof ownerRules.text === 'string' && ownerRules.text.length) test.check('the owner\'s FS.loadFile reads the folder\'s AGENTS.md');
else test.fail(OWED + 'FS.loadFile answered ' + short(ownerRules));
const annFs = ask(ann, { 'FS.search': { q: '' } });
if (annFs.ok === false && annFs.status === 404 && !annFs.code) test.check('a member asking FS gets, with DEBUG off, the plain refusal an owner verb gets');
else test.fail(OWED + 'a member asking FS.search answered ' + short(annFs));

test.subHeading('3. the gate');
// DEBUG starts off; the owner's asks are spared for the checks (one member gets only so many answers in a window).
const minted = ask(ann, { invite: { label: 'carol', days: 7 } });
if (minted.ok === false && minted.status === 404 && minted.error === 'no such peer' && !minted.code) test.check('with DEBUG off, a member asking an owner verb (invite) gets the plain no such peer an unknown verb gets');
else test.fail(OWED + 'with DEBUG off, a member asking invite answered ' + short(minted));
ask(owner, { debug: { on: true } });
const told = ask(ann, { invite: { label: 'carol', days: 7 } });
const toldFs = ask(ann, { 'FS.search': { q: '' } });
ask(owner, { debug: { on: false } });
if (told.ok === false && told.status === 403 && told.code === 'not-granted' && toldFs.code === 'not-granted') test.check('with DEBUG on, the same asks are refused not-granted, with the reason');
else test.fail(OWED + 'with DEBUG on, a member asking invite answered ' + short(told) + ', FS.search ' + short(toldFs));
// bob from here: the relay answers one member only so many asks in a short window, and ann has used hers.
const renamed = ask(bob, { rename: { label: 'bobby' } });
if (renamed.ok === true) test.check('a member\'s own verb still answers in the same call (rename to bobby)');
else test.fail(OWED + 'bob renaming himself answered ' + short(renamed));
const evict = ask(bob, { removePeer: { key: ann.publicKey } });
if (evict.ok === false && evict.status === 404) test.check('a member removing somebody else is refused as before (404)');
else test.fail(OWED + 'bob removing ann answered ' + short(evict));
const ownerMint = ask(owner, { invite: { label: 'carol', days: 7 } });
if (ownerMint.ok === true) test.check('the owner\'s invite still answers in the same call');
else test.fail(OWED + 'the owner minting answered ' + short(ownerMint));
const two = world.ask(L.box, bob, { rename: { label: 'ann' }, search: { q: 'a' } }) || {};
if ((two.sent && two.sent.ok === false && two.sent.status === 400) || (two.answer && two.answer.ok === false)) test.check('a body naming two verbs is still refused (one verb per request)');
else test.fail(OWED + 'two verbs in one body answered ' + short(two));

test.subHeading('4. introSpector alone');
const relayJs = code('spirit/relay.js');
if (/require\('\.\/introSpector'\)\.family\(/.test(relayJs) && !/require\('\.\/(appServer|apiDoor|verbTable|appClient)'\)/.test(relayJs))
  test.check('relay.js calls introSpector.family and requires none of appServer, apiDoor, verbTable, appClient');
else test.fail(OWED + 'relay.js does not use introSpector.family alone');

test.reportSuccessFailureCount();
process.exit(0);
