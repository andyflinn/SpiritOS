# spirit/probabilityStringMatch.js — its own test

How likely two strings mean the same thing, as a number from 0 to 1 (goal/G18.2, the first of the probabilit* modules),
with proximity and case added by goal/G29.1 and the shorter token first by goal/G41.28. Owed since the rule *"every
production script has its own test"* (goal/G47.1, box v72). Pure: two strings in, one number out.

- Andy's item: not a string, 0.0; exactly equal, 1.0; empty against non-empty, 0 (Andy, 2026-10-12); A and B swapped
  give the same answer (*"no matter which one is the search string"*); always 0 to 1; nothing shared, 0.
- How good a match is: starts with beats found somewhere, found whole beats only some words found, closer lengths
  higher; no wildcards (`*` and `?` are characters); accents fold both ways.
- goal/G29.1: words side by side beat them far apart, the order typed beats swapped, and distance weighs more than
  order (labels of the same length, so only those two signals differ).
- goal/G29.1: case counts by a hair, 0.000001 per character whose case differs, and nothing more.
- goal/G41.28: a typed word longer than the label's word still counts by the part they share; a whole word beats a part.
- In a page alike: on `window.spirit.probability`, leaking no name.

## What its test must try to break

The empty string scoring as a prefix of everything (it gave 0.54 once); a weight change that lets order outweigh
distance; a case penalty that moves more than the order of near-equal matches; accents no longer folded; a longer typed
word scoring nothing against a shorter one.
