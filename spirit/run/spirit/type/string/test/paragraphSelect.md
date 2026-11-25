# spirit/type/string/paragraphSelect.js

The type spirit.type.string.paragraphSelect: a paragraph that may be left empty: "" for none, else a paragraph as spirit.type.string.paragraph takes (goal/G48.4; Andy: "<type>Select.js FIRST checks for "", and returns true if the value is "", it otherwise it lets <type>.js handle the check"). Its test: `./paragraphSelect.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription), and what
every <type>Select.js keeps beside its sibling, is judged by `spirit/test/script-sibling-general.js` (its type rules).

## What its test judges

It exists and loads; isValid answers true for "", "one line\nand another"; isValid throws an error for "a".repeat(2049), 5, null.
