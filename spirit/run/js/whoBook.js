'use strict';

// Perception only. Lives on a personal node, never on a --relay.
// File: <rootDir>/relay-state/who.json
//
// [
//   {
//     "publicKey": "...",
//     "publicLabel": "john",
//     "myLabel": "lovelyJohn",
//     "relays": ["http://127.0.0.1:65410"]
//   }
// ]
//
// Identity = publicKey.
// publicLabel = their caption on a mailbox (may collide, may change).
// myLabel = your caption (never uploaded).
// relays = mailboxes where you have seen this key.

const fs = require('fs');
const path = require('path');

function bookPath(rootDir) {
  return path.join(rootDir, 'relay-state', 'who.json');
}

function load(rootDir) {
  try {
    const parsed = JSON.parse(fs.readFileSync(bookPath(rootDir), 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function save(rootDir, rows) {
  fs.mkdirSync(path.join(rootDir, 'relay-state'), { recursive: true });
  fs.writeFileSync(bookPath(rootDir), JSON.stringify(rows, null, 2));
}

function normalizeRelays(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  list.forEach(function (url) {
    const u = String(url || '').replace(/\/+$/, '');
    if (u && out.indexOf(u) === -1) out.push(u);
  });
  return out;
}

function upsert(rootDir, row) {
  if (!row || !row.publicKey) throw new Error('publicKey required');
  const publicLabel = String(row.publicLabel || '').trim();
  const rows = load(rootDir);
  const i = rows.findIndex(function (r) { return r.publicKey === row.publicKey; });
  const prev = i === -1 ? { relays: [], myLabel: '' } : rows[i];
  const myLabel = String(
    row.myLabel != null ? row.myLabel : (prev.myLabel || publicLabel)
  ).trim();
  const next = {
    publicKey: row.publicKey,
    publicLabel: publicLabel,
    myLabel: myLabel,
    relays: normalizeRelays(row.relays != null ? row.relays : prev.relays),
  };
  if (i === -1) rows.push(next);
  else rows[i] = next;
  save(rootDir, rows);
  return next;
}

function setMyLabel(rootDir, publicKey, myLabel) {
  const rows = load(rootDir);
  const row = rows.find(function (r) { return r.publicKey === publicKey; });
  if (!row) return null;
  row.myLabel = String(myLabel || '').trim();
  save(rootDir, rows);
  return row;
}

function byMyLabel(rootDir, myLabel) {
  const want = String(myLabel || '').trim();
  return load(rootDir).filter(function (r) { return r.myLabel === want; });
}

function byPublicKey(rootDir, publicKey) {
  return load(rootDir).find(function (r) { return r.publicKey === publicKey; }) || null;
}

function handshake(rootDir, peer) {
  if (!peer || !peer.publicKey) throw new Error('handshake needs publicKey');
  const publicLabel = peer.publicLabel || peer.name || '';
  const existing = byPublicKey(rootDir, peer.publicKey);
  if (existing) {
    existing.publicLabel = publicLabel || existing.publicLabel;
    if (peer.relay) {
      existing.relays = normalizeRelays((existing.relays || []).concat([peer.relay]));
    }
    const rows = load(rootDir).map(function (r) {
      return r.publicKey === existing.publicKey ? existing : r;
    });
    save(rootDir, rows);
    return existing;
  }
  return upsert(rootDir, {
    publicKey: peer.publicKey,
    publicLabel: publicLabel,
    myLabel: publicLabel,
    relays: peer.relay ? [peer.relay] : [],
  });
}

function addRoute(rootDir, publicKey, relayUrl) {
  const url = String(relayUrl || '').replace(/\/+$/, '');
  if (!url) return null;
  const rows = load(rootDir);
  const row = rows.find(function (r) { return r.publicKey === publicKey; });
  if (!row) return null;
  row.relays = normalizeRelays((row.relays || []).concat([url]));
  save(rootDir, rows);
  return row;
}

module.exports = {
  load: load,
  upsert: upsert,
  setMyLabel: setMyLabel,
  byMyLabel: byMyLabel,
  byPublicKey: byPublicKey,
  handshake: handshake,
  addRoute: addRoute,
};
