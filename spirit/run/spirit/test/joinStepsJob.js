'use strict';

// spirit/run/spirit/test/joinStepsJob.js
// The tests of spirit/joinStepsJob.js, and of no other module (spec: ./joinStepsJob.md). Its own test, owed since the
// rule "every production script has its own test" (goal/G47.1, box v72).
//
// Where the join steps stand, as a stream (goal/G30.1, goal/G43.20): facts(rootDir) read from the node's own records,
// published as news of the job spirit, kind join, only when they change. Run in process on a scratch root under the
// temp folder; the jobs table is a planted one that records each ownNews it is asked.

const fs = require('fs');
const os = require('os');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
require(path.join(RUN, 'spirit', 'spirit.js'));
const J = require(path.join(RUN, 'spirit', 'joinStepsJob.js'));
const relayKeys = spirit.require('spirit/relayKeys.js');
const ownerBadge = spirit.require('spirit/ownerBadge.js');
const contacts = spirit.require('spirit/contacts.js');
const auth = spirit.require('spirit/relayAuth.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// A jobs table as job.js's: ownNews(id, kind, data) answers the job whose data is the news; every call is recorded.
function plantedJobs() {
  const said = [];
  const job = { id: 'spirit', data: {} };
  return { said: said, ownNews: function (id, kind, data) { said.push({ id: id, kind: kind, data: data }); job.data = data; return job; } };
}
const URL_ = 'https://relay.example';
const RELAY_KEY = 'relay-key-' + process.pid;
const W = { root: null, jobs: null, made: null, me: '' };
const NO_WORLD = 'no scratch node: the world failed';

test.run('the world: a scratch node root with an identity of its own, and nothing else', 0.2, function () {
  W.root = fs.mkdtempSync(path.join(os.tmpdir(), 'nr-join-'));
  try { auth.saveIdentity(W.root, auth.generateIdentity('joiner')); W.me = auth.loadIdentity(W.root).publicKey; } catch (e) { W.root = null; return 'no identity: ' + String(e && e.message); }
  return !!W.me || (W.root = null, 'no identity read back');
}, test.limit.quick);

// ── facts ──
test.run('facts on a node with nothing: not seated, no relay, no contact, no face; no email field', 0.2, function () {
  if (!W.root) return NO_WORLD;
  const f = J.facts(W.root);
  return short(f) === short({ seated: false, relayUrl: '', contact: false, face: '', faceUrl: '' }) || 'facts: ' + short(f);
}, test.limit.quick);
test.run('create publishes those facts at once, as news of spirit, kind join, { join } and nothing else', 0.2, function () {
  if (!W.root) return NO_WORLD;
  W.jobs = plantedJobs();
  W.made = J.create(W.root, W.jobs);
  const s = W.jobs.said[0] || {};
  return (W.jobs.said.length === 1 && s.id === 'spirit' && s.kind === 'join' && short(Object.keys(s.data || {})) === '["join"]' && s.data.join.seated === false && W.made.job.data === s.data) || 'said: ' + short(W.jobs.said);
}, test.limit.quick);
test.run('refresh with nothing changed publishes nothing and answers false', 0.2, function () {
  if (!W.made) return 'no job made: the world failed';
  const did = W.made.refresh('nothing');
  return (did === false && W.jobs.said.length === 1) || 'refresh answered ' + did + ', said ' + W.jobs.said.length;
}, test.limit.quick);
test.run('a relay listed and not seated: its url is the relay, still not seated', 0.2, function () {
  if (!W.root) return NO_WORLD;
  ownerBadge.addRelay(W.root, URL_, 'example', RELAY_KEY);
  const f = J.facts(W.root);
  return (f.seated === false && f.relayUrl === URL_) || 'facts: ' + short(f);
}, test.limit.quick);
test.run('refresh after a change publishes once and answers true', 0.2, function () {
  if (!W.made) return 'no job made: the world failed';
  const did = W.made.refresh('relay listed');
  const last = W.jobs.said[W.jobs.said.length - 1] || {};
  return (did === true && W.jobs.said.length === 2 && last.kind === 'join' && last.data.join.relayUrl === URL_) || 'refresh answered ' + did + ', said ' + short(W.jobs.said);
}, test.limit.quick);
test.run('a seat held there: seated', 0.2, function () {
  if (!W.root) return NO_WORLD;
  relayKeys.accept(W.root, URL_, RELAY_KEY);
  relayKeys.seat(W.root, URL_);
  const f = J.facts(W.root);
  return (f.seated === true && f.relayUrl === URL_ && f.face === '') || 'facts: ' + short(f);
}, test.limit.quick);
test.run('a face kept on that relay: the face name, and https://<face>.<relay host>', 0.2, function () {
  if (!W.root) return NO_WORLD;
  relayKeys.keepFace(W.root, URL_, 'andy');
  const f = J.facts(W.root);
  return (f.face === 'andy' && f.faceUrl === 'https://andy.relay.example') || 'facts: ' + short(f);
}, test.limit.quick);
test.run('contact: the relay and the node itself kept are no contact; anyone else kept is', 0.2, function () {
  if (!W.root) return NO_WORLD;
  contacts.acquire(W.root, { publicKey: RELAY_KEY });
  contacts.acquire(W.root, { publicKey: W.me });
  const before = J.facts(W.root).contact;
  contacts.acquire(W.root, { publicKey: 'friend-key-' + process.pid, publicLabel: 'friend' });
  const after = J.facts(W.root).contact;
  return (before === false && after === true) || 'contact before ' + before + ', after ' + after;
}, test.limit.quick);
test.run('the made job\'s facts() reads the records now, as facts(rootDir) does', 0.2, function () {
  if (!W.made) return 'no job made: the world failed';
  return short(W.made.facts()) === short(J.facts(W.root)) || 'facts(): ' + short(W.made.facts());
}, test.limit.quick);
test.run('facts never throw: a root with no records answers the empty facts', 0.2, function () {
  let f;
  try { f = J.facts(path.join(os.tmpdir(), 'nr-join-none-' + process.pid)); } catch (e) { return 'threw: ' + String(e && e.message); }
  return (f.seated === false && f.contact === false && f.relayUrl === '') || 'facts: ' + short(f);
}, test.limit.quick);
