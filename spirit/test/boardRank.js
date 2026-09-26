'use strict';

// spirit/test/boardRank.js
// WHAT UNBLOCKS MOST GOES FIRST — the order the scoreboard is read in.
//
//   Andy, 2026-09-27: "is it ranked by resoves most blockages? because the
//   "What needs you" section is a de-facto highlight of the (let's say 3)
//   most blocking issues? and the rest should follow and re-order based on
//   blocking/dependencies" — and, of building it: "lets start with a
//   ranking and see if that makes the board adapt to progress..."
//
// AN EXPERIMENT, SAID SO. The question it answers is whether the order
// MOVES as work lands. If it never moves, the ranking is decoration.
//
// NOT A SUITE. Pure: it takes what the tree declares and answers an order
// and a list of things it could not rank. runAll renders; boardRankSuite
// asserts. Kept out of runAll.js so the graph can be tested on fixtures
// instead of eyeballed on a rendered page.
//
// ── WHAT IT READS ────────────────────────────────────────────────────
//
//   owed       [{ id, after: [ids] }]  — every requirement a suite declares
//                                        awaiting; `after` is what it waits on
//   questions  [{ key, covers: [ids] }] — open rows in blocking.js
//   isDone(id) — the requirement's own document says DONE
//   isKnown(id) — some document defines it
//
// ── WHAT IT REFUSES TO DO QUIETLY — the five prints ──────────────────
//
// Each of these is a way a ranking lies with a straight face, so each is
// returned for the page to print rather than smoothed over:
//
//   1. cycles        items waiting on each other. Counted, never looped,
//                    and no edge is dropped to break one.
//   2. undeclared    a question covering an id no suite declares. It would
//                    rank 0 and sink, while being a real blocker.
//   3. deadEdges     `after` naming something DONE (dropped by derivation,
//                    or one finished item distorts the order for ever) or
//                    something nothing defines.
//   4. unlinked      owed items with no edge in or out. Counted, not ranked:
//                    a ranking over them would claim a completeness it
//                    does not have.
//   5. the count     returned beside every item, so the page can show WHY
//                    something is first. A count rewards whoever declares
//                    many small units, and the order must not hide that.

function rank(input) {
  const owedList = (input && input.owed) || [];
  const questions = (input && input.questions) || [];
  const isDone = (input && input.isDone) || function () { return false; };
  const isKnown = (input && input.isKnown) || function () { return true; };

  const owed = Object.create(null);
  owedList.forEach(function (o) { owed[o.id] = true; });

  // released[B] = the owed items that wait on B directly.
  const released = Object.create(null);
  const deadEdges = [];
  const linked = Object.create(null);
  owedList.forEach(function (o) {
    (o.after || []).forEach(function (to) {
      if (to === o.id) { deadEdges.push({ from: o.id, to: to, why: 'itself' }); return; }
      if (owed[to]) {
        (released[to] = released[to] || []).push(o.id);
        linked[o.id] = true;
        linked[to] = true;
        return;
      }
      deadEdges.push({ from: o.id, to: to,
        why: isDone(to) ? 'done' : (isKnown(to) ? 'unwatched' : 'unknown') });
    });
  });

  // Everything that becomes free, transitively, once `id` lands. A visited
  // set, so a cycle ends the walk instead of looping it.
  function freed(id) {
    const seen = Object.create(null);
    const stack = (released[id] || []).slice();
    while (stack.length) {
      const n = stack.pop();
      if (seen[n] || n === id) continue;
      seen[n] = true;
      (released[n] || []).forEach(function (m) { stack.push(m); });
    }
    return Object.keys(seen);
  }

  const unblocks = Object.create(null);
  owedList.forEach(function (o) { unblocks[o.id] = freed(o.id).length; });

  // Stable: ties keep the order they came in, which runAll gives by age.
  const order = owedList.map(function (o, i) { return { id: o.id, i: i }; })
    .sort(function (a, b) { return (unblocks[b.id] - unblocks[a.id]) || (a.i - b.i); })
    .map(function (x) { return x.id; });

  // A question releases what it covers, and everything waiting on that.
  const undeclared = [];
  const ranked = questions.map(function (q, i) {
    const set = Object.create(null);
    (q.covers || []).forEach(function (c) {
      if (!owed[c]) { if (!isDone(c)) undeclared.push({ key: q.key, id: c }); return; }
      set[c] = true;
      freed(c).forEach(function (m) { set[m] = true; });
    });
    return { key: q.key, covers: q.covers || [], count: Object.keys(set).length, i: i };
  }).sort(function (a, b) { return (b.count - a.count) || (a.i - b.i); });

  return {
    unblocks: unblocks,
    order: order,
    questions: ranked,
    cycles: cyclesIn(owedList, owed),
    deadEdges: deadEdges,
    undeclared: undeclared,
    unlinked: owedList.filter(function (o) { return !linked[o.id]; }).map(function (o) { return o.id; }),
  };
}

// Strongly connected sets of more than one item: Tarjan, iterative enough
// for a board of a few dozen rows.
function cyclesIn(owedList, owed) {
  const next = Object.create(null);
  owedList.forEach(function (o) {
    next[o.id] = (o.after || []).filter(function (t) { return owed[t] && t !== o.id; });
  });
  let index = 0;
  const idx = Object.create(null);
  const low = Object.create(null);
  const onStack = Object.create(null);
  const stack = [];
  const out = [];
  function visit(v) {
    idx[v] = low[v] = index++;
    stack.push(v); onStack[v] = true;
    next[v].forEach(function (w) {
      if (idx[w] === undefined) { visit(w); low[v] = Math.min(low[v], low[w]); }
      else if (onStack[w]) low[v] = Math.min(low[v], idx[w]);
    });
    if (low[v] === idx[v]) {
      const comp = [];
      let w;
      do { w = stack.pop(); onStack[w] = false; comp.push(w); } while (w !== v);
      if (comp.length > 1) out.push(comp.reverse());
    }
  }
  owedList.forEach(function (o) { if (idx[o.id] === undefined) visit(o.id); });
  return out;
}

module.exports = { rank: rank };
