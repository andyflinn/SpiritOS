# spirit/type/string/json/script.js

The type spirit.type.string.json: JSON carried in a string, at most the payload limit, 22528 bytes (Q3, Andy: "make spirit/type/string/json/script.js and set the limit same as payload, but verify parsing....") (goal/G48.4). Its test: `./script.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription) is judged by
`spirit/testicle/general/any/typeRules/script.js`.

## What its test judges

It exists and loads; isValid answers true for JSON.stringify({ a: 1 }), JSON.stringify([]), JSON.stringify('x'), JSON.stringify({ a: 'b'.repeat(22000) }); isValid throws an
error for '{', 'nope', '', JSON.stringify({ a: 'b'.repeat(22600) }), 5, {}.
