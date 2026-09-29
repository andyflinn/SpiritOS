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
function fakeFor(files) { if (!fakes.has(files)) fakes.set(files, deskFake.fromFiles(files)); return fakes.get(files); }
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
    onPacket: function (app, fn) { handlers.push({ app: app, fn: fn }); },
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
test.subHeading('Desk names only jobs.api; its dialog names no verb; neither names node.history');
[DESK, DETAILS].forEach(function (f) {
  const src = fs.readFileSync(f, 'utf8');
  const code = src.split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n');
  const named = (code.match(/\.verb\(\s*'([^']*)'/g) || []).map(function (m) { return m.replace(/^\.verb\(\s*'|'$/g, ''); });
  const allowed = f === DESK ? named.every(function (v) { return v === 'jobs.api'; }) && named.length > 0 : !/\.verb\(/.test(code);
  if (allowed && !/node\.history/.test(code)) {
    test.check(path.basename(f) + (f === DESK ? ' names only jobs.api' : ' calls no verb') + ', and never node.history outside a comment');
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

function dialogSendsComeBack() {
  test.subHeading('A row\'s dialog gets its thread from Desk and hands its sends back');
  const files = {};
  const desk = mountDesk({ files: files });
  // RECENT TIMES, NOT FIXED ONES. The dialog sends only to an agent heard
  // from in the last day (deskDetails.js, DD_RECENT_MS), and it takes that
  // time from the thread. Fixed 2026-09-27 stamps made this a time bomb: it
  // went red on its own a day later, with no code changed.
  const justNow = function (minutesAgo) { return new Date(Date.now() - minutesAgo * 60000).toISOString(); };
  desk.arrive({ from: 'claude-windows', kind: 'session', text: BOARD }, { hash: 'h-in-1', fromKey: LEAD, sentAt: justNow(3) });
  desk.arrive({ from: 'wsl-claude', kind: 'explain', text: 'what G2 is', todo: 'puppets/G2' },
    { hash: 'h-in-2', fromKey: WSL, sentAt: justNow(1) });
  return settle().then(function () {
    // The table's row click, as desk.js binds it.
    const params = { id: 'puppets/G2', row: { id: 'puppets/G2', title: 'Search' },
      thread: (logged(files) || []).filter(function (r) { return r.todo === 'puppets/G2'; }),
      agents: { 'wsl-claude': { key: WSL, at: Date.now() } } };

    const doc = fakeDocument();
    const dd = load(DETAILS, doc);
    const posts = [];
    let result;
    const ddApi = {
      escapeHtml: spirit.core.util.escapeHtml,
      verb: function () { throw new Error('the dialog asked the node for a verb'); },
      onPacket: function () {},
      setScreenTitle: function () {},
      setDialogResult: function (r) { result = r; },
      peerPost: function (app, to, body) { posts.push({ to: to, body: body }); return Promise.resolve({ ok: true, status: 200, hash: 'h-dd-' + posts.length }); },
    };
    dd.mount(fakeElement('container'), ddApi);
    dd.open(params);
    if (/what G2 is/.test(doc.getElementById('dd-blurb').innerHTML) && !posts.length) {
      test.check('the explanation comes from the handed thread, so opening asks nothing');
    } else {
      test.fail('blurb ' + doc.getElementById('dd-blurb').innerHTML + ' posts ' + posts.length);
    }
    doc.getElementById('dd-say').value = 'go on';
    doc.getElementById('dd-body').fire('click', { target: { id: 'dd-say-send' } });
    return settle().then(function () {
      const sent = (result && result.sent) || [];
      if (posts.length === 1 && posts[0].to === WSL && sent.length === 1 && sent[0].key === 'h-dd-1' &&
          sent[0].todo === 'puppets/G2' && /go on/.test(doc.getElementById('dd-chat').innerHTML)) {
        test.check('his line went to the agent, shows in the chat, and is the dialog\'s result');
      } else {
        test.fail('posts ' + JSON.stringify(posts) + ' result ' + JSON.stringify(result));
      }
      return sent;
    });
  }).then(function (sent) {
    // DESK'S HALF: a click on the row opens the dialog with that row's
    // thread, and what the dialog returns when it leaves (Back resolves
    // callDialog, as the shell does) goes into Desk's log.
    const rows = desk.doc.getElementById('desk-top').queried['tr[data-id]'] || [];
    const row = rows.filter(function (r) { return r.getAttribute('data-id') === 'puppets/G2'; })[0];
    if (!row) { test.fail('Desk drew no clickable row for puppets/G2'); return null; }
    row.fire('click');
    const opened = desk.dialogs[0];
    if (opened && opened.id === 'shell/deskDetails' && opened.params.thread.length === 1 &&
        opened.params.thread[0].key === 'h-in-2' && opened.params.agents['wsl-claude'].key === WSL) {
      test.check('the row opens its dialog with its own thread and the agents Desk has heard');
    } else {
      test.fail('dialog opened with ' + JSON.stringify(opened && opened.params));
    }
    if (opened) opened.resolve({ sent: sent });
    return settle();
  }).then(function () {
    const back = (logged(files) || []).filter(function (r) { return r.key === 'h-dd-1'; });
    if (back.length === 1 && back[0].dir === 'out' && back[0].text === 'go on') {
      test.check('what he sent from the dialog is in Desk\'s log once it closes');
    } else {
      test.fail('Desk\'s log after the dialog: ' + files['log/log.json']);
    }
  });
}

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
    const rows = desk.doc.getElementById('desk-top').queried['tr[data-id]'] || [];
    if (!rows.length) { test.fail('no row to open'); return null; }
    rows[0].fire('click');
    desk.dialogs[desk.dialogs.length - 1].resolve({ sent: sent });
    return settle().then(function () {
      // The same result again (a second close) writes nothing twice.
      rows[0].fire('click');
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
  test.subHeading('A red * marks what he has not seen, and opening it clears it');
  // Andy: "... indicating that new stuff has arrived for that item", and
  // "or use the red "*" do indicate "unseen changes have occured"".
  const files = {};
  const first = mountDesk({ files: files });
  first.arrive({ from: 'claude-windows', kind: 'session', text: BOARD }, { hash: 'u-1', fromKey: LEAD, sentAt: '2026-09-27T05:00:00Z' });
  first.arrive({ from: 'wsl-claude', kind: 'note', text: 'old news', todo: 'puppets/G2' }, { hash: 'u-2', fromKey: WSL, sentAt: '2026-09-27T05:01:00Z' });
  return settle().then(function () {
    // A Desk opening with a log but no seen.json (the first run of this
    // version) counts all it holds as seen.
    delete files['seen.json'];
    first.fake.docs.seen = '';
    const again = mountDesk({ files: files });
    return settle().then(function () {
      const star = /title="unseen changes"/;
      if (!star.test(again.doc.getElementById('desk-top').innerHTML) && files['seen.json']) {
        test.check('a first open with no seen shows nothing as unseen, and records what it holds');
      } else {
        test.fail('first open: ' + again.doc.getElementById('desk-top').innerHTML.slice(0, 160));
      }
      again.arrive({ from: 'wsl-claude', kind: 'note', text: 'fresh', todo: 'puppets/G2' }, { hash: 'u-3', fromKey: WSL, sentAt: '2026-09-27T05:02:00Z' });
      return settle().then(function () { return again; });
    });
  }).then(function (again) {
    const top = again.doc.getElementById('desk-top');
    if (/title="unseen changes"/.test(top.innerHTML)) test.check('a new arrival under a row puts a red * on that row');
    else test.fail('no mark after a new arrival');
    const rows = top.queried['tr[data-id]'] || [];
    rows[0].fire('click');
    again.dialogs[again.dialogs.length - 1].resolve(null);
    return settle().then(function () {
      again.arrive({ from: 'claude-windows', kind: 'note', text: 'unrelated' }, { hash: 'u-4', fromKey: LEAD, sentAt: '2026-09-27T05:03:00Z' });
      return settle();
    }).then(function () {
      if (!/title="unseen changes"/.test(top.innerHTML)) test.check('opening the row clears its mark, and it stays clear');
      else test.fail('the row is still marked after it was opened');
      const seen = JSON.parse(files['seen.json']);
      if (seen.rows['puppets/G2'] === Date.parse('2026-09-27T05:02:00Z')) test.check('what was seen is kept by seen.set, by arrival time');
      else test.fail('seen.json ' + files['seen.json']);
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
  .then(dialogSendsComeBack)
  .then(function () { test.reportSuccessFailureCount(); })
  .catch(function (err) {
    test.fail('deskLog threw: ' + ((err && err.stack) || err));
    test.reportSuccessFailureCount();
  });

module.exports = test;
