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
    launchApp: function () {},
    // What the shell answers when an app asks who this node is. The
    // binding file itself belongs to Natter now (packet 3) — chat never
    // reads it — so this stands in for readNodeLabel, and the store key
    // below is just where these fixtures keep the answer.
    nodeLabel: function () {
      try { return (JSON.parse(store['session.json'] || '{}') || {}).label || ''; }
      catch (e) { return ''; }
    },
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

// The same idea for a button found by data-attribute rather than id —
// what the browser hands a delegated handler: the element clicked,
// answering closest() and the attribute the handler reads off it.
// Chat's own refusal of a peer, read back out of the file it lives in.
// Named through chatLog rather than spelled out again here — where the
// flag sits is that module's business, and a second answer to the same
// question is a second thing to get wrong.
function blockedHereInStore(app, peerKey) {
  try { return !!JSON.parse(app.store[chatLog.fileFor(peerKey)] || 'null').blocked; }
  catch (e) { return false; }
}

function dataStub(attr, value) {
  const node = {
    getAttribute: function (name) { return name === attr ? value : null; },
  };
  node.closest = function (selector) { return selector === '[' + attr + ']' ? node : null; };
  return node;
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

    // The mailbox used to be the way out of this state: under All it was
    // a row, so the composer came back and `whoami` could be typed at
    // it. It is not somebody to write to any more, so a node with no
    // contacts has nothing to say to anyone — which is the honest
    // reading of no contacts, and the panel below is the way forward.
    //
    // Asserted against a fixture that DOES supply mailboxPublicKey and a
    // Natter row, so this cannot pass merely because nothing was there.
    if (el(app, 'rc-to-pick').innerHTML.indexOf(MAILBOX_KEY) === -1) {
      test.check('and the mailbox is not the way out of it, though its key was supplied');
    } else {
      test.fail('a mailbox row survived: ' + el(app, 'rc-to-pick').innerHTML);
    }
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
    // Blocking came BACK to chat (Andy), and it is the only one of the
    // four that did: refusing somebody is what you want in the middle of
    // a conversation with them, while adding, accepting and renaming
    // stay Contacts' verbs. So the claim narrowed rather than held.
    //
    // One other write stays and is not address-book UI: acquireInvited
    // files the key that claimed a label this node minted an invite for.
    // It has no control, and a human is never asked.
    const src = fs.readFileSync(APP_SCRIPT, 'utf8');
    if (src.indexOf('findByHandle') === -1 && src.indexOf("'accept'") === -1) {
      test.check('and it offers no way to add, accept or rename anybody');
    } else {
      test.fail('relayChat.js still carries address-book verbs');
    }

    // The refusal it DOES carry is its own, written to its own log. It
    // asks the shell for nothing and the hub for nothing: a mere app must
    // not be able to reach a node-global switch, and the way to be sure
    // of that is that no such reach exists in the source. Matched on the
    // quoted path, because the file names /api/hub/peer in a comment
    // explaining why it does not call it — a check that greps the whole
    // source for a bare path is one a comment can fail, or pass, for no
    // reason anybody meant.
    if (src.indexOf("'/api/hub/peer'") === -1 && src.indexOf('blockId') === -1 &&
        src.indexOf('blockedHere') !== -1) {
      test.check('and its refusal is its own file, not a call on the node');
    } else {
      test.fail('how chat blocks: quoted path ' + (src.indexOf("'/api/hub/peer'") !== -1) +
        ', blockId ' + (src.indexOf('blockId') !== -1) +
        ', blockedHere ' + (src.indexOf('blockedHere') !== -1));
    }

    // And now not even that one: minting moved to Natter with the rest
    // of binding (packet 3), so the invite's own acquire went with it.
    if (src.indexOf('/api/hub/contact') === -1 && src.indexOf('/api/hub/invite') === -1) {
      test.check('and it neither mints an invite nor writes a contact at all');
    } else {
      test.fail('relayChat.js still writes contacts or mints');
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

function reloadRestores() {
  test.subHeading('Reload comes back to the name the node is bound to');

  // A reload is a fresh mount against the same node. The binding itself
  // is Natter's now (packet 3): chat asks the shell who this node is and
  // does not verify, re-claim or expire anything — that check belongs to
  // the app that owns the file (spirit/test/natterBind.js).
  const store = { 'session.json': JSON.stringify({ label: 'andy', boundAt: '2026-09-07T00:00:00.000Z' }) };
  const app = mountApp(store, { inboxStatus: 200 });

  return settle().then(function () {
    if (titleOf(app) === 'Relay Chat [andy]') {
      test.check('the name the shell reports is the name the chrome shows');
    } else {
      test.fail('restored title: ' + titleOf(app));
    }

    // It reads mail and claims nothing — claiming is not this app's to do.
    const asked = app.log.filter(function (r) { return r.url.indexOf('/api/hub/inbox') === 0; });
    const claimed = app.log.filter(function (r) { return r.url.indexOf('/api/hub/claim') === 0; });
    if (asked.length >= 1 && claimed.length === 0) {
      test.check('it reads the inbox and claims nothing');
    } else {
      test.fail('calls: ' + JSON.stringify(app.log.map(function (c) { return c.url; })));
    }

    // No name from the shell is a chat window with nobody to be. It says
    // so rather than pretending, and points at the app that fixes it.
    const nameless = mountApp({}, { inboxStatus: 200 });
    return settle().then(function () {
      if (titleOf(nameless) === 'Relay Chat' && /Natter/.test(el(nameless, 'rc-status').textContent)) {
        test.check('and with no name it says where a name comes from');
      } else {
        test.fail('nameless: ' + titleOf(nameless) + ' / ' + el(nameless, 'rc-status').textContent);
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
//
// It used to offer mailboxes too. Chatting to one reaches the console,
// and for a mailbox this node does not own the whole of what it answers
// is `help` and `whoami`. The console is untouched on the wire; it is
// simply not something this app offers, and everything that existed to
// tell a relay row from a person row went with it.
function composerOffersTheMailbox() {
  test.subHeading('The To list is people, and holds their keys');

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
    const html = el(app, 'rc-to-pick').innerHTML;

    // A To value is a peer's KEY. `relay` is what the WIRE calls a
    // mailbox when a line is addressed to it, and it was never a value
    // in this control even when mailboxes were listed.
    if (html.indexOf('value="KEY-BERT"') !== -1) {
      test.check('a peer is offered by key');
    } else {
      test.fail('options: ' + html);
    }

    if (html.indexOf('value="relay"') === -1) {
      test.check('the reserved caption is never a value here');
    } else {
      test.fail('the literal relay is still an option value');
    }

    // The mailbox is fed to the app the whole time — mailboxPublicKey is
    // in the fixture, and two Natter rows with it. None of it reaches
    // the list. Checked against a key the app definitely knows, so this
    // cannot pass merely because nothing was supplied.
    if (html.indexOf(MAILBOX_KEY) === -1) {
      test.check('and the mailbox is not offered, though the app was told its key');
    } else {
      test.fail('a mailbox row survived: ' + html);
    }

    if (html.indexOf('second.example') === -1 && html.indexOf('disabled') === -1) {
      test.check('nor is any other Natter row, inert or otherwise');
    } else {
      test.fail('a relay row survived: ' + html);
    }

    // Peers and Relays were two groups because there were two kinds of
    // row. One kind, one group — and Blocked, which is a state rather
    // than a kind.
    if (/optgroup label="Peers"/.test(html) && !/optgroup label="Relays"/.test(html)) {
      test.check('one kind of row, so no Relays group to tell it apart from');
    } else {
      test.fail('optgroups: ' + html);
    }

    // Peers / Relays / All existed to choose between the two kinds. With
    // one kind there is nothing to choose, so the buttons are gone and
    // view.json has no filter left to carry.
    const bar = app.container.innerHTML;
    if (bar.indexOf('rc-filter-peers') === -1 && bar.indexOf('rc-filter-relays') === -1 &&
        bar.indexOf('rc-filter-all') === -1 && bar.indexOf('rc-filter-new') !== -1) {
      test.check('and only New is left of the filter bar');
    } else {
      test.fail('filter bar: ' + bar.slice(bar.indexOf('rc-to-bar'), bar.indexOf('rc-to-row')));
    }

    let saved = null;
    try { saved = JSON.parse(app.store['view.json'] || 'null'); } catch (e) { saved = null; }
    if (!saved || (saved.filter === undefined && saved.search === undefined)) {
      test.check('and view.json carries neither a filter nor a search');
    } else {
      test.fail('view.json: ' + JSON.stringify(app.store['view.json']));
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

    // A view.json left over from when mailboxes were listed. The row it
    // names is not in the list any more, so it takes the same path a
    // peer who left the mailbox takes: select nobody and say so. Picking
    // the neighbouring row would be the app deciding who you meant.
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
      if (el(onRelay, 'rc-to-pick').value === '') {
        test.check('a remembered mailbox row is a To that is gone, and selects nobody');
      } else {
        test.fail('relay restore: ' + el(onRelay, 'rc-to-pick').value);
      }

      // And the stale filter beside it changes nothing: view.json has no
      // filter to honour any more, so an old one is read past.
      if (el(onRelay, 'rc-to-pick').innerHTML.indexOf('bert') !== -1) {
        test.check('and a stale filter in that file does not hide the people who are there');
      } else {
        test.fail('list under a stale filter: ' + el(onRelay, 'rc-to-pick').innerHTML);
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
      // Observed in the list rather than in view.json: the filter is not
      // written down any more (there is one, and it is a place to stand
      // rather than a setting), so what has to be true is that the read
      // peer is on offer again — which is what `new` was hiding.
      // '0.55' exactly, not merely "not 1": paintFilterButtons writes one
      // of two values, and an unset style would satisfy `!== '1'` while
      // asserting nothing.
      if (el(app, 'rc-to-pick').innerHTML.indexOf(BERT) !== -1 &&
          el(app, 'rc-filter-new').style.opacity === '0.55') {
        test.check('reading the last one drops the filter and shows everyone again');
      } else {
        test.fail('after snap-back: ' + el(app, 'rc-to-pick').innerHTML +
          ' / New opacity ' + el(app, 'rc-filter-new').style.opacity);
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
// "Messages from people I have not added" moved to Contacts (Andy): it
// asks what to do about somebody who is not in the address book, which is
// a question about the address book. Chat keeps its own notifications,
// and keeps CARRYING the policy, because chat is what polls the inbox and
// the hub takes it as a query parameter.
function settingsOnlyDisturb() {
  test.subHeading('Settings keeps what is chat\'s, and reads the rest');

  const store = { 'session.json': JSON.stringify({ label: 'andy', boundAt: '2026-09-07T00:00:00.000Z' }) };
  const app = mountApp(store, { inboxStatus: 200 });

  return settle().then(function () {
    const panel = app.container.innerHTML;

    // The switch that is genuinely this app's: being interrupted is a
    // chat question.
    if (panel.indexOf('rc-dnd-toggle') !== -1 && /Do not disturb/.test(panel)) {
      test.check('Do not disturb is still here');
    } else {
      test.fail('settings: ' + panel);
    }

    // And the section that was not. Checked on the markup this app
    // actually builds, so a comment mentioning the old ids cannot satisfy
    // it — the trap the /api/hub/peer grep fell into earlier.
    const strays = ['rc-unknown-choices', 'rc-unknown-summary', 'rc-unknown-section', 'rc-hold-line']
      .filter(function (id) { return panel.indexOf(id) !== -1; });
    if (strays.length === 0) {
      test.check('and the stranger policy is not drawn here any more');
    } else {
      test.fail('still in the chat page: ' + strays.join(', '));
    }

    // Its own file is its own business now.
    el(app, 'rc-dnd-toggle').fire('change', { target: { checked: true } });
    return settle().then(function () {
      let saved = null;
      try { saved = JSON.parse(app.store['prefs.json']); } catch (e) { saved = null; }
      if (saved && saved.dnd === true && saved.unknown === undefined) {
        test.check('and chat\'s prefs.json holds the switch and no policy');
      } else {
        test.fail('prefs.json: ' + app.store['prefs.json']);
      }
    });
  });
}

// Chat is the app that polls, so it is the app that has to carry the
// answer — read off the file Contacts owns, unscoped and read-only.
//
// This is the seam to take to Grok: the control is in one app and the
// polling in another, so two apps have to stay honest about one
// node-level setting.
function policyTravelsFromContacts() {
  test.subHeading('The policy rides on the read, from the file Contacts owns');

  const bound = { label: 'andy', boundAt: '2026-09-07T00:00:00.000Z' };

  // Nothing kept anywhere: silent, because a missing file is the safe
  // answer and the safe answer is the default.
  const bare = mountApp({ 'session.json': JSON.stringify(bound) }, { inboxStatus: 200 });

  return settle().then(function () {
    const asked = bare.log.filter(function (c) { return c.url.indexOf('/api/hub/inbox') === 0; });
    if (asked.length && asked.every(function (c) { return c.url.indexOf('unknown=silent') !== -1; })) {
      test.check('with no file anywhere, every read is made under silent');
    } else {
      test.fail('inbox calls: ' + JSON.stringify(asked.map(function (c) { return c.url; })));
    }

    // Contacts' file is what decides it — not chat's own, which no longer
    // carries the field at all.
    const app = mountApp({ 'session.json': JSON.stringify(bound) }, {
      inboxStatus: 200,
      project: {
        'app/natter/relays.json': JSON.stringify([{ label: 'spirit', url: 'https://spirit.example' }]),
        'app/contacts/prefs.json': JSON.stringify({ unknown: 'acquire' }),
      },
    });
    return settle().then(function () {
      const reads = app.log.filter(function (c) { return c.url.indexOf('/api/hub/inbox') === 0; });
      if (reads.length && reads.every(function (c) { return c.url.indexOf('unknown=acquire') !== -1; })) {
        test.check('and Contacts\' choice is what every read is made under');
      } else {
        test.fail('inbox calls: ' + JSON.stringify(reads.map(function (c) { return c.url; })));
      }

      // A leftover in chat's own file decides nothing. There is one copy
      // of this setting, and it is not here.
      const stale = mountApp({
        'session.json': JSON.stringify(bound),
        'prefs.json': JSON.stringify({ dnd: false, unknown: 'acquire' }),
      }, { inboxStatus: 200 });
      return settle().then(function () {
        const staleReads = stale.log.filter(function (c) { return c.url.indexOf('/api/hub/inbox') === 0; });
        if (staleReads.length && staleReads.every(function (c) { return c.url.indexOf('unknown=silent') !== -1; })) {
          test.check('and an unknown left in chat\'s own file is read past, not obeyed');
        } else {
          test.fail('stale reads: ' + JSON.stringify(staleReads.map(function (c) { return c.url; })));
        }
      });
    });
  });
}

// Hold puts somebody in the list without letting them in: a × row you
// can pick, so you can say yes, and no composer while they are open.
function heldRowsPointAtContacts() {
  test.subHeading('Chat refuses a peer, and sends you where the rest is decided');

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

    // A contact is somebody to write to, and the one decision chat has
    // about them is the refusal — beside the To control, on its row.
    // Accepting and renaming are still Contacts' verbs and are not here.
    el(app, 'rc-to-pick').value = BERT;
    el(app, 'rc-to-pick').fire('change');
    return settle().then(function () {
      const contactStrip = el(app, 'rc-peer-strip').innerHTML;
      // "here" is in the caption on purpose: this refusal is chat's own
      // and stops no message arriving, so the word has to carry the
      // scope or the button promises what the app cannot do.
      if (/data-rc-block="/.test(contactStrip) && />Block here</.test(contactStrip) &&
          contactStrip.indexOf('accept') === -1 && contactStrip.indexOf('label') === -1) {
        test.check('and a contact gets Block here beside the To control, and nothing else');
      } else {
        test.fail('strip for a contact: ' + contactStrip);
      }

      // One press arms and says so. This control sits a thumb-width from
      // the To picker, and a refusal nobody meant is a bad thing to
      // reach by accident — so the first press must not be the block.
      el(app, 'rc-peer-strip').fire('click', { target: dataStub('data-rc-block', BERT) });
      if (/Press again/.test(el(app, 'rc-peer-strip').innerHTML) && !blockedHereInStore(app, BERT)) {
        test.check('one press arms it and says so, and blocks nobody');
      } else {
        test.fail('after one press: ' + el(app, 'rc-peer-strip').innerHTML +
          ' / file ' + app.store[chatLog.fileFor(BERT)]);
      }

      // Arming belongs to the person it was pressed on. Moving the To
      // takes the half-pressed refusal with it, or coming back to a
      // primed button would leave a block one press from happening to
      // somebody who was never the subject.
      el(app, 'rc-to-pick').value = HELD;
      el(app, 'rc-to-pick').fire('change');
      el(app, 'rc-to-pick').value = BERT;
      el(app, 'rc-to-pick').fire('change');
      if (!/Press again/.test(el(app, 'rc-peer-strip').innerHTML)) {
        test.check('and changing who is open disarms it');
      } else {
        test.fail('still armed after the To moved: ' + el(app, 'rc-peer-strip').innerHTML);
      }

      // Two presses, and what it writes is chat's OWN file. No shell
      // surface, no hub call — the app can reach nothing but its own log,
      // which is the whole reason the flag lives there.
      el(app, 'rc-peer-strip').fire('click', { target: dataStub('data-rc-block', BERT) });
      el(app, 'rc-peer-strip').fire('click', { target: dataStub('data-rc-block', BERT) });
      if (blockedHereInStore(app, BERT)) {
        test.check('the second press writes the refusal into chat\'s own log');
      } else {
        test.fail('after two presses: ' + app.store[chatLog.fileFor(BERT)]);
      }

      // Nothing left the app. A node-global switch reached by a mere app
      // is the thing this design exists to avoid, so the absence is the
      // property — checked against a log that DID record other calls.
      const peerPosts = app.log.filter(function (c) { return c.url.indexOf('/api/hub/peer') === 0; });
      if (peerPosts.length === 0 && app.log.length > 0) {
        test.check('and asks the hub for nothing — the node\'s block is not chat\'s to set');
      } else {
        test.fail('hub calls: ' + JSON.stringify(app.log.map(function (c) { return c.url; })));
      }

      // ❌ and no × : a refusal is the whole of why the row is not a
      // conversation, so it replaces the waiting mark rather than
      // stacking with it. And 📇 is absent — the node has refused nobody.
      const marked = el(app, 'rc-to-pick').innerHTML;
      const bertLine = marked.slice(marked.indexOf(BERT));
      if (bertLine.indexOf('❌') !== -1 && bertLine.indexOf('📇') === -1) {
        test.check('and the row wears ❌ for this app\'s refusal, and no rolodex');
      } else {
        test.fail('marks: ' + marked);
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

// Two refusals exist, they are different facts, and neither undoes the
// other: you may lift what you decided, not what somebody else decided.
// This is the whole of what the strip and the marks are for.
function blockedRowsUnblock() {
  test.subHeading('Chat lifts its own refusal, and never the node\'s');

  const BERT = 'MCowBQYDK2VwAyEAbertbertbertbertbertbertbertbertbertb=';
  const bound = { label: 'andy', boundAt: '2026-09-07T00:00:00.000Z' };
  const person = { publicKey: BERT, publicLabel: 'bert', caption: 'bert', mine: false };

  // Refused here and nowhere else: a log file that already carries the
  // flag, which is what a reload finds.
  const mineStore = {
    'session.json': JSON.stringify(bound),
    [chatLog.fileFor(BERT)]: chatLog.serialize(BERT, [], true),
  };
  const mine = mountApp(mineStore, { inboxStatus: 200, people: [Object.assign({}, person, { held: false, blocked: false })] });

  return settle().then(function () {
    // Still listed, at the bottom: a row that vanished could never be
    // unblocked, and a list you can be removed from silently is a list
    // nobody can undo a mistake in.
    const list = el(mine, 'rc-to-pick').innerHTML;
    if (/optgroup label="Blocked"/.test(list) && list.indexOf(BERT) !== -1) {
      test.check('a peer refused here is still listed, at the bottom');
    } else {
      test.fail('list: ' + list);
    }

    el(mine, 'rc-to-pick').value = BERT;
    el(mine, 'rc-to-pick').fire('change');
    return settle().then(function () {
      const strip = el(mine, 'rc-peer-strip').innerHTML;
      if (/data-rc-unblock="/.test(strip) && />Unblock here</.test(strip)) {
        test.check('and offers Unblock here beside the To control');
      } else {
        test.fail('own-block strip: ' + strip);
      }

      el(mine, 'rc-peer-strip').fire('click', { target: dataStub('data-rc-unblock', BERT) });
      if (!blockedHereInStore(mine, BERT)) {
        test.check('which takes it off in one press, in chat\'s own file');
      } else {
        test.fail('after unblock: ' + mine.store[chatLog.fileFor(BERT)]);
      }

      // The other refusal: the node's, set in Contacts. Chat marks it and
      // offers nothing — the rolodex on the row IS the pointer to where
      // it is lifted, so a route would be a second way of saying it.
      const theirsStore = { 'session.json': JSON.stringify(bound) };
      const theirs = mountApp(theirsStore, {
        inboxStatus: 200,
        people: [Object.assign({}, person, { held: true, blocked: true })],
      });
      return settle().then(function () {
        const theirList = theirs.doc.byId['rc-to-pick'].innerHTML;
        const theirLine = theirList.slice(theirList.indexOf(BERT));
        if (theirLine.indexOf('📇') !== -1 && theirLine.indexOf('❌') === -1) {
          test.check('a peer the NODE refuses wears 📇, and not chat\'s mark');
        } else {
          test.fail('marks: ' + theirList);
        }

        el(theirs, 'rc-to-pick').value = BERT;
        el(theirs, 'rc-to-pick').fire('change');
        return settle().then(function () {
          // No verb — chat has none to offer about a refusal that is not
          // its own — but the way to where the verb lives, wearing the
          // same picture the row wears.
          const theirStrip = el(theirs, 'rc-peer-strip').innerHTML;
          if (theirStrip.indexOf('rc-open-contacts') !== -1 && theirStrip.indexOf('📇') !== -1 &&
              theirStrip.indexOf('data-rc-unblock') === -1 && theirStrip.indexOf('data-rc-block') === -1) {
            test.check('and chat offers no verb about them, only the way to Contacts');
          } else {
            test.fail('strip for a node-blocked row: ' + theirStrip);
          }

          // And it goes there. The id is the one a waiting row's sentence
          // uses, so a single handler answers both routes.
          let opened = '';
          theirs.api.launchApp = function (id) { opened = id; };
          el(theirs, 'rc-peer-strip').fire('click', { target: closestStub('rc-open-contacts') });
          if (opened === 'app/contacts') {
            test.check('and pressing it opens the app that owns the refusal');
          } else {
            test.fail('launched: ' + opened);
          }

          if (el(theirs, 'rc-composer').style.display === 'none') {
            test.check('and there is nothing to type at them while it stands');
          } else {
            test.fail('composer shown for a node-blocked row');
          }

          // Both at once. The node's mark wins the strip whatever chat
          // decided, or pressing Unblock here would lift chat's flag and
          // the person would stay gone — a button that appears to fail.
          const bothStore = {
            'session.json': JSON.stringify(bound),
            [chatLog.fileFor(BERT)]: chatLog.serialize(BERT, [], true),
          };
          const both = mountApp(bothStore, {
            inboxStatus: 200,
            people: [Object.assign({}, person, { held: true, blocked: true })],
          });
          return settle().then(function () {
            const bothList = both.doc.byId['rc-to-pick'].innerHTML;
            const bothLine = bothList.slice(bothList.indexOf(BERT));
            if (bothLine.indexOf('📇') !== -1 && bothLine.indexOf('❌') !== -1) {
              test.check('a peer refused by both wears both marks');
            } else {
              test.fail('marks: ' + bothList);
            }

            el(both, 'rc-to-pick').value = BERT;
            el(both, 'rc-to-pick').fire('change');
            return settle().then(function () {
              // The node's refusal wins the strip whatever chat decided:
              // an Unblock here would lift chat's flag and the person
              // would stay gone, which is a button that appears to fail.
              const bothStrip = el(both, 'rc-peer-strip').innerHTML;
              if (bothStrip.indexOf('rc-open-contacts') !== -1 && bothStrip.indexOf('data-rc-unblock') === -1) {
                test.check('and still offers no verb: the node\'s refusal wins the strip');
              } else {
                test.fail('strip with both: ' + bothStrip);
              }
            });
          });
        });
      });
    });
  });
}

// The trap this design creates, and the reason it is a test rather than a
// comment: recordMessages writes the log on every inbox read, and a save
// that carried only the entries would erase the block the first time the
// blocked peer wrote again.
function blockSurvivesTheNextMessage() {
  test.subHeading('A refused peer\'s mail is filed, counts for nothing, and does not lift the block');

  const BERT = 'MCowBQYDK2VwAyEAbertbertbertbertbertbertbertbertbertb=';
  const ME = 'MCowBQYDK2VwAyEAandyandyandyandyandyandyandyandyandya=';
  const store = {
    'session.json': JSON.stringify({ label: 'andy', boundAt: '2026-09-07T00:00:00.000Z' }),
    [chatLog.fileFor(BERT)]: chatLog.serialize(BERT, [], true),
  };
  const app = mountApp(store, {
    inboxStatus: 200,
    people: [{ publicKey: BERT, publicLabel: 'bert', caption: 'bert', mine: false, held: false, blocked: false }],
    messages: [{
      id: '31', from: 'bert', to: 'andy', fromKey: BERT, toKey: ME,
      text: 'still here', sentAt: '2026-09-08T11:00:00.000Z',
    }],
  });

  return settle().then(function () {
    const filed = app.store[chatLog.fileFor(BERT)] || '';

    // Filed, because a chat block stops this app showing them and never
    // the mailbox accepting them. Unblocking has to find the backlog
    // rather than a conversation with a silent hole in it.
    if (/still here/.test(filed)) {
      test.check('their line is filed while the refusal stands');
    } else {
      test.fail('log: ' + filed);
    }

    // And the refusal is still in the header beside it. This is the one
    // that would otherwise ship broken.
    if (blockedHereInStore(app, BERT)) {
      test.check('and writing it did not erase the refusal it was written under');
    } else {
      test.fail('the block was lost on the next message: ' + filed);
    }

    // No dot, no count, no New button. Their lines keep arriving, but
    // asking for attention on behalf of somebody already refused is what
    // a mark would be.
    const list = el(app, 'rc-to-pick').innerHTML;
    const line = list.slice(list.indexOf(BERT));
    if (line.indexOf('•') === -1 && el(app, 'rc-filter-new').style.display === 'none') {
      test.check('and it lights nothing: no dot on the row, no New to press');
    } else {
      test.fail('marks: ' + list + ' / New ' + el(app, 'rc-filter-new').style.display);
    }
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
          // Read off the list, not view.json — the filter is a place to
          // stand and is never written down. Stranded would mean the
          // button gone AND the list still narrowed to unread; what has
          // to be true is that everyone is on offer again.
          const hidden = el(app, 'rc-filter-new').style.display === 'none';
          const showsEveryone = el(app, 'rc-to-pick').innerHTML.indexOf(BERT) !== -1;
          if (hidden && showsEveryone) {
            test.check('and switching it on does not strand you in a filter you cannot leave');
          } else {
            test.fail('after dnd: New hidden ' + hidden + ', list ' + el(app, 'rc-to-pick').innerHTML);
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

reloadRestores()
  .then(enterSendsExactlyOnce)
  .then(settingsOnlyDisturb)
  .then(policyTravelsFromContacts)
  .then(heldRowsPointAtContacts)
  .then(blockedRowsUnblock)
  .then(blockSurvivesTheNextMessage)
  .then(noAddressBookInChat)
  .then(doNotDisturb)
  .then(newOpensTheList)
  .then(sendsAndReadsPackets)
  .then(composerOffersTheMailbox)
  .then(nothingStored)
  .then(threadMarksOwnLines)
  .then(viewIsRemembered)
  .then(unreadDots)
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
