'use strict';

// spirit/test/deskClosed.js
// A LINE ANDY CLOSED NEVER COMES BACK.
//
//   Andy, 2026-09-28: "why are all the lines back again. i made most of
//   them disappear with close", "the board should empty out", and "what
//   should be happening all along: the board is being modified,
//   irrevocable". A closed line has no reopen, by design (claude-windows).
//
// Held three ways, each on a fresh mount of the real desk.js from its own
// log alone: after the goal itself is done and closed (the fallback to the
// old board, fixed in 74210408), after a remount, and after the lead posts
// the same session again.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
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
const SESSION = JSON.stringify({
  goal: { id: 'test/G1', title: 'The goal' },
  rules: [{ id: 'test/G1.rule1', text: 'A rule of this goal' }],
  items: [{ id: 'test/G1.1', title: 'Closed item' }, { id: 'test/G1.2', title: 'Still open item' }],
});
const OLD_BOARD = JSON.stringify({ box: 'wsl', rows: [{ id: 'puppets/G2', handle: 'G2', title: 'Old board row', rank: 1 }] });
let n = 0;
function row(dir, kind, text, todo) {
  n += 1;
  return { key: 'k' + n, at: '2026-09-28T10:' + String(n).padStart(2, '0') + ':00.000Z', dir: dir, peer: LEAD,
    outcome: dir === 'in' ? 'received' : 'sent', from: dir === 'in' ? 'claude-windows' : 'andy', kind: kind, text: text, todo: todo };
}
const itemClosed = [
  row('in', 'board', OLD_BOARD, ''),
  row('in', 'session', SESSION, 'team/chat'),
  row('in', 'note', 'READY TO CLOSE', 'test/G1.1'),
  row('out', 'answer', 'done.', 'test/G1.1'),
  row('out', 'answer', 'closed.', 'test/G1.1'),
];
const goalClosed = itemClosed.concat([
  row('in', 'note', 'READY TO CLOSE', 'test/G1'),
  row('out', 'answer', 'done.', 'test/G1'),
  row('out', 'answer', 'closed.', 'test/G1'),
]);

test.startTest('Desk: a line Andy closed never comes back');
const files = { 'log/log.json': JSON.stringify(itemClosed) };
const first = mount(files);
settle().then(function () {
  test.subHeading('A closed item is gone; the open one and the goal stay; no old board');
  const top = first.top();
  if (!/Old board row/.test(top) && !/Closed item/.test(top) && /Still open item/.test(top)) {
    test.check('the closed item is gone, the open item stays, and no old board row comes back');
  } else {
    test.fail('the list shows: old board ' + /Old board row/.test(top) + ', closed item ' + /Closed item/.test(top) +
      ', open item ' + /Still open item/.test(top));
  }

  test.subHeading('After a remount, and after the lead posts the same session again');
  const again = mount(files);
  again.arrive({ from: 'claude-windows', kind: 'session', text: SESSION, todo: 'team/chat' }, 'h-session-again');
  return settle().then(function () {
    const top2 = again.top();
    if (!/Closed item/.test(top2) && /Still open item/.test(top2)) {
      test.check('a fresh mount and a reposted session still leave the closed item closed');
    } else {
      test.fail('after a remount and a reposted session the closed item is ' + (/Closed item/.test(top2) ? 'back' : 'gone, but so is the open one'));
    }
  });
}).then(function () {
  test.subHeading('A closed goal takes its closed lines and its rules; open work stays');
  // Andy: "the rules should also disappear with the requirement they were
  // attached to." Open work does not vanish silently (claude-windows, agreed
  // 2026-09-28): the unfinished item stays on the List.
  const done = mount({ 'log/log.json': JSON.stringify(goalClosed) });
  return settle().then(function () {
    const list = done.top();
    const gone = ['Old board row', 'Closed item', 'A rule of this goal', 'The goal'].filter(function (t) { return list.indexOf(t) !== -1; });
    if (!gone.length && /Still open item/.test(list)) {
      test.check('with the goal closed the List keeps the open item, and drops the closed item, the goal, its rule and the old board');
    } else {
      test.fail('with the goal closed the List shows ' + JSON.stringify(gone) + ', open item ' + /Still open item/.test(list));
    }
  });
}).then(function () {
  // Andy, 2026-09-29: "when a row is done, and you put the close button,
  // don't show "done" anymore".
  test.subHeading('A done row offers Close, and no longer says done');
  const doneOnly = mount({ 'log/log.json': JSON.stringify([
    row('in', 'session', SESSION, 'team/chat'),
    row('in', 'note', 'READY TO CLOSE', 'test/G1.1'),
    // Done counts only once two agents have claimed it.
    Object.assign(row('in', 'note', 'READY TO CLOSE', 'test/G1.1'), { from: 'wsl-claude' }),
    row('out', 'answer', 'done.', 'test/G1.1'),
  ]) });
  return settle().then(function () {
    const cell = (doneOnly.top().match(/<td>[^<]*<button type="button" data-close="test\/G1\.1">Close<\/button><\/td>/) || [''])[0];
    if (cell && !/done/.test(cell.replace(/data-close="[^"]*"/, ''))) test.check('the state cell holds only the Close button');
    else test.fail('the done row: ' + JSON.stringify(cell || (doneOnly.top().match(/<tr data-id="test\/G1\.1"[\s\S]*?<\/tr>/) || ['(not drawn)'])[0]));
  });
}).then(function () { test.reportSuccessFailureCount(); });
