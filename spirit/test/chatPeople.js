'use strict';
const rollOf = require('./rollOf');

// Contacts — the To control lists people this node ACQUIRED
// (CYCLE-CONTACTS-IMPL.md, replacing chat 2's "To is the roll").
//
// A mailbox roll is not an address book. Everyone who ever claimed on
// a public relay is in `who`, and a To list built from it means
// "everyone who exists" — which is how a friend picks a stranger's john.
// So a contactBook row carries how it arrived, and only some ways count:
//
//   roll  — seen in `who`. Not a contact. Also what a row with no
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
const { sealedPost } = require('./openReply');
const auth = require('../run/js/relayAuth');
const contactBook = require('../run/js/contacts');
const peerFile = require('../run/js/peerFile');
const peerStats = require('../run/js/peerStats');
// The arrival path itself. The counting sections at the foot of this file
// drive it directly — it is where the ring's read half went (R8).
const peerPost = require('../run/js/peerPost');
const { createRelay } = require('../run/js/relay');
const world = require('./world');
const hub = require('../run/js/hub');
const { createHub, buildPeople, handleMatches, keyTail, unknownPolicy, frontDoor, remember } = require('../run/js/hub');

const RELAY_URL = 'https://mailbox.example';

// ── THE RING'S THREE HELPERS, ASKED OF THE ROUTER ────────────────────
//
// This suite drove `acquireFromInbox`, `holdFromInbox` and
// `partitionInbox` — a batch of stored lines, sorted after the fact.
// R8 deleted all three with the ring on 2026-09-15 and the SUBJECT is
// untouched: who this node will hear from, and what writing to it earns
// you. peerPost asks the same questions per packet, at the moment of
// arrival, through `frontDoor` and `remember`.
//
// These helpers are deliberately thin, and `wrote` is a transcription of
// peerPost's four lines rather than a convenience: ask the front door,
// then write down whatever it said. Anything cleverer would be a second
// implementation of the door, and then this suite would be testing
// itself.
//
// TWO THINGS FALL OUT OF THAT, and both used to be special cases:
//
//   a note to YOURSELF files nobody. listenSet holds this node's own key,
//   so the verdict is `known` and `remember` does nothing with it. The
//   ring needed an explicit `m.fromKey === myKey` skip.
//
//   a message CANNOT DEMOTE a stronger row. An existing contact is
//   `known`, so nothing is written at all — where acquireFromInbox
//   wrote 'message' every time and leaned on contactBook to refuse the
//   downgrade. Two guards where one will do, and the one that is left is
//   the one the real path uses.
function wrote(home, messages, relayUrl) {
  (messages || []).forEach(function (m) {
    if (!m || !m.fromKey) return;
    const verdict = frontDoor(home, m.fromKey);
    if (verdict !== 'drop') remember(home, m.fromKey, verdict, relayUrl);
  });
}

function heldFrom(home, messages, relayUrl) {
  (messages || []).forEach(function (m) {
    if (m && m.fromKey) remember(home, m.fromKey, 'hold', relayUrl);
  });
}

// What partitionInbox answered, from the verdict the router actually
// uses. `known` is what an app would be handed; `unknown` counts the
// distinct strangers behind it, which is what `hold` reports and never
// names.
function partition(home, messages) {
  const known = [];
  const strangers = Object.create(null);
  (messages || []).forEach(function (m) {
    if (!m) return;
    if (!m.fromKey) { known.push(m); return; }
    if (frontDoor(home, m.fromKey) === 'known') known.push(m);
    else strangers[m.fromKey] = true;
  });
  return { known: known, unknown: Object.keys(strangers).length };
}

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

// The node's policy about strangers, written where Contacts writes it
// and where the hub now reads it (packet 5). No argument means no file,
// which is what a node that has never opened Contacts looks like.
function setUnknownPolicy(home, unknown) {
  const dir = path.join(home, 'app', 'contacts');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'prefs.json'), JSON.stringify({ unknown: unknown }, null, 2));
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

test.subHeading('A roll is not an address book');

// And since 2026-09-19 there is no roll to walk: buildPeople took one
// (`peers`) to refresh captions through contactBook.handshake and to mark
// rows `onRelay` and `owner`, and was fed [] once the roll went — so
// both marks were always false. Deleted with the roster readers (Andy:
// "nothing is allowed to return a roster").
{
  const home = nodeHome(null, [RELAY_URL]);
  if (buildPeople.length === 1 && buildPeople(home).length === 0 &&
      typeof contactBook.handshake === 'undefined') {
    test.check('the To list is built from the book alone — no roll argument, no roll sync');
  } else {
    test.fail('buildPeople takes ' + buildPeople.length + ' arguments');
  }

  // A row written before the field existed is exactly what a roll row
  // is, so that is how it reads — nothing has to be migrated.
  const johnA = auth.generateIdentity('john').publicKey;
  const legacy = nodeHome(null, [RELAY_URL]);
  fs.mkdirSync(path.join(legacy, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(legacy, 'relay-state', 'who.json'), JSON.stringify([
    { publicKey: johnA, publicLabel: 'john', myLabel: 'john', relays: [], onRelay: true, owner: true },
  ]));
  if (contactBook.contacts(legacy).length === 0 && buildPeople(legacy).length === 0) {
    test.check('a row from before the field is a roll row, and stays out of To');
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
  // Rows a roll sync left before 2026-09-19 — named, not contacts.
  contactBook.acquire(home, { publicKey: johnA, publicLabel: 'john', relay: RELAY_URL }, 'roll');
  contactBook.acquire(home, { publicKey: johnB, publicLabel: 'john', relay: RELAY_URL }, 'roll');
  // The policy is part of the fixture now rather than implied by calling
  // acquireFromInbox directly: the front door reads it, so a section
  // about strangers being let in has to be a node that lets them in.
  setUnknownPolicy(home, 'acquire');
  wrote(home, [
    line(1, 'john', johnA, me.publicKey, 'hello'),
    line(2, 'john', johnB, me.publicKey, 'also hello'),
  ], RELAY_URL);

  const people = buildPeople(home);
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
  contactBook.setMyLabel(home, johnA, 'lovelyJohn');
  const renamed = buildPeople(home);
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

  contactBook.acquire(home, { publicKey: bert, publicLabel: 'bert' }, 'handle');
  wrote(home, [line(3, 'bert', bert, 'KEY-ME', 'hi')], RELAY_URL);
  if (contactBook.acquiredVia(contactBook.byPublicKey(home, bert)) === 'handle') {
    test.check('a message does not demote a key confirmed out of band');
  } else {
    test.fail('downgraded to: ' + contactBook.acquiredVia(contactBook.byPublicKey(home, bert)));
  }

  // Seen again at a lower rank (a roll row, as older code wrote), the
  // public caption is corrected and the row is not turned back into a
  // stranger.
  contactBook.acquire(home, { publicKey: bert, publicLabel: 'bertram' }, 'roll');
  const row = contactBook.byPublicKey(home, bert);
  if (contactBook.acquiredVia(row) === 'handle' && row.publicLabel === 'bertram') {
    test.check('and seeing them at a lower rank updates the label without demoting the row');
  } else {
    test.fail('after roll: ' + JSON.stringify(row));
  }

  // Your own key is never filed by reading your own mail back.
  const me = auth.generateIdentity('andy');
  const own = nodeHome(me, [RELAY_URL]);
  wrote(own, [line(4, 'andy', me.publicKey, me.publicKey, 'note to self')], RELAY_URL);
  if (contactBook.contacts(own).length === 0) {
    test.check('and a note to yourself does not make you your own contact');
  } else {
    test.fail('self acquired: ' + JSON.stringify(contactBook.contacts(own)));
  }
}

test.subHeading('Add by handle: every key behind the word');

{
  const me = auth.generateIdentity('andy');
  const home = nodeHome(me, [RELAY_URL]);
  const johnA = auth.generateIdentity('john').publicKey;
  const johnB = auth.generateIdentity('john').publicKey;
  const bert = auth.generateIdentity('bert').publicKey;
  const roll = [
    peer('andy', me.publicKey, true),
    peer('john', johnA),
    peer('john', johnB),
    peer('bert', bert),
  ];

  const johns = handleMatches(home, roll, 'john');
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
  if (handleMatches(home, roll, 'joh').length === 0 && handleMatches(home, roll, 'JOHN').length === 2) {
    test.check('the handle matches the whole caption, case aside');
  } else {
    test.fail('partial or case handling is wrong');
  }

  if (handleMatches(home, roll, 'nobody').length === 0) {
    test.check('a handle nobody answers to is no candidates');
  } else {
    test.fail('invented a match');
  }

  // Never yourself: you cannot be added to your own address book.
  if (handleMatches(home, roll, 'andy').length === 0) {
    test.check('and this node is never a candidate for itself');
  } else {
    test.fail('self offered as a candidate');
  }

  // One match is still a question, so the candidate still carries its
  // tail — the UI has everything it needs to make somebody confirm.
  const one = handleMatches(home, roll, 'bert');
  if (one.length === 1 && one[0].tail === bert.slice(-6)) {
    test.check('a lone match is still shown by its key tail');
  } else {
    test.fail('bert: ' + JSON.stringify(one));
  }

  // What this node already thinks of a candidate rides along, so the UI
  // can say "already a contact" instead of offering the same person as
  // though they were new.
  setUnknownPolicy(home, 'acquire');
  wrote(home, [line(5, 'bert', bert, me.publicKey, 'hi')], RELAY_URL);
  if (handleMatches(home, roll, 'bert')[0].acquiredVia === 'message') {
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

  contactBook.acquire(home, { publicKey: johnA, publicLabel: 'john', relay: RELAY_URL }, 'roll');
  contactBook.acquire(home, { publicKey: johnB, publicLabel: 'john', relay: RELAY_URL }, 'roll');

  // The upgrade a confirm performs: roll to handle, in place, on one
  // key. Identity is the key, so the other john is untouched.
  contactBook.acquire(home, { publicKey: johnA, publicLabel: 'john', relay: RELAY_URL }, 'handle');

  const contacts = contactBook.contacts(home);
  if (contacts.length === 1 && contacts[0].publicKey === johnA && contactBook.acquiredVia(contacts[0]) === 'handle') {
    test.check('confirming one john makes one contact, marked handle');
  } else {
    test.fail('contacts: ' + JSON.stringify(contacts));
  }

  if (contactBook.acquiredVia(contactBook.byPublicKey(home, johnB)) === 'roll') {
    test.check('and the other john is still a stranger');
  } else {
    test.fail('the wrong john was promoted');
  }

  // A message afterwards does not undo the confirmation.
  wrote(home, [line(6, 'john', johnA, 'KEY-ME', 'hello again')], RELAY_URL);
  if (contactBook.acquiredVia(contactBook.byPublicKey(home, johnA)) === 'handle') {
    test.check('and a later message cannot demote it');
  } else {
    test.fail('handle was downgraded by a message');
  }

  // To is still contacts only: a roll row does not follow a confirm in.
  const people = buildPeople(home);

  // Every row carries its tail, not only the ambiguous ones. Contacts
  // puts it in the Handle column when the handle cannot identify a row —
  // two johns, or nobody who claimed a word at all — and an app that had
  // to slice it out of the key itself would be the fourth place holding
  // an opinion about how long a tail is.
  if (people.length && people.every(function (p) { return p.tail === keyTail(p.publicKey); })) {
    test.check('every row carries the key ending, cut by the one rule that decides what an ending is');
  } else {
    test.fail('tails: ' + JSON.stringify(people.map(function (p) { return p.tail; })));
  }
  if (people.length === 1 && people[0].publicKey === johnA) {
    test.check('the To list gains the confirmed key and no more');
  } else {
    test.fail('To after confirm: ' + JSON.stringify(people.map(function (p) { return p.caption; })));
  }
}
// ---------------------------------------------------------------------
// The real hub and a real relay, over loopback: being written to is how
// a contact appears.
// ---------------------------------------------------------------------
//
// THIS SECTION USED TO POLL. It stood up a stub relay serving
// `/api/relay/inbox` and `/api/relay/send`, and drove `hub.handleInbox`
// against it — because "reading your mail is how you come to know who
// wrote it" was a claim about what happens on a FETCH.
//
// R8 deleted the fetch on 2026-09-15. The claim survives it almost
// unchanged, and reads better for the change: coming to know who wrote
// to you is a claim about what happens when a PACKET ARRIVES. So the
// relay here is the real `createRelay` — no route stubs at all — and
// what crosses between the two nodes is a signed post down a held
// stream, which is the only thing that crosses now.
//
// `/api/relay/who` is still fetched, because the roll is still a
// fetch: it is the one GET that must work before a post is possible
// (decision 0010).

function relayServer(box) {
  return new Promise(function (resolve) {
    const server = http.createServer(function (req, res) {
      const url = new URL(req.url, 'http://127.0.0.1');
      // A `/api/relay/who` branch STOOD HERE serving rollOf(box). The
      // roll was deleted on 2026-09-18 (decision 0010, 0012), and a
      // fake more capable than the thing it stands in for is how two
      // mocks come to agree about a protocol neither implements.
      if (req.method === 'GET' && url.pathname === '/api/relay/key') {
        const own = box.ownerPublic();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          relayPublicKey: box.relayPublicKey(),
          relayLabel: box.relayLabel(),
          ownerKey: own.ownerKey,
          ownerLabel: own.ownerLabel,
        }));
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

function runOverLoopback() {
  test.subHeading('Through the node: a packet arrives, a contact appears');

  // The whole fixture in one line: a relay with a key of its own, an
  // owner on it, and bert invited and claimed. It was fifteen lines here
  // and fifteen more in five other files, and the mint-then-claim dance
  // is not what this suite is about.
  const L = world.build({ title: 'Andy and bert on one relay', peers: ['bert'] });
  if (!L.ok) { test.fail(L.error); return Promise.resolve(); }
  const box = L.box;
  const andy = L.owner;
  const bert = L.peer('bert');

  let server;
  let hub;
  let home;
  let arrivals;

  return relayServer(box).then(function (s) {
    server = s;
    home = nodeHome(andy, [server.url]);
    hub = createHub(home);

    // Andy's node, wired the way server.js wires it: a front door that
    // reads this node's policy, and a `remember` that is told which road
    // a packet came down.
    arrivals = [];
    const router = peerPost.createPeerPost({
      rootDir: home,
      request: function () { return Promise.resolve({ status: 200, text: '{}' }); },
      traffic: { note: function () {} },
      onArrival: function (item) { arrivals.push(item); },
      admit: function (from) { return frontDoor(home, from); },
      remember: function (from, verdict, relayUrl) {
        return remember(home, from, verdict, relayUrl);
      },
      stats: peerStats,
    });
    return hubWho(hub).then(function (data) { return { data: data, router: router }; });
  }).then(function (step) {
    const data = step.data;
    // Bert is on the relay. Andy has never heard from him.
    if (data.people && data.people.length === 0) {
      test.check('a relay full of peers is an empty To list until somebody writes');
    } else {
      test.fail('who returned: ' + JSON.stringify(data.people));
    }

    // Being added is the other half of adding. The tail somebody reads
    // out over the phone has to be readable on their own screen, and it
    // is their key, not the relay's.
    if (data.selfPublicKey === andy.publicKey && data.selfTail === andy.publicKey.slice(-6)) {
      test.check('who tells this node the end of its own key');
    } else {
      test.fail('selfTail was ' + JSON.stringify(data.selfTail));
    }
    if (data.selfTail !== data.relayPublicKey) {
      test.check('and that is your key, not the relay you are on');
    } else {
      test.fail('self and relay are the same key');
    }

    // Bert writes. Said nothing about the policy, so silence: bert is on
    // the relay and has written, and this node has still never added him.
    const TEXT = '{"app":"relay-chat","v":1,"body":"first line from bert"}';
    const packet = sealedPost(bert, andy, TEXT);
    return step.router.onRequest(server.url, packet)
      .then(function () { return { router: step.router, packet: packet }; });
  }).then(function (step) {
    if (arrivals.length === 0) {
      test.check('a node that names no policy hears nothing from a stranger');
    } else {
      test.fail('silent arrival: ' + JSON.stringify(arrivals));
    }
    return hubWho(hub).then(function (data) { return { data: data, step: step }; });
  }).then(function (both) {
    if (both.data.people && both.data.people.length === 0) {
      test.check('and the dropped packet put nobody in the To list');
    } else {
      test.fail('who after a silent arrival: ' + JSON.stringify(both.data.people));
    }
    // The same packet, with the node asking to hear it — said in the file
    // Contacts writes, which is the only place the door reads (packet 5).
    setUnknownPolicy(home, 'acquire');
    return both.step.router.onRequest(server.url, both.step.packet);
  }).then(function () {
    if (arrivals.length === 1 && /first line from bert/.test(arrivals[0].text)) {
      test.check('with Acquire in the file the same packet is delivered');
    } else {
      test.fail('arrivals: ' + JSON.stringify(arrivals));
    }
    return hubWho(hub);
  }).then(function (data) {
    const rows = data.people || [];
    if (rows.length === 1 && rows[0].publicKey === bert.publicKey && rows[0].acquiredVia === 'message') {
      test.check('and being written to is what put Bert in the To list');
    } else {
      test.fail('after arrival: ' + JSON.stringify(rows));
    }

    if (!rows.some(function (r) { return r.publicKey === andy.publicKey; })) {
      test.check('Andy is still not in his own list');
    } else {
      test.fail('self row appeared');
    }

    // ── HE ARRIVES UNNAMED, AND THAT IS THE DESIGN NOW (2026-09-18) ──
    //
    // THIS REVERSES THE CHECK THAT STOOD HERE. It asserted "the roll is
    // what named him", because `peer.list` used to walk the whole roll
    // and handshake every member into this book — so anybody who later
    // wrote to you was already captioned by a survey you had run before
    // they spoke.
    //
    //   Andy: "there is absolutely no reason for unbound entities to
    //   conduct surveys of our network." — "we're killing the roll. we
    //   will break what needs breaking."
    //
    // A survey by a BOUND entity is still a survey, and a name taken from
    // one is a name nobody gave you. So the arrangement is now:
    // acquisition carries the KEY and the ROAD, and **nothing carries the
    // caption** — a post carries none, because the relay does not read
    // the payload, which is the point rather than a regression.
    //
    // WHAT A PERSON SEES: a stranger who writes to you is a key until you
    // act on them. `peer.acquire` names them, and it asks about ONE key
    // when it does. The name arrives when somebody decides it should,
    // rather than as a side effect of opening Contacts.
    const bertRow = contactBook.byPublicKey(home, bert.publicKey);
    if (bertRow && !bertRow.publicLabel) {
      test.check('and he arrives UNNAMED — no survey ran, and the packet carried no caption');
    } else {
      test.fail('something captioned him: ' + JSON.stringify(bertRow && bertRow.publicLabel));
    }

    if (bertRow && bertRow.relays.indexOf(server.url) !== -1) {
      test.check('with the relay it arrived on recorded against it');
    } else {
      test.fail('contactBook row: ' + JSON.stringify(bertRow));
    }

    server.server.close();
  }).catch(function (err) {
    if (server && server.server) server.server.close();
    throw err;
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
  contactBook.acquire(home, { publicKey: bert.publicKey, publicLabel: 'bert', relay: RELAY_URL }, 'handle');

  const inbox = [
    line(1, 'bert', bert.publicKey, me.publicKey, 'from a contact'),
    line(2, 'carol', stranger.publicKey, me.publicKey, 'from a stranger'),
    line(3, 'andy', me.publicKey, me.publicKey, 'a note to myself'),
  ];

  const split = partition(home, inbox);
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
  const withRelay = partition(home, inbox.concat([
    { id: '9', from: 'relay', to: 'andy', fromKey: null, toKey: me.publicKey, text: 'relay status mode=keys' },
  ]));
  if (withRelay.known.some(function (m) { return m.from === 'relay'; }) && withRelay.unknown === 1) {
    test.check('the mailbox is always heard, and is nobody the count is about');
  } else {
    test.fail('relay line: ' + JSON.stringify(withRelay));
  }

  const twice = partition(home, inbox.concat([line(4, 'carol', stranger.publicKey, me.publicKey, 'again')]));
  if (twice.unknown === 1) {
    test.check('and it counts people, not lines');
  } else {
    test.fail('counted lines: ' + twice.unknown);
  }

  // The policy is read off this node's own disk (packet 5), so these are
  // files rather than values off a wire.
  //
  // Silence is what anything else means: no file, an empty one, one that
  // is not JSON, or one edited by hand into nonsense. A node that has
  // never opened Contacts, and a node whose prefs.json somebody broke,
  // must both end up at the tightest setting rather than quietly open.
  const bare = tmpHome('policy-none');
  const brokenHome = tmpHome('policy-broken');
  fs.mkdirSync(path.join(brokenHome, 'app', 'contacts'), { recursive: true });
  fs.writeFileSync(path.join(brokenHome, 'app', 'contacts', 'prefs.json'), '{oops');

  const nonsense = tmpHome('policy-nonsense');
  setUnknownPolicy(nonsense, 'everything');
  const shouty = tmpHome('policy-shouty');
  setUnknownPolicy(shouty, 'SILENT');

  const factory = [bare, brokenHome, nonsense, shouty].every(function (h) {
    return unknownPolicy(h) === 'silent';
  });

  const acquireHome = tmpHome('policy-acquire');
  setUnknownPolicy(acquireHome, 'acquire');
  const holdHome = tmpHome('policy-hold');
  setUnknownPolicy(holdHome, 'hold');

  if (factory && unknownPolicy(acquireHome) === 'acquire' && unknownPolicy(holdHome) === 'hold') {
    test.check('anything but a real choice in that file reads as silence');
  } else {
    test.fail('policy defaults are wrong');
  }

  // And nothing on the request is consulted. The old shape passed the
  // policy in from the poller; a value that looks like one must now be
  // read as a path, find nothing, and answer silent.
  if (unknownPolicy('acquire') === 'silent' && unknownPolicy('') === 'silent') {
    test.check('and a policy handed in on the request decides nothing at all');
  } else {
    test.fail('a wire value still steered the policy');
  }

  if (contactBook.byPublicKey(home, stranger.publicKey) === null) {
    test.check('a dropped line leaves nothing behind on disk');
  } else {
    test.fail('the stranger was filed anyway');
  }

  // Acquire is still available, and still exactly what cut 1 did.
  setUnknownPolicy(home, 'acquire');
  wrote(home, inbox, RELAY_URL);
  if (contactBook.acquiredVia(contactBook.byPublicKey(home, stranger.publicKey)) === 'message') {
    test.check('choosing Acquire is what lets a stranger in');
  } else {
    test.fail('acquire did not file the stranger');
  }

  if (partition(home, inbox).unknown === 0) {
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

  heldFrom(home, inbox, RELAY_URL);

  // The row is what Hold buys: somebody to say yes to. The message is
  // still dropped — holding is not hearing.
  const row = contactBook.byPublicKey(home, stranger.publicKey);
  if (row && contactBook.acquiredVia(row) === 'hold' && partition(home, inbox).known.length === 0) {
    test.check('a held sender gets a row, and their line still does not arrive');
  } else {
    test.fail('held: ' + JSON.stringify(row));
  }

  // And it is in the To list, marked, because a row nobody can see is a
  // person nobody can accept.
  const people = buildPeople(home);
  const carol = people.filter(function (p) { return p.publicKey === stranger.publicKey; })[0];
  if (carol && carol.held === true && carol.blocked === false) {
    test.check('and appears in To as somebody not added yet');
  } else {
    test.fail('people: ' + JSON.stringify(people));
  }

  // Somebody already decided about is not re-held: a blocked row must
  // not climb back out by writing again.
  contactBook.setBlocked(home, stranger.publicKey, true);
  contactBook.acquire(home, { publicKey: stranger.publicKey, publicLabel: 'carol' }, 'handle');
  heldFrom(home, inbox, RELAY_URL);
  const afterBlock = contactBook.byPublicKey(home, stranger.publicKey);
  if (contactBook.isBlocked(afterBlock) && contactBook.acquiredVia(afterBlock) === 'handle') {
    test.check('writing again neither unblocks nor demotes anybody');
  } else {
    test.fail('after writing while blocked: ' + JSON.stringify(afterBlock));
  }

  // A blocked contact is out of the listening set and still on screen.
  const blockedPeople = buildPeople(home);
  const shown = blockedPeople.filter(function (p) { return p.publicKey === stranger.publicKey; })[0];
  if (partition(home, inbox).known.length === 0 && shown && shown.held && shown.blocked) {
    test.check('a blocked contact is silent, listed, and says which it is');
  } else {
    test.fail('blocked in To: ' + JSON.stringify(shown));
  }

  // Unblocking is not accepting. Somebody blocked while still waiting
  // goes back to waiting: undoing a no is not saying yes.
  const waiting = tmpHome('waiting');
  auth.saveIdentity(waiting, me);
  contactBook.hold(waiting, { publicKey: stranger.publicKey, publicLabel: 'carol' });
  contactBook.setBlocked(waiting, stranger.publicKey, true);
  contactBook.setBlocked(waiting, stranger.publicKey, false);
  const backToWaiting = contactBook.byPublicKey(waiting, stranger.publicKey);
  if (contactBook.acquiredVia(backToWaiting) === 'hold' && !contactBook.listens(backToWaiting)) {
    test.check('unblocking somebody who was never accepted leaves them waiting');
  } else {
    test.fail('after unblock: ' + JSON.stringify(backToWaiting));
  }

  // And a nuisance nobody has ever added can still be blocked: being on
  // a list is not what makes somebody one.
  const fresh = tmpHome('nuisance');
  auth.saveIdentity(fresh, me);
  const nuisance = auth.generateIdentity('dave');
  contactBook.hold(fresh, { publicKey: nuisance.publicKey, publicLabel: 'dave' });
  contactBook.setBlocked(fresh, nuisance.publicKey, true);
  const shut = contactBook.byPublicKey(fresh, nuisance.publicKey);
  if (contactBook.isBlocked(shut) && !contactBook.listens(shut) &&
      contactBook.addressBook(fresh).length === 1) {
    test.check('somebody never added can be blocked, and stays visible to undo');
  } else {
    test.fail('blocked stranger: ' + JSON.stringify(shut));
  }

  // What YOU call that key, which the address book edits and the wire
  // never sees. The caption follows it; publicLabel does not move.
  const named = auth.generateIdentity('bert');
  contactBook.acquire(home, { publicKey: named.publicKey, publicLabel: 'bert' }, 'handle');
  contactBook.setMyLabel(home, named.publicKey, 'lovelyBert');
  const relabelled = buildPeople(home)
    .filter(function (p) { return p.publicKey === named.publicKey; })[0];
  if (relabelled && relabelled.caption === 'lovelyBert' && relabelled.myLabel === 'lovelyBert' &&
      relabelled.publicLabel === 'bert') {
    test.check('a private label captions the row without touching their own name');
  } else {
    test.fail('after relabel: ' + JSON.stringify(relabelled));
  }

  // Accepting is the way back, and it is one call.
  contactBook.accept(home, stranger.publicKey);
  if (partition(home, inbox).known.length === 1) {
    test.check('and accepting them is what lets the next line through');
  } else {
    test.fail('still silent after accept');
  }
}

test.subHeading('What a contact costs in disk is counted, not remembered');

{
  const home = nodeHome(null, [RELAY_URL]);
  const bert = auth.generateIdentity('bert').publicKey;
  const carol = auth.generateIdentity('carol').publicKey;
  contactBook.acquire(home, { publicKey: bert, publicLabel: 'bert' }, 'message');
  contactBook.acquire(home, { publicKey: carol, publicLabel: 'carol' }, 'message');

  const byKey = {};
  buildPeople(home).forEach(function (p) { byKey[p.publicKey] = p; });
  if (byKey[bert] && byKey[bert].bytesHeld === 0 && byKey[carol].bytesHeld === 0) {
    test.check('somebody who has cost nothing reads 0, not absent');
  } else {
    test.fail('empty: ' + JSON.stringify([byKey[bert], byKey[carol]].map(function (p) { return p && p.bytesHeld; })));
  }

  // Written where chat writes one, and named the way peerFile names one.
  const logs = path.join(home, 'app', 'relayChat', 'logs');
  fs.mkdirSync(logs, { recursive: true });
  fs.writeFileSync(path.join(logs, peerFile.fileName(bert)), 'x'.repeat(300));

  // And one written by an app that does not exist yet. This is the whole
  // point of the walk: Storage means what the NODE holds for that key,
  // so a second app keeping its own per-peer file has to land in the
  // same number without hub.js being edited again.
  const cards = path.join(home, 'app', 'chess', 'games');
  fs.mkdirSync(cards, { recursive: true });
  fs.writeFileSync(path.join(cards, peerFile.fileName(bert)), 'y'.repeat(700));

  // A file in the same folder that is not a peer file at all, and a peer
  // file belonging to somebody else. Neither may be counted here.
  fs.writeFileSync(path.join(logs, 'index.json'), 'z'.repeat(9999));
  fs.writeFileSync(path.join(logs, peerFile.fileName(carol)), 'c'.repeat(120));

  const after = {};
  buildPeople(home).forEach(function (p) { after[p.publicKey] = p; });
  if (after[bert].bytesHeld === 1000 && after[carol].bytesHeld === 120) {
    test.check('two apps holding files for one key sum into one number, and nobody else\'s is added');
  } else {
    test.fail('bytesHeld: bert ' + after[bert].bytesHeld + ', carol ' + after[carol].bytesHeld);
  }

  // Nothing is written down, so nothing can drift. Trimming a log is
  // what CHAT_LOG_CAP does at 500, and a stored counter would keep
  // reporting the bytes that trim just freed.
  fs.writeFileSync(path.join(logs, peerFile.fileName(bert)), 'x'.repeat(10));
  const trimmed = buildPeople(home)
    .filter(function (p) { return p.publicKey === bert; })[0];
  if (trimmed.bytesHeld === 710) {
    test.check('and a log that is trimmed makes the number fall, because it was never stored');
  } else {
    test.fail('after trim: ' + trimmed.bytesHeld);
  }
}

// ── DRIVEN THROUGH THE ROUTER FROM HERE ──────────────────────────────
//
// The three sections below asked their questions of `applyInboxBatch`,
// which R8 deleted with the ring on 2026-09-15. They ask the same
// questions of `peerPost.onRequest`, which is where packets arrive now —
// one at a time, off a stream, instead of a batch off a poll.
//
// That is a better fixture than the one it replaces. `applyInboxBatch`
// was a function this suite called; `onRequest` is the function the
// node actually runs, with its own signature check and its own front
// door in front of it. What used to be a claim about a helper is now a
// claim about the path.
//
// A node with a router, an address book and a real front door. `stats`
// is wired because counting is what these sections are about — most
// suites leave it out.
function countingNode(me, home) {
  const arrived = [];
  const router = peerPost.createPeerPost({
    rootDir: home,
    request: function () { return Promise.resolve({ status: 200, text: '{}' }); },
    traffic: { note: function () {} },
    onArrival: function (item) { arrived.push(item); },
    admit: function (from) { return frontDoor(home, from); },
    remember: function (from, verdict, relayUrl) {
      return remember(home, from, verdict, relayUrl);
    },
    stats: peerStats,
  });
  return { router: router, arrived: arrived };
}

// One packet, signed by its sender and addressed here — the shape that
// comes off the wire.
// Sealed, like every post but a card (cycle 10, R5): a node refuses an
// unsealed one, so a plaintext fixture would test the refusal instead.
function arriving(sender, toId, text) {
  return sealedPost(sender, toId, text);
}

test.subHeading('Who is counted, and who is not');

async function whoIsCounted() {
  // The eligibility rules are the node's, not peerStats' (packet 7).
  // peerStats knows how to count; whether a key MAY be counted is a
  // question about the address book, and a sidecar with an opinion about
  // blocked or held would be a second book nobody could see.
  //
  // They lived in hub.countInbound until R8 and live in peerPost now,
  // beside the stats call. Moved rather than rewritten — the comment
  // there carries Grok's three rules verbatim.
  const me = auth.generateIdentity('andy');
  const home = nodeHome(me, [RELAY_URL]);

  const friend = auth.generateIdentity('bert');
  const waiting = auth.generateIdentity('carol');
  const refused = auth.generateIdentity('dave');
  const stranger = auth.generateIdentity('eve');

  contactBook.acquire(home, { publicKey: friend.publicKey, publicLabel: 'bert' }, 'message');
  contactBook.hold(home, { publicKey: waiting.publicKey, publicLabel: 'carol' });
  contactBook.acquire(home, { publicKey: refused.publicKey, publicLabel: 'dave' }, 'message');
  contactBook.setBlocked(home, refused.publicKey, true);

  setUnknownPolicy(home, 'silent');
  const N = countingNode(me, home);
  await N.router.onRequest(RELAY_URL, arriving(friend, me, 'hello'));
  await N.router.onRequest(RELAY_URL, arriving(waiting, me, 'let me in'));
  await N.router.onRequest(RELAY_URL, arriving(refused, me, 'still here'));
  await N.router.onRequest(RELAY_URL, arriving(stranger, me, 'who am i'));
  // Our own line coming back. Counting it would make writing to somebody
  // look like them writing to us.
  await N.router.onRequest(RELAY_URL, arriving(me, me, 'note to self'));

  const count = function (key) { return peerStats.readSummary(home, key).unansweredInbound; };

  if (count(friend.publicKey) === 1) {
    test.check('a contact who writes is counted');
  } else {
    test.fail('friend: ' + count(friend.publicKey));
  }

  // Grok's answer, and the one that is not obvious: the hourglass is
  // consideration, and a line you dropped unread was still a demand on
  // your attention. The count is the only trace hold is allowed to keep
  // — the body is never written anywhere.
  //
  // THIS IS THE RULE R8 CAME CLOSEST TO EATING. `admitted` is the
  // router's word for "may be handed to an app", and it excludes `hold`
  // by design; inheriting it as the counting predicate would have made a
  // waiting stranger silently free. Counting is not delivering.
  if (count(waiting.publicKey) === 1) {
    test.check('and somebody waiting is counted, because a dropped line was still a demand');
  } else {
    test.fail('waiting: ' + count(waiting.publicKey));
  }

  if (count(refused.publicKey) === 0 && count(stranger.publicKey) === 0 &&
      count(me.publicKey) === 0) {
    test.check('and a blocked key, a silent stranger and our own key are all counted as nothing');
  } else {
    test.fail('refused ' + count(refused.publicKey) + ', stranger ' +
      count(stranger.publicKey) + ', self ' + count(me.publicKey));
  }

  // A silent stranger gets no row and no sidecar. A file for somebody
  // the book does not list would be a hidden second book — the exact
  // thing `silent` is chosen to avoid.
  if (!fs.existsSync(peerStats.statsPath(home, stranger.publicKey))) {
    test.check('and no file is written for a stranger the book refused to list');
  } else {
    test.fail('sidecar written for a silent stranger');
  }

  // And nothing of the stranger reached an app either. On the ring this
  // was a filter over a returned batch; here it is the front door, and
  // the packet never becomes an arrival at all.
  if (N.arrived.length === 2) {
    test.check('while only the contact and this node itself reached an app');
  } else {
    test.fail('arrivals: ' + N.arrived.length);
  }

  // Blocked freezes where it stood — it does not fall to zero and the
  // file is not deleted, because bytesHeld is still telling the truth
  // about disk that is really being used.
  //
  // Asked under `acquire`, which is the setting that makes it a real
  // question: a blocked row is not in listenSet, so the door says
  // `admit` and only the book's own answer keeps the number still.
  peerStats.noteIn(home, refused.publicKey, 'earlier');
  const frozen = count(refused.publicKey);
  setUnknownPolicy(home, 'acquire');
  await N.router.onRequest(RELAY_URL, arriving(refused, me, 'again'));
  if (count(refused.publicKey) === frozen && frozen === 1) {
    test.check('and a blocked key\'s numbers freeze rather than fall, file and all');
  } else {
    test.fail('frozen at ' + frozen + ', now ' + count(refused.publicKey));
  }
}

test.subHeading('A row created by this packet is a row this packet can count');

async function countsTheRowItMakes() {
  // Order matters and is easy to get backwards: the row is written
  // before the count is taken, because under `hold` the row for a
  // waiting stranger is made by this very packet. Count first and the
  // very first line from somebody new is the one that never counts.
  const me = auth.generateIdentity('andy');
  const home = nodeHome(me, [RELAY_URL]);
  const newcomer = auth.generateIdentity('frank');

  setUnknownPolicy(home, 'hold');
  const N = countingNode(me, home);
  await N.router.onRequest(RELAY_URL, arriving(newcomer, me, 'hello?'));

  const row = contactBook.byPublicKey(home, newcomer.publicKey);
  if (row && contactBook.acquiredVia(row) === contactBook.HOLD &&
      peerStats.readSummary(home, newcomer.publicKey).unansweredInbound === 1) {
    test.check('under List them, the packet that creates the row is the packet that counts it');
  } else {
    test.fail('row ' + (row && contactBook.acquiredVia(row)) + ', count ' +
      peerStats.readSummary(home, newcomer.publicKey).unansweredInbound);
  }

  // And the packet itself is still not delivered. Counting is not
  // delivering, and a held sender must reach no app until a human says
  // so.
  await N.router.onRequest(RELAY_URL, arriving(newcomer, me, 'still?'));
  if (N.arrived.length === 0 &&
      peerStats.readSummary(home, newcomer.publicKey).unansweredInbound === 2) {
    test.check('and it is still held — counted is not delivered');
  } else {
    test.fail('delivered ' + N.arrived.length + ', count ' +
      peerStats.readSummary(home, newcomer.publicKey).unansweredInbound);
  }

  // AND WHICH ROAD THEY CAME DOWN IS WRITTEN DOWN. contactBook's `relays` is
  // "mailboxes where you have seen this key" — the only routing fact
  // this node holds about a stranger. acquireFromInbox recorded it, and
  // R8 would have taken it silently: peerPost had the relay url on every
  // traffic-log row and was not passing it to `remember`. Nothing caught
  // that while both transports were acquiring in parallel.
  if (row && (row.relays || []).indexOf(RELAY_URL) !== -1) {
    test.check('with the relay it arrived on recorded against the row');
  } else {
    test.fail('relays: ' + JSON.stringify(row && row.relays));
  }

  // AND NO CAPTION, which is the other half of the same fact and the one
  // thing R8 really did cost. acquireFromInbox read `publicLabel` off the
  // relay's stored copy of the line; a post carries keys and no captions,
  // because the relay does not read the payload. This node has walked no
  // roll, so there is nothing else to name him with — and that is what
  // an unnamed row looks like until one is walked.
  if (row && row.publicLabel === '') {
    test.check('and no caption — a post carries keys, and the roll does the naming');
  } else {
    test.fail('label on a node that walked no roll: ' + JSON.stringify(row && row.publicLabel));
  }
}

test.subHeading('There is one arrival path, and it is not a poll');

{
  // TWO CALLERS, ONE APPLY PATH stood here: `handleInbox` and
  // `sweepInbox` both had to go through `applyInboxBatch`, or the
  // address book and the counters would drift apart and only one of them
  // would ever be looked at. The sweep existed because counters that
  // advanced only while a chat window was open would make Contacts read
  // "quiet" for somebody who had been writing all afternoon.
  //
  // R8 deleted all three. The drift it guarded against cannot happen
  // now, for a better reason than agreement between two callers: there
  // is ONE path. A packet arrives on the stream, peerPost admits it,
  // remembers the sender and counts them, in that order, once.
  //
  // So the check inverts. It used to prove two callers shared a
  // function; it now proves the function they shared is gone and that
  // nothing has quietly grown a poll to replace it.
  const src = fs.readFileSync(path.join(__dirname, '..', 'run', 'js', 'hub.js'), 'utf8');
  const server = fs.readFileSync(path.join(__dirname, '..', 'run', 'js', 'server.js'), 'utf8');

  const ringNames = ['applyInboxBatch', 'sweepInbox', 'handleInbox', 'countInbound',
    'partitionInbox', 'acquireFromInbox', 'holdFromInbox'];
  // Called, not merely mentioned: every one of these is named in a
  // tombstone comment explaining what it was, and a scanner that could
  // not tell a call from an epitaph would make those comments
  // undeletable.
  const alive = ringNames.filter(function (name) {
    return new RegExp('(?:^|[^\\w.])' + name + '\\s*\\(', 'm').test(
      src.replace(/^\s*\/\/.*$/gm, '')
    );
  });
  if (!alive.length) {
    test.check('none of the ring\'s seven read-path functions is called anywhere in hub.js');
  } else {
    test.fail('still called: ' + alive.join(', '));
  }

  // And no timer pulls mail. The 60-second sweep was the last one, and a
  // node that polls is a node asking a relay to have kept something.
  if (!/setInterval[\s\S]{0,200}?[Ii]nbox/.test(server) && server.indexOf('INBOX_SWEEP_MS') === -1) {
    test.check('and no timer on the node pulls mail from a relay any more');
  } else {
    test.fail('a sweep timer survives in server.js');
  }

  // The rule that outlived the sweep: a --relay is a mailbox with no
  // book, nobody to count, and other people's keys on it. Counting has
  // never happened there and peerPost is where it happens now.
  const pp = fs.readFileSync(path.join(__dirname, '..', 'run', 'js', 'peerPost.js'), 'utf8');
  if (/stats\.noteIn\(rootDir, body\.from, hash\)/.test(pp)) {
    test.check('counting lives on the arrival path, keyed by the request hash');
  } else {
    test.fail('peerPost no longer counts inbound traffic');
  }
}
test.subHeading('What buildPeople hands the app');

{
  const home = nodeHome(null, [RELAY_URL]);
  const bert = auth.generateIdentity('bert').publicKey;
  contactBook.acquire(home, { publicKey: bert, publicLabel: 'bert' }, 'message');

  const fresh = buildPeople(home)[0];
  if (fresh.unansweredInbound === 0 && fresh.inboundPerDay === 0 && fresh.outboundPerDay === 0) {
    test.check('a contact from before any of this counted reads zeros, not undefined');
  } else {
    test.fail('fresh: ' + JSON.stringify(fresh));
  }

  // Zeros are the TRUE answer, and the reason they are true is that
  // nothing was backfilled. Chat's ring caps at 500, so a total taken
  // from it stops rising exactly when somebody becomes worth looking at.
  peerStats.noteIn(home, bert, 'm1');
  peerStats.noteIn(home, bert, 'm2');
  peerStats.noteOut(home, bert);
  const counted = buildPeople(home)[0];
  if (counted.unansweredInbound === 0 && counted.inboundPerDay > 0 && counted.outboundPerDay > 0) {
    test.check('and once counted, the reply has cleared unanswered while both rates stand');
  } else {
    test.fail('counted: ' + JSON.stringify(counted));
  }

  // The counters are in the sidecar and NOT on the row. who.json is what
  // a human decided; a packet counter is not a decision, and a book that
  // changed without one would be the wrong kind of record.
  const book = JSON.stringify(contactBook.load(home));
  if (book.indexOf('unansweredInbound') === -1 && book.indexOf('inboundPerDay') === -1 &&
      book.indexOf('days') === -1) {
    test.check('and who.json grew no counter fields — the book is still only decisions');
  } else {
    test.fail('counters leaked into who.json: ' + book);
  }

  // The sidecar lives where bytesHeld already looks, so what the
  // counting costs is itself part of what the contact costs.
  if (counted.bytesHeld > 0) {
    test.check('and the sidecar counts toward that contact\'s own storage, as any peerfile does');
  } else {
    test.fail('bytesHeld: ' + counted.bytesHeld);
  }
}

runOverLoopback()
  .then(unknownMail)
  .then(heldAndBlocked)
  // Async since R8: the counting sections drive peerPost.onRequest, which
  // is a promise, where applyInboxBatch was a call and a return.
  .then(whoIsCounted)
  .then(countsTheRowItMakes)
  .then(function () { test.reportSuccessFailureCount(); })
  .catch(function (err) {
    test.fail('contacts threw: ' + ((err && err.stack) || err));
    test.reportSuccessFailureCount();
  });
