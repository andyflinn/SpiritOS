'use strict';

// spirit/run/spirit/app/chat/test/chat.js
// The tests of spirit/app/chat/chat.js, and of no other module (spec: ./chat.md; goal/G43.31). The box: "chat.json:
// identity icon 💬, label "Chat", not intrinsic; shell.mount true, with a tile; node.mount true, because the server runs on
// the node (Andy: "app icon remains the same. manifest shows node:mount AND shell:mount")", and "chat.js is the one file the
// node and the page load (Andy: "chat.js splits between browser and node.... the usual pattern"). In node it requires
// nodeChat.js. On a page it brings element.js and draws it." Its json and code read from the disc; then a scratch node of
// its own, the app switched on: the process the node runs for it, and its tile in a real Chrome, opened as a user opens it.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const APP = path.join(RUN, 'spirit', 'app', 'chat');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function json(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1'); } catch (e) { return ''; } }

test.startTest('chat: the chat app in spirit/app/chat/, chat.json and chat.js (goal/G43.31)');

(async function () {
  test.subHeading('chat.json: "app icon remains the same. manifest shows node:mount AND shell:mount"');
  const own = json(path.join(APP, 'chat.json'));
  ok(!!own, 'spirit/app/chat/chat.json is there', 'spirit/app/chat/chat.json is not there, or no JSON');
  const id = (own && own.identity) || {};
  ok(id.icon === '💬', 'its icon is 💬', 'its icon is ' + short(id.icon));
  ok(id.label === 'Chat', 'its label is Chat', 'its label is ' + short(id.label));
  ok(!!own && id.intrinsic !== true, 'it is not intrinsic', 'identity.intrinsic is ' + short(id.intrinsic));
  ok(!!(own && own.shell && own.shell.mount === true && own.shell.tile === true), 'shell mount true, with a tile', 'its shell part: ' + short(own && own.shell));
  ok(!!(own && own.node && own.node.mount === true), 'node mount true: the server runs on the node', 'its node part: ' + short(own && own.node));

  test.subHeading('chat.js: one file, split between node and page');
  const src = code(path.join(APP, 'chat.js'));
  ok(/nodeChat\.js/.test(src), 'it names nodeChat.js, for the node', 'chat.js names no nodeChat.js');
  ok(/element\.js/.test(src), 'and element.js, for a page', 'chat.js names no element.js');
  ok(src !== '' && !/innerHTML|activateApp/.test(src), 'and draws nothing itself', 'chat.js draws or reaches the old shell: ' + short(src.match(/innerHTML|activateApp/g)));

  const chrome = H.findChrome();
  const node = await H.scratchNode();
  let page = null;
  try {
    if (!node.up || !node.root) { test.fail('no scratch node of its own: nothing judged'); return; }
    const call = async function (name, args) {
      const r = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: name, args: args || {} }) });
      const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch (e) { b = null; }
      return { status: r.status, body: b, text: t };
    };

    test.subHeading('switched on, the node runs chat.js, which serves the branch chat');
    await call('app.active', { key: 'chat', active: true });
    const up = await H.until(function () { return call('chat.chats.search', {}).then(function (r) { return r.status === 200; }); }, 40000);
    ok(up, 'its server answers chat.chats.search', 'chat.chats.search: ' + short((await call('chat.chats.search', {})).text));
    const job = ((await call('jobs.get', { key: 'spirit.app.chat' })).body || {}).job || {};
    const pid = Number((job.data && job.data.pid) || job.pid || 0);
    let cmd = '';
    try { cmd = pid ? fs.readFileSync('/proc/' + pid + '/cmdline', 'utf8').split('\0').join(' ') : ''; } catch (e) { cmd = ''; }
    if (process.platform === 'linux') ok(/spirit\/app\/chat\/chat\.js/.test(cmd), 'the process the node runs for it is spirit/app/chat/chat.js', 'job spirit.app.chat runs ' + short(cmd || job));
    else ok(/chat\.js/.test(JSON.stringify(job)), 'the job the node runs for it names chat.js', 'job spirit.app.chat: ' + short(job));

    test.subHeading('its tile opens it, as a user opens it');
    if (!chrome) { test.fail('no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name'); return; }
    page = await H.chromePage(chrome);
    if (!page || page.error) { test.fail(page ? page.error : 'no Chrome page'); return; }
    await page.send('Page.navigate', { url: node.base + '/face.html' });
    await H.until(function () { return page.evaluate('!!(window.spirit && window.spirit.ready)').then(Boolean); }, H.WAIT);
    const tiles = await page.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/app/appSelector.js"); }).then(function () { window.pageErrors = []; window.addEventListener("error", function (e) { window.pageErrors.push(String(e.message)); }); var c = document.createElement("div"); c.id = "faces"; c.style.cssText = "position:fixed;left:0;top:0;width:1200px;height:760px;display:flex;flex-direction:column;background:#111;z-index:9"; document.body.appendChild(c); window.fsel = spirit.element.spirit.app.appSelector.create(c, { face: "tiles" }); if (window.fsel.parentNode !== c) c.appendChild(window.fsel); return "made"; }, function (e) { return String(e && e.message || e); })');
    ok(tiles === 'made', 'the world: the app selector\'s tiles', 'the tiles: ' + short(tiles));
    const TILE = 'Array.prototype.filter.call(document.querySelectorAll("#faces .app-icon"), function (t) { return t.offsetParent !== null && String(t.textContent).indexOf("Chat") !== -1; })[0]';
    ok(await H.until(function () { return page.evaluate('!!' + TILE); }, 10000), 'Chat has a tile, switched on', 'no Chat tile: ' + short(await page.evaluate('String(document.getElementById("faces").innerText)')));
    ok(await page.evaluate('(function () { var t = ' + TILE + '; return !!t && t.textContent.indexOf("💬") !== -1; }())'), 'its tile shows 💬', 'the Chat tile: ' + short(await page.evaluate('(function () { var t = ' + TILE + '; return t ? t.textContent : ""; }())')));
    await page.evaluate('(function () { var t = ' + TILE + '; if (t) t.click(); return !!t; }())');
    ok(await H.until(function () { return page.evaluate('(function () { var l = Array.prototype.filter.call(document.querySelectorAll("#faces .app-container"), function (c) { return c.offsetParent !== null; }).pop(); return !!l && Array.prototype.some.call(l.querySelectorAll("textarea"), function (t) { return /Enter sends/.test(t.getAttribute("placeholder") || ""); }); }())'); }, 15000),
      'its tile opens it: the chat, its input there', 'after the tile: ' + short(await page.evaluate('String(document.getElementById("faces").innerText).slice(0, 300)')));
    const errs = JSON.parse(await page.evaluate('JSON.stringify(window.pageErrors || [])'));
    ok(errs.length === 0, 'and the page threw nothing', 'page errors: ' + short(errs));
  } finally {
    if (page && page.kid) page.kid.kill();
    if (node.child) node.child.kill();
    try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
