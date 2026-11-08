'use strict';

// spirit/run/spirit/test/spirit-faceLogin.js
// THE RELAY LOGIN (goal/G43.18, box v29, "The relay login"; spec: ./spirit-faceLogin.md). Andy's box: "The relay serves a logged-out
// face one plain page, the one-field form, with spirit.js and seal.js only, which make the sealed link home. boot.js,
// shell.css, face.css and every other part of the shell come from the home node over that link.", and "The login is
// spirit.login, in spirit.js, no app. It holds the relay's own calls, state, login and logout on /face/api, and draws the one
// field when logged out. shell/login/ and its login.json go." A real scratch node, a real relay, a real face and its login,
// and a real Chrome on the face at <name>.localhost, a secure context as a face over https is. A step that could not run is
// red, never skipped.

const fs = require('fs');
const path = require('path');
const http = require('http');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { scratchNode, scratchFaceRelay, chromePage, findChrome, sleep, until } = require(path.join(RUN, 'test', 'headLessChrome.js'));

const DOMAIN = 'localhost';
const NAME = 'login';
const MAIL = 'bert@example.org';
function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }

async function home(base, verb, args) {
  const r = await fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
  const text = await r.text();
  return { status: r.status, text: text, body: parsed(text) };
}
// A request as the face's page sends it, at the face's own host.
function at(relay, method, p, body, sid) {
  return new Promise(function (resolve) {
    const b = body === undefined ? '' : JSON.stringify(body);
    const host = NAME + '.' + DOMAIN + ':' + relay.port;
    const headers = { Host: host, Origin: 'http://' + host };
    if (b) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(b); }
    if (sid) headers.Cookie = 'spirit_face=' + sid;
    const q = http.request({ host: '127.0.0.1', port: relay.port, path: p, method: method, headers: headers }, function (r) {
      let text = ''; r.on('data', function (d) { text += d; });
      r.on('end', function () { resolve({ status: r.statusCode, type: String(r.headers['content-type'] || ''), text: text, cookie: String(r.headers['set-cookie'] || '') }); });
    });
    q.on('error', function (e) { resolve({ status: 0, text: String(e && e.message) }); });
    q.end(b || undefined);
  });
}
// A real join, the star pressed at home (box v29: a face only on a starred relay), a real face, a real login.
async function faceOf(N, R) {
  await home(N.base, 'relay.add', { url: R.base, label: 'scratch' });
  await home(N.base, 'relay.join', { url: R.base, email: MAIL });
  await until(function () { return R.mailed.length > 0; }, 5000);
  const code = R.mailed[0] && ((/[?&]join=([A-Za-z0-9_-]+)/.exec(R.mailed[0].text)) || [])[1];
  if (!code) return { why: 'the relay mailed no join code' };
  await home(N.base, 'relay.join', { url: R.base, email: MAIL, code: code });
  const star = await home(N.base, 'contact.own', { key: R.relayKey, own: true });
  if (star.status !== 200) return { why: 'contact.own: ' + short(star.text) };
  let f = null;
  for (let i = 0; i < 10; i++) { f = await home(N.base, 'relay.face', { url: R.base, name: NAME }); if (f.status === 200) break; await sleep(2000); }
  if (!f || f.status !== 200) return { why: 'relay.face: ' + short(f && f.text) };
  await until(function () { return at(R, 'POST', '/face/api', { call: 'state', args: {} }).then(function (s) { return s.status === 200; }); }, 15000);
  const from = R.mailed.length;
  await at(R, 'POST', '/face/api', { call: 'login', args: { text: MAIL } });
  await until(function () { return R.mailed.length > from; }, 5000);
  const token = R.mailed[from] && String(R.mailed[from].text).split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return /^[A-Za-z0-9_-]{16,}$/.test(l); })[0];
  if (!token) return { why: 'the relay mailed no login token' };
  const done = await at(R, 'POST', '/face/api', { call: 'login', args: { text: token } });
  const sid = ((/spirit_face=([^;]+)/.exec(done.cookie)) || [])[1];
  return sid ? { sid: sid } : { why: 'the login: ' + short(done.text) };
}
// What the page shows: its visible fields, the scripts it loaded, by path, and whether a shell is drawn (Contacts, intrinsic,
// is on every shell's list).
const SEEN = '(function () { var f = Array.prototype.slice.call(document.querySelectorAll("input, textarea, select")).filter(function (e) { return e.offsetParent !== null && e.type !== "hidden"; }); ' +
  'var loaded = performance.getEntriesByType("resource").map(function (e) { return e.name.replace(/^https?:\\/\\/[^/]+/, ""); }); ' +
  'var L = window.spirit && window.spirit.login; ' +
  'return JSON.stringify({ fields: f.length, loaded: loaded, login: !!L && ["state", "login", "logout"].every(function (k) { return typeof L[k] === "function"; }), shell: /\\bContacts\\b/.test(document.body.innerText) }); }())';

test.startTest('spirit-faceLogin.js: the relay login, a plain page, and the shell from the home node (goal/G43.18)');

(async function () {
  test.subHeading('the box: "shell/login/ and its login.json go"');
  ok(!fs.existsSync(path.join(RUN, 'shell', 'login')), 'shell/login/ is gone', 'shell/login/ is still there: ' + short(fs.existsSync(path.join(RUN, 'shell', 'login')) ? fs.readdirSync(path.join(RUN, 'shell', 'login')) : []));

  const N = await scratchNode();
  const R = await scratchFaceRelay({ members: [], faceDomain: DOMAIN });
  let chrome = null;
  try {
    if (!N.up || !R.up) { test.fail('the scratch node or relay did not come up: nothing judged'); return; }
    const F = await faceOf(N, R);
    ok(!!F.sid, 'the world: a real node has a real face on a starred relay, logged in', 'nothing judged: ' + F.why);
    if (!F.sid) return;

    test.subHeading('the box: "The relay serves a logged-out face one plain page ... with spirit.js and seal.js only"');
    const pageGot = await at(R, 'GET', '/');
    ok(pageGot.status === 200 && /text\/html/.test(pageGot.type), 'the relay serves the face its page', 'GET /: ' + pageGot.status + ' ' + short(pageGot.type));
    for (const p of ['/spirit.js', '/shell/seal.js']) {
      const g = await at(R, 'GET', p);
      ok(g.status === 200 && g.text.length > 0, 'the relay serves ' + p, 'GET ' + p + ': ' + g.status);
    }
    // "boot.js, shell.css, face.css and every other part of the shell come from the home node over that link": logged out
    // or in, the relay itself serves none of them.
    for (const sid of ['', F.sid]) {
      for (const p of ['/shell/boot.js', '/shell.css', '/shell/face.css', '/shell/login/login.js', '/shell/login/login.json']) {
        const g = await at(R, 'GET', p, undefined, sid);
        ok(g.status !== 200, (sid ? 'logged in' : 'logged out') + ', the relay does not serve ' + p, (sid ? 'logged in' : 'logged out') + ', the relay serves ' + p + ' itself: ' + g.status);
      }
    }

    const where = findChrome();
    if (!where) { test.fail('no Chrome here: nothing judged'); return; }
    chrome = await chromePage(where);
    if (chrome.error) { test.fail('Chrome: ' + chrome.error); return; }
    const FACE = 'http://' + NAME + '.' + DOMAIN + ':' + R.port + '/';

    test.subHeading('the box: "The login is spirit.login, in spirit.js, no app ... and draws the one field when logged out"');
    await chrome.send('Page.navigate', { url: FACE });
    await until(function () { return chrome.evaluate('!!window.spirit && document.readyState === "complete"'); }, 20000);
    await sleep(3000);
    const out = parsed(await chrome.evaluate(SEEN)) || {};
    ok(out.login === true, 'spirit.login holds state, login and logout', 'spirit.login: ' + short(await chrome.evaluate('JSON.stringify(Object.keys((window.spirit && window.spirit.login) || {}))')));
    ok(out.fields === 1, 'logged out, the page shows one field', 'logged out, the page shows ' + out.fields + ' fields: ' + short(await chrome.evaluate('document.body.innerText')));
    const notThree = (out.loaded || []).filter(function (n) { return !/^\/(spirit\.js|shell\/seal\.js|favicon\.ico|shell\/favicon\.svg)(\?|$)/.test(n) && !/^\/face\/api/.test(n); });
    ok(Array.isArray(out.loaded) && !notThree.length, 'logged out, it loads nothing but spirit.js and seal.js', 'logged out, it loaded ' + short(notThree));

    test.subHeading('logged in: the shell comes from the home node, over the link');
    const set = await chrome.send('Network.setCookie', { name: 'spirit_face', value: F.sid, url: FACE, path: '/' });
    ok(!!(set.result && set.result.success), 'the world: the browser holds the login', 'the browser would not take the cookie: ' + short(set));
    await chrome.send('Page.navigate', { url: FACE });
    const drew = await until(function () { return chrome.evaluate(SEEN).then(function (t) { const v = parsed(t) || {}; return v.shell === true; }); }, 30000);
    const inn = parsed(await chrome.evaluate(SEEN)) || {};
    ok(!!drew, 'logged in, the face draws the home node\'s shell', 'logged in, no shell drew: ' + short(await chrome.evaluate('document.body.innerText')));
    const plainGets = (inn.loaded || []).filter(function (n) { return /^\/shell\/(boot\.js|face\.css)|^\/shell\.css/.test(n); });
    ok(!!drew && !plainGets.length, 'and none of boot.js, shell.css or face.css came as the relay\'s own file', 'logged in, the page fetched from the relay: ' + short(plainGets));

    test.subHeading('the box: spirit.login "holds ... logout"');
    await chrome.evaluate('Promise.resolve(window.spirit.login.logout()).then(function () { return true; }, function (e) { return String(e); })');
    await chrome.send('Page.navigate', { url: FACE });
    await until(function () { return chrome.evaluate('!!window.spirit && document.readyState === "complete"'); }, 20000);
    await sleep(3000);
    const after = parsed(await chrome.evaluate(SEEN)) || {};
    ok(after.fields === 1 && after.shell === false, 'logged out by spirit.login.logout, the page shows the one field again', 'after logout: ' + short(after));
    const st = await at(R, 'POST', '/face/api', { call: 'state', args: {} }, F.sid);
    ok(st.status === 200 && !/"loggedIn":\s*true/.test(st.text), 'and the relay holds the login no more', 'after logout the relay says: ' + short(st.text));
  } finally {
    try { if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
    try { R.stop(); } catch (e) { /* gone */ }
    try { if (N.child) N.child.kill(); } catch (e) { /* gone */ }
    try { if (N.root) fs.rmSync(N.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
