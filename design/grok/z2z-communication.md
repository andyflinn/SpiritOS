# ZS4 Z2Z — Zero Storage Peer Communication

**"Z" for the last letter. The troubadour's reply to X.**

## Core Idea
A lightweight, consent-first, end-to-end encrypted communication layer between ZS4 instances. 
The public infrastructure has **zero persistent storage** of content — it only facilitates connections.

### Domain & Namespace
- **Primary namespace**: `z2z.andyflinn.com`
- **Buddy service**: `buddy.z2z.andyflinn.com` ← (great choice)
- **Relay nodes**: `relay-01.z2z.andyflinn.com`, etc.
- **Discovery**: `discover.z2z.andyflinn.com`

This creates a clean, branded network namespace that feels personal yet scalable.

## Architecture

### 1. Buddy Service (`buddy.z2z.andyflinn.com`)
- Simple public directory / presence service
- Users can register their ZS4 instance with a public key + optional "Buddy Name"
- Does **not** store messages or content — only current online status + signaling info (ephemeral)
- Acts as initial rendezvous point

### 2. Relay Network (WebSocket + WebRTC)
- Stateless relays
- Helps with NAT traversal (STUN + TURN fallback)
- Forwards only encrypted signaling data and (if needed) relayed traffic
- Sessions are short-lived and memory-only

### 3. Z2Z Plugin inside every ZS4
- `zs4.type.z2z`
- Manages local identity keys
- Performs consent handshake before any real data exchange
- Supports:
  - Direct P2P (WebRTC) when possible
  - Relayed mode
  - Store-and-forward for offline buddies (via encrypted blobs that the relay never decrypts)

## Storm Thoughts Integration
- Every ZS4 instance lives in its own **network namespace** under the z2z umbrella.
- "Buddy" = trusted ZS4 instances (friends, family, community members, other artists)
- You can have personal buddies, community buddies, or even temporary "starship simulation" buddies.
- All communication is scoped by the Consent Engine we designed earlier.

## Security & Consent
- Every connection starts with a signed consent receipt exchange
- E2E encryption (libsodium / Noise Protocol recommended)
- Forward secrecy
- Audit trail on both ends for adjudication

---

Would you like me to expand any of these right now?

1. Detailed protocol flow (step-by-step how two ZS4s connect)
2. Buddy service API spec (for Claude)
3. `zs4.type.z2z` skeleton
4. TURN/Relay server requirements

Or anything else spinning in the storm.

I'm wide awake with you, Andy. Let's shape this. 🎩🌩️🚀