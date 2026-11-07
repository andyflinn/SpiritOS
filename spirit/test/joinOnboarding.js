'use strict';

// spirit/test/joinOnboarding.js
// goal/G30.2, "Onboarding a node onto a relay": a newly installed node joins a relay by its user's email; the only
// thing typed is the email, once, in the shell. The item's box, in short:
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
//   - Mail: Mailgun, configured by spirit/state/mail.json, as built in the first round.
// NAMED HERE where the box names none:
//   - relay.js: createRelay(rootDir, { sendMail }) takes the mailer; relay.join(publicKey, email, port) and
//     relay.joinConfirm(publicKey, code) are what the two door posts call, as relay.claim is for a claim. join answers
//     { ok } and never the code; joinConfirm answers { ok, status: 201, peer } like a claim.
//   - A label that is taken still seats: two johns are allowed today, so john@a and john@b both become john.
//   - The shell's own file (spirit/run/spirit/client/shell.js) asks relay.join, and reads ?join= on load.
// rule/11: through testSupport only; its own scratch folders.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const world = require('./world');
const auth = require('../run/spirit/relayAuth');

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
  relay = require('../run/spirit/relay').createRelay(home, { now: function () { return clock; }, sendMail: function (m) { sent.push(m); return Promise.resolve({ ok: true }); } });
} catch (e) { relay = null; }
function call(name, args) {
  if (!relay || typeof relay[name] !== 'function') return Promise.resolve({ ok: false, status: 0, error: 'relay.' + name + ' is missing' });
  try { return Promise.resolve(relay[name].apply(null, args)).then(function (r) { return r || {}; }, function (e) { return { ok: false, status: 0, error: e.message }; }); }
  catch (e) { return Promise.resolve({ ok: false, status: 0, error: e.message }); }
}

async function main() {
  test.subHeading('5. the node verb and the shell');
  const server = code('spirit/server.js');
  // THE PORT THE NODE LISTENS ON: relay.join hands the hub the listening port first, never the stored default ahead of
  // it, so a node on 11112 never gets a mail link to 65432.
  const joinLine = (server.split('\n').filter(function (l) { return /'join':\s*\{[\s\S]*hub\.relayJoin/.test(l); })[0]) || '';
  if (/port:\s*Number\(port\)\s*\|\|/.test(joinLine)) test.check('relay.join hands on the port this node listens on, before any stored default');
  else test.fail(OWED + 'relay.join hands on ' + short((/port:\s*[^,]+/.exec(joinLine) || [''])[0]) + ', not the listening port first');
  const relayServer = code('spirit/relayServer.js');
  // Through the driver loader (no vendor in core).
  if (/createRelay\.createRelay\([\s\S]{0,1500}sendMail/.test(relayServer) && /require\('\.\/sendMail'\)\.createSender/.test(relayServer)) test.check('relayServer hands the relay the sender sendMail.js made from mail.json');
  else test.fail(OWED + 'relayServer hands the relay no mailer');

  test.subHeading('6. the first round\'s pages are gone');
  // The face login is goal/G30.9's (relay.faceLogin; the relay login's suite is now
  // spirit/run/spirit/test/faceLogin.js, goal/G43.18). What stays gone is the first round's: its module and the login code it stored.
  const gone = ['spirit/run/spirit/faceLogin.js'].filter(function (p) { return fs.existsSync(path.join(ROOT, p)); });
  if (!gone.length && !/keepCode|takeCode|loginHash/.test(code('spirit/relayStore.js'))) test.check('the first round\'s faceLogin.js and its stored login code columns are gone');
  else test.fail(OWED + 'still there: ' + short(gone.concat(/keepCode|takeCode|loginHash/.test(code('spirit/relayStore.js')) ? ['login code in relayStore'] : [])));

  // ── 7. THE NODE STARTED WITH --email ─────────────────────────────────────────────────────────────────
  // The user starts the node with node spirit/server.js --email <address>. While the node holds no seat it asks its kept
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
  try { emailFromArgs = require('../run/spirit/serveCommon').emailFromArgs; } catch (e) { emailFromArgs = null; }
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
  try { nodeHub = require('../run/spirit/hub').createHub(nodeHome); } catch (e) { nodeHub = null; }
  function atStart(email, router) {
    if (!nodeHub || typeof nodeHub.joinAtStart !== 'function') return Promise.resolve({ missing: true, lines: [] });
    return Promise.resolve(nodeHub.joinAtStart(email, { router: router, port: 11112, keptUrl: KEPT })).then(function (r) { return r || { lines: [] }; }, function (e) { return { threw: e.message, lines: [] }; });
  }
  clock += 61 * 60 * 1000;

  const none = await atStart('', real);
  if (!none.missing && Array.isArray(none.lines) && none.lines.length === 0) test.check('without --email nothing is asked and nothing extra is printed');
  else test.fail(OWED + 'a start without an email answered ' + short(none));

  let seatedHome = null;
  try {
    const rk = require('../run/spirit/relayKeys');
    rk.accept(nodeHome, KEPT, 'MCowBQYDK2VwAyEAjoinAtStartKeptRelayKeyAAAAAAAAAAAAAAAAA=');
    rk.seat(nodeHome, KEPT, 'fern');
    seatedHome = rk.seatedUrls(nodeHome);
  } catch (e) { seatedHome = ['threw ' + e.message]; }
  let askedWhileSeated = 0;
  const seatedRun = await atStart('fern@example.org', carrier(function () { askedWhileSeated += 1; return { ok: true, status: 200 }; }));
  if (!seatedRun.missing && askedWhileSeated === 0 && (seatedRun.lines || []).length === 0) test.check('a node that holds a seat ignores --email: nothing asked, nothing printed');
  else test.fail(OWED + 'with a seat (' + short(seatedHome) + ') a start asked ' + askedWhileSeated + ' times and printed ' + short(seatedRun));
  try { require('../run/spirit/relayKeys').unseat(nodeHome, KEPT); } catch (e) { /* the refusals below would then not run */ }

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
  if (/node spirit\/server\.js --email /.test(readme) && /noderoutes\.net/.test(readme)) test.check('the README gives node spirit/server.js --email as the way onto noderoutes.net');
  else test.fail(OWED + 'the README does not give node spirit/server.js --email');

  // ── 8. NO VENDOR IN CORE, AND THE CARD SAYS WHAT THE RELAY OFFERS ────────────────────────────────────
  // spirit/run/spirit/sendMail.js reads <home>/spirit/state/mail.json and loads its driver from sendMail/<driver>.js, the name checked
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
  const JS = path.join(RUN, 'spirit');
  const moved = !fs.existsSync(path.join(JS, 'mailgun.js')) && fs.existsSync(path.join(JS, 'sendMail.js')) && fs.existsSync(path.join(JS, 'sendMail', 'mailgun.js'));
  if (moved) test.check('spirit/mailgun.js is gone; js/sendMail.js and js/sendMail/mailgun.js stand');
  else test.fail(OWED + 'the mail files are not in place: mailgun.js ' + fs.existsSync(path.join(JS, 'mailgun.js')) + ', sendMail.js ' + fs.existsSync(path.join(JS, 'sendMail.js')) + ', sendMail/mailgun.js ' + fs.existsSync(path.join(JS, 'sendMail', 'mailgun.js')));

  let sendMailMod = null;
  try { sendMailMod = require('../run/spirit/sendMail'); } catch (e) { sendMailMod = null; }
  const mailHome = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-sendmail-'));
  fs.mkdirSync(path.join(mailHome, 'spirit', 'state'), { recursive: true });
  function withMailJson(v) { fs.writeFileSync(path.join(mailHome, 'spirit', 'state', 'mail.json'), JSON.stringify(v)); }
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

  // Mailgun is named nowhere in spirit/run/spirit outside sendMail/: code and comments alike.
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
  try { bare = require('../run/spirit/relay').createRelay(home, { now: function () { return clock; } }); } catch (e) { bare = null; }
  const withMail = cardOf(relay);
  const without = cardOf(bare);
  if (withMail && withMail.services && withMail.services.sendMail === true && withMail.services.face === true &&
      without && without.services && without.services.sendMail === false && without.services.face === true)
    test.check('the relay card carries services: sendMail true with a mailer and false without; face true');
  else test.fail(OWED + 'the card with a mailer is ' + short(withMail && withMail.services) + ', without ' + short(without && without.services));

  // THE RELAY ROW: relay.get's row, built by hub.relaySummary from local state, carries the card's services, claimed
  // or not. The list asks no relay (goal/G22.4): it reads what peerPost
  // already knows from the cards it asked (the boot probe, relay.add), router.servicesOf(url).
  const rowHome = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-services-row-'));
  let mailRow = null;
  let plainRow = null;
  const cardAsks = {};
  try {
    const badgeMod = require('../run/spirit/ownerBadge');
    badgeMod.ensureRelays(rowHome);
    badgeMod.addRelay(rowHome, 'https://mail.example', 'mail', 'MCowBQYDK2VwAyEAservicesRowMailRelayKeyAAAAAAAAAAAAAAAAAA=');
    badgeMod.addRelay(rowHome, 'https://plain.example', 'plain', 'MCowBQYDK2VwAyEAservicesRowPlainRelayKeyAAAAAAAAAAAAAAAAA=');
    const rowHub = require('../run/spirit/hub').createHub(rowHome);
    const cardRouter = {
      relayKey: function (url) {
        cardAsks[url] = (cardAsks[url] || 0) + 1;
        return Promise.resolve({ relayPublicKey: 'k', services: { sendMail: url === 'https://mail.example', face: true } });
      },
      servicesOf: function (url) { return { sendMail: url === 'https://mail.example', face: true }; },
    };
    await rowHub.relayGet({ key: 'https://mail.example' }, { router: cardRouter });
    mailRow = ((await rowHub.relayGet({ key: 'https://mail.example' }, { router: cardRouter })) || {}).relay;
    plainRow = ((await rowHub.relayGet({ key: 'https://plain.example' }, { router: cardRouter })) || {}).relay;
  } catch (e) { mailRow = { threw: e.message }; }
  try { fs.rmSync(rowHome, { recursive: true, force: true }); } catch (e) { /* busy */ }
  if (mailRow && mailRow.services && mailRow.services.sendMail === true && mailRow.claimed === false &&
      plainRow && plainRow.services && plainRow.services.sendMail === false)
    test.check('relay.get\'s row for an unseated relay carries its card\'s services: sendMail true where it sends mail, false where not');
  else test.fail(OWED + 'relay.get rows: mail ' + short(mailRow) + ', plain ' + short(plainRow));
  if (!Object.keys(cardAsks).length) test.check('the list asks no relay for it: no card ask during relay.get (goal/G22.4)');
  else test.fail(OWED + 'relay.get asked cards: ' + short(cardAsks));
  // peerPost keeps what each card said, and hands it back without a call.
  const ppNow = code('spirit/peerPost.js');
  const relayKeyBody = (ppNow.split('function relayKey(')[1] || '').split('\n  function ')[0];
  if (/servicesByUrl\[[^\]]+\]\s*=/.test(relayKeyBody) && /servicesOf:\s*servicesOf/.test(ppNow)) test.check('peerPost keeps each card\'s services when it asks the card, and answers servicesOf(url) without a call');
  else test.fail(OWED + 'peerPost does not keep the card\'s services');
  const pp = code('spirit/peerPost.js');
  const relayKeyFn = (pp.split('function relayKey(')[1] || '').split('\n  function ')[0];
  if (/services/.test(relayKeyFn)) test.check('peerPost.relayKey hands the card\'s services on');
  else test.fail(OWED + 'peerPost.relayKey drops services from the card');


  // The --email start reads the card first: a relay without mail is answered without asking it to join.
  let joinAsked = 0;
  const noMailCard = { join: function () { joinAsked += 1; return Promise.resolve({ ok: true, status: 200 }); }, relayKey: function () { return Promise.resolve({ relayPublicKey: 'x', services: { sendMail: false, face: true } }); }, startStreams: function () { return Promise.resolve(); } };
  const nodeHome2 = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-joinstart-card-'));
  let hub2 = null;
  try { hub2 = require('../run/spirit/hub').createHub(nodeHome2); } catch (e) { hub2 = null; }
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
