'use strict';

// spirit/test/deskBoundedInterface.js
// goal/G33.7: the desk's interface, bounded answers and no superfluous verbs. The box (v9), among others: "The desk's
// interface itself prevents oversized answers: no verb fetches a whole goal or a whole item; every verb that could
// answer past the payload is removed or reshaped into bounded reads, and superfluous interfaces are removed.", "Every
// desk table's interface has its probability search, mandatory and made by one shared component rather than written
// per table; the suites table's is item.suites.search", and the approved verb list (delete: rule.history, state.get,
// state.set, session.set, deskClient.changed, items.find; reshape: item.checks with a more flag, seen one row per item,
// a goal row's lists of every agent ever seen bounded; add: each table's probability search).
//
// WHAT IS ASSERTED, by outcome, on a real desk of its own:
//   1. The deleted verbs are refused no-such-verb, named in no interface file, and no verb file is left for them;
//      deskClient's interface names no changed.
//   2. item.checks of an item holding many long checks answers under one answer and says checksMore.
//   3. Seen is one value per item: seen.set {id, at} then seen.get {id} answers that time; the docs table is gone.
//   4. Every table has its probability search, each answering under one answer with a more flag:
//      item.suites.search, item.checks.search, item.files.search, item.claims.search, item.box.search, agents.search,
//      beside items.search, chat.search and rules.search; text ranks the matching row first. Statically, every
//      search verb in desk.js is made by the one component (tableSearch).
//   5. A goal whose desk has seen many agents: its row still fits one answer (item.get) and says agentsMore, and
//      agents.search finds an agent the row left out.
// rule/11: through testSupport only; its own folder, pipe and port; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G33.7: ';
const RUN = path.join(__dirname, '..', 'run');
const DESK = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskBoundedTestAndyAAAAAAAAAAAAAAAAAAAAAA=', label: 'andy' };
const AGENT = { key: 'MCowBQYDK2VwAyEAdeskBoundedTestAgentAAAAAAAAAAAAAAAAAAAAA=', label: 'bounded-agent' };
const MAX = appClient.ANSWER_MAX;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parse(x) { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch (e) { return x; } }
function took(r) { return !!r && r.status === 200 && !!r.body && r.body.ok !== false; }
function bytes(x) { return Buffer.byteLength(JSON.stringify(x === undefined ? null : x), 'utf8'); }
function agentKey(n) { const s = 'MCowBQYDK2VwAyEAdeskBoundedAgent' + n; return s + 'A'.repeat(59 - s.length) + '='; }

test.startTest('goal/G33.7: the desk\'s interface answers bounded, and its superfluous verbs are gone');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-desk-bounded-'));
const state = path.join(scratch, 'state');
fs.mkdirSync(state, { recursive: true });
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'desk.sock');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('desk', pipe);
const call = function (verb, args, caller) {
  const q = {}; q[verb] = args;
  return client.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function (e) { return { status: 0, error: e.message }; });
};
const node = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    { const na = test.nodeApi(b); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":true}');
  });
});
let kid = null;

async function main() {
  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  kid = spawn(process.execPath, [DESK, '{}', '--pipe', pipe, '--state', state], {
    cwd: scratch, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'desk-bounded', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.address().port + '/api/spirit' }),
  });
  let up = false;
  for (let i = 0; i < 80 && !up; i++) { await sleep(150); try { const r = await client.ask('api'); up = !!(r.body && r.body.desk && r.body.desk.ok !== false); } catch (e) { /* not yet */ } }
  if (!up) { test.fail('the world: the desk did not start'); return; }
  // The world, through the verbs that remain: one goal, made current, and two items.
  const g = await call('goal.add', { title: 'Bounded' }, ANDY);
  const gid = took(g) ? String(g.body.id) : '';
  await call('press', { id: gid, what: 'make-current' }, ANDY);
  const i1 = await call('item.add', { goal: gid, title: 'Holds the checks' }, ANDY);
  const i2 = await call('item.add', { goal: gid, title: 'Holds the rest' }, ANDY);
  const one = took(i1) ? String(i1.body.id) : '';
  const two = took(i2) ? String(i2.body.id) : '';
  if (!gid || !one || !two) { test.fail('the world: goal.add/item.add answered ' + short([g.body, i1.body, i2.body])); return; }

  test.subHeading('1. the deleted verbs are gone, from the desk and from every interface');
  const GONE = { 'rule.history': { key: 'rule/1' }, 'state.get': {}, 'state.set': { json: '{}' }, 'session.set': { json: '{}' }, 'items.find': { text: '', by: '', since: '', before: '' } };
  const served = [];
  for (const v of Object.keys(GONE)) { const r = await call(v, GONE[v], ANDY); if (!(r.body && r.body.code === 'no-such-verb')) served.push(v + ' ' + short(r.body)); }
  const deskApi = fs.readFileSync(path.join(RUN, 'process', 'js', 'desk', 'desk.family', 'api.js'), 'utf8');
  const named = Object.keys(GONE).filter(function (v) { return deskApi.indexOf("'" + v + "'") !== -1; });
  const files = Object.keys(GONE).filter(function (v) { return fs.existsSync(path.join(RUN, 'process', 'js', 'desk', 'desk.family', v + '.json')); });
  const clientApi = require(path.join(RUN, 'process', 'js', 'deskClient', 'deskClient.family', 'api.js'));
  if (!served.length && !named.length && !files.length && !('changed' in clientApi.verbs)) test.check('rule.history, state.get, state.set, session.set and items.find are refused no-such-verb, named nowhere, no verb file left; deskClient names no changed');
  else test.fail(OWED + 'still served ' + short(served) + '; in desk api.js ' + short(named) + '; verb files ' + short(files) + '; deskClient changed ' + ('changed' in clientApi.verbs));

  test.subHeading('2. item.checks answers one answer, and says more');
  for (let k = 0; k < 30; k++) await call('check.add', { id: one, kind: 'C', words: 'check ' + k + ' ' + 'x'.repeat(380), test: '' }, ANDY);
  const ch = await call('item.checks', { id: one }, ANDY);
  if (took(ch) && bytes(ch.body) <= MAX && Array.isArray(ch.body.checks) && ch.body.checks.length > 0 && ch.body.checksMore === true) test.check('item.checks of an item with 30 long checks answered ' + ch.body.checks.length + ' in ' + bytes(ch.body) + ' bytes, checksMore');
  else test.fail(OWED + 'item.checks answered ' + ch.status + ' ' + bytes(ch.body) + ' bytes, more ' + short(ch.body && ch.body.checksMore) + ': ' + short(ch.body));

  test.subHeading('3. seen is one value per item');
  const at = '2026-10-23T12:00:00.000Z';
  const ss = await call('seen.set', { id: two, at: at }, ANDY);
  const sg = await call('seen.get', { id: two }, ANDY);
  let docs = true;
  try { const db = new DatabaseSync(path.join(state, 'desk.db'), { readOnly: true }); docs = !!db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'docs'").get(); db.close(); } catch (e) { docs = true; }
  if (took(ss) && took(sg) && sg.body.at === at && !docs) test.check('seen.set {id, at} then seen.get {id} answered ' + at + ', and there is no docs table');
  else test.fail(OWED + 'seen.set answered ' + short(ss.body) + ', seen.get ' + short(sg.body) + ', docs table ' + docs);

  test.subHeading('4. every table has its probability search, from one component');
  await call('box.write', { id: two, text: 'first walrus box', version: 0 }, ANDY);
  await call('box.write', { id: two, text: 'second box', version: 1 }, ANDY);
  // goal/G40.3: one row a write, so the two paths are two adds.
  await call('item.files.add', { id: two, path: 'spirit/test/zzWalrus.js' }, AGENT);
  await call('item.files.add', { id: two, path: 'spirit/test/zzOther.js' }, AGENT);
  await call('check.add', { id: two, kind: 'Q', words: 'Is the walrus here?', test: '' }, ANDY);
  await call('chat.add', { id: two, text: 'the walrus line' }, ANDY);
  const SEARCHES = {
    'item.box.search': { id: two, text: 'walrus' },
    'item.checks.search': { id: two, text: 'walrus' },
    'item.files.search': { id: two, text: 'walrus' },
    'item.claims.search': { id: two, text: '' },
    'item.suites.search': { id: two, text: '' },
    'agents.search': { text: 'bounded-agent' },
    'items.search': { text: 'walrus', currentGoalOnly: false, goalsOnly: false, includeClosed: false },
    'chat.search': { id: two, text: 'walrus', by: '', since: '', before: '', scope: '' },
    'rules.search': { text: '', types: [], statuses: [] },
  };
  const bad = [];
  for (const v of Object.keys(SEARCHES)) {
    const r = await call(v, SEARCHES[v], ANDY);
    if (!took(r) || !Array.isArray(r.body.items) || typeof r.body.more !== 'boolean' || bytes(r.body) > MAX) { bad.push(v + ' ' + r.status + ' ' + short(r.body)); continue; }
    const t = SEARCHES[v].text;
    // items.search finds the item by its box and chat, which its label (the facts) does not carry: by key.
    const first = r.body.items[0];
    if (t && v !== 'agents.search' && !(first && (v === 'items.search' ? first.key === two : /walrus/i.test(String(first.label))))) bad.push(v + ' ranked first ' + short(first));
    if (v === 'agents.search' && !r.body.items.some(function (x) { return x.key === AGENT.label; })) bad.push(v + ' did not find ' + AGENT.label);
  }
  const deskCode = fs.readFileSync(DESK, 'utf8').split(/\r?\n/).filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n');
  const searchVerbs = (deskCode.match(/^ {2}'[\w.]+\.search':/gm) || []).map(function (s) { return s.trim().slice(1, -2); });
  const handRolled = searchVerbs.filter(function (v) { return !new RegExp("^ {2}'" + v.replace(/\./g, '\\.') + "': tableSearch\\(", 'm').test(deskCode); });
  if (!bad.length && searchVerbs.length >= 9 && !handRolled.length) test.check('the nine table searches answer bounded with a more flag, the text\'s row first; every search verb in desk.js is tableSearch(...)');
  else test.fail(OWED + 'searches: ' + short(bad) + '; search verbs in desk.js ' + short(searchVerbs) + ', not from tableSearch ' + short(handRolled));

  test.subHeading('5. a goal row with many agents fits one answer');
  for (let n = 0; n < 160; n++) await call('agent.state', { word: 'listening' }, { key: agentKey(n), label: 'agent-with-a-rather-long-label-' + n });
  const gf = await call('item.get', { id: gid }, ANDY);
  const facts = took(gf) ? parse(gf.body.item) || {} : {};
  const far = await call('agents.search', { text: 'agent-with-a-rather-long-label-0' }, ANDY);
  const found0 = took(far) && far.body.items.some(function (x) { return x.key === 'agent-with-a-rather-long-label-0'; });
  if (took(gf) && bytes(gf.body) <= MAX && facts.agentsMore === true && found0) test.check('with 160 agents the goal\'s item.get answered ' + bytes(gf.body) + ' bytes, agentsMore, and agents.search found the oldest');
  else test.fail(OWED + 'the goal\'s item.get answered ' + gf.status + ' ' + bytes(gf.body) + ' bytes, agentsMore ' + short(facts.agentsMore) + '; agents.search found it ' + found0);

  // ── 6. NO DESK ANSWER CARRIES HIS LINES (goal/G33.7; Andy: "why? my lines are streamed to deskClient without any
  // further assistance"). Found live: goal/G33.4's item.get by the agent holding it answered app-answer-too-large, 8,930
  // bytes, his lines since its take joined to the facts (goal/G29.10's join, now gone). The holder's reads and writes
  // answer what was asked; his lines reach it on the stream and through next (deskClientPush.js).
  test.subHeading('6. a phase holder\'s reads and writes carry none of his lines');
  // A goal of its own, so the open Q of section 4 holds nothing back here.
  const g6 = await call('goal.add', { title: 'Held' }, ANDY);
  const gid6 = took(g6) ? String(g6.body.id) : '';
  const i3 = await call('item.add', { goal: gid6, title: 'Held while he talks' }, ANDY);
  const three = took(i3) ? String(i3.body.id) : '';
  await call('press', { id: gid6, what: 'end-design' }, ANDY);
  await call('press', { id: three, what: 'go' }, ANDY);
  const taken = await call('phase.take', { id: three, phase: 'red' }, AGENT);
  for (let k = 0; k < 25; k++) await call('chat.add', { id: three, text: 'his line ' + k + ' ' + 'é'.repeat(200) }, ANDY);
  const answers = {
    'item.get': await call('item.get', { id: three }, AGENT),
    'chat.add': await call('chat.add', { id: three, text: 'the holder answers' }, AGENT),
    'item.files.add': await call('item.files.add', { id: three, path: 'spirit/test/zzHeld.js' }, AGENT),
    'box.write': await call('box.write', { id: three, text: 'the holder\'s box', version: 0 }, AGENT),
  };
  const joined = Object.keys(answers).filter(function (v) { const r = answers[v]; return !took(r) || bytes(r.body) > MAX || 'andy' in r.body; });
  if (took(taken) && !joined.length && !/\bfunction heard\(|\.andy\s*=/.test(deskCode)) test.check('the holder\'s item.get, chat.add, item.files.add and box.write answered without any line of his, each under one answer; desk.js joins none');
  else test.fail(OWED + 'phase.take answered ' + short(taken.body) + '; answers with his lines or too big: ' + short(joined.map(function (v) { return v + ' ' + answers[v].status + ' ' + bytes(answers[v].body) + ' andy ' + ('andy' in (answers[v].body || {})); })));

  // ── 7. WORK IS THE CURRENT GOAL'S (goal/G33.8, box v14): work.open walked every goal, so a job left in an old goal (found
  // live: goal/G29.17's build) was offered to every listening agent. It offers the current goal's jobs alone.
  test.subHeading('7. work.open offers the current goal\'s jobs, none from another goal');
  const jobGoal = async function (title) {
    const g = await call('goal.add', { title: title }, ANDY);
    const id = took(g) ? String(g.body.id) : '';
    const it = await call('item.add', { goal: id, title: title + ' item' }, ANDY);
    const item = took(it) ? String(it.body.id) : '';
    await call('press', { id: id, what: 'end-design' }, ANDY);
    await call('press', { id: item, what: 'go' }, ANDY);
    return { goal: id, item: item };
  };
  const old = await jobGoal('Old work');
  const now = await jobGoal('Current work');
  await call('press', { id: now.goal, what: 'make-current' }, ANDY);
  const FRESH = { key: 'MCowBQYDK2VwAyEAdeskBoundedTestFreshAAAAAAAAAAAAAAAAAAAAA=', label: 'fresh-agent' };
  const wo = await call('work.open', {}, FRESH);
  const offered = (((wo.body || {}).items) || []).map(function (x) { try { return JSON.parse(x.label).id; } catch (e) { return ''; } });
  if (took(wo) && offered.indexOf(now.item) !== -1 && offered.indexOf(old.item) === -1) test.check('the red of ' + now.item + ' (current goal) is offered; the red of ' + old.item + ' (another goal) is not');
  else test.fail(OWED.replace('G33.7', 'G33.8') + 'work.open offered ' + short(offered) + ' (current ' + now.item + ', other ' + old.item + ')');
}

main().catch(function (e) { test.fail(OWED + 'the suite itself tripped: ' + (e && e.stack || e)); }).then(function () {
  try { if (kid && kid.exitCode === null) kid.kill(); } catch (e) { /* gone */ }
  try { node.close(); } catch (e) { /* closed */ }
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 500);
});
