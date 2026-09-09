'use strict';

// A personal archive of conversations, on THIS node (CYCLE-CHAT-5.1.md).
//
// The mailbox stores messages by recipient: an inbox read returns what
// was said TO you and never what you said, and spirit-3 grows no sender
// copy. So if this node does not write a line down, that line stops
// existing when the page reloads.
//
// One file per peer, named by the peer's whole public key through
// js/peerFile.js — never a label, never a tail. What goes in the file is
// an archive, not a mailbox dump:
//
//   { "peerPublicKey": "<full key>",
//     "blocked": false,
//     "entries": [ { "dir": "sent"|"received", "at": "...", "text": "..." } ] }
//
// `blocked` is CHAT's refusal of that peer, and it lives here because
// this is chat's own file. It is not the node's block: whoBook's
// `blocked` makes listens() false and the inbox stops accepting them at
// all, and that switch belongs to Contacts. This one only decides what
// this app shows — their lines keep arriving on every inbox read and
// keep being written into this very file, so unblocking finds the whole
// backlog rather than a conversation with a hole in it.
//
// The two are deliberately not one switch, and neither undoes the other:
// you may lift what you decided, not what somebody else decided.
//
// An older file has no such field and parses as false, which is what it
// was.
//
// The mailbox's own message id is useful in memory and is deliberately
// not persisted: an archive of a conversation should still make sense
// when the mailbox that carried it is gone. Which means dedupe across a
// reload is on what a line IS — direction, time, text — and two truly
// identical lines sent in the same millisecond count as one. That is the
// price of a thin record, and it is the right way round.
//
// Every peer is filed the same way — a friend, yourself, the mailbox.
// The reserved name `relay` is a caption, not an identity, so the
// mailbox has a key of its own (made on its first --relay boot, handed
// out by who and status) and its conversation lives under that key.
// A peer with no key gets no file at all: no relay.json, no tail.
//
// Isomorphic like ownerBadge.js: names, shapes and merging live here,
// the filesystem stays with the caller. Relay Chat holds the files
// through its own scoped api.fs.

var CHAT_LOG_DIR = 'logs/';

// How many entries a peer's file keeps. An archive that grows without
// bound is one that eventually costs a second to open; a thread shows
// the newest.
var CHAT_LOG_CAP = 500;

var chatLogPeerFile = (typeof require === 'function' && typeof module !== 'undefined')
  ? require('./peerFile')
  : (typeof window !== 'undefined' ? window.spiritPeerFile : null);

// Only a key names a file. Everything else — the reserved mailbox row, a
// peer the mailbox has no key for — is not written down at all.
function chatLogIsLoggable(publicKey) {
  var key = String(publicKey == null ? '' : publicKey).trim();
  if (!key) return false;
  if (key === 'relay') return false;
  return !!chatLogPeerFile.nameFromKey(key);
}

function chatLogFileFor(publicKey) {
  if (!chatLogIsLoggable(publicKey)) return '';
  return CHAT_LOG_DIR + chatLogPeerFile.fileName(publicKey);
}

// Whose conversation a message belongs to: the other party's KEY,
// whichever end this node was.
//
// Direction is PROVENANCE, never inference. A sent line is one the relay
// answered 201 to; a received line came out of an inbox read. Deciding
// it by `from === myLabel` instead gets a note to yourself wrong — both
// copies look sent, and the received half vanishes, though it is a real
// event: the mailbox delivered it.
//
// `mailboxKey` is how the mailbox itself gets filed. `relay` is the
// caption it answers to; the key beside it in `who` is the identity, and
// it is the MAILBOX's key, never the owner's — the owner is a peer who
// claimed, the mailbox is the box. Without one there is no file: no
// relay.json, no tail, nothing invented.
function chatLogPeerKeyFor(message, dir, mailboxKey) {
  if (!message) return '';
  var reservedEnd = dir === 'sent' ? message.to : message.from;
  var key = dir === 'sent' ? message.toKey : message.fromKey;
  if (!key && reservedEnd === 'relay') key = mailboxKey;
  return chatLogIsLoggable(key) ? String(key) : '';
}

// The thin record. Nothing of the mailbox survives into it but the time
// and the words — and the direction, which is what makes a conversation
// readable rather than a pile of lines.
function chatLogEntryFor(message, dir) {
  if (!message) return null;
  return {
    dir: dir === 'sent' ? 'sent' : 'received',
    at: String(message.sentAt || ''),
    text: String(message.text == null ? '' : message.text),
  };
}

// What an entry IS, for dedupe. Not the mailbox id: that is not in the
// file, on purpose.
function chatLogKeyOf(entry) {
  return [
    (entry && entry.dir) || '',
    (entry && entry.at) || '',
    (entry && entry.text) || '',
  ].join('\u0000');
}

function chatLogMerge(existing, incoming, cap) {
  var limit = cap || CHAT_LOG_CAP;
  var seen = Object.create(null);
  var rows = [];

  function take(list) {
    (Array.isArray(list) ? list : []).forEach(function (entry) {
      if (!entry) return;
      var key = chatLogKeyOf(entry);
      if (seen[key]) return;
      seen[key] = true;
      rows.push({ dir: entry.dir, at: entry.at, text: entry.text });
    });
  }

  take(existing);
  take(incoming);

  rows.sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); });
  return rows.length > limit ? rows.slice(rows.length - limit) : rows;
}

// Parsed defensively: this is a plain file on a disk, and a shell that
// cannot open a chat because one archive went malformed is a bad trade.
function chatLogParse(raw) {
  if (raw == null) return { peerPublicKey: '', blocked: false, entries: [] };
  try {
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { peerPublicKey: '', blocked: false, entries: [] };
    return {
      peerPublicKey: String(parsed.peerPublicKey || ''),
      blocked: !!parsed.blocked,
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    };
  } catch (e) {
    return { peerPublicKey: '', blocked: false, entries: [] };
  }
}

function chatLogSerialize(publicKey, entries, blocked) {
  return JSON.stringify({
    peerPublicKey: String(publicKey || ''),
    blocked: !!blocked,
    entries: Array.isArray(entries) ? entries : [],
  }, null, 2);
}

var chatLogApi = {
  DIR: CHAT_LOG_DIR,
  CAP: CHAT_LOG_CAP,
  isLoggable: chatLogIsLoggable,
  fileFor: chatLogFileFor,
  peerKeyFor: chatLogPeerKeyFor,
  entryFor: chatLogEntryFor,
  keyOf: chatLogKeyOf,
  merge: chatLogMerge,
  parse: chatLogParse,
  serialize: chatLogSerialize,
};

if (typeof process !== 'undefined' && process.versions && process.versions.node) {
  module.exports = chatLogApi;
} else if (typeof window !== 'undefined') {
  window.spiritChatLog = chatLogApi;
}
