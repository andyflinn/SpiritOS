'use strict';

// cleanup/G1.7: an owned server keeps its owner's key in relay-state/owner.json, { owner } only.
// Andy: "every server keeps its identity in a file of the same name. every owned server keeps its owners key in a file of the same name."
// The contract the builder follows:
//   relayAuth.loadOwner(rootDir) -> the key, '' when there is none; relayAuth.writeOwner(rootDir, key)
//   the relay knows its owner by key only; its name comes from its member row
//   a node is a puppet when relay-state/owner.json names a key; carries is gone

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const puppetMode = require('../run/js/puppetMode');
const { createRelay } = require('../run/js/relay');
const world = require('./world');
const UNCLAIMED = require('./scenario').UNCLAIMED;

const REPO = path.join(__dirname, '..', '..');
const OWED = 'OWED by cleanup/G1.7: ';
const HAS = typeof auth.loadOwner === 'function' && typeof auth.writeOwner === 'function';

function ownerFileOf(root) {
  try { return JSON.parse(fs.readFileSync(path.join(root, 'relay-state', 'owner.json'), 'utf8')); } catch (e) { return null; }
}
function plantOwner(root, key) {
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(root, 'relay-state', 'owner.json'), JSON.stringify({ owner: key }));
}

test.startTest('cleanup/G1.7: an owned server keeps its owner in owner.json');

test.subHeading('one reader and one writer, in relayAuth');
{
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-owner-file-'));
  const key = auth.generateIdentity('andy').publicKey;
  if (!HAS) {
    test.fail(OWED + 'relayAuth has no loadOwner and writeOwner');
  } else {
    if (auth.loadOwner(root) === '') test.check('no owner.json: loadOwner answers \'\'');
    else test.fail(OWED + 'loadOwner on an empty home: ' + JSON.stringify(auth.loadOwner(root)));
    auth.writeOwner(root, key);
    const doc = ownerFileOf(root);
    if (doc && Object.keys(doc).join() === 'owner' && doc.owner === key) test.check('writeOwner writes relay-state/owner.json as { owner } and nothing else');
    else test.fail(OWED + 'owner.json after writeOwner: ' + JSON.stringify(doc));
    if (auth.loadOwner(root) === key) test.check('loadOwner reads the key back');
    else test.fail(OWED + 'loadOwner after writeOwner: ' + JSON.stringify(auth.loadOwner(root)));
  }
  const old = ['loadAllow', 'writeAllowKeys', 'ownerName'].filter(function (n) { return n in auth; });
  if (!old.length) test.check('relayAuth no longer exports loadAllow, writeAllowKeys or ownerName');
  else test.fail(OWED + 'relayAuth still exports ' + old.join(', '));
  fs.rmSync(root, { recursive: true, force: true });
}

test.subHeading('the relay: the first owner claim writes owner.json, and allow.json is never written');
{
  const made = world.build(UNCLAIMED);
  const home = made.home;
  const id = auth.generateIdentity('andy');
  const sig = auth.sign(id.privateKey, auth.claimMessage('andy'));
  const ownerInvite = require('../run/js/invites').mintOwner(home, 'andy', 1);
  const first = made.box.claim('andy', sig, id.publicKey, '10.0.0.1', ownerInvite.token, 'andy');
  const doc = ownerFileOf(home);
  if (first.ok && first.owner === true && doc && doc.owner === id.publicKey && Object.keys(doc).join() === 'owner') test.check('the owner claim wrote owner.json as { owner: <its key> }');
  else test.fail(OWED + 'after the owner claim: ' + JSON.stringify({ claim: first, ownerJson: doc }).slice(0, 200));
  if (!fs.existsSync(path.join(home, 'relay-state', 'allow.json'))) test.check('and no allow.json');
  else test.fail(OWED + 'the relay still wrote allow.json');
  const named = createRelay(home).ownerPublic();
  if (named.ownerKey === id.publicKey && named.ownerLabel === 'andy') test.check('ownerPublic names the key, and the name from its member row');
  else test.fail(OWED + 'ownerPublic: ' + JSON.stringify(named));
}

test.subHeading('the relay knows its owner by key: owner.json alone lets the owner back in');
{
  const made = world.build(UNCLAIMED);
  const home = made.home;
  const id = auth.generateIdentity('andy');
  plantOwner(home, id.publicKey);
  const box = createRelay(home);
  const back = box.claim('andy', auth.sign(id.privateKey, auth.claimMessage('andy')), id.publicKey);
  if (back.ok) test.check('the key in owner.json claims with no invite, as after a restore');
  else test.fail(OWED + 'the owner\'s key with only owner.json: ' + JSON.stringify(back));
  const stranger = auth.generateIdentity('eve');
  const eve = box.claim('eve', auth.sign(stranger.privateKey, auth.claimMessage('eve')), stranger.publicKey);
  if (!eve.ok && eve.status === 403) test.check('another key without an invite is still refused');
  else test.fail('a stranger on an owned relay: ' + JSON.stringify(eve));
  const named = box.ownerPublic();
  if (named.ownerKey === id.publicKey) test.check('ownerPublic names the key from owner.json');
  else test.fail(OWED + 'ownerPublic with owner.json: ' + JSON.stringify(named));
}

test.subHeading('a junk owner.json is no owner, on the relay too');
{
  const made = world.build(UNCLAIMED);
  const home = made.home;
  plantOwner(home, 'not-a-key');
  const named = createRelay(home).ownerPublic();
  if (HAS && auth.loadOwner(home) === '' && named.ownerKey === '') test.check('owner.json naming no Ed25519 key: loadOwner and ownerPublic say no owner');
  else test.fail(OWED + 'junk owner.json read as ' + JSON.stringify({ loadOwner: HAS ? auth.loadOwner(home) : 'absent', ownerPublic: named }));
}

// The node's one reading of its owner is puppetMode.puppetIn (goal/G13.2: the booted app that once
// read it through api.owner() is gone, and the node starts no servers differently for a puppet).
test.subHeading('a node is a puppet when owner.json names a key');
{
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-owner-node-'));
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  const puppet = puppetMode.puppetIn(root, function () {});
  const key = auth.generateIdentity('owner').publicKey;
  fs.writeFileSync(path.join(root, 'relay-state', 'puppet.json'), JSON.stringify({ owner: key, carries: [] }));
  if (puppet().owner === '' && puppet().puppet === false) test.check('a puppet.json alone makes no owner');
  else test.fail(OWED + 'puppet.json is still read: puppetIn says ' + JSON.stringify(puppet()));
  fs.unlinkSync(path.join(root, 'relay-state', 'puppet.json'));
  plantOwner(root, key);
  if (puppet().owner === key && puppet().puppet === true) test.check('owner.json { owner } makes the node a puppet of that key, read on every call');
  else test.fail(OWED + 'with owner.json, puppetIn says ' + JSON.stringify(puppet()));
  fs.rmSync(root, { recursive: true, force: true });
}

test.subHeading('a node may own itself: owner.json naming its own ID is not a puppet');
{
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-owner-self-'));
  auth.ensureIdentity(root, 'self');
  const self = JSON.parse(fs.readFileSync(path.join(root, 'relay-state', 'identity.json'), 'utf8')).publicKey;
  const puppet = puppetMode.puppetIn(root, function () {});
  plantOwner(root, self);
  if (puppet().puppet === false && puppet().owner === '') test.check('owner.json with the node\'s own key: not a puppet');
  else test.fail(OWED + 'a node owning itself was taken for a puppet');
  plantOwner(root, auth.generateIdentity('other').publicKey);
  if (puppet().puppet === true) test.check('owner.json with another key: a puppet');
  else test.fail(OWED + 'owner.json naming another key did not make a puppet');
  fs.rmSync(root, { recursive: true, force: true });
}

test.subHeading('no code names allow.json, puppet.json, byName or carries');
{
  const files = execSync('git ls-files spirit/run bash', { cwd: REPO, encoding: 'utf8' }).split('\n')
    .filter(function (f) { return /\.js$/.test(f) || /^bash\/[^./]+$/.test(f); });
  const naming = [];
  files.forEach(function (f) {
    let t = '';
    try { t = fs.readFileSync(path.join(REPO, f), 'utf8'); } catch (e) { return; }
    t = /\.js$/.test(f)
      ? t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1')
      : t.replace(/^\s*#.*$/mg, '');
    const re = /puppetMode\.js$|^bash\/face-install$/.test(f) ? /allow\.json|puppet\.json|byName|carries/ : /allow\.json|puppet\.json|byName/;
    if (re.test(t)) naming.push(f);
  });
  if (files.length > 100 && !naming.length) test.check('none of ' + files.length + ' tracked code files names them');
  else test.fail(OWED + (files.length > 100 ? 'still named in: ' + naming.join(', ') : 'git ls-files listed only ' + files.length + ' files'));
}

test.reportSuccessFailureCount();
