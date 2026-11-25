# spirit/type/string/commitSelect/script.js

The type spirit.type.string.commitSelect: a commit that may be left empty: "" for none, else a commit as spirit.type.string.commit takes (goal/G48.4; Andy: "<type>Select.js FIRST checks for "", and returns true if the value is "", it otherwise it lets <type>.js handle the check"). Its test: `./script.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription), and what
every <type>Select.js keeps beside its sibling, is judged by `spirit/test/script-sibling-general.js` (its type rules).

## What its test judges

It exists and loads; isValid answers true for "", "ac88be8"; isValid throws an error for "ac88be", "AC88BE8", 5, null.
