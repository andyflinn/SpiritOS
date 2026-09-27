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

  return {
    // True while the caller may go on walking. The object that is answered
    // false was NOT examined, and it is what proves the walk left
    // something behind.
    offer: function (obj) {
      if (examined >= maxSearched) { walkStopped = true; return false; }
      examined += 1;
      var pair = keyAndLabel(obj);
      if (!pair || pair.key == null) return true;
      matchingText = String(labelString(obj) == null ? '' : labelString(obj));
      graded.offer({ key: String(pair.key), label: String(pair.label == null ? '' : pair.label) });
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
