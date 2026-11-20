# spirit/type/string/shellPlace.js

An options type (goal/G48.4, the box: *"options for a multiple-choice will be held in a separate script file for each field
type that has its own options"*): its choices in `OPTIONS`, `isValid` true for one of them and an error for anything else.
Its test: `./shellPlace.js`; what every type file keeps, `../../test/boolean-sibling-general.js`.

## What its test judges

It exists and loads; its `OPTIONS` a list of distinct non-empty strings; `isValid` true for each; an error for a string
that is none of them, an empty one and a choice in other case; an error for 5, true and a list. Its OPTIONS are face and home (Andy: *"{ \"at\":\"face|home\" }"*).
