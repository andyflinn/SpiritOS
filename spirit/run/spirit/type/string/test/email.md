# spirit/type/string/email.js

The type spirit.type.string.email: an email address, its limit EMAIL_MAX_BYTES, 254 bytes (goal/G48.4). Its test: `./email.js`.

## What it is

An object of two static functions (the box: *"defaultValue() returns a default value that passes validation, and
isValid(something) return boolean true if something is valid and throws and error if something is NOT valid."*).

## What its test judges

It exists and loads; it holds defaultValue and isValid; defaultValue() passes isValid; isValid answers true for 'andy@example.com'; isValid throws an
error for 'nope', '', 'a@' + 'b'.repeat(254), 5, null.
