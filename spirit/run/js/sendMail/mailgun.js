'use strict';

// spirit/run/js/sendMail/mailgun.js
// A sendMail DRIVER: Mailgun (goal/G30.2). Loaded by js/sendMail.js when relay-state/mail.json names it,
// { "driver": "mailgun", "url": "https://api.mailgun.net", "domain": "spirit.andyflinn.com", "key": "..." }.
//
// One HTTPS post per mail to <url>/v3/<domain>/messages, user api and the key (HTTP basic), the fields from, to,
// subject and text as a form; from is postmaster@<domain>. No library: their client does the same post.
// The key never leaves this module: not in an answer, an error or a log line.

// A sender over those settings, or null when a setting is missing. `fetchImpl` is the platform fetch unless a caller
// hands another (a suite's fake).
function create(settings, fetchImpl) {
  const v = settings || {};
  const url = String(v.url || '').trim().replace(/\/+$/, '');
  const domain = String(v.domain || '').trim().toLowerCase();
  const key = String(v.key || '').trim();
  if (!/^https:\/\//.test(url) || !domain || !key) return null;
  const doFetch = typeof fetchImpl === 'function' ? fetchImpl : fetch;
  const auth = 'Basic ' + Buffer.from('api:' + key).toString('base64');
  function send(m) {
    const form = new URLSearchParams();
    form.set('from', 'postmaster@' + domain);
    form.set('to', String((m && m.to) || ''));
    form.set('subject', String((m && m.subject) || ''));
    form.set('text', String((m && m.text) || ''));
    return Promise.resolve(doFetch(url + '/v3/' + domain + '/messages', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })).then(function (r) {
      return r && r.ok ? { ok: true } : { ok: false, status: (r && r.status) || 502, error: 'the mail service refused the mail' };
    }, function () {
      return { ok: false, status: 502, error: 'the mail service did not answer' };
    });
  }
  return { send: send };
}

module.exports = { create: create };
