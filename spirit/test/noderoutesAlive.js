'use strict';

// spirit/test/noderoutesAlive.js
// goal/G19.16: the alpha public relay at https://noderoutes.net answers. Andy, 2026-10-12: "noderoutes.net has to go
// up and stay up. now. it's part of the alpha strategy, where spirit is my development releay (for us) and
// noderoutes.et will be the alpha public relay.", and, the relay up: "write a test that checks if noderoutes.net is
// alive."
//
// WHAT IS ASSERTED
//   1. GET https://noderoutes.net/api/relay/key answers 200 over a certificate node trusts.
//   2. It names the relay key recorded in goal/G19.16 (the key that ships with the install, goal/G19.15), so a box
//      rebuilt under the same name with a new identity is caught, not taken for alive.
//   3. Its owner is Andy's node key, as install-units wrote it.
// rule/11: through testSupport only; one read from the public relay, nothing written, no local node.

const https = require('https');
const test = require('./testSupport.js');

const URL = 'https://noderoutes.net/api/relay/key';
const RELAY_KEY = 'MCowBQYDK2VwAyEA+4mt2XtbJHPmiyCri6HRaA/PyH4EPGYE/ez+YpE72Ls=';
const OWNER_KEY = 'MCowBQYDK2VwAyEAgrEcBu0FkTzmGKs+oBS+OllzvZh+d/0Rr6fO/fXD+0c=';

test.startTest('goal/G19.16: noderoutes.net is alive');

function get(url) {
  return new Promise(function (resolve) {
    const req = https.get(url, { timeout: 15000 }, function (res) {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', function (c) { body += c; });
      res.on('end', function () { resolve({ status: res.statusCode, body: body }); });
    });
    req.on('timeout', function () { req.destroy(new Error('no answer within 15 s')); });
    req.on('error', function (e) { resolve({ status: 0, error: e.message }); });
  });
}

get(URL).then(function (r) {
  test.subHeading('1. it answers over https');
  if (r.status === 200) test.check('GET ' + URL + ' answered 200 with a trusted certificate');
  else test.fail('GET ' + URL + ' did not answer 200: ' + (r.error || ('status ' + r.status)));

  let said = null;
  try { said = JSON.parse(r.body || ''); } catch (e) { said = null; }

  test.subHeading('2. it is the relay we ship');
  if (said && said.relayPublicKey === RELAY_KEY) test.check('it names the relay key recorded in goal/G19.16');
  else test.fail('the relay key is not the one recorded in goal/G19.16: ' + (said ? said.relayPublicKey : 'no JSON answer'));

  test.subHeading('3. it is owned by Andy\'s node');
  if (said && said.ownerKey === OWNER_KEY) test.check('its owner is Andy\'s node key');
  else test.fail('its owner is not Andy\'s node key: ' + (said ? said.ownerKey : 'no JSON answer'));

  test.reportSuccessFailureCount();
});
