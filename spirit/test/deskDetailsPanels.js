'use strict';

// spirit/test/deskDetailsPanels.js
// goal/G43.23: restored from 885f1ab5^, rewritten on today's harness. Its fake page had no spirit.require and named a
// strip deskDetails.js no longer draws; the panels it asserts are live. The page is now the real one: a scratch node,
// headless Chrome, the item dialog loaded by spirit.require into the home page's app area
// (spirit/run/test/headLessChrome.js), on a desk that is a stand-in answering the reads and recording every ask. The
// strip is the workBench's since goal/G41.22: an icon is a [data-side="left"][data-tool="<panel>"] button.
//
// goal/G30.8, "Desk item details: icon strip, lazy panels". The item's box (v5), in short:
//   - The yellow bubble "How you check it: no checks written yet." goes.
//   - A strip of icons down the left edge, the section beside them showing one panel at a time.
//   - The panels, one icon each: the box (shown on open) 📃, the red Qs ❌, the blocks 🪠, the files with their
//     grants 📂.
//   - A panel asks for its own content only when its icon is pressed: block.targets only when 🪠 is.
//   - An icon blinks (dd-blink) while something in its panel waits on Andy: a red Q not answered, a grant not given.
//   - Each red Q has a remove button beside it, which sends his clear, the chat line "<Qn>: clear" (desk clearOf); since
//     goal/G41.11 it asks are-you-sure first ("the remove button for red Q's must ask: are-you-sure?").
//   - Andy, 2026-10-20: "the box no longer needs to be foldable, it is now space-limited and contained".
//   - goal/G33.8 (box v10, Andy: "the red grant buttons are still at the bottom of the file list"): the open grants come
//     first, before the files.
// GONE SINCE 885f1ab5^, and not asserted: kernel.js's ICON table (goal/G41.1: icons are glyphs, from no table); the fixed
// upper half (#dd-upper, 30vh) above the chat search (goal/G41.22 made the dialog a workBench, the chat its centre, and
// goal/G43.22 took the chat search out).

const fs = require('fs');
const test = require('./testSupport.js');
const H = require('../run/test/headLessChrome.js');

const OWED = 'OWED by goal/G30.8: ';
const PAGE = '/DEBUG/shell/deskDetails/test/deskDetails-opened.html';
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

// ── THE WORLD, IN THE PAGE ───────────────────────────────────────────────────────────────────────────────────────────
// window.T: the api the shell hands an app, its desk a stand-in answering one item, t/G1.2, with a box, a red Q, a grant
// and a core file, and recording every ask; T.open(checks) mounts the dialog through spirit.require and opens the item.
const WORLD = function () {
  var T = window.T = { asked: [] };
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var facts = { id: 't/G1.2', title: 'Beta', goal: 't/G1', status: 'running', with: '', buttons: ['done'], blocking: ['t/G1', 't/G1.3'], blocked: ['t/G1.4'], names: {} };
  T.wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  T.tool = function (k) { return document.querySelector('[data-side="left"][data-tool="' + k + '"]'); };
  T.panel = function () { var p = document.getElementById('dd-panel'); return p ? p.innerHTML : ''; };
  T.panelText = function () { var p = document.getElementById('dd-panel'); return p ? p.textContent : ''; };
  T.verbs = function () { return T.asked.map(function (a) { return a.name; }); };
  T.press = function (k) { var b = T.tool(k); if (!b) return Promise.resolve(false); if (!b.hasAttribute('data-current')) b.click(); return T.wait(700).then(function () { return true; }); };
  T.open = function (checks) {
    var api = {
      escapeHtml: esc, setScreenTitle: function () {}, closeDialog: function () {}, armUntilElsewhere: function () {}, onPublished: function () { return function () {}; },
      verb: function (n, a) {
        T.asked.push({ name: n, args: JSON.parse(JSON.stringify(a || {})) });
        var b = { ok: true, change: 1 };
        if (n === 'desk.item.get') b = { item: JSON.stringify(facts), version: 2, change: 7 };
        if (n === 'desk.item.box') b = { box: 'BOX-TEXT', version: 2 };
        if (n === 'desk.item.checks') b = { checks: checks };
        if (n === 'desk.item.chat') b = { chat: [{ by: 'andy', at: '2026-10-20T10:00:00Z', text: 'CHAT-HELLO' }] };
        if (n === 'desk.item.files') b = { files: [{ path: 'spirit/run/spirit/hub.js', by: 'claude-windows', core: true }], filesMore: false };
        if (n === 'desk.block.targets') b = { items: [] };
        return Promise.resolve({ status: 200, body: b });
      },
    };
    var def = null;
    (spirit.shell = spirit.shell || {}).activateApp = function (d) { def = d; };
    return spirit.require('shell/deskDetails/deskDetails.js').then(function () {
      def.mount(document.getElementById('app-content'), api);
      return def.open({ id: facts.id });
    }).then(function () { return T.wait(1500); }).then(function () { return { opened: !!T.tool('box') }; });
  };
};

// CHROME STARTS WITH THE REAL USERPROFILE: testSupport makes the suite's home a temp folder (HOME and USERPROFILE), and on
// Windows Chrome then gives no debugging address at all. Its profile is a scratch one either way (--user-data-dir).
async function chromeWithItsHome(chrome) {
  const was = process.env.USERPROFILE;
  if (process.env.SPIRIT_REAL_HOME) process.env.USERPROFILE = process.env.SPIRIT_REAL_HOME;
  try { return await H.chromePage(chrome); } finally { process.env.USERPROFILE = was; }
}
// The page, driven: one scratch node, one Chrome; open() opens the page afresh, run(fn) runs fn in it.
async function browser(body) {
  const chrome = H.findChrome();
  if (!chrome) { test.fail('no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name'); return; }
  const node = await H.scratchNode();
  let page = null;
  try {
    page = node.up && node.debug ? await chromeWithItsHome(chrome) : null;
    if (!page || page.error) { test.fail(page ? page.error : 'the scratch node did not come up with its DEBUG on'); return; }
    const run = async function (fn) {
      const out = await page.evaluate('Promise.resolve((' + String(fn) + ')()).then(function (v) { return JSON.stringify(v === undefined ? null : v); }, function (e) { return JSON.stringify({ error: String(e && e.stack || e) }); })');
      try { return JSON.parse(out); } catch (e) { return { error: 'no answer: ' + String(out) }; }
    };
    const open = async function () {
      await page.evaluate('window.__left = true');
      await page.send('Page.navigate', { url: node.base + PAGE });
      await H.until(function () { return page.evaluate('!window.__left && document.readyState === "complete" && !!window.spirit && typeof spirit.require === "function"').then(Boolean); }, H.WAIT);
      await run(WORLD);
    };
    await body(run, open);
  } finally {
    if (page && page.kid) page.kid.kill();
    if (node.child) node.child.kill();
    try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
  }
}

test.startTest('goal/G30.8: the item details: an icon strip, one panel at a time');

(async function () {
  await browser(async function (run, open) {
    await open();
    const o = await run(function () {
      return T.open([{ number: 'Q1', kind: 'Q', words: 'WHICH-ONE', test: '', state: 'open', by: '', at: '' },
        { number: 'G1', kind: 'G', words: 'core grant: js/hub.js', test: '', state: 'open', by: '', at: '' }]);
    });
    if (!o || !o.opened) { test.fail('the world: the dialog drew no strip: ' + short(o)); return; }

    test.subHeading('1. the strip and its icons');
    const strip = await run(function () {
      var g = {};
      ['box', 'qs', 'blocks', 'files'].forEach(function (k) { var b = T.tool(k); g[k] = b ? b.textContent.trim() : null; });
      return { glyphs: g, page: document.getElementById('app-content').textContent };
    });
    const gl = strip.glyphs || {};
    if (gl.box === '📃' && gl.qs === '❌' && gl.blocks === '🪠' && gl.files === '📂') test.check('the strip has its four icons: 📃 box, ❌ red Qs, 🪠 blocks, 📂 files');
    else test.fail(OWED + 'the strip reads ' + short(gl));
    if (!/How you check it/.test(strip.page || '')) test.check('the yellow "How you check it" bubble is gone');
    else test.fail(OWED + 'the yellow bubble is still drawn');

    test.subHeading('2. one panel at a time, and only what it needs');
    const box = await run(function () {
      var cm = document.querySelector('#dd-panel .CodeMirror');
      var text = cm && cm.CodeMirror ? cm.CodeMirror.getValue() : (document.getElementById('dd-box-input') || {}).value;
      return { text: text, panel: T.panelText(), fold: !!document.querySelector('#dd-panel [data-fold]'), editor: !!cm || !!document.getElementById('dd-box-input'), verbs: T.verbs() };
    });
    if (box.text === 'BOX-TEXT' && !/WHICH-ONE/.test(box.panel || '')) test.check('on open the panel is the box');
    else test.fail(OWED + 'the open panel reads ' + short(box));
    if (box.editor && !box.fold) test.check('the box has no fold; it is an editor, in the panel');
    else test.fail(OWED + 'the box: editor ' + box.editor + ', fold ' + box.fold);
    if ((box.verbs || []).indexOf('desk.block.targets') === -1) test.check('opening asks no block.targets');
    else test.fail(OWED + 'opening asked block.targets: ' + short(box.verbs));

    const qs = await run(function () {
      return T.press('qs').then(function (ok) {
        if (!ok) return { error: 'no ❌ on the strip' };
        var remove = document.querySelector('#dd-panel [data-qclear="Q1"]');
        return { text: T.panelText(), remove: !!remove };
      });
    });
    if (/WHICH-ONE/.test(qs.text || '') && !/BOX-TEXT/.test(qs.text || '')) test.check('❌ shows the red Qs in place of the box');
    else test.fail(OWED + 'after ❌ the panel reads ' + short(qs));
    if (qs.remove) test.check('each red Q has its remove button');
    else test.fail(OWED + 'no remove button beside Q1');
    const cleared = await run(function () {
      var b = document.querySelector('#dd-panel [data-qclear="Q1"]');
      if (!b) return { error: 'no remove' };
      var before = T.asked.length;
      b.click();
      return T.wait(300).then(function () {
        var first = T.asked.slice(before).filter(function (a) { return a.name === 'desk.chat.add'; }).length;
        var b2 = document.querySelector('#dd-panel [data-qclear="Q1"]') || b;
        b2.click();
        return T.wait(400).then(function () { return { first: first, sent: T.asked.slice(before).filter(function (a) { return a.name === 'desk.chat.add'; }).map(function (a) { return a.args; }) }; });
      });
    });
    const sent = cleared.sent || [];
    if (cleared.first === 0 && sent.length === 1 && sent[0].text === 'Q1: clear' && sent[0].id === 't/G1.2') test.check('remove asks are-you-sure, then sends his clear, "Q1: clear"');
    else test.fail(OWED + 'remove: after one press ' + cleared.first + ' sent, after two ' + short(cleared));

    const blocks = await run(function () {
      var before = T.asked.length;
      return T.press('blocks').then(function (ok) {
        if (!ok) return { error: 'no 🪠 on the strip' };
        return { asked: T.asked.slice(before).map(function (a) { return a.name; }), text: T.panelText() };
      });
    });
    if ((blocks.asked || []).indexOf('desk.block.targets') !== -1 && /Blocking|Blocked by|Also blocks/.test(blocks.text || '')) test.check('🪠 asks block.targets then, and shows the blocks');
    else test.fail(OWED + 'after 🪠: ' + short(blocks));

    const files = await run(function () {
      return T.press('files').then(function (ok) {
        if (!ok) return { error: 'no 📂 on the strip' };
        var html = T.panel();
        return { hub: /hub\.js/.test(html), grant: !!document.querySelector('#dd-panel [data-grant="G1"]'), grantAt: html.indexOf('data-grant='), fileAt: html.indexOf('data-file=') };
      });
    });
    if (files.hub && files.grant) test.check('📂 shows the files with their grants');
    else test.fail(OWED + 'after 📂: ' + short(files));
    if (files.grantAt !== -1 && files.fileAt !== -1 && files.grantAt < files.fileAt) test.check('the open grant\'s button comes before the first file');
    else test.fail('OWED by goal/G33.8: in the files panel the first grant button is at ' + files.grantAt + ', the first file at ' + files.fileAt);

    test.subHeading('3. the icons say what waits on him');
    const blink = await run(function () {
      var on = function (k) { var b = T.tool(k); return !!b && b.classList.contains('dd-blink'); };
      return { qs: on('qs'), files: on('files'), box: on('box') };
    });
    if (blink.qs && blink.files && !blink.box) test.check('an open red Q blinks ❌, an open grant blinks 📂');
    else test.fail(OWED + 'the strip with Q1 and G1 open: ' + short(blink));
    await open();
    const quiet = await run(function () {
      return T.open([{ number: 'Q1', kind: 'Q', words: 'WHICH-ONE', test: '', state: 'answered', by: '', at: '' },
        { number: 'G1', kind: 'G', words: 'core grant: js/hub.js', test: '', state: 'granted', by: '', at: '' }]).then(function () {
        return { blinking: document.querySelectorAll('[data-side="left"][data-tool].dd-blink').length, tools: document.querySelectorAll('[data-side="left"][data-tool]').length };
      });
    });
    if (quiet.tools > 0 && quiet.blinking === 0) test.check('nothing waiting, nothing blinks');
    else test.fail(OWED + 'with nothing open: ' + short(quiet));
  });
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
