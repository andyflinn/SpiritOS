'use strict';

// goal/G6.6: a goal's Close in the List and the dialog, asking "are you sure?" while items are open (the face of G5.6).
//   Andy, in goal/G5 (G5.6): "yes. if it has items still open it can ask me: are you sure?"
//   The box: "The goal row in the List and the goal's dialog show Close; pressed while any of its items is open, the
//   face asks "are you sure?" first, naming how many are open; yes sends the press."
// The server offers Close on every goal and takes the press either way (goal/G5.6); the asking is the face's.
// The contract the builder follows (claude-windows's picks where the box names no shape):
//   - The question reads "are you sure?" (any case) and carries the number of open items, as a digit.
//   - The yes is a button whose text starts with "Yes", or, failing one, the same Close pressed again (the arm the
//     shell's apps already use). Either way no press goes before the yes.
//   - Open means not done and not closed: the List counts the goal's rows; the dialog may count the goal's blocked
//     list or its items, the fakes agree on both (two open, one done).
//   - With no item open, one Close sends the press at once.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');

const OWED = 'OWED by goal/G6.6: ';
const DESK = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const DETAILS = path.join(__dirname, '..', 'run', 'shell', 'deskDetails', 'deskDetails.js');

function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 8; i++) await settle(); }

function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, disabled: false, style: {}, listeners: {}, placeholder: '',
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function () { return null; }, setAttribute: function () {}, focus: function () {},
    appendChild: function () {}, removeChild: function () {}, replaceChild: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
function fakeDocument() {
  const byId = {};
  return { byId: byId, getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
}
function load(script, doc) {
  let b = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(script, 'utf8'))(
    { shell: { activateApp: function (x) { b = x; } }, core: kernel.core }, doc, { addEventListener: function () {} });
  return b;
}

// Every button painted anywhere, with its attributes, its text and the element it was painted into.
function buttons(doc) {
  const out = [];
  Object.keys(doc.byId).forEach(function (k) {
    const el = doc.byId[k];
    const re = /<button([^>]*)>([\s\S]*?)<\/button>/g;
    let m;
    while ((m = re.exec(el.innerHTML))) {
      const attrs = {};
      m[1].replace(/([\w-]+)="([^"]*)"/g, function (_, n, v) { attrs[n] = v; return ''; });
      out.push({ attrs: attrs, text: m[2].replace(/<[^>]*>/g, '').trim(), el: el });
    }
  });
  return out;
}
// A click bubbles: it reaches the first of the button's element and the screen's containers that listens.
function click(b, doc, roots) {
  const target = {
    id: b.attrs.id || '', getAttribute: function (n) { return Object.prototype.hasOwnProperty.call(b.attrs, n) ? b.attrs[n] : null; },
    closest: function (sel) { const n = (/^\[([\w-]+)\]$/.exec(sel) || [])[1]; return n && Object.prototype.hasOwnProperty.call(b.attrs, n) ? target : null; },
    parentNode: null,
  };
  const el = [b.el].concat(roots.map(function (id) { return doc.getElementById(id); })).filter(function (e) { return (e.listeners.click || []).length; })[0] || b.el;
  el.fire('click', { target: target, currentTarget: el, stopPropagation: function () {}, preventDefault: function () {} });
}
// The text everywhere on the screen, tags stripped: where the question is painted is the builder's.
function screen(doc) {
  return Object.keys(doc.byId).map(function (k) { return doc.byId[k].innerHTML + ' ' + doc.byId[k].textContent; }).join(' ').replace(/<[^>]*>/g, ' ');
}
async function sayYes(f) {
  const doc = f.doc, close = f.close;
  const yes = buttons(doc).filter(function (b) { return /^yes\b/i.test(b.text); })[0];
  if (yes) click(yes, doc, f.roots);
  else { const again = buttons(doc).filter(close)[0]; if (again) click(again, doc, f.roots); }
  await settled();
}

const label = function (o) { return Object.assign({ goal: 't/G1', status: '', with: '', buttons: [], blocking: [], blocked: [], star: false, asks: 0 }, o); };
function goalItems(open) {
  const items = [label({ id: 't/G1.3', title: 'Third', status: 'done', buttons: ['close', 'reopen'] })];
  if (open) {
    items.unshift(label({ id: 't/G1.1', title: 'First', status: 'running', with: 'claude-windows' }),
      label({ id: 't/G1.2', title: 'Second', status: 'blocked', blocked: ['t/G1.1'] }));
  }
  return items;
}

function list(open) {
  const fake = require('./deskFake.js').create([]);
  fake.items = [label({ id: 't/G1', title: 'Goal', goal: '', status: 'running', buttons: ['close'], blocked: open ? ['t/G1.1', 't/G1.2'] : [] })].concat(goalItems(open));
  const doc = fakeDocument();
  load(DESK, doc).mount(fakeElement('container'), {
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
    escapeHtml: kernel.core.util.escapeHtml, verb: fake.verb,
    onPublished: function () { return function () {}; }, onPacket: function () { return function () {}; },
    peerPost: function () { return Promise.resolve({ ok: true, status: 200 }); },
    callDialog: function () { return new Promise(function () {}); }, armUntilElsewhere: function () {},
  });
  const presses = function () { return fake.calls.filter(function (c) { return c.verb === 'press' && c.args && c.args.what === 'close'; }); };
  const close = function (b) { return b.attrs['data-press'] === 'close' && b.attrs['data-id'] === 't/G1'; };
  return { doc: doc, presses: presses, close: close, roots: ['desk-top'] };
}

function dialog(open) {
  const doc = fakeDocument();
  const dd = load(DETAILS, doc);
  const calls = [];
  const items = goalItems(open);
  dd.mount(fakeElement('dd'), {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      const ask = body && body.ask && body.ask.desk;
      const v = ask && Object.keys(ask)[0];
      calls.push({ verb: v, args: ask && ask[v] });
      if (v === 'item.get') {
        return Promise.resolve({ status: 200, body: { item: JSON.stringify(label({ id: 't/G1', title: 'Goal', goal: '', status: 'running', buttons: ['close'],
          blocked: open ? ['t/G1.1', 't/G1.2'] : [] })), box: 'GOAL-BOX', version: 1, change: 3, chatMore: false, checks: [], chat: [] } });
      }
      if (v === 'items.search') {
        return Promise.resolve({ status: 200, body: { items: items.map(function (i) { return { key: i.id, label: JSON.stringify(i) }; }), more: false } });
      }
      return Promise.resolve({ status: 200, body: { change: 1 } });
    },
    onPublished: function () { return function () {}; }, onPacket: function () { return function () {}; },
    setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {},
    peerPost: function () { return Promise.resolve({ ok: true }); }, armUntilElsewhere: function () {},
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  dd.open({ id: 't/G1', agents: {} });
  const presses = function () { return calls.filter(function (c) { return c.verb === 'press' && c.args && c.args.what === 'close'; }); };
  const close = function (b) { return b.attrs.id === 'dd-close'; };
  return { doc: doc, presses: presses, close: close, roots: ['dd-body'] };
}

async function asks(where, f) {
  await settled();
  const btn = buttons(f.doc).filter(f.close)[0];
  if (btn) test.check(where + ': the goal shows Close while two of its items are open');
  else { test.fail(OWED + where + ': no Close on the goal while items are open'); return; }
  click(btn, f.doc, f.roots);
  await settled();
  const text = screen(f.doc);
  const question = /are you sure\?/i.test(text);
  if (question && /\b2\b/.test((text.match(/[^.]{0,120}are you sure\?[^.]{0,120}/i) || [''])[0]) && f.presses().length === 0) {
    test.check(where + ': Close asks "are you sure?", naming the 2 open items, and sends nothing yet');
  } else test.fail(OWED + where + ': after Close, question shown ' + question + ', presses sent ' + f.presses().length);
  await sayYes(f);
  const sent = f.presses();
  if (question && sent.length === 1 && sent[0].args.id === 't/G1') test.check(where + ': yes sends press {id: t/G1, what: close}');
  else test.fail(OWED + where + ': after yes, ' + sent.length + ' close presses ' + JSON.stringify(sent.map(function (c) { return c.args; })));
}

async function straight(where, f) {
  await settled();
  const btn = buttons(f.doc).filter(f.close)[0];
  if (!btn) { test.fail(OWED + where + ': no Close on a goal with nothing open'); return; }
  click(btn, f.doc, f.roots);
  await settled();
  const sent = f.presses();
  if (sent.length === 1 && sent[0].args.id === 't/G1' && !/are you sure\?/i.test(screen(f.doc))) test.check(where + ': with nothing open, one Close sends the press at once, no question');
  else test.fail(OWED + where + ': with nothing open, one Close sent ' + sent.length + ' presses');
}

test.startTest('goal/G6.6: a goal Close asking "are you sure?" while items are open');

(async function () {
  test.subHeading('1. the List: the goal row');
  await asks('List', list(true));
  await straight('List', list(false));
  test.subHeading('2. the goal\'s dialog');
  await asks('dialog', dialog(true));
  await straight('dialog', dialog(false));
})().catch(function (e) { test.fail('the suite died: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
