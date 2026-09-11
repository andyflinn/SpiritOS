'use strict';

// Binding this node to a mailbox, in the app that owns it (packet 3).
//
// Claiming a name used to happen in the chat window, which is why the
// chat window also held the binding file, the invite mint and the copy a
// stranger reads on first run. None of that is chat. It is Natter's:
// the list of mailboxes is the same page as the claim on one of them,
// and Natter is the app a fresh node is shown (firstRun, shell.js).
//
// Driven the way chatSession and contacts are: the real natter.js with
// small document/api/fetch stubs, so "Claim writes the binding and tells
// the shell" is a test rather than a screenshot.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const spirit = require('../run/js/kernel.js');

const RUN_DIR = path.join(__dirname, '..', 'run');
const APP_SCRIPT = path.join(RUN_DIR, 'app', 'natter', 'natter.js');
const SEEDED = [{ label: 'spirit', url: 'https://spirit.example' }];

function fakeElement(id) {
  let html = '';
  const el = {
    id: id,
    value: '',
    textContent: '',
    style: {},
    dataset: {},
    open: false,
    children: [],
    listeners: {},
    addEventListener: function (event, fn) { (el.listeners[event] = el.listeners[event] || []).push(fn); },
    appendChild: function (child) { el.children.push(child); return child; },
    fire: function (event, arg) { (el.listeners[event] || []).forEach(function (fn) { fn(arg || {}); }); },
    click: function () { el.fire('click'); },
    querySelector: function (selector) { return el.byId ? el.byId(selector) : fakeElement('found'); },
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
  return {
    byId: byId,
    activeElement: null,
    getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); },
    createElement: fakeElement,
  };
}

function mountApp(options) {
  const opts = options || {};
  const doc = fakeDocument();
  const log = [];
  const store = { 'relays.json': JSON.stringify(opts.relays === undefined ? SEEDED : opts.relays) };
  let label = opts.label || '';
  let told = 0;

  const fakeFetch = function (url, init) {
    log.push({ url: url, method: (init && init.method) || 'GET', body: init && init.body });
    let status = 200;
    let payload = { rows: opts.rows || [], ownedUrls: opts.ownedUrls || [], mustPick: !!opts.mustPick };
    if (url.indexOf('/api/hub/claim') === 0) {
      status = opts.claimStatus || 201;
      payload = opts.claimBody || { peer: { name: 'andy' } };
    } else if (url.indexOf('/api/hub/invite') === 0) {
      status = opts.inviteStatus || 201;
      payload = opts.inviteBody || { token: 'saint-bernard' };
    } else if (url.indexOf('/api/hub/inbox') === 0) {
      status = opts.inboxStatus || 200;
      payload = { messages: [] };
    }
    const text = JSON.stringify(payload);
    return Promise.resolve({
      status: status,
      text: function () { return Promise.resolve(text); },
      json: function () { return Promise.resolve(JSON.parse(text)); },
    });
  };

  let behavior = null;
  const shellSpirit = {
    shell: { activateApp: function (b) { behavior = b; },
      // The shared facts bubble (factRow, shell.js). Real output, not a
      // placeholder — the tests read what a panel actually renders.
      factRow: function (pairs) {
        return '<div class="fact-row">' + (pairs || []).map(function (pair) {
          return '<div class="fact">' +
            '<span class="fact-label">' + spirit.core.util.escapeHtml(String(pair[0])) + '</span>' +
            '<span class="fact-value">' + spirit.core.util.escapeHtml(String(pair[1])) + '</span>' +
            '</div>';
        }).join('') + '</div>';
      },
    },
    core: {
      util: { escapeHtml: spirit.core.util.escapeHtml },
      const: { ICON: spirit.core.const.ICON },
    },
  };

  const src = fs.readFileSync(APP_SCRIPT, 'utf8');
  // setInterval is injected, as chatSession does for Relay Chat's poll.
  // The device panel re-asks the hub every two seconds while a row is
  // open, and a real interval here keeps node's event loop alive after
  // the assertions are done — the suite passes and then hangs forever,
  // which is a worse failure than a red line because nothing says why.
  //
  // The ticks are not what this suite is about, so they are counted and
  // dropped. clearInterval takes the same treatment so the app's own
  // cleanup path still runs without throwing.
  let intervalsStarted = 0;
  const fakeSetInterval = function () { intervalsStarted += 1; return intervalsStarted; };
  const fakeClearInterval = function () {};
  new Function('spirit', 'document', 'window', 'fetch', 'setInterval', 'clearInterval', src)(
    shellSpirit, doc, { spiritOwnerBadge: { canRemoveMailbox: function (n) { return n > 1; } } },
    fakeFetch, fakeSetInterval, fakeClearInterval
  );

  const container = fakeElement('container');
  container.byId = function () { return doc.getElementById('natter-tbody'); };

  const called = [];
  const api = {
    escapeHtml: spirit.core.util.escapeHtml,
    // Opening a mailbox IS a call now: the panel that used to unfold
    // inside the row is app/natterDetails, pushed for the row it was
    // opened from. Recorded rather than dropped, because which dialog a
    // row names with which params is the whole of what the click does.
    callDialog: function (id, params) {
      called.push({ id: id, params: params });
      // What the screen decided. A dialog that decided nothing answers
      // null, and costs this list nothing.
      return Promise.resolve(opts.dialogResult || null);
    },
    // The shell's own accessor, which reads the file this app writes.
    nodeLabel: function () { return label; },
    nodeLabelChanged: function () { told += 1; label = store['session.json']
      ? (JSON.parse(store['session.json']) || {}).label || ''
      : ''; },
    fs: {
      loadFile: function (name) { return Object.prototype.hasOwnProperty.call(store, name) ? store[name] : null; },
      saveFile: function (name, content) { store[name] = content; return Promise.resolve(); },
      deleteFile: function (name) { delete store[name]; return { ok: true }; },
    },
  };

  behavior.mount(container, api, null);
  return {
    doc: doc, log: log, store: store, container: container,
    told: function () { return told; },
    called: called,
  };
}

function el(app, id) { return app.doc.getElementById(id); }

function settle() {
  return new Promise(function (resolve) { setImmediate(resolve); })
    .then(function () { return new Promise(function (r) { setImmediate(r); }); });
}

test.startTest('Natter — where this node gets its name');

function unboundIsThePage() {
  test.subHeading('A node with no name is shown one thing to do');

  const app = mountApp({});

  return settle().then(function () {
    const note = el(app, 'natter-bind-note').innerHTML;
    // On a fresh node this paragraph IS the page — Natter is the only
    // app the shell shows until a claim succeeds — so the way in for
    // somebody holding no invite is in it, and loudly.
    if (/<strong>[^<]*countinn@gmail\.com[^<]*<\/strong>/.test(note) && /If you were invited/.test(note)) {
      test.check('it says how to claim, and who to ask for an invite');
    } else {
      test.fail('unbound copy: ' + note);
    }

    if (el(app, 'natter-bind-row').style.display !== 'none') {
      test.check('and the claim form is on the page');
    } else {
      test.fail('claim row hidden while unbound');
    }

    // A claim happens ON a mailbox, and the form never said which. The
    // heading does — there is no URL field and there should not be: the
    // hub claims on the first Natter row only, so a box offering any
    // other would be ignored.
    if (el(app, 'natter-bind-heading').textContent === 'Claim a name on spirit') {
      test.check('the heading names the mailbox the claim will happen on');
    } else {
      test.fail('bind heading: ' + el(app, 'natter-bind-heading').textContent);
    }

    // And a name, not an invite: the owner of a mailbox claims with no
    // token at all.
    if (el(app, 'natter-bind-heading').textContent.indexOf('invite') === -1) {
      test.check('and calls it a name, because an owner needs no invite');
    } else {
      test.fail('heading promises an invite: ' + el(app, 'natter-bind-heading').textContent);
    }

    // Adding a mailbox is not the first thing a new node does — claiming
    // a name on the one it ships with is.
    if (el(app, 'natter-add-row').style.display === 'none') {
      test.check('and adding a relay is not offered before there is a name');
    } else {
      test.fail('add row shown while unbound with a mailbox listed');
    }

    // A different problem, and a different sentence: nothing to claim on
    // yet. Reachable here because this is also the app that adds one.
    const empty = mountApp({ relays: [] });
    return settle().then(function () {
      const copy = el(empty, 'natter-bind-note').innerHTML;
      if (/no relay listed yet/.test(copy) && el(empty, 'natter-bind-fields').style.display === 'none') {
        test.check('with no relay listed it says so, and offers no name to claim');
      } else {
        test.fail('empty-list copy: ' + copy + ' / fields ' + el(empty, 'natter-bind-fields').style.display);
      }

      // ...and with nothing listed, adding one IS the first thing, so it
      // comes back. Hiding the only control that could fix an empty list
      // would leave the node with no way forward and no way to say so.
      if (el(empty, 'natter-add-row').style.display !== 'none') {
        test.check('but with nothing listed it is the only way forward, so it is offered');
      } else {
        test.fail('add row hidden with an empty list');
      }

      // The heading degrades to the step that comes first, rather than
      // naming a relay that is not there.
      if (/Add a relay below/.test(el(empty, 'natter-bind-heading').textContent)) {
        test.check('and the heading asks for one instead of naming none');
      } else {
        test.fail('empty heading: ' + el(empty, 'natter-bind-heading').textContent);
      }
    });
  });
}

function claimBinds() {
  test.subHeading('Claim is what binds the node');

  const app = mountApp({});

  return settle().then(function () {
    el(app, 'natter-name').value = 'andy';
    el(app, 'natter-claim').fire('click');

    return settle().then(function () {
      const claims = app.log.filter(function (c) { return c.url.indexOf('/api/hub/claim') === 0; });
      if (claims.length === 1 && JSON.parse(claims[0].body).name === 'andy' &&
          JSON.parse(claims[0].body).invite === undefined) {
        test.check('a name with no token claims without one');
      } else {
        test.fail('claim calls: ' + JSON.stringify(claims));
      }

      // The binding is this app's file now, and the shell is TOLD rather
      // than left to notice: claiming is what ends first run, and that
      // must not wait on an fs-watcher.
      let saved = null;
      try { saved = JSON.parse(app.store['session.json']); } catch (e) { saved = null; }
      if (saved && saved.label === 'andy' && saved.boundAt) {
        test.check('and the binding is written here, with when it happened');
      } else {
        test.fail('session.json: ' + app.store['session.json']);
      }

      if (app.told() === 1) {
        test.check('and the shell is told, so the rest of the apps appear');
      } else {
        test.fail('nodeLabelChanged called ' + app.told() + ' times');
      }

      if (el(app, 'natter-add-row').style.display !== 'none') {
        test.check('and adding a mailbox becomes available once there is a name');
      } else {
        test.fail('add row still hidden after binding');
      }

      if (el(app, 'natter-bind-row').style.display === 'none') {
        test.check('and the claim form goes, because claiming is what you do once');
      } else {
        test.fail('claim row still shown after binding');
      }
    });
  });
}

function tokenGoesWithTheName() {
  test.subHeading('An invited name carries its spoken word');

  const app = mountApp({});

  return settle().then(function () {
    el(app, 'natter-name').value = 'bert';
    el(app, 'natter-token').value = 'saint-bernard';
    el(app, 'natter-claim').fire('click');

    return settle().then(function () {
      const body = JSON.parse(app.log.filter(function (c) { return c.url.indexOf('/api/hub/claim') === 0; })[0].body);
      if (body.name === 'bert' && body.invite === 'saint-bernard') {
        test.check('the token travels with the claim, not instead of it');
      } else {
        test.fail('claim body: ' + JSON.stringify(body));
      }
    });
  });
}

function refusalDoesNotBind() {
  test.subHeading('A refused claim binds nothing');

  // 409 is only this node when the peer already there carries OUR key —
  // the hub marks that `mine`. Any other 409 is somebody else's name.
  const taken = mountApp({ claimStatus: 409, claimBody: { peer: { name: 'andy' }, mine: false } });

  return settle().then(function () {
    if (taken.store['session.json'] === undefined && taken.told() === 0) {
      test.check("somebody else's name is not a binding");
    } else {
      test.fail('bound on a foreign 409');
    }

    const ours = mountApp({ claimStatus: 409, claimBody: { peer: { name: 'andy' }, mine: true } });
    return settle().then(function () {
      el(ours, 'natter-name').value = 'andy';
      el(ours, 'natter-claim').fire('click');
      return settle().then(function () {
        if (ours.store['session.json'] !== undefined) {
          test.check('but a 409 carrying our own key is a bind, not an error');
        } else {
          test.fail('a 409 with mine:true did not bind');
        }
      });
    });
  });
}

// A click on a row, and a click on the Invite inside it. Both are
// delegated on the table, so the test hands the handler what the browser
// would: the element the click landed on, answering closest().
const OWNED = 'https://spirit.example';

function rowTarget(url) {
  const node = { dataset: {}, getAttribute: function () { return null; } };
  node.closest = function (selector) { return selector === '[data-row-url]' ? node : null; };
  node.getAttribute = function (name) { return name === 'data-row-url' ? url : null; };
  return node;
}

function mintTarget(url, fields) {
  // Shaped like the real thing, because a stub that is not costs a bug.
  //
  // This used to answer the panel for parentNode, so every lookup worked
  // whichever way the code asked. Then the fields and the button became a
  // row inside the panel (§3), the answer span stayed a sibling of that
  // row — and the browser stopped finding it while this test went on
  // passing. A mint succeeded and said nothing.
  //
  // So the row knows only what the row contains.
  const row = {
    querySelector: function (selector) {
      const name = selector.replace('.', '');
      return name === 'natter-inv-out' ? null : (fields[name] || null);
    },
  };
  const panel = {
    querySelector: function (selector) { return fields[selector.replace('.', '')] || null; },
  };
  const node = {
    parentNode: row,
    dataset: {},
    getAttribute: function (name) { return name === 'data-mint-url' ? url : null; },
  };
  // Both questions the real element is asked: which mint button this is,
  // and which panel it is in.
  node.closest = function (selector) {
    if (selector === '[data-mint-url]') return node;
    if (selector === '.natter-mint') return panel;
    return null;
  };
  return node;
}

// THE PANEL MOVED, AND SO DID ITS CHECKS. What a mailbox reports, the
// mint, and the device window are app/natterDetails now, covered by
// spirit/test/natterDetails.js. A row does not unfold; it opens a screen.
//
// What is left for THIS suite is the half that is still the list's: that
// a row opens the right mailbox, that Remove is answered ahead of it, and
// that a mint made over there is remembered here.
function aRowOpensTheMailbox() {
  test.subHeading('A row opens its mailbox, and that is all a row does');

  const app = mountApp({
    label: 'andy',
    rows: [{ url: OWNED, label: 'spirit', owned: true, report: { owner: 'andy', mode: 'keys', peers: [], messages: 0 } }],
  });

  return settle().then(function () {
    const tbody = app.doc.getElementById('natter-tbody');

    // ONE ROW PER MAILBOX. The second <tr> the expansion used to add is
    // gone, and with it the colspan that made the widest thing on the
    // page live inside the narrowest.
    const rowCount = (tbody.innerHTML.match(/<tr/g) || []).length;
    if (rowCount === 1 && tbody.innerHTML.indexOf('colspan') === -1) {
      test.check('a mailbox is one row, with nothing folded underneath it');
    } else {
      test.fail(rowCount + ' rows: ' + tbody.innerHTML);
    }

    tbody.fire('click', { target: rowTarget(OWNED) });
    const call = app.called[app.called.length - 1] || {};
    if (call.id === 'app/natterDetails' && call.params && call.params.url === OWNED) {
      test.check('and clicking it calls the mailbox screen for THAT url');
    } else {
      test.fail('call: ' + JSON.stringify(call));
    }

    // The screen signs a status ask of its own, and needs this node's
    // name to do it. Handed over rather than re-read, because the shell
    // already told this app what it is called.
    if (call.params && call.params.label === 'andy') {
      test.check('and hands it this node\'s name, which is what signs a status ask');
    } else {
      test.fail('no label in params: ' + JSON.stringify(call.params));
    }
  });
}

// minted.json is the LIST's file, and the screen cannot write it: a
// dialog's api.fs is scoped to its own folder. So the label comes back as
// the dialog's answer and this app records it — which is the whole reason
// a dialog returns anything.
function aMintOverThereIsRememberedHere() {
  const app = mountApp({
    label: 'andy',
    rows: [{ url: OWNED, label: 'spirit', owned: true, report: { owner: 'andy', mode: 'keys', peers: [], messages: 0 } }],
    dialogResult: { changed: true, url: OWNED, minted: 'saint' },
  });

  return settle().then(function () {
    app.doc.getElementById('natter-tbody').fire('click', { target: rowTarget(OWNED) });
    return settle().then(function () {
      const minted = app.store['minted.json'] || '';
      if (/saint/.test(minted)) {
        test.check('a label minted on that screen is remembered by this one');
      } else {
        test.fail('minted.json: ' + minted);
      }

      // Never the token. It is the spoken secret and it does not leave
      // the screen it was read off.
      if (minted.indexOf('saint-bernard') === -1) {
        test.check('and the token is not, because that is the spoken secret');
      } else {
        test.fail('a token reached minted.json: ' + minted);
      }
    });
  });
}

function staleBindingIsDropped() {
  test.subHeading('A name the mailbox no longer answers for');

  // The stored label is a question; the mailbox answers it. A signed
  // inbox read is the cheapest form of "is this still me", and the app
  // that owns the file is the one that asks.
  const app = mountApp({ label: 'andy', inboxStatus: 403 });
  app.store['session.json'] = JSON.stringify({ label: 'andy', boundAt: '2026-09-07T00:00:00.000Z' });

  return settle().then(function () {
    return settle().then(function () {
      if (app.store['session.json'] === undefined) {
        test.check('a 403 drops the binding rather than re-checking it forever');
      } else {
        test.fail('session survived a 403: ' + app.store['session.json']);
      }

      if (/claim again/.test(el(app, 'natter-bind-status').textContent)) {
        test.check('and says so, where the claim form is');
      } else {
        test.fail('status: ' + el(app, 'natter-bind-status').textContent);
      }
    });
  });
}

function chatKeepsNoBinding() {
  test.subHeading('And the chat window is out of it');

  const chat = fs.readFileSync(path.join(RUN_DIR, 'app', 'relayChat', 'relayChat.js'), 'utf8');
  const gone = ['rc-claim', 'rc-name', 'rc-invite', 'session.json', '/api/hub/claim', '/api/hub/invite']
    .filter(function (needle) { return chat.indexOf(needle) !== -1; });
  if (gone.length === 0) {
    test.check('relayChat.js neither claims, mints, nor keeps a binding');
  } else {
    test.fail('still in the chat window: ' + gone.join(', '));
  }

  // It asks the shell instead, which reads the file this app writes.
  if (/api\.nodeLabel\(\)/.test(chat)) {
    test.check('it asks the shell who this node is');
  } else {
    test.fail('relayChat.js does not use api.nodeLabel');
  }

  return Promise.resolve();
}

unboundIsThePage()
  .then(claimBinds)
  .then(tokenGoesWithTheName)
  .then(refusalDoesNotBind)
  .then(aRowOpensTheMailbox)
  .then(aMintOverThereIsRememberedHere)
  .then(staleBindingIsDropped)
  .then(chatKeepsNoBinding)
  .then(function () { test.reportSuccessFailureCount(); })
  .catch(function (err) {
    test.fail('natter bind threw: ' + ((err && err.stack) || err));
    test.reportSuccessFailureCount();
  });
