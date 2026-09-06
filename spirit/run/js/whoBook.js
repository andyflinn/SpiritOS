'use strict';

// Perception only. Lives on a personal node, never on the VPS.
//   relay-state/who.json
// [
//   { "publicKey": "...", "publicLabel": "john", "myLabel": "lovelyJohn" }
// ]
// The wire still uses whatever the mailbox understands (today: public
// labels). This book is how 65432 shows and types To.

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

function upsert(rootDir, row) {
  if (!row || !row.publicKey) throw new Error('publicKey required');
  const publicLabel = String(row.publicLabel || '').trim();
  const myLabel = String(row.myLabel || publicLabel || '').trim();
  const rows = load(rootDir);
  const i = rows.findIndex(function (r) { return r.publicKey === row.publicKey; });
  const next = { publicKey: row.publicKey, publicLabel: publicLabel, myLabel: myLabel };
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

// Handshake: public who row -> private book, myLabel starts as publicLabel.
function handshake(rootDir, peer) {
  if (!peer || !peer.publicKey) throw new Error('handshake needs publicKey');
  const existing = byPublicKey(rootDir, peer.publicKey);
  if (existing) {
    existing.publicLabel = peer.publicLabel || peer.name || existing.publicLabel;
    save(rootDir, load(rootDir).map(function (r) {
      return r.publicKey === existing.publicKey ? existing : r;
    }));
    return existing;
  }
  return upsert(rootDir, {
    publicKey: peer.publicKey,
    publicLabel: peer.publicLabel || peer.name || '',
    myLabel: peer.publicLabel || peer.name || '',
  });
}

module.exports = {
  load: load,
  upsert: upsert,
  setMyLabel: setMyLabel,
  byMyLabel: byMyLabel,
  byPublicKey: byPublicKey,
  handshake: handshake,
};
