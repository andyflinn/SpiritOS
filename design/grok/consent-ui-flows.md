# Consent UI/UX Flows

## 1. Granting Consent (Individual)
1. User sees clear plain-language summary + detailed grants
2. Checkbox + "I Understand & Consent" button
3. Optional voice confirmation (for accessibility / spirit recording)
4. Signed receipt generated and shown/stored

## 2. Community Join Flow
1. User browses communities (e.g. "Bad Ragaz Troubadours")
2. Sees what data would be shared
3. Chooses granular options (e.g. "Share music but not face")
4. Consent object created with inheritance from community template

## 3. Revocation Flow
1. One-click "Revoke All" or granular revocation
2. System shows impact ("This will remove your likeness from 3 community models")
3. User confirms → immutable revocation record created
4. Cascade jobs triggered (remove from adapters, notify dependent AIs)

## 4. Forensic / Export Flow
- "Download Court Package" button
- Generates human-readable PDF + signed JSON bundle

These flows must be logged as part of the audit trail.