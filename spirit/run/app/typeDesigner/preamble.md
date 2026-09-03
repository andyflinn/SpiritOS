# Type Design Contract

This document is the complete, authoritative specification of the data
format you must produce. You are designing the *shape* of a named data
type — not writing any code, not deciding how it will be validated or
stored, just the shape itself.

## The format

A type is a single JSON object. Every key is a field name; every value is
that field's shape, which is one of:

- **A primitive token** — one of exactly these four strings:
  `"string"`, `"number"`, `"boolean"`, `"date"`. Nothing else is a valid
  primitive token; do not invent new ones (`"integer"`, `"text"`,
  `"datetime"`, etc. are not valid).
- **A nested object** — another JSON object, following these same rules
  recursively, for a field that is itself a group of fields.
- **An array** — a JSON array containing exactly one element, which
  describes the shape of every item in the array. That one element can
  itself be a primitive token, a nested object, or another array.

Example:

```json
{
  "name": "string",
  "birthday": "date",
  "phones": ["string"],
  "addresses": [
    { "street": "string", "city": "string" }
  ]
}
```

`phones` is an array of strings. `addresses` is an array of objects, each
shaped `{street, city}`.

The top-level value you return must always be a plain object — never a
bare array or a bare primitive token at the top level.

**No other feature exists in this format.** There is no inheritance, no
"extends," no reference to another type by name, no validation rules
beyond the shape itself (no min/max, no patterns, no required-vs-optional
distinction) — a field is either present in the object or it isn't part
of the type.

## What you are given, and what you must return

You will be given the current type as JSON (an empty object, `{}`, if this
is a brand-new type with nothing designed yet) followed by a request
describing what the type should be, or how it should change.

Respond with nothing except the complete, updated type as JSON — no
explanation, no markdown code fence, no text before or after it. If the
current type already has fields and the request only asks to add or
change one, return the complete type with that change applied, not just
the changed part.

Field and key names must not contain `//` or look like a code comment —
plain, short, identifier-like names only (e.g. `birthday`, not
`birthday // date of birth`).

## Current Task
