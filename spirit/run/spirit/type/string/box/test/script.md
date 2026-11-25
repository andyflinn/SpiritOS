# spirit/type/string/box/script.js

The type spirit.type.string.box: the text of a Desk box: any string, empty too, at most the node's payload limit (goal/G48.4; Andy: "unlimited strings are forbidden in SpiritOS."). Its test: `./script.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription), and what
every <type>Select.js keeps beside its sibling, is judged by `spirit/test/script-sibling-general.js` (its type rules).

## What its test judges

It exists and loads; isValid answers true for "", "a\nb", "a".repeat(T.MAX_BYTES); isValid throws an error for "a".repeat(T.MAX_BYTES + 1), 5, null.
