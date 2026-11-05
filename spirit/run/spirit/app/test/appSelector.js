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
    const rowText = await chrome.evaluate('(function () { var want = ' + JSON.stringify(identity.label) + '; var all = document.getElementById("under-test").querySelectorAll("*"); var best = null; for (var i = 0; i < all.length; i++) { if (String(all[i].innerText || "").indexOf(want) !== -1 && all[i].children.length) best = all[i]; } if (!best) return ""; var c = best.cloneNode(true); [].forEach.call(c.querySelectorAll("button"), function (b) { b.remove(); }); return c.textContent; }())');
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

    // ── ONE appSelector, THREE FACES (goal/G43.9) ──
    {
    test.subHeading('the box: "spirit/app/appTiles.js will be removed." "spirit.app.appTiles() will be removed."');
    ok(!fs.existsSync(path.join(RUN, 'spirit', 'app', 'appTiles.js')), 'the file is gone', 'spirit/app/appTiles.js still stands');
    ok(await chrome.evaluate('!(window.spirit.app && window.spirit.app.appTiles)') === true, 'and so is spirit.app.appTiles', 'spirit.app.appTiles still stands');
    const monitorLabel = JSON.parse(fs.readFileSync(path.join(RUN, 'spirit', 'app', 'monitor', 'monitor.json'), 'utf8')).identity.label;
    const serverLabel = 'Changed On Disk';
    const mount = function (opts) { return chrome.evaluate('(function () { var old = document.getElementById("faces"); if (old) old.remove(); var c = document.createElement("div"); c.id = "faces"; c.style.cssText = "position:fixed;left:0;top:0;width:900px;height:600px;display:flex;flex-direction:column;background:#111"; document.body.appendChild(c); window.fs = spirit.elements.appSelector.create(c, ' + JSON.stringify(opts) + '); if (window.fs.parentNode !== c) c.appendChild(window.fs); return true; }())'); };
    const inFaces = function () { return chrome.evaluate('String((document.getElementById("faces") || {}).innerText || "")'); };
    const rowOf = function (label) { return '(function () { var all = document.querySelectorAll("#faces tr, #faces .list-row"); for (var i = 0; i < all.length; i++) if (String(all[i].textContent).indexOf(' + JSON.stringify(label) + ') !== -1) return all[i]; return null; }())'; };
    const tileOf = function (label) { return 'Array.prototype.filter.call(document.querySelectorAll("#faces .app-icon"), function (t) { return t.offsetParent !== null && String(t.textContent).indexOf(' + JSON.stringify(label) + ') !== -1; })[0]'; };
    const stateFile = function (k) { return path.join(node.root, 'spirit', 'run', 'spirit', 'state', k, 'node.json'); };

    test.subHeading('the box: "in :pane mode (list) i want to see a list of all rows, activated AND deactivated, with the (de)activate buttons at the end of each row."');
    await mount({ face: 'pane', toggle: true });
    const both = await until(function () { return inFaces().then(function (t) { return t.indexOf(monitorLabel) !== -1 && t.indexOf(serverLabel) !== -1; }); }, 8000);
    ok(both, 'the pane lists both, neither active', 'the pane shows: ' + short(await inFaces()));
    const buttonOf = function (label) { return 'var r = ' + rowOf(label) + '; if (!r) return "no row"; var bs = r.querySelectorAll("button"); if (bs.length !== 1) return "buttons: " + bs.length; var b = bs[0]; var all = r.querySelectorAll("*"); var last = null; for (var i = 0; i < all.length; i++) { if (all[i].getClientRects().length && !all[i].children.length) last = all[i]; } if (!(last === b || b.contains(last))) return "not last"; '; };
    const says = function (label) { return chrome.evaluate('(function () { ' + buttonOf(label) + 'return b.textContent.trim(); }())'); };
    const said = await until(function () { return says(monitorLabel).then(function (t) { return /^activate$/i.test(t); }); }, 8000);
    ok(said, 'each row ends in its one button, Activate', 'Monitor\'s row: ' + short(await says(monitorLabel)));
    test.subHeading('the box: "The node writes spirit/state/<key>/node.json and republishes its \'apps\' job, whose rows gain active. The list follows by itself."');
    await chrome.evaluate('(function () { var r = ' + rowOf(monitorLabel) + '; var b = r && r.querySelector("button"); if (b) b.click(); return !!b; }())');
    const written = await until(function () { return Promise.resolve((function () { try { return JSON.parse(fs.readFileSync(stateFile('monitor'), 'utf8')).active === true; } catch (e) { return false; } }())); }, 5000);
    ok(written, 'a press writes active true to spirit/state/monitor/node.json', 'after a press the file is not active');
    const rowActive = await until(function () { return chrome.evaluate('(function () { var r = spirit.data.app.data.rows().monitor; return !!r && r.active === true; }())'); }, 5000);
    ok(rowActive, 'the stream brings active to the row, no search asked', 'the row: ' + short(await chrome.evaluate('JSON.stringify(spirit.data.app.data.rows().monitor)')));
    const flipped = await until(function () { return says(monitorLabel).then(function (t) { return /^deactivate$/i.test(t); }); }, 5000);
    ok(flipped, 'the button follows: Deactivate', 'the button says: ' + short(await says(monitorLabel)));
    await chrome.evaluate('spirit.app.searchApp({ q: "" }).then(function (got) { spirit.data.seatRows(spirit.data.app.data.branch, got.items); return true; })');
    ok(await chrome.evaluate('(function () { var r = spirit.data.app.data.rows().monitor; return !!r && r.active === true; }())') === true, 'a search seated over it does not lose active', 'after a search the row: ' + short(await chrome.evaluate('JSON.stringify(spirit.data.app.data.rows().monitor)')));

    test.subHeading('the box: "pane shows the detail": a pick in the pane launches nothing');
    await chrome.evaluate('(function () { var r = ' + rowOf(monitorLabel) + '; if (r) r.click(); return true; }())');
    await chrome.evaluate('new Promise(function (r) { setTimeout(function () { r(true); }, 500); })');
    ok(await chrome.evaluate('!document.querySelector("#faces .app-container")') === true, 'no app opens', 'a pick in the pane opened the app');

    test.subHeading('the box: "in :tiles mode, only activated apps will appear."');
    await chrome.evaluate('(function () { var t = document.querySelector("#faces .list-toggle"); if (t) t.click(); return !!t; }())');
    const onlyActive = await until(function () { return chrome.evaluate('!!' + tileOf(monitorLabel) + ' && !' + tileOf(serverLabel)); }, 5000);
    ok(onlyActive, 'the toggle shows tiles: Monitor, active, and not server', 'the tiles: ' + short(await inFaces()));
    await mount({ face: 'tiles' });
    const direct = await until(function () { return chrome.evaluate('!!' + tileOf(monitorLabel) + ' && !' + tileOf(serverLabel)); }, 5000);
    ok(direct, 'face tiles from the start: the same', 'the tiles: ' + short(await inFaces()));
    await chrome.evaluate('spirit.app.activeApp({ key: "server", active: true })');
    const arrives = await until(function () { return chrome.evaluate('!!' + tileOf(serverLabel)); }, 5000);
    ok(arrives, 'an app made active appears, no search asked', 'the tiles after server turned on: ' + short(await inFaces()));
    await chrome.evaluate('spirit.app.activeApp({ key: "server", active: false })');
    const leaves = await until(function () { return chrome.evaluate('!' + tileOf(serverLabel)); }, 5000);
    ok(leaves, 'an app made inactive leaves', 'the tiles after server turned off: ' + short(await inFaces()));

    test.subHeading('the box: "in :tiles mode, appSelector icons will \'launch\'", "its open and close move into appSelector"');
    await chrome.evaluate('(function () { var t = ' + tileOf(monitorLabel) + '; if (t) t.click(); return !!t; }())');
    const opened = await until(function () { return chrome.evaluate('(function () { var p = document.querySelector("#faces .app-container-pane"); return !!p && /Uptime|waiting/i.test(String(p.innerText)); }())'); }, 10000);
    ok(opened, 'a tile opens its app inside, through spirit.app.monitor.createApp', 'a tile opened: ' + short(await inFaces()));
    await chrome.evaluate('(function () { var c = document.querySelector("#faces .app-container-close"); if (c) c.click(); return !!c; }())');
    const closed = await until(function () { return chrome.evaluate('!document.querySelector("#faces .app-container") && !!' + tileOf(monitorLabel)); }, 5000);
    ok(closed, 'its close icon brings the tiles back', 'after close: ' + short(await inFaces()));
    await chrome.evaluate('(function () { var c = document.getElementById("faces"); if (window.fs.destroy) window.fs.destroy(); if (c) c.remove(); return true; }())');
    }
  } finally {
    try { if (chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
    try { if (chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
