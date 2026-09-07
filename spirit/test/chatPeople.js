'use strict';

// Chat 2 — the To control is a list of people (CYCLE-CHAT-2.md).
//
// A person is a KEY. The mailbox's `who` returns one row per key, so two
// johns are two rows and stay two rows: the thing a typed name cannot
// express, and the whole reason To stops being only a text box.
//
// The caption is this node's own: whoBook's myLabel when it has one for
// that key, otherwise the label the mailbox shows. whoBook is never
// uploaded, so the caption is perception and the key is identity.
//
// The last section runs the real hub against a throwaway relay on
// loopback, because "picking a row sends to that key" is a claim about
// what actually crosses the wire.

const fs = require('fs');
const os = require('os');
const http = require('http');
const path = require('path');
const { URL } = require('url');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const whoBook = require('../run/js/whoBook');
const { createRelay } = require('../run/js/relay');
const { createHub, buildPeople } = require('../run/js/hub');

function tmpHome(tag) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-chat2-' + tag + '-'));
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

// What /api/relay/who hands back: one row per key, publicLabel and all.
function peer(label, key, owner) {
  return { name: label, publicLabel: label, publicKey: key, claimedAt: '2026-09-07T00:00:00.000Z', owner: !!owner };
}

test.startTest('Relay Chat — To is a list of people, and a person is a key');

{
  const home = nodeHome(null, ['https://mailbox.example']);
  const johnA = auth.generateIdentity('john').publicKey;
  const johnB = auth.generateIdentity('john').publicKey;

  const people = buildPeople(home, [peer('andy', 'KEY-ANDY', true), peer('john', johnA), peer('john', johnB)], 'https://mailbox.example');

  if (people.length === 3) {
    test.check('three peers on the mailbox are three rows');
  } else {
    test.fail('rows: ' + JSON.stringify(people));
  }

  const johns = people.filter(function (p) { return p.publicLabel === 'john'; });
  if (johns.length === 2 && johns[0].publicKey !== johns[1].publicKey) {
    test.check('two johns stay two rows, one per key');
  } else {
    test.fail('johns: ' + JSON.stringify(johns));
  }

  // Two rows a human cannot tell apart is a control nobody can use, so a
  // caption that would collide carries a piece of the key.
  if (johns[0].caption !== johns[1].caption && johns.every(function (p) { return p.ambiguous; })) {
    test.check('and their captions differ, because identical options cannot be picked between');
  } else {
    test.fail('captions: ' + JSON.stringify(johns.map(function (p) { return p.caption; })));
  }

  // Every Ed25519 key in base64 SPKI opens with the same ASN.1 header,
  // so a fragment taken from the front of the key distinguishes nothing.
  // This is the check that caught it.
  if (johns[0].publicKey.slice(0, 12) === johns[1].publicKey.slice(0, 12)) {
    test.check('two different keys really do share a long common prefix');
  } else {
    test.fail('keys no longer share a prefix — the tail rule may be pointless now');
  }

  if (people[0].caption === 'andy' && !people[0].ambiguous) {
    test.check('an unambiguous caption is left alone');
  } else {
    test.fail('andy row: ' + JSON.stringify(people[0]));
  }

  // Every peer is now in whoBook, keyed by key, with the mailbox it was
  // seen on — that is what makes the caption this node's to change.
  const book = whoBook.load(home);
  if (book.length === 3 && book.every(function (r) { return r.relays.indexOf('https://mailbox.example') !== -1; })) {
    test.check('each peer is handshaken into whoBook with the mailbox it was seen on');
  } else {
    test.fail('whoBook: ' + JSON.stringify(book));
  }
}

test.subHeading('The caption is myLabel when this node has one');

{
  const home = nodeHome(null, ['https://mailbox.example']);
  const johnA = auth.generateIdentity('john').publicKey;
  const johnB = auth.generateIdentity('john').publicKey;
  const rows = [peer('john', johnA), peer('john', johnB)];

  buildPeople(home, rows, 'https://mailbox.example');
  whoBook.setMyLabel(home, johnA, 'lovelyJohn');
  whoBook.setMyLabel(home, johnB, 'otherJohn');

  const people = buildPeople(home, rows, 'https://mailbox.example');
  const captions = people.map(function (p) { return p.caption; }).sort();
  if (captions[0] === 'lovelyJohn' && captions[1] === 'otherJohn') {
    test.check('private captions win over the public label');
  } else {
    test.fail('captions: ' + JSON.stringify(captions));
  }

  if (people.every(function (p) { return !p.ambiguous; })) {
    test.check('and once they read differently, no key fragment is added');
  } else {
    test.fail('still ambiguous: ' + JSON.stringify(people));
  }

  // The public label is still what the mailbox shows. Renaming is
  // perception; it must not rewrite what the peer is called on the wire.
  if (people.every(function (p) { return p.publicLabel === 'john'; })) {
    test.check('the public label is untouched — myLabel never leaves this node');
  } else {
    test.fail('public labels: ' + JSON.stringify(people));
  }

  // A relabelled peer that comes back from `who` keeps this node's
  // caption: handshake refreshes publicLabel, never myLabel.
  const renamed = buildPeople(home, [peer('johnny', johnA)], 'https://mailbox.example');
  if (renamed[0].caption === 'lovelyJohn' && renamed[0].publicLabel === 'johnny') {
    test.check('a peer who renames themselves on the mailbox keeps your caption');
  } else {
    test.fail('renamed: ' + JSON.stringify(renamed));
  }
}

test.subHeading('Who is me');

{
  const me = auth.generateIdentity('andy');
  const home = nodeHome(me, ['https://mailbox.example']);
  const people = buildPeople(home, [peer('andy', me.publicKey, true), peer('bert', 'KEY-BERT')], 'https://mailbox.example');

  const mine = people.filter(function (p) { return p.mine; });
  if (mine.length === 1 && mine[0].publicKey === me.publicKey) {
    test.check('the row carrying this node\'s own key is marked mine');
  } else {
    test.fail('mine: ' + JSON.stringify(people));
  }

  if (people[0].owner === true && people[1].owner === false) {
    test.check("and the mailbox's owner flag is carried through");
  } else {
    test.fail('owner flags: ' + JSON.stringify(people));
  }
}

// ---------------------------------------------------------------------
// The real hub, over loopback: picking a row sends to that key.
// ---------------------------------------------------------------------

function relayServer(box) {
  return new Promise(function (resolve) {
    const server = http.createServer(function (req, res) {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (req.method === 'GET' && url.pathname === '/api/relay/who') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        // The shape server.js actually sends — { peers: [...] }, not a
        // bare array. This stub said array first, the harness went green,
        // and the live mailbox returned an empty people list.
        res.end(JSON.stringify({ peers: box.who() }));
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

function runOverLoopback() {
  test.subHeading('Picking a row sends to that key, not to that name');

  // A mailbox with two johns on it, which is only reachable at all
  // because each claimed with an invite (keys mode, cycle 4).
  const relayHome = tmpHome('box');
  const box = createRelay(relayHome);
  const andy = auth.generateIdentity('andy');
  box.claim('andy', auth.sign(andy.privateKey, auth.claimMessage('andy')), andy.publicKey, '10.0.0.1');

  const invites = require('../run/js/invites');
  const johnA = auth.generateIdentity('john');
  const johnB = auth.generateIdentity('john');
  [johnA, johnB].forEach(function (j) {
    const minted = box.mint('andy', 'john', 7, auth.sign(andy.privateKey, invites.mintMessage('john', 7)));
    box.claim('john', auth.sign(j.privateKey, auth.claimMessage('john')), j.publicKey, '10.0.0.2', minted.ok && minted.invite.token);
  });

  let server;
  let hub;
  let home;

  return relayServer(box).then(function (s) {
    server = s;
    home = nodeHome(andy, [server.url]);
    hub = createHub(home);

    const res = fakeRes();
    hub.handleWho({}, res);
    return res.wait();
  }).then(function (res) {
    let data = {};
    try { data = JSON.parse(res.text); } catch (e) { data = {}; }
    const johns = (data.people || []).filter(function (p) { return p.publicLabel === 'john'; });
    if (res.status === 200 && data.people.length === 3 && johns.length === 2) {
      test.check('GET /api/hub/who lists every peer the mailbox has, johns included');
    } else {
      test.fail('hub who: ' + res.status + ' ' + res.text);
    }

    // `relay` is a destination and never a peer: it cannot be claimed,
    // so it appears in no `who`, and the To control would have no way to
    // offer it unless the node named it.
    const named = (data.people || []).some(function (p) { return p.publicLabel === 'relay'; });
    if (data.reservedName === 'relay' && !named) {
      test.check('the reserved destination travels with the list, outside it');
    } else {
      test.fail('reserved: ' + JSON.stringify({ reservedName: data.reservedName, named: named }));
    }

    // Send to the SECOND john by key. A typed "john" could not have
    // said which, and the relay would have refused it as ambiguous.
    const target = johns[1].publicKey;
    const res2 = fakeRes();
    hub.handleSend({}, res2, function () {
      return Promise.resolve({ from: 'andy', to: target, text: 'for the second john' });
    });
    return res2.wait().then(function (sent) {
      if (sent.status === 201) {
        test.check('a send addressed to a picked key is accepted');
      } else {
        test.fail('send by key: ' + sent.status + ' ' + sent.text);
      }

      const delivered = box.inbox(target, auth.sign(
        (johns[1].publicKey === johnA.publicKey ? johnA : johnB).privateKey,
        auth.inboxMessage(target)
      ));
      if (delivered.ok && delivered.messages.length === 1 && delivered.messages[0].text === 'for the second john') {
        test.check('and it lands in that john\'s inbox, not the other one');
      } else {
        test.fail('delivery: ' + JSON.stringify(delivered));
      }

      // The control this replaces: the ambiguous name the mailbox
      // itself refuses.
      const res3 = fakeRes();
      hub.handleSend({}, res3, function () {
        return Promise.resolve({ from: 'andy', to: 'john', text: 'which john?' });
      });
      return res3.wait();
    }).then(function (ambiguous) {
      if (ambiguous.status === 409) {
        test.check('while the typed name "john" is refused as ambiguous — what the list exists to avoid');
      } else {
        test.fail('typed name: ' + ambiguous.status + ' ' + ambiguous.text);
      }
      server.server.close();
    });
  });
}

runOverLoopback()
  .then(function () { test.reportSuccessFailureCount(); })
  .catch(function (err) {
    test.fail('chat 2 threw: ' + ((err && err.stack) || err));
    test.reportSuccessFailureCount();
  });
