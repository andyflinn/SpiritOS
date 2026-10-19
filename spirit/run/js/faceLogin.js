'use strict';

// spirit/run/js/faceLogin.js
// LOGGING IN ON THE RELAY BY A MAILED CODE, AND JOINING THE SAME WAY (goal/G30.2).
//
//   Andy, 2026-10-19: "i don't want the relay to store much. so if the relay send a token to the email address in
//   the login and responds with a form to enter that token to create a session, and the token is stored with the
//   member?" and "so we'll do invites the same way on the parent-domain page and the face-login in the
//   facename.noderoutes.net page".
//
// Two pages, one mechanism:
//   <name>.<domain>   GET /               the login page (no name to type: the address is the face name), or who is
//                                         logged in when the session cookie is there
//                     POST /login/code    mails a code to the email the relay holds for that face name
//                     POST /login/verify  {code}: the right code opens a session, a cookie
//   <domain>          GET /join           a page asking for an email
//                     POST /join/code     {email}: mails a code to that address
//                     POST /join/verify   {email, code}: the right code mints an invite and shows it
//
// WHAT IS KEPT: a member's code only as a hash with its expiry, on the members row (keepCode/takeCode, taken once:
// a wrong guess spends it); a stranger's code the same way in memory; a session as a random token in memory, never
// on disk, so a relay restart means logging in again. The faces hang under the domain the relay mails from.
//
// No I/O of its own: the store, the mail, the clock and the randomness are handed in, so a suite drives it whole.

const crypto = require('crypto');
const faceRoute = require('./faceRoute');

const CODE_MS = 10 * 60 * 1000;     // a code counts for 10 minutes
const GAP_MS = 60 * 1000;           // at most one code per address a minute
const HOUR_MS = 60 * 60 * 1000;
const PER_HOUR = 5;                 // and five an hour
const COOKIE = 'spirit_face';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
}
function page(title, inner) {
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + esc(title) + '</title><style>body{font-family:system-ui,sans-serif;max-width:28em;margin:3em auto;padding:0 1em}' +
    'input,button{font-size:1em;padding:.4em}</style></head><body><h1>' + esc(title) + '</h1>' + inner + '</body></html>';
}
function html(status, body, headers) {
  return { status: status, headers: Object.assign({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }, headers || {}), body: body };
}
function hostOf(host) { return String(host || '').trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, ''); }
function cookieValue(cookie, name) {
  const m = new RegExp('(?:^|;\\s*)' + name + '=([^;]*)').exec(String(cookie || ''));
  return m ? m[1] : '';
}

function createFaceLogin(deps) {
  const d = deps || {};
  const domain = hostOf(d.domain);
  const now = typeof d.now === 'function' ? d.now : function () { return Date.now(); };
  const random = typeof d.random === 'function' ? d.random : function (n) { return crypto.randomBytes(n).toString('hex'); };
  const sessions = new Map();       // token -> face name
  const strangers = new Map();      // email -> { hash, until }
  const asked = new Map();          // address -> [times a code was sent]

  function hash(who, code) { return crypto.createHash('sha256').update(String(who) + '\n' + String(code)).digest('hex'); }
  function newCode() { return String(parseInt(String(random(4)).slice(0, 8), 16) % 1000000).padStart(6, '0'); }

  // THE CAP: one code per address a minute, five an hour, so nobody burns the relay's mail allowance.
  function capped(address) {
    const t = now();
    const times = (asked.get(address) || []).filter(function (x) { return t - x < HOUR_MS; });
    if (times.length && t - times[times.length - 1] < GAP_MS) return true;
    if (times.length >= PER_HOUR) return true;
    times.push(t);
    asked.set(address, times);
    return false;
  }
  function tooMany() { return html(429, page('Not yet', '<p>A code was sent a moment ago. Please wait a minute and try again.</p>'), { 'Retry-After': '60' }); }

  function mailCode(to, where, code) {
    return Promise.resolve(d.sendMail({
      to: to,
      subject: 'Your code for ' + where,
      text: 'Your code for ' + where + ' is ' + code + '. It counts once, for 10 minutes.',
    })).then(function (r) { return !r || r.ok !== false; }, function () { return false; });
  }

  // ── <name>.<domain> ──────────────────────────────────────────────────
  function member(req, name) {
    const row = d.byFace(name);
    if (!row || !row.faceEmail) return html(404, page('No such name', '<p>Nobody here goes by ' + esc(name) + '.</p>'));
    const where = name + '.' + domain;
    if (req.method === 'GET' && req.path === '/') {
      const who = sessions.get(cookieValue(req.cookie, COOKIE));
      if (who === name) return html(200, page(where, '<p>You are logged in as ' + esc(name) + '.</p>'));
      return html(200, page(where, '<p>We will mail a code to the address this name was registered with.</p>' +
        '<form method="post" action="/login/code"><button type="submit">Send me a code</button></form>'));
    }
    if (req.method === 'POST' && req.path === '/login/code') {
      if (capped('face:' + name) || (req.visitor && capped('visitor:' + req.visitor))) return tooMany();
      const code = newCode();
      d.keepCode(name, hash(name, code), now() + CODE_MS);
      return mailCode(row.faceEmail, where, code).then(function (ok) {
        if (!ok) return html(502, page('Not sent', '<p>The mail could not be sent. Please try again later.</p>'));
        return html(200, page(where, '<p>A code is on its way to your mailbox.</p>' +
          '<form method="post" action="/login/verify"><input name="code" inputmode="numeric" autocomplete="one-time-code" placeholder="six digits"> ' +
          '<button type="submit">Log in</button></form>'));
      });
    }
    if (req.method === 'POST' && req.path === '/login/verify') {
      const code = String((req.form && req.form.code) || '').trim();
      const kept = d.takeCode(name);
      if (!kept || !kept.hash || kept.until < now() || !code || hash(name, code) !== kept.hash) {
        return html(400, page(where, '<p>That code is wrong or no longer counts. <a href="/">Ask for a new one.</a></p>'));
      }
      const token = random(32);
      sessions.set(token, name);
      return html(200, page(where, '<p>You are logged in as ' + esc(name) + '.</p>'),
        { 'Set-Cookie': COOKIE + '=' + token + '; Path=/; HttpOnly; Secure; SameSite=Strict' });
    }
    return html(404, page('Not found', '<p>Nothing here.</p>'));
  }

  // ── <domain>: joining by a mailed code ───────────────────────────────
  function parent(req) {
    if (req.method === 'GET' && (req.path === '/join' || req.path === '/')) {
      return html(200, page('Join ' + domain, '<p>Give your email address and we will mail you a code.</p>' +
        '<form method="post" action="/join/code"><input name="email" type="email" placeholder="you@example.org"> ' +
        '<button type="submit">Send me a code</button></form>'));
    }
    const email = String((req.form && req.form.email) || '').trim().toLowerCase();
    if (req.method === 'POST' && (req.path === '/join/code' || req.path === '/join/verify') &&
        (Buffer.byteLength(email, 'utf8') > 254 || !/^[^\s@]+@[^\s@]+$/.test(email))) {
      return html(400, page('Join ' + domain, '<p>That is not one email address. <a href="/join">Try again.</a></p>'));
    }
    if (req.method === 'POST' && req.path === '/join/code') {
      if (capped('mail:' + email) || (req.visitor && capped('visitor:' + req.visitor))) return tooMany();
      const code = newCode();
      strangers.set(email, { hash: hash(email, code), until: now() + CODE_MS });
      return mailCode(email, domain, code).then(function (ok) {
        if (!ok) return html(502, page('Not sent', '<p>The mail could not be sent. Please try again later.</p>'));
        return html(200, page('Join ' + domain, '<p>A code is on its way to ' + esc(email) + '.</p>' +
          '<form method="post" action="/join/verify"><input type="hidden" name="email" value="' + esc(email) + '">' +
          '<input name="code" inputmode="numeric" autocomplete="one-time-code" placeholder="six digits"> <button type="submit">Join</button></form>'));
      });
    }
    if (req.method === 'POST' && req.path === '/join/verify') {
      const code = String((req.form && req.form.code) || '').trim();
      const kept = strangers.get(email);
      strangers.delete(email);
      if (!kept || kept.until < now() || !code || hash(email, code) !== kept.hash) {
        return html(400, page('Join ' + domain, '<p>That code is wrong or no longer counts. <a href="/join">Ask for a new one.</a></p>'));
      }
      const made = d.mintInvite(email) || {};
      if (!made.token) return html(503, page('Join ' + domain, '<p>No invite could be made just now. Please try again later.</p>'));
      // BOTH HALVES: a claim is matched on the token AND the invite's label (invites.match), so a page that showed
      // the token alone gave an invite nobody could claim (found live on spirit-3, 2026-10-19).
      return html(200, page('Welcome', '<p>Your invite to ' + esc(domain) + ':</p>' +
        '<p>Name: <b>' + esc(made.label || '') + '</b></p><p>Token:</p><pre>' + esc(made.token) + '</pre>' +
        '<p>Install SpiritOS, then join this relay, https://' + esc(domain) + ', with that invite.</p>'));
    }
    return html(404, page('Not found', '<p>Nothing here.</p>'));
  }

  function handle(req) {
    const r = req || {};
    const host = hostOf(r.host);
    if (!domain || !host) return html(404, page('Not found', '<p>Nothing here.</p>'));
    if (host === domain) return parent(r);
    const suffix = '.' + domain;
    if (host.length > suffix.length && host.slice(-suffix.length) === suffix) {
      const name = faceRoute.faceLabel(host.slice(0, host.length - suffix.length));
      if (name) return member(r, name);
    }
    return html(404, page('Not found', '<p>Nothing here.</p>'));
  }

  // Whether a request is one of these pages, so the relay's door can hand it here and refuse the rest as before.
  function serves(method, host, path) {
    const h = hostOf(host);
    if (!domain || !h) return false;
    const mine = h === domain || (h.length > domain.length + 1 && h.slice(-(domain.length + 1)) === '.' + domain);
    if (!mine) return false;
    if (method === 'GET') return path === '/' || path === '/join';
    return method === 'POST' && ['/login/code', '/login/verify', '/join/code', '/join/verify'].indexOf(path) !== -1;
  }

  return { handle: handle, serves: serves };
}

module.exports = { createFaceLogin: createFaceLogin, COOKIE: COOKIE };
