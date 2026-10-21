'use strict';

// goal/G2.7: the book search in Contacts filters the visible list. Red on today's tree.
//   Found by Andy, 2026-10-02: "now to the contacts shell app, the search there does nothing" — the bar adds each
//   typed query to the shown set (contactsBookQueries, primed with *), so with everyone shown a name adds nothing.
//   RULED (Andy, verbatim): "hmm, i kind of expect for the search term to remain in the search box, and while it
//   remains, it also filters the visible list. would help me find even contacts withing the list." and "do you know
//   those search boxes that leave the search term, with a little closing button on the right that removes the input?"
// The contract the builder follows (the shape read back and recorded in goal/G2.7):
//   1. The term stays in the box; while it stands, the list follows it live as he types (an input event, no Search
//      press needed).
//   2. A small × at the right of the box clears the term and brings the whole list back.
// SINCE goal/G30.19 THE BOX IS THE ONE LIST'S. The contactSelector pane and the separate network search (peerFind) are
// deleted: Contacts draws shell/js/contactSearch.js on the standard list tool (shell/js/probabilitySearch.js), whose
// own text box and ✕ (probsearch-<n>-text, probsearch-<n>-clear) are the ones meant here. The list RANKS from its cache
// as he types, best on top and nothing cut, then asks contact.search with the words — so "shows Carol alone" is "Carol
// on top, and the node asked for carol". The network is the same search's second tier, not a box below.
// Driven as spirit/test/contacts.js drives the app: the scripts index.html loads for the list, then the app, into a
// stand-in page, the fake answering contact.search the way the node would (hub.searchPeople), and its real handlers
// fired. rule/11: through testSupport only.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const spirit = require('../run/js/kernel.js');
const hubModule = require('../run/js/hub.js');

const OWED = 'OWED by goal/G2.7: ';
const RUN = path.join(__dirname, '..', 'run');
const APP_SCRIPT = path.join(RUN, 'shell', 'contacts', 'contacts.js');
const BERT = 'MCowBQYDK2VwAyEAbertbertbertbertbertbertbertbertbertb=';
const CAROL = 'MCowBQYDK2VwAyEAcarolcarolcarolcarolcarolcarolcaro=';
const DAVE = 'MCowBQYDK2VwAyEAdavedavedavedavedavedavedavedavedave=';

// THE STAND-IN PAGE, as spirit/test/contacts.js keeps it: an element keeps its html, listeners and attributes; a table
// written into it makes its rows elements of their own (tr[data-key], each td[data-field]), where a row paints.
function fakeElement(id, attrs) {
  let html = '';
  const attributes = Object.assign({}, attrs || {});
  let rows = {};
  const el = {
    id: id || '', value: '', textContent: '', style: {}, dataset: {}, listeners: {}, hidden: false, className: '', scrollTop: 0,
    addEventListener: function (event, fn) { (el.listeners[event] = el.listeners[event] || []).push(fn); },
    fire: function (event, arg) { (el.listeners[event] || []).slice().forEach(function (fn) { fn(arg || {}); }); },
    getAttribute: function (name) { return Object.prototype.hasOwnProperty.call(attributes, name) ? attributes[name] : null; },
    focus: function () {},
    closest: function (selector) { return selector === '[data-key]' && attributes['data-key'] != null ? el : null; },
    querySelector: function (selector) { const m = /^tr\[data-key="([^"]*)"\]$/.exec(selector); return m && rows[m[1]] ? rows[m[1]] : null; },
    querySelectorAll: function (selector) { return selector === 'td[data-field]' ? (el.cells || []) : []; },
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
        while ((d = tds.exec(t[2]))) { const td = fakeElement('', { 'data-field': d[1] }); td.innerHTML = d[2]; tr.cells.push(td); }
        rows[t[1]] = tr;
      }
    },
    enumerable: true,
  });
  return el;
}
function fakeDocument() {
  const byId = {};
  return { byId: byId, activeElement: null, getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); }, createElement: function () { return fakeElement(''); } };
}
function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 8; i++) await settle(); }

// THE LIST AS THE SHELL GIVES IT (goal/G30.19): the scripts index.html loads for it, in its order, no module and no
// process, as in a page.
const PAGE_SCRIPTS = [
  'js/probabilityBucket.js', 'js/probabilityStringMatch.js', 'js/probabilityStringObjectMatch.js', 'js/fieldRules.js',
  'shell/js/spiritData.js', 'shell/js/rowElement.js', 'shell/js/rows/contactElement.js', 'shell/js/probabilitySearch.js', 'shell/js/contactSearch.js',
];

function mountApp(people) {
  const doc = fakeDocument();
  const asked = [];
  const fakeFetch = function (url, init) {
    const sent = (function () { try { return JSON.parse((init && init.body) || '{}'); } catch (e) { return {}; } })();
    let answer;
    if (sent.verb === 'contact.search') { asked.push(sent); const r = hubModule.searchPeople(people, sent.q, sent); answer = { ok: true, items: r.items, more: r.more, selfTail: null }; }
    else if (sent.verb === 'relay.search') answer = { ok: true, items: [], more: false };
    else if (sent.verb === 'contact.senders') answer = { ok: true, policy: 'silent' };
    else answer = { ok: true };
    const t = JSON.stringify(answer);
    return Promise.resolve({ status: 200, text: function () { return Promise.resolve(t); }, json: function () { return Promise.resolve(JSON.parse(t)); } });
  };
  let behavior = null;
  const shellSpirit = {
    shell: { activateApp: function (b) { behavior = b; } },
    core: {
      ask: test.browserAsk(fakeFetch),
      util: { escapeHtml: spirit.core.util.escapeHtml, formatBytes: spirit.core.util.formatBytes },
      const: { ICON: spirit.core.const.ICON },
      jobs: { subscribe: function () { return function () {}; } },
    },
  };
  const win = { spirit: shellSpirit };
  PAGE_SCRIPTS.forEach(function (rel) {
    new Function('spirit', 'document', 'window', 'module', 'process', fs.readFileSync(path.join(RUN, rel), 'utf8'))(shellSpirit, doc, win, undefined, undefined);
  });
  new Function('spirit', 'document', 'window', 'fetch', fs.readFileSync(APP_SCRIPT, 'utf8'))(shellSpirit, doc, win, fakeFetch);
  const api = {
    verb: function (name, args) { return shellSpirit.core.ask(name, args); },
    escapeHtml: spirit.core.util.escapeHtml,
    launchApp: function () {}, callDialog: function () { return Promise.resolve(null); },
    peerPost: function () { return Promise.resolve({ ok: false, status: 503, body: null, error: 'not reachable' }); },
  };
  behavior.mount(fakeElement('container'), api, null);
  const pane = doc.getElementById('contacts-book');
  const pre = (/id="(probsearch-\d+-)text"/.exec(pane.innerHTML) || [])[1] || '';
  return { doc: doc, asked: asked, pane: pane, part: function (name) { return doc.getElementById(pre + name); } };
}
function person(key, label) { return { publicKey: key, publicLabel: label, caption: label, myLabel: '', choice: 'added', blocked: false, present: null }; }
// The names in the list, in the order drawn: each row's label cell, as its contactElement painted it.
function names(app) {
  const rows = app.part('list').rows();
  return Object.keys(rows).map(function (k) {
    const td = rows[k].cells.filter(function (c) { return c.getAttribute('data-field') === 'label'; })[0];
    return td ? td.innerHTML : '';
  });
}

test.startTest('goal/G2.7: the book search filters the visible list, the term stays, × clears it');

(async function () {
  const app = mountApp([person(BERT, 'Bert'), person(CAROL, 'Carol'), person(DAVE, 'Dave')]);
  await settled();
  const box = app.part('text');

  test.subHeading('the whole book first, asked with no words');
  if (names(app).join(',') === 'Bert,Carol,Dave') test.check('Bert, Carol and Dave are shown');
  else test.fail(OWED + 'the book shows ' + JSON.stringify(names(app)) + ' — the red cannot see the list it means to filter');

  // goal/G30.19: the one list's box; it ranks from what it holds at once, then asks the node with the words.
  test.subHeading('1. a term in the list\'s box ranks the list live, stays, and asks the node');
  box.value = 'carol';
  app.pane.fire('input', { target: box });
  const drawnAtOnce = names(app);
  await settled();
  const shown = names(app);
  if (drawnAtOnce[0] === 'Carol' && shown[0] === 'Carol' && box.value === 'carol') test.check('typing carol puts Carol on top at once, from the cache, and the box still says carol');
  else test.fail(OWED + 'after typing carol the list reads ' + JSON.stringify(drawnAtOnce) + ' then ' + JSON.stringify(shown) + ' and the box says ' + JSON.stringify(box.value));
  // Nothing cut (goal/G30.17): the rows the words miss are still listed, below.
  if (shown.length === 3) test.check('and Bert and Dave are still listed, below her — the list ranks, it cuts nothing');
  else test.fail(OWED + 'after typing carol the list holds ' + JSON.stringify(shown));
  if (app.asked.some(function (a) { return a.q === 'carol'; })) test.check('and contact.search was asked with the words, no Search press needed');
  else test.fail(OWED + 'contact.search was asked ' + JSON.stringify(app.asked));

  // goal/G30.19: the ✕ is the list tool's (probsearch-<n>-clear).
  test.subHeading('2. the ✕ clears the term and the whole list is back');
  const clear = app.part('clear');
  if (/✕/.test(app.pane.innerHTML) && clear) {
    app.pane.fire('click', { target: clear });
    await settled();
    const back = names(app);
    // With the field empty the rows stand in the order they came (goal/G30.17).
    if (back.join(',') === 'Bert,Carol,Dave' && box.value === '') test.check('the ✕ emptied the box and all three are back, in the order they came');
    else test.fail(OWED + 'after the ✕ the list shows ' + JSON.stringify(back) + ' and the box says ' + JSON.stringify(box.value));
  } else test.fail(OWED + 'no ✕ at the right of the list\'s box');
})().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
});
