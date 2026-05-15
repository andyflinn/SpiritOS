# Z2Z Data Sync — Push from Originator Model

## Core Philosophy
- **"Push from Originator"** — The owner of the data is solely responsible for pushing updates.
- Receiving nodes are **passive mirrors** (with consent). They do not pull or modify the source data.
- This matches real-world chat behavior: you press "send".

## Key Concepts

### 1. Global Object Identity
Every object must have a stable **GUID**:

```js
object.zs4.head = {
  guid: "uuid-v4-or-better",        // Globally unique, immutable
  ownerNode: "andyflinn.zs4",       // Original owning node
  ownerUserId: "user-xxx",
  createdAt: "timestamp",
  version: 123,                     // monotonic version counter
  signature: "..."                  // optional cryptographic signature by owner
}