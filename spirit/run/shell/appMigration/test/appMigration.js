'use strict';

// spirit/run/shell/appMigration/test/appMigration.js
// The tests of shell/appMigration/appMigration.js, and of no other module (spec: ./appMigration.md; goal/G43.2). A real
// Chrome on a scratch node's face page, at home, where every app shows with no switch and no star (Andy); neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until, sleep } = require(path.join(RUN, 'test', 'headLessChrome.js'));

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
    // ITS OWN TILES (Andy, box: "appMigration will now do the appSelector search under the hood, by calling spirit.app.search(""),
    // and display the icons it finds as tiles"; Q6: a pressed tile does nothing). A tile is the desktop's, .app-icon.
    const tileOf = function (label) { return 'Array.prototype.filter.call(document.querySelectorAll(".app-icon"), function (t) { return t.offsetParent !== null && String(t.innerText || "").indexOf(' + JSON.stringify(label) + ') !== -1; })[0]'; };
    const shown = await until(function () { return chrome.evaluate('!!' + tileOf(identity.label)); }, 10000);
    ok(shown, 'opened, it shows a tile for server, labelled ' + identity.label, 'opened, the page shows ' + short(await chrome.evaluate('document.body.innerText')));
    const html = String(await chrome.evaluate('(function () { var t = ' + tileOf(identity.label) + '; return t ? t.innerHTML : ""; }())'));
    ok(html.indexOf(identity.icon) !== -1 || /<svg|<img/.test(html), 'the tile shows server\'s icon', 'the tile has no icon: ' + short(html));
    const others = await chrome.evaluate('Array.prototype.filter.call(document.querySelectorAll(".app-icon"), function (t) { return t.offsetParent !== null; }).map(function (t) { return t.innerText; }).join("|")');
    ok(String(others).indexOf('Job Monitor') === -1, 'the desktop is gone: these are its own tiles', 'the desktop\'s tiles are still on show: ' + short(others));
    const inputs = await chrome.evaluate('Array.prototype.filter.call(document.querySelectorAll("input"), function (t) { return t.offsetParent !== null; }).length');
    ok(inputs === 0, 'the search is under the hood: no search box', inputs + ' input(s) on show');
    const before = await chrome.evaluate('document.body.innerText');
    const pressed = await chrome.evaluate('(function () { var t = ' + tileOf(identity.label) + '; if (!t) return false; t.click(); return true; }())');
    await sleep(1000);
    const after = await chrome.evaluate('document.body.innerText');
    ok(pressed === true && before === after, 'a pressed tile does nothing', pressed === true ? 'a press changed the page to: ' + short(after) : 'no tile to press');
    // WHO PAINTS, LISTENS (Andy, G41.32): "every row's data ... must update instantly".
    const disk = path.join(node.root, 'spirit', 'run', 'spirit', 'app', 'server', 'server.json');
    const was = JSON.parse(fs.readFileSync(disk, 'utf8'));
    was.identity.label = 'Changed On Disk';
    fs.writeFileSync(disk, JSON.stringify(was));
    const follows = await until(function () { return chrome.evaluate('!!' + tileOf('Changed On Disk')); }, 8000);
    ok(follows, 'a change on the disk paints the tile, no reload', 'the tile kept its old label after the disk changed');
  } finally {
    try { if (chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
    try { if (chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
