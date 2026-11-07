'use strict';

// spirit/run/shell/icons/test/icons.js
// The tests of shell/icons/icons.js, and of no other module (spec: ./icons.md; goal/G41.27): its add row, a rowForm.
// Asked of a real browser, the real rowForm composed: ./icons-laid.html, on a scratch node with its DEBUG on, mounts the
// app in a box, the rowForm's create kept as it is called.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const H = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

const ADDRESS = '/DEBUG/shell/icons/test/icons-laid.html';
test.startTest('icons.js: the icons app\'s add row, a rowForm');

(async function () {
  const chrome = H.findChrome();
  if (!chrome) { test.fail('no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name'); test.reportSuccessFailureCount(); return; }
  const node = await H.scratchNode();
  let page = null;
  try {
    if (!node.up || !node.debug) { test.fail('the scratch node did not come up with its DEBUG on'); return; }
    page = await H.chromePage(chrome);
    if (page.error) { test.fail(page.error); return; }
    await page.send('Page.navigate', { url: node.base + ADDRESS });
    await H.until(function () { return page.evaluate('typeof window.laid === "function" && !!window.spirit').then(Boolean); }, H.WAIT);
    const s = await page.evaluate('window.laid()').catch(function () { return ''; });
    let m = null;
    try { m = JSON.parse(s); } catch (e) { m = null; }
    if (!m || !m.app) { test.fail('the app did not mount: ' + JSON.stringify(s).slice(0, 300)); return; }
    // Andy, on G41.27: "icons app:\n[➕] [an icon:paste] [keywords, comma separated][Add]".
    const forms = m.forms || [];
    ok(forms.length === 1 && forms[0].icon === '➕' && forms[0].button === 'Add' && forms[0].inBox, 'its add row is one rowForm in the app, its icon ➕ and its button Add', 'rowForms: ' + short(forms));
    if (forms.length !== 1) return;
    const sp = m.span || [];
    ok(sp.length === 2 && m.spanInputs === 2 && sp.every(function (k) { return k.tag === 'INPUT'; }) && /icon/i.test(sp[0].placeholder) && /paste/i.test(sp[0].placeholder) && sp[1].placeholder === 'keywords, comma separated',
      'its span holds the icon to paste, then the keywords, comma separated, and nothing else', 'span: ' + short(sp));
    ok(m.adds === 1 && m.addIsForm, 'its Add is the rowForm\'s button, the only Add', 'Adds ' + m.adds + ', the form\'s ' + m.addIsForm);
    ok(m.formFirst, 'the add row stands on top, above the list', 'not above the list');
    // The box: "a line saying what a press did (a refusal, a result) is the mounter's, below the bubble, not in it."
    ok(/paste an icon first/.test(m.said || ''), 'its Add is wired: pressed with no icon, it says paste an icon first', 'said: ' + short(m.said));
    ok(!!m.said && !m.saidInBubble && m.saidBelow, 'on a line below the bubble, not in it', 'in the bubble ' + m.saidInBubble + ', below ' + m.saidBelow);

    // The box: "the Icons app's one fallback path changes to this file", and "Until then the Icons app writes its old file, relay-state/shell/icons/iconSet.json".
    test.subHeading('goal/G43.11: its fallback is spirit/iconSet.json, and it writes its old file');
    const SET = 'spirit/iconSet.json';
    const OWN = path.join(node.root, 'spirit', 'run', 'relay-state', 'shell', 'icons', 'iconSet.json');
    const setOnDisc = path.join(node.root, 'spirit', 'run', SET);
    const before = fs.readFileSync(setOnDisc, 'utf8');
    const glyphs = Object.keys(JSON.parse(before));
    const code = fs.readFileSync(path.join(RUN, 'shell', 'icons', 'icons.js'), 'utf8');
    ok(code.indexOf('shell/json/iconSet.json') === -1, 'it does not name the old system set', 'icons.js still names shell/json/iconSet.json');
    // Glyphs the set does not have: Add refuses one it has.
    const fresh = [];
    for (let c = 0x1F980; c < 0x1FB00 && fresh.length < 3; c++) { const g = String.fromCodePoint(c); if (!glyphs.includes(g)) fresh.push(g); }
    if (fresh.length < 3) { test.fail('the world: the set has every glyph tried'); return; }
    // The real app on the real desktop: the page above has no spirit.ready, so its Add cannot save.
    await page.send('Page.navigate', { url: node.base + '/' });
    await H.until(function () { return page.evaluate('!!(window.spirit && window.spirit.ready)'); }, H.WAIT);
    const pressed = await H.until(function () { return page.evaluate('(function () { var e = [].filter.call(document.querySelectorAll("*"), function (x) { return x.offsetParent !== null && !x.children.length && x.textContent.trim() === "Icons"; })[0]; if (!e) return false; e.click(); return true; }())'); }, H.WAIT);
    ok(!!pressed, 'the Icons app opens on the desktop', 'no Icons tile on the desktop: nothing judged');
    if (!pressed) return;
    await H.until(function () { return page.evaluate('!!document.querySelector("[data-icons=add]")'); }, H.WAIT);
    const add = function (glyph, words) {
      return page.evaluate('(function () { var g = document.querySelector("[data-icons=new-glyph]"); var w = document.querySelector("[data-icons=new-keywords]"); g.value = ' + JSON.stringify(glyph) + '; w.value = ' + JSON.stringify(words) + '; document.querySelector("[data-icons=add]").click(); return true; })()');
    };
    const ownHolds = function (g) { try { return Object.prototype.hasOwnProperty.call(JSON.parse(fs.readFileSync(OWN, 'utf8')), g); } catch (e) { return false; } };
    ok(!fs.existsSync(OWN), 'the world: no own file yet', 'the node already has an own file');
    await add(fresh[0], 'probe');
    await H.until(function () { return Promise.resolve(ownHolds(fresh[0])); }, 8000);
    ok(ownHolds(fresh[0]), 'an Add writes its old file', 'the Add did not reach ' + OWN);
    const lost = glyphs.filter(function (g) { return !ownHolds(g); });
    ok(lost.length === 0, 'with no own file it starts from ' + SET + ': all ' + glyphs.length + ' icons', lost.length + ' icons of ' + SET + ' are not in it, ' + short(lost.slice(0, 20)));
    ok(fs.readFileSync(setOnDisc, 'utf8') === before, SET + ' is not written', SET + ' changed');
    const trimmed = {}; trimmed[fresh[1]] = ['own'];
    fs.writeFileSync(OWN, JSON.stringify(trimmed));
    await add(fresh[2], 'second');
    await H.until(function () { return Promise.resolve(ownHolds(fresh[2])); }, 8000);
    ok(ownHolds(fresh[2]) && ownHolds(fresh[1]), 'with an own file it starts from that', 'the second Add did not keep the own file\'s glyph');
    ok(!ownHolds(glyphs[0]), 'and the set is not mixed in', 'the second Add mixed ' + SET + ' in');
  } finally {
    if (page && page.kid) page.kid.kill();
    if (node.child) node.child.kill();
    try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
    test.reportSuccessFailureCount();
  }
}());
