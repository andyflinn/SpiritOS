'use strict';

// spirit/test/capacityKinds.js
// WHICH CAPACITY FIGURES DEPEND ON THE BOX, AND WHICH CANNOT.
//
//   Andy, 2026-09-26: "what we want to do is distinguish the flaky
//   measurements from the computes ones: nominal member streamed
//   concurrently (may depend on system memory user for sockets etc...)"
//
// Two kinds of number, kept apart so a busy laptop does not read as a
// regression and a real regression does not read as noise.
//
// ── THE AXIS IS NOT COMPUTED-VERSUS-MEASURED ────────────────────────
//
// None of the row sizes below has a formula. Each is obtained by
// building a row and weighing it, so BOTH kinds are measured. What
// separates them is whether the answer can differ from box to box.
//
// Every figure in SAME_ON_ANY_BOX is a property of the schema, so it can
// be asserted EXACTLY across boxes (capacityFresh.js) and a disagreement
// is a defect rather than weather.
//
// Membership is decided by what a figure IS, not by whether two boxes
// happen to agree: `cpus` can match on two boxes and is still
// box-dependent.
//
// ── WHY THIS IS ITS OWN FILE ────────────────────────────────────────
//
// `measureCapacity.js` MEASURES WHEN IT IS REQUIRED — it spawns servers
// and holds sockets at import, so anything that wants to know the KINDS
// would start a measurement to find out.

// Properties of the schema. Identical on every box, or something is wrong.
const SAME_ON_ANY_BOX = [
  'perMemberRowBytes',
  'perMemberRowBytesUncarded',
  'cardBytes',
  // The partner roll is gone (goal/G22.6) and measureCapacity does not
  // measure it; kept classified because a published capacity.json
  // (agents/claude-windows) still carries it until that box is measured again.
  'perPartnerRowBytes',
  'perShadowRowBytes',
  'perRouteRowBytes',
  'perReachablePeerBytes',
  'perLogEntryBytesSynthetic',
];

// Whatever box ran. A tolerance and a named box, or an OBSERVATION
// rather than an assertion — never compared across boxes.
const MEASURED_ON_THIS_BOX = [
  'cpus',
  'totalRamBytes',
  'bareNodeRss',
  'relayAtRestRss',
  'nodeAtRestRss',
  'perStreamProcessBytes',
  'perStreamKernelBytes',
  'installBytes',
  'installFiles',
  // How many times this box has published.
  'runs',
];

// HIS WORDS FOR THEM, not ours, because the published block is his to
// read: he asked to tell claims from observations without reading code.
const LABELS = {
  same: 'the same on any box',
  measured: 'measured on this box',
};

function kindOf(field) {
  if (SAME_ON_ANY_BOX.indexOf(field) !== -1) return 'same';
  if (MEASURED_ON_THIS_BOX.indexOf(field) !== -1) return 'measured';
  return null;
}

module.exports = {
  SAME_ON_ANY_BOX: SAME_ON_ANY_BOX,
  MEASURED_ON_THIS_BOX: MEASURED_ON_THIS_BOX,
  LABELS: LABELS,
  kindOf: kindOf,
};
