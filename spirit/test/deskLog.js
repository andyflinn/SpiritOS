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

// THE LEAD'S CHAT IS THE LEAD'S TAB INSIDE TEAM (desk/G1.2, D2): pick it,
// then type in Team's box.
function toLead(desk) {
  const target = { getAttribute: function (n) { return n === 'data-agent' ? 'claude-windows' : null; }, parentNode: null };
  const strip = desk.doc.getElementById('desk-agent-tabs');
  strip.fire('click', { target: target, currentTarget: strip });
}
function sayToLead(desk, text) {
  toLead(desk);
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
    sayToLead(desk, 'hello lead');
    return settle();
  }).then(function () {
    const rows = logged(files) || [];
    const out = rows.filter(function (r) { return r.dir === 'out'; });
    if (desk.posts.length === 1 && desk.posts[0].to === LEAD && out.length === 1 &&
        out[0].text === 'hello lead' && out[0].key === 'h-out-1' && out[0].outcome === 'sent') {
      test.check('his line went to the lead once and is logged under the hash it went as');
    } else {
      test.fail('posts ' + JSON.stringify(desk.posts) + ' out rows ' + JSON.stringify(out));
    }
    if (!desk.verbs.length) test.check('the node was asked nothing but jobs.api');
    else test.fail('verbs asked: ' + desk.verbs.join(', '));

    const again = mountDesk({ files: files });
    return settle().then(function () {
      toLead(again);
      const chat = again.doc.getElementById('desk-team').innerHTML;
      const top = again.doc.getElementById('desk-top').innerHTML;
      if (/hello lead/.test(chat) && /Search/.test(top)) {
        test.check('a fresh mount draws the board and the chat from the server\'s record alone');
      } else {
        test.fail('remount drew chat ' + chat.slice(0, 120) + ' / top ' + top.slice(0, 120));
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

function failedSendsStayApart() {
  test.subHeading('Two sends that never crossed are two rows');
  const files = { 'log/log.json': JSON.stringify([{ key: 'h-in-1', at: '2026-09-27T05:00:00Z', dir: 'in', peer: LEAD,
    outcome: 'received', from: 'claude-windows', kind: 'session', text: BOARD, todo: '' }]) };
  const desk = mountDesk({ files: files, refuse: true });
  // Its record loads from the server first (desk/G1.4), the lead with it.
  return settle().then(function () {
    sayToLead(desk, 'one');
    return settle();
  }).then(function () {
    sayToLead(desk, 'two');
    return settle();
  }).then(function () {
    const out = (logged(files) || []).filter(function (r) { return r.dir === 'out'; });
    if (out.length === 2 && out[0].key !== out[1].key && /^undelivered/.test(out[1].outcome)) {
      test.check('each failed send keeps its own row and says it was undelivered');
    } else {
      test.fail('failed sends logged as ' + JSON.stringify(out));
    }
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
    sayToLead(desk, 'typed by andy');
    return settle();
  }).then(function () {
    // What a dialog returned: one line sent to two agents, a new name, a Go!.
    const sent = [
      { key: 'd1', at: '2026-09-27T05:04:00Z', dir: 'out', peer: LEAD, outcome: 'sent', from: 'andy', kind: 'note', text: 'from the row', todo: 'puppets/G2' },
      { key: 'd2', at: '2026-09-27T05:04:00Z', dir: 'out', peer: WSL, outcome: 'sent', from: 'andy', kind: 'note', text: 'from the row', todo: 'puppets/G2' },
      { key: 'd3', at: '2026-09-27T05:05:00Z', dir: 'out', peer: WSL, outcome: 'sent', from: 'andy', kind: 'answer', text: 'retitle: My Name', todo: 'puppets/G2' },
      { key: 'd4', at: '2026-09-27T05:06:00Z', dir: 'out', peer: WSL, outcome: 'sent', from: 'andy', kind: 'answer', text: 'go.', todo: 'puppets/G2' },
      { key: 'd5', at: '2026-09-27T05:06:00Z', dir: 'out', peer: WSL, outcome: 'sent', from: 'andy', kind: 'ask', text: 'explain this to me: what is it, and why is it where it is?', todo: 'puppets/G2' },
    ];
    if (!/Search/.test(desk.doc.getElementById('desk-top').innerHTML)) { test.fail('no row to open'); return null; }
    openRow(desk, 'puppets/G2');
    desk.dialogs[desk.dialogs.length - 1].resolve({ sent: sent });
    return settle().then(function () {
      // The same result again (a second close) writes nothing twice.
      openRow(desk, 'puppets/G2');
      desk.dialogs[desk.dialogs.length - 1].resolve({ sent: sent });
      return settle();
    });
  }).then(function () {
    // Since desk/G1.4 the server keeps it (voice.add), a plain file in its
    // state folder that he moves himself (deskOnServer.js, T4).
    const lines = desk.fake.voice;
    const texts = lines.map(function (l) { return l.text; });
    if (texts.join(' | ') === 'typed by andy | from the row | My Name') {
      test.check('his typed line, the row line once, and his new name; no Go!, no explain request, no agent text');
    } else {
      test.fail('voice holds ' + JSON.stringify(texts));
    }
    if (lines.every(function (l) { return Object.keys(l).join(',') === 'text,day' && /^\d{4}-\d\d-\d\d$/.test(l.day); })) {
      test.check('each row is the vault\'s shape, {text, day}, stamped by the day and never finer');
    } else {
      test.fail('voice rows: ' + JSON.stringify(lines));
    }
  });
}

function twoTabsKeepBoth() {
  test.subHeading('Two Desk tabs do not drop each other\'s lines');
  const files = {};
  const a = mountDesk({ files: files });
  const b = mountDesk({ files: files });
  a.arrive({ from: 'claude-windows', kind: 'session', text: BOARD }, { hash: 'h-in-1', fromKey: LEAD, sentAt: '2026-09-27T05:00:00Z' });
  b.arrive({ from: 'claude-windows', kind: 'session', text: BOARD }, { hash: 'h-in-1', fromKey: LEAD, sentAt: '2026-09-27T05:00:00Z' });
  return settle().then(function () {
    sayToLead(a, 'from tab a');
    return settle();
  }).then(function () {
    sayToLead(b, 'from tab b');
    return settle();
  }).then(function () {
    const texts = (logged(files) || []).filter(function (r) { return r.dir === 'out'; }).map(function (r) { return r.text; }).sort();
    if (texts.join(',') === 'from tab a,from tab b') test.check('the record keeps both tabs\' lines');
    else test.fail('after two tabs the log holds ' + JSON.stringify(texts));
  });
}

function teamGoesToEveryAgent() {
  test.subHeading('Team: one line to every agent, and an agent\'s line shown once');
  const files = {};
  const desk = mountDesk({ files: files });
  const now = new Date().toISOString();
  desk.arrive({ from: 'claude-windows', kind: 'session', text: BOARD }, { hash: 'h-in-1', fromKey: LEAD, sentAt: now });
  desk.arrive({ from: 'wsl-claude', kind: 'note', text: 'hello', todo: 'puppets/G2' }, { hash: 'h-in-2', fromKey: WSL, sentAt: now });
  return settle().then(function () {
    desk.doc.getElementById('desk-team-say').value = 'design talk';
    desk.doc.getElementById('desk-team-send').fire('click');
    return settle();
  }).then(function () {
    const to = desk.posts.map(function (p) { return p.to; }).sort();
    if (to.join(',') === [LEAD, WSL].sort().join(',') && desk.posts.every(function (p) { return p.body.todo === 'team/chat'; })) {
      test.check('his team line went to both agents, under team/chat');
    } else {
      test.fail('team posts ' + JSON.stringify(desk.posts));
    }
    // wsl's answer, direct and again as the report of its copy to the lead.
    desk.arrive({ from: 'wsl-claude', kind: 'note', text: 'agreed', todo: 'team/chat' }, { hash: 'h-t-1', fromKey: WSL, sentAt: now });
    desk.arrive({ from: 'wsl-claude', kind: 'report', text: JSON.stringify({ v: 1, from: 'wsl-claude', to: 'claude-windows', kind: 'note', text: 'agreed', todo: 'team/chat' }) },
      { hash: 'h-t-2', fromKey: WSL, sentAt: now });
    return settle();
  }).then(function () {
    const chat = desk.doc.getElementById('desk-team').innerHTML;
    const mine = (chat.match(/design talk/g) || []).length;
    const theirs = (chat.match(/agreed/g) || []).length;
    if (mine === 1 && theirs === 1) test.check('the chat shows his line once and the agent\'s line once');
    else test.fail('team chat shows his line ' + mine + ' times and the answer ' + theirs + ' times');
    if (!/Search/.test(chat) && !/team\/chat/.test(desk.doc.getElementById('desk-top').innerHTML)) test.check('and team is no row on the list');
    else test.fail('team leaked into the list or the board into team');
  });
}

function unseenIsMarked() {
  // Andy: "... indicating that new stuff has arrived for that item", and
  // "or use the red "*" do indicate "unseen changes have occured"". SINCE
  // desk/G2.6 A ROW'S STAR IS THE DESK SERVER'S: the label says it, and
  // opening the row presses 'seen'.
  test.subHeading('A red * marks the row the server says he has not seen, and opening it presses seen');
  const files = {};
  const desk = mountDesk({ files: files });
  return settle().then(function () {
    const star = /title="unseen changes"/;
    const top = desk.doc.getElementById('desk-top');
    if (!star.test(top.innerHTML)) test.check('no star while the server says none');
    else test.fail('a star with none said: ' + top.innerHTML.slice(0, 160));
    desk.fake.calls.length = 0;
    openRow(desk, 'puppets/G2');
    return settle().then(function () {
      const seen = desk.fake.calls.filter(function (k) { return k.verb === 'press' && k.args.what === 'seen'; });
      if (seen.length === 1 && seen[0].args.id === 'puppets/G2' && seen[0].args.by === 'andy') test.check('opening the row pressed seen for it, as andy');
      else test.fail('presses on opening: ' + JSON.stringify(desk.fake.calls));
    });
  });
}

// THE LOG IN CHUNKS (Andy's "failed to save file: 413") is gone with the
// files: the server keeps every line, and a read is bounded by bytes there
// (deskServer.js, the byte cut; deskOnServer.js, T5b and T6).

arrivalsAndSendsAreLogged()
  .then(unseenIsMarked)
  .then(teamGoesToEveryAgent)
  .then(voiceHoldsWhatHeTyped)
  .then(twoTabsKeepBoth)
  .then(failedSendsStayApart)
  .then(unreachableIsSaid)
  .then(function () { test.reportSuccessFailureCount(); })
  .catch(function (err) {
    test.fail('deskLog threw: ' + ((err && err.stack) || err));
    test.reportSuccessFailureCount();
  });

module.exports = test;
