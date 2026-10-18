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
//   3. The network search below is untouched.
// SINCE goal/G29.6 THE BOX IS THE PEER PICKER'S. Andy, 2026-10-17: "no fucking protecting old design." The book is a
// contactSelector pane on the shared list (shell/shared/js/listSearch.js, goal/G29.4): its own text box and its ✕
// (listsearch-<n>-text, listsearch-<n>-clear) replace contacts-book-q and contacts-book-clear, and the list RANKS from
// its cache as he types — "best matches on top, every row the filters let through shown" (the list's box) — then asks
// contact.search with the words. So "shows Carol alone" became "Carol on top, and the node asked for carol"; Escape is
// not part of the shared list and is dropped here (goal/G29.6).
// Driven as spirit/test/contacts.js drives the app: the script loaded with fake document, api and fetch, the fake
// answering contact.search the way the node would (hub.searchPeople), the picker loaded as the shell loads it, and its
// real handlers fired.

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

function fakeElement(id) {
  let html = '';
  const el = {
    id: id || '', value: '', textContent: '', style: {}, dataset: {}, children: [], listeners: {}, hidden: false, className: '',
    addEventListener: function (event, fn) { (el.listeners[event] = el.listeners[event] || []).push(fn); },
    appendChild: function (child) { el.children.push(child); return child; },
    fire: function (event, arg) { (el.listeners[event] || []).forEach(function (fn) { fn(arg || {}); }); },
    dispatchEvent: function (event) { el.fire(event.type, event); return true; },
    contains: function () { return true; },
    click: function () { el.fire('click'); }, focus: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); el.children.length = 0; }, enumerable: true });
  return el;
}
function fakeDocument() {
  const byId = {};
  return { byId: byId, activeElement: null, getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); }, createElement: function () { return fakeElement(''); } };
}
function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }
async function settled() { for (let i = 0; i < 8; i++) await settle(); }

// THE PICKER AS THE SHELL GIVES IT (goal/G29.6): the probability modules, the shared list and the contact selector
// loaded into the page, the selector handed to the app as api.ui.elements.
function loadPicker(doc, shellSpirit) {
  const win = {};
  ['probabilityStringMatch.js', 'probabilityStringObjectMatch.js', 'probabilityBucket.js'].forEach(function (f) {
    new Function('window', 'module', fs.readFileSync(path.join(RUN, 'js', f), 'utf8'))(win, undefined);
  });
  new Function('document', 'window', fs.readFileSync(path.join(RUN, 'shell', 'shared', 'js', 'listSearch.js'), 'utf8'))(doc, win);
  const made = [];
  const real = win.spiritElements.shellCreateListSearch;
  win.spiritElements.shellCreateListSearch = function (el, cfg) { const l = real(el, cfg); made.push({ el: el, cfg: cfg, list: l }); return l; };
  new Function('spirit', 'document', 'window', fs.readFileSync(path.join(RUN, 'shell', 'js', 'contactSelector.js'), 'utf8'))(shellSpirit, doc, win);
  return { win: win, made: made };
}

function mountApp(people) {
  const doc = fakeDocument();
  const asked = [];
  const fakeFetch = function (url, init) {
    let verb = '';
    try { verb = JSON.parse(String((init && init.body) || '{}')).verb || ''; } catch (e) { verb = ''; }
    const sent = (function () { try { return JSON.parse((init && init.body) || '{}'); } catch (e) { return {}; } })();
    let answer;
    if (verb === 'contact.search') { asked.push(sent); const r = hubModule.searchPeople(people, sent.q, sent); answer = { ok: true, items: r.items, more: r.more, selfTail: null }; }
    else if (verb === 'contact.get') { const p = people.filter(function (x) { return x.publicKey === sent.key; })[0]; answer = p ? { ok: true, key: sent.key, person: p } : { ok: false, error: 'not in the book' }; }
    else if (verb === 'contact.senders') answer = { ok: true, policy: 'silent' };
    else answer = { ok: true, people: people, selfTail: null, matches: [] };
    const t = JSON.stringify(answer);
    return Promise.resolve({ status: answer.ok ? 200 : 404, text: function () { return Promise.resolve(t); }, json: function () { return Promise.resolve(JSON.parse(t)); } });
  };
  let behavior = null;
  const shellSpirit = {
    shell: {
      activateApp: function (b) { behavior = b; },
      fileInfoRow: function (label, value) { return '<div class="file-info-row"><span>' + label + '</span><span>' + value + '</span></div>'; },
      factRow: function (pairs) { return '<div class="fact-row">' + (pairs || []).map(function (p) { return '<div class="fact"><span>' + spirit.core.util.escapeHtml(String(p[0])) + '</span><span>' + spirit.core.util.escapeHtml(String(p[1])) + '</span></div>'; }).join('') + '</div>'; },
    },
    core: {
      ask: test.browserAsk(fakeFetch),
      util: { escapeHtml: spirit.core.util.escapeHtml, formatBytes: spirit.core.util.formatBytes },
      const: { ICON: spirit.core.const.ICON },
      jobs: { subscribe: function () { return function () {}; } },
    },
  };
  const picker = loadPicker(doc, shellSpirit);
  new Function('spirit', 'document', 'window', 'fetch', fs.readFileSync(APP_SCRIPT, 'utf8'))(shellSpirit, doc, picker.win, fakeFetch);  // the page's window, the shared list on it (goal/G29.17)
  const api = {
    verb: function (name, args) {
      const payload = { verb: String(name) };
      if (args) Object.keys(args).forEach(function (k) { payload[k] = args[k]; });
      return fakeFetch('/api/spirit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        .then(function (r) { return r.text().then(function (t) { let body = null; try { body = JSON.parse(t); } catch (e) { body = null; } return { status: r.status, text: t, body: body }; }); });
    },
    escapeHtml: spirit.core.util.escapeHtml,
    launchApp: function () {}, callDialog: function () { return Promise.resolve(null); },
    peerPost: function () { return Promise.resolve({ ok: false, status: 503, body: null, error: 'not reachable' }); },
    readProject: function () { return null; },
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
    ui: { elements: { createContactSelector: picker.win.spiritElements.createContactSelector } },
  };
  behavior.mount(fakeElement('container'), api, null);
  const book = picker.made[picker.made.length - 1];
  const pre = book ? (/id="(listsearch-\d+-)text"/.exec(book.el.innerHTML) || [])[1] : '';
  return { doc: doc, asked: asked, pane: book && book.el, part: function (name) { return doc.getElementById(pre + name); } };
}
function person(key, label) { return { publicKey: key, publicLabel: label, caption: label, myLabel: '', choice: 'added', blocked: false, present: null }; }
// The names in the picker's list, in the order drawn.
function names(app) {
  const html = app.part('list').innerHTML;
  return ['Bert', 'Carol', 'Dave'].map(function (n) { return [html.indexOf('>' + n + '<'), n]; })
    .filter(function (p) { return p[0] !== -1; }).sort(function (a, b) { return a[0] - b[0]; }).map(function (p) { return p[1]; });
}

test.startTest('goal/G2.7: the book search filters the visible list, the term stays, × clears it');

(async function () {
  const app = mountApp([person(BERT, 'Bert'), person(CAROL, 'Carol'), person(DAVE, 'Dave')]);
  await settled();
  const box = app.part('text');

  test.subHeading('the whole book first, asked with no words');
  if (names(app).length === 3) test.check('Bert, Carol and Dave are shown');
  else test.fail(OWED + 'the book shows ' + JSON.stringify(names(app)) + ' — the red cannot see the list it means to filter');

  // goal/G29.6: the picker's own box; the list ranks from what it holds at once, then asks the node with the words.
  test.subHeading('1. a term in the picker\'s box ranks the list live, stays, and asks the node');
  box.value = 'carol';
  app.pane.fire('input', { target: box });
  const drawnAtOnce = names(app);
  await settled();
  const shown = names(app);
  if (drawnAtOnce[0] === 'Carol' && shown[0] === 'Carol' && box.value === 'carol') test.check('typing carol puts Carol on top at once, from the cache, and the box still says carol');
  else test.fail(OWED + 'after typing carol the list reads ' + JSON.stringify(drawnAtOnce) + ' then ' + JSON.stringify(shown) + ' and the box says ' + JSON.stringify(box.value));
  if (app.asked.some(function (a) { return a.q === 'carol'; })) test.check('and contact.search was asked with the words, no Search press needed');
  else test.fail(OWED + 'contact.search was asked ' + JSON.stringify(app.asked));

  // goal/G29.6: the ✕ is the shared list's (listsearch-<n>-clear); Escape is not part of the shared list, so dropped.
  test.subHeading('2. the ✕ clears the term and the whole list is back');
  const clear = app.part('clear');
  if (/✕/.test(app.pane.innerHTML) && clear) {
    app.pane.fire('click', { target: clear });
    await settled();
    const back = names(app);
    // All three back, not the book's order: the list re-sorts what it holds, an equal score keeping its place (goal/G29.6).
    if (back.length === 3 && box.value === '') test.check('the ✕ emptied the box and all three are back');
    else test.fail(OWED + 'after the ✕ the list shows ' + JSON.stringify(back) + ' and the box says ' + JSON.stringify(box.value));
  } else test.fail(OWED + 'no ✕ at the right of the picker\'s box');
})().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
});
