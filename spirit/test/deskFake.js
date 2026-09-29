'use strict';

// spirit/test/deskFake.js
// A DESK SERVER IN MEMORY, FOR THE SUITES THAT MOUNT DESK — desk/G1.4.
//
// From G1.4 Desk keeps nothing in its own folder: it asks the desk server
// (process/js/desk) through jobs.api on the loopback door (D4). A suite that
// mounts Desk hands it this as `api.verb`, so it answers as the real server
// does: the same verbs, the same shapes, the same bound (appClient.ANSWER_MAX
// less 512, newest first, partial when cut), and it records every call so a
// suite can see what Desk asked for.
//
//   const fake = require('./deskFake.js').create(lines);   // lines: row objects
//   api.verb = fake.verb;
//   fake.calls   -> [{server, verb, args}]
//   fake.hold(pred) holds every call pred accepts until fake.release()
//   fake.backup  -> {lastCheck, lastCopy, lastError}, what backup answers

const appClient = require('../run/js/appClient.js');

const ROOM = appClient.ANSWER_MAX - 512;

function create(rows) {
  const lines = (rows || []).map(function (r) { return typeof r === 'string' ? JSON.parse(r) : r; });
  const docs = { state: '', seen: '' };
  const voice = [];
  const calls = [];
  const held = [];
  let holding = null;
  const fake = { lines: lines, docs: docs, voice: voice, calls: calls, backup: { lastCheck: '', lastCopy: '', lastError: '' } };

  function search(a) {
    a = a || {};
    const hits = lines.filter(function (m) {
      // '-' is a line with no todo: an agent's direct chat (wsl-claude, G1.4).
      if (a.todo === '-') { if (m.todo) return false; } else if (a.todo && m.todo !== a.todo) return false;
      if (a.kind && m.kind !== a.kind) return false;
      if (a.since && !(String(m.at) >= a.since)) return false;
      if (a.before && !(String(m.at) < a.before)) return false;
      if (a.text && String(m.text || '').indexOf(a.text) === -1) return false;
      return true;
    }).sort(function (x, y) { return x.at < y.at ? 1 : x.at > y.at ? -1 : (x.key < y.key ? 1 : -1); });
    const out = [];
    let bytes = 2;
    let partial = false;
    for (const m of hits) {
      const json = JSON.stringify(m);
      const cost = Buffer.byteLength(json, 'utf8') + 3;
      if (bytes + cost > ROOM) { partial = true; break; }
      out.push(json);
      bytes += cost;
    }
    return { lines: out, partial: partial };
  }
  const desk = {
    'log.add': function (a) {
      const m = JSON.parse(a.json);
      if (lines.some(function (l) { return l.key === m.key; })) return { added: false };
      lines.push(m);
      return { added: true };
    },
    'log.search': search,
    'state.get': function () { return { json: docs.state }; },
    'state.set': function (a) { docs.state = a.json; return { saved: true }; },
    'seen.get': function () { return { json: docs.seen }; },
    'seen.set': function (a) { docs.seen = a.json; return { saved: true }; },
    'voice.add': function (a) { voice.push({ text: a.text, day: a.day }); return { added: true }; },
    'pending.get': function () { return { items: [] }; },
  };
  const backup = { 'status.get': function () { return Object.assign({}, fake.backup); } };
  const servers = { desk: desk, backup: backup };

  function answer(server, verb, args) {
    const s = servers[server];
    if (!s || !s[verb]) return { status: 404, body: { ok: false, code: 'app-not-served', error: server + '.' + verb } };
    return { status: 200, body: s[verb](args || {}) };
  }
  // api.verb(name, body) -> {status, body}, as the shell's is.
  fake.verb = function (name, body) {
    if (name !== 'jobs.api' || !body || !body.ask || typeof body.ask !== 'object') {
      return Promise.resolve({ status: 200, body: {} });
    }
    const server = Object.keys(body.ask)[0];
    const verb = Object.keys(body.ask[server] || {})[0];
    const args = (body.ask[server] || {})[verb];
    const call = { server: server, verb: verb, args: args };
    calls.push(call);
    if (holding && holding(call)) {
      return new Promise(function (resolve) { held.push(function () { resolve(answer(server, verb, args)); }); });
    }
    return Promise.resolve(answer(server, verb, args));
  };
  fake.hold = function (pred) { holding = pred; };
  fake.release = function () { holding = null; held.splice(0).forEach(function (f) { f(); }); };
  fake.searches = function () { return calls.filter(function (c) { return c.server === 'desk' && c.verb === 'log.search'; }); };
  return fake;
}

// THE SUITES WRITTEN BEFORE G1.4 mounted Desk on a folder of files. This
// builds the fake from such a folder (log/log.json, seen.json, state.json)
// and keeps the folder in step with every call, so a suite that remounts
// from it, or reads seen.json back, goes on working unchanged.
function fromFiles(files) {
  let rows = [];
  try { rows = JSON.parse(files['log/log.json'] || '[]'); } catch (e) { rows = []; }
  const fake = create(rows);
  if (files['seen.json']) fake.docs.seen = files['seen.json'];
  if (files['state.json']) fake.docs.state = files['state.json'];
  const ask = fake.verb;
  fake.verb = function (name, body) {
    return ask(name, body).then(function (r) {
      files['log/log.json'] = JSON.stringify(fake.lines);
      if (fake.docs.seen) files['seen.json'] = fake.docs.seen;
      if (fake.docs.state) files['state.json'] = fake.docs.state;
      return r;
    });
  };
  return fake;
}

module.exports = { create: create, fromFiles: fromFiles, ROOM: ROOM };
