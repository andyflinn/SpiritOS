'use strict';

// spirit/test/faceLogin.js
// goal/G30.2: one field on the relay, an email typed once and a code pasted from the mail; on the parent domain it
// ends in an invite made out to that email, on a member's name in a long session. Red on the tree as it stands; the
// second round of this item. claude-windows writes it and builds it (one agent). The item's box (v12), in short:
//   - Andy's flow, 2026-10-19: one input field taking an email address OR a five-digit code, told apart by the relay.
//     An email gets a five-digit code mailed to it; the code pasted on the same page in time gives, on the parent
//     domain, a page with a copy button for email@address:token and a text saying where in Natter to paste it; on a
//     member's name, a login. The only thing ever typed is the email, once; the code is copy-pasted.
//   - The whole email address is the invite label; at claim, the part before the @ becomes the public label.
//   - The code counts 10 minutes; the session lasts much longer, refreshed while not idle too long.
//   - Built with it: a short cookie remembers which email a code went to; the session is kept with the member as a
//     hash and an expiry; Natter takes the pasted email:token where a relay invite is entered.
//   - Kept from the first round: mail through Mailgun configured by relay-state/mail.json; the code kept as a hash.
// NAMED HERE where the box names none:
//   - Both pages answer GET / with the field, named entry, and POST / with { entry }. The pending cookie is
//     spirit_pending (10 minutes), the session cookie spirit_face; both HttpOnly, Secure, SameSite=Strict.
//   - A session lasts 7 days from its last use, and each use moves it on (Max-Age refreshed). At most 5 sessions per
//     member (one per device), the oldest dropped.
//   - On a member's page an email that is not the member's gets the same answer and no mail, so the page does not
//     tell anyone whose address it is.
//   - createFaceLogin({ domain, byFace, keepCode, takeCode, keepSession, sessionOf, sendMail, mintInvite, now, random }).
//     relayStore members gain sessions (a JSON list of { hash, until }).
//   - relay.joinInvite(email) mints an invite whose label is the email, lowercased.
//   - Natter (natterDetails.js): ndInviteParts(text) splits email:token into { invite, token }; ndDefaultLabel(invite)
//     is the part before the @, made to fit the label rule.
//   - Caps unchanged: one code per address per 60 seconds, five an hour.
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

test.startTest('goal/G30.2: one field, the email once, the code pasted; an invite or a long session');

// ── THE WORLD: one member, andy, with a face, a fake mailbox, a clock ─────────────────────────────
const DOMAIN = 'relay.example';
const DAY = 24 * 60 * 60 * 1000;
const sent = [];
let clock = 1000000;
let seed = 0;
const rows = { andy: { publicKey: 'K-ANDY', faceName: 'andy', faceEmail: 'andy@example.org', loginHash: '', loginUntil: 0, sessions: [] } };
const invitesMinted = [];
const deps = {
  domain: DOMAIN,
  byFace: function (name) { return rows[String(name)] || null; },
  keepCode: function (name, hash, until) { if (!rows[name]) return false; rows[name].loginHash = hash; rows[name].loginUntil = until; return true; },
  takeCode: function (name) { const r = rows[name]; if (!r) return null; const out = { hash: r.loginHash, until: r.loginUntil }; r.loginHash = ''; r.loginUntil = 0; return out; },
  keepSession: function (name, hash, until) {
    const r = rows[name]; if (!r) return false;
    r.sessions = r.sessions.filter(function (s) { return s.hash !== hash; }).concat([{ hash: hash, until: until }]).slice(-5);
    return true;
  },
  sessionOf: function (name, hash) { const r = rows[name]; const s = r && r.sessions.filter(function (x) { return x.hash === hash; })[0]; return s ? s.until : 0; },
  sendMail: function (m) { sent.push(m); return Promise.resolve({ ok: true }); },
  mintInvite: function (email) { const t = 'TOKEN' + (invitesMinted.length + 1); invitesMinted.push({ email: email, token: t }); return { token: t, label: email }; },
  now: function () { return clock; },
  random: function (n) { seed += 1; return Buffer.alloc(n, seed).toString('hex').slice(0, n * 2); },
};
const faceLogin = load('faceLogin.js');
const login = faceLogin && typeof faceLogin.createFaceLogin === 'function' ? faceLogin.createFaceLogin(deps) : null;
function ask(req) {
  if (!login) return Promise.resolve({ status: 0, headers: {}, body: '' });
  return Promise.resolve(login.handle(Object.assign({ method: 'GET', host: '', path: '/', form: {}, cookie: '' }, req))).then(function (r) { return r || {}; }, function (e) { return { status: 0, body: 'threw ' + e.message }; });
}
function lastCode() { const m = sent[sent.length - 1]; const found = m && /\b(\d{5})\b/.exec(String(m.text || '')); return found ? found[1] : ''; }
function setCookie(r) { return String((r.headers && (r.headers['Set-Cookie'] || r.headers['set-cookie'])) || ''); }
function cookieNamed(r, name) { const c = setCookie(r); const m = new RegExp(name + '=([^;]*)').exec(c); return m ? m[1] : ''; }
function maxAge(r, name) { const c = setCookie(r); const at = c.indexOf(name + '='); if (at === -1) return -1; const m = /Max-Age=(\d+)/i.exec(c.slice(at)); return m ? Number(m[1]) : -1; }
function strict(r) { const c = setCookie(r); return /HttpOnly/i.test(c) && /Secure/i.test(c) && /SameSite=Strict/i.test(c); }

async function main() {
  test.subHeading('1. the parent domain page: one field');
  const join = await ask({ host: DOMAIN, path: '/' });
  if (join.status === 200 && /name="entry"/.test(String(join.body)) && (String(join.body).match(/<input/g) || []).length === 1) test.check('GET ' + DOMAIN + '/ answers a page with one field, entry');
  else test.fail(OWED + 'the parent page answered ' + join.status + ' ' + short(join.body));

  test.subHeading('2. an email gets a five-digit code and a pending cookie');
  const asked = await ask({ method: 'POST', host: DOMAIN, path: '/', form: { entry: 'New.Person@Example.org' } });
  const mail = sent[sent.length - 1] || {};
  const c1 = lastCode();
  const pending = cookieNamed(asked, 'spirit_pending');
  if (asked.status === 200 && mail.to === 'new.person@example.org' && c1 && pending && strict(asked) && maxAge(asked, 'spirit_pending') > 0 && maxAge(asked, 'spirit_pending') <= 600) {
    test.check('the email gets a five-digit code by mail, and the page a spirit_pending cookie for at most 10 minutes');
  } else test.fail(OWED + 'POST entry=email answered ' + asked.status + ', mail ' + short(mail) + ', cookie ' + short(setCookie(asked)));
  const nonsense = await ask({ method: 'POST', host: DOMAIN, path: '/', form: { entry: 'hello' } });
  if (nonsense.status === 400) test.check('an entry that is neither an email nor five digits is refused 400');
  else test.fail(OWED + 'entry=hello answered ' + nonsense.status);

  test.subHeading('3. the pasted code gives email:token to copy, and where to paste it');
  const noCookie = await ask({ method: 'POST', host: DOMAIN, path: '/', form: { entry: c1 } });
  if (noCookie.status === 400) test.check('a code without the pending cookie is refused 400');
  else test.fail(OWED + 'a code with no pending cookie answered ' + noCookie.status);
  await ask({ method: 'POST', host: DOMAIN, path: '/', form: { entry: 'new.person@example.org' } });
  clock += 61 * 1000;
  const asked2 = await ask({ method: 'POST', host: DOMAIN, path: '/', form: { entry: 'new.person@example.org' } });
  const c2 = lastCode();
  const pending2 = cookieNamed(asked2, 'spirit_pending');
  const done = await ask({ method: 'POST', host: DOMAIN, path: '/', form: { entry: c2 }, cookie: 'spirit_pending=' + pending2 });
  const minted = invitesMinted[invitesMinted.length - 1] || {};
  const body = String(done.body || '');
  if (done.status === 200 && minted.email === 'new.person@example.org' && body.indexOf('new.person@example.org:' + minted.token) !== -1 && /<button[^>]*copy/i.test(body) && /Natter/.test(body)) {
    test.check('the right code mints an invite for that email and shows email:token with a copy button and where in Natter to paste it');
  } else test.fail(OWED + 'the code answered ' + done.status + ', minted ' + short(minted) + ', page ' + short(body.slice(0, 200)));
  const again = await ask({ method: 'POST', host: DOMAIN, path: '/', form: { entry: c2 }, cookie: 'spirit_pending=' + pending2 });
  if (again.status === 400) test.check('the same code a second time is refused 400: one use');
  else test.fail(OWED + 'a reused code answered ' + again.status);

  test.subHeading('4. the cap');
  clock += 61 * 1000;
  const before = sent.length;
  await ask({ method: 'POST', host: DOMAIN, path: '/', form: { entry: 'cap@example.org' } });
  const tooSoon = await ask({ method: 'POST', host: DOMAIN, path: '/', form: { entry: 'cap@example.org' } });
  if (tooSoon.status === 429 && sent.length === before + 1) test.check('a second code to one address within 60 seconds is refused 429 and no mail goes');
  else test.fail(OWED + 'a second code at once answered ' + tooSoon.status + ', mails ' + (sent.length - before));

  test.subHeading('5. a member\'s name: the same field, a long session');
  const page = await ask({ host: 'andy.' + DOMAIN, path: '/' });
  if (page.status === 200 && /name="entry"/.test(String(page.body))) test.check('GET andy.' + DOMAIN + '/ answers the one field');
  else test.fail(OWED + 'the member page answered ' + page.status + ' ' + short(page.body));
  const nobody = await ask({ host: 'nobody.' + DOMAIN, path: '/' });
  if (nobody.status === 404) test.check('a name no member holds answers 404');
  else test.fail(OWED + 'nobody.' + DOMAIN + ' answered ' + nobody.status);
  clock += 61 * 1000;
  const n0 = sent.length;
  const stranger = await ask({ method: 'POST', host: 'andy.' + DOMAIN, path: '/', form: { entry: 'someone@else.org' } });
  const own = await ask({ method: 'POST', host: 'andy.' + DOMAIN, path: '/', form: { entry: 'Andy@Example.org' } });
  const ownMail = sent[sent.length - 1] || {};
  if (stranger.status === 200 && own.status === 200 && String(stranger.body) === String(own.body) && sent.length === n0 + 1 && ownMail.to === 'andy@example.org') {
    test.check('an email that is not andy\'s gets the same page and no mail; andy\'s gets the code');
  } else test.fail(OWED + 'stranger ' + stranger.status + ', own ' + own.status + ', same page ' + (String(stranger.body) === String(own.body)) + ', mails ' + (sent.length - n0));
  const pendingM = cookieNamed(own, 'spirit_pending');
  const code5 = lastCode();
  const inBody = await ask({ method: 'POST', host: 'andy.' + DOMAIN, path: '/', form: { entry: code5 }, cookie: 'spirit_pending=' + pendingM });
  const session = cookieNamed(inBody, 'spirit_face');
  const age = maxAge(inBody, 'spirit_face');
  if (inBody.status === 200 && session && strict(inBody) && age >= 7 * 24 * 3600) test.check('the pasted code logs in: spirit_face, HttpOnly, Secure, SameSite=Strict, for 7 days');
  else test.fail(OWED + 'the member code answered ' + inBody.status + ' with ' + short(setCookie(inBody)));
  if ((rows.andy.sessions || []).length === 1 && rows.andy.sessions[0].hash !== session) test.check('the session is kept with the member as a hash, not the cookie itself');
  else test.fail(OWED + 'andy\'s sessions read ' + short(rows.andy.sessions));

  test.subHeading('6. the session lasts, moves on with use, and ends when idle');
  clock += 6 * DAY;
  const day6 = await ask({ host: 'andy.' + DOMAIN, path: '/', cookie: 'spirit_face=' + session });
  if (day6.status === 200 && /logged in/i.test(String(day6.body)) && maxAge(day6, 'spirit_face') >= 7 * 24 * 3600) test.check('six days on, still logged in, and the cookie is refreshed for 7 more days');
  else test.fail(OWED + 'on day 6 the page answered ' + day6.status + ' ' + short(String(day6.body).slice(0, 120)) + ', cookie ' + short(setCookie(day6)));
  clock += 6 * DAY;
  const day12 = await ask({ host: 'andy.' + DOMAIN, path: '/', cookie: 'spirit_face=' + session });
  if (/logged in/i.test(String(day12.body))) test.check('twelve days on, still in: each visit moved it on');
  else test.fail(OWED + 'on day 12 (6 days after the last visit) the session was gone');
  clock += 8 * DAY;
  const idle = await ask({ host: 'andy.' + DOMAIN, path: '/', cookie: 'spirit_face=' + session });
  if (!/logged in/i.test(String(idle.body)) && /name="entry"/.test(String(idle.body))) test.check('eight idle days later the session is over and the field is back');
  else test.fail(OWED + 'after 8 idle days the page answered ' + short(String(idle.body).slice(0, 120)));
  const elsewhere = await ask({ host: 'bob.' + DOMAIN, path: '/', cookie: 'spirit_face=' + session });
  if (!/logged in/i.test(String(elsewhere.body))) test.check('a session never opens another name');
  else test.fail(OWED + 'andy\'s session opened bob\'s page');

  test.subHeading('7. the relay mints an invite made out to the email');
  let label = '';
  try {
    const world = require('./world');
    const L = world.build({ title: 'join', peers: [{ name: 'ann', label: 'ann' }] });
    const made = L.box && typeof L.box.joinInvite === 'function' ? L.box.joinInvite('New.Person@Example.org') : null;
    label = made ? String(made.label || '') : 'no invite';
  } catch (e) { label = 'threw ' + e.message; }
  if (label === 'new.person@example.org') test.check('joinInvite labels the invite with the whole email, lowercased');
  else test.fail(OWED + 'joinInvite labelled the invite ' + short(label));

  test.subHeading('8. Natter takes email:token');
  const natter = (function () { try { return fs.readFileSync(path.join(RUN, 'shell', 'natterDetails', 'natterDetails.js'), 'utf8'); } catch (e) { return ''; } }());
  let parts = null;
  let byDefault = '';
  try {
    // The two functions alone, cut from the file: the rest of it reads the shell at load. They are self-contained.
    const fnOf = function (name) { const m = new RegExp('function ' + name + '\\([\\s\\S]*?\\n\\}\\r?\\n').exec(natter); return m ? m[0] : ''; };
    const fns = new Function(fnOf('ndInviteParts') + fnOf('ndDefaultLabel') +
      '\nreturn { p: typeof ndInviteParts === "function" ? ndInviteParts : null, d: typeof ndDefaultLabel === "function" ? ndDefaultLabel : null };')();
    parts = fns.p ? fns.p(' new.person@example.org:TOKEN1 ') : null;
    byDefault = fns.d ? fns.d('new.person@example.org') : '';
  } catch (e) { parts = { threw: e.message }; }
  if (parts && parts.invite === 'new.person@example.org' && parts.token === 'TOKEN1') test.check('ndInviteParts splits a pasted email:token');
  else test.fail(OWED + 'ndInviteParts answered ' + short(parts));
  if (byDefault === 'new.person') test.check('ndDefaultLabel makes the part before the @ the public label');
  else test.fail(OWED + 'ndDefaultLabel answered ' + short(byDefault));

  test.subHeading('9. the mail goes to Mailgun, configured by relay-state/mail.json');
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
  if (sender) { try { await sender.send({ to: 'andy@example.org', subject: 'Your code', text: 'code 12345' }); } catch (e) { /* the check below says */ } }
  const p = posted[0] || {};
  const headers = (p.opts && p.opts.headers) || {};
  const auth = String(headers.Authorization || headers.authorization || '');
  const form = String((p.opts && p.opts.body) || '');
  if (p.url === 'https://api.mailgun.net/v3/relay.example/messages' && auth === 'Basic ' + Buffer.from('api:TEST-KEY').toString('base64') &&
      /from=postmaster%40relay\.example/.test(form) && /to=andy%40example\.org/.test(form)) test.check('one POST to <url>/v3/<domain>/messages, user api and the key, from postmaster@<domain>');
  else test.fail(OWED + 'the Mailgun post was ' + short({ url: p.url, auth: auth.slice(0, 12), body: form.slice(0, 120) }));
  try { fs.rmSync(home, { recursive: true, force: true }); } catch (e) { /* busy */ }

  test.subHeading('10. the relay keeps codes and sessions with the member, and serves the pages');
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
  if (['loginHash', 'loginUntil', 'sessions'].every(function (c) { return cols.indexOf(c) !== -1; })) test.check('the members table has loginHash, loginUntil and sessions');
  else test.fail(OWED + 'the members table has ' + short(cols));
  const server = code('js/relayServer.js');
  if (/faceLogin/.test(server) && /readMailConfig/.test(server) && /keepSession/.test(server)) test.check('relayServer hands both pages to faceLogin, with the member store\'s codes and sessions, when mail.json is there');
  else test.fail(OWED + 'relayServer does not wire the sessions into faceLogin');
}

main().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  setTimeout(function () { test.reportSuccessFailureCount(); process.exit(0); }, 100);
});
