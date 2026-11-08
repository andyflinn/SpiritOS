'use strict';

// spirit/run/spirit/element/test/panel.js
// The tests of spirit/element/panel.js (spec: ./panel.md; goal/G43.17, Q12: "yes." to panel, in spirit/element/panel.js). Andy's
// box, "What mounts covers its mounter": one generic panel element, used by the appSelector and file, each pane keeping its own
// stack. A real node on a scratch copy of the tracked files, and real clicks in a real Chrome on /face.html, on the appSelector
// as appMigration makes it. Neither Andy's node nor an agent's is touched.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');
const RUN = path.resolve(__dirname, '../../..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const VENDORED_FOLDERS = require(path.join(RUN, 'spirit', 'fileSystem.js')).VENDORED_FOLDERS;
const { freePort, until, sleep, chromePage, findChrome } = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'); } catch (e) { return ''; } }

// The code of the tree, its comments out, its tests out: what runs.
function codeNaming(re) {
  const out = [];
  (function walk(d) { (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []).forEach(function (e) { if (VENDORED_FOLDERS.holds(path.join(d, e.name)) || e.name === 'relay-state' || e.name === 'state' || e.name === 'agents' || e.name === 'test') return; const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else out.push(p); }); }(RUN));
  return out.filter(function (f) { return /\.(js|html)$/.test(f) && re.test(code(f).replace(/<!--[\s\S]*?-->/g, '')); }).map(function (f) { return path.relative(RUN, f); });
}

const PANEL = path.join(RUN, 'spirit', 'element', 'panel.js');
const USERS = { appSelector: path.join(RUN, 'spirit', 'app', 'appSelector.js'), file: path.join(RUN, 'spirit', 'app', 'file', 'file.js') };
const PLANT = { 'zzFiles/notes.txt': 'alpha\nbeta\n' };

function scratch() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-panel-'));
  execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
    .filter(function (f) { return fs.existsSync(path.join(REPO, f)); })
    .forEach(function (f) { const d = path.join(root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
  const run = path.join(root, 'spirit', 'run');
  Object.keys(PLANT).forEach(function (f) { fs.mkdirSync(path.dirname(path.join(run, f)), { recursive: true }); fs.writeFileSync(path.join(run, f), PLANT[f]); });
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

// THE PAGE'S HANDS: everything judged is what shows in #zzBox; a hidden layer never counts as shown.
const HANDS = '(function () {' +
  'function box() { return document.getElementById("zzBox"); }' +
  'function seen(e) { return !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden"; }' +
  'function all(sel) { var b = box(); return b ? Array.prototype.slice.call(b.querySelectorAll(sel)).filter(seen) : []; }' +
  'function closers() { return all("button").filter(function (b) { return String(b.textContent).trim() === "✕" && !/clear$/.test(b.id || ""); }); }' +
  'window.__t = {' +
  '  text: function () { var b = box(); return b ? String(b.innerText || "").replace(/\\s+/g, " ") : ""; },' +
  '  rows: function () { return all("tr[data-key]").map(function (t) { return t.getAttribute("data-key"); }); },' +
  '  tiles: function () { return all(".app-icon[data-key]").map(function (t) { return t.getAttribute("data-key"); }); },' +
  '  press: function (k) { var r = all("tr[data-key], .app-icon[data-key]").filter(function (t) { return t.getAttribute("data-key") === k; })[0]; if (!r) return false; (r.querySelector("td:last-child") || r).click(); return true; },' +
  '  type: function (w) { var i = all("input[id$=text]")[0]; if (!i) return false; i.value = w; i.dispatchEvent(new Event("input", { bubbles: true })); return true; },' +
  '  words: function () { var i = all("input[id$=text]")[0]; return i ? i.value : null; },' +
  '  bars: function () { return closers().map(function (b) { return String(b.parentElement.innerText || "").replace("✕", "").replace(/\\s+/g, " ").trim(); }); },' +
  '  close: function (label) { var b = closers().filter(function (b) { return String(b.parentElement.innerText || "").indexOf(label) !== -1; }); if (!b.length) return false; b[0].click(); return true; },' +
  '  count: function (sel) { return all(sel).length; },' +
  // A row's own cell pressed, not an action of it: what a press on the row opens.
  '  openRow: function (k) { var r = all("tr[data-key]").filter(function (t) { return t.getAttribute("data-key") === k; })[0]; if (!r) return false; (r.querySelector("td") || r).click(); return true; },' +
  '  depth: function () { var n = window.spirit.elements && window.spirit.elements.navigation; return n && typeof n.depth === "function" ? n.depth() : 0; },' +
  // A mark on what shows now, but not on what showed before: the layer just opened.
  '  markBefore: function () { all("*").forEach(function (e) { e.setAttribute("data-zz-before", "1"); }); return true; },' +
  '  markLayer: function (name) { var n = 0; all("*").forEach(function (e) { if (!e.hasAttribute("data-zz-before")) { e.setAttribute("data-zz-" + name, "1"); n++; } }); return n; },' +
  // A mark on what one selector draws, and all inside it: the layer's own, never the list it covers, which redraws its rows.
  '  markSel: function (name, sel) { var n = 0; all(sel).forEach(function (e) { [e].concat(Array.prototype.slice.call(e.querySelectorAll("*"))).forEach(function (k) { k.setAttribute("data-zz-" + name, "1"); n++; }); }); return n; },' +
  '  marked: function (name) { return document.querySelectorAll("[data-zz-" + name + "]").length; },' +
  '  markedShown: function (name) { return all("[data-zz-" + name + "]").length; },' +
  '}; return "hands"; }())';

test.startTest('panel.js: what mounts covers its mounter (goal/G43.17)');

(async function () {
  test.subHeading('the box: "That is one generic panel element, used by the appSelector and file; neither draws it with a <div> of its own (Q3)"');
  ok(fs.existsSync(PANEL), 'spirit/element/panel.js is there (Q12)', 'no spirit/element/panel.js');
  Object.keys(USERS).forEach(function (u) {
    const own = code(USERS[u]);
    ok(/spirit\/element\/panel\.js/.test(own), u + ' loads spirit/element/panel.js', u + ' does not load spirit/element/panel.js');
    ok(!!own && !/✕|app-container/.test(own), u + ' draws no title bar or close of its own', u + ' still draws a ✕ or an app-container');
  });

  // goal/G43.18, Andy: "contact details and relay details should be proper panels in the newest shell style.", and "add it to a
  // general test that panels must be panels....": what opens over its mounter opens as a layer of this element, so no code pushes
  // a page on the navigation for it.
  // The shell itself (shell/) opens an app as a page on the navigation: that is the shell's top container (navigationWrapper.js,
  // Andy 2026-10-25: "an app is only a mountable icon in shell, conceptually, and it simply uses the navigation wrapper as it's
  // top container"), not an element over its mounter. The apps and elements are spirit/.
  test.subHeading('Andy: "panels must be panels": no app or element opens a page on the navigation, what it opens over itself is a panel');
  const pushing = codeNaming(/navigation\.push\s*\(/).filter(function (f) { return f.split(path.sep)[0] === 'spirit'; });
  ok(!pushing.length, 'no app or element under spirit/ calls navigation.push', pushing.length + ' still do: ' + short(pushing));

  const s = scratch();
  const live = [];
  let c = null;
  let heardBefore = Infinity;
  try {
    const N = await boot(s.run); live.push(N.child);
    ok(N.up, 'the world: a scratch node comes up', 'the scratch node did not come up: nothing judged');
    if (!N.up) return;
    const where = findChrome();
    if (!where) { test.fail('no Chrome here: the page was not judged'); return; }
    c = await chromePage(where);
    if (c.error) { test.fail('Chrome: ' + c.error); return; }
    // A new page, not the old one before the reload lands: the old one carries a mark the new one has not.
    const open = async function () {
      await c.evaluate('window.__zzOld = true').catch(function () {});
      await c.send('Page.navigate', { url: N.base + '/face.html' });
      const up = await until(function () { return c.evaluate('!window.__zzOld && !!(window.spirit && window.spirit.ready && window.spirit.events)'); }, 20000);
      await c.evaluate(HANDS);
      return up;
    };
    ok(await open(), 'the world: the face shell has its spirit', 'the page has no spirit: nothing judged');
    const T = function (expr) { return c.evaluate('window.__t.' + expr); };
    // Every hand in expr is the page's, not only the first: "rows() ... && tiles()" asks both.
    const waitFor = function (expr, ms) { return until(function () { return c.evaluate('(function () { with (window.__t) { return !!(' + expr + '); } }())'); }, ms || 8000); };
    const selector = function (face) {
      return c.evaluate('(function () { if (window.__sel) window.__sel.destroy(); var old = document.getElementById("zzBox"); if (old) old.remove(); var b = document.createElement("div"); b.id = "zzBox"; b.className = "fill"; b.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;background:#fff;z-index:9999;display:flex;flex-direction:column"; document.body.appendChild(b); return spirit.require("spirit/app/appSelector.js").then(function () { window.__sel = spirit.elements.appSelector.create(b, { face: ' + JSON.stringify(face) + ' }); return "made"; }); }())');
    };

    test.subHeading('the box: "An element mounts over ALL of the one that mounts it, its title bar too", under "its own title bar [icon] <label> [✕]"');
    await selector('tiles');
    ok(await waitFor('tiles().indexOf("file") !== -1', 10000), 'the world: the tiles show Files', 'tiles: ' + short(await T('tiles()')));
    await T('press("file")');
    ok(await waitFor('rows().indexOf("zzFiles") !== -1', 10000), 'the world: Files opens', 'the app: ' + short(await T('text()')));
    ok(short(await T('bars()')) === short(['📁 Files']), 'Files opens over the tiles under one bar: its icon, its label, ✕', 'bars: ' + short(await T('bars()')));
    ok((await T('bars()')).length === 1 && (await T('tiles()')).length === 0, 'the tiles are out of view under it', 'tiles: ' + short(await T('tiles()')));
    await T('press("zzFiles")');
    await waitFor('rows().indexOf("zzFiles/notes.txt") !== -1');
    await T('markBefore()');
    await T('press("zzFiles/notes.txt")');
    ok(await waitFor('bars().length === 1 && /notes\\.txt$/.test(bars()[0])', 10000), 'a file opens over Files, in the same pane', 'bars: ' + short(await T('bars()')));
    const bars = await T('bars()');
    ok(bars.length === 1 && /^\S+ .*notes\.txt$/.test(bars[0]), 'the box: "over ALL of the one that mounts it, its title bar too": one bar in view, an icon, ending in notes.txt', 'bars: ' + short(bars));
    ok((await T('bars()')).length === 1 && (await T('rows()')).length === 0, 'the list is out of view under it', 'rows: ' + short(await T('rows()')));
    await waitFor('count(".CodeMirror") > 0', 10000);
    const marks = await T('markSel("notes", ".CodeMirror")');

    test.subHeading('the box: "✕ shows the mounter again", and "A closed layer is hidden, not destroyed"');
    await T('close("notes.txt")');
    ok(await waitFor('rows().indexOf("zzFiles/notes.txt") !== -1') && short(await T('bars()')) === short(['📁 Files']), 'its ✕ shows Files again, under its one bar', 'bars: ' + short(await T('bars()')));
    ok(marks > 0 && (await T('marked("notes")')) > 0 && (await T('markedShown("notes")')) === 0, 'the closed layer is still on the page, out of view', 'marked ' + marks + ', kept ' + (await T('marked("notes")')) + ', shown ' + (await T('markedShown("notes")')));
    await T('press("zzFiles/notes.txt")');
    ok(await waitFor('markedShown("notes") > 0', 10000), 'reopening it shows what was there: the same layer, not a new one', 'shown ' + (await T('markedShown("notes")')) + ' of ' + marks);

    test.subHeading('the box: "One stack; each ✕ goes one step back (Q17)"');
    await T('close("notes.txt")');
    ok(await waitFor('rows().indexOf("zzFiles/notes.txt") !== -1') && short(await T('bars()')) === short(['📁 Files']), 'the file\'s ✕ goes one step back, to Files', 'bars: ' + short(await T('bars()')));
    await T('close("Files")');
    ok(await waitFor('bars().length === 0 && tiles().indexOf("file") !== -1'), 'Files\' ✕ goes one more, to the tiles', 'bars: ' + short(await T('bars()')) + ', tiles ' + short(await T('tiles()')));
    await T('press("file")');
    ok(await waitFor('rows().indexOf("zzFiles") !== -1', 10000), 'the Files tile opens it again', 'the app: ' + short(await T('text()')));
    await T('type("notes")');
    await sleep(500);
    await T('close("Files")');
    await waitFor('bars().length === 0');
    await T('press("file")');
    ok(await waitFor('rows().indexOf("zzFiles/notes.txt") !== -1 && words() === "notes"', 10000), 'reopened in the same session it shows what was there: its words kept', 'words: ' + short(await T('words()')));

    test.subHeading('the box: "a reload starts clean"');
    await open();
    await selector('tiles');
    await waitFor('tiles().indexOf("file") !== -1', 10000);
    await T('press("file")');
    ok(await waitFor('rows().indexOf("zzFiles") !== -1', 10000) && (await T('words()')) === '', 'after a reload Files opens with no words', 'words: ' + short(await T('words()')));

    test.subHeading('the box: "The appSelector\'s ✕ hides too (Q3)"');
    await selector('pane');
    ok(await waitFor('rows().indexOf("agent") !== -1', 10000), 'the world: the pane lists the Agent', 'rows: ' + short(await T('rows()')));
    await T('markBefore()');
    await T('press("agent")');
    ok(await waitFor('bars().length === 1', 10000), 'the Agent\'s detail opens under one bar', 'bars: ' + short(await T('bars()')));
    await sleep(1000);
    const detail = await T('markLayer("detail")');
    await T('close("Agent")');
    ok(await waitFor('bars().length === 0 && rows().indexOf("agent") !== -1') && detail > 0 && (await T('marked("detail")')) > 0, 'its ✕ hides the detail: still on the page, out of view', 'marked ' + detail + ', kept ' + (await T('marked("detail")')));
    await T('press("agent")');
    ok(await waitFor('markedShown("detail") > 0', 10000), 'pressed again, the same detail shows', 'shown ' + (await T('markedShown("detail")')));

    test.subHeading('the box: "A deactivated app\'s layer only leaves the view; it stays loaded until the shell boots again, and is not loaded then (Q11)"');
    await call(N.base, 'app.active', { key: 'agent', active: true });
    await selector('tiles');
    ok(await waitFor('tiles().indexOf("agent") !== -1', 15000), 'the world: the Agent, active, has its tile', 'tiles: ' + short(await T('tiles()')));
    await T('markBefore()');
    await T('press("agent")');
    ok(await waitFor('bars().length === 1', 15000), 'the world: its tile opens the Agent', 'bars: ' + short(await T('bars()')));
    await sleep(2000);
    const agent = await T('markLayer("agent")');
    // What threw is judged up to here: after the switch-off the Agent's kept layer is the Agent's own (Q11: it stays loaded).
    heardBefore = c.heard.length;
    const off = await call(N.base, 'app.active', { key: 'agent', active: false });
    ok(off.status === 200, 'the world: app.active switches the Agent off', 'app.active: ' + short(off.text));
    ok(await waitFor('markedShown("agent") === 0', 10000), 'its open layer leaves the view', 'shown ' + (await T('markedShown("agent")')) + ' of ' + agent);
    ok(agent > 0 && (await T('marked("agent")')) > 0, 'and stays on the page, loaded', 'marked ' + agent + ', kept ' + (await T('marked("agent")')));
    ok((await T('tiles()')).indexOf('agent') === -1, 'its tile is gone, so it cannot be reopened', 'tiles: ' + short(await T('tiles()')));
    await open();
    await selector('tiles');
    await waitFor('tiles().indexOf("file") !== -1', 10000);
    await sleep(2000);
    const loaded = await c.evaluate('performance.getEntriesByType("resource").map(function (e) { return e.name.replace(/^https?:\\/\\/[^/]+/, ""); }).filter(function (n) { return /\\/spirit\\/app\\/agent\\//.test(n); })');
    ok(Array.isArray(loaded) && !loaded.length && (await c.evaluate('!(window.spirit.app && window.spirit.app.agent) && !(window.spirit.elements && window.spirit.elements.agent)')), 'after the shell boots again none of it is loaded', 'loaded: ' + short(loaded));

    // goal/G43.18, Andy: "contact details and relay details should be proper panels in the newest shell style."
    test.subHeading('Andy: "contact details and relay details should be proper panels in the newest shell style."');
    // A person in the book beside the relay the node starts with: a key of our own, blocked, so the book holds it.
    const zzKey = require('crypto').generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
    const planted = await call(N.base, 'contact.block', { publicKey: zzKey, publicLabel: 'zzPerson' });
    ok(planted.status === 200, 'the world: a person is in the book', 'contact.block: ' + short(planted.text));
    const found = await call(N.base, 'contact.search', { q: '' });
    const people = ((found.body && found.body.items) || []).map(function (i) { return Object.assign({ key: i.key }, parsed(i.label) || {}); });
    const kinds = [['relay', people.filter(function (p) { return p.relay === true; })[0]], ['contact', people.filter(function (p) { return p.relay !== true; })[0]]];
    for (const k of kinds) {
      const who = k[1];
      ok(!!who, 'the world: the node knows a ' + k[0], 'the world: no ' + k[0] + ' on the scratch node: ' + short(people));
      if (!who) continue;
      await selector('tiles');
      await waitFor('tiles().indexOf("contact") !== -1', 10000);
      await T('press("contact")');
      ok(await waitFor('bars().length === 1 && rows().indexOf(' + JSON.stringify(who.key) + ') !== -1', 10000), 'the world: Contacts opens and lists the ' + k[0], 'bars: ' + short(await T('bars()')) + ', rows: ' + short(await T('rows()')));
      const contacts = (await T('bars()'))[0];
      const depth = await T('depth()');
      await T('openRow(' + JSON.stringify(who.key) + ')');
      ok(await waitFor('bars().length === 1 && bars()[0] !== ' + JSON.stringify(contacts), 10000), 'the ' + k[0] + '\'s details open over Contacts under one bar of their own', 'bars: ' + short(await T('bars()')));
      ok((await T('rows()')).indexOf(who.key) === -1, 'the list is out of view under them', 'rows: ' + short(await T('rows()')));
      ok((await T('depth()')) === depth, 'no page is pushed on the navigation', 'the navigation went from ' + depth + ' to ' + (await T('depth()')));
      const own = (await T('bars()'))[0];
      await T('close(' + JSON.stringify(String(own || '').slice(-12)) + ')');
      ok(await waitFor('bars().length === 1 && bars()[0] === ' + JSON.stringify(contacts) + ' && rows().indexOf(' + JSON.stringify(who.key) + ') !== -1', 10000), 'their ✕ shows Contacts again, one step back', 'bars: ' + short(await T('bars()')) + ', rows: ' + short(await T('rows()')));
    }

    // goal/G43.18, Andy: "now you need to give each contact row its own detail panel, similar to the concept where tabs in
    // "agent" can hold the same ui for different rows, thing of the contact list in the exact same way."
    test.subHeading('Andy: "give each contact row its own detail panel", as the agent\'s tabs hold the same ui for different rows');
    const zzKey2 = require('crypto').generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
    const planted2 = await call(N.base, 'contact.block', { publicKey: zzKey2, publicLabel: 'zzPersonTwo' });
    ok(planted2.status === 200, 'the world: a second person is in the book', 'contact.block: ' + short(planted2.text));
    await selector('tiles');
    await waitFor('tiles().indexOf("contact") !== -1', 10000);
    await T('press("contact")');
    ok(await waitFor('rows().indexOf(' + JSON.stringify(zzKey) + ') !== -1 && rows().indexOf(' + JSON.stringify(zzKey2) + ') !== -1', 10000), 'the world: Contacts lists both', 'rows: ' + short(await T('rows()')));
    const listBar = (await T('bars()'))[0];
    // One row's details: what it draws is marked, then closed.
    const openOne = async function (key, mark) {
      await T('markBefore()');
      await T('openRow(' + JSON.stringify(key) + ')');
      const up = await waitFor('bars().length === 1 && bars()[0] !== ' + JSON.stringify(listBar), 10000);
      await sleep(1000);
      return up ? T('markLayer(' + JSON.stringify(mark) + ')') : 0;
    };
    const closeOne = async function () { const b = (await T('bars()'))[0]; await T('close(' + JSON.stringify(String(b || '').slice(-12)) + ')'); return waitFor('bars()[0] === ' + JSON.stringify(listBar), 10000); };
    // Andy: "the first detail shows the right data, the second row i open always shows nothing.... THAT's the problem.": each
    // panel shows its own row, read from what is in view: its Public Handle fact (detailElement.js) and, blocked, Unblock.
    const inView = function () { return c.evaluate('String((document.getElementById("zzBox") || {}).innerText || "")'); };
    const showsOwn = function (handle) { return inView().then(function (t) { return /Public Handle/.test(t) && /Unblock/.test(t) && new RegExp('Public Handle\\s*' + handle + '(?![A-Za-z])').test(t); }); };
    const a = await openOne(zzKey, 'rowA');
    ok(a > 0, 'the world: the first person\'s details open', 'nothing drew for the first person');
    ok(await until(function () { return showsOwn('zzPerson'); }, 8000), 'the first person\'s panel shows their data: Public Handle zzPerson, Unblock', 'the first panel shows: ' + short(await c.evaluate('String((document.getElementById("zzBox") || {}).innerText || "")')));
    await closeOne();
    const b = await openOne(zzKey2, 'rowB');
    ok(await until(function () { return showsOwn('zzPersonTwo'); }, 8000), 'the second person\'s panel shows their own data: Public Handle zzPersonTwo, Unblock', 'the second panel shows: ' + short(await c.evaluate('String((document.getElementById("zzBox") || {}).innerText || "")')));
    ok(b > 0 && (await T('markedShown("rowA")')) === 0, 'the second person\'s details are a panel of their own: new, and the first\'s out of view', 'drawn for the second ' + b + ', the first\'s shown ' + (await T('markedShown("rowA")')));
    ok((await T('marked("rowA")')) > 0, 'and the first person\'s panel is kept, not drawn over', 'the first person\'s panel is gone: marked ' + (await T('marked("rowA")')));
    await closeOne();
    await T('openRow(' + JSON.stringify(zzKey) + ')');
    ok(await waitFor('markedShown("rowA") > 0 && markedShown("rowB") === 0', 10000) && await showsOwn('zzPerson'), 'the first person pressed again: their own panel shows, as it was left, with their data', 'shown: first ' + (await T('markedShown("rowA")')) + ', second ' + (await T('markedShown("rowB")')));
    await closeOne();

    test.subHeading('nothing threw on the page');
    // The Agent is the world here, opened with no agent server on the scratch node; what its own table throws is the Agent's, not
    // the panel's (its stack in spirit/app/agent/).
    const thrown = c.heard.slice(0, heardBefore).filter(function (m) { return m.method === 'Runtime.exceptionThrown'; }).map(function (m) { return (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text; })
      .filter(function (t) { return !/^\s+at .*spirit\/app\/agent\//m.test(String(t)); });
    ok(!thrown.length, 'no uncaught error on the page outside the Agent, up to the Agent switched off', 'thrown: ' + short(thrown));
    await stop(N.child);
  } finally {
    live.forEach(function (x) { try { x.kill(); } catch (e) { /* gone */ } });
    if (c && c.kid) { try { c.kid.kill(); } catch (e) { /* gone */ } }
    await sleep(300);
    try { fs.rmSync(s.root, { recursive: true, force: true }); } catch (e) { /* a door still closing; the temp folder keeps it */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
