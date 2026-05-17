# SpiritOS Type System

**Version:** 0.2 (17 May 2026)  
**Author:** Andy Flinn

## Core Principle: Freedom First

The lowest layer of SpiritOS is **intentionally untyped**.  
Users can create arbitrary objects and freely add/remove members using valid `a-z` keys **without any typing**.

Typing is **opt-in**. It provides optional structure, protection, validation, and special behavior.

## Member Behavior Flags

Flags are defined in the type definition and control how individual members behave. All flags default to `false`.

| Flag          | Meaning when `true`                                              | Default |
|---------------|------------------------------------------------------------------|---------|
| `readonly`    | Client can read, but **cannot modify** this member               | false   |
| `immutable`   | Can be set once (usually at creation), then **never changed**    | false   |
| `serveronly`  | Exists only on the server, **never sent** to any client         | false   |
| `nopersist`   | Exists only in RAM, **never saved** to disk                      | false   |

### Example in Type Definition

```json
{
  "system": {
    "types": {
      "media": {
        "_type": "type-definition",
        "fields": {
          "id": {
            "type": "name",
            "immutable": true
          },
          "createdat": {
            "type": "string",
            "immutable": true
          },
          "description": {
            "type": "string"
          },
          "internalcache": {
            "type": "object",
            "serveronly": true,
            "nopersist": true
          }
        }
      }
    }
  }
}