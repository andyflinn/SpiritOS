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

test.reportSuccessFailureCount();
