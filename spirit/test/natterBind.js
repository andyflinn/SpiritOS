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
    shell: { activateApp: function (b) { behavior = b; } },
    core: {
      util: { escapeHtml: spirit.core.util.escapeHtml },
      const: { ICON: spirit.core.const.ICON },
    },
  };

  const src = fs.readFileSync(APP_SCRIPT, 'utf8');
  new Function('spirit', 'document', 'window', 'fetch', src)(
    shellSpirit, doc, { spiritOwnerBadge: { canRemoveMailbox: function (n) { return n > 1; } } }, fakeFetch
  );

  const container = fakeElement('container');
  container.byId = function () { return doc.getElementById('natter-tbody'); };

  const api = {
    escapeHtml: spirit.core.util.escapeHtml,
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
      if (/no mailbox listed yet/.test(copy) && el(empty, 'natter-bind-fields').style.display === 'none') {
        test.check('with no mailbox listed it says so, and offers no name to claim');
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
      // naming a mailbox that is not there.
      if (/Add a mailbox below/.test(el(empty, 'natter-bind-heading').textContent)) {
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
function rowTarget(url) {
  const node = { dataset: {}, getAttribute: function () { return null; } };
  node.closest = function (selector) { return selector === '[data-row-url]' ? node : null; };
  node.getAttribute = function (name) { return name === 'data-row-url' ? url : null; };
  return node;
}

function mintTarget(url, fields) {
  const panel = {
    querySelector: function (selector) { return fields[selector.replace('.', '')]; },
  };
  const node = {
    parentNode: panel,
    dataset: {},
    getAttribute: function (name) { return name === 'data-mint-url' ? url : null; },
  };
  node.closest = function (selector) { return selector === '[data-mint-url]' ? node : null; };
  return node;
}

function inviteLivesInTheRowItMintsOn() {
  test.subHeading('Minting happens inside the mailbox it mints on');

  const OWNED = 'https://spirit.example';
  const friend = mountApp({
    label: 'bert',
    rows: [{ url: OWNED, label: 'spirit', owned: false, error: 'not owner' }],
  });

  return settle().then(function () {
    // Not hidden — not built. A mailbox somebody else owns has no mint
    // markup at all to find, because the panel returns before it.
    const tbody = friend.doc.getElementById('natter-tbody');
    tbody.fire('click', { target: rowTarget(OWNED) });
    if (tbody.innerHTML.indexOf('natter-inv-go') === -1) {
      test.check('a mailbox this node does not own offers no mint at all');
    } else {
      test.fail('mint offered on an unowned row: ' + tbody.innerHTML);
    }

    const owner = mountApp({
      label: 'andy',
      rows: [{ url: OWNED, label: 'spirit', owned: true, report: { owner: 'andy', mode: 'keys', peers: [], messages: 0 } }],
    });
    return settle().then(function () {
      const rows = owner.doc.getElementById('natter-tbody');
      rows.fire('click', { target: rowTarget(OWNED) });
      const panel = rows.innerHTML;

      // In the row's own panel, under what that mailbox reports.
      if (/natter-inv-go/.test(panel) && /data-mint-url="https:\/\/spirit.example"/.test(panel)) {
        test.check('an owned row opens onto the mint for that mailbox');
      } else {
        test.fail('owned row panel: ' + panel);
      }

      // Two blocks, and the facts are one line rather than four rows:
      // the row above is the heading, and label-over-value stacked made
      // a list out of what is one reading.
      const facts = (panel.match(/natter-fact"/g) || []).length;
      if (/natter-facts/.test(panel) && facts === 4 && panel.indexOf('file-info-row') === -1) {
        test.check('and what the mailbox reports is one row of four facts');
      } else {
        test.fail('report layout: ' + panel);
      }

      // The mint is its own tile, so it carries its own space and a row
      // without one leaves no gap behind.
      if (/stat-tile wide natter-mint/.test(panel)) {
        test.check('with the mint as a second block, spaced by itself');
      } else {
        test.fail('mint is not its own block: ' + panel);
      }

      // And it is the one block here that gets a heading: the facts
      // above are a reading of the row that opened them, but this is a
      // thing to do. The mark is the shell's own ★ — the same one the
      // row carries for owning the mailbox.
      if (panel.indexOf(spirit.core.const.ICON.STAR + ' Invite someone to this relay') !== -1) {
        test.check('and says what it is, with the mark that means owned');
      } else {
        test.fail('mint heading: ' + panel);
      }

      // And no picker, ever again: the row is which mailbox. A question
      // nobody has to ask cannot be answered wrongly.
      if (panel.indexOf('natter-inv-pick') === -1 && panel.indexOf('Mailbox<select') === -1) {
        test.check('and asks no "which mailbox", because the row already said');
      } else {
        test.fail('a picker survived: ' + panel);
      }

      const out = { textContent: '' };
      rows.fire('click', {
        target: mintTarget(OWNED, {
          'natter-inv-label': { value: 'saint' },
          'natter-inv-days': { value: '7' },
          'natter-inv-token': { value: '' },
          'natter-inv-out': out,
        }),
      });

      return settle().then(function () {
        const mints = owner.log.filter(function (c) { return c.url.indexOf('/api/hub/invite') === 0; });
        const body = mints.length ? JSON.parse(mints[0].body) : null;
        if (body && body.label === 'saint' && body.days === 7 && body.url === OWNED) {
          test.check('minting names the mailbox whose row it was pressed in');
        } else {
          test.fail('mint body: ' + JSON.stringify(body));
        }

        // Printed, not copied: it is read off this screen onto a phone.
        if (/saint-bernard/.test(out.textContent)) {
          test.check('and the token the relay stored is shown to be read out');
        } else {
          test.fail('mint output: ' + out.textContent);
        }

        // The label is remembered so the invited key can be recognised
        // when it turns up claimed on this owner's own census. Never the
        // token — that is the secret.
        const minted = owner.store['minted.json'] || '';
        if (/saint/.test(minted) && minted.indexOf('saint-bernard') === -1) {
          test.check('the label is remembered for the census, and the token is not');
        } else {
          test.fail('minted.json: ' + minted);
        }

        // Closing the row rebuilds the table, so the fields and the
        // minted token go with it — a rule the old free-floating panel
        // had to enforce by hand on every toggle.
        rows.fire('click', { target: rowTarget(OWNED) });
        if (rows.innerHTML.indexOf('natter-inv-go') === -1) {
          test.check('and closing the row takes the call with it');
        } else {
          test.fail('mint survived the row closing');
        }
      });
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
  .then(inviteLivesInTheRowItMintsOn)
  .then(staleBindingIsDropped)
  .then(chatKeepsNoBinding)
  .then(function () { test.reportSuccessFailureCount(); })
  .catch(function (err) {
    test.fail('natter bind threw: ' + ((err && err.stack) || err));
    test.reportSuccessFailureCount();
  });
