'use strict';

// spirit/test/deskSmallFixes.js
// goal/G10.10: deskAgent and its Remote: smaller fixes, and the desk's. Red on today's code (386f450b); claude-windows
// wrote it and builds it. The item's box (v4), Andy, 2026-10-12:
//   - "on the Remote: we need a button to the left of the model-picker that allows me to refresh the model list, so i
//     don't have to re-start the Remote or 11111"
//   - "we don't need this: "select the node where your local agent lives", if deskAgent lives on the same node as the
//     Remote, we'll just automatically configure it to the same node, and never show this bubble."
//   - "all refusals everywhere should say why." (Q3); the 19 bare bad-request refusals in desk.js, deskClient.js,
//     chatClerver.js and server.js.
//   - "Do the input field properly, as described in the new rule." rule/12, "Inputs validate with the field rules".
//
// WHAT IS ASSERTED
//   1. no bare bad-request refusal is left in desk.js, deskClient.js, chatClerver.js and server.js: each carries why.
//   2. the desk says why: item.add with an 81-byte title names the title, its bytes and the 64 limit; profile.set with a
//      bad nick names the nick rule.
//   3. the item dialog: the title input is marked data-field="label"; typed over 64 bytes it shows the bytes over and
//      Add is refused without asking the desk; within the limit Add sends; a refusal from the desk is shown with why.
//      The Rename input is marked data-field="label" and refused past the limit the same way.
//   4. the Remote: a refresh button left of the model picker asks the models again; with deskAgent on the Remote's own
//      node the target is that node and the where bubble is never shown; without it the bubble shows.
// NOT ASSERTED: the words of each reason beyond the ones named; layout.
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const vm = require('vm');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');
const appClient = require('../run/js/appClient.js');
const fieldRules = require('../run/js/fieldRules.js');

const OWED = 'OWED by goal/G10.10: ';
const ROOT = path.join(__dirname, '..', '..');
const RUN = path.join(ROOT, 'spirit', 'run');
const DESK = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const DETAILS = path.join(RUN, 'shell', 'deskDetails', 'deskDetails.js');
const APP = path.join(RUN, 'shell', 'deskAgentRemote', 'deskAgentRemote.js');
const LONG = 'deskAgentRemote: Smaller Fixes to the UI and to both deskAgent and its Remote';
// The size and the overrun come from LONG itself (goal/G27.17): the checks named 81 bytes and 17 over, but LONG is 77 bytes,
// so both checks failed against a correct desk and dialog.
const LONG_BYTES = Buffer.byteLength(LONG, 'utf8');
const LONG_OVER = LONG_BYTES - 64;
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskSmallFixesTestOwnerAAAAAAAAAAAAAAA=', label: 'andy' };
const CW = { key: 'MCowBQYDK2VwAyEAdeskSmallFixesTestCWAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 12; i++) await settle(); }

test.startTest('goal/G10.10: refusals say why, inputs follow rule/12, the Remote refreshes and finds its own node');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-desksmallfixes-'));

function sourceHalf() {
  test.subHeading('1. no bare bad-request refusal left');
  const files = ['spirit/run/process/js/desk/desk.js', 'spirit/run/process/js/deskClient/deskClient.js', 'spirit/run/process/js/chatClerver/chatClerver.js', 'spirit/run/js/server.js'];
  const bare = [];
  files.forEach(function (rel) {
    const lines = fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n');
    lines.forEach(function (l, i) {
      if (/^\s*\/\//.test(l)) return;
      if (/refused\('bad-request'\)|refusal\('bad-request'\)|\{ refusal: 'bad-request' \}/.test(l)) bare.push(rel + ':' + (i + 1));
    });
  });
  if (!bare.length) test.check('every bad-request refusal in the desk, deskClient, chatClerver and server.js carries its reason');
  else test.fail(OWED + bare.length + ' bare: ' + bare.join(', '));
}

async function deskHalf() {
  test.subHeading('2. the desk says why');
  const state = path.join(scratch, 'desk-state');
  fs.mkdirSync(state, { recursive: true });
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'desk.sock');
  const client = appClient.createAppClient({ rootDir: scratch });
  client.register('desk', pipe);
  const kid = spawn(process.execPath, [DESK, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  const call = function (verb, args, caller) { const q = {}; q[verb] = args; return client.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function () { return {}; }); };
  try {
    let up = false;
    for (let i = 0; i < 60 && !up; i++) { await sleep(150); try { const r = await client.ask('api'); up = !!(r.body && r.body.desk && r.body.desk.ok !== false); } catch (e) { /* not yet */ } }
    if (!up) { test.fail('the world: the desk did not start'); return; }
    await call('session.set', { json: JSON.stringify({ goal: { id: 'goal/G100', title: 'Fixes' }, items: [{ id: 'goal/G100.1', title: 'One', blocks: ['goal/G100'] }] }) }, CW);
    const add = await call('item.add', { goal: 'goal/G100', title: LONG, blocks: 'goal/G100' }, ANDY);
    const why = String(((add.body || {}).extra || {}).why || '');
    if ((add.body || {}).ok === false && /title/i.test(why) && why.indexOf(String(LONG_BYTES)) !== -1 && /64/.test(why)) test.check('item.add with a ' + LONG_BYTES + '-byte title says why: ' + why);
    else test.fail(OWED + 'item.add answered ' + short(add.body));
    const prof = await call('profile.set', { agent: CW.key, name: 'gemma', nick: 'NO SPACES' }, ANDY);
    const pwhy = String(((prof.body || {}).extra || {}).why || '');
    if ((prof.body || {}).ok === false && /nick/i.test(pwhy)) test.check('profile.set with a bad nick says why: ' + pwhy);
    else test.fail(OWED + 'profile.set answered ' + short(prof.body));

    // goal/G33.2. Andy: "make an item go red in the list when the phase holder posts a report or questions ..., so
    // that my attention is caught when something happens", and "red until i open it, it may be just a status report".
    test.subHeading('2b. a line from the phase holder marks the item until he opens it (goal/G33.2)');
    const G33 = 'OWED by goal/G33.2: ';
    const factsOf = async function (id) { const r = await call('item.get', { id: id }, ANDY); try { return JSON.parse((r.body || {}).item); } catch (e) { return {}; } };
    // Its own goal, written by the owner (goal/G29.21: an agent's session creates none).
    await call('session.set', { json: JSON.stringify({ goal: { id: 'goal/G101', title: 'Marks' }, items: [{ id: 'goal/G101.1', title: 'Held', blocks: ['goal/G101'] }] }) }, ANDY);
    await call('press', { id: 'goal/G101', what: 'end-design' }, ANDY);
    await call('press', { id: 'goal/G101.1', what: 'code' }, ANDY);
    await call('press', { id: 'goal/G101.1', what: 'go' }, ANDY);
    await call('item.take', { id: 'goal/G101.1' }, CW);
    await call('phase.take', { id: 'goal/G101.1', phase: 'red' }, CW);
    const before = await factsOf('goal/G101.1');
    await call('chat.add', { id: 'goal/G101.1', text: 'a report from the phase holder' }, CW);
    const marked = await factsOf('goal/G101.1');
    await call('press', { id: 'goal/G101.1', what: 'seen' }, ANDY);
    const seen = await factsOf('goal/G101.1');
    await call('chat.add', { id: 'goal/G101.1', text: 'his own line' }, ANDY);
    const his = await factsOf('goal/G101.1');
    if (before.phase === 'red' && before.alert !== true && marked.alert === true) test.check('the phase holder\'s line marks the item');
    else test.fail(G33 + 'phase ' + before.phase + ', marked before ' + before.alert + ', after the holder\'s line ' + marked.alert);
    if (seen.alert !== true && his.alert !== true) test.check('his seen clears it, and his own line does not mark it');
    else test.fail(G33 + 'after seen ' + seen.alert + ', after his own line ' + his.alert);
    const list = fs.readFileSync(path.join(RUN, 'shell', 'desk', 'desk.js'), 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n');
    if (/row\.alert \?[^:]*(color|class)[^:]*red|alert[^\n]*desk-row-red|data-alert/.test(list)) test.check('the List draws a marked row red');
    else test.fail(G33 + 'the List does not draw a marked row red');
    if (!/deskVerifier\.queued/.test(list)) test.check('the Verifier tab shows no queue');
    else test.fail(G33 + 'the Verifier tab still draws its queue');
  } finally {
    await new Promise(function (r) { kid.once('exit', r); kid.kill(); setTimeout(r, 3000); });
  }
}

function fakeElement(id) {
  let html = '';
  const attrs = {};
  const el = {
    id: id, value: '', textContent: '', hidden: false, disabled: false, style: {}, listeners: {}, placeholder: '', className: '', scrollTop: 0, scrollHeight: 0,
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function (n) { return n in attrs ? attrs[n] : null; }, setAttribute: function (n, v) { attrs[n] = String(v); }, removeAttribute: function (n) { delete attrs[n]; }, focus: function () {},
    appendChild: function () {}, removeChild: function () {}, replaceChild: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}

async function dialogHalf() {
  test.subHeading('3. the item dialog follows rule/12');
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  const calls = [];
  let refuseWith = null;
  let dd = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(DETAILS, 'utf8'))(
    { shell: { activateApp: function (x) { dd = x; } }, core: kernel.core }, doc, test.withSpirit({ addEventListener: function () {}, 'spirit.fieldRules': fieldRules }));
  dd.mount(fakeElement('dd'), {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      // The desk's verbs by name (desk.<verb>, goal/G30.6), folded back to {desk: {verb: args}}.
      const ask = (test.foldAsk(Object.assign({}, body, { verb: name })) || {}).desk;
      const v = ask && Object.keys(ask)[0];
      calls.push({ verb: v, args: ask && ask[v] });
      if ((v === 'item.add' || v === 'item.rename') && refuseWith) return Promise.resolve({ status: 400, body: refuseWith });
      if (v === 'item.add') return Promise.resolve({ status: 200, body: { id: 'goal/G100.7', change: 9 } });
      if (v === 'item.get') return Promise.resolve({ status: 200, body: { item: JSON.stringify({ id: 'goal/G100.2', title: 'Second', goal: 'goal/G100', status: 'running', with: '', buttons: [], blocking: ['goal/G100'], blocked: [], asks: 0 }), version: 1, change: 1 } });
      return Promise.resolve({ status: 200, body: { change: 1, items: [], more: false, checks: [], chat: [], box: '', version: 1 } });
    },
    onPublished: function () { return function () {}; }, onPacket: function () { return function () {}; },
    setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {},
    peerPost: function () { return Promise.resolve({ ok: true }); }, armUntilElsewhere: function () {},
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  dd.open({ id: 'goal/G100.2', agents: {} });
  await settled();
  const body = doc.getElementById('dd-body');
  const target = function (id) { const el = doc.getElementById(id); return { id: id, value: el.value, getAttribute: function (n) { return n === 'id' ? id : (n === 'data-field' ? 'label' : null); }, closest: function () { return null; } }; };
  const sentOf = function (verb, from) { return calls.slice(from).filter(function (c) { return c.verb === verb; }); };

  if (/<input[^>]*id="dd-add-title"[^>]*data-field="label"|<input[^>]*data-field="label"[^>]*id="dd-add-title"/.test(body.innerHTML)) test.check('the title input is marked data-field="label"');
  else test.fail(OWED + 'the title input reads ' + short((/<input[^>]*id="dd-add-title"[^>]*>/.exec(body.innerHTML) || [''])[0]));

  doc.getElementById('dd-add-title').value = LONG;
  body.fire('input', { target: target('dd-add-title') });
  await settled();
  const all = function () { return Object.keys(byId).map(function (k) { return byId[k].innerHTML + ' ' + byId[k].textContent; }).join('\n'); };
  if (new RegExp(LONG_OVER + ' bytes? (too many|over)|over by ' + LONG_OVER + '|-' + LONG_OVER).test(all())) test.check('typed over the limit, it says by how many bytes (' + LONG_BYTES + ' of 64: ' + LONG_OVER + ' over)');
  else test.fail(OWED + 'after typing ' + LONG_BYTES + ' bytes nothing says ' + LONG_OVER + ' over: ' + short(all().slice(0, 400)));
  const n0 = calls.length;
  body.fire('click', { target: target('dd-add'), preventDefault: function () {}, stopPropagation: function () {} });
  await settled();
  if (!sentOf('item.add', n0).length) test.check('and Add sends nothing while the rule says no');
  else test.fail(OWED + 'Add sent ' + short(sentOf('item.add', n0)));

  doc.getElementById('dd-add-title').value = 'Do this first';
  body.fire('input', { target: target('dd-add-title') });
  const n1 = calls.length;
  body.fire('click', { target: target('dd-add'), preventDefault: function () {}, stopPropagation: function () {} });
  await settled();
  if (sentOf('item.add', n1).length === 1) test.check('within the limit Add sends item.add');
  else test.fail(OWED + 'a 13-byte title sent ' + short(calls.slice(n1)));

  refuseWith = { ok: false, code: 'bad-request', error: 'text required', extra: { why: 'the goal goal/G100 is closed' } };
  doc.getElementById('dd-add-title').value = 'Another';
  body.fire('input', { target: target('dd-add-title') });
  body.fire('click', { target: target('dd-add'), preventDefault: function () {}, stopPropagation: function () {} });
  await settled();
  if (/the goal goal\/G100 is closed/.test(all())) test.check('a refusal from the desk is shown with its why');
  else test.fail(OWED + 'the refusal shown reads ' + short((doc.getElementById('dd-error').innerHTML || '') + ' ' + (doc.getElementById('dd-error').textContent || '')));
  refuseWith = null;

  body.fire('click', { target: target('dd-rename'), preventDefault: function () {}, stopPropagation: function () {} });
  await settled();
  const bar = doc.getElementById('dd-name-row').innerHTML;
  if (/<input[^>]*id="dd-name"[^>]*data-field="label"|<input[^>]*data-field="label"[^>]*id="dd-name"/.test(bar)) test.check('the Rename input is marked data-field="label"');
  else test.fail(OWED + 'the Rename input reads ' + short((/<input[^>]*id="dd-name"[^>]*>/.exec(bar) || [''])[0]));
  doc.getElementById('dd-name').value = LONG;
  body.fire('input', { target: target('dd-name') });
  const n2 = calls.length;
  body.fire('click', { target: target('dd-name-save'), preventDefault: function () {}, stopPropagation: function () {} });
  await settled();
  if (!sentOf('item.rename', n2).length) test.check('and Save sends nothing past the limit');
  else test.fail(OWED + 'Save sent ' + short(sentOf('item.rename', n2)));
}

async function remoteHalf() {
  test.subHeading('4. the Remote: refresh, and its own node');
  const READY = { connected: true, persona: 'Levant', model: 'm', server: { url: 'u', answers: true, error: '' } };
  const MODELS = { active: 'm', activeQuant: 'Q4', cached: false, load: {}, test: {}, models: [{ id: 'm', quant: 'Q4', loaded: true, recommended: true }] };
  async function mount(local) {
    const byId = {};
    const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
    const calls = [];
    let behavior = null;
    const ctx = { spirit: { shell: { activateApp: function (a) { behavior = a; } }, core: kernel.core, keyTail: function (k) { return String(k).slice(-6); } }, document: doc, window: {}, console: console, setTimeout: setTimeout, clearTimeout: clearTimeout };
    ctx.window = ctx;
    vm.runInNewContext(fs.readFileSync(APP, 'utf8'), ctx, { filename: APP });
    behavior.mount(doc.getElementById('container'), {
      escapeHtml: kernel.core.util.escapeHtml, onPublished: function () {},
      fs: { loadFile: function (n) { return n === 'puppets.json' ? JSON.stringify({ puppets: [{ name: 'agent', key: 'KEY-AGENT' }] }) : null; } },
      verb: function (name, body) {
        calls.push({ name: name, body: body });
        if (name === 'api') return Promise.resolve({ status: 200, body: local ? { desk: {}, deskAgent: {} } : { desk: {} } });
        // deskAgent's verbs by name (deskAgent.<verb>, goal/G30.6) here; on a puppet the same name rides in owner.command.
        const here = String(name).indexOf('deskAgent.') === 0;
        const named = here ? String(name) : name === 'owner.command' ? String((body && body.command) || '') : '';
        const v = named.indexOf('deskAgent.') === 0 ? named.slice('deskAgent.'.length) : '';
        if (here && !local) return Promise.resolve({ status: 404, body: { ok: false, code: 'app-not-served', error: 'deskAgent is not served here' } });
        // goal/G27.17: the picker asks models.search; it answers as models did.
        const said = v === 'state' ? READY : (v === 'models' || v === 'models.search') ? MODELS : {};
        return Promise.resolve(here ? { status: 200, body: said } : { status: 200, body: { ok: true, status: 200, body: said } });
      },
    });
    for (let i = 0; i < 6; i++) { await settled(); await sleep(20); }
    return { doc: doc, calls: calls };
  }
  const own = await mount(true);
  const models = own.doc.getElementById('dur-models').innerHTML;
  const r = models.indexOf('id="dur-refresh"');
  const s = models.indexOf('id="dur-model"');
  if (r !== -1 && s !== -1 && r < s) test.check('a refresh button sits left of the model picker');
  else test.fail(OWED + '#dur-models reads ' + short(models));
  const asked = function (c) { return c.slice().filter(function (x) { const named = x.name === 'owner.command' ? String((x.body && x.body.command) || '') : String(x.name); return named === 'deskAgent.models' || named === 'deskAgent.models.search'; }).length; };
  const before = asked(own.calls);
  own.doc.getElementById('dur-refresh').fire('click', {});
  await settled();
  if (asked(own.calls) > before) test.check('pressing it asks the models again');
  else test.fail(OWED + 'refresh asked nothing: ' + short(own.calls.slice(-3)));
  const where = own.doc.getElementById('dur-where');
  if (own.doc.getElementById('dur-target').value === '0' && where.style.display === 'none') test.check('with deskAgent on its own node, the target is that node and the where bubble is not shown');
  else test.fail(OWED + 'own node: target ' + short(own.doc.getElementById('dur-target').value) + ', where bubble display ' + short(where.style.display));
  const away = await mount(false);
  const where2 = away.doc.getElementById('dur-where');
  if (where2.style.display !== 'none' && /select the node where your local agent lives/.test(away.doc.getElementById('dur-tab-connect').innerHTML)) test.check('without it on its own node, the where bubble shows');
  else test.fail(OWED + 'no deskAgent here: where bubble display ' + short(where2.style.display));
}

(async function () {
  sourceHalf();
  await deskHalf();
  await dialogHalf();
  await remoteHalf();
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
