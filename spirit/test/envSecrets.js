'use strict';

// spirit/test/envSecrets.js
// A SECRET IS FILLED IN ONLY BY NAME, FOR ITS HOSTS, AND WITH ITS VERBS.
//
// The rule net.fetch applies before a request leaves the node
// (js/envSecrets.js). serverSurface.js proves the host gate against a real
// node; this proves the whole rule directly, including the one a running
// node cannot show without calling the real service — that Andy's xAI
// management key, read-only on xAI's side, is read-only here too:
//
//   GROK_MANAGEMENT_KEY — management-api.x.ai, GET only (2026-09-22)

const test = require('./testSupport.js');
const envSecrets = require('../run/js/envSecrets');

const ENV = {
  ANTHROPIC_API_KEY: 'A-SECRET',
  GROK_API_KEY: 'G-SECRET',
  GROK_MANAGEMENT_KEY: 'M-SECRET',
  SOME_OTHER_SECRET: 'O-SECRET',
};
const sub = function (v, host, method) { return envSecrets.substitute(v, host, method, ENV); };

test.startTest('A secret is filled in only by name, for its hosts, and with its verbs');

test.subHeading('Each key reaches its own host');

if (sub('Bearer ${ENV:GROK_API_KEY}', 'api.x.ai', 'POST') === 'Bearer G-SECRET' &&
    sub('${ENV:ANTHROPIC_API_KEY}', 'api.anthropic.com', 'POST') === 'A-SECRET') {
  test.check('the Grok key to api.x.ai, the Anthropic key to api.anthropic.com');
} else {
  test.fail('own hosts did not substitute');
}

test.subHeading('And no other');

if (sub('Bearer ${ENV:GROK_API_KEY}', 'evil.example', 'POST') === 'Bearer ${ENV:GROK_API_KEY}' &&
    sub('Bearer ${ENV:GROK_API_KEY}', 'api.anthropic.com', 'POST') === 'Bearer ${ENV:GROK_API_KEY}' &&
    sub('Bearer ${ENV:GROK_MANAGEMENT_KEY}', 'api.x.ai', 'GET') === 'Bearer ${ENV:GROK_MANAGEMENT_KEY}') {
  test.check('a key named for another host is left as the literal placeholder — even between xAI\'s own two hosts');
} else {
  test.fail('a key reached a host it is not paired with');
}

if (sub('${ENV:SOME_OTHER_SECRET}', 'api.x.ai', 'GET') === '${ENV:SOME_OTHER_SECRET}') {
  test.check('a variable not on the list is never filled in, wherever it is sent');
} else {
  test.fail('an unlisted variable was substituted');
}

test.subHeading('The management key reads, and cannot write');

if (sub('Bearer ${ENV:GROK_MANAGEMENT_KEY}', 'management-api.x.ai', 'GET') === 'Bearer M-SECRET' &&
    sub('Bearer ${ENV:GROK_MANAGEMENT_KEY}', 'management-api.x.ai', 'get') === 'Bearer M-SECRET') {
  test.check('GET to management-api.x.ai carries it');
} else {
  test.fail('the management key did not reach its host on GET');
}
const writes = ['POST', 'PUT', 'PATCH', 'DELETE'].filter(function (m) {
  return sub('Bearer ${ENV:GROK_MANAGEMENT_KEY}', 'management-api.x.ai', m) !== 'Bearer ${ENV:GROK_MANAGEMENT_KEY}';
});
if (!writes.length) {
  test.check('POST, PUT, PATCH and DELETE to the same host do not — nothing through this node can change the account');
} else {
  test.fail('the management key was filled in for: ' + writes.join(', '));
}

test.subHeading('Missing is visible, never silent');

if (envSecrets.substitute('Bearer ${ENV:GROK_API_KEY}', 'api.x.ai', 'POST', {}) === 'Bearer ${ENV:GROK_API_KEY}') {
  test.check('a node without the key leaves the placeholder, and the service refuses it — a 401, not a blank');
} else {
  test.fail('a missing key was substituted with something');
}

test.reportSuccessFailureCount();
