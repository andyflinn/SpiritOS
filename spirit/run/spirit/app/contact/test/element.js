'use strict';

// spirit/run/spirit/app/contact/test/element.js
// The tests of spirit/app/contact/element.js, and of Contacts as Andy sees it (spec: ./contact.md; goal/G43.14). Andy: "the new
// contact app will be exactly the same as the old, merely placed where it now belongs." A real node on a scratch copy of the
// tracked files, and real clicks in a real Chrome on the appSelector, made as the shell app (spirit/app/app/element.js) makes it. Neither Andy's node nor an
// agent's is touched.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');
const RUN = path.resolve(__dirname, '../../../..');
// Every node this test uses is one of lab's (goal/G47.3): its tree by scratchTree, its node by startNodeOn.
const LABH = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const VENDORED_FOLDERS = require(path.join(RUN, 'spirit', 'fileSystem.js')).VENDORED_FOLDERS;
const { freePort, until, sleep, chromePage, findChrome } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

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
  const root = LABH.scratchTree().root;
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
  const child = LABH.startNodeOn(run, port);
  const base = 'http://127.0.0.1:' + port;
  const up = await until(function () { return call(base, 'api').then(function (r) { return r.status === 200; }); }, 60000);
  return { child: child, base: base, up: !!up };
}
function stop(c) { return new Promise(function (r) { if (!c || c.exitCode !== null) return r(); c.once('exit', function () { r(); }); c.kill(); setTimeout(r, 6000); }); }

// contact.js: Contacts in spirit/app/contact/, as Andy sees it (goal/G43.14). One test.run per test (goal/G47.2).
// What the world made, for the tests after it.
const W = { live: [] };
test.after(async function () {
  W.live.forEach(function (x) { try { x.kill(); } catch (e) { /* gone */ } });
  if (W.c && W.c.kid) { try { W.c.kid.kill(); } catch (e) { /* gone */ } }
  await sleep(300);
  if (W.s) { try { LABH.freeTree(W.s); } catch (e) { /* a door still closing; the temp folder keeps it */ } }
});
const NO_NODE = 'no scratch node: the world failed';
const NO_PAGE = 'no page: the world failed';

// the box: "the folder spirit/element/contacts/ needs to be renamed spirit/element/search/contact/"
test.run('spirit/element/contacts/ is gone', 0.2, function () {
  return !fs.existsSync(path.join(RUN, 'spirit', 'element', 'contacts')) || 'spirit/element/contacts/ is still there';
}, test.limit.quick);
test.run('spirit/element/search/contact/ holds listElement.js and rowElement.js', 0.2, function () {
  return ['listElement.js', 'rowElement.js'].every(function (f) { return fs.existsSync(path.join(RUN, 'spirit', 'element', 'search', 'contact', f)); }) || 'spirit/element/search/contact/ lacks one of them';
}, test.limit.quick);
test.run('no code names spirit/element/contacts/', 0.2, function () {
  const oldElement = codeNaming(/spirit\/element\/contacts\//);
  return !oldElement.length || 'naming it: ' + short(oldElement);
}, test.limit.quick);

// the box: "the new contact app will be exactly the same as the old, merely placed where it now belongs"
test.run('shell/contacts/ is gone', 0.2, function () {
  return !fs.existsSync(path.join(RUN, 'shell', 'contacts')) || 'shell/contacts/ is still there';
}, test.limit.quick);
test.run('spirit/app/contact/element.js is there', 0.2, function () {
  return fs.existsSync(path.join(APP, 'element.js')) || 'no spirit/app/contact/element.js';
}, test.limit.quick);
test.run('no code names shell/contacts', 0.2, function () {
  const oldApp = codeNaming(/shell\/contacts\b/);
  return !oldApp.length || 'naming it: ' + short(oldApp);
}, test.limit.quick);
const OWN = function () { return readJson(path.join(APP, 'contact.json')) || {}; };
test.run('its icon is 🤩 (Andy: "icon for new contact app: 🤩")', 0.2, function () {
  const id = OWN().identity || {};
  return id.icon === '🤩' || 'identity.icon: ' + short(id.icon);
}, test.limit.quick);
test.run('its label is Contacts, as the old app\'s name', 0.2, function () {
  const id = OWN().identity || {};
  return id.label === 'Contacts' || 'identity.label: ' + short(id.label);
}, test.limit.quick);
test.run('it is intrinsic (the box: "Contacts is always on today, so it is always on in spirit/app too")', 0.2, function () {
  const id = OWN().identity || {};
  return id.intrinsic === true || 'identity.intrinsic: ' + short(id.intrinsic);
}, test.limit.quick);
test.run('it mounts on the shell and has no server', 0.2, function () {
  const own = OWN();
  return !!own.shell && own.shell.mount === true && !!own.node && own.node.mount === false ? true : 'shell ' + short(own.shell) + ', node ' + short(own.node);
}, test.limit.quick);

// the box: "spirit/peerStats.js goes, and with it the count of every message that arrives"
test.run('spirit/peerStats.js is gone', 0.2, function () {
  return !fs.existsSync(path.join(RUN, 'spirit', 'peerStats.js')) || 'spirit/peerStats.js is still there';
}, test.limit.quick);
test.run('no code names peerStats', 0.2, function () {
  const counting = codeNaming(/peerStats/);
  return !counting.length || 'naming it: ' + short(counting);
}, test.limit.quick);

test.run('the world: a scratch node comes up', 0.2, async function () {
  W.s = scratch();
  const N = await boot(W.s.run); W.live.push(N.child);
  W.N = N;
  return N.up || 'the scratch node did not come up: nothing judged';
}, test.limit.slow);

// the box: "A contact row no longer carries unansweredInbound, inboundPerDay or outboundPerDay"
test.run('the world: the node knows a contact', 0.2, async function () {
  if (!W.N || !W.N.up) return NO_NODE;
  const found = await call(W.N.base, 'contact.search', { q: '' });
  W.items = (found.body && found.body.items) || [];
  W.relay = W.items.map(function (i) { return Object.assign({ key: i.key }, parsed(i.label) || {}); }).filter(function (r) { return r.name; })[0] || {};
  return W.items.length > 0 || 'contact.search: ' + short(found.text);
}, test.limit.quick);
test.run('no row of contact.search carries them', 0.2, function () {
  if (!W.items) return NO_NODE;
  return W.items.every(function (i) { const r = parsed(i.label) || {}; return COUNTERS.every(function (k) { return !(k in r); }); }) || 'rows: ' + short(W.items);
}, test.limit.quick);
test.run('nor does contact.get', 0.2, async function () {
  if (!W.N || !W.N.up) return NO_NODE;
  const got = await call(W.N.base, 'contact.get', { key: (W.relay || {}).key });
  const person = (got.body && (got.body.person || got.body)) || {};
  return got.status === 200 && COUNTERS.every(function (k) { return !(k in person); }) ? true : 'contact.get: ' + short(got.text);
}, test.limit.quick);

test.run('the world: a Chrome page', 0.2, async function () {
  if (!W.N || !W.N.up) return NO_NODE;
  const where = findChrome();
  if (!where) return 'no Chrome here: the page was not judged';
  W.c = await chromePage(where);
  if (W.c.error) { const e = W.c.error; W.c = null; return 'Chrome: ' + e; }
  return true;
}, test.limit.quick);
// The shell Andy uses, /face.html, where the shell app (spirit/app/app/element.js) runs the appSelector (boot.js loads what an app's pages open with).
const selector = function (face) {
  return W.c.evaluate('(function () { if (window.__sel) window.__sel.destroy(); var old = document.getElementById("zzBox"); if (old) old.remove(); var b = document.createElement("div"); b.id = "zzBox"; b.className = "fill"; b.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;background:#fff;z-index:9999"; document.body.appendChild(b); return spirit.require("spirit/app/app/element.js").then(function () { window.__sel = spirit.element.spirit.app.app.element.create(b, { face: ' + JSON.stringify(face) + ' }); return "made"; }); }())');
};
// The box's text on one line, so a failure says what was on the page.
const shown = function () { return W.c.evaluate('(document.getElementById("zzBox") || {}).innerText || ""').then(function (t) { return String(t).replace(/\s+/g, ' '); }); };
const shows = function (words) { return until(function () { return shown().then(function (t) { return t.indexOf(words) !== -1; }); }, 8000); };
const press = function (words) {
  return W.c.evaluate('(function () { var box = document.getElementById("zzBox"); var all = Array.prototype.slice.call(box.querySelectorAll("*")).filter(function (e) { return e.offsetParent !== null && String(e.innerText || "").trim().indexOf(' + JSON.stringify(words) + ') !== -1 && !Array.prototype.some.call(e.children, function (k) { return String(k.innerText || "").indexOf(' + JSON.stringify(words) + ') !== -1; }); }); if (!all.length) return false; all[0].click(); return true; }())');
};
test.run('the world: the face shell has its spirit', 0.2, async function () {
  if (!W.c) return 'no Chrome page: the world failed';
  await W.c.send('Page.navigate', { url: W.N.base + '/face.html' });
  W.page = !!(await until(function () { return W.c.evaluate('!!(window.spirit && window.spirit.ready && window.spirit.event)'); }, 20000));
  return W.page || 'the page has no spirit: nothing judged';
}, test.limit.quick);

// the box: "intrinsic true: the app is always active": its tile is there with nothing pressed
test.run('the tiles show Contacts, with nothing pressed', 0.2, async function () {
  if (!W.page) return NO_PAGE;
  await selector('tiles');
  return await shows('Contacts') ? true : 'tiles: ' + short(await shown());
}, test.limit.quick);

// the box: "exactly the same as the old": its tile opens the contacts
test.run('its tile opens the app, and the contact the node knows is listed', 0.2, async function () {
  if (!W.page) return NO_PAGE;
  const relay = W.relay || {};
  await press('Contacts');
  return await shows(relay.name || 'noderoutes') ? true : 'the app, wanting ' + (relay.name || 'noderoutes') + ': ' + short(await shown());
}, test.limit.quick);
test.run('the box: "a contact\'s detail no longer shows them"', 0.2, async function () {
  if (!W.page) return NO_PAGE;
  await press((W.relay || {}).name || 'noderoutes');
  await sleep(1500);
  const detail = await shown();
  return !/Unanswered inbound|Inbound rate|Outbound rate/.test(detail) || 'the detail: ' + short(detail);
}, test.limit.slow);

// the box: "In the appSelector's detail an intrinsic app has no row to activate or deactivate it"
test.run('its detail shows no Activate and no Deactivate', 0.2, async function () {
  if (!W.page) return NO_PAGE;
  await selector('pane');
  await shows('Contacts');
  await press('Contacts');
  await sleep(2000);
  const panel = await shown();
  return panel.indexOf('Contacts') !== -1 && !/Activate|Deactivate/.test(panel) ? true : 'its detail: ' + short(panel);
}, test.limit.slow);

// the box: "app.active does not switch it off"
test.run('after app.active false, its tile is still there', 0.2, async function () {
  if (!W.page) return NO_PAGE;
  await call(W.N.base, 'app.active', { key: 'contact', active: false });
  await selector('tiles');
  await sleep(1500);
  return (await shown()).indexOf('Contacts') !== -1 || 'tiles: ' + short(await shown());
}, test.limit.slow);

// nothing threw on the page
test.run('no uncaught error on the page, all the way', 0.2, async function () {
  if (!W.c) return NO_PAGE;
  const thrown = W.c.heard.filter(function (m) { return m.method === 'Runtime.exceptionThrown'; }).map(function (m) { return (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text; });
  await stop(W.N.child);
  return !thrown.length || 'thrown: ' + short(thrown);
}, test.limit.quick);
