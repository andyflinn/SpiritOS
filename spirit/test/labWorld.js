'use strict';

// spirit/test/labWorld.js
// A world to test against: one lab relay and up to three lab peers, real
// processes on real ports, built and torn down by the suite that wants
// them.
//
// Everything here is LOCAL, deliberately and for one reason: there is no
// verb anywhere that removes a peer from a relay. The owner console is
// `status peers search invites key version`, and relay.js never deletes
// from `peers` — mailbox.json only grows. So an invite issued on a live
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
const { spawn } = require('child_process');
const auth = require('../run/js/relayAuth');
const invites = require('../run/js/invites');
const buildStamp = require('../run/js/buildStamp');

const MASTER = 'http://127.0.0.1:65420';
const FAKES_ROOT = path.join(os.tmpdir(), 'spiritos-relay-fakes');
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

let startedMaster = null;

async function ensureMaster() {
  if (await masterUp()) return { ok: true, started: false };
  startedMaster = spawn(process.execPath, ['spirit/test/labMaster/labMaster.js'],
    { cwd: REPO_ROOT, stdio: 'ignore' });
  for (let n = 0; n < 20; n += 1) {
    await sleep(250);
    if (await masterUp()) return { ok: true, started: true };
  }
  return { ok: false, error: 'labMaster did not come up on 65420' };
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
async function ensureNode(name, type, port) {
  const id = PREFIX + name;
  const made = await master('POST', '/api/nodes', { name: id, type: type, port: port });

  if (made.status === 409) {
    // Already in the table from an interrupted run. Recycle is the verb
    // that means "give me this node, new" — and it does now.
    const cycled = await master('POST', '/api/nodes/' + id + '/recycle');
    if (cycled.status !== 200) {
      return { ok: false, error: 'recycle ' + id + ': ' + JSON.stringify(cycled) };
    }
    return { ok: true, id: id, port: port, home: homeOf(id) };
  }

  if (made.status !== 201 && made.status !== 200) {
    return { ok: false, error: 'create ' + id + ': ' + JSON.stringify(made) };
  }

  const started = await master('POST', '/api/nodes/' + id + '/start');
  if (started.status !== 200) {
    return { ok: false, error: 'start ' + id + ': ' + JSON.stringify(started) };
  }
  return { ok: true, id: id, port: port, home: homeOf(id) };
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

// opts: { peers: 1..3 }
function createWorld(opts) {
  opts = opts || {};
  const wanted = Math.max(1, Math.min(3, opts.peers || 2));

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

    relay = await ensureNode('relay', 'relay', RELAY_PORT);
    if (!relay.ok) return relay;
    relay.url = 'http://127.0.0.1:' + RELAY_PORT;
    if (!await answering(relay.url + '/api/relay/who')) {
      return { ok: false, error: 'lab relay did not answer on ' + relay.url };
    }

    // The relay's owner is whoever claims first. Made here rather than
    // borrowed from the work node: a suite must not need Andy's key, and
    // must never write to his node's state.
    owner = auth.generateIdentity('labowner');
    const claimed = await post(relay.url + '/api/relay/claim', {
      name: 'labowner',
      publicKey: owner.publicKey,
      sig: auth.sign(owner.privateKey, auth.claimMessage('labowner')),
    });
    if (!claimed.ok) {
      return { ok: false, error: 'lab owner could not claim: ' +
        JSON.stringify(claimed.body) + ' — the relay was not empty' };
    }

    for (let i = 0; i < wanted; i += 1) {
      const name = 'peer' + (i + 1);
      const node = await ensureNode(name, 'avatar', PEER_PORTS[i]);
      if (!node.ok) return node;

      const id = auth.generateIdentity(name);
      const minted = await post(relay.url + '/api/relay/invite', {
        name: 'labowner',
        label: name,
        days: 1,
        sig: auth.sign(owner.privateKey, invites.mintMessage(name, 1)),
      });
      const token = minted.body && minted.body.token;
      const joined = await post(relay.url + '/api/relay/claim', {
        name: name,
        publicKey: id.publicKey,
        sig: auth.sign(id.privateKey, auth.claimMessage(name)),
        invite: token,
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

  // GAP 2, CLOSED. This used to edit the relay's mailbox.json by hand and
  // restart it, because nothing removed a peer — it bypassed every gate,
  // needed the relay's disk, and was the single reason this helper could
  // never be pointed at a relay it did not own the filesystem of.
  //
  // Now it is one owner-signed request over the wire, which means these
  // suites can clean up after themselves anywhere.
  async function evictPeer(name) {
    const p = peers.filter(function (x) { return x.name === name; })[0];
    if (!p || !relay) return false;
    const done = await post(relay.url + '/api/relay/remove-peer', {
      name: 'labowner',
      key: p.id.publicKey,
      sig: auth.sign(owner.privateKey, auth.removePeerMessage(p.id.publicKey)),
    });
    return !!(done && done.ok);
  }

  async function destroy() {
    for (const p of peers) {
      await master('POST', '/api/nodes/' + p.node.id + '/delete');
    }
    if (relay) await master('POST', '/api/nodes/' + relay.id + '/delete');
    peers.length = 0;
    if (startedMaster) {
      try { startedMaster.kill(); } catch (e) { /* gone */ }
      startedMaster = null;
    }
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
