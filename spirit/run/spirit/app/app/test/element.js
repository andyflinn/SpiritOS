'use strict';

// spirit/run/spirit/app/app/test/element.js
// One file for every test of its script (Andy: "there is ONE FUCKING test file in the test folder per script file, and every fucking
// test that applies to that file must be inserted in the that one file"; spirit/test/TEST_SYSTEM.md): each part below is its own
// section at the end: nodeRun, shell.
// The tests of spirit/app/app/element.js, the app selector, and of no other module (spec: ./element.md; goal/G43.2).
// Since goal/G43.32 the app app's main element (it was spirit/app/appSelector.js). A real Chrome on a
// scratch node's face page; neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
// Every node this test uses is one of lab's (goal/G47.3): its tree by scratchTree, its node by startNodeOn.
const LABH = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

// One test.run per test (goal/G47.2): the three parts below run one after the other, each its own scratch node and Chrome,
// each stopped when the next part's world starts, and all of them again at the end (test.after).
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const FILE = path.join(RUN, 'spirit', 'app', 'app', 'element.js');
// The planted apps: one that mounts, the one tile there must be, and every way of not saying shell.mount true.
const PLANT = {
  zzmounted: { label: 'Zz Mounted', shell: { true: false, mount: true, tile: true }, tile: true },
  zzmountfalse: { label: 'Zz Mount False', shell: { true: false, mount: false, tile: true } },
  zznoshell: { label: 'Zz No Shell' },
  zznomount: { label: 'Zz No Mount', shell: { true: false, tile: true } },
  zzstringmount: { label: 'Zz String Mount', shell: { true: false, mount: 'true', tile: true } },
  zzonemount: { label: 'Zz One Mount', shell: { true: false, mount: 1, tile: true } },
  zzshellnull: { label: 'Zz Shell Null', shell: null },
  zzrunonly: { label: 'Zz Run Only', shell: { true: false, mount: false, tile: true }, run: true }
};

// Every scratch node and Chrome a part started, stopped whatever happened.
const LIVE = [];
function stopAll() {
  while (LIVE.length) {
    const w = LIVE.pop();
    try { if (w.chrome && w.chrome.sock) w.chrome.sock.close(); } catch (e) { /* gone */ }
    try { if (w.chrome && w.chrome.kid) w.chrome.kid.kill(); } catch (e) { /* gone */ }
    try { if (w.c && w.c.kid) w.c.kid.kill(); } catch (e) { /* gone */ }
    try { if (w.node && w.node.child) w.node.child.kill(); } catch (e) { /* gone */ }
    try { if (w.node && w.node.root) LABH.freeTree(w.node); } catch (e) { /* scratch */ }
    try { if (w.N && w.N.child) w.N.child.kill(); } catch (e) { /* gone */ }
    try { if (w.s && w.s.root) LABH.freeTree(w.s); } catch (e) { /* scratch */ }
  }
}
test.after(stopAll);

// ── element.js: the app app's main element, the app selector (goal/G43.2) ──
{
  const W1 = {};
  const NO_PAGE = 'no scratch node or no Chrome: the world failed';
  let identity, node, chrome;
  test.run('the world: a scratch node with an app of the test\'s own, and the selector on its face page', 0.2, async function () {
    if (!fs.existsSync(FILE)) return 'spirit/app/app/element.js is not there';
    identity = JSON.parse(fs.readFileSync(path.join(RUN, 'spirit', 'app', 'starter', 'starter.json'), 'utf8')).identity;
    // An app the user switches, not intrinsic, a face and no server: Starter, since Andy deleted the server app (25a95142, "delete dummy app").
    node = await scratchNode();
    chrome = await chromePage(findChrome());
    LIVE.push({ node: node, chrome: chrome });
    if (!node.up || chrome.error) return 'no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '');
    // AN APP THE USER SWITCHES, OF THIS TEST'S OWN (goal/G43.15): Monitor was it until Andy's 7f6ebbbe made it intrinsic, so always on. A copy
    // of its json as it was then, and its script, planted on the scratch node's disc; the app family reads the disc.
    if (!node.root) return 'the scratch node is shared, so no app of the test\'s own can be planted: nothing judged';
    const zz = path.join(node.root, 'spirit', 'run', 'spirit', 'app', 'hearing');
    fs.mkdirSync(zz, { recursive: true });
    fs.writeFileSync(path.join(zz, 'hearing.json'), JSON.stringify({ identity: { icon: '🦻', label: 'Hearing', intrinsic: false }, mount: { 'element.js': true }, shell: { true: false, mount: true, tile: true }, node: { mount: false } }, null, 2));
    // Monitor's main element, placed at the planted app's own path, as a tile asks for it (goal/G43.32, rule 4).
    fs.writeFileSync(path.join(zz, 'element.js'), fs.readFileSync(path.join(RUN, 'spirit', 'app', 'monitor', 'element.js'), 'utf8').split('spirit/app/monitor/element.js').join('spirit/app/hearing/element.js'));
    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    W1.up = true;
    return true;
  }, test.limit.long);
  let made, text;
  test.run('it loads through spirit.require and mounts as a pane', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    made = await chrome.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/app/app/element.js"); }).then(function () {' +
      ' var c = document.createElement("div"); c.id = "under-test"; document.body.appendChild(c); window.changes = 0;' +
      ' window.sel = spirit.element.spirit.app.app.element.create(c, { face: "pane" }); if (window.sel.parentNode !== c) c.appendChild(window.sel); window.sel.addEventListener("change", function () { window.changes += 1; }); return "made"; }, function (e) { return String(e && e.message || e); })');
    return (made === 'made') ? true : ('it did not mount: ' + short(made));
  }, test.limit.quick);
  text = function () { return chrome.evaluate('String((document.getElementById("under-test") || {}).innerText || "")'); };
  test.run('the list shows starter\'s label', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    const found = await until(function () { return text().then(function (t) { return t.indexOf(identity.label) !== -1; }); }, 8000);
    return (found) ? true : ('the list never showed "' + identity.label + '": ' + short(await text()));
  }, test.limit.slow);
  test.run('the list shows its icon', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    const html = await chrome.evaluate('String((document.getElementById("under-test") || {}).innerHTML || "")');
    return (html.indexOf(identity.icon) !== -1 || /<svg|<img/.test(html)) ? true : ('no icon in the list: ' + short(html));
  }, test.limit.quick);
  test.run('the row shows icon and label and nothing else', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    // ONLY ICON AND LABEL (Andy, box): what is left of the row once those two are taken out is nothing.
    const rowText = await chrome.evaluate('(function () { var want = ' + JSON.stringify(identity.label) + '; var all = document.getElementById("under-test").querySelectorAll("*"); var outside = function (e) { var c = e.cloneNode(true); [].forEach.call(c.querySelectorAll(".shell-row-form, button"), function (b) { b.remove(); }); return c.textContent; }; var best = null; for (var i = 0; i < all.length; i++) { if (all[i].children.length && !all[i].closest(".shell-row-form") && outside(all[i]).indexOf(want) !== -1) best = all[i]; } if (!best) return ""; return outside(best); }())');
    const rest = String(rowText).split(identity.label).join('').split(identity.icon).join('').trim();
    return (rowText !== '' && rest === '') ? true : ('the row also shows: ' + short({ rest: rest, rowText: rowText }));
  }, test.limit.quick);

  // A PRESS PICKS, AND SHOWS ITS DETAIL.
  test.run('its row can be pressed', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    const pressed = await chrome.evaluate('(function () { var want = ' + JSON.stringify(identity.label) + '; var all = document.getElementById("under-test").querySelectorAll("*"); var hit = null; for (var i = 0; i < all.length; i++) { if (String(all[i].innerText || "").trim() && String(all[i].innerText).indexOf(want) !== -1 && !all[i].children.length) hit = all[i]; } if (!hit) return false; hit.click(); return true; }())');
    return (pressed === true) ? true : ('no row to press');
  }, test.limit.quick);
  test.run('a press sets value and row, and says change', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    const picked = await until(function () { return chrome.evaluate('window.changes >= 1 && !!window.sel.row && window.sel.value !== ""'); }, 3000);
    return (picked) ? true : ('a press gave ' + short(await chrome.evaluate('JSON.stringify({ changes: window.changes, value: window.sel.value, row: window.sel.row })')));
  }, test.limit.slow);
  test.run('a press shows that app\'s detail', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    const detail = await until(function () { return chrome.evaluate('(function () { var h = document.querySelector("#under-test .app-container .shell-row-form"); return !!(spirit.element.spirit.element.search.app.detailElement) && !!h && String(h.textContent).indexOf(' + JSON.stringify(identity.label) + ') !== -1; }())'); }, 3000);
    return (detail) ? true : ('a press showed no detail');
  }, test.limit.slow);

  test.run('typed words that fit nothing rank it at nothing: the shared list cuts no row', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    await chrome.evaluate('(function () { var c = document.querySelector("#under-test .app-container-close"); if (c) c.click(); return !!c; }())');
    // THE WORDS.
    await chrome.evaluate('(function () { var i = document.querySelector("#under-test input"); if (!i) return; i.value = "zzqqxxvvkk"; i.dispatchEvent(new Event("input", { bubbles: true })); }())');
    const ranked = await until(function () { return chrome.evaluate('(function () { var b = document.querySelector("#under-test .list-rank div div"); return !!b && b.style.width === "0%"; }())'); }, 4000);
    return (ranked) ? true : ('its rank bar for words that fit nothing: ' + short(await chrome.evaluate('String((document.querySelector("#under-test .list-rank") || {}).innerHTML || "")')));
  }, test.limit.slow);

  // WHO PAINTS, LISTENS (Andy, G41.32): "every row's data ... must update instantly".
  test.run('a change on the disk paints on the page, no reload', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    await chrome.evaluate('(function () { var i = document.querySelector("#under-test input"); if (!i) return; i.value = ""; i.dispatchEvent(new Event("input", { bubbles: true })); }())');
    await until(function () { return text().then(function (t) { return t.indexOf(identity.label) !== -1; }); }, 4000);
    const disk = path.join(node.root, 'spirit', 'run', 'spirit', 'app', 'starter', 'starter.json');
    const was = JSON.parse(fs.readFileSync(disk, 'utf8'));
    was.identity.label = 'Changed On Disk';
    fs.writeFileSync(disk, JSON.stringify(was));
    const follows = await until(function () { return text().then(function (t) { return t.indexOf('Changed On Disk') !== -1; }); }, 8000);
    return (follows) ? true : ('the row kept its old label after the disk changed: ' + short(await text()));
  }, test.limit.slow);
  test.run('the open detail paints the change as well', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    // THE DETAIL OPEN IS PAINTED TOO (Andy, G41.32: "wherever it's visible"): it is the row element's own watch that does it, which no list redraw covers.
    await chrome.evaluate('(function () { var all = document.querySelectorAll("#under-test tr, #under-test .list-row"); for (var i = 0; i < all.length; i++) if (String(all[i].textContent).indexOf("Changed On Disk") !== -1) { all[i].click(); return true; } return false; }())');
    const both = await until(function () { return chrome.evaluate('(function () { var h = document.querySelector("#under-test .app-container .shell-row-form"); return !!h && String(h.textContent).indexOf("Changed On Disk") !== -1; }())'); }, 8000);
    return (both) ? true : ('the open detail kept its old label: ' + short(await text()));
  }, test.limit.slow);
  test.run('destroy empties its container', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    await chrome.evaluate('(function () { var c = document.querySelector("#under-test .app-container-close"); if (c) c.click(); return !!c; }())');
    const empty = await chrome.evaluate('(function () { window.sel.destroy(); return document.getElementById("under-test").children.length === 0; }())');
    return (empty === true) ? true : ('destroy left its container with ' + short(await text()));
  }, test.limit.quick);

  // ── ONE appSelector, THREE FACES (goal/G43.9) ──
  {
  // the box: "spirit/app/appTiles.js will be removed." "spirit.app.appTiles() will be removed."
  test.run('the file is gone', 0.2, async function () {
    return (!fs.existsSync(path.join(RUN, 'spirit', 'app', 'appTiles.js'))) ? true : ('spirit/app/appTiles.js still stands');
  }, test.limit.quick);
  test.run('and so is spirit.app.appTiles', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    return (await chrome.evaluate('!(window.spirit.app && window.spirit.app.appTiles)') === true) ? true : ('spirit.app.appTiles still stands');
  }, test.limit.quick);
  const monitorLabel = 'Hearing';
  const serverLabel = 'Changed On Disk';
  const mount = function (opts) { return chrome.evaluate('(function () { var old = document.getElementById("faces"); if (old) old.remove(); var c = document.createElement("div"); c.id = "faces"; c.style.cssText = "position:fixed;left:0;top:0;width:900px;height:600px;display:flex;flex-direction:column;background:#111"; document.body.appendChild(c); window.fs = spirit.element.spirit.app.app.element.create(c, ' + JSON.stringify(opts) + '); if (window.fs.parentNode !== c) c.appendChild(window.fs); return true; }())'); };
  const inFaces = function () { return chrome.evaluate('String((document.getElementById("faces") || {}).innerText || "")'); };
  const rowOf = function (label) { return '(function () { var all = document.querySelectorAll("#faces tr, #faces .list-row"); for (var i = 0; i < all.length; i++) if (String(all[i].textContent).indexOf(' + JSON.stringify(label) + ') !== -1) return all[i]; return null; }())'; };
  const tileOf = function (label) { return 'Array.prototype.filter.call(document.querySelectorAll("#faces .app-icon"), function (t) { return t.offsetParent !== null && String(t.textContent).indexOf(' + JSON.stringify(label) + ') !== -1; })[0]'; };
  const stateFile = function (k) { return path.join(node.root, 'spirit', 'run', 'spirit', 'state', k, 'node.json'); };
  let both, said, written, rowActive, flipped;

  // the box: "in :pane mode (list) i want to see a list of all rows, activated AND deactivated, with the (de)activate buttons at the end of each row."
  test.run('the pane lists both, neither active', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    await mount({ face: 'pane', toggle: true });
    both = await until(function () { return inFaces().then(function (t) { return t.indexOf(monitorLabel) !== -1 && t.indexOf(serverLabel) !== -1; }); }, 8000);
    return (both) ? true : ('the pane shows: ' + short(await inFaces()));
  }, test.limit.slow);
  const buttonOf = function (label) { return 'var r = ' + rowOf(label) + '; if (!r) return "no row"; var bs = r.querySelectorAll("button"); if (bs.length !== 1) return "buttons: " + bs.length; var b = bs[0]; var all = r.querySelectorAll("*"); var last = null; for (var i = 0; i < all.length; i++) { if (all[i].getClientRects().length && !all[i].children.length) last = all[i]; } if (!(last === b || b.contains(last))) return "not last"; '; };
  // The switch's words, which stand beside its 🟢/🔴 button (rowFormAppActive, goal/G43.15).
  const says = function (label) { return chrome.evaluate('(function () { ' + buttonOf(label) + 'var w = r.querySelector(".shell-row-form-span"); return (w || b).textContent.trim(); }())'); };
  test.run('each row ends in its one button, Activate', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    said = await until(function () { return says(monitorLabel).then(function (t) { return /^activate\b/i.test(t); }); }, 8000);
    return (said) ? true : ('Hearing\'s row: ' + short(await says(monitorLabel)));
  }, test.limit.slow);
  // the box: "The node writes spirit/state/<key>/node.json and republishes its 'apps' job, whose rows gain active. The list follows by itself."
  test.run('a press writes active true to spirit/state/hearing/node.json', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    await chrome.evaluate('(function () { var r = ' + rowOf(monitorLabel) + '; var b = r && r.querySelector("button"); if (b) b.click(); return !!b; }())');
    written = await until(function () { return Promise.resolve((function () { try { return JSON.parse(fs.readFileSync(stateFile('hearing'), 'utf8')).active === true; } catch (e) { return false; } }())); }, 5000);
    return (written) ? true : ('after a press the file is not active');
  }, test.limit.slow);
  test.run('the stream brings active to the row, no search asked', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    rowActive = await until(function () { return chrome.evaluate('(function () { var r = spirit.data.app.data.rows().hearing; return !!r && r.active === true; }())'); }, 5000);
    return (rowActive) ? true : ('the row: ' + short(await chrome.evaluate('JSON.stringify(spirit.data.app.data.rows().hearing)')));
  }, test.limit.slow);
  test.run('the button follows: Deactivate', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    flipped = await until(function () { return says(monitorLabel).then(function (t) { return /^deactivate\b/i.test(t); }); }, 5000);
    return (flipped) ? true : ('the button says: ' + short(await says(monitorLabel)));
  }, test.limit.slow);
  test.run('a search seated over it does not lose active', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    await chrome.evaluate('spirit.app.searchApp({ q: "" }).then(function (got) { spirit.data.seatRows(spirit.data.app.data.branch, got.items); return true; })');
    return (await chrome.evaluate('(function () { var r = spirit.data.app.data.rows().hearing; return !!r && r.active === true; }())') === true) ? true : ('after a search the row: ' + short(await chrome.evaluate('JSON.stringify(spirit.data.app.data.rows().hearing)')));
  }, test.limit.quick);

  // Andy: "the detail panel needs to open on top of the whole container", and the form he drew for it.
  // the panel: over the whole container
  const openPanel = function () { return chrome.evaluate('(function () { var r = ' + rowOf(monitorLabel) + '; if (r) r.click(); return !!r; }())'); };
  // THE PANEL IN VIEW. A closed layer is hidden, not destroyed (the box: "A closed layer is hidden, not destroyed ... The
  // appSelector's ✕ hides too", Q3), so the one that counts is the one shown.
  const panel = '[].filter.call(document.querySelectorAll("#faces .app-container"), function (p) { return p.style.display !== "none"; })[0]';
  const inPanel = function (sel) { return '((' + panel + ') || document.createElement("div")).querySelector(' + JSON.stringify(sel) + ')'; };
  const closePanel = async function () { await chrome.evaluate('(function () { var c = ' + inPanel('.app-container-close') + '; if (c) c.click(); return !!c; }())'); return until(function () { return chrome.evaluate('!' + panel); }, 4000); };
  let up, covers, l, bar, r0, newIcon, r1, r2seen, r2, wentOff, wentOn, renamed, inRow, follows, backAgain;
  test.run('a pick in the pane opens it', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    await openPanel();
    up = await until(function () { return chrome.evaluate('!!' + panel); }, 5000);
    return (up) ? true : ('a pick in the pane opened no panel: ' + short(await inFaces()));
  }, test.limit.slow);
  test.run('it covers the whole container, and the list is out of sight', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    covers = await chrome.evaluate('(function () { var p = ' + panel + '; if (!p) return "no panel"; var a = p.getBoundingClientRect(), b = document.getElementById("faces").getBoundingClientRect(); if (Math.abs(a.width - b.width) > 2 || Math.abs(a.height - b.height) > 2) return JSON.stringify([a.width, a.height, b.width, b.height]); var r = ' + rowOf(monitorLabel) + '; return r && r.offsetParent !== null ? "the list still shows" : "covers"; }())');
    return (covers === 'covers') ? true : ('the panel: ' + short(covers));
  }, test.limit.quick);
  // Each form of the panel, in order: its icon, its words, its input's value, its button.
  const clean = function (t) { return String(t).replace(/\s+/g, ' ').trim(); };
  const forms = async function () { const j = await chrome.evaluate('JSON.stringify([].map.call([].filter.call(((' + panel + ') || document.createElement("div")).querySelectorAll(".shell-row-form"), function (f) { return f.getBoundingClientRect().height > 0; }), function (f) { var sp = f.querySelector(".shell-row-form-span"); var bs = f.querySelectorAll("button"); var last = bs[bs.length - 1]; var inp = f.querySelector("input"); var ic = f.firstElementChild; return { icon: ic ? ic.textContent : "", words: sp ? sp.textContent : "", input: inp ? inp.value : null, button: last ? last.textContent : "", lastIsButton: !!last && f.lastElementChild === last }; }))'); return (JSON.parse(j) || []).map(function (x) { x.icon = clean(x.icon); x.words = clean(x.words); x.button = clean(x.button); return x; }); };
  const press = function (n) { return chrome.evaluate('(function () { var f = [].filter.call(((' + panel + ') || document.createElement("div")).querySelectorAll(".shell-row-form"), function (f) { return f.getBoundingClientRect().height > 0; })[' + n + ']; var b = f && f.querySelectorAll("button"); var last = b && b[b.length - 1]; if (last) last.click(); return !!last; }())'); };
  const stateOf = function () { try { return JSON.parse(fs.readFileSync(stateFile('hearing'), 'utf8')); } catch (e) { return {}; } };
  let disk, fileBefore;
  const waitForm = function (n, test2) { return until(function () { return forms().then(function (l) { return !!l[n] && test2(l[n]); }); }, 5000); };

  // "titlebar rowForm: [app-icon] "<app-label> [x]"
  test.run('the bar and three forms', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    disk = path.join(node.root, 'spirit', 'run', 'spirit', 'app', 'hearing', 'hearing.json');
    fileBefore = fs.readFileSync(disk, 'utf8');
    l = await forms();
    // Four: the Allow row went (goal/G43.18, box v29).
    return (l.length === 4) ? true : ('forms in the panel: ' + short(l));
  }, test.limit.quick);
  const none = { icon: '', words: '', button: '', input: null, lastIsButton: false };
  test.run('the bar: the app\'s icon and label', 0.2, async function () {
    if (!l) return NO_PAGE;
    bar = l[0] || none;
    return (bar.icon.indexOf('🦻') !== -1 && bar.words === monitorLabel) ? true : ('the bar: ' + short(bar));
  }, test.limit.quick);
  test.run('its last element is the x', 0.2, async function () {
    if (!bar) return NO_PAGE;
    return (bar.lastIsButton && /^[x✕×]$/i.test(bar.button)) ? true : ('the bar\'s button: ' + short(bar));
  }, test.limit.quick);

  // "row 0: rowForm: [✏️] "Icon" [iconSelector:dropdown] [Change]"
  test.run('the pencil, Icon, Change', 0.2, async function () {
    if (!l) return NO_PAGE;
    r0 = l[1] || none;
    return (r0.icon.indexOf('✏') !== -1 && r0.words.indexOf('Icon') !== -1 && r0.button === 'Change') ? true : ('row 0: ' + short(r0));
  }, test.limit.quick);
  test.run('the selector shows the app\'s icon', 0.2, async function () {
    if (!r0) return NO_PAGE;
    return (r0.words.indexOf('🦻') !== -1) ? true : ('row 0 shows: ' + short(r0.words));
  }, test.limit.quick);
  test.run('a changed icon reaches the bar, by the stream', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    await chrome.evaluate('spirit.app.iconApp({ key: "hearing", icon: "🧪" }).then(function () { return true; }, function () { return false; })');
    newIcon = await until(function () { return forms().then(function (x) { return !!x[0] && x[0].icon.indexOf('🧪') !== -1; }); }, 5000);
    return (newIcon) ? true : ('the bar after a changed icon: ' + short((await forms())[0]));
  }, test.limit.slow);
  test.run('it lands in spirit/state/hearing/node.json', 0.2, async function () {
    return (stateOf().icon === '🧪') ? true : ('node.json: ' + short(stateOf()));
  }, test.limit.quick);
  test.run('and not in hearing.json', 0.2, async function () {
    if (!disk) return NO_PAGE;
    return (fs.readFileSync(disk, 'utf8') === fileBefore) ? true : ('hearing.json was written');
  }, test.limit.quick);

  // "row 1: rowForm: [✏️] "Label" [label input box] [Change]"
  test.run('the pencil, Label, the box holding the label, Change', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    await chrome.evaluate('spirit.app.iconApp({ key: "hearing", icon: "🦻" }).then(function () { return true; }, function () { return false; })');
    await until(function () { return forms().then(function (x) { return !!x[0] && x[0].icon.indexOf('🦻') !== -1; }); }, 5000);
    r1 = l[2] || none;
    return (r1.icon.indexOf('✏') !== -1 && r1.words.indexOf('Label') !== -1 && r1.input === monitorLabel && r1.button === 'Change') ? true : ('row 1: ' + short(r1));
  }, test.limit.slow);

  // row 2: "if active: [🟢] "Deactivate <app-label> "face" ..." [🔴]", "if inactive: [🔴] "Activate ..." [🟢]"
  // The words name what it mounts, read from hearing.json after the row is drawn: judged once that read has had its time,
  // as the rows below are, not on the panel's first look (goal/G43.32, the panel now opens before the read answers).
  const r2ok = function (x) { return x.icon.indexOf('🟢') !== -1 && x.words === 'Deactivate ' + monitorLabel + ' face' && x.button === '🔴'; };
  test.run('Hearing is active, and mounts a face only: [🟢] Deactivate Hearing face [🔴]', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    r2seen = await waitForm(3, r2ok);
    r2 = (await forms())[3] || none;
    return (r2seen && r2ok(r2)) ? true : ('row 2: ' + short(r2));
  }, test.limit.slow);
  test.run('a press: [🔴] Activate Hearing face [🟢], and active false in node.json', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    await press(3);
    wentOff = await waitForm(3, function (x) { return x.icon.indexOf('🔴') !== -1 && x.words === 'Activate ' + monitorLabel + ' face' && x.button === '🟢'; });
    return (wentOff && stateOf().active === false) ? true : ('after a press: ' + short((await forms())[3]) + ' ' + short(stateOf()));
  }, test.limit.slow);
  test.run('a press back turns it on', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    await press(3);
    wentOn = await waitForm(3, function (x) { return x.words === 'Deactivate ' + monitorLabel + ' face'; });
    return (wentOn && stateOf().active === true) ? true : ('after a press back: ' + short((await forms())[3]));
  }, test.limit.slow);

  // Row 3, the Allow row, went (goal/G43.18, box v29: "the Allow row of the app detail and its element ... are deleted").
  // goal/G43.18: no Allow row: "<name>.json alone says whether an app may be a shell"
  test.run('no row says Allow or Don\'t allow as shell', 0.2, async function () {
    if (!l) return NO_PAGE;
    return (!l.slice(1).some(function (x) { return /allow .* as shell/i.test(x.words || ''); })) ? true : ('a row still does: ' + short(l));
  }, test.limit.quick);

  // Q4: a changed label goes in node.json, and every row follows
  test.run('Change writes label to spirit/state/hearing/node.json', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    await chrome.evaluate('(function () { var f = [].filter.call(((' + panel + ') || document.createElement("div")).querySelectorAll(".shell-row-form"), function (f) { return f.getBoundingClientRect().height > 0; })[2]; var i = f && f.querySelector("input"); if (!i) return false; i.value = "Renamed"; i.dispatchEvent(new Event("input", { bubbles: true })); return true; }())');
    await press(2);
    renamed = await until(function () { return Promise.resolve(stateOf().label === 'Renamed'); }, 5000);
    return (renamed) ? true : ('node.json: ' + short(stateOf()));
  }, test.limit.slow);
  test.run('and not to hearing.json', 0.2, async function () {
    if (!disk) return NO_PAGE;
    return (fs.readFileSync(disk, 'utf8') === fileBefore) ? true : ('hearing.json was written');
  }, test.limit.quick);
  test.run('the stream brings it to the row', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    inRow = await until(function () { return chrome.evaluate('(function () { var r = spirit.data.app.data.rows().hearing; return !!r && r.label === "Renamed"; }())'); }, 5000);
    return (inRow) ? true : ('the row: ' + short(await chrome.evaluate('JSON.stringify(spirit.data.app.data.rows().hearing)')));
  }, test.limit.slow);
  test.run('the bar and the rows of the panel say it', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    follows = await until(function () { return forms().then(function (x) { return !!x[0] && !!x[3] && x[0].words === 'Renamed' && x[3].words === 'Deactivate Renamed face'; }); }, 5000);
    return (follows) ? true : ('the panel: ' + short(await forms()));
  }, test.limit.slow);
  test.run('the app itself does not open', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    await chrome.evaluate('(function () { var f = [].filter.call(((' + panel + ') || document.createElement("div")).querySelectorAll(".shell-row-form"), function (f) { return f.getBoundingClientRect().height > 0; })[2]; var i = f && f.querySelector("input"); if (!i) return false; i.value = ' + JSON.stringify(monitorLabel) + '; i.dispatchEvent(new Event("input", { bubbles: true })); return true; }())');
    await press(2);
    await until(function () { return Promise.resolve(stateOf().label === monitorLabel); }, 5000);
    await until(function () { return chrome.evaluate('(function () { var r = spirit.data.app.data.rows().hearing; return !!r && r.label === ' + JSON.stringify(monitorLabel) + '; }())'); }, 5000);
    return (!/Uptime|waiting/i.test(await chrome.evaluate('String((' + panel + ' || {}).innerText || "")'))) ? true : ('the panel launched the app');
  }, test.limit.slow);
  test.run('its x brings the list back', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    const shut = await closePanel();
    backAgain = shut && await until(function () { return chrome.evaluate('(function () { var r = ' + rowOf(monitorLabel) + '; return !!r && r.offsetParent !== null; }())'); }, 4000);
    return (backAgain) ? true : ('after close: ' + short(await inFaces()));
  }, test.limit.slow);

  // ""face" only displays if shell.mount==true", ""server" only displays if node.mount==true", ""and" is only displayed of both are true"
  const rewrite = function (shellMount, nodeMount) { const j = JSON.parse(fileBefore); j.shell = Object.assign({}, j.shell, { mount: shellMount }); j.node = Object.assign({}, j.node, { mount: nodeMount }); fs.writeFileSync(disk, JSON.stringify(j)); };
  test.run('both: Deactivate Hearing face and server', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    rewrite(true, true);
    await openPanel();
    const bothWords = await waitForm(3, function (x) { return x.words === 'Deactivate ' + monitorLabel + ' face and server'; });
    return (bothWords) ? true : ('with both: ' + short((await forms())[3]));
  }, test.limit.slow);
  test.run('and no Allow row (goal/G43.18)', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    return ((await forms()).length === 4) ? true : ('with both, forms: ' + short(await forms()));
  }, test.limit.quick);
  test.run('node.mount alone: Deactivate Hearing server', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    await closePanel();
    rewrite(false, true);
    await openPanel();
    const serverWords = await waitForm(3, function (x) { return x.words === 'Deactivate ' + monitorLabel + ' server'; });
    return (serverWords) ? true : ('with node.mount alone: ' + short((await forms())[3]));
  }, test.limit.slow);
  test.run('with shell.mount false, and no Allow row (goal/G43.18)', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    try {
      return ((await forms()).length === 4) ? true : ('with shell.mount false, forms: ' + short(await forms()));
    } finally {
      await closePanel();
      fs.writeFileSync(disk, fileBefore);
    }
  }, test.limit.slow);

  // the box: "in :tiles mode, only activated apps will appear."
  test.run('the toggle shows tiles: Hearing, active, and not starter', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    await chrome.evaluate('(function () { var t = document.querySelector("#faces .list-toggle"); if (t) t.click(); return !!t; }())');
    const onlyActive = await until(function () { return chrome.evaluate('!!' + tileOf(monitorLabel) + ' && !' + tileOf(serverLabel)); }, 5000);
    return (onlyActive) ? true : ('the tiles: ' + short(await inFaces()));
  }, test.limit.slow);
  test.run('face tiles from the start: the same', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    await mount({ face: 'tiles' });
    const direct = await until(function () { return chrome.evaluate('!!' + tileOf(monitorLabel) + ' && !' + tileOf(serverLabel)); }, 5000);
    return (direct) ? true : ('the tiles: ' + short(await inFaces()));
  }, test.limit.slow);
  test.run('an app made active appears, no search asked', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    await chrome.evaluate('spirit.app.activeApp({ key: "starter", active: true })');
    const arrives = await until(function () { return chrome.evaluate('!!' + tileOf(serverLabel)); }, 5000);
    return (arrives) ? true : ('the tiles after starter turned on: ' + short(await inFaces()));
  }, test.limit.slow);
  test.run('an app made inactive leaves', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    await chrome.evaluate('spirit.app.activeApp({ key: "starter", active: false })');
    const leaves = await until(function () { return chrome.evaluate('!' + tileOf(serverLabel)); }, 5000);
    return (leaves) ? true : ('the tiles after starter turned off: ' + short(await inFaces()));
  }, test.limit.slow);

  // the box: "in :tiles mode, appSelector icons will 'launch'", "its open and close move into appSelector"
  test.run('a tile opens its app inside, through its main element, spirit/app/monitor/element.js (goal/G43.32)', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    await chrome.evaluate('(function () { var t = ' + tileOf(monitorLabel) + '; if (t) t.click(); return !!t; }())');
    const opened = await until(function () { return chrome.evaluate('(function () { var p = ' + inPanel('.app-container-pane') + '; return !!p && /Uptime|waiting/i.test(String(p.innerText)); }())'); }, 10000);
    return (opened) ? true : ('a tile opened: ' + short(await inFaces()));
  }, test.limit.slow);
  test.run('the box: "the title bar of all panels": a launched app\'s bar is the same rowForm', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    const launchedBar = await chrome.evaluate('(function () { var f = ' + inPanel('.shell-row-form') + '; if (!f) return "no form"; var b = f.lastElementChild; return b && b.tagName === "BUTTON" && String(f.textContent).indexOf(' + JSON.stringify(monitorLabel) + ') !== -1 ? "form" : f.innerHTML; }())');
    return (launchedBar === 'form') ? true : ('a launched app\'s bar: ' + short(launchedBar));
  }, test.limit.quick);
  test.run('its close icon brings the tiles back', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    await chrome.evaluate('(function () { var c = ' + inPanel('.app-container-close') + '; if (c) c.click(); return !!c; }())');
    const closed = await until(function () { return chrome.evaluate('!' + panel + ' && !!' + tileOf(monitorLabel)); }, 5000);
    try {
      return (closed) ? true : ('after close: ' + short(await inFaces()));
    } finally {
      await chrome.evaluate('(function () { var c = document.getElementById("faces"); if (window.fs.destroy) window.fs.destroy(); if (c) c.remove(); return true; }())');
    }
  }, test.limit.slow);
  }
  // ── NO TILE WITHOUT shell.mount, AND A FACE FOR EVERY ONE THAT SAYS IT (goal/G43.20) ──
  // Andy: "all, MAKE SURE aN APP WITHOUT shell:mount NEVER SHOWS A FUCKING TILE!", and "where is your test that scans the app
  // folders and makes sure that app search complies with the spec, and doesn't show tiles for ANY app with shell:mound:false?".
  // Every app is made active first, so "only activated apps" cannot be what keeps a tile away.
  {
  let APPS, tree, treeOff, treeOn, keys, r, runs, LABELS, flipped;
  test.run('the world: the tree has apps without shell.mount true', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    APPS = path.join(node.root, 'spirit', 'run', 'spirit', 'app');
    const monitor = fs.readFileSync(path.join(APPS, 'monitor', 'element.js'), 'utf8');
    Object.keys(PLANT).forEach(function (k) {
      const p = PLANT[k];
      const dir = path.join(APPS, k);
      fs.mkdirSync(dir, { recursive: true });
      const j = { identity: { icon: '🧪', label: p.label, intrinsic: false }, mount: {}, node: { mount: false } };
      j.mount['element.js'] = true;
      if ('shell' in p) j.shell = p.shell;
      if (p.run) j.node.run = true;
      fs.writeFileSync(path.join(dir, k + '.json'), JSON.stringify(j, null, 2));
      fs.writeFileSync(path.join(dir, 'element.js'), monitor.split('spirit/app/monitor/element.js').join('spirit/app/' + k + '/element.js'));
    });
    // The tree's own apps that do not say shell.mount true: none of them may show a tile either.
    tree = fs.readdirSync(APPS).filter(function (n) { return !PLANT[n] && fs.existsSync(path.join(APPS, n, n + '.json')); }).map(function (n) {
      let j = {};
      try { j = JSON.parse(fs.readFileSync(path.join(APPS, n, n + '.json'), 'utf8')); } catch (e) { j = {}; }
      return { key: n, label: String((j.identity && j.identity.label) || n), mount: !!(j.shell && j.shell.mount === true), run: !!(j.node && j.node.run === true) };
    });
    treeOff = tree.filter(function (a) { return !a.mount && a.key !== 'app'; });
    return (treeOff.length >= 1) ? true : ('every app of the tree says shell.mount true: nothing of the tree to judge');
  }, test.limit.quick);

  let loaded;
  test.run('the world: appSelector loads', 0.2, async function () {
    if (!W1.up) return NO_PAGE;
    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    loaded = await chrome.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/app/app/element.js"); }).then(function () { return "loaded"; }, function (e) { return String(e && e.message || e); })');
    W1.loaded = loaded === 'loaded';
    return (loaded === 'loaded') ? true : ('appSelector did not load: ' + short(loaded));
  }, test.limit.long);

  // EVERY APP ACTIVE, planted and the tree's: what keeps a tile away below can only be shell.mount.
  const rows = function () { return chrome.evaluate('(function () { var r = (spirit.data.app && spirit.data.app.data) ? spirit.data.app.data.rows() : {}; var out = {}; ' + JSON.stringify(keys) + '.forEach(function (k) { out[k] = r[k] ? { active: r[k].active === true } : null; }); return JSON.stringify(out); }())').then(function (s) { try { return JSON.parse(s); } catch (e) { return {}; } }); };
  test.run('the world: every app, planted and the tree\'s, is made active', 0.2, async function () {
    if (!W1.loaded) return 'appSelector did not load: the world failed';
    keys = Object.keys(PLANT).concat(treeOff.map(function (a) { return a.key; }));
    await chrome.evaluate('(function () { var a = spirit.app && spirit.app.activeApp; if (!a) return false; ' + JSON.stringify(keys) + '.forEach(function (k) { try { a({ key: k, active: true }); } catch (e) { /* the row below says */ } }); return true; }())');
    await until(function () { return rows().then(function (r) { return keys.every(function (k) { return r[k] && r[k].active; }); }); }, 10000);
    // A row the node would not make active through the verb is made active on its disc, as a user's earlier press left it.
    r = await rows();
    const notYet = keys.filter(function (k) { return !(r[k] && r[k].active); });
    notYet.forEach(function (k) { const d = path.join(node.root, 'spirit', 'run', 'spirit', 'state', k); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'node.json'), JSON.stringify({ active: true })); });
    if (notYet.length) { await until(function () { return rows().then(function (x) { return notYet.every(function (k) { return x[k] && x[k].active; }); }); }, 10000); r = await rows(); }
    // AN APP THAT SAYS node.run IS RUN, NEVER ACTIVE (goal/G43.21): it is a row, held inactive whatever its node.json says, so
    // two things keep its tile away; for every other app only shell.mount can.
    runs = Object.keys(PLANT).filter(function (k) { return PLANT[k].run; }).concat(treeOff.filter(function (a) { return a.run; }).map(function (a) { return a.key; }));
    W1.rows = true;
    return true;
  }, test.limit.long);
  // Each app written out, the planted ones and the tree's without shell.mount true, so that each check has a plain title.
  const rowWhy = function (k) { return k + ' is no row at all: ' + short(r[k]); };
  const activeWhy = function (k) { return k + ' is no active row, so its missing tile would judge nothing: ' + short(r[k]); };
  test.run('the world: zzmounted is a row, active', 0.2, async function () {
    if (!W1.rows) return NO_PAGE;
    return (!!(r['zzmounted'] && r['zzmounted'].active)) ? true : (activeWhy('zzmounted'));
  }, test.limit.quick);
  test.run('the world: zzmountfalse is a row, active', 0.2, async function () {
    if (!W1.rows) return NO_PAGE;
    return (!!(r['zzmountfalse'] && r['zzmountfalse'].active)) ? true : (activeWhy('zzmountfalse'));
  }, test.limit.quick);
  test.run('the world: zznoshell is a row, active', 0.2, async function () {
    if (!W1.rows) return NO_PAGE;
    return (!!(r['zznoshell'] && r['zznoshell'].active)) ? true : (activeWhy('zznoshell'));
  }, test.limit.quick);
  test.run('the world: zznomount is a row, active', 0.2, async function () {
    if (!W1.rows) return NO_PAGE;
    return (!!(r['zznomount'] && r['zznomount'].active)) ? true : (activeWhy('zznomount'));
  }, test.limit.quick);
  test.run('the world: zzstringmount is a row, active', 0.2, async function () {
    if (!W1.rows) return NO_PAGE;
    return (!!(r['zzstringmount'] && r['zzstringmount'].active)) ? true : (activeWhy('zzstringmount'));
  }, test.limit.quick);
  test.run('the world: zzonemount is a row, active', 0.2, async function () {
    if (!W1.rows) return NO_PAGE;
    return (!!(r['zzonemount'] && r['zzonemount'].active)) ? true : (activeWhy('zzonemount'));
  }, test.limit.quick);
  test.run('the world: zzshellnull is a row, active', 0.2, async function () {
    if (!W1.rows) return NO_PAGE;
    return (!!(r['zzshellnull'] && r['zzshellnull'].active)) ? true : (activeWhy('zzshellnull'));
  }, test.limit.quick);
  test.run('the world: zzrunonly is a row, run only, never active', 0.2, async function () {
    if (!W1.rows) return NO_PAGE;
    return (!!r['zzrunonly']) ? true : (rowWhy('zzrunonly'));
  }, test.limit.quick);
  test.run('the world: backup is a row, active', 0.2, async function () {
    if (!W1.rows) return NO_PAGE;
    return (!!(r['backup'] && r['backup'].active)) ? true : (activeWhy('backup'));
  }, test.limit.quick);
  test.run('the world: deskClient is a row, active', 0.2, async function () {
    if (!W1.rows) return NO_PAGE;
    return (!!(r['deskClient'] && r['deskClient'].active)) ? true : (activeWhy('deskClient'));
  }, test.limit.quick);
  test.run('the world: publishData is a row, run only, never active', 0.2, async function () {
    if (!W1.rows) return NO_PAGE;
    return (!!r['publishData']) ? true : (rowWhy('publishData'));
  }, test.limit.quick);
  test.run('the world: pushOrigin is a row, run only, never active', 0.2, async function () {
    if (!W1.rows) return NO_PAGE;
    return (!!r['pushOrigin']) ? true : (rowWhy('pushOrigin'));
  }, test.limit.quick);

  const mount = function (opts) { return chrome.evaluate('(function () { var old = document.getElementById("faces"); if (old) { if (window.fsel) window.fsel.destroy(); old.remove(); } var c = document.createElement("div"); c.id = "faces"; c.style.cssText = "position:fixed;left:0;top:0;width:1200px;height:800px;display:flex;flex-direction:column;background:#111"; document.body.appendChild(c); window.fsel = spirit.element.spirit.app.app.element.create(c, ' + JSON.stringify(opts) + '); if (window.fsel.parentNode !== c) c.appendChild(window.fsel); return true; }())'); };
  // The labels drawn as tiles: every visible leaf under the tiles whose text is a label of the test's.
  // LABELS is set by the world above it, so drawn() reads it when it runs.
  const drawn = function () { return chrome.evaluate('(function () { var c = document.getElementById("faces"); if (!c) return "[]"; var want = ' + JSON.stringify(LABELS) + '; var out = []; var all = c.querySelectorAll("*"); for (var i = 0; i < all.length; i++) { var e = all[i]; if (!e.getClientRects().length) continue; var t = String(e.innerText || e.textContent || "").trim(); if (!e.children.length && want.indexOf(t) !== -1 && out.indexOf(t) === -1) out.push(t); } return JSON.stringify(out.sort()); }())').then(function (s) { try { return JSON.parse(s); } catch (e) { return []; } }); };
  // What each way of reaching the tiles drew, for the checks after it.
  const judged = {};
  const look = async function (how) {
    if (!W1.rows) return NO_PAGE;
    const seen = await until(function () { return drawn().then(function (d) { return d.indexOf(PLANT.zzmounted.label) !== -1; }); }, 8000);
    const held12 = seen;
    const why12 = how + ': not even the mounted app shows a tile, so nothing is judged: ' + short(await drawn());
    await sleep(800);
    const d = await drawn();
    judged[how] = { d: d };
    return held12 ? true : why12;
  };
  const planted = function (how, k) {
    const J = judged[how];
    if (!J) return how + ': never looked at: the test before failed';
    const d = J.d;
    const held11 = d.indexOf(PLANT[k].label) === -1;
    const why11 = how + ': ' + k + ' shows a tile, its json ' + short('shell' in PLANT[k] ? PLANT[k].shell : 'no shell part');
    return held11 ? true : why11;
  };
  const ofTheTree = function (how, key) {
    const J = judged[how];
    if (!J) return how + ': never looked at: the test before failed';
    const d = J.d;
    const a = treeOff.filter(function (x) { return x.key === key; })[0];
    if (!a) return key + ' is no app of the tree without shell.mount true: nothing judged';
    const held10 = d.indexOf(a.label) === -1;
    const why10 = how + ': the tree\'s ' + a.key + ' shows a tile without shell.mount true';
    return held10 ? true : why10;
  };
  test.run('the world: every app of the tree without shell.mount true has a line of its own in this test', 0.2, function () {
    if (!treeOff) return NO_PAGE;
    const lined = ['backup', 'deskClient', 'publishData', 'pushOrigin'];
    const unlined = treeOff.filter(function (a) { return lined.indexOf(a.key) === -1; }).map(function (a) { return a.key; });
    return !unlined.length || unlined.join(', ') + ' has no line of its own in this test, so nothing judged it';
  }, test.limit.quick);

  // Andy: "MAKE SURE aN APP WITHOUT shell:mount NEVER SHOWS A FUCKING TILE!": tiles from the start
  test.run('tiles: the app that says shell.mount true shows its tile', 0.2, async function () {
    if (!W1.rows) return NO_PAGE;
    LABELS = Object.keys(PLANT).map(function (k) { return PLANT[k].label; }).concat(treeOff.map(function (a) { return a.label; }));
    await mount({ face: 'tiles' });
    return look('tiles');
  }, test.limit.slow);
  test.run('tiles: zzmountfalse (shell.mount false) shows no tile', 0.2, async function () {
    return planted('tiles', 'zzmountfalse');
  }, test.limit.quick);
  test.run('tiles: zznoshell (no shell part) shows no tile', 0.2, async function () {
    return planted('tiles', 'zznoshell');
  }, test.limit.quick);
  test.run('tiles: zznomount (no shell.mount) shows no tile', 0.2, async function () {
    return planted('tiles', 'zznomount');
  }, test.limit.quick);
  test.run('tiles: zzstringmount (shell.mount the string true) shows no tile', 0.2, async function () {
    return planted('tiles', 'zzstringmount');
  }, test.limit.quick);
  test.run('tiles: zzonemount (shell.mount 1) shows no tile', 0.2, async function () {
    return planted('tiles', 'zzonemount');
  }, test.limit.quick);
  test.run('tiles: zzshellnull (shell null) shows no tile', 0.2, async function () {
    return planted('tiles', 'zzshellnull');
  }, test.limit.quick);
  test.run('tiles: zzrunonly (run only, shell.mount false) shows no tile', 0.2, async function () {
    return planted('tiles', 'zzrunonly');
  }, test.limit.quick);
  test.run('tiles: the tree\'s backup shows no tile', 0.2, async function () {
    return ofTheTree('tiles', 'backup');
  }, test.limit.quick);
  test.run('tiles: the tree\'s deskClient shows no tile', 0.2, async function () {
    return ofTheTree('tiles', 'deskClient');
  }, test.limit.quick);
  test.run('tiles: the tree\'s publishData shows no tile', 0.2, async function () {
    return ofTheTree('tiles', 'publishData');
  }, test.limit.quick);
  test.run('tiles: the tree\'s pushOrigin shows no tile', 0.2, async function () {
    return ofTheTree('tiles', 'pushOrigin');
  }, test.limit.quick);

  // the same, tiles reached by the toggle from the pane
  test.run('the world: the pane has a toggle to press', 0.2, async function () {
    if (!W1.rows) return NO_PAGE;
    await mount({ face: 'pane', toggle: true });
    await until(function () { return chrome.evaluate('String(document.getElementById("faces").innerText).indexOf(' + JSON.stringify(PLANT.zzmounted.label) + ') !== -1'); }, 8000);
    flipped = await chrome.evaluate('(function () { var bs = document.getElementById("faces").querySelectorAll("button"); for (var i = 0; i < bs.length; i++) if (String(bs[i].textContent).indexOf("\u25A6") !== -1) { bs[i].click(); return true; } return false; }())');
    return (flipped === true) ? true : ('no toggle found on the pane: the toggled tiles are not judged');
  }, test.limit.slow);
  test.run('toggled tiles: the app that says shell.mount true shows its tile', 0.2, async function () {
    if (flipped !== true) return 'no toggle was pressed: the toggled tiles are not judged';
    return look('toggled tiles');
  }, test.limit.slow);
  test.run('toggled tiles: zzmountfalse (shell.mount false) shows no tile', 0.2, async function () {
    return planted('toggled tiles', 'zzmountfalse');
  }, test.limit.quick);
  test.run('toggled tiles: zznoshell (no shell part) shows no tile', 0.2, async function () {
    return planted('toggled tiles', 'zznoshell');
  }, test.limit.quick);
  test.run('toggled tiles: zznomount (no shell.mount) shows no tile', 0.2, async function () {
    return planted('toggled tiles', 'zznomount');
  }, test.limit.quick);
  test.run('toggled tiles: zzstringmount (shell.mount the string true) shows no tile', 0.2, async function () {
    return planted('toggled tiles', 'zzstringmount');
  }, test.limit.quick);
  test.run('toggled tiles: zzonemount (shell.mount 1) shows no tile', 0.2, async function () {
    return planted('toggled tiles', 'zzonemount');
  }, test.limit.quick);
  test.run('toggled tiles: zzshellnull (shell null) shows no tile', 0.2, async function () {
    return planted('toggled tiles', 'zzshellnull');
  }, test.limit.quick);
  test.run('toggled tiles: zzrunonly (run only, shell.mount false) shows no tile', 0.2, async function () {
    return planted('toggled tiles', 'zzrunonly');
  }, test.limit.quick);
  test.run('toggled tiles: the tree\'s backup shows no tile', 0.2, async function () {
    return ofTheTree('toggled tiles', 'backup');
  }, test.limit.quick);
  test.run('toggled tiles: the tree\'s deskClient shows no tile', 0.2, async function () {
    return ofTheTree('toggled tiles', 'deskClient');
  }, test.limit.quick);
  test.run('toggled tiles: the tree\'s publishData shows no tile', 0.2, async function () {
    return ofTheTree('toggled tiles', 'publishData');
  }, test.limit.quick);
  test.run('toggled tiles: the tree\'s pushOrigin shows no tile', 0.2, async function () {
    return ofTheTree('toggled tiles', 'pushOrigin');
  }, test.limit.quick);

  // the app app's own tiles, as boot.js mounts it: no options (goal/G43.32)
  test.run('the app app\'s tiles: the app that says shell.mount true shows its tile', 0.2, async function () {
    if (!W1.rows) return NO_PAGE;
    await mount();
    return look('the app app\'s tiles');
  }, test.limit.slow);
  test.run('the app app\'s tiles: zzmountfalse (shell.mount false) shows no tile', 0.2, async function () {
    return planted('the app app\'s tiles', 'zzmountfalse');
  }, test.limit.quick);
  test.run('the app app\'s tiles: zznoshell (no shell part) shows no tile', 0.2, async function () {
    return planted('the app app\'s tiles', 'zznoshell');
  }, test.limit.quick);
  test.run('the app app\'s tiles: zznomount (no shell.mount) shows no tile', 0.2, async function () {
    return planted('the app app\'s tiles', 'zznomount');
  }, test.limit.quick);
  test.run('the app app\'s tiles: zzstringmount (shell.mount the string true) shows no tile', 0.2, async function () {
    return planted('the app app\'s tiles', 'zzstringmount');
  }, test.limit.quick);
  test.run('the app app\'s tiles: zzonemount (shell.mount 1) shows no tile', 0.2, async function () {
    return planted('the app app\'s tiles', 'zzonemount');
  }, test.limit.quick);
  test.run('the app app\'s tiles: zzshellnull (shell null) shows no tile', 0.2, async function () {
    return planted('the app app\'s tiles', 'zzshellnull');
  }, test.limit.quick);
  test.run('the app app\'s tiles: zzrunonly (run only, shell.mount false) shows no tile', 0.2, async function () {
    return planted('the app app\'s tiles', 'zzrunonly');
  }, test.limit.quick);
  test.run('the app app\'s tiles: the tree\'s backup shows no tile', 0.2, async function () {
    return ofTheTree('the app app\'s tiles', 'backup');
  }, test.limit.quick);
  test.run('the app app\'s tiles: the tree\'s deskClient shows no tile', 0.2, async function () {
    return ofTheTree('the app app\'s tiles', 'deskClient');
  }, test.limit.quick);
  test.run('the app app\'s tiles: the tree\'s publishData shows no tile', 0.2, async function () {
    return ofTheTree('the app app\'s tiles', 'publishData');
  }, test.limit.quick);
  test.run('the app app\'s tiles: the tree\'s pushOrigin shows no tile', 0.2, async function () {
    return ofTheTree('the app app\'s tiles', 'pushOrigin');
  }, test.limit.quick);

  // never: an app that loses shell.mount on its disc loses its tile, no reload
  let file, j;
  test.run('its tile leaves the moment its json says shell.mount false', 0.2, async function () {
    if (!W1.rows) return NO_PAGE;
    await mount({ face: 'tiles' });
    await until(function () { return drawn().then(function (d) { return d.indexOf(PLANT.zzmounted.label) !== -1; }); }, 8000);
    file = path.join(APPS, 'zzmounted', 'zzmounted.json');
    j = JSON.parse(fs.readFileSync(file, 'utf8'));
    j.shell.mount = false;
    fs.writeFileSync(file, JSON.stringify(j, null, 2));
    const left = await until(function () { return drawn().then(function (d) { return d.indexOf(PLANT.zzmounted.label) === -1; }); }, 8000);
    return (left) ? true : ('its tile stayed after its json said shell.mount false: ' + short(await drawn()) + '; its row: ' + short(await chrome.evaluate('JSON.stringify(spirit.data.app.data.rows().zzmounted)')));
  }, test.limit.slow);
  test.run('and with its shell part gone it does not come back', 0.2, async function () {
    if (!j) return NO_PAGE;
    delete j.shell;
    fs.writeFileSync(file, JSON.stringify(j, null, 2));
    await sleep(1500);
    return ((await drawn()).indexOf(PLANT.zzmounted.label) === -1) ? true : ('with its shell part gone its tile came back');
  }, test.limit.slow);
  test.run('and saying shell.mount true again brings it back', 0.2, async function () {
    if (!j) return NO_PAGE;
    j.shell = { true: false, mount: true, tile: true };
    fs.writeFileSync(file, JSON.stringify(j, null, 2));
    const back = await until(function () { return drawn().then(function (d) { return d.indexOf(PLANT.zzmounted.label) !== -1; }); }, 8000);
    return (back) ? true : ('shell.mount true again did not bring its tile back, so the leaving judged nothing: ' + short(await drawn()));
  }, test.limit.slow);

  // AN APP THAT CLAIMS A FACE SUPPLIES ONE (Andy: "where is the test that verifies that an app who claims to have a face,
  // also actually supplies a fucking face?"): every app of the tree whose json says shell.mount true, its tile pressed, draws
  // something in the layer it opens. The app app is left out: it hides itself from the tiles (goal/G43.18, G43.32).
  // Andy: "an app who claims to have a face, also actually supplies a fucking face"
  test.run('the world: the tree has apps that say shell.mount true', 0.2, async function () {
    if (!tree) return NO_PAGE;
    treeOn = tree.filter(function (a) { return a.mount && a.key !== 'app'; });
    return (treeOn.length >= 1) ? true : ('no app of the tree says shell.mount true: nothing to judge');
  }, test.limit.quick);
  const ON = ['agent', 'chat', 'contact', 'desk', 'file', 'grants', 'hearing', 'icons', 'info', 'introSpector', 'job', 'join', 'media', 'monitor', 'starter', 'testicle', 'text'];
  test.run('the world: every app of the tree that says shell.mount true has a line of its own in this test', 0.2, function () {
    if (!treeOn) return NO_PAGE;
    const unlined = treeOn.filter(function (a) { return ON.indexOf(a.key) === -1; }).map(function (a) { return a.key; });
    return !unlined.length || unlined.join(', ') + ' has no line of its own in this test, so nothing judged it';
  }, test.limit.quick);
  const faceScript = function (key) {
    const a = (treeOn || []).filter(function (x) { return x.key === key; })[0];
    if (!a) return key + ' is no app of the tree that says shell.mount true: nothing judged';
    // Its main element, spirit/app/<name>/element.js (goal/G43.32, rule 4).
    const f = path.join(APPS, a.key, 'element.js');
    const held9 = fs.existsSync(f);
    const why9 = a.key + ' says shell.mount true and has no spirit/app/' + a.key + '/element.js';
    return held9 ? true : why9;
  };
  test.run('agent: its face script spirit/app/agent/element.js is there', 0.2, async function () {
    return faceScript('agent');
  }, test.limit.quick);
  test.run('chat: its face script spirit/app/chat/element.js is there', 0.2, async function () {
    return faceScript('chat');
  }, test.limit.quick);
  test.run('contact: its face script spirit/app/contact/element.js is there', 0.2, async function () {
    return faceScript('contact');
  }, test.limit.quick);
  test.run('desk: its face script spirit/app/desk/element.js is there', 0.2, async function () {
    return faceScript('desk');
  }, test.limit.quick);
  test.run('file: its face script spirit/app/file/element.js is there', 0.2, async function () {
    return faceScript('file');
  }, test.limit.quick);
  test.run('grants: its face script spirit/app/grants/element.js is there', 0.2, async function () {
    return faceScript('grants');
  }, test.limit.quick);
  test.run('hearing: its face script spirit/app/hearing/element.js is there', 0.2, async function () {
    return faceScript('hearing');
  }, test.limit.quick);
  test.run('icons: its face script spirit/app/icons/element.js is there', 0.2, async function () {
    return faceScript('icons');
  }, test.limit.quick);
  test.run('info: its face script spirit/app/info/element.js is there', 0.2, async function () {
    return faceScript('info');
  }, test.limit.quick);
  test.run('introSpector: its face script spirit/app/introSpector/element.js is there', 0.2, async function () {
    return faceScript('introSpector');
  }, test.limit.quick);
  test.run('job: its face script spirit/app/job/element.js is there', 0.2, async function () {
    return faceScript('job');
  }, test.limit.quick);
  test.run('join: its face script spirit/app/join/element.js is there', 0.2, async function () {
    return faceScript('join');
  }, test.limit.quick);
  test.run('media: its face script spirit/app/media/element.js is there', 0.2, async function () {
    return faceScript('media');
  }, test.limit.quick);
  test.run('monitor: its face script spirit/app/monitor/element.js is there', 0.2, async function () {
    return faceScript('monitor');
  }, test.limit.quick);
  test.run('starter: its face script spirit/app/starter/element.js is there', 0.2, async function () {
    return faceScript('starter');
  }, test.limit.quick);
  test.run('testicle: its face script spirit/app/testicle/element.js is there', 0.2, async function () {
    return faceScript('testicle');
  }, test.limit.quick);
  test.run('text: its face script spirit/app/text/element.js is there', 0.2, async function () {
    return faceScript('text');
  }, test.limit.quick);
  let shown;
  test.run('the world: every app that says shell.mount true is active', 0.2, async function () {
    if (!treeOn) return NO_PAGE;
    await chrome.evaluate('(function () { ' + JSON.stringify(treeOn.map(function (a) { return a.key; })) + '.forEach(function (k) { try { spirit.app.activeApp({ key: k, active: true }); } catch (e) { /* the tile says */ } }); return true; }())');
    const onKeys = JSON.stringify(treeOn.map(function (a) { return a.key; }));
    const allOn = await until(function () { return chrome.evaluate('(function () { var r = spirit.data.app.data.rows(); return ' + onKeys + '.every(function (k) { return !!r[k] && r[k].active === true; }); }())'); }, 10000);
    await mount({ face: 'tiles' });
    shown = 'Array.prototype.filter.call(document.querySelectorAll("#faces .app-container"), function (c) { return c.offsetParent !== null; })[0]';
    W1.allOn = true;
    return (allOn) ? true : ('not all are active: ' + short(await chrome.evaluate('(function () { var r = spirit.data.app.data.rows(); return JSON.stringify(' + onKeys + '.filter(function (k) { return !(r[k] && r[k].active === true); })); }())')));
  }, test.limit.slow);
  const faceDraws = async function (key) {
    if (!W1.allOn) return 'not every app was made active: the world failed';
    const a = treeOn.filter(function (x) { return x.key === key; })[0];
    if (!a) return key + ' is no app of the tree that says shell.mount true: nothing judged';
    const tile = 'Array.prototype.filter.call(document.querySelectorAll("#faces .app-icon"), function (t) { return t.offsetParent !== null && String(t.textContent).indexOf(' + JSON.stringify(a.label) + ') !== -1; })[0]';
    const there = await until(function () { return chrome.evaluate('!!' + tile); }, 8000);
    if (!there) return a.key + ' says shell.mount true and shows no tile to press: ' + short(await drawn());
    await chrome.evaluate('(function () { window.pageErrors = []; window.addEventListener("error", function (e) { window.pageErrors.push(String(e.message)); }); window.addEventListener("unhandledrejection", function (e) { window.pageErrors.push(String(e.reason && e.reason.message || e.reason)); }); var t = ' + tile + '; t.click(); return true; }())');
    // A face is drawn: the opened layer's pane holds a visible element of some size, beyond the bare pane itself.
    const drew = await until(function () { return chrome.evaluate('(function () { var c = ' + shown + '; if (!c) return false; var p = c.querySelector(".app-container-pane"); if (!p) return false; var all = p.querySelectorAll("*"); for (var i = 0; i < all.length; i++) { var r = all[i].getBoundingClientRect(); if (r.width > 4 && r.height > 4 && (String(all[i].innerText || "").trim() || /^(CANVAS|SVG|IMG|VIDEO|INPUT|TEXTAREA|BUTTON|IFRAME)$/i.test(all[i].tagName))) return true; } return false; }())'); }, 10000);
    const errs = await chrome.evaluate('JSON.stringify(window.pageErrors || [])');
    const held8 = drew;
    const why8 = a.key + ' says shell.mount true and its tile drew no face; page errors: ' + short(errs) + '; the layer: ' + short(await chrome.evaluate('(function () { var c = ' + shown + '; return c ? c.innerHTML : "no layer shown"; }())'));
    await chrome.evaluate('(function () { var c = ' + shown + '; var x = c && c.querySelector(".app-container-close"); if (x) x.click(); return !!x; }())');
    await until(function () { return chrome.evaluate('!' + shown); }, 5000);
    return held8 ? true : why8;
  };
  test.run('agent: its tile opens a face that draws', 0.2, async function () {
    return faceDraws('agent');
  }, test.limit.long);
  test.run('chat: its tile opens a face that draws', 0.2, async function () {
    return faceDraws('chat');
  }, test.limit.long);
  test.run('contact: its tile opens a face that draws', 0.2, async function () {
    return faceDraws('contact');
  }, test.limit.long);
  test.run('desk: its tile opens a face that draws', 0.2, async function () {
    return faceDraws('desk');
  }, test.limit.long);
  test.run('file: its tile opens a face that draws', 0.2, async function () {
    return faceDraws('file');
  }, test.limit.long);
  test.run('grants: its tile opens a face that draws', 0.2, async function () {
    return faceDraws('grants');
  }, test.limit.long);
  test.run('hearing: its tile opens a face that draws', 0.2, async function () {
    return faceDraws('hearing');
  }, test.limit.long);
  test.run('icons: its tile opens a face that draws', 0.2, async function () {
    return faceDraws('icons');
  }, test.limit.long);
  test.run('info: its tile opens a face that draws', 0.2, async function () {
    return faceDraws('info');
  }, test.limit.long);
  test.run('introSpector: its tile opens a face that draws', 0.2, async function () {
    return faceDraws('introSpector');
  }, test.limit.long);
  test.run('job: its tile opens a face that draws', 0.2, async function () {
    return faceDraws('job');
  }, test.limit.long);
  test.run('join: its tile opens a face that draws', 0.2, async function () {
    return faceDraws('join');
  }, test.limit.long);
  test.run('media: its tile opens a face that draws', 0.2, async function () {
    return faceDraws('media');
  }, test.limit.long);
  test.run('monitor: its tile opens a face that draws', 0.2, async function () {
    return faceDraws('monitor');
  }, test.limit.long);
  test.run('starter: its tile opens a face that draws', 0.2, async function () {
    return faceDraws('starter');
  }, test.limit.long);
  test.run('testicle: its tile opens a face that draws', 0.2, async function () {
    return faceDraws('testicle');
  }, test.limit.long);
  test.run('text: its tile opens a face that draws', 0.2, async function () {
    return faceDraws('text');
  }, test.limit.long);
  }
}

// ── THE nodeRun PART ───────────────────────────────────────────────────────────────────────────────────────────
{
  // The nodeRun part of ./element.js.
  // AN APP THAT IS RUN, NOT MOUNTED (goal/G43.21; spec: ./element.md, its nodeRun section). Andy, the box: "spirit app search will list these jobs
  // (node:run) only in pane mode, bacause it they have no shell-mount. the app detail will show a run button.", and "the Andy
  // user on each box will run those scripts when he feels like it". A real Chrome on a scratch node's face page, the two
  // apps of the tree that say node.run, pushOrigin and publishData; neither Andy's node nor an agent's is touched. The scratch
  // tree is no git clone, so a pushOrigin started there pushes nothing.
  const APPS = path.join(RUN, 'spirit', 'app');
  const W2 = {};
  const NO_PAGE = 'no scratch node or no Chrome: the world failed';
  let own, runs, mounts, PUSH, node, chrome, ask, loaded, LABELS, inPane, inDrop, plain, only;
  const byKey = function (list, key) { return (list || []).filter(function (a) { return a.key === key; })[0]; };

  // nodeRun: an app that says node.run is listed in pane mode only, and its detail runs it (goal/G43.21)
  test.run('the world: publishData and pushOrigin say node.run, and apps mount in the shell', 0.2, async function () {
    // The part before is done: its scratch node and Chrome stop here.
    stopAll();
    // The tree's apps, from each <name>.json: which say node.run, and which mount as a shell app.
    own = fs.readdirSync(APPS).filter(function (n) { return fs.existsSync(path.join(APPS, n, n + '.json')); }).map(function (n) {
      let j = {};
      try { j = JSON.parse(fs.readFileSync(path.join(APPS, n, n + '.json'), 'utf8')); } catch (e) { j = {}; }
      return { key: n, label: String((j.identity && j.identity.label) || n), icon: String((j.identity && j.identity.icon) || ''), run: !!(j.node && j.node.run === true), shell: !!(j.shell && j.shell.mount === true) };
    });
    runs = own.filter(function (a) { return a.run; });
    mounts = own.filter(function (a) { return a.shell && !a.run; });
    PUSH = own.filter(function (a) { return a.key === 'pushOrigin'; })[0];
    LABELS = JSON.stringify(own.map(function (a) { return a.label; }));
    return (runs.length >= 2 && mounts.length >= 1) ? true : ('nothing to judge with: ' + short(own));
  }, test.limit.quick);
  test.run('the world: every app that says node.run has a line of its own in this test', 0.2, function () {
    if (!runs) return 'the tree\'s apps were not read: the world failed';
    const unlined = runs.filter(function (a) { return ['publishData', 'pushOrigin'].indexOf(a.key) === -1; }).map(function (a) { return a.key; });
    return !unlined.length || unlined.join(', ') + ' has no line of its own in this test, so nothing judged it';
  }, test.limit.quick);
  test.run('the world: the app search and the app detail load', 0.2, async function () {
    if (!runs || !runs.length || !mounts || !mounts.length) return 'nothing to judge with: the world failed';
    node = await scratchNode();
    chrome = await chromePage(findChrome());
    LIVE.push({ node: node, chrome: chrome });
    if (!node.up || chrome.error) return 'no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '');
    ask = async function (verb, args) { const r = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) }); try { return JSON.parse(await r.text()); } catch (e) { return null; } };
    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    loaded = await chrome.evaluate('window.spirit.ready.then(function () { return Promise.all([spirit.require("spirit/element/search/app.js"), spirit.require("spirit/element/search/app/detailElement.js")]); }).then(function () { return "loaded"; }, function (e) { return String(e && e.message || e); })');
    W2.up = loaded === 'loaded';
    return (loaded === 'loaded') ? true : ('they did not load: ' + short(loaded));
  }, test.limit.long);
  // The app labels drawn anywhere under an element: its leaves whose text is an app's label.
  const drawnUnder = function (expr) { return chrome.evaluate('(function () { var root = ' + expr + '; if (!root) return []; var want = ' + LABELS + '; var out = []; var all = root.querySelectorAll("*"); for (var i = 0; i < all.length; i++) { var t = String(all[i].innerText || "").trim(); if (!all[i].children.length && want.indexOf(t) !== -1 && out.indexOf(t) === -1) out.push(t); } return out.sort(); }())'); };
  const has = function (list, a) { return list.indexOf(a.label) !== -1; };

  // Andy: "spirit app search will list these jobs (node:run) only in pane mode"
  const listedInPane = function (key) {
    const a = byKey(runs, key);
    if (!a) return key + ' says no node.run in this tree: nothing judged';
    const held7 = has(inPane, a);
    const why7 = 'the pane does not list ' + a.label + ': ' + short(inPane);
    return held7 ? true : why7;
  };
  test.run('the pane lists Publish Data', 0.2, async function () {
    if (!W2.up) return NO_PAGE;
    await chrome.evaluate('(function () { var c = document.createElement("div"); c.id = "pane"; document.body.appendChild(c); window.pane = spirit.element.spirit.element.search.app.create(c, { face: "pane" }); return true; }())');
    await until(function () { return drawnUnder('document.getElementById("pane")').then(function (d) { return runs.every(function (a) { return has(d, a); }); }); }, 8000);
    inPane = await drawnUnder('document.getElementById("pane")');
    return listedInPane('publishData');
  }, test.limit.slow);
  test.run('the pane lists Push Origin', 0.2, async function () {
    if (!inPane) return NO_PAGE;
    try {
      return listedInPane('pushOrigin');
    } finally {
      await chrome.evaluate('(function () { window.pane.destroy(); var c = document.getElementById("pane"); if (c) c.remove(); return true; }())');
    }
  }, test.limit.quick);
  // The dropdown, pressed open: its list floats, so the whole page is read, with nothing else of the test on it.
  test.run('the world: pressed, the dropdown lists the apps that mount', 0.2, async function () {
    if (!W2.up) return NO_PAGE;
    await chrome.evaluate('(function () { var c = document.createElement("div"); c.id = "drop"; document.body.appendChild(c); window.drop = spirit.element.spirit.element.search.app.create(c, { face: "dropdown" }); return true; }())');
    await sleep(800);
    await chrome.evaluate('(function () { var d = window.drop, f = (d && d.list && d.list.field) || document.querySelector("#drop input, #drop [tabindex], #drop button"); if (f) f.click(); return !!f; }())');
    await until(function () { return drawnUnder('document.body').then(function (d) { return mounts.some(function (a) { return has(d, a); }); }); }, 8000);
    inDrop = await drawnUnder('document.body');
    return (mounts.some(function (a) { return has(inDrop, a); })) ? true : ('the dropdown listed no app at all: nothing judged. ' + short(inDrop));
  }, test.limit.slow);
  const notInDrop = function (key) {
    const a = byKey(runs, key);
    if (!a) return key + ' says no node.run in this tree: nothing judged';
    const held6 = !has(inDrop, a);
    const why6 = 'the dropdown lists ' + a.label + ': ' + short(inDrop);
    return held6 ? true : why6;
  };
  test.run('the dropdown does not list Publish Data', 0.2, async function () {
    if (!inDrop) return NO_PAGE;
    return notInDrop('publishData');
  }, test.limit.quick);
  test.run('the dropdown does not list Push Origin', 0.2, async function () {
    if (!inDrop) return NO_PAGE;
    try {
      return notInDrop('pushOrigin');
    } finally {
      await chrome.evaluate('(function () { window.drop.destroy(); var c = document.getElementById("drop"); if (c) c.remove(); return true; }())');
    }
  }, test.limit.quick);

  // Andy: "the app detail will show a run button"
  // A Run button: a button whose own text is Run.
  const runButton = 'Array.prototype.filter.call(document.querySelectorAll("#detail button"), function (b) { return /\\bRun\\b/.test(String(b.textContent || "")); })[0]';
  const detailOf = function (a) { return chrome.evaluate('(function () { var old = document.getElementById("detail"); if (window.det) { window.det.destroy(); } if (old) old.remove(); var c = document.createElement("div"); c.id = "detail"; document.body.appendChild(c); window.det = spirit.element.spirit.element.search.app.detailElement.create(c, { row: ' + JSON.stringify({ key: a.key, label: a.label, icon: a.icon }) + ', panel: true }); return true; }())'); };
  const runShown = async function (key) {
    if (!W2.up) return NO_PAGE;
    const a = byKey(runs, key);
    if (!a) return key + ' says no node.run in this tree: nothing judged';
    await detailOf(a);
    const shown = await until(function () { return chrome.evaluate('!!(' + runButton + ')'); }, 6000);
    const held5 = shown;
    const why5 = a.label + '\'s detail shows no Run: ' + short(await chrome.evaluate('String(document.getElementById("detail").innerText)'));
    return held5 ? true : why5;
  };
  test.run('Publish Data\'s detail shows a Run button', 0.2, async function () {
    return runShown('publishData');
  }, test.limit.slow);
  test.run('Push Origin\'s detail shows a Run button', 0.2, async function () {
    return runShown('pushOrigin');
  }, test.limit.slow);
  test.run('Agent, which mounts and says no node.run, shows no Run', 0.2, async function () {
    if (!W2.up) return NO_PAGE;
    plain = mounts[0];
    await detailOf(plain);
    await sleep(1500);
    const drew = await chrome.evaluate('String(document.getElementById("detail").innerText || "").indexOf(' + JSON.stringify(plain.label) + ') !== -1');
    const noRun = await chrome.evaluate('!(' + runButton + ')');
    return (drew && noRun) ? true : (plain.label + '\'s detail: ' + short(await chrome.evaluate('String(document.getElementById("detail").innerText)')));
  }, test.limit.slow);

  // Andy: "in the app list and details: an app that only has node:run and no node:mount or shell:mount cannot be "activated"
  // show rowForms should knows that.", and "and the node should know it, too."
  // Andy: "an app that only has node:run and no node:mount or shell:mount cannot be "activated""
  // An Activate or Deactivate row seen under an element: a leaf whose words start so (rowFormAppActive's "Activate <label> ...").
  const activateUnder = function (expr) { return chrome.evaluate('(function () { var root = ' + expr + '; if (!root) return null; return Array.prototype.filter.call(root.querySelectorAll("*"), function (e) { return !e.children.length && /^\\s*(de)?activate\\b/i.test(String(e.textContent || "")) && e.offsetParent !== null; }).length; }())'); };
  // The row of an app in a pane list: the smallest element holding its label and a button, or its label alone.
  const rowOf = function (label) { return '(function () { var all = document.querySelectorAll("#rows tr, #rows .list-row"); for (var i = 0; i < all.length; i++) { if (String(all[i].innerText || "").indexOf(' + JSON.stringify(label) + ') !== -1) return all[i]; } return null; }())'; };
  test.run('the world: Agent\'s row in the app list shows Activate', 0.2, async function () {
    if (!W2.up) return NO_PAGE;
    only = runs.filter(function (a) { return !own.filter(function (o) { return o.key === a.key; }).some(function (o) { return o.shell; }); });
    await chrome.evaluate('(function () { var c = document.createElement("div"); c.id = "rows"; document.body.appendChild(c); window.rows = spirit.element.spirit.element.search.app.create(c, { face: "pane" }); return true; }())');
    await until(function () { return activateUnder(rowOf(plain.label)).then(function (n) { return n > 0; }); }, 8000);
    return ((await activateUnder(rowOf(plain.label))) > 0) ? true : (plain.label + '\'s row shows no Activate: nothing judged');
  }, test.limit.slow);
  const rowNoActivate = async function (key) {
    if (!W2.up) return NO_PAGE;
    const a = byKey(only, key);
    if (!a) return key + ' is no app of node.run alone in this tree: nothing judged';
    // What it mounts is read from its <name>.json after the row is drawn: given the time that takes.
    await until(function () { return activateUnder(rowOf(a.label)).then(function (n) { return n === 0; }); }, 4000);
    const n = await activateUnder(rowOf(a.label));
    const held4 = n === 0;
    const why4 = a.label + '\'s row shows ' + short(n) + ' Activate buttons';
    return held4 ? true : why4;
  };
  test.run('Publish Data\'s row in the app list shows no Activate', 0.2, async function () {
    return rowNoActivate('publishData');
  }, test.limit.slow);
  test.run('Push Origin\'s row in the app list shows no Activate', 0.2, async function () {
    try {
      return await rowNoActivate('pushOrigin');
    } finally {
      if (W2.up) await chrome.evaluate('(function () { if (window.rows) window.rows.destroy(); var c = document.getElementById("rows"); if (c) c.remove(); return true; }())');
    }
  }, test.limit.slow);
  test.run('the world: Agent\'s detail shows Activate', 0.2, async function () {
    if (!W2.up) return NO_PAGE;
    await detailOf(plain);
    return (await until(function () { return activateUnder('document.getElementById("detail")').then(function (n) { return n > 0; }); }, 6000)) ? true : (plain.label + '\'s detail shows no Activate: nothing judged');
  }, test.limit.slow);
  const detailNoActivate = async function (key) {
    if (!W2.up) return NO_PAGE;
    const a = byKey(only, key);
    if (!a) return key + ' is no app of node.run alone in this tree: nothing judged';
    await detailOf(a);
    await until(function () { return chrome.evaluate('!!(' + runButton + ')'); }, 6000);
    await sleep(800);
    const n = await activateUnder('document.getElementById("detail")');
    const held3 = n === 0;
    const why3 = a.label + '\'s detail shows ' + short(n) + ' Activate buttons';
    return held3 ? true : why3;
  };
  test.run('Publish Data\'s detail shows no Activate', 0.2, async function () {
    return detailNoActivate('publishData');
  }, test.limit.slow);
  test.run('Push Origin\'s detail shows no Activate', 0.2, async function () {
    return detailNoActivate('pushOrigin');
  }, test.limit.slow);

  // a press runs it, active or not
  // Every job the node holds, each read whole, its module with it.
  const jobsOf = async function () { const got = await ask('job.search', { q: '' }); const out = []; for (const i of ((got && got.items) || [])) out.push(await ask('job.get', { key: i.key })); return JSON.stringify(out); };
  test.run('the world: no job of pushOrigin before the press', 0.2, async function () {
    if (!W2.up) return NO_PAGE;
    if (!PUSH || !PUSH.run) return 'pushOrigin says no node.run: nothing to press';
    const before = await jobsOf();
    return (before.indexOf('spirit.app.pushOrigin') === -1) ? true : ('a job of pushOrigin is there already: nothing judged');
  }, test.limit.quick);
  test.run('the world: pushOrigin is not active on this node', 0.2, async function () {
    if (!W2.up) return NO_PAGE;
    const activeNow = await ask('app.search', { q: '' });
    const pushRow = ((activeNow && activeNow.items) || []).filter(function (i) { return i.key === 'pushOrigin'; })[0];
    let pushActive;
    try { pushActive = JSON.parse(pushRow.label).active; } catch (e) { pushActive = undefined; }
    return (pushActive !== true) ? true : ('pushOrigin is active here: the press would not show that Run asks for no activation');
  }, test.limit.quick);
  test.run('its Run can be pressed', 0.2, async function () {
    if (!W2.up || !PUSH) return NO_PAGE;
    await detailOf(PUSH);
    await until(function () { return chrome.evaluate('!!(' + runButton + ')'); }, 6000);
    const pressed = await chrome.evaluate('(function () { var b = ' + runButton + '; if (!b) return false; b.click(); return true; }())');
    return (pressed === true) ? true : ('no Run to press');
  }, test.limit.slow);
  test.run('the press starts spirit/app/pushOrigin/pushOrigin.js, a job of spirit.app.pushOrigin, though the app is not active', 0.2, async function () {
    if (!W2.up || !PUSH) return NO_PAGE;
    const started = await until(function () { return jobsOf().then(function (j) { return j.indexOf('spirit.app.pushOrigin') !== -1; }); }, 10000);
    return (started) ? true : ('no job of pushOrigin after the press: ' + short(await jobsOf()));
  }, test.limit.slow);

  // Andy: "and the node should know it, too." Asked last, since a node that takes it would leave the app active.
  // Andy: "and the node should know it, too."
  const nodeRefuses = async function (key) {
    if (!W2.up) return NO_PAGE;
    const a = byKey(only, key);
    if (!a) return key + ' is no app of node.run alone in this tree: nothing judged';
    const r = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'app.active', args: { key: a.key, active: true } }) });
    const t = await r.text();
    const listed = await ask('app.search', { q: '' });
    const row = ((listed && listed.items) || []).filter(function (i) { return i.key === a.key; })[0];
    let now;
    try { now = JSON.parse(row.label).active; } catch (e) { now = undefined; }
    const held2 = r.status >= 400 && now !== true;
    const why2 = 'app.active for ' + a.key + ' answered ' + r.status + ' ' + short(t) + ', active now ' + short(now);
    return held2 ? true : why2;
  };
  test.run('the node refuses app.active for publishData, and it stays inactive', 0.2, async function () {
    return nodeRefuses('publishData');
  }, test.limit.quick);
  test.run('the node refuses app.active for pushOrigin, and it stays inactive', 0.2, async function () {
    return nodeRefuses('pushOrigin');
  }, test.limit.quick);
}

// ── THE shell PART ───────────────────────────────────────────────────────────────────────────────────────────
{
  // The shell part of ./element.js.
  // THE APP APP AS THE SHELL, AND A SHELL THAT REPLACES ITSELF (goal/G43.18, box v29, "The shell" and "Join"; spec: ./element.md, its shell section).
  // Since goal/G43.32 the shell app is the app app (the box: "spirit/app/shell/ becomes spirit/app/app/. Its element.js is today's
  // spirit/app/appSelector.js; shell.js goes. app.json is shell.json, renamed"). A real
  // node on a scratch copy of the tracked files, with a shell-worthy app of the test's own beside the shell app, and real
  // clicks in a real Chrome on the page Andy uses at home, /face.html. Neither Andy's node nor an agent's is touched.

  const os = require('os');
  const { spawn, execSync } = require('child_process');
  const REPO = path.resolve(RUN, '..', '..');
  const { freePort, until, sleep, chromePage, findChrome } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
  function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
  function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }

  // The test's own shell: it draws one line and nothing else, and knows nothing of Join.
  const MARK = 'zz shell drawn';
  const ZZ = { identity: { label: 'Zz Shell', icon: '🧪' }, shell: { true: true, mount: true, tile: true } };
  const ZZ_JS = '(function () { var b = document.createElement("div"); b.id = "zzShell"; b.textContent = ' + JSON.stringify(MARK) + '; document.body.appendChild(b); }());\n';
  function scratch() {
    const root = LABH.scratchTree().root;
    const run = path.join(root, 'spirit', 'run');
    const zz = path.join(run, 'spirit', 'app', 'zzshell');
    fs.mkdirSync(zz, { recursive: true });
    fs.writeFileSync(path.join(zz, 'zzshell.json'), JSON.stringify(ZZ));
    fs.writeFileSync(path.join(zz, 'element.js'), ZZ_JS);
    return { root: root, run: run };
  }
  async function call(base, verb, args) {
    try {
      const r = await fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
      const text = await r.text();
      return { status: r.status, text: text, body: parsed(text) };
    } catch (e) { return { status: 0, text: String(e && e.message), body: null }; }
  }
  async function boot(run) {
    const port = await freePort();
    const child = LABH.startNodeOn(run, port);
    const base = 'http://127.0.0.1:' + port;
    const up = await until(function () { return call(base, 'api').then(function (r) { return r.status === 200; }); }, 60000);
    return { child: child, base: base, up: !!up };
  }
  function stop(c) { return new Promise(function (r) { if (!c || c.exitCode !== null) return r(); c.once('exit', function () { r(); }); c.kill(); setTimeout(r, 6000); }); }

  // shell: the app app as the shell, and a shell that replaces itself (goal/G43.18, G43.32)
  const W3 = {};
  const NO_PAGE = 'no scratch node or no Chrome page: the world failed';
  let shellJson, SHELL_LABEL, LABELS, s, N, c;
  test.run('the world: the shell app has a label', 0.2, async function () {
    shellJson = readJson(path.join(RUN, 'spirit', 'app', 'app', 'app.json'));
    SHELL_LABEL = String((shellJson && shellJson.identity && shellJson.identity.label) || '');
    LABELS = fs.readdirSync(path.join(RUN, 'spirit', 'app')).map(function (n) { const j = readJson(path.join(RUN, 'spirit', 'app', n, n + '.json')); return j && j.identity && j.identity.label; }).filter(Boolean).concat([ZZ.identity.label]);
    return (!!SHELL_LABEL) ? true : ('spirit/app/app/app.json gives no label: ' + short(shellJson));
  }, test.limit.quick);
  test.run('the world: a scratch node comes up', 0.2, async function () {
    // The part before is done: its scratch node and Chrome stop here.
    stopAll();
    s = scratch();
    LIVE.push({ s: s });
    N = await boot(s.run);
    LIVE.push({ N: N });
    return (N.up) ? true : ('the scratch node did not come up: nothing judged');
  }, test.limit.slow);
  test.run('the world: a Chrome page', 0.2, async function () {
    if (!N || !N.up) return 'no scratch node: the world failed';
    const where = findChrome();
    if (!where) return 'no Chrome here: nothing judged';
    c = await chromePage(where);
    LIVE.push({ c: c });
    if (c.error) return 'Chrome: ' + c.error;
    W3.up = true;
    return true;
  }, test.limit.quick);
  const open = async function () {
    await c.evaluate('window.__zzOld = true').catch(function () {});
    await c.send('Page.navigate', { url: N.base + '/face.html' });
    const up = await until(function () { return c.evaluate('!window.__zzOld && document.readyState === "complete" && !!window.spirit'); }, 20000);
    await sleep(4000);
    return up;
  };
  const loaded = function () { return c.evaluate('performance.getEntriesByType("resource").map(function (e) { return e.name.replace(/^https?:\\/\\/[^/]+/, ""); })'); };
  const text = function () { return c.evaluate('String(document.body.innerText || "")'); };

  // the box: "spirit/app/shell/ ... is the default for home and face on a first boot" (Q12: no spirit/state/shell.json), the app app since goal/G43.32
  let first, drawn, second;
  test.run('the world: the page opens', 0.2, async function () {
    if (!W3.up) return NO_PAGE;
    W3.opened = !!(await open());
    return W3.opened || 'the page did not open: nothing judged';
  }, test.limit.long);
  test.run('with no shell chosen the page loads spirit/app/app/element.js', 0.2, async function () {
    if (!W3.opened) return NO_PAGE;
    first = await loaded();
    return (first.some(function (n) { return (/^\/spirit\/app\/app\/element\.js(\?|$)/).test(n); })) ? true : ('it loaded: ' + short(first.filter(function (n) { return (/\/app\//).test(n); })));
  }, test.limit.quick);
  test.run('"an app that wraps the app search": the app search is on the page, Contacts listed', 0.2, async function () {
    if (!first) return NO_PAGE;
    return (first.some(function (n) { return (/^\/spirit\/element\/search\/app\.js(\?|$)/).test(n); }) && /\bContacts\b/.test(await text())) ? true : ('the app search: ' + short(first.filter(function (n) { return (/search/).test(n); })) + ', page: ' + short(await text()));
  }, test.limit.quick);

  // goal/G43.18, Andy: "the shell should exclude itself completely from the app-list, haha..."
  test.run('Andy: "the shell should exclude itself completely from the app-list": Contacts listed, the shell not', 0.2, async function () {
    if (!W3.opened) return NO_PAGE;
    const keys = await c.evaluate('Array.prototype.slice.call(document.querySelectorAll("[data-key]")).filter(function (e) { return e.offsetParent !== null; }).map(function (e) { return e.getAttribute("data-key"); })');
    return (keys.indexOf('contact') !== -1 && keys.indexOf('app') === -1 && !new RegExp('(^|\\n)\\s*' + SHELL_LABEL + '\\s*(\\n|$)').test(await text())) ? true : ('the list shows: ' + short(keys));
  }, test.limit.quick);

  // the box: "RULE: a shell must be able to replace itself", "boot.js ... then loads the shell the node names"
  test.run('the world: node.shell names zzshell at home', 0.2, async function () {
    if (!W3.up) return NO_PAGE;
    const set = await call(N.base, 'node.shell', { at: 'home', name: 'zzshell' });
    return (set.status === 200) ? true : ('node.shell: ' + set.status + ' ' + short(set.text));
  }, test.limit.quick);
  test.run('the page loads the shell the node names, zzshell, and it draws', 0.2, async function () {
    if (!W3.up) return NO_PAGE;
    await open();
    second = await loaded();
    drawn = await text();
    return (drawn.indexOf(MARK) !== -1 && second.some(function (n) { return (/^\/spirit\/app\/zzshell\/element\.js(\?|$)/).test(n); })) ? true : ('zzshell: ' + short(second.filter(function (n) { return (/\/app\//).test(n); })) + ', page: ' + short(drawn));
  }, test.limit.long);
  test.run('and nothing of the other shell, nor a desktop of boot.js\'s own', 0.2, async function () {
    if (!second) return NO_PAGE;
    return (drawn.indexOf(MARK) !== -1 && !second.some(function (n) { return (/^\/spirit\/app\/app\/element\.js(\?|$)/).test(n); }) && !/\bContacts\b/.test(drawn)) ? true : (drawn.indexOf(MARK) !== -1 ? 'beside zzshell the page shows: ' + short(drawn) : 'zzshell never drew: nothing judged');
  }, test.limit.quick);

  // Q18, Andy: "join. not the shells job.": zzshell knows nothing of Join, and Join still shows a new node its steps.
  // the box: "Join shows a new user its steps on its own ... neither boot.js nor any shell decides it"
  test.run('under a shell that knows nothing of it, Join shows itself', 0.2, async function () {
    if (!second) return NO_PAGE;
    const steps = await call(N.base, 'job.list', {});
    // The scratch node is new: its join steps are open.
    const joined = drawn.indexOf(MARK) !== -1 && await until(function () { return text().then(function (t) { return (/\bJoin\b/).test(t); }); }, 10000);
    return (joined) ? true : (drawn.indexOf(MARK) !== -1 ? 'under zzshell no Join in 10 s: ' + short(await text()) : 'zzshell never drew: nothing judged');
  }, test.limit.long);

  // the box: the two rows of the app detail, "shown only for an app whose <name>.json says shell:true:true"
  const detail = function (key) {
    return c.evaluate('(function () { return spirit.ready.then(function (s) { return s.app.searchApp({ q: "" }); }).then(function (got) { var it = (got.items || []).filter(function (i) { return i.key === ' + JSON.stringify(key) + '; })[0]; if (!it) return "no row"; var row = Object.assign({ key: it.key }, JSON.parse(it.label || "{}")); return spirit.require("spirit/element/search/app/detailElement.js").then(function () { var old = document.getElementById("zzDetail"); if (old) old.remove(); var h = document.createElement("div"); h.id = "zzDetail"; document.body.appendChild(h); spirit.element.spirit.element.search.app.detailElement.create(h, { row: row, panel: true }); return "made"; }); }); }())');
  };
  const inDetail = function () { return c.evaluate('String((document.getElementById("zzDetail") || {}).innerText || "")'); };
  test.run('the world: Contacts\' detail is drawn', 0.2, async function () {
    if (!W3.up) return NO_PAGE;
    await call(N.base, 'node.shell', { at: 'home', name: 'app' });
    await open();
    return ((await detail('contact')) === 'made') ? true : ('no detail for contact');
  }, test.limit.long);
  test.run('Contacts, shell:true false: no Home shell or Face shell row', 0.2, async function () {
    if (!W3.up) return NO_PAGE;
    await sleep(2000);
    const plain = await inDetail();
    return (plain.length > 0 && !/Home shell|Face shell/.test(plain)) ? true : ('Contacts\' detail: ' + short(plain));
  }, test.limit.slow);
  test.run('the world: zzshell\'s detail is drawn', 0.2, async function () {
    if (!W3.up) return NO_PAGE;
    return ((await detail('zzshell')) === 'made') ? true : ('no detail for zzshell');
  }, test.limit.quick);
  test.run('zzshell, shell:true true: a Home shell and a Face shell row', 0.2, async function () {
    if (!W3.up) return NO_PAGE;
    await sleep(2000);
    const worthy = await inDetail();
    return (/Home shell/.test(worthy) && /Face shell/.test(worthy)) ? true : ('zzshell\'s detail: ' + short(worthy));
  }, test.limit.slow);
  // "the dropdown first showing the configured home shell": the shell app, by Q12 and as set back above.
  const rowText = function (words) { return c.evaluate('(function () { var d = document.getElementById("zzDetail"); var all = Array.prototype.slice.call(d.querySelectorAll("*")); var r = all.filter(function (e) { return e.children.length && String(e.innerText || "").indexOf(' + JSON.stringify(words) + ') !== -1; }).pop(); r = r && (r.closest(".shell-row-form") || r); if (!r) return ""; var i = r.querySelector("input"); return String(r.innerText || "") + " | " + (i ? i.value : ""); }())'); };
  test.run('its Home shell dropdown first shows the configured home shell, Shell', 0.2, async function () {
    if (!W3.up) return NO_PAGE;
    const homeRow = await rowText('Home shell');
    return (!!SHELL_LABEL && /Home shell/.test(homeRow) && homeRow.indexOf(SHELL_LABEL) !== -1 && homeRow.indexOf(ZZ.identity.label) === -1) ? true : ('the Home shell row: ' + short(homeRow));
  }, test.limit.quick);

  // the box: "Both dropdowns list only the apps whose <name>.json says shell:true:true"
  const listsShells = async function (words) {
    if (!W3.up) return NO_PAGE;
    try {
      const opened = await c.evaluate('(function () { var d = document.getElementById("zzDetail"); var all = Array.prototype.slice.call(d.querySelectorAll("*")); var r = all.filter(function (e) { return e.children.length && String(e.innerText || "").indexOf(' + JSON.stringify(words) + ') !== -1; }).pop(); r = r && (r.closest(".shell-row-form") || r); var i = r && r.querySelector("input"); if (!i) return false; i.focus(); i.click(); i.dispatchEvent(new Event("input", { bubbles: true })); return true; }())');
      await sleep(1500);
      // What the dropdown lists: the labels inside that row, its own field and title aside.
      const seen = parsed(await c.evaluate('JSON.stringify((function () { var want = ' + JSON.stringify(LABELS) + '; var out = []; var d = document.getElementById("zzDetail"); var all = Array.prototype.slice.call(d.querySelectorAll("*")); var r = all.filter(function (e) { return e.children.length && String(e.innerText || "").indexOf(' + JSON.stringify(words) + ') !== -1; }).pop(); r = r && (r.closest(".shell-row-form") || r); Array.prototype.slice.call(r ? r.querySelectorAll("[data-key] td, li") : []).forEach(function (e) { var t = String(e.innerText || "").trim(); if ( e.offsetParent !== null && want.indexOf(t) !== -1 && out.indexOf(t) === -1) out.push(t); }); return out.sort(); }()))')) || [];
      const others = seen.filter(function (l) { return l !== SHELL_LABEL && l !== ZZ.identity.label; });
      // Q28, Andy: "no, the shell icon is now properly missing :)": the shell app leaves itself out here too.
      const held1 = opened && seen.indexOf(ZZ.identity.label) !== -1 && seen.indexOf(SHELL_LABEL) === -1 && !others.length;
      const why1 = words + ': opened ' + opened + ', it lists ' + short(seen);
      return held1 ? true : why1;
    } finally {
      await c.evaluate('document.body.click(); true');
    }
  };
  test.run('Home shell: open, it lists Zz Shell, not Shell (Q28), and no app that is no shell', 0.2, async function () {
    return listsShells('Home shell');
  }, test.limit.slow);
  test.run('Face shell: open, it lists Zz Shell, not Shell (Q28), and no app that is no shell', 0.2, async function () {
    return listsShells('Face shell');
  }, test.limit.slow);

  // the box: "[armingButton-'Set']" and node.shell
  test.run('zzshell chosen in Home shell, Set armed by the first press and pressed again', 0.2, async function () {
    if (!W3.up) return NO_PAGE;
    const chose = await c.evaluate('(function () { var d = document.getElementById("zzDetail"); var all = Array.prototype.slice.call(d.querySelectorAll("*")); var r = all.filter(function (e) { return e.children.length && String(e.innerText || "").indexOf("Home shell") !== -1; }).pop(); r = r && (r.closest(".shell-row-form") || r); var i = r && r.querySelector("input"); if (!i) return "no field"; i.focus(); i.click(); i.value = "Zz"; i.dispatchEvent(new Event("input", { bubbles: true })); return new Promise(function (res) { setTimeout(function () { var hit = Array.prototype.slice.call(document.querySelectorAll("*")).filter(function (e) { return !e.children.length && e.offsetParent !== null && String(e.innerText || "").trim() === ' + JSON.stringify(ZZ.identity.label) + '; })[0]; if (!hit) return res("no row"); hit.click(); setTimeout(function () { var b = Array.prototype.slice.call(r.querySelectorAll("button")).filter(function (x) { return /^Set\\b/.test(String(x.textContent).trim()); })[0]; if (!b) return res("no Set"); b.click(); setTimeout(function () { var armed = b.hasAttribute("data-armed"); b.click(); res(armed ? "pressed twice" : "not armed"); }, 300); }, 500); }, 1500); }); }())');
    return (chose === 'pressed twice') ? true : ('the Home shell row: ' + short(chose));
  }, test.limit.slow);
  test.run('and the node names zzshell at home', 0.2, async function () {
    if (!W3.up) return NO_PAGE;
    return (await until(function () { return call(N.base, 'node.shell', { at: 'home' }).then(function (a) { return a.body && a.body.name === 'zzshell'; }); }, 6000)) ? true : ('node.shell home: ' + short(await call(N.base, 'node.shell', { at: 'home' })));
  }, test.limit.slow);
  test.run('the face shell is its own, still app', 0.2, async function () {
    if (!W3.up) return NO_PAGE;
    return ((await call(N.base, 'node.shell', { at: 'face' })).body.name === 'app') ? true : ('node.shell face: ' + short(await call(N.base, 'node.shell', { at: 'face' })));
  }, test.limit.quick);
}
