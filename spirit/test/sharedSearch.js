'use strict';

// spirit/test/sharedSearch.js
// ONE SEARCH FOR EVERY COLLECTION: KEY/LABEL PAIRS, CUT IN BYTES, AND A
// `more` THAT TELLS THE WHOLE TRUTH (puppets/G2, slice 1).
//
//   Andy, 2026-09-27: "there are no (complete) lists, only searches",
//   "the search returns an array of key/label couples", "the cap IS measure
//   in bytes only", "the getResult() call on the bucket is what creates the
//   byte-limited json result", and of added contacts, fed first: "gives them
//   only first consideration for the result return, but are flushed like
//   any other low quality match when the bucket overflows".
//
// The design is PUPPETS.md G2, decided 1-8. The names are claude-windows',
// sent before landing: searchBucket.js exports createSearch(opts) and
// MAX_SEARCHED_ITEMS; a search has offer(obj) and getResult(). It has no
// slots option: capacity is always maxSearchedItems, so nothing that
// matched is ever turned away, and `more` has two reasons, not three.
//
// Every refusal here is paired with its positive: a cut that never happens
// proves nothing about the cut.

const test = require('./testSupport.js');
const bucket = require('../run/js/searchBucket');

test.startTest('One search for every collection: key/label pairs, cut in bytes, more tells the truth');

function bytes(result) { return Buffer.byteLength(JSON.stringify(result), 'utf8'); }

// A collection's hooks: hook 1 is the text to MATCH (title and description,
// decided 8), hook 2 the pair to KEEP. `calls` counts what the search looked at.
function hooks(calls) {
  return {
    getLabelStringFromIncomingObject: function (o) {
      if (calls) calls.seen[o.id] = true;
      return o.title + ' ' + (o.description || '');
    },
    extractKeyAndLabelFromRow: function (o) { return { key: o.id, label: o.title }; },
  };
}
function search(opts, calls) { return bucket.createSearch(Object.assign(hooks(calls), opts || {})); }
function obj(id, title, description) { return { id: id, title: title, description: description || '', secret: 'never kept' }; }

if (typeof bucket.createSearch !== 'function') {
  test.fail('searchBucket.js has no createSearch: nothing below can run (puppets/G2 is declared in puppetsPending.js)');
  test.reportSuccessFailureCount();
} else {
  // ── '*' IS EVERYTHING, AND ONLY PAIRS ARE KEPT ──────────────────────
  {
    const s = search({});
    [obj('a', 'alpha'), obj('b', 'beta'), obj('c', 'gamma')].forEach(function (o) { s.offer(o); });
    const r = s.getResult();
    const shapes = (r.items || []).map(function (i) { return Object.keys(i).sort().join(','); });
    if (r.items && r.items.length === 3 && r.more === false && shapes.every(function (k) { return k === 'key,label'; })) {
      test.check('the default search, "*", keeps every object offered, and keeps each as {key, label} only: '
        + 'nothing else of the object reaches the result');
    } else {
      test.fail('"*" over three objects gave ' + JSON.stringify(r));
    }
  }

  // ── HOOK 1 MATCHES THE DESCRIPTION; THE PAIR KEEPS ONLY THE LABEL ───
  {
    const s = search({ query: 'plumber' });
    s.offer(obj('k1', 'bert', 'the plumber from next door'));
    s.offer(obj('k2', 'ernie', 'a baker'));
    const r = s.getResult();
    if (r.items && r.items.length === 1 && r.items[0].key === 'k1' && r.items[0].label === 'bert') {
      test.check('a word only in the description finds the object (hook 1 is the text to match), and the '
        + 'pair it gives back holds the label alone (decided 8)');
    } else {
      test.fail('searching a description word gave ' + JSON.stringify(r));
    }
  }

  // ── BYTES, NOT CHARACTERS ───────────────────────────────────────────
  //
  // Each label is 20 characters but 60 bytes (a CJK character is three
  // bytes in UTF-8). A cap measured in characters lets the answer through
  // at up to three times the bound.
  {
    const wide = '漢'.repeat(20);
    const s = search({ maxBytes: 300 });
    for (let i = 0; i < 10; i += 1) s.offer(obj('w' + i, wide));
    const r = s.getResult();
    const whole = (r.items || []).every(function (i) { return i.label === wide; });
    if (bytes(r) <= 300 && r.items.length > 0 && r.items.length < 10 && whole && r.more === true) {
      test.check('with three-byte characters the result stays within 300 UTF-8 BYTES (' + bytes(r) + '), cut on '
        + 'whole pairs, with more=true: the cap is bytes, not characters (decided 5)');
    } else {
      test.fail('multibyte cut: ' + bytes(r) + ' bytes for a 300-byte cap, ' + (r.items || []).length
        + ' items, whole pairs ' + whole + ', more ' + r.more);
    }
  }

  // ── `more`: EACH OF ITS TWO REASONS, AND ITS CONTROL ───────────────
  {
    // Cut to fit: every match held, the bytes not enough.
    const s2 = search({ maxBytes: 60 });
    ['a', 'b', 'c', 'd', 'e'].forEach(function (k) { s2.offer(obj(k, 'label-' + k)); });
    const cut = s2.getResult();
    // Walk stopped: the limit reached with objects left unchecked.
    const s3 = search({ maxSearchedItems: 3 });
    const said = ['a', 'b', 'c', 'd', 'e'].map(function (k) { return s3.offer(obj(k, 'n' + k)); });
    const stopped = s3.getResult();
    // Control: exactly the limit, all fit, nothing left unchecked.
    const s4 = search({ maxSearchedItems: 3 });
    ['a', 'b', 'c'].forEach(function (k) { s4.offer(obj(k, 'n' + k)); });
    const exact = s4.getResult();
    if (cut.more === true && cut.items.length > 0 && cut.items.length < 5 && bytes(cut) <= 60
        && stopped.more === true && said.join() === 'true,true,true,false,false'
        && exact.more === false && exact.items.length === 3) {
      test.check('more is true when the answer was cut to fit and when the walk stopped at the limit with '
        + 'objects unchecked; and false for a walk that examined exactly the limit and ended on its own '
        + '(decided 6)');
    } else {
      test.fail('more: cut ' + JSON.stringify(cut) + '; offer said '
        + said.join() + ', stopped more ' + stopped.more + '; exact ' + JSON.stringify(exact));
    }
  }

  // ── THE OBJECT PAST THE LIMIT IS NOT EXAMINED ───────────────────────
  {
    // Counted by WHICH objects hook 1 saw, not how often it ran.
    const calls = { seen: {} };
    const s = search({ maxSearchedItems: 2 }, calls);
    ['a', 'b', 'c', 'd'].forEach(function (k) { s.offer(obj(k, 'n' + k)); });
    const seen = Object.keys(calls.seen).sort().join();
    if (seen === 'a,b') {
      test.check('past MAX_SEARCHED_ITEMS the search reads nothing more: 4 offered, only the first 2 looked at');
    } else {
      test.fail('with a limit of 2, hook 1 saw objects ' + seen + ' out of a,b,c,d');
    }
  }

  // ── FED FIRST IS NOT KEPT FIRST ─────────────────────────────────────
  //
  // 80 bytes fits one pair and not two (63 and 101 bytes measured), so the
  // byte cut is what flushes the weaker one, as the bucket overflowing would.
  {
    const s = search({ query: 'bert smith', maxBytes: 80 });
    s.offer(obj('added', 'bert jones'));     // his contact, fed first, half a match
    s.offer(obj('stranger', 'bert smith')); // a stranger, offered later, the whole match
    const r = s.getResult();
    const t = search({ query: 'bert smith', maxBytes: 80 });
    t.offer(obj('first', 'bert smith'));
    t.offer(obj('second', 'bert smith'));
    const tie = t.getResult();
    if (r.items.length === 1 && r.items[0].key === 'stranger' && tie.items[0].key === 'first') {
      test.check('an added contact fed first is flushed by a better stranger offered later, and between equal '
        + 'matches the one offered first wins: order only breaks ties (decided 4)');
    } else {
      test.fail('fed first: kept ' + JSON.stringify(r.items) + '; equal matches kept ' + JSON.stringify(tie.items));
    }
  }

  // ── ONE PAIR PER KEY ────────────────────────────────────────────────
  //
  // A walk over two sources can offer one contact twice. claude-windows:
  // "one pair per key, and the copy kept is the better match, or on a tie
  // the first offered".
  {
    const s = search({ query: 'bert smith' });
    s.offer(obj('dup', 'bert jones'));
    s.offer(obj('other', 'bert smith'));
    s.offer(obj('dup', 'bert smith'));
    const r = s.getResult();
    const keys = r.items.map(function (i) { return i.key; });
    const dup = r.items.filter(function (i) { return i.key === 'dup'; })[0];
    if (keys.length === 2 && keys.indexOf('dup') !== -1 && keys.indexOf('other') !== -1 && dup.label === 'bert smith'
        && r.more === false) {
      test.check('an object offered twice comes back once, as its better copy, and the duplicate does not make '
        + 'more true');
    } else {
      test.fail('offered twice: ' + JSON.stringify(r));
    }
  }

  // ── NON-MATCHES ARE NOT "MORE" ──────────────────────────────────────
  {
    const s = search({ query: 'zzz' });
    ['a', 'b', 'c'].forEach(function (k) { s.offer(obj(k, 'n' + k)); });
    const r = s.getResult();
    if (r.items.length === 0 && r.more === false) {
      test.check('objects that do not match are not viable and never make more true');
    } else {
      test.fail('three non-matches gave ' + JSON.stringify(r));
    }
  }

  // ── THE LIMIT IS ONE NUMBER ─────────────────────────────────────────
  if (bucket.MAX_SEARCHED_ITEMS === 1000) {
    test.check('MAX_SEARCHED_ITEMS is exported, 1000, today\'s searchMemoryRows default');
  } else {
    test.fail('MAX_SEARCHED_ITEMS is ' + JSON.stringify(bucket.MAX_SEARCHED_ITEMS));
  }

  test.reportSuccessFailureCount();
}
