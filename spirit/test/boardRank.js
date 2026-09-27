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

// ── A DEPENDENCY IS PROPOSED UNTIL ANDY SETTLES IT ───────────────────
//
//   Andy, 2026-09-27: "you may add dependencies, the regocgnition/
//   acceptance of which (by andy) might cause different rankings the next
//   time around" — and "in fact proposed dependencies are issues
//   themselves", then correcting his own word: they are to-dos.
//
// So an `after` an agent declares does not shape the order by itself. It
// is a TO-DO FOR HIM, and only his `accepted` makes it count. `rulings` is
// edges.js: [{ from, to, state: 'accepted'|'rejected', said, at }].
//
// Answers the owed list with only accepted edges, the proposals ranked by
// how much accepting each would change — the number of to-dos that would
// newly wait on its target — and any edge declared again after he
// rejected it, which is re-proposing what he already said no to.
function settle(owedList, rulings) {
  const ruled = Object.create(null);
  (rulings || []).forEach(function (r) { ruled[r.from + ' ' + r.to] = r; });
  const owed = Object.create(null);
  owedList.forEach(function (o) { owed[o.id] = true; });

  const accepted = owedList.map(function (o) {
    return { id: o.id, after: (o.after || []).filter(function (t) {
      const r = ruled[o.id + ' ' + t];
      return r && r.state === 'accepted';
    }) };
  });
  const base = rank({ owed: accepted });

  const proposed = [];
  const rejectedStill = [];
  owedList.forEach(function (o) {
    (o.after || []).forEach(function (t) {
      const r = ruled[o.id + ' ' + t];
      if (r && r.state === 'accepted') return;
      if (r && r.state === 'rejected') { rejectedStill.push({ from: o.id, to: t, said: r.said || '' }); return; }
      // Only an edge between two owed to-dos is a question worth his time;
      // one pointing anywhere else is reported by rank() as a dead edge.
      if (!owed[t] || t === o.id) return;
      const trial = accepted.map(function (a) {
        return a.id === o.id ? { id: a.id, after: a.after.concat([t]) } : a;
      });
      const gain = rank({ owed: trial }).unblocks[t] - base.unblocks[t];
      proposed.push({ from: o.id, to: t, gain: gain });
    });
  });
  proposed.sort(function (a, b) { return b.gain - a.gain; });
  return { owed: accepted, proposed: proposed, rejectedStill: rejectedStill };
}

// ── ONE QUESTION PER TREE, NOT ONE LINE PER EDGE ─────────────────────
//
//   Andy, 2026-09-27: "specify a dependency do-do like this: "these tow
//   functions are needed by the following to-do's: R34, R23, R45, do you
//   accept the implied change in priorities?" — and the "X waits on Y"
//   lines did not make dependencies obvious; drawn as trees, they did.
//
// Proposed edges that touch each other form ONE question: accepting part
// of a chain is not a thing he was asked. Each group answers:
//   roots   the prerequisites nothing else in the group waits on... in
//           reverse: the to-dos that must land FIRST, with nothing under them
//   edges   every proposed edge in the group, which a yes accepts
//   tree    root -> the to-dos that wait on it -> what waits on those
//   moves   [{ id, from, to }] positions before and after accepting, for
//           every to-do whose place would change
//
// `owedList` must arrive in age order, so positions tie the way the board
// breaks ties.
function proposalGroups(owedList, rulings) {
  const st = settle(owedList, rulings);
  const props = st.proposed;
  if (!props.length) return [];

  // Group proposed edges into connected components.
  const parent = Object.create(null);
  function find(x) { while (parent[x] && parent[x] !== x) x = parent[x]; return x; }
  function join(a, b) { parent[a] = parent[a] || a; parent[b] = parent[b] || b; parent[find(a)] = find(b); }
  props.forEach(function (e) { join(e.from, e.to); });
  const groups = Object.create(null);
  props.forEach(function (e) { (groups[find(e.from)] = groups[find(e.from)] || []).push(e); });

  const before = rank({ owed: st.owed }).order;
  const posBefore = Object.create(null);
  before.forEach(function (id, i) { posBefore[id] = i + 1; });

  return Object.keys(groups).map(function (g) {
    const edges = groups[g];
    // Dependents of each node over accepted edges plus this group's.
    const trial = st.owed.map(function (o) {
      const extra = edges.filter(function (e) { return e.from === o.id; }).map(function (e) { return e.to; });
      return { id: o.id, after: o.after.concat(extra) };
    });
    const waiting = Object.create(null);
    trial.forEach(function (o) { o.after.forEach(function (t) { (waiting[t] = waiting[t] || []).push(o.id); }); });
    const inGroup = Object.create(null);
    edges.forEach(function (e) { inGroup[e.from] = true; inGroup[e.to] = true; });
    // A root waits on nothing within the group.
    const roots = Object.keys(inGroup).filter(function (id) {
      return !edges.some(function (e) { return e.from === id; });
    });
    function tree(id, seen) {
      if (seen[id]) return { id: id, under: [], again: true };
      const next = Object.assign({}, seen); next[id] = true;
      return { id: id, under: (waiting[id] || []).map(function (c) { return tree(c, next); }) };
    }
    const after = rank({ owed: trial }).order;
    const moves = [];
    after.forEach(function (id, i) {
      if (posBefore[id] !== i + 1) moves.push({ id: id, from: posBefore[id], to: i + 1 });
    });
    return { roots: roots, edges: edges, tree: roots.map(function (r) { return tree(r, {}); }), moves: moves };
  }).sort(function (a, b) { return b.edges.length - a.edges.length; });
}

// ── IDS FOR THE ROWS THAT ARE NOT TO-DOS ─────────────────────────────
//
// A row's id is its thread key, and messages carry it as `todo`, which
// agents.js refuses unless it is ONE area/number pair. The first ids here
// spelled out their content — 'dependency/puppets/G7>puppets/G6,...',
// 'question/puppets/G3' — and every one of them failed that rule, so no
// agent could reply under a dependency or a question. Found by claude-
// windows building Desk; boardRankSuite now holds the two files to one rule.
//
// A SHORT HASH OF WHAT THE ROW ASKS: the same tree gives the same id, and
// a tree that grew is a NEW question with a new id — so an accept pressed
// on the tree he saw can never be applied to a different one.
function shortHash(parts) {
  return require('crypto').createHash('sha256').update(parts.slice().sort().join('\n')).digest('hex').slice(0, 12);
}
function dependencyId(edges) {
  return 'dependency/' + shortHash((edges || []).map(function (e) { return e.from + '>' + e.to; }));
}
function questionId(covers, fallback) {
  const list = (covers || []).length ? covers : [String(fallback || '')];
  return 'question/' + shortHash(list);
}

module.exports = { rank: rank, settle: settle, proposalGroups: proposalGroups,
  dependencyId: dependencyId, questionId: questionId };
