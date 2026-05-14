# ZS4 Consent Engine - Adjudication & Legal Provability

## Goal
Make every consent action provable in human courts, regulatory audits, AI dispute systems, or future digital jurisdictions.

## Core Requirements for Adjudication

### 1. Immutable Audit Trail
Every consent event must record:
- `eventId`: UUID
- `timestamp`: ISO 8601 with millisecond precision + NTP-synced source
- `actor`: User ID (or system)
- `action`: "granted" | "modified" | "revoked" | "inherited" | "exported"
- `consentVersion`: Reference to exact policy/terms shown
- `scope`: individual/family/community/organization
- `purpose`: array of strings
- `grants`: detailed permission objects
- `context`: { device, ipHash, userAgentHash, interfaceVersion, language }
- `signature`: Cryptographic signature of the entire record
- `previousHash`: Hash chaining for tamper detection

### 2. Consent Receipt Standard
Implement a **Consent Receipt** (inspired by Kantara Initiative standards) — a signed, portable JSON document that any party (user, regulator, court, another AI) can independently verify.

### 3. Revocation & Cascade Proof
- Full history always preserved
- Clear proof of what was deleted / updated after revocation
- Exportable "Revocation Report"

### 4. Forensic Export
One-click generation of court-ready packages (human readable + signed machine verifiable).

## Implementation Recommendations
- Use cryptographic libraries (node-rsa, or upgrade to modern @noble/ed25519)
- Optional public timestamping (e.g. hash anchored to blockchain or public ledger)
- Versioned consent policies stored in `./data/policies/`
- All derived models (style adapters, community AIs) must reference source consent records

This makes ZS4 compliant with GDPR, CCPA, and future AI regulations while going beyond them with the Natural Persons Licence philosophy.