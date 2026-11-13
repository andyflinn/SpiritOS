# spirit/probabilityStringObjectMatch.js — its own test

How likely a string is what an object holds (goal/G18.3, the second of the probabilit* modules): every string the object
holds is matched by probabilityStringMatch and weighted, the shortest heaviest, the weights adding up to 1. Owed since
the rule *"every production script has its own test"* (goal/G47.1, box v72). Pure; its page half is loaded in a vm.

- Input: an empty or non-string search, or an object that is no plain object, gives 0; an object holding no string, 0.
- `measureObject`: every key and string value in the order met (keys included, *"this is supposed to be dumb"*); empty
  strings out; nested objects searched; since goal/G41.28 numbers as text, a key whose value is false left out (true
  kept, `flag`), arrays scanned element by element; a cycle measured once; each row's JS object path (`stats.cpu`,
  `files[0].name`, goal/G43.6) and `isKey` on a key's own row.
- Weights: (S - L) / S / (n - 1), one string alone 1.0, adding up to 1, the shortest heaviest.
- A weighted sum, not the best field, on purpose: a perfect hit on one field is diluted, more so among more fields; a
  near hit counts less than an exact one; numbers match as text; a false key never matches.
- In a page: on `window.spirit.probability`, the string match read there when called, not when the file loads
  (goal/G41.18).

## What its test must try to break

Weights that no longer add up to 1 or favour the longest string; a false key matched; numbers or array elements left
out; a cycle that never ends; paths written another way than JS would.
