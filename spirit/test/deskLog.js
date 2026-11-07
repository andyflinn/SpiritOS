'use strict';

// DESK'S RECORD IS THE DESK SERVER'S, AND THE NODE IS ASKED NOTHING ELSE.
//
//   Andy, 2026-09-27, on node.history, a verb added to the node for one
//   app without review: "after correcting agents and desk, we will remove
//   the new verb."
//
// What this suite holds:
//
//   - neither Desk nor DeskDetails names a verb but its servers' (desk.,
//     deskVerify., backup.), and neither names node.history;
//   - an arrival of an agents packet is recorded nowhere (no log row, no
//     log.add, goal/G33.4), nothing is posted, and a remount draws the
//     board from the server's record alone, asking nothing of goal/G0;
//   - a row's star is drawn only when the server says so;
//   - a Desk whose server does not answer says it could not read.
//
// Driven with the real scripts, loaded with small document/api stubs,
// their real handlers fired.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const spirit = require('../run/spirit/kernel.js');

const APP_DIR = path.join(__dirname, '..', 'run', 'shell');
const DESK = path.join(APP_DIR, 'desk', 'desk.js');
const DETAILS = path.join(APP_DIR, 'deskDetails', 'deskDetails.js');
// A verb of one of Desk's servers, by its name on the flat apiDoor (goal/G30.6); the family is the part before the dot.
const SERVER_VERB = /^(desk|deskVerify|backup)\./;

const LEAD = 'MCowBQYDK2VwAyEAleadleadleadleadleadleadleadleadleadl=';
const WSL = 'MCowBQYDK2VwAyEAwslwslwslwslwslwslwslwslwslwslwslwsl=';

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

// The scoped fs, in memory: `files` is the app's own folder.
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

// DESK'S RECORD IS THE DESK SERVER'S (desk/G1.4): a mount gets the
// in-memory one (deskFake.js), ONE per folder, so two tabs of one node share
// one server as they do for real. The folder is kept in step with it.
const deskFake = require('./deskFake.js');
const fakes = new Map();
// THE LIST IS THE DESK SERVER'S (desk/G2.6): each fake lists goal/G100.
const G2 = { id: 'goal/G100', title: 'Search', goal: 'puppets/G', status: '', with: '', buttons: [], blocking: [], blocked: [], star: false };
function fakeFor(files) {
  if (!fakes.has(files)) { const fk = deskFake.fromFiles(files); fk.items = [Object.assign({}, G2)]; fakes.set(files, fk); }
  return fakes.get(files);
}
// A click on a row of the List, as its one listener sees it.
function openRow(desk, id) {
  const top = desk.doc.getElementById('desk-top');
  const t = { getAttribute: function (n) { return n === 'data-row' ? id : null; }, parentNode: null };
  t.closest = function (sel) { return sel === '[data-row]' ? t : null; };
  top.fire('click', { target: t, currentTarget: top });
}
// One counter for every mount: two tabs on one node never get the same hash.
let outHash = 0;
function mountDesk(opts) {
  const doc = fakeDocument();
  const behavior = load(DESK, doc);
  const handlers = [];
  const posts = [];
  const verbs = [];
  const dialogs = [];
  const api = {
    fs: fakeFs(opts.files),
    escapeHtml: spirit.core.util.escapeHtml,
    // What Desk asks the node for, other than its servers' verbs by name (desk.<verb>, deskVerify.<verb>,
    // backup.<verb> on the flat apiDoor, goal/G30.6), is recorded; a Desk
    // whose server is down (opts.dead) gets the node's refusal.
    verb: function (name, body) {
      if (!SERVER_VERB.test(String(name))) verbs.push(name);
      if (opts.dead) return Promise.resolve({ status: 503, body: { ok: false, code: 'app-not-running', error: 'the app server is not running' } });
      return fakeFor(opts.files).verb(name, body);
    },
    onPublished: function () {}, onPacket: function (app, fn) { handlers.push({ app: app, fn: fn }); },
    peerPost: function (app, to, body) {
      posts.push({ app: app, to: to, body: body });
      if (opts.refuse) return Promise.resolve({ ok: false, status: 428, hash: '', error: 'no cipher key' });
      outHash += 1;
      return Promise.resolve({ ok: true, status: 200, hash: 'h-out-' + outHash });
    },
    callDialog: function (id, params) {
      return new Promise(function (resolve) { dialogs.push({ id: id, params: params, resolve: resolve }); });
    },
  };
  behavior.mount(fakeElement('container'), api);
  return {
    doc: doc, posts: posts, verbs: verbs, dialogs: dialogs, handlers: handlers, fake: fakeFor(opts.files),
    arrive: function (body, message) { handlers.forEach(function (h) { if (h.app === 'agents') h.fn(body, message); }); },
  };
}

function settle() {
  return new Promise(function (r) { setImmediate(r); })
    .then(function () { return new Promise(function (r2) { setImmediate(r2); }); });
}

function logged(files) {
  try { return JSON.parse(files['log/log.json']); } catch (e) { return null; }
}

// A DESIGN SESSION: Desk's List shows only a session (Andy, 2026-09-28:
// "this IS the official project governance. NOW."). One item, goal/G100.
const BOARD = JSON.stringify({ goal: { id: 'puppets/G', title: 'Puppets' }, items: [{ id: 'goal/G100', title: 'Search' }] });

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

function arrivalsAndSendsAreLogged() {
  // goal/G33.4 (Andy: "log.add, log.search and pending.get: delete them."): the page keeps no log of the agents
  // app's packets: an arrival is recorded nowhere.
  test.subHeading('An arrival is recorded nowhere; a remount reads the board from the server alone');
  const files = {};
  const desk = mountDesk({ files: files });
  desk.arrive({ from: 'claude-windows', kind: 'session', text: BOARD }, { hash: 'h-in-1', fromKey: LEAD, sentAt: '2026-09-27T05:00:00Z' });
  return settle().then(function () {
    const rows = logged(files) || [];
    const asked = desk.fake.calls.filter(function (c) { return c.verb === 'log.add'; });
    if (!rows.length && !asked.length) test.check('the arrival is recorded nowhere: no log row, no log.add (goal/G33.4)');
    else test.fail('goal/G33.4: after one arrival the log holds ' + JSON.stringify(rows) + ' and log.add was asked ' + asked.length + ' time(s)');
    if (!desk.posts.length) test.check('nothing was posted as a packet');
    else test.fail('posts ' + JSON.stringify(desk.posts));
    if (!desk.verbs.length) test.check('the node was asked nothing but its servers\' verbs by name');
    else test.fail('verbs asked: ' + desk.verbs.join(', '));

    const again = mountDesk({ files: files });
    return settle().then(function () {
      // Since goal/G43.22 nothing asks goal/G0.
      const top = again.doc.getElementById('desk-top').innerHTML;
      const groupRead = again.fake.calls.some(function (c) { return c.args && c.args.id === 'goal/G0'; });
      if (!groupRead && /Search/.test(top)) {
        test.check('a fresh mount draws the board from the server\'s record alone, and asks nothing of goal/G0');
      } else {
        test.fail('remount asked goal/G0: ' + groupRead + '; drew top ' + top.slice(0, 120));
      }
    });
  });
}


// A record Desk cannot reach is said, and never drawn as an empty board.
function unreachableIsSaid() {
  test.subHeading('A Desk whose server does not answer says so');
  const desk = mountDesk({ files: {}, dead: true });
  return settle().then(function () {
    if (/could not read/.test(desk.doc.getElementById('desk-top').innerHTML)) test.check('Desk says it could not read its record');
    else test.fail('Desk drew ' + desk.doc.getElementById('desk-top').innerHTML.slice(0, 120));
  });
}

// The dialog reads item.get and writes to the desk server: spirit/test/deskDialog.js.

function unseenIsMarked() {
  // Andy: "... indicating that new stuff has arrived for that item". A
  // ROW'S STAR IS THE DESK SERVER'S (desk/G2.6): the label says it, and the
  // dialog presses seen when it opens a starred item (desk/G2.7, deskDialog.js).
  test.subHeading('A red * is drawn only when the server says so');
  const files = {};
  const desk = mountDesk({ files: files });
  return settle().then(function () {
    const top = desk.doc.getElementById('desk-top');
    if (!/title="unseen changes"/.test(top.innerHTML)) test.check('no star while the server says none');
    else test.fail('a star with none said: ' + top.innerHTML.slice(0, 160));
  });
}

arrivalsAndSendsAreLogged()
  .then(unseenIsMarked)
  .then(unreachableIsSaid)
  .then(function () { test.reportSuccessFailureCount(); })
  .catch(function (err) {
    test.fail('deskLog threw: ' + ((err && err.stack) || err));
    test.reportSuccessFailureCount();
  });

module.exports = test;
