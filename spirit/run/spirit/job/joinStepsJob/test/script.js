'use strict';

// spirit/run/spirit/job/joinStepsJob/test/script.js
// The tests of spirit/job/joinStepsJob/script.js, and of no other module (spec: ./script.md). Its own test, owed since the
// rule "every production script has its own test" (goal/G47.1, box v72).
//
// Where the join steps stand, as a stream (goal/G30.1, goal/G43.20): facts(rootDir) read from the node's own records,
// published as news of the job spirit, kind join, only when they change. Run in process on a scratch root under the
// temp folder; the jobs table is a planted one that records each ownNews it is asked.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const S = require(path.join(RUN, 'spirit', 'script.js'));
const test = S.requireScript('spirit/test/testReport.js');
// ITS TEMP FOLDERS FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"): one of its own for each
// it asks, under its suite's path, the whole of it removed when the suite ends.
const tempFolder = require('../../../tempFolder/script.js').tempFolder;
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/test/joinStepsJob/' + name + tempAsked); }
// ITS STORES CLOSED BEFORE ITS FOLDER GOES (goal/G48.4; Andy, of the 0.7s: "it leaves no temp folder behind"): on Windows a
// folder holding an open database cannot be removed, and nodeStore keeps each store it opened open; every one under the
// suite's folder (a node.db at <root>/spirit/state/node.db) is closed first.
function closeStoresUnder(top) {
  const NS = S.requireScript('spirit/nodeStore/script.js');
  (function walk(dir, depth) {
    let names = [];
    try { names = fs.readdirSync(dir); } catch (e) { return; }
    if (names.indexOf('node.db') !== -1 && path.basename(dir) === 'state') { try { NS.open(path.dirname(path.dirname(dir))).close(); } catch (e) { /* closed */ } }
    if (depth > 6) return;
    names.forEach(function (n) { const p = path.join(dir, n); try { if (fs.statSync(p).isDirectory()) walk(p, depth + 1); } catch (e) { /* gone */ } });
  }(top, 0));
}
test.after(function () {
  const top = tempFolder.path('spirit/test/joinStepsJob');
  closeStoresUnder(top);
  try { fs.rmSync(top, { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ }
});
require(path.join(RUN, 'spirit', 'script.js'));
const J = S.requireScript('spirit/job/joinStepsJob/script.js');
const relayKeys = spirit.requireScript('spirit/peer/relay/key/script.js');
const ownerBadge = spirit.requireScript('spirit/ownerBadge/script.js');
const contacts = spirit.requireScript('spirit/contact/engine/script.js');
const auth = spirit.requireScript('spirit/relayAuth/script.js');

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

test.run('a scratch node root is made with an identity of its own and nothing else', 0.2, function () {
  W.root = ownTemp('nr-join-');
  try { auth.saveIdentity(W.root, auth.generateIdentity('joiner')); W.me = auth.loadIdentity(W.root).publicKey; } catch (e) { W.root = null; return false; }
  return !!W.me || (W.root = null, false);
}, test.limit.quick);

// ── facts ──
test.run('the facts of a node with nothing say it is not seated and has no relay, no contact and no face, and they carry no email field', 0.2, function () {
  if (!W.root) return false;
  const f = J.facts(W.root);
  return short(f) === short({ seated: false, relayUrl: '', contact: false, face: '', faceUrl: '' }) || false;
}, test.limit.quick);
test.run('create publishes those facts at once, as news of spirit of the kind join, carrying the join facts and nothing else', 0.2, function () {
  if (!W.root) return false;
  W.jobs = plantedJobs();
  W.made = J.create(W.root, W.jobs);
  const s = W.jobs.said[0] || {};
  return (W.jobs.said.length === 1 && s.id === 'spirit' && s.kind === 'join' && short(Object.keys(s.data || {})) === '["join"]' && s.data.join.seated === false && W.made.job.data === s.data) || false;
}, test.limit.quick);
test.run('refresh with nothing changed publishes nothing and answers false', 0.2, function () {
  if (!W.made) return false;
  const did = W.made.refresh('nothing');
  return (did === false && W.jobs.said.length === 1) || false;
}, test.limit.quick);
test.run('with a relay listed and no seat, the facts name the relay\'s url and the node is still not seated', 0.2, function () {
  if (!W.root) return false;
  ownerBadge.addRelay(W.root, URL_, 'example', RELAY_KEY);
  const f = J.facts(W.root);
  return (f.seated === false && f.relayUrl === URL_) || false;
}, test.limit.quick);
test.run('refresh after a change publishes once and answers true', 0.2, function () {
  if (!W.made) return false;
  const did = W.made.refresh('relay listed');
  const last = W.jobs.said[W.jobs.said.length - 1] || {};
  return (did === true && W.jobs.said.length === 2 && last.kind === 'join' && last.data.join.relayUrl === URL_) || false;
}, test.limit.quick);
test.run('with a seat held on that relay, the node is seated', 0.2, function () {
  if (!W.root) return false;
  relayKeys.accept(W.root, URL_, RELAY_KEY);
  relayKeys.seat(W.root, URL_);
  const f = J.facts(W.root);
  return (f.seated === true && f.relayUrl === URL_ && f.face === '') || false;
}, test.limit.quick);
test.run('with a face kept on that relay, the facts carry the face name and its url, https://<face>.<relay host>', 0.2, function () {
  if (!W.root) return false;
  relayKeys.keepFace(W.root, URL_, 'andy');
  const f = J.facts(W.root);
  return (f.face === 'andy' && f.faceUrl === 'https://andy.relay.example') || false;
}, test.limit.quick);
test.run('the relay and the node itself, when kept, do not count as a contact, but anyone else kept does', 0.2, function () {
  if (!W.root) return false;
  contacts.acquire(W.root, { publicKey: RELAY_KEY });
  contacts.acquire(W.root, { publicKey: W.me });
  const before = J.facts(W.root).contact;
  contacts.acquire(W.root, { publicKey: 'friend-key-' + process.pid, publicLabel: 'friend' });
  const after = J.facts(W.root).contact;
  return (before === false && after === true) || false;
}, test.limit.quick);
test.run('the made job\'s facts() reads the records now, as facts(rootDir) does', 0.2, function () {
  if (!W.made) return false;
  return short(W.made.facts()) === short(J.facts(W.root)) || false;
}, test.limit.quick);
test.run('facts never throw, and a root with no records answers the empty facts', 0.2, function () {
  let f;
  try { f = J.facts(tempFolder.path('spirit/test/joinStepsJob/none')); } catch (e) { return false; }
  return (f.seated === false && f.contact === false && f.relayUrl === '') || false;
}, test.limit.quick);
