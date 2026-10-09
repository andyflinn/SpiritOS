'use strict';

// spirit/run/js/introSpector.js
// THE AGENTS FAMILY, ON BOTH DOORS — goal/G10.5.
//
//   Andy, 2026-10-09: "the verb-file should be readable/fetchable by the
//   loopback client through a multiplexed AGENTS interface"; "plus one verb
//   AGENTS.introspect that will return only the verbs available?"; ".. and if
//   there's no AGENTS.md the verb is closed for the agent, period."; "this way
//   we can slowly add verbs that are agent-safe"; "that is a decision. make
//   it so."
//
// ONE FOLDER PER MODULE holds AGENTS.md and one file per allowed verb. The
// file is the description AND the allow mark: no AGENTS.md, or no file for a
// verb, and that verb is closed to agents, never listed. The owner keeps
// every verb; nothing here gates a call (routing and handlers are untouched,
// by his decision). What this adds is what an agent may be TOLD:
//
//   AGENTS             {} -> {text}: the AGENTS.md, read on every ask
//   AGENTS.introspect  {} -> {items: [{key: verb, label: description}], more}:
//                      the verbs that have a file, through the shared bucket
//   AGENTS.<verb>      {} -> the verb's file as it stands on disc, read on
//                      every ask; on the node joined with the declaration's
//                      request and reply prototypes (point 4 of the box)
//
// ON A PROCESS SERVER the folder is the script's own, the verb name is the
// file name as is (item.add.json -> AGENTS.item.add), and appServer adds the
// family at start, as it adds DEBUG and DEPENDENCIES (withAgents). ON THE
// NODE the namespace is the folder (js/fs/) and the file name has no dot
// (stat.json -> fs.AGENTS.stat): claim() below takes a namespace in the
// declaration form, hands the lowercase handlers to verbTable as before, and
// alone adds the uppercase set, which no module can claim (verbTable's rule).
// So an uppercase verb is always the system's, told apart by the name.
//
// WHICH .json FILES ARE VERB FILES: one whose name is a verb name, that is
// not the server's manifest (<script>.json), and that parses to an object
// with a string `description`. A folder holds other json (currentGoal.json
// beside the desk, loop.json beside deskUnsloth, package.json), and none of
// those is a verb. A verb file naming a verb nobody declared is said at
// boot, by file name, so a typo is found the day it is made.

const fs = require('fs');
const path = require('path');

const AGENTS_FILE = 'AGENTS.md';
const INTROSPECT = 'introspect';
// A verb name as appServer takes it, without the family's own uppercase.
const STEM_RE = /^[a-z_][A-Za-z0-9_.-]{0,63}$/;

function isPlain(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

function refusal(code, extra) {
  const e = new Error(code);
  e.refusal = code;
  if (extra) e.extra = extra;
  return e;
}

// The room one answer has: appClient's, read at the ask, since appClient
// requires this file's neighbours.
function room() { return require('./appClient').ANSWER_MAX; }

// The verb files of a folder: {stem: fileName}, and the files that name no
// declared verb. `declared` is the list of verb names the module answers,
// each as the file's stem names it (with the namespace prefix stripped on
// the node, where the folder is the namespace).
function readFolder(dir, declared, manifest) {
  const out = { files: Object.create(null), stale: [] };
  let names = [];
  try { names = fs.readdirSync(dir); } catch (e) { return out; }
  names.sort().forEach(function (name) {
    if (!/\.json$/.test(name) || name === manifest) return;
    const stem = name.slice(0, -5);
    if (!STEM_RE.test(stem)) return;
    let parsed = null;
    try { parsed = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')); } catch (e) { parsed = null; }
    if (!isPlain(parsed) || typeof parsed.description !== 'string') return;
    if (declared.indexOf(stem) === -1) { out.stale.push(name); return; }
    out.files[stem] = name;
  });
  return out;
}

// THE FAMILY OF ONE FOLDER, in the declaration form {request, reply, handler}.
// opts: { declared: [stem...], manifest, prefix, declarations }
//   prefix        '' on a process server, 'fs.' on the node: it goes before
//                 every verb name the family answers and lists
//   declarations  {verb: {request, reply}} on the node, joined into the
//                 per-verb answer; a process server's file answers as is
// Answers { verbs: {name: declaration}, stale: [fileName] }; no AGENTS.md,
// no verbs at all, and nothing is said of the folder.
function family(dir, opts) {
  const o = opts || {};
  const prefix = String(o.prefix || '');
  const agentsFile = path.join(dir, AGENTS_FILE);
  const verbs = Object.create(null);
  if (!fs.existsSync(agentsFile)) return { verbs: verbs, stale: [] };
  const folder = readFolder(dir, o.declared || [], o.manifest || '');
  const stems = Object.keys(folder.files).sort();

  verbs[prefix + 'AGENTS'] = {
    request: {}, reply: { text: '' },
    handler: function () {
      const text = fs.readFileSync(agentsFile, 'utf8');
      // Refused by name, never cut (slim/G1.8 T4).
      if (Buffer.byteLength(JSON.stringify({ text: text }), 'utf8') > room()) throw refusal('answer-too-large');
      return { text: text };
    },
  };

  // A LIST IS A SEARCH (puppets/G2): the shared bucket, an empty question, cut
  // in bytes to one answer, `more` saying so.
  verbs[prefix + 'AGENTS.' + INTROSPECT] = {
    request: {}, reply: { items: [{ key: '', label: '' }], more: false },
    handler: function () {
      const bucket = require('./searchBucket').createSearch({
        query: '*', maxBytes: room() - 512,
        getLabelStringFromIncomingObject: function (pair) { return pair.label; },
        extractKeyAndLabelFromRow: function (pair) { return pair; },
      });
      for (const stem of stems) {
        let label = '';
        try { label = String(JSON.parse(fs.readFileSync(path.join(dir, folder.files[stem]), 'utf8')).description || ''); } catch (e) { continue; }
        if (!bucket.offer({ key: prefix + stem, label: label })) break;
      }
      return bucket.getResult();
    },
  };

  stems.forEach(function (stem) {
    const file = path.join(dir, folder.files[stem]);
    const decl = o.declarations && isPlain(o.declarations[prefix + stem]) ? o.declarations[prefix + stem] : null;
    verbs[prefix + 'AGENTS.' + stem] = {
      request: {}, reply: {},
      handler: function () {
        let parsed = null;
        try { parsed = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { parsed = null; }
        if (!isPlain(parsed)) throw refusal('handler-failed', { why: folder.files[stem] + ' is no longer a verb file' });
        const answer = Object.assign({}, parsed);
        if (decl) {
          if (!('request' in answer)) answer.request = decl.request;
          if (!('reply' in answer)) answer.reply = decl.reply;
        }
        if (Buffer.byteLength(JSON.stringify(answer), 'utf8') > room()) throw refusal('answer-too-large');
        return answer;
      },
    };
  });
  return { verbs: verbs, stale: folder.stale };
}

// ── THE NODE: A NAMESPACE IN THE DECLARATION FORM ───────────────────────
//
// claim(table, namespace, by, declarations, opts) replaces the registration
// of core-module verbs (the box, point 1): each verb is {request, reply,
// handler}, the handler the (req, res) function it always was, handed to
// verbTable.claim unchanged so routing is untouched. Then the family of
// js/<namespace>/ is added through verbTable.reserve, the one way an
// uppercase verb reaches the table, as a (req, res) handler each: the
// loopback door calls every handler alike.
function checkDeclarations(namespace, declarations) {
  if (!isPlain(declarations)) throw new Error('introSpector: ' + namespace + ' declared nothing');
  Object.keys(declarations).forEach(function (name) {
    const d = declarations[name];
    if (!isPlain(d) || typeof d.handler !== 'function' || !isPlain(d.request) || !('reply' in d)) {
      throw new Error('introSpector: verb "' + name + '" needs request (an object), reply and handler');
    }
  });
}

// THE BODY THE DOOR ALREADY READ: the loopback door peeks the verb through serveCommon.readJsonBody, which keeps its
// promise on the request, so the same call here answers at once. A second reader on the stream would wait for an end
// that has already passed (found on a planted node, 2026-10-09: every family ask hung and the client saw no answer).
function readBody(rq) {
  return require('./serveCommon').readJsonBody(rq);
}

// A declaration's handler as the loopback door calls one: the body in, the
// verb's own fields alone to the handler, its answer out as JSON; a refusal
// the catalogue knows by its code and status.
function asDoorHandler(name, decl) {
  return function (rq, rs) {
    function send(status, body) {
      rs.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      rs.end(JSON.stringify(body));
    }
    return readBody(rq).then(function (body) {
      const args = {};
      if (isPlain(body)) Object.keys(body).forEach(function (k) { if (k !== 'verb') args[k] = body[k]; });
      return Promise.resolve().then(function () { return decl.handler(args); });
    }).then(function (reply) {
      send(200, reply);
    }, function (e) {
      const errors = require('./spiritErrors');
      const known = e && typeof e.refusal === 'string' ? errors.byCode(e.refusal) : null;
      if (known) return send(known.status, Object.assign({ ok: false, code: e.refusal, error: known.text, verb: name }, e.extra && isPlain(e.extra) ? { extra: e.extra } : {}));
      if (e instanceof SyntaxError) return send(400, { ok: false, code: 'bad-request', error: 'Invalid JSON body', verb: name });
      send(500, { ok: false, code: 'handler-failed', error: 'the handler failed', verb: name });
    });
  };
}

function claim(table, namespace, by, declarations, opts) {
  const ns = String(namespace || '');
  checkDeclarations(ns, declarations);
  const group = {};
  Object.keys(declarations).forEach(function (name) { group[name] = declarations[name].handler; });
  table.claim(ns, by, group, opts);

  const dir = path.join(__dirname, ns);
  const declared = Object.keys(declarations).map(function (name) { return name.slice(ns.length + 1); });
  const made = family(dir, { declared: declared, prefix: ns + '.', declarations: declarations });
  made.stale.forEach(function (file) {
    console.error('introSpector: js/' + ns + '/' + file + ' names a verb this node does not claim');
  });
  const names = Object.keys(made.verbs);
  if (!names.length) return true;
  const reserved = {};
  names.forEach(function (name) { reserved[name] = asDoorHandler(name, made.verbs[name]); });
  table.reserve(ns, reserved);
  return true;
}

module.exports = { family: family, claim: claim, AGENTS_FILE: AGENTS_FILE };
