'use strict';

const fs = require('fs');
const path = require('path');
const auth = require('./relayAuth');

var MAX_MESSAGES = 200;
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

  function persist() {
    saveMailbox(peers, messages, nextId);
  }

  function normalizeName(name) {
    if (typeof name !== 'string') return '';
    return name.trim();
  }

  function who() {
    return Object.keys(peers).sort().map(function (k) { return peers[k]; });
  }

  function claim(name, sig) {
    var n = normalizeName(name);
    var gate = auth.checkClaim(allow, n, sig);
    if (!gate.ok) return gate;
    if (peers[n]) return { ok: false, status: 409, error: 'name already claimed', peer: peers[n] };
    var peer = { name: n, claimedAt: new Date().toISOString() };
    peers[n] = peer;
    persist();
    return { ok: true, status: 201, peer: peer };
  }

  function send(from, to, text, sig) {
    var f = normalizeName(from);
    var t = normalizeName(to);
    if (!f || !t) return { ok: false, status: 400, error: 'from and to required' };
    if (typeof text !== 'string' || !text.trim()) {
      return { ok: false, status: 400, error: 'text required' };
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

  function inbox(name) {
    var n = normalizeName(name);
    if (!n) return { ok: false, status: 400, error: 'name required' };
    return {
      ok: true,
      status: 200,
      messages: messages.filter(function (m) { return m.to === n; })
    };
  }

  return { claim: claim, who: who, send: send, inbox: inbox };
}

module.exports = { createRelay: createRelay };
