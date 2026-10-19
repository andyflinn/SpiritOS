'use strict';

// spirit/test/faceLogin.js
// goal/G30.2: a member logs into the relay by a code mailed to the email the relay holds for their face name, and a
// stranger on the parent domain page gets an invite the same way. Red on today's tree; claude-windows writes it and
// builds it (one agent). The item's box (v9), in short:
//   - Ruled: the relay stores little; it sends a token to the email of the login and answers with a form to enter it;
//     the token creates a session; the token is stored with the member. The mailed code is behind both pages: the
//     member name page ends in a session, the parent domain page in an invite and the install line.
//   - Ruled: the relay reads the Mailgun key from relay-state/mail.json (base URL, sending domain, key), placed by
//     the owner; one HTTPS post per mail to <base URL>/v3/<domain>/messages, user api and the key, from
//     postmaster@<domain>.
//   - Proposed, accepted with the Go: the page on the member name asks for no name; the code is kept as a hash with an
//     expiry of about 10 minutes, one use; the session is a random cookie in relay memory; codes are capped per
//     address and per visitor.
// NAMED HERE where the box names none:
//   - js/faceLogin.js: createFaceLogin({ domain, byFace, sendMail, mintInvite, keepCode, takeCode, now, random })
//     answers handle({ method, host, path, form, cookie }) with { status, headers, body }. The member's code lives on
//     the members row (keepCode/takeCode, relayStore loginHash and loginUntil); a stranger's in memory.
//   - Paths: GET / and POST /login/code and /login/verify on <name>.<domain>; GET /join and POST /join/code and
//     /join/verify on <domain>. The session cookie is named spirit_face, HttpOnly, Secure, SameSite=Strict.
//   - js/mailgun.js: readMailConfig(rootDir) reads relay-state/mail.json; createMailgun(config, fetch) answers
//     send({ to, subject, text }).
//   - The faces' domain is mail.json's domain: the relay mails from the domain its members' names hang under.
//   - Caps: one code per address per 60 seconds, at most 5 per address per hour.
// rule/11: through testSupport only; its own scratch folders.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G30.2: ';
const RUN = path.join(__dirname, '..', 'run');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 240); }
function load(name) { try { return require(path.join(RUN, 'js', name)); } catch (e) { return null; } }
const code = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'); } catch (e) { return ''; } };

test.startTest('goal/G30.2: log in on the relay by a mailed code; an invite the same way');

// ── THE WORLD: one member, andy, with a face, a fake mailbox, a clock ─────────────────────────────
const DOMAIN = 'relay.example';
const sent = [];
let clock = 1000000;
let seed = 0;
const rows = { andy: { publicKey: 'K-ANDY', faceName: 'andy', faceEmail: 'andy@example.org', loginHash: '', loginUntil: 0 } };
const invitesMinted = [];
const deps = {
  domain: DOMAIN,
  byFace: function (name) { return rows[String(name)] || null; },
  keepCode: function (name, hash, until) { if (!rows[name]) return false; rows[name].loginHash = hash; rows[name].loginUntil = until; return true; },
  takeCode: function (name) { const r = rows[name]; if (!r) return null; const out = { hash: r.loginHash, until: r.loginUntil }; r.loginHash = ''; r.loginUntil = 0; return out; },
  sendMail: function (m) { sent.push(m); return Promise.resolve({ ok: true }); },
  mintInvite: function (email) { const t = 'INVITE-' + (invitesMinted.length + 1); invitesMinted.push({ email: email, token: t }); return { token: t }; },
  now: function () { return clock; },
  random: function (n) { seed += 1; return Buffer.alloc(n, seed).toString('hex').slice(0, n * 2); },
};
const faceLogin = load('faceLogin.js');
const login = faceLogin && typeof faceLogin.createFaceLogin === 'function' ? faceLogin.createFaceLogin(deps) : null;
function ask(req) {
  if (!login) return Promise.resolve({ status: 0, headers: {}, body: '' });
  return Promise.resolve(login.handle(Object.assign({ method: 'GET', host: '', path: '/', form: {}, cookie: '' }, req))).then(function (r) { return r || {}; }, function (e) { return { status: 0, body: 'threw ' + e.message }; });
}
function lastCode() { const m = sent[sent.length - 1]; const found = m && /\b(\d{6})\b/.exec(String(m.text || '')); return found ? found[1] : ''; }
function cookieOf(r) { const c = String((r.headers && (r.headers['Set-Cookie'] || r.headers['set-cookie'])) || ''); return c; }

async function main() {
  test.subHeading('1. the member name page');
  const page = await ask({ host: 'andy.' + DOMAIN, path: '/' });
  if (page.status === 200 && /\/login\/code/.test(String(page.body)) && !/name="name"/.test(String(page.body))) test.check('GET andy.' + DOMAIN + ' answers a page with a button to send the code and no name field');
  else test.fail(OWED + 'the member page answered ' + page.status + ' ' + short(page.body));
  const nobody = await ask({ host: 'nobody.' + DOMAIN, path: '/' });
  if (nobody.status === 404) test.check('a name no member holds answers 404');
  else test.fail(OWED + 'nobody.' + DOMAIN + ' answered ' + nobody.status);

  test.subHeading('2. the code is mailed to the email the relay holds, and kept as a hash');
  const asked = await ask({ method: 'POST', host: 'andy.' + DOMAIN, path: '/login/code' });
  const mail = sent[sent.length - 1] || {};
  const c1 = lastCode();
  if (asked.status === 200 && mail.to === 'andy@example.org' && c1 && /\/login\/verify/.test(String(asked.body))) test.check('POST /login/code mails a six-digit code to andy@example.org and answers the form for it');
  else test.fail(OWED + 'POST /login/code answered ' + asked.status + ', mail ' + short(mail));
  if (rows.andy.loginHash && rows.andy.loginHash !== c1 && rows.andy.loginHash.indexOf(c1) === -1 && rows.andy.loginUntil > clock && rows.andy.loginUntil <= clock + 10 * 60 * 1000) test.check('the members row keeps a hash of the code, not the code, with an expiry of at most 10 minutes');
  else test.fail(OWED + 'the members row holds ' + short({ hash: rows.andy.loginHash, until: rows.andy.loginUntil - clock }));

  test.subHeading('3. a right code opens a session; a wrong, reused or late one does not');
  const wrong = await ask({ method: 'POST', host: 'andy.' + DOMAIN, path: '/login/verify', form: { code: '000000' } });
  if (wrong.status === 400 && !cookieOf(wrong)) test.check('a wrong code answers 400 and no cookie');
  else test.fail(OWED + 'a wrong code answered ' + wrong.status + ' ' + short(cookieOf(wrong)));
  clock += 61 * 1000;
  await ask({ method: 'POST', host: 'andy.' + DOMAIN, path: '/login/code' });
  const c2 = lastCode();
  const right = await ask({ method: 'POST', host: 'andy.' + DOMAIN, path: '/login/verify', form: { code: c2 } });
  const cookie = cookieOf(right);
  const session = (/spirit_face=([^;]+)/.exec(cookie) || [])[1] || '';
  if ((right.status === 200 || right.status === 303) && session && /HttpOnly/i.test(cookie) && /Secure/i.test(cookie) && /SameSite=Strict/i.test(cookie)) test.check('the right code sets spirit_face, HttpOnly, Secure, SameSite=Strict');
  else test.fail(OWED + 'the right code answered ' + right.status + ' with cookie ' + short(cookie));
  const reused = await ask({ method: 'POST', host: 'andy.' + DOMAIN, path: '/login/verify', form: { code: c2 } });
  if (reused.status === 400 && !cookieOf(reused)) test.check('the same code a second time answers 400: one use');
  else test.fail(OWED + 'a reused code answered ' + reused.status);
  const inside = await ask({ host: 'andy.' + DOMAIN, path: '/', cookie: 'spirit_face=' + session });
  if (inside.status === 200 && /andy/.test(String(inside.body)) && !/\/login\/code/.test(String(inside.body))) test.check('with the cookie, the member page says who is logged in');
  else test.fail(OWED + 'the page with the session answered ' + inside.status + ' ' + short(inside.body));
  const elsewhere = await ask({ host: 'bob.' + DOMAIN, path: '/', cookie: 'spirit_face=' + session });
  if (!/logged in/i.test(String(elsewhere.body))) test.check('the session does not log in on another name');
  else test.fail(OWED + 'andy\'s session opened bob\'s page');
  clock += 61 * 1000;
  await ask({ method: 'POST', host: 'andy.' + DOMAIN, path: '/login/code' });
  const c3 = lastCode();
  clock += 11 * 60 * 1000;
  const late = await ask({ method: 'POST', host: 'andy.' + DOMAIN, path: '/login/verify', form: { code: c3 } });
  if (late.status === 400 && !cookieOf(late)) test.check('a code past its 10 minutes answers 400');
  else test.fail(OWED + 'a late code answered ' + late.status);

  test.subHeading('4. the cap on codes');
  const before = sent.length;
  await ask({ method: 'POST', host: 'andy.' + DOMAIN, path: '/login/code' });
  const again = await ask({ method: 'POST', host: 'andy.' + DOMAIN, path: '/login/code' });
  if (again.status === 429 && sent.length === before + 1) test.check('a second code within 60 seconds is refused 429 and no mail goes');
  else test.fail(OWED + 'a second code at once answered ' + again.status + ', mails sent ' + (sent.length - before));

  test.subHeading('5. the parent domain page: an invite by a mailed code');
  const join = await ask({ host: DOMAIN, path: '/join' });
  if (join.status === 200 && /name="email"/.test(String(join.body))) test.check('GET ' + DOMAIN + '/join answers a page asking for an email');
  else test.fail(OWED + 'the join page answered ' + join.status + ' ' + short(join.body));
  const jcode = await ask({ method: 'POST', host: DOMAIN, path: '/join/code', form: { email: 'new@example.org' } });
  const jmail = sent[sent.length - 1] || {};
  const j = lastCode();
  if (jcode.status === 200 && jmail.to === 'new@example.org' && j) test.check('POST /join/code mails a code to the address given');
  else test.fail(OWED + 'POST /join/code answered ' + jcode.status + ', mail ' + short(jmail));
  const jok = await ask({ method: 'POST', host: DOMAIN, path: '/join/verify', form: { email: 'new@example.org', code: j } });
  const minted = invitesMinted[invitesMinted.length - 1] || {};
  if (jok.status === 200 && minted.email === 'new@example.org' && String(jok.body).indexOf(minted.token) !== -1) test.check('the right code mints an invite and the page shows the install line with its token');
  else test.fail(OWED + 'POST /join/verify answered ' + jok.status + ', minted ' + short(minted));
  const badMail = await ask({ method: 'POST', host: DOMAIN, path: '/join/code', form: { email: 'nope' } });
  if (badMail.status === 400) test.check('an address without @ is refused 400');
  else test.fail(OWED + 'a bad address answered ' + badMail.status);

  test.subHeading('6. the mail goes to Mailgun, configured by relay-state/mail.json');
  const mg = load('mailgun.js');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-facelogin-'));
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(home, 'relay-state', 'mail.json'), JSON.stringify({ url: 'https://api.mailgun.net', domain: 'relay.example', key: 'TEST-KEY' }));
  const cfg = mg && typeof mg.readMailConfig === 'function' ? mg.readMailConfig(home) : null;
  if (cfg && cfg.url === 'https://api.mailgun.net' && cfg.domain === 'relay.example' && cfg.key === 'TEST-KEY') test.check('readMailConfig reads url, domain and key from relay-state/mail.json');
  else test.fail(OWED + 'readMailConfig answered ' + short(cfg));
  const posted = [];
  const fakeFetch = function (url, opts) { posted.push({ url: url, opts: opts }); return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ id: 'x' }); }, text: function () { return Promise.resolve('{"id":"x"}'); } }); };
  const sender = cfg && mg && typeof mg.createMailgun === 'function' ? mg.createMailgun(cfg, fakeFetch) : null;
  if (sender) { try { await sender.send({ to: 'andy@example.org', subject: 'Your code', text: 'code 123456' }); } catch (e) { /* the check below says */ } }
  const p = posted[0] || {};
  const headers = (p.opts && p.opts.headers) || {};
  const auth = String(headers.Authorization || headers.authorization || '');
  const body = String((p.opts && p.opts.body) || '');
  if (p.url === 'https://api.mailgun.net/v3/relay.example/messages' && auth === 'Basic ' + Buffer.from('api:TEST-KEY').toString('base64') &&
      /from=postmaster%40relay\.example/.test(body) && /to=andy%40example\.org/.test(body)) test.check('one POST to <url>/v3/<domain>/messages, user api and the key, from postmaster@<domain>');
  else test.fail(OWED + 'the Mailgun post was ' + short({ url: p.url, auth: auth.slice(0, 12), body: body.slice(0, 120) }));
  try { fs.rmSync(home, { recursive: true, force: true }); } catch (e) { /* busy */ }

  test.subHeading('7. the relay keeps the code with the member, and serves the pages');
  let cols = [];
  const relayHome = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-facelogin-relay-'));
  try {
    const rs = require('../run/js/relayStore');
    rs.open(relayHome);
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(path.join(relayHome, 'relay-state', 'relay.db'), { readOnly: true });
    cols = db.prepare('PRAGMA table_info(members)').all().map(function (c) { return c.name; });
    db.close();
  } catch (e) { cols = ['threw ' + e.message]; }
  try { fs.rmSync(relayHome, { recursive: true, force: true }); } catch (e) { /* busy */ }
  if (cols.indexOf('loginHash') !== -1 && cols.indexOf('loginUntil') !== -1) test.check('the members table has loginHash and loginUntil');
  else test.fail(OWED + 'the members table has ' + short(cols));
  const server = code('js/relayServer.js');
  if (/faceLogin/.test(server) && /readMailConfig/.test(server)) test.check('relayServer hands the face and join pages to faceLogin when mail.json is there');
  else test.fail(OWED + 'relayServer does not serve the login pages');
}

main().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  setTimeout(function () { test.reportSuccessFailureCount(); process.exit(0); }, 100);
});
