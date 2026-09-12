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
// Two keys behind one handle — the case a handle alone cannot answer.
// Same SPKI header as every other key, which is why what tells them
// apart comes off the END.
const JOHN_A = 'MCowBQYDK2VwAyEAjohnjohnjohnjohnjohnjohnjohnaaajoh=';
const JOHN_B = 'MCowBQYDK2VwAyEAjohnjohnjohnjohnjohnjohnjohnbbbjoh=';

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
    // THE NODE HOLDS THE STRANGER POLICY, so the fake holds it too: a GET
    // answers what is set and a POST changes it. A stub that answered a
    // fixture forever would let a panel that never repaints pass, which
    // is the trap this harness already learned once on /api/hub/peer.
    if (url.indexOf('/api/hub/unknown-senders') === 0) {
      if ((init && init.method) === 'POST') {
        const sent = JSON.parse((init && init.body) || '{}');
        if (opts.policyRefuses) {
          const bad = JSON.stringify({ ok: false, error: 'refused' });
          return Promise.resolve({
            status: 400,
            text: function () { return Promise.resolve(bad); },
            json: function () { return Promise.resolve(JSON.parse(bad)); },
          });
        }
        opts.policy = sent.policy;
      }
      if (opts.deaf) return Promise.reject(new Error('no answer'));
      const body = JSON.stringify({ ok: true, policy: opts.policy || 'silent' });
      return Promise.resolve({
        status: 200,
        text: function () { return Promise.resolve(body); },
        json: function () { return Promise.resolve(JSON.parse(body)); },
      });
    }
    if (url.indexOf('/api/hub/contact') === 0) status = opts.contactStatus || 201;
    if (url.indexOf('/api/hub/peer') === 0) {
      status = opts.peerStatus || 200;
      // The node keeps what it is told and the next read hands it back —
      // whoBook.label, then buildPeople. A stub that answered the same
      // fixture forever is how a panel that never repaints passed this
      // suite: the POST was asserted, and nothing ever asked what the
      // screen said afterwards.
      const sent = JSON.parse((init && init.body) || '{}');
      if (status === 200 && sent.action === 'label') {
        (opts.people || []).forEach(function (p) {
          if (p.publicKey !== sent.publicKey) return;
          p.myLabel = sent.myLabel;
          p.caption = sent.myLabel || p.publicLabel;
        });
      }
    }
    const text = JSON.stringify(payload);
    return Promise.resolve({
      status: status,
      text: function () { return Promise.resolve(text); },
      json: function () { return Promise.resolve(JSON.parse(text)); },
    });
  };

  let behavior = null;
  const jobFeed = [];
  const shellSpirit = {
    shell: {
      activateApp: function (b) { behavior = b; },
      fileInfoRow: function (label, value) {
        return '<div class="file-info-row"><span>' + label + '</span><span>' + value + '</span></div>';
      },
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
      util: {
        escapeHtml: spirit.core.util.escapeHtml,
        // The real one. A stub that rounded differently would let the
        // panel say a size the browser never shows.
        formatBytes: spirit.core.util.formatBytes,
      },
      const: { ICON: spirit.core.const.ICON },
      // The channel presence arrives on. Captured rather than faked
      // away, so a test can push a relay-presence payload and read the
      // colour that comes out — which is the only part of the dot this
      // side of the browser can be held to.
      jobs: {
        subscribe: function (handlers) {
          jobFeed.push(handlers || {});
          return function () {};
        },
      },
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
  const launched = [];
  const called = [];
  // What the dialog will answer. The shell settles the promise when the
  // screen leaves the stack; here the test says what it decided.
  let answer = opts.dialogResult === undefined ? null : opts.dialogResult;
  const api = {
    escapeHtml: spirit.core.util.escapeHtml,
    launchApp: function (id, params, options) {
      launched.push({ id: id, params: params, options: options });
    },
    // Recorded rather than dropped: opening a row IS a call now, and
    // which dialog it names with which params is the whole of what the
    // click decides. It answers a promise, because that is the contract
    // — the code that opens the screen is the code that acts on what it
    // decided.
    callDialog: function (id, params) {
      called.push({ id: id, params: params });
      return Promise.resolve(answer);
    },
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
  return {
    doc: doc, log: log, container: container, behavior: behavior, store: store,
    launched: launched, called: called,
    answers: function (result) { answer = result; },
    // A SECOND MOUNT OF THE SAME LOADED SCRIPT, which is what walking
    // into an app twice actually is. mountApp() re-evaluates the source,
    // so two mountApp calls are two module instances and would prove
    // nothing about a module-level guard.
    remount: function () { behavior.mount(container, api, null); },
    // How many EventSources this app asked the shell for. One, forever —
    // the shell has no unmount hook, so a subscription per mount would
    // be a socket per visit.
    subscriptions: function () { return jobFeed.length; },
    // Deliver a presence payload the way the shell would.
    presence: function (table, how) {
      const job = { id: 'j1', type: 'relay-presence', data: { presence: table } };
      jobFeed.forEach(function (h) {
        if (how === 'snapshot') { if (h.onSnapshot) h.onSnapshot([job]); }
        else if (h.onUpdate) h.onUpdate(job);
      });
    },
    // Something else on the same channel, which must change nothing.
    otherJob: function () {
      jobFeed.forEach(function (h) {
        if (h.onUpdate) h.onUpdate({ id: 'j2', type: 'server-stats', data: { cpu: 3 } });
      });
    },
  };
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
    //
    // And what it says is what happens to the BOOK (packet 4). The old
    // wording read as a choice about keeping or dropping a message body,
    // which is only true of `acquire` — the other two drop the line
    // either way, and the difference between them is whether the person
    // gets a row. Asserted on the row words, because that is the part
    // that was wrong.
    if (/Ignore/.test(choices) && /List them/.test(choices) && /Add them/.test(choices) &&
        /No row\./.test(choices) && /A waiting row/.test(choices) && /they get a row/.test(choices)) {
      test.check('and each says in a sentence what it does to the book');
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

    // CHOOSING IS ASKED FOR, NOT WRITTEN. The setting stopped being this
    // app's file when it stopped being this app's business: it is what
    // the NODE does about a stranger, and a node-global answer stored
    // inside one of its readers was wrong as a location and wrong as a
    // layer — api.fs is scoped to app/<name>/, and a jail an app can
    // write is not a jail.
    el(app, 'contacts-unknown-choices').fire('change', { target: { value: 'acquire' } });
    return settle().then(function () {
      const posts = app.log.filter(function (c) {
        return c.url.indexOf('/api/hub/unknown-senders') === 0 && c.method === 'POST';
      });
      const sent = posts.length ? JSON.parse(posts[0].body) : null;
      if (posts.length === 1 && sent && sent.policy === 'acquire') {
        test.check('a choice is POSTed to the node, which is what holds it');
      } else {
        test.fail('posts: ' + JSON.stringify(posts));
      }

      // THE FILE IS GONE, and this is the check that keeps it gone. The
      // value has already moved between two apps' folders — relayChat's,
      // then contacts' — which was the tell that it belonged to neither.
      if (Object.keys(app.store).length === 0) {
        test.check('and this app writes no file at all any more');
      } else {
        test.fail('contacts.js wrote: ' + JSON.stringify(Object.keys(app.store)));
      }

      if (el(app, 'contacts-unknown-summary').textContent ===
          'People who write and are not in this book — Add them') {
        test.check('and the heading carries the answer, so the fold reads closed');
      } else {
        test.fail('summary: ' + el(app, 'contacts-unknown-summary').textContent);
      }

      // What the node says is what the radios show — on first paint, not
      // after a correction. The read is a round trip now, so painting
      // before it lands would draw `silent` every time.
      const back = mountApp({ policy: 'hold' });
      return settle().then(function () {
        if (/value="hold"[^>]*checked/.test(el(back, 'contacts-unknown-choices').innerHTML)) {
          test.check('and what the node holds is what comes back checked');
        } else {
          test.fail('restored: ' + el(back, 'contacts-unknown-choices').innerHTML);
        }

        // Nonsense from the node is not a policy either. Same reason as a
        // missing one: the default is the safe answer, and being wrong
        // towards `silent` costs a message rather than a stranger a row.
        const bogus = mountApp({ policy: 'whatever' });
        return settle().then(function () {
          if (/value="silent"[^>]*checked/.test(el(bogus, 'contacts-unknown-choices').innerHTML)) {
            test.check('a value nobody offered degrades to silent');
          } else {
            test.fail('bogus: ' + el(bogus, 'contacts-unknown-choices').innerHTML);
          }

          // A NODE THAT WILL NOT ANSWER reads as the tightest setting,
          // not as whatever was on screen. The old file could not fail
          // this way; a round trip can.
          const mute = mountApp({ policy: 'acquire', deaf: true });
          return settle().then(function () {
            // deaf is honoured by the harness below; with no answer at
            // all the app must still paint something, and it must be the
            // safe thing.
            const drawn = el(mute, 'contacts-unknown-choices').innerHTML;
            if (/value="silent"[^>]*checked/.test(drawn)) {
              test.check('and a node that does not answer reads as silent, never as the last thing seen');
            } else {
              test.fail('deaf node: ' + drawn);
            }

            // A REFUSED CHANGE MUST NOT SHOW AS MADE. The radio reflects
            // what the node will actually do, which is why the repaint
            // happens from the answer rather than from the click — a
            // control that lies about a security setting is worse than
            // one that is hard to use.
            const refused = mountApp({ policy: 'silent', policyRefuses: true });
            return settle().then(function () {
              el(refused, 'contacts-unknown-choices').fire('change', { target: { value: 'acquire' } });
              return settle().then(function () {
                const drawn2 = el(refused, 'contacts-unknown-choices').innerHTML;
                if (/value="silent"[^>]*checked/.test(drawn2)) {
                  test.check('a refused change repaints as unchanged, rather than showing a radio that lies');
                } else {
                  test.fail('after refusal: ' + drawn2);
                }

                if (/could not remember/.test(el(refused, 'contacts-status').textContent)) {
                  test.check('and says so, rather than failing quietly');
                } else {
                  test.fail('status: ' + el(refused, 'contacts-status').textContent);
                }
              });
            });
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
      // Bert is the one who has been renamed, so Handle and Label carry
      // different words and the columns cannot pass by both showing the
      // same thing.
      { publicKey: BERT, publicLabel: 'bert', caption: 'Bertie', myLabel: 'Bertie', tail: 'bertb=', acquiredVia: 'handle', held: false, blocked: false },
      { publicKey: CAROL, publicLabel: 'carol', caption: 'carol', myLabel: '', tail: 'lcaro=', acquiredVia: 'hold', held: true, blocked: false },
      { publicKey: DAVE, publicLabel: 'dave', caption: 'dave', myLabel: '', tail: 'edave=', acquiredVia: 'message', held: true, blocked: true },
    ],
  });

  return settle().then(function () {
    const rows = el(app, 'contacts-tbody').innerHTML;
    if (/bert/.test(rows) && /carol/.test(rows) && /dave/.test(rows)) {
      test.check('contacts, somebody waiting and somebody refused are all listed');
    } else {
      test.fail('rows: ' + rows);
    }

    // The same marks the chat list uses, meaning the same things: a mark
    // says WHO refused somebody, and that does not change with which app
    // you are standing in.
    //
    // 📇 for the node's refusal, not ❌ — ❌ is chat's own, and it lives
    // in chat's per-peer log where api.fs will not let this app look. And
    // ⌛ for waiting, which is not a refusal at all: the typed × it
    // replaced read as NO one column from the ❌ that is one.
    const ICONS = spirit.core.const.ICON;
    // Refused wears the plain no, not the rolodex the chat list uses for
    // the same person (Andy). In chat that mark says WHICH app refused
    // them, because the answer is elsewhere; here you are already in that
    // app, and a mark pointing at Contacts drawn in Contacts points at
    // itself.
    //
    // Waiting is the same ⌛ everywhere, because it names no app.
    //
    // In its own cell now, not glued to the front of a name: the mark
    // column has no heading and every handle starts at the same x
    // whether or not the row beside it is marked (Andy).
    if (rows.indexOf('<td>' + ICONS.NO + '</td><td>dave</td>') !== -1 &&
        rows.indexOf('<td>' + ICONS.WAITING + '</td><td>carol</td>') !== -1 &&
        rows.indexOf(ICONS.ROLODEX) === -1) {
      test.check('and refused wears the plain no here, where the rolodex would point at itself');
    } else {
      test.fail('marks: ' + rows);
    }

    // Five columns, and the first TWO unnamed — the dot has no word and
    // neither does the mark, and giving either one would only widen the
    // column it is trying to keep narrow. Read off the source so the
    // header and the rows cannot drift apart silently.
    const rawSrc = fs.readFileSync(APP_SCRIPT, 'utf8');
    // COMMENTS STRIPPED FIRST. This file discusses its own markup at
    // length — there is a `colspan="4"` inside a comment about the
    // layout that used to be here — and a test that greps the source
    // including its comments is a test a comment can satisfy or break.
    // That has been the cause three times in this repo now.
    const src = rawSrc.replace(/^\s*\/\/.*$/gm, '');

    if (src.indexOf('<tr><th></th><th></th><th>Handle</th><th>Label</th><th>How</th></tr>') !== -1) {
      test.check('the header is a dot column, a mark column, then Handle, Label and How');
    } else {
      test.fail('header: ' + (/<thead>[\s\S]*?<\/thead>/.exec(src) || [''])[0]);
    }

    // A column added is two numbers to keep in step: the header and every
    // colspan under it. Same check jobs.js carries, same reason — a
    // colspan one short shows only as a panel that stops before the edge
    // of the table.
    //
    // `<th` and not `<th>`: a heading that carries an attribute is still
    // a heading, and counting only the bare ones would undercount the
    // moment anybody adds one.
    const headers = (src.match(/<th[\s>]/g) || []).length;
    const spans = (src.match(/colspan="(\d+)"/g) || []).map(function (m) {
      return Number(/\d+/.exec(m)[0]);
    });
    if (headers === 5 && spans.length && spans.every(function (n) { return n === headers; })) {
      test.check('and every colspan under it spans all ' + headers);
    } else {
      test.fail(headers + ' headers vs colspans ' + JSON.stringify(spans));
    }

    // Their name and yours are two answers and the table shows both, in
    // that order — theirs is what you were told, yours is what you
    // decided afterwards. Bert has been renamed, so the two words differ
    // and a row that printed one twice would fail here.
    if (rows.indexOf('<td>bert</td><td>Bertie</td>') !== -1 &&
        rows.indexOf('<td>carol</td><td></td>') !== -1) {
      test.check('Handle carries theirs and Label carries yours, empty when you have not chosen one');
    } else {
      test.fail('handle/label columns: ' + rows);
    }

    // And no key endings on ordinary rows: you compared those down a
    // telephone while adding them and it is finished (Andy). The footer
    // still says where YOUR own ending is, which is a different job.
    if (rows.indexOf('…') === -1 && el(app, 'contacts-self').textContent.indexOf('XD+0c=') !== -1) {
      test.check('and no row wears a key ending, though the footer still tells you yours');
    } else {
      test.fail('endings in rows: ' + rows);
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

// The panel these three suites used to describe is a screen of its own
// now (app/contactsDetails), and so are its tests — spirit/test/
// contactsDetails.js. What stays here is the one thing a row does.
function aRowOpensThePerson() {
  test.subHeading('A row opens the person, and that is all a row does');

  const app = mountApp({
    people: [
      { publicKey: BERT, publicLabel: 'bert', caption: 'bert', myLabel: 'Bertie', tail: 'bertb=', acquiredVia: 'handle', held: false, blocked: false },
      { publicKey: CAROL, publicLabel: 'carol', caption: 'carol', myLabel: '', tail: 'lcaro=', acquiredVia: 'hold', held: true, blocked: false },
    ],
  });

  return settle().then(function () {
    el(app, 'contacts-tbody').fire('click', { target: target('data-contact-row', CAROL) });

    // The KEY alone. The dialog re-fetches its row, because the counters
    // move while the screen is open and a row captured at launch would
    // sit there going stale.
    if (app.called.length === 1 && app.called[0].id === 'app/contactsDetails' &&
        JSON.stringify(app.called[0].params) === JSON.stringify({ key: CAROL })) {
      test.check('clicking a row calls the dialog for that key and nothing else');
    } else {
      test.fail('called: ' + JSON.stringify(app.called));
    }

    // callDialog, not launchApp. The shell refuses a dialog through the
    // launch door precisely so there is one way in — the way that hands
    // the dialog its subject and hands back what it decided.
    if (app.launched.length === 0) {
      test.check('and it goes through callDialog rather than the launch door');
    } else {
      test.fail('launched: ' + JSON.stringify(app.launched));
    }

    // Nothing expands in place any more. The old panel put a six-fact
    // bubble and a form inside a colspan="4" — the widest thing on the
    // page inside the narrowest.
    const rows = el(app, 'contacts-tbody').innerHTML;
    if (rows.indexOf('job-log-row') === -1 && rows.indexOf('fact-row') === -1 &&
        rows.indexOf('contacts-label-input') === -1) {
      test.check('and no row expands in place, so the table keeps its shape');
    } else {
      test.fail('a row still expands: ' + rows);
    }
  });
}

function refreshesWhenTheDialogChangedSomething() {
  test.subHeading('What the dialog decided reaches the table');

  const people = [
    { publicKey: CAROL, publicLabel: 'carol', caption: 'carol', myLabel: '', tail: 'lcaro=', acquiredVia: 'hold', held: true, blocked: false },
  ];
  const app = mountApp({ people: people });

  return settle().then(function () {
    const before = el(app, 'contacts-tbody').innerHTML;
    if (before.indexOf(spirit.core.const.ICON.WAITING) !== -1) {
      test.check('carol is listed as waiting');
    } else {
      test.fail('before: ' + before);
    }

    // The dialog blocked her. render() repaints from a list this app
    // already fetched and does not fetch again, so without the answer,
    // the row behind you would still read as waiting.
    people[0].held = true;
    people[0].blocked = true;
    app.answers({ changed: true, key: CAROL });
    el(app, 'contacts-tbody').fire('click', { target: target('data-contact-row', CAROL) });

    return settle().then(function () {
      const after = el(app, 'contacts-tbody').innerHTML;
      if (after.indexOf(spirit.core.const.ICON.NO) !== -1) {
        test.check('and an answer saying something changed re-reads the book, so the mark is right');
      } else {
        test.fail('after: ' + after);
      }
    });
  });
}

// Back is not a cancel here in the sense of undoing anything — the hub
// verbs already happened — it is simply a leave with nothing to report.
// A dialog that decided nothing must not make the table re-fetch.
function saysNothingWhenNothingHappened() {
  const app = mountApp({
    people: [{ publicKey: CAROL, publicLabel: 'carol', caption: 'carol', myLabel: '', tail: 'lcaro=', acquiredVia: 'message', held: false, blocked: false }],
    dialogResult: null,
  });
  return settle().then(function () {
    const reads = app.log.filter(function (c) { return c.url === '/api/hub/who'; }).length;
    el(app, 'contacts-tbody').fire('click', { target: target('data-contact-row', CAROL) });
    return settle().then(function () {
      const after = app.log.filter(function (c) { return c.url === '/api/hub/who'; }).length;
      if (after === reads) {
        test.check('and a dialog answering null costs the table nothing');
      } else {
        test.fail('re-read on an empty result: ' + reads + ' then ' + after);
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

// The row that opened is the heading, so what is under it is one reading
// rather than a list: three facts across, then what you call them and
// what you decide about them on one line (Andy).
function foldsObeyTheSpacingRules() {
  test.subHeading('The folds are one group, and the block below a heading carries its own space');

  const src = fs.readFileSync(APP_SCRIPT, 'utf8');
  const css = fs.readFileSync(path.join(RUN_DIR, 'index.html'), 'utf8');

  // Opening one fold closes its sibling, done by the browser: same name,
  // no JS, no state. Read off the markup rather than counted, so the
  // check says WHICH group as well as how many.
  const named = (src.match(/<details[^>]*name="([^"]+)"/g) || [])
    .map(function (tag) { return /name="([^"]+)"/.exec(tag)[1]; });
  const folds = (src.match(/<details/g) || []).length;

  if (folds === 2 && named.length === 2 && named[0] === named[1]) {
    test.check('both folds are in one exclusive group, so opening one closes the other');
  } else {
    test.fail(folds + ' folds, names: ' + JSON.stringify(named));
  }

  // Named from this app's stable id prefix, never from its app id: app
  // ids are folder-derived and have moved before (APP_ID_RENAMES), and a
  // group named from one would silently regroup on the next move with
  // nothing to catch it.
  if (named[0] === 'contacts-panels' && named[0].indexOf('/') === -1) {
    test.check('and named from the id prefix, not the folder-derived app id');
  } else {
    test.fail('group name: ' + named[0]);
  }

  // A block carries the gap above itself. The radios sit under a summary
  // and would read as part of it otherwise — this rule followed the panel
  // over from Relay Chat, where its copy was left behind pointing at an
  // element that no longer existed.
  const gap = /#contacts-unknown-choices\s*\{[^}]*margin-top:\s*(\d+)px/.exec(css);
  const scale = /#app-content > \.app-pane > \*[^{]*\{[^}]*margin-top:\s*(\d+)px/.exec(css);
  if (gap && scale && gap[1] === scale[1]) {
    test.check('and the choices carry the same leading space as any other block');
  } else {
    test.fail('choices ' + (gap && gap[1]) + 'px vs the block scale ' + (scale && scale[1]) + 'px');
  }

  // The one it replaced is gone, not duplicated.
  if (css.indexOf('#rc-unknown-choices') === -1) {
    test.check('and the copy it left behind in chat is gone');
  } else {
    test.fail('#rc-unknown-choices is still in the stylesheet');
  }
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

  // THIS APP KEEPS NOTHING ON DISK, and the claim got stronger rather
  // than being relaxed. It used to own exactly one file — the stranger
  // policy, which had already moved here from relayChat's folder. Moving
  // twice between apps was the tell that it belonged to neither: it is
  // what the NODE does about a stranger, so it lives in preferences.json
  // and is reached through /api/hub/unknown-senders.
  //
  // What that leaves is an app that draws and asks, and stores nothing at
  // all. whoBook is still the book; now nothing here is.
  const writes = src.match(/saveFile\(/g) || [];
  if (writes.length === 0) {
    test.check('and it keeps nothing on disk — it draws the control, the node holds the value');
  } else {
    test.fail('contacts.js writes: ' + JSON.stringify(src.match(/saveFile\([A-Za-z_'"./]*/g)));
  }

  // No peer, no label, no key of anybody's in a file of this app's own.
  if (src.indexOf('logs/') === -1 && src.indexOf('peerFile') === -1) {
    test.check('and nothing about a person is written down here at all');
  } else {
    test.fail('contacts.js files something about a peer');
  }

  return Promise.resolve();
}

// The two rows where the handle column is not an answer by itself. Both
// are the node's verdict, not this app's: `ambiguous` is set by
// buildPeople and `tail` comes down with the row, so the table and the
// To list can never disagree about which rows read alike.
function theHandleColumnStillIdentifies() {
  test.subHeading('A handle that names nobody says which key it is');

  const app = mountApp({
    people: [
      // Two people who claimed the same word and neither renamed. The
      // node saw the collision and said so.
      { publicKey: JOHN_A, publicLabel: 'john', caption: 'john (aaajoh=)', myLabel: '', tail: 'aaajoh=', ambiguous: true, acquiredVia: 'message', held: false, blocked: false },
      { publicKey: JOHN_B, publicLabel: 'john', caption: 'john (bbbjoh=)', myLabel: '', tail: 'bbbjoh=', ambiguous: true, acquiredVia: 'message', held: false, blocked: false },
      // And somebody who never claimed a handle at all: the cell would
      // otherwise be empty, which names nobody rather than everybody.
      { publicKey: CAROL, publicLabel: '', caption: CAROL, myLabel: '', tail: 'lcaro=', acquiredVia: 'message', held: false, blocked: false },
    ],
  });

  return settle().then(function () {
    const rows = el(app, 'contacts-tbody').innerHTML;
    if (rows.indexOf('<td>john …aaajoh=</td>') !== -1 &&
        rows.indexOf('<td>john …bbbjoh=</td>') !== -1) {
      test.check('two people behind one word are told apart by the end of the key');
    } else {
      test.fail('ambiguous rows: ' + rows);
    }

    if (rows.indexOf('<td>…lcaro=</td>') !== -1) {
      test.check('and a contact who never claimed a handle is their key ending, not a blank');
    } else {
      test.fail('nameless row: ' + rows);
    }

    // The whole key is never in a cell — it is 44 characters and it was
    // what the old caption fell back to. It stays in data-contact-row,
    // because the row has to say whose panel it opens.
    if (rows.indexOf('<td>' + CAROL) === -1 && rows.indexOf('data-contact-row="' + CAROL + '"') !== -1) {
      test.check('and never the whole key, which is what the caption used to fall back to');
    } else {
      test.fail('whole key in a cell: ' + rows);
    }
  });
}

// PRESENCE.md Stage 4 — the dot, and that is the boundary.
//
// The column is the one place presence and whoBook meet: presence
// arrives keyed by public key because a key is all a relay and this node
// agree about, and the book says who that is. Everything below is that
// join and the three marks it produces.
//
// The eyeball test (presenceShow.js) watches the colours change on a
// real screen and can be run once in a sitting. This runs every case in
// a millisecond, which is the half of the pair that catches the ones
// nobody would think to look at.
function theDotColumn() {
  test.subHeading('The leftmost dot, and the third colour that makes the other two honest');

  const app = mountApp({
    people: [
      { publicKey: BERT, publicLabel: 'bert', caption: 'bert', myLabel: '', tail: 'bertb=', acquiredVia: 'handle', held: false, blocked: false },
      { publicKey: CAROL, publicLabel: 'carol', caption: 'carol', myLabel: '', tail: 'lcaro=', acquiredVia: 'handle', held: false, blocked: false },
      { publicKey: DAVE, publicLabel: 'dave', caption: 'dave', myLabel: '', tail: 'edave=', acquiredVia: 'handle', held: false, blocked: false },
    ],
  });
  const ICONS = spirit.core.const.ICON;

  function rows() { return el(app, 'contacts-tbody').innerHTML; }
  function dotFor(key) {
    // The FIRST cell of that person's row, which is what "leftmost"
    // means and is the only thing a person reading down the page sees.
    const row = new RegExp('data-contact-row="' + key.replace(/[+/=]/g, '\\$&') +
      '"><td[^>]*>([^<]*)</td>').exec(rows());
    return row ? row[1] : '(no row)';
  }

  return settle().then(function () {
    // BEFORE ANY PAYLOAD. A screenful of red on load would be a lie that
    // corrects itself a second later, and that is worse than white,
    // because the lie is the one that looks like information.
    if (dotFor(BERT) === ICONS.WHITE_CIRCLE && dotFor(DAVE) === ICONS.WHITE_CIRCLE) {
      test.check('before any payload every dot is white — nothing is known, and it says so');
    } else {
      test.fail('on load: ' + dotFor(BERT) + ' ' + dotFor(DAVE));
    }

    // The three marks, from one payload, which is the picture the whole
    // scenario exists to put on a screen at once.
    const table = {};
    table[BERT] = true;
    table[CAROL] = false;
    app.presence(table);

    if (dotFor(BERT) === ICONS.GREEN_CIRCLE) {
      test.check('a key a relay says is present goes green');
    } else {
      test.fail('bert: ' + dotFor(BERT));
    }
    if (dotFor(CAROL) === ICONS.RED_CIRCLE) {
      test.check('a key a relay says is absent goes red');
    } else {
      test.fail('carol: ' + dotFor(CAROL));
    }
    // THE ONE THAT MATTERS. Dave is in the book and in no payload. He is
    // not offline — he is unseen, and red here would be the column
    // claiming knowledge it does not have.
    if (dotFor(DAVE) === ICONS.WHITE_CIRCLE) {
      test.check('and a key NO relay mentions stays white — unseen is not offline');
    } else {
      test.fail('dave: ' + dotFor(DAVE));
    }

    // Still listed. Whatever the dot says, the row is the address book's
    // and presence has no vote on who is in it.
    if (rows().indexOf('dave') !== -1) {
      test.check('and they are still in the list, because presence does not decide membership');
    } else {
      test.fail('dave left the table');
    }

    // A REMOVED PEER GOES WHITE, NOT RED. The node deletes a key it is
    // told is gone rather than marking it absent, so the key falls out
    // of the payload — which is exactly the state above. Asserted as a
    // transition because that is how it is met: green, then nothing.
    const after = {};
    after[CAROL] = false;
    app.presence(after);
    if (dotFor(BERT) === ICONS.WHITE_CIRCLE && dotFor(CAROL) === ICONS.RED_CIRCLE) {
      test.check('a key that DROPS OUT of the payload goes white, not red — that is removal');
    } else {
      test.fail('after removal: bert=' + dotFor(BERT) + ' carol=' + dotFor(CAROL));
    }

    // Words as well as colour, on the cell rather than a heading.
    const titled = /<td title="([^"]*)">/.exec(rows());
    if (titled && /present|absent|not known/.test(titled[1])) {
      test.check('and every dot carries the words too, so colour is never the only carrier');
    } else {
      test.fail('no title on the dot cell: ' + rows().slice(0, 120));
    }

    // Nothing else on that channel may move this column. server-stats
    // ticks every two seconds.
    const before = rows();
    app.otherJob();
    if (rows() === before) {
      test.check('and another job on the same channel repaints nothing');
    } else {
      test.fail('a server-stats tick changed the table');
    }

    // The snapshot path, which is how an app mounted after the last
    // change learns anything at all. Without it, "nothing has happened
    // yet" and "nobody is here" look identical.
    const late = mountApp({
      people: [{ publicKey: BERT, publicLabel: 'bert', caption: 'bert', myLabel: '', tail: 'bertb=', acquiredVia: 'handle', held: false, blocked: false }],
    });
    return settle().then(function () {
      const snap = {};
      snap[BERT] = true;
      late.presence(snap, 'snapshot');
      if (el(late, 'contacts-tbody').innerHTML.indexOf(ICONS.GREEN_CIRCLE) !== -1) {
        test.check('and the snapshot fills the column in, so a late mount is not blank forever');
      } else {
        test.fail('snapshot ignored: ' + el(late, 'contacts-tbody').innerHTML);
      }

      // ONE SOCKET PER PAGE, NOT ONE PER MOUNT. The shell has no unmount
      // hook, so a subscription taken in mount() is never given back —
      // four visits to Contacts would leave four EventSources each
      // repainting the same table.
      //
      // Re-mounting the SAME loaded script, because that is what walking
      // into the app a second time is. Two mountApp() calls would be two
      // module instances and would prove nothing.
      const opened = late.subscriptions();
      late.remount();
      late.remount();
      if (late.subscriptions() === opened) {
        test.check('and walking in twice more opens no further subscription');
      } else {
        test.fail('two more mounts asked for ' +
          (late.subscriptions() - opened) + ' more subscription(s)');
      }
    });
  });
}

listsTheBook()
  .then(theHandleColumnStillIdentifies)
  .then(aRowOpensThePerson)
  .then(refreshesWhenTheDialogChangedSomething)
  .then(saysNothingWhenNothingHappened)
  .then(addsByHandle)
  .then(strangerPolicy)
  .then(foldsObeyTheSpacingRules)
  .then(sendsNothing)
  .then(theDotColumn)
  .then(function () { test.reportSuccessFailureCount(); })
  .catch(function (err) {
    test.fail('contacts threw: ' + ((err && err.stack) || err));
    test.reportSuccessFailureCount();
  });
