'use strict';

// spirit/run/shell/appMigration/test/appMigration.js
// The tests of shell/appMigration/appMigration.js, and of no other module (spec: ./appMigration.md; goal/G43.2). A real
// Chrome on a scratch node's face page, its tile switched on as a node's owner does; neither Andy's node nor an agent's is touched.

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
  ok(!fs.existsSync(path.join(RUN, 'shell', 'appMigration', 'appMigration.json')), 'it has no manifest', 'it has a manifest');
  // ANDY DELETES THE FOLDER (box): nothing tracked outside it may name it.
  let names = [];
  try { names = execFileSync('git', ['grep', '-l', 'appMigration', '--', '.'], { cwd: RUN, encoding: 'utf8' }).split('\n').filter(Boolean); } catch (e) { names = []; }
  const outside = names.filter(function (f) { return f.indexOf('shell/appMigration/') !== 0; });
  ok(names.length > 0 && !outside.length, 'nothing outside its folder names it', names.length ? 'named outside its folder: ' + short(outside) : 'git grep found not even itself: this check judged nothing');
  const identity = JSON.parse(fs.readFileSync(path.join(RUN, 'spirit', 'app', 'server', 'server.json'), 'utf8')).identity;
  const node = await scratchNode();
  const chrome = await chromePage(findChrome());
  try {
    if (!node.up || chrome.error) { test.fail('no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '')); return; }
    const mark = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'fs.annotate', args: { path: 'shell/appMigration/appMigration.js', payload: { app: true } } }) });
    ok(mark.status === 200, 'its tile is switched on, as the owner does', 'the switch answered ' + mark.status + ' ' + short(await mark.text()));
    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    const tile = await until(function () { return chrome.evaluate('document.body.innerText.indexOf("appMigration") !== -1'); }, 20000);
    ok(tile, 'the face\'s desktop shows it', 'no tile: ' + short(await chrome.evaluate('document.body.innerText')));
    const opened = await chrome.evaluate('(function () { var all = document.querySelectorAll("*"); var hit = null; for (var i = 0; i < all.length; i++) { if (!all[i].children.length && String(all[i].innerText || "").trim() === "appMigration") hit = all[i]; } if (!hit) return false; hit.click(); return true; }())');
    ok(opened === true, 'its tile can be pressed', 'no tile to press');
    const shown = await until(function () { return chrome.evaluate('!!(window.spirit.elements && window.spirit.elements.appSelector) && document.body.innerText.indexOf(' + JSON.stringify(identity.label) + ') !== -1'); }, 10000);
    ok(shown, 'it mounts appSelector, with server in it', 'opened, the page shows ' + short(await chrome.evaluate('document.body.innerText')));
  } finally {
    try { if (chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
    try { if (chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
