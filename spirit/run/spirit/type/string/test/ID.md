# spirit/type/string/ID.js

The type spirit.type.string.ID: an ID, a public key (the box: "spirit/type/string/ID.js (public keys)") (goal/G48.4). Its test: `./ID.js`.

## What it is

An object of two static functions (the box: *"defaultValue() returns a default value that passes validation, and
isValid(something) return boolean true if something is valid and throws and error if something is NOT valid."*).

## What its test judges

It exists and loads; it holds defaultValue and isValid; isValid answers true for 'MCowBQYDK2VwAyEANrNqPPaIac2/NlIHC7C+LoalDe0ub7RvS7U4c6P+lzQ='; isValid throws an
error for 'goal/G48', '', 'MCowBQYDK2VwAyEA', 'MCowBQYDK2VwAyEANrNqPPaIac2/NlIHC7C+LoalDe0ub7RvS7U4c6P+lz', 5, null.
