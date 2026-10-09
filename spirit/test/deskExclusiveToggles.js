'use strict';

// goal/G9.2: [Current Goal Only] and [Goals Only] are exclusive toggles.
//   Andy, 2026-10-07 (musing "Desk Improvement: User creates goals and items without agents present"):
//   "in list search, only one of the two buttons, [Current Goal Only] and [Goals Only ✓], may be
//   selected at the same time. When either of those two buttons is selected, the other must be
//   automatically de-selected."
// The shape in the item's box: UI only. items.search keeps both booleans; the shell never sends both true.
// So this suite reads what the shell asks for, not what it draws from: a click on either toggle turns the
// other off before the search goes, and no items.search of the whole session carries both as true.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');

const OWED = 'OWED by goal/G9.2: ';
const DESK = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');

function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 8; i++) await settle(); }
function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, style: {}, listeners: {}, placeholder: '',
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function () { return null; }, setAttribute: function () {}, focus: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
function target(attrs) {
  return { id: attrs.id || '', getAttribute: function (n) { return attrs[n] || null; }, closest: function () { return null; }, parentNode: null };
}

test.startTest('goal/G9.2: Current Goal Only and Goals Only are exclusive');

(async function () {
  const fake = require('./deskFake.js').create([]);
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  let behavior = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(DESK, 'utf8'))(
    { shell: { activateApp: function (x) { behavior = x; } }, core: kernel.core }, doc, {});
  behavior.mount(fakeElement('container'), {
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
    escapeHtml: kernel.core.util.escapeHtml, verb: fake.verb,
    onPublished: function () {}, onPacket: function () {},
    peerPost: function () { return Promise.resolve({ ok: true, status: 200, hash: 'h' }); },
    callDialog: function () { return new Promise(function () {}); }, armUntilElsewhere: function () {},
  });
  await settled();

  function searches() {
    return fake.calls.filter(function (c) { return c.server === 'desk' && c.verb === 'items.search'; }).map(function (c) { return c.args || {}; });
  }
  function last() { const s = searches(); return s.length ? s[s.length - 1] : null; }
  function click(id) {
    doc.getElementById(id).fire('click', { target: target({ id: id }) });
    return settled();
  }

  // The List opens with Current Goal Only on (desk.js deskFilter), so a click on Goals Only is the
  // collision his words name.
  test.subHeading('Goals Only turns Current Goal Only off');
  await click('desk-goals-only');
  const afterGoals = last();
  if (afterGoals && afterGoals.goalsOnly === true && afterGoals.currentGoalOnly === false) {
    test.check('items.search went with goalsOnly true and currentGoalOnly false');
  } else test.fail(OWED + 'items.search went with ' + JSON.stringify(afterGoals));
  if (/Current Goal Only(?! ✓)/.test(doc.getElementById('desk-current-goal').textContent)) {
    test.check('and the Current Goal Only chip lost its ✓');
  } else test.fail(OWED + 'the chip reads ' + JSON.stringify(doc.getElementById('desk-current-goal').textContent));

  test.subHeading('Current Goal Only turns Goals Only off');
  await click('desk-current-goal');
  const afterCurrent = last();
  if (afterCurrent && afterCurrent.currentGoalOnly === true && afterCurrent.goalsOnly === false) {
    test.check('items.search went with currentGoalOnly true and goalsOnly false');
  } else test.fail(OWED + 'items.search went with ' + JSON.stringify(afterCurrent));
  if (/Goals Only(?! ✓)/.test(doc.getElementById('desk-goals-only').textContent)) {
    test.check('and the Goals Only chip lost its ✓');
  } else test.fail(OWED + 'the chip reads ' + JSON.stringify(doc.getElementById('desk-goals-only').textContent));

  // Turning one off selects nothing, so both false is allowed; only both true is not.
  test.subHeading('a toggle still turns itself off, and Include Closed is untouched');
  await click('desk-current-goal');
  const offAgain = last();
  if (offAgain && offAgain.currentGoalOnly === false && offAgain.goalsOnly === false) {
    test.check('both off is a state the List can be in');
  } else test.fail(OWED + 'items.search went with ' + JSON.stringify(offAgain));
  await click('desk-include-closed');
  const closed = last();
  if (closed && closed.includeClosed === true) test.check('Include Closed is its own toggle and stays');
  else test.fail(OWED + 'items.search went with ' + JSON.stringify(closed));

  test.subHeading('no search of the whole session carried both');
  const both = searches().filter(function (a) { return a.currentGoalOnly === true && a.goalsOnly === true; });
  if (!both.length) test.check('not one items.search had currentGoalOnly and goalsOnly both true');
  else test.fail(OWED + both.length + ' of ' + searches().length + ' searches carried both: ' + JSON.stringify(both[0]));
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
