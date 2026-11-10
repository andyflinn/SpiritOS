'use strict';

// spirit/run/spirit/app/test/appSelector.js
// The tests of spirit/app/appSelector.js, and of no other module (spec: ./appSelector.md; goal/G43.2). A real Chrome on a
// scratch node's face page; neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const FILE = path.join(RUN, 'spirit', 'app', 'appSelector.js');
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

test.startTest('appSelector.js: the app selector (goal/G43.2)');

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('spirit/app/appSelector.js is not there'); return; }
  const identity = JSON.parse(fs.readFileSync(path.join(RUN, 'spirit', 'app', 'server', 'server.json'), 'utf8')).identity;
  const node = await scratchNode();
  const chrome = await chromePage(findChrome());
  try {
    if (!node.up || chrome.error) { test.fail('no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '')); return; }
    // AN APP THE USER SWITCHES, OF THIS TEST'S OWN (goal/G43.15): Monitor was it until Andy's 7f6ebbbe made it intrinsic, so always on. A copy
    // of its json as it was then, and its script, planted on the scratch node's disc; the app family reads the disc.
    if (!node.root) { test.fail('the scratch node is shared, so no app of the test\'s own can be planted: nothing judged'); return; }
    const zz = path.join(node.root, 'spirit', 'run', 'spirit', 'app', 'hearing');
    fs.mkdirSync(zz, { recursive: true });
    fs.writeFileSync(path.join(zz, 'hearing.json'), JSON.stringify({ identity: { icon: '🦻', label: 'Hearing' }, mount: { 'hearing.js': true }, shell: { true: false, mount: true, tile: true }, node: { mount: false } }, null, 2));
    // Monitor's script, registered under the planted app's own name, as a tile asks for it.
    fs.writeFileSync(path.join(zz, 'hearing.js'), fs.readFileSync(path.join(RUN, 'spirit', 'app', 'monitor', 'monitor.js'), 'utf8').replace('(S.app = S.app || {}).monitor = ', '(S.app = S.app || {}).hearing = '));
    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    const made = await chrome.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/app/appSelector.js"); }).then(function () {' +
      ' var c = document.createElement("div"); c.id = "under-test"; document.body.appendChild(c); window.changes = 0;' +
      ' window.sel = spirit.element.spirit.app.appSelector.create(c, { face: "pane" }); if (window.sel.parentNode !== c) c.appendChild(window.sel); window.sel.addEventListener("change", function () { window.changes += 1; }); return "made"; }, function (e) { return String(e && e.message || e); })');
    ok(made === 'made', 'it loads through spirit.require and mounts as a pane', 'it did not mount: ' + short(made));
    const text = function () { return chrome.evaluate('String((document.getElementById("under-test") || {}).innerText || "")'); };
    const found = await until(function () { return text().then(function (t) { return t.indexOf(identity.label) !== -1; }); }, 8000);
    ok(found, 'the list shows server\'s label', 'the list never showed "' + identity.label + '": ' + short(await text()));
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
    const detail = await until(function () { return chrome.evaluate('(function () { var h = document.querySelector("#under-test .app-container .shell-row-form"); return !!(spirit.element.spirit.app.appSelector.detailElement) && !!h && String(h.textContent).indexOf(' + JSON.stringify(identity.label) + ') !== -1; }())'); }, 3000);
    ok(detail, 'a press shows that app\'s detail', 'a press showed no detail');

    await chrome.evaluate('(function () { var c = document.querySelector("#under-test .app-container-close"); if (c) c.click(); return !!c; }())');

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
    const mount = function (opts) { return chrome.evaluate('(function () { var old = document.getElementById("faces"); if (old) old.remove(); var c = document.createElement("div"); c.id = "faces"; c.style.cssText = "position:fixed;left:0;top:0;width:900px;height:600px;display:flex;flex-direction:column;background:#111"; document.body.appendChild(c); window.fs = spirit.element.spirit.app.appSelector.create(c, ' + JSON.stringify(opts) + '); if (window.fs.parentNode !== c) c.appendChild(window.fs); return true; }())'); };
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
    ok((await forms()).length === 4, 'and no Allow row (goal/G43.18)', 'with shell.mount false, forms: ' + short(await forms()));
    await closePanel();
    fs.writeFileSync(disk, fileBefore);
    

    test.subHeading('the box: "in :tiles mode, only activated apps will appear."');
    await chrome.evaluate('(function () { var t = document.querySelector("#faces .list-toggle"); if (t) t.click(); return !!t; }())');
    const onlyActive = await until(function () { return chrome.evaluate('!!' + tileOf(monitorLabel) + ' && !' + tileOf(serverLabel)); }, 5000);
    ok(onlyActive, 'the toggle shows tiles: Hearing, active, and not server', 'the tiles: ' + short(await inFaces()));
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
    const opened = await until(function () { return chrome.evaluate('(function () { var p = ' + inPanel('.app-container-pane') + '; return !!p && /Uptime|waiting/i.test(String(p.innerText)); }())'); }, 10000);
    ok(opened, 'a tile opens its app inside, through spirit.app.monitor.createApp', 'a tile opened: ' + short(await inFaces()));
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
      const monitor = fs.readFileSync(path.join(APPS, 'monitor', 'monitor.js'), 'utf8');
      Object.keys(PLANT).forEach(function (k) {
        const p = PLANT[k];
        const dir = path.join(APPS, k);
        fs.mkdirSync(dir, { recursive: true });
        const j = { identity: { icon: '🧪', label: p.label, intrinsic: false }, mount: {}, node: { mount: false } };
        j.mount[k + '.js'] = true;
        if ('shell' in p) j.shell = p.shell;
        if (p.run) j.node.run = true;
        fs.writeFileSync(path.join(dir, k + '.json'), JSON.stringify(j, null, 2));
        fs.writeFileSync(path.join(dir, k + '.js'), monitor.replace('(S.app = S.app || {}).monitor = ', '(S.app = S.app || {})[' + JSON.stringify(k) + '] = '));
      });
      // The tree's own apps that do not say shell.mount true: none of them may show a tile either.
      const tree = fs.readdirSync(APPS).filter(function (n) { return !PLANT[n] && fs.existsSync(path.join(APPS, n, n + '.json')); }).map(function (n) {
        let j = {};
        try { j = JSON.parse(fs.readFileSync(path.join(APPS, n, n + '.json'), 'utf8')); } catch (e) { j = {}; }
        return { key: n, label: String((j.identity && j.identity.label) || n), mount: !!(j.shell && j.shell.mount === true), run: !!(j.node && j.node.run === true) };
      });
      const treeOff = tree.filter(function (a) { return !a.mount && a.key !== 'shell'; });
      ok(treeOff.length >= 1, 'the world: the tree\'s apps without shell.mount true: ' + treeOff.map(function (a) { return a.key; }).join(', '), 'every app of the tree says shell.mount true: nothing of the tree to judge');

      await chrome.send('Page.navigate', { url: node.base + '/face.html' });
      await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
      const loaded = await chrome.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/app/appSelector.js"); }).then(function () { return "loaded"; }, function (e) { return String(e && e.message || e); })');
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
      keys.forEach(function (k) {
        if (runs.indexOf(k) !== -1) ok(!!r[k], 'the world: ' + k + ' is a row, run only, never active', k + ' is no row at all: ' + short(r[k]));
        else ok(!!(r[k] && r[k].active), 'the world: ' + k + ' is a row, active', k + ' is no active row, so its missing tile would judge nothing: ' + short(r[k]));
      });

      const mount = function (opts) { return chrome.evaluate('(function () { var old = document.getElementById("faces"); if (old) { if (window.fsel) window.fsel.destroy(); old.remove(); } var c = document.createElement("div"); c.id = "faces"; c.style.cssText = "position:fixed;left:0;top:0;width:1200px;height:800px;display:flex;flex-direction:column;background:#111"; document.body.appendChild(c); window.fsel = spirit.element.spirit.app.appSelector.create(c, ' + JSON.stringify(opts) + '); if (window.fsel.parentNode !== c) c.appendChild(window.fsel); return true; }())'); };
      // The labels drawn as tiles: every visible leaf under the tiles whose text is a label of the test's.
      const LABELS = Object.keys(PLANT).map(function (k) { return PLANT[k].label; }).concat(treeOff.map(function (a) { return a.label; }));
      const drawn = function () { return chrome.evaluate('(function () { var c = document.getElementById("faces"); if (!c) return "[]"; var want = ' + JSON.stringify(LABELS) + '; var out = []; var all = c.querySelectorAll("*"); for (var i = 0; i < all.length; i++) { var e = all[i]; if (!e.getClientRects().length) continue; var t = String(e.innerText || e.textContent || "").trim(); if (!e.children.length && want.indexOf(t) !== -1 && out.indexOf(t) === -1) out.push(t); } return JSON.stringify(out.sort()); }())').then(function (s) { try { return JSON.parse(s); } catch (e) { return []; } }); };
      const judge = async function (how) {
        const seen = await until(function () { return drawn().then(function (d) { return d.indexOf(PLANT.zzmounted.label) !== -1; }); }, 8000);
        ok(seen, how + ': the app that says shell.mount true shows its tile', how + ': not even the mounted app shows a tile, so nothing is judged: ' + short(await drawn()));
        await sleep(800);
        const d = await drawn();
        Object.keys(PLANT).filter(function (k) { return !PLANT[k].tile; }).forEach(function (k) {
          ok(d.indexOf(PLANT[k].label) === -1, how + ': ' + k + ' (' + short('shell' in PLANT[k] ? PLANT[k].shell : 'no shell part') + ') shows no tile', how + ': ' + k + ' shows a tile, its json ' + short('shell' in PLANT[k] ? PLANT[k].shell : 'no shell part'));
        });
        treeOff.forEach(function (a) { ok(d.indexOf(a.label) === -1, how + ': the tree\'s ' + a.key + ' shows no tile', how + ': the tree\'s ' + a.key + ' shows a tile without shell.mount true'); });
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

      test.subHeading('the shell\'s own tiles, as the shell mounts them');
      await mount({ face: 'tiles', toggle: true, hide: ['shell'] });
      await judge('the shell\'s tiles');

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
      // something in the layer it opens. The shell is left out: it hides itself from the tiles (goal/G43.18).
      test.subHeading('Andy: "an app who claims to have a face, also actually supplies a fucking face"');
      const treeOn = tree.filter(function (a) { return a.mount && a.key !== 'shell'; });
      ok(treeOn.length >= 1, 'the world: the tree\'s apps that say shell.mount true: ' + treeOn.map(function (a) { return a.key; }).join(', '), 'no app of the tree says shell.mount true: nothing to judge');
      treeOn.forEach(function (a) {
        const f = path.join(APPS, a.key, a.key + '.js');
        ok(fs.existsSync(f), a.key + ': its face script spirit/app/' + a.key + '/' + a.key + '.js is there', a.key + ' says shell.mount true and has no spirit/app/' + a.key + '/' + a.key + '.js');
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
        ok(drew, a.key + ': its tile opens a face that draws', a.key + ' says shell.mount true and its tile drew no face; page errors: ' + short(errs) + '; the layer: ' + short(await chrome.evaluate('(function () { var c = ' + shown + '; return c ? c.innerHTML : "no layer shown"; }())')));
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
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
