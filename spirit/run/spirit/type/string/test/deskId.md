# spirit/type/string/deskId.js

The type spirit.type.string.deskId: a Desk goal or item: goal/G<goal> or goal/G<goal>.<item> (goal/G48.4; Desk's item ids). Its test: `./deskId.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription), and what
every <type>Select.js keeps beside its sibling, is judged by `spirit/test/script-sibling-general.js` (its type rules).

## What its test judges

It exists and loads; isValid answers true for "goal/G48", "goal/G48.4"; isValid throws an error for "G48.4", "goal/G48.4.1", "goal/g48", "", 5.
