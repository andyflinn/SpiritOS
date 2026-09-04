'use strict';

// In-memory claimed presence for --relay. Process lifetime only.
// Names are believed as sent. Duplicate name → 409 (so collisions are visible).

function createRelay() {
  const peers = Object.create(null); // name → { name, claimedAt }

  function normalizeName(name) {
    if (typeof name !== 'string') return '';
    return name.trim();
  }

  function claim(name) {
    const n = normalizeName(name);
    if (!n) return { ok: false, status: 400, error: 'name required' };
    if (peers[n]) return { ok: false, status: 409, error: 'name already claimed', peer: peers[n] };
    const peer = { name: n, claimedAt: new Date().toISOString() };
    peers[n] = peer;
    return { ok: true, status: 201, peer };
  }

  function who() {
    return Object.keys(peers).sort().map(function (k) { return peers[k]; });
  }

  return { claim, who };
}

module.exports = { createRelay };