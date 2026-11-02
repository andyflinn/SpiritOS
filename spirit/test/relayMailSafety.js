'use strict';

// spirit/test/relayMailSafety.js
// goal/G41.29: the relay's mails cannot be used for phishing. Red on today's tree; claude-windows writes it (the red job
// was handed to it). The box (v5), in short:
//   - the relay refuses to send a join-email unless the link in it points to the asker's own computer. It reads the
//     link as an address, the way a browser does, and sends the mail only when all of these hold: the scheme is exactly
//     http; the host is exactly 127.0.0.1; the port is any port, or none; there is no user name or password (nothing
//     before an @); the path starts with "/". A text test is not enough: http://127.0.0.1.evil.com/ and
//     http://127.0.0.1:1@evil.com/ both pass one.
//   - the login-email carries no link: the token alone, on a line of its own; a text saying where to paste it ("Open
//     your face by typing its address or from your bookmark, never from a link in a mail, and paste this token into its
//     Log in field."); and not the face's address written out, since mail programs turn an address into a link.
// NAMED HERE where the box names none:
//   - createRelay(...).join(publicKey, email, link, card) refuses a link that fails the rule with status 400 and sends
//     no mail; faceLogin(name, email) sends the login mail.
//   - relayServer.js: with no link in the mail, the face page (GET / and /face.html) no longer logs in from a token in
//     its address; the token is pasted into the Log in field (POST /face/api login) only.
// rule/11: through testSupport only; its own scratch folders.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G41.29: ';
const RUN = path.join(__dirname, '..', 'run');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const code = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'); } catch (e) { return ''; } };

test.startTest('goal/G41.29: the relay\'s mails cannot be used for phishing');

const auth = require('../run/spirit/relayAuth');
const plant = require('./plantIdentity.js');
const relayStore = require('../run/spirit/relayStore');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'g4129-'));
plant.ensureAt(home, 'relay');
const owner = auth.generateIdentity('andy');
auth.writeOwner(home, owner.publicKey);
fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
fs.writeFileSync(path.join(home, 'relay-state', 'face.json'), JSON.stringify({ domain: 'relay.example' }));
const mails = [];
let now = Date.now();
let box = null;
try {
  box = require('../run/spirit/relay').createRelay(home, { now: function () { return now; }, sendMail: function (m) { mails.push(m); return Promise.resolve({ ok: true }); } });
} catch (e) { box = null; }

// One join, by a fresh key and a fresh address each, so the caps (one a minute, five an hour) never stand in the way.
let n = 0;
function joinWith(link) {
  n += 1;
  const who = auth.generateIdentity('asker' + n);
  const before = mails.length;
  let said = null;
  try { said = box.join(who.publicKey, 'asker' + n + '@example.org', link, ''); } catch (e) { said = { threw: e.message }; }
  return { link: link, said: said, mailed: mails.length - before, text: mails.length > before ? String(mails[mails.length - 1].text || '') : '' };
}

test.subHeading('1. a join-email goes out only for a link to the asker\'s own computer');
const good = [
  'http://127.0.0.1:65432/face.html?app=join',
  'http://127.0.0.1:4242/',
  'http://127.0.0.1/face.html',
];
const bad = [
  'http://127.0.0.1.evil.com/',
  'http://127.0.0.1:1@evil.com/',
  'http://127.0.0.1:80@evil.com/face.html',
  'http://user:pass@127.0.0.1:65432/face.html',
  'https://127.0.0.1:65432/face.html',
  'http://localhost:65432/face.html',
  'http://127.0.0.2:65432/face.html',
  'http://evil.com/?http://127.0.0.1/',
  'https://phish.example/login',
];
const goods = good.map(joinWith);
const bads = bad.map(joinWith);
goods.forEach(function (g) {
  if (g.said && g.said.ok === true && g.mailed === 1 && g.text.indexOf(g.link) !== -1)
    test.check('mailed: ' + g.link);
  else test.fail(OWED + 'the join with ' + g.link + ' should be mailed: ' + short(g));
});
bads.forEach(function (b) {
  if (b.said && b.said.ok === false && b.said.status === 400 && b.mailed === 0)
    test.check('refused, no mail: ' + b.link);
  else test.fail(OWED + 'the join with ' + b.link + ' must be refused with 400 and no mail: ' + short({ said: b.said, mailed: b.mailed }));
});

test.subHeading('2. the login-email carries the token alone, where to paste it, and no link');
// Bert: a seat and a verified email through the join loop, with a good link, and a face name as the face verb writes it.
const bert = auth.generateIdentity('bert');
try {
  box.join(bert.publicKey, 'bert@example.org', 'http://127.0.0.1:4242/face.html?app=join', '');
  const joinCode = ((/[?&]join=([A-Za-z0-9_-]+)/.exec((mails[mails.length - 1] || {}).text || '')) || [])[1] || '';
  box.joinConfirm(bert.publicKey, joinCode, '');
  relayStore.open(home).members.setFace(bert.publicKey, 'harbour', 'bert@example.org');
} catch (e) { /* the checks below say what is missing */ }
now += 2 * 60 * 1000;
let mail = null;
try {
  const before = mails.length;
  box.faceLogin('harbour', 'bert@example.org');
  mail = mails.length > before ? mails[mails.length - 1] : null;
} catch (e) { mail = { threw: e.message }; }
const text = String((mail && mail.text) || '');
const lines = text.split(/\r?\n/).map(function (l) { return l.trim(); });
const token = lines.filter(function (l) { return /^[A-Za-z0-9_-]{16,}$/.test(l); })[0] || '';
if (mail && mail.to === 'bert@example.org' && token)
  test.check('the login mail goes to bert\'s verified email with the token on a line of its own');
else test.fail(OWED + 'no login mail with the token on a line of its own: ' + short(mail));
if (text && !/https?:\/\//i.test(text) && !/www\./i.test(text))
  test.check('it holds no link');
else test.fail(OWED + 'the login mail holds a link: ' + short(text));
if (text && text.toLowerCase().indexOf('harbour.relay.example') === -1 && text.toLowerCase().indexOf('relay.example') === -1)
  test.check('it does not write out the face\'s address');
else test.fail(OWED + 'the login mail writes out the face\'s address: ' + short(text));
const SAYS = 'Open your face by typing its address or from your bookmark, never from a link in a mail, and paste this token into its Log in field.';
if (text.replace(/\s+/g, ' ').indexOf(SAYS) !== -1)
  test.check('it says where to paste the token, in the box\'s words');
else test.fail(OWED + 'the login mail does not say "' + SAYS + '": ' + short(text));
let logged = null;
try { logged = box.faceLogin('harbour', token); } catch (e) { logged = { threw: e.message }; }
if (logged && logged.loggedIn === true)
  test.check('the token pasted into the Log in field logs in');
else test.fail(OWED + 'the pasted token did not log in: ' + short(logged));

test.subHeading('3. the face page no longer logs in from a token in its address');
const server = code('spirit/relayServer.js');
const at = server.indexOf("pathname === '/face.html'");
const page = at === -1 ? '' : server.slice(at, server.indexOf("faceSend(res, 200, '../face.html')", at));
if (page && !/faceLogin/.test(page) && !/url\.search/.test(page))
  test.check('GET / and /face.html serve the page and log nobody in from the address');
else test.fail(OWED + 'the face page still logs in from a token in its address: ' + short(page));
const logins = (server.match(/relay\.faceLogin\(/g) || []).length;
if (logins === 1)
  test.check('relayServer.js logs in at one place: the Log in field\'s POST');
else test.fail(OWED + 'relayServer.js calls faceLogin at ' + logins + ' places');

try { fs.rmSync(home, { recursive: true, force: true }); } catch (e) { /* busy */ }
test.reportSuccessFailureCount();
process.exit(0);
