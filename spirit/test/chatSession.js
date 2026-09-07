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

const RUN_DIR = path.join(__dirname, '..', 'run');
const APP_SCRIPT = path.join(RUN_DIR, 'app', 'relayChat', 'relayChat.js');

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
function fakeApi(store) {
  return {
    escapeHtml: spirit.core.util.escapeHtml,
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
    const body = { messages: [], ownedUrls: [], rows: [], mustPick: false };
    let status = 200;

    if (url.indexOf('/api/hub/inbox') === 0) {
      status = options.inboxStatus || 200;
    } else if (url.indexOf('/api/hub/claim') === 0) {
      status = options.claimStatus || 201;
    }

    const text = JSON.stringify(options.claimBody && url.indexOf('/api/hub/claim') === 0
      ? options.claimBody
      : body);

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
  const api = fakeApi(store);
  let behavior = null;
  const shellSpirit = {
    shell: { activateApp: function (b) { behavior = b; } },
    core: { util: { escapeHtml: spirit.core.util.escapeHtml }, const: { ICON: spirit.core.const.ICON } },
  };

  const src = fs.readFileSync(APP_SCRIPT, 'utf8');
  new Function('spirit', 'document', 'fetch', 'setInterval', src)(
    shellSpirit, doc, fakeFetch(log, options || {}), function () { return 0; }
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

claimBinds()
  .then(reloadRestores)
  .then(nothingStored)
  .then(function () { test.reportSuccessFailureCount(); })
  .catch(function (err) {
    test.fail('chat 1 threw: ' + ((err && err.stack) || err));
    test.reportSuccessFailureCount();
  });
