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

// The people list behind Relay Chat's To control (CYCLE-CHAT-2.md).
//
// A peer is a KEY. The mailbox's `who` hands back one row per key, so two
// johns are two rows here and stay two rows on screen — the thing a typed
// name cannot express, and the reason To stops being only a text box.
//
// Every peer is handshaken into whoBook on the way past, which is what
// makes the caption yours: myLabel if this node has one for that key,
// otherwise the label the mailbox shows. whoBook is never uploaded, so
// the caption is perception and the key is identity.
//
// When two rows would read the same — two johns, neither renamed yet —
// the caption carries a short piece of the key. A select with two
// identical options is a control nobody can use, and the disambiguation
// belongs where the collision is visible rather than in the app.
//
// The piece is the TAIL. These are Ed25519 public keys in base64 SPKI,
// and every one of them starts "MCowBQYDK2VwAyEA" — the ASN.1 header,
// identical for every key on every mailbox. A fragment taken from the
// front would have distinguished nothing, which is exactly what
// chatPeople.js caught.
function buildPeople(rootDir, peers, relayUrl) {
  var rows = (Array.isArray(peers) ? peers : [])
    .filter(function (p) { return p && p.publicKey; })
    .map(function (p) {
      whoBook.handshake(rootDir, {
        publicKey: p.publicKey,
        publicLabel: p.publicLabel || p.name || '',
        relay: relayUrl,
      });
      return {
        publicKey: p.publicKey,
        publicLabel: p.publicLabel || p.name || '',
        caption: whoBook.labelForKey(rootDir, p.publicKey, p.publicLabel || p.name || ''),
        owner: !!p.owner,
      };
    });

  var seen = Object.create(null);
  rows.forEach(function (r) { seen[r.caption] = (seen[r.caption] || 0) + 1; });
  rows.forEach(function (r) {
    if (seen[r.caption] > 1) {
      r.caption = r.caption + ' (' + String(r.publicKey).slice(-6) + ')';
      r.ambiguous = true;
    }
  });

  var id = auth.loadIdentity(rootDir);
  rows.forEach(function (r) { r.mine = !!(id && id.publicKey && r.publicKey === id.publicKey); });
  return rows;
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
          res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(r.text);
        })
        .catch(function (err) { fail(res, 502, String(err.message || err)); });
    });
  }

  // Status is now asked of every Natter row, not just the first, because
  // this is where the owner badge comes from: a signed 200 with a report
  // on that URL. The answer is per row — owned, not owned, unreachable —
  // and the caller is told which rows carry the badge and whether it has
  // to ask the human to pick between them.
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
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          // The reserved name travels with the people, because it is a
          // destination the app must offer and never a peer it could
          // discover: `relay` cannot be claimed, so it is in no `who`.
          // Naming it here keeps the constant on the node beside the
          // relay that honours it (relayAuth.RESERVED_NAME).
          res.end(JSON.stringify({
            relay: url,
            reservedName: auth.RESERVED_NAME,
            people: buildPeople(rootDir, peers, url),
          }));
        })
        .catch(function (err) { fail(res, 502, String(err.message || err)); });
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
    handleInvite: handleInvite,
  };
}

module.exports = { createHub: createHub, buildPeople: buildPeople };
