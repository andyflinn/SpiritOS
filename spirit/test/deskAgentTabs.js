'use strict';

// spirit/test/deskAgentTabs.js
// goal/G43.23: restored from 885f1ab5^, rewritten on today's harness. Its fake page had no spirit.require, so it threw
// "no spirit.require on this page" before the checks ran; the tab row and the dialog it asserts are live. The pages are
// now the real ones: a scratch node, headless Chrome, Desk and its item dialog loaded by spirit.require into the home
// page's app area (spirit/run/test/headLessChrome.js), on a desk that is a stand-in answering the reads.
//
// WHAT STANDS OF desk/G1.2's TABS. The agents show as bubbles in the tab row (goal/G3.12), and Team and Apps are gone
// (goal/G43.22: Andy, the box, Q5: "G0 goes, from ui and server, kept in database.").
// WHAT IS ASSERTED of desk.js and deskDetails.js:
//   - T1: #desk-tabs has the List tab, and no lead, team or apps tab; no data-agent tab is drawn.
//   - T5: the List tab's label carries "(n)", n the rows waiting on Andy, the desk server's count on the goal row.
//   - T7: deskDetails draws no #dd-name box until #dd-rename is pressed.
// GONE SINCE 885f1ab5^, and not asserted: the agents packets the old fake log carried (the page reads no log, and has
// no onPacket); the Team chat they fed (goal/G43.22).

const fs = require('fs');
const test = require('./testSupport.js');
const H = require('../run/test/headLessChrome.js');

const DESK_PAGE = '/DEBUG/shell/desk/test/desk-opened.html';
const DETAILS_PAGE = '/DEBUG/shell/deskDetails/test/deskDetails-opened.html';
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

// ── THE WORLDS, IN THE PAGE ──────────────────────────────────────────────────────────────────────────────────────────
// The api the shell hands an app, its desk a stand-in: one current goal whose row says one row waits on Andy, and one
// item of it. Then the app mounted through spirit.require, as the shell mounts it.
const DESK_WORLD = function () {
  var T = window.T = { asked: [] };
  var row = function (o) { return Object.assign({ id: 'goal/G100.1', title: 'Asks Andy', goal: 'goal/G100', status: 'running', with: 'claude-windows', buttons: [], blocking: [], blocked: [], asks: 1, alert: false, names: {} }, o || {}); };
  var rows = [row({ id: 'goal/G100', title: 'The goal', goal: '', design: false, waiting: 1, live: ['claude-windows'], working: [] }), row(), row({ id: 'goal/G100.2', title: 'Quiet', asks: 0 })];
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  T.api = {
    escapeHtml: esc, setScreenTitle: function () {}, closeDialog: function () {}, onFiles: function () {}, armUntilElsewhere: function () {},
    callDialog: function () { return new Promise(function () {}); }, onPublished: function () { return function () {}; },
    verb: function (n, a) {
      T.asked.push({ name: n, args: a });
      if (n === 'desk.items.search') return Promise.resolve({ status: 200, body: { items: rows.map(function (r) { return { key: r.id, label: JSON.stringify(r) }; }), more: false } });
      return Promise.resolve({ status: 200, body: { ok: true, items: [], more: false } });
    },
  };
  var def = null;
  (spirit.shell = spirit.shell || {}).activateApp = function (d) { def = d; };
  return Promise.resolve(spirit.start()).then(function () { return spirit.require('shell/desk/desk.js'); }).then(function () {
    def.mount(document.getElementById('app-content'), T.api);
    return new Promise(function (r) { setTimeout(r, 2500); });
  }).then(function () {
    var tabs = document.getElementById('desk-tabs');
    var list = tabs && tabs.querySelector('[data-tab="list"]');
    return { tabs: tabs ? tabs.innerHTML : null, page: document.getElementById('app-content').innerHTML.length, listLabel: list ? list.textContent : null,
      tabNames: tabs ? Array.prototype.map.call(tabs.querySelectorAll('[data-tab]'), function (b) { return b.getAttribute('data-tab'); }) : [],
      agentTabs: document.querySelectorAll('#app-content [data-agent]').length };
  });
};
const DETAILS_WORLD = function () {
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var facts = { id: 'goal/G100.1', title: 'Asks Andy', goal: 'goal/G100', status: 'running', with: '', buttons: ['go'], blocking: ['goal/G100'], blocked: [], names: {} };
  var api = {
    escapeHtml: esc, setScreenTitle: function () {}, closeDialog: function () {}, armUntilElsewhere: function () {}, onPublished: function () { return function () {}; },
    verb: function (n) {
      var b = { ok: true };
      if (n === 'desk.item.get') b = { item: JSON.stringify(facts), version: 1, change: 1 };
      if (n === 'desk.item.box') b = { box: 'a box', version: 1 };
      if (n === 'desk.item.chat') b = { chat: [] };
      if (n === 'desk.item.checks') b = { checks: [] };
      if (n === 'desk.item.files') b = { files: [] };
      return Promise.resolve({ status: 200, body: b });
    },
  };
  var def = null;
  (spirit.shell = spirit.shell || {}).activateApp = function (d) { def = d; };
  var shown = function () { return { name: !!document.getElementById('dd-name'), rename: !!document.getElementById('dd-rename') }; };
  return spirit.require('shell/deskDetails/deskDetails.js').then(function () {
    def.mount(document.getElementById('app-content'), api);
    return def.open({ id: facts.id });
  }).then(function () { return new Promise(function (r) { setTimeout(r, 1500); }); }).then(function () {
    var atOpen = shown();
    var b = document.getElementById('dd-rename');
    if (b) b.click();
    return new Promise(function (r) { setTimeout(r, 300); }).then(function () { return { atOpen: atOpen, pressed: shown() }; });
  });
};

// CHROME STARTS WITH THE REAL USERPROFILE: testSupport makes the suite's home a temp folder (HOME and USERPROFILE), and on
// Windows Chrome then gives no debugging address at all. Its profile is a scratch one either way (--user-data-dir).
async function chromeWithItsHome(chrome) {
  const was = process.env.USERPROFILE;
  if (process.env.SPIRIT_REAL_HOME) process.env.USERPROFILE = process.env.SPIRIT_REAL_HOME;
  try { return await H.chromePage(chrome); } finally { process.env.USERPROFILE = was; }
}
// The pages, driven: one scratch node, one Chrome; open(path) opens a page afresh, run(fn) runs fn in it.
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
    const open = async function (p) {
      await page.evaluate('window.__left = true');
      await page.send('Page.navigate', { url: node.base + p });
      await H.until(function () { return page.evaluate('!window.__left && document.readyState === "complete" && !!window.spirit && typeof spirit.require === "function"').then(Boolean); }, H.WAIT);
    };
    await body(run, open);
  } finally {
    if (page && page.kid) page.kid.kill();
    if (node.child) node.child.kill();
    try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
  }
}

test.startTest('desk/G1.2: the tab row, the agents as bubbles, and the rename');

(async function () {
  await browser(async function (run, open) {
    await open(DESK_PAGE);
    const d = await run(DESK_WORLD);
    if (!d || typeof d.tabs !== 'string') { test.fail('the world: the Desk page drew no #desk-tabs: ' + short(d)); return; }

    test.subHeading('T1: Lead is no longer a top tab, and no agent tab stands in its place; no Team or Apps tab (goal/G43.22)');
    const names = d.tabNames || [];
    if (names.indexOf('list') !== -1 && names.indexOf('lead') === -1 && !d.agentTabs) test.check('the List tab, no Lead top tab, no agent tab');
    else test.fail('tabs ' + short(names) + '; agent tabs: ' + d.agentTabs);
    if (names.indexOf('list') !== -1 && names.indexOf('team') === -1 && names.indexOf('apps') === -1) test.check('no Team tab and no Apps tab');
    else test.fail('goal/G43.22: the tab row holds ' + short(names));

    test.subHeading('T5: the List tab carries the count of rows waiting on Andy');
    if (/\(1\)/.test(String(d.listLabel))) test.check('List shows (1): the goal row says one row asks Andy');
    else test.fail('List tab label: ' + short(d.listLabel));

    test.subHeading('T7: renaming is its own button; the dialog shows no name box until it is pressed');
    await open(DETAILS_PAGE);
    const dd = await run(DETAILS_WORLD);
    if (dd && dd.atOpen && !dd.atOpen.name && dd.atOpen.rename) test.check('no name box on opening, a Rename button instead');
    else test.fail('dialog on opening: ' + short(dd));
    if (dd && dd.pressed && dd.pressed.name) test.check('Rename pressed: the name box shows');
    else test.fail('after Rename: ' + short(dd));
  });
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
