'use strict';

// spirit/run/spirit/test/server.js
// The tests of spirit/server.js (spec: ./server.md). goal/G43.30: "/" is the face. Andy: "can we delete run://shell/,
// run://spirit/shell/index.html, and make face.html the default for "/" ???"; the box: "In spirit/server.js, the home page
// is face.html." A scratch node of its own (test/headLessChrome.js); its "/" asked over HTTP and opened in a real Chrome.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const H = require(path.join(RUN, 'test', 'headLessChrome.js'));
const FACE = path.join(RUN, 'spirit', 'shell', 'face.html');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

test.startTest('server.js: "/" is the face, face.html (goal/G43.30)');

(async function () {
  const node = await H.scratchNode();
  let page = null;
  try {
    if (!node.up) { test.fail('the scratch node did not come up: nothing judged'); return; }
    const face = fs.readFileSync(FACE, 'utf8');

    test.subHeading('"/" answers face.html, byte for byte');
    const r = await fetch(node.base + '/');
    const body = await r.text();
    ok(r.status === 200, '"/" answers 200', '"/" answered ' + r.status);
    ok(/^text\/html/.test(String(r.headers.get('content-type'))), 'as text/html', 'its content type is ' + short(r.headers.get('content-type')));
    ok(body === face, 'its body is spirit/shell/face.html as it stands on the disc', 'its body is not face.html: ' + short(body.slice(0, 200)));

    test.subHeading('opened in a real Chrome, "/" is the face: the spirit object, ready');
    const chrome = H.findChrome();
    if (!chrome) { test.fail('no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name'); return; }
    page = await H.chromePage(chrome);
    if (!page || page.error) { test.fail(page ? page.error : 'no Chrome page'); return; }
    await page.send('Page.navigate', { url: node.base + '/' });
    const ready = await H.until(function () { return page.evaluate('!!(window.spirit && window.spirit.ready)').then(Boolean); }, H.WAIT);
    ok(ready, 'the page at "/" has the spirit object', 'no spirit object at "/"');
    const settled = ready ? await page.evaluate('window.spirit.ready.then(function () { return "ready"; }, function (e) { return "refused: " + String(e && e.message || e); })') : '';
    ok(settled === 'ready', 'and spirit.ready settles, as on face.html', 'spirit.ready at "/": ' + short(settled));
    const scripts = JSON.parse(await page.evaluate('JSON.stringify(Array.prototype.map.call(document.scripts, function (s) { return s.getAttribute("src") || ""; }).filter(Boolean))'));
    const faceScripts = (face.match(/src="([^"]*)"/g) || []).map(function (m) { return m.slice(5, -1); });
    ok(JSON.stringify(scripts.slice(0, faceScripts.length)) === JSON.stringify(faceScripts), 'it loads face.html\'s own scripts, ' + short(faceScripts), 'the page at "/" loads ' + short(scripts));
  } finally {
    if (page && page.kid) page.kid.kill();
    if (node.child) node.child.kill();
    try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
