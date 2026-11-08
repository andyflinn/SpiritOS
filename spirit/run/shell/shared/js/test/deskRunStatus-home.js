'use strict';

// spirit/run/shell/shared/js/test/deskRunStatus-home.js
// deskRunStatus STAYS IN shell/shared/, ON spirit.elements (goal/G43.5; spec: ./deskRunStatus-home.md). Andy, the box of the element
// move: "shell/shared/ will not be moved or touched. thos elements do NOT belong in spirit.element." On a real page,
// shell/shared/js/deskRunStatus.js, required, stands on spirit.elements and not on spirit.element, and shell/shared/js keeps its
// one file. The element move itself is spirit/test/spirit-elementMove.js.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const REPO = path.resolve(RUN, '../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const H = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600); }

// What does not move, and stays on spirit.elements: "those elements do NOT belong in spirit.element."
const STAYS = [['shell/shared/js/deskRunStatus.js', 'deskRunStatus']];
const tracked = execSync('git ls-files', { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean);
const IN_RUN = tracked.filter(function (f) { return f.indexOf('spirit/run/') === 0; }).map(function (f) { return f.slice('spirit/run/'.length); });

test.startTest('deskRunStatus-home.js: shell/shared/js/deskRunStatus.js stays on spirit.elements (goal/G43.5)');

(async function () {
  const chrome = H.findChrome();
  if (!chrome) { test.fail('no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name'); return; }
  const node = await H.scratchNode();
  let page = null;
  try {
    page = node.up ? await H.chromePage(chrome) : null;
    if (!page || page.error) { test.fail(page ? page.error : 'the scratch node did not come up'); return; }
    await page.send('Page.navigate', { url: node.base + '/index.html' });
    await H.until(function () { return page.evaluate('!!(window.spirit && window.spirit.ready)').then(Boolean); }, H.WAIT);
    await H.sleep(2500);
    test.subHeading('what stays: "shell/shared/ will not be moved or touched. thos elements do NOT belong in spirit.element."');
    for (const s of STAYS) {
      let v = {};
      try { v = JSON.parse(await page.evaluate('Promise.resolve(window.spirit.require(' + JSON.stringify(s[0]) + ')).then(function () { return JSON.stringify({ old: !!(window.spirit.elements || {})[' + JSON.stringify(s[1]) + '], now: !!(window.spirit.element || {})[' + JSON.stringify(s[1]) + '] }); })')); } catch (e) { v = { threw: String(e) }; }
      ok(v.old === true && v.now === false, s[0] + ': ' + s[1] + ' stays on spirit.elements', s[0] + ': ' + short(v));
    }
    const shared = IN_RUN.filter(function (f) { return /^shell\/shared\/js\/[^/]+\.js$/.test(f); });
    ok(shared.length === 1, 'shell/shared/js keeps its one file', 'shell/shared/js holds ' + short(shared));
  } finally {
    if (page && page.kid) page.kid.kill();
    if (node.child) node.child.kill();
    try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(process.exitCode || 0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(1); });
