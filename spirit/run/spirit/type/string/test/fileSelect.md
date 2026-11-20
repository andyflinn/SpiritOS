# spirit/type/string/fileSelect.js

The type spirit.type.string.fileSelect: the file a search narrows to: empty for all, else a file as spirit.type.string.file is (goal/G48.4, Andy: "<type>Select.js requires <type>.js, when
validating <type>Select.js FIRST checks for \"\", and returns true if the value is \"\", it otherwise it lets <type>.js handle
the check"). Its test: `./fileSelect.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription), and what
every <type>Select.js keeps beside its sibling, is judged by `../../test/boolean-sibling-general.js`.

## What its test judges

It exists and loads; isValid answers true for '', 'spirit/app/desk/item.get.json'; isValid throws an error for '/abs', '../up', a backslash path, 5, {}; its
description is "empty for all, else " and its sibling's own description.
