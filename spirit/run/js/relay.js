'use strict';

const fs = require('fs');
const path = require('path');
const auth = require('./relayAuth');

var MAX_MESSAGES = 200;
var MAX_TEXT = 1024;
var NAME_RE = /^[A-Za-z0-9._-]{1,32}$/;
var CLAIM_PER_MIN = 10;
var SEND_PER_MIN = 30;
var WINDOW_MS = 60 * 1000;
var RATE_KEY_SWEEP_AT = 1000;

var ROOT_DIR = path.join(__dirname, '..');
var STATE_FILE = path.join(ROOT_DIR, 'relay-state', 'mailbox.json');

function loadMailbox() {
  try {
    var raw = fs.readFileSync(STATE_FILE, 'utf8');
    var parsed = JSON.parse(raw);
    var peers = Object.create(null);
    if (parsed && parsed.peers && typeof parsed.peers === 'object') {
      Object.keys(parsed.peers).forEach(function (k) {
        peers[k] = parsed.peers[k];
      });
    }
    return {
      peers: peers,
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      nextId: Number(parsed.nextId) > 0 ? Number(parsed.nextId) : 1,
    };
  } catch (e) {
    return { peers: Object.create(null), messages: [], nextId: 1 };
  }
}

function saveMailbox(peers, messages, nextId) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify({
    nextId: nextId,
    peers: peers,
    messages: messages,
  }));
}

function createRelay() {
  var loaded = loadMailbox();
  var peers = loaded.peers;
  var messages = loaded.messages;
  var nextId = loaded.nextId;
  var allow = auth.loadAllow(ROOT_DIR);
  var claimHits = Object.create(null);
  var sendHits = Object.create(null);

  function persist() {
    saveMailbox(peers, messages, nextId);
  }

  // Drops every key whose window has fully expired. Without this the
  // buckets only ever grew: one entry per distinct key, kept forever, on a
  // box with about a gigabyte of RAM.
  function sweep(bucket) {
    var now = Date.now();
    Object.keys(bucket).forEach(function (k) {
      var kept = bucket[k].filter(function (t) { return now - t < WINDOW_MS; });
      if (kept.length === 0) delete bucket[k];
      else bucket[k] = kept;
    });
  }

  // `key` is the CALLER, not the name the caller claims to be. Keying on
  // the claimed name made the limit meaningless: 30 sends per minute per
  // name, with the name chosen by the sender, is 30 per minute per made-up
  // string — rotate it and the budget resets, which is exactly what an
  // abuser does and never what a real client does. An unidentified caller
  // (a direct in-process call, no socket) shares one bucket rather than
  // getting a free pass.
  function rateOk(bucket, key, limit) {
    if (Object.keys(bucket).length > RATE_KEY_SWEEP_AT) sweep(bucket);
    var now = Date.now();
    var k = key || '(unidentified)';
    var list = (bucket[k] || []).filter(function (t) { return now - t < WINDOW_MS; });
    if (list.length >= limit) {
      bucket[k] = list;
      return false;
    }
    list.push(now);
    bucket[k] = list;
    return true;
  }

  function normalizeName(name) {
    if (typeof name !== 'string') return '';
    return name.trim();
  }

  function nameOk(n) {
    return !!n && NAME_RE.test(n);
  }

  function who() {
    return Object.keys(peers).sort().map(function (k) { return peers[k]; });
  }

  function claim(name, sig, clientKey) {
    var n = normalizeName(name);
    if (!nameOk(n)) return { ok: false, status: 400, error: 'bad name' };
    if (!rateOk(claimHits, clientKey, CLAIM_PER_MIN)) {
      return { ok: false, status: 429, error: 'too many claims' };
    }
    var gate = auth.checkClaim(allow, n, sig);
    if (!gate.ok) return gate;
    if (peers[n]) return { ok: false, status: 409, error: 'name already claimed', peer: peers[n] };
    var peer = { name: n, claimedAt: new Date().toISOString() };
    peers[n] = peer;
    persist();
    return { ok: true, status: 201, peer: peer };
  }

  function send(from, to, text, sig, clientKey) {
    var f = normalizeName(from);
    var t = normalizeName(to);
    if (!nameOk(f) || !nameOk(t)) {
      return { ok: false, status: 400, error: 'bad name' };
    }
    if (typeof text !== 'string' || !text.trim()) {
      return { ok: false, status: 400, error: 'text required' };
    }
    if (text.length > MAX_TEXT) {
      return { ok: false, status: 400, error: 'text too long' };
    }
    if (!rateOk(sendHits, clientKey, SEND_PER_MIN)) {
      return { ok: false, status: 429, error: 'too many sends' };
    }
    var gate = auth.checkSend(allow, f, sig, t, text);
    if (!gate.ok) return gate;
    var msg = {
      id: String(nextId++),
      from: f,
      to: t,
      text: text,
      sentAt: new Date().toISOString()
    };
    messages.push(msg);
    if (messages.length > MAX_MESSAGES) {
      messages = messages.slice(messages.length - MAX_MESSAGES);
    }
    persist();
    return { ok: true, status: 201, message: msg };
  }

  function inbox(name, sig) {
    var n = normalizeName(name);
    if (!n) return { ok: false, status: 400, error: 'name required' };
    if (!nameOk(n)) return { ok: false, status: 400, error: 'bad name' };
    var gate = auth.checkInbox(allow, n, sig);
    if (!gate.ok) return gate;
    return {
      ok: true,
      status: 200,
      messages: messages.filter(function (m) { return m.to === n; })
    };
  }

  return { claim: claim, who: who, send: send, inbox: inbox };
}

module.exports = { createRelay: createRelay };
