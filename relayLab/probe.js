#!/usr/bin/env node
'use strict';

// Portable relay probe. No bash. Works on Windows and on spirit-3.
//   node relayLab/probe.js
//   node relayLab/probe.js https://spirit.andyflinn.com
// Talks to the public name over HTTPS and, if this process can
// reach it, to http://127.0.0.1:65430. Never writes relay-state.
// Never starts a server.

const http = require('http');
const https = require('https');
const { URL } = require('url');

const PUBLIC = process.argv[2] || 'https://spirit.andyflinn.com';
const LOCAL = process.env.SPIRIT_RELAY_LOCAL || 'http://127.0.0.1:65430';
const TIMEOUT_MS = 8000;

function line(tag, ok, detail) {
  const mark = ok === true ? 'ok ' : ok === false ? '!! ' : '   ';
  console.log('  ' + mark + tag + (detail ? '  ' + detail : ''));
}

function get(urlStr) {
  return new Promise(function (resolve) {
    let target;
    try { target = new URL(urlStr); }
    catch (e) {
      resolve({ error: String(e.message || e) });
      return;
    }
    const lib = target.protocol === 'https:' ? https : http;
    const req = lib.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      path: target.pathname + target.search,
      method: 'GET',
      headers: { Accept: 'application/json' }
    }, function (res) {
      let body = '';
      res.on('data', function (c) { body += c; });
      res.on('end', function () {
        resolve({ status: res.statusCode, body: body, via: target.protocol });
      });
    });
    req.setTimeout(TIMEOUT_MS, function () {
      req.destroy();
      resolve({ error: 'timeout ' + TIMEOUT_MS + 'ms' });
    });
    req.on('error', function (err) {
      resolve({ error: String(err.message || err) });
    });
    req.end();
  });
}

function summarizeWho(result) {
  if (result.error) return { ok: false, detail: result.error };
  if (result.status !== 200) {
    return { ok: false, detail: 'HTTP ' + result.status + ' ' + String(result.body || '').slice(0, 80) };
  }
  try {
    const j = JSON.parse(result.body);
    const n = Array.isArray(j.peers) ? j.peers.length : '?';
    return { ok: true, detail: 'HTTP 200  peers=' + n + '  ' + result.body.replace(/\s+/g, ' ').slice(0, 120) };
  } catch (e) {
    return { ok: false, detail: 'not JSON: ' + String(result.body).slice(0, 80) };
  }
}

(async function main() {
  console.log('probe  public  ' + PUBLIC);
  console.log('probe  local   ' + LOCAL);
  console.log('probe  node    ' + process.version + '  ' + process.platform);
  console.log();

  console.log('==> GET ' + PUBLIC.replace(/\/+$/, '') + '/api/relay/who');
  const pub = summarizeWho(await get(PUBLIC.replace(/\/+$/, '') + '/api/relay/who'));
  line('https who', pub.ok, pub.detail);

  console.log();
  console.log('==> GET ' + LOCAL.replace(/\/+$/, '') + '/api/relay/who');
  const loc = summarizeWho(await get(LOCAL.replace(/\/+$/, '') + '/api/relay/who'));
  line('local who', loc.ok, loc.detail);
  if (!loc.ok) {
    line('note', null, 'local miss is normal on the Windows box; expected on spirit-3');
  }

  console.log();
  const bad = await get(PUBLIC.replace(/\/+$/, '') + '/%');
  if (bad.error) line('bad % path', false, bad.error);
  else line('bad % path', bad.status === 400, 'HTTP ' + bad.status + ' (want 400 once URIError is caught)');

  console.log();
  if (pub.ok) line('mailbox reachable over TLS', true, PUBLIC);
  else line('mailbox reachable over TLS', false, 'fix DNS/Caddy/unit before anything else');
})();
