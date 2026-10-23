'use strict';

// spirit/test/deskBlocks.js
// goal/G27.5: blocking and blocked-by relationships in the desk. Red on today's code; claude-windows wrote it and builds
// it. The item's box (v10):
//   R1/R2. block(A, B), A blocks B, between two items of one goal; unblock(A, B) unlinks it.
//   R3. a block that would close a circle is refused: "error: circular blocking was asked".
//   R4. an item blocking nothing else blocks the goal.
//   R5. the compiler is a gate: it refuses a block already implied through others, rewrites nothing stated, and only
//       repairs what a delete or close leaves: when B goes and A blocked B while B blocked C, A blocks C.
//   R7. per item in its dialog: the blocks it states, each with a delete (none on the goal fallback), and an add
//       drop-down filled by the desk with only valid targets; blocked-by read-only.
//   R10. a block onto a running item (Go on record, not done or closed) is refused: "error: too late! this is already
//       happening"; the drop-down leaves running items out.
//
// THE SHAPES THIS RED NAMES: verbs block {id, blocks} and unblock {id, blocks} (id is A, blocks is B, as item.add names
// what it blocks); block.targets {id} -> {items: [{key, label}], more}, the valid targets as a bounded search; the
// goal fallback the gate placed (R4) goes once the item blocks something else, since it is then implied. In the
// dialog: buttons data-unblock="<B>" on the item's own blocks, a select #dd-block-add filled from block.targets, and
// #dd-block-go sending block.
// rule/11: through testSupport only; its own folders; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');
const appClient = require('../run/js/appClient.js');
const fieldRules = require('../run/js/fieldRules.js');

const OWED = 'OWED by goal/G27.5: ';
const RUN = path.join(__dirname, '..', 'run');
const DESK = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const DETAILS = path.join(RUN, 'shell', 'deskDetails', 'deskDetails.js');
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskBlocksTestAndyAAAAAAAAAAAAAAAAAAAA=', label: 'Andy' };
const G = 'goal/G100';
const I = function (n) { return G + '.' + n; };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
async function settled() { for (let i = 0; i < 6; i++) await sleep(20); }

test.startTest('goal/G27.5: block and unblock, the gate, the repair, and the dialog');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-desk-blocks-'));
const deskState = path.join(scratch, 'desk-state');
fs.mkdirSync(deskState, { recursive: true });
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'desk.sock');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('desk', pipe);
const call = function (verb, args) {
  const q = {}; q[verb] = args;
  return client.ask({ desk: q }, ANDY).then(function (r) { return (r && r.body) || {}; }, function (e) { return { ok: false, error: e.message }; });
};
async function facts(id) { const r = await call('item.get', { id: id }); try { return JSON.parse(r.item || '{}'); } catch (e) { return {}; } }
async function blocking(id) { return ((await facts(id)).blocking || []).slice().sort().join(','); }
const refusedWith = function (r, re) { return r && r.ok === false && re.test(String((r.extra && r.extra.why) || r.error || '')); };
let kid = null;

async function serverHalf() {
  kid = spawn(process.execPath, [DESK, '{}', '--pipe', pipe, '--state', deskState], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) { await sleep(150); try { const r = await client.ask('api'); up = !!(r.body && r.body.desk && r.body.desk.ok !== false); } catch (e) { /* not yet */ } }
  if (!up) { test.fail('the world: the desk did not start'); return; }
  const items = []; for (let n = 1; n <= 8; n++) items.push({ id: I(n), title: 'item ' + n, blocks: [G] });
  const set = await call('session.set', { json: JSON.stringify({ goal: { id: G, title: 'Blocks' }, items: items }) });
  if (set.ok === false) { test.fail('the world: no session: ' + short(set)); return; }

  test.subHeading('R1, R4. block, and the goal fallback goes once it blocks something');
  const b12 = await call('block', { id: I(1), blocks: I(2) });
  if (b12.ok !== false && await blocking(I(1)) === I(2)) test.check('block 1 -> 2: item 1 blocks item 2 alone (its goal fallback is now implied, and gone)');
  else test.fail(OWED + 'block 1 -> 2 answered ' + short(b12) + '; item 1 blocks ' + await blocking(I(1)));
  if (((await facts(I(2))).blocked || []).indexOf(I(1)) !== -1) test.check('item 2 is blocked by item 1');
  else test.fail(OWED + 'item 2 is blocked by ' + short((await facts(I(2))).blocked));

  test.subHeading('R2, R4. unblock, and the fallback comes back');
  const u12 = await call('unblock', { id: I(1), blocks: I(2) });
  if (u12.ok !== false && await blocking(I(1)) === G) test.check('unblock 1 -> 2: item 1 blocks the goal again');
  else test.fail(OWED + 'unblock 1 -> 2 answered ' + short(u12) + '; item 1 blocks ' + await blocking(I(1)));

  test.subHeading('R3, R5. the gate: circular and implied blocks are refused');
  await call('block', { id: I(1), blocks: I(2) });
  await call('block', { id: I(2), blocks: I(3) });
  const circle = await call('block', { id: I(3), blocks: I(1) });
  if (refusedWith(circle, /circular blocking was asked/)) test.check('block 3 -> 1 over 1 -> 2 -> 3 is refused: ' + short(circle.extra && circle.extra.why));
  else test.fail(OWED + 'a circular block answered ' + short(circle));
  const implied = await call('block', { id: I(1), blocks: I(3) });
  if (implied.ok === false && /implied|already/i.test(String((implied.extra && implied.extra.why) || ''))) test.check('block 1 -> 3, already implied, is refused: ' + short(implied.extra.why));
  else test.fail(OWED + 'an implied block answered ' + short(implied));
  if (await blocking(I(1)) === I(2)) test.check('the refusals changed nothing: item 1 still blocks item 2 alone');
  else test.fail(OWED + 'after the refusals item 1 blocks ' + await blocking(I(1)));

  test.subHeading('R5. the repair after a delete and after a close');
  const del = await call('item.delete', { id: I(2) });
  if (del.ok !== false && await blocking(I(1)) === I(3)) test.check('item 2 deleted: item 1 now blocks item 3');
  else test.fail(OWED + 'after deleting item 2 (' + short(del) + ') item 1 blocks ' + await blocking(I(1)));
  await call('block', { id: I(5), blocks: I(3) });
  await call('block', { id: I(4), blocks: I(5) });
  const closed = await call('press', { id: I(5), what: 'close' });
  if (closed.ok !== false && await blocking(I(4)) === I(3)) test.check('item 5 closed: item 4 now blocks item 3');
  else test.fail(OWED + 'after closing item 5 (' + short(closed) + ') item 4 blocks ' + await blocking(I(4)));

  test.subHeading('R10. a block onto a running item is refused');
  await call('press', { id: I(6), what: 'code' });
  await call('press', { id: G, what: 'end-design' });
  const went = await call('press', { id: I(6), what: 'go' });
  if (went.ok === false) { test.fail('the world: no Go on item 6: ' + short(went)); return; }
  const late = await call('block', { id: I(7), blocks: I(6) });
  if (refusedWith(late, /too late! this is already happening/)) test.check('block 7 -> 6, item 6 running, is refused: ' + short(late.extra && late.extra.why));
  else test.fail(OWED + 'a block onto a running item answered ' + short(late));

  test.subHeading('R7, R10. block.targets offers only valid targets');
  await call('block', { id: I(8), blocks: I(7) });
  const t = await call('block.targets', { id: I(7) });
  const keys = ((t.items || []).map(function (p) { return p.key; })).sort().join(',');
  // For item 7: not itself, not 6 (running), not 8 (it blocks 7: a circle), not the goal; 1, 3 and 4 are valid.
  if (Array.isArray(t.items) && typeof t.more === 'boolean' && keys === [I(1), I(3), I(4)].sort().join(',')) test.check('targets of item 7: ' + keys);
  else test.fail(OWED + 'block.targets for item 7 answered ' + short(t));
  const t1 = await call('block.targets', { id: I(1) });
  const keys1 = ((t1.items || []).map(function (p) { return p.key; })).sort().join(',');
  // For item 1, which blocks 3: not 3 (already), not 6 (running); 4 and 7 and 8 remain valid (4 blocks 3 too, no circle).
  if (keys1 === [I(4), I(7), I(8)].sort().join(',')) test.check('targets of item 1 leave out what it already blocks: ' + keys1);
  else test.fail(OWED + 'block.targets for item 1 answered ' + short(t1));
}

// ── THE DIALOG ──────────────────────────────────────────────────────────
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
function clickOn(attrs) { return { target: { id: attrs.id || '', getAttribute: function (n) { return n in attrs ? attrs[n] : null; }, closest: function () { return { getAttribute: function (n) { return n in attrs ? attrs[n] : null; } }; }, parentNode: null }, preventDefault: function () {}, stopPropagation: function () {} }; }

async function openDialog(facts) {
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  const calls = [];
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
      if (v === 'item.get') return Promise.resolve({ status: 200, body: { item: JSON.stringify(facts), version: 1, change: 1 } });
      if (v === 'block.targets') return Promise.resolve({ status: 200, body: { items: [{ key: I(3), label: 'item 3' }, { key: I(4), label: 'item 4' }], more: false } });
      return Promise.resolve({ status: 200, body: { change: 1, items: [], more: false, checks: [], chat: [], box: '', version: 1 } });
    },
    onPublished: function () { return function () {}; }, onPacket: function () { return function () {}; },
    setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {},
    armUntilElsewhere: function () {}, callDialog: function () { return new Promise(function () {}); },
  });
  dd.open({ id: facts.id, agents: {} });
  await settled();
  // The blocks are the blocks panel's since goal/G30.8: pressing its icon (🪠) shows them and asks block.targets.
  const blocksPanel = async function () { doc.getElementById('dd-body').fire('click', clickOn({ 'data-panel': 'blocks' })); await settled(); };
  return { doc: doc, calls: calls, blocksPanel: blocksPanel, page: function () { return Object.keys(byId).map(function (k) { return byId[k].innerHTML; }).join('\n'); } };
}

async function faceHalf() {
  test.subHeading('R7. the dialog: the item\'s own blocks with a delete, blocked-by read-only, the add drop-down');
  const d = await openDialog({ id: I(1), title: 'item 1', goal: G, status: '', with: '', buttons: [], blocking: [I(2)], blocked: [I(8)], asks: 0, go: false });
  const targetsAsked = function () { return d.calls.filter(function (c) { return c.verb === 'block.targets'; }).length; };
  if (targetsAsked() === 0) test.check('block.targets is not asked on open (goal/G30.8: only when the blocks icon is pressed)');
  else test.fail(OWED + 'block.targets was asked ' + targetsAsked() + ' times on open, before the blocks icon');
  await d.blocksPanel();
  const html = d.page();
  if (/data-unblock="goal\/G100\.2"/.test(html) && !/data-unblock="goal\/G100\.8"/.test(html)) test.check('a delete on its block of item 2, none on item 8 that blocks it');
  else test.fail(OWED + 'the dialog reads ' + short(html.slice(0, 600)));
  if (d.calls.some(function (c) { return c.verb === 'block.targets' && c.args && c.args.id === I(1); }) && /<select[^>]*id="dd-block-add"[\s\S]*goal\/G100\.3[\s\S]*goal\/G100\.4/.test(html)) test.check('the add drop-down holds what block.targets offered');
  else test.fail(OWED + 'block.targets asked ' + d.calls.filter(function (c) { return c.verb === 'block.targets'; }).length + ' times; the drop-down reads ' + short((/<select[^>]*id="dd-block-add"[\s\S]*?<\/select>/.exec(html) || ['none'])[0]));
  const n0 = d.calls.length;
  d.doc.getElementById('dd-block-add').value = I(4);
  const go = d.doc.getElementById('dd-block-go');
  go.fire('click', clickOn({ id: 'dd-block-go' }));
  const body = d.doc.getElementById('dd-body');
  body.fire('click', clickOn({ id: 'dd-block-go' }));
  await settled();
  const sent = d.calls.slice(n0).filter(function (c) { return c.verb === 'block'; })[0];
  if (sent && sent.args.id === I(1) && sent.args.blocks === I(4)) test.check('choosing item 4 and pressing add sends block {id: item 1, blocks: item 4}');
  else test.fail(OWED + 'pressing add sent ' + short(d.calls.slice(n0)));
  const n1 = d.calls.length;
  body.fire('click', clickOn({ 'data-unblock': I(2) }));
  await settled();
  const un = d.calls.slice(n1).filter(function (c) { return c.verb === 'unblock'; })[0];
  if (un && un.args.id === I(1) && un.args.blocks === I(2)) test.check('its delete sends unblock {id: item 1, blocks: item 2}');
  else test.fail(OWED + 'the delete sent ' + short(d.calls.slice(n1)));
  const g = await openDialog({ id: I(5), title: 'item 5', goal: G, status: '', with: '', buttons: [], blocking: [G], blocked: [], asks: 0, go: false });
  await g.blocksPanel();
  if (/id="dd-block-add"/.test(g.page()) && !/data-unblock=/.test(g.page())) test.check('an item that only blocks the goal shows no delete');
  else test.fail(OWED + 'the goal fallback shows a delete');
}

(async function () { await serverHalf(); await faceHalf(); })().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  try { kid && kid.kill(); } catch (e) { /* gone */ }
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
