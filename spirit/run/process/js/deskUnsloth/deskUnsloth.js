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
const http = require('http');
const https = require('https');
const appServer = require('../../../js/appServer');
const spirit = appServer.spirit;

// ── THE TWO FILES, ITS OWN STATE FOLDER'S (goal/G10.3 point 4) ────────
//
// The node names the folder with --state; the files are read once at start and the process ends without either, by
// name, asking nobody. They are hand-edited for now: the configuration manager is a later goal's screen.
const STATE = (function () {
  const argv = process.argv;
  const at = argv.indexOf('--state');
  return at !== -1 ? String(argv[at + 1] || '') : '';
})();
const CONFIGURATION_FILE = 'configuration.json';
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
const CONNECTION = readOrDie(CONNECTION_FILE);

const PERSONA = String(CONFIGURATION.persona || 'agent');
const PREAMBLE = String(CONFIGURATION.preamble || '');
// THE MODEL FOLLOWS A LOAD (goal/G14.4): model.load rewrites configuration.json and this with it, so the next call
// names what the studio now serves. Everything else in the configuration is still read once.
let MODEL = String(CONFIGURATION.model || '');
const CONTEXT_LIMIT = Number(CONFIGURATION.contextLimit) || 0;
const ANSWER_TOKENS = Number(CONFIGURATION.answerTokens) || 0;
const BYTES_PER_TOKEN = Number(CONFIGURATION.bytesPerToken) || 4;
// HIS FORMULA (goal/G10.3): the room for the whole prompt is what is left of the context once the answer has its
// own, in bytes, at bytesPerToken each.
const PROMPT_ROOM = Math.max(0, (CONTEXT_LIMIT - ANSWER_TOKENS) * BYTES_PER_TOKEN);

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

// ── WHAT IT ANSWERS: ADDRESSED LINES AND JOBs (goal/G10.3 point 7) ────
//
// Andy: the agent "answers lines addressed to it (its nick) and JOBs only, starts at the present, never the
// backlog". A line is addressed when its text opens with the persona's name and a colon or a comma after it; a line
// for another agent, a line with no address and the desk's own line are read and left alone.
const ADDRESSED = new RegExp('^\\s*' + PERSONA.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*[:,]', 'i');

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
  return { kind: 'change', by: by, verb: verb, id: body.id, text: typeof body.text === 'string' ? body.text : '' };
}
function mine(read) {
  if (!read) return false;
  if (read.kind === 'job') return true;
  if (read.verb !== 'chat.add') return false;
  // Its own line comes back as a change like any other; answering it would be a conversation with itself.
  if (String(read.by || '').toLowerCase() === PERSONA.toLowerCase()) return false;
  return ADDRESSED.test(read.text);
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

function callFor(id) {
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
        let room = PROMPT_ROOM - bytes(system) - head.reduce(function (s, t) { return s + bytes(t); }, 0);
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
        return messages;
      });
  });
}

// ── THE STUDIO: one http ask of it, the connection's url and key ──────
//
// The connection's url is the OpenAI root (…/v1); the studio's own api sits beside it at the host root (…/api/…),
// read live 2026-10-10 (Unsloth Studio 2026.10.3, openapi.json). One function for both: a path from the host root.
const STUDIO_URL = String(CONNECTION.url || '').replace(/\/+$/, '').replace(/\/v1$/, '');

// `timeoutMs` caps one call: a studio route that dawdles (v1/models took 14.9 s live on 2026-10-10, probing its
// ollama entries) must not take the whole ask past the 12 s a process has to answer.
function studio(method, pathname, body, timeoutMs) {
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
      let raw = '';
      res.on('data', function (c) { raw += c; });
      res.on('end', function () {
        let got = null;
        try { got = JSON.parse(raw); } catch (e) { return reject(new Error('the studio did not answer JSON at ' + pathname)); }
        if (res.statusCode >= 400) return reject(new Error('the studio refused ' + pathname + ': ' + res.statusCode + ' ' + raw.slice(0, 120)));
        resolve(got);
      });
    });
    req.on('error', reject);
    if (Number(timeoutMs) > 0) req.setTimeout(Number(timeoutMs), function () { req.destroy(new Error('the studio took longer than ' + timeoutMs + ' ms at ' + pathname)); });
    if (text) req.write(text);
    req.end();
  });
}

// ── THE MODEL: one OpenAI chat completion ─────────────────────────────
function askModel(messages) {
  return studio('POST', '/v1/chat/completions', { model: MODEL, messages: messages, max_tokens: ANSWER_TOKENS }).then(function (got) {
    const choice = got && Array.isArray(got.choices) ? got.choices[0] : null;
    const content = choice && choice.message ? String(choice.message.content || '') : '';
    if (!content) throw new Error('the model answered nothing');
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
function models() {
  const nothing = function () { return {}; };
  return Promise.all([studio('GET', '/api/models/cached-gguf'), studio('GET', '/v1/models', undefined, QUANT_WAIT_MS).catch(nothing), studio('GET', '/api/inference/status').catch(nothing)])
    .then(function (got) {
      const cached = Array.isArray(got[0] && got[0].cached) ? got[0].cached : [];
      const known = {};
      (Array.isArray(got[1] && got[1].data) ? got[1].data : []).forEach(function (m) { if (m && m.id) known[String(m.id)] = m; });
      const st = got[2] || {};
      const active = String(st.active_model || '');
      const loadedList = Array.isArray(st.loaded) ? st.loaded.map(String) : [];
      return {
        active: active,
        models: cached.map(function (c) {
          const id = String(c.repo_id || '');
          const k = known[id] || {};
          const loaded = id === active || loadedList.indexOf(id) !== -1 || k.loaded === true;
          return {
            id: id,
            loaded: loaded,
            quant: String(k.quant || ''),
            bytes: Number(c.size_bytes) || 0,
            task: String(c.task || ''),
            vision: c.has_vision === true,
            reasoning: loaded && st.supports_reasoning === true,
            audio: loaded && st.is_audio === true,
          };
        }),
      };
    });
}

// model.load: the studio's load for that id (it swaps the loaded one; lengthy), and the configuration follows:
// configuration.json is rewritten by this process, the one that owns it, and MODEL with it, so the next call names
// what the studio serves. ANSWERED AT ONCE, THE STUDIO NOT WAITED FOR: its POST load blocks until the model is in,
// minutes for a big one, and a process must answer jobs.api within 12 s (appClient DOOR_WAIT_MS). The first build
// waited, and Andy's press died at the wall (2026-10-10: "The load button fails because it takes too long to load
// a model, you may have to load asynchronously, and poll"). models says when the studio is done; a refusal from
// the studio is said in this process's log, the line finds out by polling.
function loadModel(id) {
  const file = path.join(STATE, CONFIGURATION_FILE);
  let conf = {};
  try { conf = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { conf = Object.assign({}, CONFIGURATION); }
  conf.model = id;
  fs.writeFileSync(file, JSON.stringify(conf, null, 2) + '\n');
  MODEL = id;
  say('loading ' + id + '; the configuration names it from now on');
  studio('POST', '/api/inference/load', { model_path: id }).then(function () {
    say('the studio has loaded ' + id);
  }, function (e) {
    say('the studio did not load ' + id + ': ' + e.message);
  });
  return { model: id, loaded: false };
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
  let room = PROMPT_ROOM - bytes(system);
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
  askModel(messages).then(function (content) {
    answers[id] = { done: true, text: content, at: Date.now() };
  }, function (e) {
    answers[id] = { done: true, text: '(the model did not answer: ' + e.message + ')', at: Date.now() };
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

function answerItem(id) {
  return callFor(id).then(askModel).then(function (content) {
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
  const id = waiting.shift();
  if (!id) return Promise.resolve();
  working = true;
  return answerItem(id).then(function () { working = false; return drain(); });
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
let connected = true;
let looping = false;

function setConnected(on) {
  if (on === connected) return Promise.resolve({ connected: connected });
  if (!on) {
    connected = false;
    say(PERSONA + ' leaves the desk: signing off');
    return desk('signoff', {}).then(function () { return { connected: false }; }, function (e) {
      say('the signoff could not be said: ' + e.message);
      return { connected: false };
    });
  }
  connected = true;
  caughtUp = false;
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
        if (waiting.indexOf(read.id) === -1) waiting.push(read.id);
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
    request: {}, reply: { connected: true, persona: '', model: '' },
    handler: function () { return { connected: connected, persona: PERSONA, model: MODEL }; },
  },
  // THE MODEL LINE AND THE CHAT BOX (goal/G14.4): what deskUnslothRemote reads and presses.
  models: {
    request: {}, reply: { active: '', models: [{ id: '', loaded: true, quant: '', bytes: 0, task: '', vision: true, reasoning: true, audio: true }] },
    handler: function () { return models(); },
  },
  'model.load': {
    request: { id: '' }, reply: { model: '', loaded: true },
    handler: function (a) { return loadModel(String(a.id)); },
  },
  'chat.send': {
    request: { lines: [{ role: '', text: '' }] }, reply: { id: '' },
    handler: function (a) { return chatSend(Array.isArray(a.lines) ? a.lines : []); },
  },
  'chat.answer': {
    request: { id: '' }, reply: { done: true, text: '' },
    handler: function (a) { return chatAnswer(a.id); },
  },
}, { dependencies: [] });

say(PERSONA + ' is at the desk, model ' + MODEL + ', context ' + CONTEXT_LIMIT + ' tokens');
loop();
