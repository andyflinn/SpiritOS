# spirit/type/string/labelSelect.js

The type spirit.type.string.labelSelect: a label that may be left empty: "" for none, else a label as spirit.type.string.label takes (goal/G48.4; Andy: "<type>Select.js FIRST checks for "", and returns true if the value is "", it otherwise it lets <type>.js handle the check"). Its test: `./labelSelect.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription), and what
every <type>Select.js keeps beside its sibling, is judged by `spirit/test/script-sibling-general.js` (its type rules).

## What its test judges

It exists and loads; isValid answers true for "", "Andy", "a".repeat(64); isValid throws an error for "a".repeat(65), 5, null.
