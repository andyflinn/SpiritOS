'use strict';

// goal/G2.7: the book search in Contacts filters the visible list. Red on today's tree.
//   Found by Andy, 2026-10-02: "now to the contacts shell app, the search there does nothing" — the bar adds each
//   typed query to the shown set (contactsBookQueries, primed with *), so with everyone shown a name adds nothing.
//   RULED (Andy, verbatim): "hmm, i kind of expect for the search term to remain in the search box, and while it
//   remains, it also filters the visible list. would help me find even contacts withing the list." and "do you know
//   those search boxes that leave the search term, with a little closing button on the right that removes the input?"
// The contract the builder follows (the shape read back and recorded in goal/G2.7):
//   1. The term stays in the box; while it stands, the table shows only the rows matching it, live as he types
//      (an input event, no Search press needed).
//   2. A small × at the right of the box (id contacts-book-clear, fixed here) clears the term and brings the whole
//      list back; Escape in the box does the same.
//   3. The network search below is untouched; the * priming stays for the empty box.
// Driven as spirit/test/contacts.js drives the app: the script loaded with fake document, api and fetch, the fake
// answering contact.search the way the node would (hub.searchPeople), and its real handlers fired.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const spirit = require('../run/js/kernel.js');
const hubModule = require('../run/js/hub.js');

const OWED = 'OWED by goal/G2.7: ';
const APP_SCRIPT = path.join(__dirname, '..', 'run', 'shell', 'contacts', 'contacts.js');
const BERT = 'MCowBQYDK2VwAyEAbertbertbertbertbertbertbertbertbertb=';
const CAROL = 'MCowBQYDK2VwAyEAcarolcarolcarolcarolcarolcarolcaro=';
const DAVE = 'MCowBQYDK2VwAyEAdavedavedavedavedavedavedavedavedave=';

function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', style: {}, dataset: {}, children: [], listeners: {}, hidden: false,
    addEventListener: function (event, fn) { (el.listeners[event] = el.listeners[event] || []).push(fn); },
    appendChild: function (child) { el.children.push(child); return child; },
    fire: function (event, arg) { (el.listeners[event] || []).forEach(function (fn) { fn(arg || {}); }); },
    click: function () { el.fire('click'); }, focus: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); el.children.length = 0; }, enumerable: true });
  return el;
}
function fakeDocument() {
  const byId = {};
  return { byId: byId, activeElement: null, getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); }, createElement: fakeElement };
}
function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }
async function settled() { for (let i = 0; i < 8; i++) await settle(); }

function mountApp(people) {
  const doc = fakeDocument();
  const fakeFetch = function (url, init) {
    let verb = '';
    try { verb = JSON.parse(String((init && init.body) || '{}')).verb || ''; } catch (e) { verb = ''; }
    const sent = (function () { try { return JSON.parse((init && init.body) || '{}'); } catch (e) { return {}; } })();
    let answer;
    if (verb === 'contact.search') { const r = hubModule.searchPeople(people, sent.q); answer = { ok: true, items: r.items, more: r.more, selfTail: null }; }
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
  new Function('spirit', 'document', 'window', 'fetch', fs.readFileSync(APP_SCRIPT, 'utf8'))(shellSpirit, doc, {}, fakeFetch);
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
  };
  behavior.mount(fakeElement('container'), api, null);
  return { doc: doc };
}
function person(key, label) { return { publicKey: key, publicLabel: label, caption: label, myLabel: '', choice: 'added', blocked: false, present: null }; }
function names(app) {
  const html = app.doc.getElementById('contacts-tbody').innerHTML;
  return ['Bert', 'Carol', 'Dave'].filter(function (n) { return html.indexOf(n) !== -1; });
}

test.startTest('goal/G2.7: the book search filters the visible list, the term stays, × clears it');

(async function () {
  const app = mountApp([person(BERT, 'Bert'), person(CAROL, 'Carol'), person(DAVE, 'Dave')]);
  await settled();
  const box = app.doc.getElementById('contacts-book-q');

  test.subHeading('the whole book first, by the * search');
  if (names(app).length === 3) test.check('Bert, Carol and Dave are shown');
  else test.fail(OWED + 'the book shows ' + JSON.stringify(names(app)) + ' — the red cannot see the table it means to filter');

  test.subHeading('1. a term in the box filters the list live, and stays');
  box.value = 'carol';
  box.fire('input', { target: box });
  await settled();
  const shown = names(app);
  if (shown.length === 1 && shown[0] === 'Carol' && box.value === 'carol') test.check('typing carol shows Carol alone, and the box still says carol');
  else test.fail(OWED + 'after typing carol the table shows ' + JSON.stringify(shown) + ' and the box says ' + JSON.stringify(box.value));

  test.subHeading('2. the × clears the term and the whole list is back; Escape does the same');
  const clear = app.doc.byId['contacts-book-clear'];
  if (clear && clear.listeners.click) {
    clear.fire('click', {});
    await settled();
    const back = names(app);
    if (back.length === 3 && box.value === '') test.check('the × emptied the box and all three are back');
    else test.fail(OWED + 'after the × the table shows ' + JSON.stringify(back) + ' and the box says ' + JSON.stringify(box.value));
  } else test.fail(OWED + 'no × (contacts-book-clear) with a click handler at the right of the box');
  box.value = 'dave';
  box.fire('input', { target: box });
  await settled();
  box.fire('keydown', { key: 'Escape', preventDefault: function () {} });
  await settled();
  if (names(app).length === 3 && box.value === '') test.check('Escape in the box clears it and the whole list is back');
  else test.fail(OWED + 'after Escape the table shows ' + JSON.stringify(names(app)) + ' and the box says ' + JSON.stringify(box.value));
})().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
});
