'use strict';

// spirit/test/boardRankSuite.js
// THE BOARD'S ORDER, ASSERTED ON FIXTURES RATHER THAN READ OFF A PAGE.
//
// boardRank.js decides what Andy reads first. A wrong order is a quiet
// lie — nothing goes red, the page just points him at the wrong thing — so
// every way it could lie is a case here, and each has a control.

const test = require('./testSupport.js');
const board = require('./boardRank.js');

test.startTest('The board ranks what unblocks most first, and says what it cannot rank');

// ── THE ORDER ITSELF ─────────────────────────────────────────────────
{
  // c waits on b, b waits on a. So a frees two, b frees one, c frees none.
  const r = board.rank({ owed: [
    { id: 'x/c', after: ['x/b'] },
    { id: 'x/b', after: ['x/a'] },
    { id: 'x/a', after: [] },
  ] });
  if (r.order.join(' ') === 'x/a x/b x/c' && r.unblocks['x/a'] === 2 && r.unblocks['x/b'] === 1) {
    test.check('what frees most comes first, counted TRANSITIVELY — a frees b and, through b, c');
  } else {
    test.fail('order ' + r.order.join(' ') + ', counts ' + JSON.stringify(r.unblocks));
  }
}

// THE CONTROL: with no edges, nothing is reordered. Without it, a sort
// that shuffled everything would pass the check above by luck on three
// rows. Ties keep the order they came in, which runAll gives by age.
{
  const r = board.rank({ owed: [{ id: 'x/old' }, { id: 'x/mid' }, { id: 'x/new' }] });
  if (r.order.join(' ') === 'x/old x/mid x/new') {
    test.check('with nothing linked, the order is the one it came in — age — and the ranking '
      + 'invents nothing');
  } else {
    test.fail('an unlinked board was reordered: ' + r.order.join(' '));
  }
}

// ── 1. CYCLES ────────────────────────────────────────────────────────
{
  const r = board.rank({ owed: [
    { id: 'x/p', after: ['x/q'] },
    { id: 'x/q', after: ['x/p'] },
    { id: 'x/r', after: [] },
  ] });
  const cyc = r.cycles.map(function (c) { return c.slice().sort().join(','); });
  if (cyc.length === 1 && cyc[0] === 'x/p,x/q' && r.order.length === 3) {
    test.check('items waiting on each other are reported as a cycle, the walk ends, and no item '
      + 'is dropped to break it');
  } else {
    test.fail('cycles ' + JSON.stringify(r.cycles) + ', order ' + r.order.join(' '));
  }
}

// ── 2. A QUESTION COVERING SOMETHING NOTHING DECLARES ────────────────
{
  const r = board.rank({
    owed: [{ id: 'x/a' }, { id: 'x/b', after: ['x/a'] }],
    questions: [
      { key: 'small', covers: ['x/b'] },
      { key: 'big', covers: ['x/a'] },
      { key: 'ghost', covers: ['x/nobody'] },
    ],
  });
  const keys = r.questions.map(function (q) { return q.key + ':' + q.count; }).join(' ');
  if (keys === 'big:2 small:1 ghost:0' && r.undeclared.length === 1
      && r.undeclared[0].key === 'ghost' && r.undeclared[0].id === 'x/nobody') {
    test.check('questions rank by what answering them frees, and one covering an id no suite '
      + 'declares is REPORTED rather than left to sink silently at zero');
  } else {
    test.fail('questions ' + keys + ', undeclared ' + JSON.stringify(r.undeclared));
  }
}

// ── 3. WAITING ON SOMETHING FINISHED, OR ON NOTHING ──────────────────
{
  const r = board.rank({
    owed: [{ id: 'x/a', after: ['x/finished', 'x/nowhere', 'x/open-unwatched'] }],
    isDone: function (id) { return id === 'x/finished'; },
    isKnown: function (id) { return id !== 'x/nowhere'; },
  });
  const why = r.deadEdges.map(function (e) { return e.to + '=' + e.why; }).sort().join(' ');
  if (why === 'x/finished=done x/nowhere=unknown x/open-unwatched=unwatched'
      && r.unblocks['x/a'] === 0) {
    test.check('an edge to something DONE, to something nothing defines, and to something open '
      + 'that no suite watches are each named for what they are, and none of them ranks anything');
  } else {
    test.fail('dead edges ' + why);
  }
}

// ── 4. UNLINKED ITEMS ARE COUNTED, NOT RANKED ────────────────────────
{
  const r = board.rank({ owed: [
    { id: 'x/a' }, { id: 'x/b', after: ['x/a'] }, { id: 'x/lonely' },
  ] });
  if (r.unlinked.length === 1 && r.unlinked[0] === 'x/lonely') {
    test.check('an item with no edge in or out is listed as unlinked, so the page can say how '
      + 'much of the board the ranking actually knows about');
  } else {
    test.fail('unlinked ' + JSON.stringify(r.unlinked));
  }
}

// ── 5. THE COUNT TRAVELS WITH THE ORDER ──────────────────────────────
{
  const r = board.rank({ owed: [{ id: 'x/a' }, { id: 'x/b', after: ['x/a'] }] });
  const all = r.order.every(function (id) { return typeof r.unblocks[id] === 'number'; });
  if (all) {
    test.check('every ranked item carries its count, so the page can show WHY it is first — a '
      + 'count rewards whoever declares many small units, and the order must not hide that');
  } else {
    test.fail('an ordered item has no count: ' + JSON.stringify(r.unblocks));
  }
}

// ── AND AN ITEM WAITING ON ITSELF IS NAMED, NOT COUNTED ──────────────
{
  const r = board.rank({ owed: [{ id: 'x/a', after: ['x/a'] }] });
  if (r.unblocks['x/a'] === 0 && r.deadEdges.length === 1 && r.deadEdges[0].why === 'itself') {
    test.check('an item declared as waiting on itself is reported, and frees nothing');
  } else {
    test.fail('self-edge gave ' + JSON.stringify(r));
  }
}

// ── A PROPOSED DEPENDENCY WAITS FOR ANDY ─────────────────────────────
{
  const owed = [
    { id: 'x/a' },
    { id: 'x/b', after: ['x/a'] },            // accepted below
    { id: 'x/c', after: ['x/a', 'x/b'] },     // c->a proposed, c->b rejected
  ];
  const rulings = [
    { from: 'x/b', to: 'x/a', state: 'accepted' },
    { from: 'x/c', to: 'x/b', state: 'rejected', said: 'no' },
  ];
  const st = board.settle(owed, rulings);
  const r = board.rank({ owed: st.owed });
  const kept = st.owed.map(function (o) { return o.id + ':' + o.after.join(','); }).join(' ');
  if (kept === 'x/a: x/b:x/a x/c:' && r.unblocks['x/a'] === 1) {
    test.check('only an ACCEPTED dependency shapes the order — the proposed one and the rejected '
      + 'one count for nothing until he rules');
  } else {
    test.fail('kept ' + kept + ', counts ' + JSON.stringify(r.unblocks));
  }
  if (st.proposed.length === 1 && st.proposed[0].from === 'x/c' && st.proposed[0].to === 'x/a'
      && st.proposed[0].gain === 1) {
    test.check('the unruled dependency is a to-do for him, measured by what accepting it would '
      + 'change: one more to-do would wait on x/a');
  } else {
    test.fail('proposed ' + JSON.stringify(st.proposed));
  }
  if (st.rejectedStill.length === 1 && st.rejectedStill[0].to === 'x/b') {
    test.check('a dependency declared again after he rejected it is reported, so nobody asks '
      + 'him the same thing twice');
  } else {
    test.fail('rejectedStill ' + JSON.stringify(st.rejectedStill));
  }
}

// THE CONTROL: with every dependency accepted, nothing is left to propose.
// Without it, settle() reporting everything as proposed would pass above.
{
  const st = board.settle([{ id: 'x/a' }, { id: 'x/b', after: ['x/a'] }],
    [{ from: 'x/b', to: 'x/a', state: 'accepted' }]);
  if (st.proposed.length === 0 && st.rejectedStill.length === 0) {
    test.check('with every dependency ruled on, there is nothing left to ask him');
  } else {
    test.fail('still proposing ' + JSON.stringify(st.proposed));
  }
}

// ── A CHAIN OF PROPOSALS IS ONE QUESTION, DRAWN AS A TREE ────────────
{
  // g4 waits on g7, g7 waits on g6, and an unrelated pair r1 -> r2.
  const owed = [
    { id: 'p/g4', after: ['p/g7'] }, { id: 'p/g7', after: ['p/g6'] }, { id: 'p/g6' },
    { id: 'q/r1', after: ['q/r2'] }, { id: 'q/r2' },
  ];
  const groups = board.proposalGroups(owed, []);
  const chain = groups[0];
  const drawn = JSON.stringify(chain && chain.tree);
  if (groups.length === 2 && chain.edges.length === 2 && chain.roots.join() === 'p/g6'
      && drawn === JSON.stringify([{ id: 'p/g6', under: [{ id: 'p/g7', under: [{ id: 'p/g4', under: [] }] }] }])) {
    test.check('two proposals that touch are ONE question, rooted at the prerequisite nothing '
      + 'else waits on, and an unrelated pair is a separate one');
  } else {
    test.fail('groups ' + JSON.stringify(groups.map(function (g) { return { roots: g.roots, n: g.edges.length }; }))
      + ' tree ' + drawn);
  }
  const g6 = chain.moves.filter(function (m) { return m.id === 'p/g6'; })[0];
  if (g6 && g6.from === 3 && g6.to === 1) {
    test.check('and it shows the implied change: the root prerequisite moves from 3rd to 1st');
  } else {
    test.fail('moves ' + JSON.stringify(chain.moves));
  }
}

// THE CONTROL: accepted edges are not asked again. Without this, a board
// re-asking settled questions would pass the grouping check above.
{
  const groups = board.proposalGroups([{ id: 'p/a', after: ['p/b'] }, { id: 'p/b' }],
    [{ from: 'p/a', to: 'p/b', state: 'accepted' }]);
  if (groups.length === 0) {
    test.check('with its only dependency accepted, a tree asks nothing');
  } else {
    test.fail('still asking ' + JSON.stringify(groups));
  }
}

// ── EVERY ROW ID IS A TODO THE MESSAGES WILL CARRY ───────────────────
//
// The board mints ids and agents.js refuses any `todo` that is not one
// area/number pair. The first dependency and question ids broke that, so
// nobody could reply under those rows — found in Desk, not by a test.
// Now the two files are held to one rule here.
{
  const TODO_ID = require('../run/process/js/agents/agents.js').TODO_ID;
  const dep = board.dependencyId([{ from: 'puppets/G7', to: 'puppets/G6' }, { from: 'puppets/G4', to: 'puppets/G7' }]);
  const depSwapped = board.dependencyId([{ from: 'puppets/G4', to: 'puppets/G7' }, { from: 'puppets/G7', to: 'puppets/G6' }]);
  const depGrown = board.dependencyId([{ from: 'puppets/G7', to: 'puppets/G6' }, { from: 'puppets/G4', to: 'puppets/G7' },
    { from: 'puppets/G3', to: 'puppets/G4' }]);
  const q = board.questionId(['puppets/G3', 'cycle-10/R13']);
  const qEmpty = board.questionId([], '2026-09-27#some decision');
  const all = [dep, q, qEmpty, 'cycle-10/R13', 'public-app-server/G17'];
  if (all.every(function (id) { return TODO_ID.test(id); })) {
    test.check('every kind of row id — to-do, dependency, question — passes the todo rule agents.js '
      + 'enforces, so a reply can be filed under any row on the board');
  } else {
    test.fail('ids refused as todo: ' + all.filter(function (id) { return !TODO_ID.test(id); }).join(', '));
  }
  if (dep === depSwapped && dep !== depGrown) {
    test.check('a dependency\'s id is the same for the same edges in any order, and NEW when the tree '
      + 'grows — so an accept pressed on the tree he saw is never applied to a different one');
  } else {
    test.fail('dependency ids: same=' + (dep === depSwapped) + ', grown differs=' + (dep !== depGrown));
  }
  // THE CONTROL: the rule is not a regex that accepts anything.
  if (!TODO_ID.test('dependency/puppets/G7>puppets/G6') && !TODO_ID.test('G10')) {
    test.check('and the rule does refuse the old spelled-out form and a bare handle');
  } else {
    test.fail('TODO_ID accepts what it must refuse');
  }
}

test.reportSuccessFailureCount();
