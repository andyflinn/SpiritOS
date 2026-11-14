'use strict';

// spirit/run/spirit/app/icons/test/icons.js
// The tests of spirit/app/icons/icons.js, the one file the node and the page load, and of no other module (spec: ./icons.md;
// goal/G43.19, box v16): the app's files, its one-shot runs, its job, its tile. Its halves have tests of their own
// (./nodeIcons.js, ./browserIcons.js, ./data.js, ./api.js). Andy:
// "icons is an app with a face, and an api, no fucking process for some trivial shit like a quickie applet", "for apps
// with only shell:mount:true and node:mount:false or missing, BUT with a api.js and data.js, the node must execute
// spirit/app/<name>/<name>.js with the request, instead of routing it to a server, like a cgi-script, and that process
// lives only as long as the request.", "there's no reason that icons shouldn't publish like any other server."
// A scratch node of the tracked files with Icons switched on, a real Chrome on its face page; neither Andy's node nor an
// agent's is touched. The verbs are read from the app's own api.js and the face is driven by Andy's own words for it
// (G41.27: "[➕] [an icon:paste] [keywords, comma separated][Add]"), so no name the box left open is guessed. What was
// written is read from the disc, what runs from the machine's process list.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until, appRuns, watchRuns } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
const APP = path.join(RUN, 'spirit', 'app', 'icons');

// The code with its comments blanked, so a word in a comment is no call. Strings are kept whole.
function code(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') { out += ' '; i++; } continue; }
    if (c === '/' && n === '*') { while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++; } out += '  '; i += 2; continue; }
    if (c === '\'' || c === '"' || c === '`') {
      const q = c; out += c; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') { out += src[i]; i++; } out += src[i]; i++; }
      out += q; i++; continue;
    }
    out += c; i++;
  }
  return out;
}
function read(f) { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return null; } }
function json(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }

// The runs of an app's script on the scratch node: spirit/test/headLessChrome.js's, the one watch the tests share.
function iconsProcesses(root, name) { return appRuns(root, name || 'icons'); }

// icons: the Icons app, a face and an api, run by the node per request, with no process of its own (goal/G43.19).
// One test.run per test (goal/G47.2). What the world made, for the tests after it.
const W = { verbs: [] };
const NO_NODE = 'no scratch node, Chrome or free glyphs: the world failed';
const NO_FACE = 'the face did not draw: the world failed';
test.after(function () {
  const c = W.chrome;
  if (c) {
    try { if (c.sock) c.sock.close(); } catch (e) { /* gone */ }
    try { if (c.kid) c.kid.kill(); } catch (e) { /* gone */ }
  }
  const node = W.node || {};
  try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (node.root) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(node); } catch (e) { /* scratch */ }
});

// the box: "a face-only app get's api.js, data.js, node<Name>.js, browser<Name>.js" (Q5, Q6)
test.run('spirit/app/icons/api.js is there', 0.2, function () { return fs.existsSync(path.join(APP, 'api.js')) || 'spirit/app/icons/api.js is not there'; }, test.limit.quick);
test.run('spirit/app/icons/data.js is there', 0.2, function () { return fs.existsSync(path.join(APP, 'data.js')) || 'spirit/app/icons/data.js is not there'; }, test.limit.quick);
test.run('spirit/app/icons/icons.js is there', 0.2, function () { return fs.existsSync(path.join(APP, 'icons.js')) || 'spirit/app/icons/icons.js is not there'; }, test.limit.quick);
test.run('spirit/app/icons/nodeIcons.js is there', 0.2, function () { return fs.existsSync(path.join(APP, 'nodeIcons.js')) || 'spirit/app/icons/nodeIcons.js is not there'; }, test.limit.quick);
test.run('spirit/app/icons/element.js is there', 0.2, function () { return fs.existsSync(path.join(APP, 'element.js')) || 'spirit/app/icons/element.js is not there'; }, test.limit.quick);
test.run('api.js at the app\'s top, no api/ folder (Q5)', 0.2, function () { return !fs.existsSync(path.join(APP, 'api')) || 'spirit/app/icons/api/ stands'; }, test.limit.quick);
test.run('the box, 1: "icons.json keeps node mount false and shell mount true"', 0.2, function () {
  const own = json(path.join(APP, 'icons.json')) || {};
  return !(own.node && own.node.mount === true) && !!(own.shell && own.shell.mount === true) ? true : 'icons.json says ' + short({ node: own.node, shell: own.shell });
}, test.limit.quick);
// goal/G43.32: by spirit.require and its run-root path, as every script loads the tree.
test.run('the box, 7: icons.js, run in node, spirit.requires spirit/app/icons/nodeIcons.js', 0.2, function () {
  const main = code(read(path.join(APP, 'icons.js')) || '');
  return (/\.require\(\s*['"]spirit\/app\/icons\/nodeIcons\.js['"]\s*\)/).test(main) || 'icons.js spirit.requires no spirit/app/icons/nodeIcons.js';
}, test.limit.quick);
const pageCode = function (f) { return code(read(path.join(APP, f)) || ''); };
const writes = /\bfs\s*\.\s*(saveFile|save|deleteFile|delete)\b|\.saveFile\s*\(/;
test.run('icons.js mounts no longer through spirit.shell.activateApp', 0.2, function () {
  const ic = pageCode('icons.js');
  return ic !== '' && !/activateApp/.test(ic) ? true : 'icons.js still calls activateApp, or is not there';
}, test.limit.quick);
test.run('the box: "the page writes no file of its own": icons.js calls no fs save or delete', 0.2, function () {
  const ic = pageCode('icons.js');
  return ic !== '' && !writes.test(ic) ? true : 'icons.js still writes through the fs family, or is not there';
}, test.limit.quick);
test.run('element.js mounts no longer through spirit.shell.activateApp', 0.2, function () {
  const el = pageCode('element.js');
  return el !== '' && !/activateApp/.test(el) ? true : 'element.js still calls activateApp, or is not there';
}, test.limit.quick);
test.run('the box: "the page writes no file of its own": element.js calls no fs save or delete', 0.2, function () {
  const el = pageCode('element.js');
  return el !== '' && !writes.test(el) ? true : 'element.js still writes through the fs family, or is not there';
}, test.limit.quick);
test.run('the world: api.js names its verbs', 0.2, function () {
  try { W.verbs = Object.keys(require(path.join(APP, 'api.js')).verbs || {}); } catch (e) { W.verbs = []; }
  return W.verbs.length >= 1 || 'api.js names no verbs, so no call is judged';
}, test.limit.quick);

// Desk switched on beside it: a permanent server, so the process list is shown to find a running app script.
test.run('the world: a scratch node with Icons and Desk switched on, its disc its own, and a Chrome page', 0.2, async function () {
  W.node = await scratchNode({ servers: ['icons', 'desk'] });
  W.chrome = await chromePage(findChrome());
  if (!W.node.up || W.chrome.error) return 'no scratch node or no Chrome: nothing judged. ' + short(W.chrome.error || '');
  if (!W.node.root) return 'the scratch node is shared, so its disc cannot be read: nothing judged';
  const run = path.join(W.node.root, 'spirit', 'run');
  W.SET = path.join(run, 'spirit', 'state', 'icons', 'data', 'iconSet.json');
  W.up = true;
  return true;
}, test.limit.slow);
test.run('the world: seven glyphs the system set does not hold', 0.2, function () {
  if (!W.up) return 'no scratch node or no Chrome: the world failed';
  const system = json(path.join(W.node.root, 'spirit', 'run', 'spirit', 'iconSet.json')) || {};
  // GLYPHS THE SYSTEM SET DOES NOT HOLD (cw found it: the set starts as the system set, so a glyph of it is a duplicate,
  // refused by Andy's rule, and nothing would be written). Compared without the invisible variation selectors.
  const bare = function (g) { return String(g || '').replace(/[︎️]/g, ''); };
  const known = Object.keys(system).map(bare);
  // Single pictures, one code point each, taken in order from the pictograph blocks.
  const CANDIDATES = [];
  for (let cp = 0x1F300; cp <= 0x1FAFF && CANDIDATES.length < 2000; cp++) { const g = String.fromCodePoint(cp); if (/\p{Extended_Pictographic}/u.test(g)) CANDIDATES.push(g); }
  const fresh = CANDIDATES.filter(function (g) { return known.indexOf(bare(g)) === -1; });
  if (fresh.length < 7) return 'only ' + fresh.length + ' candidate glyphs are not in spirit/iconSet.json: nothing to add';
  W.G1 = fresh[0]; W.G2 = fresh[1]; W.REST = fresh.slice(2);
  W.ready = true;
  return true;
}, test.limit.quick);
const ask = async function (call, args) {
  const r = await fetch(W.node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args || {} }) });
  const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch (e) { b = null; }
  return { status: r.status, body: b, text: t };
};
const none = function () { return iconsProcesses(W.node.root).length === 0; };

// the box, 1: "icons has no running process"; 8: the api tree asks it, and its run ends
test.run('the world: the process list finds the permanent desk.js running, once', 0.2, async function () {
  if (!W.ready) return NO_NODE;
  return await until(function () { return Promise.resolve(iconsProcesses(W.node.root, 'desk').length === 1); }, 15000) ? true : 'the process list finds ' + short(iconsProcesses(W.node.root, 'desk')) + ' of desk.js, so it cannot judge a run';
}, test.limit.quick);
test.run('switched on and idle, no process runs icons.js', 0.2, function () {
  if (!W.ready) return NO_NODE;
  return none() || 'icons.js runs while idle: ' + short(iconsProcesses(W.node.root));
}, test.limit.quick);
test.run('the api tree holds the icons branch, answered from icons.js', 0.2, async function () {
  if (!W.ready) return NO_NODE;
  const tree = await ask('api', {});
  W.branch = tree.body && tree.body.icons;
  return tree.status === 200 && !!W.branch ? true : 'the tree: ' + tree.status + ' ' + short(tree.body && Object.keys(tree.body));
}, test.limit.quick);
// Its one verb, icon, written out so that its check has a plain title.
test.run('its branch names icon', 0.2, function () {
  if (!W.ready) return NO_NODE;
  return JSON.stringify(W.branch || '').indexOf('icon') !== -1 || 'its branch does not name icon: ' + short(W.branch) + '; its verbs: ' + W.verbs.join(', ');
}, test.limit.quick);
test.run('and once the tree is answered no icons.js runs', 0.2, async function () {
  if (!W.ready) return NO_NODE;
  return await until(function () { return Promise.resolve(none()); }, 3000) ? true : 'icons.js still runs after the tree: ' + short(iconsProcesses(W.node.root));
}, test.limit.quick);

// the box, 10: "The node keeps one job for the app, module spirit.app.icons, open while the app is switched on"
test.run('spirit.app.icons is a job, open', 0.2, async function () {
  if (!W.ready) return NO_NODE;
  const job = await ask('job.get', { key: 'spirit.app.icons' });
  const j0 = (job.body && job.body.job) || null;
  return !!j0 && !/end|exit|stop|cancel|fail/i.test(String(j0.status || '')) ? true : 'job.get spirit.app.icons: ' + short(job.body);
}, test.limit.quick);

// the face, by its tile (the box: "its tile opens no face"), and Andy's add row: "[➕] [an icon:paste] [keywords, comma separated][Add]"
const open = async function (page) {
  const made = await page.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/app/app/element.js"); }).then(function () { var old = document.getElementById("faces"); if (old) old.remove(); var c = document.createElement("div"); c.id = "faces"; c.style.cssText = "position:fixed;left:0;top:0;width:1200px;height:800px;display:flex;flex-direction:column;background:#111;z-index:9"; document.body.appendChild(c); window.fsel = spirit.element.spirit.app.app.element.create(c, { face: "tiles" }); if (window.fsel.parentNode !== c) c.appendChild(window.fsel); return "made"; }, function (e) { return String(e && e.message || e); })');
  if (made !== 'made') return 'appSelector: ' + made;
  const tile = 'Array.prototype.filter.call(document.querySelectorAll("#faces .app-icon"), function (t) { return t.offsetParent !== null && String(t.textContent).indexOf("Icons") !== -1; })[0]';
  if (!await until(function () { return page.evaluate('!!' + tile); }, 10000)) return 'no Icons tile';
  await page.evaluate('(function () { window.pageErrors = []; window.addEventListener("error", function (e) { window.pageErrors.push(String(e.message)); }); ' + tile + '.click(); return true; }())');
  return 'opened';
};
const LAYER = 'Array.prototype.filter.call(document.querySelectorAll("#faces .app-container"), function (c) { return c.offsetParent !== null; })[0]';
const field = function (which) { return '(function () { var l = ' + LAYER + '; if (!l) return null; return Array.prototype.filter.call(l.querySelectorAll("input"), function (i) { var p = String(i.placeholder || ""); return i.getClientRects().length && (' + (which === 'glyph' ? '/icon/i.test(p) && !/keyword/i.test(p)' : '/keywords, comma separated/i.test(p)') + '); })[0] || null; }())'; };
const ADD = '(function () { var l = ' + LAYER + '; if (!l) return null; return Array.prototype.filter.call(l.querySelectorAll("button"), function (b) { return b.getClientRects().length && String(b.textContent).trim() === "Add"; })[0] || null; }())';
const layerText = function (page) { return page.evaluate('(function () { var l = ' + LAYER + '; return l ? String(l.innerText) : ""; }())'); };
// What the face itself does (its add row, the duplicate, a second page) is browserIcons.js's test; what the table holds,
// nodeIcons.js's. Here: the app's tile opens the face, and an Add through it is one run of icons.js, ended.
const add = function (page, glyph, words) { return page.evaluate('(function () { var g = ' + field('glyph') + ', k = ' + field('keywords') + ', b = ' + ADD + '; if (!g || !k || !b) return false; g.value = ' + JSON.stringify(glyph) + '; g.dispatchEvent(new Event("input", { bubbles: true })); k.value = ' + JSON.stringify(words) + '; k.dispatchEvent(new Event("input", { bubbles: true })); b.click(); return true; }())'); };
test.run('the world: the Icons tile is there and pressed', 0.2, async function () {
  if (!W.ready) return NO_NODE;
  await W.chrome.send('Page.navigate', { url: W.node.base + '/face.html' });
  await until(function () { return W.chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
  const opened = await open(W.chrome);
  W.opened = opened === 'opened';
  return W.opened || 'the Icons tile: ' + opened;
}, test.limit.quick);
test.run('its tile opens its face: an icon to paste, its keywords, comma separated, and Add', 0.2, async function () {
  if (!W.opened) return 'the Icons tile was not pressed: the world failed';
  W.drew = !!(await until(function () { return W.chrome.evaluate('!!' + field('glyph') + ' && !!' + field('keywords') + ' && !!' + ADD); }, 10000));
  return W.drew || 'no add row in the layer; page errors ' + short(await W.chrome.evaluate('JSON.stringify(window.pageErrors || [])')) + '; the layer: ' + short(await layerText(W.chrome));
}, test.limit.quick);

// an Add through its tile's face is a run of icons.js, and the run ends
test.run('an Add writes the new glyph into spirit/state/icons/data/iconSet.json', 0.2, async function () {
  if (!W.drew) return NO_FACE;
  await add(W.chrome, W.G1, 'flamingo, bird');
  const wrote = await until(function () { return Promise.resolve(((json(W.SET) || {})[W.G1] || []).join(',') === 'flamingo,bird'); }, 10000);
  return wrote ? true : 'after the Add of ' + W.G1 + ' the set holds ' + short(read(W.SET));
}, test.limit.quick);
test.run('and its run ended: no icons.js runs', 0.2, async function () {
  if (!W.drew) return NO_FACE;
  return await until(function () { return Promise.resolve(none()); }, 3000) ? true : 'icons.js still runs after the Add: ' + short(iconsProcesses(W.node.root));
}, test.limit.quick);
test.run('after the runs it is the same job, spirit.app.icons, still open', 0.2, async function () {
  if (!W.drew) return NO_FACE;
  await add(W.chrome, W.G2, 'giraffe');
  await until(function () { return Promise.resolve(W.G2 in (json(W.SET) || {})); }, 10000);
  const job2 = await ask('job.get', { key: 'spirit.app.icons' });
  const j2 = (job2.body && job2.body.job) || null;
  return !!j2 && !/end|exit|stop|cancel|fail/i.test(String(j2.status || '')) ? true : 'job.get spirit.app.icons after the runs: ' + short(job2.body);
}, test.limit.quick);

// the attacker: five Adds at once, a page writing the table itself
// The box, 9: "one run per app at a time: calls to the same one-shot app wait their turn, so two saves never write iconSet.json at once."
test.run('five Adds at once: all five are in the set, none lost to another\'s write', 0.2, async function () {
  if (!W.drew) return NO_FACE;
  const five = W.REST.slice(0, 5);
  const watching = watchRuns(W.node.root, 'icons', { base: W.node.base });
  await W.chrome.evaluate('(function () { var g = ' + field('glyph') + ', k = ' + field('keywords') + ', b = ' + ADD + '; ' + JSON.stringify(five) + '.forEach(function (x, i) { g.value = x; g.dispatchEvent(new Event("input", { bubbles: true })); k.value = "five" + i; k.dispatchEvent(new Event("input", { bubbles: true })); b.click(); }); return true; }())');
  const allFive = await until(function () { const s = json(W.SET) || {}; return Promise.resolve(five.every(function (x) { return x in s; })); }, 12000);
  await sleep(1000);
  W.watched = await watching.stop();
  const s5 = W.s5 = json(W.SET);
  return allFive ? true : 'after five Adds at once the set holds ' + short(five.filter(function (x) { return s5 && x in s5; }));
}, test.limit.slow);
test.run('and what was there stays, the file whole JSON', 0.2, function () {
  if (!W.watched) return 'the five Adds were not made';
  return !!W.s5 && W.G1 in W.s5 && W.G2 in W.s5 ? true : 'after five at once the set is ' + short(read(W.SET));
}, test.limit.quick);
test.run('the world: runs of icons.js were seen while they were answered', 0.2, function () {
  if (!W.watched) return 'the five Adds were not made';
  const w = W.watched;
  return w.seen >= 1 || w.pids >= 2 ? true : 'no run of icons.js was ever seen, so "one at a time" judged nothing (' + w.seen + ' samples, ' + w.pids + ' pids its job named)';
}, test.limit.quick);
test.run('never two runs of icons.js at once (the box, 9)', 0.2, function () {
  if (!W.watched) return 'the five Adds were not made';
  return W.watched.most <= 1 || W.watched.most + ' runs of icons.js at once';
}, test.limit.quick);
test.run('a page writing spirit/state/icons/data/iconSet.json itself is refused, and the set stands', 0.8, async function () {
  if (!W.drew) return NO_FACE;
  const forged = await W.chrome.evaluate('window.spirit.ready.then(function (s) { return s.fs.saveFile("spirit/state/icons/data/iconSet.json", "{}"); }).then(function (r) { return JSON.stringify(r); }, function (e) { return "refused: " + String(e && e.message || e); })');
  await sleep(800);
  return W.G1 in (json(W.SET) || {}) ? true : 'the page\'s own write answered ' + short(forged) + ' and the set is ' + short(read(W.SET));
}, test.limit.slow);

// the box, 4: "Switched off, its row goes, and a call to it answers app-not-served"
test.run('the world: Icons switched off', 0.2, async function () {
  if (!W.ready) return NO_NODE;
  const off = await ask('app.active', { key: 'icons', active: false });
  W.off = off.status === 200;
  return W.off || 'app.active icons false: ' + short(off);
}, test.limit.quick);
test.run('switched off, icons.icon answers app-not-served', 0.2, async function () {
  if (!W.ready) return NO_NODE;
  await sleep(1500);
  const asked = W.verbs.length ? await ask('icons.' + W.verbs[0], {}) : { text: '' };
  return /app-not-served/.test(asked.text) || 'switched off, icons.' + (W.verbs[0] || '<verb>') + ' answered ' + asked.status + ' ' + short(asked.text);
}, test.limit.slow);
test.run('the api tree holds no icons branch', 0.2, async function () {
  if (!W.ready) return NO_NODE;
  const tOff = await ask('api', {});
  return tOff.status === 200 && !(tOff.body && tOff.body.icons) ? true : 'switched off, the tree still holds icons: ' + short(tOff.body && tOff.body.icons);
}, test.limit.quick);
test.run('its job is no longer open', 0.2, async function () {
  if (!W.ready) return NO_NODE;
  const jOff = await ask('job.get', { key: 'spirit.app.icons' });
  const jo = (jOff.body && jOff.body.job) || null;
  return !jo || /end|exit|stop|cancel|off/i.test(String(jo.status || '')) ? true : 'switched off, spirit.app.icons is ' + short(jOff.body);
}, test.limit.quick);
test.run('and nothing runs icons.js', 0.2, function () {
  if (!W.ready) return NO_NODE;
  return none() || 'switched off, icons.js runs: ' + short(iconsProcesses(W.node.root));
}, test.limit.quick);
test.run('the world: Icons switched on again', 0.2, async function () {
  if (!W.ready) return NO_NODE;
  const on = await ask('app.active', { key: 'icons', active: true });
  return on.status === 200 || 'app.active icons true: ' + short(on);
}, test.limit.quick);
test.run('switched on again, its branch is back, no restart of the node', 0.2, async function () {
  if (!W.ready) return NO_NODE;
  const back = await until(function () { return ask('api', {}).then(function (t) { return t.status === 200 && !!(t.body && t.body.icons); }); }, 10000);
  return back ? true : 'switched on again, the tree holds no icons';
}, test.limit.quick);
