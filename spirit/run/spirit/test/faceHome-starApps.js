'use strict';

// spirit/run/spirit/test/faceHome-starApps.js
// A STAR SHOWS EVERY APP (goal/G41.33, Q9; spec: ./faceHome-starApps.md; Andy, of "Should a star show every app on the face, Text Editor and Media Viewer
// too, or does each app's face mark stay yours to set?": "yes. for now."). What the owner sees is the desktop, so a real
// Chrome reads it: a real scratch node, a real relay, a real face and its login, at home and on the face. What a face is
// handed, by its relay's star, is spirit/faceHome.js's, so it is judged beside it (goal/G43.28; Andy: "you WILL FUCKING PLACE
// TESTS WHERE THEY FUCKING BELONG"; moved from shell/test/navigationWrapper-faceStarApps.js, its relay row section beside
// the contact row, spirit/element/search/contact/test/rowElement-relayOnFace.js). A face at
// <name>.localhost is a secure context, as a face over https is. A step that could not run is red, never skipped.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const http = require('http');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { scratchNode, scratchFaceRelay, chromePage, findChrome, sleep, until } = require(path.join(RUN, 'test', 'headLessChrome.js'));

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
// The first tile is the home's own, and is named apart on each ("Spirit" at home, "Your home node" on a face).
const OWN = ['Spirit', 'Your home node'];
const missing = function (want, have) { return want.filter(function (n) { return OWN.indexOf(n) === -1 && have.indexOf(n) === -1; }); };

test.startTest('faceHome-starApps.js: a star shows every app on the face (goal/G41.33, Q9)');

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

    const atHome = await desktop(chrome, N.base + '/');
    test.comment('at home: ' + atHome.join(', '));
    ok(atHome.indexOf('Text Editor') !== -1 && atHome.indexOf('Media Viewer') !== -1, 'at home the desktop shows Text Editor and Media Viewer', 'at home they are not there, nothing judged: ' + short(atHome));

    test.subHeading('no star: each app\'s face mark decides, as today');
    const plain = await desktop(chrome, FACE);
    test.comment('no star: ' + plain.join(', '));
    ok(plain.indexOf('Contacts') !== -1, 'the face\'s desktop is drawn', 'the face drew no desktop, nothing judged: ' + short(plain));
    ok(plain.indexOf('Text Editor') === -1 && plain.indexOf('Media Viewer') === -1, 'Text Editor and Media Viewer are not on it', 'with no star the face shows them: ' + short(plain));

    // WHO PAINTS, LISTENS (goal/G41.32; Andy: "every row's data, wherever it's visible OR invisible must update instantly, and
    // when visible, paint immediately."; "does a star change at home stream to the face????"): the page stays open, no reload.
    test.subHeading('the star pressed at home, the face open: its desktop follows, with no reload');
    const namesNow = async function () { return String(await chrome.evaluate('document.body.innerText')).split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return /[A-Za-z]/.test(l); }); };
    await chrome.evaluate('window.__sameLoad = true; 1');
    const live = await home(N.base, 'contact.own', { key: R.relayKey, own: true });
    ok(live.status === 200, 'the star on, at home', 'contact.own: ' + live.status + ' ' + short(live.text));
    await until(function () { return namesNow().then(function (n) { return n.indexOf('Text Editor') !== -1 && n.indexOf('Media Viewer') !== -1; }); }, 8000);
    const onLive = await namesNow();
    ok(onLive.indexOf('Text Editor') !== -1 && onLive.indexOf('Media Viewer') !== -1, 'Text Editor and Media Viewer come at once', 'the open face shows: ' + short(onLive));
    const liveOff = await home(N.base, 'contact.own', { key: R.relayKey, own: false });
    ok(liveOff.status === 200, 'the star off, at home', 'contact.own false: ' + liveOff.status + ' ' + short(liveOff.text));
    await until(function () { return namesNow().then(function (n) { return n.indexOf('Text Editor') === -1 && n.indexOf('Media Viewer') === -1; }); }, 8000);
    const offLive = await namesNow();
    const cameLive = onLive.indexOf('Text Editor') !== -1 && onLive.indexOf('Media Viewer') !== -1;
    ok(cameLive && offLive.indexOf('Contacts') !== -1 && offLive.indexOf('Text Editor') === -1 && offLive.indexOf('Media Viewer') === -1, 'and go at once', cameLive ? 'the open face shows: ' + short(offLive) : 'they never came: nothing judged');
    ok((await chrome.evaluate('window.__sameLoad === true')) === true, 'all on the one load of the page', 'the page reloaded itself');

    test.subHeading('the star: every app the home desktop shows');
    const on = await home(N.base, 'contact.own', { key: R.relayKey, own: true });
    ok(on.status === 200, 'the star on, at home', 'contact.own: ' + on.status + ' ' + short(on.text));
    const starred = await desktop(chrome, FACE);
    test.comment('starred: ' + starred.join(', '));
    const gap = missing(atHome, starred);
    ok(starred.length > 0 && !gap.length, 'every app on the home desktop is on the starred face', 'on the home desktop and not on the starred face: ' + gap.join(', '));
    ok(starred.indexOf('Join') === -1, 'and Join and the login app stay the boot\'s own', 'a boot part became an app icon: ' + short(starred));

    test.subHeading('an app it shows opens');
    const pageErrors = chrome.heard.length;
    const opened = await chrome.evaluate('(function () { var all = Array.prototype.slice.call(document.querySelectorAll("*")); var hit = all.filter(function (e) { return e.children.length === 0 && e.textContent.trim() === "Text Editor"; })[0]; if (!hit) return false; hit.click(); return true; }())');
    ok(opened === true, 'its tile is there to press', 'no Text Editor tile to press on the starred face');
    await sleep(DRAWN_MS / 2);
    const threw = chrome.heard.slice(pageErrors).filter(function (m) { return m.method === 'Runtime.exceptionThrown'; }).map(function (m) { return m.params.exceptionDetails.text + ' ' + short((m.params.exceptionDetails.exception || {}).description || ''); });
    ok(opened === true && !threw.length, 'pressing it throws nothing in the page', opened === true ? 'pressing Text Editor threw: ' + threw.slice(0, 2).join(' | ') : 'nothing was pressed, so nothing is judged');

    test.subHeading('the star off: back to the face marks');
    const off = await home(N.base, 'contact.own', { key: R.relayKey, own: false });
    ok(off.status === 200, 'the star off, at home', 'contact.own false: ' + off.status + ' ' + short(off.text));
    const again = await desktop(chrome, FACE);
    ok(again.indexOf('Contacts') !== -1 && again.indexOf('Text Editor') === -1 && again.indexOf('Media Viewer') === -1, 'Text Editor and Media Viewer are gone again', 'with the star off the face shows: ' + short(again));
  } finally {
    try { if (chrome && chrome.sock) chrome.sock.close(); if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
    try { if (chrome && chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    try { R.stop(); } catch (e) { /* gone */ }
    try { if (N.child) N.child.kill(); } catch (e) { /* gone */ }
    try { if (N.root) fs.rmSync(N.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
