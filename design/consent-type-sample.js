// Proposed implementation for Claude
zs4.type.Consent = zs4.type.create({
  name: "Consent",
  fields: {
    id: { type: "string", required: true },
    owner: { type: "ref", ref: "User", required: true },
    scope: { type: "enum", values: ["individual","family","community","organization","public"] },
    purpose: { type: "array", items: "string" },
    grants: { type: "array", items: "object" },     // detailed permissions
    revoked: { type: "boolean", default: false },
    revokedAt: "date",
    expires: "date",
    inheritedFrom: "string",
    auditLog: { type: "array", default: [] }
  },

  // Automatic transforms and behaviors
  onCreate: function(consent) { ... },
  onRevoke: function() { ... cascade logic }
});