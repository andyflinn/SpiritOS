'use strict';

const fs = require('fs');
const path = require('path');

var MAX_MESSAGES = 200;

function loadAllow(rootDir) {
  try {
    var raw = fs.readFileSync(path.join(rootDir, 'relay-state', 'allow.json'), 'utf8');
    var parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.names)) return parsed.names;
  } catch (e) { /* missing = open */ }
  return null;
}

function allowed(list, name) {
  if (list == null) return true;
  return list.indexOf(name) !== -1;
}

function createRelay() {
  var peers = Object.create(null);
  var messages = [];
  var nextId = 1;
  var allow = loadAllow(path.join(__dirname, '..'));

  function normalizeName(name) {
    if (typeof name !== 'string') return '';
    return name.trim();
  }

  function claim(name) {
    var n = normalizeName(name);
    if (!n) return { ok: false, status: 400, error: 'name required' };
    if (!allowed(allow, n)) return { ok: false, status: 403, error: 'name not allowed' };
    if (peers[n]) return { ok: false, status: 409, error: 'name already claimed', peer: peers[n] };
    var peer = { name: n, claimedAt: new Date().toISOString() };
    peers[n] = peer;
    return { ok: true, status: 201, peer };
  }

  function who() {
    return Object.keys(peers).sort().map(function (k) { return peers[k]; });
  }

  function send(from, to, text) {
    var f = normalizeName(from);
    var t = normalizeName(to);
    if (!f || !t) return { ok: false, status: 400, error: 'from and to required' };
    if (!allowed(allow, f)) return { ok: false, status: 403, error: 'from not allowed' };
    if (typeof text !== 'string' || !text.trim()) {
      return { ok: false, status: 400, error: 'text required' };
    }
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