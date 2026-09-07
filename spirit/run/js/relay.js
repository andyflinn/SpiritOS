'use strict';

const fs = require('fs');
const path = require('path');
const auth = require('./relayAuth');
const invites = require('./invites');

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

  function replyFromRelay(to, text) {
    var msg = {
      id: String(nextId++),
      from: auth.RESERVED_NAME,
      to: to,
      text: text,
      sentAt: new Date().toISOString()
    };
    messages.push(msg);
    if (messages.length > MAX_MESSAGES) {
      messages = messages.slice(messages.length - MAX_MESSAGES);
    }
    persist();
    return msg;
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
        if (!sig || !auth.verify(src.peer.publicKey, auth.sendMessage(fTok, tTok, text), sig)) {
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
    // "I chat to my mailbox" is the owner's affair. The reply is a census
    // — mode, owner, peer count, message count — and a stranger who
    // claimed a key on the box, or anyone poking at an address they just
    // acquired, does not get to enumerate it by sending one message.
    // Same rule as GET /api/relay/status, which is owner-signed.
    if ((toWire === auth.RESERVED_NAME || tTok === auth.RESERVED_NAME) && isOwner(src)) {
      var snap = snapshot();
      replyFromRelay(fromWire, 'relay status mode=' + snap.mode +
        ' owner=' + (snap.owner || '-') +
        ' peers=' + snap.peers.length +
        ' messages=' + snap.messages);
    }
    return { ok: true, status: 201, message: msg };
  }

  function inbox(name, sig) {
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
      ? auth.checkInboxKey(key, n, sig)
      : auth.checkInbox(allow, n, sig);
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

  return {
    claim: claim,
    who: who,
    mailboxPublicKey: mailboxPublicKey,
    send: send,
    inbox: inbox,
    status: status,
    mint: mint,
    snapshot: snapshot,
  };
}

module.exports = { createRelay: createRelay };
