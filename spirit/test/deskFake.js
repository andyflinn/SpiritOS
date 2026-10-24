'use strict';

// spirit/test/deskFake.js
// A DESK SERVER IN MEMORY, FOR THE SUITES THAT MOUNT DESK — desk/G1.4.
//
// From G1.4 Desk keeps nothing in its own folder: it asks the desk server
// (process/js/desk) by its verbs on the loopback door (D4), desk.<verb> on the
// flat apiDoor since goal/G30.6. A suite that
// mounts Desk hands it this as `api.verb`, so it answers as the real server
// does: the same verbs, the same shapes, the same bound (appClient.ANSWER_MAX
// less 512, newest first, in the shared {items, more}), and it records every call so a
// suite can see what Desk asked for.
//
//   const fake = require('./deskFake.js').create(lines);   // lines: row objects
//   api.verb = fake.verb;
//   fake.calls   -> [{server, verb, args}]
//   fake.hold(pred) holds every call pred accepts until fake.release()
//   fake.backup  -> {lastCheck, lastCopy, lastError}, what backup answers
//   fake.items   -> the item labels (objects) items.search answers, as the
//                   server's facts (desk/G2.6); a press is recorded in calls

const appClient = require('../run/spirit/appClient.js');

const createProbabilityBucket = require('../run/spirit/probabilityBucket.js').createProbabilityBucket;

const ROOM = appClient.ANSWER_MAX - 512;

function create(rows) {
  const lines = (rows || []).map(function (r) { return typeof r === 'string' ? JSON.parse(r) : r; });
  // goal/G33.7: the docs table and state went; seen is one value per item. The fake keeps the group chat's (goal/G0)
  // as the page's own seen document, {team}, so a suite that plants seen.json goes on working.
  const docs = { seen: '' };
  const voice = [];
  const calls = [];
  const held = [];
  let holding = null;
  const fake = { lines: lines, docs: docs, voice: voice, calls: calls, backup: { lastCheck: '', lastCopy: '', lastError: '' }, pending: {}, items: [], groupChat: [] };

  // As the real server walks (desk.js walked, slim/G1.2): one bucket,
  // '**', a line too big to be sent alone skipped and said by `more`.
  function walked(walk, pairOf) {
    // goal/G29.22: the probability bucket, as desk.js walked() is now; probability 0 keeps the walk's order.
    const bucket = createProbabilityBucket(Infinity);
    let skipped = false;
    for (const obj of walk) {
      const p = pairOf(obj);
      if (Buffer.byteLength(JSON.stringify({ items: [p], more: false }), 'utf8') > ROOM) { skipped = true; continue; }
      bucket.seatFor(0, p);
    }
    const r = bucket.serialize(null, ROOM);
    return { items: r.items, more: !!r.more || skipped };
  }
  const desk = {
    // log.add, log.search and pending.get went with goal/G33.4, as on the real server.
    // state.get and state.set went with goal/G33.7, as on the real server; seen is seen.get {id} -> {at}, seen.set {id, at}.
    'seen.get': function (a) {
      if (a.id !== 'goal/G0') return { at: '' };
      let held = null; try { held = JSON.parse(docs.seen || 'null'); } catch (e) { held = null; }
      return { at: held && Number(held.team) > 0 ? new Date(Number(held.team)).toISOString() : '' };
    },
    'seen.set': function (a) {
      if (a.id === 'goal/G0') docs.seen = JSON.stringify({ team: Date.parse(a.at) || 0 });
      return { change: calls.length };
    },
    'voice.add': function (a) { voice.push({ text: a.text, day: a.day }); return { added: true }; },
    // The List's two verbs (desk/G2.6): the facts, and a press the server takes.
    'items.search': function () { return walked(fake.items, function (i) { return { key: String(i.id), label: JSON.stringify(i) }; }); },
    'press': function () { return { change: calls.length }; },
    // The group chat (goal/G3.10): the real server holds the standing goal goal/G0 (goal/G33.4: goal 0) from its start, so the
    // fake does too. fake.groupChat: its lines, oldest first; a chat.add on it is his line.
    'item.chat': function (a) { return { chat: a.id === 'goal/G0' ? fake.groupChat.slice() : [], chatMore: false }; },
    'chat.add': function (a) {
      if (a.id === 'goal/G0') fake.groupChat.push({ by: 'andy', at: new Date().toISOString(), text: String(a.text), taken: '' });
      return { change: calls.length };
    },
  };
  const backup = { 'status.get': function () { return Object.assign({}, fake.backup); } };
  const servers = { desk: desk, backup: backup };
  // goal/G8.11: fake.verifier, when a suite sets it, is a deskVerify on the node ({verb: fn}); null, none runs there.
  fake.verifier = null;

  function answer(server, verb, args) {
    const s = server === 'deskVerify' ? fake.verifier : servers[server];
    if (!s || !s[verb]) return { status: 404, body: { ok: false, code: 'app-not-served', error: server + '.' + verb } };
    return { status: 200, body: s[verb](args || {}) };
  }
  // api.verb(name, body) -> {status, body}, as the shell's is. A server's verb comes by name, '<server>.<verb>' with
  // its args as the body (goal/G30.6); the server is the part before the FIRST dot. Anything else (the tree, a node
  // verb) is answered empty, as before.
  fake.verb = function (name, body) {
    const n = String(name || '');
    const dot = n.indexOf('.');
    const server = dot > 0 ? n.slice(0, dot) : '';
    if (!server || !(server === 'deskVerify' || servers[server])) {
      return Promise.resolve({ status: 200, body: {} });
    }
    const verb = n.slice(dot + 1);
    const args = body;
    const call = { server: server, verb: verb, args: args };
    calls.push(call);
    if (holding && holding(call)) {
      return new Promise(function (resolve) { held.push(function () { resolve(answer(server, verb, args)); }); });
    }
    return Promise.resolve(answer(server, verb, args));
  };
  fake.hold = function (pred) { holding = pred; };
  fake.release = function () { holding = null; held.splice(0).forEach(function (f) { f(); }); };
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
  const ask = fake.verb;
  fake.verb = function (name, body) {
    return ask(name, body).then(function (r) {
      files['log/log.json'] = JSON.stringify(fake.lines);
      if (fake.docs.seen) files['seen.json'] = fake.docs.seen;
      return r;
    });
  };
  return fake;
}

module.exports = { create: create, fromFiles: fromFiles, ROOM: ROOM };
