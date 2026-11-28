# spirit/type/string/ID/script.js

The type spirit.type.string.ID: an ID, a public key (the box: "spirit/type/string/ID/script.js (public keys)") (goal/G48.4). Its test: `./script.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription) is judged by
`spirit/testicle/general/any/typeRules/script.js`.

## What its test judges

It exists and loads; isValid answers true for 'MCowBQYDK2VwAyEANrNqPPaIac2/NlIHC7C+LoalDe0ub7RvS7U4c6P+lzQ='; isValid throws an
error for 'goal/G48', '', 'MCowBQYDK2VwAyEA', 'MCowBQYDK2VwAyEANrNqPPaIac2/NlIHC7C+LoalDe0ub7RvS7U4c6P+lz', 5, null.

## At the node, the tight check

On a scratch node of its own (goal/G48.4, Q12; Andy: *"node side the shadow roll and the own ID"*): `contact.get`, whose key
is a `spirit.type.string.ID`, takes the node's own key past its argument check, and refuses a well-formed key nobody there has
seen, naming `key`. Adding someone new takes `spirit.type.string.IDNew` instead.
