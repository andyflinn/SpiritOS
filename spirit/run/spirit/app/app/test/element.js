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
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
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

test.startTest('element.js: the app app\'s main element, the app selector (goal/G43.2)');

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('spirit/app/app/element.js is not there'); return; }
  const identity = JSON.parse(fs.readFileSync(path.join(RUN, 'spirit', 'app', 'starter', 'starter.json'), 'utf8')).identity;
  // An app the user switches, not intrinsic, a face and no server: Starter, since Andy deleted the server app (25a95142, "delete dummy app").
  const node = await scratchNode();
  const chrome = await chromePage(findChrome());
  try {
    if (!node.up || chrome.error) { test.fail('no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '')); return; }
    // AN APP THE USER SWITCHES, OF THIS TEST'S OWN (goal/G43.15): Monitor was it until Andy's 7f6ebbbe made it intrinsic, so always on. A copy
    // of its json as it was then, and its script, planted on the scratch node's disc; the app family reads the disc.
    if (!node.root) { test.fail('the scratch node is shared, so no app of the test\'s own can be planted: nothing judged'); return; }
    const zz = path.join(node.root, 'spirit', 'run', 'spirit', 'app', 'hearing');
    fs.mkdirSync(zz, { recursive: true });
    fs.writeFileSync(path.join(zz, 'hearing.json'), JSON.stringify({ identity: { icon: '🦻', label: 'Hearing', intrinsic: false }, mount: { 'element.js': true }, shell: { true: false, mount: true, tile: true }, node: { mount: false } }, null, 2));
    // Monitor's main element, placed at the planted app's own path, as a tile asks for it (goal/G43.32, rule 4).
    fs.writeFileSync(path.join(zz, 'element.js'), fs.readFileSync(path.join(RUN, 'spirit', 'app', 'monitor', 'element.js'), 'utf8').split('spirit/app/monitor/element.js').join('spirit/app/hearing/element.js'));
    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    const made = await chrome.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/app/app/element.js"); }).then(function () {' +
      ' var c = document.createElement("div"); c.id = "under-test"; document.body.appendChild(c); window.changes = 0;' +
      ' window.sel = spirit.element.spirit.app.app.element.create(c, { face: "pane" }); if (window.sel.parentNode !== c) c.appendChild(window.sel); window.sel.addEventListener("change", function () { window.changes += 1; }); return "made"; }, function (e) { return String(e && e.message || e); })');
    ok(made === 'made', 'it loads through spirit.require and mounts as a pane', 'it did not mount: ' + short(made));
    const text = function () { return chrome.evaluate('String((document.getElementById("under-test") || {}).innerText || "")'); };
    const found = await until(function () { return text().then(function (t) { return t.indexOf(identity.label) !== -1; }); }, 8000);
    ok(found, 'the list shows starter\'s label', 'the list never showed "' + identity.label + '": ' + short(await text()));
    const html = await chrome.evaluate('String((document.getElementById("under-test") || {}).innerHTML || "")');
    ok(html.indexOf(identity.icon) !== -1 || /<svg|<img/.test(html), 'the list shows its icon', 'no icon in the list: ' + short(html));
    // ONLY ICON AND LABEL (Andy, box): what is left of the row once those two are taken out is nothing.
    const rowText = await chrome.evaluate('(function () { var want = ' + JSON.stringify(identity.label) + '; var all = document.getElementById("under-test").querySelectorAll("*"); var outside = function (e) { var c = e.cloneNode(true); [].forEach.call(c.querySelectorAll(".shell-row-form, button"), function (b) { b.remove(); }); return c.textContent; }; var best = null; for (var i = 0; i < all.length; i++) { if (all[i].children.length && !all[i].closest(".shell-row-form") && outside(all[i]).indexOf(want) !== -1) best = all[i]; } if (!best) return ""; return outside(best); }())');
    const rest = String(rowText).split(identity.label).join('').split(identity.icon).join('').trim();
    ok(rowText !== '' && rest === '', 'the row shows icon and label and nothing else', 'the row also shows: ' + short({ rest: rest, rowText: rowText }));

    // A PRESS PICKS, AND SHOWS ITS DETAIL.
    const pressed = await chrome.evaluate('(function () { var want = ' + JSON.stringify(identity.label) + '; var all = document.getElementById("under-test").querySelectorAll("*"); var hit = null; for (var i = 0; i < all.length; i++) { if (String(all[i].innerText || "").trim() && String(all[i].innerText).indexOf(want) !== -1 && !all[i].children.length) hit = all[i]; } if (!hit) return false; hit.click(); return true; }())');
    ok(pressed === true, 'its row can be pressed', 'no row to press');
    const picked = await until(function () { return chrome.evaluate('window.changes >= 1 && !!window.sel.row && window.sel.value !== ""'); }, 3000);
    ok(picked, 'a press sets value and row, and says change', 'a press gave ' + short(await chrome.evaluate('JSON.stringify({ changes: window.changes, value: window.sel.value, row: window.sel.row })')));
    const detail = await until(function () { return chrome.evaluate('(function () { var h = document.querySelector("#under-test .app-container .shell-row-form"); return !!(spirit.element.spirit.element.search.app.detailElement) && !!h && String(h.textContent).indexOf(' + JSON.stringify(identity.label) + ') !== -1; }())'); }, 3000);
    ok(detail, 'a press shows that app\'s detail', 'a press showed no detail');

    await chrome.evaluate('(function () { var c = document.querySelector("#under-test .app-container-close"); if (c) c.click(); return !!c; }())');

    // THE WORDS.
    await chrome.evaluate('(function () { var i = document.querySelector("#under-test input"); if (!i) return; i.value = "zzqqxxvvkk"; i.dispatchEvent(new Event("input", { bubbles: true })); }())');
    const ranked = await until(function () { return chrome.evaluate('(function () { var b = document.querySelector("#under-test .list-rank div div"); return !!b && b.style.width === "0%"; }())'); }, 4000);
    ok(ranked, 'typed words that fit nothing rank it at nothing: the shared list cuts no row', 'its rank bar for words that fit nothing: ' + short(await chrome.evaluate('String((document.querySelector("#under-test .list-rank") || {}).innerHTML || "")')));
    await chrome.evaluate('(function () { var i = document.querySelector("#under-test input"); if (!i) return; i.value = ""; i.dispatchEvent(new Event("input", { bubbles: true })); }())');
    await until(function () { return text().then(function (t) { return t.indexOf(identity.label) !== -1; }); }, 4000);

    // WHO PAINTS, LISTENS (Andy, G41.32): "every row's data ... must update instantly".
    const disk = path.join(node.root, 'spirit', 'run', 'spirit', 'app', 'starter', 'starter.json');
    const was = JSON.parse(fs.readFileSync(disk, 'utf8'));
    was.identity.label = 'Changed On Disk';
    fs.writeFileSync(disk, JSON.stringify(was));
    const follows = await until(function () { return text().then(function (t) { return t.indexOf('Changed On Disk') !== -1; }); }, 8000);
    ok(follows, 'a change on the disk paints on the page, no reload', 'the row kept its old label after the disk changed: ' + short(await text()));
    // THE DETAIL OPEN IS PAINTED TOO (Andy, G41.32: "wherever it's visible"): it is the row element's own watch that does it, which no list redraw covers.
    await chrome.evaluate('(function () { var all = document.querySelectorAll("#under-test tr, #under-test .list-row"); for (var i = 0; i < all.length; i++) if (String(all[i].textContent).indexOf("Changed On Disk") !== -1) { all[i].click(); return true; } return false; }())');
    const both = await until(function () { return chrome.evaluate('(function () { var h = document.querySelector("#under-test .app-container .shell-row-form"); return !!h && String(h.textContent).indexOf("Changed On Disk") !== -1; }())'); }, 8000);
    ok(both, 'the open detail paints the change as well', 'the open detail kept its old label: ' + short(await text()));
    await chrome.evaluate('(function () { var c = document.querySelector("#under-test .app-container-close"); if (c) c.click(); return !!c; }())');

    const empty = await chrome.evaluate('(function () { window.sel.destroy(); return document.getElementById("under-test").children.length === 0; }())');
    ok(empty === true, 'destroy empties its container', 'destroy left its container with ' + short(await text()));

    // ── ONE appSelector, THREE FACES (goal/G43.9) ──
    {
    test.subHeading('the box: "spirit/app/appTiles.js will be removed." "spirit.app.appTiles() will be removed."');
    ok(!fs.existsSync(path.join(RUN, 'spirit', 'app', 'appTiles.js')), 'the file is gone', 'spirit/app/appTiles.js still stands');
    ok(await chrome.evaluate('!(window.spirit.app && window.spirit.app.appTiles)') === true, 'and so is spirit.app.appTiles', 'spirit.app.appTiles still stands');
    const monitorLabel = 'Hearing';
    const serverLabel = 'Changed On Disk';
    const mount = function (opts) { return chrome.evaluate('(function () { var old = document.getElementById("faces"); if (old) old.remove(); var c = document.createElement("div"); c.id = "faces"; c.style.cssText = "position:fixed;left:0;top:0;width:900px;height:600px;display:flex;flex-direction:column;background:#111"; document.body.appendChild(c); window.fs = spirit.element.spirit.app.app.element.create(c, ' + JSON.stringify(opts) + '); if (window.fs.parentNode !== c) c.appendChild(window.fs); return true; }())'); };
    const inFaces = function () { return chrome.evaluate('String((document.getElementById("faces") || {}).innerText || "")'); };
    const rowOf = function (label) { return '(function () { var all = document.querySelectorAll("#faces tr, #faces .list-row"); for (var i = 0; i < all.length; i++) if (String(all[i].textContent).indexOf(' + JSON.stringify(label) + ') !== -1) return all[i]; return null; }())'; };
    const tileOf = function (label) { return 'Array.prototype.filter.call(document.querySelectorAll("#faces .app-icon"), function (t) { return t.offsetParent !== null && String(t.textContent).indexOf(' + JSON.stringify(label) + ') !== -1; })[0]'; };
    const stateFile = function (k) { return path.join(node.root, 'spirit', 'run', 'spirit', 'state', k, 'node.json'); };

    test.subHeading('the box: "in :pane mode (list) i want to see a list of all rows, activated AND deactivated, with the (de)activate buttons at the end of each row."');
    await mount({ face: 'pane', toggle: true });
    const both = await until(function () { return inFaces().then(function (t) { return t.indexOf(monitorLabel) !== -1 && t.indexOf(serverLabel) !== -1; }); }, 8000);
    ok(both, 'the pane lists both, neither active', 'the pane shows: ' + short(await inFaces()));
    const buttonOf = function (label) { return 'var r = ' + rowOf(label) + '; if (!r) return "no row"; var bs = r.querySelectorAll("button"); if (bs.length !== 1) return "buttons: " + bs.length; var b = bs[0]; var all = r.querySelectorAll("*"); var last = null; for (var i = 0; i < all.length; i++) { if (all[i].getClientRects().length && !all[i].children.length) last = all[i]; } if (!(last === b || b.contains(last))) return "not last"; '; };
    // The switch's words, which stand beside its 🟢/🔴 button (rowFormAppActive, goal/G43.15).
    const says = function (label) { return chrome.evaluate('(function () { ' + buttonOf(label) + 'var w = r.querySelector(".shell-row-form-span"); return (w || b).textContent.trim(); }())'); };
    const said = await until(function () { return says(monitorLabel).then(function (t) { return /^activate\b/i.test(t); }); }, 8000);
    ok(said, 'each row ends in its one button, Activate', 'Hearing\'s row: ' + short(await says(monitorLabel)));
    test.subHeading('the box: "The node writes spirit/state/<key>/node.json and republishes its \'apps\' job, whose rows gain active. The list follows by itself."');
    await chrome.evaluate('(function () { var r = ' + rowOf(monitorLabel) + '; var b = r && r.querySelector("button"); if (b) b.click(); return !!b; }())');
    const written = await until(function () { return Promise.resolve((function () { try { return JSON.parse(fs.readFileSync(stateFile('hearing'), 'utf8')).active === true; } catch (e) { return false; } }())); }, 5000);
    ok(written, 'a press writes active true to spirit/state/hearing/node.json', 'after a press the file is not active');
    const rowActive = await until(function () { return chrome.evaluate('(function () { var r = spirit.data.app.data.rows().hearing; return !!r && r.active === true; }())'); }, 5000);
    ok(rowActive, 'the stream brings active to the row, no search asked', 'the row: ' + short(await chrome.evaluate('JSON.stringify(spirit.data.app.data.rows().hearing)')));
    const flipped = await until(function () { return says(monitorLabel).then(function (t) { return /^deactivate\b/i.test(t); }); }, 5000);
    ok(flipped, 'the button follows: Deactivate', 'the button says: ' + short(await says(monitorLabel)));
    await chrome.evaluate('spirit.app.searchApp({ q: "" }).then(function (got) { spirit.data.seatRows(spirit.data.app.data.branch, got.items); return true; })');
    ok(await chrome.evaluate('(function () { var r = spirit.data.app.data.rows().hearing; return !!r && r.active === true; }())') === true, 'a search seated over it does not lose active', 'after a search the row: ' + short(await chrome.evaluate('JSON.stringify(spirit.data.app.data.rows().hearing)')));

    // Andy: "the detail panel needs to open on top of the whole container", and the form he drew for it.
    test.subHeading('the panel: over the whole container');
    const openPanel = function () { return chrome.evaluate('(function () { var r = ' + rowOf(monitorLabel) + '; if (r) r.click(); return !!r; }())'); };
    // THE PANEL IN VIEW. A closed layer is hidden, not destroyed (the box: "A closed layer is hidden, not destroyed ... The
    // appSelector's ✕ hides too", Q3), so the one that counts is the one shown.
    const panel = '[].filter.call(document.querySelectorAll("#faces .app-container"), function (p) { return p.style.display !== "none"; })[0]';
    const inPanel = function (sel) { return '((' + panel + ') || document.createElement("div")).querySelector(' + JSON.stringify(sel) + ')'; };
    const closePanel = async function () { await chrome.evaluate('(function () { var c = ' + inPanel('.app-container-close') + '; if (c) c.click(); return !!c; }())'); return until(function () { return chrome.evaluate('!' + panel); }, 4000); };
    await openPanel();
    const up = await until(function () { return chrome.evaluate('!!' + panel); }, 5000);
    ok(up, 'a pick in the pane opens it', 'a pick in the pane opened no panel: ' + short(await inFaces()));
    const covers = await chrome.evaluate('(function () { var p = ' + panel + '; if (!p) return "no panel"; var a = p.getBoundingClientRect(), b = document.getElementById("faces").getBoundingClientRect(); if (Math.abs(a.width - b.width) > 2 || Math.abs(a.height - b.height) > 2) return JSON.stringify([a.width, a.height, b.width, b.height]); var r = ' + rowOf(monitorLabel) + '; return r && r.offsetParent !== null ? "the list still shows" : "covers"; }())');
    ok(covers === 'covers', 'it covers the whole container, and the list is out of sight', 'the panel: ' + short(covers));
    // Each form of the panel, in order: its icon, its words, its input's value, its button.
    const clean = function (t) { return String(t).replace(/\s+/g, ' ').trim(); };
    const forms = async function () { const j = await chrome.evaluate('JSON.stringify([].map.call([].filter.call(((' + panel + ') || document.createElement("div")).querySelectorAll(".shell-row-form"), function (f) { return f.getBoundingClientRect().height > 0; }), function (f) { var sp = f.querySelector(".shell-row-form-span"); var bs = f.querySelectorAll("button"); var last = bs[bs.length - 1]; var inp = f.querySelector("input"); var ic = f.firstElementChild; return { icon: ic ? ic.textContent : "", words: sp ? sp.textContent : "", input: inp ? inp.value : null, button: last ? last.textContent : "", lastIsButton: !!last && f.lastElementChild === last }; }))'); return (JSON.parse(j) || []).map(function (x) { x.icon = clean(x.icon); x.words = clean(x.words); x.button = clean(x.button); return x; }); };
    const press = function (n) { return chrome.evaluate('(function () { var f = [].filter.call(((' + panel + ') || document.createElement("div")).querySelectorAll(".shell-row-form"), function (f) { return f.getBoundingClientRect().height > 0; })[' + n + ']; var b = f && f.querySelectorAll("button"); var last = b && b[b.length - 1]; if (last) last.click(); return !!last; }())'); };
    const stateOf = function () { try { return JSON.parse(fs.readFileSync(stateFile('hearing'), 'utf8')); } catch (e) { return {}; } };
    const disk = path.join(node.root, 'spirit', 'run', 'spirit', 'app', 'hearing', 'hearing.json');
    const fileBefore = fs.readFileSync(disk, 'utf8');
    const waitForm = function (n, test2) { return until(function () { return forms().then(function (l) { return !!l[n] && test2(l[n]); }); }, 5000); };

    test.subHeading('"titlebar rowForm: [app-icon] "<app-label> [x]"');
    let l = await forms();
    // Four: the Allow row went (goal/G43.18, box v29).
    ok(l.length === 4, 'the bar and three forms', 'forms in the panel: ' + short(l));
    const none = { icon: '', words: '', button: '', input: null, lastIsButton: false };
    const bar = l[0] || none;
    ok(bar.icon.indexOf('🦻') !== -1 && bar.words === monitorLabel, 'the bar: the app\'s icon and label', 'the bar: ' + short(bar));
    ok(bar.lastIsButton && /^[x✕×]$/i.test(bar.button), 'its last element is the x', 'the bar\'s button: ' + short(bar));

    test.subHeading('"row 0: rowForm: [✏️] "Icon" [iconSelector:dropdown] [Change]"');
    const r0 = l[1] || none;
    ok(r0.icon.indexOf('✏') !== -1 && r0.words.indexOf('Icon') !== -1 && r0.button === 'Change', 'the pencil, Icon, Change', 'row 0: ' + short(r0));
    ok(r0.words.indexOf('🦻') !== -1, 'the selector shows the app\'s icon', 'row 0 shows: ' + short(r0.words));
    await chrome.evaluate('spirit.app.iconApp({ key: "hearing", icon: "🧪" }).then(function () { return true; }, function () { return false; })');
    const newIcon = await until(function () { return forms().then(function (x) { return !!x[0] && x[0].icon.indexOf('🧪') !== -1; }); }, 5000);
    ok(newIcon, 'a changed icon reaches the bar, by the stream', 'the bar after a changed icon: ' + short((await forms())[0]));
    ok(stateOf().icon === '🧪', 'it lands in spirit/state/hearing/node.json', 'node.json: ' + short(stateOf()));
    ok(fs.readFileSync(disk, 'utf8') === fileBefore, 'and not in hearing.json', 'hearing.json was written');
    await chrome.evaluate('spirit.app.iconApp({ key: "hearing", icon: "🦻" }).then(function () { return true; }, function () { return false; })');
    await until(function () { return forms().then(function (x) { return !!x[0] && x[0].icon.indexOf('🦻') !== -1; }); }, 5000);

    test.subHeading('"row 1: rowForm: [✏️] "Label" [label input box] [Change]"');
    const r1 = l[2] || none;
    ok(r1.icon.indexOf('✏') !== -1 && r1.words.indexOf('Label') !== -1 && r1.input === monitorLabel && r1.button === 'Change', 'the pencil, Label, the box holding the label, Change', 'row 1: ' + short(r1));

    test.subHeading('row 2: "if active: [🟢] "Deactivate <app-label> "face" ..." [🔴]", "if inactive: [🔴] "Activate ..." [🟢]"');
    // The words name what it mounts, read from hearing.json after the row is drawn: judged once that read has had its time,
    // as the rows below are, not on the panel's first look (goal/G43.32, the panel now opens before the read answers).
    const r2ok = function (x) { return x.icon.indexOf('🟢') !== -1 && x.words === 'Deactivate ' + monitorLabel + ' face' && x.button === '🔴'; };
    const r2seen = await waitForm(3, r2ok);
    const r2 = (await forms())[3] || none;
    ok(r2seen && r2ok(r2), 'Hearing is active, and mounts a face only: [🟢] Deactivate Hearing face [🔴]', 'row 2: ' + short(r2));
    await press(3);
    const wentOff = await waitForm(3, function (x) { return x.icon.indexOf('🔴') !== -1 && x.words === 'Activate ' + monitorLabel + ' face' && x.button === '🟢'; });
    ok(wentOff && stateOf().active === false, 'a press: [🔴] Activate Hearing face [🟢], and active false in node.json', 'after a press: ' + short((await forms())[3]) + ' ' + short(stateOf()));
    await press(3);
    const wentOn = await waitForm(3, function (x) { return x.words === 'Deactivate ' + monitorLabel + ' face'; });
    ok(wentOn && stateOf().active === true, 'a press back turns it on', 'after a press back: ' + short((await forms())[3]));

    // Row 3, the Allow row, went (goal/G43.18, box v29: "the Allow row of the app detail and its element ... are deleted").
    test.subHeading('goal/G43.18: no Allow row: "<name>.json alone says whether an app may be a shell"');
    ok(!l.slice(1).some(function (x) { return /allow .* as shell/i.test(x.words || ''); }), 'no row says Allow or Don\'t allow as shell', 'a row still does: ' + short(l));

    test.subHeading('Q4: a changed label goes in node.json, and every row follows');
    await chrome.evaluate('(function () { var f = [].filter.call(((' + panel + ') || document.createElement("div")).querySelectorAll(".shell-row-form"), function (f) { return f.getBoundingClientRect().height > 0; })[2]; var i = f && f.querySelector("input"); if (!i) return false; i.value = "Renamed"; i.dispatchEvent(new Event("input", { bubbles: true })); return true; }())');
    await press(2);
    const renamed = await until(function () { return Promise.resolve(stateOf().label === 'Renamed'); }, 5000);
    ok(renamed, 'Change writes label to spirit/state/hearing/node.json', 'node.json: ' + short(stateOf()));
    ok(fs.readFileSync(disk, 'utf8') === fileBefore, 'and not to hearing.json', 'hearing.json was written');
    const inRow = await until(function () { return chrome.evaluate('(function () { var r = spirit.data.app.data.rows().hearing; return !!r && r.label === "Renamed"; }())'); }, 5000);
    ok(inRow, 'the stream brings it to the row', 'the row: ' + short(await chrome.evaluate('JSON.stringify(spirit.data.app.data.rows().hearing)')));
    const follows = await until(function () { return forms().then(function (x) { return !!x[0] && !!x[3] && x[0].words === 'Renamed' && x[3].words === 'Deactivate Renamed face'; }); }, 5000);
    ok(follows, 'the bar and the rows of the panel say it', 'the panel: ' + short(await forms()));
    await chrome.evaluate('(function () { var f = [].filter.call(((' + panel + ') || document.createElement("div")).querySelectorAll(".shell-row-form"), function (f) { return f.getBoundingClientRect().height > 0; })[2]; var i = f && f.querySelector("input"); if (!i) return false; i.value = ' + JSON.stringify(monitorLabel) + '; i.dispatchEvent(new Event("input", { bubbles: true })); return true; }())');
    await press(2);
    await until(function () { return Promise.resolve(stateOf().label === monitorLabel); }, 5000);
    await until(function () { return chrome.evaluate('(function () { var r = spirit.data.app.data.rows().hearing; return !!r && r.label === ' + JSON.stringify(monitorLabel) + '; }())'); }, 5000);
    ok(!/Uptime|waiting/i.test(await chrome.evaluate('String((' + panel + ' || {}).innerText || "")')), 'the app itself does not open', 'the panel launched the app');
    const shut = await closePanel();
    const backAgain = shut && await until(function () { return chrome.evaluate('(function () { var r = ' + rowOf(monitorLabel) + '; return !!r && r.offsetParent !== null; }())'); }, 4000);
    ok(backAgain, 'its x brings the list back', 'after close: ' + short(await inFaces()));

    test.subHeading('""face" only displays if shell.mount==true", ""server" only displays if node.mount==true", ""and" is only displayed of both are true"');
    const rewrite = function (shellMount, nodeMount) { const j = JSON.parse(fileBefore); j.shell = Object.assign({}, j.shell, { mount: shellMount }); j.node = Object.assign({}, j.node, { mount: nodeMount }); fs.writeFileSync(disk, JSON.stringify(j)); };
    rewrite(true, true);
    await openPanel();
    const bothWords = await waitForm(3, function (x) { return x.words === 'Deactivate ' + monitorLabel + ' face and server'; });
    ok(bothWords, 'both: Deactivate Hearing face and server', 'with both: ' + short((await forms())[3]));
    ok((await forms()).length === 4, 'and no Allow row (goal/G43.18)', 'with both, forms: ' + short(await forms()));
    await closePanel();
    rewrite(false, true);
    await openPanel();
    const serverWords = await waitForm(3, function (x) { return x.words === 'Deactivate ' + monitorLabel + ' server'; });
    ok(serverWords, 'node.mount alone: Deactivate Hearing server', 'with node.mount alone: ' + short((await forms())[3]));
    ok((await forms()).length === 4, 'with shell.mount false, and no Allow row (goal/G43.18)', 'with shell.mount false, forms: ' + short(await forms()));
    await closePanel();
    fs.writeFileSync(disk, fileBefore);
    

    test.subHeading('the box: "in :tiles mode, only activated apps will appear."');
    await chrome.evaluate('(function () { var t = document.querySelector("#faces .list-toggle"); if (t) t.click(); return !!t; }())');
    const onlyActive = await until(function () { return chrome.evaluate('!!' + tileOf(monitorLabel) + ' && !' + tileOf(serverLabel)); }, 5000);
    ok(onlyActive, 'the toggle shows tiles: Hearing, active, and not starter', 'the tiles: ' + short(await inFaces()));
    await mount({ face: 'tiles' });
    const direct = await until(function () { return chrome.evaluate('!!' + tileOf(monitorLabel) + ' && !' + tileOf(serverLabel)); }, 5000);
    ok(direct, 'face tiles from the start: the same', 'the tiles: ' + short(await inFaces()));
    await chrome.evaluate('spirit.app.activeApp({ key: "starter", active: true })');
    const arrives = await until(function () { return chrome.evaluate('!!' + tileOf(serverLabel)); }, 5000);
    ok(arrives, 'an app made active appears, no search asked', 'the tiles after starter turned on: ' + short(await inFaces()));
    await chrome.evaluate('spirit.app.activeApp({ key: "starter", active: false })');
    const leaves = await until(function () { return chrome.evaluate('!' + tileOf(serverLabel)); }, 5000);
    ok(leaves, 'an app made inactive leaves', 'the tiles after starter turned off: ' + short(await inFaces()));

    test.subHeading('the box: "in :tiles mode, appSelector icons will \'launch\'", "its open and close move into appSelector"');
    await chrome.evaluate('(function () { var t = ' + tileOf(monitorLabel) + '; if (t) t.click(); return !!t; }())');
    const opened = await until(function () { return chrome.evaluate('(function () { var p = ' + inPanel('.app-container-pane') + '; return !!p && /Uptime|waiting/i.test(String(p.innerText)); }())'); }, 10000);
    ok(opened, 'a tile opens its app inside, through its main element, spirit/app/monitor/element.js (goal/G43.32)', 'a tile opened: ' + short(await inFaces()));
    const launchedBar = await chrome.evaluate('(function () { var f = ' + inPanel('.shell-row-form') + '; if (!f) return "no form"; var b = f.lastElementChild; return b && b.tagName === "BUTTON" && String(f.textContent).indexOf(' + JSON.stringify(monitorLabel) + ') !== -1 ? "form" : f.innerHTML; }())');
    ok(launchedBar === 'form', 'the box: "the title bar of all panels": a launched app\'s bar is the same rowForm', 'a launched app\'s bar: ' + short(launchedBar));
    await chrome.evaluate('(function () { var c = ' + inPanel('.app-container-close') + '; if (c) c.click(); return !!c; }())');
    const closed = await until(function () { return chrome.evaluate('!' + panel + ' && !!' + tileOf(monitorLabel)); }, 5000);
    ok(closed, 'its close icon brings the tiles back', 'after close: ' + short(await inFaces()));
    await chrome.evaluate('(function () { var c = document.getElementById("faces"); if (window.fs.destroy) window.fs.destroy(); if (c) c.remove(); return true; }())');
    }
    // ── NO TILE WITHOUT shell.mount, AND A FACE FOR EVERY ONE THAT SAYS IT (goal/G43.20) ──
    // Andy: "all, MAKE SURE aN APP WITHOUT shell:mount NEVER SHOWS A FUCKING TILE!", and "where is your test that scans the app
    // folders and makes sure that app search complies with the spec, and doesn't show tiles for ANY app with shell:mound:false?".
    // Every app is made active first, so "only activated apps" cannot be what keeps a tile away.
    {
      const APPS = path.join(node.root, 'spirit', 'run', 'spirit', 'app');
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
      const tree = fs.readdirSync(APPS).filter(function (n) { return !PLANT[n] && fs.existsSync(path.join(APPS, n, n + '.json')); }).map(function (n) {
        let j = {};
        try { j = JSON.parse(fs.readFileSync(path.join(APPS, n, n + '.json'), 'utf8')); } catch (e) { j = {}; }
        return { key: n, label: String((j.identity && j.identity.label) || n), mount: !!(j.shell && j.shell.mount === true), run: !!(j.node && j.node.run === true) };
      });
      const treeOff = tree.filter(function (a) { return !a.mount && a.key !== 'app'; });
      ok(treeOff.length >= 1, 'the world: the tree has apps without shell.mount true', 'every app of the tree says shell.mount true: nothing of the tree to judge');

      await chrome.send('Page.navigate', { url: node.base + '/face.html' });
      await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
      const loaded = await chrome.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/app/app/element.js"); }).then(function () { return "loaded"; }, function (e) { return String(e && e.message || e); })');
      ok(loaded === 'loaded', 'the world: appSelector loads', 'appSelector did not load: ' + short(loaded));
      if (loaded !== 'loaded') return;

      // EVERY APP ACTIVE, planted and the tree's: what keeps a tile away below can only be shell.mount.
      const keys = Object.keys(PLANT).concat(treeOff.map(function (a) { return a.key; }));
      const rows = function () { return chrome.evaluate('(function () { var r = (spirit.data.app && spirit.data.app.data) ? spirit.data.app.data.rows() : {}; var out = {}; ' + JSON.stringify(keys) + '.forEach(function (k) { out[k] = r[k] ? { active: r[k].active === true } : null; }); return JSON.stringify(out); }())').then(function (s) { try { return JSON.parse(s); } catch (e) { return {}; } }); };
      await chrome.evaluate('(function () { var a = spirit.app && spirit.app.activeApp; if (!a) return false; ' + JSON.stringify(keys) + '.forEach(function (k) { try { a({ key: k, active: true }); } catch (e) { /* the row below says */ } }); return true; }())');
      await until(function () { return rows().then(function (r) { return keys.every(function (k) { return r[k] && r[k].active; }); }); }, 10000);
      // A row the node would not make active through the verb is made active on its disc, as a user's earlier press left it.
      let r = await rows();
      const notYet = keys.filter(function (k) { return !(r[k] && r[k].active); });
      notYet.forEach(function (k) { const d = path.join(node.root, 'spirit', 'run', 'spirit', 'state', k); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'node.json'), JSON.stringify({ active: true })); });
      if (notYet.length) { await until(function () { return rows().then(function (x) { return notYet.every(function (k) { return x[k] && x[k].active; }); }); }, 10000); r = await rows(); }
      // AN APP THAT SAYS node.run IS RUN, NEVER ACTIVE (goal/G43.21): it is a row, held inactive whatever its node.json says, so
      // two things keep its tile away; for every other app only shell.mount can.
      const runs = Object.keys(PLANT).filter(function (k) { return PLANT[k].run; }).concat(treeOff.filter(function (a) { return a.run; }).map(function (a) { return a.key; }));
      // Each app written out, the planted ones and the tree's without shell.mount true, so that each check has a plain title.
      const rowWhy = function (k) { return k + ' is no row at all: ' + short(r[k]); };
      const activeWhy = function (k) { return k + ' is no active row, so its missing tile would judge nothing: ' + short(r[k]); };
      ok(!!(r['zzmounted'] && r['zzmounted'].active), 'the world: zzmounted is a row, active', activeWhy('zzmounted'));
      ok(!!(r['zzmountfalse'] && r['zzmountfalse'].active), 'the world: zzmountfalse is a row, active', activeWhy('zzmountfalse'));
      ok(!!(r['zznoshell'] && r['zznoshell'].active), 'the world: zznoshell is a row, active', activeWhy('zznoshell'));
      ok(!!(r['zznomount'] && r['zznomount'].active), 'the world: zznomount is a row, active', activeWhy('zznomount'));
      ok(!!(r['zzstringmount'] && r['zzstringmount'].active), 'the world: zzstringmount is a row, active', activeWhy('zzstringmount'));
      ok(!!(r['zzonemount'] && r['zzonemount'].active), 'the world: zzonemount is a row, active', activeWhy('zzonemount'));
      ok(!!(r['zzshellnull'] && r['zzshellnull'].active), 'the world: zzshellnull is a row, active', activeWhy('zzshellnull'));
      ok(!!r['zzrunonly'], 'the world: zzrunonly is a row, run only, never active', rowWhy('zzrunonly'));
      ok(!!(r['backup'] && r['backup'].active), 'the world: backup is a row, active', activeWhy('backup'));
      ok(!!(r['deskClient'] && r['deskClient'].active), 'the world: deskClient is a row, active', activeWhy('deskClient'));
      ok(!!(r['deskVerify'] && r['deskVerify'].active), 'the world: deskVerify is a row, active', activeWhy('deskVerify'));
      ok(!!r['publishData'], 'the world: publishData is a row, run only, never active', rowWhy('publishData'));
      ok(!!r['pushOrigin'], 'the world: pushOrigin is a row, run only, never active', rowWhy('pushOrigin'));

      const mount = function (opts) { return chrome.evaluate('(function () { var old = document.getElementById("faces"); if (old) { if (window.fsel) window.fsel.destroy(); old.remove(); } var c = document.createElement("div"); c.id = "faces"; c.style.cssText = "position:fixed;left:0;top:0;width:1200px;height:800px;display:flex;flex-direction:column;background:#111"; document.body.appendChild(c); window.fsel = spirit.element.spirit.app.app.element.create(c, ' + JSON.stringify(opts) + '); if (window.fsel.parentNode !== c) c.appendChild(window.fsel); return true; }())'); };
      // The labels drawn as tiles: every visible leaf under the tiles whose text is a label of the test's.
      const LABELS = Object.keys(PLANT).map(function (k) { return PLANT[k].label; }).concat(treeOff.map(function (a) { return a.label; }));
      const drawn = function () { return chrome.evaluate('(function () { var c = document.getElementById("faces"); if (!c) return "[]"; var want = ' + JSON.stringify(LABELS) + '; var out = []; var all = c.querySelectorAll("*"); for (var i = 0; i < all.length; i++) { var e = all[i]; if (!e.getClientRects().length) continue; var t = String(e.innerText || e.textContent || "").trim(); if (!e.children.length && want.indexOf(t) !== -1 && out.indexOf(t) === -1) out.push(t); } return JSON.stringify(out.sort()); }())').then(function (s) { try { return JSON.parse(s); } catch (e) { return []; } }); };
      const judge = async function (how) {
        const seen = await until(function () { return drawn().then(function (d) { return d.indexOf(PLANT.zzmounted.label) !== -1; }); }, 8000);
        const held12 = seen;
        const why12 = how + ': not even the mounted app shows a tile, so nothing is judged: ' + short(await drawn());
        if (how === 'tiles') ok(held12, 'tiles: the app that says shell.mount true shows its tile', why12);
        else if (how === 'toggled tiles') ok(held12, 'toggled tiles: the app that says shell.mount true shows its tile', why12);
        else if (how === 'the app app\'s tiles') ok(held12, 'the app app\'s tiles: the app that says shell.mount true shows its tile', why12);
        await sleep(800);
        const d = await drawn();
        Object.keys(PLANT).filter(function (k) { return !PLANT[k].tile; }).forEach(function (k) {
          const held11 = d.indexOf(PLANT[k].label) === -1;
          const why11 = how + ': ' + k + ' shows a tile, its json ' + short('shell' in PLANT[k] ? PLANT[k].shell : 'no shell part');
          if (how + ': ' + k === 'tiles: zzmountfalse') ok(held11, 'tiles: zzmountfalse (shell.mount false) shows no tile', why11);
          else if (how + ': ' + k === 'tiles: zznoshell') ok(held11, 'tiles: zznoshell (no shell part) shows no tile', why11);
          else if (how + ': ' + k === 'tiles: zznomount') ok(held11, 'tiles: zznomount (no shell.mount) shows no tile', why11);
          else if (how + ': ' + k === 'tiles: zzstringmount') ok(held11, 'tiles: zzstringmount (shell.mount the string true) shows no tile', why11);
          else if (how + ': ' + k === 'tiles: zzonemount') ok(held11, 'tiles: zzonemount (shell.mount 1) shows no tile', why11);
          else if (how + ': ' + k === 'tiles: zzshellnull') ok(held11, 'tiles: zzshellnull (shell null) shows no tile', why11);
          else if (how + ': ' + k === 'tiles: zzrunonly') ok(held11, 'tiles: zzrunonly (run only, shell.mount false) shows no tile', why11);
          else if (how + ': ' + k === 'toggled tiles: zzmountfalse') ok(held11, 'toggled tiles: zzmountfalse (shell.mount false) shows no tile', why11);
          else if (how + ': ' + k === 'toggled tiles: zznoshell') ok(held11, 'toggled tiles: zznoshell (no shell part) shows no tile', why11);
          else if (how + ': ' + k === 'toggled tiles: zznomount') ok(held11, 'toggled tiles: zznomount (no shell.mount) shows no tile', why11);
          else if (how + ': ' + k === 'toggled tiles: zzstringmount') ok(held11, 'toggled tiles: zzstringmount (shell.mount the string true) shows no tile', why11);
          else if (how + ': ' + k === 'toggled tiles: zzonemount') ok(held11, 'toggled tiles: zzonemount (shell.mount 1) shows no tile', why11);
          else if (how + ': ' + k === 'toggled tiles: zzshellnull') ok(held11, 'toggled tiles: zzshellnull (shell null) shows no tile', why11);
          else if (how + ': ' + k === 'toggled tiles: zzrunonly') ok(held11, 'toggled tiles: zzrunonly (run only, shell.mount false) shows no tile', why11);
          else if (how + ': ' + k === 'the app app\'s tiles: zzmountfalse') ok(held11, 'the app app\'s tiles: zzmountfalse (shell.mount false) shows no tile', why11);
          else if (how + ': ' + k === 'the app app\'s tiles: zznoshell') ok(held11, 'the app app\'s tiles: zznoshell (no shell part) shows no tile', why11);
          else if (how + ': ' + k === 'the app app\'s tiles: zznomount') ok(held11, 'the app app\'s tiles: zznomount (no shell.mount) shows no tile', why11);
          else if (how + ': ' + k === 'the app app\'s tiles: zzstringmount') ok(held11, 'the app app\'s tiles: zzstringmount (shell.mount the string true) shows no tile', why11);
          else if (how + ': ' + k === 'the app app\'s tiles: zzonemount') ok(held11, 'the app app\'s tiles: zzonemount (shell.mount 1) shows no tile', why11);
          else if (how + ': ' + k === 'the app app\'s tiles: zzshellnull') ok(held11, 'the app app\'s tiles: zzshellnull (shell null) shows no tile', why11);
          else if (how + ': ' + k === 'the app app\'s tiles: zzrunonly') ok(held11, 'the app app\'s tiles: zzrunonly (run only, shell.mount false) shows no tile', why11);
        });
        treeOff.forEach(function (a) {
          const held10 = d.indexOf(a.label) === -1;
          const why10 = how + ': the tree\'s ' + a.key + ' shows a tile without shell.mount true';
          if (how + ': ' + a.key === 'tiles: backup') ok(held10, 'tiles: the tree\'s backup shows no tile', why10);
          else if (how + ': ' + a.key === 'tiles: deskClient') ok(held10, 'tiles: the tree\'s deskClient shows no tile', why10);
          else if (how + ': ' + a.key === 'tiles: deskVerify') ok(held10, 'tiles: the tree\'s deskVerify shows no tile', why10);
          else if (how + ': ' + a.key === 'tiles: publishData') ok(held10, 'tiles: the tree\'s publishData shows no tile', why10);
          else if (how + ': ' + a.key === 'tiles: pushOrigin') ok(held10, 'tiles: the tree\'s pushOrigin shows no tile', why10);
          else if (how + ': ' + a.key === 'toggled tiles: backup') ok(held10, 'toggled tiles: the tree\'s backup shows no tile', why10);
          else if (how + ': ' + a.key === 'toggled tiles: deskClient') ok(held10, 'toggled tiles: the tree\'s deskClient shows no tile', why10);
          else if (how + ': ' + a.key === 'toggled tiles: deskVerify') ok(held10, 'toggled tiles: the tree\'s deskVerify shows no tile', why10);
          else if (how + ': ' + a.key === 'toggled tiles: publishData') ok(held10, 'toggled tiles: the tree\'s publishData shows no tile', why10);
          else if (how + ': ' + a.key === 'toggled tiles: pushOrigin') ok(held10, 'toggled tiles: the tree\'s pushOrigin shows no tile', why10);
          else if (how + ': ' + a.key === 'the app app\'s tiles: backup') ok(held10, 'the app app\'s tiles: the tree\'s backup shows no tile', why10);
          else if (how + ': ' + a.key === 'the app app\'s tiles: deskClient') ok(held10, 'the app app\'s tiles: the tree\'s deskClient shows no tile', why10);
          else if (how + ': ' + a.key === 'the app app\'s tiles: deskVerify') ok(held10, 'the app app\'s tiles: the tree\'s deskVerify shows no tile', why10);
          else if (how + ': ' + a.key === 'the app app\'s tiles: publishData') ok(held10, 'the app app\'s tiles: the tree\'s publishData shows no tile', why10);
          else if (how + ': ' + a.key === 'the app app\'s tiles: pushOrigin') ok(held10, 'the app app\'s tiles: the tree\'s pushOrigin shows no tile', why10);
        });
      };

      test.subHeading('Andy: "MAKE SURE aN APP WITHOUT shell:mount NEVER SHOWS A FUCKING TILE!": tiles from the start');
      await mount({ face: 'tiles' });
      await judge('tiles');

      test.subHeading('the same, tiles reached by the toggle from the pane');
      await mount({ face: 'pane', toggle: true });
      await until(function () { return chrome.evaluate('String(document.getElementById("faces").innerText).indexOf(' + JSON.stringify(PLANT.zzmounted.label) + ') !== -1'); }, 8000);
      const flipped = await chrome.evaluate('(function () { var bs = document.getElementById("faces").querySelectorAll("button"); for (var i = 0; i < bs.length; i++) if (String(bs[i].textContent).indexOf("\u25A6") !== -1) { bs[i].click(); return true; } return false; }())');
      ok(flipped === true, 'the world: the pane has a toggle to press', 'no toggle found on the pane: the toggled tiles are not judged');
      if (flipped === true) await judge('toggled tiles');

      test.subHeading('the app app\'s own tiles, as boot.js mounts it: no options (goal/G43.32)');
      await mount();
      await judge('the app app\'s tiles');

      test.subHeading('never: an app that loses shell.mount on its disc loses its tile, no reload');
      await mount({ face: 'tiles' });
      await until(function () { return drawn().then(function (d) { return d.indexOf(PLANT.zzmounted.label) !== -1; }); }, 8000);
      const file = path.join(APPS, 'zzmounted', 'zzmounted.json');
      const j = JSON.parse(fs.readFileSync(file, 'utf8'));
      j.shell.mount = false;
      fs.writeFileSync(file, JSON.stringify(j, null, 2));
      const left = await until(function () { return drawn().then(function (d) { return d.indexOf(PLANT.zzmounted.label) === -1; }); }, 8000);
      ok(left, 'its tile leaves the moment its json says shell.mount false', 'its tile stayed after its json said shell.mount false: ' + short(await drawn()) + '; its row: ' + short(await chrome.evaluate('JSON.stringify(spirit.data.app.data.rows().zzmounted)')));
      delete j.shell;
      fs.writeFileSync(file, JSON.stringify(j, null, 2));
      await sleep(1500);
      ok((await drawn()).indexOf(PLANT.zzmounted.label) === -1, 'and with its shell part gone it does not come back', 'with its shell part gone its tile came back');
      j.shell = { true: false, mount: true, tile: true };
      fs.writeFileSync(file, JSON.stringify(j, null, 2));
      const back = await until(function () { return drawn().then(function (d) { return d.indexOf(PLANT.zzmounted.label) !== -1; }); }, 8000);
      ok(back, 'and saying shell.mount true again brings it back', 'shell.mount true again did not bring its tile back, so the leaving judged nothing: ' + short(await drawn()));

      // AN APP THAT CLAIMS A FACE SUPPLIES ONE (Andy: "where is the test that verifies that an app who claims to have a face,
      // also actually supplies a fucking face?"): every app of the tree whose json says shell.mount true, its tile pressed, draws
      // something in the layer it opens. The app app is left out: it hides itself from the tiles (goal/G43.18, G43.32).
      test.subHeading('Andy: "an app who claims to have a face, also actually supplies a fucking face"');
      const treeOn = tree.filter(function (a) { return a.mount && a.key !== 'app'; });
      ok(treeOn.length >= 1, 'the world: the tree has apps that say shell.mount true', 'no app of the tree says shell.mount true: nothing to judge');
      treeOn.forEach(function (a) {
        // Its main element, spirit/app/<name>/element.js (goal/G43.32, rule 4).
        const f = path.join(APPS, a.key, 'element.js');
        const held9 = fs.existsSync(f);
        const why9 = a.key + ' says shell.mount true and has no spirit/app/' + a.key + '/element.js';
        if (a.key === 'agent') ok(held9, 'agent: its face script spirit/app/agent/element.js is there', why9);
        else if (a.key === 'chat') ok(held9, 'chat: its face script spirit/app/chat/element.js is there', why9);
        else if (a.key === 'contact') ok(held9, 'contact: its face script spirit/app/contact/element.js is there', why9);
        else if (a.key === 'desk') ok(held9, 'desk: its face script spirit/app/desk/element.js is there', why9);
        else if (a.key === 'file') ok(held9, 'file: its face script spirit/app/file/element.js is there', why9);
        else if (a.key === 'grants') ok(held9, 'grants: its face script spirit/app/grants/element.js is there', why9);
        else if (a.key === 'icons') ok(held9, 'icons: its face script spirit/app/icons/element.js is there', why9);
        else if (a.key === 'info') ok(held9, 'info: its face script spirit/app/info/element.js is there', why9);
        else if (a.key === 'introSpector') ok(held9, 'introSpector: its face script spirit/app/introSpector/element.js is there', why9);
        else if (a.key === 'job') ok(held9, 'job: its face script spirit/app/job/element.js is there', why9);
        else if (a.key === 'join') ok(held9, 'join: its face script spirit/app/join/element.js is there', why9);
        else if (a.key === 'media') ok(held9, 'media: its face script spirit/app/media/element.js is there', why9);
        else if (a.key === 'monitor') ok(held9, 'monitor: its face script spirit/app/monitor/element.js is there', why9);
        else if (a.key === 'starter') ok(held9, 'starter: its face script spirit/app/starter/element.js is there', why9);
        else if (a.key === 'testicle') ok(held9, 'testicle: its face script spirit/app/testicle/element.js is there', why9);
        else if (a.key === 'text') ok(held9, 'text: its face script spirit/app/text/element.js is there', why9);
      });
      await chrome.evaluate('(function () { ' + JSON.stringify(treeOn.map(function (a) { return a.key; })) + '.forEach(function (k) { try { spirit.app.activeApp({ key: k, active: true }); } catch (e) { /* the tile says */ } }); return true; }())');
      const onKeys = JSON.stringify(treeOn.map(function (a) { return a.key; }));
      const allOn = await until(function () { return chrome.evaluate('(function () { var r = spirit.data.app.data.rows(); return ' + onKeys + '.every(function (k) { return !!r[k] && r[k].active === true; }); }())'); }, 10000);
      ok(allOn, 'the world: every app that says shell.mount true is active', 'not all are active: ' + short(await chrome.evaluate('(function () { var r = spirit.data.app.data.rows(); return JSON.stringify(' + onKeys + '.filter(function (k) { return !(r[k] && r[k].active === true); })); }())')));
      await mount({ face: 'tiles' });
      const shown = 'Array.prototype.filter.call(document.querySelectorAll("#faces .app-container"), function (c) { return c.offsetParent !== null; })[0]';
      for (const a of treeOn) {
        const tile = 'Array.prototype.filter.call(document.querySelectorAll("#faces .app-icon"), function (t) { return t.offsetParent !== null && String(t.textContent).indexOf(' + JSON.stringify(a.label) + ') !== -1; })[0]';
        const there = await until(function () { return chrome.evaluate('!!' + tile); }, 8000);
        if (!there) { test.fail(a.key + ' says shell.mount true and shows no tile to press: ' + short(await drawn())); continue; }
        await chrome.evaluate('(function () { window.pageErrors = []; window.addEventListener("error", function (e) { window.pageErrors.push(String(e.message)); }); window.addEventListener("unhandledrejection", function (e) { window.pageErrors.push(String(e.reason && e.reason.message || e.reason)); }); var t = ' + tile + '; t.click(); return true; }())');
        // A face is drawn: the opened layer's pane holds a visible element of some size, beyond the bare pane itself.
        const drew = await until(function () { return chrome.evaluate('(function () { var c = ' + shown + '; if (!c) return false; var p = c.querySelector(".app-container-pane"); if (!p) return false; var all = p.querySelectorAll("*"); for (var i = 0; i < all.length; i++) { var r = all[i].getBoundingClientRect(); if (r.width > 4 && r.height > 4 && (String(all[i].innerText || "").trim() || /^(CANVAS|SVG|IMG|VIDEO|INPUT|TEXTAREA|BUTTON|IFRAME)$/i.test(all[i].tagName))) return true; } return false; }())'); }, 10000);
        const errs = await chrome.evaluate('JSON.stringify(window.pageErrors || [])');
        const held8 = drew;
        const why8 = a.key + ' says shell.mount true and its tile drew no face; page errors: ' + short(errs) + '; the layer: ' + short(await chrome.evaluate('(function () { var c = ' + shown + '; return c ? c.innerHTML : "no layer shown"; }())'));
        if (a.key === 'agent') ok(held8, 'agent: its tile opens a face that draws', why8);
        else if (a.key === 'chat') ok(held8, 'chat: its tile opens a face that draws', why8);
        else if (a.key === 'contact') ok(held8, 'contact: its tile opens a face that draws', why8);
        else if (a.key === 'desk') ok(held8, 'desk: its tile opens a face that draws', why8);
        else if (a.key === 'file') ok(held8, 'file: its tile opens a face that draws', why8);
        else if (a.key === 'grants') ok(held8, 'grants: its tile opens a face that draws', why8);
        else if (a.key === 'icons') ok(held8, 'icons: its tile opens a face that draws', why8);
        else if (a.key === 'info') ok(held8, 'info: its tile opens a face that draws', why8);
        else if (a.key === 'introSpector') ok(held8, 'introSpector: its tile opens a face that draws', why8);
        else if (a.key === 'job') ok(held8, 'job: its tile opens a face that draws', why8);
        else if (a.key === 'join') ok(held8, 'join: its tile opens a face that draws', why8);
        else if (a.key === 'media') ok(held8, 'media: its tile opens a face that draws', why8);
        else if (a.key === 'monitor') ok(held8, 'monitor: its tile opens a face that draws', why8);
        else if (a.key === 'starter') ok(held8, 'starter: its tile opens a face that draws', why8);
        else if (a.key === 'testicle') ok(held8, 'testicle: its tile opens a face that draws', why8);
        else if (a.key === 'text') ok(held8, 'text: its tile opens a face that draws', why8);
        await chrome.evaluate('(function () { var c = ' + shown + '; var x = c && c.querySelector(".app-container-close"); if (x) x.click(); return !!x; }())');
        await until(function () { return chrome.evaluate('!' + shown); }, 5000);
      }
    }
  } finally {
    try { if (chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
    try { if (chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () {}, function (e) { test.fail('the test threw ' + (e && e.stack || e)); }).then(async function () {
  // The parts below, each after the checks above, in order; one report for all.
  for (const part of [['nodeRun', nodeRunPart], ['shell', shellPart]]) {
    try { await part[1](); } catch (e) { test.fail('the ' + part[0] + ' part threw ' + (e && e.stack || e)); }
  }
  test.reportSuccessFailureCount();
  process.exit(0);
});

// ── THE nodeRun PART ─────────────────────────────────────────────────────────────────────────────────────────────
async function nodeRunPart() {
  // The nodeRun part of ./element.js.
  // AN APP THAT IS RUN, NOT MOUNTED (goal/G43.21; spec: ./element.md, its nodeRun section). Andy, the box: "spirit app search will list these jobs
  // (node:run) only in pane mode, bacause it they have no shell-mount. the app detail will show a run button.", and "the Andy
  // user on each box will run those scripts when he feels like it". A real Chrome on a scratch node's face page, the two
  // apps of the tree that say node.run, pushOrigin and publishData; neither Andy's node nor an agent's is touched. The scratch
  // tree is no git clone, so a pushOrigin started there pushes nothing.

  const fs = require('fs');
  const path = require('path');
  const RUN = path.resolve(__dirname, '..', '..', '..', '..');
  const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
  const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

  function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
  function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  const APPS = path.join(RUN, 'spirit', 'app');

  test.subHeading('nodeRun: an app that says node.run is listed in pane mode only, and its detail runs it (goal/G43.21)');

  await (async function () {
    // The tree's apps, from each <name>.json: which say node.run, and which mount as a shell app.
    const own = fs.readdirSync(APPS).filter(function (n) { return fs.existsSync(path.join(APPS, n, n + '.json')); }).map(function (n) {
      let j = {};
      try { j = JSON.parse(fs.readFileSync(path.join(APPS, n, n + '.json'), 'utf8')); } catch (e) { j = {}; }
      return { key: n, label: String((j.identity && j.identity.label) || n), icon: String((j.identity && j.identity.icon) || ''), run: !!(j.node && j.node.run === true), shell: !!(j.shell && j.shell.mount === true) };
    });
    const runs = own.filter(function (a) { return a.run; });
    const mounts = own.filter(function (a) { return a.shell && !a.run; });
    ok(runs.length >= 2 && mounts.length >= 1, 'the world: publishData and pushOrigin say node.run, and apps mount in the shell', 'nothing to judge with: ' + short(own));
    if (!runs.length || !mounts.length) return;
    const PUSH = own.filter(function (a) { return a.key === 'pushOrigin'; })[0];
    const node = await scratchNode();
    const chrome = await chromePage(findChrome());
    try {
      if (!node.up || chrome.error) { test.fail('no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '')); return; }
      const ask = async function (verb, args) { const r = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) }); try { return JSON.parse(await r.text()); } catch (e) { return null; } };
      await chrome.send('Page.navigate', { url: node.base + '/face.html' });
      await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
      const loaded = await chrome.evaluate('window.spirit.ready.then(function () { return Promise.all([spirit.require("spirit/element/search/app.js"), spirit.require("spirit/element/search/app/detailElement.js")]); }).then(function () { return "loaded"; }, function (e) { return String(e && e.message || e); })');
      ok(loaded === 'loaded', 'the world: the app search and the app detail load', 'they did not load: ' + short(loaded));
      // The app labels drawn anywhere under an element: its leaves whose text is an app's label.
      const LABELS = JSON.stringify(own.map(function (a) { return a.label; }));
      const drawnUnder = function (expr) { return chrome.evaluate('(function () { var root = ' + expr + '; if (!root) return []; var want = ' + LABELS + '; var out = []; var all = root.querySelectorAll("*"); for (var i = 0; i < all.length; i++) { var t = String(all[i].innerText || "").trim(); if (!all[i].children.length && want.indexOf(t) !== -1 && out.indexOf(t) === -1) out.push(t); } return out.sort(); }())'); };
      const has = function (list, a) { return list.indexOf(a.label) !== -1; };

      test.subHeading('Andy: "spirit app search will list these jobs (node:run) only in pane mode"');
      await chrome.evaluate('(function () { var c = document.createElement("div"); c.id = "pane"; document.body.appendChild(c); window.pane = spirit.element.spirit.element.search.app.create(c, { face: "pane" }); return true; }())');
      await until(function () { return drawnUnder('document.getElementById("pane")').then(function (d) { return runs.every(function (a) { return has(d, a); }); }); }, 8000);
      const inPane = await drawnUnder('document.getElementById("pane")');
      runs.forEach(function (a) {
        const held7 = has(inPane, a);
        const why7 = 'the pane does not list ' + a.label + ': ' + short(inPane);
        if (a.key === 'publishData') ok(held7, 'the pane lists Publish Data', why7);
        else if (a.key === 'pushOrigin') ok(held7, 'the pane lists Push Origin', why7);
      });
      await chrome.evaluate('(function () { window.pane.destroy(); var c = document.getElementById("pane"); if (c) c.remove(); return true; }())');
      // The dropdown, pressed open: its list floats, so the whole page is read, with nothing else of the test on it.
      await chrome.evaluate('(function () { var c = document.createElement("div"); c.id = "drop"; document.body.appendChild(c); window.drop = spirit.element.spirit.element.search.app.create(c, { face: "dropdown" }); return true; }())');
      await sleep(800);
      await chrome.evaluate('(function () { var d = window.drop, f = (d && d.list && d.list.field) || document.querySelector("#drop input, #drop [tabindex], #drop button"); if (f) f.click(); return !!f; }())');
      await until(function () { return drawnUnder('document.body').then(function (d) { return mounts.some(function (a) { return has(d, a); }); }); }, 8000);
      const inDrop = await drawnUnder('document.body');
      ok(mounts.some(function (a) { return has(inDrop, a); }), 'the world: pressed, the dropdown lists the apps that mount', 'the dropdown listed no app at all: nothing judged. ' + short(inDrop));
      runs.forEach(function (a) {
        const held6 = !has(inDrop, a);
        const why6 = 'the dropdown lists ' + a.label + ': ' + short(inDrop);
        if (a.key === 'publishData') ok(held6, 'the dropdown does not list Publish Data', why6);
        else if (a.key === 'pushOrigin') ok(held6, 'the dropdown does not list Push Origin', why6);
      });
      await chrome.evaluate('(function () { window.drop.destroy(); var c = document.getElementById("drop"); if (c) c.remove(); return true; }())');

      test.subHeading('Andy: "the app detail will show a run button"');
      // A Run button: a button whose own text is Run.
      const runButton = 'Array.prototype.filter.call(document.querySelectorAll("#detail button"), function (b) { return /\\bRun\\b/.test(String(b.textContent || "")); })[0]';
      const detailOf = function (a) { return chrome.evaluate('(function () { var old = document.getElementById("detail"); if (window.det) { window.det.destroy(); } if (old) old.remove(); var c = document.createElement("div"); c.id = "detail"; document.body.appendChild(c); window.det = spirit.element.spirit.element.search.app.detailElement.create(c, { row: ' + JSON.stringify({ key: a.key, label: a.label, icon: a.icon }) + ', panel: true }); return true; }())'); };
      for (const a of runs) {
        await detailOf(a);
        const shown = await until(function () { return chrome.evaluate('!!(' + runButton + ')'); }, 6000);
        const held5 = shown;
        const why5 = a.label + '\'s detail shows no Run: ' + short(await chrome.evaluate('String(document.getElementById("detail").innerText)'));
        if (a.key === 'publishData') ok(held5, 'Publish Data\'s detail shows a Run button', why5);
        else if (a.key === 'pushOrigin') ok(held5, 'Push Origin\'s detail shows a Run button', why5);
      }
      const plain = mounts[0];
      await detailOf(plain);
      await sleep(1500);
      const drew = await chrome.evaluate('String(document.getElementById("detail").innerText || "").indexOf(' + JSON.stringify(plain.label) + ') !== -1');
      const noRun = await chrome.evaluate('!(' + runButton + ')');
      ok(drew && noRun, 'Agent, which mounts and says no node.run, shows no Run', plain.label + '\'s detail: ' + short(await chrome.evaluate('String(document.getElementById("detail").innerText)')));

      // Andy: "in the app list and details: an app that only has node:run and no node:mount or shell:mount cannot be "activated"
      // show rowForms should knows that.", and "and the node should know it, too."
      test.subHeading('Andy: "an app that only has node:run and no node:mount or shell:mount cannot be "activated""');
      // An Activate or Deactivate row seen under an element: a leaf whose words start so (rowFormAppActive's "Activate <label> ...").
      const activateUnder = function (expr) { return chrome.evaluate('(function () { var root = ' + expr + '; if (!root) return null; return Array.prototype.filter.call(root.querySelectorAll("*"), function (e) { return !e.children.length && /^\\s*(de)?activate\\b/i.test(String(e.textContent || "")) && e.offsetParent !== null; }).length; }())'); };
      const only = runs.filter(function (a) { return !own.filter(function (o) { return o.key === a.key; }).some(function (o) { return o.shell; }); });
      // The row of an app in a pane list: the smallest element holding its label and a button, or its label alone.
      const rowOf = function (label) { return '(function () { var all = document.querySelectorAll("#rows tr, #rows .list-row"); for (var i = 0; i < all.length; i++) { if (String(all[i].innerText || "").indexOf(' + JSON.stringify(label) + ') !== -1) return all[i]; } return null; }())'; };
      await chrome.evaluate('(function () { var c = document.createElement("div"); c.id = "rows"; document.body.appendChild(c); window.rows = spirit.element.spirit.element.search.app.create(c, { face: "pane" }); return true; }())');
      await until(function () { return activateUnder(rowOf(plain.label)).then(function (n) { return n > 0; }); }, 8000);
      ok((await activateUnder(rowOf(plain.label))) > 0, 'the world: Agent\'s row in the app list shows Activate', plain.label + '\'s row shows no Activate: nothing judged');
      for (const a of only) {
        // What it mounts is read from its <name>.json after the row is drawn: given the time that takes.
        await until(function () { return activateUnder(rowOf(a.label)).then(function (n) { return n === 0; }); }, 4000);
        const n = await activateUnder(rowOf(a.label));
        const held4 = n === 0;
        const why4 = a.label + '\'s row shows ' + short(n) + ' Activate buttons';
        if (a.key === 'publishData') ok(held4, 'Publish Data\'s row in the app list shows no Activate', why4);
        else if (a.key === 'pushOrigin') ok(held4, 'Push Origin\'s row in the app list shows no Activate', why4);
      }
      await chrome.evaluate('(function () { window.rows.destroy(); var c = document.getElementById("rows"); if (c) c.remove(); return true; }())');
      await detailOf(plain);
      ok(await until(function () { return activateUnder('document.getElementById("detail")').then(function (n) { return n > 0; }); }, 6000), 'the world: Agent\'s detail shows Activate', plain.label + '\'s detail shows no Activate: nothing judged');
      for (const a of only) {
        await detailOf(a);
        await until(function () { return chrome.evaluate('!!(' + runButton + ')'); }, 6000);
        await sleep(800);
        const n = await activateUnder('document.getElementById("detail")');
        const held3 = n === 0;
        const why3 = a.label + '\'s detail shows ' + short(n) + ' Activate buttons';
        if (a.key === 'publishData') ok(held3, 'Publish Data\'s detail shows no Activate', why3);
        else if (a.key === 'pushOrigin') ok(held3, 'Push Origin\'s detail shows no Activate', why3);
      }
      test.subHeading('a press runs it, active or not');
      if (!PUSH || !PUSH.run) { test.fail('pushOrigin says no node.run: nothing to press'); return; }
      // Every job the node holds, each read whole, its module with it.
      const jobsOf = async function () { const got = await ask('job.search', { q: '' }); const out = []; for (const i of ((got && got.items) || [])) out.push(await ask('job.get', { key: i.key })); return JSON.stringify(out); };
      const before = await jobsOf();
      ok(before.indexOf('spirit.app.pushOrigin') === -1, 'the world: no job of pushOrigin before the press', 'a job of pushOrigin is there already: nothing judged');
      const activeNow = await ask('app.search', { q: '' });
      const pushRow = ((activeNow && activeNow.items) || []).filter(function (i) { return i.key === 'pushOrigin'; })[0];
      let pushActive;
      try { pushActive = JSON.parse(pushRow.label).active; } catch (e) { pushActive = undefined; }
      ok(pushActive !== true, 'the world: pushOrigin is not active on this node', 'pushOrigin is active here: the press would not show that Run asks for no activation');
      await detailOf(PUSH);
      await until(function () { return chrome.evaluate('!!(' + runButton + ')'); }, 6000);
      const pressed = await chrome.evaluate('(function () { var b = ' + runButton + '; if (!b) return false; b.click(); return true; }())');
      ok(pressed === true, 'its Run can be pressed', 'no Run to press');
      const started = await until(function () { return jobsOf().then(function (j) { return j.indexOf('spirit.app.pushOrigin') !== -1; }); }, 10000);
      ok(started, 'the press starts spirit/app/pushOrigin/pushOrigin.js, a job of spirit.app.pushOrigin, though the app is not active', 'no job of pushOrigin after the press: ' + short(await jobsOf()));

      // Andy: "and the node should know it, too." Asked last, since a node that takes it would leave the app active.
      test.subHeading('Andy: "and the node should know it, too."');
      for (const a of only) {
        const r = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'app.active', args: { key: a.key, active: true } }) });
        const t = await r.text();
        const listed = await ask('app.search', { q: '' });
        const row = ((listed && listed.items) || []).filter(function (i) { return i.key === a.key; })[0];
        let now;
        try { now = JSON.parse(row.label).active; } catch (e) { now = undefined; }
        const held2 = r.status >= 400 && now !== true;
        const why2 = 'app.active for ' + a.key + ' answered ' + r.status + ' ' + short(t) + ', active now ' + short(now);
        if (a.key === 'publishData') ok(held2, 'the node refuses app.active for publishData, and it stays inactive', why2);
        else if (a.key === 'pushOrigin') ok(held2, 'the node refuses app.active for pushOrigin, and it stays inactive', why2);
      }
    } finally {
      try { if (chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
      try { if (chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
      try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
      try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    }
  }());
}

// ── THE shell PART ───────────────────────────────────────────────────────────────────────────────────────────────
async function shellPart() {
  // The shell part of ./element.js.
  // THE APP APP AS THE SHELL, AND A SHELL THAT REPLACES ITSELF (goal/G43.18, box v29, "The shell" and "Join"; spec: ./element.md, its shell section).
  // Since goal/G43.32 the shell app is the app app (the box: "spirit/app/shell/ becomes spirit/app/app/. Its element.js is today's
  // spirit/app/appSelector.js; shell.js goes. app.json is shell.json, renamed"). A real
  // node on a scratch copy of the tracked files, with a shell-worthy app of the test's own beside the shell app, and real
  // clicks in a real Chrome on the page Andy uses at home, /face.html. Neither Andy's node nor an agent's is touched.

  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { spawn, execSync } = require('child_process');
  const RUN = path.resolve(__dirname, '..', '..', '..', '..');
  const REPO = path.resolve(RUN, '..', '..');
  const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
  const { freePort, until, sleep, chromePage, findChrome } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

  function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
  function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
  function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
  function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }

  // The test's own shell: it draws one line and nothing else, and knows nothing of Join.
  const MARK = 'zz shell drawn';
  const ZZ = { identity: { label: 'Zz Shell', icon: '🧪' }, shell: { true: true, mount: true, tile: true } };
  const ZZ_JS = '(function () { var b = document.createElement("div"); b.id = "zzShell"; b.textContent = ' + JSON.stringify(MARK) + '; document.body.appendChild(b); }());\n';
  function scratch() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-shellapp-'));
    execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
      .filter(function (f) { return fs.existsSync(path.join(REPO, f)); })
      .forEach(function (f) { const d = path.join(root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
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
    const child = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: run, stdio: 'ignore' });
    const base = 'http://127.0.0.1:' + port;
    const up = await until(function () { return call(base, 'api').then(function (r) { return r.status === 200; }); }, 60000);
    return { child: child, base: base, up: !!up };
  }
  function stop(c) { return new Promise(function (r) { if (!c || c.exitCode !== null) return r(); c.once('exit', function () { r(); }); c.kill(); setTimeout(r, 6000); }); }

  test.subHeading('shell: the app app as the shell, and a shell that replaces itself (goal/G43.18, G43.32)');

  await (async function () {
    const shellJson = readJson(path.join(RUN, 'spirit', 'app', 'app', 'app.json'));
    const SHELL_LABEL = String((shellJson && shellJson.identity && shellJson.identity.label) || '');
    ok(!!SHELL_LABEL, 'the world: the shell app has a label', 'spirit/app/app/app.json gives no label: ' + short(shellJson));
    const LABELS = fs.readdirSync(path.join(RUN, 'spirit', 'app')).map(function (n) { const j = readJson(path.join(RUN, 'spirit', 'app', n, n + '.json')); return j && j.identity && j.identity.label; }).filter(Boolean).concat([ZZ.identity.label]);

    const s = scratch();
    let N = null;
    let c = null;
    try {
      N = await boot(s.run);
      ok(N.up, 'the world: a scratch node comes up', 'the scratch node did not come up: nothing judged');
      if (!N.up) return;
      const where = findChrome();
      if (!where) { test.fail('no Chrome here: nothing judged'); return; }
      c = await chromePage(where);
      if (c.error) { test.fail('Chrome: ' + c.error); return; }
      const open = async function () {
        await c.evaluate('window.__zzOld = true').catch(function () {});
        await c.send('Page.navigate', { url: N.base + '/face.html' });
        const up = await until(function () { return c.evaluate('!window.__zzOld && document.readyState === "complete" && !!window.spirit'); }, 20000);
        await sleep(4000);
        return up;
      };
      const loaded = function () { return c.evaluate('performance.getEntriesByType("resource").map(function (e) { return e.name.replace(/^https?:\\/\\/[^/]+/, ""); })'); };
      const text = function () { return c.evaluate('String(document.body.innerText || "")'); };

      test.subHeading('the box: "spirit/app/shell/ ... is the default for home and face on a first boot" (Q12: no spirit/state/shell.json), the app app since goal/G43.32');
      ok(await open(), 'the world: the page opens', 'the page did not open: nothing judged');
      const first = await loaded();
      ok(first.some(function (n) { return /^\/spirit\/app\/app\/element\.js(\?|$)/.test(n); }), 'with no shell chosen the page loads spirit/app/app/element.js', 'it loaded: ' + short(first.filter(function (n) { return /\/app\//.test(n); })));
      ok(first.some(function (n) { return /^\/spirit\/element\/search\/app\.js(\?|$)/.test(n); }) && /\bContacts\b/.test(await text()), '"an app that wraps the app search": the app search is on the page, Contacts listed', 'the app search: ' + short(first.filter(function (n) { return /search/.test(n); })) + ', page: ' + short(await text()));

      // goal/G43.18, Andy: "the shell should exclude itself completely from the app-list, haha..."
      const keys = await c.evaluate('Array.prototype.slice.call(document.querySelectorAll("[data-key]")).filter(function (e) { return e.offsetParent !== null; }).map(function (e) { return e.getAttribute("data-key"); })');
      ok(keys.indexOf('contact') !== -1 && keys.indexOf('app') === -1 && !new RegExp('(^|\\n)\\s*' + SHELL_LABEL + '\\s*(\\n|$)').test(await text()), 'Andy: "the shell should exclude itself completely from the app-list": Contacts listed, the shell not', 'the list shows: ' + short(keys));

      test.subHeading('the box: "RULE: a shell must be able to replace itself", "boot.js ... then loads the shell the node names"');
      const set = await call(N.base, 'node.shell', { at: 'home', name: 'zzshell' });
      ok(set.status === 200, 'the world: node.shell names zzshell at home', 'node.shell: ' + set.status + ' ' + short(set.text));
      await open();
      const second = await loaded();
      const drawn = await text();
      ok(drawn.indexOf(MARK) !== -1 && second.some(function (n) { return /^\/spirit\/app\/zzshell\/element\.js(\?|$)/.test(n); }), 'the page loads the shell the node names, zzshell, and it draws', 'zzshell: ' + short(second.filter(function (n) { return /\/app\//.test(n); })) + ', page: ' + short(drawn));
      ok(drawn.indexOf(MARK) !== -1 && !second.some(function (n) { return /^\/spirit\/app\/app\/element\.js(\?|$)/.test(n); }) && !/\bContacts\b/.test(drawn), 'and nothing of the other shell, nor a desktop of boot.js\'s own', drawn.indexOf(MARK) !== -1 ? 'beside zzshell the page shows: ' + short(drawn) : 'zzshell never drew: nothing judged');

      // Q18, Andy: "join. not the shells job.": zzshell knows nothing of Join, and Join still shows a new node its steps.
      test.subHeading('the box: "Join shows a new user its steps on its own ... neither boot.js nor any shell decides it"');
      const steps = await call(N.base, 'job.list', {});
      test.comment('the scratch node is new: its join steps are open (' + short(steps.status) + ')');
      const joined = drawn.indexOf(MARK) !== -1 && await until(function () { return text().then(function (t) { return /\bJoin\b/.test(t); }); }, 10000);
      ok(joined, 'under a shell that knows nothing of it, Join shows itself', drawn.indexOf(MARK) !== -1 ? 'under zzshell no Join in 10 s: ' + short(await text()) : 'zzshell never drew: nothing judged');

      test.subHeading('the box: the two rows of the app detail, "shown only for an app whose <name>.json says shell:true:true"');
      await call(N.base, 'node.shell', { at: 'home', name: 'app' });
      await open();
      const detail = function (key) {
        return c.evaluate('(function () { return spirit.ready.then(function (s) { return s.app.searchApp({ q: "" }); }).then(function (got) { var it = (got.items || []).filter(function (i) { return i.key === ' + JSON.stringify(key) + '; })[0]; if (!it) return "no row"; var row = Object.assign({ key: it.key }, JSON.parse(it.label || "{}")); return spirit.require("spirit/element/search/app/detailElement.js").then(function () { var old = document.getElementById("zzDetail"); if (old) old.remove(); var h = document.createElement("div"); h.id = "zzDetail"; document.body.appendChild(h); spirit.element.spirit.element.search.app.detailElement.create(h, { row: row, panel: true }); return "made"; }); }); }())');
      };
      const inDetail = function () { return c.evaluate('String((document.getElementById("zzDetail") || {}).innerText || "")'); };
      ok((await detail('contact')) === 'made', 'the world: Contacts\' detail is drawn', 'no detail for contact');
      await sleep(2000);
      const plain = await inDetail();
      ok(plain.length > 0 && !/Home shell|Face shell/.test(plain), 'Contacts, shell:true false: no Home shell or Face shell row', 'Contacts\' detail: ' + short(plain));
      ok((await detail('zzshell')) === 'made', 'the world: zzshell\'s detail is drawn', 'no detail for zzshell');
      await sleep(2000);
      const worthy = await inDetail();
      ok(/Home shell/.test(worthy) && /Face shell/.test(worthy), 'zzshell, shell:true true: a Home shell and a Face shell row', 'zzshell\'s detail: ' + short(worthy));
      // "the dropdown first showing the configured home shell": the shell app, by Q12 and as set back above.
      const rowText = function (words) { return c.evaluate('(function () { var d = document.getElementById("zzDetail"); var all = Array.prototype.slice.call(d.querySelectorAll("*")); var r = all.filter(function (e) { return e.children.length && String(e.innerText || "").indexOf(' + JSON.stringify(words) + ') !== -1; }).pop(); r = r && (r.closest(".shell-row-form") || r); if (!r) return ""; var i = r.querySelector("input"); return String(r.innerText || "") + " | " + (i ? i.value : ""); }())'); };
      const homeRow = await rowText('Home shell');
      ok(!!SHELL_LABEL && /Home shell/.test(homeRow) && homeRow.indexOf(SHELL_LABEL) !== -1 && homeRow.indexOf(ZZ.identity.label) === -1, 'its Home shell dropdown first shows the configured home shell, Shell', 'the Home shell row: ' + short(homeRow));

      test.subHeading('the box: "Both dropdowns list only the apps whose <name>.json says shell:true:true"');
      for (const words of ['Home shell', 'Face shell']) {
        const opened = await c.evaluate('(function () { var d = document.getElementById("zzDetail"); var all = Array.prototype.slice.call(d.querySelectorAll("*")); var r = all.filter(function (e) { return e.children.length && String(e.innerText || "").indexOf(' + JSON.stringify(words) + ') !== -1; }).pop(); r = r && (r.closest(".shell-row-form") || r); var i = r && r.querySelector("input"); if (!i) return false; i.focus(); i.click(); i.dispatchEvent(new Event("input", { bubbles: true })); return true; }())');
        await sleep(1500);
        // What the dropdown lists: the labels inside that row, its own field and title aside.
        const seen = parsed(await c.evaluate('JSON.stringify((function () { var want = ' + JSON.stringify(LABELS) + '; var out = []; var d = document.getElementById("zzDetail"); var all = Array.prototype.slice.call(d.querySelectorAll("*")); var r = all.filter(function (e) { return e.children.length && String(e.innerText || "").indexOf(' + JSON.stringify(words) + ') !== -1; }).pop(); r = r && (r.closest(".shell-row-form") || r); Array.prototype.slice.call(r ? r.querySelectorAll("[data-key] td, li") : []).forEach(function (e) { var t = String(e.innerText || "").trim(); if ( e.offsetParent !== null && want.indexOf(t) !== -1 && out.indexOf(t) === -1) out.push(t); }); return out.sort(); }()))')) || [];
        const others = seen.filter(function (l) { return l !== SHELL_LABEL && l !== ZZ.identity.label; });
        // Q28, Andy: "no, the shell icon is now properly missing :)": the shell app leaves itself out here too.
        const held1 = opened && seen.indexOf(ZZ.identity.label) !== -1 && seen.indexOf(SHELL_LABEL) === -1 && !others.length;
        const why1 = words + ': opened ' + opened + ', it lists ' + short(seen);
        if (words === 'Home shell') ok(held1, 'Home shell: open, it lists Zz Shell, not Shell (Q28), and no app that is no shell', why1);
        else if (words === 'Face shell') ok(held1, 'Face shell: open, it lists Zz Shell, not Shell (Q28), and no app that is no shell', why1);
        await c.evaluate('document.body.click(); true');
      }

      test.subHeading('the box: "[armingButton-\'Set\']" and node.shell');
      const chose = await c.evaluate('(function () { var d = document.getElementById("zzDetail"); var all = Array.prototype.slice.call(d.querySelectorAll("*")); var r = all.filter(function (e) { return e.children.length && String(e.innerText || "").indexOf("Home shell") !== -1; }).pop(); r = r && (r.closest(".shell-row-form") || r); var i = r && r.querySelector("input"); if (!i) return "no field"; i.focus(); i.click(); i.value = "Zz"; i.dispatchEvent(new Event("input", { bubbles: true })); return new Promise(function (res) { setTimeout(function () { var hit = Array.prototype.slice.call(document.querySelectorAll("*")).filter(function (e) { return !e.children.length && e.offsetParent !== null && String(e.innerText || "").trim() === ' + JSON.stringify(ZZ.identity.label) + '; })[0]; if (!hit) return res("no row"); hit.click(); setTimeout(function () { var b = Array.prototype.slice.call(r.querySelectorAll("button")).filter(function (x) { return /^Set\\b/.test(String(x.textContent).trim()); })[0]; if (!b) return res("no Set"); b.click(); setTimeout(function () { var armed = b.hasAttribute("data-armed"); b.click(); res(armed ? "pressed twice" : "not armed"); }, 300); }, 500); }, 1500); }); }())');
      ok(chose === 'pressed twice', 'zzshell chosen in Home shell, Set armed by the first press and pressed again', 'the Home shell row: ' + short(chose));
      ok(await until(function () { return call(N.base, 'node.shell', { at: 'home' }).then(function (a) { return a.body && a.body.name === 'zzshell'; }); }, 6000), 'and the node names zzshell at home', 'node.shell home: ' + short(await call(N.base, 'node.shell', { at: 'home' })));
      ok((await call(N.base, 'node.shell', { at: 'face' })).body.name === 'app', 'the face shell is its own, still app', 'node.shell face: ' + short(await call(N.base, 'node.shell', { at: 'face' })));
    } finally {
      try { if (c && c.kid) c.kid.kill(); } catch (e) { /* gone */ }
      if (N) await stop(N.child);
      try { fs.rmSync(s.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    }
  }());
}
