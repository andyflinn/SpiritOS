'use strict';

// Contacts — the To control lists people this node ACQUIRED
// (CYCLE-CONTACTS-IMPL.md, replacing chat 2's "To is the census").
//
// A mailbox census is not an address book. Everyone who ever claimed on
// a public relay is in `who`, and a To list built from it means
// "everyone who exists" — which is how a friend picks a stranger's john.
// So a whoBook row carries how it arrived, and only some ways count:
//
//   census  — seen in `who`. Not a contact. Also what a row with no
//             field at all is, since that is exactly what those were.
//   message — they wrote to you and the mailbox carried their key.
//   invite  — a token this node minted was consumed by that key.
//   handle  — confirmed out of band (cut 2, not this sitting).
//
// A person is still a KEY: two johns are two contacts, two rows, two
// captions. The last section runs the real hub against a throwaway relay
// on loopback, because "reading your mail is how you come to know who
// wrote it" is a claim about what happens on a fetch.

const fs = require('fs');
const os = require('os');
const http = require('http');
const path = require('path');
const { URL } = require('url');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const whoBook = require('../run/js/whoBook');
const { createRelay } = require('../run/js/relay');
const { createHub, buildPeople, acquireFromInbox, handleMatches, keyTail, partitionInbox, unknownPolicy, holdFromInbox } = require('../run/js/hub');

const RELAY_URL = 'https://mailbox.example';

function tmpHome(tag) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-contacts-' + tag + '-'));
}

function nodeHome(id, urls) {
  const home = tmpHome('node');
  if (id) auth.saveIdentity(home, id);
  const dir = path.join(home, 'app', 'natter');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'relays.json'), JSON.stringify(
    urls.map(function (u, i) { return { label: 'mailbox' + (i + 1), url: u }; }), null, 2));
  return home;
}

// What /api/relay/who hands back: one row per key.
function peer(label, key, owner) {
  return { name: label, publicLabel: label, publicKey: key, claimedAt: '2026-09-08T00:00:00.000Z', owner: !!owner };
}

// What an inbox read hands back: a line, with the sender's key on it.
function line(id, fromLabel, fromKey, toKey, text) {
  return {
    id: String(id), from: fromLabel, to: 'andy',
    fromKey: fromKey, toKey: toKey, text: text,
    sentAt: '2026-09-08T10:0' + id + ':00.000Z',
  };
}

test.startTest('Contacts — the To list is who this node knows, not who exists');

test.subHeading('A census is not an address book');

{
  const home = nodeHome(null, [RELAY_URL]);
  const johnA = auth.generateIdentity('john').publicKey;
  const johnB = auth.generateIdentity('john').publicKey;
  const census = [peer('andy', 'KEY-ANDY', true), peer('john', johnA), peer('john', johnB)];

  const people = buildPeople(home, census, RELAY_URL);
  if (people.length === 0) {
    test.check('three peers on the mailbox are nobody in the To list');
  } else {
    test.fail('census leaked into To: ' + JSON.stringify(people));
  }

  // Walked, though: the census is what keeps a caption and its routes
  // current. It is written down as census, which is the whole difference.
  const book = whoBook.load(home);
  if (book.length === 3 && book.every(function (row) { return whoBook.acquiredVia(row) === 'census'; })) {
    test.check('but they are in whoBook, marked census');
  } else {
    test.fail('whoBook: ' + JSON.stringify(book.map(function (r) { return r.acquiredVia; })));
  }

  // A row written before the field existed is exactly what a census row
  // is, so that is how it reads — nothing has to be migrated.
  const legacy = nodeHome(null, [RELAY_URL]);
  fs.mkdirSync(path.join(legacy, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(legacy, 'relay-state', 'who.json'), JSON.stringify([
    { publicKey: johnA, publicLabel: 'john', myLabel: 'john', relays: [] },
  ]));
  if (whoBook.contacts(legacy).length === 0 && buildPeople(legacy, [], RELAY_URL).length === 0) {
    test.check('a row from before the field is a census row, and stays out of To');
  } else {
    test.fail('a legacy row was treated as a contact');
  }
}

test.subHeading('A message is how a stranger becomes someone you can answer');

{
  const me = auth.generateIdentity('andy');
  const home = nodeHome(me, [RELAY_URL]);
  const johnA = auth.generateIdentity('john').publicKey;
  const johnB = auth.generateIdentity('john').publicKey;
  const census = [peer('andy', me.publicKey, true), peer('john', johnA), peer('john', johnB)];

  buildPeople(home, census, RELAY_URL); // the census, as any refresh would
  acquireFromInbox(home, [
    line(1, 'john', johnA, me.publicKey, 'hello'),
    line(2, 'john', johnB, me.publicKey, 'also hello'),
  ], RELAY_URL);

  const people = buildPeople(home, census, RELAY_URL);
  if (people.length === 2) {
    test.check('the two who wrote are contacts; the rest of the mailbox is not');
  } else {
    test.fail('contacts: ' + JSON.stringify(people.map(function (p) { return p.caption; })));
  }

  if (people.every(function (p) { return p.acquiredVia === 'message'; })) {
    test.check('and they carry the weak acquire that they are');
  } else {
    test.fail('acquiredVia: ' + JSON.stringify(people.map(function (p) { return p.acquiredVia; })));
  }

  // Two johns are two keys and two rows, and a caption that would read
  // the same carries a piece of the key — the TAIL, since every Ed25519
  // SPKI key opens with the same ASN.1 header.
  if (people[0].publicKey !== people[1].publicKey &&
      people[0].caption !== people[1].caption &&
      people.every(function (p) { return p.ambiguous; })) {
    test.check('two johns stay two rows, told apart by key tail');
  } else {
    test.fail('johns: ' + JSON.stringify(people));
  }

  // Claiming a name is not meeting somebody.
  if (!people.some(function (p) { return p.publicKey === me.publicKey; })) {
    test.check('and this node is not in its own To list');
  } else {
    test.fail('self row present');
  }

  // A private caption wins, and never leaves this node.
  whoBook.setMyLabel(home, johnA, 'lovelyJohn');
  const renamed = buildPeople(home, census, RELAY_URL);
  const lovely = renamed.filter(function (p) { return p.caption === 'lovelyJohn'; })[0];
  if (lovely && lovely.publicKey === johnA && lovely.publicLabel === 'john') {
    test.check('myLabel is the caption; the public label is untouched');
  } else {
    test.fail('captions: ' + JSON.stringify(renamed.map(function (p) { return [p.caption, p.publicLabel]; })));
  }
}

test.subHeading('Ranks never fall');

{
  const home = nodeHome(auth.generateIdentity('andy'), [RELAY_URL]);
  const bert = auth.generateIdentity('bert').publicKey;

  whoBook.acquire(home, { publicKey: bert, publicLabel: 'bert' }, 'handle');
  acquireFromInbox(home, [line(3, 'bert', bert, 'KEY-ME', 'hi')], RELAY_URL);
  if (whoBook.acquiredVia(whoBook.byPublicKey(home, bert)) === 'handle') {
    test.check('a message does not demote a key confirmed out of band');
  } else {
    test.fail('downgraded to: ' + whoBook.acquiredVia(whoBook.byPublicKey(home, bert)));
  }

  // A census sync corrects the public caption of somebody you know, and
  // does not turn them back into a stranger.
  buildPeople(home, [peer('bertram', bert)], RELAY_URL);
  const row = whoBook.byPublicKey(home, bert);
  if (whoBook.acquiredVia(row) === 'handle' && row.publicLabel === 'bertram') {
    test.check('and a census sync updates the label without demoting the row');
  } else {
    test.fail('after census: ' + JSON.stringify(row));
  }

  // Your own key is never filed by reading your own mail back.
  const me = auth.generateIdentity('andy');
  const own = nodeHome(me, [RELAY_URL]);
  acquireFromInbox(own, [line(4, 'andy', me.publicKey, me.publicKey, 'note to self')], RELAY_URL);
  if (whoBook.contacts(own).length === 0) {
    test.check('and a note to yourself does not make you your own contact');
  } else {
    test.fail('self acquired: ' + JSON.stringify(whoBook.contacts(own)));
  }
}

test.subHeading('Add by handle: every key behind the word');

{
  const me = auth.generateIdentity('andy');
  const home = nodeHome(me, [RELAY_URL]);
  const johnA = auth.generateIdentity('john').publicKey;
  const johnB = auth.generateIdentity('john').publicKey;
  const bert = auth.generateIdentity('bert').publicKey;
  const census = [
    peer('andy', me.publicKey, true),
    peer('john', johnA),
    peer('john', johnB),
    peer('bert', bert),
  ];

  const johns = handleMatches(home, census, 'john');
  if (johns.length === 2 && johns[0].publicKey !== johns[1].publicKey) {
    test.check('a handle two people answer to gives two candidates');
  } else {
    test.fail('john matches: ' + JSON.stringify(johns));
  }

  // The tail is from the END. A fragment from the front names every peer
  // on every mailbox equally, since all these keys share a header.
  if (johns.every(function (m) { return m.tail === m.publicKey.slice(-6) && m.tail === keyTail(m.publicKey); }) &&
      johnA.slice(0, 12) === johnB.slice(0, 12)) {
    test.check('each candidate carries the end of its key, which is the part that differs');
  } else {
    test.fail('tails: ' + JSON.stringify(johns.map(function (m) { return m.tail; })));
  }

  // A handle is a word said out loud, not a search: `joh` is not john,
  // and a substring match would hand back strangers who merely contain
  // the word.
  if (handleMatches(home, census, 'joh').length === 0 && handleMatches(home, census, 'JOHN').length === 2) {
    test.check('the handle matches the whole caption, case aside');
  } else {
    test.fail('partial or case handling is wrong');
  }

  if (handleMatches(home, census, 'nobody').length === 0) {
    test.check('a handle nobody answers to is no candidates');
  } else {
    test.fail('invented a match');
  }

  // Never yourself: you cannot be added to your own address book.
  if (handleMatches(home, census, 'andy').length === 0) {
    test.check('and this node is never a candidate for itself');
  } else {
    test.fail('self offered as a candidate');
  }

  // One match is still a question, so the candidate still carries its
  // tail — the UI has everything it needs to make somebody confirm.
  const one = handleMatches(home, census, 'bert');
  if (one.length === 1 && one[0].tail === bert.slice(-6)) {
    test.check('a lone match is still shown by its key tail');
  } else {
    test.fail('bert: ' + JSON.stringify(one));
  }

  // What this node already thinks of a candidate rides along, so the UI
  // can say "already a contact" instead of offering the same person as
  // though they were new.
  acquireFromInbox(home, [line(5, 'bert', bert, me.publicKey, 'hi')], RELAY_URL);
  if (handleMatches(home, census, 'bert')[0].acquiredVia === 'message') {
    test.check('a candidate says how this node already knows them');
  } else {
    test.fail('acquiredVia missing from a candidate');
  }
}

test.subHeading('Confirming writes handle, and nothing else changes');

{
  const home = nodeHome(auth.generateIdentity('andy'), [RELAY_URL]);
  const johnA = auth.generateIdentity('john').publicKey;
  const johnB = auth.generateIdentity('john').publicKey;

  whoBook.handshake(home, { publicKey: johnA, publicLabel: 'john', relay: RELAY_URL });
  whoBook.handshake(home, { publicKey: johnB, publicLabel: 'john', relay: RELAY_URL });

  // The upgrade a confirm performs: census to handle, in place, on one
  // key. Identity is the key, so the other john is untouched.
  whoBook.acquire(home, { publicKey: johnA, publicLabel: 'john', relay: RELAY_URL }, 'handle');

  const contacts = whoBook.contacts(home);
  if (contacts.length === 1 && contacts[0].publicKey === johnA && whoBook.acquiredVia(contacts[0]) === 'handle') {
    test.check('confirming one john makes one contact, marked handle');
  } else {
    test.fail('contacts: ' + JSON.stringify(contacts));
  }

  if (whoBook.acquiredVia(whoBook.byPublicKey(home, johnB)) === 'census') {
    test.check('and the other john is still a stranger');
  } else {
    test.fail('the wrong john was promoted');
  }

  // A message afterwards does not undo the confirmation.
  acquireFromInbox(home, [line(6, 'john', johnA, 'KEY-ME', 'hello again')], RELAY_URL);
  if (whoBook.acquiredVia(whoBook.byPublicKey(home, johnA)) === 'handle') {
    test.check('and a later message cannot demote it');
  } else {
    test.fail('handle was downgraded by a message');
  }

  // To is still contacts only: the census that was walked to find the
  // candidates does not follow them in.
  const people = buildPeople(home, [peer('john', johnA), peer('john', johnB)], RELAY_URL);
  if (people.length === 1 && people[0].publicKey === johnA) {
    test.check('the To list gains the confirmed key and no more');
  } else {
    test.fail('To after confirm: ' + JSON.stringify(people.map(function (p) { return p.caption; })));
  }
}

// ---------------------------------------------------------------------
// The real hub, over loopback: reading mail is how a contact appears.
// ---------------------------------------------------------------------

function relayServer(box) {
  return new Promise(function (resolve) {
    const server = http.createServer(function (req, res) {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (req.method === 'GET' && url.pathname === '/api/relay/who') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ peers: box.who(), mailboxPublicKey: box.mailboxPublicKey() }));
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/relay/inbox') {
        const r = box.inbox(url.searchParams.get('name') || '', url.searchParams.get('sig') || '');
        res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(r.ok ? { messages: r.messages } : { error: r.error }));
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/relay/send') {
        let raw = '';
        req.on('data', function (c) { raw += c; });
        req.on('end', function () {
          let body = {};
          try { body = JSON.parse(raw); } catch (e) { body = {}; }
          const r = box.send(body.from, body.to, body.text, body.sig, '127.0.0.1');
          res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(r.ok ? r.message : { error: r.error }));
        });
        return;
      }
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end('{"error":"no such route"}');
    });
    server.listen(0, '127.0.0.1', function () {
      resolve({ server: server, url: 'http://127.0.0.1:' + server.address().port });
    });
  });
}

function fakeRes() {
  const out = { status: 0, text: '', finished: false };
  out.writeHead = function (status) { out.status = status; };
  out.end = function (text) {
    out.text = String(text == null ? '' : text);
    out.finished = true;
    if (out.done) out.done(out);
  };
  out.wait = function () {
    return new Promise(function (resolve) {
      if (out.finished) { resolve(out); return; }
      out.done = resolve;
    });
  };
  return out;
}

function hubWho(hub) {
  const res = fakeRes();
  hub.handleWho({}, res);
  return res.wait().then(function (r) {
    let data = {};
    try { data = JSON.parse(r.text); } catch (e) { data = {}; }
    return data;
  });
}

// `unknown` is the app's setting travelling with the request. Left out
// on purpose in one place below, to check what a request that says
// nothing gets.
function hubInbox(hub, name, unknown) {
  const res = fakeRes();
  const query = '?name=' + encodeURIComponent(name) + (unknown ? '&unknown=' + unknown : '');
  hub.handleInbox({}, res, new URL('http://127.0.0.1/api/hub/inbox' + query));
  return res.wait();
}

function runOverLoopback() {
  test.subHeading('Through the hub: mail arrives, a contact appears');

  const relayHome = tmpHome('box');
  auth.saveIdentity(relayHome, auth.generateIdentity('relay'));
  const box = createRelay(relayHome);
  const andy = auth.generateIdentity('andy');
  box.claim('andy', auth.sign(andy.privateKey, auth.claimMessage('andy')), andy.publicKey, '10.0.0.1');

  const invites = require('../run/js/invites');
  const bert = auth.generateIdentity('bert');
  const minted = box.mint('andy', 'bert', 7, auth.sign(andy.privateKey, invites.mintMessage('bert', 7)));
  box.claim('bert', auth.sign(bert.privateKey, auth.claimMessage('bert')), bert.publicKey, '10.0.0.2', minted.invite.token);

  let server;
  let hub;
  let home;

  return relayServer(box).then(function (s) {
    server = s;
    home = nodeHome(andy, [server.url]);
    hub = createHub(home);
    return hubWho(hub);
  }).then(function (data) {
    // Bert is on the mailbox. Andy has never heard from him.
    if (data.people && data.people.length === 0) {
      test.check('a mailbox full of peers is an empty To list until somebody writes');
    } else {
      test.fail('who returned: ' + JSON.stringify(data.people));
    }

    // Being added is the other half of adding. The tail somebody reads
    // out over the phone has to be readable on their own screen, and it
    // is their key, not the mailbox's.
    if (data.selfPublicKey === andy.publicKey && data.selfTail === andy.publicKey.slice(-6)) {
      test.check('who tells this node the end of its own key');
    } else {
      test.fail('selfTail was ' + JSON.stringify(data.selfTail));
    }
    if (data.selfTail !== data.mailboxPublicKey) {
      test.check('and that is your key, not the mailbox you are on');
    } else {
      test.fail('self and mailbox are the same key');
    }

    box.send('bert', 'andy', 'first line from bert',
      auth.sign(bert.privateKey, auth.sendMessage('bert', 'andy', 'first line from bert')), '10.0.0.2');
    // Said nothing about the policy, so silence: bert is on the mailbox
    // and has written, and this node has still never added him.
    return hubInbox(hub, 'andy');
  }).then(function (res) {
    if (res.status === 200 && !/first line from bert/.test(res.text)) {
      test.check('a read that names no policy hears nothing from a stranger');
    } else {
      test.fail('silent read: ' + res.status + ' ' + res.text);
    }
    return hubWho(hub);
  }).then(function (data) {
    if (data.people && data.people.length === 0) {
      test.check('and the dropped line put nobody in the To list');
    } else {
      test.fail('who after a silent read: ' + JSON.stringify(data.people));
    }
    // The same mail, with the node asking to hear it.
    return hubInbox(hub, 'andy', 'acquire');
  }).then(function (res) {
    if (res.status === 200 && /first line from bert/.test(res.text)) {
      test.check('with Acquire the same read comes back with his line');
    } else {
      test.fail('inbox: ' + res.status + ' ' + res.text);
    }
    return hubWho(hub);
  }).then(function (data) {
    const rows = data.people || [];
    if (rows.length === 1 && rows[0].publicKey === bert.publicKey && rows[0].acquiredVia === 'message') {
      test.check('and reading it is what put Bert in the To list');
    } else {
      test.fail('after inbox: ' + JSON.stringify(rows));
    }

    if (!rows.some(function (r) { return r.publicKey === andy.publicKey; })) {
      test.check('Andy is still not in his own list');
    } else {
      test.fail('self row appeared');
    }

    const bertRow = whoBook.byPublicKey(home, bert.publicKey);
    if (bertRow && bertRow.relays.indexOf(server.url) !== -1) {
      test.check('with the mailbox it was seen on recorded against it');
    } else {
      test.fail('whoBook row: ' + JSON.stringify(bertRow));
    }

    server.server.close();
  });
}

// ---------------------------------------------------------------------
// Mail from somebody you have not added.
// ---------------------------------------------------------------------

function unknownMail() {
  test.subHeading('A stranger writes, and the factory setting is silence');

  const home = tmpHome('policy');
  const me = auth.generateIdentity('andy');
  auth.saveIdentity(home, me);

  const bert = auth.generateIdentity('bert');
  const stranger = auth.generateIdentity('carol');

  // Bert is a contact; carol is a name on the same mailbox and nothing
  // more. Exactly the case cut 1 was about, now with a policy over it.
  whoBook.acquire(home, { publicKey: bert.publicKey, publicLabel: 'bert', relay: RELAY_URL }, 'handle');

  const inbox = [
    line(1, 'bert', bert.publicKey, me.publicKey, 'from a contact'),
    line(2, 'carol', stranger.publicKey, me.publicKey, 'from a stranger'),
    line(3, 'andy', me.publicKey, me.publicKey, 'a note to myself'),
  ];

  const split = partitionInbox(home, inbox);
  const texts = split.known.map(function (m) { return m.text; });
  if (texts.indexOf('from a contact') !== -1 && texts.indexOf('from a stranger') === -1) {
    test.check('a contact is heard and a stranger is not');
  } else {
    test.fail('kept: ' + JSON.stringify(texts));
  }

  if (texts.indexOf('a note to myself') !== -1) {
    test.check('and this node still hears itself');
  } else {
    test.fail('own line dropped: ' + JSON.stringify(texts));
  }

  if (split.unknown === 1) {
    test.check('how many were dropped is known, which is all Hold ever says');
  } else {
    test.fail('unknown count: ' + split.unknown);
  }

  // The mailbox is not a contact and never will be — it is a caption,
  // not a person — but a node that stopped hearing its own mailbox would
  // have a relay console answering into silence. `relay` is reserved, so
  // no stranger can wear the name.
  const withRelay = partitionInbox(home, inbox.concat([
    { id: '9', from: 'relay', to: 'andy', fromKey: null, toKey: me.publicKey, text: 'relay status mode=keys' },
  ]));
  if (withRelay.known.some(function (m) { return m.from === 'relay'; }) && withRelay.unknown === 1) {
    test.check('the mailbox is always heard, and is nobody the count is about');
  } else {
    test.fail('relay line: ' + JSON.stringify(withRelay));
  }

  const twice = partitionInbox(home, inbox.concat([line(4, 'carol', stranger.publicKey, me.publicKey, 'again')]));
  if (twice.unknown === 1) {
    test.check('and it counts people, not lines');
  } else {
    test.fail('counted lines: ' + twice.unknown);
  }

  // Silence is what an unrecognised answer means: a prefs.json edited by
  // hand into nonsense must not quietly open a node up.
  const factory = ['', null, undefined, 'everything', 'SILENT'].every(function (v) {
    return unknownPolicy(v) === 'silent';
  });
  if (factory && unknownPolicy('acquire') === 'acquire' && unknownPolicy('hold') === 'hold') {
    test.check('anything but a real choice reads as silence');
  } else {
    test.fail('policy defaults are wrong');
  }

  if (whoBook.byPublicKey(home, stranger.publicKey) === null) {
    test.check('a dropped line leaves nothing behind on disk');
  } else {
    test.fail('the stranger was filed anyway');
  }

  // Acquire is still available, and still exactly what cut 1 did.
  acquireFromInbox(home, inbox, RELAY_URL);
  if (whoBook.acquiredVia(whoBook.byPublicKey(home, stranger.publicKey)) === 'message') {
    test.check('choosing Acquire is what lets a stranger in');
  } else {
    test.fail('acquire did not file the stranger');
  }

  if (partitionInbox(home, inbox).unknown === 0) {
    test.check('and once added, they are somebody this node hears');
  } else {
    test.fail('still unknown after being acquired');
  }
}

// ---------------------------------------------------------------------
// Hold: seen, not heard.
// ---------------------------------------------------------------------

function heldAndBlocked() {
  test.subHeading('Somebody waiting is in the list and not in the conversation');

  const home = tmpHome('held');
  const me = auth.generateIdentity('andy');
  auth.saveIdentity(home, me);
  const stranger = auth.generateIdentity('carol');
  const inbox = [line(1, 'carol', stranger.publicKey, me.publicKey, 'hello?')];

  holdFromInbox(home, inbox, RELAY_URL);

  // The row is what Hold buys: somebody to say yes to. The message is
  // still dropped — holding is not hearing.
  const row = whoBook.byPublicKey(home, stranger.publicKey);
  if (row && whoBook.acquiredVia(row) === 'hold' && partitionInbox(home, inbox).known.length === 0) {
    test.check('a held sender gets a row, and their line still does not arrive');
  } else {
    test.fail('held: ' + JSON.stringify(row));
  }

  // And it is in the To list, marked, because a row nobody can see is a
  // person nobody can accept.
  const people = buildPeople(home, [peer('carol', stranger.publicKey)], RELAY_URL);
  const carol = people.filter(function (p) { return p.publicKey === stranger.publicKey; })[0];
  if (carol && carol.held === true && carol.blocked === false) {
    test.check('and appears in To as somebody not added yet');
  } else {
    test.fail('people: ' + JSON.stringify(people));
  }

  // Somebody already decided about is not re-held: a blocked row must
  // not climb back out by writing again.
  whoBook.setBlocked(home, stranger.publicKey, true);
  whoBook.acquire(home, { publicKey: stranger.publicKey, publicLabel: 'carol' }, 'handle');
  holdFromInbox(home, inbox, RELAY_URL);
  const afterBlock = whoBook.byPublicKey(home, stranger.publicKey);
  if (whoBook.isBlocked(afterBlock) && whoBook.acquiredVia(afterBlock) === 'handle') {
    test.check('writing again neither unblocks nor demotes anybody');
  } else {
    test.fail('after writing while blocked: ' + JSON.stringify(afterBlock));
  }

  // A blocked contact is out of the listening set and still on screen.
  const blockedPeople = buildPeople(home, [peer('carol', stranger.publicKey)], RELAY_URL);
  const shown = blockedPeople.filter(function (p) { return p.publicKey === stranger.publicKey; })[0];
  if (partitionInbox(home, inbox).known.length === 0 && shown && shown.held && shown.blocked) {
    test.check('a blocked contact is silent, listed, and says which it is');
  } else {
    test.fail('blocked in To: ' + JSON.stringify(shown));
  }

  // Unblocking is not accepting. Somebody blocked while still waiting
  // goes back to waiting: undoing a no is not saying yes.
  const waiting = tmpHome('waiting');
  auth.saveIdentity(waiting, me);
  whoBook.hold(waiting, { publicKey: stranger.publicKey, publicLabel: 'carol' });
  whoBook.setBlocked(waiting, stranger.publicKey, true);
  whoBook.setBlocked(waiting, stranger.publicKey, false);
  const backToWaiting = whoBook.byPublicKey(waiting, stranger.publicKey);
  if (whoBook.acquiredVia(backToWaiting) === 'hold' && !whoBook.listens(backToWaiting)) {
    test.check('unblocking somebody who was never accepted leaves them waiting');
  } else {
    test.fail('after unblock: ' + JSON.stringify(backToWaiting));
  }

  // And a nuisance nobody has ever added can still be blocked: being on
  // a list is not what makes somebody one.
  const fresh = tmpHome('nuisance');
  auth.saveIdentity(fresh, me);
  const nuisance = auth.generateIdentity('dave');
  whoBook.hold(fresh, { publicKey: nuisance.publicKey, publicLabel: 'dave' });
  whoBook.setBlocked(fresh, nuisance.publicKey, true);
  const shut = whoBook.byPublicKey(fresh, nuisance.publicKey);
  if (whoBook.isBlocked(shut) && !whoBook.listens(shut) &&
      whoBook.addressBook(fresh).length === 1) {
    test.check('somebody never added can be blocked, and stays visible to undo');
  } else {
    test.fail('blocked stranger: ' + JSON.stringify(shut));
  }

  // Accepting is the way back, and it is one call.
  whoBook.accept(home, stranger.publicKey);
  if (partitionInbox(home, inbox).known.length === 1) {
    test.check('and accepting them is what lets the next line through');
  } else {
    test.fail('still silent after accept');
  }
}

runOverLoopback()
  .then(unknownMail)
  .then(heldAndBlocked)
  .then(function () { test.reportSuccessFailureCount(); })
  .catch(function (err) {
    test.fail('contacts threw: ' + ((err && err.stack) || err));
    test.reportSuccessFailureCount();
  });
