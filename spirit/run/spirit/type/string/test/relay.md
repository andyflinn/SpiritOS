# spirit/type/string/relay.js

The type spirit.type.string.relay: a relay: its ID, or its http or https address (goal/G48.4; a relay is named by its key or reached by its address). Its test: `./relay.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription), and what
every <type>Select.js keeps beside its sibling, is judged by `spirit/test/script-sibling-general.js` (its type rules).

## What its test judges

It exists and loads; isValid answers true for a key made just now, "https://example.com/a"; isValid throws an error for "", "example.com", "goal/G48", 5.
