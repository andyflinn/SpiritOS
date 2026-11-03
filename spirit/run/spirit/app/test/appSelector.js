'use strict';

// spirit/run/spirit/app/test/appSelector.js
// The tests of spirit/app/appSelector.js, and of no other module (spec: ./appSelector.md; goal/G43.2). A real Chrome on a
// scratch node's face page; neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const FILE = path.join(RUN, 'spirit', 'app', 'appSelector.js');

test.startTest('appSelector.js: the app selector (goal/G43.2)');

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('spirit/app/appSelector.js is not there'); return; }
  const identity = JSON.parse(fs.readFileSync(path.join(RUN, 'spirit', 'app', 'server', 'server.json'), 'utf8')).identity;
  const node = await scratchNode();
  const chrome = await chromePage(findChrome());
  try {
    if (!node.up || chrome.error) { test.fail('no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '')); return; }
    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    const made = await chrome.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/app/appSelector.js"); }).then(function () {' +
      ' var c = document.createElement("div"); c.id = "under-test"; document.body.appendChild(c); window.changes = 0;' +
      ' window.sel = spirit.elements.appSelector.create(c, { face: "pane" }); if (window.sel.parentNode !== c) c.appendChild(window.sel); window.sel.addEventListener("change", function () { window.changes += 1; }); return "made"; }, function (e) { return String(e && e.message || e); })');
    ok(made === 'made', 'it loads through spirit.require and mounts as a pane', 'it did not mount: ' + short(made));
    const text = function () { return chrome.evaluate('String((document.getElementById("under-test") || {}).innerText || "")'); };
    const found = await until(function () { return text().then(function (t) { return t.indexOf(identity.label) !== -1; }); }, 8000);
    ok(found, 'the list shows server\'s label', 'the list never showed "' + identity.label + '": ' + short(await text()));
    const html = await chrome.evaluate('String((document.getElementById("under-test") || {}).innerHTML || "")');
    ok(html.indexOf(identity.icon) !== -1 || /<svg|<img/.test(html), 'the list shows its icon', 'no icon in the list: ' + short(html));
    // ONLY ICON AND LABEL (Andy, box): what is left of the row once those two are taken out is nothing.
    const rowText = await chrome.evaluate('(function () { var want = ' + JSON.stringify(identity.label) + '; var all = document.getElementById("under-test").querySelectorAll("*"); var best = null; for (var i = 0; i < all.length; i++) { if (String(all[i].innerText || "").indexOf(want) !== -1 && all[i].children.length) best = all[i]; } return best ? best.innerText : ""; }())');
    const rest = String(rowText).split(identity.label).join('').split(identity.icon).join('').trim();
    ok(rowText !== '' && rest === '', 'the row shows icon and label and nothing else', 'the row also shows: ' + short(rest || rowText));

    // A PRESS PICKS, AND SHOWS ITS DETAIL.
    const pressed = await chrome.evaluate('(function () { var want = ' + JSON.stringify(identity.label) + '; var all = document.getElementById("under-test").querySelectorAll("*"); var hit = null; for (var i = 0; i < all.length; i++) { if (String(all[i].innerText || "").trim() && String(all[i].innerText).indexOf(want) !== -1 && !all[i].children.length) hit = all[i]; } if (!hit) return false; hit.click(); return true; }())');
    ok(pressed === true, 'its row can be pressed', 'no row to press');
    const picked = await until(function () { return chrome.evaluate('window.changes >= 1 && !!window.sel.row && window.sel.value !== ""'); }, 3000);
    ok(picked, 'a press sets value and row, and says change', 'a press gave ' + short(await chrome.evaluate('JSON.stringify({ changes: window.changes, value: window.sel.value, row: window.sel.row })')));
    const detail = await until(function () { return chrome.evaluate('!!(spirit.elements.appDetail) && document.body.innerText.split(' + JSON.stringify(identity.label) + ').length > 2'); }, 3000);
    ok(detail, 'a press shows that app\'s detail', 'a press showed no detail');

    // THE WORDS.
    await chrome.evaluate('(function () { var i = document.querySelector("#under-test input"); if (!i) return; i.value = "zzqqxxvvkk"; i.dispatchEvent(new Event("input", { bubbles: true })); }())');
    const ranked = await until(function () { return chrome.evaluate('(function () { var b = document.querySelector("#under-test .list-rank div div"); return !!b && b.style.width === "0%"; }())'); }, 4000);
    ok(ranked, 'typed words that fit nothing rank it at nothing: the shared list cuts no row', 'its rank bar for words that fit nothing: ' + short(await chrome.evaluate('String((document.querySelector("#under-test .list-rank") || {}).innerHTML || "")')));
    await chrome.evaluate('(function () { var i = document.querySelector("#under-test input"); if (!i) return; i.value = ""; i.dispatchEvent(new Event("input", { bubbles: true })); }())');
    await until(function () { return text().then(function (t) { return t.indexOf(identity.label) !== -1; }); }, 4000);

    // WHO PAINTS, LISTENS (Andy, G41.32): "every row's data ... must update instantly".
    const disk = path.join(node.root, 'spirit', 'run', 'spirit', 'app', 'server', 'server.json');
    const was = JSON.parse(fs.readFileSync(disk, 'utf8'));
    was.identity.label = 'Changed On Disk';
    fs.writeFileSync(disk, JSON.stringify(was));
    const follows = await until(function () { return text().then(function (t) { return t.indexOf('Changed On Disk') !== -1; }); }, 8000);
    ok(follows, 'a change on the disk paints on the page, no reload', 'the row kept its old label after the disk changed');
    // THE DETAIL OPEN IS PAINTED TOO (Andy, G41.32: "wherever it's visible"): it is the row element's own watch that does it, which no list redraw covers.
    const both = await until(function () { return text().then(function (t) { return t.split('Changed On Disk').length > 2; }); }, 8000);
    ok(both, 'the open detail paints the change as well', 'the open detail kept its old label: ' + short(await text()));

    const empty = await chrome.evaluate('(function () { window.sel.destroy(); return document.getElementById("under-test").children.length === 0; }())');
    ok(empty === true, 'destroy empties its container', 'destroy left its container with ' + short(await text()));
  } finally {
    try { if (chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
    try { if (chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
