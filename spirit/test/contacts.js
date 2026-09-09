'use strict';

// The address book, now that it has its own window (packet 2).
//
// whoBook is still the store and the hub still owns every verb — what
// moved out of Relay Chat is the view, and with it the four decisions a
// person can make about a key: add it by handle, accept somebody
// waiting, block or unblock, and say what YOU call them.
//
// Driven the way chatSession drives the chat app: contacts.js is loaded
// with small document/api/fetch stubs and its real handlers are fired,
// so "pressing Accept posts accept" is a test rather than a screenshot.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const spirit = require('../run/js/kernel.js');

const RUN_DIR = path.join(__dirname, '..', 'run');
const APP_SCRIPT = path.join(RUN_DIR, 'app', 'contacts', 'contacts.js');

const BERT = 'MCowBQYDK2VwAyEAbertbertbertbertbertbertbertbertbertb=';
const CAROL = 'MCowBQYDK2VwAyEAcarolcarolcarolcarolcarolcarolcaro=';
const DAVE = 'MCowBQYDK2VwAyEAdavedavedavedavedavedavedavedavedave=';

function fakeElement(id) {
  let html = '';
  const el = {
    id: id,
    value: '',
    textContent: '',
    style: {},
    dataset: {},
    children: [],
    listeners: {},
    addEventListener: function (event, fn) { (el.listeners[event] = el.listeners[event] || []).push(fn); },
    appendChild: function (child) { el.children.push(child); return child; },
    fire: function (event, arg) { (el.listeners[event] || []).forEach(function (fn) { fn(arg || {}); }); },
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
  return {
    byId: byId,
    activeElement: null,
    getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); },
    createElement: fakeElement,
  };
}

// What a click hands a delegated listener: the element it landed on,
// answering closest() for the attribute it carries.
function target(attr, value) {
  const node = { dataset: {} };
  const camel = attr.replace(/-([a-z])/g, function (m, c) { return c.toUpperCase(); });
  node.dataset[camel.replace(/^data/, '').replace(/^./, function (c) { return c.toLowerCase(); })] = value;
  node.closest = function (selector) {
    return selector === '[' + attr + ']' ? node : null;
  };
  return node;
}

function mountApp(options) {
  const doc = fakeDocument();
  const log = [];
  const opts = options || {};

  const fakeFetch = function (url, init) {
    log.push({ url: url, method: (init && init.method) || 'GET', body: init && init.body });
    let payload = {
      people: opts.people || [],
      selfTail: opts.selfTail || null,
      matches: opts.matches || [],
    };
    let status = 200;
    if (url.indexOf('/api/hub/contact') === 0) status = opts.contactStatus || 201;
    if (url.indexOf('/api/hub/peer') === 0) status = opts.peerStatus || 200;
    const text = JSON.stringify(payload);
    return Promise.resolve({
      status: status,
      text: function () { return Promise.resolve(text); },
      json: function () { return Promise.resolve(JSON.parse(text)); },
    });
  };

  let behavior = null;
  const shellSpirit = {
    shell: {
      activateApp: function (b) { behavior = b; },
      fileInfoRow: function (label, value) {
        return '<div class="file-info-row"><span>' + label + '</span><span>' + value + '</span></div>';
      },
    },
    core: {
      util: { escapeHtml: spirit.core.util.escapeHtml },
      const: { ICON: spirit.core.const.ICON },
    },
  };

  const src = fs.readFileSync(APP_SCRIPT, 'utf8');
  new Function('spirit', 'document', 'window', 'fetch', src)(shellSpirit, doc, {}, fakeFetch);

  const container = fakeElement('container');
  // This app keeps one file of its own now — the stranger policy that
  // moved here from chat. `store` is that folder; `project` is the
  // unscoped read, which it uses once to adopt the value from where it
  // used to live.
  const store = opts.store || {};
  const project = opts.project || {};
  const api = {
    escapeHtml: spirit.core.util.escapeHtml,
    launchApp: function () {},
    readProject: function (path) {
      return Object.prototype.hasOwnProperty.call(project, path) ? project[path] : null;
    },
    fs: {
      loadFile: function (name) {
        return Object.prototype.hasOwnProperty.call(store, name) ? store[name] : null;
      },
      saveFile: function (name, content) { store[name] = content; return Promise.resolve(); },
    },
  };
  behavior.mount(container, api, null);
  return { doc: doc, log: log, container: container, behavior: behavior, store: store };
}

function el(app, id) { return app.doc.getElementById(id); }

function settle() {
  return new Promise(function (resolve) { setImmediate(resolve); })
    .then(function () { return new Promise(function (r) { setImmediate(r); }); });
}

function posted(app, path) {
  return app.log.filter(function (c) { return c.url === path; }).map(function (c) { return JSON.parse(c.body); });
}

test.startTest('Contacts — the address book, in its own window');

// The last piece of packet 2 to move (Andy). It asks what to do about
// somebody who is not in the address book, which is a question about the
// address book — beside a chat thread it read as a setting about chat.
function strangerPolicy() {
  test.subHeading('What to do about people you have not added');

  const app = mountApp({});

  return settle().then(function () {
    const choices = el(app, 'contacts-unknown-choices').innerHTML;

    // Three answers, and the middle one checked by nothing yet: a file
    // that is missing reads as silent, which is the tightest setting that
    // still lets two people who added each other talk. The safe answer is
    // also the default, so a broken prefs.json cannot open a node up.
    if (/value="silent"[^>]*checked/.test(choices) &&
        /value="hold"/.test(choices) && /value="acquire"/.test(choices)) {
      test.check('three choices, and a node with no file kept is silent');
    } else {
      test.fail('choices: ' + choices);
    }

    // Each one says what it costs, in the same label as its radio, so
    // reading it and choosing it are one gesture.
    if (/Silent/.test(choices) && /Hold/.test(choices) && /Add them/.test(choices) &&
        /dropped/.test(choices)) {
      test.check('and each says in a sentence what it does');
    } else {
      test.fail('choice copy: ' + choices);
    }

    // Neither is built, so neither is drawn.
    if (choices.indexOf('refuse') === -1 && choices.toLowerCase().indexOf('sound') === -1) {
      test.check('no Refuse, no sound toggle');
    } else {
      test.fail('unbuilt controls were drawn: ' + choices);
    }

    // No count of who is waiting. Under Hold the hub writes them into the
    // book, so they are rows in the table above — more than a number, and
    // something you can act on.
    if (app.container.innerHTML.indexOf('hold-line') === -1) {
      test.check('and no tally of who is waiting — they are rows in the table');
    } else {
      test.fail('a hold count came across with the panel');
    }

    // Choosing is remembered, in this app's own file.
    el(app, 'contacts-unknown-choices').fire('change', { target: { value: 'acquire' } });
    return settle().then(function () {
      let saved = null;
      try { saved = JSON.parse(app.store['prefs.json']); } catch (e) { saved = null; }
      if (saved && saved.unknown === 'acquire') {
        test.check('a choice is written to this app\'s own prefs.json');
      } else {
        test.fail('prefs.json: ' + app.store['prefs.json']);
      }

      if (el(app, 'contacts-unknown-summary').textContent ===
          'Messages from people I have not added — Add them') {
        test.check('and the heading carries the answer, so the fold reads closed');
      } else {
        test.fail('summary: ' + el(app, 'contacts-unknown-summary').textContent);
      }

      // A stored value comes back chosen.
      const back = mountApp({ store: { 'prefs.json': JSON.stringify({ unknown: 'hold' }) } });
      return settle().then(function () {
        if (/value="hold"[^>]*checked/.test(el(back, 'contacts-unknown-choices').innerHTML)) {
          test.check('a remembered choice comes back checked');
        } else {
          test.fail('restored: ' + el(back, 'contacts-unknown-choices').innerHTML);
        }

        // Nonsense in the file is not a policy. Same reason as a missing
        // one: the default is the safe answer.
        const bogus = mountApp({ store: { 'prefs.json': JSON.stringify({ unknown: 'whatever' }) } });
        return settle().then(function () {
          if (/value="silent"[^>]*checked/.test(el(bogus, 'contacts-unknown-choices').innerHTML)) {
            test.check('and a value nobody offered degrades to silent');
          } else {
            test.fail('bogus: ' + el(bogus, 'contacts-unknown-choices').innerHTML);
          }

          // The one-time adoption. Without it a deliberate Hold reverts
          // to Silent on the first load after the move — a change of
          // behaviour nobody asked for.
          const moved = mountApp({
            project: { 'app/relayChat/prefs.json': JSON.stringify({ unknown: 'hold', dnd: true }) },
          });
          return settle().then(function () {
            if (/value="hold"[^>]*checked/.test(el(moved, 'contacts-unknown-choices').innerHTML)) {
              test.check('and a value left in chat\'s old file is adopted once, not lost');
            } else {
              test.fail('adoption: ' + el(moved, 'contacts-unknown-choices').innerHTML);
            }

            // One-way. The old file is read and never written, so the two
            // apps can never end up with two live answers.
            if (moved.store['app/relayChat/prefs.json'] === undefined) {
              test.check('and chat\'s file is read, never written back to');
            } else {
              test.fail('wrote to the old file: ' + moved.store['app/relayChat/prefs.json']);
            }
          });
        });
      });
    });
  });
}

function listsTheBook() {
  test.subHeading('Everyone this node has a row for');

  const app = mountApp({
    selfTail: 'XD+0c=',
    people: [
      { publicKey: BERT, publicLabel: 'bert', caption: 'bert', myLabel: '', acquiredVia: 'handle', held: false, blocked: false },
      { publicKey: CAROL, publicLabel: 'carol', caption: 'carol', myLabel: '', acquiredVia: 'hold', held: true, blocked: false },
      { publicKey: DAVE, publicLabel: 'dave', caption: 'dave', myLabel: '', acquiredVia: 'message', held: true, blocked: true },
    ],
  });

  return settle().then(function () {
    const rows = el(app, 'contacts-tbody').innerHTML;
    if (/bert/.test(rows) && /carol/.test(rows) && /dave/.test(rows)) {
      test.check('contacts, somebody waiting and somebody refused are all listed');
    } else {
      test.fail('rows: ' + rows);
    }

    // The same three marks the chat list uses, meaning the same three
    // things. A blocked row can never also be unread, so they cannot
    // collide.
    if (rows.indexOf(spirit.core.const.ICON.NO) !== -1 && /×\s*carol/.test(rows)) {
      test.check('and are marked refused and waiting the same way chat marks them');
    } else {
      test.fail('marks: ' + rows);
    }

    // How each key got here is the whole point of the book: `handle` is
    // a phone call, `message` is somebody who wrote, `hold` is nobody
    // yet.
    if (/handle/.test(rows) && /message/.test(rows)) {
      test.check('and each row says how that key got here');
    } else {
      test.fail('acquiredVia missing: ' + rows);
    }

    // Being added is the other half of adding.
    if (/XD\+0c=/.test(el(app, 'contacts-self').textContent)) {
      test.check('and the page says what your own key ends with');
    } else {
      test.fail('self line: ' + el(app, 'contacts-self').textContent);
    }
  });
}

function decidesAboutOnePerson() {
  test.subHeading('Accept, block, unblock — one row at a time');

  const app = mountApp({
    people: [
      { publicKey: BERT, publicLabel: 'bert', caption: 'bert', myLabel: '', acquiredVia: 'handle', held: false, blocked: false },
      { publicKey: CAROL, publicLabel: 'carol', caption: 'carol', myLabel: '', acquiredVia: 'hold', held: true, blocked: false },
      { publicKey: DAVE, publicLabel: 'dave', caption: 'dave', myLabel: '', acquiredVia: 'message', held: true, blocked: true },
    ],
  });

  return settle().then(function () {
    // Closed until asked, like the Jobs and Groups tables.
    if (el(app, 'contacts-tbody').innerHTML.indexOf('data-contact-accept') === -1) {
      test.check('a row offers nothing until it is opened');
    } else {
      test.fail('verbs before opening: ' + el(app, 'contacts-tbody').innerHTML);
    }

    el(app, 'contacts-tbody').fire('click', { target: target('data-contact-row', CAROL) });
    const waiting = el(app, 'contacts-tbody').innerHTML;
    if (/data-contact-accept/.test(waiting) && /data-contact-block/.test(waiting) &&
        waiting.indexOf('data-contact-unblock') === -1) {
      test.check('somebody waiting can be accepted or blocked, and not unblocked');
    } else {
      test.fail('open held row: ' + waiting);
    }

    el(app, 'contacts-tbody').fire('click', { target: target('data-contact-accept', CAROL) });
    return settle().then(function () {
      const calls = posted(app, '/api/hub/peer');
      if (calls.length === 1 && calls[0].action === 'accept' && calls[0].publicKey === CAROL) {
        test.check('and accepting says so to this node, and to nobody else');
      } else {
        test.fail('peer calls: ' + JSON.stringify(calls));
      }

      // Blocked: one way back, and no second decision to make first.
      el(app, 'contacts-tbody').fire('click', { target: target('data-contact-row', DAVE) });
      const blocked = el(app, 'contacts-tbody').innerHTML;
      if (/data-contact-unblock/.test(blocked) && blocked.indexOf('data-contact-accept') === -1) {
        test.check('somebody refused is offered only the way back');
      } else {
        test.fail('open blocked row: ' + blocked);
      }

      // Opening one closes any other, so the page is never two open
      // arguments at once.
      if ((blocked.match(/job-log-row/g) || []).length === 1) {
        test.check('and opening one row closes the other');
      } else {
        test.fail('two rows open: ' + blocked);
      }
    });
  });
}

function renamesLocally() {
  test.subHeading('What you call them is yours');

  const app = mountApp({
    people: [
      { publicKey: BERT, publicLabel: 'bert', caption: 'bert', myLabel: '', acquiredVia: 'handle', held: false, blocked: false },
    ],
  });

  return settle().then(function () {
    el(app, 'contacts-tbody').fire('click', { target: target('data-contact-row', BERT) });
    const open = el(app, 'contacts-tbody').innerHTML;
    if (/contacts-label-input/.test(open) && /placeholder="bert"/.test(open)) {
      test.check('the field shows what is stored, with their own name behind it');
    } else {
      test.fail('label field: ' + open);
    }

    const input = el(app, 'contacts-label-input');
    input.value = ' lovelyBert ';
    input.dataset.contactKey = BERT;
    el(app, 'contacts-tbody').fire('change', { target: input });
    return settle().then(function () {
      const calls = posted(app, '/api/hub/peer');
      if (calls.length === 1 && calls[0].action === 'label' && calls[0].myLabel === 'lovelyBert') {
        test.check('and renaming posts the label, trimmed, for this node only');
      } else {
        test.fail('label calls: ' + JSON.stringify(calls));
      }
    });
  });
}

function addsByHandle() {
  test.subHeading('Adding somebody is still a phone call');

  const app = mountApp({
    matches: [
      { publicKey: 'KEY-BERT-ONE', publicLabel: 'bert', tail: 'mjowM=', acquiredVia: 'census', owner: false },
      { publicKey: 'KEY-BERT-TWO', publicLabel: 'bert', tail: 'Zv0gX0=', acquiredVia: 'census', owner: false },
    ],
  });

  return settle().then(function () {
    el(app, 'contacts-add-handle').value = 'bert';
    el(app, 'contacts-add-find').fire('click');
    return settle().then(function () {
      const out = el(app, 'contacts-add-out').innerHTML;
      const confirms = out.split('data-add-key=').length - 1;
      if (confirms === 2 && /mjowM=/.test(out) && /Zv0gX0=/.test(out)) {
        test.check('every key behind the word is listed, by its ending');
      } else {
        test.fail('matches: ' + out);
      }

      if (/fine print at the bottom of their chat app/.test(out)) {
        test.check('and it still says where the other person reads their own');
      } else {
        test.fail('instruction: ' + out);
      }

      el(app, 'contacts-add-out').fire('click', { target: target('data-add-key', 'KEY-BERT-ONE') });
      return settle().then(function () {
        const calls = posted(app, '/api/hub/contact');
        if (calls.length === 1 && calls[0].publicKey === 'KEY-BERT-ONE') {
          test.check('and confirming one writes that key and no other');
        } else {
          test.fail('contact calls: ' + JSON.stringify(calls));
        }
      });
    });
  });
}

function sendsNothing() {
  test.subHeading('It reads the book — it does not talk to anybody');

  // Packet 2 is a move, not a feature: sharing a contact is a later
  // sitting and a bigger question, because a card that arrives from
  // somebody else is their six characters rather than yours.
  const src = fs.readFileSync(APP_SCRIPT, 'utf8');
  if (src.indexOf('sendMessagePacket') === -1 && src.indexOf('/api/hub/send') === -1) {
    test.check('no packets leave this app');
  } else {
    test.fail('contacts.js sends something');
  }

  // The book itself is still whoBook's: this app reads it over the hub
  // and never keeps a copy. The one file it does own is its own
  // preference — where the stranger policy moved to (Andy) — and the
  // claim narrowed rather than held, so it is asserted narrowly: exactly
  // one write, and it is that file.
  const writes = src.match(/saveFile\(([A-Za-z_]+)/g) || [];
  if (writes.length === 1 && writes[0] === 'saveFile(CONTACTS_PREFS_FILE') {
    test.check('and the only thing it keeps on disk is its own preference — whoBook is still the book');
  } else {
    test.fail('contacts.js writes: ' + JSON.stringify(writes));
  }

  // No peer, no label, no key of anybody's in a file of this app's own.
  if (src.indexOf('logs/') === -1 && src.indexOf('peerFile') === -1) {
    test.check('and nothing about a person is written down here at all');
  } else {
    test.fail('contacts.js files something about a peer');
  }

  return Promise.resolve();
}

listsTheBook()
  .then(decidesAboutOnePerson)
  .then(renamesLocally)
  .then(addsByHandle)
  .then(strangerPolicy)
  .then(sendsNothing)
  .then(function () { test.reportSuccessFailureCount(); })
  .catch(function (err) {
    test.fail('contacts threw: ' + ((err && err.stack) || err));
    test.reportSuccessFailureCount();
  });
