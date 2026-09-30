'use strict';

// desk/G2.6: the List paints only what the desk server says.
// Andy: "The server determines all the content to be drawn." "no pulling". "a press shouldn't post a line, it is not
// textual information." "The server does the searching AND the filtering." "When Desk opens: [Current Goal Only] on,
// [Goals Only] off". "Close makes item invisible? then Yes." Nudge: his pick (b), a bare 'changed' packet.
// The contract the builder follows (wsl-claude's picks where the box names no shape):
//   On mount the List asks items.search {text: '', currentGoalOnly: true, goalsOnly: false} once, through
//   api.verb('jobs.api', {ask: {desk: {...}}}), and paints one row per label.
//   Each button of a row's `buttons` is an element with data-press="<what>" data-id="<id>"; the row's blocking and
//   blocked ids are data-open links.
//   A click on a data-press element sends press {id, what, by: 'andy'}; the row does not change until the server
//   publishes. Once the server has answered, the page sends each agent it knows a bare agents packet {kind: 'changed'}.
//   It repaints from api.onPublished: {change, verb, item: <facts>} replaces that row; `listed: false` removes it.
//   A published session.set (item null) is the one publish that asks items.search again.
//   The search bar #desk-search (on 'input') and the toggles #desk-current-goal and #desk-goals-only (on click) ask
//   items.search again with the text and both toggles; the List filters nothing itself.
//   No deskGoState, deskReady, deskVerified, deskDone or READY TO CLOSE rule is left in shell/desk/desk.js.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');

const OWED = 'OWED by desk/G2.6: ';
const DESK = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const AGENT_KEY = 'MCowBQYDK2VwAyEAagentagentagentagentagentagentagen=';

function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }
async function settled() { for (let i = 0; i < 8; i++) await settle(); }
function code(file) { return fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1'); }

function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, disabled: false, checked: false, style: {}, listeners: {}, placeholder: '',
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function () { return null; }, setAttribute: function () {}, focus: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
function fakeDocument() {
  const byId = {};
  return { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); }, all: byId };
}
function target(attrs) {
  const a = attrs || {};
  const t = { id: a.id || '', getAttribute: function (n) { return Object.prototype.hasOwnProperty.call(a, n) ? a[n] : null; }, parentNode: null };
  t.closest = function (sel) {
    const m = /^\[([\w-]+)\]$/.exec(sel);
    return m && t.getAttribute(m[1]) !== null ? t : null;
  };
  return t;
}

const label = function (over) {
  return JSON.stringify(Object.assign({ id: 't/G1.1', title: 'Alpha', goal: 't/G1', status: '', with: '', buttons: ['go'],
    blocking: ['t/G1.2'], blocked: [], alone: false, star: false }, over || {}));
};
const LIST = { items: [
  { key: 't/G1', label: label({ id: 't/G1', title: 'The goal', goal: '', buttons: [], blocking: [], blocked: ['t/G1.2'], design: false, waiting: 2, live: ['claude-windows'] }) },
  { key: 't/G1.1', label: label() },
  { key: 't/G1.2', label: label({ id: 't/G1.2', title: 'Beta', status: 'done', buttons: ['close', 'reopen'], blocking: ['t/G1'], blocked: ['t/G1.1'] }) },
], more: false };

function list() {
  const doc = fakeDocument();
  let behavior = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(DESK, 'utf8'))(
    { shell: { activateApp: function (x) { behavior = x; } }, core: kernel.core }, doc, {});
  const asked = [];
  const posted = [];
  const published = [];
  const packets = [];
  behavior.mount(fakeElement('container'), {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      const ask = body && body.ask && body.ask.desk;
      if (name === 'jobs.api' && ask) {
        const v = Object.keys(ask)[0];
        asked.push({ verb: v, args: ask[v] });
        if (v === 'items.search') return Promise.resolve({ status: 200, body: LIST });
        if (v === 'press') return Promise.resolve({ status: 200, body: { change: 12 } });
        return Promise.resolve({ status: 200, body: { items: [], more: false, json: '{}' } });
      }
      return Promise.resolve({ status: 200, body: {} });
    },
    onPublished: function (fn) { published.push(fn); return function () {}; },
    onPacket: function (app, fn) { packets.push(fn); return function () {}; },
    peerPost: function (app, to, body) { posted.push({ app: app, to: to, body: body }); return Promise.resolve({ ok: true }); },
    callDialog: function () { return new Promise(function () {}); },
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  return {
    doc: doc, asked: asked, posted: posted, published: published,
    page: function () { return Object.keys(doc.all).map(function (k) { return doc.all[k].innerHTML; }).join('\n'); },
    click: function (id, attrs) { doc.getElementById(id).fire('click', { target: target(attrs), currentTarget: doc.getElementById(id), preventDefault: function () {} }); },
    publish: function (obj) { published.forEach(function (fn) { fn(obj); }); },
    arrive: function (from, key) { packets.forEach(function (fn) { fn({ from: from, kind: 'note', text: 'hello', todo: '' }, { hash: 'h-' + from, fromKey: key, sentAt: new Date().toISOString() }); }); },
    searches: function () { return asked.filter(function (a) { return a.verb === 'items.search'; }); },
  };
}
const rowOf = function (html, title) { return html.split('<tr').filter(function (s) { return s.indexOf(title) !== -1; })[0] || ''; };

test.startTest('desk/G2.6: the List paints only what the desk server says');

(async function () {
  const l = list();
  await settled();

  test.subHeading('on open: one items.search, current goal on, goals only off');
  const first = l.searches();
  if (first.length === 1 && first[0].args.text === '' && first[0].args.currentGoalOnly === true && first[0].args.goalsOnly === false) {
    test.check('it asked items.search {text: \'\', currentGoalOnly: true, goalsOnly: false} once');
  } else test.fail(OWED + 'on open it asked ' + JSON.stringify(first));
  if (!l.published.length) test.fail(OWED + 'the List does not listen with api.onPublished');
  else test.check('it listens with api.onPublished');

  test.subHeading('rows, buttons and links come from the labels');
  const p0 = l.page();
  const alpha = rowOf(p0, 'Alpha');
  const beta = rowOf(p0, 'Beta');
  if (/data-press="go"/.test(alpha) && /data-id="t\/G1\.1"/.test(alpha)) test.check('Alpha, buttons [go], shows a Go! press for t/G1.1');
  else test.fail(OWED + 'Alpha\'s row: ' + JSON.stringify(alpha.slice(0, 300)));
  // desk/G3.6, Andy: Reopen is never shown in the List; the dialog keeps it. The server still offers it.
  if (/data-press="close"/.test(beta) && !/data-press="go"/.test(beta)) test.check('Beta, done, shows Close and no Go!');
  else test.fail(OWED + 'Beta\'s row: ' + JSON.stringify(beta.slice(0, 300)));
  if (!/data-press="reopen"/.test(beta)) test.check('and no Reopen: the List never shows it (desk/G3.6)');
  else test.fail('OWED by desk/G3.6: the List shows Reopen on Beta');
  if (/data-open="t\/G1\.2"/.test(alpha)) test.check('Alpha\'s blocking id links to its item');
  else test.fail(OWED + 'Alpha\'s blocking is not a data-open link');

  test.subHeading('a press goes to the server as a press, and the row waits for the publish');
  l.arrive('claude-windows', AGENT_KEY);
  await settled();
  l.click('desk-top', { 'data-press': 'go', 'data-id': 't/G1.1' });
  await settled();
  const pressed = l.asked.filter(function (a) { return a.verb === 'press'; })[0];
  if (pressed && pressed.args.id === 't/G1.1' && pressed.args.what === 'go' && pressed.args.by === 'andy') test.check('Go! sends press {id: t/G1.1, what: go, by: andy}');
  else test.fail(OWED + 'Go! sent ' + JSON.stringify(pressed || null));
  if (/data-press="go"/.test(rowOf(l.page(), 'Alpha'))) test.check('until the server publishes, Alpha still shows Go!');
  else test.fail(OWED + 'the row changed before the server published');
  const nudge = l.posted.filter(function (p) { return p.to === AGENT_KEY && p.body && p.body.kind === 'changed'; });
  if (nudge.length === 1 && !nudge[0].body.text) test.check('after the server answered, the agent got one bare changed packet');
  else test.fail(OWED + 'the nudge: ' + JSON.stringify(l.posted));
  const lines = l.posted.filter(function (p) { return p.body && /^go\.$/.test(String(p.body.text || '')); });
  if (pressed && !lines.length) test.check('the press went as a press, and no "go." line was posted');
  else test.fail(OWED + (pressed ? 'the press also went out as a line' : 'nothing was pressed'));

  test.subHeading('it repaints from what the server publishes, and asks nothing more');
  l.publish({ change: 12, verb: 'press', item: JSON.parse(label({ status: 'running', buttons: [] })) });
  l.publish({ change: 13, verb: 'item.rename', item: JSON.parse(label({ title: 'Alpha renamed', status: 'running', buttons: [] })) });
  await settled();
  const p1 = l.page();
  if (rowOf(p1, 'Alpha renamed') && !/data-press="go"/.test(rowOf(p1, 'Alpha renamed'))) test.check('a published press and rename repaint Alpha: new title, no Go!');
  else test.fail(OWED + 'after the publishes Alpha\'s row: ' + JSON.stringify(rowOf(p1, 'Alpha').slice(0, 300)));
  l.publish({ change: 14, verb: 'press', item: JSON.parse(label({ id: 't/G1.2', title: 'Beta', status: 'done', buttons: [] })), listed: false });
  await settled();
  if (beta && !rowOf(l.page(), 'Beta')) test.check('a published close (listed: false) takes Beta off the List');
  else test.fail(OWED + 'Beta is still on the List after listed: false');
  if (l.searches().length === 1) test.check('no pulling: items.search was asked once, at open');
  else test.fail(OWED + 'items.search was asked again: ' + JSON.stringify(l.searches()));
  // An item the List does not show (filtered out, or brought back after a close) is the server's to place:
  // the List asks items.search again rather than adding a row the filters may exclude.
  const before = l.searches().length;
  l.publish({ change: 14.5, verb: 'chat.add', item: JSON.parse(label({ id: 't/G1.9', title: 'NOT-ON-THE-LIST' })), listed: true });
  await settled();
  if (!/NOT-ON-THE-LIST/.test(l.page()) && l.searches().length === before + 1) test.check('a publish for an item not on the List adds no row; it asks the server again');
  else test.fail(OWED + 'a publish for an unlisted item: shown ' + /NOT-ON-THE-LIST/.test(l.page()) + ', searches ' + (l.searches().length - before));
  l.publish({ change: 15, verb: 'session.set', item: null });
  await settled();
  if (l.searches().length === 3) test.check('a published session.set asks items.search again');
  else test.fail(OWED + 'after a session.set publish items.search was asked ' + l.searches().length + ' times');

  test.subHeading('the search bar and the two toggles go to the server');
  l.doc.getElementById('desk-search').value = 'bet';
  l.doc.getElementById('desk-search').fire('input', { target: l.doc.getElementById('desk-search') });
  await settled();
  const typed = l.searches().slice(-1)[0] || { args: {} };
  if (typed.args.text === 'bet' && typed.args.currentGoalOnly === true && typed.args.goalsOnly === false) test.check('typing asks items.search {text: bet} with the toggles as they stand');
  else test.fail(OWED + 'typing asked ' + JSON.stringify(typed));
  l.click('desk-goals-only', { id: 'desk-goals-only' });
  await settled();
  const toggled = l.searches().slice(-1)[0] || { args: {} };
  if (toggled.args.goalsOnly === true && toggled.args.text === 'bet') test.check('Goals Only asks items.search {goalsOnly: true}, the text kept');
  else test.fail(OWED + 'Goals Only asked ' + JSON.stringify(toggled));
  l.click('desk-current-goal', { id: 'desk-current-goal' });
  await settled();
  const current = l.searches().slice(-1)[0] || { args: {} };
  if (current.args.currentGoalOnly === false) test.check('Current Goal Only toggles off');
  else test.fail(OWED + 'Current Goal Only asked ' + JSON.stringify(current));

  // desk/G3.4, Andy: "i should have a go-all button for fixing rounds", "the go all should be on the right side of
  // the button bar in list", then "same as design buttons when team is active": #desk-go-all at the right of the
  // tab bar on the List tab, never in a row. The goal row's buttons say when it is offered; it sends
  // press {id: <goal>, what: 'go-all', by: 'andy'}.
  test.subHeading('desk/G3.4: Go all sits at the right of the bar while the goal offers it');
  const G34 = 'OWED by desk/G3.4: ';
  l.publish({ change: 16, verb: 'press', item: JSON.parse(label({ id: 't/G1', title: 'The goal', goal: '', buttons: ['go-all'], blocking: [], blocked: [] })) });
  await settled();
  const bar = l.doc.getElementById('desk-go-all');
  const goalRow = rowOf(l.page(), 'The goal');
  if (bar && !bar.hidden && !/data-press="go-all"/.test(goalRow)) test.check('#desk-go-all shows in the bar, and the goal row draws no go-all');
  else test.fail(G34 + 'go-all shown in the bar ' + !!(bar && !bar.hidden) + ', in the goal row ' + /data-press="go-all"/.test(goalRow));
  // "and be the armed-type": the first press arms it (data-armed, armUntilElsewhere), the second sends.
  const goAlls = function () { return l.asked.filter(function (a) { return a.verb === 'press' && a.args.what === 'go-all'; }); };
  l.click('desk-go-all', { id: 'desk-go-all' });
  await settled();
  const armedFirst = goAlls().length === 0;
  l.click('desk-go-all', { id: 'desk-go-all' });
  await settled();
  const all = goAlls()[0];
  if (armedFirst && goAlls().length === 1 && all.args.id === 't/G1' && all.args.by === 'andy') test.check('the first press arms it; the second sends press {id: t/G1, what: go-all, by: andy}');
  else test.fail(G34 + 'Go all: sent after one press ' + !armedFirst + ', after two ' + JSON.stringify(goAlls()));
  l.publish({ change: 17, verb: 'press', item: JSON.parse(label({ id: 't/G1', title: 'The goal', goal: '', buttons: [], blocking: [], blocked: [] })) });
  await settled();
  if (l.doc.getElementById('desk-go-all').hidden) test.check('once the goal no longer offers it, Go all hides');
  else test.fail(G34 + 'Go all still shows after the goal stopped offering it');

  test.subHeading('one piece of code: the List keeps no rule of its own');
  const src = code(DESK);
  const own = ['deskGoState', 'deskReady', 'deskVerified', 'deskDone', 'READY TO CLOSE', 'fresh.get'].filter(function (w) { return src.indexOf(w) !== -1; });
  if (!own.length) test.check('shell/desk/desk.js has no deskGoState, deskReady, deskVerified, deskDone, READY TO CLOSE rule or fresh.get');
  else test.fail(OWED + 'shell/desk/desk.js still has ' + own.join(', '));
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
