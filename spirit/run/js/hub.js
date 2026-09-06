'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const auth = require('./relayAuth');

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

function signedClaim(rootDir, name) {
  const id = auth.ensureIdentity(rootDir, name);
  const body = {
    name: name,
    publicKey: id.publicKey,
    sig: auth.sign(id.privateKey, auth.claimMessage(name)),
  };
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

function signedStatus(rootDir, name) {
  const id = auth.loadIdentity(rootDir);
  if (!id || !id.privateKey) return { name: name };
  return {
    name: name,
    sig: auth.sign(id.privateKey, auth.statusMessage(name)),
  };
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

function loadRelayUrl(rootDir) {
  var file = path.join(rootDir, 'app', 'natter', 'relays.json');
  var raw;
  try { raw = fs.readFileSync(file, 'utf8'); }
  catch (e) { return null; }
  try {
    var list = JSON.parse(raw);
    if (!Array.isArray(list) || !list[0] || !list[0].url) return null;
    return String(list[0].url).replace(/\/+$/, '');
  } catch (e) {
    return null;
  }
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

  function handleClaim(req, res, readJsonBody) {
    readJsonBody(req).then(function (body) {
      withRelay(res, function (url) {
        relayRequest(url, 'POST', '/api/relay/claim', signedClaim(rootDir, body && body.name))
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

  function handleStatus(req, res, urlObj) {
    withRelay(res, function (url) {
      var name = urlObj.searchParams.get('name') || '';
      var signed = signedStatus(rootDir, name);
      var q = '/api/relay/status?name=' + encodeURIComponent(name);
      if (signed.sig) q += '&sig=' + encodeURIComponent(signed.sig);
      relayRequest(url, 'GET', q, null)
        .then(function (r) {
          res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(r.text);
        })
        .catch(function (err) { fail(res, 502, String(err.message || err)); });
    });
  }

  return {
    handleClaim: handleClaim,
    handleSend: handleSend,
    handleInbox: handleInbox,
    handleStatus: handleStatus,
  };
}

module.exports = { createHub: createHub };
