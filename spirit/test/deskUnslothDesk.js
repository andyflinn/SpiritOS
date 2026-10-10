'use strict';

// spirit/test/deskUnslothDesk.js
// goal/G14.7: Levant's desk participation. Written as the red of the item, red on the tree before its build
// (0d4f6bb9); claude-windows wrote it and builds it (one agent, Andy's word). The rulings are the item's box,
// Andy's of 2026-10-10:
//
//   "can we give it the API for desk? those parts that make it usefull?"; "i want it to participate in desk
//    usefully and get those small-scoped tasks."; "Levant is restricted by the tools we give him."; the first set
//    of verbs "agreed.": items.search, item.get, item.box, item.checks, item.chat, chat.add, item.take,
//    item.status, check.add, work.open.
//
// WHAT IS ASSERTED (the box)
//   1. THE VERB FILES: process/js/desk/<verb>.json for the ten, each a description and the request as the desk
//      declares it; the family of the desk's folder lists them (introSpector.family against the real folder).
//   2. THE OBJECT with a desk route: describe(desk) asks AGENTS.introspect and AGENTS.<verb> through the route and
//      gives ten tools named desk_<verb with underscores>, parameters typed from the files; run reads the name
//      back, asks the route the bare verb with the model's arguments, hands a json answer back as json and a
//      refusal in the desk's words; a name never listed reaches nothing.
//   3. THE PROCESS: a line addressed to the persona brings a call carrying the desk's tools beside net's and the
//      note that its final text is posted for it; a desk tool call goes out as jobs.api deskClient.desk {verb,
//      json} and the model is asked again; the final text is posted under the item once.
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G14.7: ';
const ROOT = path.join(__dirname, '..', '..');
const RUN = path.join(ROOT, 'spirit', 'run');
const AGENT = path.join(RUN, 'process', 'js', 'deskUnsloth', 'deskUnsloth.js');
const TOOLS = path.join(RUN, 'process', 'js', 'deskUnsloth', 'tools.js');
const DESK_DIR = path.join(RUN, 'process', 'js', 'desk');
const TEN = ['items.search', 'item.get', 'item.box', 'item.checks', 'item.chat', 'chat.add', 'item.take', 'item.status', 'check.add', 'work.open'];
const CONFIGURATION = { persona: 'Levant', preamble: 'you are Levant, a genius', model: 'fake/Levant-Test-GGUF', contextLimit: 4000, answerTokens: 100, bytesPerToken: 4 };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { if (fn()) return true; await sleep(50); } return fn(); }
function fileOf(stem) { try { return JSON.parse(fs.readFileSync(path.join(DESK_DIR, stem + '.json'), 'utf8')); } catch (e) { return null; } }

// ── THE FAKE DESK, as deskClient.desk hands its answers back ────────────
const ITEMS = { 'x/G1': { id: 'x/G1', title: 'The item Levant reads', goal: 'x/G0', status: 'running', with: '', buttons: [], blocking: [], blocked: [], go: true } };
const deskAsks = [];
function deskAnswer(verb, args) {
  deskAsks.push({ verb: verb, args: args });
  if (verb === 'AGENTS') return { text: 'the rules' };
  if (verb === 'AGENTS.introspect') return { items: TEN.filter(function (s) { return fileOf(s); }).map(function (s) { return { key: s, label: String(fileOf(s).description) }; }), more: false };
  if (verb.indexOf('AGENTS.') === 0) { const f = fileOf(verb.slice(7)); return f || { ok: false, code: 'no-such-verb', error: 'no such verb' }; }
  if (verb === 'item.get') { const it = ITEMS[args.id]; return it ? { item: JSON.stringify(it), version: 2, change: 7 } : { ok: false, code: 'no-such-item', error: 'no such item' }; }
  if (verb === 'item.box') return ITEMS[args.id] ? { box: 'THE BOX of ' + args.id + ': read me.', version: 2 } : { ok: false, code: 'no-such-item', error: 'no such item' };
  if (verb === 'item.chat') return { chat: [{ by: 'andy', at: 't', text: 'levant: what does the box of x/G1 say', taken: '' }], chatMore: false };
  if (verb === 'item.checks') return { checks: [] };
  if (verb === 'items.search') return { items: Object.keys(ITEMS).map(function (k) { return { key: k, label: JSON.stringify(ITEMS[k]) }; }), more: false };
  if (verb === 'work.open') return { items: [], more: false };
  if (verb === 'chat.add' || verb === 'item.take' || verb === 'item.status' || verb === 'check.add') return { change: 9 };
  if (verb === 'signoff') return { change: 3 };
  return { ok: false, code: 'no-such-verb', error: 'the fake desk has no ' + verb };
}

// ── THE FAKE NODE: jobs.api for deskClient (next, desk), jobs.update, and no net family ──
let nextQueue = [];
const published = [];
const node = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    function answer(status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); }
    if (b.verb === 'jobs.update') { if (b.app && typeof b.app === 'object') published.push(b.app); return answer(200, { ok: true }); }
    if (b.verb === 'net.AGENTS.introspect') return answer(200, { items: [], more: false });
    const dc = b.verb === 'jobs.api' && b.ask && b.ask.deskClient;
    if (!dc) return answer(404, { ok: false, code: 'no-such-verb', error: 'the fake node has no ' + b.verb });
    if (dc.next) { if (nextQueue.length) return answer(200, { lines: nextQueue.shift() }); return setTimeout(function () { answer(200, { lines: [] }); }, 100); }
    if (dc.desk) {
      let args = null; try { args = JSON.parse(dc.desk.json || '{}'); } catch (e) { args = null; }
      const a = deskAnswer(String(dc.desk.verb || ''), args || {});
      return answer(200, a);
    }
    return answer(404, { ok: false, code: 'no-such-verb', error: 'the fake deskClient has next and desk alone' });
  });
});

// ── THE FAKE STUDIO ─────────────────────────────────────────────────────
const studio = { chats: [] };
let script = [];
const studioServer = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let body = null; try { body = JSON.parse(raw); } catch (e) { body = null; }
    function answer(status, obj) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }
    const p = req.url.split('?')[0];
    if (p === '/api/models/cached-gguf') return answer(200, { cached: [] });
    if (p === '/v1/models') return answer(200, { object: 'list', data: [] });
    if (p === '/api/inference/status') return answer(200, { active_model: CONFIGURATION.model, loaded: [CONFIGURATION.model], supports_tools: true, context_length: 4000 });
    if (p === '/v1/chat/completions' && req.method === 'POST') {
      studio.chats.push(body);
      const step = script.length ? script.shift() : { text: 'nothing scripted' };
      const message = step.toolCalls ? { role: 'assistant', content: '', tool_calls: step.toolCalls } : { role: 'assistant', content: step.text };
      return setTimeout(function () { answer(200, { id: 'fake', object: 'chat.completion', choices: [{ index: 0, message: message, finish_reason: step.toolCalls ? 'tool_calls' : 'stop' }] }); }, 100);
    }
    answer(404, { detail: 'API endpoint not found' });
  });
});
function toolCall(id, name, args) { return { id: id, type: 'function', function: { name: name, arguments: JSON.stringify(args) } }; }

// ── THE AGENT ────────────────────────────────────────────────────────────
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskunsloth-desk-'));
const state = path.join(scratch, 'relay-state', 'process', 'deskUnsloth');
fs.mkdirSync(state, { recursive: true });
const pipe = appClient.pipePathFor(scratch, 'deskUnsloth', process.platform, 'process');
let kid = null;
let out = { stdout: '', stderr: '', code: null };
function start() {
  out = { stdout: '', stderr: '', code: null };
  kid = spawn(process.execPath, [AGENT, '{}', '--pipe', pipe, '--state', state], {
    cwd: scratch, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'test-deskUnsloth', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.address().port + '/api/spirit' }),
  });
  kid.stdout.on('data', function (c) { out.stdout += c; });
  kid.stderr.on('data', function (c) { out.stderr += c; });
  kid.on('exit', function (code) { out.code = code === null ? 'signal' : code; });
}
function stop() {
  return new Promise(function (r) {
    const k = kid;
    if (!k || out.code !== null) return r();
    k.once('exit', function () { r(); });
    try { k.disconnect(); } catch (e) { /* no channel */ }
    setTimeout(function () { try { k.kill(); } catch (e) { /* gone */ } }, 500);
    setTimeout(r, 3000);
  });
}
async function doorUp(client, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await client.ask('api'); if (r && r.body && r.body.deskUnsloth && r.body.deskUnsloth.ok !== false) return r.body.deskUnsloth; } catch (e) { /* not yet */ }
    await sleep(150);
  }
  return null;
}

test.startTest('goal/G14.7: Levant\'s desk participation');

async function suite() {
  // ── 1. THE VERB FILES AND THE FAMILY ───────────────────────────────────
  test.subHeading('1. the desk describes its first set of verbs to agents');
  const missing = TEN.filter(function (s) { const f = fileOf(s); return !f || typeof f.description !== 'string' || !f.description || !f.request || typeof f.request !== 'object'; });
  if (!missing.length) test.check('process/js/desk holds a verb file for each of the ten, with a description and the request');
  else test.fail(OWED + 'verb files missing or incomplete: ' + missing.join(', '));
  let family = null;
  try { family = require('../run/js/introSpector.js').family(DESK_DIR, { declared: TEN.concat(['press', 'box.write']), manifest: 'desk.json' }); } catch (e) { family = null; }
  const listed = family ? Object.keys(family.verbs).filter(function (n) { return n.indexOf('AGENTS.') === 0 && n !== 'AGENTS.introspect'; }).map(function (n) { return n.slice(7); }).sort() : [];
  if (family && !family.stale.length && listed.join(',') === TEN.slice().sort().join(',')) test.check('the family of the desk\'s folder lists exactly the ten, no stale file (desk.json and currentGoal.json left alone)');
  else test.fail(OWED + 'the family lists ' + listed.join(',') + '; stale ' + short(family && family.stale));

  // ── 2. THE OBJECT WITH A DESK ROUTE ─────────────────────────────────────
  test.subHeading('2. tools.js with a desk route: describe from the desk\'s files, run through the route');
  let mod = null;
  try { mod = require(TOOLS); } catch (e) { mod = null; }
  if (!mod || typeof mod.createTools !== 'function') { test.fail(OWED + 'no tools.js with createTools'); }
  else {
    const routeAsks = [];
    const deskRoute = {
      ask: function (verb, args) { routeAsks.push({ verb: verb, args: args }); const a = deskAnswer(verb, args || {}); return Promise.resolve({ status: a && a.ok === false ? 404 : 200, body: a, text: JSON.stringify(a) }); },
      verb: function (stem) { return stem; },
      family: function (name) { return 'AGENTS.' + name; },
    };
    let tools = null;
    try { tools = mod.createTools({ routes: { desk: deskRoute }, room: 4000 }); } catch (e) { tools = null; }
    if (!tools) { test.fail(OWED + 'createTools takes no routes: ' + short(mod && Object.keys(mod))); }
    else {
      const described = await tools.describe('desk');
      const names = Array.isArray(described) ? described.map(function (t) { return t.function && t.function.name; }).sort() : [];
      const want = TEN.map(function (s) { return 'desk_' + s.replace(/\./g, '_'); }).sort();
      if (names.join(',') === want.join(',')) test.check('describe(desk) gives the ten tools, named desk_ and the verb with underscores');
      else test.fail(OWED + 'describe(desk) gave ' + names.join(','));
      const search = (described || []).filter(function (t) { return t.function.name === 'desk_items_search'; })[0];
      const props = search && search.function.parameters && search.function.parameters.properties;
      if (props && props.text && props.text.type === 'string' && props.currentGoalOnly && props.currentGoalOnly.type === 'boolean' && /goal/i.test(search.function.description)) test.check('desk_items_search carries the file\'s description and parameters typed from its request (text string, currentGoalOnly boolean)');
      else test.fail(OWED + 'desk_items_search reads ' + short(search));
      if (routeAsks.some(function (a) { return a.verb === 'AGENTS.introspect'; }) && routeAsks.some(function (a) { return a.verb === 'AGENTS.item.get'; })) test.check('it asked the route AGENTS.introspect and AGENTS.item.get, the bare family of a process server');
      else test.fail(OWED + 'the route was asked ' + short(routeAsks.map(function (a) { return a.verb; })));
      routeAsks.length = 0;
      const r1 = await tools.run(toolCall('d1', 'desk_item_get', { id: 'x/G1', extra: 1 }));
      const asked = routeAsks[0];
      let gotItem = null; try { gotItem = JSON.parse(JSON.parse(r1.text).item); } catch (e) { gotItem = null; }
      if (asked && asked.verb === 'item.get' && asked.args.id === 'x/G1' && !('extra' in asked.args) && gotItem && gotItem.title === 'The item Levant reads') test.check('run reads desk_item_get back to item.get, asks the route with the declared keys, and hands the json answer back');
      else test.fail(OWED + 'run asked ' + short(asked) + ', answered ' + short(r1));
      const r2 = await tools.run(toolCall('d2', 'desk_chat_add', { id: 'x/G1', text: 'a line from Levant' }));
      const posted = routeAsks.filter(function (a) { return a.verb === 'chat.add'; })[0];
      if (posted && posted.args.text === 'a line from Levant' && r2 && /change/.test(r2.text)) test.check('desk_chat_add posts through the route');
      else test.fail(OWED + 'chat.add asked ' + short(posted) + ', answered ' + short(r2));
      const r3 = await tools.run(toolCall('d3', 'desk_item_get', { id: 'nope/G9' }));
      if (r3 && /no such item/.test(r3.text)) test.check('a refusal of the desk comes back in its words');
      else test.fail(OWED + 'an unknown item answered ' + short(r3));
      routeAsks.length = 0;
      const r4 = await tools.run(toolCall('d4', 'desk_press', { id: 'x/G1', what: 'done' }));
      if (r4 && /not a tool|not listed/.test(r4.text) && !routeAsks.length) test.check('desk_press, never described, is refused and reaches nothing');
      else test.fail(OWED + 'an unlisted desk name: ' + short(r4) + ', route asked ' + routeAsks.length);
    }
  }

  // ── 3. THE PROCESS ──────────────────────────────────────────────────────
  test.subHeading('3. the process: a desk tool in the loop, the final text posted once');
  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  await new Promise(function (r) { studioServer.listen(0, '127.0.0.1', r); });
  fs.mkdirSync(path.join(scratch, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(scratch, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.address().port }));
  fs.writeFileSync(path.join(state, 'configuration.json'), JSON.stringify(CONFIGURATION, null, 1));
  fs.writeFileSync(path.join(state, 'connection.json'), JSON.stringify({ key: 'studio-key', url: 'http://127.0.0.1:' + studioServer.address().port + '/v1' }, null, 1));
  start();
  const client = appClient.createAppClient({ rootDir: scratch, log: function () {} });
  client.register('deskUnsloth', pipe);
  const tree = await doorUp(client, 10000);
  if (!tree) { test.fail(OWED + 'deskUnsloth never answered api on its pipe (' + short((out.stderr + out.stdout).slice(0, 200)) + ')'); return; }
  // Caught up with the backlog first (two empty next answers), then the addressed line.
  await sleep(700);
  script = [
    { toolCalls: [toolCall('b1', 'desk_item_box', { id: 'x/G1' })] },
    { text: 'The box of x/G1 says: read me.' },
  ];
  studio.chats.length = 0; deskAsks.length = 0;
  nextQueue.push(['DESK andy chat.add ' + JSON.stringify({ id: 'x/G1', text: 'levant: what does the box of x/G1 say' })]);
  // The context of the call (item.get, the boxes, the chat) is asked before the first call; the desk asks after it
  // are the tool's alone.
  await until(function () { return studio.chats.length >= 1; }, 15000);
  deskAsks.length = 0;
  await until(function () { return studio.chats.length >= 2; }, 15000);
  const c1 = studio.chats[0];
  const names = c1 && Array.isArray(c1.tools) ? c1.tools.map(function (t) { return t.function.name; }) : [];
  const sys = c1 && Array.isArray(c1.messages) ? c1.messages.filter(function (m) { return m.role === 'system'; }).map(function (m) { return String(m.content); }).join('\n') : '';
  if (names.indexOf('desk_item_box') !== -1 && names.indexOf('desk_chat_add') !== -1 && names.length === TEN.length && /posted under that item for you/.test(sys)) test.check('the call carries the desk\'s ten tools (net listed none here) and the note that the final text is posted for it');
  else test.fail(OWED + 'the call carried ' + short(names) + '; the note in the system message ' + /posted under that item for you/.test(sys));
  const boxAsk = deskAsks.filter(function (a) { return a.verb === 'item.box'; })[0];
  if (boxAsk && boxAsk.args.id === 'x/G1') test.check('the tool call went out as deskClient.desk item.box {id} through the node');
  else test.fail(OWED + 'deskClient.desk was asked ' + short(deskAsks.map(function (a) { return a.verb; })));
  const c2 = studio.chats[1];
  const toolMsg = c2 && Array.isArray(c2.messages) ? c2.messages.filter(function (m) { return m.role === 'tool'; })[0] : null;
  if (toolMsg && toolMsg.tool_call_id === 'b1' && /read me/.test(String(toolMsg.content))) test.check('the box came back to the model as the tool\'s result');
  else test.fail(OWED + 'the tool message: ' + short(toolMsg));
  await until(function () { return deskAsks.some(function (a) { return a.verb === 'chat.add'; }); }, 8000);
  await sleep(500);
  const posts = deskAsks.filter(function (a) { return a.verb === 'chat.add'; });
  if (posts.length === 1 && posts[0].args.id === 'x/G1' && /read me/.test(posts[0].args.text)) test.check('the final text is posted under the item once, by deskUnsloth, not again by a tool');
  else test.fail(OWED + 'chat.add went ' + posts.length + ' time(s): ' + short(posts));
}

suite().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  try { node.close(); } catch (e) { /* closed */ }
  try { studioServer.close(); } catch (e) { /* closed */ }
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
