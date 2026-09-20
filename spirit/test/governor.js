'use strict';

// spirit/test/governor.js
// Cycle 1, R2 and R3 — the connection allowance and the one-rule Governor,
// driven with readings of our own so the rule is proved without
// exhausting anybody's RAM.
// design/cycles/2026-09-19-relay-governor-cycle-1.md

const test = require('./testSupport.js');
const governorLib = require('../run/js/governor');
const presence = require('../run/js/presence');

const MB = 1024 * 1024;

function sink() {
  const s = { closed: false, write: function () {}, close: function () { s.closed = true; } };
  return s;
}

test.startTest('Governor — one lever, one rule, a reason each move');

function run() {
  test.subHeading('The lever: floor, ceiling, twelfths');
  const g = governorLib.createGovernor({ ramLimitMB: 32 });
  const st = g.state();
  if (st.position === '12/12' && st.floor === 1 && st.ceiling === 32 * governorLib.STREAMS_PER_MB && st.allowed === st.ceiling) {
    test.check('starts at 12/12, floor 1 (the owner), ceiling derived from ramLimitMB');
  } else {
    test.fail('initial state ' + JSON.stringify(st));
  }

  test.subHeading('Heap above 85% of the ceiling: one twelfth down, and a reason');
  const down = g.tick({ heapUsed: 30 * MB, rss: 60 * MB, present: 600 }, '2026-09-19T12:00:00Z');
  if (down && down.from === '12/12' && down.to === '11/12' && /heap 94% of 32 MB/.test(down.why)) {
    test.check('12/12 → 11/12 because "' + down.why + '"');
  } else {
    test.fail('no move down on high heap: ' + JSON.stringify(down));
  }
  if (down && down.close === Math.max(0, 600 - down.allowed)) {
    test.check('and it says how many streams must close to fit: ' + down.close);
  } else {
    test.fail('close count wrong: ' + JSON.stringify(down));
  }
  const again = g.tick({ heapUsed: 30 * MB, present: 400 });
  if (again && again.to === '10/12') test.check('one step per tick, never a jump — now 10/12');
  else test.fail('second tick did not step once: ' + JSON.stringify(again));

  test.subHeading('In the band between: hold');
  if (g.tick({ heapUsed: 22 * MB }) === null && g.state().position === '10/12') {
    test.check('heap 69% holds at 10/12');
  } else {
    test.fail('moved inside the band: ' + JSON.stringify(g.state()));
  }

  test.subHeading('Heap below 60%: back up, but only after calm');
  const t1 = g.tick({ heapUsed: 5 * MB });
  const t2 = g.tick({ heapUsed: 5 * MB });
  const t3 = g.tick({ heapUsed: 5 * MB });
  if (t1 === null && t2 === null && t3 && t3.to === '11/12' && t3.close === 0) {
    test.check('three calm ticks, then 10/12 → 11/12, closing nothing');
  } else {
    test.fail('recovery wrong: ' + JSON.stringify([t1, t2, t3]));
  }

  test.subHeading('Never below the floor');
  const f = governorLib.createGovernor({ ramLimitMB: 8 });
  for (let i = 0; i < 20; i++) f.tick({ heapUsed: 8 * MB });
  if (f.state().position === '0/12' && f.state().allowed === 1) {
    test.check('twenty ticks at 100% heap stop at 0/12, allowance 1 — the owner');
  } else {
    test.fail('went past the floor: ' + JSON.stringify(f.state()));
  }

  test.subHeading('The allowance: a newcomer is refused when full, the owner never');
  const reg = presence.createRegistry({ perMin: 100 });
  reg.setAllowed(2);
  const a = reg.connect('a', sink());
  const b = reg.connect('b', sink());
  const c = reg.connect('c', sink());
  if (a.ok && b.ok && !c.ok && c.status === 503) {
    test.check('allowance 2: third member refused with 503');
  } else {
    test.fail('allowance not enforced: ' + JSON.stringify([a, b, c]));
  }
  const owner = reg.connect('owner', sink(), true);
  if (owner.ok && reg.present().length === 3) {
    test.check('the owner is admitted over the allowance — the monitor never goes blind');
  } else {
    test.fail('owner refused: ' + JSON.stringify(owner));
  }
  const again2 = reg.connect('a', sink());
  if (again2.ok && again2.replaced) {
    test.check('a reconnect replaces its own stream and needs no room');
  } else {
    test.fail('reconnect refused: ' + JSON.stringify(again2));
  }

  test.subHeading('The remedy: longest-idle first, never the spared');
  let clock = 1000;
  const r2 = presence.createRegistry({ perMin: 100, now: function () { return clock; } });
  const sinks = {};
  ['old', 'mid', 'new', 'busy', 'owner'].forEach(function (id) {
    sinks[id] = sink();
    r2.connect(id, sinks[id], id === 'owner');
    clock += 1000;
  });
  // 'old' opened first but posted recently; 'mid' is the longest idle.
  const lastPost = { old: 9000 };
  const closed = r2.evictIdlest(2,
    function (id) { return id === 'owner' || id === 'busy'; },
    function (id) { return lastPost[id] || 0; });
  if (JSON.stringify(closed) === JSON.stringify(['mid', 'new'])) {
    test.check('closed mid and new — idle longest; old had posted since');
  } else {
    test.fail('evicted ' + JSON.stringify(closed));
  }
  if (sinks.mid.closed && sinks.new.closed && !sinks.owner.closed && !sinks.busy.closed && r2.isPresent('busy')) {
    test.check('the owner and the stream with a post in flight are spared');
  } else {
    test.fail('spared streams were touched');
  }

  // ── THE OWNER'S SETTING, AND HANDING IT BACK ──────────────────────
  //
  //   Andy: "a value set by the owner is a setting; `dynamic` hands it
  //   back."
  //
  // What is asserted is not that a flag flips. It is that the programme
  // STOPS MOVING a lever the owner has taken, and starts again when he
  // lets go — and that the restoring move is a real move with its own
  // reason rather than the owner's setting appearing to fail.
  test.subHeading('A lever the owner has taken, and handed back');

  {
    const g = governorLib.createGovernor({ ramLimitMB: 32 });
    const lev = g.lever('connections1');

    if (lev && lev.label === 'connections1') {
      test.check('the Governor lever carries its iteration in its name');
    } else {
      test.fail('no connections1 lever on the Governor');
    }
    if (g.lever('connections') === null) {
      test.check('and it is not reachable under the name it had before the rename');
    } else {
      test.fail('the old lever name still answers');
    }

    // Heap far above HIGH: the programme would step down every tick.
    const hot = { heapUsed: 32 * 1024 * 1024 * 0.99, rss: 0, present: 0 };

    const moved = g.tick(hot, '');
    if (moved && g.state().value < g.state().ceiling) {
      test.check('unheld, the programme moves it — and says why');
    } else {
      test.fail('the programme did not move an unheld lever');
    }

    const owned = lev.set(7, 'set by owner', 'owner');
    if (owned.ok && lev.heldByOwner()) {
      test.check('the owner sets a number and the lever is held');
    } else {
      test.fail('the owner could not take the lever');
    }

    const held = g.tick(hot, '');
    if (held === null && g.state().value === 7) {
      test.check('and the programme leaves it alone — a held lever is not a failed tick');
    } else {
      test.fail('the programme moved a held lever to ' + g.state().value);
    }

    lev.set('dynamic', 'handed back', 'owner');
    if (!lev.heldByOwner()) {
      test.check('`dynamic` hands it back');
    } else {
      test.fail('dynamic did not release the lever');
    }

    const back = g.tick(hot, '');
    const st = g.state();
    if (back && typeof st.value === 'number' && st.value === st.allowed) {
      test.check('the programme takes it back and the value is the programme value again');
    } else {
      test.fail('after dynamic the lever stands at ' + JSON.stringify(st.value));
    }
    if (st.lastMove && st.lastMove.by === 'programme' && st.lastMove.why) {
      test.check('shown as its own move with its own reason — not as the setting failing');
    } else {
      test.fail('the restoring move carried no attribution: ' + JSON.stringify(st.lastMove));
    }
  }

  test.reportSuccessFailureCount();
}

try { run(); }
catch (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
}
