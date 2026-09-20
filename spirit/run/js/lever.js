'use strict';

// spirit/run/js/lever.js
// ONE LEVER — what it is, what it may be set to, and what it says about
// itself. Isomorphic, the way labelRule.js and ownerBadge.js are.
//
//   Andy: "Every proposed lever must define floor and ceiling
//   considerations."
//   Andy: "I see a reason for hard-floors on levers... i see no reason
//   for hard ceilings. not even per member count. the ceilings must be
//   re-computed by events, like: a third member joined, lets divide
//   non-owner-ram by 3 now...."
//
// ── WHY A MODULE AND NOT A FIELD ON THE GOVERNOR ─────────────────────
//
// The Governor has one lever today and will have several. The owner's
// monitor draws them GENERICALLY — label, value, floor, ceiling, last
// move — with no lever named in its code, so that a lever invented on
// the relay next month is drawn by an app that shipped this month. That
// only works if every lever reports itself the same way, which means the
// self-description belongs to the lever rather than to whoever happens
// to be writing the report.
//
// ── ONE MUTATOR ──────────────────────────────────────────────────────
//
// `set` is the only way the value changes. Not a convenience: the last
// move — from, to, why, at — is the thing the owner reads to tell "the
// Governor did this" from "I did this", and a second write path is a
// move that happens with no `why` attached. The Governor moves the lever
// through `set` exactly as the owner does.
//
//   Andy: "what you term a pin, sounds to me more like programmed, final
//   constant, in the learning cycle...."
//
// ── SETTING VERSUS DYNAMIC ───────────────────────────────────────────
//
// A number is a SETTING: the owner has taken the lever and the Governor
// leaves it alone. `'dynamic'` hands it back. That is the whole of the
// owner's real-time control in 4.1, and it is deliberately the only
// thing the owner can do live:
//
//   Andy: "the only real-time tool the owner gets while node and relay
//   are running: injecting foreign partners." — and, from this cycle,
//   moving a lever.
//
// ── settable DEFAULTS TO FALSE, AND THAT IS THE POINT ────────────────
//
// Decision 0015: the Governor is the result of programming; the owner
// watches a lever move and the RECORD of those moves is what changes the
// programme. Every lever in the tree therefore ships `settable: false`,
// and a lever must DECLARE itself settable to be one.
//
// The default is a denial rather than a permission for the reason
// AGENT.md gives about the one-door census: "There is no category
// meaning unlimited, because the first version had one... and that is
// precisely what got used."
//
// The path is kept and proven rather than deleted — NODE-AND-RELAY:315
// specifies it and cycle 4.1 built it — so the day a lever should be
// owner-controlled, the capability is not rebuilt and re-argued from
// nothing. spirit/test/settableCensus.js holds the count at zero.
//
// An app draws a lever that is not settable without a control, rather
// than a control that would be refused: the shell's standing rule about
// chrome that cannot be used.
//
// ── worseAt ──────────────────────────────────────────────────────────
//
// Which END of the range is the bad one, because a meter's colour is a
// claim the drawing app cannot make. On connections1 a high value means
// the Governor has opened up and the relay is comfortable, so the floor
// is the bad end. On requestTimeout1 a high value means requests held
// longer in RAM, so the ceiling is. Same gradient, opposite meanings,
// and an app that names no lever cannot know which — so the lever says,
// beside the floor and ceiling it already declares with reasons.

var LEVER_DYNAMIC = 'dynamic';

function isInteger(v) {
  return typeof v === 'number' && isFinite(v) && Math.floor(v) === v;
}

// labelRule in node; the browser global the shell already loads. Same
// split, and the same reason, as the rest of the isomorphic modules: one
// rule, not one per environment that could drift.
function labelRule() {
  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    return require('./labelRule.js');
  }
  return (typeof window !== 'undefined' && window.spiritLabelRule) || null;
}

// REFUSES RATHER THAN CORRECTS. A lever built with a bad label or an
// inverted range is a programming error on the relay, not a runtime
// condition to be tidied — and a lever that quietly renamed itself would
// be reported under a name no test asserts.
function make(label, opts) {
  var rule = labelRule();
  if (!rule || !rule.leverOk(label)) {
    throw new Error('lever: bad label ' + JSON.stringify(label));
  }
  var o = opts || {};
  if (!isInteger(o.floor) || !isInteger(o.ceiling)) {
    throw new Error('lever ' + label + ': floor and ceiling must be integers');
  }
  if (o.floor > o.ceiling) {
    throw new Error('lever ' + label + ': floor ' + o.floor + ' above ceiling ' + o.ceiling);
  }

  var value = isInteger(o.value) ? o.value : o.floor;
  // DECLARED, never defaulted on. A lever that says nothing is not
  // settable.
  var settable = o.settable === true;
  // 'floor' or 'ceiling'. Absent means the lever makes no claim, and a
  // meter draws it without a direction rather than guessing one.
  var worseAt = o.worseAt === 'floor' || o.worseAt === 'ceiling' ? o.worseAt : null;
  var lastMove = null;

  // WHY, NOT WHETHER — the same choice labelRule.problem makes. "out of
  // bounds" and "this lever takes no settings" are different problems
  // for the person reading the refusal, and the app shows what the relay
  // said rather than inventing its own wording.
  // `by` DEFAULTS TO 'owner', which is the conservative reading: an app
  // asking "may this be set" is asking on the owner's behalf.
  //
  // `settable` GATES THE OWNER ONLY. The programme must always be able to
  // move a lever it owns — that is what a Governor is — and gating it
  // here made a non-settable lever a lever nothing could move at all,
  // which is a constant, not a programmed one. Decision 0015 draws
  // exactly this line: settable answers *may the owner move it*, and says
  // nothing about the Governor.
  function canSet(v, by) {
    if (by !== 'programme' && !settable) {
      return 'lever ' + label + ' takes no settings';
    }
    if (v === LEVER_DYNAMIC) return '';
    if (!isInteger(v)) return 'lever ' + label + ' takes a whole number or ' + LEVER_DYNAMIC;
    if (v < o.floor) return 'lever ' + label + ' floor is ' + o.floor;
    if (v > o.ceiling) return 'lever ' + label + ' ceiling is ' + o.ceiling;
    return '';
  }

  // `by` IS NOT DECORATION. The Governor has to know whether it may move
  // this lever, and "did the owner set it" cannot be answered by reading
  // the `why` prose — that would make a programme decision depend on a
  // string a human wrote. So the mover says who it is, and `heldByOwner`
  // is a fact rather than a parse.
  //
  //   Andy: "a value set by the owner is a setting; `dynamic` hands it
  //   back."
  //
  // It also makes the monitor honest: "set by owner" is drawn from a
  // field, not inferred from a sentence that could say anything.
  function set(v, why, by) {
    var mover = by === 'owner' ? 'owner' : 'programme';
    var no = canSet(v, mover);
    if (no) return { ok: false, error: no };
    var from = value;
    value = v;
    lastMove = { from: from, to: v, why: String(why || ''), by: mover, at: Date.now() };
    return { ok: true, from: from, to: v };
  }

  // LOCKED means the owner has taken this lever and the programme leaves
  // it alone (Andy, 2026-09-20: "as soon as the owner sets a lever it
  // gets a locked state. the owner would have to release that locked
  // state"). `dynamic` is the release, so a lever sitting at `dynamic` is
  // never locked however it got there.
  //
  // A LOCK IS NOT A CONSTANT. Both sit still; the authority and the
  // duration differ. A constant is the programme having finished with a
  // lever — it ends at a reprogram. A lock ends when its owner releases
  // it. See 0015.
  function lockedByOwner() {
    return !!lastMove && lastMove.by === 'owner' && value !== LEVER_DYNAMIC;
  }

  // THE REPORT'S SELF-DESCRIPTION. Everything the monitor needs to draw
  // a lever it has never heard of: what it is called, where it stands,
  // what it is bounded by, whether it can be moved, and what moved it
  // last. Nothing here is a reference — a report crosses the wire and is
  // read by an app in another process.
  function readOut() {
    return {
      label: label,
      value: value,
      floor: o.floor,
      ceiling: o.ceiling,
      settable: settable,
      worseAt: worseAt,
      locked: lockedByOwner(),
      lastMove: lastMove ? {
        from: lastMove.from, to: lastMove.to, why: lastMove.why,
        by: lastMove.by, at: lastMove.at
      } : null
    };
  }

  return {
    label: label,
    get value() { return value; },
    get settable() { return settable; },
    get worseAt() { return worseAt; },
    floor: o.floor,
    ceiling: o.ceiling,
    set: set,
    canSet: canSet,
    lockedByOwner: lockedByOwner,
    readOut: readOut,
    lastMove: function () { return readOut().lastMove; }
  };
}

// THE NODE SIDE. The monitor receives a readOut and needs the same
// `canSet` the relay will apply, so it can refuse an impossible value
// while the cursor is still in the box rather than after a round trip —
// the courtesy labelRule.js already describes for input fields.
//
// It is NOT a lever: no `set`, because nothing on the node may move a
// relay's value except by asking the relay. A silent local mutation
// would draw a value the relay never took.
function fromReport(obj) {
  if (!obj || typeof obj !== 'object') return null;
  if (!isInteger(obj.floor) || !isInteger(obj.ceiling)) return null;
  var rule = labelRule();
  if (!rule || !rule.leverOk(obj.label)) return null;
  var view = make(obj.label, {
    floor: obj.floor,
    ceiling: obj.ceiling,
    settable: obj.settable === true,
    worseAt: obj.worseAt,
    value: isInteger(obj.value) ? obj.value : obj.floor
  });
  return {
    label: view.label,
    value: view.value,
    floor: view.floor,
    ceiling: view.ceiling,
    settable: view.settable,
    worseAt: view.worseAt,
    locked: obj.locked === true,
    lastMove: obj.lastMove || null,
    canSet: view.canSet
  };
}

var LEVER = {
  DYNAMIC: LEVER_DYNAMIC,
  make: make,
  fromReport: fromReport
};

if (typeof process !== 'undefined' && !!process.versions && !!process.versions.node) {
  module.exports = LEVER;
} else if (typeof window !== 'undefined') {
  window.spiritLever = LEVER;
}
