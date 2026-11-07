'use strict';

// spirit/test/deskDialog.js
// goal/G43.23: the checks 885f1ab5 trimmed are back, rewritten on today's harness. Its fake page had no
// spirit.require and no document.createElement, so the run broke ("TypeError: document.createElement is not a
// function") before the dialog drew its workBench. The page is now the real one: a scratch node, headless Chrome, the item
// dialog loaded by spirit.require into the home page's app area (spirit/run/test/headLessChrome.js), on a desk that is a
// stand-in answering the reads and recording every ask. Each dialog is opened on a page of its own.
//
// desk/G2.7: the item dialog paints only what the desk server says.
// Andy: "I want one box only." "All other text-output-boxes are removed." "no pulling". "a press shouldn't post a
// line, it is not textual information." The yellow strip "should only be offered when the agents claim 'done'".
// The goal's abandon: "a red, arming-button ... with are-you-sure", "at the very right of the button row".
// The contract deskDetails.js keeps:
//   open({id}) asks the desk server item.get {id} once, through api.verb('desk.item.get', {id}) (goal/G30.6), and
//   paints its answer; the title rides in the shell's title bar (goal/G9.6). After that it asks nothing: it repaints
//   from api.onPublished objects, named for the desk server: {change, verb, item: <facts>} for the item, and its side
//   rows {change, table: 'box'|'chat', id, row} (goal/G33.4).
//   Buttons come from item.buttons only. A press goes to the server as press {id, what} (no by since apiAuth/G1.13);
//   the screen does not change until the server publishes. A C check is ticked by pressing it: check.set {id, check,
//   state: 'passed'}. The yellow strip is gone (goal/G30.8): the C checks are in the red Qs' panel (❌), each a button.
//   On a goal, dd-abandon arms on the first press and sends press abandon on the second; so does dd-go-all (desk/G3.7).
//   No #dd-blurb, no #dd-decide; no ready flag, go rule or local done in deskDetails.js.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const H = require('../run/test/headLessChrome.js');

const OWED = 'OWED by desk/G2.7: ';
const DETAILS = path.join(__dirname, '..', 'run', 'shell', 'deskDetails', 'deskDetails.js');
const PAGE = '/DEBUG/shell/deskDetails/test/deskDetails-opened.html';

function code(file) { return fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1'); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

// ── THE WORLD, IN THE PAGE ───────────────────────────────────────────────────────────────────────────────────────────
// window.T: the api the shell hands an app, its desk a stand-in answering one item and recording every ask, every
// subscription and the title bar; T.open(over, extra) mounts the dialog through spirit.require and opens the item.
const WORLD = function () {
  var T = window.T = { asked: [], published: [], servers: [], titles: [] };
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  T.facts = function (over) {
    return Object.assign({ id: 't/G1.2', title: 'Beta', goal: 't/G1', status: 'running', with: 'wsl-claude', buttons: ['done'], blocking: ['t/G1'], blocked: [], names: {} }, over || {});
  };
  T.wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  T.tool = function (k) { return document.querySelector('[data-side="left"][data-tool="' + k + '"]'); };
  T.press = function (k) { var b = T.tool(k); if (!b) return Promise.resolve(false); if (!b.hasAttribute('data-current')) b.click(); return T.wait(700).then(function () { return true; }); };
  T.of = function (verb) { return T.asked.filter(function (a) { return a.name === 'desk.' + verb; }); };
  T.has = function (id) { return !!document.getElementById(id); };
  T.boxText = function () {
    var cm = document.querySelector('#dd-panel .CodeMirror');
    if (cm && cm.CodeMirror) return cm.CodeMirror.getValue();
    var t = document.getElementById('dd-box-input');
    return t ? t.value : '';
  };
  // What he sees: the dialog's text and the title bar.
  T.page = function () { return document.getElementById('app-content').textContent + '\n' + (T.titles[T.titles.length - 1] || ''); };
  T.publish = function (o) { T.published.forEach(function (fn) { fn(o); }); };
  T.open = function (over, extra) {
    var facts = T.facts(over);
    var x = Object.assign({ checks: [{ number: 'C1', kind: 'C', words: 'LOOK-AT-IT', test: '', state: 'open', by: '', at: '' }],
      chat: [{ by: 'wsl-claude', at: '2026-09-30T15:00:00Z', text: 'CHAT-HELLO' }] }, extra || {});
    var api = {
      escapeHtml: esc, closeDialog: function () {}, armUntilElsewhere: function () {},
      setScreenTitle: function (t) { T.titles.push(String(t)); },
      onPublished: function (fn, server) { T.published.push(fn); T.servers.push(server); return function () {}; },
      verb: function (n, a) {
        T.asked.push({ name: n, args: JSON.parse(JSON.stringify(a || {})) });
        var b = { ok: true, change: 1 };
        if (n === 'desk.item.get') b = { item: JSON.stringify(facts), version: 2, change: 7 };
        if (n === 'desk.item.box') b = { box: 'BOX-TEXT', version: 2 };
        if (n === 'desk.item.checks') b = { checks: x.checks };
        if (n === 'desk.item.chat') b = { chat: x.chat };
        if (n === 'desk.item.files') b = { files: [], filesMore: false };
        return Promise.resolve({ status: 200, body: b });
      },
    };
    var def = null;
    (spirit.shell = spirit.shell || {}).activateApp = function (d) { def = d; };
    return spirit.require('shell/deskDetails/deskDetails.js').then(function () {
      def.mount(document.getElementById('app-content'), api);
      return def.open({ id: facts.id });
    }).then(function () { return T.wait(1500); }).then(function () { return { opened: T.has('dd-body') }; });
  };
  // A two-press button of the dialog: what it asked after one press, and after two.
  T.twice = function (id, verb) {
    var b = document.getElementById(id);
    if (!b) return Promise.resolve({ error: 'no #' + id });
    var before = T.of(verb).length;
    b.click();
    return T.wait(300).then(function () {
      var first = T.of(verb).length - before;
      (document.getElementById(id) || b).click();
      return T.wait(400).then(function () { return { first: first, sent: T.of(verb).slice(before).map(function (a) { return a.args; }) }; });
    });
  };
};

// CHROME STARTS WITH THE REAL USERPROFILE: testSupport makes the suite's home a temp folder (HOME and USERPROFILE), and on
// Windows Chrome then gives no debugging address at all. Its profile is a scratch one either way (--user-data-dir).
async function chromeWithItsHome(chrome) {
  const was = process.env.USERPROFILE;
  if (process.env.SPIRIT_REAL_HOME) process.env.USERPROFILE = process.env.SPIRIT_REAL_HOME;
  try { return await H.chromePage(chrome); } finally { process.env.USERPROFILE = was; }
}
// The page, driven: one scratch node, one Chrome; open() opens the page afresh with its world, run(fn) runs fn in it.
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
    const open = async function (over, extra) {
      await page.evaluate('window.__left = true');
      await page.send('Page.navigate', { url: node.base + PAGE });
      await H.until(function () { return page.evaluate('!window.__left && document.readyState === "complete" && !!window.spirit && typeof spirit.require === "function"').then(Boolean); }, H.WAIT);
      await run(WORLD);
      return run(function (a) { return T.open(a.over, a.extra); }, { over: over || null, extra: extra || null });
    };
    await body(run, open);
  } finally {
    if (page && page.kid) page.kid.kill();
    if (node.child) node.child.kill();
    try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
  }
}

test.startTest('desk/G2.7: the item dialog paints only what the desk server says');

(async function () {
  await browser(async function (run, open) {
    const o = await open();
    if (!o || !o.opened) { test.fail('the world: the dialog did not open: ' + short(o)); return; }

    test.subHeading('it asks item.get once, and paints its answer');
    const p0 = await run(function () {
      return { gets: T.of('item.get').map(function (a) { return a.args; }), page: T.page(), box: T.boxText(), blurb: T.has('dd-blurb'), decide: T.has('dd-decide'),
        listens: T.published.length, servers: T.servers, done: T.has('dd-done'), go: T.has('dd-go'), strip: T.has('dd-strip') };
    });
    if ((p0.gets || []).length === 1 && p0.gets[0].id === 't/G1.2') test.check('open asked item.get {id} once');
    else test.fail(OWED + 'open asked item.get ' + short(p0.gets));
    if (p0.box === 'BOX-TEXT' && /CHAT-HELLO/.test(p0.page) && /Beta/.test(p0.page)) test.check('the box, the chat and the title are painted');
    else test.fail(OWED + 'the page does not show the server\'s box, chat and title: ' + short({ box: p0.box, page: String(p0.page).slice(-200) }));
    if (!p0.blurb && !p0.decide) test.check('no explanation box and no lower box');
    else test.fail(OWED + 'the dialog still has #dd-blurb or #dd-decide');
    if (p0.listens > 0) test.check('it listens with api.onPublished');
    else test.fail(OWED + 'the dialog does not subscribe with api.onPublished');
    // The shell hands a server's changes to the app of its own name, so the dialog must name the desk server, or it
    // never hears a change.
    if ((p0.servers || []).indexOf('desk') !== -1) test.check('it listens to the desk server by name');
    else test.fail('the dialog listens as itself, so the desk server\'s changes never reach it: ' + short(p0.servers));

    test.subHeading('buttons come from item.buttons; the C checks are in the red Qs\' panel');
    if (p0.done && !p0.go) test.check('buttons [done]: Done shows, Go! does not');
    else test.fail(OWED + 'with buttons [done] the page has done ' + p0.done + ', go ' + p0.go);
    if (!p0.strip && !/LOOK-AT-IT/.test(p0.page)) test.check('no yellow strip: the C checks are not on the page while the box is shown');
    else test.fail('goal/G30.8: the yellow strip or its C1 is still on the box\'s page');
    const qs = await run(function () {
      return T.press('qs').then(function (ok) {
        var b = document.querySelector('#dd-panel button[data-check="C1"]');
        return { ok: ok, button: !!b, label: b ? b.textContent : '', line: b && b.parentNode ? b.parentNode.textContent : '' };
      });
    });
    if (qs.button && /C1/.test(qs.label) && /LOOK-AT-IT/.test(qs.line)) test.check('the red Qs\' panel lists the C checks, each a button to press');
    else test.fail(OWED + 'the red Qs\' panel does not show C1 as a button: ' + short(qs));

    test.subHeading('a press goes to the server, and the screen waits for it');
    const pressed = await run(function () {
      document.getElementById('dd-done').click();
      return T.wait(400).then(function () {
        var p = T.of('press').map(function (a) { return a.args; });
        var stays = T.has('dd-done');
        var c = document.querySelector('#dd-panel button[data-check="C1"]');
        if (c) c.click();
        return T.wait(400).then(function () { return { press: p, stays: stays, ticked: T.of('check.set').map(function (a) { return a.args; }) }; });
      });
    });
    const pr = (pressed.press || [])[0];
    if (pr && pr.id === 't/G1.2' && pr.what === 'done' && pr.by === undefined) test.check('Done sends press {id, what: done}, no by (apiAuth/G1.13)');
    else test.fail(OWED + 'Done sent ' + short(pressed.press));
    if (pressed.stays) test.check('until the server publishes, the page still shows Done');
    else test.fail(OWED + 'the page changed before the server published');
    const tk = (pressed.ticked || [])[0];
    if (tk && tk.check === 'C1' && tk.state === 'passed' && tk.by === undefined) test.check('pressing C1 sends check.set {check: C1, state: passed}, no by (apiAuth/G1.13)');
    else test.fail(OWED + 'pressing C1 sent ' + short(pressed.ticked));

    test.subHeading('it repaints from what the server publishes, and asks nothing more');
    const p1 = await run(function () {
      T.publish({ change: 8, verb: 'press', item: T.facts({ buttons: ['close', 'reopen'], status: 'done' }) });
      return T.wait(400).then(function () { return { reopen: T.has('dd-reopen'), done: T.has('dd-done') }; });
    });
    if (p1.reopen && !p1.done) test.check('a published done repaints: Reopen, no Done');
    else test.fail(OWED + 'after the publish: reopen ' + p1.reopen + ', done ' + p1.done);
    // goal/G33.4: each changed row is its own publish; the box and the chat line are side rows of the item.
    const p2 = await run(function () {
      return T.press('box').then(function () {
        T.publish({ change: 9, verb: 'box.write', item: T.facts({ buttons: ['close', 'reopen'], status: 'done' }) });
        T.publish({ change: 9, table: 'box', goal: 1, item: 2, id: 't/G1.2', row: { version: 3, text: 'NEW-BOX', by: 'andy', at: '2026-09-30T15:04:00Z' } });
        T.publish({ change: 10, verb: 'chat.add', item: T.facts({ buttons: ['close', 'reopen'], status: 'done' }) });
        T.publish({ change: 10, table: 'chat', goal: 1, item: 2, id: 't/G1.2', row: { by: 'wsl-claude', at: '2026-09-30T15:05:00Z', text: 'CHAT-NEW' } });
        return T.wait(600).then(function () { return { box: T.boxText(), page: T.page() }; });
      });
    });
    if (p2.box === 'NEW-BOX' && /CHAT-NEW/.test(p2.page)) test.check('a published box and chat line are painted as they come');
    else test.fail(OWED + 'after publishing a box and a chat line: box ' + short(p2.box) + ', chat ' + /CHAT-NEW/.test(p2.page || ''));
    const p3 = await run(function () {
      T.publish({ change: 11, verb: 'item.rename', item: T.facts({ id: 't/G1.9', title: 'SOMEONE-ELSE' }) });
      return T.wait(400).then(function () { return { other: /SOMEONE-ELSE/.test(T.page()), gets: T.of('item.get').length }; });
    });
    if (!p3.other) test.check('another item\'s publish does not repaint this one');
    else test.fail(OWED + 'another item\'s publish repainted this dialog');
    if (p3.gets === 1) test.check('no pulling: item.get was asked once, only at open');
    else test.fail(OWED + 'item.get was asked ' + p3.gets + ' times');

    test.subHeading('the goal\'s abandon arms first, then goes');
    await open({ id: 't/G1', title: 'The goal', goal: '', buttons: [] }, { checks: [], chat: [] });
    const ab = await run(function () { var has = T.has('dd-abandon'); return T.twice('dd-abandon', 'press').then(function (r) { r.has = has; return r; }); });
    if (ab.has) test.check('the goal offers dd-abandon');
    else test.fail(OWED + 'the goal has no dd-abandon');
    const abandon = (ab.sent || []).filter(function (a) { return a.what === 'abandon'; });
    if (ab.first === 0 && abandon.length === 1 && abandon[0].id === 't/G1' && abandon[0].by === undefined) test.check('the first press arms, the second sends press abandon');
    else test.fail(OWED + 'abandon: after one press ' + ab.first + ' sent, after two ' + short(ab.sent));
    await open();
    const noAb = await run(function () { return { has: T.has('dd-abandon') }; });
    if (!noAb.has) test.check('an item that is not a goal offers no abandon');
    else test.fail(OWED + 'an item offers dd-abandon');

    // desk/G3.7, Andy: "the goal-detail panel could offer the go-all button if there is any go-able items". The goal's
    // facts say when (go-all in its buttons, desk/G3.4); the dialog draws #dd-go-all, armed like abandon. An item never
    // draws it.
    test.subHeading('desk/G3.7: the goal dialog offers Go all while the goal does, armed');
    const G37 = 'OWED by desk/G3.7: ';
    await open({ id: 't/G1', title: 'The goal', goal: '', buttons: ['go-all'] }, { checks: [], chat: [] });
    const ga = await run(function () { var has = T.has('dd-go-all'); return T.twice('dd-go-all', 'press').then(function (r) { r.has = has; return r; }); });
    if (ga.has) test.check('the goal, offering go-all, draws dd-go-all');
    else test.fail(G37 + 'the goal dialog draws no dd-go-all');
    const goAll = (ga.sent || []).filter(function (a) { return a.what === 'go-all'; });
    if (ga.first === 0 && goAll.length === 1 && goAll[0].id === 't/G1' && goAll[0].by === undefined) test.check('the first press arms it, the second sends press go-all on the goal');
    else test.fail(G37 + 'Go all: after one press ' + ga.first + ' sent, after two ' + short(ga.sent));
    await open({ buttons: ['go'] });
    const item = await run(function () { return { goAll: T.has('dd-go-all'), go: T.has('dd-go'), page: T.page() }; });
    if (!item.goAll) test.check('an item draws no dd-go-all');
    else test.fail(G37 + 'an item draws dd-go-all');
    if (item.go && !/LOOK-AT-IT/.test(item.page)) test.check('buttons [go]: Go! shows, and no strip before a claim');
    else test.fail(OWED + 'with buttons [go]: go ' + item.go + ', strip ' + /LOOK-AT-IT/.test(item.page || ''));
  });

  test.subHeading('one piece of code: the dialog keeps no rule of its own');
  const dd = code(DETAILS);
  const own = [];
  if (/\.ready\b/.test(dd)) own.push('a ready flag');
  if (/mine\.done\s*=/.test(dd)) own.push('a local done');
  if (/openAsk/.test(dd)) own.push('a go rule from its own open ask');
  if (/ddSend\('answer', '(go|done|reopen)\.'\)/.test(dd)) own.push('presses sent as text lines');
  if (!own.length) test.check('deskDetails.js has no ready flag, go rule, local done or press-as-line');
  else test.fail(OWED + 'deskDetails.js still has ' + own.join(', '));
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
