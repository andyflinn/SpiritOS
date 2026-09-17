'use strict';

// One contact, as its own screen — the first DIALOG (Andy).
//
// A dialog is a hidden app a table pushes for one row. It shows that row
// and nothing else, it CANNOT launch anything, and the only way out is
// back to the table that opened it. What it wants to happen elsewhere it
// returns, and the app underneath acts on it.
//
// Three things are under test, and only the first is about markup:
//
//   - the panel that used to expand inside the Contacts table: six
//     facts in Andy's order, the rename, and the decisions;
//   - the contract that makes it a dialog rather than an app — no
//     launching, ever, and a result that survives leaving by Back;
//   - that it re-fetches its row by key rather than being handed one,
//     because the counters move while the screen is open.
//
// Driven the way contacts.js is driven: the real script is loaded with
// small document/api/fetch stubs and its real handlers are fired.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const spirit = require('../run/js/kernel.js');

const RUN_DIR = path.join(__dirname, '..', 'run');
const APP_SCRIPT = path.join(RUN_DIR, 'app', 'contactsDetails', 'contactsDetails.js');
const MANIFEST = path.join(RUN_DIR, 'app', 'contactsDetails', 'contactsDetails.json');

const BERT = 'MCowBQYDK2VwAyEAbertbertbertbertbertbertbertbertbertb=';
const CAROL = 'MCowBQYDK2VwAyEAcarolcarolcarolcarolcarolcarolcaro=';

function fakeElement(id) {
  let html = '';
  const el = {
    id: id,
    value: '',
    textContent: '',
    style: {},
    dataset: {},
    listeners: {},
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
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
  return {
    byId: byId,
    activeElement: null,
    getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); },
    createElement: fakeElement,
  };
}

// A click on a button inside the panel. The app reads event.target.id,
// because the panel is repainted after every decision and a handler
// bound to a button would go with it.
function button(id) { return { id: id }; }

function mountDialog(options) {
  const opts = options || {};
  const doc = fakeDocument();
  const log = [];
  // The book, as buildPeople hands it over. Mutable, so a decision
  // posted by the dialog can change what the next read answers — a stub
  // that returned the same fixture forever would let a screen that never
  // refreshes pass.
  const people = opts.people || [];

  const fakeFetch = function (url, init) {
    log.push({ url: url, method: (init && init.method) || 'GET', body: init && init.body });
    let status = 200;
    // BY VERB. `{ action: 'block' }` under `/api/hub/peer` became
    // `contact.block` at the one door on 2026-09-15, so a fixture that
    // still read `sent.action` would find undefined on every call and
    // change nothing — while the POST itself still looked right.
    var sentVerb = '';
    try { sentVerb = JSON.parse(String((init && init.body) || '{}')).verb || ''; }
    catch (e) { sentVerb = ''; }
    if (sentVerb.indexOf('contact.') === 0) {
      status = opts.peerStatus || 200;
      const sent = JSON.parse((init && init.body) || '{}');
      if (status === 200) {
        people.forEach(function (p) {
          if (p.publicKey !== sent.publicKey) return;
          if (sentVerb === 'contact.label') p.myLabel = sent.myLabel;
          if (sentVerb === 'contact.block') p.blocked = true;
          if (sentVerb === 'contact.unblock') p.blocked = false;
          if (sentVerb === 'contact.accept') { p.held = false; p.acquiredVia = 'message'; }
        });
      }
    }
    // ── WHICH RELAYS THIS NODE OWNS, AND THEIR KEYS ─────────────────
    //
    // Asked once, by Forget, only when the person holds a seat: the
    // screen turns each url in `memberOf` into the relay's KEY, because a
    // relay is addressed like any other peer.
    if (sentVerb === 'relay.status') {
      const statusText = JSON.stringify({
        rows: (opts.relays || []).map(function (r) {
          return {
            url: r.url, owned: true, claimed: true, status: 200,
            census: r.relayKey ? { relayKey: r.relayKey } : null,
          };
        }),
      });
      return Promise.resolve({
        status: 200,
        text: function () { return Promise.resolve(statusText); },
        json: function () { return Promise.resolve(JSON.parse(statusText)); },
      });
    }

    const text = JSON.stringify({ people: people, selfTail: null, matches: [] });
    return Promise.resolve({
      status: status,
      text: function () { return Promise.resolve(text); },
      json: function () { return Promise.resolve(JSON.parse(text)); },
    });
  };

  let behavior = null;
  const posts = [];
  const closed = [];
  const shellSpirit = {
    shell: {
      activateApp: function (b) { behavior = b; },
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
      // The browser's one mouth onto the node (AGENT.md, Comms).
      // shell.js asks here; kernel.js supplies it in a real page.
      ask: test.browserAsk(fakeFetch),
      util: {
        escapeHtml: spirit.core.util.escapeHtml,
        formatBytes: spirit.core.util.formatBytes,
      },
      const: { ICON: spirit.core.const.ICON },
    },
  };

  const src = fs.readFileSync(APP_SCRIPT, 'utf8');
  new Function('spirit', 'document', 'window', 'fetch', src)(shellSpirit, doc, {}, fakeFetch);

  const titles = [];
  let dialogResult;
  const api = {
    // WHAT THE SHELL HANDS AN APP for talking to the node (AGENT.md,
    // Comms). Until 2026-09-16 this app kept a private `fetch` wrapper and
    // this fixture never had to supply anything — which meant the fixture
    // could not see, or assert, which verbs the app actually asks for.
    verb: function (name, args) {
      const payload = { verb: String(name) };
      if (args) Object.keys(args).forEach(function (k) { payload[k] = args[k]; });
      return fakeFetch('/api/spirit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(function (r) {
        return r.text().then(function (t) {
          let body = null;
          try { body = JSON.parse(t); } catch (e) { body = null; }
          return { status: r.status, text: t, body: body };
        });
      });
    },
    // ── THE ONE CALL THAT REACHES A RELAY ───────────────────────────
    //
    // `removePeer` addressed to the relay's own key, which is what an
    // owner evicting somebody is — the same post natterDetails' Remove
    // makes. Recorded whole, because the ORDER is what is being asserted:
    // the seat goes before the row.
    peerPost: function (packetApp, toKey, body) {
      posts.push({ app: packetApp, to: toKey, body: body });
      const refuse = (opts.evictionRefuses || {})[toKey];
      if (refuse) {
        return Promise.resolve({ ok: false, status: 200, body: { ok: false, error: refuse } });
      }
      return Promise.resolve({ ok: true, status: 200, body: { ok: true, removed: { key: toKey } } });
    },
    // THE SCREEN GOES WITH THE ROW when a forget succeeds — there is
    // nobody left to paint. Recorded rather than stubbed away: leaving
    // the dialog open on a contact that no longer exists is the failure
    // this branch exists to avoid.
    closeDialog: function (r) { closed.push(r || null); dialogResult = r; },
    setScreenTitle: function (t) { titles.push(t); },
    setDialogResult: function (r) { dialogResult = r; },
    // The shell throws for a dialog; the stub does the same, so a
    // launch added here fails the suite instead of being recorded.
    launchApp: function (target) {
      throw new Error('A dialog can only return: tried to launch ' + target);
    },
  };

  const container = fakeElement('container');
  // Mount once, then open — the shape the shell uses. mount() takes no
  // params any more: the subject arrives through open(), on every call,
  // which is what makes a second open impossible to get wrong.
  behavior.mount(container, api);
  behavior.open({ key: opts.key });
  return {
    doc: doc, log: log, people: people, behavior: behavior, titles: titles,
    posts: posts,
    closed: closed,
    result: function () { return dialogResult; },
  };
}

function el(app, id) { return app.doc.getElementById(id); }
function settle() {
  return new Promise(function (r) { setImmediate(r); })
    .then(function () { return new Promise(function (r2) { setImmediate(r2); }); });
}
// WHAT WAS SENT, BY VERB. This took a path until the contact
// namespace folded onto /api/spirit: every call goes to one URL now, so
// a filter on the URL matches everything this screen ever did.
function posted(app, prefix) {
  return app.log
    .map(function (c) { try { return JSON.parse(c.body); } catch (e) { return null; } })
    .filter(function (b) { return b && String(b.verb || '').indexOf(prefix) === 0; });
}

function bert(extra) {
  const row = {
    publicKey: BERT, publicLabel: 'bert', caption: 'bert', myLabel: 'Bertie', tail: 'bertb=',
    acquiredVia: 'handle', held: false, blocked: false, bytesHeld: 2048,
    unansweredInbound: 4, inboundPerDay: 0.42857142857, outboundPerDay: 0.0714285,
  };
  Object.keys(extra || {}).forEach(function (k) { row[k] = extra[k]; });
  return row;
}

test.startTest('Contact — one row of the book, as its own screen');

test.subHeading('It is declared a dialog, and it is hidden');

{
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  if (manifest.hidden === true && manifest.type === 'dialog') {
    test.check('the manifest says hidden and says dialog');
  } else {
    test.fail('manifest: ' + JSON.stringify(manifest));
  }

  // Both, which used to be impossible: hidden was cancelled by intrinsic
  // (declareDynamicApp) back when intrinsic meant "always on the
  // desktop". A dialog is the first thing that is genuinely both.
  if (manifest.intrinsic === true && manifest.owner === 'system') {
    test.check('and it is part of the node, which no longer un-hides it');
  } else {
    test.fail('intrinsic/owner: ' + JSON.stringify(manifest));
  }

  // It wears its parent's glyph on purpose. To anybody looking at this
  // screen it IS Contacts, and two icons would say they were two things.
  // Legal because a hidden app competes in no gallery (iconIndex).
  const parent = JSON.parse(fs.readFileSync(path.join(RUN_DIR, 'app', 'contacts', 'contacts.json'), 'utf8'));
  if (manifest.icon === parent.icon) {
    test.check('and it wears the rolodex its parent wears, which a hidden app may');
  } else {
    test.fail('icon: ' + manifest.icon + ' vs parent ' + parent.icon);
  }

  // The rule, where it cannot be argued with. A dialog can only return,
  // and a button that launched something would be a button that throws.
  const src = fs.readFileSync(APP_SCRIPT, 'utf8');
  if (src.indexOf('launchApp') === -1) {
    test.check('and its source does not reach for launchApp anywhere');
  } else {
    test.fail('dialog launches something: ' + src.slice(src.indexOf('launchApp') - 80, src.indexOf('launchApp') + 40));
  }
}

test.subHeading('Six facts, in Andy\'s order');

function readsTheRow() {
  const app = mountDialog({ key: BERT, people: [bert(), { publicKey: CAROL, publicLabel: 'carol', caption: 'carol', myLabel: '' }] });

  return settle().then(function () {
    const panel = el(app, 'cd-body').innerHTML;

    const labels = (panel.match(/class="fact-label">([^<]*)</g) || [])
      .map(function (m) { return m.slice(m.indexOf('>') + 1, -1); });
    if (labels.join(' | ') === 'Public Handle | My Label | Unanswered inbound | ' +
        'Inbound rate | Outbound rate | Storage') {
      test.check('who they are, then what they cost — all six, in that order');
    } else {
      test.fail('labels: ' + labels.join(' | '));
    }

    // A rate carries its unit and one decimal; unanswered is a plain
    // count; the size is the shell's own formatting.
    if (/Public Handle<\/span><span class="fact-value">bert</.test(panel) &&
        /My Label<\/span><span class="fact-value">Bertie</.test(panel) &&
        /Unanswered inbound<\/span><span class="fact-value">4</.test(panel) &&
        /Inbound rate<\/span><span class="fact-value">0\.4 \/ day</.test(panel) &&
        /Outbound rate<\/span><span class="fact-value">0\.1 \/ day</.test(panel) &&
        /Storage<\/span><span class="fact-value">2 KB</.test(panel)) {
      test.check('and each reads as itself, rates per day and unanswered as a count');
    } else {
      test.fail('values: ' + panel);
    }

    // It picked ITS row out of the book, not the first one.
    if (panel.indexOf('carol') === -1) {
      test.check('and only the person it was opened for is on screen');
    } else {
      test.fail('another contact leaked in: ' + panel);
    }

    // The titlebar says whose row this is — the app's own name is the
    // least useful word available on a screen that shows one person.
    if (app.titles[app.titles.length - 1] === 'bert (Bertie)') {
      test.check('and the titlebar carries the person, not the app name');
    } else {
      test.fail('titles: ' + JSON.stringify(app.titles));
    }
  });
}

function marksWhoIsRefusedOrWaiting() {
  test.subHeading('The title says which of them this is');

  const ICONS = spirit.core.const.ICON;
  const waiting = mountDialog({ key: CAROL, people: [{
    publicKey: CAROL, publicLabel: 'carol', caption: 'carol', myLabel: '',
    acquiredVia: 'hold', held: true, blocked: false, tail: 'lcaro=',
  }] });

  return settle().then(function () {
    if (waiting.titles[waiting.titles.length - 1] === ICONS.WAITING + ' carol') {
      test.check('somebody waiting is marked in the titlebar, where you are already looking');
    } else {
      test.fail('waiting title: ' + JSON.stringify(waiting.titles));
    }

    // Accept is offered only to somebody waiting — the buttons are how
    // the states are told apart, as they were on the chat strip.
    const panel = el(waiting, 'cd-body').innerHTML;
    if (panel.indexOf('cd-accept') !== -1 && panel.indexOf('cd-unblock') === -1) {
      test.check('and is offered Accept, not Unblock');
    } else {
      test.fail('waiting buttons: ' + panel);
    }

    const refused = mountDialog({ key: CAROL, people: [{
      publicKey: CAROL, publicLabel: 'carol', caption: 'carol', myLabel: '',
      acquiredVia: 'message', held: true, blocked: true, tail: 'lcaro=',
    }] });
    return settle().then(function () {
      const blocked = el(refused, 'cd-body').innerHTML;
      if (refused.titles[refused.titles.length - 1] === ICONS.NO + ' carol' &&
          blocked.indexOf('cd-unblock') !== -1 && blocked.indexOf('cd-accept') === -1 &&
          blocked.indexOf('cd-block') === -1) {
        test.check('and somebody refused is marked, and offered only the way back');
      } else {
        test.fail('blocked: ' + refused.titles.join(',') + ' / ' + blocked);
      }
    });
  });
}

function decides() {
  test.subHeading('What you decide here is a hub verb, and the table is told');

  const app = mountDialog({ key: CAROL, people: [{
    publicKey: CAROL, publicLabel: 'carol', caption: 'carol', myLabel: '',
    acquiredVia: 'hold', held: true, blocked: false, tail: 'lcaro=',
  }] });

  return settle().then(function () {
    el(app, 'cd-body').fire('click', { target: button('cd-accept') });
    return settle().then(function () {
      const calls = posted(app, 'contact.');
      if (calls.length === 1 && calls[0].verb === 'contact.accept' && calls[0].publicKey === CAROL) {
        test.check('Accept posts accept for the key this screen was opened on');
      } else {
        test.fail('peer calls: ' + JSON.stringify(calls));
      }

      // The screen re-reads rather than assuming: the row it drew came
      // from the hub, and so does the row it draws next.
      const panel = el(app, 'cd-body').innerHTML;
      if (panel.indexOf('cd-accept') === -1 && panel.indexOf('cd-block') !== -1) {
        test.check('and the screen repaints from the book, so Accept is gone and Block remains');
      } else {
        test.fail('after accept: ' + panel);
      }

      // The one thing the table cannot know. Said as it happens, because
      // the way out is Back and Back is the shell's, not this app's.
      const said = app.result();
      if (said && said.changed === true && said.key === CAROL) {
        test.check('and the result is set the moment it happens, not on the way out');
      } else {
        test.fail('result: ' + JSON.stringify(said));
      }
    });
  });
}

function blockingTakesTwoPresses() {
  test.subHeading('Blocking takes two presses');

  const app = mountDialog({ key: BERT, people: [bert()] });

  return settle().then(function () {
    el(app, 'cd-body').fire('click', { target: button('cd-block') });
    return settle().then(function () {
      if (posted(app, 'contact.').length === 0 &&
          el(app, 'cd-body').innerHTML.indexOf('press again') !== -1) {
        test.check('the first press arms and says so, and posts nothing');
      } else {
        test.fail('armed: ' + el(app, 'cd-body').innerHTML);
      }

      el(app, 'cd-body').fire('click', { target: button('cd-block') });
      return settle().then(function () {
        const calls = posted(app, 'contact.');
        if (calls.length === 1 && calls[0].verb === 'contact.block') {
          test.check('and the second one does it — the only decision here that stops mail arriving');
        } else {
          test.fail('after second press: ' + JSON.stringify(calls));
        }
      });
    });
  });
}

function renamesLocally() {
  test.subHeading('What you call them is yours');

  const app = mountDialog({ key: BERT, people: [bert({ myLabel: '' })] });

  return settle().then(function () {
    const panel = el(app, 'cd-body').innerHTML;
    if (/field-label grow">Change My Label for bert</.test(panel) &&
        /id="cd-label-input"/.test(panel) && /placeholder="bert"/.test(panel)) {
      test.check('the field names the fact it edits and says whose');
    } else {
      test.fail('label field: ' + panel);
    }

    const input = el(app, 'cd-label-input');
    input.value = ' lovelyBert ';
    el(app, 'cd-body').fire('change', { target: input });
    return settle().then(function () {
      const calls = posted(app, 'contact.');
      if (calls.length === 1 && calls[0].verb === 'contact.label' && calls[0].myLabel === 'lovelyBert') {
        test.check('and renaming posts the label, trimmed, for this node only');
      } else {
        test.fail('label calls: ' + JSON.stringify(calls));
      }

      // Return fires change WITHOUT blurring, so the panel has to
      // repaint while its own field still has focus — which is exactly
      // what the guard below refuses for every other repaint. A commit
      // is the one thing that gets through.
      const after = el(app, 'cd-body').innerHTML;
      if (/My Label<\/span><span class="fact-value">lovelyBert</.test(after)) {
        test.check('and My Label above the field says so straight away');
      } else {
        test.fail('bubble after commit: ' + after);
      }

      if (app.titles[app.titles.length - 1] === 'bert (lovelyBert)') {
        test.check('and so does the titlebar');
      } else {
        test.fail('titles: ' + JSON.stringify(app.titles));
      }
    });
  });
}

function nothingTicksIt() {
  test.subHeading('Nothing repaints it behind your back');

  // A tick repaint used to destroy the field mid-word, and the fix was
  // a focus guard in this file. It is not here any more, and that is not
  // an oversight: the shell does not drive a dialog with the job tick at
  // all (switchTo and renderActive both step over one), so the only
  // repaints left are the ones this file asks for.
  //
  // What that leaves this suite to check is that the app really has
  // nothing for a tick to call, and that it has not quietly grown a
  // guard back — a guard here would now be dead code hiding the fact
  // that the shell is doing the work.
  const app = mountDialog({ key: BERT, people: [bert()] });

  return settle().then(function () {
    if (typeof app.behavior.render !== 'function') {
      test.check('the dialog declares no render, so a tick has nothing to call');
    } else {
      test.fail('a dialog still declares render');
    }

    const src = fs.readFileSync(APP_SCRIPT, 'utf8');
    if (src.indexOf('activeElement') === -1) {
      test.check('and no focus guard, because there is no repaint left to guard against');
    } else {
      test.fail('a focus guard has grown back, which means something is still ticking it');
    }

    // And what it DOES have runs on every entry, which is the other half
    // of the same guarantee.
    if (typeof app.behavior.open === 'function') {
      test.check('and it declares open, which the shell calls on every entry');
    } else {
      test.fail('no open()');
    }
  });
}

function opensForSomebodyElse() {
  test.subHeading('Opened again, for a different person');

  // The one that is impossible to see coming: mount() runs once per
  // PANE, and every row this dialog is ever opened for shares that pane
  // (switchTo). The launchers get a second chance through loadFile,
  // which the shell calls only for params.path — a dialog opened on a
  // key gets nothing but render(jobs, params). Ignore params there and
  // opening carol after bert shows you bert.
  const app = mountDialog({
    key: BERT,
    people: [bert(), {
      publicKey: CAROL, publicLabel: 'carol', caption: 'carol', myLabel: '',
      acquiredVia: 'hold', held: true, blocked: false, tail: 'lcaro=',
      unansweredInbound: 9, inboundPerDay: 0, outboundPerDay: 0, bytesHeld: 0,
    }],
  });

  return settle().then(function () {
    if (el(app, 'cd-body').innerHTML.indexOf('bert') !== -1) {
      test.check('the first open shows the person it was launched for');
    } else {
      test.fail('first open: ' + el(app, 'cd-body').innerHTML);
    }

    // Back to the table, then a different row. mount() does not run
     // again — the pane is shared — so open() is the only thing that
     // can hand this screen its new subject, and the shell calls it on
     // every entry rather than only when params.path happens to be set.
    app.behavior.open({ key: CAROL });
    return settle().then(function () {
      const panel = el(app, 'cd-body').innerHTML;
      if (/Unanswered inbound<\/span><span class="fact-value">9</.test(panel) &&
          panel.indexOf('cd-accept') !== -1) {
        test.check('and the second open re-reads for the new key rather than showing the last one');
      } else {
        test.fail('second open: ' + panel);
      }

      if (app.titles[app.titles.length - 1] === spirit.core.const.ICON.WAITING + ' carol') {
        test.check('and the titlebar follows, so the two can never disagree about who this is');
      } else {
        test.fail('titles: ' + JSON.stringify(app.titles));
      }

      // A half-armed Block from the previous person must not carry over
      // to this one — two presses means two presses about the same key.
      if (panel.indexOf('press again') === -1) {
        test.check('and nothing about the last person carries over');
      } else {
        test.fail('block stayed armed across a re-open');
      }
    });
  });
}

function survivesARowThatWentAway() {
  test.subHeading('A row that is no longer there');

  // The book is edited elsewhere while this screen is open. Better an
  // empty-handed sentence than a blank panel, which reads as a load that
  // never finished.
  const app = mountDialog({ key: BERT, people: [] });

  return settle().then(function () {
    const panel = el(app, 'cd-body').innerHTML;
    if (panel.indexOf('no longer in the book') !== -1 && panel.indexOf('fact-row') === -1) {
      test.check('says so, rather than drawing an empty panel that looks like a stall');
    } else {
      test.fail('missing row: ' + panel);
    }
  });
}

function writesNothingDown() {
  test.subHeading('It keeps nothing');

  // A sibling folder, so api.fs here is scoped to app/contactsDetails/ —
  // not to Contacts'. That is the cost of flat discovery, and this app
  // pays it by having nothing to write: every decision is a hub verb,
  // and the one file Contacts keeps (the stranger policy) belongs to the
  // list, not to any row.
  //
  // Matched on the CALL, with its open paren — the comment at the top of
  // that file explains why api.fs is scoped where it is, and a check for
  // the bare name finds the explanation and calls it a use. That is the
  // recurring way a source check passes, or fails, while saying nothing.
  const src = fs.readFileSync(APP_SCRIPT, 'utf8');
  const touches = ['.saveFile(', '.loadFile(', '.readProject(', 'createScopedFs(']
    .filter(function (call) { return src.indexOf(call) !== -1; });
  if (touches.length === 0) {
    test.check('no file of its own, and nothing read out of anybody else\'s folder');
  } else {
    test.fail('this dialog touches storage: ' + touches.join(', '));
  }

  // And it sends no packets. Reading the book is not talking to anyone.
  if (src.indexOf('sendMessagePacket') === -1 && src.indexOf('/api/hub/send') === -1) {
    test.check('and it says nothing to anybody — reading the book is not writing to them');
  } else {
    test.fail('this dialog sends');
  }
}

// ── A CONTACT NOBODY HAS A ROW FOR ───────────────────────────────────
//
//   Andy: "show a warning bubble at the top of contact details if the
//   contact is an obvious dud... the bubble will show the reason."
//
// The node decides it on the sweep that already probes every relay
// (hub.reconcileOrphans, asserted in relayOwnerContacts.js): a key every
// relay ANSWERED about and none of them listed. This screen only reads
// the answer — which is what keeps the warning off a book whose relay
// was merely rebooting.
function aDudSaysWhyAtTheTop() {
  test.subHeading('A contact on no census is warned about, with the reason');

  const app = mountDialog({
    key: 'KEY-BELLA',
    people: [{
      publicKey: 'KEY-BELLA', tail: 'qgFs=', publicLabel: 'bella',
      caption: 'bella', myLabel: 'bella from the lab', acquiredVia: 'handle',
      memberOf: [], missingSince: '2026-09-17T01:00:00.000Z',
      held: false, blocked: false, onRelay: false, bytesHeld: 0,
    }],
  });

  return settle().then(function () {
    const out = el(app, 'cd-body').innerHTML;

    if (/cd-dud/.test(out)) {
      test.check('the screen carries a warning');
    } else {
      test.fail('no bubble: ' + out.slice(0, 300));
    }

    // AT THE TOP, before the facts, because it changes what they mean:
    // "Unanswered inbound: 0" reads as a quiet contact until you know
    // there is nobody on the other end of it.
    if (out.indexOf('cd-dud') < out.indexOf('fact-row')) {
      test.check('above the facts, because it changes what they mean');
    } else {
      test.fail('the warning is below the reading it qualifies');
    }

    // THE REASON, NOT THE VERDICT. "This contact is dead" is a claim this
    // screen cannot support; the observation it was made from is one a
    // person who knows their own network reads far more out of.
    if (/No relay you are on lists this key/.test(out) &&
        /not a connection problem/.test(out)) {
      test.check('and says what was observed, not a verdict it cannot support');
    } else {
      test.fail('reason: ' + out.slice(0, 400));
    }

    // "FIRST NOTICED", NEVER "GONE SINCE". Nothing watched before there
    // was a field to watch with, so claiming a date of death would be
    // inventing a history.
    if (/First noticed 2026-09-17/.test(out) && !/gone since/i.test(out)) {
      test.check('dated as when this node first noticed, which is all it can know');
    } else {
      test.fail('date: ' + out.slice(0, 400));
    }

    // AND IT SAYS NOTHING WAS DELETED, because the row holds a name its
    // owner typed which is on no relay to be recovered from.
    if (/Nothing has been deleted/.test(out)) {
      test.check('and that nothing was acted on — the deciding stays theirs');
    } else {
      test.fail('no reassurance: ' + out.slice(0, 400));
    }
  });
}

// ── AND EVERYBODY ELSE IS UNMARKED ───────────────────────────────────
//
// The half that matters most, because a warning on every screen is a
// warning on none — and because the sweep deliberately marks nothing when
// a relay did not answer, a contact with no mark is the ordinary case.
function anOrdinaryContactIsNotWarnedAbout() {
  test.subHeading('While a contact somebody still lists is left alone');

  const app = mountDialog({
    key: 'KEY-SONNY',
    people: [{
      publicKey: 'KEY-SONNY', tail: 'kEbk=', publicLabel: 'sonny',
      caption: 'sonny', myLabel: '', acquiredVia: 'handle',
      memberOf: [], missingSince: '',
      held: false, blocked: false, onRelay: true, bytesHeld: 0,
    }],
  });

  return settle().then(function () {
    const out = el(app, 'cd-body').innerHTML;
    if (!/cd-dud/.test(out) && !/No relay you are on/.test(out)) {
      test.check('no warning, and no space held open for one');
    } else {
      test.fail('warned about a live contact: ' + out.slice(0, 300));
    }
  });
}

// ── FORGETTING SOMEBODY WHO SITS ON A RELAY I OWN ────────────────────
//
//   Andy: "when someone binds to a peer i own... i want a contact
//   auto-generated, and undeletable until i agree to also remove their
//   relay slots."
//
// The node refuses the forget outright while `memberOf` is non-empty
// (hub, contact.forget — asserted in relayOwnerContacts.js). This is the
// other half: the agreement that makes the refusal answerable, rather
// than a screen that can only say no.
function forgettingAMemberTakesTheSeatFirst() {
  test.subHeading('Forgetting a member removes their seat first, and says so');

  const app = mountDialog({
    key: 'KEY-CRUELLA',
    people: [{
      publicKey: 'KEY-CRUELLA', tail: 'lrjo=', publicLabel: 'Cruella',
      caption: 'Cruella', myLabel: '', acquiredVia: 'member',
      memberOf: ['https://mine.example'],
      held: false, blocked: false, onRelay: true, bytesHeld: 0,
    }],
    relays: [{ url: 'https://mine.example', relayKey: 'RELAYKEY-MINE' }],
  });

  return settle().then(function () {
    // ── THE BUTTON SAYS WHAT IT WILL DO, BEFORE IT IS PRESSED ────────
    //
    // A second press that quietly evicts somebody from a relay would be
    // the screen doing more than it offered. The relay is NAMED, because
    // "remove their seat" is not answerable without knowing from where.
    el(app, 'cd-body').fire('click', { target: button('cd-forget') });

    return settle().then(function () {
      const armed = el(app, 'cd-body').innerHTML;
      if (/Remove their seat on mine\.example and forget/.test(armed)) {
        test.check('the armed button names the relay and both acts');
      } else {
        test.fail('armed: ' + armed.slice(0, 400));
      }

      if (app.posts.length === 0 && posted(app, 'contact.forget').length === 0) {
        test.check('and the first press does nothing but arm');
      } else {
        test.fail('the first press acted: ' + JSON.stringify(app.posts));
      }

      // ── AND THE SECOND PRESS DOES BOTH, IN ORDER ─────────────────
      el(app, 'cd-body').fire('click', { target: button('cd-forget') });

      return settle().then(settle).then(settle).then(function () {
        const evictions = app.posts.filter(function (p) { return p.body && p.body.removePeer; });
        if (evictions.length === 1 && evictions[0].to === 'RELAYKEY-MINE' &&
            evictions[0].body.removePeer.key === 'KEY-CRUELLA') {
          test.check('the seat is given up, addressed to the relay by key');
        } else {
          test.fail('evictions: ' + JSON.stringify(app.posts));
        }

        if (posted(app, 'contact.forget').length === 1) {
          test.check('and the row is forgotten after it');
        } else {
          test.fail('forget: ' + JSON.stringify(posted(app, 'contact.forget')));
        }

        // THE ORDER IS THE ASSERTION. A forget that succeeded followed by
        // an eviction that failed would leave somebody seated with no
        // record of them here — and the next sweep would put the contact
        // straight back, so the screen would have appeared to do
        // something it had not.
        const evictAt = app.log.findIndex(function (r) {
          return String(r.body || '').indexOf('relay.status') !== -1;
        });
        const forgetAt = app.log.findIndex(function (r) {
          return String(r.body || '').indexOf('contact.forget') !== -1;
        });
        if (evictAt !== -1 && forgetAt !== -1 && evictAt < forgetAt) {
          test.check('and the relay was asked before the book was changed');
        } else {
          test.fail('order: relay at ' + evictAt + ', forget at ' + forgetAt);
        }
      });
    });
  });
}

// ── AND A SEAT THAT WILL NOT GO TAKES THE FORGET WITH IT ─────────────
//
// The half that makes the order worth having. If the relay refuses, the
// row stays — and it is still TRUE: they do hold a seat, and the node
// would refuse the forget anyway.
function aRefusedEvictionKeepsTheRow() {
  test.subHeading('And a seat that cannot be given up keeps the contact');

  const app = mountDialog({
    key: 'KEY-CRUELLA',
    people: [{
      publicKey: 'KEY-CRUELLA', tail: 'lrjo=', publicLabel: 'Cruella',
      caption: 'Cruella', myLabel: '', acquiredVia: 'member',
      memberOf: ['https://mine.example'],
      held: false, blocked: false, onRelay: true, bytesHeld: 0,
    }],
    relays: [{ url: 'https://mine.example', relayKey: 'RELAYKEY-MINE' }],
    evictionRefuses: { 'RELAYKEY-MINE': 'no such peer' },
  });

  return settle().then(function () {
    el(app, 'cd-body').fire('click', { target: button('cd-forget') });
    return settle().then(function () {
      el(app, 'cd-body').fire('click', { target: button('cd-forget') });
      return settle().then(settle).then(settle).then(function () {
        if (posted(app, 'contact.forget').length === 0) {
          test.check('nothing is forgotten when the seat could not be removed');
        } else {
          test.fail('forgot anyway: ' + JSON.stringify(posted(app, 'contact.forget')));
        }

        // AND IT SAYS WHY, naming the relay that refused. "It did not
        // work" is not actionable when a person may be seated on several.
        const said = el(app, 'cd-body').innerHTML + ' ' + (el(app, 'cd-status').textContent || '');
        if (/no such peer/.test(said) && /mine\.example/.test(said)) {
          test.check('and the screen says which relay refused, and what it said');
        } else {
          test.fail('status: ' + said.slice(0, 300));
        }
      });
    });
  });
}

// ── SOMEBODY WHO HOLDS NO SEAT OF MINE IS UNCHANGED ──────────────────
//
//   Andy: "a peer who connects with me through a partner node behaves
//   independently as contact, same as non-relay-owners experience all
//   their contacts."
function anOrdinaryContactIsForgottenAsEver() {
  test.subHeading('While an ordinary contact is forgotten as ever');

  const app = mountDialog({
    key: 'KEY-SONNY',
    people: [{
      publicKey: 'KEY-SONNY', tail: 'kEbk=', publicLabel: 'sonny',
      caption: 'sonny', myLabel: '', acquiredVia: 'handle',
      memberOf: [],
      held: false, blocked: false, onRelay: false, bytesHeld: 0,
    }],
  });

  return settle().then(function () {
    el(app, 'cd-body').fire('click', { target: button('cd-forget') });
    return settle().then(function () {
      const armed = el(app, 'cd-body').innerHTML;
      if (/Forget — press again/.test(armed) && !/Remove their seat/.test(armed)) {
        test.check('the button offers only to forget, with no seat to mention');
      } else {
        test.fail('armed: ' + armed.slice(0, 300));
      }

      el(app, 'cd-body').fire('click', { target: button('cd-forget') });
      return settle().then(settle).then(function () {
        if (posted(app, 'contact.forget').length === 1 && app.posts.length === 0) {
          test.check('and it forgets without asking any relay anything');
        } else {
          test.fail('posts: ' + JSON.stringify(app.posts));
        }
      });
    });
  });
}

readsTheRow()
  .then(marksWhoIsRefusedOrWaiting)
  .then(decides)
  .then(blockingTakesTwoPresses)
  .then(renamesLocally)
  .then(nothingTicksIt)
  .then(opensForSomebodyElse)
  .then(survivesARowThatWentAway)
  .then(writesNothingDown)
  .then(forgettingAMemberTakesTheSeatFirst)
  .then(aRefusedEvictionKeepsTheRow)
  .then(anOrdinaryContactIsForgottenAsEver)
  .then(aDudSaysWhyAtTheTop)
  .then(anOrdinaryContactIsNotWarnedAbout)
  .then(function () { test.reportSuccessFailureCount(); })
  .catch(function (err) {
    test.fail('contactsDetails threw: ' + ((err && err.stack) || err));
    test.reportSuccessFailureCount();
  });
