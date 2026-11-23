'use strict';

// spirit/run/spirit/test/nodeCard.js
// The tests of spirit/nodeCard.js, and of no other module (spec: ./nodeCard.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, box v72).
//
// What a node answers about itself to anybody who asks: the card ({card: true}, cycle 10's R1), signed over every
// field and verified from its own bytes, its counter moved on change only, its owner (goal/G19.8), and the home's
// read, setName, setDescription and rotate. Run in process on scratch roots under the temp folder, each with an
// identity.json of its own.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
// ITS TEMP FOLDERS FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"): one of its own for each
// it asks, under its suite's path, the whole of it removed when the suite ends.
const tempFolder = require('../tempFolder.js');
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/test/nodeCard/' + name + tempAsked); }
test.after(function () { try { fs.rmSync(tempFolder.path('spirit/test/nodeCard'), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
require(path.join(RUN, 'spirit', 'spirit.js'));
const C = require(path.join(RUN, 'spirit', 'nodeCard.js'));
const auth = spirit.requireScript('spirit/relayAuth.js');

// A scratch node home with an identity named as given.
function home(name) {
  const root = ownTemp('nr-card-');
  auth.saveIdentity(root, auth.generateIdentity(name));
  return root;
}
// The body of a card's text.
function bodyOf(text) { try { return JSON.parse(text).body; } catch (e) { return null; } }
const A = home('alpha');
const OWNER = auth.generateIdentity('boss').publicKey;

// ── asks ──
test.run('asks reads a system packet whose body says card true as a card ask', 0.2, function () {
  return C.asks(JSON.stringify({ v: 1, body: { card: true } })) === true || false;
}, test.limit.quick);
test.run('asks reads an app\'s packet, another question, a chat line and bad JSON as no card ask', 0.2, function () {
  const got = [JSON.stringify({ v: 1, app: 'chat', body: { card: true } }), JSON.stringify({ v: 1, body: { describe: true } }), 'hello', '{nope'].map(C.asks);
  return got.every(function (x) { return x === false; }) || false;
}, test.limit.quick);

// ── describe, verify ──
let CARD = '';
test.run('describe answers a card carrying name, description, publicKey, sealKey, at and owner, signed', 0.2, function () {
  CARD = C.describe(A);
  const b = bodyOf(CARD) || {};
  const id = auth.loadIdentity(A);
  return (b.ok === true && b.name === 'alpha' && b.publicKey === id.publicKey && b.sealKey === id.sealPublicKey && b.at >= 1 && b.owner === '' && typeof b.sig === 'string') || false;
}, test.limit.quick);
test.run('verify answers the fields of a card signed over exactly those bytes', 0.2, function () {
  const f = C.verify(CARD);
  return (!!f && f.name === 'alpha' && f.publicKey === auth.loadIdentity(A).publicKey) || false;
}, test.limit.quick);
test.run('verify refuses a card with any field changed in flight: name, description, sealKey, at, owner', 0.2, function () {
  const b = bodyOf(CARD);
  const got = [{ name: 'eve' }, { description: 'pwned' }, { sealKey: 'other' }, { at: b.at + 1 }, { owner: OWNER }].map(function (change) {
    return C.verify(JSON.stringify({ v: 1, body: Object.assign({}, b, change) }));
  });
  return got.every(function (x) { return x === null; }) || false;
}, test.limit.quick);
test.run('verify refuses a card from before the flag days, with no owner field or no counter', 0.2, function () {
  const b = bodyOf(CARD);
  const noOwner = Object.assign({}, b); delete noOwner.owner;
  const noAt = Object.assign({}, b); delete noAt.at;
  const got = [C.verify(JSON.stringify({ v: 1, body: noOwner })), C.verify(JSON.stringify({ v: 1, body: noAt })), C.verify('not a card'), C.verify(JSON.stringify({ v: 1, body: { publicKey: b.publicKey } }))];
  return got.every(function (x) { return x === null; }) || false;
}, test.limit.quick);
test.run('signable is one fixed order: card, name, description, publicKey, sealKey, at, owner', 0.2, function () {
  const s = C.signable({ name: 'n', description: 'd', publicKey: 'p', sealKey: 's', at: 3, owner: 'o' });
  return s === 'card\nn\nd\np\ns\n3\no' || false;
}, test.limit.quick);
test.run('cardFrom signs an identity in hand; with no private key it answers empty', 0.2, function () {
  const id = auth.generateIdentity('held');
  const f = C.verify(C.cardFrom(Object.assign({}, id, { cardAt: 5 })));
  return (!!f && f.name === 'held' && f.at === 5 && C.cardFrom({ publicKey: id.publicKey }) === '' && C.cardFrom(null) === '') || false;
}, test.limit.quick);

// ── the counter: it advances on change, not on publication ──
test.run('describe twice with nothing changed keeps the same counter, so a reconnect burns none', 0.2, function () {
  const a = bodyOf(C.describe(A)).at; const b = bodyOf(C.describe(A)).at;
  return a === b || false;
}, test.limit.quick);
test.run('a changed description moves the counter up', 0.2, function () {
  const before = bodyOf(C.describe(A)).at;
  C.setDescription(A, 'a node of mine');
  const after = bodyOf(C.describe(A));
  return (after.at === before + 1 && after.description === 'a node of mine') || false;
}, test.limit.quick);
test.run('an owner named in owner.json rides on the card, signed, and moves the counter', 0.2, function () {
  const before = bodyOf(C.describe(A)).at;
  auth.writeOwner(A, OWNER);
  const card = C.describe(A);
  const f = C.verify(card);
  const kept = JSON.parse(fs.readFileSync(path.join(A, 'spirit', 'state', 'identity.json'), 'utf8'));
  return (!!f && f.owner === OWNER && f.at === before + 1 && kept.owner === undefined) || false;
}, test.limit.quick);
test.run('an owner.json naming this node itself is no owner on its card', 0.2, function () {
  const B = home('self-owned');
  auth.writeOwner(B, auth.loadIdentity(B).publicKey);
  const f = C.verify(C.describe(B));
  return (!!f && f.owner === '') || false;
}, test.limit.quick);

// ── read, setName, setDescription ──
test.run('read answers name, description, publicKey and the description cap from fieldRules', 0.2, function () {
  const r = C.read(A);
  return (r.name === 'alpha' && r.description === 'a node of mine' && r.publicKey === auth.loadIdentity(A).publicKey && r.descriptionMax === 128) || false;
}, test.limit.quick);
test.run('setName normalizes and stores the name; the card carries it', 0.2, function () {
  const r = C.setName(A, '  alpha   two ');
  return (r.ok === true && r.name === 'alpha two' && auth.loadIdentity(A).name === 'alpha two' && C.verify(C.describe(A)).name === 'alpha two') || false;
}, test.limit.quick);
test.run('setName refuses, 400, an empty name, an invisible character, one too long; the name stays', 0.2, function () {
  const got = ['  ', 'a‮b', 'x'.repeat(65)].map(function (t) { return C.setName(A, t); });
  return (got.every(function (r) { return r.ok === false && r.status === 400; }) && auth.loadIdentity(A).name === 'alpha two') || false;
}, test.limit.quick);
// goal/G47.4, box v52: "that field rule will demand that desctiptions are NOT empty": a description is replaced, never cleared.
test.run('setDescription answers what was stored; empty and too long are refused, 400, the stored one kept, never cut', 0.2, function () {
  const ok = C.setDescription(A, '  said   twice ');
  const long = C.setDescription(A, 'y'.repeat(129));
  const clear = C.setDescription(A, '');
  return (ok.ok === true && ok.description === 'said twice' && long.ok === false && long.status === 400 && clear.ok === false && clear.status === 400 && C.read(A).description === 'said twice') || false;
}, test.limit.quick);

// ── rotate (Andy: "rotation is a crisis.measure") ──
test.run('rotate makes a new seal key, discards the old private key, keeps the identity key and makes the card strictly newer', 0.2, function () {
  const R = home('rotor');
  const before = auth.loadIdentity(R);
  const r = C.rotate(R);
  const after = auth.loadIdentity(R);
  const f = C.verify(C.describe(R));
  return (r.ok === true && r.at >= 2 && after.sealPublicKey !== before.sealPublicKey && after.sealPrivateKey !== before.sealPrivateKey && after.publicKey === before.publicKey && !!f && f.sealKey === after.sealPublicKey && f.at === r.at) || false;
}, test.limit.quick);
test.run('after a card was published, the rotated card\'s counter is above it', 0.2, function () {
  const R = home('rotor2');
  const was = bodyOf(C.describe(R)).at;
  const r = C.rotate(R);
  return r.at > was || false;
}, test.limit.quick);
