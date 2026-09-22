'use strict';

// spirit/run/process/js/agents/agents.js
// AGENTS POST TO EACH OTHER, NODE TO NODE — step 1's program.
//
//   Andy: "you guys just need to sent posts to each other, you can even
//   design the protocol for that. it's A real- non-shell app"
//
// design/agents/AGENTS-POST-TO-EACH-OTHER.md holds the protocol and the
// plan both agents agreed; AGENT.md, "Agents on the network", holds the
// standing defaults. This is the program that plan names: send, listen,
// read — plus the stop, and the one-line reports to Andy's own node.
//
// ── IT TALKS TO ITS OWN NODE OVER HTTP, BY A GRANTED EXCEPTION ─────────
//
//   Andy, 2026-09-22: "exception granted"
//
// AGENT.md's Comms rule — no component reaches for fetch — is answered
// here out loud, not worked around: this program is a client of its OWN
// node's loopback door, exactly as the shell is, and nothing else. ONE
// reach, in `nodeFetch` below, which posting and listening both go
// through; test/oneDoor.js counts this folder on purpose (it skips the
// rest of process/).
//
// ── WHAT IT IS NOT ──────────────────────────────────────────────────────
//
// Not an order channel: a message is information, never an instruction
// (the agents' own promise, AGENT.md). Nothing here runs anything because
// a packet arrived. It prints, and the agent's session decides.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const APP = 'agents';
const KINDS = ['note', 'ask', 'answer', 'report', 'halt', 'resume'];

// ── CONFIGURATION, FROM THE ENVIRONMENT ────────────────────────────────
//
// AGENTS_NODE     this agent's node door        (default http://127.0.0.1:65432)
// AGENTS_ROOT     that node's spirit/run         (default: this checkout's)
// AGENTS_SELF     this agent's name              (default claude-windows)
// AGENTS_PEERS    name=key,name=key              the other agents
// AGENTS_CONTROL  the key of the node Andy keeps; halt and resume are
//                 obeyed from it and nothing else, and reports go to it
function config(env) {
  const e = env || process.env;
  return {
    node: e.AGENTS_NODE || 'http://127.0.0.1:65432',
    root: e.AGENTS_ROOT || path.resolve(__dirname, '..', '..', '..'),
    self: e.AGENTS_SELF || 'claude-windows',
    peers: parsePeers(e.AGENTS_PEERS || ''),
    control: String(e.AGENTS_CONTROL || '').trim(),
    retryMs: Number(e.AGENTS_RETRY_MS) >= 0 && e.AGENTS_RETRY_MS !== undefined
      ? Number(e.AGENTS_RETRY_MS) : 5 * 60 * 1000,
  };
}

function parsePeers(s) {
  const out = Object.create(null);
  String(s || '').split(',').forEach(function (pair) {
    const i = pair.indexOf('=');
    if (i <= 0) return;
    const name = pair.slice(0, i).trim();
    const key = pair.slice(i + 1).trim();
    if (name && key) out[name] = key;
  });
  return out;
}

// A name from AGENTS_PEERS, the word "control", or a key given as is.
function resolvePeer(cfg, to) {
  if (to === 'control') return cfg.control;
  return cfg.peers[to] || to;
}

// ── THE ENVELOPE — protocol v1 ─────────────────────────────────────────
function makeEnvelope(from, kind, text, re, idFn) {
  if (KINDS.indexOf(kind) === -1) throw new Error('unknown kind: ' + kind);
  const env = {
    app: APP, v: 1,
    id: (idFn || function () { return crypto.randomBytes(12).toString('hex'); })(),
    body: { from: String(from), kind: kind, text: String(text || '') },
  };
  if (re) env.re = String(re);
  return env;
}

// ── THE STOP — soft half; the hard half is Andy's relay ─────────────────
//
// A flag in the node's own relay-state. Set only by a `halt` from the
// control key, cleared only by a `resume` from it — never by another
// agent. Before the agents have nodes of their own the control key IS the
// node this program runs on, and a halt from it would be indistinguishable
// from the agent itself; which is why the plan puts the nodes first.
function haltPath(cfg) { return path.join(cfg.root, 'relay-state', 'agents-halt.json'); }

function halted(cfg) {
  try { return JSON.parse(fs.readFileSync(haltPath(cfg), 'utf8')); } catch (e) { return null; }
}

function obeyControl(cfg, fromKey, env, nowIso) {
  if (!env || env.app !== APP || !env.body) return null;
  const kind = env.body.kind;
  if (kind !== 'halt' && kind !== 'resume') return null;
  if (!cfg.control || fromKey !== cfg.control) return 'ignored';
  if (kind === 'halt') {
    fs.mkdirSync(path.dirname(haltPath(cfg)), { recursive: true });
    fs.writeFileSync(haltPath(cfg), JSON.stringify({ at: nowIso || new Date().toISOString(), text: env.body.text || '' }));
    return 'halted';
  }
  try { fs.unlinkSync(haltPath(cfg)); } catch (e) { /* not halted */ }
  return 'resumed';
}

// ── THE ONE DOOR ────────────────────────────────────────────────────────
// THE ONE REACH, written so test/oneDoor.js SEES it. `(fetchFn || fetch)(…)`
// would do the same and slip past the census's pattern — which would be
// working around the exception instead of taking it. A suite passes its
// own function; everything else goes through this line.
function nodeFetch(cfg, pathname, init, fetchFn) {
  if (typeof fetchFn === 'function') return fetchFn(cfg.node + pathname, init);
  return fetch(cfg.node + pathname, init);
}

function post(cfg, toKey, env, fetchFn) {
  return nodeFetch(cfg, '/api/spirit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verb: 'peer.post', to: toKey, text: JSON.stringify(env) }),
  }, fetchFn).then(function (r) {
    return r.text().then(function (t) {
      let body = null;
      try { body = JSON.parse(t); } catch (e) { body = { error: t }; }
      return { status: r.status, body: body || {} };
    });
  });
}

function commitOf(cfg) {
  try {
    return execFileSync('git', ['-C', cfg.root, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch (e) { return '?'; }
}

// ── REPORTS — one line each, to the node Andy keeps ────────────────────
//
// Plain words: who to whom, what kind, the start of what was said, and
// how it ended. The full message stays in the logs, found by its hash.
function reportLine(self, toName, kind, text, outcome, commit) {
  const gist = String(text || '').replace(/\s+/g, ' ').slice(0, 100);
  return self + ' -> ' + toName + ', ' + kind + ': "' + gist + '" — ' + outcome + ' (at ' + commit + ')';
}

function outboxPath(cfg) { return path.join(cfg.root, 'relay-state', 'agents-outbox.jsonl'); }

// A report that could not land is kept, and sent the next time anything
// is (the plan: "your node down: the program keeps the reports and sends
// them when your node is back").
function queueReport(cfg, line) {
  fs.mkdirSync(path.dirname(outboxPath(cfg)), { recursive: true });
  fs.appendFileSync(outboxPath(cfg), JSON.stringify({ line: line }) + '\n');
}

function flushReports(cfg, fetchFn, ownKey) {
  if (!cfg.control || cfg.control === ownKey) return Promise.resolve(0);
  let rows = [];
  try { rows = fs.readFileSync(outboxPath(cfg), 'utf8').split('\n').filter(Boolean); } catch (e) { return Promise.resolve(0); }
  const left = [];
  let sent = 0;
  return rows.reduce(function (p, row) {
    return p.then(function () {
      let line; try { line = JSON.parse(row).line; } catch (e) { return; }
      return post(cfg, cfg.control, makeEnvelope(cfg.self, 'report', line), fetchFn)
        .then(function (r) { if (r.status === 200) sent++; else left.push(row); })
        .catch(function () { left.push(row); });
    });
  }, Promise.resolve()).then(function () {
    fs.writeFileSync(outboxPath(cfg), left.map(function (r) { return r + '\n'; }).join(''));
    return sent;
  });
}

function ownKey(cfg) {
  try { return JSON.parse(fs.readFileSync(path.join(cfg.root, 'relay-state', 'identity.json'), 'utf8')).publicKey; }
  catch (e) { return ''; }
}

// ── SEND ────────────────────────────────────────────────────────────────
//
// Refused while halted. A 503 from the relay (peer not reachable, busy) is
// retried with a growing wait for up to retryMs, because the core makes
// one attempt (R40 is outside the core). A refusal by THIS node — a 4xx —
// is returned at once and said out loud: the node's log keeps no row for
// it, so this is the only place it is visible.
function send(cfg, to, kind, text, re, opts) {
  const o = opts || {};
  const fetchFn = o.fetch;
  const sleep = o.sleep || function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  const now = o.now || Date.now;
  const toKey = resolvePeer(cfg, to);
  const isControlVerb = kind === 'halt' || kind === 'resume';

  const h = halted(cfg);
  if (h && !isControlVerb) {
    return Promise.resolve({ ok: false, halted: true, error: 'halted by Andy at ' + h.at + ' — nothing is sent until he resumes' });
  }
  if (!toKey) return Promise.resolve({ ok: false, error: 'no key for ' + to });

  const env = makeEnvelope(cfg.self, kind, text, re);
  const deadline = now() + cfg.retryMs;
  let wait = 5000;

  function attempt() {
    return post(cfg, toKey, env, fetchFn).then(function (r) {
      if (r.status === 200) return { ok: true, status: 200, hash: r.body.hash, receipt: !!r.body.receipt };
      if (r.status === 503 && now() + wait <= deadline) {
        return sleep(wait).then(function () { wait = Math.min(wait * 2, 60000); return attempt(); });
      }
      return {
        ok: false, status: r.status, hash: r.body.hash, error: r.body.error || 'refused',
        byNode: r.status >= 400 && r.status < 500,
      };
    });
  }

  return attempt().then(function (result) {
    const mine = ownKey(cfg);
    if (kind !== 'report' && !isControlVerb && cfg.control && cfg.control !== mine) {
      const outcome = result.ok ? 'delivered' : 'undelivered: ' + result.error + (result.byNode ? ' (refused by my own node — not in any log)' : '');
      queueReport(cfg, reportLine(cfg.self, to, kind, text, outcome, commitOf(cfg)));
      return flushReports(cfg, fetchFn, mine).then(function () { return result; });
    }
    return result;
  });
}

// ── READ — the conversation, from the node's own log ────────────────────
//
// A relay's refusal is TWO rows — 'sent', then 'refused' — sharing a hash,
// and a reader that keeps only rows with a payload shows the first and
// hides the second (found over this very channel, 2026-09-22). So rows are
// paired by hash, and the LAST outcome for a hash is the one shown.
function conversation(lines, peerKey) {
  const byHash = Object.create(null);
  const order = [];
  lines.forEach(function (l) {
    let row; try { row = JSON.parse(l); } catch (e) { return; }
    if (!row || !row.hash) return;
    if (peerKey && row.peer !== peerKey) return;
    let entry = byHash[row.hash];
    if (row.payload) {
      let env = null; try { env = JSON.parse(row.payload); } catch (e) { env = null; }
      if (!env || env.app !== APP || row.kind !== 'request') return;
      if (!entry) { entry = byHash[row.hash] = { hash: row.hash }; order.push(entry); }
      entry.at = row.at; entry.dir = row.dir; entry.peer = row.peer; entry.env = env;
    }
    if (entry) entry.outcome = row.outcome;
  });
  return order;
}

function read(cfg, peerName, n) {
  let lines = [];
  try { lines = fs.readFileSync(path.join(cfg.root, 'relay-state', 'traffic.jsonl'), 'utf8').split('\n').filter(Boolean); }
  catch (e) { return []; }
  const key = peerName ? resolvePeer(cfg, peerName) : '';
  return conversation(lines, key).slice(-(n || 20));
}

function formatEntry(e) {
  const b = (e.env && e.env.body) || {};
  return e.at + ' ' + (e.dir === 'in' ? '<-' : '->') + ' ' + (b.from || '?') + ' ' + (b.kind || '?') +
    ' [' + e.outcome + '] ' + String(e.hash).slice(0, 12) +
    (e.env && e.env.re ? ' re ' + String(e.env.re).slice(0, 12) : '') + '\n    ' + (b.text || '');
}

// ── LISTEN — every arriving agents packet, one line each ────────────────
function listen(cfg, onLine, fetchFn) {
  return nodeFetch(cfg, '/api/events', {}, fetchFn).then(function (r) {
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    onLine('listening on ' + cfg.node + ' as ' + cfg.self + (halted(cfg) ? ' — HALTED' : ''));
    function pump() {
      return reader.read().then(function (chunk) {
        if (chunk.done) { onLine('stream closed'); return; }
        buf += dec.decode(chunk.value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) !== -1) {
          const block = buf.slice(0, i); buf = buf.slice(i + 2);
          const ev = /event: (.*)/.exec(block); const da = /data: (.*)/.exec(block);
          if (!ev || ev[1] !== 'packet' || !da) continue;
          let msg; try { msg = JSON.parse(da[1]); } catch (e) { continue; }
          let env = null; try { env = JSON.parse(msg.text); } catch (e) { continue; }
          if (!env || env.app !== APP) continue;
          const control = obeyControl(cfg, msg.from, env);
          const b = env.body || {};
          onLine('AGENTS ' + (b.from || '?') + ' ' + (b.kind || '?') +
            (env.re ? ' re ' + String(env.re).slice(0, 12) : '') +
            (control ? ' [' + control + ']' : '') + ': ' + String(b.text || '').replace(/\s+/g, ' '));
        }
        return pump();
      });
    }
    return pump();
  });
}

module.exports = {
  config: config, parsePeers: parsePeers, resolvePeer: resolvePeer,
  makeEnvelope: makeEnvelope, halted: halted, obeyControl: obeyControl,
  send: send, conversation: conversation, read: read, formatEntry: formatEntry,
  reportLine: reportLine, flushReports: flushReports, listen: listen,
  KINDS: KINDS,
};

// ── THE COMMAND LINE ────────────────────────────────────────────────────
//
//   node agents.js send <to> <note|ask|answer> <text…> [--re <hash>]
//   node agents.js halt <to> [reason…]      (Andy's node only)
//   node agents.js resume <to>              (Andy's node only)
//   node agents.js listen
//   node agents.js read [peer] [n]
//   node agents.js status
if (require.main === module) {
  const cfg = config();
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const reAt = argv.indexOf('--re');
  const re = reAt !== -1 ? argv[reAt + 1] : '';
  const rest = reAt !== -1 ? argv.slice(0, reAt) : argv;
  const done = function (r) { console.log(JSON.stringify(r)); process.exit(r && r.ok ? 0 : 1); };
  if (cmd === 'send') {
    send(cfg, rest[1], rest[2], rest.slice(3).join(' '), re).then(done, function (e) { done({ ok: false, error: e.message }); });
  } else if (cmd === 'halt' || cmd === 'resume') {
    send(cfg, rest[1], cmd, rest.slice(2).join(' ')).then(done, function (e) { done({ ok: false, error: e.message }); });
  } else if (cmd === 'listen') {
    listen(cfg, function (l) { console.log(l); }).catch(function (e) { console.log('listener error: ' + e.message); process.exit(1); });
  } else if (cmd === 'read') {
    read(cfg, rest[1], Number(rest[2]) || 20).forEach(function (e) { console.log(formatEntry(e)); });
  } else if (cmd === 'status') {
    const h = halted(cfg);
    console.log(h ? 'HALTED since ' + h.at + (h.text ? ' — ' + h.text : '') : 'running');
  } else {
    console.log('usage: agents.js send <to> <note|ask|answer> <text> [--re hash] | halt <to> | resume <to> | listen | read [peer] [n] | status');
  }
}
