'use strict';

// The mailbox answers words (CYCLE-RELAY-CONSOLE-IMPL.md).
//
// Reserved peer `relay` is a console: a human types a line in Relay Chat,
// the mailbox answers in the same thread. HTTP keeps its own answers —
// /api/relay/status and /api/hub/who are what the personal node and the
// harness use, and neither changes because of anything here.
//
// This module knows nothing. It opens no file, reads no allow list and
// decides no permission: `ctx.isOwner` arrives already decided by
// relay.js, which is the single authority on who the owner is. A second
// owner check in a second file is a second thing to get wrong, and the
// chat-to-relay census is a gate.
//
// Everything it can see is handed to it: the census, the peers, the
// invites, the clock, the caps, the version, and who is asking. That is
// what makes it testable without a mailbox, and what stops a command
// from reaching somewhere nobody meant it to.

var RELAY_CONSOLE_DEFAULT_ROWS = 20;
var RELAY_CONSOLE_DEFAULT_BYTES = 1500;

// Owner-only words. `help` and `whoami` are not here: help is how anyone
// finds out what they may type, and whoami answers only about the sender
// — a friend whose claim went wrong has no other way to ask "which key
// does this mailbox think I am".
var RELAY_CONSOLE_OWNER_WORDS = ['status', 'peers', 'search', 'invites', 'key', 'version'];
var RELAY_CONSOLE_PUBLIC_WORDS = ['help', 'whoami'];

function relayConsoleValue(source) {
  return typeof source === 'function' ? source() : source;
}

function relayConsoleCap(ctx) {
  var cap = (ctx && ctx.cap) || {};
  return {
    rows: cap.rows > 0 ? cap.rows : RELAY_CONSOLE_DEFAULT_ROWS,
    bytes: cap.bytes > 0 ? cap.bytes : RELAY_CONSOLE_DEFAULT_BYTES,
  };
}

// Rows, then bytes, and it says so when it cut. A reply with no cap is a
// reply bounded by how busy the mailbox is — on a box with a gigabyte of
// RAM that is not a bound at all, and `messages` is capped by count
// rather than by size.
function relayConsoleTrim(rows, cap) {
  var kept = [];
  var used = 0;
  var dropped = 0;

  for (var i = 0; i < rows.length; i++) {
    var line = String(rows[i]);
    var cost = line.length + 1;
    if (kept.length >= cap.rows || used + cost > cap.bytes) {
      dropped = rows.length - i;
      break;
    }
    kept.push(line);
    used += cost;
  }

  if (dropped > 0) kept.push('… ' + dropped + ' more');
  return kept.join('\n');
}

function relayConsoleWordsFor(isOwner) {
  return isOwner
    ? RELAY_CONSOLE_PUBLIC_WORDS.concat(RELAY_CONSOLE_OWNER_WORDS).sort()
    : RELAY_CONSOLE_PUBLIC_WORDS.slice().sort();
}

// A peer row, as `who` already publishes it: the public caption and
// whether a key is present. Never the whole key — a thread is not the
// place to publish everyone's identity — and never myLabel, which is
// perception and lives on a personal node the mailbox has never seen.
function relayConsolePeerLine(peer) {
  var label = String((peer && (peer.publicLabel || peer.name)) || '(unnamed)');
  var marks = [];
  if (peer && peer.publicKey) marks.push('key');
  if (peer && peer.owner) marks.push('owner');
  return marks.length ? label + '  [' + marks.join(', ') + ']' : label;
}

// A needle matches a caption anywhere in it, or the tail of a key if
// somebody pasted enough of one to mean it. Eight characters is the
// threshold: shorter than that, a "key tail" is a coincidence.
function relayConsoleMatches(peer, needle) {
  var n = String(needle || '').toLowerCase();
  if (!n) return false;
  var label = String((peer && (peer.publicLabel || peer.name)) || '').toLowerCase();
  if (label.indexOf(n) !== -1) return true;
  if (n.length >= 8) {
    var key = String((peer && peer.publicKey) || '').toLowerCase();
    if (key && key.indexOf(n) !== -1) return true;
  }
  return false;
}

// Live means live: a token that has been burned, or one whose day has
// passed, is not something to advertise as a way in.
//
// The fields are named one at a time on purpose. An invite row carries
// its TOKEN, and the token is the only secret in it — so nothing here
// ever hands a row to a serializer, and no formatter takes a row and
// prints what it finds.
function relayConsoleInviteLine(row, now) {
  return String(row.label) + '  expires ' + String(row.expiresAt) +
    (row.invitedBy ? '  by ' + String(row.invitedBy) : '');
}

function relayConsoleLiveInvites(rows, now) {
  return (Array.isArray(rows) ? rows : []).filter(function (row) {
    if (!row || !row.label) return false;
    if (row.consumedAt) return false;
    var expires = Date.parse(row.expiresAt);
    return !(expires < now);
  });
}

function relayConsoleHandle(text, ctx) {
  var line = String(text == null ? '' : text).trim();
  if (!line) return null;

  var context = ctx || {};
  var isOwner = !!context.isOwner;
  var cap = relayConsoleCap(context);
  var now = typeof context.now === 'number' ? context.now : Date.now();

  var parts = line.split(/\s+/);
  var word = parts[0].toLowerCase();
  var args = parts.slice(1);

  function reply(t) { return { reply: t }; }

  function helpText() {
    var words = relayConsoleWordsFor(isOwner);
    return 'words I answer for you: ' + words.join(' ');
  }

  if (word === 'help') return reply(helpText());

  if (word === 'whoami') {
    var label = String(context.senderLabel || '(unclaimed)');
    var key = String(context.senderKey || '');
    return reply('you are ' + label + (isOwner ? ' — owner of this mailbox' : '') +
      (key ? '\nyour key ' + key : '\nno key on this mailbox for you'));
  }

  if (RELAY_CONSOLE_OWNER_WORDS.indexOf(word) !== -1 && !isOwner) {
    // Not "unknown word": a friend who typed a real word did not mistype,
    // and this repo is public, so the list is no secret. What silence
    // would buy is confusion for the one person who is not an attacker.
    return reply("that one is the owner's");
  }

  if (word === 'status') {
    var snap = relayConsoleValue(context.snapshot) || {};
    return reply('mode ' + String(snap.mode || '?') +
      '  owner ' + String(snap.owner || '-') +
      '  peers ' + ((snap.peers && snap.peers.length) || 0) +
      '  messages ' + (snap.messages || 0));
  }

  if (word === 'peers') {
    var peers = relayConsoleValue(context.peers) || [];
    if (!peers.length) return reply('no peers on this mailbox yet');
    return reply(relayConsoleTrim(peers.map(relayConsolePeerLine), cap));
  }

  if (word === 'search') {
    var needle = args.join(' ');
    if (!needle) return reply('search what? try: search andy');
    var all = relayConsoleValue(context.peers) || [];
    var hits = all.filter(function (peer) { return relayConsoleMatches(peer, needle); });
    if (!hits.length) return reply('nobody here matches ' + needle);
    return reply(relayConsoleTrim(hits.map(relayConsolePeerLine), cap));
  }

  if (word === 'invites') {
    var live = relayConsoleLiveInvites(relayConsoleValue(context.invites), now);
    if (!live.length) return reply('no live invites');
    var lines = live.map(function (row) { return relayConsoleInviteLine(row, now); });
    return reply(live.length + ' live\n' + relayConsoleTrim(lines, cap));
  }

  if (word === 'key') {
    var mailboxKey = relayConsoleValue(context.mailboxPublicKey) || '';
    return reply(mailboxKey ? mailboxKey : 'this mailbox has no key of its own yet');
  }

  if (word === 'version') {
    return reply(String(context.version || 'unknown'));
  }

  return reply('I do not know "' + parts[0] + '"\n' + helpText());
}

module.exports = {
  OWNER_WORDS: RELAY_CONSOLE_OWNER_WORDS,
  PUBLIC_WORDS: RELAY_CONSOLE_PUBLIC_WORDS,
  DEFAULT_ROWS: RELAY_CONSOLE_DEFAULT_ROWS,
  DEFAULT_BYTES: RELAY_CONSOLE_DEFAULT_BYTES,
  wordsFor: relayConsoleWordsFor,
  trim: relayConsoleTrim,
  liveInvites: relayConsoleLiveInvites,
  handle: relayConsoleHandle,
};
