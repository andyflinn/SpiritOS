'use strict';

const http = require('http');
const { URL } = require('url');
const spirit = require('../../../js/kernel.js');

const RELAY = 'http://127.0.0.1:65430';
const FROM = 'andy';
const TO = 'bert';
const TEXT = 'process ping ' + new Date().toISOString();

function request(method, pathname, bodyObj) {
  return new Promise(function (resolve, reject) {
    var target = new URL(RELAY + pathname);
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

async function main() {
  await spirit.core.jobs.log('relay ' + RELAY);

  var claim = await request('POST', '/api/relay/claim', { name: FROM });
  await spirit.core.jobs.log('claim ' + FROM + ' → ' + claim.status + ' ' + claim.text);
  if (claim.status !== 201 && claim.status !== 409) {
    await spirit.core.jobs.fail({ reason: 'claim failed', body: claim.text });
    return;
  }

  var sent = await request('POST', '/api/relay/send', { from: FROM, to: TO, text: TEXT });
  await spirit.core.jobs.log('send → ' + sent.status + ' ' + sent.text);
  if (sent.status !== 201) {
    await spirit.core.jobs.fail({ reason: 'send failed', body: sent.text });
    return;
  }

  var inbox = await request('GET', '/api/relay/inbox?name=' + encodeURIComponent(TO), null);
  await spirit.core.jobs.log('inbox ' + TO + ' → ' + inbox.status + ' ' + inbox.text);

  var ok = inbox.text.indexOf(TEXT) !== -1;
  if (!ok) {
    await spirit.core.jobs.fail({ reason: 'sent text not in inbox' });
    return;
  }

  await spirit.core.jobs.complete({ from: FROM, to: TO, text: TEXT });
}

main().catch(function (err) {
  return spirit.core.jobs.fail({ reason: String(err && err.message || err) });
});