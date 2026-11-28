# spirit/type/string/chatScope/script.js

The type spirit.type.string.chatScope: the scope of a Desk chat search: one of '', goal, items (goal/G48.4; its three options). Its test: `./script.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription), and what
every <type>Select.js keeps beside its sibling, is judged by `spirit/testicle/general/any/typeRules/script.js`.

## What its test judges

It exists and loads; isValid answers true for "", "goal", "items"; isValid throws an error for "all", "Goal", 5, null.
