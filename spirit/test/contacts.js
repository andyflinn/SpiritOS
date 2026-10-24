'use strict';

// The address book, now that it has its own window (packet 2).
//
// contactBook is still the store and the hub still owns every verb — what
// moved out of Relay Chat is the view, and with it the decisions a person
// can make about a key: add it, accept somebody waiting, block or unblock,
// and say what YOU call them.
//
// SINCE goal/G30.19 CONTACTS IS ONE LIST. The contactSelector pane and the
// Find-someone fold (peerFind) are deleted: the book, the shadow, the
// network and this node's relays are one shell element,
// shell/js/contacts/listElement.js, on the standard list tool
// (shell/js/probabilitySearch.js), each row a contactElement
// (shell/js/contacts/rowElement.js) that paints its own dot from the
// relay-presence job. Contacts paints no presence of its own any more.
//
// Driven the way chatSession drives the chat app: the scripts index.html
// loads for the list, then contacts.js, into a small stand-in page with
// document/api/fetch stubs, and their real handlers are fired, so
// "pressing Add asks peer.acquire" is a test rather than a screenshot.
// rule/11: through testSupport only.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');
const spirit = require('../run/spirit/kernel.js');
const hubModule = require('../run/spirit/hub.js');
const auth = require('../run/spirit/relayAuth');

const RUN_DIR = path.join(__dirname, '..', 'run');
const APP_SCRIPT = path.join(RUN_DIR, 'shell', 'contacts', 'contacts.js');
const ICONS = spirit.core.const.ICON;

const BERT = 'MCowBQYDK2VwAyEAbertbertbertbertbertbertbertbertbertb=';
const CAROL = 'MCowBQYDK2VwAyEAcarolcarolcarolcarolcarolcarolcaro=';
const DAVE = 'MCowBQYDK2VwAyEAdavedavedavedavedavedavedavedavedave=';
// Two keys behind one handle — the case a handle alone cannot answer.
// Same SPKI header as every other key, which is why what tells them
// apart comes off the END.
const JOHN_A = 'MCowBQYDK2VwAyEAjohnjohnjohnjohnjohnjohnjohnaaajoh=';
const JOHN_B = 'MCowBQYDK2VwAyEAjohnjohnjohnjohnjohnjohnjohnbbbjoh=';

// ── THE STAND-IN PAGE ────────────────────────────────────────────────
//
// Small on purpose: an element keeps its innerHTML, its listeners and
// its attributes, and answers the few selectors the list tool asks. When
// a table is written into it, its rows become elements of their own
// (tr[data-key], each td[data-field]), because that is where a
// contactElement paints — the cell, not the string the list wrote.
function fakeElement(id, attrs) {
  let html = '';
  const attributes = Object.assign({}, attrs || {});
  let rows = {};
  const el = {
    id: id || '',
    value: '',
    textContent: '',
    style: {},
    dataset: {},
    listeners: {},
    hidden: false,
    className: '',
    scrollTop: 0,
    addEventListener: function (event, fn) { (el.listeners[event] = el.listeners[event] || []).push(fn); },
    fire: function (event, arg) { (el.listeners[event] || []).slice().forEach(function (fn) { fn(arg || {}); }); },
    dispatchEvent: function (event) { el.fire(event.type, event); return true; },
    getAttribute: function (name) { return Object.prototype.hasOwnProperty.call(attributes, name) ? attributes[name] : null; },
    focus: function () {},
    closest: function (selector) { return selector === '[data-key]' && attributes['data-key'] != null ? el : null; },
    // '#id' is left to document.getElementById (the list tool falls back to it); a row by its key is the table's.
    querySelector: function (selector) {
      const m = /^tr\[data-key="([^"]*)"\]$/.exec(selector);
      return m && rows[m[1]] ? rows[m[1]] : null;
    },
    querySelectorAll: function (selector) {
      if (selector === 'td[data-field]') return el.cells || [];
      return [];
    },
    rows: function () { return rows; },
  };
  Object.defineProperty(el, 'innerHTML', {
    get: function () { return html; },
    set: function (v) {
      html = String(v);
      rows = {};
      const trs = /<tr data-key="([^"]*)"[^>]*>([\s\S]*?)<\/tr>/g;
      let t;
      while ((t = trs.exec(html))) {
        const tr = fakeElement('', { 'data-key': t[1] });
        tr.cells = [];
        const tds = /<td data-field="([^"]*)"[^>]*>([\s\S]*?)<\/td>/g;
        let d;
        while ((d = tds.exec(t[2]))) {
          const td = fakeElement('', { 'data-field': d[1] });
          td.innerHTML = d[2];
          td.parentRow = tr;
          tr.cells.push(td);
        }
        rows[t[1]] = tr;
      }
    },
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
    createElement: function () { return fakeElement(''); },
  };
}

// THE LIST AS THE SHELL GIVES IT (goal/G30.19): the scripts index.html loads for it, in its order, onto the page's
// window. spirit is the page's, so contactElement finds its icons and its one stream subscription there. No module and
// no process, as in a page: fieldRules.js takes its node branch on process.
const PAGE_SCRIPTS = [
  'spirit/probabilityBucket.js', 'spirit/probabilityStringMatch.js', 'spirit/probabilityStringObjectMatch.js', 'spirit/fieldRules.js',
  'shell/js/spiritData.js', 'shell/js/contacts/data.js', 'shell/js/rowElement.js', 'shell/js/contacts/rowElement.js', 'shell/js/probabilitySearch.js', 'shell/js/contacts/listElement.js',
];
function loadPage(doc, shellSpirit) {
  const win = { spirit: shellSpirit };
  PAGE_SCRIPTS.forEach(function (rel) {
    new Function('spirit', 'document', 'window', 'module', 'process', fs.readFileSync(path.join(RUN_DIR, rel), 'utf8'))(shellSpirit, doc, win, undefined, undefined);
  });
  return win;
}

// ── READING THE LIST ─────────────────────────────────────────────────
// The list tool's ids carry a prefix of its own (probsearch-N-); it is read off what it wrote into the host.
function listPre(app) { return (/id="(probsearch-\d+-)text"/.exec(el(app, 'contacts-book').innerHTML) || [])[1] || ''; }
function listEl(app) { return app.doc.getElementById(listPre(app) + 'list'); }
function rowKeys(app) { return Object.keys(listEl(app).rows()); }
function rowOf(app, key) { return listEl(app).rows()[key] || null; }
// One cell as its contactElement painted it: presence, status, label or add.
function cell(app, key, field) {
  const tr = rowOf(app, key);
  const td = tr && tr.cells.filter(function (c) { return c.getAttribute('data-field') === field; })[0];
  // The cell's text: the dot rides in a span whose title names its state (asserted in presenceProof).
  if (!td) return '(no row)';
  return field === 'presence' ? td.innerHTML.replace(/<[^>]*>/g, '') : td.innerHTML;
}
function fields(app, key) { const tr = rowOf(app, key); return tr ? tr.cells.map(function (c) { return c.getAttribute('data-field'); }).join(',') : ''; }
function allCells(app) {
  return rowKeys(app).map(function (k) { return rowOf(app, k).cells.map(function (c) { return c.innerHTML; }).join('|'); }).join('\n');
}
// A press on a row, as the list hears it: a click on the host, landing inside <tr data-key>.
function press(app, key) {
  const tr = rowOf(app, key);
  el(app, 'contacts-book').fire('click', { target: { id: '', getAttribute: function () { return null; },
    closest: function (s) { return s === '[data-key]' ? tr : null; } } });
}
// A press on a row's own button (its data-action), which is the row element's and not a row press.
function pressAction(app, key, action) {
  const tr = rowOf(app, key);
  const button = { id: '', getAttribute: function (n) { return n === 'data-action' ? action : null; },
    closest: function (s) { return s === '[data-action]' ? button : s === '[data-key]' ? tr : null; } };
  el(app, 'contacts-book').fire('click', { target: button });
}
function pressFilter(app, name, value) {
  el(app, 'contacts-book').fire('click', { target: { id: '', closest: function () { return null; },
    getAttribute: function (n) { return n === 'data-filter' ? name : n === 'data-value' ? value : null; } } });
}
// Words typed into the list's field, as a person types them.
function type(app, words) {
  app.doc.getElementById(listPre(app) + 'text').value = words;
  el(app, 'contacts-book').fire('input', { target: { id: listPre(app) + 'text' } });
}

// ── WHAT THE NETWORK FINDS, FROM THE NODE ITSELF ─────────────────────
//
// A network row reaches the page as one update of the 'peer-search' job. Its label is the node's (hub.contactSearch's
// walk, strangerLabel), so a real hub on a scratch home is walked here and the updates it wrote are what the page gets:
// this suite never invents a row shape the node does not send.
function networkRows(found) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-contacts-'));
  auth.saveIdentity(home, auth.generateIdentity('owner'));
  const hub = hubModule.createHub(home);
  const items = [];
  let n = 0;
  const jobs = {
    createJob: function (kind, type) { return { id: 'job_' + (++n), kind: kind, type: type, data: {} }; },
    updateJob: function (id, patch) { if (patch && patch.data && patch.data.item) items.push(patch.data.item); return null; },
    listJobs: function () { return []; },
  };
  hub.contactSearch({ q: 'x' }, { jobs: jobs, walk: function (q, onRow) {
    found.forEach(function (row) {
      onRow(Object.assign({ atKey: auth.generateIdentity('relay').publicKey, viaPartner: false }, row));
    });
    return Promise.resolve();
  } });
  try { fs.rmSync(home, { recursive: true, force: true }); } catch (e) { /* leave it */ }
  return items;
}

function mountApp(options) {
  const doc = fakeDocument();
  let networkShown = false;
  const log = [];
  const opts = options || {};

  function answer(status, obj) {
    const t = JSON.stringify(obj);
    return Promise.resolve({
      status: status,
      text: function () { return Promise.resolve(t); },
      json: function () { return Promise.resolve(JSON.parse(t)); },
    });
  }

  const fakeFetch = function (url, init) {
    log.push({ url: url, method: (init && init.method) || 'GET', body: init && init.body });
    let verb = '';
    let sent = {};
    try { sent = JSON.parse(String((init && init.body) || '{}')); verb = sent.verb || ''; }
    catch (e) { verb = ''; }

    // THE NODE HOLDS THE STRANGER POLICY, so the fake holds it too:
    // `contact.senders` answers what is set and `contact.setSenders`
    // changes it. A stub that answered a fixture forever would let a
    // panel that never repaints pass.
    if (verb === 'contact.senders' || verb === 'contact.setSenders') {
      if (verb === 'contact.setSenders') {
        if (opts.policyRefuses) return answer(400, { ok: false, error: 'refused' });
        opts.policy = sent.policy;
      }
      if (opts.deaf) return Promise.reject(new Error('no answer'));
      return answer(200, { ok: true, policy: opts.policy || 'silent' });
    }
    // THE BOOK IS SEARCHED (puppets/G2, goal/G30.19): contact.search,
    // answered by the node's own label and search (hub.searchPeople), so
    // this fake says exactly what the node would. Its network tier
    // streams as the job (networkRows), not in this answer.
    if (verb === 'contact.search') {
      const r = hubModule.searchPeople(opts.people || [], sent.q, sent);
      return answer(200, { ok: true, items: r.items, more: r.more, selfTail: opts.selfTail || null });
    }
    if (verb === 'contact.get') {
      const person = (opts.people || []).filter(function (p) { return p.publicKey === sent.key; })[0];
      return answer(person ? 200 : 404, person ? { ok: true, key: sent.key, person: person } : { ok: false, error: 'not in the book' });
    }
    // This node's relays, beside the book (goal/G30.7): one { key: url, label } each.
    if (verb === 'relay.search') {
      return answer(200, { ok: true, items: (opts.relays || []).map(function (r) {
        return { key: r.url, label: JSON.stringify({ name: r.name, owned: r.owned === true, relayKey: r.relayKey || '' }) };
      }), more: false });
    }
    if (verb === 'peer.acquire') return answer(opts.acquireStatus || 201, { ok: true, publicKey: sent.publicKey, publicLabel: sent.publicLabel || '' });
    return answer(200, { ok: true });
  };

  const posts = [];
  const jobFeed = [];
  let behavior = null;
  const shellSpirit = {
    shell: { activateApp: function (b) { behavior = b; } },
    core: {
      // The browser's one mouth onto the node (AGENT.md, Comms). The row
      // elements' actions ask here; kernel.js supplies it in a real page.
      ask: test.browserAsk(fakeFetch),
      util: { escapeHtml: spirit.core.util.escapeHtml, formatBytes: spirit.core.util.formatBytes },
      const: { ICON: ICONS },
      // The channel presence and the network search arrive on. Captured
      // rather than faked away, so a test can push a payload and read the
      // dot that comes out.
      jobs: { subscribe: function (handlers) { jobFeed.push(handlers || {}); return function () {}; } },
    },
  };
  test.spiritFor(shellSpirit.core.ask, shellSpirit);

  const win = loadPage(doc, shellSpirit);
  new Function('spirit', 'document', 'window', 'fetch', fs.readFileSync(APP_SCRIPT, 'utf8'))(shellSpirit, doc, win, fakeFetch);

  const container = fakeElement('container');
  const launched = [];
  const called = [];
  // What the dialog will answer. The shell settles the promise when the
  // screen leaves the stack; here the test says what it decided.
  let dialogAnswer = opts.dialogResult === undefined ? null : opts.dialogResult;
  const api = {
    verb: function (name, args) { return shellSpirit.core.ask(name, args); },
    escapeHtml: spirit.core.util.escapeHtml,
    launchApp: function (id, params, options) { launched.push({ id: id, params: params, options: options }); },
    // Recorded rather than dropped: opening a row IS a call, and which
    // dialog it names with which params is the whole of what the press
    // decides.
    callDialog: function (id, params) { called.push({ id: id, params: params }); return Promise.resolve(dialogAnswer); },
    // ASKING A PERSON WHO THEY ARE. Recorded whole, because its SHAPE is
    // asserted: an empty app id, so js/nodeCard.js answers it. Answered
    // in `card`, the node's checked fields (cycle 10, R3), never a raw body.
    peerPost: function (packetApp, toKey, body) {
      posts.push({ app: packetApp, to: toKey, body: body });
      const card = (opts.cards || {})[toKey];
      if (!card) return Promise.resolve({ ok: false, status: 503, body: null, error: 'that peer is not reachable right now' });
      return Promise.resolve({ ok: true, status: 200, card: { ok: true, name: card.name || '', description: card.description || '' } });
    },
  };
  behavior.mount(container, api, null);
  return {
    doc: doc, log: log, container: container, launched: launched, called: called, posts: posts,
    answers: function (result) { dialogAnswer = result; },
    // A SECOND MOUNT OF THE SAME LOADED SCRIPTS, which is what walking
    // into an app twice actually is.
    remount: function () { behavior.mount(container, api, null); },
    subscriptions: function () { return jobFeed.length; },
    // A presence payload the way the shell delivers it: a proof per key, {present, at} (goal/G2.9).
    presence: function (said, how) {
      const table = {};
      Object.keys(said).forEach(function (key) { table[key] = { present: said[key] === true, at: Date.now() }; });
      const job = { id: 'j1', type: 'relay-presence', data: { presence: table } };
      jobFeed.forEach(function (h) {
        if (how === 'snapshot') { if (h.onSnapshot) h.onSnapshot([job]); }
        else if (h.onUpdate) h.onUpdate(job);
      });
    },
    // The network search's rows, one 'peer-search' update each, as the face stream carries them.
    // The network toggle is off until pressed (box v8), so the first rows found press it on: these sections are about
    // the found rows, and contactSearchTiers asserts the toggle itself.
    found: function (items) {
      if (!networkShown) {
        networkShown = true;
        doc.getElementById('contacts-book').fire('click', { target: { id: '', closest: function () { return null; },
          getAttribute: function (n) { return n === 'data-filter' ? 'network' : n === 'data-value' ? 'toggle' : null; } } });
      }
      items.forEach(function (item) {
        jobFeed.forEach(function (h) { if (h.onUpdate) h.onUpdate({ id: 'j3', type: 'peer-search', data: { item: item } }); });
      });
    },
    // Something else on the same channel, which must change nothing.
    otherJob: function () {
      jobFeed.forEach(function (h) { if (h.onUpdate) h.onUpdate({ id: 'j2', type: 'server-stats', data: { cpu: 3 } }); });
    },
  };
}

function el(app, id) { return app.doc.getElementById(id); }

function settle() {
  let p = Promise.resolve();
  for (let i = 0; i < 4; i += 1) p = p.then(function () { return new Promise(function (r) { setImmediate(r); }); });
  return p;
}

// WHAT WAS SENT, BY VERB: every loopback call goes to one URL.
function posted(app, prefix) {
  return app.log
    .map(function (c) { try { return JSON.parse(c.body); } catch (e) { return null; } })
    .filter(function (b) { return b && String(b.verb || '').indexOf(prefix) === 0; });
}

test.startTest('Contacts — the address book, in its own window, on the one list');

// The last piece of packet 2 to move (Andy). It asks what to do about
// somebody who is not in the address book, which is a question about the
// address book — beside a chat thread it read as a setting about chat.
function strangerPolicy() {
  test.subHeading('What to do about people you have not added');

  const app = mountApp({});

  return settle().then(function () {
    const choices = el(app, 'contacts-unknown-choices').innerHTML;

    // Three answers: a node that says nothing reads as silent, the
    // tightest setting that still lets two people who added each other
    // talk.
    if (/value="silent"[^>]*checked/.test(choices) &&
        /value="hold"/.test(choices) && /value="acquire"/.test(choices)) {
      test.check('three choices, and a node with no file kept is silent');
    } else {
      test.fail('choices: ' + choices);
    }

    // What each says is what happens to the BOOK (packet 4).
    if (/Ignore/.test(choices) && /List them/.test(choices) && /Add them/.test(choices) &&
        /No row\./.test(choices) && /A waiting row/.test(choices) && /they get a row/.test(choices)) {
      test.check('and each says in a sentence what it does to the book');
    } else {
      test.fail('choice copy: ' + choices);
    }

    if (choices.indexOf('refuse') === -1 && choices.toLowerCase().indexOf('sound') === -1) {
      test.check('no Refuse, no sound toggle');
    } else {
      test.fail('unbuilt controls were drawn: ' + choices);
    }

    // No count of who is waiting: under Hold they are rows in the list.
    if (app.container.innerHTML.indexOf('hold-line') === -1) {
      test.check('and no tally of who is waiting — they are rows in the list');
    } else {
      test.fail('a hold count came across with the panel');
    }

    // CHOOSING IS ASKED FOR, NOT WRITTEN: the node holds the value.
    el(app, 'contacts-unknown-choices').fire('change', { target: { value: 'acquire' } });
    return settle().then(function () {
      const sent = posted(app, 'contact.setSenders');
      if (sent.length === 1 && sent[0].policy === 'acquire') {
        test.check('a choice is POSTed to the node, which is what holds it');
      } else {
        test.fail('posts: ' + JSON.stringify(sent));
      }

      if (el(app, 'contacts-unknown-summary').textContent ===
          'People who write and are not in this book — Add them') {
        test.check('and the heading carries the answer, so the fold reads closed');
      } else {
        test.fail('summary: ' + el(app, 'contacts-unknown-summary').textContent);
      }

      const back = mountApp({ policy: 'hold' });
      return settle().then(function () {
        if (/value="hold"[^>]*checked/.test(el(back, 'contacts-unknown-choices').innerHTML)) {
          test.check('and what the node holds is what comes back checked');
        } else {
          test.fail('restored: ' + el(back, 'contacts-unknown-choices').innerHTML);
        }

        const bogus = mountApp({ policy: 'whatever' });
        return settle().then(function () {
          if (/value="silent"[^>]*checked/.test(el(bogus, 'contacts-unknown-choices').innerHTML)) {
            test.check('a value nobody offered degrades to silent');
          } else {
            test.fail('bogus: ' + el(bogus, 'contacts-unknown-choices').innerHTML);
          }

          // A NODE THAT WILL NOT ANSWER reads as the tightest setting.
          const mute = mountApp({ policy: 'acquire', deaf: true });
          return settle().then(function () {
            const drawn = el(mute, 'contacts-unknown-choices').innerHTML;
            if (/value="silent"[^>]*checked/.test(drawn)) {
              test.check('and a node that does not answer reads as silent, never as the last thing seen');
            } else {
              test.fail('deaf node: ' + drawn);
            }

            // A REFUSED CHANGE MUST NOT SHOW AS MADE: the repaint is from
            // the answer, not from the click.
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
  test.subHeading('Everyone this node has a row for, on the one list');

  const app = mountApp({
    selfTail: 'XD+0c=',
    people: [
      // Bert has been renamed, so his name and his own handle differ and
      // the cell cannot pass by showing either.
      { publicKey: BERT, publicLabel: 'bert', caption: 'Bertie', myLabel: 'Bertie', tail: 'bertb=', acquiredVia: 'handle', held: false, blocked: false },
      { publicKey: CAROL, publicLabel: 'carol', caption: 'carol', myLabel: '', acquiredVia: 'hold', held: true, blocked: false },
      { publicKey: DAVE, publicLabel: 'dave', caption: 'dave', myLabel: '', tail: 'edave=', acquiredVia: 'message', held: true, blocked: true },
    ],
  });

  return settle().then(function () {
    const keys = rowKeys(app);
    if ([BERT, CAROL, DAVE].every(function (k) { return keys.indexOf(k) !== -1; }) && posted(app, 'contact.search').length >= 1) {
      test.check('contacts, somebody waiting and somebody refused are all listed, from contact.search as soon as it is drawn');
    } else {
      test.fail('rows: ' + JSON.stringify(keys) + ', contact.search asked ' + posted(app, 'contact.search').length);
    }

    // Refused wears the plain no, waiting the hourglass, in the status
    // cell of their own; dave is held AND blocked, and blocked shows.
    if (cell(app, DAVE, 'status') === ICONS.NO && cell(app, CAROL, 'status') === ICONS.WAITING && cell(app, BERT, 'status') === '' &&
        allCells(app).indexOf(ICONS.ROLODEX) === -1 && !/— blocked|— waiting/.test(allCells(app))) {
      test.check('and refused wears the plain no here, waiting the hourglass, in a cell of their own');
    } else {
      test.fail('marks: ' + allCells(app));
    }

    // Four cells a row, the list's columns: the dot, the mark, one name, and Add (empty on a book row).
    const shapes = [BERT, CAROL, DAVE].map(function (k) { return fields(app, k); });
    if (shapes.every(function (s) { return s === 'presence,status,label,add'; }) &&
        [BERT, CAROL, DAVE].every(function (k) { return cell(app, k, 'add') === ''; })) {
      test.check('every row is the dot, the mark, one name and an Add cell, empty for somebody already in the book');
    } else {
      test.fail('row shapes: ' + JSON.stringify(shapes) + ' add cells: ' + [BERT, CAROL, DAVE].map(function (k) { return cell(app, k, 'add'); }).join('|'));
    }

    // NO TABLE OF ITS OWN: the list draws it.
    const src = fs.readFileSync(APP_SCRIPT, 'utf8').replace(/^\s*\/\/.*$/gm, '');
    if (src.indexOf('<table') === -1) {
      test.check('and the app draws no table of its own — the one list does');
    } else {
      test.fail('contacts.js still writes a table');
    }

    // ONE NAME, NOT TWO (Andy: "what is the 'Handle' column for? it has
    // to go."): the node's label, mine for them if I chose one, theirs
    // otherwise.
    if (cell(app, BERT, 'label') === 'Bertie' && cell(app, CAROL, 'label') === 'carol') {
      test.check('one name column: mine for them where I chose one, theirs where I did not');
    } else {
      test.fail('name cells: bert ' + cell(app, BERT, 'label') + ', carol ' + cell(app, CAROL, 'label'));
    }

    // And no key endings anywhere, the footer's "your key ends …" included (Andy, 2026-10-24, goal/G40.1: "we don't
    // show the fucking tail anywhere anymore.").
    if (allCells(app).indexOf('…') === -1 && !String(el(app, 'contacts-self').textContent || '')) {
      test.check('and no row wears a key ending, and no footer tells you yours');
    } else {
      test.fail('endings in rows: ' + allCells(app) + ' | self: ' + el(app, 'contacts-self').textContent);
    }

    // AND HOW THEY GOT HERE IS NOT ON THE ROW (Andy: "the how column can
    // go, too."): that is the contact's own screen's.
    if (!/(^|\|)(handle|message|hold)(\||$)/m.test(allCells(app))) {
      test.check('and no column of provenance — that lives on the contact’s own screen');
    } else {
      test.fail('How survived: ' + allCells(app));
    }
  });
}

// The panel that stood here is a screen of its own (shell/contactsDetails),
// and so are its tests. What stays here is the one thing a book row does.
function aRowOpensThePerson() {
  test.subHeading('A book row opens the person, and that is all a row does');

  const app = mountApp({
    people: [
      { publicKey: BERT, publicLabel: 'bert', caption: 'bert', myLabel: 'Bertie', tail: 'bertb=', acquiredVia: 'handle', held: false, blocked: false },
      { publicKey: CAROL, publicLabel: 'carol', caption: 'carol', myLabel: '', acquiredVia: 'hold', held: true, blocked: false },
    ],
  });

  return settle().then(function () {
    press(app, CAROL);
    return settle();
  }).then(function () {
    // The KEY alone: the dialog re-fetches its row.
    if (app.called.length === 1 && app.called[0].id === 'shell/contactsDetails' &&
        JSON.stringify(app.called[0].params) === JSON.stringify({ key: CAROL })) {
      test.check('pressing a row calls the dialog for that key and nothing else');
    } else {
      test.fail('called: ' + JSON.stringify(app.called));
    }

    if (app.launched.length === 0 && app.posts.length === 0) {
      test.check('and it goes through callDialog rather than the launch door, asking nobody on the network');
    } else {
      test.fail('launched: ' + JSON.stringify(app.launched) + ' posts: ' + JSON.stringify(app.posts));
    }

    // Nothing expands in place: the list's rows stay one line.
    const html = listEl(app).innerHTML;
    if (html.indexOf('colspan') === -1 && html.indexOf('fact-row') === -1 && html.indexOf('contacts-label-input') === -1) {
      test.check('and no row expands in place, so the list keeps its shape');
    } else {
      test.fail('a row still expands: ' + html);
    }
  });
}

function refreshesWhenTheDialogChangedSomething() {
  test.subHeading('What the dialog decided reaches the list');

  const people = [
    { publicKey: CAROL, publicLabel: 'carol', caption: 'carol', myLabel: '', acquiredVia: 'hold', held: true, blocked: false },
  ];
  const app = mountApp({ people: people });

  return settle().then(function () {
    if (cell(app, CAROL, 'status') === ICONS.WAITING) {
      test.check('carol is listed as waiting');
    } else {
      test.fail('before: ' + cell(app, CAROL, 'status'));
    }

    // The dialog blocked her; its answer says something changed.
    people[0].blocked = true;
    app.answers({ changed: true, key: CAROL });
    const asked = posted(app, 'contact.search').length;
    press(app, CAROL);

    return settle().then(function () {
      if (cell(app, CAROL, 'status') === ICONS.NO && posted(app, 'contact.search').length > asked) {
        test.check('and an answer saying something changed asks the list again, so the mark is right');
      } else {
        test.fail('after: ' + cell(app, CAROL, 'status') + ', contact.search asked ' + (posted(app, 'contact.search').length - asked) + ' more time(s)');
      }
    });
  });
}

// A dialog that decided nothing must not make the list re-fetch.
function saysNothingWhenNothingHappened() {
  const app = mountApp({
    people: [{ publicKey: CAROL, publicLabel: 'carol', caption: 'carol', myLabel: '', acquiredVia: 'message', held: false, blocked: false }],
    dialogResult: null,
  });
  return settle().then(function () {
    const reads = posted(app, 'contact.search').length;
    press(app, CAROL);
    return settle().then(function () {
      const after = posted(app, 'contact.search').length;
      if (reads > 0 && app.called.length === 1 && after === reads) {
        test.check('and a dialog answering null costs the list nothing');
      } else {
        test.fail('re-read on an empty result: ' + reads + ' then ' + after + ', dialogs ' + app.called.length);
      }
    });
  });
}

// THIS NODE'S RELAYS STAND BESIDE THE BOOK (goal/G30.7, G30.19): relay.search, a row keyed by its url, which opens
// Relay Details rather than a person.
function relaysAreRowsToo() {
  test.subHeading('This node’s relays are rows of the same list, and open Relay Details');

  const app = mountApp({
    people: [{ publicKey: BERT, publicLabel: 'bert', caption: 'bert', myLabel: '', tail: 'bertb=', acquiredVia: 'handle', held: false, blocked: false }],
    relays: [{ url: 'https://relay.example', name: 'my relay', owned: true }],
  });

  return settle().then(function () {
    if (posted(app, 'relay.search').length >= 1 && rowOf(app, 'https://relay.example') && cell(app, 'https://relay.example', 'label') === 'my relay' &&
        cell(app, 'https://relay.example', 'add') === '' && rowOf(app, BERT)) {
      test.check('relay.search is asked beside the book, and the relay is a row by its name, with no Add');
    } else {
      test.fail('relay row: ' + JSON.stringify(rowKeys(app)) + ' label ' + cell(app, 'https://relay.example', 'label'));
    }

    press(app, 'https://relay.example');
    return settle();
  }).then(function () {
    const c = app.called[0] || {};
    if (app.called.length === 1 && c.id === 'shell/natterDetails' && c.params && c.params.url === 'https://relay.example' && app.posts.length === 0) {
      test.check('and pressing it opens shell/natterDetails for that url');
    } else {
      test.fail('relay press called: ' + JSON.stringify(app.called));
    }
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

  const contactBook = require('../run/spirit/contacts');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-forget-'));

  contactBook.acquire(home, { publicKey: 'K1', publicLabel: 'sonny', relay: 'https://lab.example' }, 'handle');
  contactBook.setMyLabel(home, 'K1', 'my sonny');
  const gone = contactBook.forget(home, 'K1');

  if (gone && gone.forgotten && contactBook.byPublicKey(home, 'K1') === null) {
    test.check('an ordinary contact leaves the book entirely, myLabel and route with them');
  } else {
    test.fail('after forget: ' + JSON.stringify(contactBook.byPublicKey(home, 'K1')));
  }

  // A blocked row IS the refusal — delete it and the next thing they
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

  if (contactBook.forget(home, 'NEVER-HEARD-OF') === null) {
    test.check('and forgetting a stranger says so rather than pretending');
  } else {
    test.fail('forgot somebody who was not there');
  }

  try { fs.rmSync(home, { recursive: true, force: true }); } catch (e) { /* leave it */ }
  return Promise.resolve();
}

// ── NO LOCK ANY MORE (2026-09-19) ────────────────────────────────────
//
// Seats were a roster's and no relay returns one — Andy: "kill the lock
// columns." Asserted as the absence, including for a row older code left
// `memberOf` on: a stale field must draw nothing.
function aMemberSaysSoOnTheRow() {
  test.subHeading('No row carries a lock — seats are not a thing a contact knows');

  const app = mountApp({
    people: [
      { publicKey: 'KEY-CRUELLA', tail: 'lrjo=', publicLabel: 'Cruella', caption: 'Cruella', myLabel: '', acquiredVia: 'member',
        memberOf: ['https://mine.example'], held: false, blocked: false, onRelay: true, bytesHeld: 0 },
      { publicKey: 'KEY-SONNY', tail: 'kEbk=', publicLabel: 'sonny', caption: 'sonny', myLabel: '', acquiredVia: 'handle',
        held: false, blocked: false, onRelay: false, bytesHeld: 0 },
    ],
  });

  return settle().then(function () {
    const out = allCells(app);
    if (cell(app, 'KEY-CRUELLA', 'label') === 'Cruella' && out.indexOf(ICONS.LOCKED) === -1 && !/hold a seat/.test(listEl(app).innerHTML)) {
      test.check('no row carries a lock, even one older code left memberOf on, and no seat is named');
    } else {
      test.fail('a lock was drawn: ' + out);
    }
    if (fields(app, 'KEY-CRUELLA') === 'presence,status,label,add' && out.indexOf('member') === -1 && cell(app, 'KEY-SONNY', 'label') === 'sonny') {
      test.check('four cells a row, and nothing more about the relationship — the screen does that');
    } else {
      test.fail('cells ' + fields(app, 'KEY-CRUELLA') + ' row: ' + out);
    }
  });
}

// ── SOMEBODY FOUND ON THE NETWORK ────────────────────────────────────
//
// goal/G30.19: the network search is the second tier of the same search.
// Each row the node finds streams in as a 'peer-search' update, joins the
// same list (book: false), shows its dot from the relay's word and offers
// Add, which acquires the key at the relay that found it.
function foundOnTheNetwork() {
  test.subHeading('Somebody found on the network is a row of the same list, with a dot and an Add');

  const here = auth.generateIdentity('here').publicKey;
  const faraway = auth.generateIdentity('faraway').publicKey;
  const items = networkRows([
    { publicKey: here, publicLabel: 'here', relay: 'https://a.example', present: true },
    // A PARTNER'S MEMBER: this node holds no stream to them, so the answering relay's word is the only answer there is.
    { publicKey: faraway, publicLabel: 'faraway', relay: 'https://b.example', present: true, viaPartner: true },
  ]);
  const app = mountApp({
    people: [{ publicKey: BERT, publicLabel: 'bert', caption: 'bert', myLabel: '', tail: 'bertb=', acquiredVia: 'handle', held: false, blocked: false }],
  });

  return settle().then(function () {
    type(app, 'a');
    return settle();
  }).then(function () {
    app.found(items);
    return settle();
  }).then(function () {
    if (rowOf(app, here) && rowOf(app, faraway) && rowOf(app, BERT) && cell(app, here, 'label') === 'here') {
      test.check('the rows the network search streams join the book’s in one list');
    } else {
      test.fail('rows: ' + JSON.stringify(rowKeys(app)) + ' from ' + JSON.stringify(items));
    }

    // Before this node's own table says anything, the answering relay's word is what shows.
    if (cell(app, here, 'presence') === ICONS.GREEN_CIRCLE && cell(app, faraway, 'presence') === ICONS.GREEN_CIRCLE) {
      test.check('each found row’s dot is the relay’s word, a partner’s member included');
    } else {
      test.fail('found dots: here ' + cell(app, here, 'presence') + ', faraway ' + cell(app, faraway, 'presence'));
    }

    // AND THIS NODE'S OWN TABLE WINS WHERE IT HAS AN OPINION; a partner's member it never mentions keeps the relay's word.
    const table = {};
    table[here] = false;
    app.presence(table);
    if (cell(app, here, 'presence') === ICONS.RED_CIRCLE && cell(app, faraway, 'presence') === ICONS.GREEN_CIRCLE) {
      test.check('and this node’s own presence table wins where it speaks: absent goes red, the partner’s member stays green');
    } else {
      test.fail('after the table: here ' + cell(app, here, 'presence') + ', faraway ' + cell(app, faraway, 'presence'));
    }

    if (/data-action="add"/.test(cell(app, here, 'add')) && cell(app, BERT, 'add') === '') {
      test.check('a found row offers Add, a book row does not');
    } else {
      test.fail('add cells: here ' + cell(app, here, 'add') + ', bert ' + cell(app, BERT, 'add'));
    }

    // NO FILTER ON PRESENCE: the dot is a fact on the row, not a reason to drop it.
    if (rowOf(app, here) && rowOf(app, faraway)) {
      test.check('and nobody is hidden for being absent, because adding somebody never needed them awake');
    } else {
      test.fail('a row went missing: ' + JSON.stringify(rowKeys(app)));
    }

    // THE NETWORK TOGGLE (box v8): on, the found rows beside the book; off, the book alone.
    const networkOn = rowKeys(app).slice().sort().join(',');
    pressFilter(app, 'network', 'toggle');
    const bookOnly = rowKeys(app).join(',');
    pressFilter(app, 'network', 'toggle');
    if (networkOn === [BERT, here, faraway].sort().join(',') && bookOnly === BERT) {
      test.check('the network toggle on shows the found rows beside the book; off, the book alone');
    } else {
      test.fail('toggle: on ' + networkOn + ' | off ' + bookOnly);
    }

    pressAction(app, here, 'add');
    return settle();
  }).then(function () {
    const calls = posted(app, 'peer.acquire');
    if (calls.length === 1 && calls[0].publicKey === here && calls[0].url === 'https://a.example' && calls[0].via === 'handle' && calls[0].publicLabel === 'here') {
      test.check('pressing Add asks peer.acquire for that key, at the relay that found it, and no other');
    } else {
      test.fail('acquire: ' + JSON.stringify(calls));
    }
    if (app.called.length === 0 && app.posts.length === 0) {
      test.check('and Add is the button’s, not a row press: no dialog, no card asked');
    } else {
      test.fail('Add also pressed the row: ' + JSON.stringify(app.called) + ' ' + JSON.stringify(app.posts));
    }
    // THE NODE'S SUCCESS IS 201 (hub.handleContact writes 201 for a contact acquired), so that is what the fake answers.
    const status = el(app, 'contacts-status').textContent;
    if (/^added/.test(status)) {
      test.check('and the page says it was added');
    } else {
      test.fail('after a successful Add (the node’s 201) the page says "' + status + '": contactSearch reads any status ' +
        'but 200 as a refusal, so it neither says added nor runs onAdded and the refresh');
    }
  });
}

// ── EVERY PERSON FOUND CAN BE ASKED WHO THEY ARE ─────────────────────
//
//   Andy: "Names are cheaper as by-product of search, Description can be
//   deliberate... when a result-row is clicked..."
//
// A search asks nobody; pressing a found row asks that one node for its
// card, and what it said (or that nobody answered) is said on the page.
function aFoundPersonCanBeAsked() {
  test.subHeading('A found person is asked who they are when their row is pressed, and only then');

  const sonny = auth.generateIdentity('sonny').publicKey;
  const ghost = auth.generateIdentity('ghost').publicKey;
  const items = networkRows([
    { publicKey: sonny, publicLabel: 'sonny', relay: 'https://a.example', present: true },
    { publicKey: ghost, publicLabel: 'ghost', relay: 'https://b.example', present: true },
  ]);
  const cards = {};
  cards[sonny] = { name: 'sonny', description: 'jazz, and a synth in the corner' };
  const app = mountApp({ cards: cards });

  return settle().then(function () {
    if (app.posts.length === 0) {
      test.check('nobody is asked anything before a search is run');
    } else {
      test.fail('posted before searching: ' + JSON.stringify(app.posts));
    }
    type(app, 'o');
    app.found(items);
    return settle();
  }).then(function () {
    if (app.posts.length === 0 && rowOf(app, sonny) && rowOf(app, ghost)) {
      test.check('a search asks nobody — the names it needs came with the answer');
    } else {
      test.fail('a search posted: ' + JSON.stringify(app.posts) + ' rows ' + JSON.stringify(rowKeys(app)));
    }
    press(app, sonny);
    return settle();
  }).then(function () {
    const one = app.posts[0] || {};
    if (app.posts.length === 1 && one.to === sonny && app.called.length === 0) {
      test.check('pressing one found row asks that person, and nobody else, and opens no dialog');
    } else {
      test.fail('after one press: ' + JSON.stringify(app.posts) + ' dialogs ' + JSON.stringify(app.called));
    }
    // THE SHAPE IS THE ASSERTION: an app-less packet is the one js/nodeCard.js answers about the node itself.
    if (one.app === '' && one.body && one.body.card === true) {
      test.check('with an app-less packet, which is the one a node answers about itself');
    } else {
      test.fail('wrong packet: ' + JSON.stringify(one));
    }
    if (/jazz, and a synth in the corner/.test(el(app, 'contacts-status').textContent)) {
      test.check('and what they said is said on the page');
    } else {
      test.fail('no description: ' + el(app, 'contacts-status').textContent);
    }
    press(app, ghost);
    return settle();
  }).then(function () {
    // THE ONE A ROLL COULD NEVER ANSWER (Andy: "this would incidentally also validate true 'reachability'.")
    if (app.posts.length === 2 && app.posts[1].to === ghost && /could not reach them/.test(el(app, 'contacts-status').textContent)) {
      test.check('and somebody who does not answer is reported unreachable, which a roll cannot tell you');
    } else {
      test.fail('ghost: ' + el(app, 'contacts-status').textContent + ' posts ' + JSON.stringify(app.posts));
    }
    // ONE LINE EACH: two people, two rows, nothing spanning the table.
    if (rowKeys(app).length === 2 && listEl(app).innerHTML.indexOf('colspan') === -1) {
      test.check('two people, two rows, and no row spans the table');
    } else {
      test.fail('rows: ' + listEl(app).innerHTML);
    }
  });
}

// Two people found under one word: a label is not an identity (R1), and
// the ENDING is how a person tells them apart. That has to keep holding
// wherever adding happens.
function addsByHandle() {
  test.subHeading('Adding somebody is still a phone call');

  const one = auth.generateIdentity('bert-one').publicKey;
  const two = auth.generateIdentity('bert-two').publicKey;
  const carl = auth.generateIdentity('carl').publicKey;
  const items = networkRows([
    { publicKey: one, publicLabel: 'bert', relay: 'https://a.example', present: true },
    { publicKey: two, publicLabel: 'bert', relay: 'https://b.example', present: true },
    { publicKey: carl, publicLabel: 'carl', relay: 'https://b.example', present: true },
  ]);
  const app = mountApp({});

  return settle().then(function () {
    type(app, 'bert');
    app.found(items);
    return settle();
  }).then(function () {
    const adds = [one, two].filter(function (k) { return /data-action="add"/.test(cell(app, k, 'add')); }).length;
    if (adds === 2) {
      test.check('every key behind the word is listed, each with its own Add');
    } else {
      test.fail('matches: ' + allCells(app));
    }

    // A FOUND ROW IS ITS NAME ALONE (goal/G40.1): no key's tail rides it, so two found under one word read alike.
    const labels = cell(app, one, 'label') + ' | ' + cell(app, two, 'label');
    if (cell(app, one, 'label') === 'bert' && cell(app, two, 'label') === 'bert') {
      test.check('two found rows behind one word both read bert: no key ending tells them apart');
    } else {
      test.fail('two found rows behind one word: ' + labels);
    }
    if (cell(app, carl, 'label') === 'carl') {
      test.check('and every found row reads its name alone');
    } else {
      test.fail('carl: ' + cell(app, carl, 'label'));
    }

    // AND THE RELAY IS NOT A COLUMN (Andy: "The user shouldn't worry about relays."): it rides on the row for Add.
    if (allCells(app).indexOf('a.example') === -1) {
      test.check('the relay is carried for the node and shown in no cell');
    } else {
      test.fail('relay leaked into a cell: ' + allCells(app));
    }

    pressAction(app, one, 'add');
    return settle();
  }).then(function () {
    const calls = posted(app, 'peer.acquire');
    if (calls.length === 1 && calls[0].publicKey === one && calls[0].url === 'https://a.example') {
      test.check('and confirming one writes that key and no other, against the relay the row came from');
    } else {
      test.fail('acquire: ' + JSON.stringify(calls));
    }
  });
}

// The two rows where a name is not an answer by itself. Both are the
// node's verdict, not this app's: `ambiguous` is set by buildPeople and
// the ending is part of the name hub.contactLabel sends.
function theHandleColumnStillIdentifies() {
  test.subHeading('A name that names nobody says which key it is');

  const app = mountApp({
    people: [
      { publicKey: JOHN_A, publicLabel: 'john', caption: 'john', myLabel: '', ambiguous: true, acquiredVia: 'message', held: false, blocked: false },
      { publicKey: JOHN_B, publicLabel: 'john', caption: 'john', myLabel: '', ambiguous: true, acquiredVia: 'message', held: false, blocked: false },
      { publicKey: CAROL, publicLabel: '', caption: CAROL, myLabel: '', acquiredVia: 'message', held: false, blocked: false },
    ],
  });

  return settle().then(function () {
    if (cell(app, JOHN_A, 'label') === 'john' && cell(app, JOHN_B, 'label') === 'john') {
      test.check('two people behind one word both read john: no key ending is shown (goal/G40.1)');
    } else {
      test.fail('ambiguous rows: ' + cell(app, JOHN_A, 'label') + ' | ' + cell(app, JOHN_B, 'label'));
    }

    const nameless = cell(app, CAROL, 'label');
    if (nameless === '(no name)') {
      test.check('and a contact who never claimed a handle is not a blank cell');
    } else {
      test.fail('nameless row: ' + nameless);
    }

    // The whole key is never in a cell; it stays on the row as data-key, because a press has to say whose screen opens.
    if (allCells(app).indexOf('MCowBQYDK2VwAyEA') === -1 && rowOf(app, CAROL)) {
      test.check('and never the whole key, which is what the caption used to fall back to');
    } else {
      test.fail('whole key in a cell: ' + allCells(app));
    }
  });
}

// The remaining folds are one group. The 'Find someone on the network'
// fold (contacts-seen-section) is gone by design (goal/G30.19): the
// network is a filter of the one list.
function foldsObeyTheSpacingRules() {
  test.subHeading('The folds are one group, and the block below a heading carries its own space');

  const src = fs.readFileSync(APP_SCRIPT, 'utf8').replace(/^\s*\/\/.*$/gm, '');
  const css = fs.readFileSync(path.join(RUN_DIR, 'shell.css'), 'utf8');

  const named = (src.match(/<details[^>]*name="([^"]+)"/g) || []).map(function (tag) { return /name="([^"]+)"/.exec(tag)[1]; });
  const folds = (src.match(/<details/g) || []).length;
  const ids = (src.match(/<details[^>]*id="([^"]+)"/g) || []).map(function (tag) { return /id="([^"]+)"/.exec(tag)[1]; }).sort();
  if (folds >= 2 && named.length === folds && named.every(function (n) { return n === 'contacts-panels'; })) {
    test.check('all ' + folds + ' folds are in one exclusive group, named from the id prefix, so opening one closes the rest');
  } else {
    test.fail(folds + ' folds, names: ' + JSON.stringify(named));
  }
  if (ids.join(',') === 'contacts-relay-add-section,contacts-unknown-section' && src.indexOf('contacts-seen') === -1) {
    test.check('the folds are Add a relay and the stranger policy; the Find-someone fold is gone, the list’s filter replaces it');
  } else {
    test.fail('folds: ' + JSON.stringify(ids) + ', contacts-seen in the source ' + (src.indexOf('contacts-seen') !== -1));
  }

  const gap = /#contacts-unknown-choices\s*\{[^}]*margin-top:\s*(\d+)px/.exec(css);
  const scale = /#app-content > \.app-pane > \*[^{]*\{[^}]*margin-top:\s*(\d+)px/.exec(css);
  if (gap && scale && gap[1] === scale[1]) {
    test.check('and the choices carry the same leading space as any other block');
  } else {
    test.fail('choices ' + (gap && gap[1]) + 'px vs the block scale ' + (scale && scale[1]) + 'px');
  }

  if (css.indexOf('#rc-unknown-choices') === -1) {
    test.check('and the copy it left behind in chat is gone');
  } else {
    test.fail('#rc-unknown-choices is still in the stylesheet');
  }
  return Promise.resolve();
}

function sendsNothing() {
  test.subHeading('It reads the book — it does not talk to anybody');

  const src = fs.readFileSync(APP_SCRIPT, 'utf8').replace(/^\s*\/\/.*$/gm, '');
  if (src.indexOf('sendMessagePacket') === -1 && src.indexOf('/api/hub/send') === -1) {
    test.check('no packets leave this app');
  } else {
    test.fail('contacts.js sends something');
  }
  if ((src.match(/saveFile\(/g) || []).length === 0) {
    test.check('and it keeps nothing on disk — it draws the control, the node holds the value');
  } else {
    test.fail('contacts.js writes: ' + JSON.stringify(src.match(/saveFile\([A-Za-z_'"./]*/g)));
  }
  if (src.indexOf('logs/') === -1 && src.indexOf('peerFile') === -1) {
    test.check('and nothing about a person is written down here at all');
  } else {
    test.fail('contacts.js files something about a peer');
  }

  // READ AS IT RUNS: mounted, the book read and words typed, and no packet went to anybody.
  const app = mountApp({
    people: [{ publicKey: BERT, publicLabel: 'bert', caption: 'bert', myLabel: '', tail: 'bertb=', acquiredVia: 'handle', held: false, blocked: false }],
  });
  return settle().then(function () {
    type(app, 'be');
    return settle();
  }).then(function () {
    if (app.posts.length === 0 && posted(app, 'contact.search').length >= 2) {
      test.check('reading the book and searching it posts no packet to anybody');
    } else {
      test.fail('posts ' + JSON.stringify(app.posts) + ', contact.search ' + posted(app, 'contact.search').length);
    }
    // peer.search and peerFind are deleted (goal/G30.19): the one search is contact.search.
    if (posted(app, 'peer.search').length === 0 && posted(app, 'peer.find').length === 0 && src.indexOf('peerFind') === -1 && src.indexOf('peer.search') === -1) {
      test.check('and it never asks peer.search: the network is contact.search’s second tier');
    } else {
      test.fail('peer.search asked ' + posted(app, 'peer.search').length + ', peerFind in source ' + (src.indexOf('peerFind') !== -1));
    }
  });
}

// PRESENCE.md Stage 4 — the dot. Since goal/G30.18/G30.19 it is each row's
// contactElement's, fed by the relay-presence job; Contacts paints none
// itself (contactsWatchPresence and contactsPaintPresence are gone).
function theDotColumn() {
  test.subHeading('The leftmost dot, painted by each row from the relay-presence job');

  const app = mountApp({
    people: [
      { publicKey: BERT, publicLabel: 'bert', caption: 'bert', myLabel: '', tail: 'bertb=', acquiredVia: 'handle', held: false, blocked: false },
      { publicKey: CAROL, publicLabel: 'carol', caption: 'carol', myLabel: '', acquiredVia: 'handle', held: false, blocked: false },
      { publicKey: DAVE, publicLabel: 'dave', caption: 'dave', myLabel: '', tail: 'edave=', acquiredVia: 'handle', held: false, blocked: false },
    ],
  });
  function dot(key) { return cell(app, key, 'presence'); }

  return settle().then(function () {
    const src = fs.readFileSync(APP_SCRIPT, 'utf8').replace(/^\s*\/\/.*$/gm, '');
    if (!/function contactsWatchPresence|function contactsPaintPresence|jobs\.subscribe/.test(src)) {
      test.check('Contacts subscribes to nothing and paints no dot itself — the rows do');
    } else {
      test.fail('contacts.js still watches presence');
    }

    // BEFORE ANY PAYLOAD: white. A screenful of red on load would be a lie that corrects itself a second later.
    if (dot(BERT) === ICONS.WHITE_CIRCLE && dot(DAVE) === ICONS.WHITE_CIRCLE) {
      test.check('before any payload every dot is white — nothing is known, and it says so');
    } else {
      test.fail('on load: ' + dot(BERT) + ' ' + dot(DAVE));
    }

    const table = {};
    table[BERT] = true;
    table[CAROL] = false;
    app.presence(table);

    if (dot(BERT) === ICONS.GREEN_CIRCLE) {
      test.check('a key a relay says is present goes green');
    } else {
      test.fail('bert: ' + dot(BERT));
    }
    if (dot(CAROL) === ICONS.RED_CIRCLE) {
      test.check('a key this node’s table says is absent goes red');
    } else {
      test.fail('carol: ' + dot(CAROL));
    }
    // THE ONE THAT MATTERS: in the book and in no payload is unseen, not offline.
    if (dot(DAVE) === ICONS.WHITE_CIRCLE) {
      test.check('and a key NO relay mentions stays white — unseen is not offline');
    } else {
      test.fail('dave: ' + dot(DAVE));
    }
    if (cell(app, DAVE, 'label') === 'dave') {
      test.check('and they are still in the list, because presence does not decide membership');
    } else {
      test.fail('dave left the list');
    }

    // A REMOVED PEER GOES WHITE. The node deletes a key it is told is gone
    // rather than marking it absent, so the key falls out of the payload.
    const after = {};
    after[CAROL] = false;
    app.presence(after);
    if (dot(BERT) === ICONS.WHITE_CIRCLE) {
      test.check('a key that DROPS OUT of the payload goes white — that is removal');
    } else {
      test.fail('a key that dropped out of the payload still reads ' + dot(BERT) + ', not white: contactElement keeps a row’s last ' +
        'presence for a key the table no longer mentions, so a removed peer stays green');
    }

    // Nothing else on that channel may move a dot. server-stats ticks every two seconds.
    const before = allCells(app);
    app.otherJob();
    if (allCells(app) === before) {
      test.check('and another job on the same channel repaints nothing');
    } else {
      test.fail('a server-stats tick changed the list');
    }

    // The snapshot path: how an app mounted after the last change learns anything at all.
    const late = mountApp({
      people: [{ publicKey: BERT, publicLabel: 'bert', caption: 'bert', myLabel: '', tail: 'bertb=', acquiredVia: 'handle', held: false, blocked: false }],
    });
    return settle().then(function () {
      const snap = {};
      snap[BERT] = true;
      late.presence(snap, 'snapshot');
      if (cell(late, BERT, 'presence') === ICONS.GREEN_CIRCLE) {
        test.check('and the snapshot fills the dot in, so a late mount is not blank forever');
      } else {
        test.fail('snapshot ignored: ' + cell(late, BERT, 'presence'));
      }

      // ONE SUBSCRIPTION PER PAGE, NOT ONE PER MOUNT: the shell has no unmount hook.
      const opened = late.subscriptions();
      late.remount();
      late.remount();
      if (opened === 1 && late.subscriptions() === opened) {
        test.check('one stream subscription for every row, and walking in twice more opens no further one');
      } else {
        test.fail('subscriptions: ' + opened + ', then ' + late.subscriptions() + ' after two more mounts');
      }
    });
  });
}

// ── A RELAY'S ROW FOLLOWS THE NODE'S HOLD ON IT (goal/G40.5) ─────────
//
//   Andy, 2026-10-24: "in contacts->natterDetails, both relays show as NOT present." and "The other problem seems to
//   be that the UI is not tracking relay-presence correctly anymore..."
//
// Written first, red on today's tree, by claude-windows. A relay's row is keyed by its url (relay.search), and the
// relay-presence table by public keys: the node seeds each relay's own key present the moment its stream opens
// (presenceNode seedRelay) and drops that relay's whole part when the stream closes (forget). The box: a relay the
// node holds a stream to is drawn present, and drawn absent when the stream drops, without a reload.
const RELAY_URL = 'https://relay.example';
const RELAY_KEY = 'MCowBQYDK2VwAyEArelayrelayrelayrelayrelayrelayrelayre=';
function aRelayRowFollowsTheNode() {
  test.subHeading('A relay\'s row is present while the node holds its stream, absent once it drops (goal/G40.5)');
  const OWED = 'OWED by goal/G40.5: ';
  const app = mountApp({
    people: [{ publicKey: BERT, publicLabel: 'bert', caption: 'bert', myLabel: '', tail: 'bertb=', acquiredVia: 'handle', held: false, blocked: false }],
    relays: [{ url: RELAY_URL, name: 'my relay', owned: true, relayKey: RELAY_KEY }],
  });
  function dot() { return cell(app, RELAY_URL, 'presence'); }

  return settle().then(function () {
    // The stream opens: the node's table names the relay's own key present, as seedRelay writes it.
    const open = {};
    open[RELAY_KEY] = true;
    open[BERT] = true;
    app.presence(open);
    if (dot() === ICONS.GREEN_CIRCLE) test.check('the node holds the relay\'s stream: its row goes green, from the relay\'s own key in the table');
    else test.fail(OWED + 'the table names the relay\'s key present and its row (keyed by its url) reads ' + dot());

    // The stream drops: forget() takes the relay's part out of the table, its own key with it.
    app.presence({});
    if (dot() === ICONS.RED_CIRCLE) test.check('the stream drops: its row goes red, absent, with no reload');
    else test.fail(OWED + 'the relay\'s key left the table (its stream closed) and its row reads ' + dot() + ', not absent');

    // And it comes back by itself.
    app.presence(open);
    if (dot() === ICONS.GREEN_CIRCLE) test.check('and green again when the stream opens again');
    else test.fail(OWED + 'the stream opened again and the row reads ' + dot());
  });
}

// ── THE RENAME'S MIGRATION (cycle 10, R18) ───────────────────────────
//
//   Andy, 2026-09-23: "we loose census from the dictionary."
//
// `acquiredVia` was the one place the old word was a VALUE ON DISC, read
// by the code that decides whom this node will hear from.
function oldRowsStillRead() {
  const contactBook = require('../run/spirit/contacts');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-r18-'));
  fs.mkdirSync(path.join(dir, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'relay-state', 'contacts.json'), JSON.stringify([
    { publicKey: BERT, publicLabel: 'bert', acquiredVia: 'census' },  // written before today
    { publicKey: CAROL, publicLabel: 'carol' },                        // written before the field
    { publicKey: DAVE, publicLabel: 'dave', acquiredVia: 'message' },
  ]));

  const rows = contactBook.load(dir);
  const bert = rows.filter(function (r) { return r.publicKey === BERT; })[0];
  const carol = rows.filter(function (r) { return r.publicKey === CAROL; })[0];
  const dave = rows.filter(function (r) { return r.publicKey === DAVE; })[0];

  if (contactBook.acquiredVia(bert) === contactBook.ROLL &&
      contactBook.acquiredVia(carol) === contactBook.ROLL) {
    test.check('a row stored as `census` reads as `roll` — the same rank it always had, and so does a row with no field');
  } else {
    test.fail('an old row did not migrate: ' + contactBook.acquiredVia(bert));
  }

  if (!contactBook.listens(bert) && !contactBook.listens(carol) && contactBook.listens(dave)) {
    test.check('and it changes nothing about who is heard — a roll row is still not a correspondent');
  } else {
    test.fail('the rename moved somebody across the listening line');
  }

  if (contactBook.addressBook(dir).length === 1) {
    test.check('and the address book still holds only the people this node actually knows');
  } else {
    test.fail('the address book took in roll rows: ' + contactBook.addressBook(dir).length);
  }

  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* leave it */ }
}

listsTheBook()
  .then(oldRowsStillRead)
  .then(theHandleColumnStillIdentifies)
  .then(aRowOpensThePerson)
  .then(refreshesWhenTheDialogChangedSomething)
  .then(saysNothingWhenNothingHappened)
  .then(relaysAreRowsToo)
  .then(forgetsWithoutUnblocking)
  .then(aMemberSaysSoOnTheRow)
  .then(foundOnTheNetwork)
  .then(aFoundPersonCanBeAsked)
  .then(addsByHandle)
  .then(strangerPolicy)
  .then(foldsObeyTheSpacingRules)
  .then(sendsNothing)
  .then(theDotColumn)
  .then(aRelayRowFollowsTheNode)
  .then(function () { test.reportSuccessFailureCount(); })
  .catch(function (err) {
    test.fail('contacts threw: ' + ((err && err.stack) || err));
    test.reportSuccessFailureCount();
  });
