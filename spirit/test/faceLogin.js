'use strict';

// spirit/test/faceLogin.js
// goal/G30.9: a member logs in on his face, served by the relay. Red on today's tree; claude-windows writes it and
// builds it (one agent). The box (v12), in short:
//   - The relay serves face.html, the lazy-load version of the shell, at <face>.<relay host> to anyone, logged in or
//     not, while that member has a verified email, a face name and his home node present. Logged out, the shell is
//     empty but for the login app.
//   - The login app is the counterpart of the node's Join app: a steps app on the same design.
//   - Its one field takes the member's verified email or the token from the mail; the page never says which it got.
//   - The relay decides the login and sends the mail: the token alone, and a link to <face>.<relay host>/?<token>.
//   - The token is used once and is good for 10 minutes, with the join's caps: one a minute, five an hour per face.
//   - A login is a cookie for that face host, valid until 7 days after the last interaction; Log out ends it.
//   - After login the login app says "waiting for plumbing". (Superseded by goal/G30.11: "After this item the face shell
//     is no longer waiting for plumbing". The second step is the link to the home node, checked below as that.)
//   - Certificates, DNS and Caddy on the relay box come from scripts in ./bash.
// NAMED HERE where the box names none:
//   - relay-state/face.json { "domain": "<relay host>" }, placed by the owner as mail.json is (bash/face-setup writes
//     it). Without it the relay serves no face.
//   - createRelay(...) answers faceAt(host) -> { ok, name } when that host is a face the relay serves now;
//     faceLogin(name, text) -> { ok: true, loggedIn, session? } (a token logs in; the member's email gets a mail; the
//     answer to anything else is the email's answer); faceSession(sid) -> { ok, name } sliding 7 days idle;
//     faceLogout(sid). Sessions are kept in the relay's memory (no new stored shape), so a relay restart logs faces out.
//   - relayServer.js: a request whose Host is a face is answered by the face, before the 404: GET / is face.html (with
//     ?<token> it logs in and sets the cookie spirit_face), POST /face/api { verb: login | state | logout }; GET
//     /face/allowed?domain=<host> answers 200 for a face it serves, for Caddy's on-demand certificate.
//   - spirit/run/face.html, spirit/run/shell/boot.js, spirit/run/shell/login/login.json (steps: login, plumbing) and
//     login.js (onSteps), bash/face-setup.
// rule/11: through testSupport only; its own scratch folders.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G30.9: ';
const RUN = path.join(__dirname, '..', 'run');
const ROOT = path.join(__dirname, '..', '..');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }
const code = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'); } catch (e) { return ''; } };
const homes = [];

test.startTest('goal/G30.9: a member logs in on his face, served by the relay');

const auth = require('../run/spirit/relayAuth');
const plant = require('./plantIdentity.js');
const relayStore = require('../run/spirit/relayStore');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'g309-'));
homes.push(home);
plant.ensureAt(home, 'relay');
const owner = auth.generateIdentity('andy');
const bert = auth.generateIdentity('bert');
auth.writeOwner(home, owner.publicKey);
fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
fs.writeFileSync(path.join(home, 'relay-state', 'face.json'), JSON.stringify({ domain: 'relay.example' }));
const mails = [];
let now = Date.now();
let box = null;
try {
  box = require('../run/spirit/relay').createRelay(home, { now: function () { return now; }, sendMail: function (m) { mails.push(m); return Promise.resolve({ ok: true }); } });
} catch (e) { box = null; }
const has = function (fn) { return box && typeof box[fn] === 'function'; };
const tokenOf = function () { const last = mails[mails.length - 1]; const m = last && /\?([A-Za-z0-9_-]{16,})/.exec(last.text); return m ? m[1] : ''; };

// Bert: a seat and a verified email through the join loop (goal/G30.1), and a face name as the face verb writes it.
// The join's mail is set aside, so the counts below are the login's.
try {
  box.join(bert.publicKey, 'bert@example.org', 4242, '');
  const code = ((/\?join=([A-Za-z0-9_-]+)/.exec((mails[0] || {}).text || '')) || [])[1] || '';
  box.joinConfirm(bert.publicKey, code, '');
  relayStore.open(home).members.setFace(bert.publicKey, 'harbour', 'bert@example.org');
} catch (e) { /* the checks below say what is missing */ }
mails.length = 0;
now += 2 * 60 * 1000;
function openStream() {
  return box.streamOpen(bert.publicKey, auth.sign(bert.privateKey, auth.streamMessage(bert.publicKey, box.relayPublicKey())), { write: function () {}, end: function () {} });
}

test.subHeading('1. the relay serves a face while its member has a verified email, a face name and his node present');
let served = null;
try {
  const before = has('faceAt') ? box.faceAt('harbour.relay.example') : null;
  const opened = openStream();
  served = {
    absent: before,
    present: has('faceAt') ? box.faceAt('harbour.relay.example') : null,
    unknown: has('faceAt') ? box.faceAt('nobody.relay.example') : null,
    bare: has('faceAt') ? box.faceAt('relay.example') : null,
    opened: !!(opened && opened.ok !== false),
  };
} catch (e) { served = { threw: e.message }; }
if (served && served.present && served.present.ok === true && served.present.name === 'harbour' && served.absent && served.absent.ok === false
    && served.unknown && served.unknown.ok === false && served.bare && served.bare.ok === false)
  test.check('harbour.relay.example is served while bert\'s node holds its stream, not before; an unknown name and the bare domain are not faces');
else test.fail(OWED + 'faceAt answered ' + short(served));

test.subHeading('2. one field: the email gets a mail, anything else the same answer, a token logs in');
let login = null;
try {
  const wrong = box.faceLogin('harbour', 'not-it');
  const mailsAfterWrong = mails.length;
  const email = box.faceLogin('harbour', 'Bert@Example.org');
  const mail = mails[mails.length - 1] || {};
  const again = box.faceLogin('harbour', 'bert@example.org');
  login = { wrong: wrong, email: email, again: again, mailsAfterWrong: mailsAfterWrong, mails: mails.length, to: mail.to, text: mail.text || '', token: tokenOf() };
} catch (e) { login = { threw: e.message }; }
const L = login || {};
if (L.wrong && L.email && JSON.stringify(L.wrong) === JSON.stringify(L.email) && L.wrong.loggedIn === false && L.mailsAfterWrong === 0)
  test.check('a wrong entry and the email get the same answer, not logged in; the wrong one sends no mail');
else test.fail(OWED + 'the answers differ or a mail went out for a wrong entry: ' + short(L));
if (L.to === 'bert@example.org' && L.token && L.text.indexOf(L.token) !== -1 && L.text.indexOf('https://harbour.relay.example/?' + L.token) !== -1 && L.mails === 1)
  test.check('the mail goes to the verified email with the token alone and the link https://harbour.relay.example/?<token>; a second ask within the minute sends none');
else test.fail(OWED + 'the login mail: ' + short({ to: L.to, text: L.text, mails: L.mails }));

let tokenUse = null;
try {
  const first = box.faceLogin('harbour', L.token);
  const twice = box.faceLogin('harbour', L.token);
  now += 2 * 60 * 1000;
  box.faceLogin('harbour', 'bert@example.org');
  const late = tokenOf();
  now += 11 * 60 * 1000;
  const expired = box.faceLogin('harbour', late);
  tokenUse = { first: first, twice: twice, expired: expired };
} catch (e) { tokenUse = { threw: e.message }; }
const T = tokenUse || {};
if (T.first && T.first.loggedIn === true && T.first.session && T.twice && T.twice.loggedIn === false && T.expired && T.expired.loggedIn === false)
  test.check('the token typed in the field logs in once; used again, or after 10 minutes, it does not');
else test.fail(OWED + 'the token: ' + short(T));

test.subHeading('3. the login lasts until 7 days after the last interaction; Log out ends it');
let session = null;
try {
  const sid = T.first && T.first.session;
  const a = box.faceSession(sid);
  now += 6 * 24 * 3600 * 1000;
  const b = box.faceSession(sid);
  now += 6 * 24 * 3600 * 1000;
  const c = box.faceSession(sid);
  now += 8 * 24 * 3600 * 1000;
  const d = box.faceSession(sid);
  box.faceLogin('harbour', 'bert@example.org');
  const fresh = box.faceLogin('harbour', tokenOf());
  box.faceLogout(fresh.session);
  const e = box.faceSession(fresh.session);
  session = { a: a, b: b, c: c, d: d, e: e };
} catch (e) { session = { threw: e.message }; }
const S = session || {};
if (S.a && S.a.ok && S.a.name === 'harbour' && S.b && S.b.ok && S.c && S.c.ok && S.d && S.d.ok === false && S.e && S.e.ok === false)
  test.check('each interaction moves the end to 7 days later; 7 days idle ends it, and Log out ends it at once');
else test.fail(OWED + 'the session: ' + short(S));

test.subHeading('4. the relay\'s door for faces, the face shell and the login app');
const server = code('spirit/relayServer.js');
if (/faceAt\(/.test(server) && /\/face\/api/.test(server) && /\/face\/allowed/.test(server) && /spirit_face=/.test(server) && /face\.html/.test(server) && /HttpOnly/.test(server))
  test.check('relayServer answers a face host before its 404: face.html, the token link setting the HttpOnly cookie spirit_face, /face/api, and /face/allowed for Caddy');
else test.fail(OWED + 'relayServer has no door for faces');
let loginManifest = null;
try { loginManifest = JSON.parse(fs.readFileSync(path.join(RUN, 'shell', 'login', 'login.json'), 'utf8')); } catch (e) { loginManifest = null; }
const loginApp = code('shell/login/login.js');
const faceHtml = code('face.html');
const faceShell = code('shell/boot.js');
if (loginManifest && Array.isArray(loginManifest.steps) && loginManifest.steps.map(function (s) { return s.until; }).join(',') === 'login,link'
    && /onSteps:/.test(loginApp) && /home node/i.test(loginApp) && /Log in/.test(loginApp) && (loginApp.match(/<input/g) || []).length === 1)
  test.check('the login app is a steps app (login, then the link to the home node): one field, Log in, and after login it says how the home node is reached');
else test.fail(OWED + 'the login app: manifest ' + short(loginManifest) + ', or its field, words or onSteps');
if (/spirit\.js/.test(faceHtml) && /var FACE = \['shell\/boot\.js'\]/.test(code('spirit.js')) && /\.onSteps\(/.test(faceShell) && /'state'/.test(faceShell) && /get\('app'\)|location\.search/.test(faceShell))
  test.check('face.html boots the face shell, which asks the relay where the user stands and hands it to the login app');
else test.fail(OWED + 'face.html or the face shell is missing, or the shell decides nothing');
const setup = (function () { try { return fs.readFileSync(path.join(ROOT, 'bash', 'face-setup'), 'utf8'); } catch (e) { return ''; } }());
if (/face\.json/.test(setup) && /on_demand/.test(setup) && /\/face\/allowed/.test(setup))
  test.check('bash/face-setup writes face.json and a Caddy block with on-demand certificates asked of /face/allowed');
else test.fail(OWED + 'bash/face-setup is missing, or writes no face.json or on-demand Caddy block');

test.subHeading('5. the face looks and feels like the shell, in green (box v14)');
// NAMED HERE: the shell's styles leave index.html for spirit/run/shell.css, its blues as variables on :root
// (--shell-*); the face loads the same sheet (/face/shell.css) and spirit/run/shell/face.css, which sets those
// variables green. face.html has the shell's skeleton; the face shell opens the login app at once when logged out;
// the login app draws its steps as Join does.
const rawFile = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8'); } catch (e) { return ''; } };
const index = rawFile('index.html');
const sheet = rawFile('shell.css');
const faceSheet = rawFile('shell/face.css');
const rootVars = ((/:root\s*\{([^}]*)\}/.exec(sheet) || [])[1] || '');
const outsideRoot = sheet.replace(/:root\s*\{[^}]*\}/, '');
if (sheet.length > 10000 && /#desktop\s*\{/.test(sheet) && /<link rel="stylesheet" href="\/shell\.css"/.test(index) && !/#desktop\s*\{/.test(index)
    && /--shell-/.test(rootVars) && !/#1a1a2e|#16213e|#0f3460|#16487a/i.test(outsideRoot))
  test.check('the shell\'s styles are one stylesheet, shell.css, linked by index.html; its blues are --shell-* variables on :root');
else test.fail(OWED + 'the shell\'s styles are not one shared sheet with its blues as variables');
const faceVars = ((/:root\s*\{([^}]*)\}/.exec(faceSheet) || [])[1] || '');
const varNames = (rootVars.match(/--shell-[a-z0-9-]+/g) || []);
// /shell.css is one path the node serves as it is and the relay serves too, so face.html works on both (box v16).
if (varNames.length && varNames.every(function (v) { return faceVars.indexOf(v) !== -1; }) && /'\/shell\.css':\s*'\.\.\/shell\.css'/.test(code('spirit/relayServer.js')) && /'\/shell\/face\.css'/.test(code('spirit/relayServer.js')))
  test.check('face.css sets every --shell-* variable green, and the relay serves both sheets to the face');
else test.fail(OWED + 'face.css does not set every shell variable, or the relay does not serve the sheets: ' + short(varNames));
const fh = rawFile('face.html');
if (/href="\/shell\.css"/.test(fh) && /href="\/shell\/face\.css"/.test(fh) && /id="desktop"/.test(fh) && /id="app-container"/.test(fh) && /id="app-header"/.test(fh)
    && /id="app-close"/.test(fh) && /id="app-home"/.test(fh) && /id="app-title"/.test(fh) && /id="app-content"/.test(fh) && !/<style/.test(fh))
  test.check('face.html is the shell\'s skeleton (desktop, title bar with Back and Home, app screen) on the shared sheets, with no style of its own');
else test.fail(OWED + 'face.html is not the shell\'s skeleton on the shared sheets');
const fs2 = code('shell/boot.js');
const la = code('shell/login/login.js');
if (/app-icon/.test(fs2) && /!state\.loggedIn|!\(state && state\.loggedIn\)|loggedIn === false/.test(fs2) && /openLogin\(\)/.test(fs2)
    && /join-steps/.test(la) && /stat-tile wide/.test(la) && /start-job-form card/.test(la) && /field-label/.test(la))
  test.check('the face shell opens the login app at once when logged out, and the login app draws its steps as Join does');
else test.fail(OWED + 'the face shell does not open the login app at once, or the login app does not draw as Join');
// On the home node (box v16): no relay login; the shell asks the node who it is and the owner is logged in.
if (/'node\.card'/.test(fs2) && /\/api\/spirit/.test(fs2) && /home/.test(fs2))
  test.check('on the home node the face shell asks node.card and the owner is logged in');
else test.fail(OWED + 'the face shell has no home-node path (node.card through /api/spirit)');

homes.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* busy */ } });
test.reportSuccessFailureCount();
process.exit(0);
