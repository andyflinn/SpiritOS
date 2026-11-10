'use strict';

// spirit/run/spirit/app/introSpector/test/introSpector.js
// The tests of spirit/app/introSpector/introSpector.js, and of no other module (spec: ./introSpector.md; goal/G43.29, box
// v3): introSpector in spirit/app/introSpector/, "as Contacts and Icons did". Andy: "fill in the box, same icons, shell:mount
// only.", "a wrapper for separate spirit/element/ files", "both apps will be intrinsic". Its json read from the disc; the
// app on a real Chrome on a scratch node's face page, through the app selector's tile as a user opens it. What it draws is
// spirit/element/introSpector.js's, judged in its own test.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const APP = path.join(RUN, 'spirit', 'app', 'introSpector');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function json(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, ''); } catch (e) { return ''; } }

test.startTest('introSpector: in spirit/app/introSpector/, a wrapper of a spirit/element/ file (goal/G43.29)');

(async function () {
  test.subHeading('the box: "same icons, shell:mount only", "both apps will be intrinsic", no api.js and no data.js');
  const own = json(path.join(APP, 'introSpector.json'));
  ok(!!own, 'spirit/app/introSpector/introSpector.json is there', 'spirit/app/introSpector/introSpector.json is not there, or no JSON');
  const id = (own && own.identity) || {};
  ok(id.icon === '👓', 'its icon is 👓', 'its icon is ' + short(id.icon));
  ok(id.label === 'introSpector', 'its name stays introSpector', 'its label is ' + short(id.label));
  ok(id.intrinsic === true, 'it is intrinsic', 'identity.intrinsic is ' + short(id.intrinsic));
  ok(!!(own && own.shell && own.shell.mount === true && own.shell.tile === true), 'shell mount true, tile true', 'its shell part: ' + short(own && own.shell));
  ok(!!own && !(own.node && own.node.mount === true) && !(own.node && own.node.run === true), 'node mount false: no server, nothing run', 'its node part: ' + short(own && own.node));
  ok(fs.existsSync(path.join(APP, 'introSpector.js')) && !fs.existsSync(path.join(APP, 'api.js')) && !fs.existsSync(path.join(APP, 'data.js')), 'no api.js and no data.js in its folder', 'spirit/app/introSpector/ holds an api.js or a data.js');

  test.subHeading('"a wrapper for separate spirit/element/ files": introSpector.js only mounts');
  const src = code(path.join(APP, 'introSpector.js'));
  ok(/spirit\/element\/introSpector\.js/.test(src), 'introSpector.js brings spirit/element/introSpector.js', 'introSpector.js names no spirit/element/introSpector.js');
  ok(src !== '' && !/innerHTML|activateApp|callDialog|factRow/.test(src), 'and draws nothing itself: no innerHTML, no old shell helper', 'introSpector.js draws or calls the old shell: ' + short((src.match(/innerHTML|activateApp|callDialog|factRow/g) || []).slice(0, 4)));

  const node = await scratchNode();
  const chrome = await chromePage(findChrome());
  try {
    if (!node.up || chrome.error) { test.fail('no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '')); return; }
    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);

    test.subHeading('spirit.element.spirit.app.introSpector.introSpector.create(container, { open }) -> { destroy }');
    const made = await chrome.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/app/introSpector/introSpector.js"); }).then(function () { var J = spirit.element && spirit.element.spirit.app.introSpector.introSpector; if (!J || typeof J.create !== "function") return "spirit.element.spirit.app.introSpector.introSpector.create is " + typeof (J && J.create); var c = document.createElement("div"); c.id = "alone"; c.style.cssText = "position:fixed;left:0;top:0;width:900px;height:600px;overflow:auto"; document.body.appendChild(c); window.alone = J.create(c, {}); return window.alone && typeof window.alone.destroy === "function" ? "made" : "create answered " + typeof window.alone; }, function (e) { return String(e && e.message || e); })');
    ok(made === 'made', 'it registers spirit.element.spirit.app.introSpector.introSpector, whose create answers { destroy }', 'it: ' + short(made));
    if (made === 'made') {
      ok(await until(function () { return chrome.evaluate('/self \\(this node\\)/.test(document.getElementById("alone").innerHTML)'); }, 10000), 'mounted, it draws its line, the party self (this node)', 'mounted, it shows: ' + short(await chrome.evaluate('String(document.getElementById("alone").innerText)')));
      ok(await chrome.evaluate('(function () { window.alone.destroy(); var c = document.getElementById("alone"); var n = c.children.length; c.remove(); return n === 0; }())'), 'destroy empties its container', 'destroy left its container holding something');
    }

    test.subHeading('its tile opens it');
    const tiles = await chrome.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/app/appSelector.js"); }).then(function () { var c = document.createElement("div"); c.id = "faces"; c.style.cssText = "position:fixed;left:0;top:0;width:1100px;height:760px;display:flex;flex-direction:column;background:#111;z-index:9"; document.body.appendChild(c); window.fsel = spirit.element.spirit.app.appSelector.create(c, { face: "tiles" }); if (window.fsel.parentNode !== c) c.appendChild(window.fsel); return "made"; }, function (e) { return String(e && e.message || e); })');
    ok(tiles === 'made', 'the world: the app selector\'s tiles', 'the tiles: ' + short(tiles));
    const TILE = 'Array.prototype.filter.call(document.querySelectorAll("#faces .app-icon"), function (t) { return t.offsetParent !== null && String(t.textContent).indexOf("introSpector") !== -1; })[0]';
    ok(await until(function () { return chrome.evaluate('!!' + TILE); }, 10000), 'introSpector has a tile, intrinsic and on', 'no introSpector tile: ' + short(await chrome.evaluate('String(document.getElementById("faces").innerText)')));
    await chrome.evaluate('(function () { var t = ' + TILE + '; if (t) t.click(); return !!t; }())');
    ok(await until(function () { return chrome.evaluate('(function () { var l = Array.prototype.filter.call(document.querySelectorAll("#faces .app-container"), function (c) { return c.offsetParent !== null; }).pop(); return !!l && /self \\(this node\\)/.test(l.innerHTML) && !!l.querySelector(".api-family-selector"); }())'); }, 10000), 'its tile opens it: the party self (this node) and the family selector', 'after the tile: ' + short(await chrome.evaluate('String(document.getElementById("faces").innerText)')));
  } finally {
    try { if (chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
    try { if (chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
