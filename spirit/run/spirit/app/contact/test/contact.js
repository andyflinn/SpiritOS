'use strict';

// spirit/run/spirit/app/contact/test/contact.js
// The tests of spirit/app/contact/contact.js, and of Contacts as Andy sees it (spec: ./contact.md; goal/G43.14). Andy: "the new
// contact app will be exactly the same as the old, merely placed where it now belongs." A real node on a scratch copy of the
// tracked files, and real clicks in a real Chrome on the appSelector, made as the shell app (spirit/app/shell/shell.js) makes it. Neither Andy's node nor an
// agent's is touched.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');
const RUN = path.resolve(__dirname, '../../../..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const VENDORED_FOLDERS = require(path.join(RUN, 'spirit', 'fileSystem.js')).VENDORED_FOLDERS;
const { freePort, until, sleep, chromePage, findChrome } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }
// Every file under a folder.
function filesUnder(dir) {
  const out = [];
  (function walk(d) { (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []).forEach(function (e) { if (VENDORED_FOLDERS.holds(path.join(d, e.name)) || e.name === 'state' || e.name === 'agents') return; const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else out.push(p); }); }(dir));
  return out;
}
// The code of the tree, its comments out, its tests out: what runs.
function codeNaming(re) {
  return filesUnder(RUN).filter(function (f) { return /\.(js|html)$/.test(f) && f.split(path.sep).indexOf('test') === -1; })
    .filter(function (f) { return re.test(fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, '')); })
    .map(function (f) { return path.relative(RUN, f); });
}

const APP = path.join(RUN, 'spirit', 'app', 'contact');
const COUNTERS = ['unansweredInbound', 'inboundPerDay', 'outboundPerDay'];

function scratch() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-contact-'));
  execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
    .filter(function (f) { return fs.existsSync(path.join(REPO, f)); })
    .forEach(function (f) { const d = path.join(root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
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

test.startTest('contact.js: Contacts in spirit/app/contact/, as Andy sees it (goal/G43.14)');

(async function () {
  test.subHeading('the box: "the folder spirit/element/contacts/ needs to be renamed spirit/element/search/contact/"');
  ok(!fs.existsSync(path.join(RUN, 'spirit', 'element', 'contacts')), 'spirit/element/contacts/ is gone', 'spirit/element/contacts/ is still there');
  ok(['listElement.js', 'rowElement.js'].every(function (f) { return fs.existsSync(path.join(RUN, 'spirit', 'element', 'search', 'contact', f)); }), 'spirit/element/search/contact/ holds listElement.js and rowElement.js', 'spirit/element/search/contact/ lacks one of them');
  const oldElement = codeNaming(/spirit\/element\/contacts\//);
  ok(!oldElement.length, 'no code names spirit/element/contacts/', 'naming it: ' + short(oldElement));

  test.subHeading('the box: "the new contact app will be exactly the same as the old, merely placed where it now belongs"');
  ok(!fs.existsSync(path.join(RUN, 'shell', 'contacts')), 'shell/contacts/ is gone', 'shell/contacts/ is still there');
  ok(fs.existsSync(path.join(APP, 'contact.js')), 'spirit/app/contact/contact.js is there', 'no spirit/app/contact/contact.js');
  const oldApp = codeNaming(/shell\/contacts\b/);
  ok(!oldApp.length, 'no code names shell/contacts', 'naming it: ' + short(oldApp));
  const own = readJson(path.join(APP, 'contact.json')) || {};
  const id = own.identity || {};
  ok(id.icon === '🤩', 'its icon is 🤩 (Andy: "icon for new contact app: 🤩")', 'identity.icon: ' + short(id.icon));
  ok(id.label === 'Contacts', 'its label is Contacts, as the old app\'s name', 'identity.label: ' + short(id.label));
  ok(id.intrinsic === true, 'it is intrinsic (the box: "Contacts is always on today, so it is always on in spirit/app too")', 'identity.intrinsic: ' + short(id.intrinsic));
  ok(!!own.shell && own.shell.mount === true && !!own.node && own.node.mount === false, 'it mounts on the shell and has no server', 'shell ' + short(own.shell) + ', node ' + short(own.node));

  test.subHeading('the box: "spirit/peerStats.js goes, and with it the count of every message that arrives"');
  ok(!fs.existsSync(path.join(RUN, 'spirit', 'peerStats.js')), 'spirit/peerStats.js is gone', 'spirit/peerStats.js is still there');
  const counting = codeNaming(/peerStats/);
  ok(!counting.length, 'no code names peerStats', 'naming it: ' + short(counting));

  const s = scratch();
  const live = [];
  let c = null;
  try {
    const N = await boot(s.run); live.push(N.child);
    ok(N.up, 'the world: a scratch node comes up', 'the scratch node did not come up: nothing judged');
    if (!N.up) return;

    test.subHeading('the box: "A contact row no longer carries unansweredInbound, inboundPerDay or outboundPerDay"');
    const found = await call(N.base, 'contact.search', { q: '' });
    const items = (found.body && found.body.items) || [];
    ok(items.length > 0, 'the world: the node knows a contact', 'contact.search: ' + short(found.text));
    const relay = items.map(function (i) { return Object.assign({ key: i.key }, parsed(i.label) || {}); }).filter(function (r) { return r.name; })[0] || {};
    ok(items.every(function (i) { const r = parsed(i.label) || {}; return COUNTERS.every(function (k) { return !(k in r); }); }), 'no row of contact.search carries them', 'rows: ' + short(items));
    const got = await call(N.base, 'contact.get', { key: relay.key });
    const person = (got.body && (got.body.person || got.body)) || {};
    ok(got.status === 200 && COUNTERS.every(function (k) { return !(k in person); }), 'nor does contact.get', 'contact.get: ' + short(got.text));

    const where = findChrome();
    if (!where) { test.fail('no Chrome here: the page was not judged'); return; }
    c = await chromePage(where);
    if (c.error) { test.fail('Chrome: ' + c.error); return; }
    // The shell Andy uses, /face.html, where the shell app (spirit/app/shell/shell.js) runs the appSelector (boot.js loads what an app's pages open with).
    await c.send('Page.navigate', { url: N.base + '/face.html' });
    ok(await until(function () { return c.evaluate('!!(window.spirit && window.spirit.ready && window.spirit.events)'); }, 20000), 'the world: the face shell has its spirit', 'the page has no spirit: nothing judged');
    const selector = function (face) {
      return c.evaluate('(function () { if (window.__sel) window.__sel.destroy(); var old = document.getElementById("zzBox"); if (old) old.remove(); var b = document.createElement("div"); b.id = "zzBox"; b.className = "fill"; b.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;background:#fff;z-index:9999"; document.body.appendChild(b); return spirit.require("spirit/app/appSelector.js").then(function () { window.__sel = spirit.element.spirit.app.appSelector.create(b, { face: ' + JSON.stringify(face) + ' }); return "made"; }); }())');
    };
    // The box's text on one line, so a failure says what was on the page.
    const shown = function () { return c.evaluate('(document.getElementById("zzBox") || {}).innerText || ""').then(function (t) { return String(t).replace(/\s+/g, ' '); }); };
    const shows = function (words) { return until(function () { return shown().then(function (t) { return t.indexOf(words) !== -1; }); }, 8000); };
    const press = function (words) {
      return c.evaluate('(function () { var box = document.getElementById("zzBox"); var all = Array.prototype.slice.call(box.querySelectorAll("*")).filter(function (e) { return e.offsetParent !== null && String(e.innerText || "").trim().indexOf(' + JSON.stringify(words) + ') !== -1 && !Array.prototype.some.call(e.children, function (k) { return String(k.innerText || "").indexOf(' + JSON.stringify(words) + ') !== -1; }); }); if (!all.length) return false; all[0].click(); return true; }())');
    };

    test.subHeading('the box: "intrinsic true: the app is always active": its tile is there with nothing pressed');
    await selector('tiles');
    ok(await shows('Contacts'), 'the tiles show Contacts, with nothing pressed', 'tiles: ' + short(await shown()));

    test.subHeading('the box: "exactly the same as the old": its tile opens the contacts');
    await press('Contacts');
    ok(await shows(relay.name || 'noderoutes'), 'its tile opens the app, and the contact the node knows is listed, ' + (relay.name || ''), 'the app: ' + short(await shown()));
    await press(relay.name || 'noderoutes');
    await sleep(1500);
    const detail = await shown();
    ok(!/Unanswered inbound|Inbound rate|Outbound rate/.test(detail), 'the box: "a contact\'s detail no longer shows them"', 'the detail: ' + short(detail));

    test.subHeading('the box: "In the appSelector\'s detail an intrinsic app has no row to activate or deactivate it"');
    await selector('pane');
    await shows('Contacts');
    await press('Contacts');
    await sleep(2000);
    const panel = await shown();
    ok(panel.indexOf('Contacts') !== -1 && !/Activate|Deactivate/.test(panel), 'its detail shows no Activate and no Deactivate', 'its detail: ' + short(panel));

    test.subHeading('the box: "app.active does not switch it off"');
    await call(N.base, 'app.active', { key: 'contact', active: false });
    await selector('tiles');
    await sleep(1500);
    ok((await shown()).indexOf('Contacts') !== -1, 'after app.active false, its tile is still there', 'tiles: ' + short(await shown()));

    test.subHeading('nothing threw on the page');
    const thrown = c.heard.filter(function (m) { return m.method === 'Runtime.exceptionThrown'; }).map(function (m) { return (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text; });
    ok(!thrown.length, 'no uncaught error on the page, all the way', 'thrown: ' + short(thrown));
    await stop(N.child);
  } finally {
    live.forEach(function (x) { try { x.kill(); } catch (e) { /* gone */ } });
    if (c && c.kid) { try { c.kid.kill(); } catch (e) { /* gone */ } }
    await sleep(300);
    try { fs.rmSync(s.root, { recursive: true, force: true }); } catch (e) { /* a door still closing; the temp folder keeps it */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
