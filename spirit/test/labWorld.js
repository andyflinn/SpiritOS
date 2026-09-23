'use strict';

// spirit/test/labWorld.js
// A world to test against: one lab relay and up to three lab peers, real
// processes on real ports, built and torn down by the suite that wants
// them.
//
// Everything here is LOCAL, deliberately and for one reason: there is no
// verb anywhere that removes a peer from a relay. The owner console is
// `status peers search invites key version`, and relay.js never deletes
// from `peers` — the routing table only grows. So an invite issued on a live
// relay creates a resident permanently, visible in /api/relay/who, in
// Contacts, and in every presence roster. In a lab the whole world is
// deletable, so nothing has to be lived with.
//
// See GAPS at the bottom. Every place this file reaches past the protocol
// and edits a file by hand is a thing the system cannot yet do, listed by
// name — and each one, once built, makes this helper able to test more
// than it can today. The cheats are the to-do list.

const fs = require('fs');
const os = require('os');
const path = require('path');
const auth = require('../run/js/relayAuth');
const seal = require('../run/js/seal');
const nodeCard = require('../run/js/nodeCard');
const { relayRequest } = require('../run/js/relayRequest');
// GAP 1 again: the node's own record of where it holds a seat.
const relayKeys = require('../run/js/relayKeys');
const buildStamp = require('../run/js/buildStamp');

const MASTER = require('./labMaster/labPaths').MASTER;
const FAKES_ROOT = require('./labMaster/labPaths').FIXTURE_ROOT;
const REPO_ROOT = path.join(__dirname, '..', '..');

// Prefixed so they can never be mistaken for — or delete — the nodes Andy
// keeps in labMaster by hand. This helper touches nothing it did not make.
const PREFIX = 'lw-';
// Ports inside labMaster's own 65400-65429 range, at the top end, away
// from where hand-made rows tend to land.
const RELAY_PORT = 65425;
const PEER_PORTS = [65426, 65427, 65428];

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function master(method, pathname, body) {
  const res = await fetch(MASTER + pathname, {
    method: method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  let parsed = null;
  try { parsed = await res.json(); } catch (e) { parsed = null; }
  return { status: res.status, body: parsed };
}

// PROVE THE DEPENDENCY IS THERE BEFORE ASSERTING ANYTHING ABOUT IT. A
// suite that needs labMaster and does not check for it reports product
// failures for a control plane that was never running — which is the
// lesson presenceWire paid for with five false red lines.
async function masterUp() {
  try {
    const r = await master('GET', '/api/nodes');
    return r.status === 200;
  } catch (e) { return false; }
}

// ONE OWNER OF STARTING labMaster: ensureMaster.js. This file had its own
// copy, and its destroy() killed what that copy started — and build()
// calls destroy() to clear leftovers, so a world built with no labMaster
// running started one and killed it a moment later. It passed only where
// a labMaster was already up (always, on the Windows box it was written
// on); on a fresh Linux box liveFrontDoor failed every time (2026-09-19).
// In a harness run, runAll starts labMaster before any lane and stops it
// after, so no suite owns it; a suite run alone starts and stops its own.
const lab = require('./labMaster/ensureMaster.js');
const { mintOwnerInvite } = require('./ownerClaim');

async function ensureMaster() {
  return lab.ensure();
}

function homeOf(id) {
  return path.join(FAKES_ROOT, id, 'spirit', 'run');
}

// GAP 5, CLOSED. A world has to start empty, and labMaster now delivers
// one: create and recycle both clear the home before laying the tracked
// tree down, and delete takes the disk with it.
//
// This used to remove relay-state by hand between create and start,
// because a node created under a name that had been used before booted
// owned by the previous run's key and could not be claimed by the suite
// that had just asked for it.
// `config` — a relay-state/config.json to give the node before it runs.
// A relay has a Governor ONLY when it is handed one (relay.js:422), so
// without this a lab relay reports no levers at all and cycle 4's own
// verification step — "open the Relay Monitor, set a lever, watch the
// relay take it" — cannot be carried out on the lab at all.
//
// Written after the home exists and followed by a restart, because
// relayServer.js reads the file once at startup and both create and
// recycle have already started the process by the time we get it back.
async function ensureNode(name, type, port, config) {
  const id = PREFIX + name;
  // `kind: 'fixture'` — a copy of the WORKING TREE under %TEMP%, not a
  // clone of origin/master under repo/lab.
  //
  // Both halves matter. A suite must test the code being written, so it
  // cannot run what is published; and `homeOf` below computes the home
  // from FIXTURE_ROOT for itself, so a node built anywhere else would
  // have its identity written into a directory nobody is running.
  //
  // That is not hypothetical — it is what happened the day lab homes
  // moved to repo/lab, and it stayed invisible through a full green run
  // because labMaster is long-running and the suites were still talking
  // to the process started before the change.
  const made = await master('POST', '/api/nodes',
    { name: id, type: type, port: port, kind: 'fixture' });

  if (made.status === 409) {
    // Already in the table from an interrupted run. Recycle is the verb
    // that means "give me this node, new" — and it does now.
    const cycled = await master('POST', '/api/nodes/' + id + '/recycle');
    if (cycled.status !== 200) {
      return { ok: false, error: 'recycle ' + id + ': ' + JSON.stringify(cycled) };
    }
    await withConfig(id, config);
    return { ok: true, id: id, port: port, home: homeOf(id) };
  }

  if (made.status !== 201 && made.status !== 200) {
    return { ok: false, error: 'create ' + id + ': ' + JSON.stringify(made) };
  }

  const started = await master('POST', '/api/nodes/' + id + '/start');
  if (started.status !== 200) {
    return { ok: false, error: 'start ' + id + ': ' + JSON.stringify(started) };
  }
  await withConfig(id, config);
  return { ok: true, id: id, port: port, home: homeOf(id) };
}

async function withConfig(id, config) {
  if (!config) return;
  const dir = path.join(homeOf(id), 'relay-state');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(config));
  await master('POST', '/api/nodes/' + id + '/restart');
}

async function answering(url) {
  for (let n = 0; n < 30; n += 1) {
    await sleep(200);
    try {
      const res = await fetch(url);
      if (res.status < 500) return true;
    } catch (e) { /* not yet */ }
  }
  return false;
}

// opts: { peers: 1..3, owner, peerNames }
//
// `owner` lets a caller supply an existing identity to own the lab relay
// instead of one being made here — which is what lets Andy's own node own
// it, so the owner-only surfaces (invites, the device panel, the roll)
// are the ones he actually sees. His identity is READ, never written: the
// key that owns spirit.andyflinn.com lives in that file and regenerating
// it would cost him the relay he already has.
function createWorld(opts) {
  opts = opts || {};
  // NOT CLAMPED. It was `Math.min(PEER_PORTS.length, ...)`, so a scenario
  // with five peers built three and reported success — and the world
  // Andy then looked at was not the scenario he asked for, with nothing
  // anywhere saying so.
  //
  // A lab has as many peers as it has ports. Wanting more than that is a
  // refusal with a reason, which build() gives below: the failure that
  // names itself beats the success that lies.
  const wanted = Math.max(1, opts.peers || 2);
  const names = opts.peerNames || null;

  let relay = null;
  let owner = null;
  const peers = [];

  async function build() {
    // BEFORE ANYTHING ELSE, because everything after it would be a lie.
    // A fake node is built from `git ls-files`, which copies your edits
    // to tracked files but cannot copy a file that is not in the index.
    // A suite that runs anyway is testing a node with a hole in it and
    // will report the failure somewhere else entirely.
    //
    // `git add` is enough. A commit is not required.
    if (wanted > PEER_PORTS.length) {
      return {
        ok: false,
        error: 'this scenario wants ' + wanted + ' peers and the lab has ' +
          PEER_PORTS.length + ' ports (' + PEER_PORTS.join(', ') + '). Add ports to ' +
          'PEER_PORTS in labWorld.js, or look at a smaller scenario — building ' +
          PEER_PORTS.length + ' of them and calling it done would show you a ' +
          'different world than the one you asked for.',
      };
    }

    const missing = buildStamp.missingFromCopy(REPO_ROOT);
    if (missing.length) {
      return {
        ok: false,
        error: missing.length + ' untracked file(s) under spirit/ would not reach the ' +
          'fake nodes — `git add` them first:\n  ' + missing.join('\n  '),
      };
    }

    const up = await ensureMaster();
    if (!up.ok) return { ok: false, error: up.error };

    // A WORLD STARTS EMPTY. Anything still standing from an interrupted
    // run holds a port this one wants, and the failure that produces
    // names the wrong thing entirely — a recycle that 404s, when the real
    // trouble is a different node sitting on the port.
    // clear(), not destroy(): leftovers go, the labMaster just ensured
    // stays (see ensureMaster above).
    await clear();

    // 128 MB is chosen so the Governor HOLDS rather than fights. Heap on
    // a fresh relay is a fraction of it, which reads as "below LOW" and
    // creeps the lever gently upward — nothing is shed, and the owner's
    // own setting is the only thing that moves it sharply.
    //
    // A small number here is worse than none: at ramLimitMB 2 the heap is
    // ~400% of the bound, the lever pins to the floor, and every member
    // stream is closed on the first tick. That is the Governor working,
    // and it makes the world useless to look at.
    relay = await ensureNode('relay', 'relay', RELAY_PORT, { ramLimitMB: 128 });
    if (!relay.ok) return relay;
    relay.url = 'http://127.0.0.1:' + RELAY_PORT;
    if (!await answering(relay.url + '/api/relay/key')) {
      return { ok: false, error: 'lab relay did not answer on ' + relay.url };
    }

    // The relay's owner is the first claim presenting the owner invite
    // (cycle 3, Part B). Made here rather than borrowed from the work node:
    // a suite must not need Andy's key, and must never write to his node's
    // state. The invite is minted into the lab relay's own relay.db, in
    // process — lab relays never run install.js (NODE-AND-RELAY).
    owner = opts.owner || auth.generateIdentity('labowner');
    const ownerName = owner.name || 'labowner';
    const ownerInvite = mintOwnerInvite(relay.home, ownerName);
    const claimed = await post(relay.url + '/api/relay/claim', {
      name: ownerName,
      publicKey: owner.publicKey,
      sig: auth.sign(owner.privateKey, auth.claimMessage(ownerName)),
      invite: ownerInvite.token,
      inviteLabel: ownerName,
      // AND THE CARD (cycle 10, R5), as hub.signedClaim sends on a real
      // node: the relay seals its answers to the key on it, so an owner
      // enrolled without one can be told nothing.
      card: nodeCard.cardFrom(Object.assign({ name: ownerName }, owner)),
    });
    if (!claimed.ok) {
      return { ok: false, error: 'lab owner could not claim: ' +
        JSON.stringify(claimed.body) + ' — the relay was not empty' };
    }

    for (let i = 0; i < wanted; i += 1) {
      const name = (names && names[i]) || ('peer' + (i + 1));
      const node = await ensureNode(name, 'avatar', PEER_PORTS[i]);
      if (!node.ok) return node;

      const id = auth.generateIdentity(name);
      const minted = await askOn(relay.url, owner, { invite: { label: name, days: 1, token: '' } });
      if (!minted.ok) return { ok: false, error: 'mint ' + name + ': ' + minted.error };
      const token = minted.invite.token;
      // THE TOKEN AND THE WORD TRAVEL TOGETHER since R1. `inviteLabel`
      // is what the owner wrote on the invite — spoken down a phone,
      // matched at the far end, never stored — and the relay refuses a
      // token that arrives without one rather than falling back:
      //
      //   Andy: "i dislike a relay supporting stale nodes at this point
      //   the nodes should break rather than STILL having code on a
      //   relay that support old crap"
      //
      // This lab minted with `label: name` above, so the word IS the
      // name here. Sent explicitly all the same: they are two different
      // things that happen to match in a lab, and writing `name` twice
      // is what says so.
      const joined = await post(relay.url + '/api/relay/claim', {
        name: name,
        publicKey: id.publicKey,
        sig: auth.sign(id.privateKey, auth.claimMessage(name)),
        invite: token,
        inviteLabel: name,
        card: nodeCard.cardFrom(Object.assign({ name: name }, id)),
      });
      if (!joined.ok) {
        return { ok: false, error: 'join ' + name + ': ' + JSON.stringify(joined.body) };
      }

      // GAP 1 — see below. Written straight into the fake node's home,
      // because nothing exposes "configure this node's identity and
      // relays" from outside it.
      auth.saveIdentity(node.home, id);
      fs.mkdirSync(path.join(node.home, 'app', 'natter'), { recursive: true });
      fs.writeFileSync(
        path.join(node.home, 'app', 'natter', 'relays.json'),
        JSON.stringify([{ label: 'lab', url: relay.url }], null, 2)
      );
      // AND THE SEAT (2026-09-18). This lab claims by posting STRAIGHT AT
      // the relay above, which is the relay's half of a bind and not the
      // node's: the box gets a row and the node is never told.
      //
      // That was invisible while a node re-derived its memberships from
      // each relay's roll on every boot. It records them itself now —
      // Andy: "persist necessary information at claim time, re-use that
      // information on boot" — so a claim made AROUND a node leaves it
      // correctly not knowing, and a world-builder has to write the
      // node's half as it writes every other file here (GAP 1).
      relayKeys.seat(node.home, relay.url, name);
      // AND session.json, or the shell believes this node has no name.
      // firstRun() is decided by exactly one thing — a label in this file
      // — and an unbound node shows Natter alone and nothing else. So a
      // fake peer with a key, a claim and a relay still opened to a
      // one-app screen, because the file that says "I am somebody" was
      // never written. GAP 1 again: a node cannot be told who it is from
      // outside itself, so every file that means "bound" has to be
      // written by hand here.
      fs.writeFileSync(
        path.join(node.home, 'app', 'natter', 'session.json'),
        JSON.stringify({ label: name, boundAt: new Date().toISOString() }, null, 2)
      );
      // It has to be restarted to read what was just written to it.
      await master('POST', '/api/nodes/' + node.id + '/stop');
      await master('POST', '/api/nodes/' + node.id + '/start');

      peers.push({ name: name, id: id, node: node, url: 'http://127.0.0.1:' + node.port });
    }

    return { ok: true };
  }

  async function post(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    let parsed = null;
    try { parsed = await res.json(); } catch (e) { parsed = null; }
    return { ok: res.ok, status: res.status, body: parsed };
  }

  // ASKING A RELAY ANYTHING, WHICH NOW NEEDS A STREAM. Decision 0010
  // emptied the register — mint, revoke, remove-peer and set-device are
  // all posts — and a relay answers a post on the asker's stream rather
  // than in the response.
  //
  // So this holds one for the length of one mint. It is more code than
  // the old two-line POST and it is the honest amount — a real node does
  // exactly this, and the lab owner is the one party here that has a key
  // and no node to hold a stream on its behalf.
  //
  // NOT A GAP, deliberately, and worth saying because the list at the
  // bottom is where cheats go: nothing here reaches past the protocol.
  // It speaks the protocol by hand because there is no node to speak it.
  async function askOn(relayUrl, ownerId, body) {
    // The roll already carries it — no second endpoint, which is the
    // same reason answerRelay.relayKey reads it there on a real node.
    let relayKey = '';
    try {
      const said = await (await fetch(relayUrl + '/api/relay/key')).json();
      relayKey = (said && said.relayPublicKey) || '';
    } catch (e) { relayKey = ''; }
    if (!relayKey) return { ok: false, error: 'the lab relay published no key' };

    // THE SIGNATURE IS A HEADER AND NEVER A QUERY STRING. This sent it
    // as `&sig=` and had been getting a flat 403 for it — a relay
    // REFUSES a query-string signature rather than ignoring it
    // (relay.streamSignatureFrom), because a URL ends up in logs,
    // referrers and history and a signature must not.
    //
    // So every process-spawning test in this tree failed at "build the
    // lab" and had done since the stream grew that rule. Nothing in the
    // harness runs them, so nothing said so; STATE.md in labMaster/ is
    // where that was written down, and this is the fix it was waiting
    // for.
    const streamSig = auth.sign(ownerId.privateKey, auth.streamMessage(ownerId.publicKey));
    const wire = relayUrl + '/api/relay/stream?key=' + encodeURIComponent(ownerId.publicKey);

    const stop = new AbortController();
    const opened = await fetch(wire, {
      signal: stop.signal,
      headers: { 'X-Spirit-Sig': streamSig },
    });
    if (!opened.ok) {
      return { ok: false, error: 'lab owner could not open a stream: ' + opened.status };
    }

    // Read the stream until the reply to THIS hash arrives. Matched by
    // hash and not by "the next reply", because a roster and a presence
    // event arrive down the same pipe.
    // ── SEALED TO THE RELAY (cycle 10, R9) ──────────────────────────
    //
    // The box refuses an unsealed post addressed to itself, so the key it
    // publishes is fetched from the same signed door a node uses — over
    // the wire, because this lab talks to a real relay in another
    // process. Sealed first, signed second (cycle 10's R11).
    // Through the product's own transport rather than a bare `fetch`:
    // oneDoor.js counts raw fetches here and is right to, and this is a
    // door a NODE reaches for — so it should be reached the way a node
    // reaches it.
    const keyDoor = JSON.parse((await relayRequest(relayUrl, 'GET', '/api/relay/key', null)).text);
    if (!auth.relayKeySigned(keyDoor.relayPublicKey, keyDoor.relaySealKey,
      keyDoor.relayLabel, keyDoor.keySig)) {
      stop.abort();
      return { ok: false, error: 'that relay does not sign what it says its keys are' };
    }
    const wrapped = seal.seal(keyDoor.relaySealKey, ownerId.publicKey, relayKey,
      JSON.stringify({ app: 'relay', v: 1, body: body }));
    if (!wrapped) {
      stop.abort();
      return { ok: false, error: 'could not seal to that relay' };
    }
    const text = JSON.stringify(wrapped);
    const sig = auth.sign(ownerId.privateKey,
      auth.postMessage(ownerId.publicKey, relayKey, text));

    const reading = (async function () {
      const reader = opened.body.getReader();
      const decode = new TextDecoder();
      let buffered = '';
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) return null;
        buffered += decode.decode(chunk.value, { stream: true });
        const frames = buffered.split('\n\n');
        buffered = frames.pop();
        for (const frame of frames) {
          const ev = /^event: (.+)$/m.exec(frame);
          const da = /^data: (.+)$/m.exec(frame);
          if (!ev || ev[1] !== 'reply' || !da) continue;
          try {
            const said = JSON.parse(da[1]);
            // Opened: a relay seals its answers now (cycle 10, R5).
            const inner = seal.isSealed(said.text)
              ? JSON.parse((seal.open(ownerId.sealPrivateKey, relayKey, ownerId.publicKey, said.text) || {}).text || 'null')
              : JSON.parse(said.text);
            if (inner && inner.body) return inner.body;
          } catch (e) { /* not the frame we are waiting for */ }
        }
      }
    })().catch(function () { return null; });

    const sent = await post(relayUrl + '/api/relay/post', {
      from: ownerId.publicKey, to: relayKey, text: text, sig: sig,
    });
    if (!sent.ok) {
      stop.abort();
      return { ok: false, error: 'mint post refused: ' + JSON.stringify(sent.body) };
    }

    const answered = await Promise.race([
      reading,
      sleep(5000).then(function () { return null; }),
    ]);
    stop.abort();

    if (!answered || !answered.ok) {
      return { ok: false, error: 'the relay refused or did not answer: ' + JSON.stringify(answered) };
    }
    return answered;
  }

  // Going away and coming back, which is what presence is about. Real
  // processes, so a stop is a real socket death.
  async function stopPeer(name) {
    const p = peers.filter(function (x) { return x.name === name; })[0];
    if (!p) return false;
    await master('POST', '/api/nodes/' + p.node.id + '/stop');
    return true;
  }

  async function startPeer(name) {
    const p = peers.filter(function (x) { return x.name === name; })[0];
    if (!p) return false;
    await master('POST', '/api/nodes/' + p.node.id + '/start');
    return true;
  }

  // GAP 2, CLOSED. This used to edit the relay's routing table by hand and
  // restart it, because nothing removed a peer — it bypassed every gate,
  // needed the relay's disk, and was the single reason this helper could
  // never be pointed at a relay it did not own the filesystem of.
  //
  // Now it is one owner-signed POST over the wire, which means these
  // suites can clean up after themselves anywhere. The route it used is
  // gone (decision 0010) — both halves of remove-peer are packets.
  async function evictPeer(name) {
    const p = peers.filter(function (x) { return x.name === name; })[0];
    if (!p || !relay) return false;
    const done = await askOn(relay.url, owner, { removePeer: { key: p.id.publicKey } });
    return !!(done && done.ok);
  }

  // BY PATTERN, never from what this object happens to remember.
  //
  // It was the other way and that was worse than useless: a teardown run
  // in a fresh process had an empty peer list, deleted nothing, and
  // reported success — so the next build found stale nodes holding the
  // ports it wanted and failed with a message about something else
  // entirely.
  //
  // The `lw-` prefix is what makes this possible, and it is the same
  // reasoning as `lab-` on the live relay: a disposable thing should be
  // identifiable as disposable without anybody having kept a list.
  // Every lw-* node goes. labMaster stays.
  async function clear() {
    const listed = await master('GET', '/api/nodes');
    const rows = (listed.body && listed.body.nodes) || [];
    for (const row of rows) {
      if (String(row.id || '').indexOf(PREFIX) !== 0) continue;
      await master('POST', '/api/nodes/' + row.id + '/delete');
    }
    peers.length = 0;
  }

  // The final teardown: the nodes, and labMaster too if THIS process
  // started it (ensureMaster.stop is a no-op otherwise).
  async function destroy() {
    await clear();
    lab.stop();
  }

  return {
    build: build,
    destroy: destroy,
    relay: function () { return relay; },
    owner: function () { return owner; },
    peers: function () { return peers.slice(); },
    peer: function (name) {
      return peers.filter(function (x) { return x.name === name; })[0] || null;
    },
    stopPeer: stopPeer,
    startPeer: startPeer,
    evictPeer: evictPeer,
    // Asking the lab relay anything, as its owner. The only way to ask a
    // relay anything since decision 0010 emptied the register.
    askOn: askOn,
  };
}

// ---------------------------------------------------------------------
// GAPS — what this helper does by hand, because the system cannot do it
// yet. Each is a feature request with a test already waiting for it.
//
// 1. A NODE CANNOT BE TOLD WHO IT IS OR WHICH RELAYS IT USES, from
//    outside itself. Identity lands via a first claim made in the
//    browser, and relays.json is written by Natter. So this helper
//    writes both files into a fake node's home and restarts it. Cost:
//    the setup path a real person takes is never exercised by any test,
//    which is exactly where a first-run bug would live.
//
// 2. CLOSED — `remove-peer`, owner-signed or self-signed, by key. It
//    takes their mail with them and revokes a live invite for their
//    label, because un-inviting that leaves the token working is a lie.
//    Expired invites are swept at the same moment, which was the other
//    half of "the box can only accumulate".
//
//    What it unlocked, which is the point of writing gaps down: a suite
//    can now clean up after itself on a relay whose disk it does not
//    have. Observation-only on a live relay was never a principle — it
//    was a consequence of this missing.
//
// 5. CLOSED — create and recycle clear the home first, delete takes the
//    disk with it, and the one rm is guarded three ways: the id must be
//    a slug, the resolved path must be strictly inside the fakes root,
//    and it must not be the work home.
//
//    Found by building this helper rather than by reading anything: a
//    second run of the same suite could not claim its own relay, because
//    "delete" had never deleted.
//
// 3. CLOSED — `GET /api/version`, public, answering the commit the
//    PROCESS loaded rather than whatever is on disk now. labMaster
//    stamps every copy it makes, so a fake node reports the commit it
//    was taken from, and a suite can assert "the box under test is
//    running the code under test" instead of hoping.
//
//    The owner console's `version` word carries it too, so the question
//    can also be asked from Relay Chat without any script at all.
//
// 4. THERE IS NO WAY TO MAKE A NODE FORGET A RELAY, or to remove a row
//    from relays.json, other than the Natter UI. Same shape as 1.
// ---------------------------------------------------------------------

module.exports = { createWorld: createWorld, PREFIX: PREFIX };
