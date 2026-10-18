'use strict';

// spirit/test/grantsSharedList.js
// goal/G29.7: Grants on the shared list. Red on today's tree; claude-windows writes it and builds it (one agent). The
// item's box (v7), in short:
//   THE LINE: one line at the top, nothing stacked: [whose access] [choose a server] [choose a verb] [Grant]; the three
//   selectors are dropdowns of the shared list (the server and verb selectors leave their native selects); the verb
//   selector shows only once a server is chosen; the selectors are filters, one left unchosen meaning all; Grant grants
//   what the line names (a peer and a server, one verb or all of them).
//   THE SEARCH AND THE TABLE: the search bar below the line searches within the line's filters, ranked as every search
//   is; below it the grants in a small table: the peer's name, the path, deprecated when no server serves it today,
//   each row's own Revoke. The page holds the grants (jobs.authSearch with no words) and ranks them itself.
//   jobs.authSearch moves to the new search: words ranked by the probability modules, each grant answered as a json
//   label {name, key, path}; its old search goes.
//
// NAMED HERE where the box names none (argue them in Desk first if the build disagrees):
//   - jobs.authSearch answers {items: [{key: key + '\n' + path, label: json {name, key, path}}], more}.
//   - createContactSelector({ all }) and createAppServerSelector({ all }) offer a first row with key '' named by all;
//     createApiBranchSelector's root carries server and verb ('' for all) beside value (the path: 'app' when no verb
//     is chosen, 'app.verb' when one is).
//   - grants.js draws the line in an element with id gr-line, display flex, and the table in gr-list.
// rule/11: through testSupport only; its own folders; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');

const OWED = 'OWED by goal/G29.7: ';
const RUN = path.join(__dirname, '..', 'run');
const ALICE = 'MCowBQYDK2VwAyEAgrantsKeyOneQQQQQQQQQQQQQQQQQQQQQQQQQQQQ=';
const BOB = 'MCowBQYDK2VwAyEAgrantsKeyTwoZZZZZZZZZZZZZZZZZZZZZZZZZZZZ=';

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }
function settle() { return new Promise(function (r) { setTimeout(r, 15); }); }
function parse(s) { try { return JSON.parse(s); } catch (e) { return null; } }
function code(file) { try { return fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); } catch (e) { return ''; } }

test.startTest('goal/G29.7: Grants on the shared list: one line of filters, a search within them, a table below');

// A small DOM: elements by createElement, events bubbling along parentNode, getElementById over everything made.
function page() {
  const byId = {};
  const made = [];
  const node = function (tag) {
    let html = '';
    const e = { tagName: String(tag || 'div').toUpperCase(), id: '', children: [], style: {}, listeners: {}, parentNode: null, hidden: false, className: '', value: '', attrs: {},
      appendChild: function (c) { if (c.parentNode) c.parentNode.children = c.parentNode.children.filter(function (x) { return x !== c; }); e.children.push(c); c.parentNode = e; return c; },
      insertBefore: function (c) { return e.appendChild(c); },
      addEventListener: function (t, fn) { (e.listeners[t] = e.listeners[t] || []).push(fn); },
      removeEventListener: function () {},
      dispatchEvent: function (ev) { for (let n = e; n; n = n.parentNode) (n.listeners[ev.type] || []).slice().forEach(function (fn) { fn(ev); }); return true; },
      setAttribute: function (k, v) { e.attrs[k] = String(v); if (k === 'id') e.id = String(v); }, getAttribute: function (k) { return e.attrs[k] === undefined ? null : e.attrs[k]; },
      focus: function () {}, contains: function (x) { for (let n = x; n; n = n.parentNode) if (n === e) return true; return false; },
      querySelector: function () { return null; }, closest: function () { return null; } };
    Object.defineProperty(e, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); e.children = []; } });
    made.push(e);
    return e;
  };
  const doc = { createElement: node, getElementById: function (id) { if (!byId[id]) { byId[id] = node('div'); byId[id].id = id; } return byId[id]; },
    addEventListener: function () {}, removeEventListener: function () {}, querySelector: function () { return null; } };
  return { doc: doc, node: node, byId: byId, made: made };
}

(async function () {
  // ── 1. the node ──
  test.subHeading('1. jobs.authSearch on the new search');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-grants-'));
  try {
    const store = require('../run/js/nodeStore').open(root).auth;
    store.grant(ALICE, 'desk.item.get', 'alice');
    store.grant(ALICE, 'chatter', 'alice');
    store.grant(BOB, 'desk', 'bob');
    const auth = require('../run/js/apiAuth').createApiAuth({ rootDir: root });
    const all = auth.search({ text: '' });
    const rows = ((all && all.items) || []).map(function (i) { return { key: i.key, label: parse(i.label) }; });
    if (rows.length === 3 && rows.every(function (r) { return r.label && r.label.name && r.label.key && r.label.path && r.key === r.label.key + '\n' + r.label.path; })) test.check('no words: every grant, each {key: key + newline + path, label: {name, key, path}}');
    else test.fail(OWED + 'jobs.authSearch with no words answered ' + short(all));
    const found = auth.search({ text: 'alice desk' });
    const top = parse(((found && found.items) || [])[0] && found.items[0].label) || {};
    if (top.name === 'alice' && top.path === 'desk.item.get') test.check('words ranked best first: alice desk puts alice\'s desk.item.get on top');
    else test.fail(OWED + 'alice desk answered ' + short(found));
    const keyCut = auth.search({ text: ALICE.slice(20, 34) });
    if (!((keyCut && keyCut.items) || []).length) test.check('the key itself is never matched');
    else test.fail(OWED + 'a cut of the key found ' + short(keyCut));
    if (!/searchBucket/.test(code(path.join(RUN, 'js', 'apiAuth.js')))) test.check('apiAuth.js holds no old search (searchBucket gone from it)');
    else test.fail(OWED + 'apiAuth.js still requires searchBucket');
  } catch (e) {
    test.fail(OWED + 'the store could not be searched: ' + (e && e.message || e));
  } finally { try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* scratch */ } }
  const server = code(path.join(RUN, 'js', 'server.js'));
  if (/'jobs\.authSearch':\s*\{\s*request:\s*\{\s*text:\s*''\s*\},\s*reply:\s*LIST/.test(server)) test.check('server.js declares jobs.authSearch {text} answering LIST');
  else test.fail(OWED + 'server.js declares ' + short((/'jobs\.authSearch':[^\n]*/.exec(server) || [''])[0]));
  const fileServer = code(path.join(RUN, 'process', 'js', 'fileServer', 'fileServer.js'));
  if (/jobs\.authSearch[\s\S]{0,400}\.items/.test(fileServer) && !/found\.records/.test(fileServer)) test.check('the file server reads the new answer (items) when it moves grants');
  else test.fail(OWED + 'fileServer.js still reads records from jobs.authSearch');

  // ── 2. the page ──
  test.subHeading('2. Grants: one line of filters, a search within them, a table below');
  const p = page();
  const win = {};
  ['probabilityStringMatch.js', 'probabilityStringObjectMatch.js', 'probabilityBucket.js'].forEach(function (f) {
    new Function('window', 'module', fs.readFileSync(path.join(RUN, 'js', f), 'utf8'))(win, undefined);
  });
  win.spiritApiTreeIndex = require(path.join(RUN, 'js', 'client', 'apiTreeIndex.js'));
  const VERB = { request: {}, reply: { x: '' } };
  const TREE = { desk: { 'item.get': VERB, 'item.add': VERB }, chatter: { 'chat.add': VERB } };
  const GRANTS = [{ name: 'alice', key: ALICE, path: 'desk.item.get' }, { name: 'alice', key: ALICE, path: 'chatter' }, { name: 'bob', key: BOB, path: 'desk' }];
  const asked = [];
  const answer = function (body) { return Promise.resolve({ status: 200, body: body }); };
  const ask = function (verb, body) {
    asked.push({ verb: verb, body: body || {} });
    if (verb === 'jobs.api') return answer(body && body.ask === 'api' ? TREE : { paths: [] });
    if (verb === 'jobs.authSearch') return answer({ items: GRANTS.map(function (g) { return { key: g.key + '\n' + g.path, label: JSON.stringify(g) }; }), more: false });
    if (verb === 'jobs.authGrant') return answer({ key: body.key, label: 'alice', path: body.path });
    if (verb === 'contact.search') return answer({ items: [{ key: ALICE, label: JSON.stringify({ name: 'alice', owned: false, blocked: false, held: false }) }, { key: BOB, label: JSON.stringify({ name: 'bob', owned: false, blocked: false, held: false }) }], more: false });
    return answer({});
  };
  const sp = { core: { ask: ask, util: { escapeHtml: kernel.core.util.escapeHtml, formatBytes: kernel.core.util.formatBytes }, const: { ICON: kernel.core.const.ICON } },
    shell: { activateApp: function (x) { sp.app = x; } } };
  const load = function (rel, names) { new Function('spirit', 'document', 'window', 'Event', fs.readFileSync(path.join(RUN, rel), 'utf8'))(sp, p.doc, win, Event); };
  try {
    new Function('document', 'window', fs.readFileSync(path.join(RUN, 'shell', 'shared', 'js', 'listSearch.js'), 'utf8'))(p.doc, win);
    load('shell/js/contactSelector.js');
    load('shell/js/appServerSelector.js');
    load('shell/js/apiBranchSelector.js');
    load('shell/grants/grants.js');
  } catch (e) { test.fail(OWED + 'the page did not load: ' + (e && e.message || e)); }
  const container = p.node('div');
  const api = { escapeHtml: kernel.core.util.escapeHtml, verb: function (v, b) { return ask(v, b); }, ui: { elements: win.spiritElements } };
  try { sp.app.mount(container, api); } catch (e) { test.fail(OWED + 'Grants did not mount: ' + (e && e.stack || e)); }
  await settle(); await settle(); await settle();

  const line = p.byId['gr-line'];
  const kinds = line ? line.children.map(function (c) { return /contact-selector/.test(c.className) ? 'contact' : /api-branch-selector/.test(c.className) ? 'branch' : c.tagName === 'BUTTON' || /gr-grant/.test(c.id) ? 'grant' : c.className || c.tagName; }) : [];
  if (line && /flex/.test(String(line.style.display || line.getAttribute('style') || '')) && kinds.slice(0, 3).join(' ') === 'contact branch grant') test.check('one line, gr-line, display flex: [whose access] [server and verb] [Grant]');
  else test.fail(OWED + 'the line is ' + short({ line: !!line, display: line && (line.style.display || line.getAttribute('style')), children: kinds }));
  const branchRoot = line && line.children.filter(function (c) { return /api-branch-selector/.test(c.className); })[0];
  const branchHtml = branchRoot ? p.made.filter(function (n) { let x = n; while (x && x !== branchRoot) x = x.parentNode; return x === branchRoot; }).map(function (n) { return n.innerHTML; }).join(' ') : '';
  if (branchRoot && /listsearch-\d+-field/.test(branchHtml) && !p.made.some(function (n) { return n.tagName === 'SELECT'; })) test.check('the server and verb selectors are shared-list dropdowns; no native select is made');
  else test.fail(OWED + 'native selects made: ' + p.made.filter(function (n) { return n.tagName === 'SELECT'; }).length + '; branch markup ' + short(branchHtml.slice(0, 200)));
  const verbBox = branchRoot && branchRoot.children[1];
  if (verbBox && verbBox.hidden === true) test.check('the verb selector is hidden until a server is chosen');
  else test.fail(OWED + 'the verb selector before a server: ' + short(verbBox ? { hidden: verbBox.hidden } : 'none'));

  // The table: every grant with nothing chosen.
  const listEl = function () { return p.made.filter(function (n) { return /id="listsearch-\d+-text"/.test(n.innerHTML) && n.parentNode && (n.parentNode.id === 'gr-list' || (n.parentNode.parentNode && n.parentNode.parentNode.id === 'gr-list')); })[0]; };
  const host = listEl();
  const pre = host && (/id="(listsearch-\d+-)text"/.exec(host.innerHTML) || [])[1];
  const rowsNow = function () { return ((pre && p.byId[pre + 'list'] ? p.byId[pre + 'list'].innerHTML : '').match(/data-key="[^"]*"/g) || []).map(function (s) { return s.slice(10, -1); }); };
  if (host && rowsNow().length === 3) test.check('the table under the line: all three grants with nothing chosen');
  else test.fail(OWED + 'the table: host ' + !!host + ', rows ' + short(rowsNow()));
  const table = pre && p.byId[pre + 'list'] ? p.byId[pre + 'list'].innerHTML : '';
  if (/gr-revoke/.test(table) && /bob/.test(table) && /desk\.item\.get/.test(table)) test.check('each row: the peer\'s name, the path, its own Revoke');
  else test.fail(OWED + 'a row reads ' + short(table.slice(0, 300)));

  // Choose the server desk: the list narrows, the verb selector shows.
  const serverRoot = branchRoot && branchRoot.children[0];
  const pick = function (rootEl, key) {
    const h = p.made.filter(function (n) { let x = n; while (x && x !== rootEl) x = x.parentNode; return x === rootEl && /listsearch-\d+-field/.test(n.innerHTML); })[0];
    const pr = h && (/id="(listsearch-\d+-)field"/.exec(h.innerHTML) || [])[1];
    if (!h || !pr) return false;
    h.dispatchEvent({ type: 'click', target: p.byId[pr + 'field'] });
    h.dispatchEvent({ type: 'click', target: { id: '', getAttribute: function (k) { return k === 'data-key' ? key : null; }, closest: function () { return null; } } });
    return true;
  };
  const picked = serverRoot ? pick(serverRoot, 'desk') : false;
  await settle();
  const deskRows = rowsNow();
  if (picked && deskRows.length === 2 && deskRows.every(function (k) { return /\ndesk/.test(k.replace(/&#10;|\\n/g, '\n')) || /desk/.test(k); }) && verbBox && verbBox.hidden === false) test.check('choosing the server desk narrows the table to desk\'s grants and shows the verb selector');
  else test.fail(OWED + 'after choosing desk: picked ' + picked + ', rows ' + short(deskRows) + ', verb hidden ' + (verbBox && verbBox.hidden));
  // Andy, 2026-10-18: "get those two selector, server and verb NEXT to each other, not stacked". The pair is one inline
  // row: the branch selector lays its two halves out side by side, the server half never a block of its own.
  const inlineOf = function (el) { return String((el && (el.style.display || el.getAttribute('style'))) || ''); };
  if (/inline-flex|^flex/.test(inlineOf(branchRoot)) && /inline/.test(inlineOf(serverRoot))) test.check('server and verb stand side by side: the branch selector is an inline row, the server half inline');
  else test.fail(OWED + 'the branch selector displays ' + short(inlineOf(branchRoot)) + ', its server half ' + short(inlineOf(serverRoot)));
  // Andy, 2026-10-18: "Ah, you smuggled them in like that was a peer-label or a server-label.... Those selection option
  // need to be very different from the rest of the options otherwise they're not recognized....". The shared list
  // draws the none-row itself (options.all): pinned first whatever is typed, its own class list-all, set apart.
  const p2 = page();
  const w2 = {};
  ['probabilityStringMatch.js', 'probabilityStringObjectMatch.js', 'probabilityBucket.js'].forEach(function (f) {
    new Function('window', 'module', fs.readFileSync(path.join(RUN, 'js', f), 'utf8'))(w2, undefined);
  });
  new Function('document', 'window', fs.readFileSync(path.join(RUN, 'shell', 'shared', 'js', 'listSearch.js'), 'utf8'))(p2.doc, w2);
  const box2 = p2.node('span');
  const picks = [];
  const dd = w2.spiritElements.shellCreateListSearch(box2, { mode: 'dropdown', all: 'all servers',
    rows: function () { return [{ key: 'desk', name: 'desk' }, { key: 'allServersTool', name: 'all servers tool' }]; },
    paint: function (row, mark) { return '<td>' + mark(row.name) + '</td>'; }, pick: function (row, key) { picks.push(key); } });
  const pre2 = (/id="(listsearch-\d+-)field"/.exec(box2.innerHTML) || [])[1];
  if (pre2) box2.dispatchEvent({ type: 'click', target: p2.byId[pre2 + 'field'] });
  const t2 = pre2 && p2.byId[pre2 + 'text'];
  if (t2) { t2.value = 'all servers'; box2.dispatchEvent({ type: 'input', target: t2 }); }
  await settle();
  const ddList = pre2 && p2.byId[pre2 + 'list'] ? p2.byId[pre2 + 'list'].innerHTML : '';
  const firstTr = (/<tr[^>]*>/.exec(ddList) || [''])[0];
  if (/class="[^"]*\blist-all\b/.test(firstTr) && /data-key=""/.test(firstTr)) test.check('the none-row is the shared list\'s own: first, class list-all, even with words that rank a real row named like it');
  else test.fail(OWED + 'the first row is ' + short(firstTr) + ' in ' + short(ddList.slice(0, 200)));
  if (/font-style:\s*italic/.test(ddList.slice(0, 600)) && /border-bottom/.test(ddList.slice(0, 600))) test.check('it is set apart: italic, a line under it');
  else test.fail(OWED + 'the none-row is drawn ' + short(ddList.slice(0, 300)));
  box2.dispatchEvent({ type: 'click', target: { id: '', getAttribute: function (k) { return k === 'data-key' ? '' : null; }, closest: function () { return null; } } });
  await settle();
  if (picks[picks.length - 1] === '' && typeof dd.value === 'string' && dd.value === '') test.check('a press on it picks the empty value');
  else test.fail(OWED + 'a press on the none-row picked ' + short(picks));
  const selSrc = code(path.join(RUN, 'shell', 'js', 'appServerSelector.js')) + code(path.join(RUN, 'shell', 'js', 'contactSelector.js'));
  if (!/unshift\(\s*\{\s*key:\s*''/.test(selSrc)) test.check('the selectors no longer smuggle the none-row in as a row of their own');
  else test.fail(OWED + 'a selector still unshifts its own all row');
  const contactRoot = line && line.children[0];
  const pickedAlice = contactRoot ? pick(contactRoot, ALICE) : false;
  await settle(); await settle();
  const aliceRows = rowsNow();
  if (pickedAlice && aliceRows.length === 1 && aliceRows[0].indexOf(ALICE) === 0) test.check('choosing alice as well narrows it to her one desk grant');
  else test.fail(OWED + 'after choosing alice: picked ' + pickedAlice + ', rows ' + short(aliceRows));

  // Grant what the line names: alice, desk, no verb chosen: the whole server.
  const grantBtn = line && line.children.filter(function (c) { return c.tagName === 'BUTTON'; })[0];
  if (grantBtn) grantBtn.dispatchEvent({ type: 'click', target: grantBtn });
  await settle();
  const g = asked.filter(function (a) { return a.verb === 'jobs.authGrant'; }).pop();
  if (g && g.body.key === ALICE && g.body.path === 'desk') test.check('Grant grants what the line names: alice the whole server desk (no verb chosen)');
  else test.fail(OWED + 'Grant asked ' + short(g || asked.map(function (a) { return a.verb; })));
  if (!asked.some(function (a) { return a.verb === 'jobs.authPeer'; })) test.check('the page holds the grants: no jobs.authPeer is asked');
  else test.fail(OWED + 'the page still asks jobs.authPeer');
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(0); }, 100);
});
