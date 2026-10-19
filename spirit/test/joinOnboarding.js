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
  // THE PORT THE NODE LISTENS ON (found live, 2026-10-19: a node on 11112 got a mail link to 65432). relay.join hands
  // the hub the listening port first, never the stored default ahead of it.
  const joinLine = (server.split('\n').filter(function (l) { return /'relay\.join'/.test(l); })[0]) || '';
  if (/port:\s*Number\(port\)\s*\|\|/.test(joinLine)) test.check('relay.join hands on the port this node listens on, before any stored default');
  else test.fail(OWED + 'relay.join hands on ' + short((/port:\s*[^,]+/.exec(joinLine) || [''])[0]) + ', not the listening port first');
  const shell = code('js/client/shell.js');
  if (/relay\.join/.test(shell) && /[?&]?join=|get\('join'\)/.test(shell)) test.check('the shell asks relay.join and reads ?join= on load');
  else test.fail(OWED + 'the shell neither asks relay.join nor reads ?join=');
  // THE EMAIL, TYPED ONCE ON FIRST START: an unbound node opens Natter, which opens the claim screen of its relay
  // (shell.js openBinderIfUnbound); the email field sits there and asks relay.join with the email.
  const nd = code('shell/natterDetails/natterDetails.js');
  if (/type="email"|class="nd-join-email"/.test(nd) && /'relay\.join',\s*\{[^}]*email/.test(nd)) test.check('the first-run claim screen (natterDetails) has an email field that asks relay.join with it');
  else test.fail(OWED + 'the first-run screen has no email field asking relay.join');
  const relayServer = code('js/relayServer.js');
  // Through the driver loader since the box's v28 (no vendor in core).
  if (/createRelay\.createRelay\([\s\S]{0,1500}sendMail/.test(relayServer) && /require\('\.\/sendMail'\)\.createSender/.test(relayServer)) test.check('relayServer hands the relay the sender sendMail.js made from mail.json');
  else test.fail(OWED + 'relayServer hands the relay no mailer');

  test.subHeading('6. the first round\'s pages are gone');
  const gone = ['spirit/run/js/faceLogin.js', 'spirit/test/faceLogin.js'].filter(function (p) { return fs.existsSync(path.join(ROOT, p)); });
  if (!gone.length && !/faceLogin/.test(relayServer) && !/keepCode|takeCode|loginHash/.test(code('js/relayStore.js'))) test.check('faceLogin.js, its suite, its wiring and the login code columns are gone');
  else test.fail(OWED + 'still there: ' + short(gone.concat(/faceLogin/.test(relayServer) ? ['faceLogin in relayServer'] : []).concat(/keepCode|takeCode|loginHash/.test(code('js/relayStore.js')) ? ['login code in relayStore'] : [])));

  // ── 7. THE NODE STARTED WITH --email (the box, v26) ─────────────────────────────────────────────────
  // The user starts the node with node js/server.js --email <address>. While the node holds no seat it asks its kept
  // relay to join with that email and the port it listens on; with a seat, --email does nothing. On stdout it prints
  // that a mail will arrive shortly, or why the join did not start (the relay named, what went wrong, what to do
  // next), and then node is listening on 127.0.0.1:<port>. The email is optional; the README documents it as the
  // easiest way onto noderoutes.net.
  // NAMED HERE where the box names none:
  //   - serveCommon.emailFromArgs(argv) reads --email <address> and --email=<address>, '' without one.
  //   - hub.joinAtStart(email, { router, port, keptUrl }) answers { lines }: the lines to print before the listening
  //     line, none without an email or with a seat. It asks through relay.join's own path (hub.relayJoin).
  test.subHeading('7. the node started with --email');
  let emailFromArgs = null;
  try { emailFromArgs = require('../run/js/serveCommon').emailFromArgs; } catch (e) { emailFromArgs = null; }
  const parsed = typeof emailFromArgs === 'function'
    ? [emailFromArgs(['--email', 'ann@example.org']), emailFromArgs(['--port', '11112', '--email=ann@example.org']), emailFromArgs(['--port', '11112'])]
    : null;
  if (parsed && parsed[0] === 'ann@example.org' && parsed[1] === 'ann@example.org' && parsed[2] === '') test.check('--email <address> and --email=<address> are read; no flag gives no email');
  else test.fail(OWED + 'serveCommon.emailFromArgs answered ' + short(parsed));

  // A node home of its own, its router a thin carrier onto the real relay above, so a join at start mails for real.
  const os = require('os');
  const nodeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-joinstart-node-'));
  const fern = auth.generateIdentity('fern');
  const KEPT = 'https://kept.example';
  function carrier(answerOf) {
    return { join: function (url, email, port, c) { return Promise.resolve(answerOf(url, email, port, c)); }, startStreams: function () { return Promise.resolve(); },
      // The card of a relay that sends mail (section 8: the start reads it first).
      relayKey: function () { return Promise.resolve({ relayPublicKey: relay.relayPublicKey(), services: { sendMail: true, face: true } }); } };
  }
  const real = carrier(function (url, email, port, c) { return c ? relay.joinConfirm(fern.publicKey, c) : relay.join(fern.publicKey, email, port); });
  let nodeHub = null;
  try { nodeHub = require('../run/js/hub').createHub(nodeHome); } catch (e) { nodeHub = null; }
  function atStart(email, router) {
    if (!nodeHub || typeof nodeHub.joinAtStart !== 'function') return Promise.resolve({ missing: true, lines: [] });
    return Promise.resolve(nodeHub.joinAtStart(email, { router: router, port: 11112, keptUrl: KEPT })).then(function (r) { return r || { lines: [] }; }, function (e) { return { threw: e.message, lines: [] }; });
  }
  clock += 61 * 60 * 1000;
  const n1 = sent.length;
  const started = await atStart('fern@example.org', real);
  const fernMail = sent.slice(n1).filter(function (m) { return m.to === 'fern@example.org'; })[0] || {};
  const said = (started.lines || []).join('\n');
  if (/http:\/\/127\.0\.0\.1:11112\?join=/.test(String(fernMail.text)) && /mail/i.test(said) && /shortly/i.test(said) && said.indexOf('fern@example.org') !== -1)
    test.check('an unseated node started with --email asks its kept relay: the mail goes to its own port 11112, and stdout says a mail to fern@example.org will arrive shortly');
  else test.fail(OWED + 'a join at start printed ' + short(started) + ', mail ' + short(fernMail));
  const fernCode = codeOf(fernMail);
  if (fernCode) await call('joinConfirm', [fern.publicKey, fernCode]);

  const none = await atStart('', real);
  if (!none.missing && Array.isArray(none.lines) && none.lines.length === 0) test.check('without --email nothing is asked and nothing extra is printed');
  else test.fail(OWED + 'a start without an email answered ' + short(none));

  let seatedHome = null;
  try {
    const rk = require('../run/js/relayKeys');
    rk.accept(nodeHome, KEPT, 'MCowBQYDK2VwAyEAjoinAtStartKeptRelayKeyAAAAAAAAAAAAAAAAA=');
    rk.seat(nodeHome, KEPT, 'fern');
    seatedHome = rk.seatedUrls(nodeHome);
  } catch (e) { seatedHome = ['threw ' + e.message]; }
  let askedWhileSeated = 0;
  const seatedRun = await atStart('fern@example.org', carrier(function () { askedWhileSeated += 1; return { ok: true, status: 200 }; }));
  if (!seatedRun.missing && askedWhileSeated === 0 && (seatedRun.lines || []).length === 0) test.check('a node that holds a seat ignores --email: nothing asked, nothing printed');
  else test.fail(OWED + 'with a seat (' + short(seatedHome) + ') a start asked ' + askedWhileSeated + ' times and printed ' + short(seatedRun));
  try { require('../run/js/relayKeys').unseat(nodeHome, KEPT); } catch (e) { /* the refusals below would then not run */ }

  // EVERY REFUSAL IS A HIGH-QUALITY MESSAGE: the relay named, what went wrong, what to do next.
  const refusals = [
    { why: 'a relay without mail', answer: { ok: false, status: 503, error: 'this relay sends no mail, so it takes no join' }, next: /invite/i },
    { why: 'the cap', answer: { ok: false, status: 429, error: 'a join was asked a moment ago; wait a minute' }, next: /wait a minute/i },
    { why: 'a bad address', answer: { ok: false, status: 400, error: 'an email is one address with an @' }, next: /correct|check the address|spell/i },
    { why: 'the relay unreachable', answer: null, next: /network|reach/i },
  ];
  for (const r of refusals) {
    const out = await atStart('fern@example.org', carrier(function () { if (!r.answer) throw new Error('connect ECONNREFUSED'); return r.answer; }));
    const text = (out.lines || []).join('\n');
    if (text.indexOf('kept.example') !== -1 && r.next.test(text) && !/shortly/i.test(text)) test.check(r.why + ': stdout names the relay and says what to do next (' + short(text) + ')');
    else test.fail(OWED + r.why + ' printed ' + short(out));
  }
  try { fs.rmSync(nodeHome, { recursive: true, force: true }); } catch (e) { /* busy */ }

  // THE WIRING AND THE WORDS: server.js reads --email, prints the join's lines and then the listening line; --help
  // names the flag; the README names the command.
  if (/emailFromArgs\(/.test(server) && /joinAtStart\(/.test(server)) test.check('server.js reads --email and runs the join at start');
  else test.fail(OWED + 'server.js neither reads --email nor runs a join at start');
  if (/node is listening on 127\.0\.0\.1:\$\{port\}/.test(server)) test.check('server.js prints node is listening on 127.0.0.1:<port>');
  else test.fail(OWED + 'server.js prints no "node is listening on 127.0.0.1:<port>" line');
  if (/--email <address>/.test(server)) test.check('--help names --email <address>');
  else test.fail(OWED + '--help does not name --email');
  let readme = '';
  try { readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8'); } catch (e) { readme = ''; }
  if (/node js\/server\.js --email /.test(readme) && /noderoutes\.net/.test(readme)) test.check('the README gives node js/server.js --email as the way onto noderoutes.net');
  else test.fail(OWED + 'the README does not give node js/server.js --email');

  // ── 8. NO VENDOR IN CORE, AND THE CARD SAYS WHAT THE RELAY OFFERS (the box, v28) ─────────────────────
  // js/sendMail.js reads relay-state/mail.json and loads its driver from js/sendMail/<driver>.js, the name checked
  // against that folder; mailgun.js is the first driver there and Mailgun is named nowhere else in core. mail.json
  // names its driver by hand; without one the relay sends no mail, no fallback. The relay card carries
  // services: { sendMail, face }; Natter shows the email field only when the card says sendMail; the --email start
  // reads the same card and, without it, prints the use-an-invite message without asking.
  // NAMED HERE where the box names none:
  //   - sendMail.createSender(rootDir, { fetch }) answers { driver, send } or null; a driver exports
  //     create(settings, fetch) answering { send }.
  //   - relay.relayCard() is exported, as the card a card ask is answered with.
  //   - ownerBadge.probe puts the card's services on every relay row it answers for (row.services).
  //   - joinAtStart asks the card first through router.relayKey(url), the card ask relay.add already uses.
  test.subHeading('8. sendMail drivers, and services in the card');
  const JS = path.join(RUN, 'js');
  const moved = !fs.existsSync(path.join(JS, 'mailgun.js')) && fs.existsSync(path.join(JS, 'sendMail.js')) && fs.existsSync(path.join(JS, 'sendMail', 'mailgun.js'));
  if (moved) test.check('js/mailgun.js is gone; js/sendMail.js and js/sendMail/mailgun.js stand');
  else test.fail(OWED + 'the mail files are not in place: mailgun.js ' + fs.existsSync(path.join(JS, 'mailgun.js')) + ', sendMail.js ' + fs.existsSync(path.join(JS, 'sendMail.js')) + ', sendMail/mailgun.js ' + fs.existsSync(path.join(JS, 'sendMail', 'mailgun.js')));

  let sendMailMod = null;
  try { sendMailMod = require('../run/js/sendMail'); } catch (e) { sendMailMod = null; }
  const mailHome = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-sendmail-'));
  fs.mkdirSync(path.join(mailHome, 'relay-state'), { recursive: true });
  function withMailJson(v) { fs.writeFileSync(path.join(mailHome, 'relay-state', 'mail.json'), JSON.stringify(v)); }
  function sender(v, fetchImpl) {
    withMailJson(v);
    if (!sendMailMod || typeof sendMailMod.createSender !== 'function') return { missing: true };
    try { return sendMailMod.createSender(mailHome, { fetch: fetchImpl }); } catch (e) { return { threw: e.message }; }
  }
  const posts = [];
  const fakeFetch = function (url, opts) { posts.push({ url: url, body: String(opts && opts.body || '') }); return Promise.resolve({ ok: true, status: 200 }); };
  const good = sender({ driver: 'mailgun', url: 'https://api.mail.example', domain: 'relay.example', key: 'k-123' }, fakeFetch);
  let goodSent = null;
  if (good && typeof good.send === 'function') goodSent = await good.send({ to: 'ann@example.org', subject: 's', text: 't' });
  if (goodSent && goodSent.ok === true && posts.length === 1 && posts[0].url === 'https://api.mail.example/v3/relay.example/messages' && /to=ann%40example\.org/.test(posts[0].body))
    test.check('mail.json naming the mailgun driver gives a sender that posts to <url>/v3/<domain>/messages');
  else test.fail(OWED + 'a mailgun sender answered ' + short(good) + ', sent ' + short(goodSent) + ', posts ' + short(posts));
  const noDriver = sender({ url: 'https://api.mail.example', domain: 'relay.example', key: 'k-123' }, fakeFetch);
  const climbs = sender({ driver: '../relay', url: 'https://api.mail.example', domain: 'relay.example', key: 'k-123' }, fakeFetch);
  const unknown = sender({ driver: 'nosuch', url: 'https://api.mail.example', domain: 'relay.example', key: 'k-123' }, fakeFetch);
  if (sendMailMod && noDriver === null && climbs === null && unknown === null) test.check('no driver, a driver name that leaves the folder, or one that is not there: no sender, no fallback');
  else test.fail(OWED + 'no driver gave ' + short(noDriver) + ', ../relay gave ' + short(climbs) + ', nosuch gave ' + short(unknown));
  try { fs.rmSync(mailHome, { recursive: true, force: true }); } catch (e) { /* busy */ }

  // Mailgun is named nowhere in core outside js/sendMail/: code and comments alike.
  const named = [];
  (function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (d) {
      const p = path.join(dir, d.name);
      if (d.isDirectory()) { if (d.name !== 'node_modules' && p !== path.join(JS, 'sendMail')) walk(p); return; }
      if (/\.js$/.test(d.name) && /mailgun/i.test(fs.readFileSync(p, 'utf8'))) named.push(path.relative(RUN, p));
    });
  }(JS));
  if (!named.length) test.check('Mailgun is named nowhere in spirit/run/js outside sendMail/');
  else test.fail(OWED + 'Mailgun is still named in ' + short(named));

  // The card: services { sendMail, face }.
  const cardOf = function (r) { try { return r && typeof r.relayCard === 'function' ? r.relayCard() : null; } catch (e) { return { threw: e.message }; } };
  let bare = null;
  try { bare = require('../run/js/relay').createRelay(home, { now: function () { return clock; } }); } catch (e) { bare = null; }
  const withMail = cardOf(relay);
  const without = cardOf(bare);
  if (withMail && withMail.services && withMail.services.sendMail === true && withMail.services.face === true &&
      without && without.services && without.services.sendMail === false && without.services.face === true)
    test.check('the relay card carries services: sendMail true with a mailer and false without; face true');
  else test.fail(OWED + 'the card with a mailer is ' + short(withMail && withMail.services) + ', without ' + short(without && without.services));

  // The node keeps services on each relay row it probes, claimed or not, so Natter's claim screen can read it.
  const probeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-services-node-'));
  let probed = null;
  try {
    const badgeMod = require('../run/js/ownerBadge');
    const keptUrl = badgeMod.KEPT_RELAY.url;
    badgeMod.ensureRelays(probeHome);
    const cardText = JSON.stringify({ relayPublicKey: badgeMod.KEPT_RELAY.key, ownerKey: 'someone', ownerLabel: 'o', relayLabel: 'r', services: { sendMail: true, face: true } });
    const summary = await badgeMod.probe(probeHome, function () { return Promise.resolve({ status: 200, text: cardText }); }, fern.publicKey);
    probed = ((summary && summary.rows) || []).filter(function (r) { return r.url === keptUrl; })[0] || summary;
  } catch (e) { probed = { threw: e.message }; }
  try { fs.rmSync(probeHome, { recursive: true, force: true }); } catch (e) { /* busy */ }
  if (probed && probed.services && probed.services.sendMail === true && probed.claimed === false) test.check('an unclaimed relay row carries the card\'s services (sendMail true)');
  else test.fail(OWED + 'the probed row is ' + short(probed));
  const pp = code('js/peerPost.js');
  const relayKeyFn = (pp.split('function relayKey(')[1] || '').split('\n  function ')[0];
  if (/services/.test(relayKeyFn)) test.check('peerPost.relayKey hands the card\'s services on');
  else test.fail(OWED + 'peerPost.relayKey drops services from the card');

  if (/services[^\n]{0,80}sendMail/.test(nd) && /nd-join-email/.test(nd)) test.check('natterDetails draws the email field only when the relay row says services.sendMail');
  else test.fail(OWED + 'natterDetails draws the email field without reading services.sendMail');

  // The --email start reads the card first: a relay without mail is answered without asking it to join.
  let joinAsked = 0;
  const noMailCard = { join: function () { joinAsked += 1; return Promise.resolve({ ok: true, status: 200 }); }, relayKey: function () { return Promise.resolve({ relayPublicKey: 'x', services: { sendMail: false, face: true } }); }, startStreams: function () { return Promise.resolve(); } };
  const nodeHome2 = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-joinstart-card-'));
  let hub2 = null;
  try { hub2 = require('../run/js/hub').createHub(nodeHome2); } catch (e) { hub2 = null; }
  let cardRun = null;
  try { cardRun = hub2 && typeof hub2.joinAtStart === 'function' ? await hub2.joinAtStart('fern@example.org', { router: noMailCard, port: 11112, keptUrl: KEPT }) : null; } catch (e) { cardRun = { threw: e.message }; }
  try { fs.rmSync(nodeHome2, { recursive: true, force: true }); } catch (e) { /* busy */ }
  const cardSaid = ((cardRun && cardRun.lines) || []).join('\n');
  if (joinAsked === 0 && /invite/i.test(cardSaid) && cardSaid.indexOf('kept.example') !== -1) test.check('--email at a relay whose card says no sendMail prints the use-an-invite message and asks no join');
  else test.fail(OWED + 'with a card saying no sendMail the start asked ' + joinAsked + ' joins and printed ' + short(cardRun));
}

main().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  setTimeout(function () { test.reportSuccessFailureCount(); process.exit(0); }, 100);
});
