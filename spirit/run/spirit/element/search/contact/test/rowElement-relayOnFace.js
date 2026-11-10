'use strict';

// spirit/run/spirit/element/search/contact/test/rowElement-relayOnFace.js
// A RELAY'S ROW IS A RELAY'S, ON A FACE (goal/G41.32; spec: ./rowElement-relayOnFace.md). A contact row follows its row: the
// presence stream puts a relay's row in the page before Contacts' search says relay: yes, and the row must open the relay,
// never the person's page. What it draws is spirit/element/search/contact/rowElement.js's, so it is judged beside it
// (goal/G43.28; Andy: "you WILL FUCKING PLACE TESTS WHERE THEY FUCKING BELONG"; moved from the relay row section of
// shell/test/navigationWrapper-faceStarApps.js). A real Chrome: a real scratch node, a real relay, a real face and its login. A face at
// <name>.localhost is a secure context, as a face over https is. A step that could not run is red, never skipped.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const http = require('http');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, scratchFaceRelay, chromePage, findChrome, sleep, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

const DOMAIN = 'localhost';
const NAME = 'apps';
const MAIL = 'bert@example.org';
const DRAWN_MS = 6000;
function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }

async function home(base, verb, args) {
  const r = await fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
  const text = await r.text();
  return { status: r.status, text: text, body: parsed(text) };
}
function page(relay, p, body) {
  return new Promise(function (resolve) {
    const b = JSON.stringify(body);
    const host = NAME + '.' + DOMAIN + ':' + relay.port;
    const q = http.request({ host: '127.0.0.1', port: relay.port, path: p, method: 'POST', headers: { Host: host, Origin: 'http://' + host, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) } }, function (r) {
      let text = ''; r.on('data', function (d) { text += d; });
      r.on('end', function () { resolve({ status: r.statusCode, text: text, cookie: String(r.headers['set-cookie'] || '') }); });
    });
    q.on('error', function (e) { resolve({ status: 0, text: String(e && e.message) }); });
    q.end(b);
  });
}
// A real join, a real face, a real login; answers the session, or why not.
async function faceOf(N, R) {
  await home(N.base, 'relay.add', { url: R.base, label: 'scratch' });
  await home(N.base, 'relay.join', { url: R.base, email: MAIL });
  await until(function () { return R.mailed.length > 0; }, 5000);
  const code = R.mailed[0] && ((/[?&]join=([A-Za-z0-9_-]+)/.exec(R.mailed[0].text)) || [])[1];
  if (!code) return { why: 'the relay mailed no join code' };
  await home(N.base, 'relay.join', { url: R.base, email: MAIL, code: code });
  let f = null;
  for (let i = 0; i < 10; i++) { f = await home(N.base, 'relay.face', { url: R.base, name: NAME }); if (f.status === 200) break; await sleep(2000); }
  if (!f || f.status !== 200) return { why: 'relay.face: ' + short(f && f.text) };
  await until(function () { return page(R, '/face/api', { call: 'state', args: {} }).then(function (s) { return s.status === 200; }); }, 15000);
  const from = R.mailed.length;
  await page(R, '/face/api', { call: 'login', args: { text: MAIL } });
  await until(function () { return R.mailed.length > from; }, 5000);
  const token = R.mailed[from] && String(R.mailed[from].text).split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return /^[A-Za-z0-9_-]{16,}$/.test(l); })[0];
  if (!token) return { why: 'the relay mailed no login token' };
  const done = await page(R, '/face/api', { call: 'login', args: { text: token } });
  const sid = ((/spirit_face=([^;]+)/.exec(done.cookie)) || [])[1];
  return sid ? { sid: sid } : { why: 'the login: ' + short(done.text) };
}
// The names on a desktop, as it reads: icon and name line by line, the name lines only.
async function desktop(chrome, url) {
  await chrome.send('Page.navigate', { url: url });
  await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.events)'); }, 20000);
  await sleep(DRAWN_MS);
  const text = String(await chrome.evaluate('document.body.innerText'));
  return text.split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return /[A-Za-z]/.test(l); });
}

test.startTest('rowElement-relayOnFace.js: a relay\'s row in Contacts opens the relay on a face, whichever came first (goal/G41.32)');

(async function () {
  const N = await scratchNode();
  const R = await scratchFaceRelay({ members: [], faceDomain: DOMAIN });
  let chrome = null;
  try {
    if (!N.up || !R.up) { test.fail('the scratch node or relay did not come up: nothing judged'); return; }
    const F = await faceOf(N, R);
    ok(!!F.sid, 'a real node has a real face, logged in', 'nothing judged: ' + F.why);
    if (!F.sid) return;
    const where = findChrome();
    if (!where) { test.fail('no Chrome here: nothing judged'); return; }
    chrome = await chromePage(where);
    if (chrome.error) { test.fail('Chrome: ' + chrome.error); return; }
    const FACE = 'http://' + NAME + '.' + DOMAIN + ':' + R.port + '/';
    const set = await chrome.send('Network.setCookie', { name: 'spirit_face', value: F.sid, url: FACE, path: '/' });
    ok(!!(set.result && set.result.success), 'the browser holds the login', 'the browser would not take the cookie: ' + short(set));

    // The face's desktop is drawn, so Contacts is there to press.
    const plain = await desktop(chrome, FACE);
    ok(plain.indexOf('Contacts') !== -1, 'the world: the face\'s desktop is drawn, Contacts on it', 'the face drew no desktop, nothing judged: ' + short(plain));

    // A RELAY'S ROW IS A RELAY'S (goal/G41.32; Andy: "where the fuck did the contents of the relayPanel disappear to", "No
    // folding panels anymore"; cw, on his node: the presence stream puts the row in the page before Contacts' search says
    // relay: yes, so it was made as a person and stayed one). On a face that order is the usual one; a row follows its row.
    test.subHeading('a relay\'s row in Contacts opens the relay, whichever came first');
    const TILE = '(function () { var a = Array.prototype.slice.call(document.querySelectorAll("*")); var e = a.filter(function (x) { return x.offsetParent !== null && !x.children.length && x.textContent.trim() === WORDS; })[0]; if (!e) return false; e.click(); return true; }())';
    const press = function (words) { return chrome.evaluate(TILE.replace('WORDS', JSON.stringify(words))); };
    const pressedApp = await press('Contacts');
    await sleep(DRAWN_MS / 2);
    const pressedRow = await press('scratch');
    ok(pressedApp === true && pressedRow === true, 'Contacts opens, and the relay\'s row is pressed', 'Contacts ' + pressedApp + ', row ' + pressedRow + ': ' + short(await chrome.evaluate('document.body.innerText')));
    await until(function () { return chrome.evaluate('document.querySelectorAll(".nd-fold").length > 0'); }, 8000);
    const relayOpened = await chrome.evaluate('JSON.stringify({ folds: document.querySelectorAll(".nd-fold").length, person: /Public Handle/.test(document.body.innerText) })').then(JSON.parse);
    ok(relayOpened.folds > 0, 'its panel opens, with its folds', 'no folds: ' + short(await chrome.evaluate('document.body.innerText')));
    ok(relayOpened.person === false, 'and not the person\'s page', 'the person\'s page opened for a relay');

  } finally {
    try { if (chrome && chrome.sock) chrome.sock.close(); if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
    try { if (chrome && chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    try { R.stop(); } catch (e) { /* gone */ }
    try { if (N.child) N.child.kill(); } catch (e) { /* gone */ }
    try { if (N.root) fs.rmSync(N.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
