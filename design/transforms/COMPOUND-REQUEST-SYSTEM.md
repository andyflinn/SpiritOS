# SpiritOS Compound Request & Transform System

**Version:** 0.1 (17 May 2026)  
**Author:** Andy Flinn

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