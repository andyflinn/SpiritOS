# `app/shell/` — the optional layer, offered as files

**G4, `design/shell/PUBLIC-APP-SERVER.md`:** *"Elements and style
adoption are separately optional. The provider is the shell's **folder**,
not its process — every clone carries `app/shell/` whether or not
anything launches it. 'Paints, never decides' is the condition of being
offerable at all."*

## What is here

| file | utility | what taking it means |
|---|---|---|
| `tokens.css` | `tokens` | colours, spacing and faces as custom properties, and the dark answer as a redefinition of the same names |
| `elements.css` | `elements` | opt-in classes that READ tokens with fallbacks, so they render without them |

`dialogs` is the third name in the vocabulary (`appServer.js`,
`UTILITIES`) and **is not provided yet**. It is listed there because the
grant is a contract decision and the file is a deployment fact — an app
may declare it, and will be granted nothing until this folder offers it.

## How an app takes it

In its manifest, and nowhere else:

```json
{ "surface": ["verb"], "utilities": ["elements"], "posture": "strict" }
```

**Declaring nothing is handed nothing.** Absent means nothing, because
the permissive default would make the app contract a check that cannot
fail.

**And the two are separately optional**, which is asserted rather than
promised: `appServerBoundary.js` plants an app that asks for `elements`
alone and requires that `dialogs` does not arrive with it.

## The rule this folder lives under

**Paints, never decides.** A token or a class that carried a decision
would make every app adopting it inherit that decision, and an app cannot
refuse what it did not know it was taking. So: custom properties and
opt-in class names. Nothing here selects a bare element, so linking a
file cannot restyle a page that merely linked it.

**This is a folder, not a process.** Nothing launches to make it
available, nothing is running for an app to depend on, and a clone that
never starts a shell still carries it.
