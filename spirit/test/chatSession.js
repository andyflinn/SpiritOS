'use strict';

// Chat 1 — the app says who you are, and remembers it (CYCLE-CHAT-1.md).
//
// Two claims, and both are about a reload:
//
//   1. After a successful Claim the chrome reads "Relay Chat [andy]" —
//      in the app's own heading and in the tab title.
//   2. A reload restores that binding without claiming again, but only
//      if the mailbox still answers a SIGNED inbox read for the label.
//      The stored file is a reminder, never a credential.
//
// Driven here rather than left to the browser: relayChat.js is loaded
// with small document/api/fetch stubs and its real handlers are fired,
// so "claim, reload, still bound" is a test rather than a screenshot.
// Andy still looks at the shell — this only means he is not the first
// to find out.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const spirit = require('../run/js/kernel.js');
// The app reads its logging rules off the same global the shell hands
// it in the browser (index.html loads js/chatLog.js as a script), so the
// stub supplies the real module rather than a lookalike.
const chatLog = require('../run/js/chatLog.js');
const peerFile = require('../run/js/peerFile.js');
// index.html loads this by script tag beside the other two; the app
// reads envelopes with it, so the stub hands over the real module rather
// than a lookalike.
const packet = require('../run/js/packet.js');

const RUN_DIR = path.join(__dirname, '..', 'run');
const APP_SCRIPT = path.join(RUN_DIR, 'app', 'relayChat', 'relayChat.js');

// The mailbox's own key (chat 5.1): what the To list carries for the
// relay row, and what its archive is filed under.
const MAILBOX_KEY = 'MCowBQYDK2VwAyEAmailboxmailboxmailboxmailboxmailb=';

function fakeElement(id) {
  let html = '';
  const el = {
    id: id,
    value: '',
    textContent: '',
    style: {},
    children: [],
    listeners: {},
    addEventListener: function (event, fn) { (el.listeners[event] = el.listeners[event] || []).push(fn); },
    appendChild: function (child) { el.children.push(child); return child; },
    fire: function (event, arg) { (el.listeners[event] || []).forEach(function (fn) { fn(arg || {}); }); },
    // The app presses its own Send button when Enter is pressed, so the
    // stub has to be able to be pressed that way too.
    click: function () { el.fire('click'); },
  };
  Object.defineProperty(el, 'innerHTML', {
    get: function () { return html; },
    set: function (v) { html = String(v); el.children.length = 0; },
    enumerable: true,
  });
  // A <select> is asked what it offers, not only what it reads as: the
  // app decides whether there is anybody to write to by looking at its
  // own options, so the stub builds them from the markup the way a
  // browser does.
  Object.defineProperty(el, 'options', {
    get: function () {
      return html.split('<option').slice(1).map(function (part) {
        const tag = part.split('>')[0];
        const m = /value="([^"]*)"/.exec(tag);
        return { value: m ? m[1] : '', disabled: tag.indexOf('disabled') !== -1 };
      });
    },
    enumerable: true,
  });
  return el;
}

function fakeDocument() {
  const byId = {};
  const doc = {
    title: 'SpiritOS',
    byId: byId,
    getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); },
    createElement: fakeElement,
  };
  return doc;
}

// An api like the one buildApiFor hands an app: fs scoped to this app's
// own folder, backed by a plain object so the test can see what was
// written and hand back what a reload would find.
function fakeApi(store, project) {
  return {
    escapeHtml: spirit.core.util.escapeHtml,
    // The unscoped read a system app is handed (CLEANUP-PLAN step 6).
    // Relay Chat uses it for one thing: whether Natter lists a mailbox
    // at all, which decides whether there is anything to claim on.
    readProject: function (path) {
      return Object.prototype.hasOwnProperty.call(project || {}, path) ? project[path] : null;
    },
    fs: {
      loadFile: function (name) { return Object.prototype.hasOwnProperty.call(store, name) ? store[name] : null; },
      saveFile: function (name, content) { store[name] = content; return Promise.resolve(); },
      deleteFile: function (name) { delete store[name]; return { ok: true }; },
    },
  };
}

// Answers the hub calls the app makes. `inboxStatus` is what the mailbox
// says about the stored label: 200 is "still yours", 403 is "not any
// more" — the only two answers the reload path cares about.
function fakeFetch(log, options) {
  return function (url, init) {
    log.push({ url: url, method: (init && init.method) || 'GET', body: init && init.body });
    const body = {
      messages: options.messages || [],
      ownedUrls: options.ownedUrls || [],
      rows: options.rows || [],
      mustPick: !!options.mustPick,
      people: options.people || [],
      reservedName: 'relay',
      mailboxPublicKey: options.mailboxPublicKey || null,
      selfTail: options.selfTail || null,
      matches: options.matches || [],
      unknown: options.unknown || 0,
    };
    let status = 200;
    let payload = body;

    if (url.indexOf('/api/hub/inbox') === 0) {
      status = options.inboxStatus || 200;
    } else if (url.indexOf('/api/hub/claim') === 0) {
      status = options.claimStatus || 201;
      if (options.claimBody) payload = options.claimBody;
    } else if (url.indexOf('/api/hub/send') === 0) {
      // What the relay answers a send with: the message it stored, which
      // is the only copy of an outgoing line that will ever exist.
      status = options.sendStatus || 201;
      if (options.sendBody) payload = options.sendBody;
    }

    const text = JSON.stringify(payload);

    return Promise.resolve({
      status: status,
      text: function () { return Promise.resolve(text); },
      json: function () { return Promise.resolve(JSON.parse(text)); },
    });
  };
}

// Mounts the real app and returns the pieces a test needs to poke it.
function mountApp(store, options) {
  const doc = fakeDocument();
  const log = [];
  const api = fakeApi(store, (options && options.project) || {
    'app/natter/relays.json': JSON.stringify([{ label: 'spirit', url: 'https://spirit.example' }]),
  });
  let behavior = null;
  const shellSpirit = {
    shell: { activateApp: function (b) { behavior = b; } },
    core: { util: { escapeHtml: spirit.core.util.escapeHtml }, const: { ICON: spirit.core.const.ICON } },
  };

  const src = fs.readFileSync(APP_SCRIPT, 'utf8');
  new Function('spirit', 'document', 'window', 'fetch', 'setInterval', src)(
    shellSpirit, doc, { spiritChatLog: chatLog, spiritPeerFile: peerFile, spiritPacket: packet },
    fakeFetch(log, options || {}), function () { return 0; }
  );

  const container = fakeElement('container');
  behavior.mount(container, api, null);
  return { doc: doc, api: api, store: store, log: log, container: container };
}

// getElementById creates on demand in this stub, exactly as a real
// document would already have the node: the app looks ids up lazily
// inside its handlers, so byId is only populated where it has looked.
function el(app, id) {
  return app.doc.getElementById(id);
}

// What a click hands a delegated listener: the element it landed on,
// which answers closest() for the id it is inside.
function closestStub(id) {
  return { closest: function (selector) { return selector === '#' + id ? { id: id } : null; } };
}

function titleOf(app) {
  return el(app, 'rc-title').textContent;
}

// Lets the app's own promise chains settle — every path here is one or
// two thenables deep, never a timer.
function settle() {
  return new Promise(function (resolve) { setImmediate(resolve); })
    .then(function () { return new Promise(function (r) { setImmediate(r); }); });
}

test.startTest('Relay Chat — bound to a name, and still bound after a reload');

// A bound node with an empty address book. It has a name and a mailbox
// and still nobody to say anything to, so the three controls for saying
// something are not on the page.
function nobodyToWriteTo() {
  test.subHeading('A name, a mailbox, and nobody yet');

  const store = { 'session.json': JSON.stringify({ label: 'jim', boundAt: '2026-09-07T00:00:00.000Z' }) };
  const app = mountApp(store, {
    inboxStatus: 200,
    people: [],
    selfTail: 'Zv0gX0=',
    mailboxPublicKey: MAILBOX_KEY,
    rows: [{ url: 'https://spirit.example', label: 'spirit.example', owned: false }],
  });

  return settle().then(function () {
    const dead = ['rc-thread', 'rc-composer']
      .filter(function (id) { return el(app, id).style.display !== 'none'; });
    if (dead.length === 0) {
      test.check('no thread, no say-something box, no Send');
    } else {
      test.fail('still shown with nobody to write to: ' + dead.join(', '));
    }

    // What IS on the page is the way out of that state: the list saying
    // so, and the panel for adding somebody.
    const alive = ['rc-to-pick', 'rc-to-bar']
      .filter(function (id) { return el(app, id).style.display === 'none'; });
    if (alive.length === 0 && /nobody yet/.test(el(app, 'rc-to-pick').innerHTML)) {
      test.check('but the list and Add someone by handle stay');
    } else {
      test.fail('hidden too: ' + alive.join(', ') + ' / ' + el(app, 'rc-to-pick').innerHTML);
    }

    // The mailbox is somebody to write to — it is where `whoami` is
    // typed. Under All it is in the list, so the composer is back.
    el(app, 'rc-filter-all').fire('click');
    return settle().then(function () {
      if (el(app, 'rc-composer').style.display !== 'none' &&
          el(app, 'rc-to-pick').innerHTML.indexOf(MAILBOX_KEY) !== -1) {
        test.check('and it comes back for the mailbox under All');
      } else {
        test.fail('composer stayed hidden with the mailbox listed');
      }
    });
  });
}

// Contacts cut 2 — adding somebody by handle ends in a spoken tail, so
// both people need one on screen: the one adding reads the rows, the one
// being added reads their own.
function ownTailIsReadable() {
  test.subHeading('Your own key, in fine print at the foot of the page');

  const store = { 'session.json': JSON.stringify({ label: 'andy', boundAt: '2026-09-07T00:00:00.000Z' }) };
  const app = mountApp(store, {
    inboxStatus: 200,
    selfTail: 'mjowM=',
    people: [{ publicKey: 'KEY-BERT', publicLabel: 'bert', caption: 'bert', mine: false }],
    rows: [{ url: 'https://spirit.example', label: 'spirit.example', owned: false }],
  });

  return settle().then(function () {
    // Read out over the phone by somebody who was told "the bottom of
    // your chat app" and nothing else, so it has to say whose key it is
    // and what it ends with, on the page, with nothing to open.
    const foot = el(app, 'rc-footer').textContent;
    if (foot.indexOf('mjowM=') !== -1 && foot.indexOf('andy') !== -1) {
      test.check('the footer names this node and what its key ends with');
    } else {
      test.fail('footer: ' + foot);
    }

    // The unread count moves; the footer does not. Somebody mid-sentence
    // on the phone should not have the line change under them.
    const before = el(app, 'rc-footer').textContent;
    app.doc.title = '';
    el(app, 'rc-filter-all').fire('click');
    return settle().then(function () {
      if (el(app, 'rc-footer').textContent === before) {
        test.check('and it stays put while the rest of the page moves');
      } else {
        test.fail('footer moved: ' + el(app, 'rc-footer').textContent);
      }
    });
  });
}

// Adding somebody moved to Contacts with the rest of the address book
// (packet 2). What chat must not do is grow it back.
function noAddressBookInChat() {
  test.subHeading('The chat window does not edit the address book');

  const store = { 'session.json': JSON.stringify({ label: 'andy', boundAt: '2026-09-07T00:00:00.000Z' }) };
  const app = mountApp(store, { inboxStatus: 200 });

  return settle().then(function () {
    const page = app.container.innerHTML;
    const grown = ['rc-add-panel', 'rc-add-handle', 'rc-add-find', 'rc-add-out']
      .filter(function (id) { return page.indexOf(id) !== -1; });
    if (grown.length === 0) {
      test.check('no add-by-handle chrome anywhere in the chat page');
    } else {
      test.fail('still in the chat window: ' + grown.join(', '));
    }

    // And the source no longer knows how: a panel nobody mounts is a
    // panel somebody mounts again.
    //
    // One write stays, and it is not address-book UI: acquireInvited
    // files the key that claimed a label this node minted an invite for.
    // Invite stays in chat by this cycle's own note, and that acquire is
    // the invite's consequence rather than a way to edit the book — it
    // has no control, and a human is never asked.
    const src = fs.readFileSync(APP_SCRIPT, 'utf8');
    if (src.indexOf('findByHandle') === -1 && src.indexOf('/api/hub/peer') === -1) {
      test.check('and it offers no way to add, accept, block or rename anybody');
    } else {
      test.fail('relayChat.js still carries address-book verbs');
    }

    if ((src.match(/api\/hub\/contact/g) || []).length === 1 && /via: 'invite'/.test(src)) {
      test.check('the one contact write left is the invite it just minted');
    } else {
      test.fail('unexpected contact writes in relayChat.js');
    }
  });
}

// A node nobody has told its key cannot invent one.
function noTailNoLine() {
  test.subHeading('And says nothing when there is nothing to say');

  const store = { 'session.json': JSON.stringify({ label: 'andy', boundAt: '2026-09-07T00:00:00.000Z' }) };
  const app = mountApp(store, {
    inboxStatus: 200,
    rows: [{ url: 'https://spirit.example', label: 'spirit.example', owned: false }],
  });

  return settle().then(function () {
    if (el(app, 'rc-footer').textContent === '') {
      test.check('no key, no promise about one');
    } else {
      test.fail('invented a tail: ' + el(app, 'rc-footer').textContent);
    }
  });
}

function claimBinds() {
  test.subHeading('Claim binds the chrome');

  const store = {};
  const app = mountApp(store, { claimStatus: 201, claimBody: { peer: { name: 'andy' } } });

  // The heading inside the app. The browser tab is the shell's — it says
  // which NODE this window is, so several of them can be told apart —
  // and this app must not write to it.
  if (titleOf(app) === 'Relay Chat' && app.doc.title === 'SpiritOS') {
    test.check('before any claim the chrome is plain "Relay Chat", and the tab belongs to the shell');
  } else {
    test.fail('unbound title: ' + titleOf(app) + ' / ' + app.doc.title);
  }

  el(app, 'rc-name').value = 'andy';
  el(app, 'rc-claim').fire('click');

  return settle().then(function () {
    if (titleOf(app) === 'Relay Chat [andy]' && app.doc.title === 'SpiritOS') {
      test.check('a 201 claim puts the label in the heading and the tab title');
    } else {
      test.fail('bound title: ' + titleOf(app) + ' / ' + app.doc.title);
    }

    let stored = null;
    try { stored = JSON.parse(store['session.json']); } catch (e) { stored = null; }
    if (stored && stored.label === 'andy' && stored.boundAt) {
      test.check('and the binding is written to this app\'s own session.json');
    } else {
      test.fail('session.json: ' + JSON.stringify(store));
    }

    // A 409 on someone else's name is not a session — the node only
    // treats a conflict as its own when the peer carries its key.
    const other = mountApp({}, { claimStatus: 409, claimBody: { mine: false, peer: { name: 'andy' } } });
    el(other, 'rc-name').value = 'andy';
    el(other, 'rc-claim').fire('click');
    return settle().then(function () {
      if (titleOf(other) === 'Relay Chat' && other.store['session.json'] === undefined) {
        test.check('a 409 that is not ours binds nothing and writes nothing');
      } else {
        test.fail('foreign 409: ' + titleOf(other) + ' ' + JSON.stringify(other.store));
      }
    });
  });
}

function reloadRestores() {
  test.subHeading('Reload restores it, if the mailbox agrees');

  // A reload is a fresh mount against the same node's files.
  const store = { 'session.json': JSON.stringify({ label: 'andy', boundAt: '2026-09-07T00:00:00.000Z' }) };
  const app = mountApp(store, { inboxStatus: 200 });

  return settle().then(function () {
    if (titleOf(app) === 'Relay Chat [andy]') {
      test.check('a stored label the mailbox still answers for comes back bound');
    } else {
      test.fail('restored title: ' + titleOf(app));
    }

    if (el(app, 'rc-name').value === 'andy') {
      test.check('and the name field is filled in, so Claim is not the next move');
    } else {
      test.fail('name field: ' + el(app, 'rc-name').value);
    }

    // It asked, and it asked the signed way — an inbox read, not a
    // second claim.
    const asked = app.log.filter(function (r) { return r.url.indexOf('/api/hub/inbox') === 0; });
    const claimed = app.log.filter(function (r) { return r.url.indexOf('/api/hub/claim') === 0; });
    if (asked.length >= 1 && claimed.length === 0) {
      test.check('restoring asks the mailbox with a signed inbox read, and claims nothing');
    } else {
      test.fail('calls: ' + JSON.stringify(app.log));
    }

    // The other answer: the label is not this node's any more — a
    // cutover that emptied the mailbox, or somebody else holding it.
    const stale = { 'session.json': JSON.stringify({ label: 'andy', boundAt: '2026-09-07T00:00:00.000Z' }) };
    const gone = mountApp(stale, { inboxStatus: 403 });
    return settle().then(function () {
      if (titleOf(gone) === 'Relay Chat') {
        test.check('a 403 shows unbound rather than a name this node cannot use');
      } else {
        test.fail('stale title: ' + titleOf(gone));
      }

      if (stale['session.json'] === undefined) {
        test.check('and the stale file is dropped, so it is not re-checked forever');
      } else {
        test.fail('session.json survived a 403: ' + JSON.stringify(stale));
      }
    });
  });
}

function nothingStored() {
  test.subHeading('A node that never claimed');

  const app = mountApp({}, {});
  return settle().then(function () {
    if (titleOf(app) === 'Relay Chat' && app.log.length === 0) {
      test.check('no session file, no questions asked of the mailbox');
    } else {
      test.fail('unbound node called: ' + JSON.stringify(app.log));
    }

    // The file is the app's own, inside its scoped folder — and the
    // kernel would refuse it anywhere else.
    if (spirit.core.fs.fileWritable('app/relayChat/session.json') &&
        !spirit.core.fs.fileWritable('app/relayChat/relayChat.js') &&
        !spirit.core.fs.fileWritable('app/relayChat/relayChat.json')) {
      test.check("session.json is writable where the app's own code is not");
    } else {
      test.fail('writable rules changed under this app');
    }
  });
}

// Chat 3 — the log is a thread, and your lines are told from theirs by
// class. Not a screenshot test: the two classes are the whole contract
// the CSS hangs off, so they are worth asserting even though the look
// itself is Andy's call.
function threadMarksOwnLines() {
  test.subHeading('Own lines and other lines carry different classes');

  // Keyed, because that is what the mailbox sends and what chat 5.1
  // files: a peer is a key, and a line whose other party has none is not
  // written down at all.
  const BERT = 'MCowBQYDK2VwAyEAbertbertbertbertbertbertbertbertbertb=';
  const ME = 'MCowBQYDK2VwAyEAandyandyandyandyandyandyandyandyandya=';
  const store = { 'session.json': JSON.stringify({ label: 'andy', boundAt: '2026-09-07T00:00:00.000Z' }) };
  const app = mountApp(store, {
    inboxStatus: 200,
    people: [{ publicKey: BERT, publicLabel: 'bert', caption: 'bert', mine: false }],
    // An inbox read only ever returns what was addressed to this node.
    // The other half of the thread arrives the only way it can: as the
    // 201 the relay answers a send with.
    messages: [
      { id: '1', from: 'bert', to: 'andy', fromKey: BERT, toKey: ME, text: 'a word from bert', sentAt: '2026-09-07T10:00:00.000Z' },
    ],
    sendBody: { id: '2', from: 'andy', to: 'bert', fromKey: ME, toKey: BERT, text: 'and one back', sentAt: '2026-09-07T10:01:00.000Z' },
  });

  return settle().then(function () {
    // Say something back, so the thread has both halves in it.
    el(app, 'rc-to-pick').value = BERT;
    el(app, 'rc-text').value = 'and one back';
    el(app, 'rc-send').fire('click');
    return settle();
  }).then(function () {
    const html = el(app, 'rc-thread').innerHTML;
    if (/rc-msg them/.test(html) && /rc-msg me/.test(html)) {
      test.check('a line from another peer and a line of your own render differently');
    } else {
      test.fail('thread html: ' + html);
    }

    // Both halves were filed, under the one peer, in the order they
    // happened — which is what a reload will read back.
    const filed = chatLog.parse(app.store[chatLog.fileFor(BERT)]);
    if (filed.peerPublicKey === BERT &&
        filed.entries.map(function (e) { return e.dir; }).join(',') === 'received,sent') {
      test.check('and both are in that peer file, received then sent');
    } else {
      test.fail('filed: ' + JSON.stringify(filed));
    }

    // Everything in a thread came off a mailbox any peer can write to.
    const nasty = mountApp({ 'session.json': JSON.stringify({ label: 'andy' }) }, {
      inboxStatus: 200,
      people: [{ publicKey: BERT, publicLabel: '<img src=x onerror=alert(1)>', caption: '<img src=x onerror=alert(1)>', mine: false }],
      messages: [{
        id: '3', from: '<img src=x onerror=alert(1)>', to: 'andy',
        fromKey: BERT, toKey: ME,
        text: '<script>bad()</script>', sentAt: '2026-09-07T10:02:00.000Z',
      }],
    });
    return settle().then(function () {
      // A thread is one conversation now, so there is one to pick before
      // there is anything to escape.
      el(nasty, 'rc-to-pick').value = BERT;
      el(nasty, 'rc-to-pick').fire('change');
      const html2 = el(nasty, 'rc-thread').innerHTML;
      if (html2.indexOf('<script>') === -1 && html2.indexOf('<img') === -1 && html2.indexOf('&lt;script&gt;') !== -1) {
        test.check('and both the text and the sender name are escaped');
      } else {
        test.fail('unescaped thread: ' + html2);
      }

      // The option text is escaped too: a caption comes off the mailbox
      // the same way a message does.
      const options = el(nasty, 'rc-to-pick').innerHTML;
      if (options.indexOf('<img') === -1 && options.indexOf('&lt;img') !== -1) {
        test.check('and so is a peer caption in the To list');
      } else {
        test.fail('unescaped option: ' + options);
      }
    });
  });
}

// Chat 3.1 — the To control is the only way to say who a line is for,
// so what it offers is the whole of what can be said.
function composerOffersTheMailbox() {
  test.subHeading('The To list holds keys, and one selectable mailbox');

  const store = { 'session.json': JSON.stringify({ label: 'andy', boundAt: '2026-09-07T00:00:00.000Z' }) };
  const app = mountApp(store, {
    inboxStatus: 200,
    people: [{ publicKey: 'KEY-BERT', publicLabel: 'bert', caption: 'bert', mine: false }],
    mailboxPublicKey: MAILBOX_KEY,
    ownedUrls: ['https://spirit.example'],
    rows: [
      { url: 'https://spirit.example', label: 'spirit.example', owned: true },
      { url: 'https://second.example', label: 'second.example', owned: false },
    ],
  });

  return settle().then(function () {
    // Default filter is peers, so that is what the list holds: a peer,
    // by key, and no mailbox row until it is asked for.
    const peersOnly = el(app, 'rc-to-pick').innerHTML;
    if (peersOnly.indexOf('value="KEY-BERT"') !== -1 && peersOnly.indexOf(MAILBOX_KEY) === -1) {
      test.check('the peers filter shows peers, by key, and no relay row');
    } else {
      test.fail('peers filter: ' + peersOnly);
    }

    // A To value is a key — a peer's, or the mailbox's own. `relay` is
    // what the WIRE calls the mailbox when a line is addressed to it,
    // and it is never a value in this control.
    el(app, 'rc-filter-all').fire('click');
    const html = el(app, 'rc-to-pick').innerHTML;

    if (html.indexOf('value="' + MAILBOX_KEY + '"') !== -1 && html.indexOf('value="KEY-BERT"') !== -1) {
      test.check('and All shows the mailbox beside them, also by key');
    } else {
      test.fail('options: ' + html);
    }

    if (html.indexOf('value="relay"') === -1) {
      test.check('the reserved caption is never a value here');
    } else {
      test.fail('the literal relay is still an option value');
    }

    if (/optgroup label="Peers"/.test(html) && /optgroup label="Relays"/.test(html)) {
      test.check('peers and relays read as two kinds of row');
    } else {
      test.fail('no optgroups: ' + html);
    }

    // Only relays.json[0] is selectable: it is the one mailbox the hub
    // speaks to, and a row that looked selected while sending somewhere
    // else would be a promise this node cannot keep.
    if (/second\.example.*not the mailbox this node speaks to/.test(html) && /disabled/.test(html)) {
      test.check('a second Natter row is named and inert, with the reason');
    } else {
      test.fail('second relay row: ' + html);
    }

    // The filter is remembered; the search is not.
    let saved = null;
    try { saved = JSON.parse(app.store['view.json']); } catch (e) { saved = null; }
    if (saved && saved.filter === 'all' && saved.search === undefined) {
      test.check('the filter is written to view.json and the search is not');
    } else {
      test.fail('view.json: ' + JSON.stringify(app.store['view.json']));
    }

    if (app.store['session.json'].indexOf('filter') === -1) {
      test.check('and session.json is still only who this node is');
    } else {
      test.fail('session.json grew a view: ' + app.store['session.json']);
    }

    // The ghost box is gone: there is no second control that could aim a
    // line at a name nobody holds.
    if (app.container.innerHTML.indexOf('id="rc-to"') === -1) {
      test.check('and there is no free-text destination beside it');
    } else {
      test.fail('the typed destination box is still in the markup');
    }
  });
}

// Chat 4 — the mint UI belongs to whoever owns a mailbox, and to
// nobody else. Not hidden for a friend: not built for them.
function inviteOnlyForAnOwner() {
  test.subHeading('Invite exists only when this node owns a mailbox');

  const bound = { 'session.json': JSON.stringify({ label: 'saint', boundAt: '2026-09-07T00:00:00.000Z' }) };
  const friend = mountApp(bound, { inboxStatus: 200, ownedUrls: [], rows: [] });

  return settle().then(function () {
    const html = friend.container.innerHTML + el(friend, 'rc-invite-slot').innerHTML;
    if (html.indexOf('rc-invite-panel') === -1 && html.indexOf('rc-inv-go') === -1 && html.indexOf('rc-inv-token') === -1) {
      test.check('a node that owns nothing has no invite markup at all');
    } else {
      test.fail('mint UI present for a non-owner: ' + html);
    }

    // The owner of one mailbox: panel, no picker — there is nothing to
    // pick between.
    const owner = mountApp({ 'session.json': JSON.stringify({ label: 'andy' }) }, {
      inboxStatus: 200,
      ownedUrls: ['https://spirit.example'],
      rows: [{ url: 'https://spirit.example', label: 'spirit.example', owned: true }],
    });
    return settle().then(function () {
      const slot = el(owner, 'rc-invite-slot').innerHTML;
      if (slot.indexOf('rc-invite-panel') !== -1 && slot.indexOf('rc-inv-go') !== -1) {
        test.check('an owner gets the panel');
      } else {
        test.fail('owner slot: ' + slot);
      }
      // It says what it does. "Invite someone" beside "Add someone by
      // handle" reads as two ways to do one thing; the relay is the
      // difference, and it is what the invite is for.
      if (slot.indexOf('<summary>Invite someone to a relay</summary>') !== -1) {
        test.check('and it says what it invites them to');
      } else {
        test.fail('summary: ' + slot);
      }
      if (slot.indexOf('rc-inv-pick') === -1) {
        test.check('and no mailbox picker, with only one mailbox owned');
      } else {
        test.fail('picker drawn for a single mailbox: ' + slot);
      }

      // Two owned mailboxes: the picker is a question that has to be
      // asked (cycle A), and it is built from the owned rows.
      const two = mountApp({ 'session.json': JSON.stringify({ label: 'andy' }) }, {
        inboxStatus: 200,
        ownedUrls: ['https://one.example', 'https://two.example'],
        mustPick: true,
        rows: [
          { url: 'https://one.example', label: 'one', owned: true },
          { url: 'https://two.example', label: 'two', owned: true },
          { url: 'https://three.example', label: 'three', owned: false },
        ],
      });
      return settle().then(function () {
        const slot2 = el(two, 'rc-invite-slot').innerHTML;
        const owned = (slot2.match(/<option/g) || []).length;
        if (slot2.indexOf('rc-inv-pick') !== -1 && owned === 2) {
          test.check('two owned mailboxes get a picker of exactly those two');
        } else {
          test.fail('picker options: ' + slot2);
        }
      });
    });
  });
}

// Enter sends, and sends ONCE. This exists because restoring a lost
// block left two identical keydown handlers on the text box for a
// while, and two handlers is two messages for one press — the kind of
// thing nobody notices until a line is said twice to somebody.
function enterSendsExactlyOnce() {
  test.subHeading('Enter sends one message');

  const store = { 'session.json': JSON.stringify({ label: 'andy', boundAt: '2026-09-07T00:00:00.000Z' }) };
  const app = mountApp(store, { inboxStatus: 200 });

  return settle().then(function () {
    el(app, 'rc-to-pick').value = 'relay';
    el(app, 'rc-text').value = 'hello mailbox';
    const before = app.log.filter(function (r) { return r.url === '/api/hub/send'; }).length;

    el(app, 'rc-text').fire('keydown', { key: 'Enter', preventDefault: function () {} });

    return settle().then(function () {
      const sends = app.log.filter(function (r) { return r.url === '/api/hub/send'; }).length - before;
      if (sends === 1) {
        test.check('one Enter is one send');
      } else {
        test.fail('sends for one Enter: ' + sends);
      }

      // And a key that is not Enter says nothing at all.
      el(app, 'rc-text').value = 'not yet';
      el(app, 'rc-text').fire('keydown', { key: 'a', preventDefault: function () {} });
      return settle().then(function () {
        const after = app.log.filter(function (r) { return r.url === '/api/hub/send'; }).length - before;
        if (after === 1) {
          test.check('and an ordinary keystroke sends nothing');
        } else {
          test.fail('sends after a plain keystroke: ' + after);
        }
      });
    });
  });
}

// The claim row is setup, not conversation: once this node is bound it
// has nothing to offer, and a chat that asks your name every visit reads
// as a form. It has to come back the moment the binding stops being
// true, or a node whose label was taken has no way back in.
function claimRowHidesOnceBound() {
  test.subHeading('The claim row goes away once you are bound');

  const fresh = mountApp({}, {});
  return settle().then(function () {
    if (el(fresh, 'rc-claim-row').style.display !== 'none') {
      test.check('an unclaimed node shows the claim row');
    } else {
      test.fail('claim row hidden on a node that never claimed');
    }

    fresh.doc.getElementById('rc-name').value = 'andy';
    fresh.doc.getElementById('rc-claim').fire('click');
    return settle();
  }).then(function () {
    if (el(fresh, 'rc-claim-row').style.display === 'none') {
      test.check('and hides it as soon as the claim lands');
    } else {
      test.fail('claim row still shown after binding');
    }

    // A reload of a node that is still recognised: bound before the
    // human sees anything, so the row never appears.
    const back = mountApp({ 'session.json': JSON.stringify({ label: 'andy' }) }, { inboxStatus: 200 });
    return settle().then(function () {
      if (el(back, 'rc-claim-row').style.display === 'none') {
        test.check('a restored session stays hidden too');
      } else {
        test.fail('claim row shown after a successful restore');
      }

      // ...and the way back: the mailbox no longer answers for that
      // label, so the row returns without anyone asking for it.
      const lost = mountApp({ 'session.json': JSON.stringify({ label: 'andy' }) }, { inboxStatus: 403 });
      return settle().then(function () {
        if (el(lost, 'rc-claim-row').style.display !== 'none') {
          test.check('a label the mailbox has stopped recognising brings it back');
        } else {
          test.fail('no way to claim again after a 403');
        }
      });
    });
  });
}

// Chat 6 — what was on screen last time, and what happens when the
// person who was on it is gone.
function viewIsRemembered() {
  test.subHeading('The last conversation comes back; a missing one is not replaced');

  const BERT = 'MCowBQYDK2VwAyEAbertbertbertbertbertbertbertbertbertb=';
  const JOHN = 'MCowBQYDK2VwAyEAjohnjohnjohnjohnjohnjohnjohnjohnjohn=';
  const bound = { label: 'andy', boundAt: '2026-09-07T00:00:00.000Z' };
  const two = [
    { publicKey: BERT, publicLabel: 'bert', caption: 'bert', mine: false },
    { publicKey: JOHN, publicLabel: 'john', caption: 'john', mine: false },
  ];

  // A node that was last looking at bert.
  const store = {
    'session.json': JSON.stringify(bound),
    'view.json': JSON.stringify({ toKey: BERT, filter: 'peers', lastSeen: {} }),
  };
  const app = mountApp(store, { inboxStatus: 200, people: two });

  return settle().then(function () {
    if (el(app, 'rc-to-pick').value === BERT) {
      test.check('the To that was open is selected again');
    } else {
      test.fail('restored To: ' + el(app, 'rc-to-pick').value);
    }

    // A remembered relay row with a peers filter: restore the To first,
    // then widen the filter until that row can be seen. A conversation
    // filtered out of its own list is one the app lost for you.
    const MAILBOX = 'MCowBQYDK2VwAyEAmailboxmailboxmailboxmailboxmailb=';
    const relayStore = {
      'session.json': JSON.stringify(bound),
      'view.json': JSON.stringify({ toKey: MAILBOX, filter: 'peers', lastSeen: {} }),
    };
    const onRelay = mountApp(relayStore, {
      inboxStatus: 200,
      people: two,
      mailboxPublicKey: MAILBOX,
      rows: [{ url: 'https://spirit.example', label: 'spirit.example', owned: true }],
      ownedUrls: ['https://spirit.example'],
    });

    return settle().then(function () {
      if (el(onRelay, 'rc-to-pick').value === MAILBOX) {
        test.check('a remembered mailbox row widens the filter rather than vanishing');
      } else {
        test.fail('relay restore: ' + el(onRelay, 'rc-to-pick').innerHTML);
      }

      // And the one that matters: the peer is gone from the mailbox.
      // Selecting the neighbour would be the app deciding who you meant.
      const goneStore = {
        'session.json': JSON.stringify(bound),
        'view.json': JSON.stringify({ toKey: BERT, filter: 'peers', lastSeen: {} }),
      };
      const gone = mountApp(goneStore, {
        inboxStatus: 200,
        people: [{ publicKey: JOHN, publicLabel: 'john', caption: 'john', mine: false }],
      });

      return settle().then(function () {
        if (el(gone, 'rc-to-pick').value === '') {
          test.check('a To the mailbox no longer has selects nobody');
        } else {
          test.fail('picked a neighbour: ' + el(gone, 'rc-to-pick').value);
        }

        if (/is gone/.test(el(gone, 'rc-thread').innerHTML)) {
          test.check('and the thread says so rather than showing an empty room');
        } else {
          test.fail('thread: ' + el(gone, 'rc-thread').innerHTML);
        }

        let saved = null;
        try { saved = JSON.parse(goneStore['view.json']); } catch (e) { saved = null; }
        if (saved && saved.toKey === '') {
          test.check('the missing To is forgotten, so it is not asked about forever');
        } else {
          test.fail('view.json: ' + goneStore['view.json']);
        }
      });
    });
  });
}

// A dot on a row whose archive grew since it was last read. Without it,
// a thread scoped to one peer hides mail from everyone else.
function unreadDots() {
  test.subHeading('A row with something new carries a mark');

  const BERT = 'MCowBQYDK2VwAyEAbertbertbertbertbertbertbertbertbertb=';
  const ME = 'MCowBQYDK2VwAyEAandyandyandyandyandyandyandyandyandya=';
  const store = {
    'session.json': JSON.stringify({ label: 'andy', boundAt: '2026-09-07T00:00:00.000Z' }),
  };
  const app = mountApp(store, {
    inboxStatus: 200,
    people: [{ publicKey: BERT, publicLabel: 'bert', caption: 'bert', mine: false }],
    messages: [{
      id: '9', from: 'bert', to: 'andy', fromKey: BERT, toKey: ME,
      text: 'while you were out', sentAt: '2026-09-08T09:00:00.000Z',
    }],
  });

  return settle().then(function () {
    if (/•\s*bert/.test(el(app, 'rc-to-pick').innerHTML)) {
      test.check('an unread line marks its row');
    } else {
      test.fail('no mark: ' + el(app, 'rc-to-pick').innerHTML);
    }

    // Reading it is what clears it, and that is remembered — otherwise a
    // reload lights every row up again.
    el(app, 'rc-to-pick').value = BERT;
    el(app, 'rc-to-pick').fire('change');

    return settle().then(function () {
      if (!/•/.test(el(app, 'rc-to-pick').innerHTML)) {
        test.check('opening the conversation clears it');
      } else {
        test.fail('mark survived: ' + el(app, 'rc-to-pick').innerHTML);
      }

      let saved = null;
      try { saved = JSON.parse(store['view.json']); } catch (e) { saved = null; }
      if (saved && saved.lastSeen && saved.lastSeen[BERT] === '2026-09-08T09:00:00.000Z') {
        test.check('and how far it was read is written down');
      } else {
        test.fail('lastSeen: ' + store['view.json']);
      }
    });
  });
}

// Chat 7 — nothing on the page that cannot work yet, and mail you are
// not looking at is on its row rather than in the open thread.
// The way in for somebody who has neither an invite nor a mailbox of
// their own. On a fresh node this paragraph is the whole page.
function unboundSaysHowToGetIn() {
  test.subHeading('The paragraph that gets a stranger from reading to using');

  const app = mountApp({}, { inboxStatus: 200 });

  return settle().then(function () {
    const note = el(app, 'rc-unbound').innerHTML;
    if (/<strong>[^<]*countinn@gmail\.com[^<]*<\/strong>/.test(note)) {
      test.check('an unbound node says who to ask, and says it loudly');
    } else {
      test.fail('unbound copy: ' + note);
    }

    if (/within 24 hours/.test(note) && /If you were invited/.test(note)) {
      test.check('and it is added to the claim instructions, not instead of them');
    } else {
      test.fail('copy lost its first half: ' + note);
    }

    // A node with no mailbox listed has a different problem and gets the
    // other sentence — being told to ask for an invite would be an
    // answer to a question it has not reached yet.
    const noRelay = mountApp({}, { inboxStatus: 200, project: {} });
    return settle().then(function () {
      if (/no mailbox yet/.test(el(noRelay, 'rc-unbound').innerHTML)) {
        test.check('and a node with nowhere to claim still hears about Natter first');
      } else {
        test.fail('no-relay copy: ' + el(noRelay, 'rc-unbound').innerHTML);
      }
    });
  });
}

function unboundChrome() {
  test.subHeading('What an unbound node is offered');

  // No mailbox in Natter: a name on a mailbox that does not exist is not
  // something this node can do, so it is not offered — the page says
  // where to go instead.
  const empty = mountApp({}, { project: { 'app/natter/relays.json': '[]' } });

  return settle().then(function () {
    // The instruction and the form share one tile — two bubbles of
    // different widths read as two unrelated things — so what goes is
    // the FIELDS, not the tile that carries the sentence.
    if (el(empty, 'rc-claim-fields').style.display === 'none' &&
        el(empty, 'rc-claim-row').style.display !== 'none') {
      test.check('with no mailbox in Natter there is no Claim to press, but there is still the sentence');
    } else {
      test.fail('claim fields shown with an empty Natter');
    }

    const note = el(empty, 'rc-unbound').innerHTML;
    if (/Natter/.test(note) && /https:\/\/spirit\.andyflinn\.com/.test(note)) {
      test.check('and it says to open Natter and add one');
    } else {
      test.fail('note: ' + note);
    }

    // A mailbox, but no name yet: the form, and what the two ways in
    // are. A token is for someone invited; the owner needs none.
    const unbound = mountApp({}, {});
    return settle().then(function () {
      if (el(unbound, 'rc-claim-row').style.display !== 'none') {
        test.check('with a mailbox listed the Claim form is there');
      } else {
        test.fail('claim row hidden though Natter has a URL');
      }

        const copy = el(unbound, 'rc-unbound').innerHTML;
      if (/spoken word/.test(copy) && /own the mailbox/.test(copy)) {
        test.check('and it explains the invited case and the owner case');
      } else {
        test.fail('copy: ' + copy);
      }

      // While there is no name, the instruction for getting one IS the
      // page. A To list with nobody in it, a thread of nothing and a
      // composer that would refuse the line are not neutral: they are
      // things to read and dismiss around the only sentence that
      // matters.
      const deadChrome = ['rc-to-bar', 'rc-to-pick', 'rc-thread', 'rc-composer', 'rc-invite-slot']
        .filter(function (id) { return el(unbound, id).style.display !== 'none'; });
      if (deadChrome.length === 0) {
        test.check('and nothing else is on the page while it cannot work');
      } else {
        test.fail('still shown while unbound: ' + deadChrome.join(', '));
      }

      // Bound, with somebody to write to: neither. The page is a
      // conversation, not a form.
      const bound = mountApp(
        { 'session.json': JSON.stringify({ label: 'andy', boundAt: '2026-09-07T00:00:00.000Z' }) },
        {
          inboxStatus: 200,
          people: [{ publicKey: 'KEY-BERT', publicLabel: 'bert', caption: 'bert', mine: false }],
        }
      );
      return settle().then(function () {
        if (el(bound, 'rc-claim-row').style.display === 'none' &&
            el(bound, 'rc-unbound').innerHTML === '') {
          test.check('a bound node is shown neither the form nor the explanation');
        } else {
          test.fail('bound node still has unbound chrome');
        }

        const missing = ['rc-to-bar', 'rc-to-pick', 'rc-thread', 'rc-composer']
          .filter(function (id) { return el(bound, id).style.display === 'none'; });
        if (missing.length === 0) {
          test.check('and gets the whole app back once it has a name and a contact');
        } else {
          test.fail('hidden from a bound node: ' + missing.join(', '));
        }
      });
    });
  });
}

// Bert says something while Andy is reading the mailbox thread. It goes
// to Bert's row and to the title, and NOT into the conversation that is
// open.
function mailArrivesOnTheRow() {
  test.subHeading('A line from someone else does not land in the open thread');

  const BERT = 'MCowBQYDK2VwAyEAbertbertbertbertbertbertbertbertbertb=';
  const CAROL = 'MCowBQYDK2VwAyEAcarolcarolcarolcarolcarolcarolcaro=';
  const ME = 'MCowBQYDK2VwAyEAandyandyandyandyandyandyandyandyandya=';
  const MAILBOX = 'MCowBQYDK2VwAyEAmailboxmailboxmailboxmailboxmailb=';

  const store = {
    'session.json': JSON.stringify({ label: 'andy', boundAt: '2026-09-07T00:00:00.000Z' }),
    'view.json': JSON.stringify({ toKey: MAILBOX, filter: 'relays', lastSeen: {} }),
  };
  const app = mountApp(store, {
    inboxStatus: 200,
    mailboxPublicKey: MAILBOX,
    rows: [{ url: 'https://spirit.example', label: 'spirit.example', owned: true }],
    ownedUrls: ['https://spirit.example'],
    people: [
      { publicKey: BERT, publicLabel: 'bert', caption: 'bert', mine: false },
      { publicKey: CAROL, publicLabel: 'carol', caption: 'carol', mine: false },
    ],
    messages: [{
      id: '11', from: 'bert', to: 'andy', fromKey: BERT, toKey: ME,
      text: 'first line from bert', sentAt: '2026-09-08T09:00:00.000Z',
    }],
  });

  return settle().then(function () {
    const thread = el(app, 'rc-thread').innerHTML;
    if (thread.indexOf('first line from bert') === -1) {
      test.check("Bert's line is not dumped into the mailbox thread Andy is reading");
    } else {
      test.fail('thread carried it: ' + thread);
    }

    // The filter Andy is on shows relays, so Bert's row is not in the
    // list — and a mark on a row nobody can see is no signal at all. The
    // count moves onto a button that only exists while it means
    // something, so the way to the marked row is one press rather than a
    // notice telling you to go and look.
    if (el(app, 'rc-filter-new').style.display !== 'none' &&
        el(app, 'rc-filter-new').textContent === 'New 1') {
      test.check('a New button appears, carrying the count');
    } else {
      test.fail('new button: ' + el(app, 'rc-filter-new').style.display + ' ' + el(app, 'rc-filter-new').textContent);
    }

    // It shows exactly the conversations with something in them, and it
    // is never written down: a reload into a filter that has emptied is
    // a list with no way out.
    el(app, 'rc-filter-new').fire('click');
    const onlyNew = el(app, 'rc-to-pick').innerHTML;
    let saved = null;
    try { saved = JSON.parse(app.store['view.json']); } catch (e) { saved = null; }
    // Bert has something to say; Carol does not. The mailbox row is
    // there only because it is the one selected, which is the rule that
    // stops a filter changing who you are writing to.
    if (/•\s*bert/.test(onlyNew) && onlyNew.indexOf(CAROL) === -1 && saved && saved.filter !== 'new') {
      test.check('New lists what is unread, leaves out what is not, and is not remembered');
    } else {
      test.fail('new filter: ' + onlyNew + ' saved ' + JSON.stringify(saved && saved.filter));
    }

    el(app, 'rc-filter-all').fire('click');
    if (/•\s*bert/.test(el(app, 'rc-to-pick').innerHTML)) {
      test.check('and All brings his marked row into view');
    } else {
      test.fail('no mark: ' + el(app, 'rc-to-pick').innerHTML);
    }

    // The count rides in the app's own heading. It used to ride in the
    // browser tab as well; the tab now names the node instead, and a
    // number that changes on its own has no business in a label somebody
    // is scanning to find the right window.
    if (/Relay Chat \[andy\] · 1/.test(titleOf(app)) && app.doc.title === 'SpiritOS') {
      test.check('and the heading counts it, without touching the tab');
    } else {
      test.fail('heading: ' + titleOf(app) + ' / tab: ' + app.doc.title);
    }

    // Switching to Bert shows it and clears both marks.
    el(app, 'rc-to-pick').value = BERT;
    el(app, 'rc-to-pick').fire('change');

    return settle().then(function () {
      if (el(app, 'rc-thread').innerHTML.indexOf('first line from bert') !== -1) {
        test.check('switching to Bert shows the line');
      } else {
        test.fail('thread after switch: ' + el(app, 'rc-thread').innerHTML);
      }

      if (!/•/.test(el(app, 'rc-to-pick').innerHTML) && titleOf(app) === 'Relay Chat [andy]') {
        test.check('and the mark and the count both go');
      } else {
        test.fail('marks left: ' + titleOf(app) + ' ' + el(app, 'rc-to-pick').innerHTML);
      }

      // Nothing unread, nothing to press: the button leaves the page
      // rather than sitting there reading "New 0".
      if (el(app, 'rc-filter-new').style.display === 'none') {
        test.check('and the New button goes with it');
      } else {
        test.fail('New button still shown: ' + el(app, 'rc-filter-new').textContent);
      }
    });
  });
}

// Reading the last unread while standing in New: the filter has nothing
// left to mean, so it snaps back to whichever real one was showing.
function newFilterSnapsBack() {
  test.subHeading('New is a place to stand, not a place to be left');

  const BERT = 'MCowBQYDK2VwAyEAbertbertbertbertbertbertbertbertbertb=';
  const ME = 'MCowBQYDK2VwAyEAandyandyandyandyandyandyandyandyandya=';
  const store = {
    'session.json': JSON.stringify({ label: 'andy', boundAt: '2026-09-07T00:00:00.000Z' }),
    'view.json': JSON.stringify({ toKey: '', filter: 'all', lastSeen: {} }),
  };
  const app = mountApp(store, {
    inboxStatus: 200,
    people: [{ publicKey: BERT, publicLabel: 'bert', caption: 'bert', mine: false }],
    messages: [{
      id: '21', from: 'bert', to: 'andy', fromKey: BERT, toKey: ME,
      text: 'one thing', sentAt: '2026-09-08T10:00:00.000Z',
    }],
  });

  return settle().then(function () {
    el(app, 'rc-filter-new').fire('click');
    el(app, 'rc-to-pick').value = BERT;
    el(app, 'rc-to-pick').fire('change');

    return settle().then(function () {
      let saved = null;
      try { saved = JSON.parse(app.store['view.json']); } catch (e) { saved = null; }
      if (saved && saved.filter === 'all') {
        test.check('reading the last one returns the filter it was pressed from');
      } else {
        test.fail('filter after snap-back: ' + JSON.stringify(saved && saved.filter));
      }

      if (el(app, 'rc-to-pick').value === BERT) {
        test.check('and the conversation stays open through it');
      } else {
        test.fail('selection lost: ' + el(app, 'rc-to-pick').value);
      }
    });
  });
}

// Andy: the fields clear when the panel is collapsed — the phone call is
// done. The minted token is the reason: it stays on screen after a 201,
// and the next person to open this panel is starting a different
// invitation rather than reading the last one.
function invitePanelForgetsTheCall() {
  test.subHeading('Closing the invite panel ends the call');

  const store = { 'session.json': JSON.stringify({ label: 'andy', boundAt: '2026-09-07T00:00:00.000Z' }) };
  const app = mountApp(store, {
    inboxStatus: 200,
    ownedUrls: ['https://spirit.example'],
    rows: [{ url: 'https://spirit.example', label: 'spirit.example', owned: true }],
  });

  return settle().then(function () {
    el(app, 'rc-inv-label').value = 'bert';
    el(app, 'rc-inv-days').value = '3';
    el(app, 'rc-inv-token').value = 'saint-bernard';
    el(app, 'rc-inv-out').textContent = 'saint-bernard  →  https://spirit.example';

    // Opened, not closed: nothing is touched while the call is on.
    el(app, 'rc-invite-panel').open = true;
    el(app, 'rc-invite-panel').fire('toggle');
    if (el(app, 'rc-inv-label').value === 'bert' && el(app, 'rc-inv-out').textContent !== '') {
      test.check('opening it leaves what is there alone');
    } else {
      test.fail('opening cleared the panel');
    }

    el(app, 'rc-invite-panel').open = false;
    el(app, 'rc-invite-panel').fire('toggle');

    const cleared = ['rc-inv-label', 'rc-inv-token'].every(function (id) { return el(app, id).value === ''; });
    if (cleared && el(app, 'rc-inv-days').value === '7') {
      test.check('closing it empties the fields and puts the days back');
    } else {
      test.fail('after collapse: label ' + el(app, 'rc-inv-label').value +
        ', token ' + el(app, 'rc-inv-token').value + ', days ' + el(app, 'rc-inv-days').value);
    }

    // The one that matters: a token somebody spoke aloud does not sit on
    // the screen waiting for the next person to open the panel.
    if (el(app, 'rc-inv-out').textContent === '') {
      test.check('and the minted token is not left on the screen');
    } else {
      test.fail('token still shown: ' + el(app, 'rc-inv-out').textContent);
    }
  });
}

// The settings panel: three answers to "somebody you have not added just
// wrote to you", the tightest of them factory.
function settingsPanel() {
  test.subHeading('What to do about people you have not added');

  const store = { 'session.json': JSON.stringify({ label: 'andy', boundAt: '2026-09-07T00:00:00.000Z' }) };
  const app = mountApp(store, { inboxStatus: 200 });

  return settle().then(function () {
    const choices = el(app, 'rc-unknown-choices').innerHTML;
    const radios = (choices.match(/type="radio"/g) || []).length;
    if (radios === 3 && /value="silent"[^>]*checked/.test(choices)) {
      test.check('three choices, and the tightest is the one already made');
    } else {
      test.fail('choices: ' + choices);
    }

    // Short names to choose by, each with its own sentence: the name is
    // what gets remembered, the sentence is read once.
    if (/rc-choice-title">Silent/.test(choices) &&
        /rc-choice-title">Hold/.test(choices) &&
        /rc-choice-title">Add them/.test(choices) &&
        (choices.match(/rc-choice-note/g) || []).length === 3) {
      test.check('each choice is a short name with its own explanation');
    } else {
      test.fail('choice copy: ' + choices);
    }

    // Settings folds the whole configuration away; each question inside
    // it folds separately. One question today, and the shape is what
    // makes the second one cost nothing.
    const panel = app.container.innerHTML;
    const at = panel.indexOf('id="rc-settings-panel"');
    const inner = panel.slice(at, panel.indexOf('</details>', at));
    if (at !== -1 && inner.indexOf('id="rc-unknown-section"') !== -1 && inner.indexOf('<details') !== -1) {
      test.check('the question is a fold inside the Settings fold');
    } else {
      test.fail('settings markup: ' + panel.slice(at, at + 400));
    }

    // The choices stand off from the heading that introduces them.
    const css = require('fs').readFileSync(require('path').join(RUN_DIR, 'index.html'), 'utf8');
    const gapAt = css.indexOf('#rc-unknown-choices {');
    const gap = gapAt === -1 ? '' : css.slice(gapAt, css.indexOf('}', gapAt));
    if (/margin-top:\s*12px/.test(gap)) {
      test.check('and the first choice does not sit against the title');
    } else {
      test.fail('choices gap: ' + gap);
    }

    // A folded panel still answers the question it exists for.
    if (el(app, 'rc-unknown-summary').textContent === 'Messages from people I have not added — Silent') {
      test.check('and the heading says both the question and the answer');
    } else {
      test.fail('summary: ' + el(app, 'rc-unknown-summary').textContent);
    }

    // Neither is built, so neither is drawn: a control that silently
    // does nothing is worse than one that is not there.
    if (choices.indexOf('refuse') === -1 && choices.toLowerCase().indexOf('sound') === -1) {
      test.check('no Refuse, no sound toggle');
    } else {
      test.fail('unbuilt controls were drawn: ' + choices);
    }

    // The policy travels with the read; the hub never opens prefs.json.
    const asked = app.log.filter(function (call) { return call.url.indexOf('/api/hub/inbox') === 0; });
    if (asked.length && asked.every(function (call) { return call.url.indexOf('unknown=silent') !== -1; })) {
      test.check('and every inbox read says which policy it was made under');
    } else {
      test.fail('inbox calls: ' + JSON.stringify(asked.map(function (c) { return c.url; })));
    }

    // Choosing is remembered, on this node, in its own file.
    el(app, 'rc-unknown-choices').fire('change', { target: { value: 'acquire' } });
    return settle().then(function () {
      let saved = null;
      try { saved = JSON.parse(app.store['prefs.json']); } catch (e) { saved = null; }
      if (saved && saved.unknown === 'acquire') {
        test.check('a choice is written to prefs.json, not to session or view');
      } else {
        test.fail('prefs.json: ' + app.store['prefs.json']);
      }
      if (!/unknown/.test(app.store['view.json'] || '') && !/unknown/.test(app.store['session.json'])) {
        test.check('and neither of the other two files learns about it');
      } else {
        test.fail('the setting leaked into another file');
      }

      if (el(app, 'rc-unknown-summary').textContent === 'Messages from people I have not added — Add them') {
        test.check('and the heading moves with the answer');
      } else {
        test.fail('summary after the change: ' + el(app, 'rc-unknown-summary').textContent);
      }

      // It takes effect on the spot: the next read is made under the new
      // policy, not the one the page was opened with.
      const later = app.log.filter(function (call) { return call.url.indexOf('/api/hub/inbox') === 0; }).pop();
      if (later && later.url.indexOf('unknown=acquire') !== -1) {
        test.check('and the very next read is made under it');
      } else {
        test.fail('read after the change: ' + (later && later.url));
      }
    });
  });
}

// Hold is a number and never a name — the name is the thing it withholds.
function holdLine() {
  test.subHeading('Hold says how many, and never who');

  const store = {
    'session.json': JSON.stringify({ label: 'andy', boundAt: '2026-09-07T00:00:00.000Z' }),
    'prefs.json': JSON.stringify({ unknown: 'hold', mintedLabels: [] }),
  };
  const app = mountApp(store, { inboxStatus: 200, unknown: 2 });

  return settle().then(function () {
    if (/2 from people you have not added/.test(el(app, 'rc-hold-line').textContent)) {
      test.check('two waiting says so');
    } else {
      test.fail('hold line: ' + el(app, 'rc-hold-line').textContent);
    }

    // A stored choice is what the panel shows on the way back in.
    if (/value="hold"[^>]*checked/.test(el(app, 'rc-unknown-choices').innerHTML)) {
      test.check('and a reload comes back to the setting that was made');
    } else {
      test.fail('restored panel: ' + el(app, 'rc-unknown-choices').innerHTML);
    }

    // Quiet mailbox, quiet page.
    const quiet = mountApp({
      'session.json': JSON.stringify({ label: 'andy', boundAt: '2026-09-07T00:00:00.000Z' }),
      'prefs.json': JSON.stringify({ unknown: 'hold', mintedLabels: [] }),
    }, { inboxStatus: 200, unknown: 0 });
    return settle().then(function () {
      if (el(quiet, 'rc-hold-line').textContent === '') {
        test.check('nothing waiting says nothing at all');
      } else {
        test.fail('hold line with nothing held: ' + el(quiet, 'rc-hold-line').textContent);
      }
    });
  });
}

// Hold puts somebody in the list without letting them in: a × row you
// can pick, so you can say yes, and no composer while they are open.
function heldRowsPointAtContacts() {
  test.subHeading('Chat shows who is waiting, and sends you where it is decided');

  const BERT = 'MCowBQYDK2VwAyEAbertbertbertbertbertbertbertbertbertb=';
  const HELD = 'MCowBQYDK2VwAyEAcarolcarolcarolcarolcarolcarolcaro=';
  const store = { 'session.json': JSON.stringify({ label: 'andy', boundAt: '2026-09-07T00:00:00.000Z' }) };
  const app = mountApp(store, {
    inboxStatus: 200,
    people: [
      { publicKey: BERT, publicLabel: 'bert', caption: 'bert', mine: false, held: false, blocked: false },
      { publicKey: HELD, publicLabel: 'carol', caption: 'carol', mine: false, held: true, blocked: false },
    ],
  });

  return settle().then(function () {
    const list = el(app, 'rc-to-pick').innerHTML;
    if (/optgroup label="Blocked"/.test(list) && /carol/.test(list)) {
      test.check('somebody waiting is still listed here, and still marked');
    } else {
      test.fail('list: ' + list);
    }

    // A contact is somebody to write to, and that is all this window has
    // to say about them: no Block, no rename, no strip at all.
    el(app, 'rc-to-pick').value = BERT;
    el(app, 'rc-to-pick').fire('change');
    return settle().then(function () {
      if (el(app, 'rc-peer-strip').innerHTML === '') {
        test.check('and a contact gets no verbs in the chat window');
      } else {
        test.fail('strip for a contact: ' + el(app, 'rc-peer-strip').innerHTML);
      }

      // Somebody held has nothing to type at — and would be a dead end
      // without the way out, now that the deciding has moved.
      el(app, 'rc-to-pick').value = HELD;
      el(app, 'rc-to-pick').fire('change');
      return settle().then(function () {
        const strip = el(app, 'rc-peer-strip').innerHTML;
        if (/rc-open-contacts/.test(strip) && /Not added/.test(strip) &&
            strip.indexOf('rc-peer-accept') === -1 && strip.indexOf('rc-peer-block') === -1) {
          test.check('a held row offers the way to Contacts, and no decision of its own');
        } else {
          test.fail('held strip: ' + strip);
        }

        if (el(app, 'rc-composer').style.display === 'none') {
          test.check('and there is still nothing to type at somebody unaccepted');
        } else {
          test.fail('composer shown for a held row');
        }

        let opened = '';
        app.api.launchApp = function (id) { opened = id; };
        el(app, 'rc-peer-strip').fire('click', { target: closestStub('rc-open-contacts') });
        if (opened === 'app/contacts') {
          test.check('and pressing it opens the app that owns the decision');
        } else {
          test.fail('launched: ' + opened);
        }
      });
    });
  });
}

// Do not disturb silences notifications and nothing else: the count goes,
// the information stays.
function doNotDisturb() {
  test.subHeading('Not being interrupted is not being unreachable');

  const BERT = 'MCowBQYDK2VwAyEAbertbertbertbertbertbertbertbertbertb=';
  const line = {
    id: 'm1', from: 'bert', to: 'andy', fromKey: BERT, toKey: 'KEY-ANDY',
    text: 'are you there', sentAt: '2026-09-08T10:00:00.000Z',
  };
  const store = { 'session.json': JSON.stringify({ label: 'andy', boundAt: '2026-09-07T00:00:00.000Z' }) };
  const app = mountApp(store, {
    inboxStatus: 200,
    messages: [line],
    people: [{ publicKey: BERT, publicLabel: 'bert', caption: 'bert', mine: false, held: false, blocked: false }],
  });

  return settle().then(function () {
    // Loud by default: being unreachable unless you ask is the wrong
    // kind of safe.
    if (/· 1/.test(titleOf(app))) {
      test.check('mail announces itself until told not to');
    } else {
      test.fail('title: ' + titleOf(app));
    }

    el(app, 'rc-dnd-toggle').fire('change', { target: { checked: true } });
    return settle().then(function () {
      if (titleOf(app) === 'Relay Chat [andy]') {
        test.check('switched on, the heading stops counting at you');
      } else {
        test.fail('title with dnd: ' + titleOf(app));
      }

      // The other announcement: a button that appears on its own,
      // carrying a number that grows, is a notification whatever else it
      // is also good for.
      if (el(app, 'rc-filter-new').style.display === 'none') {
        test.check('and the New button stops appearing too');
      } else {
        test.fail('New button visible under dnd');
      }

      // The information is all still there — this is about being
      // interrupted, not about being unreachable.
      if (/•\s*bert/.test(el(app, 'rc-to-pick').innerHTML)) {
        test.check('and the row is still marked unread');
      } else {
        test.fail('list: ' + el(app, 'rc-to-pick').innerHTML);
      }

      // Named through the real module rather than rebuilt here: the file
      // name is peerFile's business, and a test that spells it out again
      // is a second answer to the same question.
      const filed = app.store[chatLog.fileFor(BERT)] || '';
      if (/are you there/.test(filed)) {
        test.check('and the line was filed exactly as it would have been');
      } else {
        test.fail('logs: ' + Object.keys(app.store).join(', '));
      }

      let saved = null;
      try { saved = JSON.parse(app.store['prefs.json']); } catch (e) { saved = null; }
      if (saved && saved.dnd === true) {
        test.check('and the switch is remembered on this node');
      } else {
        test.fail('prefs: ' + app.store['prefs.json']);
      }

      // Nothing was lost while it was on.
      el(app, 'rc-dnd-toggle').fire('change', { target: { checked: false } });
      return settle().then(function () {
        if (/· 1/.test(titleOf(app)) && el(app, 'rc-filter-new').style.display !== 'none') {
          test.check('switching it off brings back both, and the count that was there all along');
        } else {
          test.fail('after: ' + titleOf(app) + ' / new button ' + el(app, 'rc-filter-new').style.display);
        }

        // Standing in `new` when the button that took you there goes
        // would leave a filter nothing can turn off.
        el(app, 'rc-filter-new').fire('click');
        el(app, 'rc-dnd-toggle').fire('change', { target: { checked: true } });
        return settle().then(function () {
          let saved = null;
          try { saved = JSON.parse(app.store['view.json']); } catch (e) { saved = null; }
          if (saved && saved.filter !== 'new') {
            test.check('and switching it on does not strand you in a filter you cannot leave');
          } else {
            test.fail('filter after dnd: ' + (saved && saved.filter));
          }
        });
      });
    });
  });
}

// Pressing New is asking who wrote to you, and the answer is in the list.
function newOpensTheList() {
  test.subHeading('New asks a question the list answers');

  const BERT = 'MCowBQYDK2VwAyEAbertbertbertbertbertbertbertbertbertb=';
  const store = { 'session.json': JSON.stringify({ label: 'andy', boundAt: '2026-09-07T00:00:00.000Z' }) };
  const app = mountApp(store, {
    inboxStatus: 200,
    messages: [{
      id: 'm1', from: 'bert', to: 'andy', fromKey: BERT, toKey: 'KEY-ANDY',
      text: 'anybody home', sentAt: '2026-09-08T10:00:00.000Z',
    }],
    people: [{ publicKey: BERT, publicLabel: 'bert', caption: 'bert', mine: false, held: false, blocked: false }],
  });

  return settle().then(function () {
    // What a browser that has showPicker does.
    let opened = 0;
    el(app, 'rc-to-pick').showPicker = function () { opened += 1; };
    el(app, 'rc-filter-new').fire('click');

    return settle().then(function () {
      if (opened === 1) {
        test.check('pressing it drops the list open');
      } else {
        test.fail('showPicker calls: ' + opened);
      }

      // Narrowing a list you are already reading is not the same
      // question, so it does not reopen the control under you.
      el(app, 'rc-filter-all').fire('click');
      if (opened === 1) {
        test.check('and the other filters leave the control alone');
      } else {
        test.fail('a plain filter opened the list too');
      }

      // A browser without it, and a browser that refuses: neither may
      // take the click down with it.
      const older = mountApp(
        { 'session.json': JSON.stringify({ label: 'andy', boundAt: '2026-09-07T00:00:00.000Z' }) },
        { inboxStatus: 200 }
      );
      return settle().then(function () {
        let focused = 0;
        el(older, 'rc-to-pick').focus = function () { focused += 1; };
        el(older, 'rc-filter-new').fire('click');
        el(older, 'rc-to-pick').showPicker = function () { throw new Error('NotAllowedError'); };
        el(older, 'rc-filter-new').fire('click');
        if (focused >= 1) {
          test.check('and where it cannot open, it puts the keyboard there instead');
        } else {
          test.fail('no fallback: focus called ' + focused);
        }
      });
    });
  });
}

// Packet 1: what goes out is an envelope, what comes back may be one of
// three things, and only one of them is a line in this thread.
function sendsAndReadsPackets() {
  test.subHeading('Chat is one client of the packet door');

  const BERT = 'MCowBQYDK2VwAyEAbertbertbertbertbertbertbertbertbertb=';
  const chess = JSON.stringify({ app: 'chess', v: 1, id: 'g1', body: { move: 'e4' } });
  const store = { 'session.json': JSON.stringify({ label: 'andy', boundAt: '2026-09-07T00:00:00.000Z' }) };
  const app = mountApp(store, {
    inboxStatus: 200,
    people: [{ publicKey: BERT, publicLabel: 'bert', caption: 'bert', mine: false, held: false, blocked: false }],
    messages: [
      // A line from before packets existed: still mail, still chat.
      { id: 'm1', from: 'bert', to: 'andy', fromKey: BERT, toKey: 'KEY-ANDY',
        text: 'sent before packets', sentAt: '2026-09-08T10:00:00.000Z',
        packet: { legacy: true, app: null, id: null, body: 'sent before packets' } },
      // This app's own traffic, wrapped.
      { id: 'm2', from: 'bert', to: 'andy', fromKey: BERT, toKey: 'KEY-ANDY',
        text: '{"app":"relay-chat","v":1,"id":"p1","body":"and one after"}',
        sentAt: '2026-09-08T10:01:00.000Z',
        packet: { legacy: false, app: 'relay-chat', id: 'p1', body: 'and one after' } },
      // Somebody else's app. Not a chat line, and not this app's to keep.
      { id: 'm3', from: 'bert', to: 'andy', fromKey: BERT, toKey: 'KEY-ANDY',
        text: chess, sentAt: '2026-09-08T10:02:00.000Z',
        packet: { legacy: false, app: 'chess', id: 'g1', body: { move: 'e4' } } },
    ],
  });

  return settle().then(function () {
    el(app, 'rc-to-pick').value = BERT;
    el(app, 'rc-to-pick').fire('change');

    return settle().then(function () {
      const thread = el(app, 'rc-thread').innerHTML;
      if (/sent before packets/.test(thread) && /and one after/.test(thread)) {
        test.check('a legacy line and a packet line both paint as chat');
      } else {
        test.fail('thread: ' + thread);
      }

      // The one that matters: another app's packet is dropped, not held,
      // not shown, and above all not filed.
      if (thread.indexOf('e4') === -1 && thread.indexOf('chess') === -1) {
        test.check('and another app’s packet is not in the thread');
      } else {
        test.fail('chess leaked into the thread: ' + thread);
      }

      const filed = app.store[chatLog.fileFor(BERT)] || '';
      if (/and one after/.test(filed) && filed.indexOf('chess') === -1 && filed.indexOf('"app"') === -1) {
        test.check('the archive holds the line, never the envelope it came in');
      } else {
        test.fail('peerfile: ' + filed);
      }

      // Outbound: the app says who and what, the node wraps it. The
      // mailbox still receives a string in `text`, which is why nothing
      // on spirit-3 has to move.
      el(app, 'rc-text').value = 'a new line';
      el(app, 'rc-send').fire('click');
      return settle().then(function () {
        const send = app.log.filter(function (c) { return c.url.indexOf('/api/hub/send') === 0; }).pop();
        const body = send && send.body ? JSON.parse(send.body) : null;
        if (body && body.app === 'relay-chat' && body.body === 'a new line' && body.text === undefined) {
          test.check('and a send says app and body, not a wire string');
        } else {
          test.fail('send body: ' + (send && send.body));
        }
      });
    });
  });
}

claimBinds()
  .then(claimRowHidesOnceBound)
  .then(enterSendsExactlyOnce)
  .then(inviteOnlyForAnOwner)
  .then(invitePanelForgetsTheCall)
  .then(settingsPanel)
  .then(heldRowsPointAtContacts)
  .then(noAddressBookInChat)
  .then(doNotDisturb)
  .then(newOpensTheList)
  .then(sendsAndReadsPackets)
  .then(holdLine)
  .then(composerOffersTheMailbox)
  .then(reloadRestores)
  .then(nothingStored)
  .then(threadMarksOwnLines)
  .then(viewIsRemembered)
  .then(unreadDots)
  .then(unboundChrome)
  .then(unboundSaysHowToGetIn)
  .then(mailArrivesOnTheRow)
  .then(newFilterSnapsBack)
  .then(nobodyToWriteTo)
  .then(ownTailIsReadable)
  .then(noTailNoLine)
  .then(function () { test.reportSuccessFailureCount(); })
  .catch(function (err) {
    test.fail('chat 1 threw: ' + ((err && err.stack) || err));
    test.reportSuccessFailureCount();
  });
