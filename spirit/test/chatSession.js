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
    log.push({ url: url, method: (init && init.method) || 'GET' });
    const body = {
      messages: options.messages || [],
      ownedUrls: options.ownedUrls || [],
      rows: options.rows || [],
      mustPick: !!options.mustPick,
      people: options.people || [],
      reservedName: 'relay',
      mailboxPublicKey: options.mailboxPublicKey || null,
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
    shellSpirit, doc, { spiritChatLog: chatLog, spiritPeerFile: peerFile },
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

function claimBinds() {
  test.subHeading('Claim binds the chrome');

  const store = {};
  const app = mountApp(store, { claimStatus: 201, claimBody: { peer: { name: 'andy' } } });

  if (titleOf(app) === 'Relay Chat' && app.doc.title === 'Relay Chat') {
    test.check('before any claim the chrome is plain "Relay Chat"');
  } else {
    test.fail('unbound title: ' + titleOf(app) + ' / ' + app.doc.title);
  }

  el(app, 'rc-name').value = 'andy';
  el(app, 'rc-claim').fire('click');

  return settle().then(function () {
    if (titleOf(app) === 'Relay Chat [andy]' && app.doc.title === 'Relay Chat [andy]') {
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

    const note = el(empty, 'rc-unbound').textContent;
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

        const copy = el(unbound, 'rc-unbound').textContent;
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

      // Bound: neither. The page is a conversation, not a form.
      const bound = mountApp(
        { 'session.json': JSON.stringify({ label: 'andy', boundAt: '2026-09-07T00:00:00.000Z' }) },
        { inboxStatus: 200 }
      );
      return settle().then(function () {
        if (el(bound, 'rc-claim-row').style.display === 'none' &&
            el(bound, 'rc-unbound').textContent === '') {
          test.check('a bound node is shown neither the form nor the explanation');
        } else {
          test.fail('bound node still has unbound chrome');
        }

        const missing = ['rc-to-bar', 'rc-to-pick', 'rc-thread', 'rc-composer']
          .filter(function (id) { return el(bound, id).style.display === 'none'; });
        if (missing.length === 0) {
          test.check('and gets the whole app back the moment it has a name');
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

    if (/Relay Chat \[andy\] · 1/.test(app.doc.title)) {
      test.check('and the title counts it, for a tab that is not in front of you');
    } else {
      test.fail('title: ' + app.doc.title);
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

      if (!/•/.test(el(app, 'rc-to-pick').innerHTML) && app.doc.title === 'Relay Chat [andy]') {
        test.check('and the mark and the count both go');
      } else {
        test.fail('marks left: ' + app.doc.title + ' ' + el(app, 'rc-to-pick').innerHTML);
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

claimBinds()
  .then(claimRowHidesOnceBound)
  .then(enterSendsExactlyOnce)
  .then(inviteOnlyForAnOwner)
  .then(composerOffersTheMailbox)
  .then(reloadRestores)
  .then(nothingStored)
  .then(threadMarksOwnLines)
  .then(viewIsRemembered)
  .then(unreadDots)
  .then(unboundChrome)
  .then(mailArrivesOnTheRow)
  .then(newFilterSnapsBack)
  .then(function () { test.reportSuccessFailureCount(); })
  .catch(function (err) {
    test.fail('chat 1 threw: ' + ((err && err.stack) || err));
    test.reportSuccessFailureCount();
  });
