'use strict';

// spirit/run/spirit/app/icons/test/element.js
// The tests of spirit/app/icons/element.js, and of no other module (spec: ./browserIcons.md; goal/G43.19, box v16):
// the Icons face, spirit.element.spirit.app.icons.element.create(container), mounted in a box of a real Chrome on a scratch node's face page
// with Icons switched on. The box: "the page asks icons through its api branch; only ./nodeIcons.js writes the table, the
// page writes no file of its own"; 10: "data.js on every open page follows that one job". Andy, its add row (G41.27):
// "[➕] [an icon:paste] [keywords, comma separated][Add]"; of a duplicate (G40.5): "if add icon cannot add because the icon
// already exists, the open the edit dialog for the existing icon." What was written is read from the disc.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function read(f) { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return null; } }
function json(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }
const bare = function (g) { return String(g || '').replace(/[︎️]/g, ''); };

// element.js: the Icons face, asking its own branch and writing no file (goal/G43.19).
// One test.run per test (goal/G47.2). What the world made, for the tests after it.
const W = {};
const NO_WORLD = 'no scratch node, Chrome or free glyphs: the world failed';
const NO_FACE = 'the face did not mount: the world failed';
test.after(function () {
  [W.chrome, W.other].forEach(function (c) {
    if (!c) return;
    try { if (c.sock) c.sock.close(); } catch (e) { /* gone */ }
    try { if (c.kid) c.kid.kill(); } catch (e) { /* gone */ }
  });
  const node = W.node || {};
  try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (node.root) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(node); } catch (e) { /* scratch */ }
});

// The face, mounted alone in a box, as the Icons app's createApp mounts it.
const mount = async function (page) {
  await page.send('Page.navigate', { url: W.node.base + '/face.html' });
  await until(function () { return page.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
  return page.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/app/icons/element.js"); }).then(function () { window.pageErrors = []; window.addEventListener("error", function (e) { window.pageErrors.push(String(e.message)); }); var c = document.createElement("div"); c.id = "box"; c.style.cssText = "position:fixed;left:0;top:0;width:900px;height:700px;display:flex;flex-direction:column;background:#111;z-index:9"; document.body.appendChild(c); window.made = spirit.element.spirit.app.icons.element.create(c); window.__posts = []; var f = window.fetch; window.fetch = function (u, o) { if (/\\/api\\//.test(String(u)) && o && o.body) window.__posts.push(String(o.body).slice(0, 200)); return f.apply(this, arguments); }; return "made"; }, function (e) { return String(e && e.message || e); })');
};
const field = function (which) { return '(function () { return Array.prototype.filter.call(document.querySelectorAll("#box input"), function (i) { var p = String(i.placeholder || ""); return i.getClientRects().length && (' + (which === 'glyph' ? '/icon/i.test(p) && !/keyword/i.test(p)' : '/keywords, comma separated/i.test(p)') + '); })[0] || null; }())'; };
const button = function (word) { return '(function () { return Array.prototype.filter.call(document.querySelectorAll("#box button"), function (b) { return b.getClientRects().length && String(b.textContent).trim() === ' + JSON.stringify(word) + '; })[0] || null; }())'; };
const text = function (page) { return page.evaluate('String((document.getElementById("box") || {}).innerText || "")'); };
// What the list shows: its rows only, so the line saying what a press did is no row.
const rows = function (page) { return page.evaluate('Array.prototype.map.call(document.querySelectorAll("#box tr, #box .list-row"), function (r) { return r.getClientRects().length ? String(r.innerText || r.textContent || "") : ""; }).join("\\n")'); };
const add = function (page, glyph, words) { return page.evaluate('(function () { var g = ' + field('glyph') + ', k = ' + field('keywords') + ', b = ' + button('Add') + '; if (!g || !k || !b) return false; g.value = ' + JSON.stringify(glyph) + '; g.dispatchEvent(new Event("input", { bubbles: true })); k.value = ' + JSON.stringify(words) + '; k.dispatchEvent(new Event("input", { bubbles: true })); b.click(); return true; }())'); };
const posts = async function () { return JSON.parse(await W.chrome.evaluate('JSON.stringify(window.__posts || [])')); };
// OVER THE APP, AS CONTACT'S DETAIL (Andy: "the icon detail panel is supposed to open overtop of the icon app..... like
// contact detail etc."): a panel layer (spirit/element/panel.js) covering the whole face, the icon's glyph on it, the
// add row and the list out of sight under it; its close brings the list back. Judged by what is on top where the add
// row stands.
const OVER = function () { return '(function () { var box = document.getElementById("box"); var b = box.getBoundingClientRect(); var l = Array.prototype.filter.call(box.querySelectorAll(".app-container"), function (c) { return c.offsetParent !== null; }).pop(); if (!l) return "no panel layer"; var r = l.getBoundingClientRect(); if (r.width < b.width - 4 || r.height < b.height - 4) return "a layer of " + Math.round(r.width) + "x" + Math.round(r.height) + " in a box of " + Math.round(b.width) + "x" + Math.round(b.height); if (String(l.textContent).indexOf(' + JSON.stringify(W.fresh[0]) + ') === -1) return "the layer does not show " + ' + JSON.stringify(W.fresh[0]) + '; var g = ' + field('glyph') + '; if (g) { var gr = g.getBoundingClientRect(); var top = document.elementFromPoint(gr.left + 2, gr.top + 2); if (top && !l.contains(top)) return "the add row is still in sight"; } return "over"; }())'; };
// REMOVE IS AN ARMING BUTTON (Andy: "icon detail, delete should be an armingButton."; spirit/element/armingButton.js):
// a first press only arms it, a click anywhere else disarms it, and only a second press removes.
const REMOVE = '(function () { return Array.prototype.filter.call(document.querySelectorAll("#box button"), function (b) { return b.getClientRects().length && /^Remove/.test(String(b.textContent).trim()); }).pop() || null; }())';
const armed = function () { return W.chrome.evaluate('(function () { var b = ' + REMOVE + '; return !!b && b.hasAttribute("data-armed"); }())'); };
const inSet = function () { return json(W.SET) || {}; };

test.run('the world: a scratch node with Icons switched on, and a Chrome page', 0.2, async function () {
  W.node = await scratchNode({ servers: ['icons'] });
  W.chrome = await chromePage(findChrome());
  W.up = !!(W.node.up && !W.chrome.error && W.node.root);
  return W.up || 'no scratch node of its own or no Chrome: nothing judged. ' + short(W.chrome.error || '');
}, test.limit.slow);
test.run('the world: the system set, and four glyphs it does not hold', 0.2, function () {
  if (!W.up) return 'no scratch node of its own or no Chrome: the world failed';
  const run = path.join(W.node.root, 'spirit', 'run');
  W.SET = path.join(run, 'spirit', 'state', 'icons', 'data', 'iconSet.json');
  const system = json(path.join(run, 'spirit', 'iconSet.json')) || {};
  const known = Object.keys(system).map(bare);
  const fresh = [];
  for (let cp = 0x1F300; cp <= 0x1FAFF && fresh.length < 6; cp++) { const g = String.fromCodePoint(cp); if (/\p{Extended_Pictographic}/u.test(g) && known.indexOf(g) === -1) fresh.push(g); }
  W.sys = Object.keys(system)[0];
  W.ready = fresh.length >= 4 && !!W.sys;
  W.fresh = fresh;
  return W.ready || 'no system set or too few free glyphs: nothing judged';
}, test.limit.quick);
test.run('it loads through spirit.require and mounts with spirit.element.spirit.app.icons.element.create(container)', 0.2, async function () {
  if (!W.ready) return NO_WORLD;
  const made = await mount(W.chrome);
  W.mounted = made === 'made';
  return W.mounted || 'it did not mount: ' + short(made);
}, test.limit.quick);

// Andy (G41.27): "[➕] [an icon:paste] [keywords, comma separated][Add]"
test.run('its add row: an icon to paste, its keywords, comma separated, and Add', 0.2, async function () {
  if (!W.mounted) return NO_FACE;
  W.drew = !!(await until(function () { return W.chrome.evaluate('!!' + field('glyph') + ' && !!' + field('keywords') + ' && !!' + button('Add')); }, 10000));
  return W.drew || 'no add row: ' + short(await text(W.chrome)) + ' errors ' + short(await W.chrome.evaluate('JSON.stringify(window.pageErrors)'));
}, test.limit.quick);
test.run('with ➕', 0.2, async function () {
  if (!W.drew) return 'no add row';
  return await W.chrome.evaluate('document.getElementById("box").innerHTML.indexOf("➕") !== -1') ? true : 'no ➕ on the add row';
}, test.limit.quick);
test.run('the icon first, then its keywords', 0.2, async function () {
  if (!W.drew) return 'no add row';
  return await W.chrome.evaluate('(function () { var g = ' + field('glyph') + ', k = ' + field('keywords') + '; return !!(g.compareDocumentPosition(k) & Node.DOCUMENT_POSITION_FOLLOWING); }())') ? true : 'the keywords come before the icon';
}, test.limit.quick);
test.run('the list shows the set, its first glyph among it', 0.2, async function () {
  if (!W.drew) return 'no add row';
  return await until(function () { return rows(W.chrome).then(function (t) { return t.indexOf(W.sys) !== -1; }); }, 8000) ? true : 'the list does not show ' + W.sys + ': ' + short(await text(W.chrome));
}, test.limit.quick);
test.run('an Add with no icon says paste an icon first', 0.2, async function () {
  if (!W.drew) return 'no add row';
  await add(W.chrome, '', 'nothing');
  return await until(function () { return text(W.chrome).then(function (t) { return t.indexOf('paste an icon first') !== -1; }); }, 3000) ? true : 'an empty Add said: ' + short(await text(W.chrome));
}, test.limit.quick);
test.run('and writes nothing', 0.2, async function () {
  if (!W.drew) return 'no add row';
  await sleep(600);
  return !fs.existsSync(W.SET) || 'an empty Add wrote the set';
}, test.limit.quick);

// the box: "the page asks icons through its api branch ... the page writes no file of its own"
test.run('an Add writes the new glyph with its keywords, split at the commas', 0.2, async function () {
  if (!W.drew) return 'no add row';
  await W.chrome.evaluate('window.__posts = []; true');
  await add(W.chrome, W.fresh[0], 'first, one');
  const wrote = await until(function () { return Promise.resolve(JSON.stringify(inSet()[W.fresh[0]]) === '["first","one"]'); }, 10000);
  W.p1 = await posts();
  return wrote ? true : 'after the Add of ' + W.fresh[0] + ' the set holds ' + short(inSet()[W.fresh[0]]);
}, test.limit.quick);
test.run('it asked icons.icon, its own branch', 0.2, function () {
  if (!W.p1) return 'no Add was made';
  return W.p1.some(function (p) { return (/"call"\s*:\s*"icons\.icon"/).test(p); }) || 'it asked: ' + short(W.p1);
}, test.limit.quick);
test.run('and nothing of the fs family', 0.2, function () {
  if (!W.p1) return 'no Add was made';
  return !W.p1.some(function (p) { return (/"call"\s*:\s*"fs\./).test(p); }) || 'it asked fs: ' + short(W.p1.filter(function (p) { return (/"fs\./).test(p); }));
}, test.limit.quick);
test.run('the list shows the new glyph, no reload', 0.2, async function () {
  if (!W.drew) return 'no add row';
  return await until(function () { return rows(W.chrome).then(function (t) { return t.indexOf(W.fresh[0]) !== -1; }); }, 8000) ? true : 'the list never showed ' + W.fresh[0];
}, test.limit.quick);

// Andy (G40.5): a duplicate opens the edit dialog of the icon there, and writes nothing
test.run('its dialog opens, its keywords in it, with Remove', 0.2, async function () {
  if (!W.drew) return 'no add row';
  W.t1 = read(W.SET);
  await add(W.chrome, W.fresh[0], 'again');
  const opened = await until(function () { return W.chrome.evaluate('(function () { var k = Array.prototype.filter.call(document.querySelectorAll("#box input"), function (i) { return i.getClientRects().length && !/icon|keyword/i.test(String(i.placeholder || "")); })[0]; return !!k && /first/.test(k.value) && !!' + button('Remove this icon') + '; }())'); }, 5000);
  return opened ? true : 'no dialog of ' + W.fresh[0] + ': ' + short(await text(W.chrome));
}, test.limit.quick);
test.run('and the set is not written', 0.2, function () {
  if (!W.drew) return 'no add row';
  return read(W.SET) === W.t1 || 'a duplicate changed the set';
}, test.limit.quick);

// Andy: "the icon detail panel is supposed to open overtop of the icon app..... like contact detail"
test.run('the duplicate\'s dialog is a panel over the whole face, the glyph on it, the add row under it', 0.2, async function () {
  if (!W.drew) return 'no add row';
  W.wasOver = !!(await until(function () { return W.chrome.evaluate(OVER()).then(function (v) { return v === 'over'; }); }, 5000));
  return W.wasOver || 'the dialog: ' + short(await W.chrome.evaluate(OVER()));
}, test.limit.quick);
test.run('its close brings the face back, the add row on top', 0.2, async function () {
  if (!W.drew) return 'no add row';
  await W.chrome.evaluate('(function () { var c = Array.prototype.filter.call(document.querySelectorAll("#box .app-container-close"), function (x) { return x.offsetParent !== null; }).pop(); if (c) c.click(); return !!c; }())');
  const back = await until(function () { return W.chrome.evaluate('(function () { var g = ' + field('glyph') + '; if (!g) return false; var gr = g.getBoundingClientRect(); var top = document.elementFromPoint(gr.left + 2, gr.top + 2); return top === g || g.contains(top); }())'); }, 5000);
  return W.wasOver && back ? true : (W.wasOver ? 'after its close the add row is not on top: ' + short(await W.chrome.evaluate(OVER())) : 'no panel was open, so its close judged nothing');
}, test.limit.quick);
// Pressing the icon's row in the list opens it the same way.
test.run('a press on its row opens it over the face too', 0.2, async function () {
  if (!W.drew) return 'no add row';
  await W.chrome.evaluate('(function () { var rows = Array.prototype.filter.call(document.querySelectorAll("#box tr, #box .list-row"), function (r) { return r.getClientRects().length && String(r.textContent).indexOf(' + JSON.stringify(W.fresh[0]) + ') !== -1; }); var hit = rows[0]; if (!hit) return false; var leaf = Array.prototype.filter.call(hit.querySelectorAll("*"), function (e) { return !e.children.length && e.getClientRects().length; })[0] || hit; leaf.click(); return true; }())');
  return await until(function () { return W.chrome.evaluate(OVER()).then(function (v) { return v === 'over'; }); }, 5000) ? true : 'a press on its row: ' + short(await W.chrome.evaluate(OVER()));
}, test.limit.quick);

// an icon opened: its keywords saved as they change, and Remove
test.run('a change of its keywords writes them', 0.2, async function () {
  if (!W.drew) return 'no add row';
  await W.chrome.evaluate('(function () { var k = Array.prototype.filter.call(document.querySelectorAll("#box input"), function (i) { return i.getClientRects().length && !/icon|keyword/i.test(String(i.placeholder || "")); })[0]; k.value = "changed, again"; k.dispatchEvent(new Event("change", { bubbles: true })); return true; }())');
  return await until(function () { return Promise.resolve(JSON.stringify(inSet()[W.fresh[0]]) === '["changed","again"]'); }, 8000) ? true : 'after the change the set holds ' + short(inSet()[W.fresh[0]]);
}, test.limit.quick);
test.run('Andy: "delete should be an armingButton": a first press arms Remove', 0.2, async function () {
  if (!W.drew) return 'no add row';
  await W.chrome.evaluate('(function () { var b = ' + REMOVE + '; if (b) b.click(); return !!b; }())');
  await sleep(1200);
  W.wasArmed = await armed();
  return W.wasArmed ? true : 'a first press of Remove did not arm it: ' + short(await W.chrome.evaluate('(function () { var b = ' + REMOVE + '; return b ? b.outerHTML : "no Remove"; }())'));
}, test.limit.slow);
test.run('and removes nothing', 0.2, function () {
  if (!W.drew) return 'no add row';
  return W.fresh[0] in inSet() || 'a single press of Remove took ' + W.fresh[0] + ' out of the set';
}, test.limit.quick);
test.run('a click elsewhere disarms it ("the button must reset, back to its original state")', 0.2, async function () {
  if (!W.drew) return 'no add row';
  await W.chrome.evaluate('(function () { var b = ' + REMOVE + '; var l = b && b.closest(".app-container"); var t = (l && (l.querySelector(".panel-heading") || l.querySelector("label"))) || document.body; t.click(); return true; }())');
  await sleep(500);
  return W.wasArmed && !(await armed()) ? true : (W.wasArmed ? 'after a click elsewhere Remove is still armed' : 'Remove never armed, so disarming judged nothing');
}, test.limit.quick);
test.run('and still nothing is removed', 0.2, function () {
  if (!W.drew) return 'no add row';
  return W.fresh[0] in inSet() || 'disarming took ' + W.fresh[0] + ' out of the set';
}, test.limit.quick);
test.run('a second press removes it from the set', 0.2, async function () {
  if (!W.drew) return 'no add row';
  await W.chrome.evaluate('(function () { var b = ' + REMOVE + '; if (b) b.click(); return !!b; }())');
  await sleep(300);
  await W.chrome.evaluate('(function () { var b = ' + REMOVE + '; if (b) b.click(); return !!b; }())');
  return await until(function () { return Promise.resolve(!(W.fresh[0] in inSet())); }, 8000) ? true : 'after two presses the set still holds ' + W.fresh[0];
}, test.limit.quick);
test.run('and its dialog closes', 0.2, async function () {
  if (!W.drew) return 'no add row';
  return await until(function () { return W.chrome.evaluate('!' + REMOVE); }, 5000) ? true : 'its dialog stayed after Remove';
}, test.limit.quick);
test.run('the list lets it go, no reload', 0.2, async function () {
  if (!W.drew) return 'no add row';
  return await until(function () { return rows(W.chrome).then(function (t) { return t.indexOf(W.fresh[0]) === -1; }); }, 8000) ? true : 'the list still shows ' + W.fresh[0] + ': ' + short(await rows(W.chrome));
}, test.limit.quick);

// the box, 10: "data.js on every open page follows that one job": a second page
test.run('the world: a second page shows the set', 0.2, async function () {
  if (!W.drew) return 'no add row';
  const other = await chromePage(findChrome());
  if (other.error) return 'no second Chrome: the other page is not judged. ' + short(other.error);
  W.other = other;
  const m2 = await mount(other);
  W.second = m2 === 'made' && !!(await until(function () { return rows(other).then(function (t) { return t.indexOf(W.sys) !== -1; }); }, 10000));
  return W.second || 'the second page: ' + short(m2);
}, test.limit.slow);
test.run('the other page shows the second new glyph, added on the first, no reload', 0.2, async function () {
  if (!W.second) return 'no second page: the world failed';
  await W.other.evaluate('window.__posts = []; true');
  await add(W.chrome, W.fresh[1], 'second');
  return await until(function () { return rows(W.other).then(function (t) { return t.indexOf(W.fresh[1]) !== -1; }); }, 10000) ? true : 'the other page never showed ' + W.fresh[1] + ': ' + short(await text(W.other));
}, test.limit.quick);
test.run('and asked no search of its own for it', 0.2, async function () {
  if (!W.second) return 'no second page: the world failed';
  const asked = JSON.parse(await W.other.evaluate('JSON.stringify(window.__posts || [])'));
  return !asked.some(function (p) { return (/"op"\s*:\s*"search"/).test(p); }) || 'the other page searched: ' + short(asked);
}, test.limit.quick);
test.run('an icon deleted elsewhere leaves the other page too', 0.2, async function () {
  if (!W.second) return 'no second page: the world failed';
  await W.chrome.evaluate('(function () { window.__posts = []; return true; }())');
  await W.other.evaluate('window.__posts = []; true');
  await icondelete(W.node, W.fresh[1]);
  return await until(function () { return rows(W.other).then(function (t) { return t.indexOf(W.fresh[1]) === -1; }); }, 10000) ? true : 'the other page still shows ' + W.fresh[1];
}, test.limit.quick);

// destroy
test.run('destroy empties its container', 0.2, async function () {
  if (!W.mounted) return NO_FACE;
  const empty = await W.chrome.evaluate('(function () { window.made.destroy(); return document.getElementById("box").children.length === 0; }())');
  return empty === true || 'destroy left ' + short(await text(W.chrome));
}, test.limit.quick);

// A delete asked of the node directly, as another page or peer would.
function icondelete(node, glyph) {
  return fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'icons.icon', args: { op: 'delete', glyph: glyph } }) }).then(function (r) { return r.text(); }, function () { return ''; });
}
