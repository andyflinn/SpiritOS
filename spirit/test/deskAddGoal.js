'use strict';

// spirit/test/deskAddGoal.js
// goal/G43.23: restored from 885f1ab5^, rewritten on today's harness. Its fake page had no spirit.require, so it threw
// "no spirit.require on this page" before any check; the bubble it asserts is live. The page is now the real one: a
// scratch node, headless Chrome, the Desk page loaded by spirit.require into the home page's app area
// (spirit/run/test/headLessChrome.js), on a desk that is a stand-in answering the reads and recording every ask.
//
// goal/G9.11: the Add Goal bubble above the List's search, while [Goals Only] is on.
//   Andy: "In the list panel, when the [Goals Only] toggle button in the search bar is \"checked\" (on), a new bubble
//   will appear directly above the search bubble for the list: \"Add Goal\" [Title String, subject to label rules]
//   [add-button]. When the user presses the [add-button], the desk will add a goal with the entered title and a blank
//   text box. The new goal will automatically become the current goal."
//
// THE SHAPE ASSERTED: goal.add does NOT make its goal current (goal/G9.13: an add must not move what he chose); his words
// here say the goal he adds by hand IS current. Both hold if the bubble does what he would do by hand: goal.add, then the
// make-current press on the id it answers, in that order, with no new verb.
//   The bubble: #desk-add-goal, holding the input #desk-goal-title and the button #desk-goal-add, shown directly above
//   the List's search bubble and only while Goals Only is on; the title obeys the label rules, which the desk enforces
//   (fieldRules, goal/G9.10), so the page sends it as typed.
// NOT ASSERTED: that the new goal arrives in design mode (goal.add's own doing) and the blank box (nothing writes one).

const fs = require('fs');
const test = require('./testSupport.js');
const H = require('../run/test/headLessChrome.js');

const OWED = 'OWED by goal/G9.11: ';
// A page that loads spirit.js into the home page's app area (the Desk page's own test page); nothing of its own is run.
const PAGE = '/DEBUG/shell/desk/test/desk-opened.html';
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

// ── THE WORLD, IN THE PAGE ───────────────────────────────────────────────────────────────────────────────────────────
// window.T: the api the shell hands an app, its desk a stand-in that holds one current goal in design mode, answers
// goal.add with goal/G101, and records every ask; the Desk page mounted through spirit.require, as the shell mounts it.
const WORLD = function () {
  var T = window.T = { asked: [] };
  var goal = { id: 'goal/G100', title: 'The current one', goal: '', design: true, status: 'running', with: '', buttons: [], blocking: [], blocked: [], live: [], working: [], waiting: 0, asks: 0, names: {} };
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  T.api = {
    escapeHtml: esc, setScreenTitle: function () {}, closeDialog: function () {}, onFiles: function () {}, armUntilElsewhere: function () {},
    callDialog: function () { return new Promise(function () {}); },
    onPublished: function () { return function () {}; },
    verb: function (n, a) {
      T.asked.push({ name: n, args: JSON.parse(JSON.stringify(a || {})) });
      if (n === 'desk.items.search') return Promise.resolve({ status: 200, body: { items: [{ key: goal.id, label: JSON.stringify(goal) }], more: false } });
      if (n === 'desk.goal.add') return Promise.resolve({ status: 200, body: { id: 'goal/G101', change: 7 } });
      return Promise.resolve({ status: 200, body: { ok: true, change: 8, items: [], more: false } });
    },
  };
  T.wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  T.writes = function () { return T.asked.filter(function (a) { return a.name === 'desk.goal.add' || a.name === 'desk.press'; }); };
  T.filter = function (name) { return document.querySelector('#desk-list button[data-filter="' + name + '"]'); };
  // Shown: on the page, not hidden, and drawn with a size.
  T.shows = function (id) {
    var el = document.getElementById(id);
    if (!el || el.hidden) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  var def = null;
  (spirit.shell = spirit.shell || {}).activateApp = function (d) { def = d; };
  return Promise.resolve(spirit.start()).then(function () { return spirit.require('shell/desk/desk.js'); }).then(function () {
    def.mount(document.getElementById('app-content'), T.api);
    return T.wait(2500);
  }).then(function () { return { search: !!document.querySelector('#desk-list .shell-bubble input[type="text"]') }; });
};

// CHROME STARTS WITH THE REAL USERPROFILE: testSupport makes the suite's home a temp folder (HOME and USERPROFILE), and on
// Windows Chrome then gives no debugging address at all. Its profile is a scratch one either way (--user-data-dir).
async function chromeWithItsHome(chrome) {
  const was = process.env.USERPROFILE;
  if (process.env.SPIRIT_REAL_HOME) process.env.USERPROFILE = process.env.SPIRIT_REAL_HOME;
  try { return await H.chromePage(chrome); } finally { process.env.USERPROFILE = was; }
}
// The page, driven: one scratch node, one Chrome, the page opened and the world set up in it.
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
    await page.send('Page.navigate', { url: node.base + PAGE });
    await H.until(function () { return page.evaluate('document.readyState === "complete" && !!window.spirit && typeof spirit.require === "function"').then(Boolean); }, H.WAIT);
    await body(run);
  } finally {
    if (page && page.kid) page.kid.kill();
    if (node.child) node.child.kill();
    try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
  }
}

test.startTest('goal/G9.11: Add Goal above the List search, while Goals Only is on');

(async function () {
  await browser(async function (run) {
    const w = await run(WORLD);
    // The control: the List's own search bubble is on the page, so a missing Add Goal bubble is a missing bubble.
    if (w && w.search) test.check('the world: the List draws its search bubble');
    else { test.fail('the world: no search bubble in the List: ' + short(w)); return; }

    test.subHeading('1. nothing while Goals Only is off, as Desk opens');
    const off = await run(function () { return { shown: T.shows('desk-add-goal') }; });
    if (!off.shown) test.check('with Goals Only off there is no Add Goal bubble');
    else test.fail(OWED + 'the bubble shows with Goals Only off');

    test.subHeading('2. Goals Only on draws it, directly above the search bubble');
    const on = await run(function () {
      var b = T.filter('goalsOnly');
      if (!b) return { error: 'no [Goals Only] button' };
      b.click();
      return T.wait(800).then(function () {
        var add = document.getElementById('desk-add-goal');
        var bubble = document.querySelector('#desk-list .shell-bubble');
        var a = add ? add.getBoundingClientRect() : null;
        var s = bubble ? bubble.getBoundingClientRect() : null;
        return { shown: T.shows('desk-add-goal'), input: T.shows('desk-goal-title'), button: T.shows('desk-goal-add'),
          add: a && { top: Math.round(a.top), bottom: Math.round(a.bottom) }, search: s && { top: Math.round(s.top), bottom: Math.round(s.bottom) } };
      });
    });
    if (on.shown && on.input && on.button) test.check('the bubble #desk-add-goal shows, with #desk-goal-title and #desk-goal-add');
    else test.fail(OWED + 'with Goals Only on: ' + short(on));
    // Above the search bubble, as he sees it: its foot at or above the bubble's top, nothing of the List between.
    if (on.add && on.search && on.add.bottom <= on.search.top && on.search.top - on.add.bottom < 64) test.check('it is drawn directly above the search bubble (' + on.add.bottom + ' over ' + on.search.top + ')');
    else test.fail(OWED + 'Add Goal at ' + short(on.add) + ', the search bubble at ' + short(on.search));

    test.subHeading('3. the button adds the goal and makes it current');
    const added = await run(function () {
      var before = T.writes().length;
      document.getElementById('desk-goal-title').value = 'A goal of his own';
      document.getElementById('desk-goal-add').click();
      return T.wait(600).then(function () { return { writes: T.writes().slice(before), box: document.getElementById('desk-goal-title').value }; });
    });
    const writes = added.writes || [];
    const add = writes.filter(function (c) { return c.name === 'desk.goal.add'; });
    if (add.length === 1 && add[0].args.title === 'A goal of his own' && add[0].args.id === undefined) test.check('it sent goal.add {title}, naming no id');
    else test.fail(OWED + 'it sent ' + short(writes));
    const press = writes.filter(function (c) { return c.name === 'desk.press' && c.args.what === 'make-current'; });
    if (press.length === 1 && press[0].args.id === 'goal/G101' && writes.indexOf(press[0]) > writes.indexOf(add[0])) test.check('then make-current on goal/G101, the id the desk answered');
    else test.fail(OWED + 'the writes were ' + short(writes));
    if (added.box === '') test.check('the title box clears once the goal is taken');
    else test.fail(OWED + 'the box still holds ' + short(added.box));

    test.subHeading('4. an empty title sends nothing');
    const blank = await run(function () {
      var before = T.writes().length;
      document.getElementById('desk-goal-title').value = '   ';
      document.getElementById('desk-goal-add').click();
      return T.wait(600).then(function () { return { sent: T.writes().slice(before) }; });
    });
    if (!(blank.sent || []).length) test.check('a blank title adds nothing');
    else test.fail(OWED + 'it sent ' + short(blank));

    test.subHeading('5. Current Goal Only takes the bubble away again (goal/G9.2)');
    const back = await run(function () {
      var b = T.filter('current');
      if (!b) return { error: 'no [Current Goal Only] button' };
      b.click();
      return T.wait(800).then(function () { return { shown: T.shows('desk-add-goal') }; });
    });
    if (back.shown === false) test.check('turning Current Goal Only on de-selects Goals Only, and the bubble goes');
    else test.fail(OWED + 'after Current Goal Only: ' + short(back));
  });
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
