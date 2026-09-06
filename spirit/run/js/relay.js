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

function stateFile(rootDir) {
  return path.join(rootDir, 'relay-state', 'mailbox.json');
}

function loadMailbox(rootDir) {
  try {
    var raw = fs.readFileSync(stateFile(rootDir), 'utf8');
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

function saveMailbox(rootDir, peers, messages, nextId) {
  fs.mkdirSync(path.dirname(stateFile(rootDir)), { recursive: true });
  fs.writeFileSync(stateFile(rootDir), JSON.stringify({
    nextId: nextId,
    peers: peers,
    messages: messages,
  }));
}

function createRelay(rootDir) {
  rootDir = rootDir || path.join(__dirname, '..');
  var loaded = loadMailbox(rootDir);
  var peers = loaded.peers;
  var messages = loaded.messages;
  var nextId = loaded.nextId;
  var allow = auth.loadAllow(rootDir);
  var claimHits = Object.create(null);
  var sendHits = Object.create(null);

  function persist() {
    saveMailbox(rootDir, peers, messages, nextId);
  }

  function reloadAllow() {
    allow = auth.loadAllow(rootDir);
  }

  function rateOk(bucket, key, limit) {
    var now = Date.now();
    var list = (bucket[key] || []).filter(function (t) { return now - t < WINDOW_MS; });
    if (list.length >= limit) {
      bucket[key] = list;
      return false;
    }
    list.push(now);
    bucket[key] = list;
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

  function snapshot() {
    return {
      owner: auth.ownerName(allow),
      mode: allow.mode,
      reserved: auth.RESERVED_NAME,
      peers: who(),
      messages: messages.length,
    };
  }

  function becomeOwner(name, publicKey) {
    auth.writeAllowKeys(rootDir, [{ name: name, publicKey: publicKey }]);
    reloadAllow();
  }

  function claim(name, sig, publicKey, clientKey) {
    var n = normalizeName(name);
    if (!nameOk(n)) return { ok: false, status: 400, error: 'bad name' };
    if (n === auth.RESERVED_NAME) {
      return { ok: false, status: 400, error: 'name reserved' };
    }
    if (!rateOk(claimHits, clientKey || n, CLAIM_PER_MIN)) {
      return { ok: false, status: 429, error: 'too many claims' };
    }

    var pending = auth.loadPendingOwner(rootDir);
    var firstOwner = Object.keys(peers).length === 0 &&
      (pending || allow.mode === 'open');
    if (pending && n !== pending) {
      return { ok: false, status: 403, error: 'name not allowed' };
    }
    if (firstOwner) {
      if (!publicKey || !sig) {
        return { ok: false, status: 400, error: 'first claim needs publicKey and sig' };
      }
      if (!auth.verify(publicKey, auth.claimMessage(n), sig)) {
        return { ok: false, status: 403, error: 'bad claim signature' };
      }
      becomeOwner(n, publicKey);
      auth.clearPendingOwner(rootDir);
    } else {
      var gate = auth.checkClaim(allow, n, sig);
      if (!gate.ok) return gate;
    }

    if (peers[n]) return { ok: false, status: 409, error: 'name already claimed', peer: peers[n] };
    var peer = { name: n, claimedAt: new Date().toISOString(), owner: firstOwner };
    peers[n] = peer;
    persist();
    return { ok: true, status: 201, peer: peer, owner: firstOwner };
  }

  function replyFromRelay(to, text) {
    var msg = {
      id: String(nextId++),
      from: auth.RESERVED_NAME,
      to: to,
      text: text,
      sentAt: new Date().toISOString()
    };
    messages.push(msg);
    if (messages.length > MAX_MESSAGES) {
      messages = messages.slice(messages.length - MAX_MESSAGES);
    }
    persist();
    return msg;
  }

  function send(from, to, text, sig) {
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
    if (!rateOk(sendHits, f, SEND_PER_MIN)) {
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
    if (t === auth.RESERVED_NAME) {
      var snap = snapshot();
      replyFromRelay(f, 'relay status mode=' + snap.mode +
        ' owner=' + (snap.owner || '-') +
        ' peers=' + snap.peers.length +
        ' messages=' + snap.messages);
    }
    return { ok: true, status: 201, message: msg };
  }

  function inbox(name) {
    var n = normalizeName(name);
    if (!n) return { ok: false, status: 400, error: 'name required' };
    if (!nameOk(n)) return { ok: false, status: 400, error: 'bad name' };
    return {
      ok: true,
      status: 200,
      messages: messages.filter(function (m) { return m.to === n; })
    };
  }

  function status(name, sig) {
    var n = normalizeName(name);
    var gate = auth.checkOwner(allow, n, sig);
    if (!gate.ok) return gate;
    return { ok: true, status: 200, report: snapshot() };
  }

  return {
    claim: claim,
    who: who,
    send: send,
    inbox: inbox,
    status: status,
    snapshot: snapshot,
  };
}

module.exports = { createRelay: createRelay };
