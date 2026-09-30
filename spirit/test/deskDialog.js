'use strict';

// desk/G2.7: the item dialog paints only what the desk server says.
// Andy: "I want one box only." "All other text-output-boxes are removed." "no pulling". "a press shouldn't post a
// line, it is not textual information." The yellow strip "should only be offered when the agents claim 'done'".
// The goal's abandon: "a red, arming-button ... with are-you-sure", "at the very right of the button row".
// The contract the builder follows:
//   open({id}) asks the desk server item.get {id} once, through api.verb('jobs.api', {ask: {desk: {...}}}), and
//   paints its answer. After that it asks nothing: it repaints from api.onPublished objects,
//   {change, verb, item: <facts>} plus, for a box write, {box, version}, and for a chat line, {chat: {by, at, text}}.
//   (The desk server publishes box and chat that way; its half is part of this item.)
//   Buttons come from item.buttons only. A press goes to the server as press {id, what, by: 'andy'}; the screen
//   does not change until the server publishes. A C check is ticked by pressing it: check.set {id, check, state:
//   'passed', by: 'andy'}. The yellow strip shows the C checks only while item.buttons offers 'done'.
//   On a goal, dd-abandon arms on the first press and sends press abandon on the second.
//   No #dd-blurb, no #dd-decide; no ready flag, go rule or local done in deskDetails.js.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');

const OWED = 'OWED by desk/G2.7: ';
const DETAILS = path.join(__dirname, '..', 'run', 'shell', 'deskDetails', 'deskDetails.js');

function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }
async function settled() { for (let i = 0; i < 6; i++) await settle(); }
function code(file) { return fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1'); }

function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, disabled: false, style: {}, listeners: {}, placeholder: '',
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
function load(doc) {
  let b = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(DETAILS, 'utf8'))(
    { shell: { activateApp: function (x) { b = x; } }, core: kernel.core }, doc, {});
  return b;
}
function target(id, attrs) {
  const a = attrs || {};
  return { id: id, getAttribute: function (n) { return Object.prototype.hasOwnProperty.call(a, n) ? a[n] : null; },
    closest: function () { return null; }, parentNode: null };
}

function dialog(answer) {
  const doc = fakeDocument();
  const dd = load(doc);
  const asked = [];
  const published = [];
  const servers = [];
  dd.mount(fakeElement('dd'), {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      const ask = body && body.ask && body.ask.desk;
      if (name === 'jobs.api' && ask) {
        const v = Object.keys(ask)[0];
        asked.push({ verb: v, args: ask[v] });
        if (v === 'item.get') return Promise.resolve({ status: 200, body: answer });
        return Promise.resolve({ status: 200, body: { change: 1 } });
      }
      return Promise.resolve({ status: 200, body: {} });
    },
    onPublished: function (fn, server) { published.push(fn); servers.push(server); return function () {}; },
    onPacket: function () { return function () {}; },
    setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {},
    peerPost: function () { return Promise.resolve({ ok: true }); },
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  const page = function () { return Object.keys(doc.all).map(function (k) { return doc.all[k].innerHTML; }).join('\n'); };
  const click = function (id, attrs) { doc.getElementById('dd-body').fire('click', { target: target(id, attrs), preventDefault: function () {} }); };
  const publish = function (obj) { published.forEach(function (fn) { fn(obj); }); };
  return { dd: dd, asked: asked, page: page, click: click, publish: publish, published: published, servers: servers };
}

const facts = function (over) {
  return JSON.stringify(Object.assign({ id: 't/G1.2', title: 'Beta', goal: 't/G1', status: 'running', with: 'wsl-claude',
    buttons: ['done'], blocking: ['t/G1'], blocked: [], alone: false, star: false }, over || {}));
};
const answerFor = function (over, extra) {
  return Object.assign({ item: facts(over), box: 'BOX-TEXT', version: 2, change: 7,
    checks: [{ number: 'C1', kind: 'C', words: 'LOOK-AT-IT', test: '', state: 'open', by: '', at: '' }],
    chat: [{ by: 'wsl-claude', at: '2026-09-30T15:00:00Z', text: 'CHAT-HELLO' }] }, extra || {});
};

test.startTest('desk/G2.7: the item dialog paints only what the desk server says');

(async function () {
  test.subHeading('it asks item.get once, and paints its answer');
  const d = dialog(answerFor());
  d.dd.open({ id: 't/G1.2' });
  await settled();
  const gets = d.asked.filter(function (a) { return a.verb === 'item.get'; });
  if (gets.length === 1 && gets[0].args.id === 't/G1.2') test.check('open asked item.get {id} once');
  else test.fail(OWED + 'open asked ' + JSON.stringify(d.asked));
  const p0 = d.page();
  if (p0.indexOf('BOX-TEXT') !== -1 && p0.indexOf('CHAT-HELLO') !== -1 && p0.indexOf('Beta') !== -1) test.check('the box, the chat and the title are painted');
  else test.fail(OWED + 'the page does not show the server\'s box, chat and title');
  if (p0.indexOf('id="dd-blurb"') === -1 && p0.indexOf('id="dd-decide"') === -1) test.check('no explanation box and no lower box');
  else test.fail(OWED + 'the dialog still has #dd-blurb or #dd-decide');
  if (!d.published.length) test.fail(OWED + 'the dialog does not subscribe with api.onPublished');
  else test.check('it listens with api.onPublished');
  // Found live on Andy's node (wsl-claude): the shell hands a server's changes to the app of its own name, so the
  // dialog must name the desk server, or it never hears a change.
  if (d.servers.indexOf('desk') !== -1) test.check('it listens to the desk server by name');
  else test.fail('the dialog listens as itself, so the desk server changes never reach it: ' + JSON.stringify(d.servers));

  test.subHeading('buttons and the yellow strip come from item.buttons');
  if (p0.indexOf('id="dd-done"') !== -1 && p0.indexOf('id="dd-go"') === -1) test.check('buttons [done]: Done shows, Go! does not');
  else test.fail(OWED + 'with buttons [done] the page has done ' + (p0.indexOf('id="dd-done"') !== -1) + ', go ' + (p0.indexOf('id="dd-go"') !== -1));
  if (p0.indexOf('LOOK-AT-IT') !== -1) test.check('while Done is offered, the yellow strip lists the C checks');
  else test.fail(OWED + 'the yellow strip does not show C1 while Done is offered');
  const e = dialog(answerFor({ buttons: ['go'] }));
  e.dd.open({ id: 't/G1.2' });
  await settled();
  const pe = e.page();
  if (pe.indexOf('id="dd-go"') !== -1 && pe.indexOf('LOOK-AT-IT') === -1) test.check('buttons [go]: Go! shows, and no strip before a claim');
  else test.fail(OWED + 'with buttons [go]: go ' + (pe.indexOf('id="dd-go"') !== -1) + ', strip ' + (pe.indexOf('LOOK-AT-IT') !== -1));

  test.subHeading('a press goes to the server, and the screen waits for it');
  d.click('dd-done');
  await settled();
  const pressed = d.asked.filter(function (a) { return a.verb === 'press'; })[0];
  if (pressed && pressed.args.id === 't/G1.2' && pressed.args.what === 'done' && pressed.args.by === 'andy') test.check('Done sends press {id, what: done, by: andy}');
  else test.fail(OWED + 'Done sent ' + JSON.stringify(d.asked.slice(1)));
  if (d.page().indexOf('id="dd-done"') !== -1) test.check('until the server publishes, the page still shows Done');
  else test.fail(OWED + 'the page changed before the server published');
  d.click('', { 'data-check': 'C1' });
  await settled();
  const ticked = d.asked.filter(function (a) { return a.verb === 'check.set'; })[0];
  if (ticked && ticked.args.check === 'C1' && ticked.args.state === 'passed' && ticked.args.by === 'andy') test.check('pressing C1 sends check.set {check: C1, state: passed, by: andy}');
  else test.fail(OWED + 'pressing C1 sent ' + JSON.stringify(ticked || null));

  test.subHeading('it repaints from what the server publishes, and asks nothing more');
  d.publish({ change: 8, verb: 'press', item: JSON.parse(facts({ buttons: ['close', 'reopen'], status: 'done' })) });
  await settled();
  const p1 = d.page();
  if (p1.indexOf('id="dd-reopen"') !== -1 && p1.indexOf('id="dd-done"') === -1) test.check('a published done repaints: Reopen, no Done');
  else test.fail(OWED + 'after the publish: reopen ' + (p1.indexOf('id="dd-reopen"') !== -1) + ', done ' + (p1.indexOf('id="dd-done"') !== -1));
  d.publish({ change: 9, verb: 'box.write', item: JSON.parse(facts({ buttons: ['close', 'reopen'] })), box: 'NEW-BOX', version: 3 });
  d.publish({ change: 10, verb: 'chat.add', item: JSON.parse(facts({ buttons: ['close', 'reopen'] })), chat: { by: 'wsl-claude', at: '2026-09-30T15:05:00Z', text: 'CHAT-NEW' } });
  await settled();
  const p2 = d.page();
  if (p2.indexOf('NEW-BOX') !== -1 && p2.indexOf('BOX-TEXT') === -1 && p2.indexOf('CHAT-NEW') !== -1) test.check('a published box and chat line are painted as they come');
  else test.fail(OWED + 'after publishing a box and a chat line: box ' + (p2.indexOf('NEW-BOX') !== -1) + ', chat ' + (p2.indexOf('CHAT-NEW') !== -1));
  d.publish({ change: 11, verb: 'item.rename', item: JSON.parse(facts({ id: 't/G1.9', title: 'SOMEONE-ELSE' })) });
  await settled();
  if (d.page().indexOf('SOMEONE-ELSE') === -1) test.check('another item\'s publish does not repaint this one');
  else test.fail(OWED + 'another item\'s publish repainted this dialog');
  if (d.asked.filter(function (a) { return a.verb === 'item.get'; }).length === 1) test.check('no pulling: item.get was asked once, only at open');
  else test.fail(OWED + 'item.get was asked again after open');

  test.subHeading('the goal\'s abandon arms first, then goes');
  const g = dialog(answerFor({ id: 't/G1', title: 'The goal', goal: '', buttons: [] }, { checks: [], chat: [] }));
  g.dd.open({ id: 't/G1' });
  await settled();
  if (g.page().indexOf('id="dd-abandon"') !== -1) test.check('the goal offers dd-abandon');
  else test.fail(OWED + 'the goal has no dd-abandon');
  g.click('dd-abandon');
  await settled();
  const armed = g.asked.filter(function (a) { return a.verb === 'press'; }).length;
  g.click('dd-abandon');
  await settled();
  const sent = g.asked.filter(function (a) { return a.verb === 'press' && a.args.what === 'abandon'; });
  if (armed === 0 && sent.length === 1 && sent[0].args.by === 'andy') test.check('the first press arms, the second sends press abandon');
  else test.fail(OWED + 'abandon: after one press ' + armed + ' sent, after two ' + JSON.stringify(sent));
  const item = dialog(answerFor());
  item.dd.open({ id: 't/G1.2' });
  await settled();
  if (item.page().indexOf('id="dd-abandon"') === -1) test.check('an item that is not a goal offers no abandon');
  else test.fail(OWED + 'an item offers dd-abandon');

  // desk/G3.7, Andy: "the goal-detail panel could offer the go-all button if there is any go-able items". The goal's
  // facts say when (go-all in its buttons, desk/G3.4); the dialog draws #dd-go-all, armed like abandon: the first press
  // arms it, the second sends press {id: <goal>, what: 'go-all', by: 'andy'}. An item never draws it.
  test.subHeading('desk/G3.7: the goal dialog offers Go all while the goal does, armed');
  const G37 = 'OWED by desk/G3.7: ';
  const ga = dialog(answerFor({ id: 't/G1', title: 'The goal', goal: '', buttons: ['go-all'] }, { checks: [], chat: [] }));
  ga.dd.open({ id: 't/G1' });
  await settled();
  if (ga.page().indexOf('id="dd-go-all"') !== -1) test.check('the goal, offering go-all, draws dd-go-all');
  else test.fail(G37 + 'the goal dialog draws no dd-go-all');
  ga.click('dd-go-all');
  await settled();
  const armedGoAll = ga.asked.filter(function (a) { return a.verb === 'press'; }).length;
  ga.click('dd-go-all');
  await settled();
  const goAll = ga.asked.filter(function (a) { return a.verb === 'press' && a.args.what === 'go-all'; });
  if (armedGoAll === 0 && goAll.length === 1 && goAll[0].args.id === 't/G1' && goAll[0].args.by === 'andy') test.check('the first press arms it, the second sends press go-all on the goal');
  else test.fail(G37 + 'Go all: after one press ' + armedGoAll + ' sent, after two ' + JSON.stringify(goAll));
  const noGoAll = dialog(answerFor({ buttons: ['go'] }));
  noGoAll.dd.open({ id: 't/G1.2' });
  await settled();
  if (noGoAll.page().indexOf('id="dd-go-all"') === -1) test.check('an item draws no dd-go-all');
  else test.fail(G37 + 'an item draws dd-go-all');

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
});
