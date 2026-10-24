'use strict';

// spirit/test/deskAgentConnectTable.js
// goal/G14.9, More Minor Fixes (Unsloth Remote). Red on today's code; claude-windows wrote it and builds it (one agent).
// The rulings are the item's box, Andy's:
//
//   "Use in the account rows becomes the two-press armed button" (Use replaces Remove in his first line).
//   "the connect tab: the list is UGLY, and has no indication of which OpenAI compatible server deskAgent is
//   connected to. why not a beautiful table like other places have where the currently connected AI server is marked
//   with a green dot or something."
//
// WHAT IS ASSERTED
//   1. the connect tab's server list is the house table (jobs-table, as Natter, Desk, Jobs and Contacts): a header and
//      one job-row per kept server.
//   2. exactly the connected server's row carries the green dot (ICON.GREEN_CIRCLE, Natter's mark for a usable relay):
//      the pair in use while a server answers there; no dot when nothing answers.
//   3. Use arms on the first press (data-armed, the shell paints it), sends connection.use only on the second, and a
//      press elsewhere (the shell's armUntilElsewhere) disarms it.
//   4. Remove the same (Andy's later edit of the box: both buttons, "Remove" and "Use", are two-press armed buttons).
// NOT ASSERTED, the builder's: column order, header words beyond Name, the exact title texts.
// rule/11: through testSupport only; no node, no ports.

const fs = require('fs');
const vm = require('vm');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/spirit/kernel.js');

const OWED = 'OWED by goal/G14.9: ';
const APP = path.join(__dirname, '..', 'run', 'shell', 'deskAgentRemote', 'deskAgentRemote.js');
const DOT = kernel.core.const.ICON.GREEN_CIRCLE;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 12; i++) await settle(); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

function fakeElement(id) {
  let html = '';
  const attrs = {};
  const el = {
    id: id, value: '', textContent: '', hidden: false, disabled: false, style: {}, listeners: {}, placeholder: '', className: '', scrollTop: 0, scrollHeight: 0,
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function (n) { return n in attrs ? attrs[n] : null; }, setAttribute: function (n, v) { attrs[n] = String(v); }, removeAttribute: function (n) { delete attrs[n]; }, focus: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
function clickOn(attrs) { return { target: { getAttribute: function (n) { return n in attrs ? attrs[n] : null; }, closest: function () { return null; } }, preventDefault: function () {}, stopPropagation: function () {} }; }

const PAIRS = [{ name: 'studio', url: 'http://s/v1', use: false }, { name: 'openai', url: 'http://o/v1', use: true }, { name: 'spare', url: 'http://x/v1', use: false }];
const MODELS = { active: 'gpt-x', activeQuant: '', cached: false, load: {}, test: {}, models: [{ id: 'gpt-x', quant: '', loaded: true }] };

async function mount(answers) {
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  const calls = [];
  const armed = [];
  let behavior = null;
  const ctx = { spirit: { shell: { activateApp: function (a) { behavior = a; } }, core: kernel.core }, document: doc, window: {}, console: console, setTimeout: setTimeout, clearTimeout: clearTimeout };
  ctx.window = ctx;
  vm.runInNewContext(fs.readFileSync(APP, 'utf8'), ctx, { filename: APP });
  behavior.mount(doc.getElementById('container'), {
    escapeHtml: kernel.core.util.escapeHtml, onPublished: function () {},
    fs: { loadFile: function () { return null; } },
    armUntilElsewhere: function (fn) { armed.push(fn); },
    verb: function (name, body) {
      // deskAgent's verbs by name on the flat apiDoor (deskAgent.<verb>, goal/G30.6), folded back to {verb: args}.
      const a = (test.foldAsk(Object.assign({}, body, { verb: name })) || {}).deskAgent;
      if (name === 'api') return Promise.resolve({ status: 200, body: { deskAgent: {} } });
      const v = a ? Object.keys(a)[0] : '';
      if (v) calls.push({ verb: v, args: a[v] });
      const said = v === 'state' ? answers.state : v === 'models' ? MODELS : v === 'connection.use' ? { answers: true, url: 'http://s/v1', error: '' } : { ok: true };
      return Promise.resolve({ status: 200, body: said });
    },
  });
  for (let i = 0; i < 6; i++) { await settled(); await sleep(20); }
  return { doc: doc, calls: calls, armed: armed };
}

function rows(html) { return String(html).match(/<tr[\s\S]*?<\/tr>/g) || []; }
function rowOf(html, name) { return rows(html).filter(function (r) { return r.indexOf('>' + name + '<') !== -1; })[0] || ''; }

(async function () {
  test.startTest('goal/G14.9: the Remote\'s connect tab, a table with the connected server dotted, and Use armed');

  test.subHeading('1. the server list is the house table');
  const STATE = { connected: false, persona: 'Levant', model: 'gpt-x', server: { url: 'http://o/v1', answers: true, error: '' }, connections: PAIRS };
  const on = await mount({ state: STATE });
  const list = on.doc.getElementById('dur-pairs').innerHTML;
  if (/<table class="jobs-table[^"]*">/.test(list) && /<thead>[\s\S]*<th[^>]*>Name<\/th>[\s\S]*<\/thead>/.test(list) && /<tbody>/.test(list)) test.check('#dur-pairs is a jobs-table with a header naming the Name column');
  else test.fail(OWED + '#dur-pairs reads ' + short(list));
  const body = rows(list).filter(function (r) { return /class="job-row/.test(r); });
  if (body.length === 3 && ['studio', 'openai', 'spare'].every(function (n) { return rowOf(list, n); })) test.check('one job-row per kept server, by name');
  else test.fail(OWED + 'the rows read ' + short(rows(list)));

  test.subHeading('2. the green dot on the connected server, and only there');
  const dotted = ['studio', 'openai', 'spare'].filter(function (n) { return rowOf(list, n).indexOf(DOT) !== -1; });
  if (dotted.length === 1 && dotted[0] === 'openai') test.check('exactly openai, the one in use with a server answering, carries ' + DOT);
  else test.fail(OWED + 'the dot sits on ' + short(dotted));
  const off = await mount({ state: Object.assign({}, STATE, { server: { url: 'http://o/v1', answers: false, error: 'refused' } }) });
  const offList = off.doc.getElementById('dur-pairs').innerHTML;
  if (rows(offList).length >= 3 && offList.indexOf(DOT) === -1) test.check('nothing answers: no row carries the dot');
  else test.fail(OWED + 'with nothing answering #dur-pairs reads ' + short(offList));

  test.subHeading('3. Use is the two-press armed button');
  const pairs = on.doc.getElementById('dur-pairs');
  const n0 = on.calls.length;
  pairs.fire('click', clickOn({ 'data-use': 'studio' }));
  await settled();
  const afterOne = on.calls.slice(n0).filter(function (c) { return c.verb === 'connection.use'; });
  const armedRow = rowOf(pairs.innerHTML, 'studio');
  if (afterOne.length === 0 && /data-use="studio"[^>]*data-armed|data-armed[^>]*data-use="studio"/.test(armedRow) && on.armed.length === 1) test.check('the first press arms Use (data-armed, armUntilElsewhere) and sends nothing');
  else test.fail(OWED + 'after one press: sent ' + short(afterOne) + '; row ' + short(armedRow) + '; armUntilElsewhere called ' + on.armed.length);
  pairs.fire('click', clickOn({ 'data-use': 'studio' }));
  await settled(); await sleep(20); await settled();
  const afterTwo = on.calls.slice(n0).filter(function (c) { return c.verb === 'connection.use'; });
  if (afterTwo.length === 1 && afterTwo[0].args.name === 'studio') test.check('the second press sends connection.use {name}');
  else test.fail(OWED + 'after two presses: sent ' + short(on.calls.slice(n0)));

  const n1 = on.calls.length;
  pairs.fire('click', clickOn({ 'data-use': 'spare' }));
  await settled();
  const disarm = on.armed[on.armed.length - 1];
  if (typeof disarm === 'function') disarm();
  const coldRow = rowOf(pairs.innerHTML, 'spare');
  if (typeof disarm === 'function' && !/data-armed/.test(coldRow)) test.check('a press elsewhere disarms it: the row is cold again');
  else test.fail(OWED + 'after a press elsewhere the row reads ' + short(coldRow));
  pairs.fire('click', clickOn({ 'data-use': 'spare' }));
  await settled();
  const sentCold = on.calls.slice(n1).filter(function (c) { return c.verb === 'connection.use'; });
  if (sentCold.length === 0) test.check('and the next press arms again rather than sending');
  else test.fail(OWED + 'a press after the disarm sent ' + short(sentCold));

  test.subHeading('4. Remove is the two-press armed button too');
  // Andy's later edit of the box: both buttons in the account rows, Remove and Use, become two-press armed buttons.
  const rm = await mount({ state: STATE });
  const box = rm.doc.getElementById('dur-pairs');
  const n2 = rm.calls.length;
  box.fire('click', clickOn({ 'data-remove': 'studio' }));
  await settled();
  const rmOne = rm.calls.slice(n2).filter(function (c) { return c.verb === 'connection.remove'; });
  const rmRow = rowOf(box.innerHTML, 'studio');
  if (rmOne.length === 0 && /data-remove="studio"[^>]*data-armed|data-armed[^>]*data-remove="studio"/.test(rmRow) && rm.armed.length === 1) test.check('the first press arms Remove (data-armed, armUntilElsewhere) and sends nothing');
  else test.fail(OWED + 'after one Remove press: sent ' + short(rmOne) + '; row ' + short(rmRow) + '; armUntilElsewhere called ' + rm.armed.length);
  box.fire('click', clickOn({ 'data-remove': 'studio' }));
  await settled(); await sleep(20); await settled();
  const rmTwo = rm.calls.slice(n2).filter(function (c) { return c.verb === 'connection.remove'; });
  if (rmTwo.length === 1 && rmTwo[0].args.name === 'studio') test.check('the second press sends connection.remove {name}');
  else test.fail(OWED + 'after two Remove presses: sent ' + short(rm.calls.slice(n2)));
  const n3 = rm.calls.length;
  box.fire('click', clickOn({ 'data-remove': 'spare' }));
  await settled();
  const rmDisarm = rm.armed[rm.armed.length - 1];
  if (typeof rmDisarm === 'function') rmDisarm();
  if (typeof rmDisarm === 'function' && !/data-armed/.test(rowOf(box.innerHTML, 'spare'))) test.check('a press elsewhere disarms Remove');
  else test.fail(OWED + 'after a press elsewhere the row reads ' + short(rowOf(box.innerHTML, 'spare')));
  box.fire('click', clickOn({ 'data-remove': 'spare' }));
  await settled();
  // An armed Use is not a Remove's confirmation: the two arms are separate.
  box.fire('click', clickOn({ 'data-use': 'spare' }));
  await settled();
  const crossed = rm.calls.slice(n3).filter(function (c) { return c.verb === 'connection.remove' || c.verb === 'connection.use'; });
  if (crossed.length === 0) test.check('after the disarm Remove arms again, and Use pressed on an armed Remove only arms Use');
  else test.fail(OWED + 'sent ' + short(crossed));
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
