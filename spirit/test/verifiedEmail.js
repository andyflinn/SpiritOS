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
const box = createRelay(boxHome, { sendMail: function (m) { mails.push(m); return Promise.resolve({ ok: true }); } });
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
if (/function ndEmailHtml/.test(nd) && /Add email address/.test(nd) && /Change email address/.test(nd) && /confirmation link/.test(nd))
  test.check('natterDetails has the email panel for a seated relay, reading Add or Change email address, and says a confirmation link is in the inbox');
else test.fail(OWED + 'natterDetails has no email panel for a seated relay, or not its words');
const info = code('shell/info/info.js');
if (!/id="info-face-email"/.test(info)) test.check('Info\'s face section has no email field');
else test.fail(OWED + 'Info\'s face section still has its email field');

homes.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* busy */ } });
test.reportSuccessFailureCount();
process.exit(0);
