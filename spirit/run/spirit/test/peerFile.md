# spirit/peerFile.js — its own test

One peer, one file, named by the peer's WHOLE public key, so that "which file is this peer's" has one answer in the
tree. Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). Pure, in process.

- `nameFromKey`: the key's bytes in lowercase hex, `0-9a-f` only; injective (two keys sharing their SPKI prefix, or
  differing only in case, name two files even case-folded, as NTFS folds them); the whole key, never a tail, prefix or
  hash; no key names nothing.
- `keyFromName`: reversible, from the name or the name upper-cased; a char above one byte round-trips, and so does the
  char 0xff; a name it did not write (not hex, odd length, a cut wide char, empty, a path) is no key.
- `fileName`: `peerfile-<name>.json` (`PREFIX` is `peerfile-`, the one `.gitignore` line `**/peerfile-*.json`); one
  path segment, never a separator; another extension, or none, honoured.
- `keyFromFileName`: the key back, the extension's case ignored; the prefix optional on the way back, so a name written
  before it still decodes; any other file name is no key.

## What its test must try to break

A name that keeps letters as letters (lossy on Windows); a name from part of the key; a decoder that half-decodes a
foreign name; a prefix that changes and orphans the `.gitignore` line.

## The char 0xff

`the char 0xff round-trips too`: `keyFromName` reads the byte `ff` as the mark of a wider char, so `nameFromKey` writes
0xff itself in the long form (`ff00ff`), and `'aÿb'` comes back whole. The module's own words: *"a
caller passing something else must still round-trip rather than silently truncate"*. Base64 keys never hold it.
