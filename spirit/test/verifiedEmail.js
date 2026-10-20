'use strict';

// spirit/test/verifiedEmail.js
// goal/G30.1, "Negotiating face-name and email between node and relay", the part left (box v28): a member's (or the
// owner's) verified email on a relay, added and changed through the join loop. Red on today's tree; claude-windows
// writes it and builds it (one agent).
// The box, in short:
//   - The join form in natterDetails is always there, for a seated member and the owner too, reading "Add email
//     address" while the node holds none for that relay, "Change email address" once it does; the input shows the
//     verified address held; after sending, it says an email in his inbox at the entered address holds a confirmation
//     link.
//   - The relay takes a repeat join from a key already seated as an email update: the same mail, link and code. Only
//     when the code is confirmed does it write the address on that member's row, verified (members.email and
//     members.emailVerified); until then the old email stands. No seat, no rename, not refused for a full relay.
//   - A first join writes the joined address on the new member's row the same way, verified.
//   - joinConfirm brings the address and the flag back; the node keeps them on that relay's row in node.db
//     (relays.email and relays.emailVerified), and natterDetails reads the label from it.
//   - Info's face section loses its email field.
// NAMED HERE where the box names none:
//   - relayStore members rows answer email and emailVerified; members.setEmail(key, email) writes it verified.
//   - The join and joinConfirm answers carry email and emailVerified.
//   - relayKeys.keepEmail(rootDir, url, email, verified) and relayKeys.emailOf(rootDir, url) -> {email, verified};
//     relay.get's row carries email and emailVerified.
//   - natterDetails: a panel for a seated relay (ndEmailHtml), its input class nd-join-email, its button nd-join-go.
// rule/11: through testSupport only; its own scratch folders.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G30.1: ';
const RUN = path.join(__dirname, '..', 'run');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }
const code = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'); } catch (e) { return ''; } };
const homes = [];
function home(name) { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'g301-' + name + '-')); homes.push(d); return d; }

test.startTest('goal/G30.1: a verified email per member on a relay, added and changed through the join loop');

const auth = require('../run/js/relayAuth');
const plant = require('./plantIdentity.js');
const { createRelay } = require('../run/js/relay');
const relayStore = require('../run/js/relayStore');
const boxHome = home('relay');
plant.ensureAt(boxHome, 'relay');
const owner = auth.generateIdentity('andy');
const member = auth.generateIdentity('bert');
auth.writeOwner(boxHome, owner.publicKey);
const mails = [];
// The relay's clock, moved past the one-a-minute join cap between joins.
let now = Date.now();
const box = createRelay(boxHome, { now: function () { return now; }, sendMail: function (m) { mails.push(m); return Promise.resolve({ ok: true }); } });
const codeOf = function () { const last = mails[mails.length - 1]; const m = last && /\?join=([A-Za-z0-9_-]+)/.exec(last.text); return m ? m[1] : ''; };
const row = function (key) { try { return relayStore.open(boxHome).members.get(key) || {}; } catch (e) { return { threw: e.message }; } };

test.subHeading('1. a first join writes the email on the new row, verified');
let first = null;
let firstOk = null;
try {
  first = box.join(member.publicKey, 'bert@example.org', 4242, '');
  firstOk = box.joinConfirm(member.publicKey, codeOf(), '');
} catch (e) { firstOk = { threw: e.message }; }
const r1 = row(member.publicKey);
if (first && first.ok && firstOk && firstOk.ok && r1.email === 'bert@example.org' && r1.emailVerified === true)
  test.check('bert joins: his row holds bert@example.org, verified');
else test.fail(OWED + 'first join ' + short(first) + ' / ' + short(firstOk) + ', row ' + short(r1));
if (firstOk && firstOk.email === 'bert@example.org' && firstOk.emailVerified === true) test.check('the join\'s confirm answers the email and the flag');
else test.fail(OWED + 'joinConfirm answered ' + short(firstOk));

test.subHeading('2. a repeat join from a seated key changes the email only once the code is confirmed');
let again = null;
now += 2 * 60 * 1000;
try { again = box.join(member.publicKey, 'bert@new.example', 4242, ''); } catch (e) { again = { threw: e.message }; }
const r2 = row(member.publicKey);
if (again && again.ok && r2.email === 'bert@example.org') test.check('a seated key may join again: a mail goes out, and the old email stands until the code');
else test.fail(OWED + 'the repeat join answered ' + short(again) + ', row ' + short(r2));
let changed = null;
try { changed = box.joinConfirm(member.publicKey, codeOf(), ''); } catch (e) { changed = { threw: e.message }; }
const r3 = row(member.publicKey);
const snap = box.snapshot();
if (changed && changed.ok && r3.email === 'bert@new.example' && r3.emailVerified === true && r3.publicLabel === r1.publicLabel && snap.peers === 2)
  test.check('the code confirms it: the row holds bert@new.example, verified, his label unchanged, no new seat');
else test.fail(OWED + 'after the confirm ' + short(changed) + ', row ' + short(r3) + ', peers ' + short(snap.peers));

test.subHeading('3. the owner adds his email the same way');
let ownerJoin = null;
let ownerOk = null;
try {
  ownerJoin = box.join(owner.publicKey, 'andy@example.org', 65432, '');
  ownerOk = box.joinConfirm(owner.publicKey, codeOf(), '');
} catch (e) { ownerOk = { threw: e.message }; }
const r4 = row(owner.publicKey);
if (ownerJoin && ownerJoin.ok && ownerOk && ownerOk.ok && r4.email === 'andy@example.org' && r4.emailVerified === true && box.snapshot().owner === 'owner')
  test.check('the owner\'s seat takes andy@example.org, verified, and keeps its label');
else test.fail(OWED + 'the owner\'s join ' + short(ownerJoin) + ' / ' + short(ownerOk) + ', row ' + short(r4));

test.subHeading('4. the node keeps the verified email on that relay\'s row');
const relayKeys = require('../run/js/relayKeys');
const nodeHome = home('node');
plant.ensureAt(nodeHome, 'andy');
let held = null;
try {
  relayKeys.list(nodeHome, 'https://relay.example', 'relay', 'RELAYKEY-R');
  relayKeys.keepEmail(nodeHome, 'https://relay.example', 'andy@example.org', true);
  held = relayKeys.emailOf(nodeHome, 'https://relay.example');
} catch (e) { held = { threw: e.message }; }
if (held && held.email === 'andy@example.org' && held.verified === true) test.check('relayKeys keeps the email and its flag on the relay\'s row (node.db relays.email, emailVerified)');
else test.fail(OWED + 'relayKeys.emailOf answered ' + short(held));
const hub = code('js/hub.js');
if (/relayKeys\.keepEmail\(/.test(hub) && /emailOf\(/.test(hub)) test.check('relay.join keeps what the confirm answered, and relay.get\'s row carries it');
else test.fail(OWED + 'hub.js keeps no email from the join, or relay.get carries none');
const peerPost = code('js/peerPost.js');
if (/email: said\.email/.test(peerPost) && /emailVerified: said\.emailVerified/.test(peerPost)) test.check('peerPost hands the confirm\'s email and flag back');
else test.fail(OWED + 'peerPost drops the confirm\'s email');

test.subHeading('5. the form, and Info');
const nd = code('shell/natterDetails/natterDetails.js');
// The confirmation-link sentence moved into the shared joinForm element (box v33, section 5d).
// The words are the joinForm control's own since box v41 (joinForm.words); natterDetails asks it.
const jfWords = code('shell/js/joinForm.js');
if (/function ndEmailHtml/.test(nd) && /ndJoinForm\(\)\.words\(/.test(nd) && /Add email address/.test(jfWords) && /Change email address/.test(jfWords))
  test.check('natterDetails has the email panel for a seated relay, reading Add or Change email address');
else test.fail(OWED + 'natterDetails has no email panel for a seated relay, or not its words');
const info = code('shell/info/info.js');
if (!/id="info-face-email"/.test(info)) test.check('Info\'s face section has no email field');
else test.fail(OWED + 'Info\'s face section still has its email field');

test.subHeading('5b. the words around a change (box v31)');
// The mails this suite made: [0] bert's first join, [1] his repeat, [2] the owner's join on his boot seat.
const subjects = mails.map(function (m) { return m.subject; });
if (subjects[0] === 'Join this relay' && subjects[1] === 'Confirm your email address' && subjects[2] === 'Confirm your email address')
  test.check('a first join mails Join this relay; a seated key (the owner too) gets Confirm your email address');
else test.fail(OWED + 'the mail subjects were ' + short(subjects));
const relayJoinSrc = (/function relayJoin\([\s\S]*?\n  \}/.exec(code('js/hub.js')) || [''])[0];
const shellSrc = code('js/client/shell.js');
if (/status:\s*said\.status === 200 \? 200 : 201/.test(relayJoinSrc) && /Email address verified/.test(shellSrc))
  test.check('the node passes the relay\'s 200 for a change on, and the page says Email address verified');
else test.fail(OWED + 'relay.join hands no change apart from a new seat, or the page never says Email address verified');
// Info's face form is the shell element faceForm since box v39.
const infoFace = /spiritElements\.faceForm/.test(info) ? code('shell/js/faceForm.js') : (info.split('function infoDrawFace')[1] || '');
if (/emailVerified/.test(infoFace) && /Verify your email in Contacts/.test(infoFace) && /callDialog\('shell\/natterDetails'/.test(infoFace))
  test.check('Info draws no face form for a relay with no verified email, and offers its natterDetails instead');
else test.fail(OWED + 'Info draws the face form without a verified email, or offers no way to natterDetails');

test.subHeading('5c. the Join app, an intrinsic tile outside the group (box v32; its steps since v39 are joinSteps.js)');
// shell/join/ is an intrinsic app whose manifest lists steps; the shell shows its tile on the desktop while a step is
// open (joinSteps.js asserts which), and never in the Spirit group's grid.
let joinManifest = null;
try { joinManifest = JSON.parse(fs.readFileSync(path.join(RUN, 'shell', 'join', 'join.json'), 'utf8')); } catch (e) { joinManifest = null; }
if (joinManifest && joinManifest.intrinsic === true && Array.isArray(joinManifest.steps))
  test.check('shell/join is an intrinsic app whose manifest lists its steps');
else test.fail(OWED + 'no shell/join app with steps');
if (/'join'/.test((/INTRINSIC_APP_FOLDERS\s*=\s*\[[^\]]*\]/.exec(shellSrc) || [''])[0]) && /\.steps/.test((/function renderAppGroup\([\s\S]*?\n  \}/.exec(shellSrc) || [''])[0]))
  test.check('the shell declares join at boot and keeps an app with steps out of the group grid');
else test.fail(OWED + 'the shell does not keep the join app out of the group grid');

test.subHeading('5d. the join form is one shell element (box v33)');
// NAMED HERE: spiritElements.joinForm = { html(opts), bind(root, opts), send(opts) }. send asks opts.ask('relay.join',
// {url, email, code: ''}) and answers {ok, text}; html draws the field (prefilled with opts.email), the button and the
// line the text goes to; bind wires a root's button and Enter to send.
let element = null;
try {
  const src = fs.readFileSync(path.join(RUN, 'shell', 'js', 'joinForm.js'), 'utf8');
  const win = {};
  new Function('window', src)(win);
  element = win.spiritElements && win.spiritElements.joinForm;
} catch (e) { element = null; }
let asked = null;
let said = null;
let drawn = '';
const sendIt = function () {
  if (!element || typeof element.send !== 'function') return Promise.resolve(null);
  drawn = typeof element.html === 'function' ? String(element.html({ email: 'held@example.org', label: 'Change email address' })) : '';
  return element.send({ url: 'https://relay.example', email: 'new@example.org', ask: function (verb, args) { asked = { verb: verb, args: args }; return Promise.resolve({ status: 200, body: { ok: true } }); } });
};
const elementDone = sendIt().then(function (r) {
  said = r;
  if (asked && asked.verb === 'relay.join' && asked.args.url === 'https://relay.example' && asked.args.email === 'new@example.org' && asked.args.code === ''
      && said && said.ok && /new@example\.org/.test(said.text) && /confirmation link/.test(said.text) && /value="held@example\.org"/.test(drawn) && typeof element.bind === 'function')
    test.check('joinForm draws the field prefilled, asks relay.join for its relay, and says the confirmation link is in the inbox');
  else test.fail(OWED + 'joinForm asked ' + short(asked) + ', said ' + short(said) + ', drew ' + short(drawn));
  const index = (function () { try { return fs.readFileSync(path.join(RUN, 'index.html'), 'utf8'); } catch (e) { return ''; } }());
  const ndSrc = code('shell/natterDetails/natterDetails.js');
  const joinSrc = code('shell/join/join.js');
  if (/src="\/shell\/js\/joinForm\.js"/.test(index) && /spiritElements\.joinForm/.test(ndSrc) && /spiritElements\.joinForm/.test(joinSrc)
      && !/type="email"/.test(ndSrc) && !/type="email"/.test(joinSrc) && !/'relay\.join'/.test(ndSrc) && !/'relay\.join'/.test(joinSrc))
    test.check('index.html loads it; natterDetails and the Join app draw it and keep no email form or relay.join of their own');
  else test.fail(OWED + 'joinForm is not loaded, or natterDetails or the Join app keeps its own form');
});

test.subHeading('6. a newly started node presents noderoutes.net as a contact');
// Box v29: "A newly started node presents noderoutes.net as a contact already". Contacts' relay rows are relay.search's
// (contacts.js asks it); a new node's list is what boot asserts (server.js calls ownerBadge.ensureRelays). So a fresh
// home, the boot's call, and relay.search as Contacts asks it.
const freshHome = home('fresh');
plant.ensureAt(freshHome, 'carl');
let fresh = null;
try {
  require('../run/js/ownerBadge').ensureRelays(freshHome);
  fresh = require('../run/js/hub').createHub(freshHome).relaySearch({ q: '*' }, {});
} catch (e) { fresh = Promise.resolve({ threw: e.message }); }
const server = code('js/server.js');
elementDone.then(function () { return fresh; }).then(function (r) {
  const items = (r && r.items) || [];
  const seed = items.filter(function (i) { return i.key === 'https://noderoutes.net'; })[0];
  if (/ownerBadge\.ensureRelays\(ROOT_DIR\)/.test(server) && seed) test.check('a fresh node\'s relay.search, what Contacts lists relays from, holds noderoutes.net');
  else test.fail('a fresh node\'s relay.search answered ' + short(r));
}, function (e) { test.fail('a fresh node\'s relay.search threw ' + e.message); }).then(function () {
  homes.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* busy */ } });
  test.reportSuccessFailureCount();
  process.exit(0);
});
