'use strict';

// spirit/test/joinOnboarding.js
// goal/G30.2, "Onboarding a node onto a relay": a newly installed node joins a relay by its user's email; the only
// thing typed is the email, once, in the shell. Red on today's tree; claude-windows writes it and builds it (one
// agent). The item's box (v22), in short:
//   - The node sends a signed join request to a relay: the email and its port; its key is the signer. The relay
//     mails a link to the user's own node, http://127.0.0.1:<port>?join=<code>. The node sends the code back to that
//     relay, signed by the same key; only that key can finish. A right code within 10 minutes takes the seat at once;
//     the public label is the part of the email before the @, made to fit the label rule. The email is never
//     published.
//   - Relay: two new posts a stranger may make on the door, join {email, port} and joinConfirm {code} (accepted by
//     Andy), under the claim's rules. The pending join lives 10 minutes in memory. Codes are capped per key, per
//     address and per sending address: one a minute, five an hour. The code is 32 random characters, one use, kept
//     only as a hash. The relay's login and join pages built earlier in this item go.
//   - Node: relay.join {url, email, code}, owner only, beside relay.add (confirmed by Andy). The shell calls it with
//     the email on first start, and with the code when opened at http://127.0.0.1:<port>?join=<code>.
//   - Mail: Mailgun, configured by relay-state/mail.json, as built in the first round.
// NAMED HERE where the box names none:
//   - relay.js: createRelay(rootDir, { sendMail }) takes the mailer; relay.join(publicKey, email, port) and
//     relay.joinConfirm(publicKey, code) are what the two door posts call, as relay.claim is for a claim. join answers
//     { ok } and never the code; joinConfirm answers { ok, status: 201, peer } like a claim.
//   - A label that is taken still seats: two johns are allowed today, so john@a and john@b both become john.
//   - The shell's own file (js/client/shell.js) asks relay.join, and reads ?join= on load.
// rule/11: through testSupport only; its own scratch folders.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const world = require('./world');
const auth = require('../run/js/relayAuth');
const rollOf = require('./rollOf');

const OWED = 'OWED by goal/G30.2: ';
const RUN = path.join(__dirname, '..', 'run');
const ROOT = path.join(__dirname, '..', '..');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 240); }
const code = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'); } catch (e) { return ''; } };

test.startTest('goal/G30.2: a node joins a relay by its user\'s email');

// ── THE WORLD: an owned relay, rebuilt over its home with a mailbox and a clock ──────────────────
const L = world.build({ title: 'A relay to join', owner: 'andy', peers: [] });
if (!L.ok) { test.fail('the world: ' + L.error); test.reportSuccessFailureCount(); process.exit(0); }
const home = L.box.rootDir();
const sent = [];
let clock = Date.now();
let relay = null;
try {
  relay = require('../run/js/relay').createRelay(home, { now: function () { return clock; }, sendMail: function (m) { sent.push(m); return Promise.resolve({ ok: true }); } });
} catch (e) { relay = null; }
const ann = auth.generateIdentity('ann');
const eve = auth.generateIdentity('eve');
function codeOf(m) { const found = m && /[?&]join=([A-Za-z0-9_-]+)/.exec(String(m.text || '')); return found ? found[1] : ''; }
function call(name, args) {
  if (!relay || typeof relay[name] !== 'function') return Promise.resolve({ ok: false, status: 0, error: 'relay.' + name + ' is missing' });
  try { return Promise.resolve(relay[name].apply(null, args)).then(function (r) { return r || {}; }, function (e) { return { ok: false, status: 0, error: e.message }; }); }
  catch (e) { return Promise.resolve({ ok: false, status: 0, error: e.message }); }
}

async function main() {
  test.subHeading('1. join mails a link to the user\'s own node');
  const asked = await call('join', [ann.publicKey, 'Ann.Smith@Example.org', 65432]);
  const mail = sent[sent.length - 1] || {};
  const c1 = codeOf(mail);
  if (asked.ok === true && mail.to === 'ann.smith@example.org' && /http:\/\/127\.0\.0\.1:65432\?join=/.test(String(mail.text)) && c1.length >= 32) {
    test.check('join mails ann.smith@example.org a link to http://127.0.0.1:65432?join=<a code of 32 or more characters>');
  } else test.fail(OWED + 'join answered ' + short(asked) + ', mail ' + short(mail));
  if (JSON.stringify(asked).indexOf(c1 || 'no code') === -1) test.check('join answers without the code: only the mail carries it');
  else test.fail(OWED + 'join gave the code back to the caller');
  const badMail = await call('join', [eve.publicKey, 'not-an-address', 65432]);
  if (badMail.ok === false && badMail.status === 400) test.check('an address without @ is refused 400');
  else test.fail(OWED + 'join with a bad address answered ' + short(badMail));

  test.subHeading('2. only the key that asked can finish, once, in time');
  const wrongKey = await call('joinConfirm', [eve.publicKey, c1]);
  if (wrongKey.ok === false && rollOf(home).every(function (r) { return r.publicKey !== eve.publicKey; })) test.check('the right code under another key takes no seat');
  else test.fail(OWED + 'eve finishing ann\'s join answered ' + short(wrongKey));
  const wrongCode = await call('joinConfirm', [ann.publicKey, 'x'.repeat(32)]);
  if (wrongCode.ok === false) test.check('a wrong code takes no seat');
  else test.fail(OWED + 'a wrong code answered ' + short(wrongCode));
  clock += 61 * 1000;
  await call('join', [ann.publicKey, 'ann.smith@example.org', 65432]);
  const c2 = codeOf(sent[sent.length - 1]);
  const done = await call('joinConfirm', [ann.publicKey, c2]);
  const row = rollOf(home).filter(function (r) { return r.publicKey === ann.publicKey; })[0] || {};
  if (done.ok === true && done.status === 201 && row.publicLabel === 'ann.smith') test.check('the right code under ann\'s key seats her at once, as ann.smith');
  else test.fail(OWED + 'joinConfirm answered ' + short(done) + ', row ' + short(row));
  const dump = (function () { try { return JSON.stringify(rollOf(home)) + fs.readdirSync(path.join(home, 'relay-state')).join(','); } catch (e) { return ''; } }());
  if (dump.indexOf('example.org') === -1) test.check('the email is published nowhere in the roll');
  else test.fail(OWED + 'the roll holds the email');
  const twice = await call('joinConfirm', [ann.publicKey, c2]);
  if (twice.ok === false) test.check('the same code a second time takes nothing');
  else test.fail(OWED + 'a reused code answered ' + short(twice));
  const bob = auth.generateIdentity('bob');
  await call('join', [bob.publicKey, 'bob@example.org', 65432]);
  const c3 = codeOf(sent[sent.length - 1]);
  clock += 11 * 60 * 1000;
  const late = await call('joinConfirm', [bob.publicKey, c3]);
  if (late.ok === false) test.check('a code past its 10 minutes takes nothing');
  else test.fail(OWED + 'a late code answered ' + short(late));

  test.subHeading('3. the cap');
  const carl = auth.generateIdentity('carl');
  const n0 = sent.length;
  await call('join', [carl.publicKey, 'carl@example.org', 65432]);
  const soon = await call('join', [carl.publicKey, 'carl@example.org', 65432]);
  if (soon.ok === false && soon.status === 429 && sent.length === n0 + 1) test.check('a second join from one key within a minute is refused 429 and no mail goes');
  else test.fail(OWED + 'a second join at once answered ' + short(soon) + ', mails ' + (sent.length - n0));

  test.subHeading('4. the door takes join and joinConfirm from a stranger');
  let doorStatus = 0;
  try {
    const seal = require('../run/js/seal.js');
    const dora = auth.generateIdentity('dora');
    const text = JSON.stringify(seal.seal(relay.relaySealKey(), dora.publicKey, relay.relayPublicKey(),
      JSON.stringify({ v: 1, body: { join: { email: 'dora@example.org', port: 65432 } } })));
    const r = relay.routePost(dora.publicKey, '', text, auth.sign(dora.privateKey, auth.postMessage(dora.publicKey, '', text)), undefined, '192.0.2.44');
    doorStatus = r && r.ok ? 200 : (r && r.status) || 0;
  } catch (e) { doorStatus = -1; }
  const doraMail = sent.filter(function (m) { return m.to === 'dora@example.org'; }).length;
  if (doorStatus === 200 && doraMail === 1) test.check('a stranger\'s signed join through the door is taken and mails once');
  else test.fail(OWED + 'a stranger\'s join on the door answered ' + doorStatus + ', mails to dora ' + doraMail);

  test.subHeading('5. the node verb and the shell');
  const server = code('js/server.js');
  if (/'relay\.join':\s*\{\s*request:\s*\{\s*url:\s*'',\s*email:\s*'',\s*code:\s*''\s*\}/.test(server)) test.check('server.js declares relay.join {url, email, code}');
  else test.fail(OWED + 'server.js declares no relay.join {url, email, code}');
  const shell = code('js/client/shell.js');
  if (/relay\.join/.test(shell) && /[?&]?join=|get\('join'\)/.test(shell)) test.check('the shell asks relay.join and reads ?join= on load');
  else test.fail(OWED + 'the shell neither asks relay.join nor reads ?join=');
  // THE EMAIL, TYPED ONCE ON FIRST START: an unbound node opens Natter, which opens the claim screen of its relay
  // (shell.js openBinderIfUnbound); the email field sits there and asks relay.join with the email.
  const nd = code('shell/natterDetails/natterDetails.js');
  if (/type="email"|class="nd-join-email"/.test(nd) && /'relay\.join',\s*\{[^}]*email/.test(nd)) test.check('the first-run claim screen (natterDetails) has an email field that asks relay.join with it');
  else test.fail(OWED + 'the first-run screen has no email field asking relay.join');
  const relayServer = code('js/relayServer.js');
  if (/createRelay\.createRelay\([\s\S]{0,1500}sendMail/.test(relayServer) && /createMailgun/.test(relayServer)) test.check('relayServer hands the Mailgun sender to the relay');
  else test.fail(OWED + 'relayServer hands the relay no mailer');

  test.subHeading('6. the first round\'s pages are gone');
  const gone = ['spirit/run/js/faceLogin.js', 'spirit/test/faceLogin.js'].filter(function (p) { return fs.existsSync(path.join(ROOT, p)); });
  if (!gone.length && !/faceLogin/.test(relayServer) && !/keepCode|takeCode|loginHash/.test(code('js/relayStore.js'))) test.check('faceLogin.js, its suite, its wiring and the login code columns are gone');
  else test.fail(OWED + 'still there: ' + short(gone.concat(/faceLogin/.test(relayServer) ? ['faceLogin in relayServer'] : []).concat(/keepCode|takeCode|loginHash/.test(code('js/relayStore.js')) ? ['login code in relayStore'] : [])));
}

main().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  setTimeout(function () { test.reportSuccessFailureCount(); process.exit(0); }, 100);
});
