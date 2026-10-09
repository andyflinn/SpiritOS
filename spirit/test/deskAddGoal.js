'use strict';

// goal/G9.11: the Add Goal bubble above the List's search, while [Goals Only] is on.
//   Andy, 2026-10-07 (musing "Desk Improvement: User creates goals and items without agents present"): "In the list
//   panel, when the [Goals Only] toggle button in the search bar is \"checked\" (on), a new bubble will appear directly
//   above the search bubble for the list: \"Add Goal\" [Title String, subject to label rules] [add-button]. When the
//   user presses the [add-button], the desk will add a goal with the entered title and a blank text box. The new goal
//   will automatically become the current goal."
// Red on today's tree; wsl wrote it from G9.11's box and does not build it.
//
// WHAT IS TRUE TODAY (read at 05620c37): goal.add {title} exists and answers the minted id (goal/G9.9), the List has
// its search bubble and the three toggles, and nothing draws an Add Goal bubble.
//
// THE SHAPE ASSERTED, and the one reading it needs: goal.add does NOT make its goal current - deskIds.js holds it to
// that, because an add must not move what he chose (goal/G9.13). His words here say the goal he adds by hand IS
// current. Both hold if the bubble does what he would do by hand: goal.add, then the make-current press on the id it
// answers. So the shell sends the two, in that order, with no new verb and no change to either.
//   The bubble: #desk-add-goal, holding the input #desk-goal-title and the button #desk-goal-add, drawn directly above
//   the search bubble (#desk-search's card) and only while Goals Only is on; the title obeys the label rules, which
//   the desk enforces (fieldRules, goal/G9.10), so the shell sends it as typed.
// NOT ASSERTED: that the new goal arrives in design mode (goal.add's own doing, already true) and the blank box
// (nothing writes one).
// SAID PLAINLY: three checks pass on today's tree because nothing is drawn at all - no bubble while Goals Only is off,
// a blank title sending nothing, and the bubble gone when Current Goal Only takes over. They are here because they
// bite once the bubble exists, not because they prove anything today; the five that are owed are the build.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');

const OWED = 'OWED by goal/G9.11: ';
const DESK = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
async function settled() { for (let i = 0; i < 6; i++) await sleep(20); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, disabled: false, style: {}, listeners: {}, placeholder: '',
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function () { return null; }, setAttribute: function () {}, focus: function () {},
    appendChild: function () {}, removeChild: function () {}, replaceChild: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
function target(attrs) {
  return { id: attrs.id || '', getAttribute: function (n) { return attrs[n] === undefined ? null : attrs[n]; }, closest: function () { return null; }, parentNode: null };
}
// The bubble, wherever the shell draws it: hidden counts as not shown, as it does for the design button.
function tagOf(html, id) {
  const at = html.indexOf('id="' + id + '"');
  if (at === -1) return '';
  const from = html.lastIndexOf('<', at);
  const to = html.indexOf('>', at);
  return html.slice(from, to === -1 ? html.length : to + 1);
}
function shows(html, id) { const t = tagOf(html, id); return !!t && !/\shidden(\s|>|=)/.test(t); }

test.startTest('goal/G9.11: Add Goal above the List search, while Goals Only is on');

(async function () {
  const fake = require('./deskFake.js').create([]);
  fake.items = [{ id: 'ag/G1', title: 'The current one', goal: '', design: true, status: '', with: '',
    buttons: [], blocking: [], blocked: [], live: [], working: [], waiting: 0 }];
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  let behavior = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(DESK, 'utf8'))(
    { shell: { activateApp: function (x) { behavior = x; } }, core: kernel.core }, doc, { addEventListener: function () {} });
  const container = fakeElement('container');
  const added = [];
  const realVerb = fake.verb;
  behavior.mount(container, {
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      const ask = body && body.ask && body.ask.desk;
      const v = ask && Object.keys(ask)[0];
      if (v === 'goal.add' || v === 'press') added.push({ verb: v, args: ask[v] });
      if (v === 'goal.add') return Promise.resolve({ status: 200, body: { id: 'ag/G2', change: 7 } });
      return realVerb(name, body);
    },
    onPublished: function () { return function () {}; }, onPacket: function () { return function () {}; },
    peerPost: function () { return Promise.resolve({ ok: true, status: 200, hash: 'h' }); },
    callDialog: function () { return new Promise(function () {}); }, armUntilElsewhere: function () {},
  });
  await settled();

  const page = function () { return Object.keys(byId).map(function (k) { return byId[k].innerHTML; }).concat([container.innerHTML]).join('\n'); };
  // The control: the List's own search bubble is on the page, so a missing Add Goal bubble is a missing bubble.
  if (/id="desk-search"/.test(page())) test.check('the world: the List draws its search bubble');
  else { test.fail('the world: no #desk-search on the page: ' + short(page())); return; }

  test.subHeading('1. nothing while Goals Only is off, as Desk opens');
  if (!shows(page(), 'desk-add-goal')) test.check('with Goals Only off there is no Add Goal bubble');
  else test.fail(OWED + 'the bubble shows with Goals Only off: ' + short(tagOf(page(), 'desk-add-goal')));

  test.subHeading('2. Goals Only on draws it, directly above the search bubble');
  doc.getElementById('desk-goals-only').fire('click', { target: target({ id: 'desk-goals-only' }) });
  await settled();
  const on = page();
  if (shows(on, 'desk-add-goal') && /id="desk-goal-title"/.test(on) && /id="desk-goal-add"/.test(on)) {
    test.check('the bubble #desk-add-goal shows, with #desk-goal-title and #desk-goal-add');
  } else test.fail(OWED + 'with Goals Only on: ' + short({ bubble: tagOf(on, 'desk-add-goal'), input: tagOf(on, 'desk-goal-title'), button: tagOf(on, 'desk-goal-add') }));
  // Above the search bubble: in the markup that holds both, the bubble comes first.
  const holder = Object.keys(byId).map(function (k) { return byId[k].innerHTML; }).concat([container.innerHTML])
    .filter(function (h) { return h.indexOf('id="desk-add-goal"') !== -1 && h.indexOf('id="desk-search"') !== -1; })[0] || '';
  if (holder && holder.indexOf('id="desk-add-goal"') < holder.indexOf('id="desk-search"')) test.check('it is drawn directly above the search bubble');
  else test.fail(OWED + (holder ? 'the order reads add at ' + holder.indexOf('id="desk-add-goal"') + ', search at ' + holder.indexOf('id="desk-search"') : 'the two are not drawn in one place, so nothing says which is above'));

  test.subHeading('3. the button adds the goal and makes it current');
  doc.getElementById('desk-goal-title').value = 'A goal of his own';
  doc.getElementById('desk-goal-add').fire('click', { target: target({ id: 'desk-goal-add' }) });
  await settled();
  const add = added.filter(function (c) { return c.verb === 'goal.add'; });
  if (add.length === 1 && add[0].args.title === 'A goal of his own' && add[0].args.id === undefined) test.check('it sent goal.add {title}, naming no id');
  else test.fail(OWED + 'it sent ' + short(added));
  const press = added.filter(function (c) { return c.verb === 'press' && c.args && c.args.what === 'make-current'; });
  if (press.length === 1 && press[0].args.id === 'ag/G2') test.check('and make-current on ag/G2, the id the desk answered');
  else test.fail(OWED + 'the presses were ' + short(added.filter(function (c) { return c.verb === 'press'; })));
  if (doc.getElementById('desk-goal-title').value === '') test.check('the title box clears once the goal is taken');
  else test.fail(OWED + 'the box still holds ' + short(doc.getElementById('desk-goal-title').value));

  test.subHeading('4. an empty title sends nothing');
  const before = added.length;
  doc.getElementById('desk-goal-title').value = '   ';
  doc.getElementById('desk-goal-add').fire('click', { target: target({ id: 'desk-goal-add' }) });
  await settled();
  if (added.length === before) test.check('a blank title adds nothing');
  else test.fail(OWED + 'it sent ' + short(added.slice(before)));

  test.subHeading('5. Current Goal Only takes the bubble away again (goal/G9.2)');
  doc.getElementById('desk-current-goal').fire('click', { target: target({ id: 'desk-current-goal' }) });
  await settled();
  if (!shows(page(), 'desk-add-goal')) test.check('turning Current Goal Only on de-selects Goals Only, and the bubble goes');
  else test.fail(OWED + 'the bubble is still shown: ' + short(tagOf(page(), 'desk-add-goal')));
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
