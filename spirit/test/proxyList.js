'use strict';

// spirit/test/proxyList.js
// THE OWNER'S LIST FOR THE PROXY — a node file, maintained only by verbs,
// with a gate he can close (design/proxy/THE-PROXY.md, 2026-09-22).
//
//   Andy: "on the core-side it's primarily about having a configuration
//   file for allowed key/website combinations and a client api (loopback)
//   that allows that internal list to be maintained" — "if i see outragous
//   spending by agents, i then could close the node-gate."
//
// In process, on a temp home. serverSurface.js proves the same list through
// a real node: not served, not writable through fs, and the gate closing
// net.fetch.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const proxyList = require('../run/js/proxyList');
const envSecrets = require('../run/js/envSecrets');

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-proxylist-'));
const file = path.join(home, 'relay-state', 'proxy.json');

test.startTest('The owner\'s list for the proxy');

test.subHeading('A node without a list starts with the one that was code');

let list = proxyList.load(home);
if (fs.existsSync(file) && list.open === true && list.entries.length === 3 &&
    list.entries.some(function (e) { return e.key === 'GROK_MANAGEMENT_KEY' && e.methods[0] === 'GET' && e.methods.length === 1; })) {
  test.check('the first read writes relay-state/proxy.json: open, three entries, the management key GET-only');
} else {
  test.fail('defaults: ' + JSON.stringify(list));
}

test.subHeading('Allow and remove');

let r = proxyList.allow(home, { host: 'API.Example.com', key: 'EXAMPLE_KEY', methods: ['get'] });
list = proxyList.load(home);
if (r.ok && list.entries.some(function (e) { return e.host === 'api.example.com' && e.key === 'EXAMPLE_KEY' && e.methods[0] === 'GET'; })) {
  test.check('allow adds an entry, host and method written the one way the gate reads them');
} else {
  test.fail('allow: ' + JSON.stringify(r));
}
r = proxyList.allow(home, { host: 'api.example.com', key: 'EXAMPLE_KEY' });
if (proxyList.load(home).entries.filter(function (e) { return e.key === 'EXAMPLE_KEY'; }).length === 1) {
  test.check('allowing the same key and website again replaces the entry, never doubles it');
} else {
  test.fail('allow twice doubled the entry');
}
const bad = [
  proxyList.allow(home, { host: 'x.example', key: 'lower-case' }),
  proxyList.allow(home, { host: 'not a host', key: 'OK_KEY' }),
  proxyList.allow(home, { host: 'x.example', key: 'OK_KEY', methods: ['STEAL'] }),
];
if (bad.every(function (b) { return !b.ok && b.status === 400; })) {
  test.check('a malformed key name, website or method is refused 400 and changes nothing');
} else {
  test.fail('malformed entries: ' + JSON.stringify(bad));
}
r = proxyList.remove(home, { host: 'api.example.com', key: 'EXAMPLE_KEY' });
const gone = proxyList.remove(home, { host: 'api.example.com', key: 'EXAMPLE_KEY' });
if (r.ok && !gone.ok && gone.status === 404) {
  test.check('remove takes it out, and removing it again is 404');
} else {
  test.fail('remove: ' + JSON.stringify([r, gone]));
}

test.subHeading('The gate: everything, one key, one website');

list = proxyList.load(home);
if (proxyList.gate(list, 'api.x.ai', ['GROK_API_KEY']).ok && proxyList.gate(list, 'github.com', []).ok) {
  test.check('open: a listed key to its website goes, and a website not on the list that names no key goes too');
} else {
  test.fail('open gate refused');
}

proxyList.close(home, {});
list = proxyList.load(home);
let g = proxyList.gate(list, 'github.com', []);
if (!g.ok && g.status === 403 && /closed by the owner/.test(g.error) && proxyList.openEntries(list).length === 0) {
  test.check('close {} shuts everything — "the proxy is closed by the owner" — and no key can be filled in');
} else {
  test.fail('closed gate: ' + JSON.stringify(g));
}
proxyList.open(home, {});

proxyList.close(home, { key: 'GROK_API_KEY' });
list = proxyList.load(home);
g = proxyList.gate(list, 'api.x.ai', ['GROK_API_KEY']);
const other = proxyList.gate(list, 'api.anthropic.com', ['ANTHROPIC_API_KEY']);
const filled = envSecrets.substitute('Bearer ${ENV:GROK_API_KEY}', 'api.x.ai', 'POST', { GROK_API_KEY: 'G' }, proxyList.openEntries(list));
if (!g.ok && /GROK_API_KEY is closed by the owner/.test(g.error) && other.ok && filled === 'Bearer ${ENV:GROK_API_KEY}') {
  test.check('close { key } shuts that key everywhere, leaves the others working, and the key is never filled in');
} else {
  test.fail('closed key: ' + JSON.stringify([g, other, filled]));
}
proxyList.open(home, { key: 'GROK_API_KEY' });
if (proxyList.gate(proxyList.load(home), 'api.x.ai', ['GROK_API_KEY']).ok) {
  test.check('and open { key } brings it back');
} else {
  test.fail('the key did not reopen');
}

proxyList.close(home, { host: 'somewhere.example' });
list = proxyList.load(home);
g = proxyList.gate(list, 'somewhere.example', []);
if (!g.ok && /somewhere.example is closed by the owner/.test(g.error) &&
    list.entries.some(function (e) { return e.host === 'somewhere.example' && !e.key && e.open === false; })) {
  test.check('close { host } shuts a website that was not on the list, by adding a keyless entry to hold it');
} else {
  test.fail('closed website: ' + JSON.stringify(g));
}
proxyList.open(home, { host: 'somewhere.example' });
if (proxyList.gate(proxyList.load(home), 'somewhere.example', []).ok) {
  test.check('and open { host } lifts it');
} else {
  test.fail('the website did not reopen');
}

test.subHeading('A list that broke closes the gate, never opens it');

fs.writeFileSync(file, '{ this is not json');
list = proxyList.load(home);
g = proxyList.gate(list, 'github.com', []);
const refill = proxyList.allow(home, { host: 'x.example' });
if (list.broken && !g.ok && g.status === 503 && proxyList.openEntries(list).length === 0 && !refill.ok) {
  test.check('an unreadable proxy.json refuses every call, fills in no key, and is not silently overwritten');
} else {
  test.fail('broken list: ' + JSON.stringify([list, g, refill]));
}

try { fs.rmSync(home, { recursive: true, force: true }); } catch (e) { /* windows */ }
test.reportSuccessFailureCount();
