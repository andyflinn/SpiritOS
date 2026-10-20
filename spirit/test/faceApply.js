'use strict';

// spirit/test/faceApply.js
// goal/G30.1: a node registers a face name and an email with one relay. Red on today's tree; claude-windows writes
// it, wsl-claude builds it. Box v30 drops the email from the verb: relay.face is {url, name}, and the relay pairs the
// name with the verified email it holds for the calling key; sections 1 to 3 and 5 assert that. The box (v19), in short:
//   - Relay: one more self verb, face {name, email}, answered with the pair signed, or refused; the members row gains
//     faceName (unique when set) and faceEmail. The name is one DNS label by faceRoute.nameOf's rule, lowercased. It is
//     freed when its member leaves the relay.
//   - Node: a new verb relay.face {url, name, email}, owner only, beside relay.add; it keeps the signed answer whole in
//     node.db on that relay's row (relays gains faceName, faceEmail, faceReply).
//   - Shell app: one section in the info app, addressing one relay.
//   - Deleted: grantFace, appFaceApp, appFaceAppServer, their own suites, bash/face-install; faceRoute.js moves to js/.
// NAMED HERE where the box names none: a refusal answers status 400 (bad name or email) or 409 (name held), as
// renameSelf does; an email is refused without an @; the answer on success carries ok, name and email.
// rule/11: through testSupport only; its own scratch folders.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');
const world = require('./world');

const OWED = 'OWED by goal/G30.1: ';
const RUN = path.join(__dirname, '..', 'run');
const ROOT = path.join(__dirname, '..', '..');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 240); }
const code = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'); } catch (e) { return ''; } };
function faceRows(box) {
  const home = typeof box.rootDir === 'function' ? box.rootDir() : box;
  const relayStore = require('../run/js/relayStore');
  const rows = [];
  relayStore.open(home).members.each(function (p) { rows.push({ key: p.publicKey, faceName: p.faceName, faceEmail: p.faceEmail }); });
  return rows;
}

test.startTest('goal/G30.1: a node registers a face name and an email with one relay');

test.subHeading('1. the relay answers face {name, email}');
const L = world.build({ title: 'A relay and two members', peers: [{ name: 'ann', label: 'ann' }, { name: 'bob', label: 'bob' }] });
if (!L.ok) { test.fail('the world: ' + L.error); test.reportSuccessFailureCount(); process.exit(0); }
const ann = L.peer('ann');
const bob = L.peer('bob');
const ask = function (who, body) { return (world.ask(L.box, who, body) || {}).answer || {}; };
// THE EMAIL IS ON FILE (box v30): relay.face is {url, name}; the relay pairs the name with the verified email it
// holds for the calling key, which a confirmed join wrote (verifiedEmail.js drives that loop). Written here the way
// the confirm writes it.
const verify = function (who, email) { require('../run/js/relayStore').open(L.box.rootDir()).members.setEmail(who.publicKey, email); };
verify(ann, 'ann@example.org');

const got = ask(ann, { face: { name: 'Harbour' } });
if (got.ok === true && got.name === 'harbour' && got.email === 'ann@example.org') test.check('ann applies for Harbour and is answered ok with the pair, the name lowercased');
else test.fail(OWED + 'face {Harbour, ann@example.org} answered ' + short(got));
const row = faceRows(L.box).filter(function (r) { return r.key === ann.publicKey; })[0] || {};
if (row.faceName === 'harbour' && row.faceEmail === 'ann@example.org') test.check('the members row holds faceName harbour and faceEmail');
else test.fail(OWED + 'ann\'s members row reads ' + short(row));

test.subHeading('2. what the relay refuses');
const noMail = ask(bob, { face: { name: 'bob' } });
if (noMail.ok === false && noMail.status === 400 && /email/i.test(String(noMail.error))) test.check('a member with no verified email on file is refused 400, told to add one');
else test.fail(OWED + 'face {bob} with no email on file answered ' + short(noMail));
verify(bob, 'bob@example.org');
const badName = ask(bob, { face: { name: 'two words' } });
if (badName.ok === false && badName.status === 400) test.check('a name that is not one DNS label is refused 400');
else test.fail(OWED + 'face {two words} answered ' + short(badName));
const sent = ask(bob, { face: { name: 'bobby', email: 'other@example.org' } });
if (sent.ok === true && sent.email === 'bob@example.org') test.check('an email sent along is ignored: the face pairs with the one on file');
else test.fail(OWED + 'face {bobby, other@example.org} answered ' + short(sent));
const held = ask(bob, { face: { name: 'HARBOUR' } });
if (held.ok === false && held.status === 409) test.check('a name another member holds is refused 409, whatever its case');
else test.fail(OWED + 'bob asking for HARBOUR answered ' + short(held));
const bobRow = faceRows(L.box).filter(function (r) { return r.key === bob.publicKey; })[0] || {};
if (bobRow.faceName === 'bobby') test.check('and bob\'s row holds his own face name, not harbour, after the refusals');
else test.fail(OWED + 'bob\'s row reads ' + short(bobRow));

test.subHeading('3. a repeat changes the pair; leaving frees the name');
verify(ann, 'ann@new.example.org');
const again = ask(ann, { face: { name: 'harbour' } });
const annRow = faceRows(L.box).filter(function (r) { return r.key === ann.publicKey; })[0] || {};
if (again.ok === true && annRow.faceEmail === 'ann@new.example.org') test.check('ann\'s verified email changes, she asks again, and the pair carries the new one');
else test.fail(OWED + 'ann\'s repeat answered ' + short(again) + ', row ' + short(annRow));
ask(ann, { removePeer: { key: ann.publicKey } });
const freed = ask(bob, { face: { name: 'harbour' } });
if (freed.ok === true && freed.name === 'harbour') test.check('once ann leaves the relay, bob may take harbour');
else test.fail(OWED + 'after ann left, bob asking for harbour answered ' + short(freed));

test.subHeading('4. the node keeps the answer in node.db, on the relay row');
const nodeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-faceapply-node-'));
let cols = [];
try {
  const store = require('../run/js/nodeStore');
  const s = store.open(nodeHome);
  const { DatabaseSync } = require('node:sqlite');
  const file = fs.readdirSync(path.join(nodeHome, 'relay-state')).filter(function (f) { return /^node\.db$/.test(f); })[0];
  const db = new DatabaseSync(path.join(nodeHome, 'relay-state', file), { readOnly: true });
  cols = db.prepare('PRAGMA table_info(relays)').all().map(function (c) { return c.name; });
  db.close();
  if (s && typeof s.close === 'function') s.close();
} catch (e) { cols = ['threw ' + e.message]; }
if (['faceName', 'faceEmail', 'faceReply'].every(function (c) { return cols.indexOf(c) !== -1; })) test.check('the node relays table has faceName, faceEmail and faceReply');
else test.fail(OWED + 'the node relays table has ' + short(cols));

test.subHeading('5. the node verb and the info app section');
const server = code('js/server.js');
// The relay family's verbs since the flat door (goal/G30.5): 'face' in the relay table. Box v30: {url, name}.
if (/'face':\s*\{\s*request:\s*\{\s*url:\s*'',\s*name:\s*''\s*\}/.test(server)) test.check('server.js declares relay.face {url, name}, no email');
else test.fail(OWED + 'server.js does not declare relay.face {url, name}');
const hubFace = (/function relayFace\([\s\S]*?\n  \}/.exec(code('js/hub.js')) || [''])[0];
if (hubFace && !/body\.email/.test(hubFace)) test.check('hub.relayFace sends no email to the relay');
else test.fail(OWED + 'hub.relayFace still reads an email from the body');
// Every relayKeys function hub.js calls is one relayKeys exports: relay.face crashed Andy's node on 2026-10-19
// because hub.relayFace called relayKeys.byUrl, which existed but was not exported.
const relayKeysApi = require('../run/js/relayKeys.js');
const usedByHub = Array.from(new Set((code('js/hub.js').match(/relayKeys\.([A-Za-z]+)\(/g) || []).map(function (m) { return m.slice(10, -1); })));
const missing = usedByHub.filter(function (n) { return typeof relayKeysApi[n] !== 'function'; });
if (usedByHub.indexOf('byUrl') !== -1 && !missing.length) test.check('every relayKeys function hub.js calls is exported (' + usedByHub.length + ', byUrl among them)');
else test.fail(OWED + 'hub.js calls relayKeys functions that are not exported: ' + short(missing));
// SHOWN AGAIN AFTER A RESTART (Andy, 2026-10-19): "after restarting the node for kicks, when i go to the info app
// again, it should show my current face and email address for any relay i select..... or any relay that is
// pre-selected". The node keeps the pair on the relay's row; each relay row relay.get answers carries it as face.
const keptHome = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-faceapply-keep-'));
let keptFace = null;
try {
  relayKeysApi.accept(keptHome, 'https://relay.example', 'MCowBQYDK2VwAyEAfaceApplyKeptRelayKeyAAAAAAAAAAAAAAAAAA=');
  relayKeysApi.keepFace(keptHome, 'https://relay.example', 'harbour', 'ann@example.org', '{"text":"signed"}');
  keptFace = relayKeysApi.faceOf(keptHome, 'https://relay.example');
} catch (e) { keptFace = { threw: e.message }; }
try { fs.rmSync(keptHome, { recursive: true, force: true }); } catch (e) { /* busy */ }
if (keptFace && keptFace.name === 'harbour' && keptFace.email === 'ann@example.org') test.check('the node reads back the face it kept for a relay (relayKeys.faceOf), across a fresh open');
else test.fail(OWED + 'relayKeys.faceOf answered ' + short(keptFace));
const hubSrc = code('js/hub.js');
if (/row\.face\s*=/.test(hubSrc) && /faceOf\(/.test(hubSrc)) test.check('each relay row the node answers carries its kept face (hub.js sets row.face from faceOf)');
else test.fail(OWED + 'hub.js puts no kept face on the relay rows relay.get answers');
const info = code('shell/info/info.js');
if (/\.face\b/.test(info.split('function infoDrawFace')[1] || '') && /addEventListener\('change'/.test(info.split('function infoDrawFace')[1] || '')) test.check('the info app draws the kept face of the selected relay and follows a change of selection');
else test.fail(OWED + 'the info app does not show the kept face of the selected relay');
if (/relay\.face/.test(info)) test.check('the info app asks relay.face');
else test.fail(OWED + 'the info app never asks relay.face');
if (!/info-face-email/.test(info) && !/email:\s*email/.test(info)) test.check('the info app has no email field and sends no email');
else test.fail(OWED + 'the info app still has its email field or sends one');

test.subHeading('6. the old face processes are gone; faceRoute moved');
const gone = ['spirit/run/process/js/grantFace', 'spirit/run/process/js/appFaceApp', 'spirit/run/process/js/appFaceAppServer', 'bash/face-install',
  'spirit/test/appFaceGrant.js', 'spirit/test/appFaceProcess.js', 'spirit/test/faceAppGates.js', 'spirit/test/faceNoIdentity.js', 'spirit/test/grantFace.js', 'spirit/test/memberFacePending.js']
  .filter(function (p) { return fs.existsSync(path.join(ROOT, p)); });
if (!gone.length) test.check('grantFace, appFaceApp, appFaceAppServer, face-install and their own suites are deleted');
else test.fail(OWED + 'still there: ' + gone.join(', '));
let nameOf = null;
try { nameOf = require('../run/js/faceRoute.js').nameOf; } catch (e) { nameOf = null; }
if (typeof nameOf === 'function' && nameOf('ann.noderoutes.net', 'noderoutes.net') === 'ann') test.check('js/faceRoute.js holds nameOf');
else test.fail(OWED + 'js/faceRoute.js with nameOf is not there');
const kept = ['bash/face-tls', 'bash/FACE.md'].filter(function (p) { return !fs.existsSync(path.join(ROOT, p)); });
if (!kept.length) test.check('face-tls and FACE.md are kept as bones');
else test.fail('the bones were deleted: ' + kept.join(', '));

setTimeout(function () {
  try { fs.rmSync(nodeHome, { recursive: true, force: true }); } catch (e) { /* busy */ }
  test.reportSuccessFailureCount();
  process.exit(0);
}, 100);
