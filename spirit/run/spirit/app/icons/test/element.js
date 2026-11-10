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

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function read(f) { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return null; } }
function json(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }
const bare = function (g) { return String(g || '').replace(/[︎️]/g, ''); };

test.startTest('element.js: the Icons face, asking its own branch and writing no file (goal/G43.19)');

(async function () {
  const node = await scratchNode({ servers: ['icons'] });
  const chrome = await chromePage(findChrome());
  let other = null;
  try {
    if (!node.up || chrome.error || !node.root) { test.fail('no scratch node of its own or no Chrome: nothing judged. ' + short(chrome.error || '')); return; }
    const run = path.join(node.root, 'spirit', 'run');
    const SET = path.join(run, 'spirit', 'state', 'icons', 'data', 'iconSet.json');
    const system = json(path.join(run, 'spirit', 'iconSet.json')) || {};
    const known = Object.keys(system).map(bare);
    const fresh = [];
    for (let cp = 0x1F300; cp <= 0x1FAFF && fresh.length < 6; cp++) { const g = String.fromCodePoint(cp); if (/\p{Extended_Pictographic}/u.test(g) && known.indexOf(g) === -1) fresh.push(g); }
    const sys = Object.keys(system)[0];
    ok(fresh.length >= 4 && !!sys, 'the world: the system set, and glyphs it does not hold: ' + fresh.slice(0, 4).join(' '), 'no system set or too few free glyphs: nothing judged');
    if (fresh.length < 4 || !sys) return;

    // The face, mounted alone in a box, as the Icons app's createApp mounts it.
    const mount = async function (page) {
      await page.send('Page.navigate', { url: node.base + '/face.html' });
      await until(function () { return page.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
      return page.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/app/icons/element.js"); }).then(function () { window.pageErrors = []; window.addEventListener("error", function (e) { window.pageErrors.push(String(e.message)); }); var c = document.createElement("div"); c.id = "box"; c.style.cssText = "position:fixed;left:0;top:0;width:900px;height:700px;display:flex;flex-direction:column;background:#111;z-index:9"; document.body.appendChild(c); window.made = spirit.element.spirit.app.icons.element.create(c); window.__posts = []; var f = window.fetch; window.fetch = function (u, o) { if (/\\/api\\//.test(String(u)) && o && o.body) window.__posts.push(String(o.body).slice(0, 200)); return f.apply(this, arguments); }; return "made"; }, function (e) { return String(e && e.message || e); })');
    };
    const made = await mount(chrome);
    ok(made === 'made', 'it loads through spirit.require and mounts with spirit.element.spirit.app.icons.element.create(container)', 'it did not mount: ' + short(made));
    if (made !== 'made') return;
    const field = function (which) { return '(function () { return Array.prototype.filter.call(document.querySelectorAll("#box input"), function (i) { var p = String(i.placeholder || ""); return i.getClientRects().length && (' + (which === 'glyph' ? '/icon/i.test(p) && !/keyword/i.test(p)' : '/keywords, comma separated/i.test(p)') + '); })[0] || null; }())'; };
    const button = function (word) { return '(function () { return Array.prototype.filter.call(document.querySelectorAll("#box button"), function (b) { return b.getClientRects().length && String(b.textContent).trim() === ' + JSON.stringify(word) + '; })[0] || null; }())'; };
    const text = function (page) { return page.evaluate('String((document.getElementById("box") || {}).innerText || "")'); };
    // What the list shows: its rows only, so the line saying what a press did is no row.
    const rows = function (page) { return page.evaluate('Array.prototype.map.call(document.querySelectorAll("#box tr, #box .list-row"), function (r) { return r.getClientRects().length ? String(r.innerText || r.textContent || "") : ""; }).join("\\n")'); };
    const add = function (page, glyph, words) { return page.evaluate('(function () { var g = ' + field('glyph') + ', k = ' + field('keywords') + ', b = ' + button('Add') + '; if (!g || !k || !b) return false; g.value = ' + JSON.stringify(glyph) + '; g.dispatchEvent(new Event("input", { bubbles: true })); k.value = ' + JSON.stringify(words) + '; k.dispatchEvent(new Event("input", { bubbles: true })); b.click(); return true; }())'); };
    const posts = async function () { return JSON.parse(await chrome.evaluate('JSON.stringify(window.__posts || [])')); };

    test.subHeading('Andy (G41.27): "[➕] [an icon:paste] [keywords, comma separated][Add]"');
    const drew = await until(function () { return chrome.evaluate('!!' + field('glyph') + ' && !!' + field('keywords') + ' && !!' + button('Add')); }, 10000);
    ok(drew, 'its add row: an icon to paste, its keywords, comma separated, and Add', 'no add row: ' + short(await text(chrome)) + ' errors ' + short(await chrome.evaluate('JSON.stringify(window.pageErrors)')));
    if (!drew) return;
    ok(await chrome.evaluate('document.getElementById("box").innerHTML.indexOf("➕") !== -1'), 'with ➕', 'no ➕ on the add row');
    ok(await chrome.evaluate('(function () { var g = ' + field('glyph') + ', k = ' + field('keywords') + '; return !!(g.compareDocumentPosition(k) & Node.DOCUMENT_POSITION_FOLLOWING); }())'), 'the icon first, then its keywords', 'the keywords come before the icon');
    ok(await until(function () { return rows(chrome).then(function (t) { return t.indexOf(sys) !== -1; }); }, 8000), 'the list shows the set, ' + sys + ' among it', 'the list does not show ' + sys + ': ' + short(await text(chrome)));
    await add(chrome, '', 'nothing');
    ok(await until(function () { return text(chrome).then(function (t) { return t.indexOf('paste an icon first') !== -1; }); }, 3000), 'an Add with no icon says paste an icon first', 'an empty Add said: ' + short(await text(chrome)));
    await sleep(600);
    ok(!fs.existsSync(SET), 'and writes nothing', 'an empty Add wrote the set');

    test.subHeading('the box: "the page asks icons through its api branch ... the page writes no file of its own"');
    await chrome.evaluate('window.__posts = []; true');
    await add(chrome, fresh[0], 'first, one');
    const wrote = await until(function () { return Promise.resolve(JSON.stringify((json(SET) || {})[fresh[0]]) === '["first","one"]'); }, 10000);
    ok(wrote, 'an Add writes ' + fresh[0] + ' with its keywords, split at the commas', 'after the Add the set holds ' + short((json(SET) || {})[fresh[0]]));
    const p1 = await posts();
    ok(p1.some(function (p) { return /"call"\s*:\s*"icons\.icon"/.test(p); }), 'it asked icons.icon, its own branch', 'it asked: ' + short(p1));
    ok(!p1.some(function (p) { return /"call"\s*:\s*"fs\./.test(p); }), 'and nothing of the fs family', 'it asked fs: ' + short(p1.filter(function (p) { return /"fs\./.test(p); })));
    ok(await until(function () { return rows(chrome).then(function (t) { return t.indexOf(fresh[0]) !== -1; }); }, 8000), 'the list shows ' + fresh[0] + ', no reload', 'the list never showed ' + fresh[0]);

    test.subHeading('Andy (G40.5): a duplicate opens the edit dialog of the icon there, and writes nothing');
    const t1 = read(SET);
    await add(chrome, fresh[0], 'again');
    const opened = await until(function () { return chrome.evaluate('(function () { var k = Array.prototype.filter.call(document.querySelectorAll("#box input"), function (i) { return i.getClientRects().length && !/icon|keyword/i.test(String(i.placeholder || "")); })[0]; return !!k && /first/.test(k.value) && !!' + button('Remove this icon') + '; }())'); }, 5000);
    ok(opened, 'its dialog opens, its keywords in it, with Remove', 'no dialog of ' + fresh[0] + ': ' + short(await text(chrome)));
    ok(read(SET) === t1, 'and the set is not written', 'a duplicate changed the set');

    // OVER THE APP, AS CONTACT'S DETAIL (Andy: "the icon detail panel is supposed to open overtop of the icon app..... like
    // contact detail etc."): a panel layer (spirit/element/panel.js) covering the whole face, the icon's glyph on it, the
    // add row and the list out of sight under it; its close brings the list back. Judged by what is on top where the add
    // row stands.
    test.subHeading('Andy: "the icon detail panel is supposed to open overtop of the icon app..... like contact detail"');
    const OVER = '(function () { var box = document.getElementById("box"); var b = box.getBoundingClientRect(); var l = Array.prototype.filter.call(box.querySelectorAll(".app-container"), function (c) { return c.offsetParent !== null; }).pop(); if (!l) return "no panel layer"; var r = l.getBoundingClientRect(); if (r.width < b.width - 4 || r.height < b.height - 4) return "a layer of " + Math.round(r.width) + "x" + Math.round(r.height) + " in a box of " + Math.round(b.width) + "x" + Math.round(b.height); if (String(l.textContent).indexOf(' + JSON.stringify(fresh[0]) + ') === -1) return "the layer does not show " + ' + JSON.stringify(fresh[0]) + '; var g = ' + field('glyph') + '; if (g) { var gr = g.getBoundingClientRect(); var top = document.elementFromPoint(gr.left + 2, gr.top + 2); if (top && !l.contains(top)) return "the add row is still in sight"; } return "over"; }())';
    const wasOver = await until(function () { return chrome.evaluate(OVER).then(function (v) { return v === 'over'; }); }, 5000);
    ok(wasOver, 'the duplicate\'s dialog is a panel over the whole face, ' + fresh[0] + ' on it, the add row under it', 'the dialog: ' + short(await chrome.evaluate(OVER)));
    await chrome.evaluate('(function () { var c = Array.prototype.filter.call(document.querySelectorAll("#box .app-container-close"), function (x) { return x.offsetParent !== null; }).pop(); if (c) c.click(); return !!c; }())');
    const back = await until(function () { return chrome.evaluate('(function () { var g = ' + field('glyph') + '; if (!g) return false; var gr = g.getBoundingClientRect(); var top = document.elementFromPoint(gr.left + 2, gr.top + 2); return top === g || g.contains(top); }())'); }, 5000);
    ok(wasOver && back, 'its close brings the face back, the add row on top', wasOver ? 'after its close the add row is not on top: ' + short(await chrome.evaluate(OVER)) : 'no panel was open, so its close judged nothing');
    // Pressing the icon's row in the list opens it the same way.
    await chrome.evaluate('(function () { var rows = Array.prototype.filter.call(document.querySelectorAll("#box tr, #box .list-row"), function (r) { return r.getClientRects().length && String(r.textContent).indexOf(' + JSON.stringify(fresh[0]) + ') !== -1; }); var hit = rows[0]; if (!hit) return false; var leaf = Array.prototype.filter.call(hit.querySelectorAll("*"), function (e) { return !e.children.length && e.getClientRects().length; })[0] || hit; leaf.click(); return true; }())');
    ok(await until(function () { return chrome.evaluate(OVER).then(function (v) { return v === 'over'; }); }, 5000), 'a press on its row opens it over the face too', 'a press on its row: ' + short(await chrome.evaluate(OVER)));

    test.subHeading('an icon opened: its keywords saved as they change, and Remove');
    await chrome.evaluate('(function () { var k = Array.prototype.filter.call(document.querySelectorAll("#box input"), function (i) { return i.getClientRects().length && !/icon|keyword/i.test(String(i.placeholder || "")); })[0]; k.value = "changed, again"; k.dispatchEvent(new Event("change", { bubbles: true })); return true; }())');
    ok(await until(function () { return Promise.resolve(JSON.stringify((json(SET) || {})[fresh[0]]) === '["changed","again"]'); }, 8000), 'a change of its keywords writes them', 'after the change the set holds ' + short((json(SET) || {})[fresh[0]]));
    // REMOVE IS AN ARMING BUTTON (Andy: "icon detail, delete should be an armingButton."; spirit/element/armingButton.js):
    // a first press only arms it, a click anywhere else disarms it, and only a second press removes.
    const REMOVE = '(function () { return Array.prototype.filter.call(document.querySelectorAll("#box button"), function (b) { return b.getClientRects().length && /^Remove/.test(String(b.textContent).trim()); }).pop() || null; }())';
    const armed = function () { return chrome.evaluate('(function () { var b = ' + REMOVE + '; return !!b && b.hasAttribute("data-armed"); }())'); };
    await chrome.evaluate('(function () { var b = ' + REMOVE + '; if (b) b.click(); return !!b; }())');
    await sleep(1200);
    const wasArmed = await armed();
    ok(wasArmed, 'Andy: "delete should be an armingButton": a first press arms Remove', 'a first press of Remove did not arm it: ' + short(await chrome.evaluate('(function () { var b = ' + REMOVE + '; return b ? b.outerHTML : "no Remove"; }())')));
    ok(fresh[0] in (json(SET) || {}), 'and removes nothing', 'a single press of Remove took ' + fresh[0] + ' out of the set');
    await chrome.evaluate('(function () { var b = ' + REMOVE + '; var l = b && b.closest(".app-container"); var t = (l && (l.querySelector(".panel-heading") || l.querySelector("label"))) || document.body; t.click(); return true; }())');
    await sleep(500);
    ok(wasArmed && !(await armed()), 'a click elsewhere disarms it ("the button must reset, back to its original state")', wasArmed ? 'after a click elsewhere Remove is still armed' : 'Remove never armed, so disarming judged nothing');
    ok(fresh[0] in (json(SET) || {}), 'and still nothing is removed', 'disarming took ' + fresh[0] + ' out of the set');
    await chrome.evaluate('(function () { var b = ' + REMOVE + '; if (b) b.click(); return !!b; }())');
    await sleep(300);
    await chrome.evaluate('(function () { var b = ' + REMOVE + '; if (b) b.click(); return !!b; }())');
    ok(await until(function () { return Promise.resolve(!(fresh[0] in (json(SET) || {}))); }, 8000), 'a second press removes it from the set', 'after two presses the set still holds ' + fresh[0]);
    ok(await until(function () { return chrome.evaluate('!' + REMOVE); }, 5000), 'and its dialog closes', 'its dialog stayed after Remove');
    ok(await until(function () { return rows(chrome).then(function (t) { return t.indexOf(fresh[0]) === -1; }); }, 8000), 'the list lets it go, no reload', 'the list still shows ' + fresh[0] + ': ' + short(await rows(chrome)));

    test.subHeading('the box, 10: "data.js on every open page follows that one job": a second page');
    other = await chromePage(findChrome());
    if (other.error) { test.fail('no second Chrome: the other page is not judged. ' + short(other.error)); other = null; }
    if (other) {
      const m2 = await mount(other);
      ok(m2 === 'made' && await until(function () { return rows(other).then(function (t) { return t.indexOf(sys) !== -1; }); }, 10000), 'the world: a second page shows the set', 'the second page: ' + short(m2));
      await other.evaluate('window.__posts = []; true');
      await add(chrome, fresh[1], 'second');
      ok(await until(function () { return rows(other).then(function (t) { return t.indexOf(fresh[1]) !== -1; }); }, 10000), 'the other page shows ' + fresh[1] + ', added on the first, no reload', 'the other page never showed ' + fresh[1] + ': ' + short(await text(other)));
      const asked = JSON.parse(await other.evaluate('JSON.stringify(window.__posts || [])'));
      ok(!asked.some(function (p) { return /"op"\s*:\s*"search"/.test(p); }), 'and asked no search of its own for it', 'the other page searched: ' + short(asked));
      await chrome.evaluate('(function () { window.__posts = []; return true; }())');
      await other.evaluate('window.__posts = []; true');
      await icondelete(node, fresh[1]);
      ok(await until(function () { return rows(other).then(function (t) { return t.indexOf(fresh[1]) === -1; }); }, 10000), 'an icon deleted elsewhere leaves the other page too', 'the other page still shows ' + fresh[1]);
    }

    test.subHeading('destroy');
    const empty = await chrome.evaluate('(function () { window.made.destroy(); return document.getElementById("box").children.length === 0; }())');
    ok(empty === true, 'destroy empties its container', 'destroy left ' + short(await text(chrome)));
  } finally {
    [chrome, other].forEach(function (c) {
      if (!c) return;
      try { if (c.sock) c.sock.close(); } catch (e) { /* gone */ }
      try { if (c.kid) c.kid.kill(); } catch (e) { /* gone */ }
    });
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });

// A delete asked of the node directly, as another page or peer would.
function icondelete(node, glyph) {
  return fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'icons.icon', args: { op: 'delete', glyph: glyph } }) }).then(function (r) { return r.text(); }, function () { return ''; });
}
