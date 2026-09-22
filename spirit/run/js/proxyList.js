'use strict';

// spirit/run/js/proxyList.js
// THE OWNER'S LIST FOR THE PROXY — which key may go to which website, with
// which methods, and the gate he can close. A node file, not code.
//
//   Andy, 2026-09-22: "on the core-side it's primarily about having a
//   configuration file for allowed key/website combinations and a client
//   api (loopback) that allows that internal list to be maintained. that
//   node-file will be !fileServable() ?" — "if i see outragous spending by
//   agents, i then could close the node-gate." — "the shell side is
//   deferred. the api will first be usefull to agents."
//
// design/proxy/THE-PROXY.md is where each of these was ruled.
//
// ── WHERE IT LIVES, AND WHY THERE ─────────────────────────────────────
//
// relay-state/proxy.json. That folder is never served (kernel.js,
// fileServable), never writable through the fs verbs (kernel.js, the
// writable roots are app/, media/, published/ and preferences.json), and
// never in git. So the ONLY way to change the list is the proxy verbs
// (server.js), and an app cannot quietly add "send my key to this site"
// through the file door. It holds key NAMES, websites and methods; the
// secrets stay in the environment (envSecrets.js).
//
// ── WHAT THE LIST DOES AND DOES NOT DO ────────────────────────────────
//
// It governs KEYS and the owner's GATE. A website that is not on the list
// and names no key is not fenced — Andy: "I'm not saying that my agents
// here should ot do their own internet calls". An entry with no key exists
// only to close a website.
//
// The core knows no apps and no askers (Andy: "on the core-layer apps are
// unknown"; "my authoriy extends over the whole machine. it's implicit").
//
// ── READ ON EVERY CALL ────────────────────────────────────────────────
//
// So closing the gate takes effect on the next call, with no restart. It
// is a small file. A file that cannot be read or makes no sense CLOSES the
// gate rather than opening it: an owner's list that broke must not become
// "anything goes".

const fs = require('fs');
const path = require('path');

const FILE = path.join('relay-state', 'proxy.json');

// The entries that were code until 2026-09-22 (envSecrets.js), written to
// the file the first time a node without one needs it.
const DEFAULTS = {
  open: true,
  entries: [
    { key: 'ANTHROPIC_API_KEY', host: 'api.anthropic.com' },
    // Andy's Grok key, for agent reviews on a budget he grants.
    { key: 'GROK_API_KEY', host: 'api.x.ai' },
    // Andy's xAI management key: read-only at xAI, GET-only here.
    { key: 'GROK_MANAGEMENT_KEY', host: 'management-api.x.ai', methods: ['GET'] },
  ],
};

const KEY_NAME = /^[A-Z0-9_]{1,64}$/;
const HOST_NAME = /^[a-z0-9.-]{1,253}$/;
const METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

function fileOf(rootDir) { return path.join(rootDir, FILE); }

function copy(o) { return JSON.parse(JSON.stringify(o)); }

// One entry, as the file and the verbs both accept it — or a reason not to.
function clean(e) {
  if (!e || typeof e !== 'object') return { error: 'an entry is an object' };
  const host = String(e.host || '').toLowerCase();
  if (!HOST_NAME.test(host)) return { error: 'host: a website name, like api.x.ai' };
  const out = { host: host };
  if (e.key !== undefined && e.key !== null && e.key !== '') {
    if (!KEY_NAME.test(String(e.key))) return { error: 'key: an environment variable name, like GROK_API_KEY' };
    out.key = String(e.key);
  }
  if (e.methods !== undefined) {
    if (!Array.isArray(e.methods) || !e.methods.length) return { error: 'methods: a list, like ["GET"]' };
    const m = e.methods.map(function (x) { return String(x).toUpperCase(); });
    if (m.some(function (x) { return METHODS.indexOf(x) === -1; })) return { error: 'methods: ' + METHODS.join(', ') };
    out.methods = m;
  }
  if (e.open === false) out.open = false;
  return { entry: out };
}

// The list as it stands, from the file. A missing file is written from
// DEFAULTS; a broken one answers { open: false, broken: <why> }.
function load(rootDir) {
  const file = fileOf(rootDir);
  let text = null;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { text = null; }
  if (text === null) {
    const fresh = copy(DEFAULTS);
    try { save(rootDir, fresh); } catch (e) { /* a node that cannot write still answers from defaults */ }
    return fresh;
  }
  let parsed = null;
  try { parsed = JSON.parse(text); } catch (e) { parsed = null; }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.entries)) {
    return { open: false, entries: [], broken: 'relay-state/proxy.json is not a proxy list' };
  }
  const entries = [];
  for (let i = 0; i < parsed.entries.length; i += 1) {
    const c = clean(parsed.entries[i]);
    if (c.error) return { open: false, entries: [], broken: 'relay-state/proxy.json entry ' + i + ': ' + c.error };
    entries.push(c.entry);
  }
  return { open: parsed.open !== false, entries: entries };
}

// Written whole, then moved into place, so a crash mid-write leaves the
// old list rather than half of a new one.
function save(rootDir, list) {
  const file = fileOf(rootDir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ open: list.open !== false, entries: list.entries }, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

function same(a, b) { return a.host === b.host && (a.key || '') === (b.key || ''); }

// ── THE VERBS' WORK ───────────────────────────────────────────────────

function allow(rootDir, args) {
  const c = clean(args);
  if (c.error) return { ok: false, status: 400, error: c.error };
  const list = load(rootDir);
  if (list.broken) return { ok: false, status: 409, error: list.broken };
  list.entries = list.entries.filter(function (e) { return !same(e, c.entry); });
  list.entries.push(c.entry);
  save(rootDir, list);
  return { ok: true, status: 200, list: list };
}

function remove(rootDir, args) {
  const c = clean(args);
  if (c.error) return { ok: false, status: 400, error: c.error };
  const list = load(rootDir);
  if (list.broken) return { ok: false, status: 409, error: list.broken };
  const before = list.entries.length;
  list.entries = list.entries.filter(function (e) { return !same(e, c.entry); });
  if (list.entries.length === before) return { ok: false, status: 404, error: 'no such entry' };
  save(rootDir, list);
  return { ok: true, status: 200, list: list };
}

// Close or open: the whole gate ({}), every entry for one key ({ key }),
// or one website ({ host }) — which, for a website not on the list, adds a
// keyless entry to hold the "closed".
function setOpen(rootDir, args, open) {
  const a = args || {};
  const list = load(rootDir);
  if (list.broken && open) return { ok: false, status: 409, error: list.broken };
  if (list.broken) return { ok: true, status: 200, list: list };
  if (!a.key && !a.host) {
    list.open = open;
  } else if (a.key && !a.host) {
    if (!KEY_NAME.test(String(a.key))) return { ok: false, status: 400, error: 'key: an environment variable name' };
    const hit = list.entries.filter(function (e) { return e.key === a.key; });
    if (!hit.length) return { ok: false, status: 404, error: 'no entry names ' + a.key };
    hit.forEach(function (e) { if (open) delete e.open; else e.open = false; });
  } else {
    const c = clean({ host: a.host, key: a.key });
    if (c.error) return { ok: false, status: 400, error: c.error };
    const hit = list.entries.filter(function (e) {
      return e.host === c.entry.host && (!c.entry.key || e.key === c.entry.key);
    });
    if (hit.length) hit.forEach(function (e) { if (open) delete e.open; else e.open = false; });
    else if (!open) list.entries.push({ host: c.entry.host, open: false });
    else return { ok: false, status: 404, error: 'nothing closed for ' + c.entry.host };
  }
  save(rootDir, list);
  return { ok: true, status: 200, list: list };
}

// ── THE GATE, ASKED BEFORE A CALL LEAVES ──────────────────────────────
//
// `keys` are the ${ENV:NAME}s the call names. Refusals say the owner
// closed it, so an agent stops and reports rather than retrying.
function gate(list, host, keys) {
  const h = String(host || '').toLowerCase();
  if (list.broken) return { ok: false, status: 503, error: 'the proxy is closed: ' + list.broken };
  if (!list.open) return { ok: false, status: 403, error: 'the proxy is closed by the owner' };
  const siteClosed = list.entries.some(function (e) { return !e.key && e.host === h && e.open === false; });
  if (siteClosed) return { ok: false, status: 403, error: h + ' is closed by the owner' };
  for (let i = 0; i < (keys || []).length; i += 1) {
    const k = keys[i];
    const mine = list.entries.filter(function (e) { return e.key === k; });
    if (mine.length && mine.every(function (e) { return e.open === false; })) {
      return { ok: false, status: 403, error: k + ' is closed by the owner' };
    }
    if (mine.some(function (e) { return e.host === h && e.open === false; })) {
      return { ok: false, status: 403, error: k + ' is closed by the owner for ' + h };
    }
  }
  return { ok: true };
}

// The open entries, in the shape envSecrets fills from.
function openEntries(list) {
  if (list.broken || !list.open) return [];
  return list.entries.filter(function (e) { return e.key && e.open !== false; });
}

module.exports = {
  FILE: FILE, DEFAULTS: DEFAULTS,
  load: load, save: save, allow: allow, remove: remove,
  close: function (rootDir, args) { return setOpen(rootDir, args, false); },
  open: function (rootDir, args) { return setOpen(rootDir, args, true); },
  gate: gate, openEntries: openEntries,
};
