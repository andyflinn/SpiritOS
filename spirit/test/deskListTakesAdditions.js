'use strict';

// goal/G24.6: THE LIST TAKES ADDITIONS FROM THE STREAM.
//   The box: "The List (the table of items) takes additions from the stream: an item added, by Andy or an agent,
//   appears in its place; a changed item's row is replaced; a closed one follows the include-closed toggle." "The row
//   is drawn from what the publish carries, in the order the server gives." "Test: a published new item appears as a
//   row with no items.search asked; a published change replaces its row."
//
// WHAT THE SERVER PUBLISHES, READ AT 6503c0a6 (process/js/desk/desk.js):
//   - after every write: { change, verb, item: facts(item), listed, checks?, rows } (desk.js:1633-1652). `rows` is
//     changedRows (desk.js:1706-1715): the goal and those of its members whose facts or listed changed, in the order
//     [goal].concat(g.members), each facts(...) plus listed.
//   - facts() is exactly what items.search hands the List as each row's label (desk.js:1457, 2053-2057), so a published
//     row carries everything deskRowHtml draws.
//   - item.add appends the new id to its goal's members (desk.js:922, `g.members.push(id)`), and items.search with
//     no text gives every item probability 0 (desk.js:334), so the List's order is the goal, then its members in
//     session order (desk.js:1431-1460, ranked keeps the walk's order among equals, desk.js:339-342). An added item's
//     place in that List is therefore after the last row of its goal: the publish names its goal (`goal`).
//   - listed (desk.js:1227-1232) is false for a closed item; with Include Closed on, items.search still lists it
//     (desk.js:1451-1452), so a closed row stays while the toggle is on.
//
// WHAT THE LIST DOES TODAY (shell/desk/desk.js, deskOnPublished, :481-525): a row it holds is replaced (:520); a row
//   whose listed is false is spliced out whatever Include Closed says (:519); a row it does not hold sets `unknown`
//   and the List asks items.search again (:521-523): the pull the box names.
//
// Driven through the real shell.js (as deskDialogFollowsItem.js and listeningApp.js drive it) with the real Desk face,
// shell/desk/desk.js, evaluated as the browser evaluates the script the shell injected; its server's publishes arrive
// as the node's job updates do. The desk server is a stand-in that answers items.search as desk.js does (the goal,
// then its members, listed or with Include Closed every one) and publishes the objects desk.js publishes. Once the
// List is on screen, every items.search asked is counted and, after a publish, held unanswered: a row that appears
// then was drawn from the publish, not from a pull.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel');
const packet = require('../run/js/client/packet');

const OWED = 'OWED by goal/G24.6: ';
const SHELL = path.join(__dirname, '..', 'run', 'js', 'client', 'shell.js');
const DESK = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const DESK_MANIFEST = fs.readFileSync(path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.json'), 'utf8');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
async function settled() { for (let i = 0; i < 6; i++) await sleep(10); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

function fakeElement(tag) {
  let html = '';
  const attrs = {};
  const el = {
    tag: tag, id: '', className: '', textContent: '', hidden: false, value: '', checked: false, disabled: false, style: {},
    children: [], listeners: {}, parentNode: null,
    appendChild: function (child) { el.children.push(child); return child; },
    removeChild: function () {}, replaceChild: function () {}, remove: function () {}, insertBefore: function (c) { return c; },
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).slice().forEach(function (fn) { fn(event || {}); }); },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    setAttribute: function (k, v) { attrs[k] = String(v); },
    getAttribute: function (k) { return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null; },
    removeAttribute: function (k) { delete attrs[k]; },
    focus: function () {}, scrollTo: function () {},
    classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } },
  };
  Object.defineProperty(el, 'innerHTML', {
    get: function () { return html; },
    set: function (v) { html = String(v); el.children.length = 0; },
    enumerable: true,
  });
  return el;
}

// ── THE DESK SERVER, STAND-IN ───────────────────────────────────────────
// facts() as desk.js:1362-1427 shapes them, the fields the List draws.
function facts(it) {
  return { id: it.id, title: it.title, goal: it.goal, status: it.closed ? 'closed' : it.status, with: '', buttons: it.closed ? ['bring-back'] : [],
    blocking: it.blocking || [], blocked: it.blocked || [], go: false, alone: false, alert: false, claims: 0, boxTaken: '', limbo: false,
    subGoal: false, files: [], green: true, code: false, phase: '', red: '', builder: '', verifier: '', claimCommit: '', redCommit: '',
    waived: false, rules: [], names: {}, asks: 0, half: false, full: false };
}
function deskStandIn() {
  const goal = { id: 'g/G1', title: 'The goal', goal: '', status: '' };
  const items = {};
  items['g/G1'] = goal;
  items['g/G1.1'] = { id: 'g/G1.1', title: 'First', goal: 'g/G1', status: 'ready', blocking: ['g/G1'] };
  items['g/G1.2'] = { id: 'g/G1.2', title: 'Second', goal: 'g/G1', status: 'ready', blocking: ['g/G1'] };
  const members = ['g/G1.1', 'g/G1.2'];
  const desk = { items: items, members: members, change: 10, searches: [], holding: false, held: [], publish: null };
  const goalFacts = function () {
    const f = facts(goal);
    f.blocked = members.filter(function (id) { return !items[id].closed; });
    f.design = false; f.waiting = 0; f.live = []; f.working = []; f.excluded = []; f.agents = {};
    return f;
  };
  const factsOf = function (id) { return id === 'g/G1' ? goalFacts() : facts(items[id]); };
  const listed = function (id) { return !items[id].closed; };
  // items.search, as searchItems (desk.js:1432-1460) with no text: the goal, then its members in session order.
  function search(a) {
    const ids = ['g/G1'].concat(a.goalsOnly ? [] : members).filter(function (id) { return listed(id) || a.includeClosed === true; });
    return { ok: true, items: ids.map(function (id) { return { key: id, label: JSON.stringify(factsOf(id)) }; }), more: false };
  }
  desk.answer = function (ask) {
    const verb = Object.keys(ask)[0];
    const a = ask[verb] || {};
    if (verb === 'items.search' && a.text === 'plugin/') return Promise.resolve({ ok: true, items: [], more: false });   // deskFindPlugins
    if (verb === 'items.search') {
      desk.searches.push(a);
      // After a publish, a search is held unanswered: what the List shows then, it drew from the publish.
      if (desk.holding) return new Promise(function (r) { desk.held.push(function () { r(search(a)); }); });
      return Promise.resolve(search(a));
    }
    if (verb === 'item.chat') return Promise.resolve({ ok: true, chat: [], chatMore: false });
    return Promise.resolve({ ok: true, items: [], more: false, json: '', chat: [], checks: [] });
  };
  // One write, published as desk.js:1629-1652 publishes it: the item, listed, and every row of the goal it changed.
  desk.write = function (verb, id, change) {
    const before = {};
    ['g/G1'].concat(members).forEach(function (x) { before[x] = JSON.stringify([factsOf(x), listed(x)]); });
    const isNew = change();
    desk.change += 1;
    const rows = ['g/G1'].concat(members).filter(function (x) { return isNew === x || before[x] !== JSON.stringify([factsOf(x), listed(x)]); })
      .map(function (x) { return Object.assign(factsOf(x), { listed: listed(x) }); });
    const out = { change: desk.change, verb: verb, item: factsOf(id), listed: listed(id) };
    if (verb === 'item.add') out.checks = [];
    out.rows = rows;
    desk.publish(out);
    return out;
  };
  return desk;
}

// ── THE PAGE: the real shell.js, the real Desk face ─────────────────────
function bootPage(desk) {
  const byId = {};
  const doc = {
    body: fakeElement('body'),
    currentScript: null,
    getElementById: function (id) { if (!byId[id]) { byId[id] = fakeElement('div'); byId[id].id = id; } return byId[id]; },
    createElement: fakeElement,
    createDocumentFragment: function () { return fakeElement('fragment'); },
    addEventListener: function () {},
  };
  const win = test.withSpirit({ 'spirit.packet': packet, 'spirit.limits': require('../run/js/limits.js'), addEventListener: function () {} });
  const subscribers = [];
  const shellSpirit = {
    core: {
      ask: function (verb, args) {
        // The desk's verbs by name (desk.<verb>, goal/G30.6), folded back to {desk: {verb: args}}.
        const asked = test.foldAsk(Object.assign({}, args, { verb: verb }));
        if (asked && asked.desk) {
          return desk.answer(asked.desk).then(function (body) { return { status: 200, text: JSON.stringify(body), body: body }; });
        }
        return Promise.resolve({ status: 200, text: '{}', body: {} });
      },
      const: { ICON: kernel.core.const.ICON, MIME: {} },
      util: { escapeHtml: kernel.core.util.escapeHtml, formatBytes: function () { return ''; } },
      fs: {
        loadFile: function (rel) {
          if (rel === 'preferences.json') return JSON.stringify({ apps: {}, groups: {} });
          if (rel === 'shell/natter/session.json') return JSON.stringify({ label: 'me', boundAt: '2026-09-13T00:00:00.000Z' });
          if (rel === 'shell/desk/desk.json') return DESK_MANIFEST;
          return null;
        },
        saveFile: function () { return Promise.resolve(); },
        statFile: function () { return null; },
        getAnnotations: function () { return {}; },
        createScopedFs: function () { return { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } }; },
      },
      jobs: { subscribe: function (handlers) { subscribers.push(handlers); } },
    },
  };
  new Function('spirit', 'document', 'fetch', 'window', fs.readFileSync(SHELL, 'utf8'))(shellSpirit, doc, function () {}, win);
  const jobsWire = subscribers.filter(function (h) { return typeof h.onUpdate === 'function'; })[0];
  let deskJob = { id: 'job_desk', kind: 'server', type: 'Desk server', module: 'process/js/desk', status: 'running', data: {}, log: [] };
  jobsWire.onSnapshot([{ id: 'fs-watcher-1', type: 'fs-watcher', data: {} }, deskJob]);
  ['shell', 'shell/desk'].forEach(function (p) { jobsWire.onUpdate({ id: 'fs-watcher-1', type: 'fs-watcher', data: { command: { op: 'createDirectory', path: p, at: '' } } }); });
  jobsWire.onUpdate({ id: 'fs-watcher-1', type: 'fs-watcher', data: { command: { op: 'createFile', path: 'shell/desk/desk.js', at: '' } } });
  jobsWire.onUpdate({ id: 'fs-watcher-1', type: 'fs-watcher', data: { treeComplete: true } });
  desk.publish = function (app) {
    deskJob = Object.assign({}, deskJob, { app: app });
    jobsWire.onUpdate(deskJob);
  };

  // Desk listens (its manifest's `listens`), so the shell loads its script at page load; opening it shows the pane.
  const script = doc.body.children.filter(function (c) { return c.tag === 'script' && c.getAttribute('data-app-id') === 'shell/desk'; })[0];
  let evaluated = false;
  const run = function (s) {
    if (!s || evaluated) return;
    evaluated = true;
    doc.currentScript = s;
    new Function('spirit', 'document', 'window', fs.readFileSync(DESK, 'utf8'))(shellSpirit, doc, win);
    doc.currentScript = null;
    s.onload();
  };
  run(script);
  shellSpirit.shell.launchApp('shell/desk');
  run(doc.body.children.filter(function (c) { return c.tag === 'script' && c.getAttribute('data-app-id') === 'shell/desk'; })[0]);

  return {
    // The List's rows, in the order drawn: the data-row of each <tr> in #desk-top.
    rows: function () {
      const out = [];
      String(doc.getElementById('desk-top').innerHTML).replace(/<tr data-row="([^"]+)"/g, function (m, id) { out.push(id); return m; });
      return out;
    },
    rowHtml: function (id) {
      const m = new RegExp('<tr data-row="' + id.replace(/[/.]/g, '\\$&') + '"[\\s\\S]*?</tr>').exec(doc.getElementById('desk-top').innerHTML);
      return m ? m[0] : '';
    },
    click: function (id) { doc.getElementById(id).fire('click', { target: { id: id, getAttribute: function () { return null; }, closest: function () { return null; } } }); },
  };
}

test.startTest('goal/G24.6: the List takes additions from the stream');

(async function () {
  const desk = deskStandIn();
  const page = bootPage(desk);
  await settled();
  if (page.rows().join(',') === 'g/G1,g/G1.1,g/G1.2' && desk.searches.length >= 1) test.check('the world: the List asked items.search once at mount and shows the goal and its two items');
  else { test.fail('the world did not land: rows ' + short(page.rows()) + ', searches ' + desk.searches.length); return; }

  // From here every items.search is counted, and held unanswered.
  desk.searches.length = 0;
  desk.holding = true;

  test.subHeading('1. a published change replaces its row, with no search');
  desk.write('item.rename', 'g/G1.1', function () { desk.items['g/G1.1'].title = 'First, renamed'; });
  await settled();
  if (/First, renamed/.test(page.rowHtml('g/G1.1')) && page.rows().join(',') === 'g/G1,g/G1.1,g/G1.2') test.check('the row of g/G1.1 is replaced in its place, from the publish');
  else test.fail('after the rename the List reads ' + short(page.rows()) + ', g/G1.1 ' + short(page.rowHtml('g/G1.1')));
  if (!desk.searches.length) test.check('no items.search was asked for a change');
  else test.fail('a change made the List ask items.search ' + desk.searches.length + ' times');

  test.subHeading('2. a published new item appears as a row, in its place, with no search');
  // An agent's item.add: the desk appends it to its goal's members (desk.js:922) and publishes it with its goal's row.
  const added = desk.write('item.add', 'g/G1.3', function () {
    desk.items['g/G1.3'] = { id: 'g/G1.3', title: 'Added by an agent', goal: 'g/G1', status: 'ready', blocking: ['g/G1'] };
    desk.members.push('g/G1.3');
    return 'g/G1.3';
  });
  await settled();
  if (added.rows.some(function (r) { return r.id === 'g/G1.3' && r.listed === true; }) && added.item.goal === 'g/G1') test.check('the world: the publish carries the new row, listed, naming its goal');
  else test.fail('the world: the publish was ' + short(added));
  if (page.rows().indexOf('g/G1.3') !== -1) test.check('the new item is a row on the List');
  else test.fail(OWED + 'the new item g/G1.3 is not on the List; it shows ' + short(page.rows()) + ' (deskOnPublished asked items.search instead of drawing the published row, shell/desk/desk.js:521-523)');
  if (page.rows().join(',') === 'g/G1,g/G1.1,g/G1.2,g/G1.3') test.check('in the place items.search gives it: after the last row of its goal');
  else test.fail(OWED + 'the List reads ' + short(page.rows()) + ', and items.search would give g/G1,g/G1.1,g/G1.2,g/G1.3');
  if (/Added by an agent/.test(page.rowHtml('g/G1.3'))) test.check('drawn from what the publish carries');
  else test.fail(OWED + 'no row drawn for g/G1.3 from the publish');
  if (!desk.searches.length) test.check('no items.search was asked for an addition');
  else test.fail(OWED + 'the addition made the List ask items.search ' + desk.searches.length + ' times: ' + short(desk.searches));

  // Whatever was held is answered now, so the List is whole again for the next sections.
  desk.holding = false;
  desk.held.splice(0).forEach(function (go) { go(); });
  await settled();
  desk.searches.length = 0;

  test.subHeading('3. a close with Include Closed off: the row leaves, with no search');
  desk.holding = true;
  desk.write('press', 'g/G1.2', function () { desk.items['g/G1.2'].closed = true; });
  await settled();
  if (page.rows().indexOf('g/G1.2') === -1) test.check('the closed row g/G1.2 left the List');
  else test.fail('the closed row g/G1.2 stayed with Include Closed off: ' + short(page.rows()));
  if (!desk.searches.length) test.check('no items.search was asked for the close');
  else test.fail('the close made the List ask items.search ' + desk.searches.length + ' times');

  test.subHeading('4. a close with Include Closed on: the row stays, marked closed, with no search');
  desk.holding = false;
  page.click('desk-include-closed');   // a toggle asks items.search: allowed, it is his change of what is shown
  await settled();
  if (page.rows().join(',') === 'g/G1,g/G1.1,g/G1.2,g/G1.3') test.check('the world: Include Closed on shows the closed g/G1.2 again');
  else test.fail('the world: Include Closed on shows ' + short(page.rows()));
  desk.searches.length = 0;
  desk.holding = true;
  desk.write('press', 'g/G1.1', function () { desk.items['g/G1.1'].closed = true; });
  await settled();
  if (page.rows().join(',') === 'g/G1,g/G1.1,g/G1.2,g/G1.3') test.check('the closed row g/G1.1 stays in its place while Include Closed is on');
  else test.fail(OWED + 'with Include Closed on, closing g/G1.1 left the List as ' + short(page.rows()) + ' (deskOnPublished splices every listed:false row, shell/desk/desk.js:519)');
  if (/closed/.test(page.rowHtml('g/G1.1'))) test.check('and it is redrawn as closed');
  else test.fail(OWED + 'g/G1.1 is not drawn closed: ' + short(page.rowHtml('g/G1.1').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')));
  if (!desk.searches.length) test.check('no items.search was asked for that close');
  else test.fail(OWED + 'that close made the List ask items.search ' + desk.searches.length + ' times');
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(0); }, 50);
});


module.exports = test;
