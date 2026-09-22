'use strict';

// spirit/run/process/js/grokReview/grokReview.js
// A REVIEW WITH GROK, THROUGH ITS API, ON A BUDGET ANDY GRANTS.
//
//   Andy: "to me it feels like grok review is for agents, you compute the
//   fallout and present me with decisions." — "I have to approve a limited
//   message exchange with grok, because that hits my wallet." — "It's good
//   discipline for me to make targeted, goal oriented use of my
//   external-AI budget." (2026-09-22)
//
// An agent runs this; Andy does not. He grants a THREAD a goal and a cap —
// a number of messages — in his own words, and nothing else reaches his
// wallet. The agent sends, reads, triages, and brings him decisions
// (ANDYS_RULES general rule 9).
//
// ── WHAT IT WILL NOT DO ──────────────────────────────────────────────
//
//   - send one message past the cap. The cap is checked before the call,
//     and raising it needs Andy's words, recorded beside the new number.
//   - send anything from Andy's vault. His brain is his data, behind a
//     stricter fence (AGENT.md): a file under spirit/run/brains is refused
//     by path, before a byte is read.
//   - hold the key at all. It asks its NODE to call Grok (`net.fetch`)
//     and names the key as `${ENV:GROK_API_KEY}`; the node fills it in,
//     from its own environment, and only for api.x.ai (server.js,
//     PROXY_ENV_SUBSTITUTION_ALLOWLIST). Andy: "this is where the
//     env-variable proxy-call in node should come in" — "may as well
//     excercise that aspect of the SpiritOS".
//   - run on a timer, or from the browser. There is no launcher manifest
//     beside this file on purpose: a paid call is an agent's act on
//     Andy's grant, never a button.
//
// ── A THREAD REMEMBERS; THE RECORD IS OURS ───────────────────────────
//
// Grok's Responses API keeps a conversation server-side for 30 days and
// continues it from the last reply's id (previous_response_id), so a
// review's rounds share one memory and the earlier ones are billed at the
// cached rate. The thread record — design/reviews/grok/<thread>/ — keeps
// that id, the cap, what was granted in whose words, every message sent
// and received, and the EXACT cost of each, which the API reports as
// usage.cost_in_usd_ticks (10^10 ticks to the dollar). It is committed:
// a review is a document, like the ones beside it.
//
//   node grokReview.js models
//   node grokReview.js balance
//   node grokReview.js start  <thread> --cap N --grant "<Andy's words>" --goal "<goal>"
//                             --commit <hash> [--since <hash>] [--pieces a,b,c] [--model m] [--reasoning high]
//   node grokReview.js send   <thread>          (the first send, with no text, is OPENING.md filled)
//   node grokReview.js send   <thread> <file.md | "text"> [--attach path ...]
//   node grokReview.js grant  <thread> --cap N --grant "<Andy's words>"
//   node grokReview.js status [thread]

const fs = require('fs');
const path = require('path');

const API = 'https://api.x.ai/v1';
// The node that makes the call, and holds the key. Its own loopback door.
const NODE = process.env.GROK_NODE || process.env.AGENTS_NODE || 'http://127.0.0.1:65432';
const KEY_PLACEHOLDER = '${ENV:GROK_API_KEY}';
// Andy's management key: read-only at xAI, and GET-only to its host at the
// node (the owner's proxy list). Used for the balance only.
const MGMT = 'https://management-api.x.ai/v1';
const MGMT_PLACEHOLDER = '${ENV:GROK_MANAGEMENT_KEY}';
const REPO = path.join(__dirname, '..', '..', '..', '..', '..');
const THREADS = path.join(REPO, 'design', 'reviews', 'grok');
const TICKS_PER_USD = 1e10;
// The newest listed on 2026-09-22 (`models`); a thread records its own.
const DEFAULT_MODEL = process.env.GROK_MODEL || 'grok-4.7';
// A reasoning model can think for minutes on a large review.
const CALL_TIMEOUT_MS = 10 * 60 * 1000;

// ── HOW HARD IT THINKS, AND WHERE IT MAY LOOK (2026-09-22) ─────────────
// Andy: "we do need high reasoning for a good review" — and, of the
// model, "we go with the model you suggested". Reasoning is billed as
// output, so 'high' is the start and each message's real cost is kept.
// Grok reads the tree itself, from GitHub at the pinned commit — which is
// also what gets a review past the node's 17 KB body limit — and its web
// tool is fenced to GitHub, so it neither wanders nor buys searches.
const DEFAULT_REASONING = 'high';
const READ_DOMAINS = ['github.com', 'raw.githubusercontent.com'];
const OPENING = path.join(__dirname, 'OPENING.md');

// The standing brief, sent once, at the head of a thread.
const BRIEF = [
  'You are reviewing work on SpiritOS for Andy, its owner, at a checkpoint.',
  'Return findings as a numbered list. For each: what, where (file and line where you can),',
  'and which pile it belongs in — REGRESSION (a closed gate broken) or DESIGN (not built yet / a better shape).',
  'Andy decides; an agreement he made in the studio outranks a review finding, and says so in the material.',
  'Be brief: every message is paid for.',
].join(' ');

// ── THE ONE DOOR: THIS SCRIPT'S OWN NODE ─────────────────────────────
// Not a third party: the node's loopback door, verb `net.fetch`, as the
// agents program posts through `peer.post`. The node calls Grok. Counted
// in oneDoor.js as a granted exception, like agents.js. A suite passes
// its own function; everything else goes through this line.
//
// NOT Node's fetch: its 300-second headers limit cut this script off from
// its own node while the node was still waiting on Grok at high reasoning
// (2026-09-22, the second try of the first review). http.request imposes no
// wait; the node, and Grok, decide how long an answer takes. Answers the
// part of a fetch Response this file reads: ok, status, text().
function nodeFetch(node, init, fetchFn) {
  if (typeof fetchFn === 'function') return fetchFn(node + '/api/spirit', init);
  const http = require('http');
  return new Promise(function (resolve, reject) {
    const req = http.request(node + '/api/spirit', { method: init.method, headers: init.headers }, function (res) {
      const chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode,
          text: function () { return Promise.resolve(text); } });
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end(init.body);
  });
}

// One call to Grok, made by the node. Answers { ok, status, text } — the
// node relays Grok's own status and body.
function callApi(pathname, method, payload, d, base, placeholder) {
  const verb = {
    verb: 'net.fetch', url: (base || API) + pathname, method: method,
    headers: { Authorization: 'Bearer ' + (placeholder || KEY_PLACEHOLDER) },
    timeoutMs: CALL_TIMEOUT_MS,
  };
  if (payload !== undefined) verb.body = payload;
  return nodeFetch(d.node || NODE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(verb),
  }, d.fetch).then(function (res) {
    return res.text().then(function (text) { return { ok: res.ok, status: res.status, text: text }; });
  });
}

// A 401 with the placeholder sent means the NODE has no key: it leaves
// ${ENV:…} literal when the variable is missing, and Grok rejects it.
function explainAuth(status) {
  return status === 401
    ? ' — is GROK_API_KEY set in the environment of the node at ' + NODE + ' (a node started before it was set does not have it)?'
    : '';
}

function threadDir(root, name) {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(String(name || ''))) {
    throw new Error('a thread is named in lower case, digits and dashes: ' + JSON.stringify(name));
  }
  return path.join(root, name);
}

function load(root, name) {
  const file = path.join(threadDir(root, name), 'thread.json');
  if (!fs.existsSync(file)) throw new Error('no thread ' + name + ' — start it first');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function save(root, t) {
  const dir = threadDir(root, t.name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'thread.json'), JSON.stringify(t, null, 2) + '\n');
}

// Andy's vault never leaves the box. Refused by path, before reading.
function refuseVault(p) {
  const norm = path.resolve(p).replace(/\\/g, '/').toLowerCase();
  if (norm.indexOf('/spirit/run/brains/') !== -1 || /\/spirit\/run\/brains$/.test(norm)) {
    throw new Error('refused: ' + p + ' is in Andy\'s vault, which never goes to an outside AI');
  }
}

function start(root, name, opts) {
  const cap = Number(opts.cap);
  if (!(cap > 0) || Math.floor(cap) !== cap) throw new Error('--cap N: how many messages Andy granted');
  if (!opts.grant) throw new Error('--grant "<Andy\'s words>": a cap is his, quoted');
  if (!opts.goal) throw new Error('--goal "<goal>": a review has one');
  if (!/^[0-9a-f]{7,40}$/.test(String(opts.commit || ''))) {
    throw new Error('--commit <hash>: the pushed commit Grok reads, so what it reads is what is reviewed');
  }
  if (fs.existsSync(path.join(threadDir(root, name), 'thread.json'))) throw new Error('thread ' + name + ' exists');
  const t = {
    name: name, goal: String(opts.goal), model: opts.model || DEFAULT_MODEL,
    reasoning: opts.reasoning || DEFAULT_REASONING, domains: READ_DOMAINS.slice(),
    commit: String(opts.commit), since: String(opts.since || ''),
    pieces: String(opts.pieces || '').split(',').map(function (p) { return p.trim(); }).filter(Boolean),
    cap: cap, grants: [{ cap: cap, words: String(opts.grant), at: new Date().toISOString() }],
    used: 0, costTicks: 0, lastResponseId: null, rounds: [],
  };
  save(root, t);
  return t;
}

function grant(root, name, opts) {
  const t = load(root, name);
  const cap = Number(opts.cap);
  if (!(cap > 0) || Math.floor(cap) !== cap) throw new Error('--cap N');
  if (!opts.grant) throw new Error('--grant "<Andy\'s words>"');
  t.cap = cap;
  t.grants.push({ cap: cap, words: String(opts.grant), at: new Date().toISOString() });
  save(root, t);
  return t;
}

// THE OPENING, FILLED. Sent once, first, when no text is given; every
// later message relies on Grok remembering it.
function opening(t, templatePath) {
  const src = fs.readFileSync(templatePath || OPENING, 'utf8')
    .replace(/^<!--[\s\S]*?-->\s*/m, '');
  const list = t.pieces.length
    ? '\n' + t.pieces.map(function (p, i) { return '   ' + String.fromCharCode(97 + i) + '. `' + p + '`'; }).join('\n')
    : '(none named — read what the goal needs)';
  return src
    .replace(/\{commit\}/g, t.commit).replace(/\{since\}/g, t.since || '(the last review)')
    .replace(/\{goal\}/g, t.goal).replace(/\{cap\}/g, String(t.cap))
    .replace(/\{pieces\}/g, list);
}

function composeText(text, attachments) {
  const parts = [String(text || '')];
  (attachments || []).forEach(function (p) {
    refuseVault(p);
    parts.push('\n\n--- ' + path.relative(REPO, path.resolve(p)).replace(/\\/g, '/') + ' ---\n' + fs.readFileSync(p, 'utf8'));
  });
  return parts.join('');
}

function replyText(body) {
  if (body && typeof body.output_text === 'string') return body.output_text;
  const out = [];
  ((body && body.output) || []).forEach(function (item) {
    (item.content || []).forEach(function (c) { if (typeof c.text === 'string') out.push(c.text); });
  });
  return out.join('\n');
}

async function send(root, name, text, attachments, deps) {
  const d = deps || {};
  const t = load(root, name);
  // THE CAP, BEFORE ANYTHING IS READ OR SENT.
  if (t.used >= t.cap) {
    throw new Error('cap reached: ' + t.used + ' of ' + t.cap + ' messages used — raising it is Andy\'s word');
  }
  const first = !t.lastResponseId;
  const composed = (first && !text && (!attachments || !attachments.length))
    ? opening(t, d.opening)
    : composeText(text, attachments);
  const input = [];
  if (!t.lastResponseId) {
    input.push({ role: 'system', content: BRIEF + '\n\nGoal of this review: ' + t.goal });
  }
  input.push({ role: 'user', content: composed });
  const body = {
    model: t.model, input: input, store: true,
    reasoning: { effort: t.reasoning || DEFAULT_REASONING },
    tools: [{ type: 'web_search', filters: { allowed_domains: (t.domains || READ_DOMAINS).slice(0, 5) } }],
  };
  if (t.lastResponseId) body.previous_response_id = t.lastResponseId;

  const n = t.rounds.length + 1;
  const stem = String(n).padStart(2, '0');
  const dir = threadDir(root, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, stem + '-sent.md'), composed + '\n');

  const res = await callApi('/responses', 'POST', body, d);
  let parsed = null;
  const raw = res.text;
  try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }

  if (!res.ok) {
    // NOT COUNTED against the cap: a refused call is not a message Grok
    // answered. Its cost, if the API reports one, is still recorded.
    const ticks = Number(parsed && parsed.usage && parsed.usage.cost_in_usd_ticks) || 0;
    t.costTicks += ticks;
    t.rounds.push({ n: n, at: new Date().toISOString(), ok: false, status: res.status, costTicks: ticks,
      error: (parsed && (parsed.error && (parsed.error.message || parsed.error))) || raw.slice(0, 300) });
    save(root, t);
    throw new Error('Grok refused (' + res.status + '): ' + JSON.stringify(t.rounds[t.rounds.length - 1].error) + explainAuth(res.status));
  }

  const usage = (parsed && parsed.usage) || {};
  const ticks = Number(usage.cost_in_usd_ticks) || 0;
  const reply = replyText(parsed);
  fs.writeFileSync(path.join(dir, stem + '-grok.md'), reply + '\n');
  t.used += 1;
  t.costTicks += ticks;
  t.lastResponseId = parsed && parsed.id ? parsed.id : t.lastResponseId;
  t.rounds.push({
    n: n, at: new Date().toISOString(), ok: true, responseId: parsed && parsed.id,
    inputTokens: usage.input_tokens, outputTokens: usage.output_tokens,
    cachedTokens: usage.input_tokens_details && usage.input_tokens_details.cached_tokens,
    costTicks: ticks,
  });
  save(root, t);
  return { thread: t, reply: reply, costUsd: ticks / TICKS_PER_USD };
}

function statusLine(t) {
  return t.name + ': ' + t.used + ' of ' + t.cap + ' messages, $' + (t.costTicks / TICKS_PER_USD).toFixed(4) +
    ' spent, model ' + t.model + (t.lastResponseId ? '' : ', nothing sent yet');
}

async function models(deps) {
  const res = await callApi('/models', 'GET', undefined, deps || {});
  if (!res.ok) throw new Error('Grok refused (' + res.status + '): ' + res.text.slice(0, 200) + explainAuth(res.status));
  const body = JSON.parse(res.text);
  return ((body && body.data) || []).map(function (m) { return m.id; });
}

// ── WHAT IS LEFT OF THE BUDGET ─────────────────────────────────────────
// Free: the key's own status names the team, and the management API reads
// the team's prepaid balance. Andy set the management key read-only; the
// node sends it GET-only, to management-api.x.ai only.
async function balance(deps) {
  const d = deps || {};
  const who = await callApi('/api-key', 'GET', undefined, d);
  if (!who.ok) throw new Error('key status refused (' + who.status + ')' + explainAuth(who.status));
  const team = JSON.parse(who.text).team_id;
  if (!team) throw new Error('the key status named no team');
  const res = await callApi('/billing/teams/' + encodeURIComponent(team) + '/prepaid/balance', 'GET', undefined, d, MGMT, MGMT_PLACEHOLDER);
  if (!res.ok) {
    throw new Error('balance refused (' + res.status + '): ' + res.text.slice(0, 200) +
      (res.status === 401 || res.status === 403
        ? ' — is GROK_MANAGEMENT_KEY set on the node, and is this box\'s address on the key\'s allowed list?'
        : ''));
  }
  return JSON.parse(res.text);
}

// The API counts the prepaid balance in CENTS, and a credit is NEGATIVE:
// a $5 purchase reads {"total":{"val":"-500"}} (seen live, 2026-09-22).
function balanceLine(b) {
  const cents = -Number(b && b.total && b.total.val);
  if (!isFinite(cents)) return 'balance: unreadable ' + JSON.stringify(b && b.total);
  return 'prepaid balance left: $' + (cents / 100).toFixed(2);
}

module.exports = { balance: balance, balanceLine: balanceLine, start: start, send: send, grant: grant, load: load, statusLine: statusLine,
  models: models, refuseVault: refuseVault, opening: opening, TICKS_PER_USD: TICKS_PER_USD, THREADS: THREADS,
  KEY_PLACEHOLDER: KEY_PLACEHOLDER };

function flags(argv) {
  const out = { _: [], attach: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--attach') { out.attach.push(argv[++i]); continue; }
    if (a.startsWith('--')) { out[a.slice(2)] = argv[++i]; continue; }
    out._.push(a);
  }
  return out;
}

if (require.main === module) {
  const f = flags(process.argv.slice(2));
  const cmd = f._[0];
  const name = f._[1];
  (async function () {
    if (cmd === 'models') { (await models()).forEach(function (m) { console.log(m); }); return; }
    if (cmd === 'balance') { console.log(balanceLine(await balance())); return; }
    if (cmd === 'start') { console.log(statusLine(start(THREADS, name, f))); return; }
    if (cmd === 'grant') { console.log(statusLine(grant(THREADS, name, f))); return; }
    if (cmd === 'status') {
      if (name) { console.log(statusLine(load(THREADS, name))); return; }
      if (!fs.existsSync(THREADS)) { console.log('no threads'); return; }
      fs.readdirSync(THREADS).forEach(function (n) {
        try { console.log(statusLine(load(THREADS, n))); } catch (e) { /* not a thread */ }
      });
      return;
    }
    if (cmd === 'send') {
      const arg = f._[2] || '';
      const text = arg && fs.existsSync(arg) ? (refuseVault(arg), fs.readFileSync(arg, 'utf8')) : arg;
      const r = await send(THREADS, name, text, f.attach);
      console.log(statusLine(r.thread) + '  (this message: $' + r.costUsd.toFixed(4) + ')');
      // Best effort: a balance that cannot be read does not undo a reply.
      try { console.log(balanceLine(await balance())); } catch (e) { console.log('balance not read: ' + e.message); }
      console.log('reply: ' + path.join('design', 'reviews', 'grok', name,
        String(r.thread.rounds.length).padStart(2, '0') + '-grok.md'));
      return;
    }
    console.log('usage: grokReview.js models | balance | start <thread> --cap N --grant "<words>" --goal "<goal>" [--model m] | ' +
      'send <thread> <file|text> [--attach p ...] | grant <thread> --cap N --grant "<words>" | status [thread]');
  })().catch(function (e) { console.error(String(e && e.message || e)); process.exitCode = 1; });
}
