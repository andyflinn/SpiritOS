# SpiritOS Compound Request & Transform System

**Version:** 0.1 (17 May 2026)  
**Author:** Andy Flinn

> **Status: not yet implemented.** Describes a request format for the
> future `spirit.json` layer (see design/spirit-json/ROOT-STRUCTURE.md).
> spirit/run/'s actual API is one verb per packet through the node's one
> door (`fs.save`, `jobs.create`, … — the old `/api/fs/*` and `/api/jobs`
> routes are gone, `spirit/run/spirit/server.js:924-926`); it is simpler
> and doesn't implement this compound-request shape.

## Principle

A single request is a **nested subset** of the global object tree.  
It can contain any combination of:

- Simple value updates
- Deletions (`null`)
- Named transforms/method calls

## Request Example

```json
{
  "media": {
    "media_123": {
      "description": "updated description"
    },
    "media_999.create": {
      "filename": "newportrait.jpg",
      "description": "portrait photo of me in the swimming pool..."
    }
  },
  "playlist.current": null
}