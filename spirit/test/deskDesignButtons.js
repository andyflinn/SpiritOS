'use strict';

// goal/G9.8: the design button is always there, right after the Musings tab, and the yellow bubble goes.
//   Andy, 2026-10-07 (musing "Desk Improvement: User creates goals and items without agents present"):
//   "The [Start/End design] buttons should be displayed always, not only when the team tab is active, and
//   it should be placed right after the [Musings] tab header in desks header area" and "get rid of the
//   yellow bubble that says \"Design mode. Nothing is built until it ends, and it ends only in the Team
//   tab.\". it is useless."
// The box's shape: UI only, in the desk shell. Red on today's tree; wsl wrote it and does not build it.
//
// WHAT IS ASSERTED:
//   1  On every tab - List, Team, Rules, Musings - the tab row holds a design button that is not hidden.
//      Today both buttons carry hidden unless deskTab is 'team' (desk.js deskDrawTabs).
//   2  It sits right after the Musings tab button, before the agent bubbles.
//   3  Which of the two shows still follows design mode: End while it is on, Start while it is off.
//   4  The yellow bubble is gone: no #desk-design, and none of its words are drawn anywhere.
// The arming stays as it is (one click arms, the second fires): asserted nowhere here, because the item
// does not touch it.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');

const OWED = 'OWED by goal/G9.8: ';
const DESK = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const TABS = ['list', 'team', 'rules', 'musings'];

function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 8; i++) await settle(); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 240); }
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
// A button's own markup, from its id to the end of the tag, so `hidden` is read off that button alone.
function tagOf(html, id) {
  const at = html.indexOf('id="' + id + '"');
  if (at === -1) return '';
  const from = html.lastIndexOf('<', at);
  const to = html.indexOf('>', at);
  return html.slice(from, to === -1 ? html.length : to + 1);
}
function shows(html, id) { const t = tagOf(html, id); return !!t && !/\shidden(\s|>|=)/.test(t); }

test.startTest('goal/G9.8: the design button is always in the tab row, and the yellow bubble is gone');

(async function () {
  const fake = require('./deskFake.js').create([]);
  // One goal row, design mode on, as the desk server answers it (desk/G2.6).
  fake.items = [{ id: 'goal/G9', title: 'Desk without agents', goal: '', design: true, status: '', with: '',
    buttons: [], blocking: [], blocked: [], live: [], working: [], waiting: 0 }];
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  let behavior = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(DESK, 'utf8'))(
    { shell: { activateApp: function (x) { behavior = x; } }, core: kernel.core }, doc, {});
  const container = fakeElement('container');
  behavior.mount(container, {
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
    escapeHtml: kernel.core.util.escapeHtml, verb: fake.verb,
    onPublished: function () {}, onPacket: function () {},
    peerPost: function () { return Promise.resolve({ ok: true, status: 200, hash: 'h' }); },
    callDialog: function () { return new Promise(function () {}); }, armUntilElsewhere: function () {},
  });
  await settled();

  const tabs = doc.getElementById('desk-tabs');
  async function open(name) {
    tabs.fire('click', { target: target({ 'data-tab': name }), currentTarget: tabs });
    await settled();
    return tabs.innerHTML;
  }

  test.subHeading('1. a design button shows on every tab');
  for (const name of TABS) {
    const html = await open(name);
    if (shows(html, 'desk-end-design') || shows(html, 'desk-start-design')) {
      test.check('on the ' + name + ' tab the design button is not hidden');
    } else test.fail(OWED + 'on the ' + name + ' tab: ' + short({ end: tagOf(html, 'desk-end-design'), start: tagOf(html, 'desk-start-design') }));
  }

  test.subHeading('2. it sits right after the Musings tab button');
  const html = await open('list');
  const musings = html.indexOf('data-tab="musings"');
  const design = Math.min.apply(null, ['desk-end-design', 'desk-start-design'].map(function (id) {
    const at = html.indexOf('id="' + id + '"');
    return at === -1 ? Number.MAX_SAFE_INTEGER : at;
  }));
  const bubbles = html.indexOf('data-bubble=');
  if (musings !== -1 && design > musings && (bubbles === -1 || design < bubbles)) {
    test.check('the design button comes after the Musings tab and before the agent bubbles');
  } else test.fail(OWED + 'in the tab row: ' + short({ musingsAt: musings, designAt: design === Number.MAX_SAFE_INTEGER ? -1 : design, bubblesAt: bubbles }));

  test.subHeading('3. which of the two shows still follows design mode');
  if (shows(html, 'desk-end-design') && !shows(html, 'desk-start-design')) {
    test.check('design mode is on, so End design mode shows and Start does not');
  } else test.fail(OWED + short({ end: tagOf(html, 'desk-end-design'), start: tagOf(html, 'desk-start-design') }));
  fake.items[0].design = false;
  const off = await open('list');
  if (shows(off, 'desk-start-design') && !shows(off, 'desk-end-design')) {
    test.check('with design mode off, Start design mode shows and End does not');
  } else test.fail(OWED + short({ end: tagOf(off, 'desk-end-design'), start: tagOf(off, 'desk-start-design') }));

  test.subHeading('4. the yellow bubble is gone');
  const page = container.innerHTML + tabs.innerHTML + doc.getElementById('desk-top').innerHTML;
  if (page.indexOf('id="desk-design"') === -1) test.check('nothing draws #desk-design');
  else test.fail(OWED + 'the page still holds #desk-design');
  if (!/Nothing is built until it ends/.test(page)) test.check('and its words are nowhere on the page');
  else test.fail(OWED + 'the page still says "Nothing is built until it ends"');
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
