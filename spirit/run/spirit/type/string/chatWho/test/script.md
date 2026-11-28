# spirit/type/string/chatWho/script.js

The type spirit.type.string.chatWho: the side a Desk chat search keeps: one of '', me, them (goal/G48.4; its three options). Its test: `./script.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription), and what
every <type>Select.js keeps beside its sibling, is judged by `spirit/testicle/general/any/typeRules/script.js`.

## What its test judges

It exists and loads; isValid answers true for "", "me", "them"; isValid throws an error for "you", "Me", 5, null.
