
---

### 2. **`design/crypto-signing-helpers.js`**

```js
// design/crypto-signing-helpers.js — For Claude to implement / integrate

zs4.crypto = zs4.crypto || {};

// Simple but strong signing (upgradeable to ed25519 later)
zs4.crypto.sign = function(data) {
  // data = any object (consent, receipt, audit entry)
  const canonical = JSON.stringify(data, Object.keys(data).sort());
  const hash = zs4.crypto.sha256(canonical);
  
  // Use existing node-rsa or upgrade to modern library
  const signature = zs4.rsa.sign(hash);   // your current rsa.js
  
  return {
    algorithm: "rsa-sha256",
    value: signature,
    keyId: "zs4-owner-key-001"
  };
};

zs4.crypto.verify = function(data, signature) {
  // verification logic
};

zs4.crypto.hashChain = function(previousHash, newRecord) {
  return zs4.crypto.sha256(previousHash + JSON.stringify(newRecord));
};