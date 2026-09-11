'use strict';

// spirit/run/js/deviceHandshake.js
// One in-RAM slot PER IDENTITY, and one offer bucket + one pending
// bucket PER IDENTITY. Never written to disk. The relay does not check
// the password. It holds the POST body until that identity's node takes
// it and replies, or the wait expires.
//
// Per-identity slot and per-identity rate land together. A per-identity
// slot with a shared bucket is the same bug wearing a better name.
//
// LONGER THAN ONE NODE PASS, PLUS A MARGIN. Written down rather than
// imported: this module runs on the RELAY and DEVICE_TICK_MS belongs to
// a personal node. spirit/test/deviceRendezvous.js holds the two together.
// A per-identity slot changes who is waiting, not the arithmetic.
//
// DEFAULT_WAIT_MS = 66000. Do not lower it without changing DEVICE_TICK_MS
// and the rendezvous test in the same commit.

var DEFAULT_WAIT_MS = 66000;
var ERROR_NOT_NOW = 'not now';

// B2: TRIM ONLY. The id handed in here is a PUBLIC KEY, and keys are
// standard base64 — `toLowerCase()` is lossy on them, so two distinct
// keys could collide into one slot. Labels cannot be the id: they
// duplicate by design (relay.js, at the claim path — "two johns is still
// two keys"), and a slot keyed by label cannot tell them apart.
//
// Every B1 caller is unaffected: its ids were already lower case.
function normalizeName(name) {
  return String(name || '').trim();
}

function createOne(opts) {
  opts = opts || {};
  var waitMs = opts.waitMs || DEFAULT_WAIT_MS;
  var nowFn = opts.now || Date.now;
  var pending = null;
  var offerHits = [];
  var pendingHits = [];
  var perMin = opts.perMin || 10;

  function prune(hits, t) {
    return hits.filter(function (h) { return t - h < 60000; });
  }

  function rateOk(hits) {
    var t = nowFn();
    hits = prune(hits, t);
    if (hits.length >= perMin) return { ok: false, hits: hits };
    hits.push(t);
    return { ok: true, hits: hits };
  }

  function clearTimer(slot) {
    if (slot && slot.timer) {
      clearTimeout(slot.timer);
      slot.timer = null;
    }
  }

  function fail(slot, status) {
    if (!slot || slot.done) return;
    slot.done = true;
    clearTimer(slot);
    if (pending === slot) pending = null;
    slot.resolve({ ok: false, status: status || 403, error: ERROR_NOT_NOW });
  }

  function offer(password, devicePublicKey) {
    return new Promise(function (resolve) {
      var gated = rateOk(offerHits);
      offerHits = gated.hits;
      if (!gated.ok) {
        resolve({ ok: false, status: 429, error: ERROR_NOT_NOW });
        return;
      }
      if (typeof password !== 'string' || !password) {
        resolve({ ok: false, status: 403, error: ERROR_NOT_NOW });
        return;
      }
      if (typeof devicePublicKey !== 'string' || !devicePublicKey) {
        resolve({ ok: false, status: 403, error: ERROR_NOT_NOW });
        return;
      }
      if (pending && !pending.done) {
        resolve({ ok: false, status: 403, error: ERROR_NOT_NOW });
        return;
      }
      var slot = {
        password: password,
        devicePublicKey: devicePublicKey,
        done: false,
        resolve: resolve,
        timer: null
      };
      pending = slot;
      slot.timer = setTimeout(function () {
        fail(slot, 403);
      }, waitMs);
    });
  }

  function take(nameIgnored) {
    if (!pending || pending.done) return null;
    return {
      password: pending.password,
      devicePublicKey: pending.devicePublicKey
    };
  }

  function reply(accepted) {
    if (!pending || pending.done) {
      return { ok: false, status: 403, error: ERROR_NOT_NOW };
    }
    var slot = pending;
    slot.done = true;
    clearTimer(slot);
    pending = null;
    if (accepted) {
      slot.resolve({
        ok: true,
        status: 200,
        devicePublicKey: slot.devicePublicKey
      });
      return { ok: true, status: 200 };
    }
    slot.resolve({ ok: false, status: 403, error: ERROR_NOT_NOW });
    return { ok: true, status: 200 };
  }

  function pendingRateOk() {
    var gated = rateOk(pendingHits);
    pendingHits = gated.hits;
    return gated.ok;
  }

  function reset() {
    if (pending && !pending.done) fail(pending, 403);
    pending = null;
    offerHits = [];
    pendingHits = [];
  }

  return {
    offer: offer,
    take: take,
    reply: reply,
    pendingRateOk: pendingRateOk,
    reset: reset,
    waitMs: waitMs
  };
}

function createQueue(opts) {
  var byName = Object.create(null);

  function queueFor(name) {
    var key = normalizeName(name);
    if (!key) return null;
    if (!byName[key]) byName[key] = createOne(opts);
    return byName[key];
  }

  function offer(name, password, devicePublicKey) {
    var q = queueFor(name);
    if (!q) {
      return Promise.resolve({ ok: false, status: 403, error: ERROR_NOT_NOW });
    }
    return q.offer(password, devicePublicKey);
  }

  function take(name) {
    var q = queueFor(name);
    if (!q) return null;
    return q.take();
  }

  function reply(name, accepted) {
    var q = queueFor(name);
    if (!q) return { ok: false, status: 403, error: ERROR_NOT_NOW };
    return q.reply(accepted);
  }

  function pendingRateOk(name) {
    var q = queueFor(name);
    if (!q) return false;
    return q.pendingRateOk();
  }

  function reset(name) {
    if (name == null || name === '') {
      Object.keys(byName).forEach(function (k) { byName[k].reset(); });
      byName = Object.create(null);
      return;
    }
    var q = queueFor(name);
    if (q) q.reset();
  }

  return {
    offer: offer,
    take: take,
    reply: reply,
    pendingRateOk: pendingRateOk,
    reset: reset,
    queueFor: queueFor,
    ERROR_NOT_NOW: ERROR_NOT_NOW,
    waitMs: (opts && opts.waitMs) || DEFAULT_WAIT_MS
  };
}

module.exports = {
  createQueue: createQueue,
  ERROR_NOT_NOW: ERROR_NOT_NOW,
  DEFAULT_WAIT_MS: DEFAULT_WAIT_MS
};
