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
//   relay-state/config.json   { "ramLimitMB": 256, "discLimitMB": 64 }
//
// Pure: text in, config or error out. Reading the file and measuring the
// box are the caller's, so this is testable without either.
//
// ── TWO LIMITS NOW, BECAUSE ONE IS NOT A BOUND (cycle 9) ─────────────
//
//   Andy, 2026-09-22: "DISC boundaries must be set also."
//   Andy: "disc bound must be in place for completeness."
//
// A relay that bounds its memory and not its disc cannot be said to be
// bounded. `ramLimitMB` fixes how many streams it will carry
// (relay.js, allowanceFor); `discLimitMB` fixes how much of the box its
// state may occupy, and therefore how many members it will take on.
//
// This file promised it: "Later keys (a disc limit) arrive with the cycle
// that uses them." This is that cycle.
//
// ── NO RELAY RUNS ON AN IMPLICIT FIGURE ──────────────────────────────
//
// `DEFAULT_RAM_LIMIT_MB = 256` stood here — one number for a 1 GB VPS and
// a 64 GB workstation alike. It is gone. The default is now measured from
// the box (relayLimits.js): half of what it has, clamped to what it can
// give. A relay started without a `config.json` writes the file it
// computed, so the figures a relay runs on are always readable on the box
// rather than implied by an absent file.

var relayLimits = require('./relayLimits');

// `text` is the file's contents, or null when there is no file.
// `measured` is relayLimits.measure()'s answer — { totalMB, availableMB,
// discTotalMB, discFreeMB }. A bare number is accepted as the box's total
// memory, which is what cycle 1's callers passed.
// Returns { ok, config } or { ok: false, error } with a sentence an owner
// can act on.
function parse(text, measured, opts) {
  var box = normalise(measured);
  var fallback = relayLimits.defaults(box);
  var atBoot = !!(opts && opts.atBoot);

  if (text == null) {
    return check({
      ramLimitMB: fallback.ramLimitMB,
      discLimitMB: fallback.discLimitMB,
      source: 'default',
    }, box, atBoot);
  }
  var raw;
  try { raw = JSON.parse(String(text)); }
  catch (e) {
    return { ok: false, error: 'relay-state/config.json is not valid JSON: ' + e.message };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'relay-state/config.json must be an object, e.g. { "ramLimitMB": 256, "discLimitMB": 64 }' };
  }
  // `maxPerTarget` STOOD HERE and is gone (2026-09-21). It was put in this
  // file on 2026-09-20 arguing that the file "is only ever written by a
  // person with a shell" — the same argument Andy revoked hours later for
  // `settable`. By the rule that replaced it, a LIMIT is the code's and a
  // POLICY is the owner's, and this is a limit: it bounds what a partner
  // may aim at a member, so it protects parties other than the owner. A
  // limit an owner can widen is not a limit, it is a default.
  //
  // It is now a constant in router.js, at 1, which is where 0016 always
  // said it would land once a node could queue.
  //
  // A KEY THE FILE OMITS TAKES THE MEASURED DEFAULT rather than failing:
  // a `config.json` written before disc was bounded is a real file on a
  // real box, and it names a RAM figure its owner chose. Refusing to
  // start over the key it could not have known about would punish him for
  // upgrading.
  return check({
    ramLimitMB: raw.ramLimitMB === undefined ? fallback.ramLimitMB : raw.ramLimitMB,
    discLimitMB: raw.discLimitMB === undefined ? fallback.discLimitMB : raw.discLimitMB,
    source: 'file',
  }, box, atBoot);
}

function normalise(measured) {
  if (typeof measured === 'number') return { totalMB: measured, availableMB: measured };
  return measured || {};
}

function check(config, box, atBoot) {
  var caps = relayLimits.ceilings(box);

  var bad = positive('ramLimitMB', config.ramLimitMB);
  if (bad) return bad;
  bad = positive('discLimitMB', config.discLimitMB);
  if (bad) return bad;

  // ── AN OVERFLOW NOBODY ASKED FOR MUST NOT KEEP THE RELAY DOWN ─────
  //
  //   Andy, 2026-09-22, on a figure that no longer fits: the relay comes
  //   up, says so, takes no new claims, and evicts nobody.
  //
  // A written figure can stop fitting without anybody touching it: the
  // box filled up, or another service took the memory that was spare
  // when the file was written. Refusing to start would take every
  // member's messages down to enforce an accounting rule, and the owner
  // would need SSH to undo a number he never typed.
  //
  // So AT BOOT the ceiling clamps instead of refusing: the relay runs on
  // what the box can actually give, and `overflow` carries what was
  // asked for so the boot line and the owner's report can say it. The
  // owner's own `config` verb passes no `atBoot`, and is refused as
  // before — a figure he is typing NOW is a mistake worth catching.
  if (atBoot) {
    var over = null;
    var ram = config.ramLimitMB;
    var disc = config.discLimitMB;
    if (isFinite(caps.ramMaxMB) && ram > caps.ramMaxMB) {
      over = over || {};
      over.ramAsked = ram;
      ram = caps.ramMaxMB;
    }
    if (isFinite(caps.discMaxMB) && disc > caps.discMaxMB) {
      over = over || {};
      over.discAsked = disc;
      disc = caps.discMaxMB;
    }
    return {
      ok: true,
      config: {
        ramLimitMB: ram,
        discLimitMB: disc,
        source: config.source,
        overflow: over || undefined,
      },
    };
  }

  // ── THE CEILING IS AVAILABILITY, NOT CAPACITY (cycle 9) ────────────
  //
  //   Andy, 2026-09-22: "the upper bound is: total memory minus the
  //   memory not available at startup/install time due to system
  //   overhead. minus a 25 MB or so safety margin."
  //
  // It used to be the box's TOTAL memory, which let an owner configure
  // memory the machine had never had spare — a bound that passed its own
  // check and could not be kept. The margins live in relayLimits.js.
  if (isFinite(caps.ramMaxMB) && config.ramLimitMB > caps.ramMaxMB) {
    return {
      ok: false,
      error: 'ramLimitMB ' + config.ramLimitMB + ' is more than this box can give (' +
        caps.ramMaxMB + ' MB available, after the ' + relayLimits.RAM_MARGIN_MB +
        ' MB safety margin). The configuration is bounded by the box; lower it, or free memory.',
    };
  }
  if (isFinite(caps.discMaxMB) && config.discLimitMB > caps.discMaxMB) {
    return {
      ok: false,
      error: 'discLimitMB ' + config.discLimitMB + ' is more than this disc can give (' +
        caps.discMaxMB + ' MB free, after the safety margin). Lower it, or free space.',
    };
  }

  // THIS RETURN IS A WHITELIST, and that is worth knowing before adding a
  // field above without adding it here. `maxPerTarget` nearly shipped
  // without this line: the config file carried it, relay.js read
  // `config.maxPerTarget`, and this dropped it in between — so the cap
  // was configurable, plumbed, tested in memory, and inert on a real box.
  return {
    ok: true,
    config: {
      ramLimitMB: config.ramLimitMB,
      discLimitMB: config.discLimitMB,
      source: config.source,
    },
  };
}

// WHAT THE FILE SAYS, NOT WHAT THE BOX ALLOWED. The owner's verb writes
// the figures he asked for; a boot-time clamp is this process's own
// accommodation and must never be written back, or a busy afternoon
// would quietly shrink a relay for ever.
function asked(config) {
  var c = config || {};
  var over = c.overflow || {};
  return {
    ramLimitMB: over.ramAsked === undefined ? c.ramLimitMB : over.ramAsked,
    discLimitMB: over.discAsked === undefined ? c.discLimitMB : over.discAsked,
  };
}

function positive(name, mb) {
  if (typeof mb !== 'number' || !isFinite(mb) || mb <= 0) {
    return { ok: false, error: name + ' must be a positive number of megabytes, got ' + JSON.stringify(mb) };
  }
  return null;
}

// THE FILE A RELAY WRITES FOR ITSELF, from one place, so what first start
// writes and what a later reconfigure writes cannot drift apart. Trailing
// newline because a person opens this file over SSH.
function fileText(config) {
  return JSON.stringify({
    ramLimitMB: (config || {}).ramLimitMB,
    discLimitMB: (config || {}).discLimitMB,
  }, null, 2) + '\n';
}

module.exports = {
  parse: parse,
  fileText: fileText,
  asked: asked,
};
