'use strict';

// A personal archive of conversations (CYCLE-CHAT-5.1.md).
//
// The mailbox stores messages by recipient: an inbox read returns what
// was said TO you and never what you said, and spirit-3 grows no sender
// copy. If this node does not write a line down, that line stops
// existing when the page reloads.
//
// What is under test is the shape of that record, and what it refuses:
//
//   - one file per peer, named by the WHOLE key through peerFile;
//   - the same treatment for every peer — a friend, yourself, the
//     mailbox — with both halves kept, sent and received;
//   - a header naming the peer, and entries of nothing but direction,
//     time and words: an archive, not a mailbox dump;
//   - no file for a peer with no key. `relay` is a caption, so the
//     mailbox has a key of its own, and it is not the owner's.

const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const peerFile = require('../run/js/peerFile.js');
const chatLog = require('../run/js/chatLog.js');

// The scoped api.fs Relay Chat is handed, backed by an object, so a
// "reload" is reading the same store with a fresh cache.
function fakeScopedFs(store) {
  return {
    loadFile: function (name) {
      return Object.prototype.hasOwnProperty.call(store, name) ? store[name] : null;
    },
    saveFile: function (name, content) { store[name] = content; return Promise.resolve(); },
  };
}

// What Relay Chat does with a batch of messages, in the small. The
// direction is passed in because it is provenance: a 201 the relay
// answered, or a line out of an inbox read.
function record(store, messages, dir, mailboxKey) {
  const fsApi = fakeScopedFs(store);
  const byPeer = {};
  messages.forEach(function (m) {
    const peerKey = chatLog.peerKeyFor(m, dir, mailboxKey);
    if (!peerKey) return;
    (byPeer[peerKey] = byPeer[peerKey] || []).push(chatLog.entryFor(m, dir));
  });
  Object.keys(byPeer).forEach(function (peerKey) {
    const file = chatLog.fileFor(peerKey);
    const before = chatLog.parse(fsApi.loadFile(file)).entries;
    fsApi.saveFile(file, chatLog.serialize(peerKey, chatLog.merge(before, byPeer[peerKey])));
  });
}

function readLog(store, peerKey) {
  return chatLog.parse(fakeScopedFs(store).loadFile(chatLog.fileFor(peerKey)));
}

function msg(n, from, to, text, extra) {
  const m = { id: String(n), from: from, to: to, text: text, sentAt: '2026-09-07T10:0' + n + ':00.000Z' };
  Object.keys(extra || {}).forEach(function (k) { m[k] = extra[k]; });
  return m;
}

const ME = auth.generateIdentity('andy').publicKey;
const BERT = auth.generateIdentity('bert').publicKey;
// The mailbox's own key: made on its first --relay boot, handed out by
// who and status. Not the owner's — the owner is a peer who claimed.
const MAILBOX = auth.generateIdentity('relay').publicKey;

test.startTest('Chat log — a thin archive, one file per key');

test.subHeading('A file is named by the key, through peerFile');

{
  const file = chatLog.fileFor(BERT);
  if (file === 'logs/' + peerFile.fileName(BERT)) {
    test.check('the filename comes from peerFile and the folder from here');
  } else {
    test.fail('file: ' + file);
  }

  if (peerFile.keyFromFileName(file.slice('logs/'.length)) === BERT) {
    test.check('and it decodes back to the peer it belongs to');
  } else {
    test.fail('cannot read the peer back out of ' + file);
  }

  // The names the previous sitting left behind.
  if (file.indexOf('relay.json') === -1 && file.indexOf('k-') === -1) {
    test.check('no tail name, no caption name');
  } else {
    test.fail('old-style name: ' + file);
  }
}

test.subHeading('The mailbox is a peer, and it is not the owner');

{
  if (!chatLog.isLoggable('relay') && chatLog.fileFor('relay') === '') {
    test.check('the caption `relay` is refused a filename outright');
  } else {
    test.fail('relay produced: ' + chatLog.fileFor('relay'));
  }

  if (MAILBOX !== ME && chatLog.fileFor(MAILBOX) !== chatLog.fileFor(ME)) {
    test.check('the mailbox key is not the owner key, and names a different file');
  } else {
    test.fail('mailbox and owner share a key or a file');
  }

  // The whole exchange with the mailbox: asked, and answered. Both ends
  // file under the MAILBOX's key, whichever direction the line went.
  const store = {};
  record(store, [msg(1, 'andy', 'relay', 'status?', { fromKey: ME })], 'sent', MAILBOX);
  record(store, [msg(2, 'relay', 'andy', 'relay status mode=keys owner=andy', { toKey: ME })], 'received', MAILBOX);

  const files = Object.keys(store);
  if (files.length === 1 && files[0] === chatLog.fileFor(MAILBOX)) {
    test.check('a conversation with the mailbox lands in one file, under the mailbox key');
  } else {
    test.fail('files: ' + JSON.stringify(files));
  }

  if (!store[chatLog.fileFor(ME)]) {
    test.check('and nothing of it is filed under the owner key');
  } else {
    test.fail('mailbox lines leaked into the owner file');
  }

  const box = readLog(store, MAILBOX);
  const dirs = box.entries.map(function (e) { return e.dir; }).join(',');
  if (box.peerPublicKey === MAILBOX && dirs === 'sent,received') {
    test.check('both halves are there: what was asked and what came back');
  } else {
    test.fail('mailbox log: ' + JSON.stringify(box));
  }

  // A mailbox that has not been restarted since it grew a key hands back
  // none — and then nothing is written, rather than a name invented.
  const older = {};
  record(older, [msg(3, 'andy', 'relay', 'status?', { fromKey: ME })], 'sent', null);
  if (Object.keys(older).length === 0) {
    test.check('a mailbox with no key of its own is not filed at all');
  } else {
    test.fail('wrote: ' + JSON.stringify(Object.keys(older)));
  }
}

test.subHeading('What an entry is, and where its direction comes from');

{
  const sent = chatLog.entryFor(msg(3, 'andy', 'bert', 'hello', { fromKey: ME, toKey: BERT }), 'sent');
  const received = chatLog.entryFor(msg(4, 'bert', 'andy', 'hi back', { fromKey: BERT, toKey: ME }), 'received');

  if (sent.dir === 'sent' && received.dir === 'received') {
    test.check('direction is where the line came from: a 201, or an inbox read');
  } else {
    test.fail('dirs: ' + JSON.stringify([sent.dir, received.dir]));
  }

  const fields = Object.keys(sent).sort().join(',');
  if (fields === 'at,dir,text') {
    test.check('and an entry is direction, time and words — nothing else');
  } else {
    test.fail('entry fields: ' + fields);
  }

  // A note to yourself is sent AND received: both happened, and reading
  // it back should show a conversation rather than half of one. Working
  // the direction out from the sender name cannot express that — both
  // copies look sent.
  const selfStore = {};
  const self = msg(7, 'andy', 'andy', 'milk', { fromKey: ME, toKey: ME });
  record(selfStore, [self], 'sent', MAILBOX);
  record(selfStore, [self], 'received', MAILBOX);
  const selfLog = readLog(selfStore, ME);
  if (Object.keys(selfStore).length === 1 && selfLog.entries.length === 2 &&
      selfLog.entries.map(function (e) { return e.dir; }).sort().join(',') === 'received,sent') {
    test.check('a note to yourself is one file with both halves kept');
  } else {
    test.fail('self log: ' + JSON.stringify(selfLog.entries));
  }

  // The mailbox id is useful in memory and deliberately absent from the
  // file: an archive should still read when the mailbox that carried it
  // is gone.
  const store = {};
  record(store, [msg(5, 'andy', 'bert', 'and again', { fromKey: ME, toKey: BERT })], 'sent', MAILBOX);
  const raw = store[chatLog.fileFor(BERT)];
  if (raw.indexOf('"id"') === -1 && raw.indexOf('fromKey') === -1 && raw.indexOf('toKey') === -1) {
    test.check('no mailbox metadata reaches the disk');
  } else {
    test.fail('file carries mailbox fields: ' + raw);
  }

  const parsed = chatLog.parse(raw);
  if (parsed.peerPublicKey === BERT && parsed.entries.length === 1) {
    test.check('the header names the peer by its whole key');
  } else {
    test.fail('header: ' + JSON.stringify(parsed).slice(0, 120));
  }
}

test.subHeading('Merging: the same line twice is one line');

{
  const a = { dir: 'received', at: '2026-09-07T10:01:00.000Z', text: 'first' };
  const b = { dir: 'received', at: '2026-09-07T10:02:00.000Z', text: 'second' };

  if (chatLog.merge([a], [a, b]).length === 2) {
    test.check('an entry already stored is not stored again');
  } else {
    test.fail('merged: ' + JSON.stringify(chatLog.merge([a], [a, b])));
  }

  if (chatLog.merge([b], [a]).map(function (e) { return e.text; }).join(',') === 'first,second') {
    test.check('merging sorts by when it was said, not by when it arrived');
  } else {
    test.fail('order wrong');
  }

  // Same words, other direction: two entries. Direction is part of what
  // an entry is, which is what makes a note to yourself readable.
  const echoed = { dir: 'sent', at: a.at, text: a.text };
  if (chatLog.merge([a], [echoed]).length === 2) {
    test.check('the same words in the other direction are a different entry');
  } else {
    test.fail('direction was ignored in dedupe');
  }

  const many = [];
  for (let i = 0; i < chatLog.CAP + 50; i++) {
    many.push({ dir: 'received', at: '2026-09-07T' + String(i).padStart(6, '0'), text: 'x' + i });
  }
  const capped = chatLog.merge([], many);
  if (capped.length === chatLog.CAP && capped[capped.length - 1].text === 'x' + (chatLog.CAP + 49)) {
    test.check('an archive is capped, and it is the newest that survive');
  } else {
    test.fail('cap: ' + capped.length);
  }

  if (chatLog.parse('{ not json').entries.length === 0 && chatLog.parse(null).peerPublicKey === '') {
    test.check('a malformed file reads as empty rather than throwing the app over');
  } else {
    test.fail('bad json was not handled');
  }
}

test.subHeading('Two peers, two files — and a reload finds them');

{
  const store = {};
  const john = auth.generateIdentity('john').publicKey;

  record(store, [msg(1, 'andy', 'bert', 'morning', { fromKey: ME, toKey: BERT })], 'sent', MAILBOX);
  record(store, [msg(2, 'john', 'andy', 'a word', { fromKey: john, toKey: ME })], 'received', MAILBOX);

  const files = Object.keys(store).sort();
  if (files.length === 2 &&
      files.indexOf(chatLog.fileFor(BERT)) !== -1 &&
      files.indexOf(chatLog.fileFor(john)) !== -1) {
    test.check('two peers wrote two files, each named for its own key');
  } else {
    test.fail('files: ' + JSON.stringify(files));
  }

  // The point of the cycle: a line this node SENT, read back from a
  // store the mailbox never kept a copy in.
  const reloaded = readLog(store, BERT);
  if (reloaded.peerPublicKey === BERT && reloaded.entries.length === 1 &&
      reloaded.entries[0].dir === 'sent' && reloaded.entries[0].text === 'morning') {
    test.check('a hard reload still shows what this node said');
  } else {
    test.fail('after reload: ' + JSON.stringify(reloaded));
  }

  // The inbox handing the same lines back on the next poll must not
  // double the thread — and it has no ids to help, since the file keeps
  // none.
  record(store, [msg(2, 'john', 'andy', 'a word', { fromKey: john, toKey: ME })], 'received', MAILBOX);
  if (readLog(store, john).entries.length === 1) {
    test.check('re-reading the inbox files nothing new');
  } else {
    test.fail('doubled: ' + JSON.stringify(readLog(store, john).entries));
  }
}

test.subHeading('The header carries chat\'s own refusal, and only chat\'s');

{
  // Two blocks exist and they are not the same switch. whoBook's makes
  // listens() false and the node stops accepting that peer at all; this
  // one lives in chat's own file and only decides what chat shows. It
  // rides in the header because that is the app's own store — a mere app
  // must not be able to reach a node-global switch (Andy).
  const carried = chatLog.parse(chatLog.serialize(BERT, [], true));
  if (carried.blocked === true && carried.peerPublicKey === BERT) {
    test.check('a refusal written into the header comes back out of it');
  } else {
    test.fail('round trip: ' + JSON.stringify(carried));
  }

  // The entries travel with it, or a block would cost you the archive.
  const withLines = chatLog.parse(chatLog.serialize(BERT, [
    { dir: 'received', at: '2026-09-07T10:01:00.000Z', text: 'morning' },
  ], true));
  if (withLines.blocked === true && withLines.entries.length === 1) {
    test.check('and the conversation is still in the file beside it');
  } else {
    test.fail('with lines: ' + JSON.stringify(withLines));
  }

  // The trap: every writer must carry the flag. A save that passed only
  // the entries would erase the block the first time the blocked peer
  // wrote again — which is exactly what recordMessages does on every
  // inbox read.
  const dropped = chatLog.parse(chatLog.serialize(BERT, withLines.entries));
  if (dropped.blocked === false) {
    test.check('and serializing without it is a lifted block, so every writer must pass it');
  } else {
    test.fail('a flag appeared from nowhere: ' + JSON.stringify(dropped));
  }

  // Every log written before this field existed. It has no `blocked`,
  // and what it meant was no.
  const old = chatLog.parse(JSON.stringify({
    peerPublicKey: BERT,
    entries: [{ dir: 'sent', at: '2026-09-07T10:01:00.000Z', text: 'morning' }],
  }));
  if (old.blocked === false && old.entries.length === 1) {
    test.check('an older file with no such field reads as not refused');
  } else {
    test.fail('old file: ' + JSON.stringify(old));
  }

  // And the shapes that are not files at all still answer, since a
  // missing log is the ordinary case for a peer nobody has written to.
  if (chatLog.parse(null).blocked === false && chatLog.parse('{oops').blocked === false) {
    test.check('and a missing or broken file refuses nobody');
  } else {
    test.fail('empty/broken: ' + JSON.stringify([chatLog.parse(null), chatLog.parse('{oops')]));
  }
}

test.subHeading('The binding is still a label, wherever it lives');

{
  // It moved to Natter with the claim that writes it (packet 3), and the
  // rule that mattered moved with it: this file says who this node IS,
  // and a conversation is not part of who you are. A log that crept in
  // here would be a log the shell reads on every paint.
  const fs = require('fs');
  const path = require('path');
  const app = fs.readFileSync(path.join(__dirname, '..', 'run', 'app', 'natter', 'natter.js'), 'utf8');
  const bind = app.slice(app.indexOf('function natterBind('), app.indexOf('function natterUnbind('));
  const extras = ['messages', 'entries', 'log', 'peers'].filter(function (k) { return bind.indexOf(k + ':') !== -1; });
  if (bind.indexOf('label:') !== -1 && bind.indexOf('boundAt:') !== -1 && extras.length === 0) {
    test.check('the binder writes label and boundAt, and nothing else');
  } else {
    test.fail('the binding grew: ' + extras.join(', '));
  }

  const chat = fs.readFileSync(path.join(__dirname, '..', 'run', 'app', 'relayChat', 'relayChat.js'), 'utf8');
  if (chat.indexOf('session.json') === -1) {
    test.check('and chat writes no binding at all');
  } else {
    test.fail('relayChat.js still names a session file');
  }
}

test.reportSuccessFailureCount();
