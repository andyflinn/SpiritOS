'use strict';

// spirit/test/deskVision.js
// goal/G27.3: the "musings" tab replaced by the desk app "vision". Red on today's tree; claude-windows writes it and
// builds it (one agent). The item's box (v9), Andy's rulings, 2026-10-14 to 17:
//   R1. the musings tab is removed, replaced by a desk-app tab named vision.
//   R2. vision is a simple standard desk plugin, not a bespoke app.
//   R3. its goal, allocated at its first mount, stays in design mode at all times; nothing ends design mode for it.
//   R4. its items offer Rename, Close and Delete at all times, Close are-you-sure styled; no Done, no Go, no code phases.
//   R5. no new button logic: the plugin refuses go, done, code and claim, and end-design on its goal; the List and the
//       dialog then never draw them.
//   R6. item details open in the standard deskDetails dialog.
//   R7. the item chat is the record of each conversation; nothing more is logged.
//   R8. the plugin's goal is plugin/vision, made at first mount (the desk's mechanism, used, not built).
//   R9. vision items keep blocking: what must turn into reality before an item can.
//   R10. the vision goal is never the current goal (goal/G27.2, D6): already true.
//
// WHAT IS ASSERTED: a real desk with the plugin folder as it is (stackFrameChecks beside vision, on a scratch list);
// the face's source and the plugin's private UI in a fake page.
// rule/11: through testSupport only; its own folders; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G27.3: ';
const RUN = path.join(__dirname, '..', 'run');
const DESK = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const FACE = path.join(RUN, 'shell', 'desk', 'desk.js');
const PLUGIN_JS = path.join(RUN, 'process', 'js', 'desk', 'plugins', 'js', 'vision', 'vision.js');
const PLUGIN_JSON = path.join(RUN, 'process', 'js', 'desk', 'plugins', 'js', 'vision', 'vision.json');
const PLUGIN_UI = path.join(RUN, 'shell', 'desk', 'plugins', 'vision', 'vision.js');
const GOAL = 'plugin/vision';
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskVisionTestOwnerAAAAAAAAAAAAAAAAAAAAA=', label: 'andy' };
const CW = { key: 'MCowBQYDK2VwAyEAdeskVisionTestCWAAAAAAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

test.startTest('goal/G27.3: the desk app "vision" replaces the musings tab');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-desk-vision-'));
const state = path.join(scratch, 'state');
fs.mkdirSync(state, { recursive: true });
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('desk', pipe);
const call = function (verb, a, caller) { const q = {}; q[verb] = a || {}; return client.ask({ desk: q }, caller || ANDY).then(function (r) { return (r && r.body) || {}; }, function () { return {}; }); };
const why = function (r) { return r && r.ok === false && r.extra ? String(r.extra.why || r.code || '') : (r && r.ok === false ? String(r.code || 'refused') : ''); };
const landed = function (r) { return !!(r && r.change); };
async function factsOf(id) { const r = await call('item.get', { id: id }); try { return JSON.parse(r.item); } catch (e) { return null; } }
let kid = null;

async function serverHalf() {
  test.subHeading('R2, R8. a standard desk plugin with its own goal');
  if (fs.existsSync(PLUGIN_JS) && fs.existsSync(PLUGIN_JSON)) test.check('the plugin sits in the plugin folder: vision/vision.js and vision.json');
  else { test.fail(OWED + 'no process/js/desk/plugins/js/vision/ with its .js and .json'); return; }
  let manifest = null;
  try { manifest = JSON.parse(fs.readFileSync(PLUGIN_JSON, 'utf8')); } catch (e) { manifest = null; }
  if (manifest && /^vision$/i.test(String(manifest.tab || ''))) test.check('its .json names its tab under Apps: ' + manifest.tab);
  else test.fail(OWED + 'vision.json reads ' + short(manifest));
  // A scratch list for stackFrameChecks, which mounts beside it, so no suite desk reads the tree's list.
  kid = spawn(process.execPath, [DESK, JSON.stringify({ stackFrameList: path.join(scratch, 'stackFrameList.json') }), '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) { await sleep(150); try { const r = await client.ask('api'); up = !!(r.body && r.body.desk && r.body.desk.ok !== false); } catch (e) { /* not yet */ } }
  if (!up) { test.fail('the world: the desk did not start'); return; }
  await sleep(300);
  const g = await factsOf(GOAL);
  if (g && g.plugin === 'vision' && /^vision$/i.test(String(g.pluginTab || ''))) test.check('its first mount made the goal ' + GOAL + ', marked for the plugin and its tab');
  else { test.fail(OWED + GOAL + ' reads ' + short(g)); return; }

  test.subHeading('R3. its goal stays in design mode at all times');
  if (g.design === true) test.check('the goal is in design mode from its first mount');
  else test.fail(OWED + 'the goal\'s design reads ' + short(g.design));
  const end = await call('press', { id: GOAL, what: 'end-design' });
  const g2 = await factsOf(GOAL);
  if (!landed(end) && g2 && g2.design === true) test.check('end-design on it is refused: ' + why(end));
  else test.fail(OWED + 'end-design answered ' + short(end) + ', design now ' + short(g2 && g2.design));

  test.subHeading('R4, R5. its items: Rename, Close and Delete; no Go, Done, code or claim');
  const a = await call('item.add', { goal: GOAL, title: 'A city without cars', blocks: '' });
  const b = await call('item.add', { goal: GOAL, title: 'Trains every ten minutes', blocks: '' });
  if (!a.id || !b.id) { test.fail('the world: item.add in ' + GOAL + ' answered ' + short([a, b])); return; }
  const fa = await factsOf(a.id);
  const shown = (fa && fa.buttons) || [];
  if (shown.indexOf('close') !== -1 && shown.indexOf('delete') !== -1 && !shown.some(function (x) { return ['go', 'done', 'code', 'claim-done', 'go-all'].indexOf(x) !== -1; })) test.check('an item offers Close and Delete and none of Go, Done, Code or claim: ' + short(shown));
  else test.fail(OWED + 'the item offers ' + short(shown));
  for (const what of ['go', 'code', 'done', 'claim-done']) {
    const r = await call('press', { id: a.id, what: what });
    if (!landed(r)) test.check(what + ' on its item is refused: ' + why(r));
    else test.fail(OWED + what + ' on ' + a.id + ' landed');
  }
  const cl = await call('claim', { id: a.id, phase: 'build', commit: '' }, CW);
  if (!landed(cl)) test.check('a claim on its item is refused: ' + why(cl));
  else test.fail(OWED + 'a claim on ' + a.id + ' landed');
  const fa2 = await factsOf(a.id);
  if (fa2 && fa2.code !== true && !fa2.phase) test.check('the item has no code mark and no phase');
  else test.fail(OWED + 'the item reads code ' + short(fa2 && fa2.code) + ', phase ' + short(fa2 && fa2.phase));
  // THE CODE TOGGLE IS NOT OFFERED (goal/G27.3). Andy, 2026-10-17: "The code button should not be available in vision
  // items." The dialog draws its Code toggle from the facts' codeOffered, which the plugin's refusal sets false.
  // An ordinary goal and item, through goal.add and item.add (goal/G33.7: session.set went), the desk naming the ids.
  const og = await call('goal.add', { title: 'Ordinary' });
  const ord = await call('item.add', { goal: String((og && og.id) || ''), title: 'one' });
  const fo = await factsOf(String((ord && ord.id) || ''));
  if (fa2 && fa2.codeOffered === false && fo && fo.codeOffered === true) test.check('a vision item carries codeOffered false; an ordinary item true');
  else test.fail(OWED + 'codeOffered reads ' + short([fa2 && fa2.codeOffered, fo && fo.codeOffered]) + ' (session ' + short(ord) + ')');
  const rn = await call('item.rename', { id: a.id, title: 'A city for people' });
  if (landed(rn)) test.check('Rename lands');
  else test.fail(OWED + 'item.rename answered ' + short(rn));

  test.subHeading('R9. its items keep blocking');
  const bl = await call('block', { id: b.id, blocks: a.id });
  const fb = await factsOf(b.id);
  if (landed(bl) && fb && (fb.blocking || []).indexOf(a.id) !== -1) test.check(b.id + ' blocks ' + a.id + ': what must become real first');
  else test.fail(OWED + 'block answered ' + short(bl) + ', blocking ' + short(fb && fb.blocking));

  test.subHeading('R4. Close and Delete land');
  const cs = await call('press', { id: a.id, what: 'close' });
  const del = await call('item.delete', { id: b.id });
  if (landed(cs) && landed(del)) test.check('Close and Delete land on its items');
  else test.fail(OWED + 'close answered ' + short(cs) + ', delete ' + short(del));
  const g3 = await factsOf(GOAL);
  if (g3 && g3.design === true && g3.status !== 'closed') test.check('its goal stays open and in design after its items go');
  else test.fail(OWED + 'the goal reads ' + short(g3 && [g3.status, g3.design]));
}

// ── THE FACE AND THE PRIVATE UI ─────────────────────────────────────────
function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, disabled: false, style: {}, listeners: {},
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    getAttribute: function () { return null; }, setAttribute: function () {}, appendChild: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
async function faceHalf() {
  test.subHeading('R1. the musings tab is gone');
  const face = fs.readFileSync(FACE, 'utf8');
  const left = ['data-tab="musings"', 'data-pane="musings"', 'desk-musings', 'function deskMusings', "kind: 'musing'"].filter(function (w) { return face.indexOf(w) !== -1; });
  if (!left.length) test.check('the Desk face holds no Musings tab, pane, log or send');
  else test.fail(OWED + 'shell/desk/desk.js still holds ' + short(left));
  const gone = ['deskMusing.js', 'deskMusingBubbles.js'].filter(function (f) { return fs.existsSync(path.join(__dirname, f)); });
  if (!gone.length) test.check('the musings suites are gone with it');
  else test.fail(OWED + 'still there: ' + short(gone));

  test.subHeading('R6, R7. the Vision pane: its items, an add, the standard dialog, the goal chat');
  if (!fs.existsSync(PLUGIN_UI)) { test.fail(OWED + 'no shell/desk/plugins/vision/vision.js'); return; }
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); }, createElement: function () { return fakeElement(''); }, body: fakeElement('body') };
  const win = test.withSpirit({ 'spirit.fieldRules': require('../run/js/fieldRules.js'), 'spirit.deskPlugins': {} });
  new Function('document', 'window', fs.readFileSync(PLUGIN_UI, 'utf8'))(doc, win);
  const ui = win.spirit.deskPlugins.vision;
  if (!ui || typeof ui.open !== 'function') { test.fail(OWED + 'the UI registers no window.spirit.deskPlugins.vision.open'); return; }
  const asked = [];
  const dialogs = [];
  let chatAt = null;
  const ITEM = { id: GOAL + '.1', title: 'A city without cars', goal: GOAL, status: '', buttons: ['close', 'delete'], blocking: [], blocked: [] };
  const box = fakeElement('pane');
  ui.open(box, {
    goal: GOAL,
    // THE LIST COMES FROM ITS GOAL, NOT A SEARCH (goal/G27.3, Andy, 2026-10-17: "where is my list of vision items?"):
    // a search answers one bucket, here full of other goals' items, while the goal's own facts name its open items.
    ask: function (verb, a) {
      asked.push([verb, a]);
      if (verb === 'items.search') return Promise.resolve({ items: [{ key: 'goal/G9.1', label: JSON.stringify({ id: 'goal/G9.1', title: 'Another goal\'s item', goal: 'goal/G9' }) }], more: true });
      if (verb === 'item.get' && a && a.id === GOAL) return Promise.resolve({ item: JSON.stringify({ id: GOAL, title: 'Vision', goal: '', blocked: [ITEM.id], blocking: [] }), version: 1, change: 9 });
      if (verb === 'item.get' && a && a.id === ITEM.id) return Promise.resolve({ item: JSON.stringify(ITEM), version: 1, change: 9 });
      return Promise.resolve({ id: GOAL + '.2', change: 9 });
    },
    onPublished: function () { return function () {}; },
    chat: function (el) { chatAt = el; },
    callDialog: function (app, params) { dialogs.push([app, params]); return new Promise(function () {}); },
  });
  await sleep(30);
  const all = function () { return box.innerHTML + Object.keys(byId).map(function (k) { return byId[k].innerHTML; }).join('\n'); };
  if (/A city without cars/.test(all()) && /data-open="plugin\/vision\.1"/.test(all())) test.check('the pane lists its goal\'s items, each with an Open');
  else test.fail(OWED + 'the pane shows ' + short(all()));
  const titleIn = Object.keys(byId).filter(function (k) { return /title/.test(k); })[0];
  const addBtn = Object.keys(byId).filter(function (k) { return /add/.test(k) && !/title/.test(k); })[0];
  if (titleIn && addBtn) {
    byId[titleIn].value = 'Trains every ten minutes';
    box.fire('click', { target: { id: addBtn, getAttribute: function () { return null; } } });
    await sleep(20);
  }
  const added = asked.filter(function (x) { return x[0] === 'item.add'; })[0];
  if (added && added[1].goal === GOAL && added[1].title === 'Trains every ten minutes') test.check('its add sends item.add to ' + GOAL + ' with the title typed');
  else test.fail(OWED + 'the add asked ' + short(asked) + ' (title input ' + short(titleIn) + ', add ' + short(addBtn) + ')');
  box.fire('click', { target: { id: '', getAttribute: function (n) { return n === 'data-open' ? ITEM.id : null; } } });
  await sleep(20);
  if (dialogs.some(function (d) { return d[0] === 'shell/deskDetails' && d[1] && d[1].id === ITEM.id; })) test.check('Open shows the item in the standard deskDetails dialog');
  else test.fail(OWED + 'Open opened ' + short(dialogs));
  if (chatAt) test.check('the pane mounts its goal\'s chat through the face (ctx.chat)');
  else test.fail(OWED + 'the pane mounted no chat');

  test.subHeading('the dialog draws no Code toggle where none is offered');
  const DD = path.join(RUN, 'shell', 'deskDetails', 'deskDetails.js');
  const drawIn = async function (codeOffered) {
    const ids = {};
    const d2 = { getElementById: function (id) { return ids[id] || (ids[id] = fakeElement(id)); } };
    let app = null;
    new Function('spirit', 'document', 'window', fs.readFileSync(DD, 'utf8'))({ shell: { activateApp: function (x) { app = x; } }, core: require('../run/js/kernel.js').core }, d2, test.withSpirit({ addEventListener: function () {}, 'spirit.fieldRules': require('../run/js/fieldRules.js') }));
    const f = { id: 'goal/G101.1', title: 'an item', goal: 'goal/G101', status: '', with: '', buttons: ['close', 'delete'], blocking: [], blocked: [], code: false, codeOffered: codeOffered };
    app.mount(fakeElement('dd'), { escapeHtml: require('../run/js/kernel.js').core.util.escapeHtml,
      verb: function (n, body) { const q = (test.foldAsk(Object.assign({}, body, { verb: n })) || {}).desk; const v = q && Object.keys(q)[0];
        if (v === 'item.get') return Promise.resolve({ status: 200, body: { item: JSON.stringify(f), version: 1, change: 1 } });
        if (v === 'item.chat') return Promise.resolve({ status: 200, body: { chat: [], chatMore: false } });
        if (v === 'item.checks') return Promise.resolve({ status: 200, body: { checks: [] } });
        if (v === 'item.box') return Promise.resolve({ status: 200, body: { box: '', version: 1 } });
        return Promise.resolve({ status: 200, body: { items: [], more: false } }); },
      onPublished: function () { return function () {}; }, closeDialog: function () {}, armUntilElsewhere: function () {}, setScreenTitle: function () {}, setDialogResult: function () {} });
    await app.open({ id: 'goal/G101.1' });
    await sleep(20);
    return Object.keys(ids).map(function (k) { return ids[k].innerHTML; }).join('\n');
  };
  const without = await drawIn(false);
  const withIt = await drawIn(true);
  if (!/id="dd-code"/.test(without) && /id="dd-code"/.test(withIt)) test.check('deskDetails draws Code only when the item\'s facts offer it');
  else test.fail(OWED + 'the dialog drew Code: offered false ' + /id="dd-code"/.test(without) + ', offered true ' + /id="dd-code"/.test(withIt));
}

(async function () { await serverHalf(); await faceHalf(); })().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  try { kid && kid.kill(); } catch (e) { /* gone */ }
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
