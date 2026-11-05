'use strict';

// spirit/run/spirit/test/relay.js
// The tests of spirit/relay.js, and of no other module (spec: ./relay.md). This file holds goal/G41.29: the join mail
// is sent only for a link to the asker's own computer, and the login mail carries a token and no link. A relay is made
// on a scratch folder of its own, its mailer a stand-in that keeps what it was handed; nothing is sent.

const fs = require('fs');
const os = require('os');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

// A relay on a scratch folder: its identity planted as the relay keeps it (relayAuth beside it), its face domain
// relay.example, its mail kept.
function scratchRelay() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-relay-'));
  const js = path.join(home, 'spirit');
  fs.mkdirSync(js, { recursive: true });
  ['relayAuth.js', 'fieldRules.js'].forEach(function (f) { fs.copyFileSync(path.join(RUN, 'spirit', f), path.join(js, f)); });
  const planted = require(path.join(js, 'relayAuth.js'));
  planted.nameIdentity(home, 'relay');
  // Its owner, written at install as a relay's is: a relay with none seats nobody.
  planted.writeOwner(home, planted.generateIdentity('owner').publicKey);
  fs.mkdirSync(path.join(home, 'spirit', 'state'), { recursive: true });
  fs.writeFileSync(path.join(home, 'spirit', 'state', 'face.json'), JSON.stringify({ domain: 'relay.example' }));
  const mails = [];
  let now = Date.now();
  const relay = require(path.join(RUN, 'spirit', 'relay.js')).createRelay(home, {
    now: function () { return now; },
    sendMail: function (m) { mails.push(m); return Promise.resolve({ ok: true }); },
  });
  return { home: home, relay: relay, mails: mails, auth: planted, later: function (ms) { now += ms; } };
}

test.startTest('relay.js: the join mail and the login mail (goal/G41.29)');

const R = scratchRelay();
const auth = require(path.join(RUN, 'spirit', 'relayAuth.js'));
let n = 0;
// Each ask by a key and a mail of its own, so no cap of a minute or an hour is what refuses it.
function ask(link) {
  n += 1;
  const who = auth.generateIdentity('asker' + n);
  const before = R.mails.length;
  let said = null;
  try { said = R.relay.join(who.publicKey, 'asker' + n + '@example.org', link, ''); } catch (e) { said = { ok: false, error: String(e && e.message || e) }; }
  return { said: said || {}, mail: R.mails.length > before ? R.mails[R.mails.length - 1] : null };
}

test.subHeading('the join mail goes only to a link on the asker\'s own computer');
// The box: "the relay must refuse to send a join-email, unless the link in it points to the asker's own computer, so
// senders cannot use the relay to send phishing emails. The relay reads the link as an address, the way a browser
// does, and sends the mail only when all of these hold: the scheme is exactly http, the host is exactly 127.0.0.1, the
// port is any port, or none, there is no user name or password (nothing before an @), the path starts with \"/\"".
const NODE = 'http://127.0.0.1:65432/face.html?app=join';
const a = ask(NODE);
ok(a.said.ok === true && !!a.mail && a.mail.text.indexOf(NODE) !== -1, 'the link a node sends, ' + NODE + ', is mailed', 'said ' + short(a.said) + ', mail ' + short(a.mail));
const b = ask('http://127.0.0.1/face.html?app=join');
ok(b.said.ok === true && !!b.mail, 'with no port, it is mailed', 'said ' + short(b.said) + ', mail ' + short(b.mail));
[
  ['https://127.0.0.1:65432/face.html', 'the scheme is not exactly http'],
  ['http://localhost:65432/face.html', 'the host is not exactly 127.0.0.1'],
  ['http://evil.com/face.html', 'the host is another site'],
  ['http://127.0.0.1.evil.com/face.html', 'a host that only begins with 127.0.0.1 (the box: "http://127.0.0.1.evil.com/")'],
  ['http://127.0.0.1:1@evil.com/face.html', 'a user name and password before an @, the site evil.com (the box: "http://127.0.0.1:1@evil.com/")'],
  ['http://user@127.0.0.1:65432/face.html', 'a user name before an @, even on 127.0.0.1'],
  ['http://127.0.0.2:65432/face.html', 'another loopback address, not exactly 127.0.0.1'],
  ['http://evil.com/?http://127.0.0.1:65432/', '127.0.0.1 only in the query, the site evil.com'],
].forEach(function (c) {
  const r = ask(c[0]);
  ok(r.said.ok === false && !r.mail, 'refused, and no mail sent: ' + c[0] + ' (' + c[1] + ')', c[0] + ': said ' + short(r.said) + ', mail ' + (r.mail ? 'sent' : 'none'));
});

test.subHeading('the login mail carries the token, where to paste it, and no link');
// The box: "The login-email must not carry a link, so a fake login-email cannot lead the user to a look-alike site",
// "it carries the token only, on a line of its own, easy to copy.", "it carries a text that says where to paste it:
// \"Open your face by typing its address or from your bookmark, never from a link in a mail, and paste this token into
// its Log in field.\"", and "it does not write out the face's address either".
const SAY = 'Open your face by typing its address or from your bookmark, never from a link in a mail, and paste this token into its Log in field.';
const bert = auth.generateIdentity('bert');
let login = null;
try {
  R.later(2 * 60 * 1000);
  const j = R.relay.join(bert.publicKey, 'bert@example.org', NODE, '');
  const code = ((/[?&]join=([A-Za-z0-9_-]+)/.exec((R.mails[R.mails.length - 1] || {}).text || '')) || [])[1] || '';
  R.relay.joinConfirm(bert.publicKey, code, '');
  require(path.join(RUN, 'spirit', 'relayStore.js')).open(R.home).members.setFace(bert.publicKey, 'harbour', 'bert@example.org');
  R.later(2 * 60 * 1000);
  const before = R.mails.length;
  R.relay.faceLogin('harbour', 'bert@example.org');
  login = R.mails.length > before ? R.mails[R.mails.length - 1] : null;
  void j;
} catch (e) { login = null; test.comment('the face member could not be made: ' + (e && e.message || e)); }
const text = String((login && login.text) || '');
const lines = text.split(/\r?\n/).map(function (l) { return l.trim(); });
const token = lines.filter(function (l) { return /^[A-Za-z0-9_-]{16,}$/.test(l); })[0] || '';
ok(!!login, 'asked with the member\'s own email, the relay mails a login', 'no login mail was sent');
ok(!!token, 'the token stands on a line of its own', 'no line holds the token alone: ' + short(text));
ok(text.indexOf(SAY) !== -1, 'it says where to paste it: "' + SAY + '"', 'the mail says: ' + short(text));
ok(!!login && !/https?:\/\/|www\./i.test(text), 'it holds no link', 'the mail holds a link: ' + short(text));
ok(!!login && !/harbour\.relay\.example|relay\.example/i.test(text), 'it does not write out the face\'s address', 'the mail names the address: ' + short(text));
let pasted = null;
try { pasted = token ? R.relay.faceLogin('harbour', token) : null; } catch (e) { pasted = null; }
ok(!!pasted && pasted.loggedIn === true, 'the token, pasted into the Log in field, logs in', 'faceLogin with the token: ' + short(pasted));

try { fs.rmSync(R.home, { recursive: true, force: true }); } catch (e) { /* scratch */ }

// A LONG SEARCH MUST NOT STOP THE RELAY (goal/G41.30; the box: "the server MUST not CRASH or HANG", "an attacker trying
// to crash our servers will throw ANYTHING at the api. Imitate that attacker!"; Andy, on the report "A long search query
// stalls the relay's event loop for seconds": "fix this now. in this item"). A relay with MEMBERS connected members;
// one of them sends the longest search the wire carries, sealed to the relay as every ask is. While it is answered the
// relay's event loop is watched: a tick every 5 ms must never wait longer than GAP_MS, so every other request on the
// relay keeps being served, and the search must still be answered.
const MEMBERS = 500;
const GAP_MS = 250;
async function longSearch() {
  test.subHeading('a search as long as the wire carries does not stop the relay answering others');
  const limits = require(path.join(RUN, 'spirit', 'limits.js'));
  const seal = require(path.join(RUN, 'spirit', 'seal.js'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-relay-search-'));
  fs.mkdirSync(path.join(home, 'spirit', 'state'), { recursive: true });
  auth.saveIdentity(home, auth.generateIdentity('relay'));
  const owner = auth.generateIdentity('owner');
  auth.writeOwner(home, owner.publicKey);
  const box = require(path.join(RUN, 'spirit', 'relay.js')).createRelay(home);
  box.claim('owner', auth.sign(owner.privateKey, auth.claimMessage('owner')), owner.publicKey);
  // Each member seated by an invite of the owner's and connected by its stream, as a node connects.
  const heard = [];
  let asker = null; let seated = 0;
  for (let i = 0; i < MEMBERS; i++) {
    const name = 'm' + i;
    const id = auth.generateIdentity(name);
    const minted = box.mint('owner', name, 7, '');
    if (!minted || !minted.invite) continue;
    const c = box.claim(name, auth.sign(id.privateKey, auth.claimMessage(name)), id.publicKey, null, minted.invite.token, name);
    if (!c || c.ok === false) continue;
    const sink = { write: function (chunk) { if (id === asker) heard.push(String(chunk)); return true; }, close: function () {} };
    if (!asker) asker = id;
    const s = box.streamOpen(id.publicKey, auth.sign(id.privateKey, auth.streamMessage(id.publicKey, box.relayPublicKey())), sink);
    if (s && s.ok === false) continue;
    seated += 1;
  }
  ok(seated === MEMBERS, MEMBERS + ' members seated and connected', 'only ' + seated + ' of ' + MEMBERS + ' members were seated and connected: the search would rank fewer rows than asked');
  const relayKey = box.relayPublicKey();
  // The longest sealed search the wire takes: from 3/4 of the payload down, until the relay takes the post.
  const sealedAsk = function (len) {
    const q = ('abcdefghij ').repeat(Math.ceil(len / 11)).slice(0, len);
    const sealed = seal.seal(box.relaySealKey(), asker.publicKey, relayKey, JSON.stringify({ v: 1, body: { search: { q: q } } }));
    return JSON.stringify(sealed);
  };
  let len = Math.floor(limits.PAYLOAD_MAX * 3 / 4); let text = sealedAsk(len);
  while (len > 1000 && Buffer.byteLength(text, 'utf8') > limits.PAYLOAD_MAX) { len -= 250; text = sealedAsk(len); }
  test.comment('the search: ' + len + ' characters, ' + Buffer.byteLength(text, 'utf8') + ' bytes sealed, over ' + seated + ' connected members (a longer one, as the report\'s 60,000, is refused 413 by the wire)');
  ok(len >= 12000, 'the search thrown is ' + len + ' characters, near 3/4 of the payload', 'only ' + len + ' characters fit: the search judges too little');
  let last = Date.now(); let gap = 0;
  const tick = setInterval(function () { const n = Date.now(); gap = Math.max(gap, n - last); last = n; }, 5);
  const before = heard.length;
  const t0 = Date.now();
  const posted = box.routePost(asker.publicKey, relayKey, text, auth.sign(asker.privateKey, auth.postMessage(asker.publicKey, relayKey, text)));
  const inPost = Date.now() - t0;
  let answered = false;
  for (let i = 0; i < 200 && !answered; i++) { await new Promise(function (r) { setTimeout(r, 25); }); answered = heard.length > before; }
  clearInterval(tick);
  const worst = Math.max(gap, inPost);
  ok(!!posted && posted.ok !== false, 'the relay takes the search', 'the relay refused the search: ' + short(posted));
  ok(worst <= GAP_MS, 'while it searches, the relay keeps answering: its event loop never waited more than ' + GAP_MS + ' ms (worst ' + worst + ' ms)',
    'IT HANGS: one search of ' + len + ' characters over ' + seated + ' members held the relay\'s event loop for ' + worst + ' ms (more than ' + GAP_MS + '), every other request on the relay waiting');
  ok(answered, 'and the search is answered', 'the search was never answered within 5 s');
  try { fs.rmSync(home, { recursive: true, force: true }); } catch (e) { /* scratch */ }
}

longSearch().then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
