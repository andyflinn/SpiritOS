'use strict';

// spirit/test/capacityKinds.js
// WHICH CAPACITY FIGURES DEPEND ON THE BOX, AND WHICH CANNOT.
//
//   Andy, 2026-09-26: "what we want to do is distinguish the flaky
//   measurements from the computes ones: nominal member streamed
//   concurrently (may depend on system memory user for sockets etc...)"
//
// TWO KINDS OF NUMBER WORE ONE NAME, so a busy laptop read as a
// regression and a real regression read as noise — which is why
// capacityFresh went red and nobody trusted it.
//
// ── THE AXIS IS NOT COMPUTED-VERSUS-MEASURED ────────────────────────
//
// None of the row sizes below has a formula. Each is obtained by
// building a row and weighing it, so BOTH kinds are measured. What
// separates them is whether the answer can differ from box to box.
//
// ── AND THE PUBLISHED ROWS PROVE THE SPLIT RATHER THAN CLAIM IT ─────
//
// Every figure in SAME_ON_ANY_BOX agrees BYTE FOR BYTE between
// `ubuntu-24.04-wsl2` and `windows-10.0` — two operating systems, two
// Node builds, two filesystems, measured three days apart at different
// commits: 603, 199, 376, 3293, 159, 420, 579, 253. They are properties
// of the schema, so they can be asserted EXACTLY across boxes and a
// disagreement is a defect rather than weather.
//
// ── AGREEMENT IS THE EVIDENCE, NOT THE TEST ─────────────────────────
//
// `cpus` is 32 on both boxes, by coincidence — both happen to have 32.
// It is box-dependent and sits in the other list. Membership is decided
// by what a figure IS; the cross-box agreement is what prompted the
// split and what makes it checkable.
//
// ── WHY THIS IS ITS OWN FILE ────────────────────────────────────────
//
// `measureCapacity.js` MEASURES WHEN IT IS REQUIRED — it spawns servers
// and holds sockets at import. Putting the declaration there means
// anything that wants to know the KINDS starts a measurement to find
// out. Found by doing exactly that.

// Properties of the schema. Identical on every box, or something is wrong.
const SAME_ON_ANY_BOX = [
  'perMemberRowBytes',
  'perMemberRowBytesUncarded',
  'cardBytes',
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
  // How many times this box has published. Caught by the
  // every-field-is-classified control on its first run — which is the
  // control doing exactly what it was added for: a figure nobody had
  // thought about was neither asserted nor excused.
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
