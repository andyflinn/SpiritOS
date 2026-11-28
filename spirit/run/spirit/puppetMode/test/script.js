'use strict';

// spirit/run/spirit/puppetMode/test/script.js
// The tests of spirit/puppetMode/script.js, and of no other module (spec: ./script.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, box v72).
//
// A node owned by another node, and the door its owner has: puppetIn (whose puppet this node is, from owner.json),
// ownerCommandIn (the switch where a remote packet becomes local authority, puppets/G5) and puppetDoor (a signed command
// runs through the node's verbs, puppets/G7). In process: a scratch folder holds the identity and owner.json, real keys
// sign the commands, and the door's encode, post and call are planted.

const path = require('path');
const fs = require('fs');
const RUN = path.resolve(__dirname, '..', '..', '..');
const S = require(path.join(RUN, 'spirit', 'script.js'));
const test = S.requireScript('spirit/test/testReport.js');
// ITS TEMP FOLDERS FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"): one of its own for each
// it asks, under its suite's path, the whole of it removed when the suite ends.
const tempFolder = require('../../tempFolder/script.js').tempFolder;
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/test/puppetMode/' + name + tempAsked); }
test.after(function () { try { fs.rmSync(tempFolder.path('spirit/test/puppetMode'), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
const auth = S.requireScript('spirit/relayAuth/script.js');
const P = S.requireScript('spirit/puppetMode/script.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = function () { return new Promise(function (r) { setTimeout(r, 30); }); };

const OWNER = auth.generateIdentity('owner');
const SELF = auth.generateIdentity('puppet');
const SIBLING = auth.generateIdentity('sibling');

const HOMES = [];
process.on('exit', function () { HOMES.forEach(function (h) { try { fs.rmSync(h, { recursive: true, force: true }); } catch (e) { /* gone */ } }); });
function scratch(owner) {
  const home = ownTemp('spirit-puppetmode-');
  HOMES.push(home);
  auth.saveIdentity(home, SELF);
  if (owner !== undefined) {
    fs.mkdirSync(path.join(home, 'spirit', 'state'), { recursive: true });
    fs.writeFileSync(path.join(home, 'spirit', 'state', 'owner.json'), owner);
  }
  return home;
}
function ownerFile(home, text) { fs.writeFileSync(path.join(home, 'spirit', 'state', 'owner.json'), text); }
// ── puppetIn: whose puppet this node is ──
test.run('an owner.json naming another key makes this node that key\'s puppet', 0.2, function () {
  const home = scratch(JSON.stringify({ owner: OWNER.publicKey }));
  const got = P.puppetIn(home)();
  return (got.puppet === true && got.owner === OWNER.publicKey) || false;
}, test.limit.quick);
test.run('an owner.json naming this node\'s own key does not make it a puppet', 0.2, function () {
  const got = P.puppetIn(scratch(JSON.stringify({ owner: SELF.publicKey })))();
  return (got.puppet === false && got.owner === '') || false;
}, test.limit.quick);
test.run('a node with no owner.json is not a puppet', 0.2, function () {
  const got = P.puppetIn(scratch())();
  return (got.puppet === false && got.owner === '') || false;
}, test.limit.quick);
test.run('puppetIn reads owner.json on every call, so an edit of the owner is seen at once', 0.2, function () {
  const home = scratch(JSON.stringify({ owner: OWNER.publicKey }));
  const read = P.puppetIn(home);
  const first = read();
  ownerFile(home, JSON.stringify({ owner: SIBLING.publicKey }));
  const second = read();
  return (first.owner === OWNER.publicKey && second.owner === SIBLING.publicKey) || false;
}, test.limit.quick);
test.run('a broken owner.json names no owner, and this is said once in the log, not on every call', 0.2, function () {
  const said = [];
  const home = scratch('{"owner": "not a key"}');
  const read = P.puppetIn(home, function (line) { said.push(line); });
  const got = [read(), read(), read()];
  return (got.every(function (g) { return g.puppet === false; }) && said.length === 1 && /has no owner/.test(said[0])) || false;
}, test.limit.quick);
test.run('an owner.json broken, fixed and then broken again is said in the log again', 0.2, function () {
  const said = [];
  const home = scratch('garbage');
  const read = P.puppetIn(home, function (line) { said.push(line); });
  read(); ownerFile(home, JSON.stringify({ owner: OWNER.publicKey })); const fixed = read(); ownerFile(home, 'garbage'); read();
  return (fixed.puppet === true && said.length === 2) || false;
}, test.limit.quick);

// THE OWNER DOOR WENT (goal/G49.24, box v18; Andy: "put the ceremonial killing of the owner branch in the box, with all the shit
// that can go, puppet sender and all."): ownerCommandIn and puppetDoor with it, and their checks; who owns a node, puppetIn, stays.
test.run('the module answers puppetIn, and nothing else', 0.2, function () {
  return short(Object.keys(P).sort()) === short(['puppetIn']) || false;
}, test.limit.quick);
