# Z2Z Buddy Linking — Mutual Object Tree Extension

## Core Idea
When two ZS4 instances mutually "buddy" each other, they create a **bidirectional Link Object** that allows each side to see (parts of) the other’s object tree as a natural extension of their own User record — all governed by the Consent Engine.

### Assumptions
- Both parties have accounts on each other’s nodes (mutual friend request accepted)
- Strong identity + public key exchange has occurred
- All visibility is controlled by Consent objects

## Link Object Structure

```js
zs4.type.Link = zs4.type.create({
  name: "Link",
  fields: {
    id: "string",
    myUserId: "ref:User",
    remoteUserId: "ref:User",
    remoteNode: "string",           // e.g. "buddy.z2z.andyflinn.com" or domain
    remotePublicKey: "string",
    status: "enum[pending, active, blocked, revoked]",
    consent: "ref:Consent",         // The governing consent for this link
    lastSynced: "date",
    permissions: {                  // What I allow them to see
      type: "object",
      default: {
        "profile": true,
        "music": true,
        "visual": false,
        "memories": "limited",
        // ... custom types
      }
    }
  }
});