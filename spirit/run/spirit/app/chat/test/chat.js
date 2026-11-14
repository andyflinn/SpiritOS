'use strict';

// spirit/run/spirit/app/chat/test/chat.js
// The tests of spirit/app/chat/chat.js, and of no other module (spec: ./chat.md; goal/G43.31). The box: "chat.json:
// identity icon 💬, label "Chat", not intrinsic; shell.mount true, with a tile; node.mount true, because the server runs on
// the node (Andy: "app icon remains the same. manifest shows node:mount AND shell:mount")", and "chat.js is the one file the
// node and the page load (Andy: "chat.js splits between browser and node.... the usual pattern"). In node it requires
// nodeChat.js. On a page it brings element.js and draws it." Its json and code read from the disc; then a scratch node of
// its own, the app switched on: the process the node runs for it, and its tile in a real Chrome, opened as a user opens it.
// One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const APP = path.join(RUN, 'spirit', 'app', 'chat');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function json(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1'); } catch (e) { return ''; } }

// What the tests make, for the tests after them.
const X = { own: null, id: {}, src: '', node: null, call: null, page: null, TILE: '' };
const NO_NODE = 'no scratch node of its own: the world failed';
const NO_PAGE = 'no page of the app selector\'s tiles: the world failed';
test.after(function () {
  const page = X.page, node = X.node;
  if (page && page.kid) page.kid.kill();
  if (node && node.child) node.child.kill();
  try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (node && node.root) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(node); } catch (e) { /* left */ }
});

// ── chat.json: "app icon remains the same. manifest shows node:mount AND shell:mount" ──
test.run('spirit/app/chat/chat.json is there', 0.2, function () {
  X.own = json(path.join(APP, 'chat.json'));
  X.id = (X.own && X.own.identity) || {};
  return X.own ? true : 'spirit/app/chat/chat.json is not there, or no JSON';
}, test.limit.quick);
test.run('its icon is 💬', 0.2, function () { return X.id.icon === '💬' ? true : 'its icon is ' + short(X.id.icon); }, test.limit.quick);
test.run('its label is Chat', 0.2, function () { return X.id.label === 'Chat' ? true : 'its label is ' + short(X.id.label); }, test.limit.quick);
test.run('it is not intrinsic', 0.2, function () { return !!X.own && X.id.intrinsic !== true ? true : 'identity.intrinsic is ' + short(X.id.intrinsic); }, test.limit.quick);
test.run('shell mount true, with a tile', 0.2, function () {
  const own = X.own;
  return own && own.shell && own.shell.mount === true && own.shell.tile === true ? true : 'its shell part: ' + short(own && own.shell);
}, test.limit.quick);
test.run('node mount true: the server runs on the node', 0.2, function () {
  const own = X.own;
  return own && own.node && own.node.mount === true ? true : 'its node part: ' + short(own && own.node);
}, test.limit.quick);

// Since goal/G43.32 a page loads the main element, element.js, itself (rule 4), and chat.js is the node's alone.
// ── chat.js: the node's script; element.js: the page's (goal/G43.32, rule 4) ──
test.run('it names nodeChat.js, for the node', 0.2, function () {
  X.src = code(path.join(APP, 'chat.js'));
  return (/nodeChat\.js/).test(X.src) ? true : 'chat.js names no nodeChat.js';
}, test.limit.quick);
test.run('and element.js stands beside it, for a page, which chat.js does not load', 0.2, function () {
  return fs.existsSync(path.join(APP, 'element.js')) && !/element\.js/.test(X.src) ? true : 'chat.js still names element.js, or element.js is not there';
}, test.limit.quick);
test.run('and draws nothing itself', 0.2, function () {
  return X.src !== '' && !/innerHTML|activateApp/.test(X.src) ? true : 'chat.js draws or reaches the old shell: ' + short(X.src.match(/innerHTML|activateApp/g));
}, test.limit.quick);

// ── switched on, the node runs chat.js, which serves the branch chat ──
test.run('its server answers chat.chats.search', 0.2, async function () {
  const node = X.node = await H.scratchNode();
  if (!node.up || !node.root) return 'no scratch node of its own: nothing judged';
  X.call = async function (name, args) {
    const r = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: name, args: args || {} }) });
    const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch (e) { b = null; }
    return { status: r.status, body: b, text: t };
  };
  await X.call('app.active', { key: 'chat', active: true });
  const up = await H.until(function () { return X.call('chat.chats.search', {}).then(function (r) { return r.status === 200; }); }, 40000);
  return up ? true : 'chat.chats.search: ' + short((await X.call('chat.chats.search', {})).text);
}, test.limit.slow);
const jobOf = async function () { return ((await X.call('job.get', { key: 'spirit.app.chat' })).body || {}).job || {}; };
if (process.platform === 'linux') {
  test.run('the process the node runs for it is spirit/app/chat/chat.js', 0.2, async function () {
    if (!X.call) return NO_NODE;
    const job = await jobOf();
    const pid = Number((job.data && job.data.pid) || job.pid || 0);
    let cmd = '';
    try { cmd = pid ? fs.readFileSync('/proc/' + pid + '/cmdline', 'utf8').split('\0').join(' ') : ''; } catch (e) { cmd = ''; }
    return (/spirit\/app\/chat\/chat\.js/).test(cmd) ? true : 'job spirit.app.chat runs ' + short(cmd || job);
  }, test.limit.quick);
} else {
  test.run('the job the node runs for it names chat.js', 0.2, async function () {
    if (!X.call) return NO_NODE;
    const job = await jobOf();
    return (/chat\.js/).test(JSON.stringify(job)) ? true : 'job spirit.app.chat: ' + short(job);
  }, test.limit.quick);
}

// ── its tile opens it, as a user opens it ──
test.run('the world: the app selector\'s tiles', 0.2, async function () {
  if (!X.call) return NO_NODE;
  const chrome = H.findChrome();
  if (!chrome) return 'no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name';
  const page = X.page = await H.chromePage(chrome);
  if (!page || page.error) { const why = page ? page.error : 'no Chrome page'; X.page = page && page.kid ? page : null; return why; }
  await page.send('Page.navigate', { url: X.node.base + '/face.html' });
  await H.until(function () { return page.evaluate('!!(window.spirit && window.spirit.ready)').then(Boolean); }, H.WAIT);
  const tiles = await page.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/app/app/element.js"); }).then(function () { window.pageErrors = []; window.addEventListener("error", function (e) { window.pageErrors.push(String(e.message)); }); var c = document.createElement("div"); c.id = "faces"; c.style.cssText = "position:fixed;left:0;top:0;width:1200px;height:760px;display:flex;flex-direction:column;background:#111;z-index:9"; document.body.appendChild(c); window.fsel = spirit.element.spirit.app.app.element.create(c, { face: "tiles" }); if (window.fsel.parentNode !== c) c.appendChild(window.fsel); return "made"; }, function (e) { return String(e && e.message || e); })');
  X.TILE = 'Array.prototype.filter.call(document.querySelectorAll("#faces .app-icon"), function (t) { return t.offsetParent !== null && String(t.textContent).indexOf("Chat") !== -1; })[0]';
  return tiles === 'made' ? true : 'the tiles: ' + short(tiles);
}, test.limit.slow);
test.run('Chat has a tile, switched on', 0.2, async function () {
  const page = X.page;
  if (!page || !X.TILE) return NO_PAGE;
  return await H.until(function () { return page.evaluate('!!' + X.TILE); }, 10000) ? true : 'no Chat tile: ' + short(await page.evaluate('String(document.getElementById("faces").innerText)'));
}, test.limit.quick);
test.run('its tile shows 💬', 0.2, async function () {
  const page = X.page;
  if (!page || !X.TILE) return NO_PAGE;
  return await page.evaluate('(function () { var t = ' + X.TILE + '; return !!t && t.textContent.indexOf("💬") !== -1; }())')
    ? true : 'the Chat tile: ' + short(await page.evaluate('(function () { var t = ' + X.TILE + '; return t ? t.textContent : ""; }())'));
}, test.limit.quick);
test.run('its tile opens it: the chat, its input there', 0.2, async function () {
  const page = X.page;
  if (!page || !X.TILE) return NO_PAGE;
  await page.evaluate('(function () { var t = ' + X.TILE + '; if (t) t.click(); return !!t; }())');
  return await H.until(function () { return page.evaluate('(function () { var l = Array.prototype.filter.call(document.querySelectorAll("#faces .app-container"), function (c) { return c.offsetParent !== null; }).pop(); return !!l && Array.prototype.some.call(l.querySelectorAll("textarea"), function (t) { return /Enter sends/.test(t.getAttribute("placeholder") || ""); }); }())'); }, 15000)
    ? true : 'after the tile: ' + short(await page.evaluate('String(document.getElementById("faces").innerText).slice(0, 300)'));
}, test.limit.quick);
test.run('and the page threw nothing', 0.2, async function () {
  const page = X.page;
  if (!page || !X.TILE) return NO_PAGE;
  const errs = JSON.parse(await page.evaluate('JSON.stringify(window.pageErrors || [])'));
  return errs.length === 0 ? true : 'page errors: ' + short(errs);
}, test.limit.quick);
