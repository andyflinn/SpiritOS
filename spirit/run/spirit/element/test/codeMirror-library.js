'use strict';

// spirit/run/spirit/element/test/codeMirror-library.js
// THE CodeMirror LIBRARY IN spirit/element/codeMirror/, codeMirror.js's OWN FOLDER (goal/G43.5; spec: ./codeMirror-library.md).
// Andy, live: "ALL move the fucking library inside run::/spirit/element/codeMirror/", and "only access to codeMirror library is
// through the element!". Its 15 files stand there and shell/node_modules is gone; no product file but the element names the
// folder; on a real page the page starts with no CodeMirror, and the element draws from there with its sheet, its marks and its
// search keys, asking no other place. The rest of the element move is spirit/test/spirit-elementMove.js.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..');
const REPO = path.resolve(RUN, '../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const H = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600); }

const tracked = execSync('git ls-files', { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean);
const IN_RUN = tracked.filter(function (f) { return f.indexOf('spirit/run/') === 0; }).map(function (f) { return f.slice('spirit/run/'.length); });

test.startTest('codeMirror-library.js: CodeMirror inside spirit/element/codeMirror/, reached only through the element (goal/G43.5)');

(async function () {
  // Andy, live: "ALL move the fucking library inside run::/spirit/element/codeMirror/"
  test.subHeading('the library: CodeMirror inside spirit/element/codeMirror/');
  const lib = IN_RUN.filter(function (f) { return f.indexOf('spirit/element/codeMirror/') === 0; });
  ok(lib.indexOf('spirit/element/codeMirror/lib/codemirror.js') !== -1 && lib.indexOf('spirit/element/codeMirror/LICENSE') !== -1 && lib.length === 15, 'its 15 files, licence included, stand in spirit/element/codeMirror/', 'spirit/element/codeMirror/ holds ' + lib.length + ' files');
  // Andy: "only access to codeMirror library is through the element!"
  const asking = tracked.filter(function (f) { return /\.(js|html|css)$/.test(f) && f.indexOf('spirit/run/') === 0 && !/\/test\//.test(f) && f !== 'spirit/run/spirit/element/codeMirror.js' && f.indexOf('spirit/run/spirit/element/codeMirror/') !== 0 && !/^spirit\/run\/test\//.test(f); }).filter(function (f) {
    return fs.existsSync(path.join(REPO, f)) && /element\/codeMirror\//.test(fs.readFileSync(path.join(REPO, f), 'utf8').split('\n').map(function (l) { const cut = l.search(/(^|[^:'"])\/\//); return cut === -1 ? l : l.slice(0, cut + 1); }).join('\n'));
  });
  ok(!asking.length, 'no product file but the element names the library\'s folder', 'these name it: ' + short(asking));
  ok(!IN_RUN.some(function (f) { return f.indexOf('shell/node_modules/') === 0; }) && !fs.existsSync(path.join(RUN, 'shell/node_modules')), 'shell/node_modules is gone', 'shell/node_modules still stands');

  test.subHeading('the page: "only access to codeMirror library is through the element!"');
  const chrome = H.findChrome();
  if (!chrome) { test.fail('no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name'); return; }
  const node = await H.scratchNode();
  let page = null;
  try {
    page = node.up ? await H.chromePage(chrome) : null;
    if (!page || page.error) { test.fail(page ? page.error : 'the scratch node did not come up'); return; }
    await page.send('Page.navigate', { url: node.base + '/' });
    await H.until(function () { return page.evaluate('!!(window.spirit && window.spirit.ready)').then(Boolean); }, H.WAIT);
    await H.sleep(2500);
    let at = {};
    try { at = JSON.parse(await page.evaluate('JSON.stringify({ library: typeof window.CodeMirror })')); } catch (e) { at = {}; }
    ok(at.library === 'undefined', 'the page starts with no CodeMirror on it: "only access to codeMirror library is through the element!"', 'at start window.CodeMirror is ' + short(at.library));
    await page.evaluate('Promise.resolve(window.spirit.require("spirit/element/codeMirror.js")).then(function () { return true; }, function () { return false; })');
    let cm = {};
    try { cm = JSON.parse(await page.evaluate('(function () { var d = document.body.appendChild(document.createElement("div")); return window.spirit.element.codeMirror.create(d, { mode: "edit", text: "one needle", words: "needle" }).then(function () { return JSON.stringify({ drawn: !!d.querySelector(".CodeMirror"), marks: d.querySelectorAll(".text-view-match").length, cssLoaded: getComputedStyle(d.querySelector(".CodeMirror")).position === "relative", search: !!(window.CodeMirror.commands && window.CodeMirror.commands.find) }); }); })()')); } catch (e) { cm = { threw: String(e) }; }
    const fromHere = await page.evaluate('performance.getEntriesByType("resource").map(function (r) { return r.name; }).filter(function (u) { return /codemirror/i.test(u); }).join(" ")').catch(function () { return ''; });
    ok(cm.drawn === true && cm.marks === 1 && cm.cssLoaded === true && cm.search === true, 'the element draws from there, its sheet, its marks and its search keys with it', 'codeMirror: ' + short(cm));
    ok(/spirit\/element\/codeMirror\/lib\/codemirror\.js/.test(fromHere) && !/shell\/node_modules/.test(fromHere), 'and the page asked the new place only', 'the page asked: ' + short(fromHere));
  } finally {
    if (page && page.kid) page.kid.kill();
    if (node.child) node.child.kill();
    try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(process.exitCode || 0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(1); });
