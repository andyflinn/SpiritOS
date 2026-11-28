# spirit/type/string/descriptionSelect/script.js

The type spirit.type.string.descriptionSelect: the words a search narrows by: empty for all, else a description as
spirit.type.string.description is (goal/G48.4, Q22; Andy: "isn't description enough?", "description, 128 bytes for a search
string is plenty"). It takes the place of lineSelect, which went with line.js. Its test: `./script.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription), and what
every <type>Select.js keeps beside its sibling, is judged by `spirit/testicle/general/any/typeRules/script.js`.

## What its test judges

It exists and loads; isValid answers true for '', 'two words', 'a'.repeat(128); isValid throws an error for
'a'.repeat(129), '   ' (a description is not empty), 5, {}; its description is "empty for all, else " and its sibling's
own description.
