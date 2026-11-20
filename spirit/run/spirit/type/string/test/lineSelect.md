# spirit/type/string/lineSelect.js

The type spirit.type.string.lineSelect: the words a search narrows by: empty for all, else a line as spirit.type.string.line is (goal/G48.4, Andy: "<type>Select.js requires <type>.js, when
validating <type>Select.js FIRST checks for \"\", and returns true if the value is \"\", it otherwise it lets <type>.js handle
the check"). Its test: `./lineSelect.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription), and what
every <type>Select.js keeps beside its sibling, is judged by `../../test/boolean-sibling-general.js`.

## What its test judges

It exists and loads; isValid answers true for '', 'two words', 'a'.repeat(1024); isValid throws an error for 'a'.repeat(1025), '   ' (a line is not empty), 5, {}; its
description is "empty for all, else " and its sibling's own description.
