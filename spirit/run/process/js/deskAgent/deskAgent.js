'use strict';

// spirit/run/process/js/deskAgent/deskAgent.js
// THE LOCAL AGENT'S MEDIATOR: it routes between the agent and the desk, and nothing more — goal/G10.3.
// Since goal/G14.2 it has a switch: connect {on} and state {}, the two verbs deskAgentRemote flips and reads.
//
//   Andy, 2026-10-09: "tooling is deferred for this goal. deskAgent simply will route between agent and desk."
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
// Built by wsl-claude against claude-windows's red, spirit/test/deskAgentContext.js, which is the contract this
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
// name, asking nobody. THE CONNECTION MAY BE ABSENT (goal/G10.7): it is set from deskAgentRemote's connect tab
// through connection.set, so a node without one starts, says it has no server, and waits for it. Andy, 2026-10-12, on
// the server bubble writing a url and a key into connection.json through a verb of deskAgent's own: "yes."
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
    console.error('deskAgent: ' + name + ' is not in its state folder (' + file + '); it is hand-written for now');
    process.exit(2);
  }
  try { return JSON.parse(raw); } catch (e) {
    console.error('deskAgent: ' + name + ' is not readable JSON: ' + e.message);
    process.exit(2);
  }
  return null;
}
// Read before anything is asked of the node: a missing file is this process's own business and no desk's.
// A MISSING CONFIGURATION STARTS ON DEFAULTS (goal/G19.12). Andy, 2026-10-12, asked whether deskAgent should start
// without configuration.json, on defaults: "yes." So it starts as persona agent with no model, as it already starts with
// no connection (goal/G10.7), and the Remote sets the rest; model.load writes the file. A file that is there but not
// readable JSON still ends it: that is broken data, not absent data.
const CONFIGURATION = fs.existsSync(path.join(STATE, CONFIGURATION_FILE)) ? readOrDie(CONFIGURATION_FILE) : (function () {
  console.log('deskAgent: no ' + CONFIGURATION_FILE + ' in its state folder; starting on defaults (persona agent, no model)');
  return {};
}());
// THE PAIRS (goal/G18.6). Andy, 2026-10-12: "I want my Account URL/token pairs saved in connection.json, now an array.
// i want to maintain that array in the connect tab."; each pair named by him, "good Idea, yes." So connection.json is
// [{name, url, key, use, model}]: one pair in use, and the model chosen on each pair kept with it. AN OLD FILE, one
// {url, key}, is read as one pair named studio, in use, its model the configuration's; it is rewritten as an array at
// the first change (stored data stays readable).
// A WORKSPACE BESIDE THE KEY (goal/G14.10): Andy wants his Anthropic user key, which Anthropic accepts only with a
// workspace id on every call. So a pair keeps an optional workspace, '' when the server asks for none, and every call
// to a pair that has one carries the header anthropic-workspace-id (pairHeaders below). One header, not an
// adapter: Andy refused an adapter for deskAgent in goal/G21.
const LEGACY_PAIR = 'studio';
// THE EFFORT, PER API AND MODEL (goal/G27.8). Andy's box: "Effort is the control for how much work a task gets, like
// the low to high sliders in claude-code: an effort slider in the configuration, per api/model combination that
// supports it", "configured not guessed", and the slider defaults to medium (Andy, 2026-10-17). So a table of rows
// {server, model, field}: a row applies to a pair whose url holds its server and to a model whose id begins with its
// model; its field is the one the request carries. configuration.json may carry its own table as effort; without one,
// these rows. The level is kept per pair and model, on the pair, medium until set; off sends nothing; a model no row
// applies to sends nothing and its slider is disabled. The studio has no row until its accepted fields are confirmed.
const EFFORT_LEVELS = ['off', 'low', 'medium', 'high'];
const EFFORT_DEFAULT = 'medium';
const EFFORT_TABLE_DEFAULT = [
  { server: 'api.openai.com', model: 'o', field: 'reasoning_effort' },
  { server: 'api.openai.com', model: 'gpt-5', field: 'reasoning_effort' },
  { server: 'api.anthropic.com', model: 'claude-', field: 'thinking' },
];
function effortLevels(x) {
  const out = {};
  if (x && typeof x === 'object' && !Array.isArray(x)) Object.keys(x).forEach(function (m) { if (EFFORT_LEVELS.indexOf(x[m]) !== -1) out[m] = x[m]; });
  return out;
}
function readConnections() {
  let c = null;
  try { c = JSON.parse(fs.readFileSync(path.join(STATE, CONNECTION_FILE), 'utf8')); } catch (e) { return []; }
  if (Array.isArray(c)) {
    return c.filter(function (p) { return p && typeof p.name === 'string' && p.name; }).map(function (p) {
      return { name: p.name, url: String(p.url || ''), key: String(p.key || ''), use: p.use === true, model: String(p.model || ''), workspace: String(p.workspace || ''), effort: effortLevels(p.effort) };
    });
  }
  if (c && typeof c === 'object' && c.url) return [{ name: LEGACY_PAIR, url: String(c.url), key: String(c.key || ''), use: true, model: String(CONFIGURATION.model || ''), workspace: '', effort: {} }];
  return [];
}
function writeConnections() {
  const rows = CONNECTIONS.map(function (p) { return { name: p.name, url: p.url, key: p.key, use: p.use, model: p.model, workspace: p.workspace || '', effort: effortLevels(p.effort) }; });
  fs.writeFileSync(path.join(STATE, CONNECTION_FILE), JSON.stringify(rows, null, 2) + '\n');
}
// The headers of every call to a pair: its key, and its workspace only when it has one (goal/G14.10).
// AND ANTHROPIC'S API VERSION ON EVERY CALL, TO EVERY SERVER (goal/G14.10, Andy's A): Anthropic's model list refuses
// a call without it, so the configure tab had no dropdown; OpenAI and the studio ignore it. A fixed value.
const ANTHROPIC_VERSION = '2023-06-01';
function pairHeaders(pair) {
  // x-api-key too (goal/G27.6, Andy 2026-10-16): Anthropic authenticates with it, not the bearer; other servers ignore it.
  const headers = { Authorization: 'Bearer ' + String((pair && pair.key) || ''), 'x-api-key': String((pair && pair.key) || ''), 'anthropic-version': ANTHROPIC_VERSION };
  if (pair && pair.workspace) headers['anthropic-workspace-id'] = String(pair.workspace);
  return headers;
}
function pairNamed(name) { return CONNECTIONS.filter(function (p) { return p.name === name; })[0] || null; }
let CONNECTIONS = readConnections();
let CONNECTION = CONNECTIONS.filter(function (p) { return p.use; })[0] || {};
const EFFORT_TABLE = (Array.isArray(CONFIGURATION.effort) ? CONFIGURATION.effort : EFFORT_TABLE_DEFAULT).filter(function (r) {
  return r && typeof r.server === 'string' && r.server && typeof r.model === 'string' && (r.field === 'reasoning_effort' || r.field === 'thinking');
});
function effortRow(pair, model) {
  const url = String((pair && pair.url) || '');
  const id = String(model || '');
  return EFFORT_TABLE.filter(function (r) { return url.indexOf(r.server) !== -1 && id.indexOf(r.model) === 0; })[0] || null;
}
function effortLevel(pair, model) { return ((pair && pair.effort) || {})[String(model || '')] || EFFORT_DEFAULT; }
function effortNow() { return { supported: !!effortRow(CONNECTION, MODEL), level: effortLevel(CONNECTION, MODEL) }; }
// THE THINKING BUDGET: a share of the answer's own length mark, which it must stay under (Anthropic refuses a budget at
// or over max_tokens). The cost, stated (rule/5): thinking spends that share of the answer's tokens.
const THINKING_SHARE = { low: 0.25, medium: 0.5, high: 0.75 };
// Only the mapped field is added; the rest of the body is unchanged.
function withEffort(body) {
  const row = effortRow(CONNECTION, body.model);
  const level = effortLevel(CONNECTION, body.model);
  if (!row || level === 'off') return body;
  if (row.field === 'reasoning_effort') body.reasoning_effort = level;
  else {
    const room = Number(body.max_completion_tokens || body.max_tokens) || 0;
    const budget = Math.floor(room * THINKING_SHARE[level]);
    if (budget > 0) body.thinking = { type: 'enabled', budget_tokens: budget };
  }
  return body;
}
function setEffort(model, level) {
  const id = String(model || '');
  if (EFFORT_LEVELS.indexOf(level) === -1) throw refused('the level is one of ' + EFFORT_LEVELS.join(', ') + ', not ' + JSON.stringify(level));
  if (!CONNECTION.name) throw refused('no pair is in use');
  if (!effortRow(CONNECTION, id)) throw refused('no effort row applies to ' + JSON.stringify(id) + ' on ' + CONNECTION.name + ': its slider is disabled');
  CONNECTION.effort = Object.assign({}, CONNECTION.effort || {});
  CONNECTION.effort[id] = level;
  writeConnections();
  say('effort ' + level + ' for ' + id + ' on ' + CONNECTION.name);
  publishState();
  return { model: id, level: level };
}

const PERSONA = String(CONFIGURATION.persona || 'agent');
const PREAMBLE = String(CONFIGURATION.preamble || '');
// THE MODEL FOLLOWS A LOAD (goal/G14.4): model.load rewrites configuration.json and this with it, so the next call
// names what the studio now serves. Everything else in the configuration is still read once.
// Since goal/G18.6 the model is the pair's: the one chosen on the pair in use.
let MODEL = String(CONNECTION.name ? CONNECTION.model : CONFIGURATION.model || '');
// THE CONTEXT IS THE STUDIO'S, NEVER CONFIGURED (goal/G10.7). Andy, 2026-10-12: "remove  contextLimit from the
// configuration file. we will not work on stuff that unsloth does already well. we will never pass context limits to
// unslot. that's a decision." The room below is the loaded model's context_length as the studio reports it
// (inference/status, read with every refresh of the known list), CONTEXT_FALLBACK until it has been read once; it
// only sizes what this process sends, and no context length is ever sent to the studio.
const CONTEXT_FALLBACK = 8192;
let studioContext = 0;
// A PLAIN SERVER'S CONTEXT (goal/G14.11): only the studio reports one, so every call to a plain OpenAI server was sized
// to CONTEXT_FALLBACK, and Levant answered Andy from cut reads. On a plain pair the room is the chosen model's own
// entry in the known list, kept from the server's v1/models (plainList), read again with every call so nothing of one
// pair stays for the next; still never configured and never sent (goal/G10.7). The cost, stated (rule/5): a bigger
// room is a bigger prompt, and a paid server bills more per answer.
function contextLimit() {
  const have = readKnown();
  let reported = studioContext > 0 ? studioContext : CONTEXT_FALLBACK;
  if (have && have.studio === false) {
    const chosen = MODEL || String(have.active || '');
    const entry = have.models.filter(function (m) { return m && m.id === chosen; })[0];
    reported = entry && Number(entry.context) > 0 ? Number(entry.context) : CONTEXT_FALLBACK;
  }
  // LEARNED FROM A REFUSAL (goal/G27.15, R2): the smaller of what the server reports and what a refusal taught wins.
  const learned = Number((learnedEntry() || {}).learnedContext) || 0;
  return learned > 0 && learned < reported ? learned : reported;
}
// The model in use's entry in the pair in use's list, whatever its quantization.
function learnedEntry() {
  const have = readKnown();
  const chosen = MODEL || String((have && have.active) || '');
  return have && Array.isArray(have.models) ? have.models.filter(function (m) { return m && m.id === chosen && Number(m.learnedContext) > 0; })[0] || null : null;
}
// THE MARGIN (goal/G27.15, R1). Andy, 2026-10-17: "i wouldn't mind a safety margin, always used, maybe 95% or something,
// that would avoid re-tries". Every call is sized to this share of the limit.
const CONTEXT_MARGIN = 0.95;
// Bytes per token: what a refusal taught this model (R2), else the configuration's.
function bytesPerToken() {
  const learned = Number((learnedEntry() || {}).bytesPerToken) || 0;
  return learned > 0 ? learned : BYTES_PER_TOKEN;
}
// NEVER 0 (goal/G19.7): started on defaults (goal/G19.12) the answer had no room and the call asked for 0 tokens.
const ANSWER_TOKENS_DEFAULT = 1024;
const ANSWER_TOKENS = Number(CONFIGURATION.answerTokens) > 0 ? Number(CONFIGURATION.answerTokens) : ANSWER_TOKENS_DEFAULT;
const BYTES_PER_TOKEN = Number(CONFIGURATION.bytesPerToken) || 4;
// HIS FORMULA (goal/G10.3): the room for the whole prompt is what is left of the context once the answer has its
// own, in bytes, at bytesPerToken each. A function since the limit may follow the studio.
function promptRoom() { return Math.max(0, Math.floor((Math.floor(contextLimit() * CONTEXT_MARGIN) - ANSWER_TOKENS) * bytesPerToken())); }
// WHETHER THE MODEL'S CONTEXT IS KNOWN (goal/G23.4): the studio's context_length once read, or a plain pair's entry
// that gave one. Unknown, the tool loop has no bound and no tool result is cut for room: the server decides. The
// window of chat lines a call is built with still uses promptRoom, the fallback included.
function contextKnown() {
  const have = readKnown();
  if (have && have.studio === false) {
    const chosen = MODEL || String(have.active || '');
    const entry = have.models.filter(function (m) { return m && m.id === chosen; })[0];
    return !!(entry && Number(entry.context) > 0);
  }
  return studioContext > 0;
}

// ── THE DESK, THROUGH THIS NODE'S deskClient (goal/G10.3 point 1) ─────
//
// KISS, his word: deskAgent speaks to the desk through the same deskClient server the claudes use, in a loop; it
// opens no stream and holds no place of its own. One mouth, the kernel's.
const PORT = spirit.core.node.const.SPIRIT_PORT;
const NODE_URL = 'http://127.0.0.1:' + PORT;
const WAIT_MS = 250;

function say(text) { console.log('deskAgent: ' + text); }
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

// `DESK <by> <verb> <json>`, as deskAgentEar prints a change: the verb is the last word before the json, so a `by` of
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
  // The desk's AGENTS.md through its family's FS (goal/G30.4: the AGENTS verbs are gone; FS reads the folder).
  return desk('FS.loadFile', { path: 'AGENTS.md' }).then(function (b) { return String((b && b.text) || ''); }, function () { return ''; });
}

// THE CURRENT GOAL, ASKED FOR EVERY CALL (goal/G24.3): Andy saw Levant answer about G23 after G24 was made current;
// his call carried only the goal of the item he answered under. The desk names its current goal to an empty
// current-goal search of goals alone; its facts give the id and title, item.box its box. Nothing current, or the desk
// not answering: no section.
function currentGoal() {
  return desk('items.search', { text: '', currentGoalOnly: true, goalsOnly: true, includeClosed: false }).then(function (b) {
    const first = b && Array.isArray(b.items) ? b.items[0] : null;
    if (!first || !first.key) return null;
    let f = {};
    try { f = JSON.parse(first.label || '{}'); } catch (e) { f = {}; }
    const id = String(first.key);
    return boxOf(id).then(function (box) { return { id: id, title: String(f.title || ''), box: box }; });
  }).catch(function () { return null; });
}

// THE CHANGES THAT WOKE IT are in the call, after the item's chat, so the model knows what happened (goal/G10.8).
function callFor(id, changes) {
  return factsOf(id).then(function (facts) {
    const goalId = facts.goal ? String(facts.goal) : id;
    return Promise.all([agentsText(), boxOf(goalId), goalId === id ? Promise.resolve('') : boxOf(id), chatOf(id), currentGoal()])
      .then(function (got) {
        const rules = got[0];
        const goalBox = got[1];
        const itemBox = got[2];
        const chat = got[3];
        const current = got[4];
        // HIS DESK NAME (goal/G23.2): Levant took his own take of Andy's line for another agent's, because nothing told
        // him the desk names his writes by his node's name. The name is the node's own, handed at start, never configured.
        const nameLine = NODE_NAME ? 'At the desk your writes show as "' + NODE_NAME + '": a line, a take or an item under that name is yours.' : '';
        const system = [rules, PREAMBLE, nameLine].filter(Boolean).join('\n\n');
        const head = [];
        // The current goal first, counted in the room as every panel is; when it is the item's own goal it is said
        // once, as the current goal, and its box is not repeated.
        const own = current && current.id === goalId;
        if (current) head.push('THE CURRENT GOAL ' + current.id + ' "' + current.title + '"' + (own ? ', this item\'s' : '') + '\n' + current.box);
        if (goalBox && !own) head.push('THE GOAL OF THIS ITEM ' + goalId + '\n' + goalBox);
        if (itemBox) head.push('THE ITEM ' + id + '\n' + itemBox);
        // THE WINDOW: the newest lines that fit. Everything but the chat is owed to the call, so the chat takes
        // whatever room is left and the oldest line goes first (his "rolling window ... the oldest dropped").
        const woke = (changes || []).map(function (t) { return 'WHAT JUST HAPPENED AT THE DESK: ' + t; });
        let room = promptRoom() - TOOLS_NOTE_BYTES - bytes(system) - head.concat(woke).reduce(function (s, t) { return s + bytes(t); }, 0);
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
// `conn` is the pair asked (goal/G18.6), the one in use when left out: a refresh started on one pair keeps asking it
// after a switch, and its answer lands in that pair's list.
// `flight` is the model's answer this call belongs to (goal/G19.7): abort destroys the request it holds.
function studio(method, pathname, body, timeoutMs, conn, flight) {
  const pair = conn || CONNECTION;
  const base = studioUrlOf(pair);
  const current = pair === CONNECTION;
  if (!base) return Promise.reject(new Error('no OpenAI compatible server is set: connect one in deskAgentRemote'));
  if (flight && flight.aborted) return Promise.reject(abortedError());
  const url = new URL(base + pathname);
  const text = body === undefined ? '' : JSON.stringify(body);
  const lib = url.protocol === 'https:' ? https : http;
  return new Promise(function (resolve, reject) {
    const headers = pairHeaders(pair);
    if (text) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(text); }
    const req = lib.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: headers,
    }, function (res) {
      if (current) serverSeen(true, '');
      let raw = '';
      res.on('data', function (c) { raw += c; });
      res.on('end', function () {
        // The status rides on the error, so a 404 tells a plain OpenAI server from a studio (goal/G18.6).
        const failed = function (text) { const e = new Error(text); e.status = res.statusCode; e.raw = raw; return e; };
        let got = null;
        try { got = JSON.parse(raw); } catch (e) { return reject(failed('the studio did not answer JSON at ' + pathname)); }
        if (res.statusCode >= 400) return reject(failed('the studio refused ' + pathname + ': ' + res.statusCode + ' ' + raw.slice(0, 120)));
        resolve(got);
      });
    });
    req.on('error', function (e) { if (e && e.code && current) serverSeen(false, String(e.message || e)); reject(e); });
    if (Number(timeoutMs) > 0) req.setTimeout(Number(timeoutMs), function () { req.destroy(new Error('the studio took longer than ' + timeoutMs + ' ms at ' + pathname)); });
    if (flight) {
      flight.reqs.add(req);
      req.on('close', function () { flight.reqs.delete(req); });
    }
    if (text) req.write(text);
    req.end();
  });
}

// ── THE MODEL AT WORK, AND THE ABORT (goal/G19.7) ─────────────────────
//
//   Andy, 2026-10-12: "i think the Remote should have an abort button, that is armed and comes alive whenever the
//   model is working. i much would prefer manual intervention to automated aborting....."
//
// So the model's answer has NO timeout: a huge batch may take as long as it takes, and only abort ends it. A flight is
// one answer in the making (a chat of the test tab, an answer to the desk, a model test): every studio request it
// makes is held, abort destroys them and marks it, and a round not yet asked is never asked. `working` in the state is
// whether any flight is up, so the Remote's Abort is alive exactly then.
const flights = new Set();
function abortedError() { const e = new Error('aborted from the Remote'); e.aborted = true; return e; }
function takeOff(from) {
  const flight = { from: from, aborted: false, reqs: new Set() };
  flights.add(flight);
  if (flights.size === 1) publishState();
  return flight;
}
function land(flight) {
  if (!flights.delete(flight)) return;
  if (!flights.size) publishState();
}
function abortAll() {
  if (!flights.size) throw refused('the model is not working: there is nothing to abort');
  const all = Array.from(flights);
  all.forEach(function (f) {
    f.aborted = true;
    f.reqs.forEach(function (req) { req.destroy(abortedError()); });
    note(f.from, 'abort', 'aborted from the Remote');
    flights.delete(f);
  });
  say('aborted ' + all.length + ' answer(s) in flight from the Remote');
  publishState();
  return { aborted: all.length };
}

// ── THE LOG OF THE TEST TAB (goal/G19.7) ───────────────────────────────
//
//   Andy, 2026-10-12: "The abort button sit's with the chat in the test tab, where all requests, replies, and tool
//   calls should be logged."
//
// Every request to the model, every reply, every tool call and its result, his desk work included, is an entry
// {seq, at, from, kind, text}: from is 'chat' (the test tab), 'test' (model.test) or the item answered. The newest
// entries ride in the published state, as many as fit LOG_BYTES; the Remote keeps what it has seen by seq. A tool
// result is logged in short (RESULT_SHORT), anything else cut at LOG_TEXT_MAX with the cut said.
const LOG_BYTES = 8192;
const LOG_TEXT_MAX = 2048;
const RESULT_SHORT = 240;
let logSeq = 0;
let logRing = [];
function clip(text, room) {
  const s = String(text);
  if (bytes(s) <= room) return s;
  let head = s.slice(0, room);
  while (bytes(head) > room - 40 && head.length) head = head.slice(0, -16);
  return head + ' [cut: ' + bytes(s) + ' bytes]';
}
function note(from, kind, text) {
  logRing.push({ seq: ++logSeq, at: new Date().toISOString(), from: String(from || ''), kind: kind, text: clip(text, kind === 'result' ? RESULT_SHORT : LOG_TEXT_MAX) });
  let total = logRing.reduce(function (s, e) { return s + bytes(JSON.stringify(e)); }, 0);
  while (logRing.length > 1 && total > LOG_BYTES) total -= bytes(JSON.stringify(logRing.shift()));
  publishState();
}

// ── THE MODEL: one OpenAI chat completion, WITH THE NODE'S TOOLS (goal/G14.6) ──
//
//   Andy, 2026-10-10: "now we want a tool that expands Levant's knowledge, our proxy internet call....". The tools
//   come from the node's own description of its verbs (tools.js: describe), the first being net.fetch; the model
//   calls one, this runs it through the node (tools.js: run) and asks the model again with the result, for as long as
//   the prompt has room, then the model's last text is the answer. Nothing hand-written here about any tool.
// ROUNDS BOUNDED BY THE CONTEXT, NOT A COUNT (goal/G23.4). Andy: rounds "tied to the context, and if no context is
// specified, no limit either. like in unsloth studio that manages the context automatically." The old cap of three
// rounds was a guard from the small local models, never ruled. Abort is the brake.
function toolRoom() { return contextKnown() ? Math.floor(promptRoom() / 4) : Infinity; }
// THE ROUTES (goal/G14.7): net through the node's loopback door; the desk through this node's deskClient, the verb
// bare and the family under AGENTS, as a process server lists it. The desk's answer comes back as the asked body;
// a refusal of the desk (not granted, no such item, a rule) is a body with ok false, which run hands to the model
// in the desk's words. Andy: "Levant is restricted by the tools we give him": what has no verb file is no tool.
// THE NAMESPACES (goal/G14.8): net no longer. Andy, 2026-10-10: "net_fetch will be removed for Levant." A tool
// configurator in deskAgentRemote is a later item, and this list is its seed.
// AND deskAgent's own (goal/G10.8): its file and git verbs, rooted at its clone, listed by its own introspection and
// asked through its node as any caller asks them, so the fence below holds for the model as for everyone.
// ONE ROOT (goal/G23.5): the node's fs tools left his list. They were rooted at spirit/run and his own file verbs at
// the repo root of his clone, so a path his search gave him failed when he read it. Andy: "give him everything." and
// "Levant should have the same rules as you". Every file tool is deskAgent's own, in repository paths.
// NET IS BACK (goal/G29.20). Andy, 2026-10-18, reversing goal/G19.9: "fetch will not be able to reach ports on this
// machine, and agents may use it." net.fetch refuses this machine (js/netFence.js), so the reason it left is gone.
const TOOL_NAMESPACES = ['desk', 'deskAgent', 'net'];
// NOTHING RUNS ON THE DESK WHILE HE IS DISCONNECTED (goal/G18.9). Found in the record on 2026-10-12: his signoff
// reached the desk, and an answer already in flight went on writing (two check.set, a chat.add, item.status,
// item.files.add), each write making him live again for ten minutes. So a desk or deskAgent tool asked while he is
// disconnected is refused, and the model is told so. The tools' descriptions (AGENTS...) are still read: the test
// describes them after it disconnects him, and a description writes nothing.
// HIS FILE READS STAY (goal/G23.5, G18.9): they reach no desk, so file.load (and file.search) are answered while he is
// disconnected, as the node's fs reads were before his file tools became his own; file.save, commit and push stay
// refused.
const READS_OFF_THE_DESK = ['file.load', 'file.search'];
// The tools' descriptions are still read while disconnected: the family folder's FS reads (goal/G30.4), never a write.
const FS_READS = /^FS\.(loadFile|loadJsonValue|search|statFile|fileExists)$/;
function offTheDesk(verb) {
  const body = { ok: false, code: 'not-offered', error: 'disconnected', extra: { why: PERSONA + ' is disconnected from the desk, so ' + verb + ' is not run' } };
  return { status: 400, body: body, text: JSON.stringify(body) };
}
const tools = require('./tools').createTools({
  routes: {
    desk: {
      ask: function (verb, args) {
        if (!connected && !FS_READS.test(String(verb))) return Promise.resolve(offTheDesk(verb));
        return askNode({ deskClient: { desk: { verb: String(verb), json: JSON.stringify(args || {}) } } })
          .then(function (body) { return { status: body && body.ok === false ? 400 : 200, body: body, text: JSON.stringify(body) }; });
      },
      verb: function (stem) { return stem; },
      fs: function (name) { return 'FS.' + name; },
    },
    deskAgent: {
      ask: function (verb, args) {
        if (!connected && !FS_READS.test(String(verb)) && READS_OFF_THE_DESK.indexOf(String(verb)) === -1) return Promise.resolve(offTheDesk(verb));
        const one = {}; one[String(verb)] = args || {};
        return spirit.core.ask('jobs.api', { ask: { deskAgent: one } }, NODE_URL).then(function (r) {
          const body = (r && r.body) || {};
          return { status: (r && r.status) || 200, body: body, text: JSON.stringify(body) };
        });
      },
      verb: function (stem) { return stem; },
      fs: function (name) { return 'FS.' + name; },
    },
  },
  room: toolRoom,
});
// DESCRIBED ONCE A WHILE, NOT FOR EVERY ANSWER (goal/G19.7): every desk change was an answer, and every answer asked
// each namespace's introspection and every verb file again. The list is kept TOOLS_KEEP_MS, so a verb file added or
// changed is in the answers from a minute later at the latest.
const TOOLS_KEEP_MS = 60 * 1000;
let described = null;   // { at, list }
function describeAll() {
  if (described && Date.now() - described.at < TOOLS_KEEP_MS) return Promise.resolve(described.list);
  return TOOL_NAMESPACES.reduce(function (chain, ns) {
    return chain.then(function (list) {
      return tools.describe(ns).then(function (more) { return list.concat(more); }, function () { return list; });
    });
  }, Promise.resolve([])).then(function (list) {
    // An empty list is not kept: the node may not have answered yet.
    described = list.length ? { at: Date.now(), list: list } : null;
    return list;
  });
}
// WHAT deskAgent DOES FOR THE MODEL, said in every call beside the rules: its final text is posted under the item
// it was addressed in, so a chat.add tool is for another item or an extra line, never its answer again.
// AND HOW A TOOL IS CALLED (goal/G21.5): only as a real tool call. A call written out as text in the answer is not
// run and not posted; see SPELLED below.
const TOOLS_NOTE = 'Your tools are the verbs described to you, named namespace_verb. Call a tool only as a real tool call; never write a call out as text in your answer, it is not run. Your final answer to the line you were addressed in is posted under that item for you; use desk_chat_add only for another item or an extra line, never to repeat your answer.';

function argumentsOf(call) {
  try { const a = JSON.parse(String((call && call.function && call.function.arguments) || '{}')); return a && typeof a === 'object' ? a : {}; } catch (e) { return {}; }
}

// DESIGN MODE WITHHOLDS THE WRITE TOOLS (goal/G27.6 R3, R5; Andy 2026-10-16). The goal's design flag is read from the
// desk's goal rows when the answer is made, so the tool set follows the goal's state, not a push. A write tool is
// file.save, file.edit, commit and push; while any current goal is in design, or the desk cannot say, none of them is given.
const WRITE_TOOLS = ['deskAgent_file_save', 'deskAgent_file_edit', 'deskAgent_commit', 'deskAgent_push'];
function designNow() {
  return askNode({ deskClient: { desk: { verb: 'items.search', json: JSON.stringify({ text: '', currentGoalOnly: true, goalsOnly: true, includeClosed: false }) } } })
    .then(function (r) {
      const items = (r && r.items) || [];
      return items.some(function (p) { try { return JSON.parse(p.label).design === true; } catch (e) { return false; } });
    }, function () { return true; });
}

// `flight` is the answer in the making (takeOff), so abort reaches every round of it and the log names whom it is for.
function askModel(messages, flight, onTool) {
  return Promise.all([describeAll(), designNow()]).then(function (both) {
    const list = both[1] ? both[0].filter(function (t) { return WRITE_TOOLS.indexOf(t && t.function && t.function.name) === -1; }) : both[0];
    const all = messages.slice();
    // The note rides with the rules, in the system message, only when there is a tool to speak of.
    if (list.length && all.length && all[0].role === 'system') all[0] = { role: 'system', content: String(all[0].content || '') + '\n\n' + TOOLS_NOTE };
    return askModelRound(all, list, 0, flight, onTool);
  });
}
// THE NOTE'S BYTES, kept out of the window the call is built with, since it joins the system message after.
const TOOLS_NOTE_BYTES = bytes('\n\n' + TOOLS_NOTE);

// TOOL RESULTS COUNTED AGAINST THE PROMPT ROOM (goal/G19.7). Each result was cut to a quarter of the room and never
// counted, so three rounds of two results each overflowed it. Now a result is cut to what is left of the room after
// every message already in the call, less ROOM_RESERVE for the notes this loop may still add, and a result that finds
// no room is replaced by a note that says so.
const ROOM_RESERVE = 256;
function messageBytes(m) { return bytes(m.content || '') + (m.tool_calls ? bytes(JSON.stringify(m.tool_calls)) : 0); }
function roomLeft(messages) {
  if (!contextKnown()) return Infinity; // goal/G23.4: no context known, nothing is cut for room
  return promptRoom() - ROOM_RESERVE - messages.reduce(function (s, m) { return s + messageBytes(m); }, 0);
}
const ROOM_MIN = 96;
function resultRoom(messages) { return Math.min(toolRoom(), roomLeft(messages)); }
function fitResult(name, text, room, messages) {
  if (room > ROOM_MIN && bytes(text) <= room) return text;
  // The note that says so is counted too: what is left of the room, the budget's note kept free.
  const free = roomLeft(messages) + ROOM_RESERVE - bytes(BUDGET_SPENT);
  const said = '[no room left in the prompt: the result of ' + name + ' is dropped]';
  if (bytes(said) <= free) return said;
  return bytes('[dropped]') <= free ? '[dropped]' : '';
}
function lastWords(messages) {
  const last = messages[messages.length - 1];
  return last ? String(last.content || '') : '';
}

// THE LAST WORD IS THE MODEL'S, NOT A PLACEHOLDER (found live by Andy, 2026-10-10: Levant fetched sources three
// rounds long and the answer read "the model kept asking for tools after 3 rounds and said nothing"). When the
// room is spent (goal/G23.4: a known context with no room left for a result) and the model still asks for a tool, it
// is asked once more WITHOUT tools and told the budget is spent, so it answers with what it has read; only if that too
// says nothing does the placeholder stand.
function roomSpent(messages) { return roomLeft(messages) <= ROOM_MIN; }
const BUDGET_SPENT = '(the tool budget of this answer is spent: answer now with what you have read)';
// A TOOL CALL WRITTEN AS TEXT (goal/G21.5, Andy's box): seen live 2026-10-13, Levant ending its answer with a
// desk_chat_add call spelled in tags, which went into chat while nothing it claimed was done. Such text is never
// posted: the model is asked again once, told so, and if it spells a call again the answer is SPELLED_ANSWER.
// deskAgent is no adapter for formats (his ruling): the tags are only recognized, never parsed or run.
const SPELLED_CALL = /<\/?tool_call>|<function=|<parameter=/;
const SPELLED_AGAIN = '(your answer wrote a tool call out as text; it was not run and will not be posted. Make it as a real tool call, or answer in plain words)';
const SPELLED_ANSWER = '(the model wrote a tool call as text instead of calling it, twice; nothing was run and its text is not posted)';

// THE ANSWER'S LENGTH, AS THE SERVER NAMES IT (goal/G18.7). OpenAI refuses max_tokens (found live, 2026-10-12:
// "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens'"); the studio
// reads max_tokens. So a plain OpenAI pair is sent max_completion_tokens, and every other one max_tokens.
function withAnswerTokens(body) {
  const have = readKnown();
  if (have && have.studio === false) body.max_completion_tokens = ANSWER_TOKENS;
  else body.max_tokens = ANSWER_TOKENS;
  return body;
}
// THE REASONING MARK, LEARNED (goal/G18.7). Andy: "yes add reasoning."; OpenAI reports no capabilities, so a model is
// marked reasoning once an answer of it counts reasoning tokens. Only on a plain pair: the studio says it itself.
function learnReasoning(model, got) {
  const used = Number(got && got.usage && got.usage.completion_tokens_details && got.usage.completion_tokens_details.reasoning_tokens) || 0;
  const have = readKnown();
  if (!used || !have || have.studio !== false) return;
  const entry = have.models.filter(function (m) { return m && m.id === model; })[0];
  if (!entry || entry.reasoning === true) return;
  writeKnown(Object.assign({}, have, { models: have.models.map(function (m) { return m.id === model ? Object.assign({}, m, { reasoning: true }) : m; }) }));
  say(model + ' counted ' + used + ' reasoning tokens: marked reasoning');
  publishState();
}

function askModelRound(messages, list, round, flight, onTool) {
  if (flight.aborted) return Promise.reject(abortedError());
  const body = withEffort(withAnswerTokens({ model: MODEL, messages: messages }));
  if (list.length) body.tools = list;
  note(flight.from, 'request', 'to ' + (MODEL || '(no model)') + ', round ' + (round + 1) + ': ' + messages.length + ' messages, ' +
    messages.reduce(function (s, m) { return s + messageBytes(m); }, 0) + ' bytes, ' + list.length + ' tools; the last: ' + lastWords(messages));
  // NO TIMEOUT HERE, BY HIS DECISION (goal/G19.7): only abort ends the model's answer.
  return studio('POST', '/v1/chat/completions', body, undefined, undefined, flight).then(function (got) {
    learnReasoning(body.model, got);
    const choice = got && Array.isArray(got.choices) ? got.choices[0] : null;
    const message = choice && choice.message ? choice.message : null;
    const calls = message && Array.isArray(message.tool_calls) ? message.tool_calls : [];
    if (message && String(message.content || '')) note(flight.from, 'reply', String(message.content));
    if (calls.length && list.length && roomSpent(messages)) {
      note(flight.from, 'reply', 'asked for ' + calls.length + ' more tool call(s) with the budget spent: asked once more, without tools');
      messages.push({ role: 'user', content: BUDGET_SPENT });
      return askModelRound(messages, [], round + 1, flight, onTool);
    }
    if (calls.length && list.length) {
      messages.push({ role: 'assistant', content: String(message.content || ''), tool_calls: calls });
      return calls.reduce(function (chain, call) {
        return chain.then(function () {
          if (flight.aborted) throw abortedError();
          const name = String((call.function && call.function.name) || '');
          // What the tool works on, for the Remote's chat line: a url (net), else a path (fs, goal/G14.8).
          const given = argumentsOf(call);
          const url = String(given.url || given.path || '');
          note(flight.from, 'tool', name + ' ' + String((call.function && call.function.arguments) || '{}'));
          if (onTool) onTool({ name: name, url: url, done: false });
          // The room is taken before the tool runs: a tool that writes runs even when its result will not fit.
          const room = resultRoom(messages);
          // goal/G24.2: a chat post under the item this turn answers takes the line first, once per turn (takeOnce).
          const here = name === 'desk_chat_add' && String(given.id || '') === flight.from;
          return (here ? takeOnce(flight) : Promise.resolve()).then(function () {
            return tools.run(call, room > ROOM_MIN ? room : undefined);
          }).then(function (r) {
            note(flight.from, 'result', name + ': ' + r.text);
            // goal/G24.2: an accepted chat post under the item this turn answers is the turn's answer.
            if (here && !/^the node refused/.test(String(r.text))) flight.postedHere = true;
            messages.push({ role: 'tool', tool_call_id: r.id, content: fitResult(name, r.text, room, messages) });
            if (onTool) onTool({ name: name, url: url, done: true });
          });
        });
      }, Promise.resolve()).then(function () { return askModelRound(messages, list, round + 1, flight, onTool); });
    }
    const content = message ? String(message.content || '') : '';
    if (!content) {
      if (calls.length && !messages.some(function (m) { return m.content === BUDGET_SPENT; })) return '(the model asked for a tool though none was offered, and said nothing)';
      if (calls.length) return '(the model kept asking for tools after ' + round + ' rounds, the room spent, and said nothing)';
      throw new Error('the model answered nothing');
    }
    if (SPELLED_CALL.test(content)) {
      if (flight.spelled) { note(flight.from, 'reply', 'a tool call written as text again: not posted'); return SPELLED_ANSWER; }
      flight.spelled = true;
      note(flight.from, 'reply', 'a tool call written as text: not run, not posted; asked again');
      messages.push({ role: 'assistant', content: content });
      messages.push({ role: 'user', content: SPELLED_AGAIN });
      return askModelRound(messages, list, round + 1, flight, onTool);
    }
    // A REPLY CUT AT THE LENGTH LIMIT IS SAID SO (goal/G27.8, design C): "marked truncated in the chat or box text,
    // never sent silently as if complete".
    if (choice && choice.finish_reason === 'length') return content + TRUNCATED_MARK;
    return content;
  }, function (e) {
    // A REFUSAL FOR SIZE IS LEARNED AND ASKED AGAIN ONCE (goal/G27.15, R2 and R3). Andy, 2026-10-17: "the studio has
    // 400 error messages that name two number, the limit and the size supplied that exceeds the limit, if thos can be
    // mechanically extracted, then the lower number represents the limit". Any other refusal, or a second one, fails
    // the turn as before (R4).
    if (flight.sizeRetried || !learnFromRefusal(e, messages, body.model)) throw e;
    flight.sizeRetried = true;
    cutToFit(messages);
    note(flight.from, 'reply', 'refused for size: learned the limit and bytes per token, asked again with the oldest lines cut');
    return askModelRound(messages, list, round, flight, onTool);
  });
}
// What a 400 naming two numbers teaches (goal/G27.15, R2): the lower is the limit, the higher the tokens supplied; the
// bytes deskAgent counted for the prompt over those tokens is this model's bytes per token. Both kept on the model's
// entry in the pair in use's list (models.json). A refusal naming fewer than two numbers teaches nothing: false.
function learnFromRefusal(e, messages, model) {
  if (!e || e.status !== 400) return false;
  const numbers = (String(e.raw || '').match(/\d+/g) || []).map(Number).filter(function (n) { return n >= 16; });
  const distinct = numbers.filter(function (n, i) { return numbers.indexOf(n) === i; });
  if (distinct.length < 2) return false;
  const limit = Math.min.apply(null, distinct);
  const supplied = Math.max.apply(null, distinct);
  const sent = messages.reduce(function (sum, m) { return sum + messageBytes(m); }, 0);
  if (!(supplied > 0) || !(sent > 0)) return false;
  const have = readKnown();
  if (!have || !Array.isArray(have.models)) return false;
  const id = String(model || MODEL);
  let hit = false;
  const list = have.models.map(function (m) {
    if (!m || m.id !== id) return m;
    hit = true;
    return Object.assign({}, m, { learnedContext: limit, bytesPerToken: Math.round((sent / supplied) * 100) / 100 });
  });
  if (!hit) return false;
  writeKnown(Object.assign({}, have, { models: list }));
  say(id + ' was refused for size: learned limit ' + limit + ' and ' + (Math.round((sent / supplied) * 100) / 100) + ' bytes per token');
  return true;
}
// THE RETRY'S CUT (R3): the oldest messages after the system message go first, a tool result left without its call
// with them, until the prompt fits the room now learned; the newest message always stays.
function cutToFit(messages) {
  const room = promptRoom() - ROOM_RESERVE;
  const total = function () { return messages.reduce(function (sum, m) { return sum + messageBytes(m); }, 0); };
  const first = messages.length && messages[0].role === 'system' ? 1 : 0;
  while (total() > room && messages.length - first > 1) {
    messages.splice(first, 1);
    while (messages.length - first > 1 && messages[first].role === 'tool') messages.splice(first, 1);
  }
}

const TRUNCATED_MARK = ' [truncated: the answer reached its length limit]';

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
const LIST_WAIT_MS = 5000;

// THE KNOWN LIST IS THE CACHE, AND THE ANSWER (Andy, 2026-10-10: "deskAgent should cache the model list with all
// capabilities, you'll be able to show more info earlier, and more info from cache, for not-loaded models.", then
// "deskUnloth should REALLY cache the know list....", and "deskUnloth must respond to all queries immediately").
// models.json in the state folder holds the last list as it was answered: every model with its quant, size, task,
// vision, and the reasoning and audio flags learned while it was the loaded one. A models ask is answered FROM THE
// FILE AT ONCE, and a refresh from the studio runs behind it (one at a time): the next ask has what the studio said.
// Only the very first ask, with no file yet, waits for the studio. The studio says reasoning and audio only of the
// loaded model and the quant only when v1/models is quick, so a refresh keeps what was known where the studio is
// silent this time. Vision is the studio's, for every model ("then show vision always").
const MODELS_FILE = 'models.json';
// ONE KNOWN LIST PER PAIR (goal/G18.6): Andy asked whether the available-models list "must be kept by account as well",
// answered yes. models.json is {pairs: {<name>: {active, activeQuant, studio, models}}}; an old file, one list, is read
// as the studio pair's, so stored data stays readable.
let knownAll = null;    // the whole file, or null before it is read
let refreshing = null;  // the one refresh in flight
// THE CACHED FLAG (Andy, 2026-10-10: "the list should return with a cached flag, so the remote can forbid loading
// until.... unsloth-studio crashed again."): an answer is `cached` until a refresh from the studio has landed
// within FRESH_MS, so the remote offers Load only when the studio has just been heard from. A list from the file
// with the studio down is still a list, and says so.
const FRESH_MS = 10000;
let refreshedAt = 0;

function readKnownAll() {
  if (knownAll) return knownAll;
  let raw = null;
  try { raw = JSON.parse(fs.readFileSync(path.join(STATE, MODELS_FILE), 'utf8')); } catch (e) { raw = null; }
  if (raw && raw.pairs && typeof raw.pairs === 'object' && !Array.isArray(raw.pairs)) knownAll = raw;
  else if (raw && Array.isArray(raw.models)) { knownAll = { pairs: {} }; knownAll.pairs[LEGACY_PAIR] = raw; }
  else knownAll = { pairs: {} };
  return knownAll;
}
// The list of the pair named, the pair in use when no name is given; null when it has none yet.
function readKnown(name) {
  const k = readKnownAll().pairs[name === undefined ? String(CONNECTION.name || '') : name];
  return k && Array.isArray(k.models) ? k : null;
}
function writeKnown(next, name) {
  const all = readKnownAll();
  all.pairs[name === undefined ? String(CONNECTION.name || '') : name] = next;
  try { fs.writeFileSync(path.join(STATE, MODELS_FILE), JSON.stringify(all, null, 2) + '\n'); } catch (e) { say('models.json could not be written: ' + e.message); }
}

// ONE ENTRY PER MODEL AND QUANTIZATION (goal/G10.9). Andy, 2026-10-12: "we need to offer a precise selection of
// models, that includes the quantization/flavor as well?", and of which: "yes. i'll download extra flavors manually,
// if needed." So the downloaded variants of every cached model, read from api/models/gguf-variants (0.65 s live), one
// ask per cached model, one after another; the cost, stated (rule/5): one more studio call per cached model on every
// refresh. A model whose variants cannot be read keeps one entry, its quant from v1/models as before. The loaded pair
// is the status's active_model and gguf_variant. The 🧵 mark (recommended) and when it was tested are kept from the
// known list: only model.test writes them.
function pairKey(id, quant) { return String(id) + '\n' + String(quant || ''); }
function variantsOf(id, conn) {
  return studio('GET', '/api/models/gguf-variants?repo_id=' + encodeURIComponent(id) + '&prefer_local_cache=true', undefined, QUANT_WAIT_MS, conn)
    .then(function (v) { return (Array.isArray(v && v.variants) ? v.variants : []).filter(function (x) { return x && x.downloaded === true && x.quant; }); }, function () { return null; });
}
// A PLAIN OPENAI SERVER (goal/G18.6) answers api/models/cached-gguf with a 404: it has no studio routes, so its list is
// its v1/models, one entry per id with no quantization, and the loaded one is the model chosen on the pair. Andy: "the
// OpenAI caveats are noted. and accepted."
const PLAIN = {};
function plainList(conn, name, got) {
  const was = {};
  ((readKnown(name) || {}).models || []).forEach(function (m) { if (m && m.id) was[m.id] = m; });
  const chosen = String(conn.model || '');
  const list = (Array.isArray(got && got.data) ? got.data : []).filter(function (m) { return m && m.id; }).map(function (m) {
    const id = String(m.id);
    const w = was[id] || {};
    const entry = { id: id, quant: '', loaded: id === chosen, bytes: 0, task: '', vision: false, reasoning: w.reasoning === true, audio: w.audio === true, recommended: w.recommended === true, tested: String(w.tested || '') };
    // What a refusal taught it (goal/G27.15) is kept through a refresh, as its marks are.
    if (Number(w.learnedContext) > 0) { entry.learnedContext = Number(w.learnedContext); entry.bytesPerToken = Number(w.bytesPerToken) || 0; }
    // The model's context as the server names it (goal/G14.11): max_input_tokens, or context_length; else none.
    const context = Number(m.max_input_tokens) > 0 ? Number(m.max_input_tokens) : Number(m.context_length) > 0 ? Number(m.context_length) : 0;
    if (context) entry.context = context;
    return entry;
  });
  return { active: chosen, activeQuant: '', studio: false, models: list };
}
// The pair asked is the one in use when the refresh starts; the list is that pair's.
function fetchModels(conn, name) {
  const nothing = function () { return {}; };
  const notStudio = function (e) { if (e && e.status === 404) return PLAIN; throw e; };
  // TIMEOUTS ON THE MODEL-LIST READS (goal/G19.7): a cached-gguf or a status that never answered held the one refresh
  // forever, and no list was read again until a restart. Only these reads time out, never the model's answer.
  return Promise.all([studio('GET', '/api/models/cached-gguf', undefined, LIST_WAIT_MS, conn).catch(notStudio), studio('GET', '/v1/models', undefined, QUANT_WAIT_MS, conn).catch(nothing), studio('GET', '/api/inference/status', undefined, LIST_WAIT_MS, conn).catch(nothing)])
    .then(function (got) {
      if (got[0] === PLAIN) return plainList(conn, name, got[1]);
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
      ((readKnown(name) || {}).models || []).forEach(function (m) { if (m && m.id) { was[pairKey(m.id, m.quant)] = m; wasById[m.id] = m; } });
      const list = [];
      return cached.reduce(function (chain, c) {
        return chain.then(function () {
          const id = String(c.repo_id || '');
          const k = byId[id] || {};
          return variantsOf(id, conn).then(function (variants) {
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
                // What a refusal taught it (goal/G27.15), kept through a refresh.
                learnedContext: Number(w.learnedContext) || 0,
                bytesPerToken: Number(w.bytesPerToken) || 0,
              });
            });
          });
        });
      }, Promise.resolve()).then(function () {
        // A status without gguf_variant and a late v1/models: the loaded entry's quant, as the list knows it.
        const loadedOne = list.filter(function (m) { return m.id === active && m.loaded; })[0];
        return { active: active, activeQuant: activeQuant || (loadedOne ? loadedOne.quant : ''), studio: true, models: list };
      });
    });
}

function refreshModels() {
  if (refreshing) return refreshing;
  const conn = CONNECTION;
  const name = String(conn.name || '');
  const mine = refreshing = fetchModels(conn, name).then(function (next) {
    if (refreshing === mine) refreshing = null;
    writeKnown(next, name);
    // A refresh that lands after a switch fills its own pair's list and says nothing of the pair now in use.
    if (conn === CONNECTION) { refreshedAt = Date.now(); publishState(); }
    return next;
  }, function (e) {
    if (refreshing === mine) refreshing = null;
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
  }, function (e) { throw refused('the studio\'s model list could not be read: ' + String((e && e.message) || e)); });
}

// ── ONE STATE, PUBLISHED ON EVERY CHANGE (goal/G14.5) ─────────────────
//
//   Andy, 2026-10-10: "so deskAgent keeps a state, and publishes changes, it's own api are more like
//   event-delivery to deskAgent".
//
// The state is what state, models and chat.answer answer, in one object, published through spirit.core.jobs.publish
// whenever any of it changes: the switch, a load's state, the known list after a refresh, a chat answer. The node
// hands it to the pages on this node and, on a puppet, streams it to the owner (puppetStream.js); the Remote
// draws from it and asks nothing. The read verbs stay for a one-shot ask.
// THE CHAT SHOWN is the id of the chat that changed last; its record is its own, in answers (goal/G19.7: one global
// lastChat had a tool of one chat published under another's id).
let chatShown = '';
function chatObject() {
  const a = chatShown ? answers[chatShown] : null;
  if (!a) return { id: '', done: false, text: '', tool: { name: '', url: '', done: true } };
  return { id: chatShown, done: a.done, text: a.text, tool: { name: a.tool.name, url: a.tool.url, done: a.tool.done } };
}
function stateObject() {
  const have = readKnown() || { active: '', models: [] };
  return {
    connected: connected,
    persona: PERSONA,
    model: MODEL,
    server: { url: server.url, answers: server.answers, error: server.error },
    // The pairs by name and url, the one in use marked (goal/G18.6); never a key, the state goes to every page.
    connections: connectionsNow(),
    active: String(have.active || ''),
    activeQuant: String(have.activeQuant || ''),
    cached: !(refreshedAt && Date.now() - refreshedAt < FRESH_MS),
    load: { model: load.model, state: load.state, error: load.error },
    test: testNow(),
    // The effort for the model in use (goal/G27.8): whether a row applies, and its level.
    effort: effortNow(),
    // NO MODEL LIST IN THE STATE (goal/G27.17, R1): with OpenAI's list it outgrew one publish and one tunnelled packet
    // ("puppet stream: process/js/deskAgent not posted: too big to tunnel"). Only the loaded entry travels here; the
    // picker asks models.search.
    loaded: loadedEntryOf(have),
    // The tool in flight, if any (goal/G14.6), so the chat box can show the fetch.
    chat: chatObject(),
    // Whether the model is answering anything now, so the Remote's Abort is alive (goal/G19.7).
    working: flights.size > 0,
    // The newest entries of the test tab's log (goal/G19.7).
    log: logRing.slice(),
  };
}
// The loaded model's entry, or null: the one marked loaded, else the active one.
function loadedEntryOf(have) {
  const list = have && Array.isArray(have.models) ? have.models : [];
  return list.filter(function (m) { return m && m.loaded; })[0] || list.filter(function (m) { return m && m.id === have.active; })[0] || null;
}

// ── THE MODELS, AS A BOUNDED SEARCH (goal/G27.17) ─────────────────────
//
//   Andy, 2026-10-17: "populate the model selector using search always", and "lets stick to the search as you specified
//   it, with the loaded model always being part of the result." The box: a bounded bucket with a partial flag (more);
//   the loaded model always in it; the marks present in the whole list named, so the Remote offers only the filters
//   that apply; and the answer fits one tunnelled reply. The cost, stated (rule/5): one ask per keystroke.
// What one answer of this door may carry (appClient ANSWER_MAX), less room for its envelope: tighter than a tunnelled
// reply, so it fits both.
const SEARCH_ROOM = require('../../../js/appClient').ANSWER_MAX - 1024;
const MARKS = {
  'desk-tested': function (m) { return m.recommended === true; },
  vision: function (m) { return m.vision === true; },
  reasoning: function (m) { return m.reasoning === true; },
  audio: function (m) { return m.audio === true; },
};
// THE STANDARD SEARCH (Andy, 2026-10-17: "i sure hope you're useing probability search..."): since goal/G29.21 the
// probability modules, each model ranked by how well its id and quant match the text, newest-listed first among equals,
// and cut in bytes. The marks pressed are an exact filter on the walk. THE LOADED MODEL GOES INTO THE BUCKET FIRST, AT
// PROBABILITY 1 (Andy, 2026-10-17: "the loaded model just get's thrown into the bucket first, with a probability of
// 1.0"): seated first, nothing seats above it.
const createProbabilityBucket = require('../../../js/probabilityBucket.js').createProbabilityBucket;
const probabilityStringObjectMatch = require('../../../js/probabilityStringObjectMatch.js').probabilityStringObjectMatch;
function modelsSearch(text, marks) {
  const wanted = (Array.isArray(marks) ? marks : []).map(String).filter(function (k) { return MARKS[k]; });
  return Promise.resolve(models()).then(function (m) {
    const all = Array.isArray(m.models) ? m.models : [];
    const present = Object.keys(MARKS).filter(function (k) { return all.some(MARKS[k]); });
    const loaded = all.filter(function (x) { return x && x.loaded; });
    const answer = { models: [], more: false, marks: present, active: m.active, activeQuant: m.activeQuant, cached: m.cached, load: m.load, test: m.test };
    // An empty search is every model, in the studio's order: every probability 0.
    const query = String(text || '').trim();
    const room = SEARCH_ROOM - Buffer.byteLength(JSON.stringify(answer), 'utf8');
    const bucket = createProbabilityBucket(Infinity);
    loaded.forEach(function (x) { bucket.seatFor(1, x); });
    for (let i = 0; i < all.length; i++) {
      const x = all[i];
      if (!x || x.loaded || !x.id) continue;
      if (!wanted.every(function (k) { return MARKS[k](x); })) continue;
      bucket.seatFor(query ? probabilityStringObjectMatch(query, { id: String(x.id), quant: String(x.quant || '') }) : 0, x);
    }
    const got = room > 0 ? bucket.serialize(null, room) : { items: [], more: all.length > 0 };
    answer.models = got.items;
    answer.more = !!got.more;
    return answer;
  });
}
function publishState() {
  appServer.spirit.core.jobs.publish(stateObject());
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
  // THE MODEL IS THE PAIR'S (goal/G18.6): kept on the pair in use, so a switch back finds it.
  if (CONNECTION.name) { CONNECTION.model = id; writeConnections(); }
  // A PLAIN OPENAI SERVER HAS NOTHING TO LOAD: the model is named per call, so choosing it is the whole of it.
  const have = readKnown();
  if (have && have.studio === false) {
    load = { model: id, state: 'done', error: '' };
    writeKnown(Object.assign({}, have, { active: id, activeQuant: '', models: have.models.map(function (m) { return Object.assign({}, m, { loaded: m.id === id }); }) }));
    say(id + ' is the model from now on; a plain OpenAI server loads nothing');
    publishState();
    return Promise.resolve();
  }
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
  // LEVANT OFF THE DESK FIRST (goal/G10.9). Andy, 2026-10-12: "the test button should disconnect Levant from desk
  // before testing". The same disconnect as the switch's: the asks stop and one signoff goes to the desk.
  if (connected) setConnected(false).catch(function () { /* said by setConnected */ });
  testing = { id: id, quant: String(quant || ''), state: 'running', why: '' };
  publishState();
  const p = loadedPair();
  const ready = p.id === id && p.quant === String(quant || '') ? Promise.resolve() : loadModel(id, quant);
  ready.then(function () { return refreshModels(); }).then(function () {
    return describeAll().then(function (list) {
      if (!list.length) throw new Error('no tools described to test with');
      // The test's call is the model at work too: abort reaches it and the test tab logs it (goal/G19.7).
      const flight = takeOff('test');
      note('test', 'request', 'to ' + id + (quant ? ' ' + quant : '') + ', ' + list.length + ' tools: ' + TEST_PROMPT);
      return studio('POST', '/v1/chat/completions', withEffort(withAnswerTokens({ model: id, messages: [{ role: 'system', content: PREAMBLE }, { role: 'user', content: TEST_PROMPT }], tools: list })), undefined, undefined, flight)
        .then(function (got) { land(flight); return got; }, function (e) { land(flight); throw e; });
    });
  }).then(function (got) {
    learnReasoning(id, got);
    const message = got && Array.isArray(got.choices) && got.choices[0] ? got.choices[0].message : null;
    const calls = message && Array.isArray(message.tool_calls) ? message.tool_calls.filter(function (c) { return c && c.function && c.function.name; }) : [];
    note('test', 'reply', calls.length ? 'tool call ' + calls[0].function.name + ' ' + String(calls[0].function.arguments || '{}') : String((message && message.content) || '(nothing)'));
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
      method: 'GET', headers: pairHeaders(CONNECTION),
    }, function (res) { res.resume(); resolve({ ok: true, error: '' }); });
    req.on('error', function (e) { resolve({ ok: false, error: String((e && e.message) || e) }); });
    req.setTimeout(PROBE_MS, function () { req.destroy(new Error('no answer within ' + PROBE_MS + ' ms')); });
    req.end();
  });
}
// THE PAIRS KEPT FROM THE CONNECT TAB (goal/G18.6): connection.set {name, url, key} adds the pair, or replaces the one
// of that name, and uses it, as a set always did; connection.use {name} switches; connection.remove {name} takes one
// out, never the one in use. A name is a label (rule/12, js/fieldRules.js).
function nameWhy(name) {
  const fr = require('../../../js/fieldRules.js');
  const p = fr.problem(name);
  if (!p) return '';
  const bytes = fr.byteLength(fr.normalize(name));
  return 'the pair\'s ' + p + (bytes > fr.MAX_BYTES ? ' (' + bytes + ' bytes, the limit is ' + fr.MAX_BYTES + ')' : '');
}
function connectionsNow() { return CONNECTIONS.map(function (p) { return { name: p.name, url: p.url, use: p.use === true }; }); }
function setConnection(name, url, key, workspace) {
  const why = nameWhy(name);
  if (why) throw refused(why);
  const n = require('../../../js/fieldRules.js').normalize(name);
  let p = pairNamed(n);
  if (!p) { p = { name: n, url: '', key: '', use: false, model: '', workspace: '', effort: {} }; CONNECTIONS.push(p); }
  p.url = String(url || '');
  p.key = String(key || '');
  p.workspace = String(workspace || '').trim();
  return usePair(n);
}
function usePair(name) {
  const p = pairNamed(name);
  if (!p) throw refused('no pair is named ' + JSON.stringify(name));
  const switched = p !== CONNECTION;
  CONNECTIONS.forEach(function (x) { x.use = x === p; });
  writeConnections();
  CONNECTION = p;
  STUDIO_URL = studioUrlOf(p);
  MODEL = p.model;
  refreshing = null;
  refreshedAt = 0;
  server = { url: p.url, answers: false, error: '' };
  // A SWITCH DISCONNECTS LEVANT (goal/G18.6, box v4): the model under it changed, so Connect checks the 🧵 again.
  if (switched && connected) setConnected(false).catch(function () { /* said by setConnected */ });
  say('connection.json now uses ' + p.name + ' at ' + p.url);
  publishState();
  refreshModels().catch(function () { /* said by refreshModels; the known list stands */ });
  return probe().then(function (r) {
    serverSeen(r.ok, r.error);
    return { url: p.url, answers: r.ok, error: r.error };
  });
}
function removePair(name) {
  const p = pairNamed(name);
  if (!p) throw refused('no pair is named ' + JSON.stringify(name));
  if (p === CONNECTION) throw refused(name + ' is the pair in use: use another first');
  CONNECTIONS = CONNECTIONS.filter(function (x) { return x !== p; });
  writeConnections();
  const all = readKnownAll();
  if (all.pairs[name]) { delete all.pairs[name]; try { fs.writeFileSync(path.join(STATE, MODELS_FILE), JSON.stringify(all, null, 2) + '\n'); } catch (e) { say('models.json could not be written: ' + e.message); } }
  say('the pair ' + name + ' is removed');
  publishState();
  return { connections: connectionsNow() };
}

// ── THE FILE AND GIT VERBS, FENCED BY THE DESK (goal/G10.8) ────────────
//
//   Andy, 2026-10-12: "Give deskAgent its own file tools, rooted at the checkout.", the fence "only files on the
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
// A FILE OF ANY SIZE, PART BY PART (goal/G23.3): Levant could not read a file bigger than one answer. Andy: "so let
// him read files with a tool that matches yours." With no range the file comes whole, as before, when it fits; with
// offset (the first line, from 1) and/or limit (how many lines) the answer is {path, text, lines, next}: the lines as
// `<n>\t<line>`, the file's line count, and the line to ask for next (0 at the end), cut at the last whole line whose
// whole reply fits one answer. A single line that alone does not fit is refused, saying so: it is never cut in two.
function fileLoad(p, offset, limit) {
  const at = insideClone(p);
  let text = null;
  try { text = fs.readFileSync(at.full, 'utf8'); } catch (e) { throw refused('no such file: ' + at.rel); }
  if (offset === undefined && limit === undefined) {
    if (bytes(text) > LOAD_MAX) throw refused(at.rel + ' is ' + bytes(text) + ' bytes, more than one answer carries (' + LOAD_MAX + '): read it part by part with offset and limit, following next');
    return { path: at.rel, text: text };
  }
  // 0 or left out is the default: from line 1, to the end as far as fits. The model's tool requires every key
  // (tools.js), so a model that wants no range sends 0s.
  const whole = function (n) { return n === undefined || (Number.isInteger(n) && n >= 0); };
  if (!whole(offset)) throw refused('offset is the first line to read, a whole number from 1 (0 for the first)');
  if (!whole(limit)) throw refused('limit is how many lines to read, a whole number (0 for as many as fit)');
  const all = text.split('\n');
  const total = all.length;
  const from = offset ? offset : 1;
  if (from > total) throw refused('offset ' + from + ' is past the last line of ' + at.rel + ' (' + total + ')');
  const end = limit ? Math.min(total, from - 1 + limit) : total;
  const rows = [];
  // What the reply costs without its text, next at its widest; each row adds its escaped bytes and a "\n" (2 escaped).
  let size = bytes(JSON.stringify({ path: at.rel, text: '', lines: total, next: total }));
  for (let n = from; n <= end; n++) {
    const row = n + '\t' + all[n - 1];
    const cost = bytes(JSON.stringify(row)) - 2 + (rows.length ? 2 : 0);
    if (size + cost > LOAD_MAX) break;
    size += cost;
    rows.push(row);
  }
  if (!rows.length) throw refused('line ' + from + ' of ' + at.rel + ' alone is ' + bytes(all[from - 1]) + ' bytes, more than one answer carries (' + LOAD_MAX + ')');
  const last = from + rows.length - 1;
  return { path: at.rel, text: rows.join('\n'), lines: total, next: last >= total ? 0 : last + 1 };
}
// FILE SEARCH AT THE REPO ROOT (goal/G23.6), like cw's Glob and Grep; Andy: "give him everything." pattern is a glob on
// the whole repository path ("**" any folders, "*" within one name, "?" one character; '' every file); text a regular
// expression tried on each line ('' a search by name alone); path the folder to search under ('' the repo root), inside
// the clone. Nothing under .git, at any level. The answer is {files, cut} or {matches: [{path, line, text}], cut}, cut
// at the last whole result that fits one answer, the walk stopped there.
function globRegExp(pattern) {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*' && pattern[i + 1] === '*') {
      if (pattern[i + 2] === '/') { re += '(?:.*/)?'; i += 2; } else { re += '.*'; i += 1; }
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + re + '$');
}
function fileSearch(pattern, text, under) {
  let line = null;
  if (text) { try { line = new RegExp(text); } catch (e) { throw refused('text is no regular expression: ' + e.message); } }
  const glob = pattern ? globRegExp(String(pattern)) : null;
  let start = { rel: '', full: CLONE };
  if (under) {
    start = insideClone(under);
    let isDir = false;
    try { isDir = fs.statSync(start.full).isDirectory(); } catch (e) { isDir = false; }
    if (!isDir) throw refused('no such folder: ' + start.rel);
  }
  const key = line ? 'matches' : 'files';
  const found = [];
  let size = bytes(JSON.stringify({ [key]: [], cut: false }));
  let cut = false;
  function add(item) {
    const cost = bytes(JSON.stringify(item)) + (found.length ? 1 : 0);
    if (size + cost > LOAD_MAX) { cut = true; return false; }
    size += cost;
    found.push(item);
    return true;
  }
  function walk(full, rel) {
    let entries = [];
    try { entries = fs.readdirSync(full, { withFileTypes: true }); } catch (e) { return; }
    entries.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
    for (const d of entries) {
      if (cut) return;
      if (d.name === '.git') continue;
      const r = rel ? rel + '/' + d.name : d.name;
      const f = path.join(full, d.name);
      if (d.isDirectory()) { walk(f, r); continue; }
      if (!d.isFile() || (glob && !glob.test(r))) continue;
      if (!line) { add(r); continue; }
      let body = '';
      try { body = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
      const lines = body.split('\n');
      for (let n = 0; n < lines.length && !cut; n++) {
        const t = lines[n].replace(/\r$/, '');
        if (line.test(t)) add({ path: r, line: n + 1, text: t });
      }
    }
  }
  walk(start.full, start.rel);
  const out = { cut: cut };
  out[key] = found;
  return out;
}
function fileSave(p, content) {
  const at = insideClone(p);
  return fenced(at.rel).then(function () {
    fs.mkdirSync(path.dirname(at.full), { recursive: true });
    fs.writeFileSync(at.full, String(content), 'utf8');
    return { path: at.rel, bytes: bytes(content) };
  });
}
// ONE EXACT PIECE REPLACED (goal/G23.7), like cw's Edit: a whole-file save cannot carry a file bigger than one answer,
// so he could not change big files. Andy: "give him everything." The same fence as file.save; old is matched as bytes,
// exactly (no regular expression), refused when absent or, unless all, found more than once; every other byte of the
// file stays as it was.
function fileEdit(p, oldText, newText, all) {
  const at = insideClone(p);
  if (!String(oldText || '')) return Promise.reject(refused('old is empty: name the exact text to replace'));
  return fenced(at.rel).then(function () {
    let body = null;
    try { body = fs.readFileSync(at.full); } catch (e) { throw refused('no such file: ' + at.rel); }
    const from = Buffer.from(String(oldText), 'utf8');
    const to = Buffer.from(String(newText || ''), 'utf8');
    const at0 = [];
    for (let i = body.indexOf(from); i !== -1; i = body.indexOf(from, i + from.length)) at0.push(i);
    const said = String(oldText).length > 80 ? String(oldText).slice(0, 80) + '...' : String(oldText);
    if (!at0.length) throw refused('the text ' + JSON.stringify(said) + ' is not found in ' + at.rel);
    if (at0.length > 1 && all !== true) throw refused('the text ' + JSON.stringify(said) + ' is found ' + at0.length + ' times in ' + at.rel + ': give more of it to make it unique, or all true');
    const parts = [];
    let last = 0;
    at0.forEach(function (i) { parts.push(body.subarray(last, i), to); last = i + from.length; });
    parts.push(body.subarray(last));
    fs.writeFileSync(at.full, Buffer.concat(parts));
    return { path: at.rel, replaced: at0.length };
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

// ── A COMMAND IN HIS CLONE (goal/G23.8) ───────────────────────────────
//
// Like cw's Bash; Andy: "give him everything." A command runs in his clone's root through a shell found on the machine:
// Git's bash on Windows when it is installed (never System32's bash, which is WSL), /bin/bash elsewhere when there is
// one, else the platform's own shell. His clone is the checkout node 11111 runs from, so a command there can stop or
// break that node: recorded in the box, no guard asked.
// A JOB, because a verb answers within 12 s (appClient DOOR_WAIT_MS): command.run waits up to INLINE_MS for the
// command to end and answers its result, else {id, running: true}, and command.result {id} is asked until it is done.
// The timeout runs on the command (its own process tree killed, timedOut true), never on the answer. The output is
// stdout and stderr as they came, its LAST whole lines that fit one answer (errors land at the end), cut said.
const INLINE_MS = 10000;
const COMMAND_TIMEOUT_DEFAULT = 120000;
const COMMAND_TIMEOUT_MAX = 600000;
const COMMAND_KEEP = 20;            // finished jobs kept for command.result, the oldest forgotten first
const COMMAND_HOLD_BYTES = 4 * LOAD_MAX; // the output's tail held while it runs; what falls off makes it cut
const commandJobs = new Map();
let commandSeq = 0;
function shellOf() {
  if (process.platform === 'win32') {
    const roots = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs')].filter(Boolean);
    for (const r of roots) { const b = path.join(r, 'Git', 'bin', 'bash.exe'); if (fs.existsSync(b)) return b; }
    return '';
  }
  return fs.existsSync('/bin/bash') ? '/bin/bash' : '';
}
function killTree(job) {
  const pid = job.child && job.child.pid;
  if (!pid) return;
  if (process.platform === 'win32') spawn('taskkill', ['/T', '/F', '/PID', String(pid)], { stdio: 'ignore', windowsHide: true });
  else { try { process.kill(-pid, 'SIGKILL'); } catch (e) { try { job.child.kill('SIGKILL'); } catch (e2) { /* gone */ } } }
}
// The last whole lines of the output that fit one answer beside the rest of the reply.
function outputTail(job) {
  const text = job.held;
  const room = LOAD_MAX - bytes(JSON.stringify({ id: job.id, running: true, exit: -1, output: '', cut: true, timedOut: false }));
  const cost = function (s) { return bytes(JSON.stringify(s)) - 2; };
  if (!job.dropped && cost(text) <= room) return { output: text, cut: false };
  const lines = text.split('\n');
  const kept = [];
  let size = 0;
  // The first line held may be a part of one when the head was dropped: it is never kept.
  for (let i = lines.length - 1; i >= (job.dropped ? 1 : 0); i--) {
    const c = cost(lines[i]) + (kept.length ? 2 : 0);
    if (size + c > room) break;
    size += c;
    kept.unshift(lines[i]);
  }
  return { output: kept.join('\n'), cut: true };
}
function commandReply(job) {
  const t = outputTail(job);
  return { id: job.id, running: !job.done, exit: job.done ? job.exit : -1, output: t.output, cut: t.cut, timedOut: job.timedOut };
}
function commandRun(command, timeoutMs) {
  if (!String(command || '').trim()) throw refused('command is empty');
  const limit = Math.min(COMMAND_TIMEOUT_MAX, Number(timeoutMs) > 0 ? Number(timeoutMs) : COMMAND_TIMEOUT_DEFAULT);
  const shell = shellOf();
  const opts = { cwd: CLONE, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, detached: process.platform !== 'win32' };
  const child = shell ? spawn(shell, ['-c', String(command)], opts) : spawn(String(command), Object.assign({ shell: true }, opts));
  const job = { id: 'c' + (++commandSeq) + '-' + Date.now().toString(36), child: child, held: '', dropped: false, done: false, exit: -1, timedOut: false, waiters: [] };
  commandJobs.set(job.id, job);
  const take = function (chunk) {
    job.held += chunk.toString('utf8');
    // In bytes; a character cut in two at the head is in the first line, never kept once dropped.
    if (bytes(job.held) > COMMAND_HOLD_BYTES) { job.held = Buffer.from(job.held, 'utf8').subarray(-COMMAND_HOLD_BYTES).toString('utf8'); job.dropped = true; }
  };
  child.stdout.on('data', take);
  child.stderr.on('data', take);
  const timer = setTimeout(function () { if (!job.done) { job.timedOut = true; killTree(job); } }, limit);
  const finish = function (code) {
    if (job.done) return;
    clearTimeout(timer);
    job.done = true;
    job.exit = typeof code === 'number' ? code : -1;
    job.child = null;
    const finished = Array.from(commandJobs.values()).filter(function (j) { return j.done; });
    while (finished.length > COMMAND_KEEP) commandJobs.delete(finished.shift().id);
    job.waiters.splice(0).forEach(function (w) { w(); });
  };
  child.on('close', finish);
  child.on('error', function (e) { take(Buffer.from(String(e.message || e) + '\n')); finish(-1); });
  say('command ' + job.id + ' (' + (shell || 'the platform shell') + ', ' + limit + ' ms): ' + String(command).slice(0, 200));
  return new Promise(function (resolve) {
    const t = setTimeout(resolve, INLINE_MS);
    job.waiters.push(function () { clearTimeout(t); resolve(); });
  }).then(function () { return commandReply(job); });
}
function commandResult(id) {
  const job = commandJobs.get(String(id || ''));
  if (!job) throw refused('no command ' + JSON.stringify(String(id || '')) + ': unknown, or finished long enough ago to be forgotten');
  return commandReply(job);
}

// ── THE CHAT BOX'S CALLS (goal/G14.4) ──────────────────────────────────
//
//   Andy, 2026-10-10: a chat box "sticky, at the bottom of the window (panel)", "Enter = send, one line only",
//   "the chat will only be shown on the node that hosts deskAgent....".
//
// TWO ASKS, NOT ONE: an ask of this process through jobs.api is answered within DOOR_WAIT_MS, 12 s (appClient.js),
// and a model answer can take longer. So chat.send takes the page's transcript, answers an id at once and asks the
// model; chat.answer {id} says whether it is done and hands the text over. The page keeps the transcript; this keeps
// only the answers in flight, and forgets one ANSWER_KEEP_MS after it is done.
const ANSWER_KEEP_MS = 10 * 60 * 1000;
const answers = Object.create(null);

const NO_TOOL = { name: '', url: '', done: true };
// One chat's record changed: it is the one shown, and the state goes out.
function chatChanged(id, change) {
  answers[id] = Object.assign({}, answers[id], change);
  chatShown = id;
  publishState();
}
function chatSend(lines) {
  const id = require('crypto').randomBytes(8).toString('hex');
  const system = PREAMBLE;
  let room = promptRoom() - TOOLS_NOTE_BYTES - bytes(system);
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
  chatChanged(id, { done: false, text: '', at: Date.now(), tool: NO_TOOL });
  const onTool = function (t) { chatChanged(id, { tool: { name: t.name, url: t.url, done: t.done } }); };
  const flight = takeOff('chat');
  askModel(messages, flight, onTool).then(function (content) {
    land(flight);
    chatChanged(id, { done: true, text: content, at: Date.now(), tool: NO_TOOL });
  }, function (e) {
    land(flight);
    if (!e.aborted) note('chat', 'error', 'the model did not answer: ' + e.message);
    chatChanged(id, { done: true, text: '(the model did not answer: ' + e.message + ')', at: Date.now(), tool: NO_TOOL });
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

// EVERY DESK WRITE IS CHECKED (goal/G23.1). Levant's answer to Andy under goal/G17 vanished: posted without a take,
// the desk's refusal dropped. A refusal comes back as an answer, {ok: false, code, error, extra: {why}}, so it is
// read here, in one place, and goes into his log with the desk's reason; it is never thrown past answerItem, so
// Levant stays free for the next job.
function deskWrite(from, verb, args) {
  return desk(verb, args).then(function (b) {
    if (b && b.ok === false) {
      const why = (b.extra && b.extra.why) || b.error || b.code || 'no reason given';
      say('the desk refused ' + verb + ' for ' + from + ': ' + why);
      note(from, 'error', 'the desk refused ' + verb + ': ' + why);
    }
    return b;
  }, function (e) {
    note(from, 'error', 'the desk could not be asked ' + verb + ': ' + String((e && e.message) || e));
    return { ok: false, error: String((e && e.message) || e) };
  });
}

function post(id, text) {
  // An answer that comes back after a disconnect is said here and nowhere else (goal/G18.9).
  if (!connected) { say('disconnected: the answer for ' + id + ' is not posted'); return Promise.resolve({ dropped: true }); }
  return deskWrite(id, 'chat.add', { id: id, text: text });
}
// TAKE BEFORE ANSWERING (goal/G23.1): every agent takes Andy's latest line under an item before it answers there
// (Andy, 2026-10-12: "no agent should answer without taking"). A refused take is logged and the post goes on: there
// may be no line of his to take, and then the desk decides on the post.
// ONE TURN, ONE ANSWER, TAKEN FIRST (goal/G24.2): the line is taken at the moment of posting, never at the start of the
// turn: a taken line bars every other agent from answering it ("a second answer comes only when Andy names the
// agent"), so a turn that posts nothing must take nothing. The take is made once per turn, by whichever post comes
// first: the model's desk_chat_add under this very item, or the final answer. When the model posted under this item
// with the tool (accepted), that post is the turn's answer and the final text is not posted as well; a tool post under
// another item does not count.
function takeOnce(flight) {
  if (flight.took || !connected) return Promise.resolve();
  flight.took = true;
  return deskWrite(flight.from, 'line.take', { id: flight.from });
}
function postAll(id, texts, flight) {
  return texts.reduce(function (chain, text) {
    return chain.then(function () { return post(id, text); });
  }, flight ? takeOnce(flight) : Promise.resolve());
}

// AN ANSWER THAT FAILS OR IS ABORTED POSTS NOTHING, AND FREES LEVANT AT ONCE (goal/G19.7): it is said, logged,
// and the next one waiting is answered.
function answerItem(job) {
  const id = job.id;
  const flight = takeOff(id);
  return callFor(id, job.changes).then(function (messages) { return askModel(messages, flight); }).then(function (content) {
    land(flight);
    if (flight.aborted) return null;
    if (flight.postedHere) { note(id, 'reply', 'answered with the tool: the final answer is not posted'); return null; }
    return postAll(id, linesOf(content), flight);
  }).catch(function (e) {
    land(flight);
    say('the answer for ' + id + ' failed: ' + e.message);
    if (!e.aborted) note(id, 'error', 'the answer failed: ' + e.message);
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
  const free = function () { working = false; return drain(); };
  return answerItem(job).then(free, free);
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
// THE SWITCH IS KEPT (goal/G18.9). Andy, 2026-10-12: "The connected/disconnected status of levant needs to be persisted,
// otherwise he will be re-connected every time i update his node/deskAgent... and restart." So switch.json in the
// state folder holds his last word, and a start is connected only when it said connected (or was never said) and the
// model still has 🧵.
const SWITCH_FILE = 'switch.json';
function keptSwitch() {
  try { const k = JSON.parse(fs.readFileSync(path.join(STATE, SWITCH_FILE), 'utf8')); return k && typeof k.connected === 'boolean' ? k.connected : true; } catch (e) { return true; }
}
function keepSwitch(on) {
  try { fs.writeFileSync(path.join(STATE, SWITCH_FILE), JSON.stringify({ connected: on === true, at: new Date().toISOString() }, null, 2) + '\n'); } catch (e) { say('switch.json could not be written: ' + e.message); }
}
let connected = keptSwitch() && loadedRecommended();
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
    keepSwitch(false);
    // What waited for an answer is dropped with him (goal/G18.9); a connect starts from the present anyway.
    waiting.length = 0;
    publishState();
    say(PERSONA + ' leaves the desk: signing off');
    askNode({ deskClient: { signoff: { agent: PERSONA } } }).catch(function (e) { say('deskClient could not sign off: ' + ((e && e.message) || e)); });
    return deskWrite('switch', 'signoff', {}).then(function () { return { connected: false }; }, function (e) {
      say('the signoff could not be said: ' + e.message);
      return { connected: false };
    });
  }
  connected = true;
  askNode({ deskClient: { clearSignoff: { agent: PERSONA } } }).catch(function (e) { say('deskClient could not clear the signoff: ' + ((e && e.message) || e)); });
  keepSwitch(true);
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
  // THE SWITCH'S TWO VERBS (goal/G14.2): what deskAgentRemote flips and reads, on this node through jobs.api,
  // from the owner's node through owner.command carrying that same ask.
  connect: {
    request: { on: true }, reply: { connected: true },
    handler: function (a) { return setConnected(a.on === true); },
  },
  state: {
    request: {}, reply: { connected: true, persona: '', model: '', server: { url: '', answers: true, error: '' }, connections: [{ name: '', url: '', use: true }], working: true, effort: { supported: true, level: '' }, loaded: {} },
    handler: function () { return { connected: connected, persona: PERSONA, model: MODEL, server: { url: server.url, answers: server.answers, error: server.error }, connections: connectionsNow(), working: flights.size > 0, effort: effortNow(), loaded: loadedEntryOf(readKnown()) || {} }; },
  },
  // CLEAR SIGNOFF (goal/G27.6, approved by Andy 2026-10-16): the Remote's button lifts a signoff the desk gave. The
  // node asks its deskClient, which clears the state and answers with it.
  clearSignoff: {
    request: {}, reply: { cleared: true, status: '' },
    handler: function () { return askNode({ deskClient: { clearSignoff: { agent: PERSONA } } }).then(function (b) { return { cleared: b.cleared === true, status: String(b.status || '') }; }); },
  },
  // THE REMOTE'S ABORT (goal/G19.7): cancels every model answer in flight and frees Levant. Andy's manual
  // intervention, in place of any automatic timeout. No verb file: it is the Remote's, never a tool of Levant's.
  abort: {
    request: {}, reply: { aborted: 0 },
    handler: function () { return abortAll(); },
  },
  // THE SERVER BUBBLE'S VERB (goal/G10.7): the url and the key into connection.json, and whether a server answers.
  // Since goal/G18.6 a named pair, one of several kept in connection.json; the key never comes back.
  // Since goal/G14.10 an optional workspace beside the key, left out when the server asks for none.
  'connection.set': {
    request: { name: '', url: '', key: '', workspace: '' }, reply: { url: '', answers: true, error: '' },
    accepts: function (a) {
      if (!a || typeof a !== 'object' || Array.isArray(a)) return false;
      const known = ['name', 'url', 'key', 'workspace'];
      return Object.keys(a).every(function (k) { return known.indexOf(k) !== -1; }) &&
        typeof a.name === 'string' && typeof a.url === 'string' && typeof a.key === 'string' &&
        (a.workspace === undefined || typeof a.workspace === 'string');
    },
    handler: function (a) {
      if (!String(a.url || '')) throw { refusal: 'bad-request', extra: { why: 'a url is needed' } };
      return setConnection(a.name, a.url, a.key, a.workspace);
    },
  },
  'connection.use': {
    request: { name: '' }, reply: { url: '', answers: true, error: '' },
    handler: function (a) { return usePair(String(a.name)); },
  },
  // THE EFFORT SLIDER'S VERB (goal/G27.8): the level for one model on the pair in use.
  'effort.set': {
    request: { model: '', level: '' }, reply: { model: '', level: '' },
    handler: function (a) { return setEffort(String(a.model || ''), String(a.level || '')); },
  },
  'connection.remove': {
    request: { name: '' }, reply: { connections: [{ name: '', url: '', use: true }] },
    handler: function (a) { return removePair(String(a.name)); },
  },
  // THE MODEL LINE AND THE CHAT BOX (goal/G14.4): what deskAgentRemote reads and presses.
  // THE PICKER'S SEARCH (goal/G27.17).
  'models.search': {
    request: { text: '', marks: [''] }, reply: { models: [{ id: '', loaded: true }], more: true, marks: [''], active: '' },
    handler: function (a) { return modelsSearch(a.text, a.marks); },
  },
  // THE QUANTIZATION NAMED (goal/G10.9); answered at once, the studio not waited for (goal/G14.4).
  'model.load': {
    request: { id: '', quant: '' }, reply: { model: '', loaded: true },
    handler: function (a) {
      // An empty id wrote an empty model into configuration.json (goal/G19.7): refused, saying why.
      if (!String(a.id || '')) throw refused('an id is needed: the model to load');
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
    // {path} or {path, offset, limit}, either of the two alone too (goal/G23.3): appServer matches exact argument sets.
    request: { path: '', offset: 0, limit: 0 }, reply: { path: '', text: '' }, // a ranged read carries lines and next beside them
    accepts: function (a) {
      if (!a || typeof a !== 'object' || Array.isArray(a) || typeof a.path !== 'string') return false;
      return Object.keys(a).every(function (k) { return k === 'path' || ((k === 'offset' || k === 'limit') && typeof a[k] === 'number'); });
    },
    handler: function (a) { return fileLoad(a.path, a.offset, a.limit); },
  },
  // goal/G23.6: by name and by text, at the repo root of the clone.
  'file.search': {
    request: { pattern: '', text: '', path: '' }, reply: { cut: true }, // and files or matches beside it
    handler: function (a) { return fileSearch(String(a.pattern || ''), String(a.text || ''), String(a.path || '')); },
  },
  // goal/G23.7: one exact piece replaced; it writes, so it is no read off the desk.
  'file.edit': {
    request: { path: '', old: '', new: '', all: false }, reply: { path: '', replaced: 0 },
    handler: function (a) { return fileEdit(a.path, a.old, a.new, a.all === true); },
  },
  // goal/G23.8: a command in his clone, as a job (a verb answers within 12 s); both write or read a job, so neither is
  // answered to the model while he is disconnected.
  'command.run': {
    request: { command: '', timeoutMs: 0 }, reply: { id: '', running: false, exit: 0, output: '', cut: false, timedOut: false },
    handler: function (a) { return commandRun(a.command, a.timeoutMs); },
  },
  'command.result': {
    request: { id: '' }, reply: { id: '', running: false, exit: 0, output: '', cut: false, timedOut: false },
    handler: function (a) { return commandResult(a.id); },
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
// Remote does when it opens): at the desk alone, deskAgent speaks to the studio for chat and nothing else
// (goal/G10.3, deskAgentContext.js).
publishState();
loop();
