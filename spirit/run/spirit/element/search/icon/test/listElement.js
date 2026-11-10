'use strict';

// spirit/run/spirit/element/search/icon/test/listElement.js
// The icons list reads one file (spec: ./listElement.md; goal/G43.11). Andy: "run://spirit/iconSet.json IS the system set now.",
// "we make it a constant, that way i cannot change, and leave code that reads it hanging". A real Chrome on a scratch node's page, and on a real face through a real relay,
// the file read as a page reads it; and the file itself, and every reader, from the tree.

const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync, spawn } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, scratchFaceRelay, chromePage, findChrome, until, sleep } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

const SET = 'spirit/iconSet.json';
const OLD = 'shell/json/iconSet.json';
const OWN = 'spirit/state/icons/data/iconSet.json';
const DOMAIN = 'localhost';
const NAME = 'icons';
const MAIL = 'bert@example.org';
function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
function source(rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8'); } catch (e) { return ''; } }

async function home(base, verb, args) {
  const r = await fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
  const text = await r.text();
  return { status: r.status, text: text, body: parsed(text) };
}
function facePost(relay, p, body) {
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
  await until(function () { return facePost(R, '/face/api', { call: 'state', args: {} }).then(function (s) { return s.status === 200; }); }, 15000);
  const from = R.mailed.length;
  await facePost(R, '/face/api', { call: 'login', args: { text: MAIL } });
  await until(function () { return R.mailed.length > from; }, 5000);
  const token = R.mailed[from] && String(R.mailed[from].text).split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return /^[A-Za-z0-9_-]{16,}$/.test(l); })[0];
  if (!token) return { why: 'the relay mailed no login token' };
  const done = await facePost(R, '/face/api', { call: 'login', args: { text: token } });
  const sid = ((/spirit_face=([^;]+)/.exec(done.cookie)) || [])[1];
  return sid ? { sid: sid } : { why: 'the login: ' + short(done.text) };
}

// A list made in a box of the page, every read and every watch of the set kept. Answers what the page has asked so far.
const MAKE = '(function () {' +
  ' return window.spirit.ready.then(function (s) { if (!window.__asks) { window.__asks = []; window.__watches = [];' +
  '  var read = s.fs.loadFile; s.fs.loadFile = function (p) { window.__asks.push(String(p)); return read.apply(this, arguments); }; }' +
  '  return window.spirit.require("spirit/element/search/icon/listElement.js"); }).then(function () { var F = window.spirit.data.fs.data;' +
  '   if (!F.__kept) { F.__kept = true; var watch = F.watchFile; F.watchFile = function (p) { window.__watches.push(String(p)); return watch.apply(this, arguments); }; }' +
  '   var box = document.body.appendChild(document.createElement("div")); box.style.cssText = "position:fixed;left:0;top:0;width:600px;height:400px;display:flex;flex-direction:column;background:#fff;z-index:99999";' +
  '   window.__list = window.spirit.element.spirit.element.search.icon.listElement.create(box, { face: "pane" }); window.__box = box; return "made"; }); })';
const SEEN = 'JSON.stringify({ asks: (window.__asks || []).filter(function (p) { return /iconSet\\.json$/.test(p); }), watches: (window.__watches || []).filter(function (p) { return /iconSet\\.json$/.test(p); }), SET: window.spirit.element.spirit.element.search.icon.listElement.SET })';
// What the newest list answers to a word, typed as the owner types it: the glyphs it draws.
const FINDS = function (word) {
  return '(function () { var i = [].filter.call(window.__box.querySelectorAll("input"), function (x) { return x.getClientRects().length && x.type !== "checkbox"; })[0]; i.value = ' + JSON.stringify(word) + '; i.dispatchEvent(new Event("input", { bubbles: true })); return true; })()';
};

test.startTest('listElement.js: the icons list reads one file (goal/G43.11)');

(async function () {
  test.subHeading('the box: "This file: run://spirit/iconSet.json"');
  const tracked = execSync('git ls-files -- spirit/run/' + SET + ' spirit/run/' + OLD, { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean);
  ok(tracked.indexOf('spirit/run/' + SET) !== -1, SET + ' is in git', SET + ' is not in git');
  const set = parsed(source(SET)) || {};
  const glyphs = Object.keys(set);
  ok(glyphs.length > 0 && glyphs.every(function (g) { return Array.isArray(set[g]); }), 'and it is a set: each glyph with its keywords', SET + ' holds: ' + short(glyphs.length));

  test.subHeading('the box: "The old system set, shell/json/iconSet.json, is deleted in this item", "none uses the old file"');
  ok(!fs.existsSync(path.join(RUN, OLD)), OLD + ' is gone', OLD + ' still stands');
  ok(tracked.indexOf('spirit/run/' + OLD) === -1, 'and git no longer holds it', 'git still holds ' + OLD);
  // A glyph the set does not have, for the Icons app's own file below.
  let PLANTED = ''; for (let c = 0x1F980; c < 0x1FB00 && !PLANTED; c++) { const g = String.fromCodePoint(c); if (!glyphs.includes(g)) PLANTED = g; }
  ok(!!PLANTED, 'the world: a glyph the set does not have', 'the set has every glyph tried');
  // The two tests that check for the old file name it.
  const QUOTES = ['spirit/run/spirit/element/search/icon/test/listElement.js', 'spirit/run/shell/icons/test/icons.js'];
  const namers = execSync('git ls-files -- spirit', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(function (f) { return /\.(js|html|json)$/.test(f) && QUOTES.indexOf(f) === -1; })
    .filter(function (f) { try { return fs.readFileSync(path.join(REPO, f), 'utf8').indexOf(OLD) !== -1; } catch (e) { return false; } });
  ok(namers.length === 0, 'no file names the old file', 'these still name ' + OLD + ': ' + short(namers));

  test.subHeading('the box: "the list element reads this one file, with no \'own, else system\' any more"');
  const listCode = source('spirit/element/search/icon/listElement.js');
  const rowCode = source('spirit/element/search/icon/rowElement.js');
  ok(listCode.indexOf(OWN) === -1, 'the list does not name the Icons app\'s file', 'the list still names ' + OWN);
  ok(rowCode.indexOf(OWN) === -1, 'nor does the row element, comment included', 'the row element still names ' + OWN);

  const where = findChrome();
  if (!where) { test.fail('no Chrome on this machine: nothing judged in a page'); test.reportSuccessFailureCount(); return; }
  const N = await scratchNode();
  const R = await scratchFaceRelay({ members: [], faceDomain: DOMAIN });
  let chrome = null;
  try {
    if (!N.up || !R.up) { test.fail('the scratch node or relay did not come up: nothing judged'); return; }
    // The Icons app's own file, as a node has it: the list must not read it.
    const own = path.join(N.root, 'spirit', 'run', OWN);
    fs.mkdirSync(path.dirname(own), { recursive: true });
    fs.writeFileSync(own, JSON.stringify({ [PLANTED]: ['planted'] }));
    chrome = await chromePage(where);
    if (chrome.error) { test.fail('Chrome: ' + chrome.error); return; }
    const open = async function (url) {
      await chrome.send('Page.navigate', { url: url });
      await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    };
    const made = async function () { return chrome.evaluate(MAKE + '()').catch(function (e) { return String(e && e.message); }); };
    const seen = function () { return chrome.evaluate(SEEN).then(parsed); };
    // A word only one icon of the file has, and what the list shows for it.
    const words = {};
    glyphs.forEach(function (g) { set[g].forEach(function (w) { words[w] = (words[w] || 0) + 1; }); });
    const lastOnly = glyphs.slice().reverse().filter(function (g) { return set[g].some(function (w) { return words[w] === 1 && /^[a-z]{4,}$/.test(w); }); })[0];
    const lastWord = set[lastOnly].filter(function (w) { return words[w] === 1 && /^[a-z]{4,}$/.test(w); })[0];
    const shows = async function (word, glyph) {
      await chrome.evaluate(FINDS(word));
      return !!(await until(function () { return chrome.evaluate('window.__box.innerText').then(function (x) { return String(x).indexOf(glyph) !== -1; }); }, 6000));
    };
    const empty = async function (word) {
      await chrome.evaluate(FINDS(word));
      await sleep(800);
      return chrome.evaluate('window.__box.innerText').then(function (x) { return /No icon matches/.test(String(x)); });
    };

    // A search ranks near matches too, so what must not be there is judged by its glyph.
    const lacks = async function (word, glyph) {
      await chrome.evaluate(FINDS(word));
      await sleep(800);
      return chrome.evaluate('window.__box.innerText').then(function (x) { return String(x).indexOf(glyph) === -1; });
    };

    test.subHeading('at home');
    await open(N.base + '/face.html');
    const one = await made();
    ok(one === 'made', 'the list is made', 'the list: ' + short(one));
    if (one !== 'made') return;
    ok(await shows(lastWord, lastOnly), 'it finds the file\'s last icon by its word: ' + lastWord, 'the word ' + lastWord + ' does not find ' + lastOnly);
    ok(await lacks('planted', PLANTED), 'and not the Icons app\'s own file', 'the list finds what only the Icons app\'s file has');
    const atHome = await seen();
    ok(atHome.SET === SET, 'its file is ' + SET, 'its SET is ' + short(atHome.SET));
    ok(JSON.stringify(atHome.asks) === JSON.stringify([SET]), 'it reads that file and no other, through spirit.fs.loadFile', 'it read: ' + short(atHome.asks));

    test.subHeading('the box: "A constant", "A page reads the file once and holds it where a stream connecting does not wipe it"');
    ok(atHome.watches.length === 0, 'nothing watches the file', 'it watches: ' + short(atHome.watches));
    await chrome.evaluate('window.__sameLoad = true; 1');
    await sleep(4000);
    ok(await shows(lastWord, lastOnly), 'the rows stay after the stream connects', 'after the stream connects the list no longer finds ' + lastOnly);
    const two = await made();
    ok(two === 'made' && await shows(lastWord, lastOnly), 'a second list on the page has them too', 'the second list: ' + short(two));
    ok((await seen()).asks.length === 1, 'and the file was read once', 'reads: ' + short((await seen()).asks));
    const port = Number(new URL(N.base).port);
    N.child.kill();
    await until(function () { return Promise.resolve(N.child.exitCode !== null); }, 8000);
    await sleep(2000);
    N.child = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: path.join(N.root, 'spirit', 'run'), stdio: 'ignore' });
    const back = await until(function () { return home(N.base, 'node.card').then(function (r) { return r.status === 200; }, function () { return false; }); }, 30000);
    ok(!!back, 'the world: the node gone and back, the page open', 'the node did not come back: nothing judged');
    await sleep(6000);
    ok(await shows(lastWord, lastOnly), 'the rows are still there after the reconnect', 'after the reconnect the list no longer finds ' + lastOnly);
    ok((await seen()).asks.length === 1, 'still the one read', 'reads: ' + short((await seen()).asks));
    ok((await chrome.evaluate('window.__sameLoad === true')) === true, 'all on the one load of the page', 'the page reloaded itself');

    test.subHeading('the box: "Andy\'s commit shows after a page reload."');
    const setFile = path.join(N.root, 'spirit', 'run', SET);
    fs.writeFileSync(setFile, JSON.stringify(Object.assign({}, set, { [PLANTED]: ['committedword'] })));
    await sleep(3000);
    ok(await lacks('committedword', PLANTED), 'an open page does not change', 'an open page took the changed file');
    await open(N.base + '/face.html');
    ok((await made()) === 'made' && await shows('committedword', PLANTED), 'after a reload the page has it', 'after a reload the page does not have the changed file');
    fs.writeFileSync(setFile, JSON.stringify(set));

    test.subHeading('on a real face');
    const F = await faceOf(N, R);
    ok(!!F.sid, 'a real node has a real face, logged in', 'nothing judged on a face: ' + F.why);
    if (!F.sid) return;
    const FACE = 'http://' + NAME + '.' + DOMAIN + ':' + R.port + '/';
    await chrome.send('Network.setCookie', { name: 'spirit_face', value: F.sid, url: FACE, path: '/' });
    await open(FACE);
    await sleep(2000);
    const refused = await chrome.evaluate('window.spirit.ready.then(function (s) { return s.fs.loadFile(' + JSON.stringify(SET) + '); }).then(function () { return "read"; }, function (e) { return String(e && (e.code || e.message)); })');
    ok(refused !== 'read', 'a face with no star is refused', 'a face with no star read the file');
    ok((await made()) === 'made' && await empty(lastWord), 'and its list has no rows', 'a list on a face with no star has rows');

    test.subHeading('the box: "A read that is refused is not kept, so a face that gets its star can read it later."');
    const star = await home(N.base, 'contact.own', { key: R.relayKey, own: true });
    ok(star.status === 200, 'the star on, the page open', 'contact.own: ' + star.status + ' ' + short(star.text));
    await sleep(2000);
    ok((await made()) === 'made' && await shows(lastWord, lastOnly), 'a new list on the same page has the set', 'a new list on the starred face does not find ' + lastOnly);
    await open(FACE);
    await sleep(2000);
    ok((await made()) === 'made' && await shows(lastWord, lastOnly), 'and a fresh starred face has it', 'a fresh starred face does not find ' + lastOnly);
    ok(JSON.stringify((await seen()).asks) === JSON.stringify([SET]), 'through the one read', 'it read: ' + short((await seen()).asks));
  } finally {
    if (chrome && chrome.kid) chrome.kid.kill();
    if (N.child) N.child.kill();
    if (R.stop) await R.stop();
    try { if (chrome && chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
    try { if (N.root) fs.rmSync(N.root, { recursive: true, force: true }); } catch (e) { /* left */ }
    test.reportSuccessFailureCount();
  }
}());
