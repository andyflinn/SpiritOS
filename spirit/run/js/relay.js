'use strict';

// In-memory claimed presence + mailbox for --relay. Process lifetime only.
// Names are believed as sent. Duplicate name → 409.

var MAX_MESSAGES = 200;

function createRelay() {
  var peers = Object.create(null);
  var messages = [];
  var nextId = 1;

  function normalizeName(name) {
    if (typeof name !== 'string') return '';
    return name.trim();
  }

  function claim(name) {
    var n = normalizeName(name);
    if (!n) return { ok: false, status: 400, error: 'name required' };
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

  return { claim, who, send, inbox };
}

module.exports = { createRelay };