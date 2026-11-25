'use strict';

// spirit/run/spirit/element/test/script.js
// One file for every test of its script (Andy: "there is ONE FUCKING test file in the test folder per script file, and every fucking
// test that applies to that file must be inserted in the that one file"; spirit/test/TEST_SYSTEM.md): each part below is its own
// section at the end: nodeRun, shell.
// The tests of spirit/element/script.js, the one shell and app selector, and of no other module (spec: ./script.md; goal/G43.2;
// moved from spirit/element/script.js by goal/G49.4).
// Since goal/G43.32 the app app's main element (it was spirit/app/appSelector.js). A real Chrome on a
// scratch node's face page; neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
// Every node this test uses is one of lab's (goal/G47.3): its tree by scratchTree, its node by startNodeOn.
const LABH = LOADER.requireScript('spirit/test/headLessChrome.js');
const test = LOADER.requireScript('spirit/test/testReport.js');
const { scratchNode, chromePage, findChrome, until } = LOADER.requireScript('spirit/test/headLessChrome.js');

// One test.run per test (goal/G47.2): the three parts below run one after the other, each its own scratch node and Chrome,
// each stopped when the next part's world starts, and all of them again at the end (test.after).
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
const FILE = path.join(RUN, 'spirit', 'element', 'script.js');
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
  let identity, node, chrome;
  test.run('a scratch node comes up with an app of the test\'s own, and Chrome opens its face page for the selector', 0.2, async function () {
    if (!fs.existsSync(FILE)) return false;
    identity = JSON.parse(fs.readFileSync(path.join(RUN, 'spirit', 'app', 'starter', 'starter.json'), 'utf8')).identity;
    // An app the user switches, not intrinsic, a face and no server: Starter, since Andy deleted the server app (25a95142, "delete dummy app").
    node = await scratchNode();
    chrome = await chromePage(findChrome());
    LIVE.push({ node: node, chrome: chrome });
    if (!node.up || chrome.error) return false;
    // AN APP THE USER SWITCHES, OF THIS TEST'S OWN (goal/G43.15): Monitor was it until Andy's 7f6ebbbe made it intrinsic, so always on. A copy
    // of its json as it was then, and its script, planted on the scratch node's disc; the app family reads the disc.
    if (!node.root) return false;
    const zz = path.join(node.root, 'spirit', 'run', 'spirit', 'app', 'hearing');
    fs.mkdirSync(zz, { recursive: true });
    fs.writeFileSync(path.join(zz, 'hearing.json'), JSON.stringify({ identity: { icon: '🦻', label: 'Hearing', intrinsic: false }, mount: { 'element.js': true }, shell: { true: false, mount: true, tile: true }, node: { mount: false } }, null, 2));
    // Monitor's main element, placed at the planted app's own path, as a tile asks for it (goal/G43.32, rule 4).
    fs.writeFileSync(path.join(zz, 'element.js'), fs.readFileSync(path.join(RUN, 'spirit', 'app', 'monitor', 'element.js'), 'utf8').split('spirit/app/monitor/element.js').join('spirit/app/hearing/element.js'));
    await chrome.send('Page.navigate', { url: node.base + '/' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.readyPromise)'); }, 20000);
    W1.up = true;
    return true;
  }, test.limit.long);
  let made, text;
  test.run('it loads through spirit.requireScript and mounts as a pane', 0.2, async function () {
    if (!W1.up) return false;
    made = await chrome.evaluate('window.spirit.readyPromise.then(function () { return spirit.requireScript("spirit/element/script.js"); }).then(function () {' +
      ' var c = document.createElement("div"); c.id = "under-test"; document.body.appendChild(c); window.changes = 0;' +
      ' window.sel = spirit.required.spirit.element.create(c, { face: "pane" }); if (window.sel.parentNode !== c) c.appendChild(window.sel); window.sel.addEventListener("change", function () { window.changes += 1; }); return "made"; }, function () { return false; })');
    return (made === 'made') ? true : false;
  }, test.limit.quick);
  text = function () { return chrome.evaluate('String((document.getElementById("under-test") || {}).innerText || "")'); };
  test.run('the list shows starter\'s label', 0.2, async function () {
    if (!W1.up) return false;
    const found = await until(function () { return text().then(function (t) { return t.indexOf(identity.label) !== -1; }); }, 8000);
    return (found) ? true : false;
  }, test.limit.slow);
  test.run('the list shows its icon', 0.2, async function () {
    if (!W1.up) return false;
    const html = await chrome.evaluate('String((document.getElementById("under-test") || {}).innerHTML || "")');
    return (html.indexOf(identity.icon) !== -1 || /<svg|<img/.test(html)) ? true : false;
  }, test.limit.quick);
  test.run('the row shows icon and label and nothing else', 0.2, async function () {
    if (!W1.up) return false;
    // ONLY ICON AND LABEL (Andy, box): what is left of the row once those two are taken out is nothing.
    const rowText = await chrome.evaluate('(function () { var want = ' + JSON.stringify(identity.label) + '; var all = document.getElementById("under-test").querySelectorAll("*"); var outside = function (e) { var c = e.cloneNode(true); [].forEach.call(c.querySelectorAll(".shell-row-form, button"), function (b) { b.remove(); }); return c.textContent; }; var best = null; for (var i = 0; i < all.length; i++) { if (all[i].children.length && !all[i].closest(".shell-row-form") && outside(all[i]).indexOf(want) !== -1) best = all[i]; } if (!best) return ""; return outside(best); }())');
    const rest = String(rowText).split(identity.label).join('').split(identity.icon).join('').trim();
    return (rowText !== '' && rest === '') ? true : false;
  }, test.limit.quick);

  // A PRESS PICKS, AND SHOWS ITS DETAIL.
  test.run('its row can be pressed', 0.2, async function () {
    if (!W1.up) return false;
    const pressed = await chrome.evaluate('(function () { var want = ' + JSON.stringify(identity.label) + '; var all = document.getElementById("under-test").querySelectorAll("*"); var hit = null; for (var i = 0; i < all.length; i++) { if (String(all[i].innerText || "").trim() && String(all[i].innerText).indexOf(want) !== -1 && !all[i].children.length) hit = all[i]; } if (!hit) return false; hit.click(); return true; }())');
    return (pressed === true) ? true : false;
  }, test.limit.quick);
  test.run('a press sets value and row, and says change', 0.2, async function () {
    if (!W1.up) return false;
    const picked = await until(function () { return chrome.evaluate('window.changes >= 1 && !!window.sel.row && window.sel.value !== ""'); }, 3000);
    return (picked) ? true : false;
  }, test.limit.slow);
  test.run('a press shows that app\'s detail', 0.2, async function () {
    if (!W1.up) return false;
    const detail = await until(function () { return chrome.evaluate('(function () { var h = document.querySelector("#under-test .app-container .shell-row-form"); return !!(spirit.required.spirit.element.search.app.detail) && !!h && String(h.textContent).indexOf(' + JSON.stringify(identity.label) + ') !== -1; }())'); }, 3000);
    return (detail) ? true : false;
  }, test.limit.slow);

  test.run('typed words that fit nothing rank it at nothing: the shared list cuts no row', 0.2, async function () {
    if (!W1.up) return false;
    await chrome.evaluate('(function () { var c = document.querySelector("#under-test .app-container-close"); if (c) c.click(); return !!c; }())');
    // THE WORDS.
    await chrome.evaluate('(function () { var i = document.querySelector("#under-test input"); if (!i) return; i.value = "zzqqxxvvkk"; i.dispatchEvent(new Event("input", { bubbles: true })); }())');
    const ranked = await until(function () { return chrome.evaluate('(function () { var b = document.querySelector("#under-test .list-rank div div"); return !!b && b.style.width === "0%"; }())'); }, 4000);
    return (ranked) ? true : false;
  }, test.limit.slow);

  // WHO PAINTS, LISTENS (Andy, G41.32): "every row's data ... must update instantly".
  test.run('a change on the disk paints on the page, no reload', 0.2, async function () {
    if (!W1.up) return false;
    await chrome.evaluate('(function () { var i = document.querySelector("#under-test input"); if (!i) return; i.value = ""; i.dispatchEvent(new Event("input", { bubbles: true })); }())');
    await until(function () { return text().then(function (t) { return t.indexOf(identity.label) !== -1; }); }, 4000);
    const disk = path.join(node.root, 'spirit', 'run', 'spirit', 'app', 'starter', 'starter.json');
    const was = JSON.parse(fs.readFileSync(disk, 'utf8'));
    was.identity.label = 'Changed On Disk';
    fs.writeFileSync(disk, JSON.stringify(was));
    const follows = await until(function () { return text().then(function (t) { return t.indexOf('Changed On Disk') !== -1; }); }, 8000);
    return (follows) ? true : false;
  }, test.limit.slow);
  test.run('the open detail paints the change as well', 0.2, async function () {
    if (!W1.up) return false;
    // THE DETAIL OPEN IS PAINTED TOO (Andy, G41.32: "wherever it's visible"): it is the row element's own watch that does it, which no list redraw covers.
    await chrome.evaluate('(function () { var all = document.querySelectorAll("#under-test tr, #under-test .list-row"); for (var i = 0; i < all.length; i++) if (String(all[i].textContent).indexOf("Changed On Disk") !== -1) { all[i].click(); return true; } return false; }())');
    const both = await until(function () { return chrome.evaluate('(function () { var h = document.querySelector("#under-test .app-container .shell-row-form"); return !!h && String(h.textContent).indexOf("Changed On Disk") !== -1; }())'); }, 8000);
    return (both) ? true : false;
  }, test.limit.slow);
  test.run('destroy empties its container', 0.2, async function () {
    if (!W1.up) return false;
    await chrome.evaluate('(function () { var c = document.querySelector("#under-test .app-container-close"); if (c) c.click(); return !!c; }())');
    const empty = await chrome.evaluate('(function () { window.sel.destroy(); return document.getElementById("under-test").children.length === 0; }())');
    return (empty === true) ? true : false;
  }, test.limit.quick);

  // ── ONE appSelector, THREE FACES (goal/G43.9) ──
  {
  // the box: "spirit/app/appTiles.js will be removed." "spirit.app.appTiles() will be removed."
  test.run('spirit/app/appTiles.js is gone', 0.2, async function () {
    return (!fs.existsSync(path.join(RUN, 'spirit', 'app', 'appTiles.js'))) ? true : false;
  }, test.limit.quick);
  test.run('spirit.app.appTiles is gone from the page', 0.2, async function () {
    if (!W1.up) return false;
    return (await chrome.evaluate('!(window.spirit.app && window.spirit.app.appTiles)') === true) ? true : false;
  }, test.limit.quick);
  const monitorLabel = 'Hearing';
  const serverLabel = 'Changed On Disk';
  const mount = function (opts) { return chrome.evaluate('(function () { var old = document.getElementById("faces"); if (old) old.remove(); var c = document.createElement("div"); c.id = "faces"; c.style.cssText = "position:fixed;left:0;top:0;width:900px;height:600px;display:flex;flex-direction:column;background:#111"; document.body.appendChild(c); window.fs = spirit.required.spirit.element.create(c, ' + JSON.stringify(opts) + '); if (window.fs.parentNode !== c) c.appendChild(window.fs); return true; }())'); };
  const inFaces = function () { return chrome.evaluate('String((document.getElementById("faces") || {}).innerText || "")'); };
  const rowOf = function (label) { return '(function () { var all = document.querySelectorAll("#faces tr, #faces .list-row"); for (var i = 0; i < all.length; i++) if (String(all[i].textContent).indexOf(' + JSON.stringify(label) + ') !== -1) return all[i]; return null; }())'; };
  const tileOf = function (label) { return 'Array.prototype.filter.call(document.querySelectorAll("#faces .app-icon"), function (t) { return t.offsetParent !== null && String(t.textContent).indexOf(' + JSON.stringify(label) + ') !== -1; })[0]'; };
  const stateFile = function (k) { return path.join(node.root, 'spirit', 'run', 'spirit', 'state', k, 'node.json'); };
  let both, said, written, rowActive, flipped;

  // the box: "in :pane mode (list) i want to see a list of all rows, activated AND deactivated, with the (de)activate buttons at the end of each row."
  test.run('the pane lists both test apps, neither of them active', 0.2, async function () {
    if (!W1.up) return false;
    await mount({ face: 'pane', toggle: true });
    both = await until(function () { return inFaces().then(function (t) { return t.indexOf(monitorLabel) !== -1 && t.indexOf(serverLabel) !== -1; }); }, 8000);
    return (both) ? true : false;
  }, test.limit.slow);
  const buttonOf = function (label) { return 'var r = ' + rowOf(label) + '; if (!r) return false; var bs = r.querySelectorAll("button"); if (bs.length !== 1) return false; var b = bs[0]; var all = r.querySelectorAll("*"); var last = null; for (var i = 0; i < all.length; i++) { if (all[i].getClientRects().length && !all[i].children.length) last = all[i]; } if (!(last === b || b.contains(last))) return false; '; };
  // The switch's words, which stand beside its 🟢/🔴 button (rowFormAppActive, goal/G43.15).
  const says = function (label) { return chrome.evaluate('(function () { ' + buttonOf(label) + 'var w = r.querySelector(".shell-row-form-span"); return (w || b).textContent.trim(); }())'); };
  test.run('each row ends in its one button, which says Activate', 0.2, async function () {
    if (!W1.up) return false;
    said = await until(function () { return says(monitorLabel).then(function (t) { return /^activate\b/i.test(t); }); }, 8000);
    return (said) ? true : false;
  }, test.limit.slow);
  // the box: "The node writes spirit/state/<key>/node.json and republishes its 'apps' job, whose rows gain active. The list follows by itself."
  test.run('a press writes active true to spirit/state/hearing/node.json', 0.2, async function () {
    if (!W1.up) return false;
    await chrome.evaluate('(function () { var r = ' + rowOf(monitorLabel) + '; var b = r && r.querySelector("button"); if (b) b.click(); return !!b; }())');
    written = await until(function () { return Promise.resolve((function () { try { return JSON.parse(fs.readFileSync(stateFile('hearing'), 'utf8')).active === true; } catch (e) { return false; } }())); }, 5000);
    return (written) ? true : false;
  }, test.limit.slow);
  test.run('the stream brings active to the row without a search being asked', 0.2, async function () {
    if (!W1.up) return false;
    rowActive = await until(function () { return chrome.evaluate('(function () { var r = spirit.required.spirit.data.app.data.rows().hearing; return !!r && r.active === true; }())'); }, 5000);
    return (rowActive) ? true : false;
  }, test.limit.slow);
  test.run('the button follows and says Deactivate', 0.2, async function () {
    if (!W1.up) return false;
    flipped = await until(function () { return says(monitorLabel).then(function (t) { return /^deactivate\b/i.test(t); }); }, 5000);
    return (flipped) ? true : false;
  }, test.limit.slow);
  test.run('a search seated over it does not lose active', 0.2, async function () {
    if (!W1.up) return false;
    await chrome.evaluate('spirit.required.spirit.app.api.searchApp({ q: "" }).then(function (got) { spirit.required.spirit.data.seatRows(spirit.required.spirit.data.app.data.branch, got.items); return true; })');
    return (await chrome.evaluate('(function () { var r = spirit.required.spirit.data.app.data.rows().hearing; return !!r && r.active === true; }())') === true) ? true : false;
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
  test.run('a pick in the pane opens the detail panel', 0.2, async function () {
    if (!W1.up) return false;
    await openPanel();
    up = await until(function () { return chrome.evaluate('!!' + panel); }, 5000);
    return (up) ? true : false;
  }, test.limit.slow);
  test.run('it covers the whole container, and the list is out of sight', 0.2, async function () {
    if (!W1.up) return false;
    covers = await chrome.evaluate('(function () { var p = ' + panel + '; if (!p) return false; var a = p.getBoundingClientRect(), b = document.getElementById("faces").getBoundingClientRect(); if (Math.abs(a.width - b.width) > 2 || Math.abs(a.height - b.height) > 2) return false; var r = ' + rowOf(monitorLabel) + '; return r && r.offsetParent !== null ? false : "covers"; }())');
    return (covers === 'covers') ? true : false;
  }, test.limit.quick);
  // Each form of the panel, in order: its icon, its words, its input's value, its button.
  const clean = function (t) { return String(t).replace(/\s+/g, ' ').trim(); };
  const forms = async function () { const j = await chrome.evaluate('JSON.stringify([].map.call([].filter.call(((' + panel + ') || document.createElement("div")).querySelectorAll(".shell-row-form"), function (f) { return f.getBoundingClientRect().height > 0; }), function (f) { var sp = f.querySelector(".shell-row-form-span"); var bs = f.querySelectorAll("button"); var last = bs[bs.length - 1]; var inp = f.querySelector("input"); var ic = f.firstElementChild; return { icon: ic ? ic.textContent : "", words: sp ? sp.textContent : "", input: inp ? inp.value : null, button: last ? last.textContent : "", lastIsButton: !!last && f.lastElementChild === last }; }))'); return (JSON.parse(j) || []).map(function (x) { x.icon = clean(x.icon); x.words = clean(x.words); x.button = clean(x.button); return x; }); };
  const press = function (n) { return chrome.evaluate('(function () { var f = [].filter.call(((' + panel + ') || document.createElement("div")).querySelectorAll(".shell-row-form"), function (f) { return f.getBoundingClientRect().height > 0; })[' + n + ']; var b = f && f.querySelectorAll("button"); var last = b && b[b.length - 1]; if (last) last.click(); return !!last; }())'); };
  const stateOf = function () { try { return JSON.parse(fs.readFileSync(stateFile('hearing'), 'utf8')); } catch (e) { return {}; } };
  let disk, fileBefore;
  const waitForm = function (n, test2) { return until(function () { return forms().then(function (l) { return !!l[n] && test2(l[n]); }); }, 5000); };

  // "titlebar rowForm: [app-icon] "<app-label> [x]"
  test.run('the panel shows the title bar and three forms', 0.2, async function () {
    if (!W1.up) return false;
    disk = path.join(node.root, 'spirit', 'run', 'spirit', 'app', 'hearing', 'hearing.json');
    fileBefore = fs.readFileSync(disk, 'utf8');
    l = await forms();
    // Four: the Allow row went (goal/G43.18, box v29).
    return (l.length === 4) ? true : false;
  }, test.limit.quick);
  const none = { icon: '', words: '', button: '', input: null, lastIsButton: false };
  test.run('the title bar shows the app\'s icon and label', 0.2, async function () {
    if (!l) return false;
    bar = l[0] || none;
    return (bar.icon.indexOf('🦻') !== -1 && bar.words === monitorLabel) ? true : false;
  }, test.limit.quick);
  test.run('its last element is the x', 0.2, async function () {
    if (!bar) return false;
    return (bar.lastIsButton && /^[x✕×]$/i.test(bar.button)) ? true : false;
  }, test.limit.quick);

  // "row 0: rowForm: [✏️] "Icon" [iconSelector:dropdown] [Change]"
  test.run('the first form shows the pencil, the word Icon and a Change button', 0.2, async function () {
    if (!l) return false;
    r0 = l[1] || none;
    return (r0.icon.indexOf('✏') !== -1 && r0.words.indexOf('Icon') !== -1 && r0.button === 'Change') ? true : false;
  }, test.limit.quick);
  test.run('the selector shows the app\'s icon', 0.2, async function () {
    if (!r0) return false;
    return (r0.words.indexOf('🦻') !== -1) ? true : false;
  }, test.limit.quick);
  test.run('a changed icon reaches the bar, by the stream', 0.2, async function () {
    if (!W1.up) return false;
    await chrome.evaluate('spirit.required.spirit.app.api.iconApp({ key: "hearing", icon: "🧪" }).then(function () { return true; }, function () { return false; })');
    newIcon = await until(function () { return forms().then(function (x) { return !!x[0] && x[0].icon.indexOf('🧪') !== -1; }); }, 5000);
    return (newIcon) ? true : false;
  }, test.limit.slow);
  test.run('it lands in spirit/state/hearing/node.json', 0.2, async function () {
    return (stateOf().icon === '🧪') ? true : false;
  }, test.limit.quick);
  test.run('the changed icon is not written to hearing.json', 0.2, async function () {
    if (!disk) return false;
    return (fs.readFileSync(disk, 'utf8') === fileBefore) ? true : false;
  }, test.limit.quick);

  // "row 1: rowForm: [✏️] "Label" [label input box] [Change]"
  test.run('the second form shows the pencil, the word Label, the box holding the label and a Change button', 0.2, async function () {
    if (!W1.up) return false;
    await chrome.evaluate('spirit.required.spirit.app.api.iconApp({ key: "hearing", icon: "🦻" }).then(function () { return true; }, function () { return false; })');
    await until(function () { return forms().then(function (x) { return !!x[0] && x[0].icon.indexOf('🦻') !== -1; }); }, 5000);
    r1 = l[2] || none;
    return (r1.icon.indexOf('✏') !== -1 && r1.words.indexOf('Label') !== -1 && r1.input === monitorLabel && r1.button === 'Change') ? true : false;
  }, test.limit.slow);

  // row 2: "if active: [🟢] "Deactivate <app-label> "face" ..." [🔴]", "if inactive: [🔴] "Activate ..." [🟢]"
  // The words name what it mounts, read from hearing.json after the row is drawn: judged once that read has had its time,
  // as the rows below are, not on the panel's first look (goal/G43.32, the panel now opens before the read answers).
  const r2ok = function (x) { return x.icon.indexOf('🟢') !== -1 && x.words === 'Deactivate ' + monitorLabel + ' face' && x.button === '🔴'; };
  test.run('with Hearing active and mounting a face only, the third form shows 🟢, the words Deactivate Hearing face, and 🔴', 0.2, async function () {
    if (!W1.up) return false;
    r2seen = await waitForm(3, r2ok);
    r2 = (await forms())[3] || none;
    return (r2seen && r2ok(r2)) ? true : false;
  }, test.limit.slow);
  test.run('a press turns the third form to 🔴, the words Activate Hearing face, and 🟢, and writes active false to node.json', 0.2, async function () {
    if (!W1.up) return false;
    await press(3);
    wentOff = await waitForm(3, function (x) { return x.icon.indexOf('🔴') !== -1 && x.words === 'Activate ' + monitorLabel + ' face' && x.button === '🟢'; });
    return (wentOff && stateOf().active === false) ? true : false;
  }, test.limit.slow);
  test.run('a press back turns it on', 0.2, async function () {
    if (!W1.up) return false;
    await press(3);
    wentOn = await waitForm(3, function (x) { return x.words === 'Deactivate ' + monitorLabel + ' face'; });
    return (wentOn && stateOf().active === true) ? true : false;
  }, test.limit.slow);

  // Row 3, the Allow row, went (goal/G43.18, box v29: "the Allow row of the app detail and its element ... are deleted").
  // goal/G43.18: no Allow row: "<name>.json alone says whether an app may be a shell"
  test.run('no row says Allow or Don\'t allow as shell', 0.2, async function () {
    if (!l) return false;
    return (!l.slice(1).some(function (x) { return /allow .* as shell/i.test(x.words || ''); })) ? true : false;
  }, test.limit.quick);

  // Q4: a changed label goes in node.json, and every row follows
  test.run('Change writes label to spirit/state/hearing/node.json', 0.2, async function () {
    if (!W1.up) return false;
    await chrome.evaluate('(function () { var f = [].filter.call(((' + panel + ') || document.createElement("div")).querySelectorAll(".shell-row-form"), function (f) { return f.getBoundingClientRect().height > 0; })[2]; var i = f && f.querySelector("input"); if (!i) return false; i.value = "Renamed"; i.dispatchEvent(new Event("input", { bubbles: true })); return true; }())');
    await press(2);
    renamed = await until(function () { return Promise.resolve(stateOf().label === 'Renamed'); }, 5000);
    return (renamed) ? true : false;
  }, test.limit.slow);
  test.run('the changed label is not written to hearing.json', 0.2, async function () {
    if (!disk) return false;
    return (fs.readFileSync(disk, 'utf8') === fileBefore) ? true : false;
  }, test.limit.quick);
  test.run('the stream brings the new label to the row', 0.2, async function () {
    if (!W1.up) return false;
    inRow = await until(function () { return chrome.evaluate('(function () { var r = spirit.required.spirit.data.app.data.rows().hearing; return !!r && r.label === "Renamed"; }())'); }, 5000);
    return (inRow) ? true : false;
  }, test.limit.slow);
  test.run('the title bar and the rows of the panel say the new label', 0.2, async function () {
    if (!W1.up) return false;
    follows = await until(function () { return forms().then(function (x) { return !!x[0] && !!x[3] && x[0].words === 'Renamed' && x[3].words === 'Deactivate Renamed face'; }); }, 5000);
    return (follows) ? true : false;
  }, test.limit.slow);
  test.run('the app itself does not open', 0.2, async function () {
    if (!W1.up) return false;
    await chrome.evaluate('(function () { var f = [].filter.call(((' + panel + ') || document.createElement("div")).querySelectorAll(".shell-row-form"), function (f) { return f.getBoundingClientRect().height > 0; })[2]; var i = f && f.querySelector("input"); if (!i) return false; i.value = ' + JSON.stringify(monitorLabel) + '; i.dispatchEvent(new Event("input", { bubbles: true })); return true; }())');
    await press(2);
    await until(function () { return Promise.resolve(stateOf().label === monitorLabel); }, 5000);
    await until(function () { return chrome.evaluate('(function () { var r = spirit.required.spirit.data.app.data.rows().hearing; return !!r && r.label === ' + JSON.stringify(monitorLabel) + '; }())'); }, 5000);
    return (!/Uptime|waiting/i.test(await chrome.evaluate('String((' + panel + ' || {}).innerText || "")'))) ? true : false;
  }, test.limit.slow);
  test.run('its x brings the list back', 0.2, async function () {
    if (!W1.up) return false;
    const shut = await closePanel();
    backAgain = shut && await until(function () { return chrome.evaluate('(function () { var r = ' + rowOf(monitorLabel) + '; return !!r && r.offsetParent !== null; }())'); }, 4000);
    return (backAgain) ? true : false;
  }, test.limit.slow);

  // ""face" only displays if shell.mount==true", ""server" only displays if node.mount==true", ""and" is only displayed of both are true"
  const rewrite = function (shellMount, nodeMount) { const j = JSON.parse(fileBefore); j.shell = Object.assign({}, j.shell, { mount: shellMount }); j.node = Object.assign({}, j.node, { mount: nodeMount }); fs.writeFileSync(disk, JSON.stringify(j)); };
  test.run('with shell.mount and node.mount both true, the row says Deactivate Hearing face and server', 0.2, async function () {
    if (!W1.up) return false;
    rewrite(true, true);
    await openPanel();
    const bothWords = await waitForm(3, function (x) { return x.words === 'Deactivate ' + monitorLabel + ' face and server'; });
    return (bothWords) ? true : false;
  }, test.limit.slow);
  test.run('with both mounts true the panel has no Allow row', 0.2, async function () {
    if (!W1.up) return false;
    return ((await forms()).length === 4) ? true : false;
  }, test.limit.quick);
  test.run('with node.mount alone true, the row says Deactivate Hearing server', 0.2, async function () {
    if (!W1.up) return false;
    await closePanel();
    rewrite(false, true);
    await openPanel();
    const serverWords = await waitForm(3, function (x) { return x.words === 'Deactivate ' + monitorLabel + ' server'; });
    return (serverWords) ? true : false;
  }, test.limit.slow);
  test.run('with shell.mount false the panel has no Allow row', 0.2, async function () {
    if (!W1.up) return false;
    try {
      return ((await forms()).length === 4) ? true : false;
    } finally {
      await closePanel();
      fs.writeFileSync(disk, fileBefore);
    }
  }, test.limit.slow);

  // the box: "in :tiles mode, only activated apps will appear."
  test.run('the toggle shows tiles, a tile for the active Hearing and none for Starter', 0.2, async function () {
    if (!W1.up) return false;
    await chrome.evaluate('(function () { var t = document.querySelector("#faces .list-toggle"); if (t) t.click(); return !!t; }())');
    const onlyActive = await until(function () { return chrome.evaluate('!!' + tileOf(monitorLabel) + ' && !' + tileOf(serverLabel)); }, 5000);
    return (onlyActive) ? true : false;
  }, test.limit.slow);
  test.run('mounted as tiles from the start, it shows the same tiles', 0.2, async function () {
    if (!W1.up) return false;
    await mount({ face: 'tiles' });
    const direct = await until(function () { return chrome.evaluate('!!' + tileOf(monitorLabel) + ' && !' + tileOf(serverLabel)); }, 5000);
    return (direct) ? true : false;
  }, test.limit.slow);
  test.run('an app made active appears as a tile without a search being asked', 0.2, async function () {
    if (!W1.up) return false;
    await chrome.evaluate('spirit.required.spirit.app.api.activeApp({ key: "starter", active: true })');
    const arrives = await until(function () { return chrome.evaluate('!!' + tileOf(serverLabel)); }, 5000);
    return (arrives) ? true : false;
  }, test.limit.slow);
  test.run('an app made inactive leaves', 0.2, async function () {
    if (!W1.up) return false;
    await chrome.evaluate('spirit.required.spirit.app.api.activeApp({ key: "starter", active: false })');
    const leaves = await until(function () { return chrome.evaluate('!' + tileOf(serverLabel)); }, 5000);
    return (leaves) ? true : false;
  }, test.limit.slow);

  // the box: "in :tiles mode, appSelector icons will 'launch'", "its open and close move into appSelector"
  test.run('a tile opens its app inside, through its main element, spirit/app/monitor/element.js', 0.2, async function () {
    if (!W1.up) return false;
    await chrome.evaluate('(function () { var t = ' + tileOf(monitorLabel) + '; if (t) t.click(); return !!t; }())');
    const opened = await until(function () { return chrome.evaluate('(function () { var p = ' + inPanel('.app-container-pane') + '; return !!p && /Uptime|waiting/i.test(String(p.innerText)); }())'); }, 10000);
    return (opened) ? true : false;
  }, test.limit.slow);
  test.run('a launched app\'s title bar is the same rowForm as the title bar of all panels', 0.2, async function () {
    if (!W1.up) return false;
    const launchedBar = await chrome.evaluate('(function () { var f = ' + inPanel('.shell-row-form') + '; if (!f) return false; var b = f.lastElementChild; return b && b.tagName === "BUTTON" && String(f.textContent).indexOf(' + JSON.stringify(monitorLabel) + ') !== -1 ? "form" : false; }())');
    return (launchedBar === 'form') ? true : false;
  }, test.limit.quick);
  test.run('its close icon brings the tiles back', 0.2, async function () {
    if (!W1.up) return false;
    await chrome.evaluate('(function () { var c = ' + inPanel('.app-container-close') + '; if (c) c.click(); return !!c; }())');
    const closed = await until(function () { return chrome.evaluate('!' + panel + ' && !!' + tileOf(monitorLabel)); }, 5000);
    try {
      return (closed) ? true : false;
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
  let APPS, keys, r, runs, LABELS, flipped;
  test.run('the test\'s apps are planted', 0.2, async function () {
    if (!W1.up) return false;
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
    // THE TREE'S OWN APPS ARE JUDGED BY THEIR OWN MANIFESTS, in spirit/test/app-child-browser.js (goal/G47.4; Andy: "THIS IS
    // something that belongs in fucking app-child-browser", "that fucking test is useless, it fucking assumes settings in
    // fucking spirit/app/<name>/<name>.json"): this test judges only the apps it plants.
    return Object.keys(PLANT).every(function (k) { return fs.existsSync(path.join(APPS, k, k + '.json')); }) || false;
  }, test.limit.quick);

  let loaded;
  test.run('the face page reloads and the app selector loads', 0.2, async function () {
    if (!W1.up) return false;
    await chrome.send('Page.navigate', { url: node.base + '/' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.readyPromise)'); }, 20000);
    loaded = await chrome.evaluate('window.spirit.readyPromise.then(function () { return spirit.requireScript("spirit/element/script.js"); }).then(function () { return "loaded"; }, function () { return false; })');
    W1.loaded = loaded === 'loaded';
    return (loaded === 'loaded') ? true : false;
  }, test.limit.long);

  // EVERY APP ACTIVE, planted and the tree's: what keeps a tile away below can only be shell.mount.
  const rows = function () { return chrome.evaluate('(function () { var r = (spirit.required.spirit.data.app && spirit.required.spirit.data.app.data) ? spirit.required.spirit.data.app.data.rows() : {}; var out = {}; ' + JSON.stringify(keys) + '.forEach(function (k) { out[k] = r[k] ? { active: r[k].active === true } : null; }); return JSON.stringify(out); }())').then(function (s) { try { return JSON.parse(s); } catch (e) { return {}; } }); };
  test.run('every app, planted and the tree\'s, is made active', 0.2, async function () {
    if (!W1.loaded) return false;
    keys = Object.keys(PLANT);
    await chrome.evaluate('(function () { var a = spirit.required.spirit.app && spirit.required.spirit.app.api && spirit.required.spirit.app.api.activeApp; if (!a) return false; ' + JSON.stringify(keys) + '.forEach(function (k) { try { a({ key: k, active: true }); } catch (e) { /* the row below says */ } }); return true; }())');
    await until(function () { return rows().then(function (r) { return keys.every(function (k) { return r[k] && r[k].active; }); }); }, 10000);
    // A row the node would not make active through the verb is made active on its disc, as a user's earlier press left it.
    r = await rows();
    const notYet = keys.filter(function (k) { return !(r[k] && r[k].active); });
    notYet.forEach(function (k) { const d = path.join(node.root, 'spirit', 'run', 'spirit', 'state', k); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'node.json'), JSON.stringify({ active: true })); });
    if (notYet.length) { await until(function () { return rows().then(function (x) { return notYet.every(function (k) { return x[k] && x[k].active; }); }); }, 10000); r = await rows(); }
    // AN APP THAT SAYS node.run IS RUN, NEVER ACTIVE (goal/G43.21): it is a row, held inactive whatever its node.json says, so
    // two things keep its tile away; for every other app only shell.mount can.
    runs = Object.keys(PLANT).filter(function (k) { return PLANT[k].run; });
    W1.rows = true;
    return true;
  }, test.limit.long);
  // Each app written out, the planted ones and the tree's without shell.mount true, so that each check has a plain title.
  test.run('zzmounted is an active row', 0.2, async function () {
    if (!W1.rows) return false;
    return (!!(r['zzmounted'] && r['zzmounted'].active)) ? true : false;
  }, test.limit.quick);
  test.run('zzmountfalse is an active row', 0.2, async function () {
    if (!W1.rows) return false;
    return (!!(r['zzmountfalse'] && r['zzmountfalse'].active)) ? true : false;
  }, test.limit.quick);
  test.run('zznoshell is an active row', 0.2, async function () {
    if (!W1.rows) return false;
    return (!!(r['zznoshell'] && r['zznoshell'].active)) ? true : false;
  }, test.limit.quick);
  test.run('zznomount is an active row', 0.2, async function () {
    if (!W1.rows) return false;
    return (!!(r['zznomount'] && r['zznomount'].active)) ? true : false;
  }, test.limit.quick);
  test.run('zzstringmount is an active row', 0.2, async function () {
    if (!W1.rows) return false;
    return (!!(r['zzstringmount'] && r['zzstringmount'].active)) ? true : false;
  }, test.limit.quick);
  test.run('zzonemount is an active row', 0.2, async function () {
    if (!W1.rows) return false;
    return (!!(r['zzonemount'] && r['zzonemount'].active)) ? true : false;
  }, test.limit.quick);
  test.run('zzshellnull is an active row', 0.2, async function () {
    if (!W1.rows) return false;
    return (!!(r['zzshellnull'] && r['zzshellnull'].active)) ? true : false;
  }, test.limit.quick);
  test.run('zzrunonly is a row that is run only, never active', 0.2, async function () {
    if (!W1.rows) return false;
    return (!!r['zzrunonly']) ? true : false;
  }, test.limit.quick);

  const mount = function (opts) { return chrome.evaluate('(function () { var old = document.getElementById("faces"); if (old) { if (window.fsel) window.fsel.destroy(); old.remove(); } var c = document.createElement("div"); c.id = "faces"; c.style.cssText = "position:fixed;left:0;top:0;width:1200px;height:800px;display:flex;flex-direction:column;background:#111"; document.body.appendChild(c); window.fsel = spirit.required.spirit.element.create(c, ' + JSON.stringify(opts) + '); if (window.fsel.parentNode !== c) c.appendChild(window.fsel); return true; }())'); };
  // The labels drawn as tiles: every visible leaf under the tiles whose text is a label of the test's.
  // LABELS is set by the world above it, so drawn() reads it when it runs.
  const drawn = function () { return chrome.evaluate('(function () { var c = document.getElementById("faces"); if (!c) return "[]"; var want = ' + JSON.stringify(LABELS) + '; var out = []; var all = c.querySelectorAll("*"); for (var i = 0; i < all.length; i++) { var e = all[i]; if (!e.getClientRects().length) continue; var t = String(e.innerText || e.textContent || "").trim(); if (!e.children.length && want.indexOf(t) !== -1 && out.indexOf(t) === -1) out.push(t); } return JSON.stringify(out.sort()); }())').then(function (s) { try { return JSON.parse(s); } catch (e) { return []; } }); };
  // What each way of reaching the tiles drew, for the checks after it.
  const judged = {};
  const look = async function (how) {
    if (!W1.rows) return false;
    const seen = await until(function () { return drawn().then(function (d) { return d.indexOf(PLANT.zzmounted.label) !== -1; }); }, 8000);
    await sleep(800);
    const d = await drawn();
    judged[how] = { d: d };
    return seen ? true : false;
  };
  const planted = function (how, k) {
    const J = judged[how];
    if (!J) return false;
    return J.d.indexOf(PLANT[k].label) === -1;
  };
  // Andy: "MAKE SURE aN APP WITHOUT shell:mount NEVER SHOWS A FUCKING TILE!": tiles from the start
  test.run('on the tiles from the start, the app that says shell.mount true shows its tile', 0.2, async function () {
    if (!W1.rows) return false;
    LABELS = Object.keys(PLANT).map(function (k) { return PLANT[k].label; });
    await mount({ face: 'tiles' });
    return look('tiles');
  }, test.limit.slow);
  test.run('on the tiles from the start, zzmountfalse, whose shell.mount is false, shows no tile', 0.2, async function () {
    return planted('tiles', 'zzmountfalse');
  }, test.limit.quick);
  test.run('on the tiles from the start, zznoshell, which has no shell part, shows no tile', 0.2, async function () {
    return planted('tiles', 'zznoshell');
  }, test.limit.quick);
  test.run('on the tiles from the start, zznomount, which has no shell.mount, shows no tile', 0.2, async function () {
    return planted('tiles', 'zznomount');
  }, test.limit.quick);
  test.run('on the tiles from the start, zzstringmount, whose shell.mount is the string true, shows no tile', 0.2, async function () {
    return planted('tiles', 'zzstringmount');
  }, test.limit.quick);
  test.run('on the tiles from the start, zzonemount, whose shell.mount is 1, shows no tile', 0.2, async function () {
    return planted('tiles', 'zzonemount');
  }, test.limit.quick);
  test.run('on the tiles from the start, zzshellnull, whose shell is null, shows no tile', 0.2, async function () {
    return planted('tiles', 'zzshellnull');
  }, test.limit.quick);
  test.run('on the tiles from the start, zzrunonly, which is run only with shell.mount false, shows no tile', 0.2, async function () {
    return planted('tiles', 'zzrunonly');
  }, test.limit.quick);

  // the same, tiles reached by the toggle from the pane
  test.run('the pane is mounted with a toggle, and the toggle is pressed', 0.2, async function () {
    if (!W1.rows) return false;
    await mount({ face: 'pane', toggle: true });
    await until(function () { return chrome.evaluate('String(document.getElementById("faces").innerText).indexOf(' + JSON.stringify(PLANT.zzmounted.label) + ') !== -1'); }, 8000);
    flipped = await chrome.evaluate('(function () { var bs = document.getElementById("faces").querySelectorAll("button"); for (var i = 0; i < bs.length; i++) if (String(bs[i].textContent).indexOf("\u25A6") !== -1) { bs[i].click(); return true; } return false; }())');
    return (flipped === true) ? true : false;
  }, test.limit.slow);
  test.run('on the tiles reached by the toggle, the app that says shell.mount true shows its tile', 0.2, async function () {
    if (flipped !== true) return false;
    return look('toggled tiles');
  }, test.limit.slow);
  test.run('on the tiles reached by the toggle, zzmountfalse, whose shell.mount is false, shows no tile', 0.2, async function () {
    return planted('toggled tiles', 'zzmountfalse');
  }, test.limit.quick);
  test.run('on the tiles reached by the toggle, zznoshell, which has no shell part, shows no tile', 0.2, async function () {
    return planted('toggled tiles', 'zznoshell');
  }, test.limit.quick);
  test.run('on the tiles reached by the toggle, zznomount, which has no shell.mount, shows no tile', 0.2, async function () {
    return planted('toggled tiles', 'zznomount');
  }, test.limit.quick);
  test.run('on the tiles reached by the toggle, zzstringmount, whose shell.mount is the string true, shows no tile', 0.2, async function () {
    return planted('toggled tiles', 'zzstringmount');
  }, test.limit.quick);
  test.run('on the tiles reached by the toggle, zzonemount, whose shell.mount is 1, shows no tile', 0.2, async function () {
    return planted('toggled tiles', 'zzonemount');
  }, test.limit.quick);
  test.run('on the tiles reached by the toggle, zzshellnull, whose shell is null, shows no tile', 0.2, async function () {
    return planted('toggled tiles', 'zzshellnull');
  }, test.limit.quick);
  test.run('on the tiles reached by the toggle, zzrunonly, which is run only with shell.mount false, shows no tile', 0.2, async function () {
    return planted('toggled tiles', 'zzrunonly');
  }, test.limit.quick);

  // the app app's own tiles, as boot.js mounts it: no options (goal/G43.32)
  test.run('on the app app\'s own tiles, the app that says shell.mount true shows its tile', 0.2, async function () {
    if (!W1.rows) return false;
    await mount();
    return look('the app app\'s tiles');
  }, test.limit.slow);
  test.run('on the app app\'s own tiles, zzmountfalse, whose shell.mount is false, shows no tile', 0.2, async function () {
    return planted('the app app\'s tiles', 'zzmountfalse');
  }, test.limit.quick);
  test.run('on the app app\'s own tiles, zznoshell, which has no shell part, shows no tile', 0.2, async function () {
    return planted('the app app\'s tiles', 'zznoshell');
  }, test.limit.quick);
  test.run('on the app app\'s own tiles, zznomount, which has no shell.mount, shows no tile', 0.2, async function () {
    return planted('the app app\'s tiles', 'zznomount');
  }, test.limit.quick);
  test.run('on the app app\'s own tiles, zzstringmount, whose shell.mount is the string true, shows no tile', 0.2, async function () {
    return planted('the app app\'s tiles', 'zzstringmount');
  }, test.limit.quick);
  test.run('on the app app\'s own tiles, zzonemount, whose shell.mount is 1, shows no tile', 0.2, async function () {
    return planted('the app app\'s tiles', 'zzonemount');
  }, test.limit.quick);
  test.run('on the app app\'s own tiles, zzshellnull, whose shell is null, shows no tile', 0.2, async function () {
    return planted('the app app\'s tiles', 'zzshellnull');
  }, test.limit.quick);
  test.run('on the app app\'s own tiles, zzrunonly, which is run only with shell.mount false, shows no tile', 0.2, async function () {
    return planted('the app app\'s tiles', 'zzrunonly');
  }, test.limit.quick);

  // never: an app that loses shell.mount on its disc loses its tile, no reload
  let file, j;
  test.run('its tile leaves the moment its json says shell.mount false', 0.2, async function () {
    if (!W1.rows) return false;
    await mount({ face: 'tiles' });
    await until(function () { return drawn().then(function (d) { return d.indexOf(PLANT.zzmounted.label) !== -1; }); }, 8000);
    file = path.join(APPS, 'zzmounted', 'zzmounted.json');
    j = JSON.parse(fs.readFileSync(file, 'utf8'));
    j.shell.mount = false;
    fs.writeFileSync(file, JSON.stringify(j, null, 2));
    const left = await until(function () { return drawn().then(function (d) { return d.indexOf(PLANT.zzmounted.label) === -1; }); }, 8000);
    return (left) ? true : false;
  }, test.limit.slow);
  test.run('with its shell part gone, its tile does not come back', 0.2, async function () {
    if (!j) return false;
    delete j.shell;
    fs.writeFileSync(file, JSON.stringify(j, null, 2));
    await sleep(1500);
    return ((await drawn()).indexOf(PLANT.zzmounted.label) === -1) ? true : false;
  }, test.limit.slow);
  test.run('saying shell.mount true again brings its tile back', 0.2, async function () {
    if (!j) return false;
    j.shell = { true: false, mount: true, tile: true };
    fs.writeFileSync(file, JSON.stringify(j, null, 2));
    const back = await until(function () { return drawn().then(function (d) { return d.indexOf(PLANT.zzmounted.label) !== -1; }); }, 8000);
    return (back) ? true : false;
  }, test.limit.slow);
  }
}

// ── THE shell PART ───────────────────────────────────────────────────────────────────────────────────────────
{
  // THE ONE SHELL (goal/G49.4, box v15; Andy: "spirit/element/script.js becomes the hard-coded only shell there is in
  // SpiritOS", "the app manifests shell:true goes, and all the logic that goes with it, including any places where the
  // \"current\" shell is stored", "the verb node.shell goes", "go!"). A real node on a scratch copy of the tracked files, and
  // a real Chrome on the page Andy uses at home, / (spirit/shell/face.html). Neither Andy's node nor an agent's is touched.

  const os = require('os');
  const { spawn, execSync } = require('child_process');
  const REPO = path.resolve(RUN, '..', '..');
  const { freePort, until, sleep, chromePage, findChrome } = LOADER.requireScript('spirit/test/headLessChrome.js');
  function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
  function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }
  async function call(base, verb, args) {
    try {
      const r = await fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
      const text = await r.text();
      return { status: r.status, text: text, body: parsed(text) };
    } catch (e) { return { status: 0, text: '', body: null }; }
  }
  async function boot(run) {
    const port = await freePort();
    const child = LABH.startNodeOn(run, port);
    const base = 'http://127.0.0.1:' + port;
    const up = await until(function () { return call(base, 'api').then(function (r) { return r.status === 200; }); }, 60000);
    return { child: child, base: base, up: !!up };
  }
  function stop(c) { return new Promise(function (r) { if (!c || c.exitCode !== null) return r(); c.once('exit', function () { r(); }); c.kill(); setTimeout(r, 6000); }); }

  const W3 = {};
  let s, N, c;
  test.run('a scratch node comes up', 0.2, async function () {
    // The part before is done: its scratch node and Chrome stop here.
    stopAll();
    s = { root: LABH.scratchTree().root };
    s.run = path.join(s.root, 'spirit', 'run');
    LIVE.push({ s: s });
    N = await boot(s.run);
    LIVE.push({ N: N });
    return (N.up) ? true : false;
  }, test.limit.slow);
  test.run('a Chrome page opens', 0.2, async function () {
    if (!N || !N.up) return false;
    const where = findChrome();
    if (!where) return false;
    c = await chromePage(where);
    LIVE.push({ c: c });
    if (c.error) return false;
    W3.up = true;
    return true;
  }, test.limit.quick);
  const open = async function () {
    await c.evaluate('window.__zzOld = true').catch(function () {});
    await c.send('Page.navigate', { url: N.base + '/' });
    const up = await until(function () { return c.evaluate('!window.__zzOld && document.readyState === "complete" && !!window.spirit'); }, 20000);
    await sleep(4000);
    return up;
  };
  const loaded = function () { return c.evaluate('performance.getEntriesByType("resource").map(function (e) { return e.name.replace(/^https?:\\/\\/[^/]+/, ""); })'); };
  const text = function () { return c.evaluate('String(document.body.innerText || "")'); };

  let first;
  test.run('the face page opens', 0.2, async function () {
    if (!W3.up) return false;
    W3.opened = !!(await open());
    return W3.opened || false;
  }, test.limit.long);
  test.run('the page loads spirit/element/script.js, the one shell', 0.2, async function () {
    if (!W3.opened) return false;
    first = await loaded();
    return (first.some(function (n) { return (/^\/spirit\/element\/script\.js(\?|$)/).test(n); })) ? true : false;
  }, test.limit.quick);
  test.run('the shell wraps the app search: the app search is on the page, with Contacts listed', 0.2, async function () {
    if (!first) return false;
    return (first.some(function (n) { return (/^\/spirit\/element\/search\/app\/script\.js(\?|$)/).test(n); }) && /\bContacts\b/.test(await text())) ? true : false;
  }, test.limit.quick);
  // goal/G43.18, Andy: "the shell should exclude itself completely from the app-list, haha..."; since goal/G49.4 the shell is
  // no app at all, so the list holds no row of it.
  test.run('the app list holds Contacts and no row of the shell', 0.2, async function () {
    if (!W3.opened) return false;
    const keys = await c.evaluate('Array.prototype.slice.call(document.querySelectorAll("[data-key]")).filter(function (e) { return e.offsetParent !== null; }).map(function (e) { return e.getAttribute("data-key"); })');
    return (keys.indexOf('contact') !== -1 && keys.indexOf('app') === -1) ? true : false;
  }, test.limit.quick);

  // ── THE remote PART (goal/G47.5, box v12: "all appServer faces now carry a Remote element in the center of their titlebar",
  // "that title bar is a simple dropdown, that is filled by a \"remote\" request without argument to its appServer", "the
  // Remote element shows only on apps that have a server"; Andy: "i understand that it touches the shared titlebar.") ──
  // A scratch node of its own; Chat, an app with a server, switched on, and Testicle, whose manifest refuses client mode (goal/G49.8: node.remote false); Starter, an app with none. A tile pressed on the
  // face opens the app as a layer, its title bar the row form naming the app. What the page asks is read from its fetches.
  const W4 = {};
  let N4 = null, c4 = null, CHAT = '', TESTICLE = '', STARTER = '';
  const labelOf = function (n) { const j = readJson(path.join(RUN, 'spirit', 'app', n, n + '.json')); return String((j && j.identity && j.identity.label) || ''); };
  // The title bar of the open layer: the visible row form whose words are the app's label; whether it holds the shared
  // search's dropdown (its field, a button whose id ends in field).
  const barOf = function (label) { return c4.evaluate('(function () { var f = [].filter.call(document.querySelectorAll(".shell-row-form"), function (x) { var sp = x.querySelector(".shell-row-form-span"); return x.getBoundingClientRect().height > 0 && sp && String(sp.textContent || "").indexOf(' + JSON.stringify(label) + ') !== -1; })[0]; if (!f) return "none"; return f.querySelector("button[id$=\'field\']") ? "dropdown" : "plain"; }())'); };
  const pressTile = function (label) { return c4.evaluate('(function () { var t = [].filter.call(document.querySelectorAll("*"), function (e) { return !e.children.length && e.offsetParent !== null && String(e.textContent || "").trim() === ' + JSON.stringify(label) + '; })[0]; if (!t) return false; t.click(); return true; }())'); };
  const asked = function () { return c4.evaluate('JSON.stringify(window.__zzAsked || [])').then(function (t) { return parsed(t) || []; }); };
  test.run('a scratch node comes up with Chat and Testicle switched on, and Chrome opens its face page', 0.2, async function () {
    stopAll();
    CHAT = labelOf('chat'); TESTICLE = labelOf('testicle'); STARTER = labelOf('starter');
    const s4 = LABH.scratchTree();
    LIVE.push({ s: s4 });
    N4 = await boot(path.join(s4.root, 'spirit', 'run'));
    LIVE.push({ N: N4 });
    if (!N4.up) return false;
    c4 = await chromePage(findChrome());
    LIVE.push({ c: c4 });
    if (c4.error) return false;
    await c4.send('Page.navigate', { url: N4.base + '/' });
    await until(function () { return c4.evaluate('!!(window.spirit && window.spirit.readyPromise && spirit.required.spirit.app && spirit.required.spirit.app.api && spirit.required.spirit.app.api.activeApp)'); }, 20000);
    await c4.evaluate('spirit.required.spirit.app.api.activeApp({ key: "chat", active: true }); spirit.required.spirit.app.api.activeApp({ key: "testicle", active: true }); spirit.required.spirit.app.api.activeApp({ key: "starter", active: true }); true');
    const served = await until(function () { return call(N4.base, 'api').then(function (r) { return !!(r.body && r.body.chat && r.body.testicle); }); }, 60000);
    await c4.send('Page.navigate', { url: N4.base + '/' });
    await until(function () { return c4.evaluate('document.readyState === "complete" && !!window.spirit'); }, 20000);
    await sleep(3000);
    // Every call the page makes, kept: its fetches to /api/spirit carry { call, args }.
    await c4.evaluate('(function () { window.__zzAsked = []; var f = window.fetch; window.fetch = function (u, o) { try { if (o && o.body) window.__zzAsked.push(String(o.body)); } catch (e) {} return f.apply(this, arguments); }; return true; }())');
    W4.up = !!served && !!CHAT && !!TESTICLE && !!STARTER;
    return W4.up || false;
  }, test.limit.long);
  test.run('Chat, an app with a server, opens with the shared search dropdown in its title bar', 0.2, async function () {
    if (!W4.up) return false;
    if (!(await pressTile(CHAT))) return false;
    await sleep(3000);
    W4.bar = await barOf(CHAT);
    return W4.bar === 'dropdown' || false;
  }, test.limit.slow);
  test.run('the dropdown is filled by remote, asked of chat\'s server with no argument', 0.2, async function () {
    if (W4.bar !== 'dropdown') return false;
    return (await asked()).some(function (b) { const j = parsed(b) || {}; return /(^|\.)remote$/.test(String(j.call || '')) && /chat/.test(String(j.call || '')) && !(j.args && j.args.id); }) || false;
  }, test.limit.quick);
  // WHAT IT RUNS ON, SHOWN (Andy: "the selector dropdown on andy-wsl's desk finds \"Andy Flinn\" but won't accept the
  // selection, the setting remains on \"WSL ANDY VSCode\""; "nothing returned handles the data"; "all, agreed. spirit/data/script.js"):
  // before any pick the field names the server remote answers as current; chat's published remote row reaches the page's
  // spirit.required.spirit.data.chat.remote; and the field follows what lands there.
  const barForm = function () { return '[].filter.call(document.querySelectorAll(".shell-row-form"), function (x) { var sp = x.querySelector(".shell-row-form-span"); return x.getBoundingClientRect().height > 0 && sp && String(sp.textContent || "").indexOf(' + JSON.stringify(CHAT) + ') !== -1; })[0]'; };
  const fieldText = function () { return c4.evaluate('(function () { var f = ' + barForm() + '; var b = f && f.querySelector("button[id$=\'field\']"); return b ? String(b.textContent || "") : ""; }())'); };
  test.run('before any pick the dropdown\'s field names the server remote answers as current', 0.2, async function () {
    if (W4.bar !== 'dropdown') return false;
    W4.real = parsed(await c4.evaluate('spirit.requireScript("spirit/app/chat/api.js").then(function (f) { return f.remote({}); }).then(function (r) { return JSON.stringify(r); }, function () { return "null"; })')) || {};
    const c = (W4.real.items || []).filter(function (i) { return String(i.key) === String(W4.real.current); })[0];
    const label = c ? String(c.label || '') : '';
    if (!label) return false;
    return (await fieldText()).indexOf(label) !== -1 || false;
  }, test.limit.slow);
  test.run('chat\'s published remote row reaches the page\'s spirit.required.spirit.data.chat.remote, naming the same current', 0.2, async function () {
    if (W4.bar !== 'dropdown' || !W4.real || !W4.real.current) return false;
    return (await until(function () { return c4.evaluate('(function () { var t = (window.spirit.required.spirit.data || {}).chat; return !!(t && t.remote && String(t.remote.current) === ' + JSON.stringify(String(W4.real.current)) + '); }())'); }, 15000)) ? true : false;
  }, test.limit.slow);
  test.run('a remote row landing in spirit.required.spirit.data.chat.remote is what the field then names', 0.2, async function () {
    if (W4.bar !== 'dropdown') return false;
    const fake = { current: 'K-ZZELSEWHERE', items: [{ key: 'K-ZZELSEWHERE', label: 'zz Elsewhere' }], more: false };
    await c4.evaluate('(function () { window.spirit.required.spirit.data.takeJob({ id: "zz-remote-row", type: "app", module: "spirit.app.chat", app: { remote: ' + JSON.stringify(fake) + ' } }); return true; }())');
    await sleep(1000);
    const shown = await fieldText();
    // The node's own row back, for what follows.
    if (W4.real && W4.real.current) await c4.evaluate('(function () { window.spirit.required.spirit.data.takeJob({ id: "zz-remote-row", type: "app", module: "spirit.app.chat", app: { remote: ' + JSON.stringify(W4.real) + ' } }); return true; }())');
    return shown.indexOf('zz Elsewhere') !== -1 || false;
  }, test.limit.slow);
  test.run('picking a row of the dropdown sends remote with that row\'s id', 0.2, async function () {
    if (W4.bar !== 'dropdown') return false;
    // The dropdown's own rows, inside the title bar's row form (cw: the tiles under the open layer have data-key rows too).
    const inBar = '[].filter.call(document.querySelectorAll(".shell-row-form"), function (x) { var sp = x.querySelector(".shell-row-form-span"); return x.getBoundingClientRect().height > 0 && sp && String(sp.textContent || "").indexOf(' + JSON.stringify(CHAT) + ') !== -1; })[0]';
    await c4.evaluate('(function () { var f = ' + inBar + '; var b = f && f.querySelector("button[id$=\'field\']"); if (b) b.click(); return !!b; }())');
    await sleep(1500);
    await c4.evaluate('(function () { var f = ' + inBar + '; var r = f && f.querySelector("[data-key]"); if (r) r.click(); return !!r; }())');
    await sleep(1500);
    return (await asked()).some(function (b) { const j = parsed(b) || {}; return /(^|\.)remote$/.test(String(j.call || '')) && !!(j.args && j.args.id); }) || false;
  }, test.limit.slow);
  // WHAT IT RUNS ON, SHOWN (Andy: "the selector dropdown on andy-wsl's desk finds \"Andy Flinn\" but won't accept the
  // selection, the setting remains on \"WSL ANDY VSCode\""): the field names the server remote answers as current, and a
  // switch the node refuses says why in the bar. The refusal is the node's answer, stood in for at the page's fetch.
  test.run('a switch the node refuses says why in the title bar', 0.2, async function () {
    if (W4.bar !== 'dropdown') return false;
    await c4.evaluate('(function () { var f = window.fetch; window.__zzFetch = f; window.fetch = function (u, o) { var j = null; try { j = JSON.parse(String((o && o.body) || "")); } catch (e) {} if (j && /(^|\\.)remote$/.test(String(j.call || "")) && j.args && j.args.id) return Promise.resolve(new Response(JSON.stringify({ ok: false, code: "not-granted", error: "zz no grant on the sibling" }), { status: 403, headers: { "content-type": "application/json" } })); return f.apply(this, arguments); }; return true; }())');
    await c4.evaluate('(function () { var f = ' + barForm() + '; var b = f && f.querySelector("button[id$=\'field\']"); if (b) b.click(); return !!b; }())');
    await sleep(1500);
    await c4.evaluate('(function () { var f = ' + barForm() + '; var r = f && f.querySelector("[data-key]"); if (r) r.click(); return !!r; }())');
    await sleep(1500);
    const text = await c4.evaluate('(function () { var f = ' + barForm() + '; return f ? String(f.textContent || "") : ""; }())');
    await c4.evaluate('(function () { if (window.__zzFetch) window.fetch = window.__zzFetch; return true; }())');
    return text.indexOf('zz no grant on the sibling') !== -1 || false;
  }, test.limit.slow);
  test.run('Starter, an app with no server, opens with no dropdown in its title bar', 0.2, async function () {
    if (!W4.up) return false;
    await c4.send('Page.navigate', { url: N4.base + '/' });
    await until(function () { return c4.evaluate('document.readyState === "complete" && !!window.spirit'); }, 20000);
    await sleep(3000);
    if (!(await pressTile(STARTER))) return false;
    await sleep(3000);
    return (await barOf(STARTER)) === 'plain' || false;
  }, test.limit.slow);
  // AN APP THAT REFUSES CLIENT MODE HAS NO REMOTE (goal/G49.8, box v3: "the shell draws no remote in that app's title bar";
  // testicle's manifest sets node.remote false): Testicle, though it has a server, opens with no dropdown.
  test.run('Testicle, whose manifest refuses client mode, opens with no dropdown in its title bar', 0.4, async function () {
    if (!W4.up) return false;
    await c4.send('Page.navigate', { url: N4.base + '/' });
    await until(function () { return c4.evaluate('document.readyState === "complete" && !!window.spirit'); }, 20000);
    await sleep(3000);
    if (!(await pressTile(TESTICLE))) return false;
    await sleep(3000);
    return (await barOf(TESTICLE)) === 'plain' || false;
  }, test.limit.slow);
}
