'use strict';

// spirit/test/labWorld.js
// A world to test against: one lab relay and up to three lab peers, real
// processes on real ports, built and torn down by the suite that wants
// them.
//
// Everything here is LOCAL, deliberately: in a lab the whole world is
// deletable, so a suite never leaves a resident on a live relay.
//
// See GAPS at the bottom. Every place this file reaches past the protocol
// and edits a file by hand is a thing the system cannot yet do, listed by
// name. The cheats are the to-do list.

const fs = require('fs');
const os = require('os');
const path = require('path');
const auth = require('../run/spirit/relayAuth');
const seal = require('../run/spirit/seal');
const nodeCard = require('../run/spirit/nodeCard');
// GAP 1 again: the node's own record of where it holds a seat.
const relayKeys = require('../run/spirit/relayKeys');
const buildStamp = require('../run/spirit/buildStamp');

const MASTER = require('./labMaster/labPaths').MASTER;
const FAKES_ROOT = require('./labMaster/labPaths').FIXTURE_ROOT;
const REPO_ROOT = path.join(__dirname, '..', '..');

// Prefixed so they can never be mistaken for — or delete — the nodes Andy
// keeps in labMaster by hand. This helper touches nothing it did not make.
const PREFIX = 'lw-';
// Ports inside labMaster's own 65400-65429 range, at the top end, away
// from where hand-made rows tend to land.
const RELAY_PORT = require('./labMaster/labPaths').labPort(25);
const PEER_PORTS = [26, 27, 28].map(require('./labMaster/labPaths').labPort);
// The owner NODE's port (apiAuth/G1.0): a world whose cases are decided
// at the owner's gate needs the gate running.
const OWNER_PORT = require('./labMaster/labPaths').labPort(29);
// How long a case waits before its outcome is 'silence'. Long enough for
// a relay round trip under harness load; a real answer arrives in well
// under a second.
const CASE_WAIT_MS = 8000;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// ONE PLACE A STREAM IS OPENED, for the relay's wire and a peer node's
// events alike (apiAuth/G1.0). One site, not two: oneDoor counts every
// raw reach in this file, and two streams opened in two places is one
// more site to watch for no more capability.
function openStream(url, stop, headers) {
  return fetch(url, { signal: stop.signal, headers: headers || {} }).catch(function () { return null; });
}

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
// failures for a control plane that was never running.
async function masterUp() {
  try {
    const r = await master('GET', '/api/nodes');
    return r.status === 200;
  } catch (e) { return false; }
}

// ONE OWNER OF STARTING labMaster: ensureMaster.js. build() clears
// leftovers with clear(), which never stops the labMaster. In a harness run, runAll starts labMaster before any lane and stops it
// after, so no suite owns it; a suite run alone starts and stops its own.
const lab = require('./labMaster/ensureMaster.js');

async function ensureMaster() {
  return lab.ensure();
}

function homeOf(id) {
  return path.join(FAKES_ROOT, id, 'spirit', 'run');
}

// A world has to start empty, and labMaster delivers one: create and
// recycle both clear the home before laying the tracked tree down, and
// delete takes the disk with it.
// `config` — a spirit/state/config.json to give the node before it runs
// (a relay's ramLimitMB, which sets its stream allowance).
//
// Written after the home exists and followed by a restart, because
// relayServer.js reads the file once at startup and both create and
// recycle have already started the process by the time we get it back.
async function ensureNode(name, type, port, config, ownerKey) {
  // labMaster slugs every id (slugName: lowercase, odd characters to
  // '-'), so the id asked back for must be the slug or a camel-cased
  // peer (the auth world's appPeer) creates one row and starts a 404.
  const id = (PREFIX + name).toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
  // `kind: 'fixture'` — a copy of the WORKING TREE under %TEMP%, not a
  // clone of origin/master under repo/lab.
  //
  // Both halves matter. A suite must test the code being written, so it
  // cannot run what is published; and `homeOf` below computes the home
  // from FIXTURE_ROOT for itself, so a node built anywhere else would
  // have its identity written into a directory nobody is running.
  //
  const made = await master('POST', '/api/nodes',
    { name: id, type: type, port: port, kind: 'fixture' });

  if (made.status === 409) {
    // Already in the table from an interrupted run. Recycle is the verb
    // that means "give me this node, new".
    const cycled = await master('POST', '/api/nodes/' + id + '/recycle');
    if (cycled.status !== 200) {
      return { ok: false, error: 'recycle ' + id + ': ' + JSON.stringify(cycled) };
    }
    await withConfig(id, config, ownerKey);
    return { ok: true, id: id, port: port, home: homeOf(id) };
  }

  if (made.status !== 201 && made.status !== 200) {
    return { ok: false, error: 'create ' + id + ': ' + JSON.stringify(made) };
  }

  const started = await master('POST', '/api/nodes/' + id + '/start');
  if (started.status !== 200) {
    return { ok: false, error: 'start ' + id + ': ' + JSON.stringify(started) };
  }
  await withConfig(id, config, ownerKey);
  return { ok: true, id: id, port: port, home: homeOf(id) };
}

// THE OWNER IS WRITTEN HERE, before the restart, the way bash/install-units
// writes it before a relay serves (goal/G16.8): a relay reads its owner once,
// at start, and no claim can make one.
async function withConfig(id, config, ownerKey) {
  if (!config && !ownerKey) return;
  const dir = path.join(homeOf(id), 'spirit', 'state');
  fs.mkdirSync(dir, { recursive: true });
  if (config) fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(config));
  if (ownerKey) auth.writeOwner(homeOf(id), ownerKey);
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

// ── A CLAIM IS A POST ON THE RELAY'S ONE DOOR (goal/G22.6) ──────────
//
// POST /api/relay/claim is closed (Andy's decision, goal/G22.6). A claim is
// a post from the claimer's key to the relay's, sealed to the relay's
// cipher key learnt from a card ask, answered on the post — as
// peerPost.claim does on a real node. `body` is the claim's body whole
// (name, publicKey, sig, card, invite, inviteLabel); the answer comes back
// in the shape the closed route gave, { ok, status, body }, so a suite
// reads it as it read that route.
async function claimOn(relayUrl, id, body) {
  const r = await require('./relayDoor').claimBodyOnDoor(relayUrl, id, body);
  return { ok: r.status >= 200 && r.status < 300, status: r.status, body: r.json };
}
function createWorld(opts) {
  opts = opts || {};
  // THE AUTH WORLD (apiAuth/G1.0): a scenario carrying servers, grants
  // and cases builds an owner NODE too, and runCases() asks its gate.
  const sc = opts.scenario ? require('./scenario').normalize(opts.scenario) : null;
  // NOT CLAMPED: a scenario with more peers than ports must not quietly
  // build fewer and report success. A lab has as many peers as it has ports. Wanting more than that is a
  // refusal with a reason, which build() gives below: the failure that
  // names itself beats the success that lies.
  const wanted = sc ? Math.max(1, sc.peers.length) : Math.max(1, opts.peers || 2);
  const names = sc ? sc.peers.map(function (p) { return p.name; }) : (opts.peerNames || null);

  let relay = null;
  let owner = null;
  let ownerNode = null;
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

    // Desk's folder is live data that Desk keeps writing (a new log chunk,
    // a voice file), tracked by Andy's ruling ("git everything in this
    // folder") but committed when he does. A fake node needs none of it.
    const missing = buildStamp.missingFromCopy(REPO_ROOT)
      .filter(function (f) { return f.indexOf('spirit/run/shell/desk/') !== 0; });
    if (missing.length) {
      return {
        ok: false,
        error: missing.length + ' untracked file(s) under spirit/ would not reach the ' +
          'fake nodes — `git add` them first:\n  ' + missing.join('\n  '),
      };
    }

    const up = await ensureMaster();
    // `foreign` is carried through rather than flattened: a caller needs
    // to tell a labMaster that will not start (a fault) from one that
    // belongs to another checkout (the machine's condition, and a
    // stand-down). Dropping the flag here would make every world-builder
    // go red for something the developer clears in one command.
    if (!up.ok) return { ok: false, error: up.error, foreign: !!up.foreign };

    // A WORLD STARTS EMPTY. Anything still standing from an interrupted
    // run holds a port this one wants, and the failure that produces
    // names the wrong thing entirely — a recycle that 404s, when the real
    // trouble is a different node sitting on the port.
    // clear(), not destroy(): leftovers go, the labMaster just ensured
    // stays (see ensureMaster above).
    await clear();

    // 128 MB: the relay's stream allowance is its configured RAM less its
    // own memory at rest (relay.js allowanceFor), so a small figure would
    // leave a lab relay no streams to give.
    // The owner is made first, because the install names him (goal/G16.8).
    owner = opts.owner || auth.generateIdentity('labowner');
    relay = await ensureNode('relay', 'relay', RELAY_PORT, { ramLimitMB: 128 }, owner.publicKey);
    if (!relay.ok) return relay;
    relay.url = 'http://127.0.0.1:' + RELAY_PORT;
    // READY WHEN IT ANSWERS A CARD ASK ON ITS ONE DOOR (goal/G22.6: the
    // relay's public routes are closed). A node files a relay under its key
    // (goal/G19.15), so the lab learns it once.
    const card = await require('./relayDoor').awaitRelayDoor(relay.url);
    if (!card) {
      return { ok: false, error: 'lab relay did not answer on ' + relay.url };
    }
    relay.key = card.relayPublicKey || '';

    // The relay's owner was written into its owner.json above, before it
    // started, as bash/install-units does (goal/G16.8); he now claims his
    // own box with no invite. Made here rather than borrowed from the work
    // node: a suite must not need Andy's key, and must never write to his
    // node's state.
    const ownerName = owner.name || 'labowner';
    const claimed = await claimOn(relay.url, owner, {
      name: ownerName,
      publicKey: owner.publicKey,
      sig: auth.sign(owner.privateKey, auth.claimMessage(ownerName)),
      // AND THE CARD (cycle 10, R5), as hub.signedClaim sends on a real
      // node: the relay seals its answers to the key on it, so an owner
      // enrolled without one can be told nothing.
      card: nodeCard.cardFrom(Object.assign({ name: ownerName }, owner)),
    });
    if (!claimed.ok) {
      return { ok: false, error: 'lab owner could not claim: ' +
        JSON.stringify(claimed.body) + ' — the relay was not installed for this owner' };
    }

    for (let i = 0; i < wanted; i += 1) {
      const name = (names && names[i]) || ('peer' + (i + 1));
      const node = await ensureNode(name, 'avatar', PEER_PORTS[i]);
      if (!node.ok) return node;

      const id = auth.generateIdentity(name);
      const minted = await askOn(relay.url, owner, { invite: { label: name, days: 1, token: '' } });
      if (!minted.ok) return { ok: false, error: 'mint ' + name + ': ' + minted.error };
      const token = minted.invite.token;
      // THE TOKEN AND THE WORD TRAVEL TOGETHER (R1). `inviteLabel`
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
      const joined = await claimOn(relay.url, id, {
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
      fs.mkdirSync(path.join(node.home, 'shell', 'natter'), { recursive: true });
      // The node's relay list is node.db's one table, keyed by relay key (goal/G19.15, goal/G40.11).
      relayKeys.list(node.home, relay.url, 'lab', relay.key);
      // AND THE SEAT. This lab claims by posting STRAIGHT AT the relay
      // above, which is the relay's half of a bind and not the node's: the
      // box gets a row and the node is never told. A node records its
      // memberships itself — Andy: "persist necessary information at claim
      // time, re-use that information on boot" — so a claim made AROUND a
      // node leaves it not knowing, and a world-builder has to write the
      // node's half as it writes every other file here (GAP 1).
      relayKeys.seat(node.home, relay.url, name);
      // THE AUTH WORLD'S PEERS KNOW THE OWNER (apiAuth/G1.0): the
      // owner's reply is an ordinary packet at the peer's own front
      // door, and a stranger's packet is dropped without a word — so a
      // peer that has not acquired the owner hears every answer as
      // silence. The card rides along for the sealed paths.
      if (sc) {
        const contactBook = require('../run/spirit/contacts.js');
        contactBook.acquire(node.home, { publicKey: owner.publicKey, publicLabel: ownerName }, 'invite');
        contactBook.setCard(node.home, owner.publicKey,
          nodeCard.cardFrom(Object.assign({ name: ownerName }, owner)), 'invite');
        contactBook.setMyLabel(node.home, owner.publicKey, ownerName);
      }
      // shell/natter/session.json, written for the Natter app. Natter is
      // gone (goal/G30.7) and nothing in the tree reads this file now: the
      // shell takes the node's name from node.card (spirit/client/shell.js),
      // so this write (and the mkdir of shell/natter above) is dead.
      fs.writeFileSync(
        path.join(node.home, 'shell', 'natter', 'session.json'),
        JSON.stringify({ label: name, boundAt: new Date().toISOString() }, null, 2)
      );
      // It has to be restarted to read what was just written to it.
      await master('POST', '/api/nodes/' + node.id + '/stop');
      await master('POST', '/api/nodes/' + node.id + '/start');

      peers.push({ name: name, id: id, node: node, url: 'http://127.0.0.1:' + node.port });
    }

    // ── THE OWNER'S OWN NODE (apiAuth/G1.0) ─────────────────────────
    //
    // The cases are decided at the owner's gate, so the owner stops being
    // a bare key and runs a node: its servers from the scenario, seeded
    // through their manifests' runs (goal/G30.20, the one way a node is told what it runs), its
    // peers made known through contacts.acquire (frontDoor's 'known' is
    // the acquired set, hub.js listenSet) — GAP 1's shape, but through
    // the product's own writers. The grants then go through
    // auth.grant on its loopback, never by writing node.db (Andy's
    // ruling under G1.5: configuring by file is the cheat).
    if (sc) {
      const node = await ensureNode('owner', 'avatar', OWNER_PORT);
      if (!node.ok) return node;
      const runsHome = require('./tools/runsHome.js');
      const contactBook = require('../run/spirit/contacts.js');
      auth.saveIdentity(node.home, owner);
      fs.mkdirSync(path.join(node.home, 'shell', 'natter'), { recursive: true });
      // The node's relay list is node.db's one table, keyed by relay key (goal/G19.15, goal/G40.11).
      relayKeys.list(node.home, relay.url, 'lab', relay.key);
      relayKeys.seat(node.home, relay.url, ownerName);
      fs.writeFileSync(
        path.join(node.home, 'shell', 'natter', 'session.json'),
        JSON.stringify({ label: ownerName, boundAt: new Date().toISOString() }, null, 2)
      );
      sc.servers.forEach(function (s) { runsHome(node.home, 'process/js/' + s); });
      peers.forEach(function (p) {
        contactBook.acquire(node.home, { publicKey: p.id.publicKey, publicLabel: p.name }, 'invite');
        contactBook.setCard(node.home, p.id.publicKey,
          nodeCard.cardFrom(Object.assign({ name: p.name }, p.id)), 'invite');
        contactBook.setMyLabel(node.home, p.id.publicKey, p.name);
      });
      await master('POST', '/api/nodes/' + node.id + '/stop');
      await master('POST', '/api/nodes/' + node.id + '/start');
      ownerNode = { id: node.id, port: OWNER_PORT, home: node.home, url: 'http://127.0.0.1:' + OWNER_PORT };
      if (!await answering(ownerNode.url + '/')) {
        return { ok: false, error: 'the owner node did not answer on ' + ownerNode.url };
      }
      // Its servers must be served before a grant can take their paths.
      let served = false;
      for (let n = 0; n < 100 && !served; n += 1) {
        await sleep(300);
        // The tree by the verb api on the flat apiDoor (goal/G30.6).
        const tree = await post(ownerNode.url + '/api/spirit', { call: 'api', args: {} });
        served = !!tree.body && sc.servers.every(function (s) {
          const branch = tree.body[s];
          return branch && typeof branch === 'object' && branch.ok !== false;
        });
      }
      if (!served) {
        return { ok: false, error: 'the owner node never served ' + sc.servers.join(', ') };
      }
      for (const p of sc.peers) {
        const row = peers.filter(function (x) { return x.name === p.name; })[0];
        for (const g of p.grants) {
          const made = await post(ownerNode.url + '/api/spirit',
            { call: 'auth.grant', args: { key: row.id.publicKey, path: g } });
          if (!made.ok) {
            return { ok: false, error: 'grant ' + p.name + ' ' + g + ': ' + JSON.stringify(made.body).slice(0, 160) };
          }
        }
      }
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

  // ASKING A RELAY ANYTHING NEEDS A STREAM. Decision 0010: mint, revoke,
  // remove-peer and set-device are all posts, and a relay answers a post
  // on the asker's stream rather than in the response.
  //
  // So this holds one for the length of one ask, as a real node does: the
  // lab owner is the one party here that has a key and no node to hold a
  // stream on its behalf.
  //
  // NOT A GAP, deliberately, and worth saying because the list at the
  // bottom is where cheats go: nothing here reaches past the protocol.
  // It speaks the protocol by hand because there is no node to speak it.
  async function askOn(relayUrl, ownerId, body) {
    // THE RELAY'S CARD, asked on its one door (goal/G22.6) — the owner is a
    // member, so this is no stranger's ask and the address table does not
    // hold it.
    const keyDoor = await require('./relayDoor').relayKeyOf(relayUrl);
    const relayKey = (keyDoor && keyDoor.relayPublicKey) || '';
    if (!relayKey) return { ok: false, error: 'the lab relay published no key' };

    // THE SIGNATURE IS A HEADER AND NEVER A QUERY STRING. A relay
    // REFUSES a query-string signature rather than ignoring it
    // (relay.streamSignatureFrom), because a URL ends up in logs,
    // referrers and history and a signature must not.
    const streamSig = auth.sign(ownerId.privateKey, auth.streamMessage(ownerId.publicKey, relayKey));
    const wire = relayUrl + '/api/relay/stream?key=' + encodeURIComponent(ownerId.publicKey);

    const stop = new AbortController();
    const opened = await openStream(wire, stop, { 'X-Spirit-Sig': streamSig });
    if (!opened || !opened.ok) {
      return { ok: false, error: 'lab owner could not open a stream: ' + (opened ? opened.status : 'no connection') };
    }

    // Read the stream until the reply to THIS hash arrives. Matched by
    // hash and not by "the next reply", because a roster and a presence
    // event arrive down the same pipe.
    // ── SEALED TO THE RELAY (cycle 10, R9) ──────────────────────────
    //
    // The box refuses an unsealed post addressed to itself, so the key it
    // publishes is the one its card answered above, verified there as a
    // signed statement (relayDoor.cardAsk). Sealed first, signed second
    // (cycle 10's R11).
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

  // One owner-signed removePeer post over the wire (decision 0010), so a
  // suite can clean up after itself on a relay whose disk it does not have.
  async function evictPeer(name) {
    const p = peers.filter(function (x) { return x.name === name; })[0];
    if (!p || !relay) return false;
    const done = await askOn(relay.url, owner, { removePeer: { key: p.id.publicKey } });
    return !!(done && done.ok);
  }

  // BY PATTERN, never from what this object happens to remember: a
  // teardown run in a fresh process has an empty peer list, and must still
  // delete the stale nodes holding the ports the next build wants.
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

  // ── ONE CASE AT THE OWNER'S GATE (apiAuth/G1.0) ────────────────────
  //
  // The peer's stream is opened BEFORE the post, so an answer quicker than the post's own
  // reply is not missed; the answer is the 'api' packet whose re is the
  // post's hash. The outcome speaks expect's vocabulary: a refusal by
  // its code, any other reply 'answered', no reply at all 'silence'.
  async function oneCase(p, ask) {
    const packet = require('../run/spirit/client/packet');
    const encoded = packet.encode('api', ask);
    if (!encoded.ok) return 'could not encode: ' + encoded.error;
    const stop = new AbortController();
    const opened = await openStream(p.url + '/api/events', stop);
    if (!opened || !opened.ok) return 'no stream on ' + p.name;
    let want = '';
    const early = [];
    const reading = (async function () {
      const reader = opened.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) return null;
        buf += dec.decode(chunk.value, { stream: true });
        const frames = buf.split('\n\n');
        buf = frames.pop();
        for (const frame of frames) {
          const ev = /^event: (.+)$/m.exec(frame);
          const da = /^data: (.+)$/m.exec(frame);
          if (!ev || ev[1] !== 'packet' || !da) continue;
          let msg; try { msg = JSON.parse(da[1]); } catch (e) { continue; }
          if (msg.from !== owner.publicKey) continue;
          let got; try { got = packet.decode(msg.text); } catch (e) { continue; }
          if (!got || got.app !== 'api' || !got.re) continue;
          if (!want) { early.push(got); continue; }
          if (got.re === want) return got.body;
        }
      }
    })().catch(function () { return null; });
    const sent = await post(p.url + '/api/spirit', { call: 'peer.post', args: { to: owner.publicKey, text: encoded.text } });
    if (!sent.ok || !sent.body || !sent.body.hash) {
      stop.abort();
      return 'not posted: ' + JSON.stringify(sent.body).slice(0, 100);
    }
    want = sent.body.hash;
    const hit = early.filter(function (g) { return g.re === want; })[0];
    const body = hit ? hit.body : await Promise.race([
      reading,
      sleep(CASE_WAIT_MS).then(function () { return undefined; }),
    ]);
    stop.abort();
    // undefined is the race timing out; null is the stream closing with
    // no answer. Both are a call nobody answered.
    if (body === undefined || body === null) return 'silence';
    if (body && body.ok === false && body.code) return 'refused ' + body.code;
    return 'answered';
  }

  // Every case of the scenario, in order, each from its own peer.
  async function runCases() {
    const out = [];
    if (!sc) return out;
    for (let i = 0; i < sc.cases.length; i += 1) {
      const c = sc.cases[i];
      const p = peers.filter(function (x) { return x.name === c.from; })[0];
      out.push({ index: i, outcome: p ? await oneCase(p, c.ask) : 'no peer named ' + c.from });
    }
    return out;
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
    // Asking the lab relay anything, as its owner: a post (decision 0010).
    askOn: askOn,
    // The auth world's half (apiAuth/G1.0): the owner's node, the cases
    // run at its gate, and teardown as the suites name it.
    ownerNode: function () { return ownerNode; },
    runCases: runCases,
    teardown: destroy,
  };
}

// ---------------------------------------------------------------------
// GAPS — what this helper does by hand, because the system cannot do it
// yet from outside a node.
//
// 1. A NODE CANNOT BE TOLD WHO IT IS, OR ITS SEAT ON A RELAY, from outside
//    itself. Its key exists from its first boot (goal/G22.5), named by the
//    machine; the name a person picks arrives with a claim. This helper
//    claims straight at the relay, then writes the fake node's identity,
//    its relay row and its seat into its home (auth.saveIdentity,
//    relayKeys.list, relayKeys.seat) and restarts it. Cost: the setup path
//    a real person takes (the node's own relay.claim) is never exercised
//    here, which is exactly where a first-run bug would live.
// ---------------------------------------------------------------------

// `claimOn` is exported for the lab suites that build their own claims
// (labRefusals, labPersistence, appServerWorlds). One claim site for the
// suites, on the relay's one door (goal/G22.6), for the same reason the
// product has one: two that differ in a detail is how the associated data
// gets dropped on one path.
module.exports = { createWorld: createWorld, PREFIX: PREFIX, claimOn: claimOn };
