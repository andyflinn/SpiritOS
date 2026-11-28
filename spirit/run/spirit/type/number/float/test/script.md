# spirit/type/number/float/script.js

The type spirit.type.number.float: a finite number, with or without a fractional part, such as a disc size of 1.5
gigabytes (goal/G48.4, Q23; Andy: "spirit.type.number.float"). Its test: `./script.js`.

## What it is

An object of static functions; what every type file holds and keeps (defaultValue, isValid, ruleDescription) is judged by
`spirit/testicle/general/any/typeRules/script.js`.

## What its test judges

It exists and loads; isValid answers true for 1.5, 0.01, 0, -3, 1e6; isValid throws an error for "1.5", NaN, Infinity,
null, {}.
