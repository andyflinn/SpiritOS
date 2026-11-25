'use strict';

// spirit/run/spirit/app/icons/test/icons.js
// The tests of spirit/app/icons/icons.js, the one file the node and the page load, and of no other module (spec: ./icons.md;
// goal/G43.19, box v16): the app's files, its one-shot runs, its job, its tile. Its halves have tests of their own
// (./server/server.js, ./browserIcons.js, ./data.js, ./api.js). Andy:
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
const S = require(path.join(RUN, 'spirit', 'script.js'));
const test = S.requireScript('spirit/test/testReport.js');
const { scratchNode, chromePage, findChrome, until, appRuns, watchRuns } = S.requireScript('spirit/test/headLessChrome.js');

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
test.after(function () {
  const c = W.chrome;
  if (c) {
    try { if (c.sock) c.sock.close(); } catch (e) { /* gone */ }
    try { if (c.kid) c.kid.kill(); } catch (e) { /* gone */ }
  }
  const node = W.node || {};
  try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (node.root) S.requireScript('spirit/test/headLessChrome.js').freeTree(node); } catch (e) { /* scratch */ }
});

// the box: "a face-only app get's api.js, data.js, node<Name>.js, browser<Name>.js" (Q5, Q6)
test.run('spirit/app/icons/api.js is there', 0.2, function () { return fs.existsSync(path.join(APP, 'api.js')) || false; }, test.limit.quick);
test.run('spirit/app/icons/data.js is there', 0.2, function () { return fs.existsSync(path.join(APP, 'data.js')) || false; }, test.limit.quick);
test.run('spirit/app/icons/icons.js is there', 0.2, function () { return fs.existsSync(path.join(APP, 'icons.js')) || false; }, test.limit.quick);
test.run('spirit/app/icons/server/server.js is there', 0.2, function () { return fs.existsSync(path.join(APP, 'server', 'server.js')) || false; }, test.limit.quick);
test.run('spirit/app/icons/element.js is there', 0.2, function () { return fs.existsSync(path.join(APP, 'element.js')) || false; }, test.limit.quick);
test.run('api.js sits at the app\'s top, with no api/ folder', 0.2, function () { return !fs.existsSync(path.join(APP, 'api')) || false; }, test.limit.quick);
test.run('icons.json keeps node mount false and shell mount true', 0.2, function () {
  const own = json(path.join(APP, 'icons.json')) || {};
  return !(own.node && own.node.mount === true) && !!(own.shell && own.shell.mount === true) ? true : false;
}, test.limit.quick);
// goal/G43.32: by spirit.requireScript and its run-root path, as every script loads the tree.
test.run('icons.js, run in node, loads spirit/app/icons/server/server.js through spirit.requireScript', 0.2, function () {
  const main = code(read(path.join(APP, 'icons.js')) || '');
  return (/\.requireScript\(\s*['"]spirit\/app\/icons\/server\/server\.js['"]\s*\)/).test(main) || false;
}, test.limit.quick);
const pageCode = function (f) { return code(read(path.join(APP, f)) || ''); };
const writes = /\bfs\s*\.\s*(saveFile|save|deleteFile|delete)\b|\.saveFile\s*\(/;
test.run('icons.js mounts no longer through spirit.shell.activateApp', 0.2, function () {
  const ic = pageCode('icons.js');
  return ic !== '' && !/activateApp/.test(ic) ? true : false;
}, test.limit.quick);
test.run('icons.js calls no fs save or delete, so the page writes no file of its own', 0.2, function () {
  const ic = pageCode('icons.js');
  return ic !== '' && !writes.test(ic) ? true : false;
}, test.limit.quick);
test.run('element.js mounts no longer through spirit.shell.activateApp', 0.2, function () {
  const el = pageCode('element.js');
  return el !== '' && !/activateApp/.test(el) ? true : false;
}, test.limit.quick);
test.run('element.js calls no fs save or delete, so the page writes no file of its own', 0.2, function () {
  const el = pageCode('element.js');
  return el !== '' && !writes.test(el) ? true : false;
}, test.limit.quick);
test.run('api.js names its verbs', 0.2, function () {
  try { W.verbs = Object.keys(require(path.join(APP, 'api.js')).verbs || {}); } catch (e) { W.verbs = []; }
  return W.verbs.length >= 1 || false;
}, test.limit.quick);

// Desk switched on beside it: a permanent server, so the process list is shown to find a running app script.
test.run('a scratch node with its own disc comes up with Icons and Desk switched on, and a Chrome page opens', 0.2, async function () {
  W.node = await scratchNode({ servers: ['icons', 'desk'] });
  W.chrome = await chromePage(findChrome());
  if (!W.node.up || W.chrome.error) return false;
  if (!W.node.root) return false;
  const run = path.join(W.node.root, 'spirit', 'run');
  W.SET = path.join(run, 'spirit', 'state', 'app', 'icons', 'data', 'iconSet.json');
  W.up = true;
  return true;
}, test.limit.slow);
test.run('seven glyphs the system set does not hold are found', 0.2, function () {
  if (!W.up) return false;
  const system = json(path.join(W.node.root, 'spirit', 'run', 'spirit', 'iconSet.json')) || {};
  // GLYPHS THE SYSTEM SET DOES NOT HOLD (cw found it: the set starts as the system set, so a glyph of it is a duplicate,
  // refused by Andy's rule, and nothing would be written). Compared without the invisible variation selectors.
  const bare = function (g) { return String(g || '').replace(/[︎️]/g, ''); };
  const known = Object.keys(system).map(bare);
  // Single pictures, one code point each, taken in order from the pictograph blocks.
  const CANDIDATES = [];
  for (let cp = 0x1F300; cp <= 0x1FAFF && CANDIDATES.length < 2000; cp++) { const g = String.fromCodePoint(cp); if (/\p{Extended_Pictographic}/u.test(g)) CANDIDATES.push(g); }
  const fresh = CANDIDATES.filter(function (g) { return known.indexOf(bare(g)) === -1; });
  if (fresh.length < 7) return false;
  W.G1 = fresh[0]; W.G2 = fresh[1]; W.REST = fresh.slice(2);
  W.ready = true;
  return true;
}, test.limit.quick);
const ask = async function (call, args) {
  const r = await fetch(W.node.base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args || {} }) });
  const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch (e) { b = null; }
  return { status: r.status, body: b, text: t };
};
const none = function () { return iconsProcesses(W.node.root).length === 0; };

// the box, 1: "icons has no running process"; 8: the api tree asks it, and its run ends
test.run('the process list finds the permanent desk.js running, once', 0.2, async function () {
  if (!W.ready) return false;
  return await until(function () { return Promise.resolve(iconsProcesses(W.node.root, 'desk').length === 1); }, 15000) ? true : false;
}, test.limit.quick);
test.run('switched on and idle, no process runs icons.js', 0.2, function () {
  if (!W.ready) return false;
  return none() || false;
}, test.limit.quick);
test.run('the api tree holds the icons branch, answered from icons.js', 0.2, async function () {
  if (!W.ready) return false;
  const tree = await ask('api', {});
  W.branch = tree.body && tree.body.icons;
  return tree.status === 200 && !!W.branch ? true : false;
}, test.limit.quick);
// Its one verb, icon, written out so that its check has a plain title.
test.run('the icons branch names the verb icon', 0.2, function () {
  if (!W.ready) return false;
  return JSON.stringify(W.branch || '').indexOf('icon') !== -1 || false;
}, test.limit.quick);
test.run('once the tree is answered, no icons.js runs', 0.2, async function () {
  if (!W.ready) return false;
  return await until(function () { return Promise.resolve(none()); }, 3000) ? true : false;
}, test.limit.quick);

// the box, 10: "The node keeps one job for the app, module spirit.app.icons, open while the app is switched on"
test.run('spirit.app.icons is an open job', 0.2, async function () {
  if (!W.ready) return false;
  const job = await ask('job.get', { key: 'spirit.app.icons' });
  const j0 = (job.body && job.body.job) || null;
  return !!j0 && !/end|exit|stop|cancel|fail/i.test(String(j0.status || '')) ? true : false;
}, test.limit.quick);

// the face, by its tile (the box: "its tile opens no face"), and Andy's add row: "[➕] [an icon:paste] [keywords, comma separated][Add]"
const open = async function (page) {
  const made = await page.evaluate('window.spirit.readyPromise.then(function () { return spirit.requireScript("spirit/element/script.js"); }).then(function () { var old = document.getElementById("faces"); if (old) old.remove(); var c = document.createElement("div"); c.id = "faces"; c.style.cssText = "position:fixed;left:0;top:0;width:1200px;height:800px;display:flex;flex-direction:column;background:#111;z-index:9"; document.body.appendChild(c); window.fsel = spirit.required.spirit.element.create(c, { face: "tiles" }); if (window.fsel.parentNode !== c) c.appendChild(window.fsel); return "made"; }, function () { return false; })');
  if (made !== 'made') return false;
  const tile = 'Array.prototype.filter.call(document.querySelectorAll("#faces .app-icon"), function (t) { return t.offsetParent !== null && String(t.textContent).indexOf("Icons") !== -1; })[0]';
  if (!await until(function () { return page.evaluate('!!' + tile); }, 10000)) return false;
  await page.evaluate('(function () { ' + tile + '.click(); return true; }())');
  return true;
};
const LAYER = 'Array.prototype.filter.call(document.querySelectorAll("#faces .app-container"), function (c) { return c.offsetParent !== null; })[0]';
const field = function (which) { return '(function () { var l = ' + LAYER + '; if (!l) return null; return Array.prototype.filter.call(l.querySelectorAll("input"), function (i) { var p = String(i.placeholder || ""); return i.getClientRects().length && (' + (which === 'glyph' ? '/icon/i.test(p) && !/keyword/i.test(p)' : '/keywords, comma separated/i.test(p)') + '); })[0] || null; }())'; };
const ADD = '(function () { var l = ' + LAYER + '; if (!l) return null; return Array.prototype.filter.call(l.querySelectorAll("button"), function (b) { return b.getClientRects().length && String(b.textContent).trim() === "Add"; })[0] || null; }())';
// What the face itself does (its add row, the duplicate, a second page) is browserIcons.js's test; what the table holds,
// icons/server/server.js's. Here: the app's tile opens the face, and an Add through it is one run of icons.js, ended.
const add = function (page, glyph, words) { return page.evaluate('(function () { var g = ' + field('glyph') + ', k = ' + field('keywords') + ', b = ' + ADD + '; if (!g || !k || !b) return false; g.value = ' + JSON.stringify(glyph) + '; g.dispatchEvent(new Event("input", { bubbles: true })); k.value = ' + JSON.stringify(words) + '; k.dispatchEvent(new Event("input", { bubbles: true })); b.click(); return true; }())'); };
test.run('the Icons tile is there and is pressed', 0.2, async function () {
  if (!W.ready) return false;
  await W.chrome.send('Page.navigate', { url: W.node.base + '/' });
  await until(function () { return W.chrome.evaluate('!!(window.spirit && window.spirit.readyPromise)'); }, 20000);
  const opened = await open(W.chrome);
  W.opened = opened === true;
  return W.opened || false;
}, test.limit.quick);
test.run('the Icons tile opens its face, with an icon to paste, its keywords, comma separated, and Add', 0.2, async function () {
  if (!W.opened) return false;
  W.drew = !!(await until(function () { return W.chrome.evaluate('!!' + field('glyph') + ' && !!' + field('keywords') + ' && !!' + ADD); }, 10000));
  return W.drew || false;
}, test.limit.quick);

// an Add through its tile's face is a run of icons.js, and the run ends
test.run('an Add writes the new glyph into spirit/state/app/icons/data/iconSet.json', 0.2, async function () {
  if (!W.drew) return false;
  await add(W.chrome, W.G1, 'flamingo, bird');
  const wrote = await until(function () { return Promise.resolve(((json(W.SET) || {})[W.G1] || []).join(',') === 'flamingo,bird'); }, 10000);
  return wrote ? true : false;
}, test.limit.quick);
test.run('after the Add, its run has ended and no icons.js runs', 0.2, async function () {
  if (!W.drew) return false;
  return await until(function () { return Promise.resolve(none()); }, 3000) ? true : false;
}, test.limit.quick);
test.run('after the runs it is the same job, spirit.app.icons, still open', 0.2, async function () {
  if (!W.drew) return false;
  await add(W.chrome, W.G2, 'giraffe');
  await until(function () { return Promise.resolve(W.G2 in (json(W.SET) || {})); }, 10000);
  const job2 = await ask('job.get', { key: 'spirit.app.icons' });
  const j2 = (job2.body && job2.body.job) || null;
  return !!j2 && !/end|exit|stop|cancel|fail/i.test(String(j2.status || '')) ? true : false;
}, test.limit.quick);

// the attacker: five Adds at once, a page writing the table itself
// The box, 9: "one run per app at a time: calls to the same one-shot app wait their turn, so two saves never write iconSet.json at once."
test.run('after five Adds at once, all five are in the set, none lost to another\'s write', 0.2, async function () {
  if (!W.drew) return false;
  const five = W.REST.slice(0, 5);
  const watching = watchRuns(W.node.root, 'icons', { base: W.node.base });
  // Five calls from the page at once, through spirit: Add itself is busy until its answer (goal/G47.1, Q20), so five presses
  // in a row would be one; the box's "calls" are what must wait their turn.
  await W.chrome.evaluate('window.spirit.readyPromise.then(function () { return window.spirit.requireScript("spirit/app/icons/api.js"); }).then(function (s) { ' + JSON.stringify(five) + '.forEach(function (x, i) { s.icon({ op: "add", glyph: x, keywords: JSON.stringify(["five" + i]) }); }); return true; })');
  const allFive = await until(function () { const s = json(W.SET) || {}; return Promise.resolve(five.every(function (x) { return x in s; })); }, 12000);
  await sleep(1000);
  W.watched = await watching.stop();
  const s5 = W.s5 = json(W.SET);
  return allFive ? true : false;
}, test.limit.slow);
test.run('the glyphs added before the five stay, and the file is whole JSON', 0.2, function () {
  if (!W.watched) return false;
  return !!W.s5 && W.G1 in W.s5 && W.G2 in W.s5 ? true : false;
}, test.limit.quick);
test.run('runs of icons.js were seen while they were answered', 0.2, function () {
  if (!W.watched) return false;
  const w = W.watched;
  return w.seen >= 1 || w.pids >= 2 ? true : false;
}, test.limit.quick);
test.run('two runs of icons.js never happen at once', 0.2, function () {
  if (!W.watched) return false;
  return W.watched.most <= 1 || false;
}, test.limit.quick);
test.run('a page writing spirit/state/app/icons/data/iconSet.json itself is refused, and the set stands', 0.8, async function () {
  if (!W.drew) return false;
  await W.chrome.evaluate('window.spirit.readyPromise.then(function () { return window.spirit.requireScript("spirit/fs/script.js"); }).then(function (s) { return s.saveFile("spirit/state/app/icons/data/iconSet.json", "{}"); }).then(function (r) { return JSON.stringify(r); }, function () { return false; })');
  await sleep(800);
  return W.G1 in (json(W.SET) || {}) ? true : false;
}, test.limit.slow);

// the box, 4: "Switched off, its row goes, and a call to it answers app-not-served"
test.run('Icons is switched off', 0.2, async function () {
  if (!W.ready) return false;
  const off = await ask('app.active', { key: 'icons', active: false });
  W.off = off.status === 200;
  return W.off || false;
}, test.limit.quick);
test.run('switched off, icons.icon answers app-not-served', 0.2, async function () {
  if (!W.ready) return false;
  await sleep(1500);
  const asked = W.verbs.length ? await ask('icons.' + W.verbs[0], {}) : { text: '' };
  return /app-not-served/.test(asked.text) || false;
}, test.limit.slow);
test.run('switched off, the api tree holds no icons branch', 0.2, async function () {
  if (!W.ready) return false;
  const tOff = await ask('api', {});
  return tOff.status === 200 && !(tOff.body && tOff.body.icons) ? true : false;
}, test.limit.quick);
test.run('switched off, the spirit.app.icons job is no longer open', 0.2, async function () {
  if (!W.ready) return false;
  const jOff = await ask('job.get', { key: 'spirit.app.icons' });
  const jo = (jOff.body && jOff.body.job) || null;
  return !jo || /end|exit|stop|cancel|off/i.test(String(jo.status || '')) ? true : false;
}, test.limit.quick);
test.run('switched off, nothing runs icons.js', 0.2, function () {
  if (!W.ready) return false;
  return none() || false;
}, test.limit.quick);
test.run('Icons is switched on again', 0.2, async function () {
  if (!W.ready) return false;
  const on = await ask('app.active', { key: 'icons', active: true });
  return on.status === 200 || false;
}, test.limit.quick);
test.run('switched on again, the icons branch is back with no restart of the node', 0.2, async function () {
  if (!W.ready) return false;
  const back = await until(function () { return ask('api', {}).then(function (t) { return t.status === 200 && !!(t.body && t.body.icons); }); }, 10000);
  return back ? true : false;
}, test.limit.quick);
