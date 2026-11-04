'use strict';

// spirit/run/spirit/app/test/tiles.js
// The tests of spirit/app/tiles.js, and of no other module (spec: ./tiles.md; goal/G43.2, goal/G43.6). Andy, box: "the word ui
// goes", "spirit/app/tiles.js: an element, a probabilitySearch variant, that displays its list as tiles". A real Chrome on a
// scratch node's face page, the element mounted by itself; neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const FILE = path.join(RUN, 'spirit', 'app', 'tiles.js');

test.startTest('tiles.js: the tiles and what they open (goal/G43.2, goal/G43.6)');

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('spirit/app/tiles.js is not there'); return; }
  // goal/G43.6; Andy, box: "spirit/ui.js, spirit/test/ui.js and spirit/test/ui.md are deleted, and spirit.elements.ui with them."
  ['spirit/ui.js', 'spirit/test/ui.js', 'spirit/test/ui.md'].forEach(function (f) { ok(!fs.existsSync(path.join(RUN, f)), f + ' is gone', f + ' still stands'); });
  // The name built, so this test does not name the throw-away host: its delete breaks nothing here.
  const HOST = ['app', 'Migration'].join('');
  ok(fs.readFileSync(FILE, 'utf8').indexOf(HOST) === -1, 'it does not name its throw-away host', 'it names its throw-away host');
  const identity = JSON.parse(fs.readFileSync(path.join(RUN, 'spirit', 'app', 'server', 'server.json'), 'utf8')).identity;
  const node = await scratchNode();
  const chrome = await chromePage(findChrome());
  try {
    if (!node.up || chrome.error) { test.fail('no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '')); return; }
    // A SECOND APP, ON THE SCRATCH NODE ONLY (spirit/app/app, the second one, was killed; Andy: "it was just a test object to
    // prove a point"): server's own files under another name, so a tile can be told from the other.
    const appsDir = path.join(node.root, 'spirit', 'run', 'spirit', 'app');
    const other = path.join(appsDir, 'zzother');
    fs.mkdirSync(other, { recursive: true });
    const named = function (s) { return String(s).replace(/\bserver\b/g, 'zzother'); };
    const otherJson = JSON.parse(named(fs.readFileSync(path.join(appsDir, 'server', 'server.json'), 'utf8')));
    otherJson.identity = { icon: '🎈', label: 'zzother' };
    fs.writeFileSync(path.join(other, 'zzother.json'), JSON.stringify(otherJson));
    fs.writeFileSync(path.join(other, 'zzother.js'), named(fs.readFileSync(path.join(appsDir, 'server', 'server.js'), 'utf8')));
    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    const made = await chrome.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/app/tiles.js"); }).then(function () { var c = document.createElement("div"); c.id = "under-test"; c.style.cssText = "position:fixed;left:0;top:0;width:900px;height:600px;z-index:9999;background:#000;display:flex;flex-direction:column"; document.body.appendChild(c); window.made = spirit.app.tiles.create(c); return "made"; }, function (e) { return String(e && e.message || e); })');
    ok(made === 'made', 'it loads through spirit.require and mounts by itself', 'it did not mount: ' + short(made));
    const INSIDE = '#under-test ';
    const tileOf = function (label) { return 'Array.prototype.filter.call(document.querySelectorAll(' + JSON.stringify(INSIDE + '.app-icon') + '), function (t) { return t.offsetParent !== null && String(t.innerText || "").indexOf(' + JSON.stringify(label) + ') !== -1; })[0]'; };
    const visible = function (sel) { return 'Array.prototype.filter.call(document.querySelectorAll(' + JSON.stringify(INSIDE + sel) + '), function (t) { return t.offsetParent !== null; })[0]'; };
    const appIdentity = otherJson.identity;
    const shown = await until(function () { return chrome.evaluate('!!' + tileOf(identity.label)); }, 10000);
    ok(shown, 'it shows a tile for server, labelled ' + identity.label, 'it shows ' + short(await chrome.evaluate('document.getElementById("under-test").innerText')));
    ok(await until(function () { return chrome.evaluate('!!' + tileOf(appIdentity.label)); }, 5000), 'and a tile for the other app, labelled ' + appIdentity.label, 'no tile for the other app');
    const html = String(await chrome.evaluate('(function () { var t = ' + tileOf(identity.label) + '; return t ? t.innerHTML : ""; }())'));
    ok(html.indexOf(identity.icon) !== -1 || /<svg|<img/.test(html), 'the tile shows server\'s icon', 'the tile has no icon: ' + short(html));
    // goal/G43.6; Andy, box: "The tiles get a search field."
    const inputs = await chrome.evaluate('Array.prototype.filter.call(document.querySelectorAll("#under-test input"), function (t) { return t.offsetParent !== null; }).length');
    ok(inputs === 1, 'the tiles have one search field', inputs + ' input(s) on show');
    const homes = JSON.parse(await chrome.evaluate('JSON.stringify({ tiles: typeof ((window.spirit.app || {}).tiles || {}).create, ui: typeof (window.spirit.elements || {}).ui, search: typeof (window.spirit.app || {}).search })'));
    ok(homes.tiles === 'function' && homes.ui === 'undefined' && homes.search === 'function', 'spirit.app.tiles.create, beside spirit.app.search, and no spirit.elements.ui', 'homes: ' + short(homes));
    const code = fs.readFileSync(FILE, 'utf8').replace(/\/\/[^\n]*/g, '');
    ok(/face\s*:\s*['"]tiles['"]/.test(code) && /probabilitySearch/.test(code), 'it is a probabilitySearch, in its face tiles', 'tiles.js does not make a probabilitySearch with face tiles');

    // A PRESSED TILE OPENS IT (Andy, box: "when the tile is clicked, \"open\" those elements on top of itself", in "an
    // \"internal\" (for now) element \"appCountainer\", that shows a titlebar, and a pane below").
    await chrome.evaluate('(function () { var t = ' + tileOf(identity.label) + '; if (t) t.click(); }())');
    const open = await until(function () { return chrome.evaluate('!!' + visible('.app-container')); }, 8000);
    ok(open, 'a pressed tile opens appContainer', 'a press opened nothing: ' + short(await chrome.evaluate('document.getElementById("under-test").innerText')));
    const geo = await chrome.evaluate('(function () { var r = function (s) { var e = Array.prototype.filter.call(document.querySelectorAll(' + JSON.stringify(INSIDE) + ' + s), function (t) { return t.offsetParent !== null; })[0]; if (!e) return null; var b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, text: String(e.innerText || ""), html: e.innerHTML }; };' +
      ' return JSON.stringify({ bar: r(".app-container-bar"), pane: r(".app-container-pane"), close: r(".app-container-close"), head: r(".app-container-head") }); }())');
    const g = JSON.parse(geo);
    ok(!!g.bar && !!g.pane && g.pane.t >= g.bar.b - 1, 'a titlebar, and a pane below it', 'its parts: ' + short(geo));
    ok(!!g.head && g.head.text.indexOf(identity.label) !== -1 && (g.head.html.indexOf(identity.icon) !== -1 || /<svg|<img/.test(g.head.html)), 'the titlebar shows the tile\'s icon and label', 'the titlebar\'s head: ' + short(g.head));
    ok(!!g.head && !!g.bar && g.head.l - g.bar.l < 40, 'they sit on its left edge', 'they sit at ' + short(g.head));
    ok(!!g.close && !!g.bar && g.bar.r - g.close.r < 40 && g.close.l > (g.bar.l + g.bar.r) / 2, 'the close icon sits on its right edge', 'the close icon: ' + short(g.close));
    ok(!!g.pane && g.pane.text.indexOf(identity.label) !== -1, 'the element is mounted in the pane, painting its name', 'the pane shows ' + short(g.pane));
    // goal/G43.6; Andy, box: "The app tiles open it from spirit.app." server stays where it is.
    await chrome.evaluate('(function () { var c = ' + visible('.app-container-close') + '; if (c) c.click(); }())');
    await until(function () { return chrome.evaluate('!' + visible('.app-container') + ' && !!' + tileOf('Monitor')); }, 5000);
    await chrome.evaluate('(function () { var t = ' + tileOf('Monitor') + '; if (t) t.click(); }())');
    const monitor = await until(function () { return chrome.evaluate('(function () { var p = ' + visible('.app-container-pane') + '; return !!p && /Uptime|waiting/i.test(String(p.innerText)); }())'); }, 10000);
    ok(monitor, 'the Monitor tile opens the app from spirit.app', 'its pane: ' + short(await chrome.evaluate('document.getElementById("under-test").innerText')));
    await chrome.evaluate('(function () { var c = ' + visible('.app-container-close') + '; if (c) c.click(); }())');
    await until(function () { return chrome.evaluate('!' + visible('.app-container') + ' && !!' + tileOf(identity.label)); }, 5000);
    await chrome.evaluate('(function () { var t = ' + tileOf(identity.label) + '; if (t) t.click(); }())');
    await until(function () { return chrome.evaluate('!!' + visible('.app-container')); }, 5000);
    // CLOSE (Andy, box: "when the close button on the titlebar is pressed, the \"app\" closes again").
    await chrome.evaluate('(function () { var c = ' + visible('.app-container-close') + '; if (c) c.click(); }())');
    const closed = await until(function () { return chrome.evaluate('!' + visible('.app-container') + ' && !!' + tileOf(identity.label)); }, 5000);
    ok(closed, 'close closes it, and the tiles are back', 'after close it shows ' + short(await chrome.evaluate('document.getElementById("under-test").innerText')));
    await chrome.evaluate('(function () { var t = ' + tileOf(appIdentity.label) + '; if (t) t.click(); }())');
    const second = await until(function () { return chrome.evaluate('(function () { var p = ' + visible('.app-container-pane') + '; return !!p && String(p.innerText).indexOf(' + JSON.stringify(appIdentity.label) + ') !== -1 && String(p.innerText).indexOf(' + JSON.stringify(identity.label) + ') === -1; }())'); }, 5000);
    ok(second, 'the other tile opens the other element, and only that', 'the app tile\'s pane: ' + short(await chrome.evaluate('document.getElementById("under-test").innerText')));
    await chrome.evaluate('(function () { var c = ' + visible('.app-container-close') + '; if (c) c.click(); }())');
    await until(function () { return chrome.evaluate('!' + visible('.app-container')); }, 5000);

    // WHO PAINTS, LISTENS (Andy, G41.32): "every row's data ... must update instantly".
    const disk = path.join(node.root, 'spirit', 'run', 'spirit', 'app', 'server', 'server.json');
    const was = JSON.parse(fs.readFileSync(disk, 'utf8'));
    was.identity.label = 'Changed On Disk';
    fs.writeFileSync(disk, JSON.stringify(was));
    const follows = await until(function () { return chrome.evaluate('!!' + tileOf('Changed On Disk')); }, 8000);
    ok(follows, 'a change on the disk paints the tile, no reload', 'the tile kept its old label after the disk changed');
    const empty = await chrome.evaluate('(function () { window.made.destroy(); return document.getElementById("under-test").children.length === 0; }())');
    ok(empty === true, 'destroy empties its container', 'destroy left: ' + short(await chrome.evaluate('document.getElementById("under-test").innerHTML')));
  } finally {
    try { if (chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
    try { if (chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
