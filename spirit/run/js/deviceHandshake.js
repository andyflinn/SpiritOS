'use strict';

// spirit/run/js/deviceHandshake.js
// One in-RAM slot per mailbox process. Never written to disk.
// The relay does not check the password. It holds the POST body
// until the personal node takes it and replies, or the wait expires.

var DEFAULT_WAIT_MS = 25000;
var ERROR_NOT_NOW = 'not now';

function createQueue(opts) {
  opts = opts || {};
  var waitMs = opts.waitMs || DEFAULT_WAIT_MS;
  var nowFn = opts.now || Date.now;
  var pending = null;
  var hits = [];
  var perMin = opts.perMin || 10;

  function rateOk() {
    var t = nowFn();
    hits = hits.filter(function (h) { return t - h < 60000; });
    if (hits.length >= perMin) return false;
    hits.push(t);
    return true;
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
      if (!rateOk()) {
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

  function take() {
    if (!pending || pending.done) return null;
    return {
      password: pending.password,
      devicePublicKey: pending.devicePublicKey
    };
  }

  function reply(accepted) {
    if (!pending || pending.done) return { ok: false, status: 403, error: ERROR_NOT_NOW };
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

  function reset() {
    if (pending && !pending.done) fail(pending, 403);
    pending = null;
    hits = [];
  }

  return {
    offer: offer,
    take: take,
    reply: reply,
    reset: reset,
    ERROR_NOT_NOW: ERROR_NOT_NOW,
    waitMs: waitMs
  };
}

module.exports = { createQueue: createQueue, ERROR_NOT_NOW: ERROR_NOT_NOW };
