'use strict';

// spirit/run/js/deviceHandshake.js
// One in-RAM slot per mailbox process. Never written to disk.
// The relay does not check the password. It holds the POST body
// until the personal node takes it and replies, or the wait expires.

// LONGER THAN ONE NODE PASS, PLUS A MARGIN. This is the whole guarantee:
// hub.js looks every DEVICE_TICK_MS (60s), and a hold that outlasts one
// of those cannot be missed, whatever moment the browser pressed the
// button. A hold SHORTER than the pass makes enrolment a coin toss on the
// phase between two clocks nobody can see — which is exactly what 25s
// against 60s was, and exactly how it behaved: reliable just before a
// pass, reliable-in-the-other-direction just after (Andy, 2026-09-11).
//
// The margin is Andy's rule — "ten percent longer than the poll interval"
// — and it is there for drift and a slow pass, not for luck.
//
// Written down rather than imported: this module runs on the RELAY and
// DEVICE_TICK_MS belongs to a personal node, which the relay never reads.
// spirit/test/deviceRendezvous.js holds the two to each other so the rule
// cannot be broken by changing either one alone.
//
// The cost is one held request, because there is one pending slot — not
// one per enroller. A 66s hold occupies that slot 2.6x longer than a 25s
// one did, and the slot was already the limit on concurrent enrolment.
var DEFAULT_WAIT_MS = 66000;
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
