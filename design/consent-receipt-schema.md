# ZS4 Consent Receipt Schema

A portable, verifiable, court-ready receipt for every consent action.

```js
{
  "receiptId": "uuid-string",
  "consentId": "ref-to-consent",
  "version": "2026-05-01",
  "issuedAt": "2026-05-15T12:00:00.000Z",
  "issuer": "zs4.and yflinn.com",           // or self-hosted domain
  "owner": {
    "userId": "user-xyz",
    "displayName": "Andy Flinn"
  },
  "scope": "community",
  "purpose": ["digital-twin", "music-style-training", "community-spirit"],
  "grants": [
    {
      "resourceType": "visual-likeness",
      "allowed": true,
      "limitations": { "maxResolution": "high", "contexts": ["personal", "community"] }
    },
    {
      "resourceType": "music-performance-style",
      "allowed": true,
      "limitations": { "purpose": ["training", "public-performance"] }
    }
  ],
  "revokable": true,
  "expires": null,
  "policyUrl": "https://zs4.and yflinn.com/policies/npl-v1",
  "signature": {
    "algorithm": "ed25519",
    "publicKey": "...",
    "value": "base64-signature"
  },
  "previousReceiptId": "optional-for-chain"
}