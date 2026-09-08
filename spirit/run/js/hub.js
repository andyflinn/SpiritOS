'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');
const auth = require('./relayAuth');
const invites = require('./invites');
const ownerBadge = require('./ownerBadge');
const whoBook = require('./whoBook');

function isLoopbackHost(hostname) {
  var h = String(hostname || '').toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1';
}

function assertRelayUrl(relayUrl) {
  var target;
  try { target = new URL(relayUrl); }
  catch (e) { throw new Error('bad relay url'); }
  if (target.protocol === 'https:') return target;
  if (target.protocol === 'http:' && isLoopbackHost(target.hostname)) return target;
  throw new Error('relay url must be https (loopback http is allowed for lab relays)');
}

// The invite is forwarded, never minted here — a token this node made up
// would not be in the relay's invites.json. Minting is cycle 2.
function signedClaim(rootDir, name, invite) {
  const id = auth.ensureIdentity(rootDir, name);
  const body = {
    name: name,
    publicKey: id.publicKey,
    sig: auth.sign(id.privateKey, auth.claimMessage(name)),
  };
  if (invite) body.invite = invite;
  return body;
}

function signedSend(rootDir, from, to, text) {
  const id = auth.ensureIdentity(rootDir, from);
  const body = { from: from, to: to, text: text };
  if (id && id.privateKey) {
    body.sig = auth.sign(id.privateKey, auth.sendMessage(from, to, text));
  }
  return body;
}

// "Is the peer in this claim response us?" — the browser has no key of its
// own, so the node answers it here. A 409 on a name someone else holds is
// not a session; a 409 on our own key is.
function markMine(rootDir, text) {
  var id = auth.loadIdentity(rootDir);
  var parsed;
  try { parsed = JSON.parse(text); }
  catch (e) { return text; }
  if (!parsed || typeof parsed !== 'object') return text;
  var peer = parsed.peer || parsed;
  parsed.mine = !!(id && id.publicKey && peer && peer.publicKey === id.publicKey);
  return JSON.stringify(parsed);
}

// Claim, send and inbox still speak to the first Natter row: one browser,
// one session, one mailbox at a time. Minting is the call that had to stop
// doing that — see handleInvite.
function loadRelayUrl(rootDir) {
  var urls = ownerBadge.configuredUrls(rootDir);
  return urls.length ? urls[0] : null;
}

function relayRequest(relayUrl, method, pathname, bodyObj) {
  return new Promise(function (resolve, reject) {
    var target;
    try { target = assertRelayUrl(relayUrl + pathname); }
    catch (e) { reject(e); return; }
    var payload = bodyObj == null ? '' : JSON.stringify(bodyObj);
    var lib = target.protocol === 'https:' ? https : http;
    var req = lib.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      path: target.pathname + target.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Host': target.host
      }
    }, function (res) {
      var chunks = '';
      res.on('data', function (c) { chunks += c; });
      res.on('end', function () {
        resolve({ status: res.statusCode, text: chunks });
      });
    });
    req.on('error', reject);
    req.end(payload);
  });
}

// The people list behind Relay Chat's To control (CYCLE-CONTACTS-IMPL).
//
// CONTACTS, not the census. Everyone who ever claimed on a public
// mailbox is in `who`; that is a fact about the mailbox, not an address
// book, and a To list built from it means "everyone who exists" — which
// is how a friend picks a stranger's john. So the list is whoBook rows
// this node actually acquired: somebody wrote to it, or consumed an
// invite it minted, or a human confirmed the key out of band.
//
// A peer is a KEY. Two johns are two contacts and stay two rows; the
// caption is this node's own (myLabel where it has one) and never
// decides identity.
//
// The census is still walked, because it is what keeps a contact's
// public caption and its routes current — but handshake only ever
// updates, never promotes. Nobody enters the To list by appearing on a
// mailbox.
function buildPeople(rootDir, peers, relayUrl) {
  var census = Object.create(null);
  (Array.isArray(peers) ? peers : [])
    .filter(function (p) { return p && p.publicKey; })
    .forEach(function (p) {
      whoBook.handshake(rootDir, {
        publicKey: p.publicKey,
        publicLabel: p.publicLabel || p.name || '',
        relay: relayUrl,
      });
      census[p.publicKey] = p;
    });

  var id = auth.loadIdentity(rootDir);
  var myKey = (id && id.publicKey) || '';

  var rows = whoBook.contacts(rootDir)
    // No self row. Claiming a name is not meeting somebody, and a list
    // of people to write to that opens with yourself reads as a mistake.
    .filter(function (row) { return row.publicKey !== myKey; })
    .map(function (row) {
      var seen = census[row.publicKey];
      return {
        publicKey: row.publicKey,
        publicLabel: (seen && (seen.publicLabel || seen.name)) || row.publicLabel || '',
        caption: whoBook.labelForKey(rootDir, row.publicKey, row.publicLabel || ''),
        acquiredVia: whoBook.acquiredVia(row),
        // Whether this contact is on the mailbox this node is pointed at
        // right now. A contact you acquired elsewhere is still a contact;
        // it just has nowhere to be written to from here.
        onMailbox: !!seen,
        owner: !!(seen && seen.owner),
      };
    });

  // When two rows would read the same — two johns, neither renamed yet —
  // the caption carries a piece of the key. The TAIL: every Ed25519 SPKI
  // key opens with the same ASN.1 header, so a fragment from the front
  // would distinguish nothing.
  var seenCaption = Object.create(null);
  rows.forEach(function (r) { seenCaption[r.caption] = (seenCaption[r.caption] || 0) + 1; });
  rows.forEach(function (r) {
    if (seenCaption[r.caption] > 1) {
      r.caption = r.caption + ' (' + keyTail(r.publicKey) + ')';
      r.ambiguous = true;
    }
  });

  rows.sort(function (a, b) { return String(a.caption).localeCompare(String(b.caption)); });
  return rows;
}

// The end of a key, for a human to read down a telephone. From the END
// on purpose: every Ed25519 SPKI key opens with the same ASN.1 header,
// so a fragment from the front names every peer on every mailbox
// equally. Six characters is what buildPeople already uses to tell two
// johns apart, and relayConsole uses the same rule from its own copy.
function keyTail(publicKey) {
  return String(publicKey || '').slice(-6);
}

// Every peer on the mailbox whose PUBLIC LABEL is the handle a human
// heard. Not a search: an exact caption, case-insensitively, because a
// handle is a word somebody said out loud and a substring match would
// hand back strangers who merely contain it.
//
// Two johns are two candidates, and stay two. Nothing here picks one:
// picking is the human's job, done against a key tail on a phone call,
// which is what makes this an acquisition rather than a guess.
function handleMatches(rootDir, peers, handle) {
  var want = String(handle || '').trim().toLowerCase();
  if (!want) return [];
  var id = auth.loadIdentity(rootDir);
  var myKey = (id && id.publicKey) || '';

  return (Array.isArray(peers) ? peers : [])
    .filter(function (p) { return p && p.publicKey && p.publicKey !== myKey; })
    .filter(function (p) {
      return String(p.publicLabel || p.name || '').trim().toLowerCase() === want;
    })
    .map(function (p) {
      var row = whoBook.byPublicKey(rootDir, p.publicKey);
      return {
        publicKey: p.publicKey,
        publicLabel: p.publicLabel || p.name || '',
        tail: keyTail(p.publicKey),
        // What this node already thinks of them, so the UI can say
        // "already a contact" instead of offering the same person twice.
        acquiredVia: row ? whoBook.acquiredVia(row) : null,
        owner: !!p.owner,
      };
    });
}

// Somebody wrote to this node, and the mailbox carried their key. That
// is how a stranger becomes someone you can answer.
//
// Weak on purpose: anyone the mailbox admits can write, so this proves a
// key exists and is reachable, not that it belongs to the person you
// think. It is enough to reply to, and Add-by-handle (cut 2) upgrades
// the same row rather than making a second one. It never downgrades a
// row acquired more strongly, and it never files this node's own key.
function acquireFromInbox(rootDir, messages, relayUrl) {
  var id = auth.loadIdentity(rootDir);
  var myKey = (id && id.publicKey) || '';
  (Array.isArray(messages) ? messages : []).forEach(function (m) {
    if (!m || !m.fromKey || m.fromKey === myKey) return;
    whoBook.acquire(rootDir, {
      publicKey: m.fromKey,
      publicLabel: m.from || '',
      relay: relayUrl,
    }, 'message');
  });
}

function createHub(rootDir) {
  function fail(res, status, msg) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: msg }));
  }

  function withRelay(res, fn) {
    var url = loadRelayUrl(rootDir);
    if (!url) {
      fail(res, 503, 'no relay url in app/natter/relays.json');
      return;
    }
    try { assertRelayUrl(url); }
    catch (e) {
      fail(res, 503, String(e.message || e));
      return;
    }
    fn(url);
  }

  // The mailbox a mint is aimed at. Same scheme check withRelay does, so
  // a plain-http row in Natter is refused here rather than at the socket.
  function withChosenRelay(res, wanted, fn) {
    var chosen = ownerBadge.chooseUrl(ownerBadge.configuredUrls(rootDir), wanted);
    if (!chosen.ok) {
      fail(res, chosen.status, chosen.error);
      return;
    }
    try { assertRelayUrl(chosen.url); }
    catch (e) {
      fail(res, 503, String(e.message || e));
      return;
    }
    fn(chosen.url);
  }

  function handleClaim(req, res, readJsonBody) {
    readJsonBody(req).then(function (body) {
      withRelay(res, function (url) {
        relayRequest(url, 'POST', '/api/relay/claim', signedClaim(
          rootDir,
          body && body.name,
          body && body.invite
        ))
          .then(function (r) {
            res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(markMine(rootDir, r.text));
          })
          .catch(function (err) { fail(res, 502, String(err.message || err)); });
      });
    }).catch(function () {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Invalid JSON body');
    });
  }

  function handleSend(req, res, readJsonBody) {
    readJsonBody(req).then(function (body) {
      withRelay(res, function (url) {
        relayRequest(url, 'POST', '/api/relay/send', signedSend(
          rootDir,
          body && body.from,
          body && body.to,
          body && body.text
        ))
          .then(function (r) {
            res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(r.text);
          })
          .catch(function (err) { fail(res, 502, String(err.message || err)); });
      });
    }).catch(function () {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Invalid JSON body');
    });
  }

  // The token is the relay's to generate, never this node's: a token
  // invented here would not be in the relay's invites.json and would
  // refuse the very claim it was made for. All the hub contributes is the
  // owner's name and a signature over the label and duration it is asking
  // for. The relay is what mints.
  //
  // Which mailbox is the caller's to say, not relays.json[0]'s to assume.
  // A node may own several; minting on the first one listed would put the
  // token on a mailbox the friend was never being invited to, and the
  // owner would not find out until the claim failed somewhere else.
  function handleInvite(req, res, readJsonBody) {
    readJsonBody(req).then(function (body) {
      withChosenRelay(res, body && body.url, function (url) {
        var id = auth.loadIdentity(rootDir);
        if (!id || !id.privateKey) {
          fail(res, 403, 'no identity on this node');
          return;
        }
        var label = (body && body.label) || '';
        var days = body && body.days;
        // The spoken token, when Andy typed one, is part of what is
        // signed — not a field bolted on beside the signature. Empty
        // still means the relay picks the hex, and signs as it did
        // before A2.
        var token = invites.normalizeToken(body && body.token);
        relayRequest(url, 'POST', '/api/relay/invite', {
          name: (body && body.name) || id.name,
          label: label,
          days: days,
          token: token,
          sig: auth.sign(id.privateKey, invites.mintMessage(label, days, token)),
        })
          .then(function (r) {
            res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(r.text);
          })
          .catch(function (err) { fail(res, 502, String(err.message || err)); });
      });
    }).catch(function () {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Invalid JSON body');
    });
  }

  function handleInbox(req, res, urlObj) {
    withRelay(res, function (url) {
      var name = urlObj.searchParams.get('name') || '';
      // Signed for the same reason claim and send are: in keys mode the
      // relay proves who is READING a mailbox, not just who is writing to
      // one. Unsigned when this node has no identity yet, which the relay
      // still accepts in open and names mode.
      var id = auth.loadIdentity(rootDir);
      var query = '?name=' + encodeURIComponent(name);
      if (id && id.privateKey) {
        query += '&sig=' + encodeURIComponent(auth.sign(id.privateKey, auth.inboxMessage(name)));
      }
      relayRequest(url, 'GET', '/api/relay/inbox' + query, null)
        .then(function (r) {
          // Reading your mail is also how you come to know who wrote it.
          // Done here rather than in the app: it is a fact about this
          // node's address book, and the browser is a view of it.
          if (r.status === 200) {
            var parsed = null;
            try { parsed = JSON.parse(r.text); }
            catch (e) { parsed = null; }
            if (parsed && Array.isArray(parsed.messages)) {
              acquireFromInbox(rootDir, parsed.messages, url);
            }
          }
          res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(r.text);
        })
        .catch(function (err) { fail(res, 502, String(err.message || err)); });
    });
  }

  // GET /api/hub/who — the mailbox's peers, captioned by this node.
  // Unsigned, like the relay route it forwards: `who` is public on the
  // mailbox (isRelayPublicPath, server.js), and the captions it comes
  // back with never leave this machine.
  function handleWho(req, res) {
    withRelay(res, function (url) {
      relayRequest(url, 'GET', '/api/relay/who', null)
        .then(function (r) {
          if (r.status !== 200) {
            res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(r.text);
            return;
          }
          // The relay route answers { peers: [...] } (server.js
          // handleRelayWho), not a bare array. Both shapes are accepted
          // because a stub that guessed wrong is exactly how this got
          // shipped once already: the harness passed against a fake that
          // returned the array, and the live mailbox returned an object.
          var parsed = null;
          try { parsed = JSON.parse(r.text); }
          catch (e) { parsed = null; }
          var peers = Array.isArray(parsed) ? parsed : ((parsed && parsed.peers) || []);
          // Null from a mailbox that has not been restarted since it grew
          // a key of its own. The app treats that as "no log for this
          // row" rather than inventing a name for it.
          var mailboxKey = (parsed && parsed.mailboxPublicKey) || null;
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          // The reserved name travels with the people, because it is a
          // destination the app must offer and never a peer it could
          // discover: `relay` cannot be claimed, so it is in no `who`.
          // Naming it here keeps the constant on the node beside the
          // relay that honours it (relayAuth.RESERVED_NAME).
          // This node's own key travels with the list, because being
          // added is the other half of adding: the person confirming a
          // tail has to hear it from somebody, and until now the only
          // way to read your own was to type `whoami` at the mailbox.
          var self = auth.loadIdentity(rootDir);
          res.end(JSON.stringify({
            relay: url,
            reservedName: auth.RESERVED_NAME,
            mailboxPublicKey: mailboxKey,
            selfPublicKey: (self && self.publicKey) || null,
            selfTail: self && self.publicKey ? keyTail(self.publicKey) : null,
            people: buildPeople(rootDir, peers, url),
          }));
        })
        .catch(function (err) { fail(res, 502, String(err.message || err)); });
    });
  }

  // GET /api/hub/handle?handle=bert — the candidates behind a handle.
  //
  // The filtering happens HERE, and only the matches go back. The node
  // has to fetch the census to answer at all, but the browser holding a
  // copy of it is how `To` gets refilled from `who` by accident six
  // weeks from now. Downloading is not acquiring.
  function handleHandle(req, res, urlObj) {
    var handle = urlObj.searchParams.get('handle') || '';
    withRelay(res, function (url) {
      relayRequest(url, 'GET', '/api/relay/who', null)
        .then(function (r) {
          if (r.status !== 200) {
            res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(r.text);
            return;
          }
          var parsed = null;
          try { parsed = JSON.parse(r.text); }
          catch (e) { parsed = null; }
          var peers = Array.isArray(parsed) ? parsed : ((parsed && parsed.peers) || []);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            handle: handle,
            matches: handleMatches(rootDir, peers, handle),
          }));
        })
        .catch(function (err) { fail(res, 502, String(err.message || err)); });
    });
  }

  // POST /api/hub/contact — a human confirmed one of those candidates.
  //
  // The key is checked against the census before it is written: a stale
  // page, or a mistyped paste, must not put a contact in the book for
  // somebody who is not there. The label comes from the mailbox rather
  // than from the browser, for the same reason.
  function handleContact(req, res, readJsonBody) {
    readJsonBody(req).then(function (body) {
      var publicKey = String((body && body.publicKey) || '').trim();
      if (!publicKey) {
        fail(res, 400, 'publicKey required');
        return;
      }
      withRelay(res, function (url) {
        relayRequest(url, 'GET', '/api/relay/who', null)
          .then(function (r) {
            var parsed = null;
            try { parsed = JSON.parse(r.text); }
            catch (e) { parsed = null; }
            var peers = Array.isArray(parsed) ? parsed : ((parsed && parsed.peers) || []);
            var found = peers.filter(function (p) { return p && p.publicKey === publicKey; })[0];
            if (!found) {
              fail(res, 404, 'no peer on this mailbox with that key');
              return;
            }
            var id = auth.loadIdentity(rootDir);
            if (id && id.publicKey === publicKey) {
              fail(res, 400, 'that key is this node');
              return;
            }
            var row = whoBook.acquire(rootDir, {
              publicKey: publicKey,
              publicLabel: found.publicLabel || found.name || '',
              relay: url,
            }, 'handle');
            res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
              publicKey: row.publicKey,
              publicLabel: row.publicLabel,
              acquiredVia: whoBook.acquiredVia(row),
            }));
          })
          .catch(function (err) { fail(res, 502, String(err.message || err)); });
      });
    }).catch(function () {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Invalid JSON body');
    });
  }

  function handleStatus(req, res, urlObj) {
    var name = urlObj.searchParams.get('name') || '';
    ownerBadge.probe(rootDir, name, function (url, method, pathname) {
      return relayRequest(url, method, pathname, null);
    })
      .then(function (summary) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          name: name,
          rows: summary.rows,
          ownedUrls: summary.ownedUrls,
          mustPick: summary.mustPick,
        }));
      })
      .catch(function (err) { fail(res, 502, String(err.message || err)); });
  }

  return {
    handleClaim: handleClaim,
    handleSend: handleSend,
    handleInbox: handleInbox,
    handleStatus: handleStatus,
    handleWho: handleWho,
    handleHandle: handleHandle,
    handleContact: handleContact,
    handleInvite: handleInvite,
  };
}

module.exports = {
  createHub: createHub,
  buildPeople: buildPeople,
  acquireFromInbox: acquireFromInbox,
  handleMatches: handleMatches,
  keyTail: keyTail,
};
