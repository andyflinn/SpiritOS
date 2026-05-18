# SpiritOS Root Structure — spirit.json

**Version:** 0.2 (17 May 2026)  
**Author:** Andy Flinn

## Root Structure

```json
{
  "core": {
    "readme": "SpiritOS is a sovereign personal operating system designed to capture, preserve, and extend a single human spirit under full individual control. Freedom first. Typing is optional but encouraged.",

    "constants": {
      "version": "spiritos/0.1",
      "createdat": "2026-05-17T16:00:00Z",
      "modifiedat": "2026-05-17T16:00:00Z",
      "name": "SpiritOS",
      "author": "Andy Flinn",
      "port": 7777,
      "defaultlanguage": "en",
      "baseurl": "http://localhost:7777"
    },

    "types": {
      // Core types + user/plugin defined types
    }
  },

  // =============================================
  // User Spirit Data
  // =============================================

  "identity": { ... },
  "media": { ... },
  "plugins": { ... },
  "lists": { ... },
  "journal": { ... }
}