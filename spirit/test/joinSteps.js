'use strict';

// spirit/test/joinSteps.js
// goal/G30.1, box v39: the Join app walks a new user from joining to his face link. Red on today's tree; claude-windows
// writes it and builds it (one agent). The box, in short:
//   - The app shows every step as a bullet in a to-do list, done ones ticked, the first open one expanded with its
//     form; the tile shows the first open step's name and icon. Its manifest lists the steps in order, each with its
//     name, icon and the fact that ends it. Join (until a seat); Find someone (until a first contact), optional, so it
//     never blocks; Configure your node's remote control (until the node holds a face name on the relay it joined);
//     the face link, https://<face name>.<relay host>, ticked once he has opened it (kept in the shell's preferences),
//     which ends the steps and takes the tile away.
//   - The shell opens an app named in its address on load (?app=<folder>); the mail's link carries ?join=<code>&app=join.
//   - Find someone on the network and Info's face form are shell elements; Contacts, Info and the Join app draw them.
// NAMED HERE where the box names none:
//   - spiritElements.joinSteps = { facts(ask, opened) -> Promise of {seated, contact, face, faceUrl, opened},
//     current(steps, facts) -> the first open step that is not optional, or null; done(step, facts) -> boolean }.
//     A step's `until` is one of seated, contact, face, opened.
//   - spiritElements.peerFind (shell/js/peerFind.js) and spiritElements.faceForm (shell/js/faceForm.js).
//   - The Join app keeps the opened link as its own override: setAppOverride('shell/join', { faceOpened: true }).
// rule/11: through testSupport only; its own scratch folders.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G30.1: ';
const RUN = path.join(__dirname, '..', 'run');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }
const code = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'); } catch (e) { return ''; } };
const raw = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8'); } catch (e) { return ''; } };
function element(rel, name) {
  try { const win = {}; new Function('window', raw(rel))(win); return (win.spiritElements || {})[name] || null; } catch (e) { return null; }
}

test.startTest('goal/G30.1: the Join app walks a new user from joining to his face link');

test.subHeading('1. the steps, in the manifest');
let manifest = null;
try { manifest = JSON.parse(raw('shell/join/join.json')); } catch (e) { manifest = null; }
const steps = (manifest && Array.isArray(manifest.steps)) ? manifest.steps : [];
const ids = steps.map(function (s) { return s.until; });
const find = steps.filter(function (s) { return s.until === 'contact'; })[0] || {};
const face = steps.filter(function (s) { return s.until === 'face'; })[0] || {};
if (ids.join(',') === 'seated,contact,face,opened' && find.optional === true && /remote control/i.test(String(face.name || '')) && steps.every(function (s) { return s.name && s.icon; }))
  test.check('join.json lists Join, Find someone (optional), Configure your node\'s remote control and the face link, each with a name and an icon');
else test.fail(OWED + 'join.json steps read ' + short(steps));

test.subHeading('2. which step is open, from what the node says');
const joinSteps = element('shell/js/joinSteps.js', 'joinSteps');
// A fake node door: relay.search answers the listed relays, contact.search the book, relay.get one relay's row.
function door(state) {
  return function (verb, args) {
    let body = null;
    if (verb === 'relay.search') body = { ok: true, items: [{ key: 'https://relay.example', label: JSON.stringify({ url: 'https://relay.example', claimed: !!state.seated, owned: false }) }], more: false };
    else if (verb === 'contact.search') body = { ok: true, items: state.contact ? [{ key: 'K1', label: JSON.stringify({ name: 'bert' }) }] : [], more: false };
    else if (verb === 'relay.get') body = { ok: true, key: args.key, relay: { url: args.key, claimed: !!state.seated, face: state.face ? { name: 'harbour', email: 'a@b.c' } : null } };
    return Promise.resolve({ status: 200, body: body, text: JSON.stringify(body) });
  };
}
function stepFor(state, opened) {
  if (!joinSteps || typeof joinSteps.facts !== 'function') return Promise.resolve({ missing: true });
  return joinSteps.facts(door(state), opened).then(function (f) { const s = joinSteps.current(steps, f); return { until: s ? s.until : null, facts: f }; });
}
const stepsDone = Promise.all([
  stepFor({ seated: false }, false),
  stepFor({ seated: true }, false),
  stepFor({ seated: true, contact: true }, false),
  stepFor({ seated: true, face: true }, false),
  stepFor({ seated: true, face: true }, true),
]).then(function (r) {
  if (r[0].until === 'seated') test.check('a node with no seat is on Join');
  else test.fail(OWED + 'with no seat the open step is ' + short(r[0]));
  if (r[1].until === 'face' && r[2].until === 'face') test.check('seated, the open step is the remote control, contact or not: Find someone is optional');
  else test.fail(OWED + 'seated, the open steps are ' + short([r[1].until, r[2].until]));
  if (r[3].until === 'opened' && r[3].facts && r[3].facts.faceUrl === 'https://harbour.relay.example') test.check('with a face name, the open step is the face link, https://harbour.relay.example');
  else test.fail(OWED + 'with a face the open step is ' + short(r[3]));
  if (r[4].until === null) test.check('once the link was opened, no step is open and the tile goes');
  else test.fail(OWED + 'after the link was opened the open step is ' + short(r[4].until));
});

test.subHeading('3. the shell: the tile, the address and the link in the mail');
const shell = code('js/client/shell.js');
const desktop = (/function renderDesktop\(\) \{[\s\S]*?\n  \}/.exec(shell) || [''])[0];
if (/joinSteps/.test(shell) && /\.current\(/.test(shell) && /faceOpened/.test(shell) && /steps/.test(desktop) && !/untilSeated/.test(shell))
  test.check('the shell draws the Join tile by its open step (name and icon), reading faceOpened from the app\'s override; untilSeated is gone');
else test.fail(OWED + 'the shell does not draw the Join tile by joinSteps');
if (/get\('app'\)/.test(shell) && /launchApp\(/.test((shell.split("get('app')")[1] || '').slice(0, 800)))
  test.check('the shell opens the app named by ?app= on load');
else test.fail(OWED + 'the shell does not open ?app=');
const mails = [];
let link = '';
try {
  const auth = require('../run/js/relayAuth');
  const plant = require('./plantIdentity.js');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'g301-steps-'));
  plant.ensureAt(home, 'relay');
  auth.writeOwner(home, auth.generateIdentity('andy').publicKey);
  const box = require('../run/js/relay').createRelay(home, { sendMail: function (m) { mails.push(m); return Promise.resolve({ ok: true }); } });
  box.join(auth.generateIdentity('bert').publicKey, 'bert@example.org', 11112, '');
  link = ((/http:\/\/127\.0\.0\.1:\d+\/?\?[^\s]+/.exec((mails[0] || {}).text || '')) || [''])[0];
  try { fs.rmSync(home, { recursive: true, force: true }); } catch (e) { /* busy */ }
} catch (e) { link = 'threw ' + e.message; }
if (/^http:\/\/127\.0\.0\.1:11112\/?\?join=[A-Za-z0-9_-]+&app=join$/.test(link)) test.check('the mail\'s link carries ?join=<code>&app=join, so it opens the Join app');
else test.fail(OWED + 'the mail\'s link reads ' + short(link));

test.subHeading('4. the shell elements and who draws them');
const index = raw('index.html');
const contacts = code('shell/contacts/contacts.js');
const info = code('shell/info/info.js');
const joinApp = code('shell/join/join.js');
const peerFind = element('shell/js/peerFind.js', 'peerFind');
const faceForm = element('shell/js/faceForm.js', 'faceForm');
if (peerFind && typeof peerFind.create === 'function' && /'peer\.search'/.test(code('shell/js/peerFind.js')) && /'peer\.acquire'/.test(code('shell/js/peerFind.js'))
    && /spiritElements\.peerFind/.test(contacts) && /spiritElements\.peerFind/.test(joinApp)
    && !/function contactsSeenSource|function contactsSeenCells|function contactsAskCard|function contactsSeenAdd/.test(contacts))
  test.check('Find someone is the peerFind element (peer.search, its rows, Add by peer.acquire); Contacts and the Join app draw it, Contacts keeps no copy');
else test.fail(OWED + 'peerFind is missing, or Contacts keeps its own find panel, or the Join app does not draw it');
if (faceForm && typeof faceForm.mount === 'function' && /'relay\.face'/.test(code('shell/js/faceForm.js'))
    && /spiritElements\.faceForm/.test(info) && /spiritElements\.faceForm/.test(joinApp) && !/'relay\.face'/.test(info))
  test.check('the face form is the faceForm element (relay.face); Info and the Join app draw it, Info keeps no copy');
else test.fail(OWED + 'faceForm is missing, or Info keeps its own face form, or the Join app does not draw it');
if (['peerFind', 'faceForm', 'joinSteps'].every(function (n) { return new RegExp('src="/shell/js/' + n + '\\.js"').test(index); }))
  test.check('index.html loads peerFind, faceForm and joinSteps');
else test.fail(OWED + 'index.html does not load all three elements');
if (/spiritElements\.joinSteps/.test(joinApp) && /setAppOverride\('shell\/join',\s*\{\s*faceOpened:\s*true\s*\}\)/.test(joinApp) && /spiritElements\.joinForm/.test(joinApp))
  test.check('the Join app draws its steps from joinSteps, the join form, and keeps the opened link as its override');
else test.fail(OWED + 'the Join app does not draw joinSteps, the join form, or does not keep faceOpened');

stepsDone.then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
}, function (e) { test.fail('the steps threw ' + e.message); test.reportSuccessFailureCount(); process.exit(0); });
