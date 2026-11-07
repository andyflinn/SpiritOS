'use strict';

// spirit/test/deskList.js
// goal/G43.23: restored from 885f1ab5^, rewritten on today's harness. Its fake page had no spirit.require, so it broke
// at mount; the List it asserts is live. The page is now the real one: a scratch node, headless Chrome, the Desk page
// loaded by spirit.require into the home page's app area (spirit/run/test/headLessChrome.js), on a desk that is a
// stand-in answering the reads and recording every ask.
//
// desk/G2.6: the List paints only what the desk server says.
// Andy: "The server determines all the content to be drawn." "no pulling". "a press shouldn't post a line, it is not
// textual information." "The server does the searching AND the filtering." "When Desk opens: [Current Goal Only] on,
// [Goals Only] off". "Close makes item invisible? then Yes."
// What is checked:
//   On open the List asks desk.items.search {text: '', currentGoalOnly: true, goalsOnly: false} once, and paints one
//   row per label.
//   A row's next press is a button data-press="<what>" data-id="<id>"; Reopen is never in the List (desk/G3.6); the
//   ids it blocks are data-open links.
//   A click on a data-press button sends press {id, what}, no `by` (apiAuth/G1.13); the row does not change until
//   the server publishes. The page posts nothing: no nudge (goal/G3.8), no line.
//   It repaints from api.onPublished: {change, verb, item: <facts>} replaces that row; a published close takes the
//   row off the List; a row it does not hold is drawn from the publish, asking nothing (goal/G24.6). A published
//   session.set is the one publish that asks items.search again.
//   Typed words and the two toggles go to the server with items.search; the List filters nothing by a rule of its own.
//   Go all (desk/G3.4) sits in the bar while the goal offers it, never in the goal's row, and asks are-you-sure.
//   No deskGoState, deskReady, deskVerified, deskDone or READY TO CLOSE rule is left in shell/desk/desk.js.
// GONE SINCE 885f1ab5^, and not asserted: an agents packet arriving at the page (the page has no onPacket since
// goal/G33.4 and G43.22: nothing to arrive).

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const H = require('../run/test/headLessChrome.js');

const OWED = 'OWED by desk/G2.6: ';
const DESK = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
// A page that loads spirit.js into the home page's app area (the Desk page's own test page); nothing of its own is run.
const PAGE = '/DEBUG/shell/desk/test/desk-opened.html';

function code(file) { return fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1'); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

// ── THE WORLD, IN THE PAGE ───────────────────────────────────────────────────────────────────────────────────────────
// window.T: the api the shell hands an app, its desk a stand-in that answers items.search with the rows below and
// records every ask; the Desk page mounted through spirit.require, as the shell mounts it.
const WORLD = function () {
  var T = window.T = { asked: [], published: [], posted: [], dialogs: [] };
  var label = function (over) {
    return JSON.stringify(Object.assign({ id: 'goal/G100.1', title: 'Alpha', goal: 'goal/G100', status: 'running', with: '', buttons: ['go'],
      blocking: ['goal/G100', 'goal/G100.2'], blocked: [], verified: '', asks: 0, alert: false, names: {} }, over || {}));
  };
  T.label = label;
  T.rows = [
    { key: 'goal/G100', label: label({ id: 'goal/G100', title: 'The goal', goal: '', buttons: [], blocking: [], blocked: ['goal/G100.1', 'goal/G100.2'], design: false, waiting: 2, live: [] }) },
    { key: 'goal/G100.1', label: label() },
    { key: 'goal/G100.2', label: label({ id: 'goal/G100.2', title: 'Beta', status: 'done', buttons: ['close', 'reopen'], blocking: ['goal/G100'], blocked: ['goal/G100.1'] }) },
  ];
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  T.api = {
    escapeHtml: esc, setScreenTitle: function () {}, closeDialog: function () {}, onFiles: function () {},
    armUntilElsewhere: function () {},
    callDialog: function (id, p) { T.dialogs.push({ id: id, params: p }); return new Promise(function () {}); },
    onPublished: function (fn) { T.published.push(fn); return function () {}; },
    peerPost: function (app, to, body) { T.posted.push({ app: app, to: to, body: body }); return Promise.resolve({ ok: true }); },
    verb: function (n, a) {
      T.asked.push({ name: n, args: JSON.parse(JSON.stringify(a || {})) });
      if (n === 'desk.items.search') return Promise.resolve({ status: 200, body: { items: T.rows, more: false } });
      if (n === 'desk.press') return Promise.resolve({ status: 200, body: { change: 12 } });
      return Promise.resolve({ status: 200, body: { ok: true, items: [], more: false } });
    },
  };
  T.wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  T.searches = function () { return T.asked.filter(function (a) { return a.name === 'desk.items.search'; }); };
  T.presses = function () { return T.asked.filter(function (a) { return a.name === 'desk.press'; }); };
  // A publish is the desk's record changing: the stand-in's rows change with it, so whatever is asked after answers the
  // record as it now stands, as the desk server would.
  T.publish = function (o) {
    var it = o && o.item;
    if (it && it.id) {
      var row = { key: it.id, label: JSON.stringify(it) };
      var at = -1;
      T.rows.forEach(function (r, i) { if (r.key === it.id) at = i; });
      if (at === -1) T.rows.push(row); else T.rows[at] = row;
    }
    T.published.forEach(function (fn) { fn(o); });
  };
  // A row of the List, by a word of its title: the row element's tr.
  T.row = function (title) {
    var list = document.getElementById('desk-list');
    return Array.prototype.filter.call(list ? list.querySelectorAll('tr') : [], function (tr) { return tr.textContent.indexOf(title) !== -1 && !tr.querySelector('tr'); })[0] || null;
  };
  T.rowHtml = function (title) { var r = T.row(title); return r ? r.innerHTML : ''; };
  T.filter = function (name) { return document.querySelector('#desk-list button[data-filter="' + name + '"]'); };
  var def = null;
  (spirit.shell = spirit.shell || {}).activateApp = function (d) { def = d; };
  return Promise.resolve(spirit.start()).then(function () { return spirit.require('shell/desk/desk.js'); }).then(function () {
    def.mount(document.getElementById('app-content'), T.api);
    return T.wait(2500);
  }).then(function () { return { mounted: !!document.getElementById('desk-list') }; });
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
      const src = '(' + String(fn) + ')()';
      const out = await page.evaluate('Promise.resolve(' + src + ').then(function (v) { return JSON.stringify(v === undefined ? null : v); }, function (e) { return JSON.stringify({ error: String(e && e.stack || e) }); })');
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

test.startTest('desk/G2.6: the List paints only what the desk server says');

(async function () {
  await browser(async function (run) {
    const w = await run(WORLD);
    if (!w || !w.mounted) { test.fail('the world: the Desk page did not mount: ' + short(w)); return; }

    test.subHeading('on open: one items.search, current goal on, goals only off');
    const first = await run(function () { return { searches: T.searches(), listens: T.published.length }; });
    const s0 = first.searches || [];
    if (s0.length === 1 && s0[0].args.text === '' && s0[0].args.currentGoalOnly === true && s0[0].args.goalsOnly === false) {
      test.check('it asked items.search {text: \'\', currentGoalOnly: true, goalsOnly: false} once');
    } else test.fail(OWED + 'on open it asked items.search ' + s0.length + ' times: ' + short(s0.map(function (s) { return s.args; })));
    if (first.listens > 0) test.check('it listens with api.onPublished');
    else test.fail(OWED + 'the List does not listen with api.onPublished');

    test.subHeading('rows, buttons and links come from the labels');
    const rows = await run(function () { return { alpha: T.rowHtml('Alpha'), beta: T.rowHtml('Beta') }; });
    if (/data-press="go"/.test(rows.alpha) && /data-id="goal\/G100\.1"/.test(rows.alpha)) test.check('Alpha, buttons [go], shows a Go! press for goal/G100.1');
    else test.fail(OWED + 'Alpha\'s row: ' + short(rows.alpha));
    if (/data-press="close"/.test(rows.beta) && !/data-press="go"/.test(rows.beta)) test.check('Beta, done, shows Close and no Go!');
    else test.fail(OWED + 'Beta\'s row: ' + short(rows.beta));
    // desk/G3.6, Andy: Reopen is never shown in the List; the dialog keeps it. The server still offers it.
    if (rows.beta && !/data-press="reopen"/.test(rows.beta)) test.check('and no Reopen: the List never shows it (desk/G3.6)');
    else test.fail('OWED by desk/G3.6: the List shows Reopen on Beta, or no Beta: ' + short(rows.beta));
    if (/data-open="goal\/G100\.2"/.test(rows.alpha)) test.check('Alpha\'s blocking id links to its item');
    else test.fail(OWED + 'Alpha\'s blocking is not a data-open link: ' + short(rows.alpha));

    test.subHeading('a press goes to the server as a press, and the row waits for the publish');
    const pressed = await run(function () {
      var b = T.row('Alpha') && T.row('Alpha').querySelector('[data-press="go"]');
      if (!b) return { error: 'no Go! in Alpha\'s row' };
      b.click();
      return T.wait(400).then(function () { return { presses: T.presses(), alpha: T.rowHtml('Alpha'), posted: T.posted, lines: T.asked.filter(function (a) { return a.name === 'desk.chat.add'; }) }; });
    });
    const p = (pressed.presses || [])[0];
    if (p && p.args.id === 'goal/G100.1' && p.args.what === 'go' && !('by' in p.args)) test.check('Go! sends press {id: goal/G100.1, what: go}, no by (apiAuth/G1.13)');
    else test.fail(OWED + 'Go! sent ' + short(pressed));
    if (/data-press="go"/.test(pressed.alpha || '')) test.check('until the server publishes, Alpha still shows Go!');
    else test.fail(OWED + 'the row changed before the server published: ' + short(pressed.alpha));
    // goal/G3.8: the page posts no nudge; the desk server reaches the agents by its stream (goal/G33.4).
    if (p && !(pressed.posted || []).length && !(pressed.lines || []).length) test.check('the press went as a press: no packet posted, no nudge, no "go." line (goal/G3.8)');
    else test.fail(OWED + 'beside the press the page posted ' + short({ posted: pressed.posted, lines: pressed.lines }));

    test.subHeading('it repaints from what the server publishes, and asks nothing more');
    const after = await run(function () {
      var L = function (o) { return JSON.parse(T.label(o)); };
      T.publish({ change: 12, verb: 'press', item: L({ status: 'running', buttons: [] }) });
      T.publish({ change: 13, verb: 'item.rename', item: L({ title: 'Alpha renamed', status: 'running', buttons: [] }) });
      return T.wait(500).then(function () {
        var renamed = T.rowHtml('Alpha renamed');
        T.publish({ change: 14, verb: 'press', item: L({ id: 'goal/G100.2', title: 'Beta', status: 'closed', buttons: [] }) });
        return T.wait(500).then(function () { return { renamed: renamed, beta: T.rowHtml('Beta'), searches: T.searches().length }; });
      });
    });
    if (after.renamed && !/data-press="go"/.test(after.renamed)) test.check('a published press and rename repaint Alpha: new title, no Go!');
    else test.fail(OWED + 'after the publishes Alpha\'s row: ' + short(after.renamed));
    if (!after.beta) test.check('a published close takes Beta off the List');
    else test.fail(OWED + 'Beta is still on the List after its close was published: ' + short(after.beta));
    if (after.searches === s0.length) test.check('no pulling: the publishes asked no items.search');
    else test.fail(OWED + 'the publishes asked items.search ' + (after.searches - s0.length) + ' more times');
    // A NEW ITEM IS DRAWN FROM THE PUBLISH (goal/G24.6, Andy: "no pulling"): a row of the current goal the List does not
    // hold is drawn from what the publish carries, and nothing is asked.
    const added = await run(function () {
      var before = T.searches().length;
      T.publish({ change: 14.5, verb: 'item.add', item: JSON.parse(T.label({ id: 'goal/G100.9', title: 'NEW-ON-THE-LIST' })) });
      return T.wait(500).then(function () { return { shown: !!T.row('NEW-ON-THE-LIST'), asked: T.searches().length - before }; });
    });
    if (added.shown && added.asked === 0) test.check('a publish for an item not on the List draws its row from the publish, and asks nothing (goal/G24.6)');
    else test.fail('OWED by goal/G24.6: a publish for a new item: shown ' + added.shown + ', searches ' + added.asked);
    const session = await run(function () {
      var before = T.searches().length;
      T.publish({ change: 15, verb: 'session.set', item: null });
      return T.wait(500).then(function () { return { asked: T.searches().length - before }; });
    });
    if (session.asked === 1) test.check('a published session.set asks items.search again, once');
    else test.fail(OWED + 'after a session.set publish items.search was asked ' + session.asked + ' times');

    test.subHeading('the search words and the two toggles go to the server');
    const typed = await run(function () {
      var box = document.querySelector('#desk-list input[type="text"]');
      if (!box) return { error: 'no search box in the List' };
      var before = T.searches().length;
      box.value = 'bet';
      box.dispatchEvent(new Event('input', { bubbles: true }));
      return T.wait(1200).then(function () { return { asked: T.searches().slice(before).map(function (s) { return s.args; }) }; });
    });
    if ((typed.asked || []).some(function (a) { return a.text === 'bet' && a.currentGoalOnly === true && a.goalsOnly === false; })) test.check('typing asks items.search {text: bet} with the toggles as they stand');
    else test.fail(OWED + 'typing asked ' + short(typed));
    const goals = await run(function () {
      var b = T.filter('goalsOnly');
      if (!b) return { error: 'no [Goals Only] button' };
      var before = T.searches().length;
      b.click();
      return T.wait(1200).then(function () { return { asked: T.searches().slice(before).map(function (s) { return s.args; }) }; });
    });
    if ((goals.asked || []).some(function (a) { return a.goalsOnly === true && a.text === 'bet'; })) test.check('Goals Only asks items.search {goalsOnly: true}, the words kept');
    else test.fail(OWED + 'Goals Only asked ' + short(goals));
    const current = await run(function () {
      var b = T.filter('current');
      if (!b) return { error: 'no [Current Goal Only] button' };
      var before = T.searches().length;
      b.click();
      return T.wait(1200).then(function () { return { asked: T.searches().slice(before).map(function (s) { return s.args; }) }; });
    });
    // The two are exclusive (goal/G9.2, goal/G43.3): Goals Only above turned Current Goal Only off, so this press turns it
    // back on and Goals Only off.
    const last = (current.asked || []).slice(-1)[0] || {};
    if (last.currentGoalOnly === true && last.goalsOnly === false) test.check('Current Goal Only toggles back on, and Goals Only off');
    else test.fail(OWED + 'Current Goal Only asked ' + short(current));

    // desk/G3.4, Andy: "i should have a go-all button for fixing rounds", "the go all should be on the right side of
    // the button bar in list", "and be the armed-type": #desk-go-all in the bar on the List tab, never in a row, while the
    // goal row's buttons offer it; it sends press {id: <goal>, what: 'go-all'}.
    test.subHeading('desk/G3.4: Go all sits in the bar while the goal offers it, armed');
    const G34 = 'OWED by desk/G3.4: ';
    const bar = await run(function () {
      T.publish({ change: 16, verb: 'press', item: JSON.parse(T.label({ id: 'goal/G100', title: 'The goal', goal: '', buttons: ['go-all'], blocking: [], blocked: [], waiting: 2 })) });
      return T.wait(600).then(function () {
        var b = document.getElementById('desk-go-all');
        var shown = !!b && !b.hidden;
        var inRow = /data-press="go-all"/.test(T.rowHtml('The goal'));
        var before = T.presses().length;
        if (!b) return { shown: false };
        b.click();
        return T.wait(300).then(function () {
          var first = T.presses().length - before;
          var armed = b.textContent;
          b.click();
          return T.wait(300).then(function () { return { shown: shown, inRow: inRow, first: first, armed: armed, sent: T.presses().slice(before).map(function (s) { return s.args; }) }; });
        });
      });
    });
    if (bar.shown && !bar.inRow) test.check('#desk-go-all shows in the bar, and the goal row draws no go-all');
    else test.fail(G34 + 'go-all shown in the bar ' + bar.shown + ', in the goal row ' + bar.inRow);
    const sent = bar.sent || [];
    if (bar.first === 0 && sent.length === 1 && sent[0].id === 'goal/G100' && sent[0].what === 'go-all' && !('by' in sent[0])) test.check('the first press arms it ("' + bar.armed + '"); the second sends press {id: goal/G100, what: go-all}, no by (apiAuth/G1.13)');
    else test.fail(G34 + 'Go all: sent after one press ' + bar.first + ', after two ' + short(sent));
    const hid = await run(function () {
      T.publish({ change: 17, verb: 'press', item: JSON.parse(T.label({ id: 'goal/G100', title: 'The goal', goal: '', buttons: [], blocking: [], blocked: [], waiting: 2 })) });
      return T.wait(600).then(function () { var b = document.getElementById('desk-go-all'); return { hidden: !b || b.hidden }; });
    });
    if (hid.hidden) test.check('once the goal no longer offers it, Go all hides');
    else test.fail(G34 + 'Go all still shows after the goal stopped offering it');
  });

  test.subHeading('one piece of code: the List keeps no rule of its own');
  const src = code(DESK);
  const own = ['deskGoState', 'deskReady', 'deskVerified', 'deskDone', 'READY TO CLOSE', 'fresh.get'].filter(function (w) { return src.indexOf(w) !== -1; });
  if (!own.length) test.check('shell/desk/desk.js has no deskGoState, deskReady, deskVerified, deskDone, READY TO CLOSE rule or fresh.get');
  else test.fail(OWED + 'shell/desk/desk.js still has ' + own.join(', '));
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
