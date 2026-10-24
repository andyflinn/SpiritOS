'use strict';

// spirit/test/deskRealtimeFace.js
// goal/G27.9, slices S2 to S4: the faces repaint from the stream, element by element. Red on today's tree;
// claude-windows wrote it and builds it (one agent). The item's box:
//   B. "one client repaint path ... Each element subscribes to the keys it shows and repaints only its own part. The
//      face-wide deskDraw stays for layout only."
//   C. "No tab gate: changes are applied to the store whether or not the tab shows; the tab repaints on show."
//   D. "a new folder spirit/run/shell/shared/js ... one file per element, each named with the desk prefix ... each
//      adding itself to window.spirit.elements as the shell elements do. The element is made with the keys it shows and
//      a paint function and subscribes to the stream itself (desk rule 8); Desk rows, the remote switch, warnings and
//      pairs are all made from it."
//   S4: "every remote element listens for itself and redraws only itself."
//
// THE SHAPES THIS RED NAMES (left to the builder by the box; named here so it can be run):
//   - spirit/run/shell/shared/js/deskElement.js sets window.spirit.elements.createDeskElement({subscribe, wants, paint}):
//     subscribe(handler) is the stream (an app's onPublished) and answers its unsubscribe; the element subscribes
//     itself when made; a published object it wants is painted, any other is not; destroy() unsubscribes.
//   - a Desk row is its own element: <tr id="desk-row-<id>">, repainted alone when a publish changes that row.
// WHAT IS ASSERTED
//   1. the shared element: subscribes itself, paints only what it wants, unsubscribes on destroy.
//   2. Desk: a publish changing one row repaints that row alone: not the List, not the other row.
//   3. Desk: a team chat line repaints the team chat alone, not the List.
//   4. Desk: a rule's published row repaints the rule list without asking rules.search again.
//   5. Desk: a change while another tab shows is there when the List shows again (C, a guard).
//   6. Remote: a state whose pairs changed repaints the pairs alone; one whose models changed, the models alone.
//   7. Desk and the Remote make their elements with createDeskElement.
// NOT ASSERTED: layout, words, the verifier tab and the musings (S3's rest), the reconnect pull (E, unchanged).
// rule/11: through testSupport only; no node, no port.

const fs = require('fs');
const vm = require('vm');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/spirit/kernel.js');
const fieldRules = require('../run/spirit/fieldRules.js');

const OWED = 'OWED by goal/G27.9: ';
const RUN = path.join(__dirname, '..', 'run');
const ELEMENT = path.join(RUN, 'shell', 'shared', 'js', 'deskElement.js');
const DESK = path.join(RUN, 'shell', 'desk', 'desk.js');
const REMOTE = path.join(RUN, 'shell', 'deskAgentRemote', 'deskAgentRemote.js');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
async function settled() { for (let i = 0; i < 6; i++) await sleep(20); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

// An element that counts every time its markup is set.
function fakeElement(id) {
  let html = '';
  const attrs = {};
  const el = {
    id: id, value: '', textContent: '', disabled: false, style: {}, listeners: {}, placeholder: '', className: '', scrollTop: 0, scrollHeight: 0, sets: 0,
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function (n) { return n in attrs ? attrs[n] : null; }, setAttribute: function (n, v) { attrs[n] = String(v); }, removeAttribute: function (n) { delete attrs[n]; }, focus: function () {},
    appendChild: function () {}, removeChild: function () {}, replaceChild: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); el.sets++; }, enumerable: true });
  let hid = false;
  Object.defineProperty(el, 'hidden', { get: function () { return hid; }, set: function (v) { hid = !!v; }, enumerable: true });
  return el;
}
function target(attrs) { return { id: attrs.id || '', getAttribute: function (n) { return attrs[n] === undefined ? null : attrs[n]; }, closest: function () { return null; }, parentNode: null }; }
// The shared element, loaded into a page's window as the shell would load it. Missing, the window has none.
function loadElement(win) {
  if (!fs.existsSync(ELEMENT)) return false;
  new Function('window', fs.readFileSync(ELEMENT, 'utf8'))(win);
  return !!(win.spirit.elements && typeof win.spirit.elements.createDeskElement === 'function');
}

function row(id, title, goal) {
  return { id: id, title: title, goal: goal, status: '', with: '', buttons: [], blocking: goal ? [goal] : [], blocked: [], live: [], working: [], waiting: 0, go: false, alone: false, alert: false, claims: 0, files: [] };
}

test.startTest('goal/G27.9 S2 to S4: the faces repaint element by element');

async function elementHalf() {
  test.subHeading('1. the shared element');
  const win = {};
  if (!loadElement(win)) { test.fail(OWED + 'spirit/run/shell/shared/js/deskElement.js does not set window.spirit.elements.createDeskElement'); return; }
  let handler = null;
  let subscribed = 0;
  let unsubscribed = 0;
  const painted = [];
  const el = win.spirit.elements.createDeskElement({
    subscribe: function (fn) { handler = fn; subscribed++; return function () { unsubscribed++; handler = null; }; },
    wants: function (obj) { return !!(obj && obj.mine); },
    paint: function (obj) { painted.push(obj); },
  });
  if (subscribed === 1 && typeof handler === 'function') test.check('made, it subscribes itself once');
  else test.fail(OWED + 'made, it subscribed ' + subscribed + ' times');
  if (handler) { handler({ other: 1 }); handler({ mine: 1 }); }
  if (painted.length === 1 && painted[0].mine === 1) test.check('it paints what it wants and nothing else');
  else test.fail(OWED + 'it painted ' + short(painted));
  const before = handler;
  if (el && typeof el.destroy === 'function') el.destroy();
  if (unsubscribed === 1) test.check('destroy unsubscribes it');
  else test.fail(OWED + 'destroy unsubscribed ' + unsubscribed + ' times');
  if (before) before({ mine: 2 });
  if (painted.length === 1) test.check('after destroy it paints nothing');
  else test.fail(OWED + 'after destroy it painted ' + short(painted.slice(1)));
}

async function deskHalf() {
  const fake = require('./deskFake.js').create([]);
  const G = 'goal/G100';
  fake.items = [row(G, 'The goal', ''), row(G + '.1', 'Row one', G), row(G + '.2', 'Row two', G)];
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  const win = { addEventListener: function () {} };
  const loaded = loadElement(win);
  let behavior = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(DESK, 'utf8'))({ shell: { activateApp: function (x) { behavior = x; } }, core: kernel.core }, doc, win);
  const container = fakeElement('container');
  const streams = { desk: [], other: [] };
  behavior.mount(container, {
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
    escapeHtml: kernel.core.util.escapeHtml,
    verb: fake.verb,
    onPublished: function (fn, server) { (server ? streams.other : streams.desk).push(fn); return function () { const l = server ? streams.other : streams.desk; const i = l.indexOf(fn); if (i !== -1) l.splice(i, 1); }; },
    onPacket: function () { return function () {}; },
    peerPost: function () { return Promise.resolve({ ok: true, status: 200, hash: 'h' }); },
    callDialog: function () { return new Promise(function () {}); }, armUntilElsewhere: function () {},
  });
  await settled();
  const publish = function (obj) { streams.desk.slice().forEach(function (fn) { fn(obj); }); };
  const top = doc.getElementById('desk-top');
  if (!/Row one/.test(top.innerHTML) || !/Row two/.test(top.innerHTML)) { test.fail('the world: the List does not show both rows: ' + short(top.innerHTML)); return; }

  test.subHeading('2. one row changed, one row repainted');
  const rowOne = doc.getElementById('desk-row-' + G + '.1');
  const rowTwo = doc.getElementById('desk-row-' + G + '.2');
  const marks = { top: top.sets, one: rowOne.sets, two: rowTwo.sets };
  const renamed = row(G + '.1', 'Row one, renamed', G);
  publish({ change: 100, verb: 'item.rename', item: renamed, listed: true, rows: [renamed] });
  await settled();
  if (rowOne.sets > marks.one && /Row one, renamed/.test(rowOne.innerHTML)) test.check('#desk-row-' + G + '.1 is repainted with the new title');
  else test.fail(OWED + '#desk-row-' + G + '.1 was set ' + (rowOne.sets - marks.one) + ' times and reads ' + short(rowOne.innerHTML));
  if (top.sets === marks.top && rowTwo.sets === marks.two) test.check('the List and the other row are not repainted');
  else test.fail(OWED + 'the List was set ' + (top.sets - marks.top) + ' times, the other row ' + (rowTwo.sets - marks.two));

  test.subHeading('3. a team chat line repaints the team chat alone');
  const team = doc.getElementById('desk-team');
  const t0 = { top: top.sets, team: team.sets };
  // goal/G33.4: the goal's row and the line are two publishes, one row each.
  publish({ change: 101, verb: 'chat.add', item: row('goal/G0', 'Group chat', ''), listed: false, key: { goal: 0, item: 0 } });
  publish({ change: 101, table: 'chat', goal: 0, item: 0, id: 'goal/G0', row: { by: 'andy', at: new Date().toISOString(), text: 'hello team', taken: '', key: '', name: '' } });
  await settled();
  if (team.sets > t0.team && top.sets === t0.top) test.check('#desk-team repainted, #desk-top not');
  else test.fail(OWED + 'after a team line #desk-team was set ' + (team.sets - t0.team) + ' times and #desk-top ' + (top.sets - t0.top));

  test.subHeading('4. a rule\'s row repaints the rule list without a search');
  doc.getElementById('container').fire('click', { target: target({ 'data-tab': 'rules' }) });
  const tabs = doc.getElementById('desk-tabs');
  tabs.fire('click', { target: target({ 'data-tab': 'rules' }) });
  await settled();
  const searches0 = fake.calls.filter(function (c) { return c.verb === 'rules.search'; }).length;
  publish({ rule: 'rule/77', row: { key: 'rule/77', label: 'A rule from the stream', type: 'ui', status: 'proposed', text: 't', draft: '', at: '', by: 'andy' } });
  await settled();
  const searches1 = fake.calls.filter(function (c) { return c.verb === 'rules.search'; }).length;
  const ruleList = doc.getElementById('desk-rule-list');
  if (/A rule from the stream/.test(ruleList.innerHTML) && searches1 === searches0) test.check('the rule list shows the published row, and rules.search was not asked');
  else test.fail(OWED + 'after a rule\'s row the list reads ' + short(ruleList.innerHTML) + ', rules.search asked ' + (searches1 - searches0) + ' more times');

  test.subHeading('5. a change while another tab shows (guard)');
  tabs.fire('click', { target: target({ 'data-tab': 'musings' }) });
  const two = row(G + '.2', 'Row two, renamed', G);
  publish({ change: 102, verb: 'item.rename', item: two, listed: true, rows: [two] });
  tabs.fire('click', { target: target({ 'data-tab': 'list' }) });
  await settled();
  const shown = top.innerHTML + doc.getElementById('desk-row-' + G + '.2').innerHTML;
  if (/Row two, renamed/.test(shown)) test.check('back on the List, the row renamed meanwhile shows its new title');
  else test.fail(OWED + 'back on the List the row reads ' + short(shown));

  test.subHeading('7. Desk makes its elements with createDeskElement');
  if (loaded && /createDeskElement/.test(fs.readFileSync(DESK, 'utf8'))) test.check('desk.js makes its elements with createDeskElement');
  else test.fail(OWED + 'desk.js does not use createDeskElement');
}

async function remoteHalf() {
  test.subHeading('6. the Remote: each element repaints on its own change');
  const STATE = { connected: false, persona: 'Levant', model: 'gpt-x', server: { url: 'http://o/v1', answers: true, error: '' }, connections: [{ name: 'openai', url: 'http://o/v1', use: true }], working: false, effort: { supported: false, level: 'medium' },
    active: 'gpt-x', activeQuant: '', cached: false, load: {}, test: {}, models: [{ id: 'gpt-x', quant: '', loaded: true }], chat: { id: '', done: false, text: '', tool: { name: '', url: '', done: true } }, log: [] };
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  let behavior = null;
  const handlers = [];
  const ctx = { spirit: { shell: { activateApp: function (a) { behavior = a; } }, core: kernel.core }, document: doc, window: {}, console: console, setTimeout: setTimeout, clearTimeout: clearTimeout };
  ctx.window = ctx;
  (ctx.window.spirit = ctx.window.spirit || {}).fieldRules = fieldRules;
  const loaded = loadElement(ctx);
  vm.runInNewContext(fs.readFileSync(REMOTE, 'utf8'), ctx, { filename: REMOTE });
  behavior.mount(doc.getElementById('container'), {
    escapeHtml: kernel.core.util.escapeHtml,
    onPublished: function (fn) { handlers.push(fn); return function () { const i = handlers.indexOf(fn); if (i !== -1) handlers.splice(i, 1); }; },
    fs: { loadFile: function () { return null; } },
    verb: function (name, body) {
      // deskAgent's verbs by name on the flat apiDoor (deskAgent.<verb>, goal/G30.6), folded back to {verb: args}.
      const a = (test.foldAsk(Object.assign({}, body, { verb: name })) || {}).deskAgent;
      if (name === 'api') return Promise.resolve({ status: 200, body: { desk: {}, deskAgent: {} } });
      const v = a ? Object.keys(a)[0] : '';
      return Promise.resolve({ status: 200, body: v === 'state' ? STATE : v === 'models' ? STATE : { change: 1 } });
    },
  });
  for (let i = 0; i < 6; i++) { await settled(); }
  const publish = function (obj) { handlers.slice().forEach(function (fn) { fn(obj, ''); }); };
  const pairs = doc.getElementById('dur-pairs');
  const models = doc.getElementById('dur-models');
  publish(Object.assign({}, STATE));
  await settled();
  const p0 = { pairs: pairs.sets, models: models.sets };
  publish(Object.assign({}, STATE, { connections: [{ name: 'openai', url: 'http://o/v1', use: true }, { name: 'studio', url: 'http://s/v1', use: false }] }));
  await settled();
  if (pairs.sets > p0.pairs && /studio/.test(pairs.innerHTML) && models.sets === p0.models) test.check('a new pair repaints #dur-pairs, not #dur-models');
  else test.fail(OWED + 'after a pair change #dur-pairs was set ' + (pairs.sets - p0.pairs) + ' times, #dur-models ' + (models.sets - p0.models));
  const p1 = { pairs: pairs.sets, models: models.sets };
  publish(Object.assign({}, STATE, { connections: [{ name: 'openai', url: 'http://o/v1', use: true }, { name: 'studio', url: 'http://s/v1', use: false }], models: [{ id: 'gpt-x', quant: '', loaded: true }, { id: 'gpt-y', quant: '', loaded: false }] }));
  await settled();
  if (models.sets > p1.models && /gpt-y/.test(models.innerHTML) && pairs.sets === p1.pairs) test.check('a new model repaints #dur-models, not #dur-pairs');
  else test.fail(OWED + 'after a model change #dur-models was set ' + (models.sets - p1.models) + ' times, #dur-pairs ' + (pairs.sets - p1.pairs));
  if (loaded && /createDeskElement/.test(fs.readFileSync(REMOTE, 'utf8'))) test.check('deskAgentRemote.js makes its elements with createDeskElement');
  else test.fail(OWED + 'deskAgentRemote.js does not use createDeskElement');
}

(async function () { await elementHalf(); await deskHalf(); await remoteHalf(); })().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
