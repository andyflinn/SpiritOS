// design/consent-type-full-skeleton.js - Feed this to Claude

zs4.type.Consent = zs4.type.create({
  name: "Consent",
  fields: {
    id: { type: "string", required: true, default: "auto-uuid" },
    owner: { type: "ref", ref: "User", required: true },
    scope: { type: "enum", values: ["individual","family","community","organization","public"] },
    purpose: { type: "array", items: "string" },
    grants: { type: "array", items: "object" },
    revoked: { type: "boolean", default: false },
    revokedAt: "date",
    expires: "date",
    inheritedFrom: "string",
    auditLog: { type: "array", default: [] },
    receiptSignature: "string",
    policyVersion: "string"
  },

  onCreate: function(consent) {
    // Generate signed receipt + add to auditLog
    consent.auditLog.push({
      timestamp: new Date().toISOString(),
      action: "granted",
      // ... full details
    });
    consent.receiptSignature = zs4.crypto.sign(consent);
    return consent;
  },

  onRevoke: function(consent) {
    // Cascade logic + immutable history
  }
});