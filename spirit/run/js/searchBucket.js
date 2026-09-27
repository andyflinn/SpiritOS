'use strict';

// spirit/run/js/searchBucket.js
// THE SHARED SEARCH OVER A COLLECTION: the bucket a list verb becomes.
//
// ITS OWN LAYER, ABOVE gradedSearch. bucket.js is a data structure with no
// opinion about quality and requires nothing; gradedSearch.js holds the one
// opinion about how well a label matches; this is the tool a collection's
// verb calls, beside peerSearch.js. The layering is the one
// test/peerSearch.js asserts, and it is kept rather than bent: Andy wanted
// "the graded search logic ... isolated", with "an independent evolution
// path".
//
// ── THE SHARED SEARCH OVER A COLLECTION (puppets/G2) ─────────────────
//
//   Andy, 2026-09-27: "there are no (complete) lists, only searches", and
//   "Everything, everywhere that goes out, is bounded by MAX_PAYLOAD."
//   The design, decided and written up in design/principles/PUPPETS.md, G2.
//
// WHAT THE CALLER DOES AND WHAT THIS DOES, split where he split it:
//
//   - THE WALK IS THE CALLER'S. "i doubt that bucket scans itself, that's a
//     can of worms ... the priority sequence can only be known by the user
//     of bucket.js". The caller goes through its own data in its own order
//     and offers each object; offer() answers false once
//     MAX_SEARCHED_ITEMS have been examined, and the caller stops.
//   - TWO HOOKS, in his names. getLabelStringFromIncomingObject(obj) is the
//     text a search MATCHES (title and description may both be in it:
//     PUPPETS.md G2, point 8). extractKeyAndLabelFromRow(obj) is the pair
//     the bucket KEEPS, {key, label}, and nothing else of the object is
//     held: "the bucket first checks if the incoming object is even viable,
//     if it is then it creates a key,label object to join the bucket,
//     inserted in a prioritized fashion."
//   - THE ORDER: how well it matches first, then the order it was offered.
//     "subject primarily to the seach string, second to the scan order."
//     The matching is gradedSearch's, the one opinion about quality in the
//     tree, never a second one here.
//   - getResult() MAKES THE ANSWER, CUT IN BYTES. "the cap IS measure in
//     bytes only", and "the getResult() call on the bucket is what creates
//     the byte-limited json result". UTF-8 bytes of the whole JSON answer,
//     never characters, cut on whole pairs, best first.
//   - `more` TELLS THE WHOLE TRUTH: a pair turned away for want of a spot,
//     a pair cut to fit the bytes, or a walk that stopped with objects left
//     unexamined. The requester narrows by searching; there is no paging.
//
// The default search is "*", which matches everything: a list is a search
// with an empty question.
var gradedSearch = require('./gradedSearch');
var limits = require('./limits');

var MAX_SEARCHED_ITEMS = 1000;

function utf8Bytes(text) {
  return Buffer.byteLength(String(text), 'utf8');
}

function createSearch(opts) {
  var o = opts || {};
  var labelString = o.getLabelStringFromIncomingObject;
  var keyAndLabel = o.extractKeyAndLabelFromRow;
  if (typeof labelString !== 'function' || typeof keyAndLabel !== 'function') {
    throw new Error('createSearch needs getLabelStringFromIncomingObject(obj) and extractKeyAndLabelFromRow(obj)');
  }
  var query = o.query == null || String(o.query).trim() === '' ? '*' : String(o.query);
  var maxSearched = typeof o.maxSearchedItems === 'number' && o.maxSearchedItems > 0
    ? Math.floor(o.maxSearchedItems) : MAX_SEARCHED_ITEMS;
  var maxBytes = typeof o.maxBytes === 'number' && o.maxBytes > 0
    ? Math.floor(o.maxBytes) : limits.PLAINTEXT_MAX;

  var matchingText = '';
  var graded = gradedSearch.open(query, {
    text: function () { return matchingText; },
    id: function (pair) { return pair.key; },
    scanOrder: true,
    // AS MANY SPOTS AS THE WALK MAY EXAMINE, and no option to shrink it.
    // A duplicate key holds a spot until getResult() drops it, so a smaller
    // bucket could let one push out a distinct match (wsl-claude). With a
    // spot for every object the walk can offer, nothing is ever turned
    // away for room: the byte cut and the walk limit are the bounds.
    slots: maxSearched,
  });

  var examined = 0;
  var walkStopped = false;

  // ── "*" STOPS THE WALK WHEN THE ANSWER IS FULL ──────────────────────
  //
  //   Andy, 2026-09-27: "the caller should understand that in the case of
  //   "*" he must not scan beyond the buckets limit?"
  //
  // The caller need not understand it: offer() says so. Under a query of
  // only '*', every object grades the same (checked: six unlike labels,
  // one quality), so the answer is the scan order and nothing offered
  // later can take a place from anything offered earlier. Once the pairs
  // offered fill the byte cap, the next one could never be sent, and the
  // walk is told to stop, with `more` set. Any other query ranks, so a
  // later object may still win a place, and the walk goes on to its limit.
  var everything = /^\*+$/.test(query.trim());
  var frameBytes = utf8Bytes(JSON.stringify({ items: [], more: false }));
  var usedByOrder = frameBytes;
  var keysByOrder = Object.create(null);
  var answerFull = false;

  return {
    // True while the caller may go on walking. The object that is answered
    // false was NOT examined, and it is what proves the walk left
    // something behind.
    offer: function (obj) {
      if (examined >= maxSearched || answerFull) { walkStopped = true; return false; }
      examined += 1;
      var pair = keyAndLabel(obj);
      if (!pair || pair.key == null) return true;
      // Called once: a hook may be costly or read a store (wsl-claude).
      var text = labelString(obj);
      matchingText = text == null ? '' : String(text);
      var held = { key: String(pair.key), label: String(pair.label == null ? '' : pair.label) };
      if (everything && !keysByOrder[held.key]) {
        var cost = utf8Bytes(JSON.stringify(held)) + (usedByOrder > frameBytes ? 1 : 0);
        // It will not be sent, so it was not examined: the contract of a
        // false answer, the same as at the walk limit.
        if (usedByOrder + cost > maxBytes) { answerFull = true; walkStopped = true; examined -= 1; return false; }
        usedByOrder += cost;
        keysByOrder[held.key] = true;
      }
      graded.offer(held);
      return true;
    },

    getResult: function () {
      var r = graded.result();
      var items = [];
      // The frame costs its own bytes, `more` at its longest ("false"), so
      // a cut never pushes the whole answer over by the width of a word.
      var used = utf8Bytes(JSON.stringify({ items: [], more: false }));
      var cut = false;
      // ONE PAIR PER KEY. A walk over two sources can offer the same object
      // twice (wsl-claude). The list is best first, so the copy kept is the
      // better match, or on a tie the one offered first.
      var emitted = Object.create(null);
      for (var i = 0; i < r.matches.length; i += 1) {
        var m = r.matches[i].item;
        if (emitted[m.key]) continue;
        var pair = { key: m.key, label: m.label };
        var cost = utf8Bytes(JSON.stringify(pair)) + (items.length ? 1 : 0);
        if (used + cost > maxBytes) { cut = true; break; }
        used += cost;
        emitted[m.key] = true;
        items.push(pair);
      }
      return { items: items, more: !!(r.more || cut || walkStopped) };
    },

    // For a caller that wants to say how broad the walk was.
    examined: function () { return examined; },
  };
}

module.exports = { createSearch: createSearch, MAX_SEARCHED_ITEMS: MAX_SEARCHED_ITEMS };
