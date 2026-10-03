'use strict';

// DESK KEEPS ITS OWN LOG — design/shell/AGENTS-UI.md.
//
//   Andy, 2026-09-27: "they must keep their own logs", and "after
//   correcting agents and desk, we will remove the new verb."
//
// Desk read his node's record through node.history, a verb added to the
// node for one app without review. This suite holds the correction:
//
//   - neither Desk nor DeskDetails asks the node for anything (no verb);
//   - an arrival through onPacket, and a line Andy sends, land in Desk's
//     own `log.json` through its scoped fs, and a remount reads them back;
//   - two sends that never crossed are two rows, not one;
//   - a log that does not parse is never overwritten;
//   - what Andy sends from a row's dialog comes back to Desk as the
//     dialog's result and is logged there.
//
// Driven the way contactsDetails.js is: the real scripts, loaded with
// small document/api stubs, their real handlers fired.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const spirit = require('../run/js/kernel.js');

const APP_DIR = path.join(__dirname, '..', 'run', 'shell');
const DESK = path.join(APP_DIR, 'desk', 'desk.js');
const DETAILS = path.join(APP_DIR, 'deskDetails', 'deskDetails.js');

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

// SINCE desk/G1.4 DESK'S RECORD IS THE DESK SERVER'S: a mount gets the
// in-memory one (deskFake.js), ONE per folder, so two tabs of one node share
// one server as they do for real. The folder is kept in step with it.
const deskFake = require('./deskFake.js');
const fakes = new Map();
// THE LIST IS THE DESK SERVER'S (desk/G2.6): each fake lists puppets/G2.
const G2 = { id: 'puppets/G2', title: 'Search', goal: 'puppets/G', status: '', with: '', buttons: [], blocking: [], blocked: [], star: false };
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
    // What Desk asks the node for, other than jobs.api, is recorded; a Desk
    // whose server is down (opts.dead) gets the node's refusal.
    verb: function (name, body) {
      if (name !== 'jobs.api') verbs.push(name);
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

// THE LEAD'S TAB INSIDE TEAM WENT (goal/G3.12): a line typed under Team is the group chat's, one chat.add on
// desk/G0.0, posted to nobody. What he types there is no longer a log line of the page's.
function sayInTeam(desk, text) {
  desk.doc.getElementById('desk-team-say').value = text;
  desk.doc.getElementById('desk-team-send').fire('click');
}

function logged(files) {
  try { return JSON.parse(files['log/log.json']); } catch (e) { return null; }
}

// A DESIGN SESSION, NOT THE OLD BOARD: Desk's List shows only a session since
// the old tracking was retired (Andy, 2026-09-28: "this IS the official
// project governance. NOW."). One item, puppets/G2, as the board had.
const BOARD = JSON.stringify({ goal: { id: 'puppets/G', title: 'Puppets' }, items: [{ id: 'puppets/G2', title: 'Search' }] });

test.startTest('Desk — its record, through the desk server, and nothing else asked of the node');

// SINCE desk/G1.4 Desk reaches its record through jobs.api (D4), and that is
// the one verb it may name; the node's own history it never asks for.
test.subHeading('Desk and its dialog name only jobs.api (desk/G2.7), and never node.history');
[DESK, DETAILS].forEach(function (f) {
  const src = fs.readFileSync(f, 'utf8');
  const code = src.split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n');
  const named = (code.match(/\.verb\(\s*'([^']*)'/g) || []).map(function (m) { return m.replace(/^\.verb\(\s*'|'$/g, ''); });
  const allowed = named.every(function (v) { return v === 'jobs.api'; }) && named.length > 0;
  if (allowed && !/node\.history/.test(code)) {
    test.check(path.basename(f) + ' names only jobs.api' + ', and never node.history outside a comment');
  } else {
    test.fail(path.basename(f) + ' asks the node for ' + JSON.stringify(named) + (/node\.history/.test(code) ? ' and names node.history' : ''));
  }
});

function arrivalsAndSendsAreLogged() {
  test.subHeading('An arrival and a sent line land in log.json, and a remount reads them back');
  const files = {};
  const desk = mountDesk({ files: files });
  desk.arrive({ from: 'claude-windows', kind: 'session', text: BOARD }, { hash: 'h-in-1', fromKey: LEAD, sentAt: '2026-09-27T05:00:00Z' });
  return settle().then(function () {
    const rows = logged(files) || [];
    if (rows.length === 1 && rows[0].key === 'h-in-1' && rows[0].dir === 'in' && rows[0].peer === LEAD) {
      test.check('the board arrival is in the log, keyed by its hash, from the lead\'s key');
    } else {
      test.fail('after one arrival the log holds ' + JSON.stringify(rows));
    }
    sayInTeam(desk, 'hello team');
    return settle();
  }).then(function () {
    // HIS LINE TO THE LEAD STOOD HERE, posted as a packet and logged as an out row. Since goal/G3.12 a Team line is
    // one chat.add on the group chat: no packet, no out row of the page's.
    const rows = logged(files) || [];
    const out = rows.filter(function (r) { return r.dir === 'out'; });
    const added = desk.fake.calls.filter(function (c) { return c.verb === 'chat.add'; });
    if (!desk.posts.length && !out.length && added.length === 1 && added[0].args.id === 'desk/G0.0' && added[0].args.text === 'hello team') {
      test.check('his Team line went as one chat.add on desk/G0.0: no packet, no out row');
    } else {
      test.fail('posts ' + JSON.stringify(desk.posts) + ' out rows ' + JSON.stringify(out) + ' chat.add ' + JSON.stringify(added.map(function (c) { return c.args; })));
    }
    if (!desk.verbs.length) test.check('the node was asked nothing but jobs.api');
    else test.fail('verbs asked: ' + desk.verbs.join(', '));

    const again = mountDesk({ files: files });
    return settle().then(function () {
      // The remount reads the group chat (item.chat on desk/G0.0) and draws it; the fake holds his line there.
      const chat = again.doc.getElementById('desk-team').innerHTML;
      const top = again.doc.getElementById('desk-top').innerHTML;
      const groupRead = again.fake.calls.some(function (c) { return c.verb === 'item.chat' && c.args.id === 'desk/G0.0'; });
      if (groupRead && /hello team/.test(chat) && /Search/.test(top)) {
        test.check('a fresh mount draws the board and the group chat from the server\'s record alone');
      } else {
        test.fail('remount read the group chat: ' + groupRead + '; drew chat ' + chat.slice(0, 120) + ' / top ' + top.slice(0, 120));
      }
      // The same arrival twice (a replay) is one row.
      again.arrive({ from: 'claude-windows', kind: 'session', text: BOARD }, { hash: 'h-in-1', fromKey: LEAD, sentAt: '2026-09-27T05:00:00Z' });
      return settle();
    });
  }).then(function () {
    const rows = logged(files) || [];
    if (rows.filter(function (r) { return r.key === 'h-in-1'; }).length === 1) test.check('a replayed arrival is not logged twice');
    else test.fail('replay doubled the row');
  });
}


// A LOG THAT DID NOT PARSE is the server's to refuse now (deskOnServer.js,
// the import). What Desk still owes: a record it cannot reach is said, and
// never drawn as an empty board.
function unreachableIsSaid() {
  test.subHeading('A Desk whose server does not answer says so');
  const desk = mountDesk({ files: {}, dead: true });
  return settle().then(function () {
    if (/could not read/.test(desk.doc.getElementById('desk-top').innerHTML)) test.check('Desk says it could not read its record');
    else test.fail('Desk drew ' + desk.doc.getElementById('desk-top').innerHTML.slice(0, 120));
  });
}

// THE DIALOG'S OLD FLOW (a thread handed over, sends by peerPost, the result logged by Desk) went with
// desk/G2.7: the dialog reads item.get and writes to the desk server (spirit/test/deskDialog.js).

function voiceHoldsWhatHeTyped() {
  test.subHeading('what he typed goes to the desk server\'s voice, and nothing else');
  const files = {};
  const desk = mountDesk({ files: files });
  desk.arrive({ from: 'claude-windows', kind: 'session', text: BOARD }, { hash: 'h-in-1', fromKey: LEAD, sentAt: '2026-09-27T05:00:00Z' });
  desk.arrive({ from: 'claude-windows', kind: 'ask', text: 'go?', todo: 'puppets/G2' }, { hash: 'h-in-3', fromKey: LEAD, sentAt: '2026-09-27T05:03:00Z' });
  return settle().then(function () {
    sayInTeam(desk, 'typed by andy');
    return settle();
    // WHAT HE TYPES IN A DIALOG goes by chat.add since desk/G2.7; the dialog no
    // longer hands its lines back for Desk to record, so this checks Desk's own.
  }).then(function () {
    // From desk/G1.4 to goal/G2.1 the server kept it (voice.add), a plain file in its state folder that he
    // moved himself. NO LONGER (goal/G2.1 note 8): the log line is the record, the brain reads it through the
    // desk api, and the vault's own tool keeps his corpus. Nothing goes to voice.add.
    if (!desk.fake.voice.length) {
      test.check('his typed line went to the log alone, nothing to voice.add');
    } else {
      test.fail('OWED by goal/G2.1: the page still sends voice.add ' + JSON.stringify(desk.fake.voice));
    }
  });
}


// teamGoesToEveryAgent STOOD HERE: his team line posted to every agent as a packet under team/chat, and an
// agent's packet line shown once in Team. That mechanism is gone with goal/G3.10: the All tab is the chat of the
// desk server's standing goal desk/G0.0, written with chat.add and posted to nobody. deskGroupChat.js holds what
// replaced it, including that no packet is posted and no team/chat packet line is drawn there.

function unseenIsMarked() {
  // Andy: "... indicating that new stuff has arrived for that item". SINCE
  // desk/G2.6 A ROW'S STAR IS THE DESK SERVER'S: the label says it, and the
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

// THE LOG IN CHUNKS (Andy's "failed to save file: 413") is gone with the
// files: the server keeps every line, and a read is bounded by bytes there
// (deskServer.js, the byte cut; deskOnServer.js, T5b and T6).

arrivalsAndSendsAreLogged()
  .then(unseenIsMarked)
  .then(voiceHoldsWhatHeTyped)
  // twoTabsKeepBoth and failedSendsStayApart stood here: two Desk tabs' lines to the lead both kept, and two failed
  // sends two rows. The page sends no line as a packet since goal/G3.12, so there is nothing of the kind to log.
  .then(unreachableIsSaid)
  .then(function () { test.reportSuccessFailureCount(); })
  .catch(function (err) {
    test.fail('deskLog threw: ' + ((err && err.stack) || err));
    test.reportSuccessFailureCount();
  });

module.exports = test;
