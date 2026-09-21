'use strict';

// spirit/test/chosenMarks.js
// CHOOSING IS A MARK ON WHAT THE MACHINE REMEMBERS (0021, R38).
//
//   Andy: "ignoring means only: mark this row as "ignored"." — "it's the
//   chosen-mark that gives protection from eviction, if the memory
//   overflows. the shedded rows will first be ignored, then held, once the
//   memory is full with 'added' statuses no more can be chosen/added until
//   eviction by blocking or ignoring...." — "it's just reality."
//
// Four things: the order the sweep sheds in, and that it never reaches an
// added row; that a full memory refuses the next add and blocking makes
// room; that the book marks the memory on every save; and that the door
// marks a stranger it turned away.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const seenPeers = require('../run/js/seenPeers');
const nodeStore = require('../run/js/nodeStore');
const contactBook = require('../run/js/contacts');
const hub = require('../run/js/hub');

function home(tag) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-chosen-' + (tag || '') + '-'));
}

function clock() {
  let t = 1000;
  return { now: function () { return t; }, tick: function (ms) { t += ms; } };
}

function key(prefix, n) { return prefix + '-' + String(n).padStart(4, '0'); }

test.startTest('Choosing is a mark on what the machine remembers');

test.subHeading('The sweep sheds in order, and never reaches an added row');

{
  const H = home('order');
  const c = clock();
  const S = seenPeers.createSeenPeers({ rootDir: H, now: c.now, maxBytes: 64 * 1024 * 1024 });
  const store = nodeStore.open(H);

  // ADDED ARE THE OLDEST, on purpose: if age alone ordered the sweep they
  // would be the first to go. The mark has to beat the clock.
  const tiers = [['ADDED', 'added', false], ['HELD', 'held', false],
    ['IGNORED', 'ignored', false], ['BLOCKED', 'held', true], ['STRANGER', '', false]];
  tiers.forEach(function (t) {
    for (let n = 0; n < 60; n += 1) {
      c.tick(10);
      S.note(key(t[0], n), { at: 'R', url: 'https://relay.example', label: t[0].toLowerCase() + n });
      if (t[1] || t[2]) S.mark(key(t[0], n), t[1], t[2]);
    }
  });

  function left(prefix) {
    let k = 0;
    for (let n = 0; n < 60; n += 1) if (store.seen.get(key(prefix, n))) k += 1;
    return k;
  }

  // Squeeze in steps, and at every step the line must have been kept.
  let orderKept = true;
  let addedKept = true;
  let steps = 0;
  const full = store.seen.bytes();
  for (let cap = full; cap > 4096; cap = Math.floor(cap * 0.8)) {
    store.seen.sweepToBytes(cap);
    steps += 1;
    const s = left('STRANGER');
    const i = left('IGNORED') + left('BLOCKED');
    const h = left('HELD');
    // A later tier may only lose rows once every earlier tier is empty.
    if ((i < 120 && s > 0) || (h < 60 && (s > 0 || i > 0))) orderKept = false;
    if (left('ADDED') !== 60) addedKept = false;
  }

  if (orderKept && steps > 3) {
    test.check('squeezed ' + steps + ' times: strangers went first, then ignored and blocked, then held — never out of turn');
  } else {
    test.fail('order broken: strangers ' + left('STRANGER') + ', ignored+blocked ' +
      (left('IGNORED') + left('BLOCKED')) + ', held ' + left('HELD'));
  }
  if (addedKept && left('HELD') === 0) {
    test.check('and all 60 added people survived a squeeze that took everyone else, though they were the oldest');
  } else {
    test.fail('added left: ' + left('ADDED') + ', held left: ' + left('HELD'));
  }
}

test.subHeading('A full memory refuses the next add; letting somebody go makes room');

{
  const H = home('full');
  const c = clock();
  const cap = 64 * 1024;
  const S = seenPeers.createSeenPeers({ rootDir: H, now: c.now, maxBytes: cap });

  // Add people until the cap is spent on them alone.
  let n = 0;
  while (S.roomToAdd(key('FRIEND', n)) && n < 5000) {
    c.tick(1);
    S.note(key('FRIEND', n), { at: 'R', url: 'https://relay.example', label: 'friend' + n });
    S.mark(key('FRIEND', n), 'added', false);
    n += 1;
  }

  if (n > 10 && n < 5000 && !S.roomToAdd('SOMEBODY-NEW')) {
    test.check('after ' + n + ' added people the ' + (cap / 1024) + ' KB cap is spent, and the next add is refused');
  } else {
    test.fail('added ' + n + ', room for one more: ' + S.roomToAdd('SOMEBODY-NEW'));
  }
  if (S.roomToAdd(key('FRIEND', 0))) {
    test.check('somebody already added needs no room — re-adding them is not refused');
  } else {
    test.fail('an existing friend was refused');
  }

  // "until eviction by blocking or ignoring": block a third of them.
  for (let k = 0; k < Math.ceil(n / 3); k += 1) S.mark(key('FRIEND', k), 'added', true);
  if (S.roomToAdd('SOMEBODY-NEW') && S.get(key('FRIEND', 0)) === null) {
    test.check('blocking some hands their rows back to the sweep, and there is room again');
  } else {
    test.fail('no room after blocking, or the blocked row survived: ' + JSON.stringify(S.get(key('FRIEND', 0))));
  }
}

test.subHeading('The book marks the memory, every time it is saved');

{
  const H = home('book');
  const store = nodeStore.open(H);
  contactBook.acquire(H, { publicKey: 'KEY-ANN', publicLabel: 'ann' }, 'handle');
  contactBook.hold(H, { publicKey: 'KEY-BOB', publicLabel: 'bob' });
  contactBook.acquire(H, { publicKey: 'KEY-CAT', publicLabel: 'cat' }, 'handle');
  contactBook.setBlocked(H, 'KEY-CAT', true);

  const ann = store.seen.get('KEY-ANN');
  const bob = store.seen.get('KEY-BOB');
  const cat = store.seen.get('KEY-CAT');
  if (ann && ann.choice === 'added' && bob && bob.choice === 'held' && cat && cat.blocked) {
    test.check('added, held and blocked in the book are added, held and blocked in the memory');
  } else {
    test.fail('marks: ' + JSON.stringify({ ann: ann, bob: bob, cat: cat }));
  }
  // Marked without ever being seen: a pasted key has no date and no
  // presence, and the row says so rather than guessing.
  if (ann && ann.seen === 0 && ann.present === null) {
    test.check('a contact the node has never seen is marked with no date and no presence, not a guess');
  } else {
    test.fail('ann: ' + JSON.stringify(ann));
  }

  contactBook.forget(H, 'KEY-ANN');
  const after = store.seen.get('KEY-ANN');
  if (after && after.choice === '' && !after.blocked) {
    test.check('forgetting somebody takes the mark off and leaves the memory — they are a stranger again, not erased');
  } else {
    test.fail('after forget: ' + JSON.stringify(after));
  }
}

test.subHeading('The door marks a stranger it turned away, and nobody the owner chose');

{
  const H = home('door');
  hub.remember(H, 'KEY-STRANGER', 'drop', '');
  const s = hub.shadow(H).get('KEY-STRANGER');
  if (s && s.choice === 'ignored') {
    test.check('a stranger dropped under Ignore is remembered as ignored, not forgotten');
  } else {
    test.fail('stranger: ' + JSON.stringify(s));
  }

  // A held person also gets 'drop' from the door — not listened to yet —
  // and what the owner decided must outrank what the door did.
  contactBook.hold(H, { publicKey: 'KEY-WAITING', publicLabel: 'w' });
  hub.remember(H, 'KEY-WAITING', 'drop', '');
  const w = hub.shadow(H).get('KEY-WAITING');
  if (w && w.choice === 'held') {
    test.check('and somebody the owner is holding stays held when the door turns them away');
  } else {
    test.fail('waiting: ' + JSON.stringify(w));
  }
}

test.subHeading('Under Acquire, a full memory adds nobody');

{
  const H = home('acquire');
  fs.mkdirSync(path.join(H, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(H, 'relay-state', 'node.json'), JSON.stringify({ cacheMaxMB: 1 }));
  const S = hub.shadow(H);
  const store = nodeStore.open(H);
  // IN BULK, a thousand to a transaction, asking for room only between
  // batches: a megabyte is thousands of people, and one measured add at a
  // time is longer than the harness will wait.
  let n = 0;
  while (S.roomToAdd('KEY-NOBODY-YET') && n < 20000) {
    store.transaction(function () {
      for (let k = 0; k < 1000; k += 1, n += 1) {
        store.seen.put(key('OWN', n), { label: 'own' + n, seen: n + 1 });
        store.seen.putRoute(key('OWN', n), { at: 'R', url: 'https://relay.example', told: n + 1 });
        store.seen.mark(key('OWN', n), 'added', false);
      }
    });
  }
  const added = hub.remember(H, 'KEY-WRITER', 'admit', '');
  if (!added && !contactBook.byPublicKey(H, 'KEY-WRITER') && n < 20000) {
    test.check('with 1 MB spent on ' + n + ' added people, a stranger who writes is heard and not added');
  } else {
    test.fail('added=' + added + ' after ' + n);
  }
}

test.reportSuccessFailureCount();
