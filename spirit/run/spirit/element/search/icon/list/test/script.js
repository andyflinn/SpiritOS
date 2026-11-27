'use strict';

// spirit/run/spirit/element/search/icon/list/test/script.js
// The icons list reads one file (spec: ./script.md; goal/G43.11). Andy: "run://spirit/iconSet.json IS the system set now.";
// since goal/G43.32 the fs family's, followed: "It obviously must require the fs interface so it can listen to changes in the
// file it loads for it's icon list....". A real Chrome on a scratch node's page, and on a real face through a real relay,
// the file read as a page reads it; and the file itself, and every reader, from the tree. One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync, spawn } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
// Every node this test uses is one of lab's (goal/G47.3): its tree by scratchTree, its node by startNodeOn.
const LABH = LOADER.requireScript('spirit/test/headLessChrome.js');
const REPO = path.resolve(RUN, '..', '..');
const test = LOADER.requireScript('spirit/test/testReport.js');
const { scratchNode, scratchFaceRelay, chromePage, findChrome, until, sleep } = LOADER.requireScript('spirit/test/headLessChrome.js');

const SET = 'spirit/iconSet.json';
const OWN = 'spirit/state/app/icons/data/iconSet.json';
const DOMAIN = 'localhost';
const NAME = 'icons';
const MAIL = 'bert@example.org';
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
function source(rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8'); } catch (e) { return ''; } }

async function home(base, verb, args) {
  const r = await fetch(base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
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
    q.on('error', function () { resolve({ status: 0, text: '' }); });
    q.end(b);
  });
}
// A real join, a real face, a real login; answers the session, or none.
async function faceOf(N, R) {
  await home(N.base, 'relay.add', { url: R.base, label: 'scratch' });
  await home(N.base, 'relay.join', { url: R.base, email: MAIL });
  await until(function () { return R.mailed.length > 0; }, 5000);
  const code = R.mailed[0] && ((/[?&]join=([A-Za-z0-9_-]+)/.exec(R.mailed[0].text)) || [])[1];
  if (!code) return {};
  await home(N.base, 'relay.join', { url: R.base, email: MAIL, code: code });
  let f = null;
  for (let i = 0; i < 10; i++) { f = await home(N.base, 'relay.face', { url: R.base, name: NAME }); if (f.status === 200) break; await sleep(2000); }
  if (!f || f.status !== 200) return {};
  await until(function () { return facePost(R, '/face/api', { call: 'state', args: {} }).then(function (s) { return s.status === 200; }); }, 15000);
  const from = R.mailed.length;
  await facePost(R, '/face/api', { call: 'login', args: { text: MAIL } });
  await until(function () { return R.mailed.length > from; }, 5000);
  const token = R.mailed[from] && String(R.mailed[from].text).split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return /^[A-Za-z0-9_-]{16,}$/.test(l); })[0];
  if (!token) return {};
  const done = await facePost(R, '/face/api', { call: 'login', args: { text: token } });
  const sid = ((/spirit_face=([^;]+)/.exec(done.cookie)) || [])[1];
  return sid ? { sid: sid } : {};
}

// A list made in a box of the page, every read and every watch of the set kept. Answers what the page has asked so far.
const MAKE = '(function () {' +
  // The fs branch bound first, by its api.js's path as the list binds it (goal/G49.6: nothing hands out a branch by its name,
  // so what readyPromise answers holds no fs), and its loadFile kept at its one place, the object every require of it answers. Its
// watches are counted on its client (goal/G49.23, box v22 Part 1), the reads the list reads on that branch.
  ' return window.spirit.readyPromise.then(function () { if (window.__asks) return null; window.__asks = []; window.__watches = [];' +
  '  return Promise.resolve(window.spirit.requireScript("spirit/fs/script.js")).then(function (f) {' +
  '  window.__fs = f; var read = f.loadFile; f.loadFile = function (p) { window.__asks.push(String(p)); return read.apply(this, arguments); }; }); }).then(function () {' +
  '  return window.spirit.requireScript("spirit/element/search/icon/list/script.js"); }).then(function () { var F = window.__fs.client;' +
  '   if (!F.__kept) { F.__kept = true; var watch = F.watch; F.watch = function (p) { window.__watches.push(typeof p === "function" ? "the tree" : String(p)); return watch.apply(this, arguments); }; }' +
  '   var box = document.body.appendChild(document.createElement("div")); box.style.cssText = "position:fixed;left:0;top:0;width:600px;height:400px;display:flex;flex-direction:column;background:#fff;z-index:99999";' +
  '   window.__list = window.spirit.element.search.icon.list.create(box, { face: "pane" }); window.__box = box; return "made"; }); })';
const SEEN = 'JSON.stringify({ asks: (window.__asks || []).filter(function (p) { return /iconSet\\.json$/.test(p); }), watches: (window.__watches || []).filter(function (p) { return /iconSet\\.json$/.test(p) || p === "the tree"; }), SET: window.spirit.element.search.icon.list.SET })';
// What the newest list answers to a word, typed as the owner types it: the glyphs it draws.
const FINDS = function (word) {
  return '(function () { var i = [].filter.call(window.__box.querySelectorAll("input"), function (x) { return x.getClientRects().length && x.type !== "checkbox"; })[0]; i.value = ' + JSON.stringify(word) + '; i.dispatchEvent(new Event("input", { bubbles: true })); return true; })()';
};

// What the world and the tests make, for the tests after them.
let tracked = [], set = {}, glyphs = [], PLANTED = '', N, R, chrome, open, made, seen, lastOnly, lastWord, shows, lacks, one, atHome, F, FACE;

// the box: "This file: run://spirit/iconSet.json"
test.run('spirit/iconSet.json is in git', 0.2, function () {
  tracked = execSync('git ls-files -- spirit/run/' + SET, { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean);
  return tracked.indexOf('spirit/run/' + SET) !== -1 ? true : false;
}, test.limit.quick);
test.run('spirit/iconSet.json is a set of glyphs, each with its keywords', 0.2, function () {
  set = parsed(source(SET)) || {};
  glyphs = Object.keys(set);
  return glyphs.length > 0 && glyphs.every(function (g) { return Array.isArray(set[g]); }) ? true : false;
}, test.limit.quick);

// A glyph the set does not have, for the Icons app's own file below.
test.run('there is a glyph the set does not have', 0.2, function () {
  for (let c = 0x1F980; c < 0x1FB00 && !PLANTED; c++) { const g = String.fromCodePoint(c); if (!glyphs.includes(g)) PLANTED = g; }
  return !!PLANTED ? true : false;
}, test.limit.quick);

// the box: "the list element reads this one file, with no 'own, else system' any more"
test.run('the list does not name the Icons app\'s file', 0.2, function () {
  return source('spirit/element/search/icon/list/script.js').indexOf(OWN) === -1 ? true : false;
}, test.limit.quick);
test.run('the row element does not name the Icons app\'s file either, comments included', 0.2, function () {
  return source('spirit/element/search/icon/row/script.js').indexOf(OWN) === -1 ? true : false;
}, test.limit.quick);

test.after(async function () {
  if (chrome && chrome.kid) chrome.kid.kill();
  if (N && N.child) N.child.kill();
  if (R && R.stop) await R.stop();
  try { if (chrome && chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (N && N.root) LABH.freeTree(N); } catch (e) { /* left */ }
});
test.run('a scratch node, a scratch relay and Chrome come up', 0.2, async function () {
  const where = findChrome();
  if (!where) return false;
  if (!PLANTED || !glyphs.length) return false;
  N = await scratchNode();
  R = await scratchFaceRelay({ members: [], faceDomain: DOMAIN });
  if (!N.up || !R.up) return false;
  // The Icons app's own file, as a node has it: the list must not read it.
  const own = path.join(N.root, 'spirit', 'run', OWN);
  fs.mkdirSync(path.dirname(own), { recursive: true });
  fs.writeFileSync(own, JSON.stringify({ [PLANTED]: ['planted'] }));
  const c = await chromePage(where);
  if (c.error) { if (c.kid) chrome = c; return false; }
  chrome = c;
  open = async function (url) {
    await chrome.send('Page.navigate', { url: url });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.readyPromise)'); }, 20000);
  };
  made = async function () { return chrome.evaluate(MAKE + '()').catch(function () { return null; }); };
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
  // A search ranks near matches too, so what must not be there is judged by its glyph.
  lacks = async function (word, glyph) {
    await chrome.evaluate(FINDS(word));
    await sleep(800);
    return chrome.evaluate('window.__box.innerText').then(function (x) { return String(x).indexOf(glyph) === -1; });
  };
  return true;
}, test.limit.slow);

// at home
test.run('the list is made', 0.2, async function () {
  if (!open) return false;
  await open(N.base + '/');
  one = await made();
  return one === 'made' ? true : false;
}, test.limit.slow);
test.run('it finds the file\'s last icon by its word', 0.2, async function () {
  if (one !== 'made') return false;
  return (await shows(lastWord, lastOnly)) ? true : false;
}, test.limit.long);
test.run('it does not find the glyph of the Icons app\'s own file', 0.2, async function () {
  if (one !== 'made') return false;
  return (await lacks('planted', PLANTED)) ? true : false;
}, test.limit.slow);
test.run('its file is spirit/iconSet.json', 0.2, async function () {
  if (one !== 'made') return false;
  atHome = await seen();
  return atHome.SET === SET ? true : false;
}, test.limit.slow);
test.run('it reads that file and no other, through spirit.fs.api.loadFile', 0.2, function () {
  if (!atHome) return false;
  return JSON.stringify(atHome.asks) === JSON.stringify([SET]) ? true : false;
}, test.limit.quick);

// goal/G43.32, Andy: "It obviously must require the fs interface so it can listen to changes in the file it loads for
// it's icon list....": no longer a constant.
// the fs family's: kept in its cache, the file followed, read once for every list
test.run('the list watches the file\'s row, and the fs tree for a reconnect', 0.2, function () {
  if (!atHome) return false;
  return JSON.stringify(atHome.watches.slice().sort()) === JSON.stringify([SET, 'the tree']) ? true : false;
}, test.limit.quick);
test.run('the rows stay after the stream connects', 0.2, async function () {
  if (one !== 'made') return false;
  await chrome.evaluate('window.__sameLoad = true; 1');
  await sleep(4000);
  return (await shows(lastWord, lastOnly)) ? true : false;
}, test.limit.slow);
test.run('a second list on the page has them too', 0.2, async function () {
  if (one !== 'made') return false;
  const two = await made();
  return two === 'made' && await shows(lastWord, lastOnly) ? true : false;
}, test.limit.slow);
test.run('the file was read once for both lists', 0.2, async function () {
  if (one !== 'made') return false;
  const asks = (await seen()).asks;
  return asks.length === 1 ? true : false;
}, test.limit.slow);
test.run('the node goes away and comes back while the page stays open', 0.2, async function () {
  if (one !== 'made') return false;
  const port = Number(new URL(N.base).port);
  N.child.kill();
  await until(function () { return Promise.resolve(N.child.exitCode !== null); }, 8000);
  await sleep(2000);
  N.child = LABH.startNodeOn(N.run, port);
  // goal/G49.23 Part 2: node.card is spirit.card.
  const back = await until(function () { return home(N.base, 'spirit.card').then(function (r) { return r.status === 200; }, function () { return false; }); }, 30000);
  return !!back ? true : false;
}, test.limit.slow);
test.run('the rows are still there after the reconnect', 0.2, async function () {
  if (one !== 'made') return false;
  await sleep(6000);
  return (await shows(lastWord, lastOnly)) ? true : false;
}, test.limit.long);
// A RECONNECT FORGETS NOTHING (goal/G47.1, box v148; Andy: "THE FUCKING CACHE IS NOT WIPED OUT."): the set the page held
// stays, so the file is not read again.
test.run('after the reconnect the file is not read again, since the page kept the set', 0.2, async function () {
  if (one !== 'made') return false;
  const asks = (await seen()).asks;
  return asks.length === 1 ? true : false;
}, test.limit.slow);
test.run('all of this happens on the one load of the page', 0.2, async function () {
  if (one !== 'made') return false;
  return (await chrome.evaluate('window.__sameLoad === true')) === true ? true : false;
}, test.limit.slow);

// a changed file reaches the open page
test.run('the open page has the changed file with no reload', 0.2, async function () {
  if (one !== 'made') return false;
  fs.writeFileSync(path.join(N.root, 'spirit', 'run', SET), JSON.stringify(Object.assign({}, set, { [PLANTED]: ['committedword'] })));
  return (await shows('committedword', PLANTED)) ? true : false;
}, test.limit.long);
test.run('the changed file arrives on the same load of the page', 0.2, async function () {
  if (one !== 'made') return false;
  return (await chrome.evaluate('window.__sameLoad === true')) === true ? true : false;
}, test.limit.slow);
test.run('with the file put back, the page has the planted glyph no more', 0.2, async function () {
  if (one !== 'made') return false;
  fs.writeFileSync(path.join(N.root, 'spirit', 'run', SET), JSON.stringify(set));
  await chrome.evaluate(FINDS('committedword'));
  return !!(await until(function () { return chrome.evaluate('window.__box.innerText').then(function (x) { return String(x).indexOf(PLANTED) === -1; }); }, 6000)) ? true : false;
}, test.limit.long);

// on a real face
test.run('a real node has a real face, logged in', 0.2, async function () {
  if (!open) return false;
  F = await faceOf(N, R);
  return !!F.sid ? true : false;
}, test.limit.long);
// A FACE WITH NO STAR GETS NOTHING (goal/G43.18, box v29: "A face is whole, or there is none"; Andy, Q18: "yes"): its page
// has no link home, so the set file is not read there; asked, it answers no text within ten seconds.
test.run('a face with no star reads no set file', 0.8, async function () {
  if (!F || !F.sid) return false;
  FACE = 'http://' + NAME + '.' + DOMAIN + ':' + R.port + '/';
  await chrome.send('Network.setCookie', { name: 'spirit_face', value: F.sid, url: FACE, path: '/' });
  await open(FACE);
  await sleep(2000);
  const got = await chrome.evaluate('Promise.race([window.spirit.readyPromise.then(function () { return window.spirit.requireScript("spirit/fs/script.js"); }).then(function (f) { return f.loadFile(' + JSON.stringify(SET) + '); }).then(function (t) { return typeof t === "string" ? "read" : "none"; }, function () { return "none"; }), new Promise(function (r) { setTimeout(function () { r("none"); }, 10000); })])');
  return got === 'none' ? true : false;
}, test.limit.slow);

// The star put on at home: a face page opened after it has the set (a starless page has no link to hear a star by).
test.run('the star is put on at home', 0.2, async function () {
  if (!FACE) return false;
  const star = await home(N.base, 'contact.faceable', { key: R.relayKey, faceable: true });
  return star.status === 200 ? true : false;
}, test.limit.slow);
test.run('a fresh starred face has the set too', 0.2, async function () {
  if (!FACE) return false;
  await open(FACE);
  await sleep(2000);
  return (await made()) === 'made' && await shows(lastWord, lastOnly) ? true : false;
}, test.limit.long);
test.run('the starred faces get the set through one read of the file', 0.2, async function () {
  if (!FACE) return false;
  const asks = (await seen()).asks;
  return JSON.stringify(asks) === JSON.stringify([SET]) ? true : false;
}, test.limit.slow);
