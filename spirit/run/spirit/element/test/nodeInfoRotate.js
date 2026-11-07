'use strict';

// spirit/run/spirit/element/test/nodeInfoRotate.js
// THE ROTATE KEY DIALOG, DONE RIGHT (goal/G43.24, requirement 8; spec: ./nodeInfoRotate.md). Andy, on "Info's rotate button
// opens the old shell's dialog": "not good." "do it right!", "it's just a panel that opens exactly overtop of the calling
// panel, new-shell-style.", "like fstat". The tree read as it is, then a real node on a scratch copy of the tree's files and
// real clicks in a real Chrome on /face.html, Info opened from its tile in the shell app. No key is ever rotated: the page's
// node.rotateCipher is replaced by a recorder that refuses, and the node's card is compared before and after. Neither Andy's
// node nor an agent's is touched.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { freePort, until, sleep, chromePage, findChrome } = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'); } catch (e) { return ''; } }

// The dialog's explanation and its button "as they are": shell/rotateKey/rotateKey.js at 4f01465b, as the page reads it.
const EXPLAINED = [
  'Rotate this node\'s cipher key',
  'When to use it: you believe this node\'s cipher key has been copied or seen, for example because the box was broken into or a backup of its home went somewhere it should not.',
  'What it does: makes a new cipher key and throws the old one away. Your identity stays the same; only the key others seal to changes. The new card goes to every relay you are on at once, and peers pick it up the next time they post to you.',
  'What it costs: anything already sealed to the old key and still on its way cannot be opened. Peers who are offline catch up when they next post.',
  'What it does not do: protect what was sent before. Whoever holds the old key can still read anything they captured with it.',
  'It is a crisis measure, not a routine one.',
];
const BUTTON = 'Rotate the key';
const ARMED = 'Rotate the key: press again';
const ELEMENT = path.join(RUN, 'spirit', 'element', 'rotateKey.js');

function treeFiles() {
  return execSync('git ls-files --cached --others --exclude-standard -- spirit/run', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 })
    .split('\n').filter(Boolean).filter(function (f) { return fs.existsSync(path.join(REPO, f)) && fs.statSync(path.join(REPO, f)).isFile(); });
}
function scratch() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-rk-'));
  treeFiles().forEach(function (f) { const d = path.join(root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
  return { root: root, run: path.join(root, 'spirit', 'run') };
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

// THE PAGE'S HANDS: what shows in #zzBox (or #zzOwn, the element alone); a hidden layer never counts.
const HANDS = '(function () {' +
  'function box() { return document.getElementById(window.__in || "zzBox"); }' +
  'function seen(e) { return !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden"; }' +
  'function all(sel) { var b = box(); return b ? Array.prototype.slice.call(b.querySelectorAll(sel)).filter(seen) : []; }' +
  'window.__t = {' +
  '  text: function () { var b = box(); return b ? String(b.innerText || "").replace(/\\s+/g, " ") : ""; },' +
  '  tiles: function () { return all(".app-icon[data-key]").map(function (t) { return t.getAttribute("data-key"); }); },' +
  '  tile: function (k) { var t = all(".app-icon[data-key]").filter(function (e) { return e.getAttribute("data-key") === k; })[0]; if (!t) return false; t.click(); return true; },' +
  '  bars: function () { return all("button").filter(function (b) { return String(b.textContent).trim() === "✕" && !/clear$/.test(b.id || ""); }).map(function (b) { return String(b.parentElement.innerText || "").replace("✕", "").replace(/\\s+/g, " ").trim(); }); },' +
  '  closeLast: function () { var b = all("button").filter(function (b) { return String(b.textContent).trim() === "✕" && !/clear$/.test(b.id || ""); }); if (!b.length) return false; b[b.length - 1].click(); return true; },' +
  '  count: function (sel) { return all(sel).length; },' +
  '  buttons: function () { return all("button").map(function (b) { return String(b.textContent).replace(/\\s+/g, " ").trim(); }); },' +
  '  press: function (words) { var b = all("button").filter(function (x) { return String(x.textContent).replace(/\\s+/g, " ").trim() === words; })[0]; if (!b) return false; b.click(); return true; },' +
  '  says: function (lines) { var t = window.__t.text(); return lines.filter(function (l) { return t.indexOf(l) === -1; }); },' +
  '}; return "hands"; }())';

test.startTest('nodeInfoRotate.js: the rotate key dialog, an element opened over Info through panel.js (goal/G43.24)');

(async function () {
  test.subHeading('the box, 8: "shell/rotateKey/ goes, its line in coreFiles.js\'s INTRINSIC list with it, and its test moves"');
  ok(!fs.existsSync(path.join(RUN, 'shell', 'rotateKey')), 'shell/rotateKey/ is gone', 'shell/rotateKey/ is still there');
  let core = null;
  try { core = require(path.join(RUN, 'spirit', 'coreFiles.js')); } catch (e) { core = null; }
  ok(!!core && Array.isArray(core.INTRINSIC) && core.INTRINSIC.length > 0, 'the world: coreFiles.js answers its INTRINSIC list (' + (core && core.INTRINSIC ? core.INTRINSIC.length : 0) + ')', 'coreFiles.js answers no INTRINSIC list: nothing judged');
  if (core && Array.isArray(core.INTRINSIC)) ok(core.INTRINSIC.map(function (x) { return String(x).toLowerCase(); }).indexOf('shell/rotatekey') === -1, 'coreFiles.js\'s INTRINSIC list has no shell/rotateKey', 'INTRINSIC still lists shell/rotateKey');
  ok(fs.existsSync(path.join(RUN, 'spirit', 'element', 'test', 'rotateKey.js')) && fs.existsSync(path.join(RUN, 'spirit', 'element', 'test', 'rotateKey.md')), 'its test is in the element\'s test folder: spirit/element/test/rotateKey.js and .md', 'no spirit/element/test/rotateKey.js and .md');
  // What runs, its comments out and its tests out: nothing opens the old dialog any more.
  const opening = treeFiles().filter(function (f) { return /\.(js|html)$/.test(f) && f.split('/').indexOf('test') === -1; })
    .filter(function (f) { return /shell\/rotateKey(?![\w-])/.test(code(path.join(REPO, f))); });
  ok(!opening.length, 'no code opens shell/rotateKey', 'still opening it: ' + short(opening));

  test.subHeading('the box, 8: "becomes an element, spirit/element/rotateKey.js, mounted the new shell\'s way (requirement 7)"');
  const el = code(ELEMENT);
  ok(el.length > 0, 'spirit/element/rotateKey.js is there', 'no spirit/element/rotateKey.js');
  ok(el.length > 0 && !/\bactivateApp\b/.test(el) && !/\bspirit\.shell\b/.test(el), 'rotateKey.js mounts through no spirit.shell.activateApp', el.length ? 'rotateKey.js calls spirit.shell.activateApp' : 'no rotateKey.js: nothing judged');
  const ni = code(path.join(RUN, 'spirit', 'element', 'nodeInfo.js'));
  ok(ni.length > 0 && !/\bcallDialog\b/.test(ni), 'nodeInfo opens no dialog of the old shell (no callDialog)', ni.length ? 'nodeInfo.js calls callDialog' : 'no spirit/element/nodeInfo.js: nothing judged');

  const s = scratch();
  let N = null;
  let c = null;
  try {
    N = await boot(s.run);
    ok(N.up, 'the world: a scratch node comes up', 'the scratch node did not come up: nothing judged');
    if (!N.up) return;
    const card0 = await call(N.base, 'node.card', {});
    ok(card0.status === 200 && !!card0.body, 'the world: the node answers its card', 'node.card: ' + card0.status + ' ' + short(card0.text));
    const where = findChrome();
    if (!where) { test.fail('no Chrome here: the page was not judged'); return; }
    c = await chromePage(where);
    if (c.error) { test.fail('Chrome: ' + c.error); return; }
    await c.send('Page.navigate', { url: N.base + '/face.html' });
    ok(await until(function () { return c.evaluate('!!(window.spirit && window.spirit.ready && window.spirit.events)'); }, 20000), 'the world: the face page has its spirit', 'the page has no spirit: nothing judged');
    // NO KEY IS ROTATED: the page's node.rotateCipher records the ask and refuses it.
    const spy = await c.evaluate('window.spirit.ready.then(function () { var S = window.spirit; window.__rotations = 0; if (!S.node || typeof S.node.rotateCipher !== "function") return "no spirit.node.rotateCipher"; S.node.rotateCipher = function () { window.__rotations += 1; return Promise.resolve({ status: 403, body: { ok: false, error: "refused by the test" } }); }; return "spied"; })');
    ok(spy === 'spied', 'the world: the page\'s node.rotateCipher is a recorder that refuses', 'the spy: ' + short(spy));
    await c.evaluate(HANDS);
    const T = function (expr) { return c.evaluate('window.__t.' + expr); };
    const waitFor = function (expr, ms) { return until(function () { return c.evaluate('(function () { with (window.__t) { return !!(' + expr + '); } }())'); }, ms || 8000); };
    const rotations = function () { return c.evaluate('window.__rotations'); };

    test.subHeading('the box, 8: the element alone, "its explanation and its two-press arming button as they are"');
    await c.evaluate('window.__in = "zzOwn"');
    const made = await c.evaluate('(function () { var b = document.createElement("div"); b.id = "zzOwn"; b.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;background:#fff;z-index:9999"; document.body.appendChild(b); var p; try { p = spirit.require("spirit/element/rotateKey.js"); } catch (e) { return "load threw: " + e; } return Promise.resolve(p).then(function () { var E = spirit.elements && spirit.elements.rotateKey; if (!E || typeof E.create !== "function") return "no spirit.elements.rotateKey.create"; window.__rk = E.create(b, {}); return window.__rk && typeof window.__rk.destroy === "function" ? "made" : "create answered " + typeof window.__rk; }, function (e) { return "load: " + e; }); }())');
    ok(made === 'made', 'spirit.elements.rotateKey.create(container, opts) answers { destroy() }', 'rotateKey: ' + short(made));
    const alone = made === 'made' && await waitFor('says(' + JSON.stringify(EXPLAINED) + ').length === 0', 6000);
    ok(alone, 'it draws the explanation as it is', made === 'made' ? 'missing: ' + short(await T('says(' + JSON.stringify(EXPLAINED) + ')')) : 'no element: nothing judged');
    const hasButton = made === 'made' && await waitFor('buttons().indexOf(' + JSON.stringify(BUTTON) + ') !== -1', 6000);
    ok(hasButton, 'it draws its button, ' + BUTTON, made === 'made' ? 'its buttons: ' + short(await T('buttons()')) : 'no element: nothing judged');
    if (hasButton) await T('press(' + JSON.stringify(BUTTON) + ')');
    const armedAlone = hasButton && await waitFor('buttons().indexOf(' + JSON.stringify(ARMED) + ') !== -1 && count("button[data-armed]") === 1', 4000);
    ok(armedAlone, 'one press arms it: ' + ARMED, hasButton ? 'after one press: ' + short(await T('buttons()')) : 'no button: nothing judged');
    ok(hasButton && (await rotations()) === 0, 'and one press rotates nothing', hasButton ? 'one press asked node.rotateCipher ' + (await rotations()) + ' times' : 'no button: nothing judged');
    await c.evaluate('(function () { try { if (window.__rk) window.__rk.destroy(); } catch (e) { /* judged above */ } var b = document.getElementById("zzOwn"); if (b) b.remove(); window.__in = "zzBox"; return true; }())');

    test.subHeading('the box, 8: "nodeInfo\'s rotate button opens it as a layer over Info through panel.js ... its ✕ shows Info again"');
    const shell = await c.evaluate('(function () { var b = document.createElement("div"); b.id = "zzBox"; b.className = "fill"; b.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;background:#fff;z-index:9999;display:flex;flex-direction:column"; document.body.appendChild(b); return spirit.require("spirit/app/shell/shell.js").then(function () { window.__shell = spirit.elements.shell.create(b); return "made"; }, function (e) { return "load: " + e; }); }())');
    ok(shell === 'made' && await waitFor('tiles().indexOf("file") !== -1', 10000), 'the world: the shell draws its tiles', 'the shell: ' + short(shell) + ', tiles ' + short(await T('tiles()')));
    const infoOpen = (await waitFor('tiles().indexOf("info") !== -1', 6000)) && (await T('tile("info")')) && await waitFor('count("[data-field=label]") === 1 && buttons().some(function (b) { return /^Rotate this node.s cipher key$/.test(b); })', 10000);
    ok(infoOpen, 'the world: Info opens from its tile, its name field and its rotate button shown', 'Info did not open with its rotate button: ' + short(await T('text()')) + ' tiles ' + short(await T('tiles()')));
    if (!infoOpen) { test.fail('Info did not open: the rotate button was not judged'); return; }
    const before = await T('bars()');
    await T('press("Rotate this node\'s cipher key")');
    const over = await waitFor('says(' + JSON.stringify(EXPLAINED.slice(1)) + ').length === 0', 8000);
    ok(over, 'the rotate button opens the dialog: its explanation shows', 'after the press: ' + short(await T('text()')));
    ok(over && (await T('count("[data-field=label]")')) === 0 && (await T('count("[data-field=description]")')) === 0, 'over Info: Info\'s fields are out of view', over ? 'Info still shows its fields' : 'nothing opened: nothing judged');
    const bars = await T('bars()');
    ok(over && bars.length === 1 && short(bars) !== short(before) && (await T('count(".app-container-close")')) === 1, '"like fstat": one layer of panel.js over all of Info, one bar in view, its own (' + short(bars) + ')', over ? 'bars before ' + short(before) + ', now ' + short(bars) + ', panel.js closes in view ' + (await T('count(".app-container-close")')) : 'nothing opened: nothing judged');
    const layerButton = over && await waitFor('buttons().indexOf(' + JSON.stringify(BUTTON) + ') !== -1', 4000);
    ok(layerButton, 'the layer shows its button, ' + BUTTON, over ? 'its buttons: ' + short(await T('buttons()')) : 'nothing opened: nothing judged');
    if (layerButton) await T('press(' + JSON.stringify(BUTTON) + ')');
    const armed = layerButton && await waitFor('buttons().indexOf(' + JSON.stringify(ARMED) + ') !== -1', 4000);
    ok(armed, 'one press arms it: ' + ARMED, layerButton ? 'after one press: ' + short(await T('buttons()')) : 'no button: nothing judged');
    await sleep(800);
    ok(layerButton && (await rotations()) === 0, 'and one press rotates nothing', layerButton ? 'one press asked node.rotateCipher ' + (await rotations()) + ' times' : 'no button: nothing judged');
    const closed = over && await T('closeLast()');
    const back = closed && await waitFor('count("[data-field=label]") === 1 && count("[data-field=description]") === 1 && says([' + JSON.stringify(EXPLAINED[1]) + ']).length === 1', 6000);
    ok(back, 'its ✕ shows Info again, the dialog out of view', closed ? 'after ✕: ' + short(await T('text()')) : 'no ✕ to press: nothing judged');
    ok(back && short(await T('bars()')) === short(before), 'and Info\'s bar is the one in view again', back ? 'bars: ' + short(await T('bars()')) : 'Info did not come back: nothing judged');

    test.subHeading('no key was rotated');
    const card1 = await call(N.base, 'node.card', {});
    ok(card0.status === 200 && card1.status === 200 && card1.text === card0.text, 'the node\'s card is as it was', 'card before ' + short(card0.text) + ', after ' + short(card1.text));
  } finally {
    try { if (c && c.sock) c.sock.close(); } catch (e) { /* gone */ }
    try { if (c && c.kid) c.kid.kill(); } catch (e) { /* gone */ }
    if (N) await stop(N.child);
    try { fs.rmSync(s.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
