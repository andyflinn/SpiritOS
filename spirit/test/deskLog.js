'use strict';

// DESK'S RECORD IS THE DESK SERVER'S, AND THE NODE IS ASKED NOTHING ELSE.
//
//   Andy, 2026-09-27, on node.history, a verb added to the node for one
//   app without review: "after correcting agents and desk, we will remove
//   the new verb."
//
// goal/G43.23: the checks 885f1ab5 trimmed, of how Desk draws its board, are back, rewritten on today's harness: its
// fake page had no spirit.require. The page is now the real one: a scratch node, headless Chrome, the Desk page loaded
// by spirit.require into the home page's app area (spirit/run/test/headLessChrome.js), on a desk that is a stand-in
// answering the reads and recording every ask.
//
// What this suite holds:
//
//   - neither Desk nor DeskDetails names a verb but its servers' (desk.,
//     deskVerify., backup.), and neither names node.history;
//   - an arrival of an agents packet is recorded nowhere (no log row, no
//     log.add, goal/G33.4), nothing is posted, the node is asked nothing
//     but its servers' verbs, and a fresh mount draws the board from the
//     server's record alone, asking nothing of goal/G0 (goal/G43.22);
//   - what needs his eye on a row is drawn only when the server says so:
//     the red ! of an alert row (goal/G33.8, box v13, Andy: "it's enough
//     to put a red ! next to the item"), which took the red * 's place;
//   - a Desk whose server does not answer says it could not read.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const H = require('../run/test/headLessChrome.js');

const APP_DIR = path.join(__dirname, '..', 'run', 'shell');
const DESK = path.join(APP_DIR, 'desk', 'desk.js');
const DETAILS = path.join(APP_DIR, 'deskDetails', 'deskDetails.js');
// A verb of one of Desk's servers, by its name on the flat apiDoor (goal/G30.6); the family is the part before the dot.
const SERVER_VERB = /^(desk|deskVerify|backup)\./;
const PAGE = '/DEBUG/shell/desk/test/desk-opened.html';
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

test.startTest('Desk — its record, through the desk server, and nothing else asked of the node');

// Desk reaches its record through its servers (desk/G1.4, D4), by each
// verb's name on the flat apiDoor (goal/G30.6: desk.<verb>, and beside it
// deskVerify.<verb> and backup.<verb>), and those are the only verbs it may
// name; the node's own history it never asks for.
test.subHeading('Desk and its dialog name only their servers\' verbs (desk/G2.7), and never node.history');
[DESK, DETAILS].forEach(function (f) {
  const src = fs.readFileSync(f, 'utf8');
  const code = src.split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n');
  const named = (code.match(/\.verb\(\s*'([^']*)'/g) || []).map(function (m) { return m.replace(/^\.verb\(\s*'|'$/g, ''); });
  const allowed = named.every(function (v) { return SERVER_VERB.test(v); }) && named.length > 0;
  if (allowed && !/node\.history/.test(code)) {
    test.check(path.basename(f) + ' names only its servers\' verbs (' + named.join(', ') + '), and never node.history outside a comment');
  } else {
    test.fail(path.basename(f) + ' asks the node for ' + JSON.stringify(named) + (/node\.history/.test(code) ? ' and names node.history' : ''));
  }
});

// ── THE WORLD, IN THE PAGE ───────────────────────────────────────────────────────────────────────────────────────────
// window.T: the api the shell hands an app, every ask recorded, every packet subscription and post too; its desk a
// stand-in answering items.search with the board below (o.alert marks its item), or, o.dead, the node's refusal of a
// server that is not running. The Desk page mounted through spirit.require, as the shell mounts it.
const WORLD = function (o) {
  var T = window.T = { asked: [], packets: [], posted: [] };
  var row = function (x) { return Object.assign({ id: 'goal/G100.1', title: 'Search', goal: 'goal/G100', status: 'running', with: '', buttons: [], blocking: [], blocked: [], asks: 0, alert: false, names: {} }, x || {}); };
  var rows = [row({ id: 'goal/G100', title: 'Puppets', goal: '', design: false, waiting: 0, live: [] }), row({ alert: !!o.alert })];
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  T.api = {
    escapeHtml: esc, setScreenTitle: function () {}, closeDialog: function () {}, onFiles: function () {}, armUntilElsewhere: function () {},
    callDialog: function () { return new Promise(function () {}); }, onPublished: function () { return function () {}; },
    onPacket: function (app, fn) { T.packets.push({ app: app, fn: fn }); return function () {}; },
    peerPost: function (app, to, body) { T.posted.push({ app: app, to: to, body: body }); return Promise.resolve({ ok: true, status: 200, hash: 'h-out' }); },
    verb: function (n, a) {
      T.asked.push({ name: String(n), args: JSON.parse(JSON.stringify(a || {})) });
      if (o.dead) return Promise.resolve({ status: 503, body: { ok: false, code: 'app-not-running', error: 'the app server is not running' } });
      if (n === 'desk.items.search') return Promise.resolve({ status: 200, body: { items: rows.map(function (r) { return { key: r.id, label: JSON.stringify(r) }; }), more: false } });
      return Promise.resolve({ status: 200, body: { ok: true, items: [], more: false } });
    },
  };
  T.wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  T.board = function () { var t = document.getElementById('desk-top'); return t ? t.textContent : ''; };
  T.row = function (title) {
    var list = document.getElementById('desk-list');
    return Array.prototype.filter.call(list ? list.querySelectorAll('tr') : [], function (tr) { return tr.textContent.indexOf(title) !== -1 && !tr.querySelector('tr'); })[0] || null;
  };
  var def = null;
  (spirit.shell = spirit.shell || {}).activateApp = function (d) { def = d; };
  return Promise.resolve(spirit.start()).then(function () { return spirit.require('shell/desk/desk.js'); }).then(function () {
    def.mount(document.getElementById('app-content'), T.api);
    return T.wait(2500);
  }).then(function () { return { mounted: !!document.getElementById('desk-top') }; });
};

// CHROME STARTS WITH THE REAL USERPROFILE: testSupport makes the suite's home a temp folder (HOME and USERPROFILE), and on
// Windows Chrome then gives no debugging address at all. Its profile is a scratch one either way (--user-data-dir).
async function chromeWithItsHome(chrome) {
  const was = process.env.USERPROFILE;
  if (process.env.SPIRIT_REAL_HOME) process.env.USERPROFILE = process.env.SPIRIT_REAL_HOME;
  try { return await H.chromePage(chrome); } finally { process.env.USERPROFILE = was; }
}
// The page, driven: one scratch node, one Chrome; mount(o) opens the page afresh and mounts Desk in its world.
async function browser(body) {
  const chrome = H.findChrome();
  if (!chrome) { test.fail('no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name'); return; }
  const node = await H.scratchNode();
  let page = null;
  try {
    page = node.up && node.debug ? await chromeWithItsHome(chrome) : null;
    if (!page || page.error) { test.fail(page ? page.error : 'the scratch node did not come up with its DEBUG on'); return; }
    const run = async function (fn, arg) {
      const out = await page.evaluate('Promise.resolve((' + String(fn) + ')(' + JSON.stringify(arg === undefined ? null : arg) + ')).then(function (v) { return JSON.stringify(v === undefined ? null : v); }, function (e) { return JSON.stringify({ error: String(e && e.stack || e) }); })');
      try { return JSON.parse(out); } catch (e) { return { error: 'no answer: ' + String(out) }; }
    };
    const mount = async function (o) {
      await page.evaluate('window.__left = true');
      await page.send('Page.navigate', { url: node.base + PAGE });
      await H.until(function () { return page.evaluate('!window.__left && document.readyState === "complete" && !!window.spirit && typeof spirit.require === "function"').then(Boolean); }, H.WAIT);
      return run(WORLD, o || {});
    };
    await body(run, mount);
  } finally {
    if (page && page.kid) page.kid.kill();
    if (node.child) node.child.kill();
    try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
  }
}

(async function () {
  await browser(async function (run, mount) {
    // goal/G33.4 (Andy: "log.add, log.search and pending.get: delete them."): the page keeps no log of the agents app's
    // packets: an arrival is recorded nowhere. A page that takes no packet at all records none.
    test.subHeading('An arrival is recorded nowhere; a fresh mount reads the board from the server alone');
    const m = await mount({});
    if (!m || !m.mounted) { test.fail('the world: the Desk page did not mount: ' + short(m)); return; }
    const arrived = await run(function () {
      var heard = T.packets.filter(function (p) { return p.app === 'agents'; });
      heard.forEach(function (p) { p.fn({ from: 'claude-windows', kind: 'session', text: '{}' }, { hash: 'h-in-1', fromKey: 'MCowBQYDK2VwAyEAlead=', sentAt: '2026-09-27T05:00:00Z' }); });
      return T.wait(500).then(function () {
        return { subscribed: heard.length, logAdd: T.asked.filter(function (a) { return a.name === 'desk.log.add'; }).length, posted: T.posted,
          others: T.asked.map(function (a) { return a.name; }).filter(function (n) { return !/^(desk|deskVerify|backup)\./.test(n); }) };
      });
    });
    if (!arrived.logAdd) test.check('an arrival is recorded nowhere: no log.add' + (arrived.subscribed ? '' : ' (the page takes no agents packet at all)') + ' (goal/G33.4)');
    else test.fail('goal/G33.4: after one arrival log.add was asked ' + arrived.logAdd + ' time(s)');
    if (!(arrived.posted || []).length) test.check('nothing was posted as a packet');
    else test.fail('posts ' + short(arrived.posted));
    if (!(arrived.others || []).length) test.check('the node was asked nothing but its servers\' verbs by name');
    else test.fail('verbs asked: ' + (arrived.others || []).join(', '));

    await mount({});
    const again = await run(function () {
      return { board: T.board(), g0: T.asked.some(function (a) { return a.args && (a.args.id === 'goal/G0' || a.args.goal === 'goal/G0'); }) };
    });
    // Since goal/G43.22 nothing asks goal/G0.
    if (!again.g0 && /Search/.test(again.board || '')) test.check('a fresh mount draws the board from the server\'s record alone, and asks nothing of goal/G0');
    else test.fail('remount asked goal/G0: ' + again.g0 + '; drew ' + short(again.board));

    // What needs his eye is the server's to say (desk/G2.6), drawn as the red ! beside the item (goal/G33.8, box v13).
    test.subHeading('The red ! is drawn only when the server says so');
    const quiet = await run(function () { var r = T.row('Search'); return { row: !!r, mark: !!(r && r.querySelector('[data-alert-mark]')) }; });
    if (quiet.row && !quiet.mark) test.check('no mark while the server says none');
    else test.fail('with no alert said: ' + short(quiet));
    await mount({ alert: true });
    const loud = await run(function () { var r = T.row('Search'); return { row: !!r, mark: !!(r && r.querySelector('[data-alert-mark]')) }; });
    if (loud.row && loud.mark) test.check('the red ! beside the item the server marks alert');
    else test.fail('with alert said: ' + short(loud));

    // A record Desk cannot reach is said, and never drawn as an empty board.
    test.subHeading('A Desk whose server does not answer says so');
    await mount({ dead: true });
    const dead = await run(function () { return { board: T.board() }; });
    if (/could not read/.test(dead.board || '')) test.check('Desk says it could not read its record');
    else test.fail('Desk drew ' + short(dead.board));
  });
})().catch(function (err) { test.fail('deskLog threw: ' + ((err && err.stack) || err)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});

module.exports = test;
