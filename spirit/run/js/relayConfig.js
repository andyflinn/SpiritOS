'use strict';

// spirit/run/js/relayConfig.js
// THE FIRST CONFIGURATION A RELAY HAS EVER HAD.
//
// Cycle 1 (design/principles/NODE-AND-RELAY.md, §8 and Decided). Until
// now a relay read nothing but --port: every limit was a constant in the
// code. This is the owner's bound, and three levels govern it (Andy,
// 2026-09-19):
//
//   the box            physical RAM — what the owner bought
//   the configuration  this file, bounded by the box
//   the Governor       lever positions, bounded by this file
//
// Each level may narrow the one above it and never widen it. So a
// configured ceiling larger than the box is refused, not honoured: a
// ceiling the machine cannot supply is a misconfiguration, not a
// generous setting.
//
// READ ONCE, AT BOOT. The owner's only real-time tools are signed grants
// (injecting a partner, minting an invite); the configuration is not
// changed while the relay runs (NODE-AND-RELAY §5, scope).
//
//   relay-state/config.json   { "ramLimitMB": 256 }
//
// Only what cycle 1 uses. Later keys (a disc limit) arrive with the cycle
// that uses them, so this precedent stays as narrow as it honestly can.
//
// Pure: text in, config or error out. Reading the file and measuring the
// box are the caller's, so this is testable without either.

// An entry-level VPS is the baseline (NODE-AND-RELAY §8): a ceiling that
// defaulted to "whatever the box has" would not be a ceiling. 256 MB of a
// 1 GB box — a placeholder Andy accepted, to be learned from cycle 1.
var DEFAULT_RAM_LIMIT_MB = 256;

// `text` is the file's contents, or null when there is no file.
// `boxMB` is the machine's total memory. Returns { ok, config } or
// { ok: false, error } with a sentence an owner can act on.
function parse(text, boxMB) {
  if (text == null) {
    return check({ ramLimitMB: DEFAULT_RAM_LIMIT_MB, source: 'default' }, boxMB);
  }
  var raw;
  try { raw = JSON.parse(String(text)); }
  catch (e) {
    return { ok: false, error: 'relay-state/config.json is not valid JSON: ' + e.message };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'relay-state/config.json must be an object, e.g. { "ramLimitMB": 256 }' };
  }
  var mb = raw.ramLimitMB === undefined ? DEFAULT_RAM_LIMIT_MB : raw.ramLimitMB;
  return check({
    ramLimitMB: mb,
    // HOW MANY REQUESTS MAY BE AIMED AT ONE MEMBER AT ONCE (0016).
    // Absent means the router leaves it no tighter than its own table —
    // the ceiling of 1 lands after a node can queue, not before.
    //
    // In the config file and nowhere else, for the reason the whole file
    // exists: it "is only ever written by a person with a shell"
    // (NODE-AND-RELAY:318), so tightening what may be aimed at a member
    // is the owner's act and there is deliberately no verb for it.
    maxPerTarget: raw.maxPerTarget,
    source: 'file',
  }, boxMB);
}

function check(config, boxMB) {
  var mb = config.ramLimitMB;
  if (typeof mb !== 'number' || !isFinite(mb) || mb <= 0) {
    return { ok: false, error: 'ramLimitMB must be a positive number of megabytes, got ' + JSON.stringify(mb) };
  }
  if (typeof boxMB === 'number' && boxMB > 0 && mb > boxMB) {
    return {
      ok: false,
      error: 'ramLimitMB ' + mb + ' is larger than this machine (' + Math.floor(boxMB) +
        ' MB). The configuration is bounded by the box; lower it.',
    };
  }
  // REFUSED RATHER THAN ROUNDED. A per-target cap of 0 admits nobody and
  // a fractional one is a typo; both would be a relay that quietly serves
  // nothing, which is the failure this file exists to make impossible —
  // "a ceiling larger than this machine refuses to start rather than
  // being honoured".
  var per = config.maxPerTarget;
  if (per !== undefined
      && (typeof per !== 'number' || !isFinite(per) || per < 1 || Math.floor(per) !== per)) {
    return {
      ok: false,
      error: 'maxPerTarget must be a whole number of requests, 1 or more, got ' +
        JSON.stringify(per),
    };
  }

  // THIS RETURN IS A WHITELIST, and that is worth knowing before adding a
  // field above without adding it here. `maxPerTarget` nearly shipped
  // without this line: the config file carried it, relay.js read
  // `config.maxPerTarget`, and this dropped it in between — so the cap
  // was configurable, plumbed, tested in memory, and inert on a real box.
  var out = { ramLimitMB: mb, source: config.source };
  if (per !== undefined) out.maxPerTarget = per;
  return { ok: true, config: out };
}

module.exports = {
  parse: parse,
  DEFAULT_RAM_LIMIT_MB: DEFAULT_RAM_LIMIT_MB,
};
