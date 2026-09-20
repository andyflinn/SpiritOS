'use strict';

// spirit/run/js/governor.js
// THE FIRST GOVERNOR. ONE LEVER, ONE RULE.
//
// Cycle 1 (design/principles/NODE-AND-RELAY.md, and
// design/cycles/2026-09-19-relay-governor-cycle-1.md). Andy: "The
// Governor will be simple ... then we learn from the results." It is the
// result of programming — nothing moves it at runtime but readings, and
// the owner's only live tools are signed grants, never a lever (§5,
// scope).
//
// ── THE LEVER ────────────────────────────────────────────────────────
//
// The CONNECTION ALLOWANCE: how many member streams this relay holds.
// Held streams are what hold a relay's RAM — the router keeps hashes, not
// bodies — and nothing bounded their total before this cycle.
//
// A position in twelfths (§10): 0 is the hard floor, 12 the hard ceiling.
//
//   floor    1 stream  — the owner's. The monitor never goes blind under
//                        exactly the load worth watching. (presence.js
//                        admits the owner whatever the count; the floor
//                        says the same thing in the lever's own terms.)
//   ceiling  derived from the configured ramLimitMB by STREAMS_PER_MB —
//            a declared placeholder, NOT a measurement. Cycle 1 measures
//            what one stream actually costs, and this number is the first
//            thing that result replaces.
//
// ── THE RULE ─────────────────────────────────────────────────────────
//
// heapUsed governs, not rss (Andy, 2026-09-19): heap falls after garbage
// collection, so a shed can be SEEN to work; rss rarely gives memory back
// and is reported beside it as the box-level truth.
//
//   heap above HIGH of the ceiling   → one twelfth down, close the
//                                      longest-idle streams to fit
//   heap below LOW for CALM ticks    → one twelfth up
//   otherwise                        → hold
//
// One step per tick in either direction, so a lever is always readable as
// a sequence of moves with a reason each (§4: "an owner can watch a lever
// move, read why, and disagree" — by changing this programming).
//
// Pure: readings in, decision out. No clock, no process, no socket — the
// caller ticks it and carries out what it says.

var lever = require('./lever.js');

var MB = 1024 * 1024;

// PLACEHOLDER. Guessed so the ceiling is finite and proportional to the
// configured bound; replaced by the per-stream cost cycle 1 measures.
var STREAMS_PER_MB = 16;
var HIGH = 0.85;
var LOW = 0.60;
var CALM_TICKS = 3;
var STEPS = 12;
var FLOOR = 1;

function createGovernor(opts) {
  opts = opts || {};
  var ramLimitMB = opts.ramLimitMB;
  var perMB = opts.streamsPerMB || STREAMS_PER_MB;
  var high = opts.high || HIGH;
  var low = opts.low || LOW;
  var calmTicks = opts.calmTicks || CALM_TICKS;

  var ceiling = Math.max(FLOOR, Math.floor(ramLimitMB * perMB));
  var position = STEPS;
  var calm = 0;
  var last = null;

  function allowedAt(p) {
    return FLOOR + Math.round((ceiling - FLOOR) * p / STEPS);
  }

  // ── THE LEVER IS AN OBJECT NOW, NOT A FIELD ────────────────────────
  //
  // Named `connections1` because a lever carries its iteration in its
  // name (labelRule.leverOk): what the Governor learns about this one
  // does not transfer to `connections2`, which will have different
  // bounds and a different programme, and two generations must never be
  // read as one measurement.
  //
  // The programme still thinks in twelfths — `position` is unchanged —
  // but the lever holds the VALUE, because that is what the owner sets
  // and what an app draws. One mutator, so every move has a why and a
  // mover attached.
  var connections = lever.make('connections1', {
    floor: FLOOR, ceiling: ceiling, value: allowedAt(STEPS)
  });

  function state() {
    var out = connections.readOut();
    // `position` and `allowed` are what cycle 1's consumers read, kept
    // while 4.1 is in pieces. `value` is the same number as `allowed`;
    // stage 3 moves the report onto readOut alone.
    out.position = position + '/' + STEPS;
    out.allowed = allowedAt(position);
    return out;
  }

  // readings: { heapUsed, rss, present } in bytes / streams. Returns a
  // decision when the lever moved, null when it held.
  function tick(readings, atIso) {
    var r = readings || {};
    var limitBytes = ramLimitMB * MB;
    var heapPct = limitBytes > 0 ? (r.heapUsed || 0) / limitBytes : 0;
    var from = position;

    // THE OWNER'S SETTING WINS, AND SILENTLY — a held lever is not a
    // failed tick, it is the owner driving. Andy: a value set by the
    // owner is a setting and the programme leaves it alone; `dynamic`
    // hands it back. Nothing is reported, because nothing moved.
    if (connections.heldByOwner()) return null;

    if (heapPct > high && position > 0) {
      position -= 1;
      calm = 0;
    } else if (heapPct < low) {
      calm += 1;
      if (calm >= calmTicks && position < STEPS) {
        position += 1;
        calm = 0;
      }
    } else {
      calm = 0;
    }

    var allowed = allowedAt(position);

    // NOT `position === from`. After the owner hands the lever back with
    // `dynamic`, the programme's position has not changed but the VALUE
    // is no longer the programme's — so the test is whether the lever
    // stands where the programme wants it, not whether the programme
    // changed its mind. That restoring move is a real move with its own
    // reason, which is what the plan says the owner should see rather
    // than a setting appearing to fail.
    if (position === from && connections.value === allowed) return null;

    connections.set(allowed, position === from
      ? 'returned to the programme'
      : 'heap ' + Math.round(heapPct * 100) + '%', 'programme');

    last = {
      at: atIso || '',
      lever: 'connections1',
      from: from + '/' + STEPS,
      to: position + '/' + STEPS,
      allowed: allowed,
      // What the caller must close so the relay fits the new allowance.
      // Zero on the way up.
      close: Math.max(0, (r.present || 0) - allowed),
      why: 'heap ' + Math.round(heapPct * 100) + '% of ' + ramLimitMB + ' MB' +
        (position < from ? ' (above ' + Math.round(high * 100) + '%)'
                         : ' (below ' + Math.round(low * 100) + '% for ' + calmTicks + ' ticks)'),
    };
    return last;
  }

  return {
    tick: tick,
    state: state,
    // relay.js reaches the lever to apply the owner's verb (stage 3).
    // Exposed by name rather than as a bag, so a second lever is an
    // addition here and not a shape change everywhere.
    lever: function (name) { return name === connections.label ? connections : null; },
    lastDecision: function () { return last; },
    allowed: function () { return allowedAt(position); },
    ramLimitMB: ramLimitMB,
  };
}

module.exports = {
  createGovernor: createGovernor,
  STREAMS_PER_MB: STREAMS_PER_MB,
  HIGH: HIGH,
  LOW: LOW,
  CALM_TICKS: CALM_TICKS,
  STEPS: STEPS,
  FLOOR: FLOOR,
};
