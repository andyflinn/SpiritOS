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
const tempFolder = require('../../tempFolder/script.js');
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
const STRANGER = auth.generateIdentity('stranger');

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
// A command as the owner signs it: for this puppet (to), for this envelope (id).
function command(verb, body, o) {
  const x = o || {};
  const cmd = x.cmd !== undefined ? x.cmd : JSON.stringify({ verb: verb, body: body });
  const id = x.id || 'env-1';
  const signer = x.signer || OWNER;
  const to = x.to || SELF.publicKey;
  return { id: id, app: null, body: { cmd: cmd, sig: x.sig !== undefined ? x.sig : auth.sign(signer.privateKey, auth.commandMessage(OWNER.publicKey, to, id, cmd)) } };
}
function arrive(envelope, from) { return { from: from === undefined ? OWNER.publicKey : from, envelope: envelope }; }
function switchOpts(ownerKey) { return { ownerKey: ownerKey === undefined ? OWNER.publicKey : ownerKey, selfKey: SELF.publicKey, auth: auth }; }

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
  return (got.every(function (g) { return g.puppet === false; }) && said.length === 1 && /no owner commands/.test(said[0])) || false;
}, test.limit.quick);
test.run('an owner.json broken, fixed and then broken again is said in the log again', 0.2, function () {
  const said = [];
  const home = scratch('garbage');
  const read = P.puppetIn(home, function (line) { said.push(line); });
  read(); ownerFile(home, JSON.stringify({ owner: OWNER.publicKey })); const fixed = read(); ownerFile(home, 'garbage'); read();
  return (fixed.puppet === true && said.length === 2) || false;
}, test.limit.quick);

// ── ownerCommandIn: the switch (puppets/G5) ──
test.run('a command the owner signed for this puppet gives the verb and body to run', 0.2, function () {
  const got = P.ownerCommandIn(arrive(command('job.list', { all: true })), switchOpts());
  return (got.ok === true && got.verb === 'job.list' && short(got.body) === short({ all: true })) || false;
}, test.limit.quick);
test.run('an owner\'s command with no body runs with an empty body', 0.2, function () {
  const got = P.ownerCommandIn(arrive(command('node.card')), switchOpts());
  return (got.ok === true && got.verb === 'node.card' && short(got.body) === '{}') || false;
}, test.limit.quick);
test.run('a node that is not a puppet takes no command at all, even a well-signed one, and answers 403 not a puppet', 0.2, function () {
  const got = P.ownerCommandIn(arrive(command('job.list')), switchOpts(''));
  return (got.ok === false && got.status === 403 && got.error === 'not a puppet') || false;
}, test.limit.quick);
test.run('a command from any key but the owner\'s, or from nobody, is refused 403 not the owner', 0.2, function () {
  const got = [P.ownerCommandIn(arrive(command('job.list'), STRANGER.publicKey), switchOpts()), P.ownerCommandIn(arrive(command('job.list'), ''), switchOpts())];
  return got.every(function (g) { return g.ok === false && g.status === 403 && g.error === 'not the owner'; }) || false;
}, test.limit.quick);
test.run('an envelope addressed to an app, or a chat line with no envelope, is not a command and is answered 400', 0.2, function () {
  const toApp = Object.assign(command('job.list'), { app: 'chat' });
  const got = [P.ownerCommandIn(arrive(toApp), switchOpts()), P.ownerCommandIn(arrive(null), switchOpts())];
  return got.every(function (g) { return g.ok === false && g.status === 400 && g.error === 'not a command'; }) || false;
}, test.limit.quick);
test.run('a sibling puppet posting with the owner\'s key but signing itself is refused 403 bad command signature', 0.2, function () {
  const got = P.ownerCommandIn(arrive(command('job.list', {}, { signer: SIBLING })), switchOpts());
  return (got.ok === false && got.status === 403 && got.error === 'bad command signature') || false;
}, test.limit.quick);
test.run('an absent signature and a wrong signature get one and the same refusal', 0.2, function () {
  const got = [P.ownerCommandIn(arrive(command('job.list', {}, { sig: '' })), switchOpts()), P.ownerCommandIn(arrive(command('job.list', {}, { sig: 'AAAA' })), switchOpts())];
  return (short(got[0]) === short(got[1]) && got[0].error === 'bad command signature' && got[0].status === 403) || false;
}, test.limit.quick);
test.run('a command signed for a sibling does not verify here', 0.2, function () {
  const got = P.ownerCommandIn(arrive(command('job.list', {}, { to: SIBLING.publicKey })), switchOpts());
  return (got.ok === false && got.error === 'bad command signature') || false;
}, test.limit.quick);
test.run('a command\'s signature cannot be lifted onto another envelope', 0.2, function () {
  const env = command('job.list', {}, { id: 'env-1' });
  env.id = 'env-2';
  const got = P.ownerCommandIn(arrive(env), switchOpts());
  return (got.ok === false && got.error === 'bad command signature') || false;
}, test.limit.quick);
test.run('a signed command that is no JSON, or names no verb, is not a command and is answered 400', 0.2, function () {
  const got = [P.ownerCommandIn(arrive(command(null, null, { cmd: '{not json' })), switchOpts()), P.ownerCommandIn(arrive(command(null, null, { cmd: JSON.stringify({ body: {} }) })), switchOpts())];
  return got.every(function (g) { return g.ok === false && g.status === 400 && g.error === 'not a command'; }) || false;
}, test.limit.quick);

// ── puppetDoor: the owner door (puppets/G7) ──
function door(o) {
  const said = { posts: [], calls: [], log: [] };
  const x = o || {};
  said.door = P.puppetDoor({
    puppet: x.puppet || function () { return { puppet: true, owner: OWNER.publicKey }; },
    log: function (line) { said.log.push(line); },
    selfKey: function () { return SELF.publicKey; },
    auth: auth,
    encode: x.encode || function (type, answer, extra) { return { text: JSON.stringify({ type: type, answer: answer, re: extra && extra.re }) }; },
    post: function (relay, to, text) { said.posts.push({ relay: relay, to: to, sent: JSON.parse(text) }); return Promise.resolve({ ok: true }); },
    call: x.call || function (verb, body) { said.calls.push({ verb: verb, body: body }); return Promise.resolve({ ok: true, status: 200, echo: body }); },
  });
  return said;
}
function message(envelope, from) { return { hash: 'h4sh0123456789', relay: 'https://relay.example', fromKey: from === undefined ? OWNER.publicKey : from, envelope: envelope }; }

test.run('at the puppet door the owner\'s signed command runs through the node\'s verbs, the answer going back with the command\'s hash as re', 0.2, async function () {
  const d = door();
  d.door(message(command('job.list', { all: true })));
  await settle();
  const post = d.posts[0] || {};
  return (d.calls.length === 1 && d.calls[0].verb === 'job.list' && short(d.calls[0].body) === short({ all: true }) &&
    d.posts.length === 1 && post.relay === 'https://relay.example' && post.to === OWNER.publicKey && post.sent.re === 'h4sh0123456789' &&
    post.sent.answer.verb === 'job.list' && post.sent.answer.status === 200) || false;
}, test.limit.quick);
test.run('the puppet door of a node that is not a puppet is silent, as a non-puppet must behave', 0.2, async function () {
  const d = door({ puppet: function () { return { puppet: false, owner: '' }; } });
  d.door(message(command('job.list')));
  await settle();
  return (d.calls.length === 0 && d.posts.length === 0) || false;
}, test.limit.quick);
test.run('the puppet door is silent to a stranger and to a chat line from the owner, and never tells them this is a puppet', 0.2, async function () {
  const d = door();
  d.door(message(command('job.list'), STRANGER.publicKey));
  d.door(message(null));
  d.door(message(Object.assign(command('job.list'), { app: 'chat' })));
  await settle();
  return (d.calls.length === 0 && d.posts.length === 0) || false;
}, test.limit.quick);
test.run('a command from the owner that fails the switch is refused to him at the puppet door, and nothing runs', 0.2, async function () {
  const d = door();
  d.door(message(command('job.list', {}, { signer: SIBLING })));
  await settle();
  const a = (d.posts[0] || { sent: {} }).sent.answer || {};
  return (d.calls.length === 0 && d.posts.length === 1 && a.status === 403 && a.error === 'bad command signature') || false;
}, test.limit.quick);
test.run('an answer too large for a packet is said at the puppet door, never dropped: 413 answer-too-large with the verb and the size', 0.2, async function () {
  const d = door({ encode: function (type, answer, extra) { return answer && answer.code !== 'answer-too-large' ? null : { text: JSON.stringify({ answer: answer, re: extra.re }) }; } });
  d.door(message(command('job.list')));
  await settle();
  const a = (d.posts[0] || { sent: {} }).sent.answer || {};
  return (d.posts.length === 1 && a.status === 413 && a.code === 'answer-too-large' && a.verb === 'job.list' && a.bytes > 0 && d.log.some(function (l) { return /too large/.test(l); })) || false;
}, test.limit.quick);
test.run('the module answers puppetIn, puppetDoor and ownerCommandIn', 0.2, function () {
  return short(Object.keys(P).sort()) === short(['ownerCommandIn', 'puppetDoor', 'puppetIn']) || false;
}, test.limit.quick);
