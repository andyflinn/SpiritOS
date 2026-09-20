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
// `live: false` is a lever that reports itself but takes no setting —
// a measurement the owner watches and cannot touch. An app must draw it
// without a control rather than draw a control that will be refused,
// which is the shell's standing rule about chrome that cannot be used.

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
  var live = o.live !== false;
  var lastMove = null;

  // WHY, NOT WHETHER — the same choice labelRule.problem makes. "out of
  // bounds" and "this lever takes no settings" are different problems
  // for the person reading the refusal, and the app shows what the relay
  // said rather than inventing its own wording.
  function canSet(v) {
    if (!live) return 'lever ' + label + ' takes no settings';
    if (v === LEVER_DYNAMIC) return '';
    if (!isInteger(v)) return 'lever ' + label + ' takes a whole number or ' + LEVER_DYNAMIC;
    if (v < o.floor) return 'lever ' + label + ' floor is ' + o.floor;
    if (v > o.ceiling) return 'lever ' + label + ' ceiling is ' + o.ceiling;
    return '';
  }

  function set(v, why) {
    var no = canSet(v);
    if (no) return { ok: false, error: no };
    var from = value;
    value = v;
    lastMove = { from: from, to: v, why: String(why || ''), at: Date.now() };
    return { ok: true, from: from, to: v };
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
      live: live,
      lastMove: lastMove ? {
        from: lastMove.from, to: lastMove.to, why: lastMove.why, at: lastMove.at
      } : null
    };
  }

  return {
    label: label,
    get value() { return value; },
    get live() { return live; },
    floor: o.floor,
    ceiling: o.ceiling,
    set: set,
    canSet: canSet,
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
    live: obj.live !== false,
    value: isInteger(obj.value) ? obj.value : obj.floor
  });
  return {
    label: view.label,
    value: view.value,
    floor: view.floor,
    ceiling: view.ceiling,
    live: view.live,
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
