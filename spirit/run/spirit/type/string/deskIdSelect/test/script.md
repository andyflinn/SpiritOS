# spirit/type/string/deskIdSelect/script.js

The type spirit.type.string.deskIdSelect: a Desk id that may be left empty: "" for none, else an id as spirit.type.string.deskId takes (goal/G48.4; Andy: "<type>Select.js FIRST checks for "", and returns true if the value is "", it otherwise it lets <type>.js handle the check"). Its test: `./script.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription), and what
every <type>Select.js keeps beside its sibling, is judged by `spirit/testicle/general/any/typeRules/script.js`.

## What its test judges

It exists and loads; isValid answers true for "", "goal/G48.4"; isValid throws an error for "G48", "goal/G48.4.1", 5, null.
