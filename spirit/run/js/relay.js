'use strict';

const fs = require('fs');
const path = require('path');
const auth = require('./relayAuth');
const invites = require('./invites');
const relayConsole = require('./relayConsole');
// keysForName and the set-device bytes. The device slot's shape is one
// module's answer whether it is read here or on the personal node
// (DEVICE-CYCLE1.md).
const deviceAuth = require('./deviceAuth');
const deviceHandshake = require('./deviceHandshake');

var MAX_MESSAGES = 200;
var MAX_TEXT = 1024;
var NAME_RE = /^[A-Za-z0-9._-]{1,32}$/;
var CLAIM_PER_MIN = 10;
var SEND_PER_MIN = 30;
var WINDOW_MS = 60 * 1000;
var RATE_KEY_SWEEP_AT = 1000;

function stateFile(rootDir) {
  return path.join(rootDir, 'relay-state', 'mailbox.json');
}

function loadMailbox(rootDir) {
  try {
    var raw = fs.readFileSync(stateFile(rootDir), 'utf8');
    var parsed = JSON.parse(raw);
    var peers = Object.create(null);
    if (parsed && parsed.peers && typeof parsed.peers === 'object') {
      Object.keys(parsed.peers).forEach(function (k) {
        peers[k] = parsed.peers[k];
      });
    }
    return {
      peers: peers,
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      nextId: Number(parsed.nextId) > 0 ? Number(parsed.nextId) : 1,
    };
  } catch (e) {
    return { peers: Object.create(null), messages: [], nextId: 1 };
  }
}

function saveMailbox(rootDir, peers, messages, nextId) {
  fs.mkdirSync(path.dirname(stateFile(rootDir)), { recursive: true });
  fs.writeFileSync(stateFile(rootDir), JSON.stringify({
    nextId: nextId,
    peers: peers,
    messages: messages,
  }));
}

function createRelay(rootDir) {
  rootDir = rootDir || path.join(__dirname, '..');
  var loaded = loadMailbox(rootDir);
  var peers = loaded.peers;
  var messages = loaded.messages;
  var nextId = loaded.nextId;
  var allow = auth.loadAllow(rootDir);
  var claimHits = Object.create(null);
  var sendHits = Object.create(null);
  // Console messages are never stored, so they must not spend the ids
  // real mail is numbered with.
  var consoleSeq = 1;

  // One in-RAM slot for a browser trying to become this owner's device.
  // Nothing about it is persisted and nothing about it is checked here:
  // the relay holds the POST body and hands it to the personal node,
  // which owns the password and is the only thing that may compare it
  // (DEVICE-CYCLE2.md). A mailbox that could check the password could
  // also install a device without knowing one.
  // Defaults, deliberately: the wait and the rate limit are the module's
  // to state once. A test that needs a short wait builds its own queue.
  var deviceQueue = deviceHandshake.createQueue();

  function persist() {
    saveMailbox(rootDir, peers, messages, nextId);
  }

  function reloadAllow() {
    allow = auth.loadAllow(rootDir);
  }

  // Drops every key whose window has fully expired. Without this the
  // buckets only ever grew: one entry per distinct key, kept forever, on a
  // box with about a gigabyte of RAM.
  function sweep(bucket) {
    var now = Date.now();
    Object.keys(bucket).forEach(function (k) {
      var kept = bucket[k].filter(function (t) { return now - t < WINDOW_MS; });
      if (kept.length === 0) delete bucket[k];
      else bucket[k] = kept;
    });
  }

  // `key` is the CALLER, not the name the caller claims to be. Keying on
  // the claimed name made the limit meaningless: 30 sends per minute per
  // name, with the name chosen by the sender, is 30 per minute per made-up
  // string — rotate it and the budget resets, which is exactly what an
  // abuser does and never what a real client does. Peer-by-key moved the
  // send limit back onto `from`; it belongs on the socket. An unidentified
  // caller (a direct in-process call, no socket) shares one bucket rather
  // than getting a free pass.
  function rateOk(bucket, key, limit) {
    if (Object.keys(bucket).length > RATE_KEY_SWEEP_AT) sweep(bucket);
    var now = Date.now();
    var k = key || '(unidentified)';
    var list = (bucket[k] || []).filter(function (t) { return now - t < WINDOW_MS; });
    if (list.length >= limit) {
      bucket[k] = list;
      return false;
    }
    list.push(now);
    bucket[k] = list;
    return true;
  }

  function normalizeName(name) {
    if (typeof name !== 'string') return '';
    return name.trim();
  }

  function nameOk(n) {
    return !!n && NAME_RE.test(n);
  }

  function peerId(peer) {
    return (peer && peer.publicKey) || (peer && peer.name) || '';
  }

  function labelOf(peer) {
    return (peer && (peer.publicLabel || peer.name)) || '';
  }

  function listPeers() {
    return Object.keys(peers).map(function (k) { return peers[k]; });
  }

  function findByKey(publicKey) {
    if (!publicKey) return null;
    if (peers[publicKey]) return peers[publicKey];
    var list = listPeers();
    for (var i = 0; i < list.length; i++) {
      if (list[i].publicKey === publicKey) return list[i];
    }
    return null;
  }

  function findByLabel(label) {
    var n = normalizeName(label);
    var hits = listPeers().filter(function (p) { return labelOf(p) === n; });
    if (hits.length === 1) return hits[0];
    if (peers[n] && !peers[n].publicKey) return peers[n];
    return null;
  }

  function resolveParty(token) {
    var t = normalizeName(token);
    if (!t) return null;
    if (t === auth.RESERVED_NAME) {
      return { id: auth.RESERVED_NAME, label: auth.RESERVED_NAME, reserved: true };
    }
    var byKey = findByKey(t);
    if (byKey) {
      return { id: peerId(byKey), label: labelOf(byKey), peer: byKey };
    }
    var byLabel = findByLabel(t);
    if (byLabel) {
      return { id: peerId(byLabel), label: labelOf(byLabel), peer: byLabel };
    }
    var same = listPeers().filter(function (p) { return labelOf(p) === t; });
    if (same.length > 1) return { ambiguous: true, label: t };
    return null;
  }

  function who() {
    return listPeers().map(function (p) {
      return {
        name: labelOf(p),
        publicLabel: labelOf(p),
        publicKey: p.publicKey || null,
        claimedAt: p.claimedAt,
        owner: !!p.owner,
      };
    }).sort(function (a, b) {
      return String(a.publicLabel).localeCompare(String(b.publicLabel));
    });
  }

  // The mailbox's OWN key, not the owner's. `relay` is a caption — the
  // reserved word a message can be addressed to — and a caption is not
  // an identity: a node that keeps one file per peer cannot file the
  // mailbox anywhere without one (CYCLE-CHAT-5.1). The keypair is made
  // once, on the first --relay boot (server.js), and lives in this
  // process's own relay-state like any other identity.
  //
  // Public, deliberately: it names the mailbox the way a peer's key
  // names a peer, and it is the half that may be handed out.
  function mailboxPublicKey() {
    var id = auth.loadIdentity(rootDir);
    return (id && id.publicKey) || null;
  }

  function snapshot() {
    return {
      owner: auth.ownerName(allow),
      mode: allow.mode,
      reserved: auth.RESERVED_NAME,
      mailboxPublicKey: mailboxPublicKey(),
      peers: who(),
      messages: messages.length,
    };
  }

  function becomeOwner(name, publicKey) {
    auth.writeAllowKeys(rootDir, [{ name: name, publicKey: publicKey }]);
    reloadAllow();
  }

  function claim(name, sig, publicKey, clientKey, inviteToken) {
    var inviteRow = null;
    var n = normalizeName(name);
    if (!nameOk(n)) return { ok: false, status: 400, error: 'bad name' };
    if (n === auth.RESERVED_NAME) {
      return { ok: false, status: 400, error: 'name reserved' };
    }
    if (!rateOk(claimHits, clientKey, CLAIM_PER_MIN)) {
      return { ok: false, status: 429, error: 'too many claims' };
    }

    // pending-owner only means anything while the mailbox is empty: it
    // names who may take the FIRST claim. If peers are already on the box
    // there is no first claim left to reserve, so the file is stale — drop
    // it rather than leaving a mailbox where no name but the pending one
    // can ever be claimed again.
    var pending = auth.loadPendingOwner(rootDir);
    var empty = listPeers().length === 0;
    if (pending && !empty) {
      auth.clearPendingOwner(rootDir);
      pending = null;
    }
    var firstOwner = empty && !!(pending || allow.mode === 'open');
    if (pending && n !== pending) {
      return { ok: false, status: 403, error: 'name not allowed' };
    }

    if (firstOwner) {
      if (!publicKey || !sig) {
        return { ok: false, status: 400, error: 'first claim needs publicKey and sig' };
      }
      if (!auth.verify(publicKey, auth.claimMessage(n), sig)) {
        return { ok: false, status: 403, error: 'bad claim signature' };
      }
      becomeOwner(n, publicKey);
      auth.clearPendingOwner(rootDir);
    } else if (allow.mode === 'names') {
      var namesGate = auth.checkClaim(allow, n, sig);
      if (!namesGate.ok) {
        // An invite is the names-mode escape hatch: it is how the owner
        // lets someone in without SSH-editing allow.json. The INVITE's
        // error comes back, not the allow list's — "expired" and "not on
        // the list" are different problems and only the first is one the
        // claimer can do anything about. See INVITE-CYCLE1.md; keys-mode
        // does not require an invite yet (cycle 4).
        var invited = invites.match(rootDir, inviteToken, n);
        if (!invited.ok) return invited;
        inviteRow = invited.invite;
      }
      if (peers[n] || findByLabel(n)) {
        return { ok: false, status: 409, error: 'name already claimed', peer: peers[n] || findByLabel(n) };
      }
    } else if (allow.mode === 'keys') {
      if (!publicKey || !sig) {
        return { ok: false, status: 400, error: 'claim needs publicKey and sig' };
      }
      if (!auth.verify(publicKey, auth.claimMessage(n), sig)) {
        return { ok: false, status: 403, error: 'bad claim signature' };
      }
      // This is the lock 0003 promised: after first-claim-is-owner, a new
      // key gets on the box only with a live invite the owner minted for
      // that exact label. It is NOT the first owner's path — firstOwner
      // is handled above and needs no invite, because there is nobody to
      // invite them yet.
      //
      // Two johns is still two keys; it is now also two invites. The
      // label is not what is scarce, the token is.
      //
      // A key already in allow.json is not a NEW key — it is the owner,
      // and the owner is never someone the box has to be invited into.
      // Without this, a relay whose allow.json outlived its mailbox.json
      // (a restore, a lost peer record) locks its own owner out: no peer,
      // so no first-owner path, and no invite, because the only account
      // that can mint one is the one being refused.
      var allowed = allow.byName[n];
      if (!allowed || allowed !== publicKey) {
        if (!inviteToken) {
          return { ok: false, status: 403, error: 'invite required' };
        }
        var keysInvite = invites.match(rootDir, inviteToken, n);
        if (!keysInvite.ok) return keysInvite;
        inviteRow = keysInvite.invite;
      }
    } else {
      var gate = auth.checkClaim(allow, n, sig);
      if (!gate.ok) return gate;
    }

    if (publicKey && findByKey(publicKey)) {
      return { ok: false, status: 409, error: 'key already claimed', peer: findByKey(publicKey) };
    }
    if (!publicKey && (peers[n] || findByLabel(n))) {
      return { ok: false, status: 409, error: 'name already claimed', peer: peers[n] || findByLabel(n) };
    }

    // Consume BEFORE the write, and only write if the row actually
    // burned. The other order — persist the peer, then consume — leaves a
    // claimed name behind a still-live token whenever the write to
    // invites.json fails, which is the one failure a one-shot token
    // cannot survive. Everything that can refuse this claim has already
    // run, so a burn here is not spent on a claim that then 409s.
    if (inviteRow) {
      var burned = invites.consume(rootDir, inviteRow.token);
      if (!burned) {
        return { ok: false, status: 403, error: 'invite already used' };
      }
    }

    var peer = {
      name: n,
      publicLabel: n,
      publicKey: publicKey || null,
      claimedAt: new Date().toISOString(),
      owner: firstOwner,
    };
    peers[publicKey || n] = peer;
    persist();
    return { ok: true, status: 201, peer: peer, owner: firstOwner };
  }

  // allow.json is the authority on who the owner is; peer.owner is only
  // the record written at claim time.
  function isOwner(party) {
    var key = party && party.peer && party.peer.publicKey;
    if (!key) return false;
    var owner = auth.ownerName(allow);
    return !!owner && allow.byName[owner] === key;
  }

  // Minting is not checkOwner(): that verifies auth.statusMessage(name),
  // which says nothing about WHICH invite is being made. A signature that
  // could be replayed from a status request into "mint me a token for any
  // label, for any number of days" would not be a mint gate at all. The
  // owner signs the label and the duration, and that is what is verified.
  //
  // Note the shape this leaves until cycle 4: mint needs an owner key, so
  // it only works in keys mode, while an invite is only CONSUMED in names
  // mode. The two halves do not meet yet. See INVITE-CYCLE2.md.
  //
  // Cycle A2 adds the spoken token. It is optional and it is SIGNED: an
  // empty field still means "the relay picks the hex", and a signature
  // made over the two-argument message mints nothing but that hex. The
  // token is held to the same rules as a name because it is typed by one
  // human and read aloud to another, and because a token that could be
  // any string could be a path, a header, or a megabyte.
  function mint(ownerName, label, days, sig, token) {
    var owner = normalizeName(ownerName);
    var lbl = normalizeName(label);
    var tok = invites.normalizeToken(token);
    if (allow.mode !== 'keys') {
      return { ok: false, status: 403, error: 'no owner key on this relay' };
    }
    if (!nameOk(lbl)) return { ok: false, status: 400, error: 'bad label' };
    if (lbl === auth.RESERVED_NAME) {
      return { ok: false, status: 400, error: 'name reserved' };
    }
    if (tok && !nameOk(tok)) return { ok: false, status: 400, error: 'bad token' };
    var pub = owner && allow.byName[owner];
    if (!pub) return { ok: false, status: 403, error: 'not the owner' };
    if (!sig || !auth.verify(pub, invites.mintMessage(lbl, days, tok), sig)) {
      return { ok: false, status: 403, error: 'bad mint signature' };
    }
    var row = invites.add(rootDir, {
      label: lbl,
      days: days,
      token: tok,
      invitedBy: owner,
    });
    return {
      ok: true,
      status: 201,
      invite: {
        token: row.token,
        label: row.label,
        expiresAt: row.expiresAt,
        invitedBy: row.invitedBy,
      },
    };
  }

  // "I chat to my mailbox" is still the owner's affair. The gate has not
  // moved — it is the same isOwner() the census used, decided HERE and
  // handed to the console as a boolean, because a second owner check in
  // a second file is a second thing to get wrong. What a non-owner gets
  // is the console's own answer ("that one is the owner's"), never a
  // census.
  //
  // Neither message is pushed into `messages`: see the comment in send.
  // They carry the keys anyway, so the personal node can file them under
  // the right peer — a reply follows the sender's KEY, not their public
  // label, which is what a label-addressed reply could never do when two
  // peers share a caption.
  function consoleExchange(src, fromWire, text) {
    var senderKey = (src && src.peer && src.peer.publicKey) || null;
    var at = new Date().toISOString();
    var command = {
      id: 'console-' + (consoleSeq++),
      from: fromWire,
      to: auth.RESERVED_NAME,
      fromKey: senderKey,
      toKey: mailboxPublicKey(),
      text: text,
      sentAt: at,
    };

    var answer = relayConsole.handle(text, {
      isOwner: isOwner(src),
      snapshot: snapshot,
      peers: who,
      invites: function () { return invites.load(rootDir); },
      mailboxPublicKey: mailboxPublicKey,
      now: Date.now(),
      // The version this box is actually running answers "did my update
      // land?" without an SSH session.
      version: require('./kernel').core.const.VERSION,
      senderKey: senderKey,
      senderLabel: fromWire,
    });

    if (!answer || !answer.reply) {
      return { ok: true, status: 201, message: command };
    }

    return {
      ok: true,
      status: 201,
      message: command,
      consoleReply: {
        id: 'console-' + (consoleSeq++),
        from: auth.RESERVED_NAME,
        to: fromWire,
        fromKey: mailboxPublicKey(),
        toKey: senderKey,
        text: answer.reply,
        sentAt: new Date().toISOString(),
      },
    };
  }

  function send(from, to, text, sig, clientKey) {
    var fTok = normalizeName(from);
    var tTok = normalizeName(to);
    if (!fTok || !tTok) return { ok: false, status: 400, error: 'bad name' };
    if (typeof text !== 'string' || !text.trim()) {
      return { ok: false, status: 400, error: 'text required' };
    }
    if (text.length > MAX_TEXT) {
      return { ok: false, status: 400, error: 'text too long' };
    }
    if (!rateOk(sendHits, clientKey, SEND_PER_MIN)) {
      return { ok: false, status: 429, error: 'too many sends' };
    }

    var src = resolveParty(fTok);
    var dst = resolveParty(tTok);
    if (src && src.ambiguous) return { ok: false, status: 409, error: 'ambiguous from label' };
    if (dst && dst.ambiguous) return { ok: false, status: 409, error: 'ambiguous to label' };

    if (allow.mode === 'names') {
      var namesSend = auth.checkSend(allow, fTok, sig, tTok, text);
      if (!namesSend.ok) return namesSend;
    } else if (allow.mode === 'keys') {
      if (src && src.peer && src.peer.publicKey) {
        // The peer's own key, OR a device key standing for the same
        // name. Both, not just the device list: keysForName only ever
        // answers for the owner (allow.byName holds one row), so
        // replacing this key with that list would have taken every
        // ordinary peer's ability to send with it.
        //
        // A device is the owner on a handheld, so it signs as the owner
        // and the owner's row is what it speaks for. The device key
        // itself never reaches the wire — see fromKey below.
        var sendKeys = [src.peer.publicKey].concat(
          // B2: and this peer's own handheld. A device speaks for the row
          // it was installed on and for no other — it is not in the
          // allow list, so keysForName below would never find it.
          src.peer.devicePublicKey ? [src.peer.devicePublicKey] : [],
          deviceAuth.keysForName(allow, fTok).filter(function (k) {
            return k !== src.peer.publicKey;
          })
        );
        var sendProved = !!sig && sendKeys.some(function (pub) {
          return auth.verify(pub, auth.sendMessage(fTok, tTok, text), sig);
        });
        if (!sendProved) {
          return { ok: false, status: 403, error: 'bad send signature' };
        }
      } else {
        var ownerSend = auth.checkSend(allow, fTok, sig, tTok, text);
        if (!ownerSend.ok) return ownerSend;
      }
    } else {
      var openSend = auth.checkSend(allow, fTok, sig, tTok, text);
      if (!openSend.ok) return openSend;
    }

    var fromWire = (src && src.label) || fTok;
    var toWire = (dst && dst.label) || tTok;

    // A line addressed to the reserved name is a console command, not
    // mail, and every gate above has already run on it: the rate limit,
    // the signature, the allow list. What changes is where it goes.
    //
    // Nothing about this exchange is persisted. `messages` is a
    // 200-entry ring shared by every peer's undelivered mail, and a
    // console that wrote two entries per command would quietly evict the
    // oldest real thing anyone said — while the command itself could
    // never be read back by anybody, since inbox('relay') is refused for
    // everyone including the owner. So the answer rides home in this
    // response, and the personal node keeps whatever record it wants
    // (chat 5).
    if (tTok === auth.RESERVED_NAME || toWire === auth.RESERVED_NAME) {
      return consoleExchange(src, fromWire, text);
    }

    var msg = {
      id: String(nextId++),
      from: fromWire,
      to: toWire,
      fromKey: (src && src.peer && src.peer.publicKey) || null,
      toKey: (dst && dst.peer && dst.peer.publicKey) || null,
      text: text,
      sentAt: new Date().toISOString()
    };
    messages.push(msg);
    if (messages.length > MAX_MESSAGES) {
      messages = messages.slice(messages.length - MAX_MESSAGES);
    }
    persist();
    // fromKey is lifted out of the message as well as sitting inside it:
    // it is the answer to "whose line is this on the wire", and after the
    // device slot that is a question with a wrong answer available. It is
    // the HOUSE key whoever signed, because the peer row is what a line
    // is sent from and a device has no row. So a handheld is invisible to
    // everyone downstream — which is the point of a device being Andy
    // rather than a second person.
    return { ok: true, status: 201, message: msg, fromKey: msg.fromKey };
  }

  // `atMs` is the clock the signature window is measured against —
  // injected so a test can stand a minute either side of a signature
  // without sleeping through it.
  function inbox(name, sig, atMs) {
    var n = normalizeName(name);
    if (!n) return { ok: false, status: 400, error: 'name required' };
    var party = resolveParty(n);
    if (party && party.ambiguous) {
      return { ok: false, status: 409, error: 'ambiguous label' };
    }
    var label = (party && party.label) || n;
    var key = (party && party.peer && party.peer.publicKey) || null;
    // A peer that claimed with a key proves the read with that key. A
    // keyless one (open/names relay, or the reserved `relay` token) falls
    // back to the allow list, which in keys mode is the owner and nobody
    // else.
    var gate = key
      ? auth.checkInboxKey(key, n, sig, atMs)
      : auth.checkInbox(allow, n, sig, atMs);
    // Or this owner's device. Tried only after the peer row's own key has
    // failed, so the ordinary read costs nothing extra and the common
    // answer is unchanged.
    //
    // This is where cycle 1 stopped short: checkInbox learned about the
    // device slot, but a keys-mode peer always HAS a key, so the branch
    // that actually runs is checkInboxKey against the house key alone —
    // and a phone could own the box without reading its mail.
    //
    // Nothing about the FILTER moves. The messages handed back are still
    // the house row's, matched on its label and its key, because a device
    // has no row and nothing is addressed to it. It is reading Andy's
    // mail, not its own.
    if (!gate.ok && key) {
      // This row's own handheld first (B2), then the allow list's — a
      // peer's device is on the peer row and nowhere else, so
      // keysForName cannot see it. Tried only after the row key has
      // failed, so the ordinary read still costs one verify.
      var peerDevice = (party && party.peer && party.peer.devicePublicKey) || null;
      var deviceKeys = (peerDevice ? [peerDevice] : []).concat(
        deviceAuth.keysForName(allow, label)
      ).filter(function (k) {
        return k !== key;
      });
      if (deviceKeys.some(function (pub) { return auth.checkInboxKey(pub, n, sig, atMs).ok; })) {
        gate = { ok: true };
      }
    }
    if (!gate.ok) return gate;
    return {
      ok: true,
      status: 200,
      messages: messages.filter(function (m) {
        return m.to === n || m.to === label || (key && m.toKey === key);
      })
    };
  }

  function status(name, sig) {
    var n = normalizeName(name);
    var gate = auth.checkOwner(allow, n, sig);
    if (!gate.ok) return gate;
    return { ok: true, status: 200, report: snapshot() };
  }

  // Install (or replace) this owner's device key on the owner record.
  //
  // Signed by the HOUSE key, never by the current device: a device that
  // could name its successor would only have to be borrowed once. The
  // house key is the one thing that stays at home.
  //
  // The bytes are their own message (deviceAuth.setDeviceMessage), so a
  // captured `status` signature — which the owner makes constantly, for
  // every census — cannot be replayed as "install this key". That is
  // asserted in deviceInbox.js rather than left to reading.
  //
  // No peer row is written and no label is claimed. A second row wearing
  // `andy` would make resolveParty ambiguous and stop the owner's own
  // inbox resolving at all (design/reviews/2026-09-10-owner-devices.md).
  // B2: any identity installs its OWN device, proved with its OWN row
  // key. The owner still lands in allow.json; a peer lands on its row in
  // mailbox.json. Two rooms, one rule — nobody installs a key on a row
  // they cannot sign for.
  function setDevice(token, devicePublicKey, sig) {
    var who = deviceIdentity(token);
    if (!who) return { ok: false, status: 403, error: 'no such identity' };
    if (typeof devicePublicKey !== 'string' || !devicePublicKey) {
      return { ok: false, status: 400, error: 'devicePublicKey required' };
    }
    if (!sig || !auth.verify(who.publicKey, deviceAuth.setDeviceMessage(devicePublicKey), sig)) {
      return { ok: false, status: 403, error: 'bad set-device signature' };
    }

    if (!who.owner) {
      // One slot, and the next enrolment replaces the last — the same
      // rule the owner has had since cycle 5, and the thing that makes a
      // stolen password noticeable rather than silent.
      who.peer.devicePublicKey = devicePublicKey;
      persist();
      return { ok: true, status: 200 };
    }

    var n = who.label;

    // Every row rewritten, not just this one. In practice keys mode holds
    // exactly one — becomeOwner writes one and nothing else has ever
    // written this file — but allow.json is the file an operator edits by
    // hand on the box when all else fails, and a verb that silently drops
    // what it did not expect is a bad thing to point at a live VPS.
    var rows = Object.keys(allow.byName).map(function (rowName) {
      return {
        name: rowName,
        publicKey: allow.byName[rowName],
        devicePublicKey: rowName === n
          ? devicePublicKey
          : (allow.deviceByName && allow.deviceByName[rowName]) || null,
      };
    });
    auth.writeAllowKeys(rootDir, rows);
    reloadAllow();
    return { ok: true, status: 200 };
  }

  // What is waiting, and the answer to it. Both are the owner's, proved
  // with the HOUSE key and never with the device key: the slot holds a
  // password somebody is trying, so answering a device key would let a
  // borrowed phone read the credential that installs its successor.
  //
  // deviceTakeMessage has its own bytes for the same reason set-device
  // does — the owner signs `status` for every census, and a captured one
  // must not be replayable as "hand me what is pending".
  //
  // And it carries a minute now, checked ±1 the way an inbox read is: the
  // proof travels in a header rather than the query (server.js reuses
  // inboxSignatureFrom for that), and it dies on its own if it is written
  // down anyway. Both halves are needed — the header keeps it out of the
  // log, the minute makes the copy in yesterday's log worthless.
  // B2: ANY identity with a row, proved with that row's own key — not
  // the owner's house key. The row is selected by key first, so two peers
  // wearing the same label sign the same message bytes and each still
  // verifies only against their own row. The ambiguity disappears without
  // the signed message changing shape.
  //
  // Still never the DEVICE key: the slot holds a password somebody is
  // trying, so answering a device key would let a borrowed phone read the
  // credential that installs its successor.
  function deviceGate(token, sig) {
    var who = deviceIdentity(token);
    if (!who) return { ok: false, status: 403, error: 'no such identity' };
    // The label, not the id, because that is what the node signed —
    // deviceTakeMessage has always carried a name and nothing about B2
    // needs it to carry a key.
    if (!deviceAuth.deviceTakeSignatureOk(who.publicKey, who.label, sig)) {
      return { ok: false, status: 403, error: 'bad device-take signature' };
    }
    return { ok: true, who: who };
  }

  // WHO A DEVICE SLOT BELONGS TO. B1 keyed it by normalized label, which
  // is right while the owner is the only enroller — allow.json in keys
  // mode holds exactly one row and its label is unique. It does not
  // survive peers: labels duplicate on purpose ("two johns is still two
  // keys", at the claim path above), so a slot keyed by label cannot tell
  // two of them apart.
  //
  // So the id IS the public key, which is the unique thing. The label
  // stays a display name. This is the same answer PEER-DEVICES.md §5
  // reached for the URL, carried inward.
  //
  // A token may be either — a key resolves directly, a label only when it
  // is unambiguous. A duplicate label resolves to NOTHING, which is the
  // honest answer and the same one resolveParty gives the inbox.
  function deviceIdentity(token) {
    var t = String(token == null ? '' : token).trim();

    // The owner first, by label, because allow.json is the authority on
    // who the owner is and holds exactly one row.
    var ownerLabel = auth.ownerName(allow);
    if (ownerLabel) {
      var ownerKey = allow.byName && allow.byName[ownerLabel];
      if (ownerKey && (t === ownerKey || normalizeName(t) === ownerLabel)) {
        return { id: ownerKey, label: ownerLabel, publicKey: ownerKey, owner: true };
      }
    }
    if (!t) return null;

    var peer = findByKey(t) || findByLabel(t);
    if (!peer || !peer.publicKey) return null;
    return {
      id: peer.publicKey,
      label: labelOf(peer),
      publicKey: peer.publicKey,
      owner: false,
      peer: peer,
    };
  }

  // AN OMITTED TOKEN IS NOBODY. B1 resolved it to the owner so the bare
  // /device page kept working; B3 gave every page a key in its address
  // and Andy retired that page, which leaves this a way to enrol without
  // naming anyone — an implicit identity in a design whose whole point is
  // that identity is explicit. So it refuses, like any other token that
  // resolves to no row.
  function deviceIdentityOr(token) {
    return deviceIdentity(token);
  }

  function deviceOffer(token, password, devicePublicKey) {
    var who = deviceIdentityOr(token);
    if (!who) {
      return Promise.resolve({
        ok: false, status: 403, error: deviceHandshake.ERROR_NOT_NOW,
      });
    }
    return deviceQueue.offer(who.id, password, devicePublicKey);
  }

  function deviceTake(token) {
    var who = deviceIdentityOr(token);
    if (!who) return null;
    return deviceQueue.take(who.id);
  }

  function deviceReply(token, accepted) {
    var who = deviceIdentityOr(token);
    if (!who) {
      return { ok: false, status: 403, error: deviceHandshake.ERROR_NOT_NOW };
    }
    return deviceQueue.reply(who.id, !!accepted);
  }

  function devicePending(token, sig) {
    // A token this box does not know is refused before it touches the
    // queue at all — B1's rule, kept: `queueFor` mints a map entry on
    // first use, so reaching the bucket with arbitrary input would let a
    // stranger grow that map with ids they choose. B1 said this check
    // and deviceGate's cheap half should collapse into one here, and
    // they have: deviceIdentity IS the test, for the owner and every
    // peer alike.
    var who = deviceIdentity(token);
    if (!who) return { ok: false, status: 403, error: 'no such identity' };

    // THEN the bucket, and therefore still before any crypto. A known
    // identity with a bad signature costs three Ed25519 verifies, and
    // nothing limited how often a stranger could make the box do that —
    // the one unlimited crypto path on it. Per identity, so one node's
    // polling cannot spend another's allowance.
    if (!deviceQueue.pendingRateOk(who.id)) {
      return { ok: false, status: 429, error: deviceHandshake.ERROR_NOT_NOW };
    }

    var gate = deviceGate(token, sig);
    if (!gate.ok) return gate;
    // An empty object, not a refusal. "Nobody is waiting" is the ordinary
    // answer to a poll that runs while a window is open, and a 403 there
    // would make the quiet case indistinguishable from a credential that
    // has stopped working.
    return deviceQueue.take(who.id) || {};
  }

  function deviceAnswer(token, accepted, sig) {
    var gate = deviceGate(token, sig);
    if (!gate.ok) return gate;
    return deviceQueue.reply(gate.who.id, !!accepted);
  }

  return {
    claim: claim,
    who: who,
    mailboxPublicKey: mailboxPublicKey,
    send: send,
    inbox: inbox,
    status: status,
    mint: mint,
    snapshot: snapshot,
    setDevice: setDevice,
    // The held POST, and the two ends the personal node works: what is
    // waiting, and the answer. Nothing here reads the password — see the
    // queue's comment where it is created.
    deviceOffer: deviceOffer,
    deviceTake: deviceTake,
    deviceReply: deviceReply,
    // The same two ends, behind the owner's signature — this is what a
    // route may call. deviceTake / deviceReply above are in-process and
    // ungated, and stay that way for the tests that drive the queue
    // directly.
    devicePending: devicePending,
    deviceAnswer: deviceAnswer,
    // Does anybody here hold this key or label? Answers a LABEL, never a
    // key and never a device key — the routing layer needs to know an
    // identity exists and what to call it, and nothing more. Everything
    // it could return is already public at /api/relay/who.
    deviceIdentityPublic: function (token) {
      var who = deviceIdentity(token);
      return who ? { label: who.label, owner: !!who.owner } : null;
    },
  };
}

// Where the proof of a read is allowed to travel.
//
// A query string is written to every access log the request passes
// through — Caddy's on this box, and whatever sits in front of it — so a
// signature there is a read credential sitting in a log file. The signed
// bytes carry a minute now (relayAuth.inboxMessage), which makes a
// captured one expire; this is what stops it being written down at all.
//
// A request that still puts `sig` on the query is refused even when the
// header is perfectly good. Accepting it "just this once" is how a caller
// stays unfixed, and a signature that has been in a URL is already in a
// log whatever happens next. `name` may stay on the query: it is the
// mailbox being asked for, not the permission to read it.
//
// A function rather than four lines in the route, so a test can drive
// the decision itself instead of reading the source and hoping.
function inboxSignatureFrom(querySig, headers) {
  if (querySig) {
    return { ok: false, status: 403, error: 'inbox signature must be a header' };
  }
  var h = headers || {};
  return { ok: true, sig: h['x-spirit-sig'] || h['X-Spirit-Sig'] || '' };
}

module.exports = { createRelay: createRelay, inboxSignatureFrom: inboxSignatureFrom };
