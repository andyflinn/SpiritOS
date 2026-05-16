# Morituri Te Salutant — Execution Roadmap

**Version:** 0.1 (16 May 2026)  
**Author:** Andy Flinn

**Goal:** Aggressively clean the codebase, then build the minimal viable three-node network.

### Phase 0: The Great Purge (Next ~10 days)

**High Priority Kills:**
- Passport.js + session middleware
- Generic database driver layer
- AMP support
- price.js / coin stuff
- Old polling / HTTP-only endpoints
- OAuth / social logins
- Multi-tenant / admin code

*(Continue the full list we discussed earlier...)*

### Phase 1: Foundation Modernization
- WebSocket browser ↔ server communication
- Simplified JSON persistence
- Public-key identity
- Basic consent engine

### Phase 2: Three Nodes
1. Andy’s Relay Node
2. Andy’s Personal Node A
3. Andy’s Personal Node B

Prove: relay connection + owned relay exchange + basic object exchange.