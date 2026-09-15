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

  // A BOUND FIXTURE NOW HAS THE FILE, because the file is the answer.
  //
  // `opts.label` used to reach the app only through api.nodeLabel(), so
  // a fixture could be "bound" with no session.json at all. The app
  // reads its own file now (natterLoadSession) — bindings are per-relay
  // and the shell's one-label accessor cannot carry them — so a fixture
  // that means bound has to say so where the app looks.
  //
  // Written in the OLD shape on purpose: { label, boundAt } and no
  // `relays` map. That is what every node on disk has today, so every
  // test using opts.label also exercises the migration that carries a
  // legacy label onto the first listed relay.
  if (opts.label) {
    store['session.json'] = JSON.stringify({
      label: opts.label,
      boundAt: '2026-09-07T00:00:00.000Z',
    });
  }
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
    }
    // A `/api/hub/inbox` branch stood here, answering whatever
    // `opts.inboxStatus` said, because Natter checked its binding with a
    // signed inbox read. R8 deleted that route (2026-09-15) and the check
    // moved onto the census — see `claimedLabel` on the rows above, and
    // natterCheckBinding.
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
  test.subHeading('A node with no seat is shown one thing to do');

  const app = mountApp({});

  return settle().then(function () {
    const note = el(app, 'natter-bind-note').innerHTML;
    // On a fresh node this paragraph IS the page — Natter is the only
    // app the shell shows until a claim succeeds — so the way in for
    // somebody holding no invite is in it, and loudly.
    if (/<strong>[^<]*countinn@gmail\.com[^<]*<\/strong>/.test(note)) {
      test.check('it says who to ask for an invite, loudly');
    } else {
      test.fail('unbound copy: ' + note);
    }

    // ── IT POINTS AT THE LIST, IT DOES NOT ASK ──────────────────────
    //
    //   Andy: "the never-bound-to-any-relay form that shows up if I'm
    //   truly not bound yet, it shows up in natter, instead of
    //   natterDetails for spirit.andyflinn.com"
    //
    // The form asked for a label and a token and could not say which
    // relay either was for — hub.handleClaim took relays.json[0]
    // whatever the caller meant. Both halves moved on 2026-09-15: the
    // claim takes a url, and the form lives on the relay's own screen.
    // What is left here is a direction to the list.
    if (/Open a relay in the list below/.test(note)) {
      test.check('and sends you to the relay you mean to join');
    } else {
      test.fail('copy does not point at the list: ' + note);
    }

    if (el(app, 'natter-bind-row').style.display !== 'none') {
      test.check('and the guidance is on the page while nothing is held');
    } else {
      test.fail('guidance hidden while unbound');
    }

    // It states the condition rather than naming a relay it could not
    // have aimed at.
    if (el(app, 'natter-bind-heading').textContent === 'This node has no seat on any relay yet') {
      test.check('the heading says what is missing, not where to put it');
    } else {
      test.fail('bind heading: ' + el(app, 'natter-bind-heading').textContent);
    }

    // Adding a relay is not the first thing a new node does — claiming
    // a seat on one it already lists is.
    if (el(app, 'natter-add-row').style.display === 'none') {
      test.check('and adding a relay is not offered before there is a seat');
    } else {
      test.fail('add row shown while unbound with a relay listed');
    }

    // A different problem, and a different sentence: nothing to claim on
    // yet. Reachable here because this is also the app that adds one.
    const empty = mountApp({ relays: [] });
    return settle().then(function () {
      const copy = el(empty, 'natter-bind-note').innerHTML;
      if (/no relay listed yet/.test(copy)) {
        test.check('with no relay listed it says so');
      } else {
        test.fail('empty-list copy: ' + copy);
      }

      // ...and with nothing listed, adding one IS the first thing, so it
      // comes back. Hiding the only control that could fix an empty list
      // would leave the node with no way forward and no way to say so.
      if (el(empty, 'natter-add-row').style.display !== 'none') {
        test.check('but with nothing listed it is the only way forward, so it is offered');
      } else {
        test.fail('add row hidden with an empty list');
      }

      // The heading degrades to the step that comes first.
      if (/Add a relay below/.test(el(empty, 'natter-bind-heading').textContent)) {
        test.check('and the heading asks for one instead of naming none');
      } else {
        test.fail('empty heading: ' + el(empty, 'natter-bind-heading').textContent);
      }
    });
  });
}

// ── THE CLAIM FORM LEFT THIS APP, THE BINDING DID NOT ────────────────
//
// `claimBinds`, `tokenGoesWithTheName` and `refusalDoesNotBind` stood
// here and drove the form directly. The form is app/natterDetails now
// (spirit/test/natterDetails.js: claimingNamesThisMailbox,
// aHalfCopiedInviteIsRefusedBeforeItTravels), because a claim happens ON
// a relay and this app's form could not say which.
//
// What stayed is what Natter still owns: session.json, and writing a
// seat down against the relay it was taken on. The dialog reports;
// this app records. Same contract as a mint and a rename.
function aClaimReturnedIsRecordedAgainstItsRelay() {
  test.subHeading('A seat taken on a relay is written down under that relay');

  const app = mountApp({ dialogResult: { changed: true, url: OWNED, claimed: 'andy' } });

  return settle().then(function () {
    el(app, 'natter-tbody').fire('click', { target: rowTarget(OWNED) });

    return settle().then(function () {
      let saved = null;
      try { saved = JSON.parse(app.store['session.json']); } catch (e) { saved = null; }

      if (saved && saved.relays && saved.relays[OWNED] &&
          saved.relays[OWNED].label === 'andy' && saved.relays[OWNED].boundAt) {
        test.check('the seat is recorded under the relay it was taken on');
      } else {
        test.fail('session.json: ' + app.store['session.json']);
      }

      // THE PRIMARY IS DERIVED. `label` at the top is what the shell
      // reads for the window title (readNodeLabel), and it stays where
      // it was so nothing outside this app has to learn a new shape.
      if (saved && saved.label === 'andy') {
        test.check('and the primary caption is still where the shell reads it');
      } else {
        test.fail('top-level label: ' + (saved && saved.label));
      }

      // Claiming is what ends first run, and that must not wait on an
      // fs-watcher.
      if (app.told() >= 1) {
        test.check('and the shell is told, so the rest of the apps appear');
      } else {
        test.fail('nodeLabelChanged called ' + app.told() + ' times');
      }

      if (el(app, 'natter-add-row').style.display !== 'none') {
        test.check('and adding a relay becomes available once a seat is held');
      } else {
        test.fail('add row still hidden after binding');
      }

      if (el(app, 'natter-bind-row').style.display === 'none') {
        test.check('and the guidance goes, because it has nothing left to say');
      } else {
        test.fail('guidance still shown after binding');
      }
    });
  });
}

// The mirror: a dialog that reports no seat writes none. ndClaim returns
// `claimed` only for an answer the relay agreed to — a 409 for somebody
// else's label never reaches here — so this asserts the recording half
// keeps its side of that bargain.
function nothingReportedBindsNothing() {
  test.subHeading('A dialog that took no seat leaves the file alone');

  const app = mountApp({ dialogResult: { changed: true, url: OWNED } });

  return settle().then(function () {
    el(app, 'natter-tbody').fire('click', { target: rowTarget(OWNED) });

    return settle().then(function () {
      if (app.store['session.json'] === undefined && app.told() === 0) {
        test.check('no seat reported, no binding written, and the shell is not disturbed');
      } else {
        test.fail('bound on a dialog that claimed nothing: ' + app.store['session.json']);
      }
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

// THIS TEST USED TO ASSERT THE OPPOSITE, and it was wrong from the day
// R4 landed. It mounted a row with `claimed: true, claimedLabel:
// 'someone-else'` and called that "the sharpest case: somebody is wearing
// the name" — then required the binding to be dropped.
//
// `claimed` and `claimedLabel` are both read off the row whose
// `publicKey` IS this node's (ownerBadge.js). A row that answers `claimed
// true` is OUR row. Its caption cannot belong to a stranger, so the
// fixture described a state that cannot occur, and the rule it defended
// unbound a node for renaming itself.
//
//   Andy: "checkbinding must be key-based... if i have a key"
//
// It cost a live session on 2026-09-15: a rename to `andyflinn` was
// accepted by spirit-3, the local cache still said `andy`, and this rule
// deleted session.json and sent a correctly enrolled shell back to first
// run.
function aRenamedRowKeepsTheBinding() {
  test.subHeading('A row this key holds, wearing a caption the cache has not caught up with');

  const app = mountApp({
    label: 'andy',
    rows: [{ url: OWNED, label: 'spirit', status: 200, claimed: true, claimedLabel: 'andyflinn' }],
  });
  app.store['session.json'] = JSON.stringify({ label: 'andy', boundAt: '2026-09-07T00:00:00.000Z' });

  return settle().then(function () {
    return settle().then(function () {
      if (app.store['session.json'] !== undefined) {
        test.check('the binding survives — the key still holds a row here');
      } else {
        test.fail('session was deleted for a row this key owns');
      }

      let stored = null;
      try { stored = JSON.parse(app.store['session.json'] || 'null'); }
      catch (e) { stored = null; }
      if (stored && stored.label === 'andyflinn') {
        test.check('and the relay\'s caption is adopted, not argued with');
      } else {
        test.fail('session label is ' + (stored && stored.label) + ', not andyflinn');
      }

      if (/andyflinn/.test(el(app, 'natter-bind-status').textContent)) {
        test.check('and the screen says what it is called here now');
      } else {
        test.fail('status: ' + el(app, 'natter-bind-status').textContent);
      }
    });
  });
}

// OFFLINE IS MOSTLY SILENCE, AND SILENCE IS NOT EVIDENCE.
//
// The fully offline node is covered below by
// anUnreachableRelayKeepsTheBinding — nothing answers, nothing is
// concluded. This is the half-offline node, which is the dangerous one
// because it LOOKS like evidence: one relay answers honestly that it
// holds no row for this key, while the relay that does hold the row
// could not be reached at all.
//
// Being enrolled on one relay is being bound, so a relay we could not
// ask can still be the reason we are bound. Unbinding deletes
// session.json and cannot currently be walked back, so it may only
// happen when EVERY relay answered.
function halfOfflineDoesNotUnbind() {
  test.subHeading('One relay answers empty while another cannot be reached');

  const app = mountApp({
    label: 'andy',
    rows: [
      { url: OWNED, label: 'spirit', status: 200, claimed: false, error: 'no row here' },
      { url: 'https://lab.example', label: 'lab', status: 0, error: 'connect ECONNREFUSED' },
    ],
  });
  app.store['session.json'] = JSON.stringify({ label: 'andy', boundAt: '2026-09-07T00:00:00.000Z' });

  return settle().then(function () {
    return settle().then(function () {
      if (app.store['session.json'] !== undefined) {
        test.check('the binding survives — the silent relay was never asked');
      } else {
        test.fail('session was deleted on the word of a relay that is not the only one');
      }
    });
  });
}

// The unbind that IS real, and the only one: every relay answered, and
// none holds a row for this key. That is an owner purging a seat.
function noRowForThisKeyDropsTheBinding() {
  test.subHeading('A relay that answers and holds nothing for this key');

  // `error: 'no row here'` is what ownerBadge.probe writes on exactly
  // this row — it answered fine, it simply has no seat for us. An
  // earlier version of the check filtered rows on `!error` and so threw
  // away the only evidence that can prove an unbind.
  const app = mountApp({
    label: 'andy',
    rows: [{ url: OWNED, label: 'spirit', status: 200, claimed: false, error: 'no row here' }],
  });
  app.store['session.json'] = JSON.stringify({ label: 'andy', boundAt: '2026-09-07T00:00:00.000Z' });

  return settle().then(function () {
    return settle().then(function () {
      if (app.store['session.json'] === undefined) {
        test.check('no row for this key drops the binding');
      } else {
        test.fail('session survived: ' + app.store['session.json']);
      }

      if (/claim again/i.test(el(app, 'natter-bind-status').textContent)) {
        test.check('and says so, where the claim form is');
      } else {
        test.fail('status: ' + el(app, 'natter-bind-status').textContent);
      }
    });
  });
}

// UNREACHABLE IS NOT THE SAME AS NOT OURS. The rule the old version got
// right, and the one most easily lost in the move: a relay that did not
// answer carries no label either, and a check that read "no label" as
// "not mine" would unbind a node every time its relay restarted.
function anUnreachableRelayKeepsTheBinding() {
  test.subHeading('A relay that says nothing takes nothing away');

  const app = mountApp({
    label: 'andy',
    rows: [{ url: OWNED, label: 'spirit', status: 0, error: 'connect ECONNREFUSED' }],
  });
  app.store['session.json'] = JSON.stringify({ label: 'andy', boundAt: '2026-09-07T00:00:00.000Z' });

  return settle().then(function () {
    return settle().then(function () {
      if (app.store['session.json'] !== undefined) {
        test.check('a relay that did not answer leaves the binding alone');
      } else {
        test.fail('an unreachable relay unbound the node');
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
  .then(aClaimReturnedIsRecordedAgainstItsRelay)
  .then(nothingReportedBindsNothing)
  .then(aRowOpensTheMailbox)
  .then(aMintOverThereIsRememberedHere)
  .then(aRenamedRowKeepsTheBinding)
  .then(halfOfflineDoesNotUnbind)
  .then(noRowForThisKeyDropsTheBinding)
  .then(anUnreachableRelayKeepsTheBinding)
  .then(chatKeepsNoBinding)
  .then(function () { test.reportSuccessFailureCount(); })
  .catch(function (err) {
    test.fail('natter bind threw: ' + ((err && err.stack) || err));
    test.reportSuccessFailureCount();
  });
