'use strict';

// spirit/run/spirit/app/server/test/server.js
// The tests of spirit/app/server/server.js, and of no other module (spec: ./server.md; goal/G43.2). A real Chrome on a scratch
// node's face page; neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const FILE = path.join(RUN, 'spirit', 'app', 'server', 'server.js');

test.startTest('server.js: a face-app skeleton (goal/G43.2)');

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('spirit/app/server/server.js is not there'); return; }
  const label = JSON.parse(fs.readFileSync(path.join(RUN, 'spirit', 'app', 'server', 'server.json'), 'utf8')).identity.label;
  const node = await scratchNode();
  const chrome = await chromePage(findChrome());
  try {
    if (!node.up || chrome.error) { test.fail('no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '')); return; }
    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    const made = await chrome.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/app/server/server.js"); }).then(function () { var c = document.createElement("div"); c.id = "under-test"; c.style.cssText = "position:fixed;left:100px;top:100px;width:600px;height:400px;z-index:9999;background:#000"; document.body.appendChild(c); window.made = spirit.element.spirit.app.server.server.create(c); return "made"; }, function (e) { return String(e && e.message || e); })');
    ok(made === 'made', 'it loads through spirit.require and mounts', 'it did not mount: ' + short(made));
    const painted = await until(function () { return chrome.evaluate('String(document.getElementById("under-test").innerText).trim() === ' + JSON.stringify(label)); }, 5000);
    ok(painted, 'it paints its name, ' + label, 'it paints: ' + short(await chrome.evaluate('document.getElementById("under-test").innerText')));
    // The element holding the words, as the page laid it out.
    const box = JSON.parse(await chrome.evaluate('(function () { var c = document.getElementById("under-test"); var w = document.createTreeWalker(c, NodeFilter.SHOW_TEXT); var n = null; while (w.nextNode()) { if (w.currentNode.nodeValue.trim()) { n = w.currentNode; break; } } if (!n) return "{}"; var r = document.createRange(); r.selectNodeContents(n); var b = r.getBoundingClientRect(); return JSON.stringify({ x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2, size: parseFloat(getComputedStyle(n.parentElement).fontSize), body: parseFloat(getComputedStyle(document.body).fontSize) }); }())'));
    ok(box.size >= box.body * 2, 'in big letters: ' + box.size + 'px, the page ' + box.body + 'px', 'its letters are ' + box.size + 'px, the page ' + box.body + 'px');
    ok(Math.abs(box.x - 400) < 3 && Math.abs(box.y - 300) < 3, 'in the center of its container', 'its middle is at ' + box.x + ',' + box.y + ', its container\'s at 400,300');
    const empty = await chrome.evaluate('(function () { window.made.destroy(); return document.getElementById("under-test").children.length === 0 && !String(document.getElementById("under-test").innerText).trim(); }())');
    ok(empty === true, 'destroy empties its container', 'destroy left: ' + short(await chrome.evaluate('document.getElementById("under-test").innerHTML')));
  } finally {
    try { if (chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
    try { if (chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
