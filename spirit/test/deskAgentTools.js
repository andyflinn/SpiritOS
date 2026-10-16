'use strict';

// spirit/test/deskAgentTools.js
// goal/G14.6: The First Tool: fetch data from the internet. Written first, red on today's code (99118975);
// claude-windows wrote it and builds it (one agent, Andy's word). The rulings are the item's box, Andy's of
// 2026-10-10:
//
//   "now we have a uniform api introspection, now we want a tool that expands Levant's knowledge, our proxy
//    internet call...."; "we decided a while back that the conversion belongs to deskAgent."; "so we build one
//    object for now: it has two main methods: 1 convert node-style introspection to OpenAI style tool description
//    2 execute tool when model asks"; "so we need to map the tool-name to your verb-call, and that should now be a
//    generic thing."; net.fetch opened to agents with a verb file js/net/fetch.json ("Yes to that.").
//
// WHAT IS ASSERTED (the box)
//   1. SINCE goal/G19.9: no verb file describes net.fetch, and the family of js/net lists nothing for an agent.
//   2. THE OBJECT, process/js/deskAgent/tools.js, createTools({ask}): describe(namespace) turns the node's
//      introspection into OpenAI tools (name = the verb with its dot as an underscore, description = the file's,
//      parameters typed from the request's examples), and none when the list is empty; run(call) reads the name
//      back to the verb, asks the node with the model's arguments (declared keys only), hands the page back
//      stripped of tags and cut to the room with the cut said, a refusal in the node's words, and refuses a name
//      describe never listed.
//   3. THE LOOP, in the process: the call to the studio carries the tools; a tool_calls answer runs the tool, the
//      result goes back as a tool message with its id, the model is asked again and its text is posted; three
//      rounds at most; the published object's chat.tool names the tool and what it works on while it runs.
//      Since goal/G14.8 the process names desk and fs and no longer net ("net_fetch will be removed for Levant."),
//      so the loop is exercised with fs.load against the fake node, the object (2.) still with net: the loop is
//      generic, and which namespaces ride is the process's list. Since goal/G23.5 the file tool is deskAgent's own
//      file.load, answered by the fake node as it answered fs.load.
//   4. SINCE goal/G21.5: a tool call the model writes as text is never posted and never run; the model is asked again.
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G14.6: ';
const ROOT = path.join(__dirname, '..', '..');
const RUN = path.join(ROOT, 'spirit', 'run');
const AGENT = path.join(RUN, 'process', 'js', 'deskAgent', 'deskAgent.js');
const TOOLS = path.join(RUN, 'process', 'js', 'deskAgent', 'tools.js');
const FETCH_DESCRIPTION = 'Fetch a page from the internet by url: GET unless method says otherwise; the owner proxy list decides which sites and which keys';
const LOAD_DESCRIPTION = 'The text of one file the node will serve, by its path';
// The context is the studio's (goal/G14.6 "auto", always since goal/G10.7, no contextLimit): the limit is the
// studio's context_length of the loaded model, STUDIO_CONTEXT below, read with the known list; the rooms follow it.
const STUDIO_CONTEXT = 2000;
const CONFIGURATION = { persona: 'Levant', preamble: 'you are Levant, a genius', model: 'fake/Levant-Test-GGUF', answerTokens: 100, bytesPerToken: 4 };
const PROMPT_ROOM = (STUDIO_CONTEXT - CONFIGURATION.answerTokens) * CONFIGURATION.bytesPerToken;
const TOOL_ROOM = Math.floor(PROMPT_ROOM / 4);

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { if (fn()) return true; await sleep(50); } return fn(); }

// ── THE FAKE NODE: the net family, net.fetch, jobs.update, deskClient ────
const PAGE = '<html><head><title>Example Domain</title><style>body{margin:0}</style></head><body><h1>Example Domain</h1>\n<p>This domain is for use in illustrative examples in documents.</p>\n<script>var x = 1;</script></body></html>';
const BIG_PAGE = '<html><body>' + 'A long paragraph of the page, repeated so it overflows the tool room. '.repeat(400) + '</body></html>';
let introspectItems = [{ key: 'net.fetch', label: FETCH_DESCRIPTION }];
const nodeAsks = [];
const published = [];
let nextQueue = [];
const deskWords = [];
const node = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    nodeAsks.push(b);
    function answer(status, body, type) { res.writeHead(status, { 'Content-Type': type || 'application/json; charset=utf-8' }); res.end(typeof body === 'string' ? body : JSON.stringify(body)); }
    // THE FILE TOOL IS deskAgent's OWN SINCE goal/G23.5: its asks reach this node as jobs.api {deskAgent: ...}, and
    // the node answers them here as it answered fs.load before (recorded as verb file.load), so the loop is the same.
    const du = b.verb === 'jobs.api' && b.ask && b.ask.deskAgent;
    if (du && du['AGENTS.introspect']) return answer(200, { items: [{ key: 'file.load', label: LOAD_DESCRIPTION }], more: false });
    if (du && du['AGENTS.file.load']) return answer(200, { description: LOAD_DESCRIPTION, request: { path: '' }, reply: { path: '', text: '' } });
    if (du && du['file.load']) {
      const p = String(du['file.load'].path || '');
      nodeAsks.push({ verb: 'file.load', path: p });
      if (!p) return answer(400, { error: 'path is required' });
      return answer(200, { path: p, text: /big\.test/.test(p) ? BIG_PAGE : PAGE });
    }
    if (du) return answer(404, { ok: false, code: 'no-such-verb' });
    if (b.verb === 'net.AGENTS.introspect') return answer(200, { items: introspectItems, more: false });
    if (b.verb === 'net.AGENTS.fetch') return answer(200, { description: FETCH_DESCRIPTION, request: { url: '', method: '', headers: {}, body: '', timeoutMs: 0 }, reply: {} });
    if (b.verb === 'net.fetch') {
      if (!b.url) return answer(400, { error: 'url is required' });
      if (/closed\.test/.test(b.url)) return answer(403, { error: 'closed.test is closed by the owner', closed: true });
      if (/big\.test/.test(b.url)) return answer(200, BIG_PAGE);
      return answer(200, PAGE);
    }
    if (b.verb === 'jobs.update') { if (b.app && typeof b.app === 'object') published.push(b.app); return answer(200, { ok: true }); }
    const dc = b.verb === 'jobs.api' && b.ask && b.ask.deskClient;
    if (!dc) return answer(404, { ok: false, code: 'no-such-verb', error: 'the fake node has no ' + b.verb });
    if (dc.next) { if (nextQueue.length) return answer(200, { lines: nextQueue.shift() }); return setTimeout(function () { answer(200, { lines: [] }); }, 100); }
    if (dc.desk) {
      let args = null; try { args = JSON.parse(dc.desk.json || '{}'); } catch (e) { args = null; }
      deskWords.push({ verb: String(dc.desk.verb || ''), args: args });
      const v = dc.desk.verb;
      if (v === 'AGENTS') return answer(200, { text: 'rules' });
      if (v === 'item.get') return answer(200, { item: JSON.stringify({ id: args.id, title: 't', goal: '', status: '', with: '', buttons: [], blocking: [], blocked: [], go: true }), version: 1, change: 1 });
      if (v === 'item.box') return answer(200, { box: 'the box', version: 1 });
      if (v === 'item.chat') return answer(200, { chat: [{ by: 'andy', at: 't', text: 'levant: what is on example.com', taken: '' }], chatMore: false });
      if (v === 'chat.add') return answer(200, { change: 2 });
      if (v === 'signoff') return answer(200, { change: 3 });
      return answer(404, { ok: false, code: 'no-such-item', error: 'the fake desk holds nothing' });
    }
    return answer(404, { ok: false, code: 'no-such-verb', error: 'the fake deskClient has next and desk alone' });
  });
});

// ── THE FAKE STUDIO: a chat completion that calls the tool first, then answers ──
const studio = { chats: [] };
let script = [];   // per call: { toolCalls: [...] } or { text: '...' }
const studioServer = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let body = null; try { body = JSON.parse(raw); } catch (e) { body = null; }
    function answer(status, obj) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }
    const p = req.url.split('?')[0];
    if (p === '/api/models/cached-gguf') return answer(200, { cached: [] });
    if (p === '/v1/models') return answer(200, { object: 'list', data: [] });
    if (p === '/api/inference/status') return answer(200, { active_model: CONFIGURATION.model, loaded: [CONFIGURATION.model], supports_tools: true, context_length: STUDIO_CONTEXT });
    if (p === '/v1/chat/completions' && req.method === 'POST') {
      studio.chats.push(body);
      const step = script.length ? script.shift() : { text: 'nothing scripted' };
      const message = step.toolCalls
        ? { role: 'assistant', content: '', tool_calls: step.toolCalls }
        : { role: 'assistant', content: step.text };
      return setTimeout(function () {
        answer(200, { id: 'fake', object: 'chat.completion', choices: [{ index: 0, message: message, finish_reason: step.toolCalls ? 'tool_calls' : 'stop' }] });
      }, 100);
    }
    answer(404, { detail: 'API endpoint not found' });
  });
});
function toolCall(id, name, args) { return { id: id, type: 'function', function: { name: name, arguments: JSON.stringify(args) } }; }

// ── THE AGENT ────────────────────────────────────────────────────────────
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskunsloth-tools-'));
const state = path.join(scratch, 'relay-state', 'process', 'deskAgent');
fs.mkdirSync(state, { recursive: true });
const pipe = appClient.pipePathFor(scratch, 'deskAgent', process.platform, 'process');
let kid = null;
let out = { stdout: '', stderr: '', code: null };
function start() {
  out = { stdout: '', stderr: '', code: null };
  kid = spawn(process.execPath, [AGENT, '{}', '--pipe', pipe, '--state', state], {
    cwd: scratch, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'test-deskAgent', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.address().port + '/api/spirit' }),
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
    try {
      const r = await client.ask('api');
      if (r && r.body && r.body.deskAgent && r.body.deskAgent.ok !== false) return r.body.deskAgent;
    } catch (e) { /* not yet */ }
    await sleep(150);
  }
  return null;
}

test.startTest('goal/G14.6: the first tool, fetch data from the internet');

async function suite() {
  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  await new Promise(function (r) { studioServer.listen(0, '127.0.0.1', r); });
  const NODE_URL = 'http://127.0.0.1:' + node.address().port;

  // ── 1. THE VERB FILE ────────────────────────────────────────────────────
  // SINCE goal/G19.9 NET.FETCH IS NO TOOL FOR AGENTS. Andy, 2026-10-12: "node fetch should NOT be allowed to agents", and
  // a suite "ensuring a js/net/fetch.json is not allowed to exists" (netNoAgentTool.js). This section asserted the verb
  // file and its AGENTS.md (goal/G14.6); it now asserts that the family of js/net describes nothing to an agent.
  test.subHeading('1. net.fetch is described to no agent');
  let family = null;
  try { family = require('../run/js/introSpector.js').family(path.join(RUN, 'js', 'net'), { declared: ['fetch'], prefix: 'net.' }); } catch (e) { family = null; }
  if (!fs.existsSync(path.join(RUN, 'js', 'net', 'fetch.json')) && family && !family.verbs['net.AGENTS.fetch']) test.check('no js/net/fetch.json, and the family of js/net carries no net.AGENTS.fetch');
  else test.fail('goal/G19.9: the net family still describes fetch: ' + short(family && { verbs: Object.keys(family.verbs), stale: family.stale }));

  // ── 2. THE OBJECT ───────────────────────────────────────────────────────
  test.subHeading('2. tools.js: describe from the introspection, run through the node, generic');
  let mod = null;
  try { mod = require(TOOLS); } catch (e) { mod = null; }
  if (!mod || typeof mod.createTools !== 'function') { test.fail(OWED + 'no process/js/deskAgent/tools.js with createTools'); }
  else {
    // The ask tools.js is given: one loopback ask of the node, {status, text, body}, as spirit.core.ask answers.
    const ask = function (verb, args) { return new Promise(function (resolve, reject) {
      const text = JSON.stringify(Object.assign({ verb: verb }, args || {}));
      const req = http.request(NODE_URL + '/api/spirit', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(text) } }, function (res) {
        let t = ''; res.on('data', function (c) { t += c; }); res.on('end', function () { let body = null; try { body = JSON.parse(t); } catch (e) { body = null; } resolve({ status: res.statusCode, text: t, body: body }); });
      });
      req.on('error', reject); req.end(text);
    }); };
    const tools = mod.createTools({ ask: ask, room: TOOL_ROOM });
    const described = await tools.describe('net');
    const t0 = Array.isArray(described) ? described[0] : null;
    const props = t0 && t0.function && t0.function.parameters && t0.function.parameters.properties;
    if (Array.isArray(described) && described.length === 1 && t0.type === 'function' && t0.function.name === 'net_fetch' && t0.function.description === FETCH_DESCRIPTION
        && props && props.url && props.url.type === 'string' && props.method && props.method.type === 'string' && props.headers && props.headers.type === 'object' && props.timeoutMs && props.timeoutMs.type === 'number' && t0.function.parameters.type === 'object') {
      test.check('describe(net) gives one OpenAI tool: net_fetch, the file\'s description, parameters typed from the request\'s examples (url string, headers object, timeoutMs number)');
    } else test.fail(OWED + 'describe answered ' + short(described));
    const nodeAsked = nodeAsks.filter(function (a) { return a.verb === 'net.AGENTS.introspect' || a.verb === 'net.AGENTS.fetch'; }).map(function (a) { return a.verb; });
    if (nodeAsked.indexOf('net.AGENTS.introspect') !== -1 && nodeAsked.indexOf('net.AGENTS.fetch') !== -1) test.check('it asked the node net.AGENTS.introspect and net.AGENTS.fetch, nothing hand-written');
    else test.fail(OWED + 'describe asked the node ' + short(nodeAsked));
    introspectItems = [];
    const none = await tools.describe('net');
    introspectItems = [{ key: 'net.fetch', label: FETCH_DESCRIPTION }];
    if (Array.isArray(none) && none.length === 0) test.check('nothing listed, no tools');
    else test.fail(OWED + 'with an empty introspection describe answered ' + short(none));
    await tools.describe('net');
    const before = nodeAsks.length;
    const r1 = await tools.run(toolCall('c1', 'net_fetch', { url: 'https://example.test/', method: 'GET', extra: 'not declared' }));
    const fetched = nodeAsks.slice(before).filter(function (a) { return a.verb === 'net.fetch'; })[0];
    if (fetched && fetched.url === 'https://example.test/' && fetched.method === 'GET' && !('extra' in fetched)) test.check('run reads net_fetch back to net.fetch and asks the node with the model\'s arguments, declared keys only');
    else test.fail(OWED + 'run asked ' + short(fetched));
    if (r1 && r1.id === 'c1' && typeof r1.text === 'string' && /Example Domain/.test(r1.text) && /illustrative examples/.test(r1.text) && !/<h1>|<script>|margin:0|var x/.test(r1.text)) test.check('the page comes back as text: tags, style and script gone, the words kept, with the call\'s id');
    else test.fail(OWED + 'run answered ' + short(r1));
    const r2 = await tools.run(toolCall('c2', 'net_fetch', { url: 'https://big.test/' }));
    if (r2 && Buffer.byteLength(r2.text, 'utf8') <= TOOL_ROOM + 200 && /cut/i.test(r2.text)) test.check('a page over the tool room is cut to it, and the cut is said in the text (' + Buffer.byteLength(r2.text, 'utf8') + ' bytes of room ' + TOOL_ROOM + ')');
    else test.fail(OWED + 'a big page came back as ' + (r2 ? Buffer.byteLength(r2.text, 'utf8') : 'nothing') + ' bytes, said cut ' + (r2 && /cut/i.test(r2.text)));
    const r3 = await tools.run(toolCall('c3', 'net_fetch', { url: 'https://closed.test/' }));
    if (r3 && /closed by the owner/.test(r3.text)) test.check('a refusal from the proxy comes back as text in the node\'s words');
    else test.fail(OWED + 'a closed site came back as ' + short(r3));
    const r4 = await tools.run(toolCall('c4', 'jobs_cancel', { id: 'x' }));
    const cancelled = nodeAsks.some(function (a) { return a.verb === 'jobs.cancel'; });
    if (r4 && typeof r4.text === 'string' && /not a tool|no such tool|not listed/i.test(r4.text) && !cancelled) test.check('a name describe never listed is refused and never reaches the node');
    else test.fail(OWED + 'an unlisted name: ' + short(r4) + ', reached the node ' + cancelled);
  }

  // ── 3. THE LOOP IN THE PROCESS ──────────────────────────────────────────
  test.subHeading('3. the loop: the call carries the tools, a tool call is run and the model asked again');
  fs.mkdirSync(path.join(scratch, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(scratch, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.address().port }));
  fs.writeFileSync(path.join(state, 'configuration.json'), JSON.stringify(CONFIGURATION, null, 1));
  fs.writeFileSync(path.join(state, 'connection.json'), JSON.stringify({ key: 'studio-key', url: 'http://127.0.0.1:' + studioServer.address().port + '/v1' }, null, 1));
  start();
  const client = appClient.createAppClient({ rootDir: scratch, log: function () {} });
  client.register('deskAgent', pipe);
  const tree = await doorUp(client, 10000);
  if (!tree) { test.fail(OWED + 'deskAgent never answered api on its pipe (' + short((out.stderr + out.stdout).slice(0, 200)) + ')'); return; }
  function ask(verb, args) { const a = {}; a[verb] = args || {}; return client.ask({ deskAgent: a }).then(function (r) { return r.body || {}; }); }
  // THE ROOM FOLLOWS THE STUDIO (since goal/G10.7 always): the known list is read once (models), which carries the
  // studio's context_length; then a page over a quarter of (2000 - 100) * 4 bytes comes back cut to that room.
  await ask('models', {});
  await sleep(300);
  script = [{ toolCalls: [toolCall('room-1', 'deskAgent_file_load', { path: 'shell/big.test' })] }, { text: 'seen the big page' }];
  studio.chats.length = 0;
  const sRoom = await ask('chat.send', { lines: [{ role: 'user', text: 'read the big page' }] });
  let aRoom = {};
  for (let i = 0; i < 80; i++) { aRoom = await ask('chat.answer', { id: sRoom.id }); if (aRoom.done) break; await sleep(100); }
  const roomCall = studio.chats[1];
  const roomTool = roomCall && Array.isArray(roomCall.messages) ? roomCall.messages.filter(function (m) { return m.role === 'tool'; })[0] : null;
  const roomBytes = roomTool ? Buffer.byteLength(String(roomTool.content), 'utf8') : -1;
  if (roomTool && roomBytes <= TOOL_ROOM + 200 && roomBytes > TOOL_ROOM / 2 && /cut/.test(String(roomTool.content))) test.check('the tool room follows the studio\'s context_length: the big page came back cut to ' + roomBytes + ' bytes of room ' + TOOL_ROOM);
  else test.fail(OWED + 'the tool result was ' + roomBytes + ' bytes against a room of ' + TOOL_ROOM + ' (' + short(roomTool && roomTool.content) + ')');
  script = [
    { toolCalls: [toolCall('call-1', 'deskAgent_file_load', { path: 'shell/example.test' })] },
    { text: 'The page says: Example Domain, for use in illustrative examples.' },
  ];
  studio.chats.length = 0; published.length = 0;
  const s1 = await ask('chat.send', { lines: [{ role: 'user', text: 'what is in shell/example.test' }] });
  await until(function () { return studio.chats.length >= 2; }, 10000);
  const c1 = studio.chats[0], c2 = studio.chats[1];
  const sentTools = c1 && Array.isArray(c1.tools) ? c1.tools : [];
  if (sentTools.length === 1 && sentTools[0].function && sentTools[0].function.name === 'deskAgent_file_load' && sentTools[0].function.description === LOAD_DESCRIPTION) test.check('the call to the studio carries the file tool, deskAgent\'s own since goal/G23.5, and no net tool (goal/G14.8)');
  else test.fail(OWED + 'the first call carried tools ' + short(sentTools));
  const toolMsg = c2 && Array.isArray(c2.messages) ? c2.messages.filter(function (m) { return m.role === 'tool'; })[0] : null;
  const assistantMsg = c2 && Array.isArray(c2.messages) ? c2.messages.filter(function (m) { return m.role === 'assistant' && m.tool_calls; })[0] : null;
  if (toolMsg && toolMsg.tool_call_id === 'call-1' && /Example Domain/.test(String(toolMsg.content)) && assistantMsg) test.check('the second call carries the assistant\'s tool call and the tool\'s result as a tool message with its id');
  else test.fail(OWED + 'the second call\'s messages: ' + short(c2 && c2.messages));
  let a1 = {};
  for (let i = 0; i < 80; i++) { a1 = await ask('chat.answer', { id: s1.id }); if (a1.done) break; await sleep(100); }
  if (a1.done === true && /illustrative examples/.test(a1.text)) test.check('the model\'s text after the tool is the answer');
  else test.fail(OWED + 'chat.answer ended ' + short(a1));
  const sawTool = published.some(function (p) { return p.chat && p.chat.tool && p.chat.tool.name === 'deskAgent_file_load' && /example\.test/.test(String(p.chat.tool.url || '')); });
  if (sawTool) test.check('the published chat.tool named the tool and its path while it ran');
  else test.fail(OWED + 'no published object carried chat.tool for the load: ' + short(published.map(function (p) { return p.chat; })));
  // NO ROUND COUNT (goal/G23.4): with no context known every tool call the model makes runs, and its own text is the
  // answer. Andy: rounds "tied to the context, and if no context is specified, no limit either". This check asserted
  // the three-round cap until goal/G23.4; the room-spent path (asked once more without tools) is
  // deskAgentToolRounds.js's, with a known small context.
  script = [
    { toolCalls: [toolCall('r1', 'deskAgent_file_load', { path: 'shell/example.test/1' })] },
    { toolCalls: [toolCall('r2', 'deskAgent_file_load', { path: 'shell/example.test/2' })] },
    { toolCalls: [toolCall('r3', 'deskAgent_file_load', { path: 'shell/example.test/3' })] },
    { toolCalls: [toolCall('r4', 'deskAgent_file_load', { path: 'shell/example.test/4' })] },
    { text: 'With what I have read: three pages of examples.' },
    { text: 'never reached' },
  ];
  studio.chats.length = 0;
  const s2 = await ask('chat.send', { lines: [{ role: 'user', text: 'keep fetching' }] });
  let a2 = {};
  for (let i = 0; i < 100; i++) { a2 = await ask('chat.answer', { id: s2.id }); if (a2.done) break; await sleep(100); }
  await sleep(300);
  const last = studio.chats[studio.chats.length - 1];
  const lastUser = last && Array.isArray(last.messages) ? last.messages[last.messages.length - 1] : null;
  const fetchesRun = nodeAsks.filter(function (a) { return a.verb === 'file.load' && /example\.test\/[1-4]/.test(String(a.path)); }).map(function (a) { return a.path.slice(-1); });
  if (a2.done === true && /three pages of examples/.test(a2.text) && studio.chats.length === 5 && script.length === 1 && last && Array.isArray(last.tools) && last.tools.length && lastUser && lastUser.role === 'tool' && fetchesRun.join('') === '1234') {
    test.check('no round count with no context known: all four fetches run, the last request still offers the tools, and the model\'s own words are the answer');
  } else test.fail('goal/G23.4: rounds: ' + studio.chats.length + ' calls, script left ' + script.length + ', fetches ' + fetchesRun.join('') + ', last call tools ' + (last && 'tools' in last) + ', last message ' + short(lastUser) + ', answer ' + short(a2));

  // ── 4. A TOOL CALL WRITTEN AS TEXT NEVER REACHES CHAT (goal/G21.5) ──────
  // Andy's box: deskAgent never posts a call the model spelled as text; it asks the model again. It is no adapter
  // for formats: the spelled call is never parsed or run. The preamble says tools are called only as real calls.
  const OWED5 = 'OWED by goal/G21.5: ';
  test.subHeading('4. a tool call written as text is never posted, and never run');
  const SPELLED = '<tool_call>\n<function=deskAgent_file_load>\n<parameter=path>\nshell/spelled.test\n</parameter>\n</function>\n</tool_call>';
  function spelledLoads() { return nodeAsks.filter(function (a) { return a.verb === 'file.load' && /spelled\.test/.test(String(a.path)); }).length; }
  script = [{ text: SPELLED }, { text: 'The file holds the example page.' }];
  studio.chats.length = 0;
  const s3 = await ask('chat.send', { lines: [{ role: 'system', text: 'you are Levant' }, { role: 'user', text: 'what is in shell/spelled.test' }] });
  let a3 = {};
  for (let i = 0; i < 80; i++) { a3 = await ask('chat.answer', { id: s3.id }); if (a3.done) break; await sleep(100); }
  const sys = studio.chats[0] && Array.isArray(studio.chats[0].messages) ? studio.chats[0].messages.filter(function (m) { return m.role === 'system'; })[0] : null;
  if (sys && /real tool call/i.test(String(sys.content)) && /as text/i.test(String(sys.content))) test.check('the preamble says tools are called only as real tool calls, never written as text');
  else test.fail(OWED5 + 'the system message said ' + short(sys && sys.content).replace(/\n/g, ' '));
  const again = studio.chats[1];
  const againLast = again && Array.isArray(again.messages) ? again.messages[again.messages.length - 1] : null;
  if (a3.done === true && a3.text === 'The file holds the example page.' && studio.chats.length === 2 && againLast && againLast.role === 'user' && /as text/i.test(String(againLast.content))) test.check('a spelled call is not the answer: the model is asked again, told its call was written as text, and its next words are the answer');
  else test.fail(OWED5 + studio.chats.length + ' studio calls, the second ending ' + short(againLast) + ', answer ' + short(a3));
  if (!spelledLoads()) test.check('the spelled call was never run: no file.load reached the node');
  else test.fail(OWED5 + 'the spelled call reached the node ' + spelledLoads() + ' time(s)');
  script = [{ text: SPELLED }, { text: 'still ' + SPELLED }, { text: 'never reached' }];
  studio.chats.length = 0;
  const s4 = await ask('chat.send', { lines: [{ role: 'user', text: 'what is in shell/spelled.test' }] });
  let a4 = {};
  for (let i = 0; i < 80; i++) { a4 = await ask('chat.answer', { id: s4.id }); if (a4.done) break; await sleep(100); }
  if (a4.done === true && typeof a4.text === 'string' && a4.text && !/<tool_call|<function=|<parameter=/.test(a4.text) && studio.chats.length === 2 && !spelledLoads()) test.check('spelled twice, the answer is a plain line saying so, with no tags in it, and the model is asked again only once');
  else test.fail(OWED5 + studio.chats.length + ' studio calls, answer ' + short(a4) + ', loads ' + spelledLoads());
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
