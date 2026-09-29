'use strict';

// spirit/test/deskOpenPoints.js
// AN OPEN POINT IS AN ITEM, AT THE TOP, MARKED YOURS — desk/G1.1, written FIRST.
//
//   Andy, 2026-09-29: "i keep missing my O's because the don't have a
//   prioritized slot. perceive them as item other things depend on. so they
//   should act like any item on the list i go to their detail, to see what
//   depends on them." Decided as D6: the lead posts each open point as an
//   item, id <goal>.O<n>, marked open (open: true, the field this suite
//   assumes, sent to claude-windows before the build), with 'blocks' naming
//   what depends on it. His go on desk/G1.1, under red first, green after.
//
// Driven the way deskClosed.js drives Desk: the real desk.js, mounted from
// its own log alone, with fake document and fs.

const fs = require('fs');
const path = require('path');
const spirit = require('../run/js/kernel.js');

const DESK = path.join(__dirname, '..', 'run', 'app', 'desk', 'desk.js');
const LEAD = 'MCowBQYDK2VwAyEAleadleadleadleadleadleadleadleadleadl=';

function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, disabled: false, style: {}, listeners: {},
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    // Desk binds its row clicks on `tr[data-id]` after every draw, so the
    // stub builds those rows from the drawn markup and keeps the newest.
    queried: {},
    querySelectorAll: function (sel) {
      if (sel !== 'tr[data-id]') return [];
      const rows = (html.match(/<tr data-id="[^"]*"/g) || []).map(function (m) {
        const row = fakeElement('');
        const id = m.slice('<tr data-id="'.length, -1);
        row.getAttribute = function (name) { return name === 'data-id' ? id : null; };
        return row;
      });
      el.queried[sel] = rows;
      return rows;
    },
    getAttribute: function () { return null; },
  };
  Object.defineProperty(el, 'innerHTML', {
    get: function () { return html; },
    set: function (v) { html = String(v); },
    enumerable: true,
  });
  return el;
}

function fakeDocument() {
  const byId = {};
  return { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
}

function fakeFs(files) {
  return {
    loadFile: function (name) { return Object.prototype.hasOwnProperty.call(files, name) ? files[name] : null; },
    saveFile: function (name, content) { files[name] = content; return Promise.resolve(); },
  };
}

function load(script, doc) {
  let behavior = null;
  const shellSpirit = { shell: { activateApp: function (b) { behavior = b; } } };
  new Function('spirit', 'document', 'window', fs.readFileSync(script, 'utf8'))(shellSpirit, doc, {});
  return behavior;
}

function mount(files) {
  const doc = fakeDocument();
  const behavior = load(DESK, doc);
  const handlers = [];
  behavior.mount(fakeElement('container'), {
    fs: fakeFs(files),
    escapeHtml: spirit.core.util.escapeHtml,
    verb: require('./deskFake.js').fromFiles(files).verb,
    onPacket: function (app, fn) { handlers.push(fn); },
    peerPost: function () { return Promise.resolve({ ok: true, status: 200, hash: 'h-out' }); },
    callDialog: function () { return new Promise(function () {}); },
  });
  return {
    top: function () { return doc.getElementById('desk-top').innerHTML; },
    page: function () { return ['desk-top', 'desk-session', 'desk-goal'].map(function (id) { return doc.getElementById(id).innerHTML; }).join(' '); },
    arrive: function (body, hash) { handlers.forEach(function (fn) { fn(body, { hash: hash, fromKey: LEAD, sentAt: '2026-09-28T10:30:00.000Z' }); }); },
  };
}
function settle() {
  return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); });
}

// His log: a session with one closed and one open item and a rule, an old
// board from before the ruling, the claims, his done. and his closed.

const test = require('./testSupport.js');
test.startTest('desk/G1.1: an open point is an item, at the top of the List, marked yours');
const OWED = 'OWED by desk/G1.1: ';

let n = 0;
function row(dir, kind, text, todo) {
  n += 1;
  return { key: 'k' + n, at: '2026-09-29T10:' + String(n).padStart(2, '0') + ':00.000Z', dir: dir, peer: LEAD,
    outcome: dir === 'in' ? 'received' : 'sent', from: dir === 'in' ? 'claude-windows' : 'andy', kind: kind, text: text, todo: todo };
}
function session(oDone) {
  const o = { id: 'test/G1.O1', title: 'Which colour?', open: true, blocks: ['test/G1.2'] };
  if (oDone) o.done = true;
  return JSON.stringify({
    goal: { id: 'test/G1', title: 'The goal' },
    items: [
      { id: 'test/G1.1', title: 'An ordinary item' },
      { id: 'test/G1.2', title: 'Waits on the colour' },
      o,
    ],
  });
}
// The List's rows, in order: id and the text of each cell.
function rows(html) {
  const out = [];
  const re = /<tr data-id="([^"]*)"[^>]*>([\s\S]*?)<\/tr>/g;
  let m;
  while ((m = re.exec(html))) {
    const cells = (m[2].match(/<td[^>]*>([\s\S]*?)<\/td>/g) || []).map(function (c) { return c.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); });
    out.push({ id: m[1], cells: cells, text: cells.join(' | ') });
  }
  return out;
}

const open = mount({ 'log/log.json': JSON.stringify([row('in', 'session', session(false), 'team/chat')]) });
settle().then(function () {
  const r = rows(open.top());
  const first = r[0] || { id: '', cells: [], text: '' };
  const o = r.find(function (x) { return x.id === 'test/G1.O1'; });
  const dep = r.find(function (x) { return x.id === 'test/G1.2'; });

  test.subHeading('T1: an item marked open sorts above every other open row');
  if (first.id === 'test/G1.O1') test.check('the open point is the List\'s first row, above the goal\'s other items');
  else test.fail(OWED + 'the first row is ' + JSON.stringify(first.id) + '; order ' + JSON.stringify(r.map(function (x) { return x.id; })));

  test.subHeading('T2: its state column says yours');
  if (o && /\byours\b/i.test(o.cells[o.cells.length - 1] || '')) test.check('its state column reads yours');
  else test.fail(OWED + 'the open point\'s row reads ' + JSON.stringify(o && o.text));

  // T3 is a GUARD: waits-on already follows 'blocks' today (desk.js:542),
  // and an open point must keep it. It proves nothing new on its own.
  test.subHeading('T3 (guard): an item it blocks lists it under waits on');
  if (dep && /test\/G1\.O1/.test(dep.text)) test.check('the item it blocks shows test/G1.O1 under waits on');
  else test.fail(OWED + 'the blocked item reads ' + JSON.stringify(dep && dep.text));

  const done = mount({ 'log/log.json': JSON.stringify([row('in', 'session', session(true), 'team/chat')]) });
  return settle().then(function () {
    test.subHeading('T4: once done it leaves the top slot and its dependents unblock');
    const r2 = rows(done.top());
    const top = r2[0] || { id: '' };
    const dep2 = r2.find(function (x) { return x.id === 'test/G1.2'; });
    // It must have BEEN on top for leaving the top to mean anything.
    if (first.id === 'test/G1.O1' && top.id !== 'test/G1.O1' && dep2 && !/test\/G1\.O1/.test(dep2.text)) {
      test.check('answered, the open point is no longer on top and test/G1.2 waits on nothing');
    } else {
      test.fail(OWED + (first.id !== 'test/G1.O1' ? 'it was never on top to leave it; ' : '') + 'after done: top ' + JSON.stringify(top.id) + ', test/G1.2 reads ' + JSON.stringify(dep2 && dep2.text));
    }
  });
}).catch(function (e) { test.fail(OWED + 'the run broke: ' + e.message); })
  .then(function () { test.reportSuccessFailureCount(); });
