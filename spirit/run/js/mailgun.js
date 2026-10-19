'use strict';

// spirit/run/js/mailgun.js
// THE RELAY SENDS MAIL THROUGH MAILGUN (goal/G30.2).
//
//   Andy, 2026-10-19, on where the key lives: "relay-state/mail.json ... sure." The relay sends the mail, so the
//   relay reads the key, from a file the owner places by hand on the relay box and never in git. It is the first,
//   narrow case of goal/G30's secrets store, which is not built yet.
//
//   relay-state/mail.json   { "url": "https://api.mailgun.net", "domain": "spirit.andyflinn.com", "key": "..." }
//
// One HTTPS post per mail to <url>/v3/<domain>/messages, user api and the key (HTTP basic), the fields from, to,
// subject and text as a form; from is postmaster@<domain>. No library: their client does the same post.
// The key never leaves this module: not in an answer, an error or a log line.

const fs = require('fs');
const path = require('path');

// The mail settings, or null when there are none (no file, unreadable, or a field missing).
function readMailConfig(rootDir) {
  let v = null;
  try { v = JSON.parse(fs.readFileSync(path.join(String(rootDir || ''), 'relay-state', 'mail.json'), 'utf8')); } catch (e) { return null; }
  if (!v || typeof v !== 'object') return null;
  const url = String(v.url || '').trim().replace(/\/+$/, '');
  const domain = String(v.domain || '').trim().toLowerCase();
  const key = String(v.key || '').trim();
  if (!/^https:\/\//.test(url) || !domain || !key) return null;
  return { url: url, domain: domain, key: key };
}

// A sender over those settings. `fetchImpl` is the platform fetch unless a caller hands another (a suite's fake).
function createMailgun(config, fetchImpl) {
  const c = config || {};
  const doFetch = typeof fetchImpl === 'function' ? fetchImpl : fetch;
  const auth = 'Basic ' + Buffer.from('api:' + String(c.key || '')).toString('base64');
  function send(m) {
    const form = new URLSearchParams();
    form.set('from', 'postmaster@' + c.domain);
    form.set('to', String((m && m.to) || ''));
    form.set('subject', String((m && m.subject) || ''));
    form.set('text', String((m && m.text) || ''));
    return Promise.resolve(doFetch(c.url + '/v3/' + c.domain + '/messages', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })).then(function (r) {
      return r && r.ok ? { ok: true } : { ok: false, status: (r && r.status) || 502, error: 'the mail service refused the mail' };
    }, function () {
      return { ok: false, status: 502, error: 'the mail service did not answer' };
    });
  }
  return { send: send, domain: c.domain };
}

module.exports = { readMailConfig: readMailConfig, createMailgun: createMailgun };
