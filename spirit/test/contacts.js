'use strict';

// The address book, now that it has its own window (packet 2).
//
// contactBook is still the store and the hub still owns every verb — what
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
function target(attr, value, opts) {
  const node = { dataset: {} };
  const camel = attr.replace(/-([a-z])/g, function (m, c) { return c.toUpperCase(); });
  node.dataset[camel.replace(/^data/, '').replace(/^./, function (c) { return c.toLowerCase(); })] = value;
  // ANSWERS A CLASS SELECTOR TOO. This only ever matched '[data-attr]',
  // which was enough while every clickable row was found by attribute.
  // The seen list finds its Add by CLASS, so a stub that could not answer
  // one silently produced "nothing was clicked" — which reads exactly like
  // a broken handler.
  node.className = (opts && opts.className) || '';
  node.closest = function (selector) {
    if (selector === '[' + attr + ']') return node;
    if (selector.charAt(0) === '.' && node.className.split(/\s+/).indexOf(selector.slice(1)) !== -1) return node;
    return null;
  };
  // The handler reads data-url off the button as well as data-key.
  Object.keys((opts && opts.dataset) || {}).forEach(function (k) {
    node.dataset[k] = opts.dataset[k];
  });
  node.getAttribute = function (name) {
    const c = name.replace(/^data-/, '').replace(/-([a-z])/g, function (m, ch) { return ch.toUpperCase(); });
    return node.dataset[c] === undefined ? '' : node.dataset[c];
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
    // THE VERB, since the contact namespace folded onto /api/spirit on
    // 2026-09-15. Matching on the URL stopped telling these apart: every
    // loopback call this app makes goes to the same path now.
    let verb = '';
    try { verb = JSON.parse(String((init && init.body) || '{}')).verb || ''; }
    catch (e) { verb = ''; }

    // THE NODE HOLDS THE STRANGER POLICY, so the fake holds it too:
    // `contact.senders` answers what is set and `contact.setSenders`
    // changes it. A stub that answered a fixture forever would let a
    // panel that never repaints pass, which is the trap this harness
    // already learned once on /api/hub/peer.
    //
    // READ AND WRITE ARE TWO VERBS rather than two methods on one path,
    // and the fixture is better for it: it used to read `init.method`,
    // which under one door is 'POST' for both and would have made every
    // write look like a read.
    if (verb === 'contact.senders' || verb === 'contact.setSenders') {
      if (verb === 'contact.setSenders') {
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
    if (verb === 'peer.acquire') status = opts.contactStatus || 201;
    if (verb.indexOf('contact.') === 0) {
      status = opts.peerStatus || 200;
      // The node keeps what it is told and the next read hands it back —
      // contactBook.label, then buildPeople. A stub that answered the same
      // fixture forever is how a panel that never repaints passed this
      // suite: the POST was asserted, and nothing ever asked what the
      // screen said afterwards.
      const sent = JSON.parse((init && init.body) || '{}');
      if (status === 200 && verb === 'contact.label') {
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
  const posts = [];
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
      // The browser's one mouth onto the node (AGENT.md, Comms).
      // shell.js asks here; kernel.js supplies it in a real page.
      ask: test.browserAsk(fakeFetch),
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
    // ── ASKING A PERSON WHO THEY ARE ─────────────────────────────────
    //
    // Recorded whole, because what is being asserted about it is its
    // SHAPE: an empty app id, so packet.js omits the field and
    // js/nodeCard.js will answer it (a packet carrying an app is an
    // app's, and falls through to the front door instead).
    //
    // `opts.cards` maps a key to what that node says back, or to a
    // refusal — there is no third state worth faking, because the one
    // thing this bubble reports that a census cannot is whether anybody
    // was home.
    peerPost: function (packetApp, toKey, body) {
      posts.push({ app: packetApp, to: toKey, body: body });
      const card = (opts.cards || {})[toKey];
      if (!card) {
        return Promise.resolve({ ok: false, status: 503, body: null,
          error: 'that peer is not reachable right now' });
      }
      return Promise.resolve({ ok: true, status: 200,
        body: { ok: true, name: card.name || '', description: card.description || '' } });
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
    launched: launched, called: called, posts: posts,
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

// WHAT WAS SENT, BY VERB. This took a path until the fold finished on
// 2026-09-15: every loopback call goes to one URL now, so a filter on
// the URL matches everything this app ever did.
function posted(app, prefix) {
  return app.log
    .map(function (c) { try { return JSON.parse(c.body); } catch (e) { return null; } })
    .filter(function (b) { return b && String(b.verb || '').indexOf(prefix) === 0; });
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
        return /contact.setSenders/.test(String(c.body || ''));
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
    // `icon-cell` since the glyph columns were given a fixed width
    // (Andy: "the column width should be fixed to twice the column
    // height") — the mark column is empty on most rows, and a
    // content-sized one would be a few pixels wide until somebody is
    // held, then shift every name in the table sideways.
    if (rows.indexOf('<td class="icon-cell">' + ICONS.NO + '</td><td class="label-cell">dave</td>') !== -1 &&
        rows.indexOf('<td class="icon-cell">' + ICONS.WAITING + '</td><td class="label-cell">carol</td>') !== -1 &&
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

    // TWO UNHEADED COLUMNS AGAIN: the presence dot and the mark. There
    // were three while the LOCK column stood (a contact seated on a relay
    // I own); the seats were a roster's and no relay returns one, so the
    // column went on 2026-09-19 (Andy: "kill the lock columns"). None of
    // them has a word, and a one-word heading over a glyph is a word read
    // on every pass to learn nothing.
    //
    // MATCHED ACROSS THE CONCATENATION, and against the whole file
    // rather than the first <thead> in it. Both bit: the header is built
    // from several string literals joined with `+` now, and a regex for
    // the first <thead> finds the SEARCH table's — which has different
    // columns and would have made this assert the wrong table quietly.
    //
    // So: drop whitespace and the string joins, then look for the run of
    // cells. What survives is the markup as the browser receives it.
    const flat = src.replace(/\s+/g, '').replace(/'\+'/g, '');
    if (flat.indexOf('<thclass="icon-cell"></th><thclass="icon-cell"></th><th>Label</th>') !== -1 &&
        flat.indexOf('<thclass="icon-cell"></th><thclass="icon-cell"></th><thclass="icon-cell"></th><th>Label</th>') === -1) {
      test.check('the header is two fixed glyph columns and one name');
    } else {
      test.fail('header: ' + (/<tr>(<th[^>]*>[^<]*<\/th>)+<\/tr>/.exec(flat) || [''])[0]);
    }

    // A column added is two numbers to keep in step: the header and every
    // colspan under it. Same check jobs.js carries, same reason — a
    // colspan one short shows only as a panel that stops before the edge
    // of the table.
    //
    // `<th` and not `<th>`: a heading that carries an attribute is still
    // a heading, and counting only the bare ones would undercount the
    // moment anybody adds one.
    // PER TABLE, because this file has more than one now. It counted
    // every `<th` in the source and demanded exactly five — true while
    // there was a single table, and it went red the moment "People you
    // have not added yet" arrived with four headings of its own. The
    // count was never the rule; the rule is that a colspan matches the
    // table it is in, and that generalises where a total does not.
    const tables = src.split('<table').slice(1);
    const wrong = [];
    tables.forEach(function (chunk, i) {
      const cols = (chunk.match(/<th[\s>]/g) || []).length;
      (chunk.match(/colspan="(\d+)"/g) || []).forEach(function (m) {
        const n = Number(/\d+/.exec(m)[0]);
        if (n !== cols) wrong.push('table ' + (i + 1) + ': colspan ' + n + ' of ' + cols);
      });
    });
    if (tables.length && !wrong.length) {
      test.check('and every colspan spans all of its own table’s columns (' + tables.length + ' tables)');
    } else {
      test.fail(wrong.length ? wrong.join('; ') : 'no table found in the source');
    }

    // ── ONE NAME, NOT TWO ────────────────────────────────────────────
    //
    //   Andy: "what is the 'Handle' column for? it has to go."
    //
    // Handle was their caption on a relay and Label was mine for them, and
    // every row showed both — so somebody with no private caption had a
    // name and then a blank, and somebody with one had their name twice.
    //
    // `caption` is the node's own answer (contactBook.labelForKey): mine if I
    // set one, theirs otherwise. Bert has been renamed, so his cell shows
    // MINE; carol has not, so hers shows HERS — one column, neither blank.
    if (rows.indexOf('<td class="label-cell">Bertie</td>') !== -1 &&
        rows.indexOf('<td class="label-cell">carol</td>') !== -1 &&
        rows.indexOf('<td class="label-cell">bert</td>') === -1) {
      test.check('one name column: mine for them where I chose one, theirs where I did not');
    } else {
      test.fail('name column: ' + rows);
    }

    // And no key endings on ordinary rows: you compared those down a
    // telephone while adding them and it is finished (Andy). The footer
    // still says where YOUR own ending is, which is a different job.
    if (rows.indexOf('…') === -1 && el(app, 'contacts-self').textContent.indexOf('XD+0c=') !== -1) {
      test.check('and no row wears a key ending, though the footer still tells you yours');
    } else {
      test.fail('endings in rows: ' + rows);
    }

    // ── AND HOW THEY GOT HERE IS NOT IN THE TABLE ────────────────────
    //
    //   Andy: "the how column can go, too."
    //
    // Provenance is a fact about the past that never changes and is read
    // once, if ever. It is on the contact's own screen, where somebody
    // asking "how did this row get here" is already standing — and a
    // column of it on every row is a column nobody reads twice.
    if (!/>handle</.test(rows) && !/>message</.test(rows)) {
      test.check('and no column of provenance \u2014 that lives on the contact\u2019s own screen');
    } else {
      test.fail('How survived: ' + rows);
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
    const reads = app.log.filter(function (c) { return /peer.list/.test(String(c.body || '')); }).length;
    el(app, 'contacts-tbody').fire('click', { target: target('data-contact-row', CAROL) });
    return settle().then(function () {
      const after = app.log.filter(function (c) { return /peer.list/.test(String(c.body || '')); }).length;
      if (after === reads) {
        test.check('and a dialog answering null costs the table nothing');
      } else {
        test.fail('re-read on an empty result: ' + reads + ' then ' + after);
      }
    });
  });
}

// FORGETTING SOMEBODY, WHICH IS NOT BLOCKING THEM.
//
//   Andy: "i also have no method of removing sonny from my contacts so i
//   could re-test easily."
//
// Driven against contactBook directly because that is where the rule lives and
// there is no relay in it: this is one node's own book.
function forgetsWithoutUnblocking() {
  test.subHeading('Forgetting somebody is not unblocking them');

  const os = require('os');
  const fs = require('fs');
  const path = require('path');
  const contactBook = require('../run/js/contacts');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-forget-'));

  contactBook.acquire(home, { publicKey: 'K1', publicLabel: 'sonny', relay: 'https://lab.example' }, 'handle');
  contactBook.setMyLabel(home, 'K1', 'my sonny');
  const gone = contactBook.forget(home, 'K1');

  if (gone && gone.forgotten && contactBook.byPublicKey(home, 'K1') === null) {
    test.check('an ordinary contact leaves the book entirely, myLabel and route with them');
  } else {
    test.fail('after forget: ' + JSON.stringify(contactBook.byPublicKey(home, 'K1')));
  }

  // THE CASE A PLAIN DELETE GETS WRONG, and the reason forget is not one
  // line. A blocked row IS the refusal — delete it and the next thing they
  // write is admitted by a node that has forgotten why it said no.
  contactBook.acquire(home, { publicKey: 'K2', publicLabel: 'nuisance' }, 'handle');
  contactBook.setBlocked(home, 'K2', true);
  contactBook.forget(home, 'K2');
  const after = contactBook.byPublicKey(home, 'K2');

  if (after && contactBook.isBlocked(after)) {
    test.check('a blocked person is downgraded, not deleted — the refusal survives');
  } else {
    test.fail('block evaporated: ' + JSON.stringify(after));
  }

  const stillListed = contactBook.contacts(home).some(function (r) { return r.publicKey === 'K2'; });
  if (!stillListed) {
    test.check('and they are no longer a contact, which is what was asked for');
  } else {
    test.fail('still in the book as a contact');
  }

  // FORGETTING SOMEBODY THIS NODE NEVER KNEW is not an error to swallow
  // quietly — the verb answers 404 so a caller can tell "gone" from
  // "never there".
  if (contactBook.forget(home, 'NEVER-HEARD-OF') === null) {
    test.check('and forgetting a stranger says so rather than pretending');
  } else {
    test.fail('forgot somebody who was not there');
  }

  return Promise.resolve();
}

// The other half of the deletion, and the half a test written around two
// berts would never see: a list of distinct names carries no key at all.
function distinctNamesCarryNoKey() {
  test.subHeading('And a list of distinct names shows no key at all');

  const app = mountApp({
    matches: [
      { publicKey: 'KEY-BERT', publicLabel: 'bert', tail: 'mjowM=', relay: 'https://a.example', acquiredVia: 'census', owner: false },
      { publicKey: 'KEY-CAROL', publicLabel: 'carol', tail: 'Zv0gX0=', relay: 'https://b.example', acquiredVia: 'census', owner: false },
    ],
  });

  return settle().then(function () {
    el(app, 'contacts-seen-q').value = 'r';
    el(app, 'contacts-seen-go').fire('click');
    return settle().then(function () {
      const out = el(app, 'contacts-seen-list').innerHTML;

      if (/bert/.test(out) && /carol/.test(out)) {
        test.check('both are listed by name');
      } else {
        test.fail('rows: ' + out);
      }

      if (out.indexOf('mjowM=') === -1 && out.indexOf('Zv0gX0=') === -1) {
        test.check('and neither carries an ending, because neither needs one');
      } else {
        test.fail('an ending appeared on an unambiguous row: ' + out);
      }

      // NOR THE SENTENCE ABOUT TELLING THEM APART. There is nothing to
      // tell apart, and a standing instruction for a problem you do not
      // have is a thing to read and dismiss (UI_DESIGN_STYLE §1).
      //
      // Two answers is still "more than one", so this fixture deliberately
      // keeps two rows: what is being asserted is that the ENDING goes and
      // the sentence stays, not that the sentence tracks the count.
      if (/data-key=/.test(out)) {
        test.check('and Add still carries the whole key it writes');
      } else {
        test.fail('rows are not keyed: ' + out);
      }
    });
  });
}

// ── AND WHETHER ANYBODY IS HOME ──────────────────────────────────────
//
//   Andy: "the search might need a filter argument (onlineOnly = true)…
//   discuss?" — and the discussion found the field already existed and
//   was being thrown away: the relay computes presence per row and the
//   ranker weighs it at a quarter of an exact match, while
//   hub.handleSearch dropped it before the browser saw it.
//
// No filter was built on it. Hiding absent people would answer "nobody
// found" for somebody whose laptop is shut, and acquiring a key has never
// required the person to be awake. What it buys instead is a dot — the
// same one the book above has always had.
function foundPeopleShowWhetherTheyAreHome() {
  test.subHeading('A found person carries whether anybody is home');

  const app = mountApp({
    matches: [
      // On a relay this node shares: its own presence table will answer.
      { publicKey: 'KEY-HERE', publicLabel: 'here', tail: 'aaa=', relay: 'https://a.example', acquiredVia: 'census', present: true },
      { publicKey: 'KEY-AWAY', publicLabel: 'away', tail: 'bbb=', relay: 'https://a.example', acquiredVia: 'census', present: false },
      // A PARTNER'S MEMBER. This node holds no stream to them, so its own
      // table never mentions the key — the answering relay's word is the
      // only answer there is.
      { publicKey: 'KEY-PARTNER', publicLabel: 'faraway', tail: 'ccc=', relay: 'https://b.example', acquiredVia: 'census', present: true, viaPartner: true },
    ],
  });

  return settle().then(function () {
    el(app, 'contacts-seen-q').value = 'a';
    el(app, 'contacts-seen-go').fire('click');

    return settle().then(settle).then(function () {
      const ICON = spirit.core.const.ICON;
      const before = el(app, 'contacts-seen-list').innerHTML;

      // NOTHING KNOWN YET, so the node's own table is silent and the
      // relay's word is what shows. White for the one it called absent —
      // never red, because this node has not checked and a red dot it
      // cannot stand behind is the lie that looks like information.
      if (before.indexOf(ICON.GREEN_CIRCLE) !== -1 && before.indexOf(ICON.RED_CIRCLE) === -1) {
        test.check('before any presence payload, the answering relay\’s word is what shows');
      } else {
        test.fail('marks: ' + before);
      }

      // ── AND THEN THIS NODE'S OWN TABLE ARRIVES ──────────────────────
      //
      // It wins wherever it has an opinion, because it is the same fact
      // `peer.post` uses to decide whether a packet can go — so it is
      // what predicts whether the bubble below will say anything.
      app.presence({ 'KEY-HERE': true, 'KEY-AWAY': false }, 'snapshot');

      return settle().then(function () {
        el(app, 'contacts-seen-go').fire('click');
        return settle().then(settle).then(function () {
          const out = el(app, 'contacts-seen-list').innerHTML;
          const rows = out.split('<tr>');

          const rowFor = function (name) {
            return rows.filter(function (r) { return r.indexOf('>' + name) !== -1; })[0] || '';
          };

          if (rowFor('here').indexOf(ICON.GREEN_CIRCLE) !== -1) {
            test.check('somebody this node can see is green');
          } else {
            test.fail('here: ' + rowFor('here'));
          }

          if (rowFor('away').indexOf(ICON.RED_CIRCLE) !== -1) {
            test.check('and somebody it can see is absent goes red, which only its own table may say');
          } else {
            test.fail('away: ' + rowFor('away'));
          }

          // THE CASE THE PASSTHROUGH EXISTS FOR. This node's table will
          // never mention a partner's member, so without the relay's word
          // this row could only ever be white — and white next to "could
          // not reach them" says nothing at all about whether the person
          // is there.
          if (rowFor('faraway').indexOf(ICON.GREEN_CIRCLE) !== -1) {
            test.check('and a partner\’s member is green on the answering relay\’s word, which this node could never supply');
          } else {
            test.fail('faraway: ' + rowFor('faraway'));
          }

          // NO FILTER. Every row is still listed — the dot is a fact on
          // the row, not a reason to drop it.
          if (/here/.test(out) && /away/.test(out) && /faraway/.test(out)) {
            test.check('and nobody is hidden for being absent, because adding somebody never needed them awake');
          } else {
            test.fail('a row went missing: ' + out);
          }
        });
      });
    });
  });
}

// ── EVERY PERSON FOUND IS ASKED WHO THEY ARE ─────────────────────────
//
//   Andy: "when a contact is found, there should be a bubble below with a
//   description obtained via a peerPost to the ID of the found peer."
//
// A search answers off a relay's census: a label and a key, which the
// relay was told and has no opinion about. Each row is then asked, and
// the answer is a different kind of fact — they wrote it, they are awake
// to say it, and the packet came back.
//
// NOT ON A CLICK, which is what this asserted first and was wrong about.
// The description is what replaced the key ending, and an ending was
// readable without doing anything to it; a fact you have to go hunting
// for row by row does not replace one that was simply on the page.
function aFoundPersonCanBeAsked() {
  test.subHeading('Everybody found is asked who they are, without being pressed');

  const app = mountApp({
    matches: [
      { publicKey: 'KEY-SONNY', publicLabel: 'sonny', tail: 'mjowM=', relay: 'https://a.example', acquiredVia: 'census', owner: false },
      { publicKey: 'KEY-GHOST', publicLabel: 'ghost', tail: 'Zv0gX0=', relay: 'https://b.example', acquiredVia: 'census', owner: false },
    ],
    cards: {
      'KEY-SONNY': { name: 'sonny', description: 'jazz, and a synth in the corner' },
      // KEY-GHOST answers nothing — their node is not reachable from here.
    },
  });

  return settle().then(function () {
    if (app.posts.length === 0) {
      test.check('nobody is asked anything before a search is run');
    } else {
      test.fail('posted before searching: ' + JSON.stringify(app.posts));
    }

    el(app, 'contacts-seen-q').value = 'o';
    el(app, 'contacts-seen-go').fire('click');

    return settle().then(settle).then(function () {
      // A SEARCH ASKS NOBODY (2026-09-21). It used to ask every row it
      // found, one request each, on every search — for a description most
      // rows never had read.
      //
      //   Andy: "Names are cheaper as by-product of search, Description
      //   can be deliberate... when a result-row is clicked a description
      //   bubble opens below it."
      //
      // The name is already on the row: `publicLabel` travels with the
      // search answer. What cost a packet was the description, and at one
      // request in flight per member (0016) a screenful of them is a
      // screenful of somebody's own turns, spent before they asked.
      if (app.posts.length === 0) {
        test.check('a search asks nobody — the names it needs came with the answer');
      } else {
        test.fail('a search still posted: ' + JSON.stringify(app.posts));
      }

      // AND A PRESS ASKS ONE PERSON. The row is a control again, which it
      // was until the sweep replaced it.
      function press(key) {
        el(app, 'contacts-seen-list').fire('click', {
          target: target('data-key', key, {
            className: 'contacts-seen-row',
            dataset: { key: key },
          }),
        });
      }
      press('KEY-SONNY');
      if (app.posts.length === 1 && app.posts[0].to === 'KEY-SONNY') {
        test.check('and pressing one row asks that person, and nobody else');
      } else {
        test.fail('after one press: ' + JSON.stringify(app.posts));
      }

      // PRESSED AGAIN IS NOT ASKED AGAIN, because the answer is already
      // on screen and a second turn would buy nothing.
      press('KEY-SONNY');
      if (app.posts.length === 1) {
        test.check('and pressing it again spends no second request');
      } else {
        test.fail('a second press posted again: ' + JSON.stringify(app.posts));
      }

      press('KEY-GHOST');
      const to = app.posts.map(function (p) { return p.to; }).sort();
      if (to.length === 2 && to[0] === 'KEY-GHOST' && to[1] === 'KEY-SONNY') {
        test.check('and each row asked is asked once');
      } else {
        test.fail('posts: ' + JSON.stringify(app.posts));
      }

      // THE SHAPE IS THE ASSERTION. packet.js omits an empty app id, and
      // js/nodeCard.js answers only a packet that carries none — a card is
      // a question about the node itself and belongs to no app on either
      // end. An app name here would meet the front door instead, which for
      // a stranger is silence.
      const one = app.posts[0] || {};
      if (one.app === '' && one.body && one.body.card === true) {
        test.check('with an app-less packet, which is the one a node answers about itself');
      } else {
        test.fail('wrong packet: ' + JSON.stringify(one));
      }

      return null;
    }).then(settle).then(settle).then(function () {
      const out = el(app, 'contacts-seen-list').innerHTML;

      // WHAT THEY SAID IS UNDER THEIR NAME, once they have been asked.
      // This read "with nothing pressed" while the sweep existed.
      if (/jazz, and a synth in the corner/.test(out)) {
        test.check('and what they said is under their name, once that row was pressed');
      } else {
        test.fail('no bubble: ' + out);
      }

      // ── THE ONE A CENSUS COULD NEVER ANSWER ─────────────────────────
      //
      //   Andy, earlier: "this would incidentally also validate true
      //   'reachability'."
      if (/could not reach them/.test(out)) {
        test.check('and somebody who does not answer is reported unreachable, which a census cannot tell you');
      } else {
        test.fail('ghost: ' + out);
      }

      // BOTH AT ONCE. There is nothing to choose between when every row
      // answers for itself, so the single-open rule went with the click.
      if (/jazz, and a synth/.test(out) && /could not reach them/.test(out)) {
        test.check('both answers at once — there is no row to open any more');
      } else {
        test.fail('only one answered: ' + out);
      }

      // ── ONE LINE EACH ───────────────────────────────────────────────
      //
      //   Andy: "i'd like the search results ... to be each only occupying
      //   one line. 1) colored status circle 2) label 3) Add Button, if
      //   applicable 4) description or error message."
      //
      // Two people, two rows. A row expansion stood here and made it four,
      // which put the widest thing on the page inside the narrowest box
      // and changed the page height under whoever was reading it.
      // COUNTED BY `<tr`, not by `<tr>`. The row carries a class and a
      // data-key since it became a control again (2026-09-21), so a
      // counter looking for the bare tag found none and reported that two
      // people had produced no rows at all.
      const bodyRows = (out.split('<tbody>')[1] || '').split('<tr').length - 1;
      if (bodyRows === 2) {
        test.check('two people, two rows — what they said shares the line with their name');
      } else {
        test.fail(bodyRows + ' rows for two people: ' + out);
      }

      if (out.indexOf('colspan') === -1) {
        test.check('and no row spans the table, which is what the expansion had to do');
      } else {
        test.fail('a spanning row survived: ' + out);
      }

      // ── AND A FAILURE DOES NOT READ AS A DESCRIPTION ────────────────
      //
      //   Andy: "error message must be visually different (preceded by
      //   ICON.WARNING and maybe a dark-red background)."
      //
      // Both are prose in the same cell, so the difference cannot be the
      // words: somebody scanning ten rows is looking for which ones they
      // can act on, and that has to be answerable without reading any of
      // them.
      const cells = out.split('<td');
      const said = cells.filter(function (c) { return c.indexOf('seen-said') !== -1; });
      const failed = said.filter(function (c) { return c.indexOf('is-error') !== -1; });

      if (said.length === 2 && failed.length === 1) {
        test.check('one cell each, and exactly one of them marked as a failure');
      } else {
        test.fail(said.length + ' said cells, ' + failed.length + ' failures: ' + out);
      }

      // AND EACH IS A BUBBLE, not bare text in a cell.
      //
      //   Andy: "hmmm the description text should still be in a bubble."
      //
      // The row expansion went and the bubble came with it, which was one
      // change too many — they were never the same thing. Asserted by
      // name so the next tidy-up cannot quietly take it again: a sentence
      // somebody wrote about themselves is a reading, and bare text in a
      // table cell reads as a fourth column of data.
      if (said.every(function (c) { return c.indexOf('said-bubble') !== -1; })) {
        test.check('and each sits in a bubble rather than bare in the cell');
      } else {
        test.fail('a said cell has no bubble: ' + said.join(' | '));
      }

      if (failed[0] && failed[0].indexOf(spirit.core.const.ICON.WARNING) !== -1) {
        test.check('the failure carries the warning mark');
      } else {
        test.fail('no mark on the failure: ' + (failed[0] || ''));
      }

      // AND THE ORDINARY CASE EARNS NO DECORATION. A mark on every row is
      // a mark on no row.
      const plain = said.filter(function (c) { return c.indexOf('is-error') === -1; })[0] || '';
      if (plain.indexOf(spirit.core.const.ICON.WARNING) === -1 && /jazz, and a synth/.test(plain)) {
        test.check('and a description carries none, so the mark still means something');
      } else {
        test.fail('the description is decorated too: ' + plain);
      }

      // AND NOTHING TO PRESS. A chevron promising an action that no longer
      // exists is worse than no chevron (UI_DESIGN_STYLE §1).
      if (out.indexOf('data-seen-row') === -1) {
        test.check('and the row is not a control, because there is nothing left to do to it');
      } else {
        test.fail('the row still offers to be opened: ' + out);
      }

      // ── ASKED ONCE ──────────────────────────────────────────────────
      const before = app.posts.length;
      el(app, 'contacts-seen-list').fire('click', { target: target('data-key', 'nothing') });

      return settle().then(function () {
        if (app.posts.length === before) {
          test.check('a repaint asks nobody again');
        } else {
          test.fail('asked again: ' + JSON.stringify(app.posts.slice(before)));
        }

        // ── ADD IS STILL ADD ──────────────────────────────────────────
        el(app, 'contacts-seen-list').fire('click', {
          target: target('data-key', 'KEY-SONNY', {
            className: 'cancel-btn contacts-seen-add',
            dataset: { key: 'KEY-SONNY', url: 'https://a.example' },
          }),
        });

        return settle().then(function () {
          const calls = posted(app, 'peer.acquire');
          if (calls.length === 1 && calls[0].publicKey === 'KEY-SONNY') {
            test.check('and pressing Add still adds that key and no other');
          } else {
            test.fail('acquire: ' + JSON.stringify(calls));
          }
        });
      });
    });
  });
}


// ── NO LOCK ANY MORE (2026-09-19) ────────────────────────────────────
//
// This asserted that somebody seated on a relay I own carried ICON.LOCKED
// in the column after the status dot, naming the relay on the hover. The
// seats were `memberOf`, written by a roster sweep, and no relay may return
// a roster (0012 widened, PAYLOAD_MAX) — Andy: "What is not found cannot
// influence decisions … contacts go stale. Deal with it." — and then:
// "kill the lock columns."
//
// What is asserted instead is the absence, including for a row older code
// left `memberOf` on: a stale field must draw nothing.
function aMemberSaysSoOnTheRow() {
  test.subHeading('No row carries a lock — seats are not a thing a contact knows');

  const app = mountApp({
    people: [
      { publicKey: 'KEY-CRUELLA', tail: 'lrjo=', publicLabel: 'Cruella',
        caption: 'Cruella', myLabel: '', acquiredVia: 'member',
        // Left by older code on a book written before 2026-09-19.
        memberOf: ['https://mine.example'],
        held: false, blocked: false, onRelay: true, bytesHeld: 0 },
      { publicKey: 'KEY-SONNY', tail: 'kEbk=', publicLabel: 'sonny',
        caption: 'sonny', myLabel: '', acquiredVia: 'handle',
        held: false, blocked: false, onRelay: false, bytesHeld: 0 },
    ],
  });

  return settle().then(function () {
    const out = el(app, 'contacts-tbody').innerHTML;
    const rowFor = function (name) {
      return out.split('<tr').filter(function (r) { return r.indexOf(name) !== -1; })[0] || '';
    };

    if (out.indexOf(spirit.core.const.ICON.LOCKED) === -1) {
      test.check('no row carries a lock, even one older code left memberOf on');
    } else {
      test.fail('a lock was drawn: ' + rowFor('Cruella'));
    }

    // Three cells a row: the status dot, the mark, the name — matching
    // the header's two glyph columns and one name.
    const cells = rowFor('Cruella').split('<td').length - 1;
    if (cells === 3 && !/hold a seat/.test(out)) {
      test.check('three cells a row, and no seat is named anywhere');
    } else {
      test.fail('cells=' + cells + ' row: ' + rowFor('Cruella'));
    }

    // The table still says nothing about provenance (Andy: "the how column
    // can go, too"): that is the contact's own screen's.
    if (rowFor('Cruella').indexOf('>member<') === -1 && /sonny/.test(rowFor('sonny'))) {
      test.check('and the table says nothing more about the relationship — the screen does');
    } else {
      test.fail('provenance in the table: ' + rowFor('Cruella'));
    }
  });
}

function addsByHandle() {
  test.subHeading('Adding somebody is still a phone call');

  // THE PANEL MOVED, THE RULE DID NOT. This drove "Add someone by handle",
  // which asked `peer.find` and is gone —
  //
  //   Andy: "this new item should be integrated in: Find someone by
  //   handle. The user shouldn't worry about relays, they just want to
  //   find somebody."
  //
  // What it asserted is a product rule and not a panel: a label is not an
  // identity (R1), so two people can carry one name, and the ENDING is how
  // a person tells them apart. That has to keep holding wherever adding
  // happens, so the test follows it rather than going with the box.
  const app = mountApp({
    matches: [
      { publicKey: 'KEY-BERT-ONE', publicLabel: 'bert', tail: 'mjowM=', relay: 'https://a.example', acquiredVia: 'census', owner: false },
      { publicKey: 'KEY-BERT-TWO', publicLabel: 'bert', tail: 'Zv0gX0=', relay: 'https://b.example', acquiredVia: 'census', owner: false },
    ],
  });

  return settle().then(function () {
    el(app, 'contacts-seen-q').value = 'bert';
    el(app, 'contacts-seen-go').fire('click');
    return settle().then(function () {
      const out = el(app, 'contacts-seen-list').innerHTML;
      // COUNTED BY THE BUTTON'S OWN CLASS. This counted `data-key=`,
      // which was unique to the Add button until the row became a control
      // again and took one as well (2026-09-21) — so two people read as
      // four. A count of a proxy is a count of whatever else starts
      // wearing it.
      const adds = out.split('contacts-seen-add').length - 1;
      if (adds === 2 && /mjowM=/.test(out) && /Zv0gX0=/.test(out)) {
        test.check('every key behind the word is listed, by its ending');
      } else {
        test.fail('matches: ' + out);
      }

      // ── IN NO COLUMN, THOUGH ─────────────────────────────────────
      //
      //   Andy: "get rid of the keys column (that stuff has to go
      //   everywhere)" — and, asked about this last one: "word."
      //
      // This was the final place in the shell with a key ending in a
      // column of its own, and the one that had an argument for keeping
      // it: picking the right key IS the decision here. What answers that
      // now is opening the row — the node says who it is in its own
      // words, which is the thing an ending was ever standing in for.
      if (out.indexOf('<th>Key ends</th>') === -1) {
        test.check('and no Key ends column — the last one in the shell is gone');
      } else {
        test.fail('the column is still here: ' + out);
      }

      // THE ENDING RIDES THE NAME, on the rows that collide, because a
      // node that will not answer leaves two identical rows and Add
      // writes one of them.
      if (/bert <span class="muted"[^>]*>…mjowM=<\/span>/.test(out)) {
        test.check('it rides beside the name instead, on the rows that need it');
      } else {
        test.fail('ending is not on the label: ' + out);
      }

      // AND THE SENTENCE POINTS AT THE NEW ANSWER FIRST, keeping the old
      // one as the fallback it now is. "Open a row" stood here until the
      // bubbles stopped needing to be opened; the sentence follows the
      // gesture, or it is a set of instructions for a screen that no
      // longer exists.
      // THE INSTRUCTION NAMES WHAT TO DO, where it used to name what the
      // page had already done for you. Copy that describes a thing the
      // code stopped doing is worse than none: it sends somebody looking
      // for an answer that is not coming.
      if (/Press a row/.test(out) && /ends with/.test(out) && /fine print/.test(out)) {
        test.check('and the instruction says to press a row, with the key ending as the fallback');
      } else {
        test.fail('instruction: ' + out);
      }

      // AND THE RELAY IS NOT A COLUMN. Andy: "The user shouldn't worry
      // about relays." It rides on the row as data-url, because the
      // confirm is checked against that census and the contact keeps it as
      // a route — but nobody reads it.
      // NOT IN A CELL, but present as an attribute. A first draft asked
      // for the URL to be absent AND present, which no render can satisfy:
      // what "shown to nobody" means is that it is not TEXT, not that the
      // bytes are missing.
      const cells = (out.match(/<td>([^<]*)<\/td>/g) || []).join(' ');
      if (cells.indexOf('a.example') === -1 && /data-url="https:\/\/a\.example"/.test(out)) {
        test.check('the relay is carried for the node and shown in no cell');
      } else {
        test.fail('relay leaked into a cell, or the route was dropped: ' + cells);
      }

      el(app, 'contacts-seen-list').fire('click', {
        target: target('data-key', 'KEY-BERT-ONE', {
          className: 'cancel-btn contacts-seen-add',
          dataset: { key: 'KEY-BERT-ONE', url: 'https://a.example' },
        }),
      });
      return settle().then(function () {
        const calls = posted(app, 'peer.acquire');
        if (calls.length === 1 && calls[0].publicKey === 'KEY-BERT-ONE') {
          test.check('and confirming one writes that key and no other');
        } else {
          test.fail('contact calls: ' + JSON.stringify(calls));
        }

        // THE BUG THE MERGE FIXED. The old Confirm sent a key and no url,
        // so peer.acquire fell back to `urls[0]` — the first relay in the
        // file, whatever the question — and somebody found on a second
        // relay, or on a partner's, could not be confirmed by the panel
        // built for confirming.
        if (calls[0] && calls[0].url === 'https://a.example') {
          test.check('against the relay the row came from, not whichever is first in the file');
        } else {
          test.fail('no route on the acquire: ' + JSON.stringify(calls[0]));
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

  // THE PROPERTY, NOT THE COUNT. This demanded exactly two folds, which
  // was the number there happened to be — and a third ("People you have
  // not added yet") is not a violation of anything, it is another fold in
  // the same group. What must hold is that EVERY fold is named and named
  // the same, because that is what makes the browser close the others.
  const oneGroup = folds >= 2 && named.length === folds &&
    named.every(function (n) { return n === named[0]; });
  if (oneGroup) {
    test.check('all ' + folds + ' folds are in one exclusive group, so opening one closes the rest');
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
  // and is reached through `contact.senders`.
  //
  // What that leaves is an app that draws and asks, and stores nothing at
  // all. contactBook is still the book; now nothing here is.
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
      { publicKey: JOHN_A, publicLabel: 'john', caption: 'john', myLabel: '', tail: 'aaajoh=', ambiguous: true, acquiredVia: 'message', held: false, blocked: false },
      { publicKey: JOHN_B, publicLabel: 'john', caption: 'john', myLabel: '', tail: 'bbbjoh=', ambiguous: true, acquiredVia: 'message', held: false, blocked: false },
      // And somebody who never claimed a handle at all: the cell would
      // otherwise be empty, which names nobody rather than everybody.
      { publicKey: CAROL, publicLabel: '', caption: CAROL, myLabel: '', tail: 'lcaro=', acquiredVia: 'message', held: false, blocked: false },
    ],
  });

  return settle().then(function () {
    const rows = el(app, 'contacts-tbody').innerHTML;
    // The ending is muted now: it is the disambiguator, not part of the
    // name, and in one column with no Handle beside it the eye needs the
    // two told apart.
    if (/john <span class="muted">…aaajoh=<\/span>/.test(rows) &&
        /john <span class="muted">…bbbjoh=<\/span>/.test(rows)) {
      test.check('two people behind one word are told apart by the end of the key');
    } else {
      test.fail('ambiguous rows: ' + rows);
    }

    // `caption` falls back to the whole key for somebody who claimed no
    // handle, so the cell shows the ENDING rather than 44 characters —
    // and it is muted, like every other ending.
    if (/<td class="label-cell">[^<]*<span class="muted">…lcaro=<\/span><\/td>/.test(rows) ||
        /<td class="label-cell"><span class="muted">\(no name\)<\/span><\/td>/.test(rows)) {
      test.check('and a contact who never claimed a handle is not a blank cell');
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
// The column is the one place presence and contactBook meet: presence
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
    // `icon-cell` since the glyph columns were given a fixed width, so
    // the attribute is no longer the first thing on the cell.
    const titled = /<td class="icon-cell" title="([^"]*)">/.exec(rows());
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
  .then(forgetsWithoutUnblocking).then(aMemberSaysSoOnTheRow).then(addsByHandle).then(distinctNamesCarryNoKey).then(aFoundPersonCanBeAsked).then(foundPeopleShowWhetherTheyAreHome)
  .then(strangerPolicy)
  .then(foldsObeyTheSpacingRules)
  .then(sendsNothing)
  .then(theDotColumn)
  .then(function () { test.reportSuccessFailureCount(); })
  .catch(function (err) {
    test.fail('contacts threw: ' + ((err && err.stack) || err));
    test.reportSuccessFailureCount();
  });
