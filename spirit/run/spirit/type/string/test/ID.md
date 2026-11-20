# spirit/type/string/ID.js

The type spirit.type.string.ID: an ID, a public key (the box: "spirit/type/string/ID.js (public keys)") (goal/G48.4). Its test: `./ID.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription) is judged by
`../../test/boolean-sibling-general.js`.

## What its test judges

It exists and loads; isValid answers true for 'MCowBQYDK2VwAyEANrNqPPaIac2/NlIHC7C+LoalDe0ub7RvS7U4c6P+lzQ='; isValid throws an
error for 'goal/G48', '', 'MCowBQYDK2VwAyEA', 'MCowBQYDK2VwAyEANrNqPPaIac2/NlIHC7C+LoalDe0ub7RvS7U4c6P+lz', 5, null.
