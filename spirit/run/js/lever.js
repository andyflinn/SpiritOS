'use strict';

// spirit/run/js/lever.js
// ONE GAUGE — what a relay's bound is, where it stands, and what it says
// about itself. Isomorphic, the way labelRule.js and ownerBadge.js are.
//
// ── IT WAS A LEVER, AND NOW IT CANNOT MOVE (cycle 8) ─────────────────────
//
//   Andy: "relay will self-manage within fixed/constant limits. i agree."
//   Andy: "as design pattern relay-internally, they still make sense to
//   me" — with the lever-control APIs scrapped.
//   Grok (review): "Levers kept 'for later' grow a governor back."
//
// Until cycle 8 this had ONE MUTATOR, `set`, through which the Governor and
// the owner moved a value, with a `lastMove` recording who and why, a
// `settable` flag for the owner, and a `'dynamic'` value that handed a
// lever back. All of it is gone with the Governor (governor.js, deleted):
// nothing on a relay moves a bound at runtime any more, so nothing here
// can. **A gauge is described once, at boot, and only read after.** That
// is the line that stops a governor growing back — there is no setter to
// grow one from.
//
// ── WHAT STAYS, AND WHY ──────────────────────────────────────────────────
//
//   Andy: "Every proposed lever must define floor and ceiling
//   considerations."
//
// The owner's monitor draws gauges GENERICALLY — label, value, floor,
// ceiling — with none named in its code, so a gauge added on the relay
// next month is drawn by an app that shipped this month. That only works
// if every gauge reports itself the same way, so the self-description
// belongs here.
//
// The report keeps the lever's old field names (`settable` false, `locked`
// false, `lastMove` null), so the monitor that draws them needed no change.
//
// ── worseAt ──────────────────────────────────────────────────────────────
//
// Which END of the range is the bad one, because a meter's colour is a
// claim the drawing app cannot make. On connections1 a low allowance is the
// bad end; on a timeout a high value would be. The gauge says which.

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

// REFUSES RATHER THAN CORRECTS. A gauge built with a bad label or an
// inverted range is a programming error on the relay, not a runtime
// condition to be tidied.
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
  if (value < o.floor || value > o.ceiling) {
    throw new Error('lever ' + label + ': value ' + value + ' outside ' + o.floor + '..' + o.ceiling);
  }
  var worseAt = o.worseAt === 'floor' || o.worseAt === 'ceiling' ? o.worseAt : null;

  // THE REPORT'S SELF-DESCRIPTION: everything the monitor needs to draw a
  // gauge it has never heard of. Nothing here is a reference — a report
  // crosses the wire and is read by an app in another process.
  function readOut() {
    return {
      label: label, value: value, floor: o.floor, ceiling: o.ceiling,
      settable: false, worseAt: worseAt, locked: false, lastMove: null,
    };
  }

  // FROZEN, so "only read after boot" is enforced rather than hoped.
  return Object.freeze({
    label: label,
    value: value,
    floor: o.floor,
    ceiling: o.ceiling,
    worseAt: worseAt,
    readOut: readOut,
  });
}

// THE NODE SIDE: the monitor receives a readOut and draws it. It never
// moves anything — nothing on the node may.
function fromReport(obj) {
  if (!obj || typeof obj !== 'object') return null;
  if (!isInteger(obj.floor) || !isInteger(obj.ceiling)) return null;
  var rule = labelRule();
  if (!rule || !rule.leverOk(obj.label)) return null;
  var view;
  try {
    view = make(obj.label, {
      floor: obj.floor, ceiling: obj.ceiling, worseAt: obj.worseAt,
      value: isInteger(obj.value) ? obj.value : obj.floor,
    });
  } catch (e) { return null; }
  return {
    label: view.label, value: view.value, floor: view.floor, ceiling: view.ceiling,
    settable: false, worseAt: view.worseAt, locked: false, lastMove: null,
  };
}

var LEVER = {
  make: make,
  fromReport: fromReport,
};

if (typeof process !== 'undefined' && !!process.versions && !!process.versions.node) {
  module.exports = LEVER;
} else if (typeof window !== 'undefined') {
  window.spiritLever = LEVER;
}
