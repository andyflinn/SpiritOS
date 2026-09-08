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
const { createHub, buildPeople, acquireFromInbox } = require('../run/js/hub');

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

function hubInbox(hub, name) {
  const res = fakeRes();
  hub.handleInbox({}, res, new URL('http://127.0.0.1/api/hub/inbox?name=' + encodeURIComponent(name)));
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

    box.send('bert', 'andy', 'first line from bert',
      auth.sign(bert.privateKey, auth.sendMessage('bert', 'andy', 'first line from bert')), '10.0.0.2');
    return hubInbox(hub, 'andy');
  }).then(function (res) {
    if (res.status === 200 && /first line from bert/.test(res.text)) {
      test.check('the inbox read comes back with his line');
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

runOverLoopback()
  .then(function () { test.reportSuccessFailureCount(); })
  .catch(function (err) {
    test.fail('contacts threw: ' + ((err && err.stack) || err));
    test.reportSuccessFailureCount();
  });
