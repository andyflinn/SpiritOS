'use strict';

// spirit/run/spirit/client/test/intrinsicFolders.js
// THE OLD SHELL ASKS FOR NO MISSING APP (goal/G43.23, item 13; spec: ./intrinsicFolders.md). The box: "the old shell's
// INTRINSIC_APP_FOLDERS (client/shell.js) still lists stats, apps, contacts, icons: four 404s on every load." A real Chrome loads
// the old shell (the node's /, spirit/shell/index.html, which loads spirit/client/shell.js) from a scratch node, and every
// answer the page got is read. Neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until, sleep } = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

test.startTest('intrinsicFolders.js: every folder the old shell\'s INTRINSIC_APP_FOLDERS names is there, so a load asks for no missing app (goal/G43.23, item 13)');

(async function () {
  const node = await scratchNode();
  const chrome = await chromePage(findChrome());
  try {
    if (!node.up || chrome.error) { test.fail('no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '')); return; }
    await chrome.send('Page.navigate', { url: node.base + '/' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.shell && Array.isArray(window.spirit.shell.INTRINSIC_APP_FOLDERS))'); }, 20000);
    await sleep(2000);
    const folders = await chrome.evaluate('window.spirit && window.spirit.shell && window.spirit.shell.INTRINSIC_APP_FOLDERS');
    ok(Array.isArray(folders) && folders.length > 0, 'the world: the old shell loaded, its INTRINSIC_APP_FOLDERS names ' + short(folders), 'the old shell did not load or names no folder: nothing judged. ' + short(folders));
    if (!Array.isArray(folders) || !folders.length) return;
    // Every answer the page got, by its path.
    const answers = {};
    chrome.heard.filter(function (m) { return m.method === 'Network.responseReceived'; }).forEach(function (m) {
      try { const u = new URL(m.params.response.url); answers[u.pathname] = m.params.response.status; } catch (e) { /* no url */ }
    });
    const asked = folders.map(function (f) { return '/shell/' + f + '/' + f + '.json'; }).filter(function (p) { return p in answers; });
    ok(asked.length > 0, 'the world: the page asked for ' + asked.length + ' of its intrinsic apps\' manifests', 'the page asked for no manifest of its intrinsic apps: nothing judged. ' + short(Object.keys(answers).slice(0, 40)));

    test.subHeading('the box: "still lists stats, apps, contacts, icons: four 404s on every load"');
    folders.forEach(function (f) {
      const dir = path.join(node.root, 'spirit', 'run', 'shell', f);
      ok(fs.existsSync(dir) && fs.statSync(dir).isDirectory(), 'shell/' + f + '/ is there', 'INTRINSIC_APP_FOLDERS names shell/' + f + '/, which is not there');
      const p = '/shell/' + f + '/' + f + '.json';
      ok(!(p in answers) || answers[p] === 200, 'the load asked for no missing ' + p + (p in answers ? ' (' + answers[p] + ')' : ' (not asked)'), 'the load asked for ' + p + ': ' + answers[p]);
    });
  } finally {
    try { if (chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
    try { if (chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    await sleep(300);
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    try { if (chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
