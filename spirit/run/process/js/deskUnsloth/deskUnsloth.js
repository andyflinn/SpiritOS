'use strict';

// spirit/run/process/js/deskUnsloth/deskUnsloth.js
// THE LOCAL AGENT'S MEDIATOR: it routes between the agent and the desk, and nothing more — goal/G10.3.
// Since goal/G14.2 it has a switch: connect {on} and state {}, the two verbs deskUnslothRemote flips and reads.
//
//   Andy, 2026-10-09: "tooling is deferred for this goal. deskUnsloth simply will route between agent and desk."
//   On the context: "The Context, for now is CurrentGoal.json, the chat history", settled to the boxes because the
//   file is 161 KB and stale on the agent node; "Boxes instead of the file, chat as the rolling window, yes?" — "yes."
//   On the configuration: "for starters a configuration has 1. agent persona, 1 preamble,  1 model, 1 context limit,
//   all simple and safe, for my RTX 5060, this way we get off the ground quicker", and "for starters, we have just
//   one configuration file, and one connection file with the contents of loop.json, so i don't have to keep
//   regenerating keys in unsloth. no UI yet."
//   On the window: MAX_CONTEXT_LENGTH minus the goal and item boxes, minus the system prompt and the answer room,
//   sizes in tokens by bytesPerToken from the configuration.
//   On the packets: "the cap bites on packets only", so a long answer goes back as several lines under the room.
//
// Built by wsl-claude against claude-windows's red, spirit/test/deskUnslothContext.js, which is the contract this
// file answers to; the shape it asserts is G10.3's box, decided points 1 to 8.
//
// NOTHING IS KEPT BETWEEN CALLS. The model remembers nothing, so every call is built fresh from the desk: the desk's
// AGENTS text, the persona's preamble, the goal's box, the item's box and the newest chat lines that fit. A box
// changed at the desk is in the next call as changed; a line the desk no longer holds is gone from it. There is no
// cache here on purpose — the desk is the record (rule/5: the plainest mechanism that does the job).

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const https = require('https');
const appServer = require('../../../js/appServer');
const spirit = appServer.spirit;

// ── THE TWO FILES, ITS OWN STATE FOLDER'S (goal/G10.3 point 4) ────────
//
// The node names the folder with --state; the configuration is read once at start and the process ends without it, by
// name, asking nobody. THE CONNECTION MAY BE ABSENT (goal/G10.7): it is set from deskUnslothRemote's connect tab
// through connection.set, so a node without one starts, says it has no server, and waits for it. Andy, 2026-10-12, on
// the server bubble writing a url and a key into connection.json through a verb of deskUnsloth's own: "yes."
const STATE = (function () {
  const argv = process.argv;
  const at = argv.indexOf('--state');
  return at !== -1 ? String(argv[at + 1] || '') : '';
})();
const CONFIGURATION_FILE = 'configuration.json';
// THE VALUES THE NODE HANDS IT (argv[2]) AND THE NODE'S NAME (--node), goal/G10.8. The node's name is how the desk
// names this agent's writes (an item it takes reads with: <name>), so its own changes and its own items are told by it.
const VALUES = (function () { try { const v = JSON.parse(process.argv[2] || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } })();
const NODE_NAME = (function () {
  const at = process.argv.indexOf('--node');
  try { return at !== -1 ? String((JSON.parse(process.argv[at + 1]) || {}).name || '') : ''; } catch (e) { return ''; }
})();
// THE CLONE IT WORKS IN (goal/G10.8): Andy, 2026-10-12, "levant stays in his checkout/clone", its file tools "rooted
// at the checkout". The checkout this script runs from, unless the manifest value root names another (a suite does).
const CLONE = path.resolve(VALUES.root ? String(VALUES.root) : path.join(__dirname, '..', '..', '..', '..', '..'));
const CONNECTION_FILE = 'connection.json';

function readOrDie(name) {
  const file = path.join(STATE, name);
  let raw = null;
  try { raw = fs.readFileSync(file, 'utf8'); } catch (e) {
    console.error('deskUnsloth: ' + name + ' is not in its state folder (' + file + '); it is hand-written for now');
    process.exit(2);
  }
  try { return JSON.parse(raw); } catch (e) {
    console.error('deskUnsloth: ' + name + ' is not readable JSON: ' + e.message);
    process.exit(2);
  }
  return null;
}
// Read before anything is asked of the node: a missing file is this process's own business and no desk's.
const CONFIGURATION = readOrDie(CONFIGURATION_FILE);
function readConnection() {
  try { const c = JSON.parse(fs.readFileSync(path.join(STATE, CONNECTION_FILE), 'utf8')); return c && typeof c === 'object' ? c : {}; } catch (e) { return {}; }
}
let CONNECTION = readConnection();

const PERSONA = String(CONFIGURATION.persona || 'agent');
const PREAMBLE = String(CONFIGURATION.preamble || '');
// THE MODEL FOLLOWS A LOAD (goal/G14.4): model.load rewrites configuration.json and this with it, so the next call
// names what the studio now serves. Everything else in the configuration is still read once.
let MODEL = String(CONFIGURATION.model || '');
// THE CONTEXT IS THE STUDIO'S, NEVER CONFIGURED (goal/G10.7). Andy, 2026-10-12: "remove  contextLimit from the
// configuration file. we will not work on stuff that unsloth does already well. we will never pass context limits to
// unslot. that's a decision." The room below is the loaded model's context_length as the studio reports it
// (inference/status, read with every refresh of the known list), CONTEXT_FALLBACK until it has been read once; it
// only sizes what this process sends, and no context length is ever sent to the studio.
const CONTEXT_FALLBACK = 8192;
let studioContext = 0;
function contextLimit() { return studioContext > 0 ? studioContext : CONTEXT_FALLBACK; }
const ANSWER_TOKENS = Number(CONFIGURATION.answerTokens) || 0;
const BYTES_PER_TOKEN = Number(CONFIGURATION.bytesPerToken) || 4;
// HIS FORMULA (goal/G10.3): the room for the whole prompt is what is left of the context once the answer has its
// own, in bytes, at bytesPerToken each. A function since the limit may follow the studio.
function promptRoom() { return Math.max(0, (contextLimit() - ANSWER_TOKENS) * BYTES_PER_TOKEN); }

// ── THE DESK, THROUGH THIS NODE'S deskClient (goal/G10.3 point 1) ─────
//
// KISS, his word: deskUnsloth speaks to the desk through the same deskClient server the claudes use, in a loop; it
// opens no stream and holds no place of its own. One mouth, the kernel's.
const PORT = spirit.core.node.const.SPIRIT_PORT;
const NODE_URL = 'http://127.0.0.1:' + PORT;
const WAIT_MS = 250;

function say(text) { console.log('deskUnsloth: ' + text); }
function bytes(s) { return Buffer.byteLength(String(s), 'utf8'); }

function askNode(ask) {
  return spirit.core.ask('jobs.api', { ask: ask }, NODE_URL).then(function (r) { return (r && r.body) || {}; });
}
function desk(verb, args) {
  return askNode({ deskClient: { desk: { verb: verb, json: JSON.stringify(args || {}) } } });
}
function nextLines() {
  return askNode({ deskClient: { next: {} } }).then(function (b) { return Array.isArray(b.lines) ? b.lines : []; });
}

// ── WHAT IT ANSWERS: EVERY CHANGE BUT ITS OWN, AND JOBs ────────────────
//
// It starts at the present, never the backlog (goal/G10.3 point 7: "starts at the present, never the backlog"). It
// answered only lines addressed to it until goal/G10.8, which has it read every change as claude does (mine below).

// `DESK <by> <verb> <json>`, as deskEar prints a change: the verb is the last word before the json, so a `by` of
// several words (an agent named "ollama agent node") still parses. The json is parsed, never matched by regex: a
// text holding a brace broke the old reading.
function readLine(line) {
  const s = String(line || '');
  const job = /^JOB\s+(\S+)/.exec(s);
  if (job) return { kind: 'job', id: job[1] };
  if (s.slice(0, 5) !== 'DESK ') return null;
  const at = s.indexOf(' {');
  if (at === -1) return null;
  const words = s.slice(5, at).trim().split(/\s+/);
  const verb = words.pop();
  const by = words.join(' ');
  let body = null;
  try { body = JSON.parse(s.slice(at + 1)); } catch (e) { return null; }
  if (!body || typeof body.id !== 'string') return null;
  return { kind: 'change', by: by, verb: verb, id: body.id, text: typeof body.text === 'string' ? body.text : '', line: s };
}
// EVERY CHANGE, AS CLAUDE READS THEM (goal/G10.8). Andy, 2026-10-12, asked whether Levant should read every desk change
// and act on it as claude does: "yes. it'll make flaws visible. and i need him when my claude credits run out. and i
// need him just as constrained by desk as we all are." So every change is the model's to judge under the desk's
// rules, which say which lines are not its to answer; only its own change is left alone: answering it would be a
// conversation with itself. Its own is the node's name, which the desk writes its changes under, or the persona's.
// The cost, stated (rule/5): one model call per change, the desk's own lines included.
function mine(read) {
  if (!read) return false;
  if (read.kind === 'job') return true;
  const by = String(read.by || '').toLowerCase();
  return by !== PERSONA.toLowerCase() && (!NODE_NAME || by !== NODE_NAME.toLowerCase());
}

// ── THE CALL, BUILT FRESH (goal/G10.3 points 2 and 3) ─────────────────
//
// The system message is the desk's rules and the persona's preamble; then the goal's box, the item's box, and the
// item's newest chat lines, the oldest dropped until the whole prompt fits his room. Each panel is its own ask, as
// the dialog asks them (item.get, item.box, item.chat), so no answer carries the sum of them.
function factsOf(id) {
  return desk('item.get', { id: id }).then(function (b) {
    let f = {};
    try { f = JSON.parse(b.item || '{}'); } catch (e) { f = {}; }
    return f;
  });
}
function boxOf(id) {
  return desk('item.box', { id: id }).then(function (b) { return String(b.box || ''); });
}
function chatOf(id) {
  return desk('item.chat', { id: id }).then(function (b) { return Array.isArray(b.chat) ? b.chat : []; });
}
function agentsText() {
  return desk('AGENTS', {}).then(function (b) { return String(b.text || ''); }, function () { return ''; });
}

// THE CHANGES THAT WOKE IT are in the call, after the item's chat, so the model knows what happened (goal/G10.8).
function callFor(id, changes) {
  return factsOf(id).then(function (facts) {
    const goalId = facts.goal ? String(facts.goal) : id;
    return Promise.all([agentsText(), boxOf(goalId), goalId === id ? Promise.resolve('') : boxOf(id), chatOf(id)])
      .then(function (got) {
        const rules = got[0];
        const goalBox = got[1];
        const itemBox = got[2];
        const chat = got[3];
        const system = [rules, PREAMBLE].filter(Boolean).join('\n\n');
        const head = [];
        if (goalBox) head.push('THE GOAL\n' + goalBox);
        if (itemBox) head.push('THE ITEM ' + id + '\n' + itemBox);
        // THE WINDOW: the newest lines that fit. Everything but the chat is owed to the call, so the chat takes
        // whatever room is left and the oldest line goes first (his "rolling window ... the oldest dropped").
        const woke = (changes || []).map(function (t) { return 'WHAT JUST HAPPENED AT THE DESK: ' + t; });
        let room = promptRoom() - bytes(system) - head.concat(woke).reduce(function (s, t) { return s + bytes(t); }, 0);
        const window = [];
        for (let i = chat.length - 1; i >= 0; i--) {
          const line = String(chat[i].by || '') + ': ' + String(chat[i].text || '');
          const cost = bytes(line);
          if (cost > room) break;
          room -= cost;
          window.unshift(line);
        }
        const messages = [{ role: 'system', content: system }];
        head.forEach(function (t) { messages.push({ role: 'user', content: t }); });
        window.forEach(function (t) { messages.push({ role: 'user', content: t }); });
        woke.forEach(function (t) { messages.push({ role: 'user', content: t }); });
        return messages;
      });
  });
}

// ── THE STUDIO: one http ask of it, the connection's url and key ──────
//
// The connection's url is the OpenAI root (…/v1); the studio's own api sits beside it at the host root (…/api/…),
// read live 2026-10-10 (Unsloth Studio 2026.10.3, openapi.json). One function for both: a path from the host root.
function studioUrlOf(conn) { return String((conn && conn.url) || '').replace(/\/+$/, '').replace(/\/v1$/, ''); }
let STUDIO_URL = studioUrlOf(CONNECTION);
// WHETHER THE SERVER ANSWERS (goal/G10.7), for the Remote's warning (`answers`, since `ok` is appServer's reserved
// reply key): true once a call got any answer back, false when
// one could not reach it, and false with no url. Never the key: the state goes to every page that listens.
let server = { url: String(CONNECTION.url || ''), answers: false, error: STUDIO_URL ? '' : 'no OpenAI compatible server is set' };
function serverSeen(ok, error) {
  if (server.answers === ok && server.error === error && server.url === String(CONNECTION.url || '')) return;
  server = { url: String(CONNECTION.url || ''), answers: ok, error: error };
  publishState();
}

// `timeoutMs` caps one call: a studio route that dawdles (v1/models took 14.9 s live on 2026-10-10, probing its
// ollama entries) must not take the whole ask past the 12 s a process has to answer.
function studio(method, pathname, body, timeoutMs) {
  if (!STUDIO_URL) return Promise.reject(new Error('no OpenAI compatible server is set: connect one in deskUnslothRemote'));
  const url = new URL(STUDIO_URL + pathname);
  const text = body === undefined ? '' : JSON.stringify(body);
  const lib = url.protocol === 'https:' ? https : http;
  return new Promise(function (resolve, reject) {
    const headers = { Authorization: 'Bearer ' + String(CONNECTION.key || '') };
    if (text) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(text); }
    const req = lib.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: headers,
    }, function (res) {
      serverSeen(true, '');
      let raw = '';
      res.on('data', function (c) { raw += c; });
      res.on('end', function () {
        let got = null;
        try { got = JSON.parse(raw); } catch (e) { return reject(new Error('the studio did not answer JSON at ' + pathname)); }
        if (res.statusCode >= 400) return reject(new Error('the studio refused ' + pathname + ': ' + res.statusCode + ' ' + raw.slice(0, 120)));
        resolve(got);
      });
    });
    req.on('error', function (e) { if (e && e.code) serverSeen(false, String(e.message || e)); reject(e); });
    if (Number(timeoutMs) > 0) req.setTimeout(Number(timeoutMs), function () { req.destroy(new Error('the studio took longer than ' + timeoutMs + ' ms at ' + pathname)); });
    if (text) req.write(text);
    req.end();
  });
}

// ── THE MODEL: one OpenAI chat completion, WITH THE NODE'S TOOLS (goal/G14.6) ──
//
//   Andy, 2026-10-10: "now we want a tool that expands Levant's knowledge, our proxy internet call....". The tools
//   come from the node's own description of its verbs (tools.js: describe), the first being net.fetch; the model
//   calls one, this runs it through the node (tools.js: run) and asks the model again with the result, at most
//   TOOL_ROUNDS times, then the model's last text is the answer. Nothing hand-written here about any tool.
function toolRoom() { return Math.floor(promptRoom() / 4); }
const TOOL_ROUNDS = 3;
// THE ROUTES (goal/G14.7): net through the node's loopback door; the desk through this node's deskClient, the verb
// bare and the family under AGENTS, as a process server lists it. The desk's answer comes back as the asked body;
// a refusal of the desk (not granted, no such item, a rule) is a body with ok false, which run hands to the model
// in the desk's words. Andy: "Levant is restricted by the tools we give him": what has no verb file is no tool.
// THE NAMESPACES (goal/G14.8): desk and fs; net no longer. Andy, 2026-10-10: "i'm more inclined to deny URL fetch,
// and allow loadFile, it's much narrower." and "net_fetch will be removed for Levant." The fs tools are the verbs
// js/fs describes (load, save, search, stat, annotations), through the node's loopback door; a tool configurator
// in deskUnslothRemote is a later item, and this list is its seed.
// AND deskUnsloth's own (goal/G10.8): its file and git verbs, rooted at its clone, listed by its own introspection and
// asked through its node as any caller asks them, so the fence below holds for the model as for everyone.
const TOOL_NAMESPACES = ['desk', 'fs', 'deskUnsloth'];
const tools = require('./tools').createTools({
  ask: function (verb, args) { return spirit.core.ask(verb, args, NODE_URL); },
  routes: {
    desk: {
      ask: function (verb, args) {
        return askNode({ deskClient: { desk: { verb: String(verb), json: JSON.stringify(args || {}) } } })
          .then(function (body) { return { status: body && body.ok === false ? 400 : 200, body: body, text: JSON.stringify(body) }; });
      },
      verb: function (stem) { return stem; },
      family: function (name) { return 'AGENTS.' + name; },
    },
    deskUnsloth: {
      ask: function (verb, args) {
        const one = {}; one[String(verb)] = args || {};
        return spirit.core.ask('jobs.api', { ask: { deskUnsloth: one } }, NODE_URL).then(function (r) {
          const body = (r && r.body) || {};
          return { status: (r && r.status) || 200, body: body, text: JSON.stringify(body) };
        });
      },
      verb: function (stem) { return stem; },
      family: function (name) { return 'AGENTS.' + name; },
    },
  },
  room: toolRoom,
});
function describeAll() {
  return TOOL_NAMESPACES.reduce(function (chain, ns) {
    return chain.then(function (list) {
      return tools.describe(ns).then(function (more) { return list.concat(more); }, function () { return list; });
    });
  }, Promise.resolve([]));
}
// WHAT deskUnsloth DOES FOR THE MODEL, said in every call beside the rules: its final text is posted under the item
// it was addressed in, so a chat.add tool is for another item or an extra line, never its answer again.
const TOOLS_NOTE = 'Your tools are the verbs described to you, named namespace_verb. Your final answer to the line you were addressed in is posted under that item for you; use desk_chat_add only for another item or an extra line, never to repeat your answer.';

function argumentsOf(call) {
  try { const a = JSON.parse(String((call && call.function && call.function.arguments) || '{}')); return a && typeof a === 'object' ? a : {}; } catch (e) { return {}; }
}

function askModel(messages, onTool) {
  return describeAll().then(function (list) {
    const all = messages.slice();
    // The note rides with the rules, in the system message, only when there is a tool to speak of.
    if (list.length && all.length && all[0].role === 'system') all[0] = { role: 'system', content: String(all[0].content || '') + '\n\n' + TOOLS_NOTE };
    return askModelRound(all, list, 0, onTool);
  });
}

// THE LAST WORD IS THE MODEL'S, NOT A PLACEHOLDER (found live by Andy, 2026-10-10: Levant fetched sources three
// rounds long and the answer read "the model kept asking for tools after 3 rounds and said nothing"). When the
// rounds are spent and the model still asks for a tool, it is asked once more WITHOUT tools and told the budget is
// spent, so it answers with what it has read; only if that too says nothing does the placeholder stand.
const BUDGET_SPENT = '(the tool budget of this answer is spent: answer now with what you have read)';

function askModelRound(messages, list, round, onTool) {
  const body = { model: MODEL, messages: messages, max_tokens: ANSWER_TOKENS };
  if (list.length) body.tools = list;
  return studio('POST', '/v1/chat/completions', body).then(function (got) {
    const choice = got && Array.isArray(got.choices) ? got.choices[0] : null;
    const message = choice && choice.message ? choice.message : null;
    const calls = message && Array.isArray(message.tool_calls) ? message.tool_calls : [];
    if (calls.length && round >= TOOL_ROUNDS && list.length) {
      messages.push({ role: 'user', content: BUDGET_SPENT });
      return askModelRound(messages, [], round + 1, onTool);
    }
    if (calls.length && round < TOOL_ROUNDS) {
      messages.push({ role: 'assistant', content: String(message.content || ''), tool_calls: calls });
      return calls.reduce(function (chain, call) {
        return chain.then(function () {
          const name = String((call.function && call.function.name) || '');
          // What the tool works on, for the Remote's chat line: a url (net), else a path (fs, goal/G14.8).
          const given = argumentsOf(call);
          const url = String(given.url || given.path || '');
          if (onTool) onTool({ name: name, url: url, done: false });
          return tools.run(call).then(function (r) {
            messages.push({ role: 'tool', tool_call_id: r.id, content: r.text });
            if (onTool) onTool({ name: name, url: url, done: true });
          });
        });
      }, Promise.resolve()).then(function () { return askModelRound(messages, list, round + 1, onTool); });
    }
    const content = message ? String(message.content || '') : '';
    if (!content) {
      if (calls.length) return '(the model kept asking for tools after ' + TOOL_ROUNDS + ' rounds and said nothing)';
      throw new Error('the model answered nothing');
    }
    return content;
  });
}

// ── THE STUDIO'S MODELS, AND A LOAD (goal/G14.4) ──────────────────────
//
//   Andy, 2026-10-10: "The dropdown will only show models that unsloth has cached locally." "The [Load] button will
//   only be displayed if the models is not running, otherwise that spot shows the RUNNING icon." On choosing: "No.
//   because the loading process is lengthy, changing the selection only will bring more detailed info."
//
// models: the cached list (api/models/cached-gguf: size, task, vision), each with its quant and loaded flag from
// v1/models, and reasoning and audio from inference/status for the loaded one, false for the rest: the studio has
// no cheap, consistent answer for an unloaded model (api/models/config takes 3.6 s each and contradicted
// cached-gguf on vision). Three studio calls per ask, nothing kept.
// ONLY THE CACHED LIST IS REQUIRED. With no model loaded the studio answers inference/status with an error, and
// the first build failed the whole ask on it, so the dropdown never appeared (Andy, 2026-10-10: "when no model is
// loaded, the model selector doesn't show up."). A failing status or v1/models now means nothing loaded, and the
// list still comes.
// AND THE WALL: v1/models is asked for the quant alone, capped at QUANT_WAIT_MS; late, the quant is '' this time
// (it took 14.9 s live, probing the studio's ollama entries, and the whole ask died at 12 s). The loaded flag
// comes from inference/status, 0.3 s live, which names the active model and lists the loaded ones.
const QUANT_WAIT_MS = 5000;

// THE KNOWN LIST IS THE CACHE, AND THE ANSWER (Andy, 2026-10-10: "deskUnsloth should cache the model list with all
// capabilities, you'll be able to show more info earlier, and more info from cache, for not-loaded models.", then
// "deskUnloth should REALLY cache the know list....", and "deskUnloth must respond to all queries immediately").
// models.json in the state folder holds the last list as it was answered: every model with its quant, size, task,
// vision, and the reasoning and audio flags learned while it was the loaded one. A models ask is answered FROM THE
// FILE AT ONCE, and a refresh from the studio runs behind it (one at a time): the next ask has what the studio said.
// Only the very first ask, with no file yet, waits for the studio. The studio says reasoning and audio only of the
// loaded model and the quant only when v1/models is quick, so a refresh keeps what was known where the studio is
// silent this time. Vision is the studio's, for every model ("then show vision always").
const MODELS_FILE = 'models.json';
let known = null;       // {active, models: [...]} as last answered, or null before the file is read
let refreshing = null;  // the one refresh in flight
// THE CACHED FLAG (Andy, 2026-10-10: "the list should return with a cached flag, so the remote can forbid loading
// until.... unsloth-studio crashed again."): an answer is `cached` until a refresh from the studio has landed
// within FRESH_MS, so the remote offers Load only when the studio has just been heard from. A list from the file
// with the studio down is still a list, and says so.
const FRESH_MS = 10000;
let refreshedAt = 0;

function readKnown() {
  if (known) return known;
  try { known = JSON.parse(fs.readFileSync(path.join(STATE, MODELS_FILE), 'utf8')); } catch (e) { known = null; }
  if (!known || !Array.isArray(known.models)) known = null;
  return known;
}
function writeKnown(next) {
  known = next;
  try { fs.writeFileSync(path.join(STATE, MODELS_FILE), JSON.stringify(next, null, 2) + '\n'); } catch (e) { say('models.json could not be written: ' + e.message); }
}

// ONE ENTRY PER MODEL AND QUANTIZATION (goal/G10.9). Andy, 2026-10-12: "we need to offer a precise selection of
// models, that includes the quantization/flavor as well?", and of which: "yes. i'll download extra flavors manually,
// if needed." So the downloaded variants of every cached model, read from api/models/gguf-variants (0.65 s live), one
// ask per cached model, one after another; the cost, stated (rule/5): one more studio call per cached model on every
// refresh. A model whose variants cannot be read keeps one entry, its quant from v1/models as before. The loaded pair
// is the status's active_model and gguf_variant. The 🧵 mark (recommended) and when it was tested are kept from the
// known list: only model.test writes them.
function pairKey(id, quant) { return String(id) + '\n' + String(quant || ''); }
function variantsOf(id) {
  return studio('GET', '/api/models/gguf-variants?repo_id=' + encodeURIComponent(id) + '&prefer_local_cache=true', undefined, QUANT_WAIT_MS)
    .then(function (v) { return (Array.isArray(v && v.variants) ? v.variants : []).filter(function (x) { return x && x.downloaded === true && x.quant; }); }, function () { return null; });
}
function fetchModels() {
  const nothing = function () { return {}; };
  return Promise.all([studio('GET', '/api/models/cached-gguf'), studio('GET', '/v1/models', undefined, QUANT_WAIT_MS).catch(nothing), studio('GET', '/api/inference/status').catch(nothing)])
    .then(function (got) {
      const cached = Array.isArray(got[0] && got[0].cached) ? got[0].cached : [];
      const byId = {};
      (Array.isArray(got[1] && got[1].data) ? got[1].data : []).forEach(function (m) { if (m && m.id) byId[String(m.id)] = m; });
      const st = got[2] || {};
      const active = String(st.active_model || '');
      const loadedList = Array.isArray(st.loaded) ? st.loaded.map(String) : [];
      // The loaded model's context: the room every call is sized to (goal/G10.7).
      if (Number(st.context_length) > 0) studioContext = Number(st.context_length);
      const activeQuant = String(st.gguf_variant || (byId[active] || {}).quant || '');
      const was = {};
      // A MODEL WHOSE VARIANTS COULD NOT BE READ keeps one entry, and what was learned of it (its quant, its flags, its
      // mark) is found by its id, as before goal/G10.9: a late v1/models must not cost it (goal/G14.4, 2b).
      const wasById = {};
      ((readKnown() || {}).models || []).forEach(function (m) { if (m && m.id) { was[pairKey(m.id, m.quant)] = m; wasById[m.id] = m; } });
      const list = [];
      return cached.reduce(function (chain, c) {
        return chain.then(function () {
          const id = String(c.repo_id || '');
          const k = byId[id] || {};
          return variantsOf(id).then(function (variants) {
            const listed = variants && variants.length;
            const quants = listed ? variants : [{ quant: String(k.quant || (wasById[id] || {}).quant || ''), size_bytes: c.size_bytes }];
            quants.forEach(function (v) {
              const quant = String(v.quant || '');
              const w = was[pairKey(id, quant)] || (listed ? {} : wasById[id] || {});
              const loaded = (id === active || loadedList.indexOf(id) !== -1 || k.loaded === true) && (!activeQuant || !quant || quant === activeQuant);
              list.push({
                id: id,
                quant: quant,
                loaded: loaded,
                bytes: Number(v.size_bytes) || Number(c.size_bytes) || 0,
                task: String(c.task || ''),
                vision: c.has_vision === true,
                // The flags are the studio's while this pair is loaded, and what was learned of it otherwise.
                reasoning: loaded ? st.supports_reasoning === true : w.reasoning === true,
                audio: loaded ? st.is_audio === true : w.audio === true,
                recommended: w.recommended === true,
                tested: String(w.tested || ''),
              });
            });
          });
        });
      }, Promise.resolve()).then(function () {
        // A status without gguf_variant and a late v1/models: the loaded entry's quant, as the list knows it.
        const loadedOne = list.filter(function (m) { return m.id === active && m.loaded; })[0];
        return { active: active, activeQuant: activeQuant || (loadedOne ? loadedOne.quant : ''), models: list };
      });
    });
}

function refreshModels() {
  if (refreshing) return refreshing;
  refreshing = fetchModels().then(function (next) {
    refreshing = null;
    refreshedAt = Date.now();
    writeKnown(next);
    publishState();
    return next;
  }, function (e) {
    refreshing = null;
    say('the studio\'s model list could not be read: ' + e.message);
    throw e;
  });
  return refreshing;
}

function models() {
  const loadNow = { model: load.model, state: load.state, error: load.error };
  const have = readKnown();
  if (have) {
    refreshModels().catch(function () { /* said above; the known list stands */ });
    return { active: String(have.active || ''), activeQuant: String(have.activeQuant || ''), cached: !(refreshedAt && Date.now() - refreshedAt < FRESH_MS), load: loadNow, test: testNow(), models: have.models };
  }
  return refreshModels().then(function (next) {
    return { active: next.active, activeQuant: String(next.activeQuant || ''), cached: false, load: loadNow, test: testNow(), models: next.models };
  });
}

// ── ONE STATE, PUBLISHED ON EVERY CHANGE (goal/G14.5) ─────────────────
//
//   Andy, 2026-10-10: "so deskUnsloth keeps a state, and publishes changes, it's own api are more like
//   event-delivery to deskUnsloth".
//
// The state is what state, models and chat.answer answer, in one object, published through appServer.publish
// whenever any of it changes: the switch, a load's state, the known list after a refresh, a chat answer. The node
// hands it to the pages on this node and, on a puppet, streams it to the owner (puppetStream.js); the Remote
// draws from it and asks nothing. The read verbs stay for a one-shot ask.
let lastChat = { id: '', done: false, text: '', tool: { name: '', url: '', done: true } };
function stateObject() {
  const have = readKnown() || { active: '', models: [] };
  return {
    connected: connected,
    persona: PERSONA,
    model: MODEL,
    server: { url: server.url, answers: server.answers, error: server.error },
    active: String(have.active || ''),
    activeQuant: String(have.activeQuant || ''),
    cached: !(refreshedAt && Date.now() - refreshedAt < FRESH_MS),
    load: { model: load.model, state: load.state, error: load.error },
    test: testNow(),
    models: Array.isArray(have.models) ? have.models : [],
    // The tool in flight, if any (goal/G14.6), so the chat box can show the fetch.
    chat: { id: lastChat.id, done: lastChat.done, text: lastChat.text, tool: { name: lastChat.tool.name, url: lastChat.tool.url, done: lastChat.tool.done } },
  };
}
function publishState() {
  appServer.publish(stateObject());
}

// model.load: the studio's load for that id (it swaps the loaded one; lengthy), and the configuration follows:
// configuration.json is rewritten by this process, the one that owns it, and MODEL with it, so the next call names
// what the studio serves. ANSWERED AT ONCE, THE STUDIO NOT WAITED FOR: its POST load blocks until the model is in,
// minutes for a big one, and a process must answer jobs.api within 12 s (appClient DOOR_WAIT_MS). The first build
// waited, and Andy's press died at the wall (2026-10-10: "The load button fails because it takes too long to load
// a model, you may have to load asynchronously, and poll"). models says when the studio is done; a refusal from
// the studio is said in this process's log, the line finds out by polling.
//
// THE LOAD'S OUTCOME IS SAID, NOT ONLY LOGGED (Andy, 2026-10-10, after a load failed live: "your UI must release
// the hour-glass status. and allow another loading attempt."): `load` is the last load's model, state (loading,
// done, failed) and the studio's words when it failed, and models carries it, so the line polling models sees a
// failure the moment the studio refuses and offers Load again.
let load = { model: '', state: '', error: '' };

function loadModel(id, quant) {
  const file = path.join(STATE, CONFIGURATION_FILE);
  let conf = {};
  try { conf = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { conf = Object.assign({}, CONFIGURATION); }
  conf.model = id;
  fs.writeFileSync(file, JSON.stringify(conf, null, 2) + '\n');
  MODEL = id;
  say('loading ' + id + '; the configuration names it from now on');
  load = { model: id, state: 'loading', error: '' };
  publishState();
  // THE QUANTIZATION NAMED (goal/G10.9): the studio's own field, gguf_variant; without one it picks its default.
  const body = { model_path: id };
  if (quant) body.gguf_variant = String(quant);
  return studio('POST', '/api/inference/load', body).then(function () {
    if (load.model === id) load = { model: id, state: 'done', error: '' };
    say('the studio has loaded ' + id);
    // The studio is done: the known list is read again, and the state goes out with it.
    refreshModels().catch(function () { publishState(); });
  }, function (e) {
    if (load.model === id) load = { model: id, state: 'failed', error: String(e.message || e) };
    say('the studio did not load ' + id + ': ' + e.message);
    publishState();
    throw e;
  });
}

// ── THE TEST, AND THE 🧵 IT SETS (goal/G10.9) ─────────────────────────
//
//   Andy, 2026-10-12: the mark is set by "a test, there is no use of it all if a model is not capable of using desk
//   properly."; "run it from a [test] button, and utomatically connect/disconnect Levant from the desk, depending on
//   the outcome."; and "Connect should be refused while the loaded model has no 🧵."
//
// model.test answers at once (a load takes minutes). It loads the pair unless it is the loaded one, then asks the
// model once with the tools it would have at the desk and a request only a tool can answer. A real tool call back
// (the message's tool_calls) passes; text, even text that spells a call (seen live 2026-10-12, Ornith writing
// <tool_call>... as content), fails. The pair's entry in models.json keeps recommended and tested, and Levant is
// connected on a pass and disconnected on a fail.
const TEST_PROMPT = 'This is a test of your tools. Call the tool desk_items_search with an empty text to list the items of the current goal. Answer only with the tool call.';
let testing = { id: '', quant: '', state: '', why: '' };
function testNow() { return { id: testing.id, quant: testing.quant, state: testing.state, why: testing.why }; }
function markPair(id, quant, pass) {
  const have = readKnown() || { active: '', models: [] };
  const list = Array.isArray(have.models) ? have.models.slice() : [];
  let hit = false;
  list.forEach(function (m) { if (m && m.id === id && String(m.quant || '') === String(quant || '')) { m.recommended = pass; m.tested = new Date().toISOString(); hit = true; } });
  if (!hit) list.push({ id: id, quant: String(quant || ''), loaded: false, bytes: 0, task: '', vision: false, reasoning: false, audio: false, recommended: pass, tested: new Date().toISOString() });
  writeKnown(Object.assign({}, have, { models: list }));
}
function loadedPair() {
  const have = readKnown() || {};
  return { id: String(have.active || ''), quant: String(have.activeQuant || '') };
}
function loadedRecommended() {
  const have = readKnown() || {};
  const p = loadedPair();
  if (!p.id) return false;
  return (Array.isArray(have.models) ? have.models : []).some(function (m) { return m && m.id === p.id && String(m.quant || '') === p.quant && m.recommended === true; });
}
function testModel(id, quant) {
  if (testing.state === 'running') throw refused('a test is running already: ' + testing.id + ' ' + testing.quant);
  testing = { id: id, quant: String(quant || ''), state: 'running', why: '' };
  publishState();
  const p = loadedPair();
  const ready = p.id === id && p.quant === String(quant || '') ? Promise.resolve() : loadModel(id, quant);
  ready.then(function () { return refreshModels(); }).then(function () {
    return describeAll().then(function (list) {
      if (!list.length) throw new Error('no tools described to test with');
      return studio('POST', '/v1/chat/completions', { model: id, messages: [{ role: 'system', content: PREAMBLE }, { role: 'user', content: TEST_PROMPT }], tools: list, max_tokens: ANSWER_TOKENS });
    });
  }).then(function (got) {
    const message = got && Array.isArray(got.choices) && got.choices[0] ? got.choices[0].message : null;
    const calls = message && Array.isArray(message.tool_calls) ? message.tool_calls.filter(function (c) { return c && c.function && c.function.name; }) : [];
    const pass = calls.length > 0;
    return { pass: pass, why: pass ? 'a real tool call came back: ' + calls[0].function.name : 'no tool call came back; the model answered: ' + String((message && message.content) || '').slice(0, 160) };
  }, function (e) { return { pass: false, why: 'the test could not run: ' + String((e && e.message) || e) }; }).then(function (r) {
    markPair(id, quant, r.pass);
    testing = { id: id, quant: String(quant || ''), state: r.pass ? 'passed' : 'failed', why: r.why };
    say('test of ' + id + ' ' + (quant || '') + ': ' + testing.state + ', ' + r.why);
    return setConnected(r.pass);
  }).then(function () { publishState(); }, function () { publishState(); });
  return { id: id, quant: String(quant || ''), testing: true };
}

// ── THE CONNECTION, FROM THE CONNECT TAB (goal/G10.7) ───────────────────
//
// connection.set {url, key}: connection.json is written by this process, the one that owns it, and the next call
// uses it. The answer says whether a server answers at that url: one GET of the url itself, any HTTP answer counting,
// capped at PROBE_MS. Not v1/models: the studio's took 14.9 s live (goal/G14.4) and a process answers within 12 s.
const PROBE_MS = 5000;
function probe() {
  return new Promise(function (resolve) {
    let url = null;
    try { url = new URL(String(CONNECTION.url || '')); } catch (e) { return resolve({ ok: false, error: 'not a url: ' + String(CONNECTION.url || '') }); }
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80), path: url.pathname + url.search,
      method: 'GET', headers: { Authorization: 'Bearer ' + String(CONNECTION.key || '') },
    }, function (res) { res.resume(); resolve({ ok: true, error: '' }); });
    req.on('error', function (e) { resolve({ ok: false, error: String((e && e.message) || e) }); });
    req.setTimeout(PROBE_MS, function () { req.destroy(new Error('no answer within ' + PROBE_MS + ' ms')); });
    req.end();
  });
}
function setConnection(url, key) {
  const next = { url: String(url || ''), key: String(key || '') };
  fs.writeFileSync(path.join(STATE, CONNECTION_FILE), JSON.stringify(next, null, 2) + '\n');
  CONNECTION = next;
  STUDIO_URL = studioUrlOf(next);
  say('connection.json now names ' + next.url);
  return probe().then(function (r) {
    serverSeen(r.ok, r.error);
    return { url: next.url, answers: r.ok, error: r.error };
  });
}

// ── THE FILE AND GIT VERBS, FENCED BY THE DESK (goal/G10.8) ────────────
//
//   Andy, 2026-10-12: "Give deskUnsloth its own file tools, rooted at the checkout.", the fence "only files on the
//   item Levant has taken" holding for every caller ("ok. we'll take that route,"), and on committing: "Shouldn't
//   Levant be able to commit and Push? otherwise his stuff goes unverified, and i think that's worse", then "All in
//   this item." The commit goes through the clone's own hooks (commitCheck), so no Go, no commit, as for claude.
//
// A path is a repository path inside CLONE, never under .git. Writing and committing need it on the file list of an
// item of the current goal that this node has taken (with: its name) and that is not done or closed.
function refused(why) { return { refusal: 'bad-request', extra: { why: why } }; }
function insideClone(p) {
  const rel = String(p || '').replace(/\\/g, '/').replace(/^\.\//, '');
  if (!rel || path.isAbsolute(rel) || /^[A-Za-z]:/.test(rel)) throw refused('a repository path, not ' + JSON.stringify(p));
  const full = path.resolve(CLONE, rel);
  const back = path.relative(CLONE, full).split(path.sep).join('/');
  if (!back || back.startsWith('..')) throw refused(rel + ' is outside the clone');
  if (back === '.git' || back.indexOf('.git/') === 0) throw refused('nothing under .git');
  return { rel: back, full: full };
}
function fencedPaths() {
  return desk('items.search', { text: '', currentGoalOnly: true, goalsOnly: false, includeClosed: false }).then(function (b) {
    const out = Object.create(null);
    ((b && b.items) || []).forEach(function (i) {
      let it = null;
      try { it = JSON.parse(i.label); } catch (e) { it = null; }
      if (!it || !it.goal || !NODE_NAME || it.with !== NODE_NAME || it.status === 'done' || it.status === 'closed') return;
      (Array.isArray(it.files) ? it.files : []).forEach(function (f) { if (f && f.path) out[String(f.path)] = it.id; });
    });
    return out;
  });
}
function fenced(rel) {
  return fencedPaths().then(function (fence) {
    if (!fence[rel]) throw refused(rel + ' is on no item ' + (NODE_NAME || 'this node') + ' has taken: item.files.add it under your item first');
    return fence[rel];
  });
}
const LOAD_MAX = require('../../../js/appClient').ANSWER_MAX - 1024;
function fileLoad(p) {
  const at = insideClone(p);
  let text = null;
  try { text = fs.readFileSync(at.full, 'utf8'); } catch (e) { throw refused('no such file: ' + at.rel); }
  if (bytes(text) > LOAD_MAX) throw refused(at.rel + ' is ' + bytes(text) + ' bytes, more than one answer carries (' + LOAD_MAX + ')');
  return { path: at.rel, text: text };
}
function fileSave(p, content) {
  const at = insideClone(p);
  return fenced(at.rel).then(function () {
    fs.mkdirSync(path.dirname(at.full), { recursive: true });
    fs.writeFileSync(at.full, String(content), 'utf8');
    return { path: at.rel, bytes: bytes(content) };
  });
}
// git in the clone, awaited, never blocking this process: its own pipe keeps answering while a hook runs.
function gitIn(args) {
  return new Promise(function (resolve) {
    const kid = spawn('git', args, { cwd: CLONE, stdio: ['ignore', 'pipe', 'pipe'] });
    let said = '';
    kid.stdout.on('data', function (d) { said += d; });
    kid.stderr.on('data', function (d) { said += d; });
    kid.on('error', function (e) { resolve({ code: 1, said: String(e.message || e) }); });
    kid.on('exit', function (code) { resolve({ code: code, said: said }); });
  });
}
function commit(message, paths) {
  const msg = String(message || '').trim();
  if (!msg) return Promise.reject(refused('a message is needed, starting with the item id'));
  const list = (Array.isArray(paths) ? paths : []).map(function (p) { return insideClone(p).rel; });
  if (!list.length) return Promise.reject(refused('paths are needed: the files to commit'));
  return fencedPaths().then(function (fence) {
    const out = list.filter(function (p) { return !fence[p]; });
    if (out.length) throw refused('not on an item ' + (NODE_NAME || 'this node') + ' has taken: ' + out.join(', '));
    // By name, never everything (the house rule: stage by name).
    return gitIn(['add', '--'].concat(list));
  }).then(function (r) {
    if (r.code !== 0) throw refused('git add: ' + r.said.trim());
    return gitIn(['commit', '-m', msg]);
  }).then(function (r) {
    if (r.code !== 0) throw refused('git commit (its hook included): ' + r.said.trim().slice(0, 600));
    return gitIn(['rev-parse', '--short', 'HEAD']);
  }).then(function (r) {
    say('committed ' + r.said.trim() + ': ' + msg.split('\n')[0]);
    return { commit: r.said.trim() };
  });
}
function push() {
  return gitIn(['pull', '--rebase']).then(function (r) {
    if (r.code !== 0) {
      return gitIn(['rebase', '--abort']).then(function () { throw refused('git pull --rebase failed, nothing pushed: ' + r.said.trim().slice(0, 600)); });
    }
    return gitIn(['push']);
  }).then(function (r) {
    if (r.code !== 0) throw refused('git push: ' + r.said.trim().slice(0, 600));
    return gitIn(['rev-parse', '--short', 'HEAD']);
  }).then(function (r) {
    say('pushed ' + r.said.trim());
    return { commit: r.said.trim() };
  });
}

// ── THE CHAT BOX'S CALLS (goal/G14.4) ──────────────────────────────────
//
//   Andy, 2026-10-10: a chat box "sticky, at the bottom of the window (panel)", "Enter = send, one line only",
//   "the chat will only be shown on the node that hosts deskUnsloth....".
//
// TWO ASKS, NOT ONE: an ask of this process through jobs.api is answered within DOOR_WAIT_MS, 12 s (appClient.js),
// and a model answer can take longer. So chat.send takes the page's transcript, answers an id at once and asks the
// model; chat.answer {id} says whether it is done and hands the text over. The page keeps the transcript; this keeps
// only the answers in flight, and forgets one ANSWER_KEEP_MS after it is done.
const ANSWER_KEEP_MS = 10 * 60 * 1000;
const answers = Object.create(null);

function chatSend(lines) {
  const id = require('crypto').randomBytes(8).toString('hex');
  const system = PREAMBLE;
  let room = promptRoom() - bytes(system);
  const window = [];
  for (let i = lines.length - 1; i >= 0; i--) {
    const role = lines[i].role === 'assistant' ? 'assistant' : 'user';
    const content = String(lines[i].text || '');
    const cost = bytes(content);
    if (cost > room) break;
    room -= cost;
    window.unshift({ role: role, content: content });
  }
  const messages = [{ role: 'system', content: system }].concat(window);
  answers[id] = { done: false, text: '', at: Date.now() };
  lastChat = { id: id, done: false, text: '', tool: { name: '', url: '', done: true } };
  publishState();
  const onTool = function (t) { lastChat.tool = { name: t.name, url: t.url, done: t.done }; publishState(); };
  askModel(messages, onTool).then(function (content) {
    answers[id] = { done: true, text: content, at: Date.now() };
    lastChat = { id: id, done: true, text: content, tool: { name: '', url: '', done: true } };
    publishState();
  }, function (e) {
    answers[id] = { done: true, text: '(the model did not answer: ' + e.message + ')', at: Date.now() };
    lastChat = { id: id, done: true, text: answers[id].text, tool: { name: '', url: '', done: true } };
    publishState();
  });
  Object.keys(answers).forEach(function (k) { if (answers[k].done && Date.now() - answers[k].at > ANSWER_KEEP_MS) delete answers[k]; });
  return { id: id };
}

function chatAnswer(id) {
  const a = answers[String(id)];
  if (!a) throw { refusal: 'bad-request', extra: { why: 'no such answer' } };
  return { done: a.done, text: a.text };
}

// ── THE ANSWER, IN LINES UNDER THE ROOM (goal/G10.3 point 8) ──────────
//
// The cap bites on packets, so a long answer is split at paragraphs and each line stays under the room the desk can
// hand back in one answer. A paragraph is never cut in two: whole in one line, in order, as many to a line as fit.
// The first line carries the persona's name, so the desk shows who spoke; no "[loop.js]" anywhere — that prefix was
// the hack's.
const LINE_ROOM = require('../../../js/appClient').ANSWER_MAX - 1024;

function linesOf(answer) {
  const paragraphs = String(answer).split(/\n{2,}/).map(function (p) { return p.trim(); }).filter(Boolean);
  const out = [];
  let held = '';
  paragraphs.forEach(function (p) {
    const first = !out.length && !held;
    const lead = first ? PERSONA + ': ' : '';
    const joined = held ? held + '\n\n' + p : lead + p;
    if (held && bytes(joined) > LINE_ROOM) { out.push(held); held = p; return; }
    held = joined;
  });
  if (held) out.push(held);
  // A paragraph of its own bigger than the room is cut at the last space that fits: nothing is dropped.
  const safe = [];
  out.forEach(function (text) {
    let rest = text;
    while (bytes(rest) > LINE_ROOM) {
      let cut = LINE_ROOM;
      while (cut > 0 && bytes(rest.slice(0, cut)) > LINE_ROOM) cut -= 64;
      const space = rest.lastIndexOf(' ', cut);
      const at = space > cut / 2 ? space : cut;
      safe.push(rest.slice(0, at));
      rest = rest.slice(at).replace(/^\s+/, '');
    }
    if (rest) safe.push(rest);
  });
  return safe.length ? safe : [PERSONA + ': (nothing to say)'];
}

function post(id, text) {
  return desk('chat.add', { id: id, text: text });
}
function postAll(id, texts) {
  return texts.reduce(function (chain, text) {
    return chain.then(function () { return post(id, text); });
  }, Promise.resolve());
}

function answerItem(job) {
  const id = job.id;
  return callFor(id, job.changes).then(askModel).then(function (content) {
    return postAll(id, linesOf(content));
  }).catch(function (e) {
    say('the answer for ' + id + ' failed: ' + e.message);
  });
}

// ── THE LOOP, AND THE PRESENT (goal/G10.3 point 7) ────────────────────
//
// What the listener hands over before it first answers with no lines is the backlog: read, never answered, so the
// agent starts at the present. One answer at a time: a model call is long and the desk is the record.
let caughtUp = false;
let working = false;
const waiting = [];

function drain() {
  if (working) return Promise.resolve();
  const job = waiting.shift();
  if (!job) return Promise.resolve();
  working = true;
  return answerItem(job).then(function () { working = false; return drain(); });
}

// ── THE SWITCH (goal/G14.2) ───────────────────────────────────────────
//
//   Andy, 2026-10-10: "it will be a connect/disconnect switch for Levant to be visible in desk." "this way i can
//   turn it off, so i don't have to waive for you to claim both reds and code."
//
// The desk counts an agent live for ten minutes after its last write, and every ask for next lines is a write; only
// signoff drops it at once (desk.js, goal/G8.5). So DISCONNECT is two things: the loop stops asking, and one signoff
// goes to the desk, so Levant leaves the live list now and the waive rule sees one agent. CONNECT starts the loop
// again as at a start: what it is handed before the first empty answer is the backlog, read and never answered,
// and its first ask makes it live again. The process stays up either way: stopping the job is not this switch.
// It starts connected, as it always did. `looping` keeps a connect that lands while the last ask is still in
// flight from starting a second loop.
// AT START, CONNECTED ONLY ON 🧵 (goal/G10.9): Andy, 2026-10-12, "Connect should be refused while the loaded model has
// no 🧵." The loaded pair and its mark are the known list's (models.json), read without asking the studio.
let connected = loadedRecommended();
let looping = false;

function setConnected(on) {
  // REFUSED WITHOUT 🧵 (goal/G10.9): "Connect should be refused while the loaded model has no 🧵."
  if (on && !loadedRecommended()) {
    const p = loadedPair();
    return Promise.reject(refused('the loaded model ' + (p.id || '(none)') + (p.quant ? ' ' + p.quant : '') + ' has no desk-recommended mark: test it first'));
  }
  if (on === connected) return Promise.resolve({ connected: connected });
  if (!on) {
    connected = false;
    publishState();
    say(PERSONA + ' leaves the desk: signing off');
    return desk('signoff', {}).then(function () { return { connected: false }; }, function (e) {
      say('the signoff could not be said: ' + e.message);
      return { connected: false };
    });
  }
  connected = true;
  caughtUp = false;
  publishState();
  say(PERSONA + ' is back at the desk, from the present');
  if (!looping) loop();
  return Promise.resolve({ connected: true });
}

function loop() {
  if (!connected) { looping = false; return; }
  looping = true;
  nextLines().then(function (lines) {
    if (!lines.length) {
      if (!caughtUp) { caughtUp = true; say('caught up with the backlog; answering from here'); }
    } else if (!caughtUp) {
      say(lines.length + ' line(s) of backlog read and left alone');
    } else {
      lines.forEach(function (line) {
        const read = readLine(line);
        if (!mine(read)) return;
        // One answer per item waiting, every change for it carried (nothing dropped): the call reads them all.
        const at = waiting.filter(function (j) { return j.id === read.id; })[0];
        const what = read.kind === 'job' ? 'JOB ' + read.id : String(read.line || '');
        if (at) at.changes.push(what);
        else waiting.push({ id: read.id, changes: [what] });
      });
      drain();
    }
    setTimeout(loop, WAIT_MS);
  }, function (e) {
    say('the listener could not be asked: ' + e.message);
    setTimeout(loop, WAIT_MS);
  });
}

appServer.serve({
  alive: {
    request: {}, reply: { alive: true },
    handler: function () { return { alive: true }; },
  },
  // THE SWITCH'S TWO VERBS (goal/G14.2): what deskUnslothRemote flips and reads, on this node through jobs.api,
  // from the owner's node through owner.command carrying that same ask.
  connect: {
    request: { on: true }, reply: { connected: true },
    handler: function (a) { return setConnected(a.on === true); },
  },
  state: {
    request: {}, reply: { connected: true, persona: '', model: '', server: { url: '', answers: true, error: '' } },
    handler: function () { return { connected: connected, persona: PERSONA, model: MODEL, server: { url: server.url, answers: server.answers, error: server.error } }; },
  },
  // THE SERVER BUBBLE'S VERB (goal/G10.7): the url and the key into connection.json, and whether a server answers.
  'connection.set': {
    request: { url: '', key: '' }, reply: { url: '', answers: true, error: '' },
    handler: function (a) {
      if (!String(a.url || '')) throw { refusal: 'bad-request', extra: { why: 'a url is needed' } };
      return setConnection(a.url, a.key);
    },
  },
  // THE MODEL LINE AND THE CHAT BOX (goal/G14.4): what deskUnslothRemote reads and presses.
  models: {
    request: {}, reply: { active: '', cached: true, load: { model: '', state: '', error: '' }, models: [{ id: '', loaded: true, quant: '', bytes: 0, task: '', vision: true, reasoning: true, audio: true }] },
    handler: function () { return models(); },
  },
  // THE QUANTIZATION NAMED (goal/G10.9); answered at once, the studio not waited for (goal/G14.4).
  'model.load': {
    request: { id: '', quant: '' }, reply: { model: '', loaded: true },
    handler: function (a) {
      loadModel(String(a.id), String(a.quant || '')).catch(function () { /* said and published above */ });
      return { model: String(a.id), loaded: false };
    },
  },
  // THE [test] BUTTON'S VERB (goal/G10.9): answered at once; the outcome is published (test) and kept (models.json).
  'model.test': {
    request: { id: '', quant: '' }, reply: { id: '', quant: '', testing: true },
    handler: function (a) {
      if (!String(a.id || '')) throw refused('an id is needed');
      return testModel(String(a.id), String(a.quant || ''));
    },
  },
  'chat.send': {
    request: { lines: [{ role: '', text: '' }] }, reply: { id: '' },
    handler: function (a) { return chatSend(Array.isArray(a.lines) ? a.lines : []); },
  },
  // THE FILE AND GIT VERBS (goal/G10.8), each with its file beside this script, so introspection lists them.
  'file.load': {
    request: { path: '' }, reply: { path: '', text: '' },
    handler: function (a) { return fileLoad(a.path); },
  },
  'file.save': {
    request: { path: '', content: '' }, reply: { path: '', bytes: 0 },
    handler: function (a) { return fileSave(a.path, a.content); },
  },
  commit: {
    request: { message: '', paths: [''] }, reply: { commit: '' },
    handler: function (a) { return commit(a.message, a.paths); },
  },
  push: {
    request: {}, reply: { commit: '' },
    handler: function () { return push(); },
  },
  'chat.answer': {
    request: { id: '' }, reply: { done: true, text: '' },
    handler: function (a) { return chatAnswer(a.id); },
  },
}, { dependencies: [] });

say(PERSONA + ' is at the desk, model ' + MODEL + ', context the studio\'s (' + CONTEXT_FALLBACK + ' until read), server ' + (server.url || 'not set'));
// The first state goes out at once, from what is known. The studio is not read until somebody asks models (the
// Remote does when it opens): at the desk alone, deskUnsloth speaks to the studio for chat and nothing else
// (goal/G10.3, deskUnslothContext.js).
publishState();
loop();
