'use strict';

// The ICON table, read the other way round.
//
// kernel.js keys glyphs by name — 162 keys over 136 distinct glyphs,
// because aliases are deliberate: NO, ERROR and DELETE are all ❌, and an
// app that means "delete" should be able to say so. That is the right
// shape for writing code. It is the wrong shape for offering a choice,
// where the thing being chosen is the glyph and the names are how you
// find it. So this file inverts the table: one entry per glyph, carrying
// every name it answers to.
//
// Nothing here touches the DOM. The widget built on it (createIconSelector,
// shell.js) is a thin painter over these arrays, which is what lets the
// grouping, the ordering, the exclusion and the filtering be asserted in
// node instead of only being looked at.

// A key as it is shown to a person: SPIRIT -> "Spirit", DELETE -> "Delete",
// BLUE_CIRCLE -> "Blue circle".
//
// The underscore is a separator in the table, not something to read. Left
// in, a two-word key reads as "Blue_circle" — the only place in the shell
// where an identifier leaks into a label.
//
// Acronym-shaped keys read a little oddly this way (OK becomes "Ok"), and
// that is left alone on purpose — a display-override map would be a second
// table to keep in step with the first, and is not worth it for one word.
function iconTitleCase(key) {
  var text = String(key).replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

// What a name looks like for searching: lowercase, and underscores flat.
//
// Both sides go through this, so a person may type what they SEE. Without
// it the chooser offers "Blue circle" and then finds nothing when that is
// typed back — a label you can read and cannot search for, which is worse
// than the raw key it replaced.
function iconSearchable(text) {
  return String(text == null ? '' : text).toLowerCase().replace(/_/g, ' ');
}

// Every glyph in `iconTable`, once, with the names it is keyed under.
//
// `excludeGlyphs` is an array of GLYPHS, not keys, and that is the whole
// point of the signature. Uniqueness between two apps is decided on the
// glyph they paint: Contacts and Groups both showed 👥 while holding
// different keys (GROUP and, had it been used, PEOPLE). Excluding a key
// would strike one name and leave its aliases behind, and the collision
// walks straight back in through the alias. Excluding a glyph strikes the
// whole line, which is the only exclusion that means anything. It also
// costs the caller nothing to produce — listApps() already hands back
// resolved glyphs.
//
// Order is `iconTable`'s own declaration order, both for the lines and for
// the names within a line, so `key` — the first name a glyph is declared
// under — is stable across reloads and machines. The table is hand-written
// and its first spelling is already the primary one (FILE before its
// alias, DELETE at the head of ❌). The alternative, "whichever key the
// runtime happened to enumerate first", is a bug that stays invisible
// until somebody reorders kernel.js.
function iconChoices(iconTable, excludeGlyphs) {
  var excluded = Object.create(null);
  (excludeGlyphs || []).forEach(function (glyph) {
    if (glyph) excluded[glyph] = true;
  });

  var byGlyph = Object.create(null);
  var order = [];
  Object.keys(iconTable || {}).forEach(function (key) {
    var glyph = iconTable[key];
    if (!glyph || excluded[glyph]) return;
    if (!byGlyph[glyph]) {
      byGlyph[glyph] = [];
      order.push(glyph);
    }
    byGlyph[glyph].push(key);
  });

  return order.map(function (glyph) {
    var keys = byGlyph[glyph];
    return {
      glyph: glyph,
      key: keys[0],
      keys: keys,
      label: keys.map(iconTitleCase).join(', '),
    };
  });
}

// The canonical key for a glyph — the first name it is declared under.
//
// Unused by the selector, which deals in glyphs from end to end because
// that is what setAppOverride stores. It is here for the other direction:
// a manifest's `icon` field must be a KEY (kernel.js resolves it through
// ICON[...]), so anything that ever writes a manifest from a chosen glyph
// needs this. Kept beside the grouping rather than re-derived there, so
// there is one answer to "which of these names is the real one".
function iconKeyFor(iconTable, glyph) {
  var keys = Object.keys(iconTable || {});
  for (var i = 0; i < keys.length; i++) {
    if (iconTable[keys[i]] === glyph) return keys[i];
  }
  return null;
}

// Does this line answer to what the person is typing?
//
// Matched against every name on the line, anywhere in it — so `del` finds
// ❌ through DELETE even though the line is headed by another name, and
// `arrow` finds all four arrows. A native <select> could only have matched
// a prefix of the whole option text, and every line here starts with the
// glyph, so its type-ahead would have been reachable only by typing the
// emoji. Owning the filter is what buys this back, and then some.
//
// An empty filter matches everything: the closed list is the whole pool.
function iconMatches(choice, filterText) {
  var needle = iconSearchable(filterText).trim();
  if (!needle) return true;
  if (choice.glyph === needle) return true;
  return choice.keys.some(function (key) {
    return iconSearchable(key).indexOf(needle) !== -1;
  });
}

var iconIndexApi = {
  choices: iconChoices,
  keyFor: iconKeyFor,
  matches: iconMatches,
  titleCase: iconTitleCase,
};

if (typeof process !== 'undefined' && process.versions && process.versions.node) {
  module.exports = iconIndexApi;
} else if (typeof window !== 'undefined') {
  window.spiritIconIndex = iconIndexApi;
}
