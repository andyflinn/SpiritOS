'use strict';

// spirit/test/listSearch.js
// goal/G29.4: THE LIST-SEARCH CONTAINER, a shell element: a list with its search, the same everywhere it is used.
// Red on today's tree; claude-windows wrote it and builds it. The item's box (v8), in short:
//   LAYOUT: [filters: icons, or word + icon] / [search input, its clear button inside it on the right] [search
//   button] / [count line] / [list].
//   CONFIGURATION: one plain object given at creation, callbacks in it, no registry:
//   shellCreateListSearch(container, { server, verb, args(text, filters), filters: [{ name, choices: [{ value, icon,
//   word }], test(row, value) }], paint(row), press(row), empty }). A row is the object an answer item's label carries.
//   test answers a probability that only lowers. WHERE IT LIVES: shell/shared/js/listSearch.js. WHAT EVERY SEARCH IT
//   CALLS ANSWERS: {items: [{key, label}], more, total}, key the identity of what the row shows.
//   BEHAVIOUR: rows keyed by the answer's key; every row kept in an unbounded probabilityBucket; each character typed
//   or erased redraws the list from the cache at once, scored by probabilityStringObjectMatch times every filter's
//   test and handed to bucket.sort; the server calls MUST be serialized, no typing pause; the count line says how
//   many match and that the answer was partial.
//
// THE ONE KEY ADDED IN BUILDING: api, the shell api the app was mounted with, through which the element asks its
// server (api.verb('jobs.api', {ask: {<server>: {<verb>: args}}}), as Desk asks) and hears its stream
// (api.onPublished(fn, server)), as deskElement takes the app's subscribe. Without it the element can reach nothing.
//
// rule/11: through testSupport only. No server: the api is a fake that counts what it is asked.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G29.4: ';
const RUN = path.join(__dirname, '..', 'run');
const FILE = path.join(RUN, 'shell', 'shared', 'js', 'listSearch.js');

const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
const short = function (x) { const s = typeof x === 'string' ? x : JSON.stringify(x); return s && s.length > 300 ? s.slice(0, 300) + '…' : s; };

function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, style: {}, listeners: {},
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    getAttribute: function () { return null; }, setAttribute: function () {}, appendChild: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}

// A page: the three probability modules as index.html loads them, spied on, and the element's file.
function page() {
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); }, createElement: function () { return fakeElement(''); }, body: fakeElement('body') };
  const win = {};
  ['probabilityStringMatch.js', 'probabilityStringObjectMatch.js', 'probabilityBucket.js'].forEach(function (f) {
    new Function('window', 'module', fs.readFileSync(path.join(RUN, 'js', f), 'utf8'))(win, undefined);
  });
  const spy = { buckets: [], sorts: 0, objectMatches: 0 };
  const P = win.spiritProbability;
  const realObj = P.probabilityStringObjectMatch;
  P.probabilityStringObjectMatch = function () { spy.objectMatches += 1; return realObj.apply(null, arguments); };
  const realBucket = P.createProbabilityBucket;
  P.createProbabilityBucket = function (capacity) {
    const b = realBucket(capacity);
    spy.buckets.push(capacity);
    const realSort = b.sort;
    b.sort = function () { spy.sorts += 1; return realSort.apply(b, arguments); };
    return b;
  };
  return { byId: byId, doc: doc, win: win, spy: spy };
}

// The api a shell app is mounted with: verb('jobs.api', {ask: {server: {verb: args}}}) answers the fake server's
// search; onPublished(fn, server) hands the element the server's stream.
function fakeApi(answer, delayMs) {
  const api = { asked: [], inFlight: 0, maxInFlight: 0, heard: [], streams: [] };
  api.verb = function (name, body) {
    const ask = body && body.ask;
    const server = ask && Object.keys(ask)[0];
    const verb = server && Object.keys(ask[server])[0];
    const args = verb && ask[server][verb];
    api.asked.push({ name: name, server: server, verb: verb, args: args, at: Date.now() });
    api.inFlight += 1;
    api.maxInFlight = Math.max(api.maxInFlight, api.inFlight);
    return new Promise(function (resolve) {
      setTimeout(function () { api.inFlight -= 1; resolve({ status: 200, body: answer(args) }); }, delayMs || 0);
    });
  };
  api.onPublished = function (fn, server) { api.streams.push(server); api.heard.push(fn); return function () {}; };
  return api;
}

const ROWS = {
  r1: { suite: 'zzA.js', title: 'the relay answers its key #1', outcome: 'red' },
  r2: { suite: 'zzB.js', title: 'a door stays shut #1', outcome: 'green' },
  r3: { suite: 'zzC.js', title: 'the gate holds #2', outcome: 'red' },
};
const pairs = function (keys, labels) { return keys.map(function (k) { return { key: k, label: JSON.stringify((labels && labels[k]) || ROWS[k]) }; }); };

function config(api, extra) {
  return Object.assign({
    api: api,
    server: 'desk',
    verb: 'fallout.reds',
    args: function (text, filters) { return { text: text, outcome: filters.outcome }; },
    filters: [{ name: 'outcome', choices: [{ value: 'red', icon: '❌', word: 'fail' }, { value: 'green', icon: '✅', word: 'success' }, { value: '', word: 'both' }],
      test: function (row, value) { return !value || row.outcome === value ? 1 : 0; } }],
    paint: function (row) { return '<td>' + row.suite + '</td><td>' + row.title + '</td>'; },
    press: function () {},
    empty: 'No test matches.',
  }, extra || {});
}

// The element's own parts, found by what they are in the markup it drew.
function parts(p, container) {
  const ids = (container.innerHTML.match(/id="([^"]+)"/g) || []).map(function (s) { return s.slice(4, -1); });
  const find = function (re) { const id = ids.filter(function (i) { return re.test(i); })[0]; return id ? p.doc.getElementById(id) : null; };
  return { ids: ids, text: find(/text$/), clear: find(/clear$/), search: find(/search$/), count: find(/count$/), list: find(/list$/) };
}
const typeInto = function (container, input, v) { input.value = v; container.fire('input', { target: { id: input.id, getAttribute: function () { return null; } } }); };
const rowsShown = function (el) { return el ? ((el.innerHTML.match(/<tr[\s>]/g) || []).length) : 0; };

test.startTest('goal/G29.4: shellCreateListSearch, the list with its search');

(async function main() {
  test.subHeading('1. where it lives');
  if (!fs.existsSync(FILE)) { test.fail(OWED + 'no shell/shared/js/listSearch.js'); test.reportSuccessFailureCount(); process.exit(0); }
  test.check('shell/shared/js/listSearch.js exists');
  const p = page();
  try { new Function('document', 'window', fs.readFileSync(FILE, 'utf8'))(p.doc, p.win); } catch (e) { test.fail(OWED + 'the file does not load in a page: ' + e.message); }
  const make = p.win.spiritElements && p.win.spiritElements.shellCreateListSearch;
  if (typeof make === 'function') test.check('it adds window.spiritElements.shellCreateListSearch, as the shared elements do');
  else { test.fail(OWED + 'no window.spiritElements.shellCreateListSearch'); test.reportSuccessFailureCount(); process.exit(0); }

  // Answers: the empty words bring r1 and r2; "gate" brings r3; a second answer for r1 changes its label.
  let r1Label = ROWS.r1;
  const api = fakeApi(function (args) {
    const keys = args && args.text === 'gate' ? ['r3'] : ['r1', 'r2'];
    return { items: pairs(keys, { r1: r1Label }), more: args && args.text === '', total: keys.length + (args && args.text === '' ? 10 : 0) };
  }, 5);
  const pressed = [];
  const box = fakeElement('box');
  make(box, config(api, { press: function (row) { pressed.push(row); } }));
  const el = parts(p, box);

  test.subHeading('2. its layout, the same everywhere');
  const html = box.innerHTML;
  const atFilter = html.indexOf('❌');
  const atText = el.text ? html.indexOf('id="' + el.text.id + '"') : -1;
  const atClear = el.clear ? html.indexOf('id="' + el.clear.id + '"') : -1;
  const atSearch = el.search ? html.indexOf('id="' + el.search.id + '"') : -1;
  const atCount = el.count ? html.indexOf('id="' + el.count.id + '"') : -1;
  const atList = el.list ? html.indexOf('id="' + el.list.id + '"') : -1;
  if (atFilter !== -1 && html.indexOf('✅') !== -1 && /both/.test(html) && atText > atFilter && atClear > atText && atSearch > atClear && atCount > atSearch && atList > atCount) test.check('filters drawn from their declaration, then the input, its clear button, the search button, the count line, the list');
  else test.fail(OWED + 'the layout reads: filter ' + atFilter + ', text ' + atText + ', clear ' + atClear + ', search ' + atSearch + ', count ' + atCount + ', list ' + atList + ' in ' + short(html));
  const wrap = html.slice(0, atSearch === -1 ? html.length : atSearch);
  if (atText !== -1 && atClear !== -1 && /position:\s*relative/.test(wrap) && /position:\s*absolute[^"]*right/.test(html.slice(atClear - 200, atClear + 200))) test.check('the clear button sits inside the search box, on the right');
  else test.fail(OWED + 'the clear button is not inside the search box on the right: ' + short(wrap));

  test.subHeading('3. it asks its server through the api, at once');
  const t0 = Date.now();
  typeInto(box, el.text, '');
  const first = api.asked[0];
  if (first && first.name === 'jobs.api' && first.server === 'desk' && first.verb === 'fallout.reds' && first.args && first.args.text === '' && first.args.outcome === 'red' && first.at - t0 < 5) test.check('the first character asks api.verb(jobs.api, {ask: {desk: {fallout.reds: args(text, filters)}}}) at once, no typing pause');
  else test.fail(OWED + 'asked ' + short(api.asked));
  await sleep(40);
  if (rowsShown(el.list) === 1 && /the relay answers its key/.test(el.list.innerHTML) && !/a door stays shut/.test(el.list.innerHTML)) test.check('rows are painted by paint(row), the ❌ filter testing each one: r1 shown, the green r2 left out');
  else test.fail(OWED + 'the list reads ' + short(el.list && el.list.innerHTML));
  if (el.count && /\b12\b/.test(el.count.textContent) && /partial|more/i.test(el.count.textContent)) test.check('the count line says how many match in all, and that the answer was partial: ' + el.count.textContent);
  else test.fail(OWED + 'the count line reads ' + short(el.count && el.count.textContent));

  test.subHeading('4. one cache, keyed, ranked as typed');
  typeInto(box, el.text, 'gate');
  await sleep(40);
  typeInto(box, el.text, '');
  const atOnce = el.list.innerHTML;
  if (/the gate holds/.test(atOnce) && /the relay answers its key/.test(atOnce)) test.check('erasing the words redraws from the cache at once: what "gate" brought is still there');
  else test.fail(OWED + 'after erasing, the list at once reads ' + short(atOnce));
  typeInto(box, el.text, 'gate');
  const ranked = el.list.innerHTML;
  if (ranked.indexOf('the gate holds') !== -1 && ranked.indexOf('the relay answers') > ranked.indexOf('the gate holds')) test.check('typing ranks the cache at once: the row the words match on top, every other row below');
  else test.fail(OWED + 'typing gate, the list at once reads ' + short(ranked));
  if (p.spy.buckets.length && p.spy.buckets.every(function (c) { return c === Infinity; }) && p.spy.sorts > 0 && p.spy.objectMatches > 0) test.check('the cache is an unbounded probabilityBucket, sorted by probabilityStringObjectMatch');
  else test.fail(OWED + 'buckets ' + short(p.spy.buckets) + ', sorts ' + p.spy.sorts + ', object matches ' + p.spy.objectMatches);
  await sleep(40);
  r1Label = Object.assign({}, ROWS.r1, { title: 'the relay answers its key #1, renamed' });
  typeInto(box, el.text, '');
  await sleep(40);
  const relays = (el.list.innerHTML.match(/the relay answers its key/g) || []).length;
  if (relays === 1 && /renamed/.test(el.list.innerHTML)) test.check('a row a later search brings again replaces the older one, by its key');
  else test.fail(OWED + relays + ' relay rows, the list reads ' + short(el.list.innerHTML));

  test.subHeading('5. the server calls are serialized');
  const slow = fakeApi(function (args) { return { items: pairs(['r1']), more: false, total: 1, text: args && args.text }; }, 60);
  const box2 = fakeElement('box2');
  make(box2, config(slow));
  const el2 = parts(p, box2);
  typeInto(box2, el2.text, 'a');
  typeInto(box2, el2.text, 'ab');
  typeInto(box2, el2.text, 'abc');
  await sleep(250);
  const texts = slow.asked.map(function (a) { return a.args && a.args.text; });
  if (slow.maxInFlight === 1) test.check('at most one request of the element on the wire at a time');
  else test.fail(OWED + slow.maxInFlight + ' requests were in flight at once');
  if (texts.length === 2 && texts[0] === 'a' && texts[1] === 'abc') test.check('one asked meanwhile goes next, with the latest words: ' + short(texts));
  else test.fail(OWED + 'the server was asked ' + short(texts));

  test.subHeading('6. the configuration does what it says');
  el.list.fire && box.fire('click', { target: { id: '', getAttribute: function (n) { return n === 'data-key' ? 'r3' : null; }, closest: function () { return null; } } });
  if (pressed.length === 1 && pressed[0].title === ROWS.r3.title) test.check('a press on a row calls press(row) with that row');
  else test.fail(OWED + 'press got ' + short(pressed));
  el.text.value = 'gate';
  box.fire('click', { target: { id: el.clear.id, getAttribute: function () { return null; } } });
  if (el.text.value === '' && rowsShown(el.list) >= 2) test.check('the clear button empties the search box and redraws every row');
  else test.fail(OWED + 'after clear: box "' + el.text.value + '", ' + rowsShown(el.list) + ' rows');
  const halfBox = fakeElement('box3');
  const halfApi = fakeApi(function () { return { items: pairs(['r1', 'r3']), more: false, total: 2 }; }, 0);
  make(halfBox, config(halfApi, { filters: [{ name: 'outcome', choices: [{ value: 'red', icon: '❌', word: 'fail' }], test: function (row) { return row.suite === 'zzA.js' ? 0.1 : 1; } }] }));
  const el3 = parts(p, halfBox);
  typeInto(halfBox, el3.text, '');
  await sleep(20);
  const h = el3.list.innerHTML;
  if (h.indexOf('the gate holds') !== -1 && h.indexOf('the relay answers') > h.indexOf('the gate holds')) test.check('a filter\'s test lowers a row: at 0.1 it stays, below the one at 1');
  else test.fail(OWED + 'with a lowering filter the list reads ' + short(h));
  const emptyBox = fakeElement('box4');
  const emptyApi = fakeApi(function () { return { items: [], more: false, total: 0 }; }, 0);
  make(emptyBox, config(emptyApi));
  const el4 = parts(p, emptyBox);
  typeInto(emptyBox, el4.text, 'nothing');
  await sleep(20);
  if (/No test matches\./.test(el4.list.innerHTML)) test.check('an empty list says the configured sentence');
  else test.fail(OWED + 'the empty list reads ' + short(el4.list.innerHTML));

  test.subHeading('7. it hears its server');
  const before = api.asked.length;
  if (api.streams.indexOf('desk') !== -1 && api.heard.length) {
    api.heard[0]({ change: 1 });
    await sleep(40);
    if (api.asked.length === before + 1) test.check('it subscribes to its server\'s stream, and a publish asks the server again with the words as they stand');
    else test.fail(OWED + 'a publish asked ' + (api.asked.length - before) + ' times');
  } else test.fail(OWED + 'it never subscribed: streams ' + short(api.streams));

  test.reportSuccessFailureCount();
  process.exit(0);
}()).catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
