'use strict';

// spirit/run/shell/appMigration/test/appMigration.js
// The tests of shell/appMigration/appMigration.js, and of no other module (spec: ./appMigration.md; goal/G43.2). A real
// Chrome on a scratch node's face page, at home, where every app shows with no switch and no star (Andy); neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const FILE = path.join(RUN, 'shell', 'appMigration', 'appMigration.js');

test.startTest('appMigration.js: the throw-away host of appSelector (goal/G43.2)');

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('shell/appMigration/appMigration.js is not there'); return; }
  // ANDY DELETES THE FOLDER (box): nothing tracked outside it may name it.
  let names = [];
  try { names = execFileSync('git', ['grep', '-l', 'appMigration', '--', '.'], { cwd: RUN, encoding: 'utf8' }).split('\n').filter(Boolean); } catch (e) { names = []; }
  const outside = names.filter(function (f) { return f.indexOf('shell/appMigration/') !== 0 && f !== 'process/js/desk/currentGoal.json'; });
  ok(names.length > 0 && !outside.length, 'nothing outside its folder names it', names.length ? 'named outside its folder: ' + short(outside) : 'git grep found not even itself: this check judged nothing');
  const identity = JSON.parse(fs.readFileSync(path.join(RUN, 'spirit', 'app', 'server', 'server.json'), 'utf8')).identity;
  const node = await scratchNode();
  const chrome = await chromePage(findChrome());
  try {
    if (!node.up || chrome.error) { test.fail('no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '')); return; }
    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    const tile = await until(function () { return chrome.evaluate('document.body.innerText.indexOf("appMigration") !== -1'); }, 20000);
    ok(tile, 'the face\'s desktop shows it at home, with no switch and no star', 'no tile: ' + short(await chrome.evaluate('document.body.innerText')));
    const opened = await chrome.evaluate('(function () { var all = document.querySelectorAll("*"); var hit = null; for (var i = 0; i < all.length; i++) { if (!all[i].children.length && String(all[i].innerText || "").trim() === "appMigration") hit = all[i]; } if (!hit) return false; hit.click(); return true; }())');
    ok(opened === true, 'its tile can be pressed', 'no tile to press');
    // JUST A WRAPPER (Andy, box: "appMigration becomes JUST a wrapper for \"run/spirit/ui.js\""): what it does is spirit/app/appTiles.js's, whose test judges it (spirit/test/ui.js). Here: it mounts that, in the real shell.
    const tileOf = function (label) { return 'Array.prototype.filter.call(document.querySelectorAll(".app-icon"), function (t) { return t.offsetParent !== null && String(t.innerText || "").indexOf(' + JSON.stringify(label) + ') !== -1; })[0]'; };
    const visible = function (sel) { return 'Array.prototype.filter.call(document.querySelectorAll(' + JSON.stringify(sel) + '), function (t) { return t.offsetParent !== null; })[0]'; };
    // The box: "appMigration wraps appSelector in face tiles", and "in :tiles mode, only activated apps will appear."
    await chrome.evaluate('window.spirit.ready.then(function (s) { return s.app.activeApp({ key: "server", active: true }); }).then(function () { return true; }, function () { return false; })');
    const shown = await until(function () { return chrome.evaluate('!!(window.spirit.elements && window.spirit.elements.appSelector) && !(window.spirit.app && window.spirit.app.appTiles) && !!' + tileOf(identity.label)); }, 10000);
    ok(shown, 'opened, it mounts appSelector in face tiles, and server\'s tile is there', 'opened, the page shows ' + short(await chrome.evaluate('document.body.innerText')));
    const others = await chrome.evaluate('Array.prototype.filter.call(document.querySelectorAll(".app-icon"), function (t) { return t.offsetParent !== null; }).map(function (t) { return t.innerText; }).join("|")');
    ok(String(others).indexOf('Job Monitor') === -1, 'the desktop is gone: these are appSelector\'s tiles', 'the desktop\'s tiles are still on show: ' + short(others));
    // NONE OF THE SHELL'S BUSINESS (Andy, box: "NO INTERFERENCE FROM ANY FUCKING SHELL").
    const shellNow = function () { return chrome.evaluate('(function () { var b = document.querySelector("#app-close"); return JSON.stringify({ t: document.title, closeShown: !!(b && b.offsetParent !== null) }); }())'); };
    const shellBefore = await shellNow();
    await chrome.evaluate('(function () { var t = ' + tileOf(identity.label) + '; if (t) t.click(); }())');
    const open = await until(function () { return chrome.evaluate('!!' + visible('.app-container')); }, 8000);
    ok(open, 'a pressed tile opens the app inside it', 'a press opened nothing: ' + short(await chrome.evaluate('document.body.innerText')));
    const shellOpen = await shellNow();
    ok(shellOpen === shellBefore, 'the shell does not notice: its title and its own button stay as they were', 'the shell changed: ' + shellBefore + ' to ' + shellOpen);
    const src = fs.readFileSync(FILE, 'utf8').replace(/\/\/.*$/gm, '');
    ok(src.indexOf('spirit/app/appSelector.js') !== -1 && src.indexOf('appTiles') === -1 && !/app-icon|app-container|\.search\(|createElement/.test(src), 'its own script draws nothing and asks nothing', 'its script still does the work: ' + short(src));
  } finally {
    try { if (chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
    try { if (chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
