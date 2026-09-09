'use strict';

// spirit/run/js/peerStats.js
// Personal node only. Per-peer packet counters. Never uploaded. Never on the relay.
//
// A whoBook row is a human decision. These numbers are not.
// They live in app/contacts/peerfile-<key>.json via peerFile.js so
// bytesHeld already includes them.
//
// unansweredInbound increments on inbound, zeros on outbound.
// days[] is a 14-day ring of {day, in, out}. Rates are window sums / 14
// calendar days (missing days count as 0). Day grain is a privacy choice:
// you cannot rebuild a conversation from it.
//
// seenIds: bounded relay message ids so a non-destructive inbox poll
// cannot count the same line twice. Not a transcript.

const fs = require('fs');
const path = require('path');
const peerFile = require('./peerFile');

const WINDOW_DAYS = 14;
const SEEN_CAP = 200;
const DIR = ['app', 'contacts'];

function contactsDir(rootDir) {
  return path.join(rootDir, DIR[0], DIR[1]);
}

function statsPath(rootDir, publicKey) {
  return path.join(contactsDir(rootDir), peerFile.fileName(publicKey));
}

function todayUTC(now) {
  var d = now ? new Date(now) : new Date();
  return d.toISOString().slice(0, 10);
}

function dayUTC(now, daysAgo) {
  var d = now ? new Date(now) : new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function emptyRow(publicKey) {
  return {
    peerPublicKey: String(publicKey || ''),
    unansweredInbound: 0,
    days: [],
    seenIds: []
  };
}

function readRow(rootDir, publicKey) {
  var file = statsPath(rootDir, publicKey);
  var raw;
  try { raw = fs.readFileSync(file, 'utf8'); }
  catch (e) { return emptyRow(publicKey); }
  try {
    var row = JSON.parse(raw);
    if (!row || typeof row !== 'object') return emptyRow(publicKey);
    if (typeof row.unansweredInbound !== 'number' || row.unansweredInbound < 0) {
      row.unansweredInbound = 0;
    }
    if (!Array.isArray(row.days)) row.days = [];
    if (!Array.isArray(row.seenIds)) row.seenIds = [];
    row.peerPublicKey = String(publicKey || '');
    return row;
  } catch (e) {
    return emptyRow(publicKey);
  }
}

function writeRow(rootDir, row) {
  var dir = contactsDir(rootDir);
  fs.mkdirSync(dir, { recursive: true });
  var file = statsPath(rootDir, row.peerPublicKey);
  var tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(row, null, 2));
  fs.renameSync(tmp, file);
}

function bumpDay(row, field, now) {
  var day = todayUTC(now);
  if (!row.days.length || row.days[0].day !== day) {
    row.days.unshift({ day: day, in: 0, out: 0 });
    while (row.days.length > WINDOW_DAYS) row.days.pop();
  }
  row.days[0][field] += 1;
}

function alreadySeen(row, messageId) {
  if (messageId == null || messageId === '') return false;
  var id = String(messageId);
  return row.seenIds.indexOf(id) !== -1;
}

function rememberId(row, messageId) {
  if (messageId == null || messageId === '') return;
  var id = String(messageId);
  row.seenIds.push(id);
  if (row.seenIds.length > SEEN_CAP) {
    row.seenIds = row.seenIds.slice(row.seenIds.length - SEEN_CAP);
  }
}

function windowRate(days, field, now) {
  var map = Object.create(null);
  (days || []).forEach(function (b) {
    if (b && b.day) map[b.day] = b;
  });
  var total = 0;
  var i;
  for (i = 0; i < WINDOW_DAYS; i++) {
    var b = map[dayUTC(now, i)];
    total += b ? (Number(b[field]) || 0) : 0;
  }
  return total / WINDOW_DAYS;
}

function summarize(row, now) {
  row = row || emptyRow('');
  return {
    unansweredInbound: row.unansweredInbound || 0,
    inboundPerDay: windowRate(row.days, 'in', now),
    outboundPerDay: windowRate(row.days, 'out', now)
  };
}

// Inbound: one delivered packet from this key.
// Skip if this id was already counted. Caller decides whether the key is eligible.
function noteIn(rootDir, publicKey, messageId, now) {
  if (!publicKey) return null;
  var row = readRow(rootDir, publicKey);
  if (alreadySeen(row, messageId)) return summarize(row, now);
  rememberId(row, messageId);
  row.unansweredInbound += 1;
  bumpDay(row, 'in', now);
  writeRow(rootDir, row);
  return summarize(row, now);
}

// Outbound: this node sent a packet to this key. Resets unanswered.
function noteOut(rootDir, publicKey, now) {
  if (!publicKey) return null;
  var row = readRow(rootDir, publicKey);
  row.unansweredInbound = 0;
  bumpDay(row, 'out', now);
  writeRow(rootDir, row);
  return summarize(row, now);
}

function readSummary(rootDir, publicKey, now) {
  return summarize(readRow(rootDir, publicKey), now);
}

module.exports = {
  WINDOW_DAYS: WINDOW_DAYS,
  statsPath: statsPath,
  noteIn: noteIn,
  noteOut: noteOut,
  readSummary: readSummary,
  summarize: summarize
};
