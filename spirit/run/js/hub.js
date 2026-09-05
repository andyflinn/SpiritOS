'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { URL } = require('url');
const auth = require('./relayAuth');

function signedClaim(rootDir, name) {
  const id = auth.loadIdentity(rootDir);
  const body = { name: name };
  if (id && id.privateKey) {
    body.sig = auth.sign(id.privateKey, auth.claimMessage(name));
  }
  return body;
}

function signedSend(rootDir, from, to, text) {
  const id = auth.loadIdentity(rootDir);
  const body = { from: from, to: to, text: text };
  if (id && id.privateKey) {
    body.sig = auth.sign(id.privateKey, auth.sendMessage(from, to, text));
  }
  return body;
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
    try { target = new URL(relayUrl + pathname); }
    catch (e) { reject(new Error('bad relay url')); return; }
    var payload = bodyObj == null ? '' : JSON.stringify(bodyObj);
    var req = http.request({
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
    fn(url);
  }

  function handleClaim(req, res, readJsonBody) {
    readJsonBody(req).then(function (body) {
      withRelay(res, function (url) {
        relayRequest(url, 'POST', '/api/relay/claim', signedClaim(rootDir, body && body.name))
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
      relayRequest(url, 'GET', '/api/relay/inbox?name=' + encodeURIComponent(name), null)
        .then(function (r) {
          res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(r.text);
        })
        .catch(function (err) { fail(res, 502, String(err.message || err)); });
    });
  }

  return { handleClaim: handleClaim, handleSend: handleSend, handleInbox: handleInbox };
}

module.exports = { createHub: createHub };
