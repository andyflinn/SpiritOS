'use strict';

// spirit/run/process/js/relayLimits/relayLimits.js
// READING AND SETTING A REMOTE RELAY'S LIMITS, FROM ITS OWNER'S NODE.
//
//   Andy, 2026-09-22: "i want interfaces to do this remotely." — "the
//   relay config must be updated via relay api. if it goes wrong i can
//   also ssh...."
//
// The relay half landed in cycle 9: an owner-signed `{ config: … }` posted
// to the relay's own key, answered on the post. This is the node half —
// the thing a person or an agent actually runs.
//
//   node process/js/relayLimits/relayLimits.js list
//   node process/js/relayLimits/relayLimits.js read  [spirit|lab|<url>]
//   node process/js/relayLimits/relayLimits.js set   [<relay>] --ram 256 --disc 64 [--no-restart]
//
// `set` RESTARTS THE RELAY, because the figures are read once at boot and
// because the restart is what returns the process's working set to the
// box. `--no-restart` writes them and leaves the outage for later.
//
// ── WHY A PROGRAM AND NOT A VERB ────────────────────────────────────
//
// The node already posts owner grants to a relay the way it posts to a
// person, and hub.js says why a verb would be wrong: it "would have been
// a third place to shape one request, and the only thing it added was a
// second door on the relay to receive it". So this builds the packet,
// posts it through `peer.post`, and reads the answer off the node's own
// event stream — no new surface anywhere.
//
// It is also the third sample: hello-world posts, the agents program
// coordinates, and this one asks a machine to change itself and reports
// what it said. Everything it does, a developer's program in any language
// can do through the same loopback door.
//
// ── WHAT IT WILL NOT DO ─────────────────────────────────────────────
//
// It never decides a figure. It sends what it was told and prints what
// came back — including a refusal, which on this verb is usually the
// point: a shrink that would strand members is refused whole, and the
// answer names the gap (design/principles/LIMITED-RESOURCES.md).


// The spirit object first, as the global spirit (goal/G40.1).
require('../../../spirit.js');
const RELAY_APP = 'relay';
// Long enough for a relay across the Atlantic to answer, short enough
// that a box which is not there says so while somebody is still looking.
const WAIT_MS = 20000;

// THE NODE THROUGH THE ONE SPIRIT OBJECT (goal/G32.3, goal/G40.6): one verb by its name on this checkout's own node, its
// answer or its refusal's body; a node that does not answer says so.
function door(verb, args) {
  // A node family's verb (relay.search, peer.post): the family bound on the one spirit object (goal/G40.6).
  const dot = String(verb).indexOf('.');
  return spirit.outcome(spirit.require('spirit/' + String(verb).slice(0, dot) + '/api.js').then(function (fam) { return fam[String(verb).slice(dot + 1)](args); })).then(function (r) {
    if (!r || !r.status) throw new Error('the node of this checkout did not answer — start it');
    return r.body || {};
  });
}

// ── THE RELAYS THIS NODE OWNS ───────────────────────────────────────
//
// `relay.search` answers every relay this node holds a row on, with
// `owned` saying which of them this key may configure. A relay this node
// is merely a member of is listed and refused here rather than at the far
// end, so the reason arrives now instead of as a silent non-answer.
function relays(doorFn) {
  // relay.status is gone from the node: a list is a search (puppets/G2). relay.search answers one row per relay this
  // node holds, its label the row as the node paints it: url, owned, relayLabel and relayKey among it (hub.js relayRow).
  return (doorFn || door)('relay.search', { q: '' }).then(function (out) {
    if (out && out.ok === false) throw new Error('the node refused relay.search: ' + (out.error || out.code || JSON.stringify(out).slice(0, 200)));
    if (out && out.more) console.error('relayLimits: the node holds more relays than one answer carries; only the first are considered');
    return ((out && out.items) || []).map(function (item) {
      let row = {};
      try { row = JSON.parse(item.label) || {}; } catch (e) { row = {}; }
      return { url: String(row.url || item.key || ''), owned: !!row.owned, label: row.relayLabel || row.name || '', key: row.relayKey || '' };
    });
  });
}

function pick(rows, which) {
  const owned = rows.filter(function (r) { return r.owned && r.key; });
  if (!owned.length) throw new Error('this node owns no relay — nothing to configure');
  if (!which) {
    if (owned.length === 1) return owned[0];
    throw new Error('this node owns ' + owned.length + ' relays; name one: ' +
      owned.map(function (r) { return r.url; }).join(', '));
  }
  const hits = owned.filter(function (r) {
    return r.url.indexOf(which) !== -1 || (r.label && r.label.indexOf(which) !== -1);
  });
  if (hits.length === 1) return hits[0];
  if (!hits.length) throw new Error('no relay this node owns matches "' + which + '"');
  throw new Error('"' + which + '" matches ' + hits.length + ' of this node\'s relays');
}

// ── THE ANSWER COMES BACK ON THE POST ───────────────────────────────
//
// `peer.post` waits for the target's reply and hands it over as `text` —
// the correlation by hash, the receipt signature and the timeout are all
// peerPost's already (waiting[hash], onReply). A program listening on
// /api/events for its own answer would be a second, worse copy of that:
// the stream carries packets ARRIVING at this node, and an answer to a
// post this node made is settled before it would ever appear there.
//
// So this is one request. A relay that is down, or too busy, or running
// code without the verb, all come back here rather than as silence.
function askRelay(relay, verbBody, doorFn) {
  const packet = JSON.stringify({ app: RELAY_APP, v: 1, body: verbBody });
  return (doorFn || door)('peer.post', { to: relay.key, text: packet }).then(function (out) {
    if (!out || out.ok === false) {
      throw new Error('the post did not land: ' + (out && out.error ? out.error : JSON.stringify(out).slice(0, 200)));
    }
    if (typeof out.text !== 'string') {
      throw new Error('the relay took the post but said nothing back' +
        (out.receipt ? ' (it receipted it, so it is running and did not answer this verb)' : ''));
    }
    let answer = null;
    try {
      const back = JSON.parse(out.text);
      answer = back && back.body ? back.body : back;
    } catch (e) {
      throw new Error('the relay answered something this cannot read: ' + out.text.slice(0, 200));
    }
    // A RELAY THAT HAS NEVER HEARD OF THIS VERB says "no such peer" — the
    // fall-through answer in answerSelf for a body it has no branch for.
    // It is the one refusal worth translating, because it reads as a
    // routing failure and is in fact an old box.
    if (answer && answer.ok === false && answer.status === 404 && /no such peer/.test(answer.error || '')) {
      throw new Error(relay.url + ' does not know the config verb — it is running code older than ' +
        'cycle 9. Update it (./bash/update), then ./bash/install-units and ./bash/restart.');
    }
    return answer;
  });
}

// ── PRINTING, WHICH IS MOST OF WHAT THIS IS FOR ─────────────────────
function mb(n) {
  if (n === undefined || n === null) return '—';
  return n >= 1024 ? (n / 1024).toFixed(1) + ' GB' : n + ' MB';
}

function showRead(relay, a) {
  console.log(relay.url + (relay.label ? '  (' + relay.label + ')' : ''));
  console.log('');
  console.log('  configured   ' + mb(a.onFile.ramLimitMB) + ' RAM, ' + mb(a.onFile.discLimitMB) + ' disc   [' + a.source + ']');
  console.log('  running on   ' + mb(a.running.ramLimitMB) + ' RAM, ' + mb(a.running.discLimitMB) + ' disc' +
    (a.running.clamped ? '   ← CLAMPED: the box could not give what the file asks for' : ''));
  console.log('  allowance    ' + (a.running.allowance === null ? '—' : a.running.allowance.toLocaleString() + ' streams'));
  console.log('');
  console.log('  the roll     ' + a.roll.members + ' member(s), ' + a.roll.discUsedMB + ' MB used');
  console.log('');
  console.log('  the box      ' + mb(a.room.totalMB) + ' RAM total, ' + mb(a.room.availableMB) + ' available now');
  console.log('               ' + mb(a.room.discTotalMB) + ' disc total, ' + mb(a.room.discFreeMB) + ' free');
  console.log('  could give   up to ' + mb(a.room.ramMaxMB) + ' RAM (after a ' + mb(a.room.ramMarginMB) + ' margin)');
  console.log('               up to ' + mb(a.room.discMaxMB) + ' disc (after a ' + mb(a.room.discMarginMB) + ' margin)');
  if (a.room.wouldDefaultTo) {
    console.log('  would default to ' + mb(a.room.wouldDefaultTo.ramLimitMB) + ' RAM, ' +
      mb(a.room.wouldDefaultTo.discLimitMB) + ' disc on this box today');
  }
}

function showSet(relay, a) {
  console.log(relay.url);
  console.log('');
  console.log('  was   ' + mb(a.now.ramLimitMB) + ' RAM, ' + mb(a.now.discLimitMB) + ' disc   (' +
    a.now.allowance.toLocaleString() + ' streams, ' + a.now.members + ' member(s), ' + a.now.discUsedMB + ' MB used)');
  console.log('  now   ' + mb(a.after.ramLimitMB) + ' RAM, ' + mb(a.after.discLimitMB) + ' disc   (' +
    a.after.allowance.toLocaleString() + ' streams)');
  console.log('');
  if (a.restarting === true) {
    console.log('  restarting now — members were told to come back in 3s, and the process');
    console.log('  hands its working set back to the box on the way out');
  } else if (a.restarting === false) {
    console.log('  NOT RESTARTING: ' + a.restartRefused);
    console.log('  the figures above are written and apply whenever it next starts');
  } else {
    console.log('  NOT RESTARTING (--no-restart): nothing changes until it does.');
    console.log('  the figures above are written and apply whenever it next starts');
  }
}

function flags(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--restart') { out.restart = true; continue; }
    if (argv[i] === '--no-restart') { out['no-restart'] = true; continue; }
    if (argv[i].startsWith('--')) { out[argv[i].slice(2)] = argv[i + 1]; i += 1; continue; }
    out._.push(argv[i]);
  }
  return out;
}

function number(name, raw) {
  const n = Number(raw);
  if (!isFinite(n) || n <= 0) throw new Error('--' + name + ' wants a positive number of megabytes, got ' + JSON.stringify(raw));
  return n;
}

async function main() {
  const argv = process.argv.slice(2);
  const command = argv[0] || 'read';
  const f = flags(argv.slice(1));
  const which = f._[0] || '';

  if (command === 'list') {
    const rows = await relays();
    if (!rows.length) return console.log('this node is on no relay');
    rows.forEach(function (r) {
      console.log((r.owned ? 'owned  ' : 'member ') + r.url + (r.label ? '  (' + r.label + ')' : ''));
    });
    return;
  }

  const relay = pick(await relays(), which);

  if (command === 'read') {
    const a = await askRelay(relay, { config: {} });
    if (!a.ok) throw new Error(a.error || JSON.stringify(a));
    return showRead(relay, a);
  }

  if (command === 'set') {
    const ask = {};
    if (f.ram !== undefined) ask.ramLimitMB = number('ram', f.ram);
    if (f.disc !== undefined) ask.discLimitMB = number('disc', f.disc);
    if (ask.ramLimitMB === undefined && ask.discLimitMB === undefined) {
      throw new Error('set what? --ram <MB> and/or --disc <MB>');
    }
    // ── SETTING RESTARTS, UNLESS TOLD NOT TO ────────────────────────
    //
    //   Andy, 2026-09-22: "the reducing configuration should restart the
    //   relay, exactly to free up that RAM, that's why we do it after
    //   all, and the restart will have to happen sooner than later."
    //
    // The figures apply at the next start (relayConfig reads once at
    // boot), so a set without one is a change that has not happened yet —
    // and the restart is also what hands the process's working set back
    // to the box, which is the point of shrinking a relay at all.
    //
    // `--no-restart` is for the case where the owner wants the file
    // changed now and the outage at a moment of his choosing; the relay
    // verb itself stays explicit either way, so nothing restarts a box
    // because a program forgot to say.
    ask.restart = f['no-restart'] !== true;
    const a = await askRelay(relay, { config: ask });
    if (!a.ok) throw new Error(a.error || JSON.stringify(a));
    return showSet(relay, a);
  }

  console.log('usage: relayLimits.js list | read [<relay>] | set [<relay>] --ram <MB> --disc <MB> [--no-restart]');
  process.exitCode = 1;
}

// The suite drives the parts that decide, with the door injected: which
// relay a name picks, what the flags meant, and what a relay's answer is
// turned into. Nothing here needs a node, a relay or a network.
module.exports = {
  flags: flags,
  pick: pick,
  mb: mb,
  number: number,
  relays: relays,
  askRelay: askRelay,
};

// `require`d by the suite, run by a person or an agent — only the second
// should do anything.
if (require.main === module) {
  main().catch(function (e) {
    console.error(String(e && e.message ? e.message : e));
    process.exitCode = 1;
  });
}
