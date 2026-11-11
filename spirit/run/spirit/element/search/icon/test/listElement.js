'use strict';

// spirit/run/spirit/element/search/icon/test/listElement.js
// The icons list reads one file (spec: ./listElement.md; goal/G43.11). Andy: "run://spirit/iconSet.json IS the system set now.";
// since goal/G43.32 the fs family's, followed: "It obviously must require the fs interface so it can listen to changes in the
// file it loads for it's icon list....". A real Chrome on a scratch node's page, and on a real face through a real relay,
// the file read as a page reads it; and the file itself, and every reader, from the tree. One test.run per test (goal/G47.2).

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
  // The fs family bound first (a file of its own read, not counted): since goal/G43.27 a family binds when first called, and
  // a wrapper put on it before then is bound in as its own loadFile, calling itself for ever.
  ' return window.spirit.ready.then(function (s) { if (window.__asks) return null; window.__asks = []; window.__watches = [];' +
  '  return Promise.resolve(s.fs.loadFile("spirit/fieldRules.js")).then(null, function () {}).then(function () {' +
  '  var read = s.fs.loadFile; s.fs.loadFile = function (p) { window.__asks.push(String(p)); return read.apply(this, arguments); }; }); }).then(function () {' +
  '  return window.spirit.require("spirit/element/search/icon/listElement.js"); }).then(function () { var F = window.spirit.data.fs.data;' +
  '   if (!F.__kept) { F.__kept = true; var watch = F.watch; F.watch = function (p) { window.__watches.push(typeof p === "function" ? "the tree" : String(p)); return watch.apply(this, arguments); }; }' +
  '   var box = document.body.appendChild(document.createElement("div")); box.style.cssText = "position:fixed;left:0;top:0;width:600px;height:400px;display:flex;flex-direction:column;background:#fff;z-index:99999";' +
  '   window.__list = window.spirit.element.spirit.element.search.icon.listElement.create(box, { face: "pane" }); window.__box = box; return "made"; }); })';
const SEEN = 'JSON.stringify({ asks: (window.__asks || []).filter(function (p) { return /iconSet\\.json$/.test(p); }), watches: (window.__watches || []).filter(function (p) { return /iconSet\\.json$/.test(p) || p === "the tree"; }), SET: window.spirit.element.spirit.element.search.icon.listElement.SET })';
// What the newest list answers to a word, typed as the owner types it: the glyphs it draws.
const FINDS = function (word) {
  return '(function () { var i = [].filter.call(window.__box.querySelectorAll("input"), function (x) { return x.getClientRects().length && x.type !== "checkbox"; })[0]; i.value = ' + JSON.stringify(word) + '; i.dispatchEvent(new Event("input", { bubbles: true })); return true; })()';
};

// What the world and the tests make, for the tests after them.
let tracked = [], set = {}, glyphs = [], PLANTED = '', N, R, chrome, open, made, seen, lastOnly, lastWord, shows, empty, lacks, one, atHome, F, FACE;
const NO_PAGE = 'no page: the world failed';
const NO_LIST = 'no list on the page';

// the box: "This file: run://spirit/iconSet.json"
test.run('spirit/iconSet.json is in git', 0.2, function () {
  tracked = execSync('git ls-files -- spirit/run/' + SET + ' spirit/run/' + OLD, { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean);
  return tracked.indexOf('spirit/run/' + SET) !== -1 ? true : SET + ' is not in git';
}, 1000);
test.run('and it is a set: each glyph with its keywords', 0.2, function () {
  set = parsed(source(SET)) || {};
  glyphs = Object.keys(set);
  return glyphs.length > 0 && glyphs.every(function (g) { return Array.isArray(set[g]); }) ? true : SET + ' holds: ' + short(glyphs.length);
}, 1000);

// the box: "The old system set, shell/json/iconSet.json, is deleted in this item", "none uses the old file"
test.run('shell/json/iconSet.json is gone', 0.2, function () {
  return !fs.existsSync(path.join(RUN, OLD)) ? true : OLD + ' still stands';
}, 1000);
test.run('and git no longer holds it', 0.2, function () {
  return tracked.indexOf('spirit/run/' + OLD) === -1 ? true : 'git still holds ' + OLD;
}, 1000);
// A glyph the set does not have, for the Icons app's own file below.
test.run('the world: a glyph the set does not have', 0.2, function () {
  for (let c = 0x1F980; c < 0x1FB00 && !PLANTED; c++) { const g = String.fromCodePoint(c); if (!glyphs.includes(g)) PLANTED = g; }
  return !!PLANTED ? true : 'the set has every glyph tried';
}, 1000);
test.run('no file names the old file', 0.2, function () {
  // The two tests that check for the old file name it.
  const QUOTES = ['spirit/run/spirit/element/search/icon/test/listElement.js', 'spirit/run/shell/icons/test/icons.js'];
  const namers = execSync('git ls-files -- spirit', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(function (f) { return /\.(js|html|json)$/.test(f) && QUOTES.indexOf(f) === -1; })
    .filter(function (f) { try { return fs.readFileSync(path.join(REPO, f), 'utf8').indexOf(OLD) !== -1; } catch (e) { return false; } });
  return namers.length === 0 ? true : 'these still name ' + OLD + ': ' + short(namers);
}, 3000);

// the box: "the list element reads this one file, with no 'own, else system' any more"
test.run('the list does not name the Icons app\'s file', 0.2, function () {
  return source('spirit/element/search/icon/listElement.js').indexOf(OWN) === -1 ? true : 'the list still names ' + OWN;
}, 1000);
test.run('nor does the row element, comment included', 0.2, function () {
  return source('spirit/element/search/icon/rowElement.js').indexOf(OWN) === -1 ? true : 'the row element still names ' + OWN;
}, 1000);

test.after(async function () {
  if (chrome && chrome.kid) chrome.kid.kill();
  if (N && N.child) N.child.kill();
  if (R && R.stop) await R.stop();
  try { if (chrome && chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (N && N.root) fs.rmSync(N.root, { recursive: true, force: true }); } catch (e) { /* left */ }
});
test.run('the world: a scratch node, a scratch relay and Chrome', 0.2, async function () {
  const where = findChrome();
  if (!where) return 'no Chrome on this machine: nothing judged in a page';
  if (!PLANTED || !glyphs.length) return 'no set read, or no glyph to plant';
  N = await scratchNode();
  R = await scratchFaceRelay({ members: [], faceDomain: DOMAIN });
  if (!N.up || !R.up) return 'the scratch node or relay did not come up: nothing judged';
  // The Icons app's own file, as a node has it: the list must not read it.
  const own = path.join(N.root, 'spirit', 'run', OWN);
  fs.mkdirSync(path.dirname(own), { recursive: true });
  fs.writeFileSync(own, JSON.stringify({ [PLANTED]: ['planted'] }));
  const c = await chromePage(where);
  if (c.error) { if (c.kid) chrome = c; return 'Chrome: ' + c.error; }
  chrome = c;
  open = async function (url) {
    await chrome.send('Page.navigate', { url: url });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
  };
  made = async function () { return chrome.evaluate(MAKE + '()').catch(function (e) { return String(e && e.message); }); };
  seen = function () { return chrome.evaluate(SEEN).then(parsed); };
  // A word only one icon of the file has, and what the list shows for it.
  const words = {};
  glyphs.forEach(function (g) { set[g].forEach(function (w) { words[w] = (words[w] || 0) + 1; }); });
  lastOnly = glyphs.slice().reverse().filter(function (g) { return set[g].some(function (w) { return words[w] === 1 && /^[a-z]{4,}$/.test(w); }); })[0];
  lastWord = set[lastOnly].filter(function (w) { return words[w] === 1 && /^[a-z]{4,}$/.test(w); })[0];
  shows = async function (word, glyph) {
    await chrome.evaluate(FINDS(word));
    return !!(await until(function () { return chrome.evaluate('window.__box.innerText').then(function (x) { return String(x).indexOf(glyph) !== -1; }); }, 6000));
  };
  empty = async function (word) {
    await chrome.evaluate(FINDS(word));
    await sleep(800);
    return chrome.evaluate('window.__box.innerText').then(function (x) { return /No icon matches/.test(String(x)); });
  };
  // A search ranks near matches too, so what must not be there is judged by its glyph.
  lacks = async function (word, glyph) {
    await chrome.evaluate(FINDS(word));
    await sleep(800);
    return chrome.evaluate('window.__box.innerText').then(function (x) { return String(x).indexOf(glyph) === -1; });
  };
  return true;
}, 10000);

// at home
test.run('the list is made', 0.2, async function () {
  if (!open) return NO_PAGE;
  await open(N.base + '/face.html');
  one = await made();
  return one === 'made' ? true : 'the list: ' + short(one);
}, 5000);
test.run('it finds the file\'s last icon by its word', 0.2, async function () {
  if (one !== 'made') return NO_LIST;
  return (await shows(lastWord, lastOnly)) ? true : 'the word ' + lastWord + ' does not find ' + lastOnly;
}, 110000);
test.run('and not the Icons app\'s own file', 0.2, async function () {
  if (one !== 'made') return NO_LIST;
  return (await lacks('planted', PLANTED)) ? true : 'the list finds what only the Icons app\'s file has';
}, 5000);
test.run('its file is spirit/iconSet.json', 0.2, async function () {
  if (one !== 'made') return NO_LIST;
  atHome = await seen();
  return atHome.SET === SET ? true : 'its SET is ' + short(atHome.SET);
}, 3000);
test.run('it reads that file and no other, through spirit.fs.loadFile', 0.2, function () {
  if (!atHome) return NO_LIST;
  return JSON.stringify(atHome.asks) === JSON.stringify([SET]) ? true : 'it read: ' + short(atHome.asks);
}, 1000);

// goal/G43.32, Andy: "It obviously must require the fs interface so it can listen to changes in the file it loads for
// it's icon list....": no longer a constant.
// the fs family's: kept in its cache, the file followed, read once for every list
test.run('the list watches the file\'s row, and the fs tree for a reconnect', 0.2, function () {
  if (!atHome) return NO_LIST;
  return JSON.stringify(atHome.watches.slice().sort()) === JSON.stringify([SET, 'the tree']) ? true : 'it watches: ' + short(atHome.watches);
}, 1000);
test.run('the rows stay after the stream connects', 0.2, async function () {
  if (one !== 'made') return NO_LIST;
  await chrome.evaluate('window.__sameLoad = true; 1');
  await sleep(4000);
  return (await shows(lastWord, lastOnly)) ? true : 'after the stream connects the list no longer finds ' + lastOnly;
}, 15000);
test.run('a second list on the page has them too', 0.2, async function () {
  if (one !== 'made') return NO_LIST;
  const two = await made();
  return two === 'made' && await shows(lastWord, lastOnly) ? true : 'the second list: ' + short(two);
}, 5000);
test.run('and the file was read once', 0.2, async function () {
  if (one !== 'made') return NO_LIST;
  const asks = (await seen()).asks;
  return asks.length === 1 ? true : 'reads: ' + short(asks);
}, 3000);
test.run('the world: the node gone and back, the page open', 0.2, async function () {
  if (one !== 'made') return NO_LIST;
  const port = Number(new URL(N.base).port);
  N.child.kill();
  await until(function () { return Promise.resolve(N.child.exitCode !== null); }, 8000);
  await sleep(2000);
  N.child = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: path.join(N.root, 'spirit', 'run'), stdio: 'ignore' });
  const back = await until(function () { return home(N.base, 'node.card').then(function (r) { return r.status === 200; }, function () { return false; }); }, 30000);
  return !!back ? true : 'the node did not come back: nothing judged';
}, 10000);
test.run('the rows are still there after the reconnect', 0.2, async function () {
  if (one !== 'made') return NO_LIST;
  await sleep(6000);
  return (await shows(lastWord, lastOnly)) ? true : 'after the reconnect the list no longer finds ' + lastOnly;
}, 220000);
// spirit.data forgets on a reconnect, the set with it; the push sets the file's row again, and the two lists read it once.
test.run('read once more for the reconnect, once for both lists', 0.2, async function () {
  if (one !== 'made') return NO_LIST;
  const asks = (await seen()).asks;
  return asks.length === 2 ? true : 'reads: ' + short(asks);
}, 3000);
test.run('all on the one load of the page', 0.2, async function () {
  if (one !== 'made') return NO_LIST;
  return (await chrome.evaluate('window.__sameLoad === true')) === true ? true : 'the page reloaded itself';
}, 3000);

// a changed file reaches the open page
test.run('the open page has the changed file, no reload', 0.2, async function () {
  if (one !== 'made') return NO_LIST;
  fs.writeFileSync(path.join(N.root, 'spirit', 'run', SET), JSON.stringify(Object.assign({}, set, { [PLANTED]: ['committedword'] })));
  return (await shows('committedword', PLANTED)) ? true : 'the open page does not take the changed file';
}, 470000);
test.run('on the same load of the page', 0.2, async function () {
  if (one !== 'made') return NO_LIST;
  return (await chrome.evaluate('window.__sameLoad === true')) === true ? true : 'the page reloaded itself';
}, 3000);
test.run('and the file put back, it has it no more', 0.2, async function () {
  if (one !== 'made') return NO_LIST;
  fs.writeFileSync(path.join(N.root, 'spirit', 'run', SET), JSON.stringify(set));
  await chrome.evaluate(FINDS('committedword'));
  return !!(await until(function () { return chrome.evaluate('window.__box.innerText').then(function (x) { return String(x).indexOf(PLANTED) === -1; }); }, 6000)) ? true : 'the open page keeps a glyph the file no longer has';
}, 450000);

// on a real face
test.run('a real node has a real face, logged in', 0.2, async function () {
  if (!open) return NO_PAGE;
  F = await faceOf(N, R);
  return !!F.sid ? true : 'nothing judged on a face: ' + F.why;
}, 30000);
test.run('a face with no star is refused', 0.2, async function () {
  if (!F || !F.sid) return 'no face: nothing judged';
  FACE = 'http://' + NAME + '.' + DOMAIN + ':' + R.port + '/';
  await chrome.send('Network.setCookie', { name: 'spirit_face', value: F.sid, url: FACE, path: '/' });
  await open(FACE);
  await sleep(2000);
  const refused = await chrome.evaluate('window.spirit.ready.then(function (s) { return s.fs.loadFile(' + JSON.stringify(SET) + '); }).then(function () { return "read"; }, function (e) { return String(e && (e.code || e.message)); })');
  return refused !== 'read' ? true : 'a face with no star read the file';
}, 30000);
test.run('and its list has no rows', 0.2, async function () {
  if (!FACE) return 'no face: nothing judged';
  return (await made()) === 'made' && await empty(lastWord) ? true : 'a list on a face with no star has rows';
}, 10000);

// the box: "A read that is refused is not kept, so a face that gets its star can read it later."
test.run('the star on, the page open', 0.2, async function () {
  if (!FACE) return 'no face: nothing judged';
  const star = await home(N.base, 'contact.own', { key: R.relayKey, own: true });
  return star.status === 200 ? true : 'contact.own: ' + star.status + ' ' + short(star.text);
}, 5000);
test.run('a new list on the same page has the set', 0.2, async function () {
  if (!FACE) return 'no face: nothing judged';
  await sleep(2000);
  return (await made()) === 'made' && await shows(lastWord, lastOnly) ? true : 'a new list on the starred face does not find ' + lastOnly;
}, 110000);
test.run('and a fresh starred face has it', 0.2, async function () {
  if (!FACE) return 'no face: nothing judged';
  await open(FACE);
  await sleep(2000);
  return (await made()) === 'made' && await shows(lastWord, lastOnly) ? true : 'a fresh starred face does not find ' + lastOnly;
}, 130000);
test.run('through the one read', 0.2, async function () {
  if (!FACE) return 'no face: nothing judged';
  const asks = (await seen()).asks;
  return JSON.stringify(asks) === JSON.stringify([SET]) ? true : 'it read: ' + short(asks);
}, 3000);
