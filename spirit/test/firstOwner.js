'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const { createRelay } = require('../run/js/relay');

function tmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-first-owner-'));
}

test.startTest('First claim is owner; chat to reserved name relay');

{
  const home = tmpHome();
  const box = createRelay(home);
  const id = auth.generateIdentity('andy');
  const sig = auth.sign(id.privateKey, auth.claimMessage('andy'));

  const first = box.claim('andy', sig, id.publicKey);
  if (first.ok && first.status === 201 && first.owner === true) {
    test.check('first signed claim becomes owner');
  } else {
    test.fail('first claim: ' + JSON.stringify(first));
  }

  const allow = auth.loadAllow(home);
  if (allow.mode === 'keys' && allow.byName.andy === id.publicKey) {
    test.check('allow.json written as keys for andy');
  } else {
    test.fail('allow after first claim: ' + JSON.stringify(allow));
  }

  const reserved = box.claim('relay', sig, id.publicKey);
  if (!reserved.ok && reserved.status === 400) {
    test.check('name "relay" is reserved');
  } else {
    test.fail('reserved claim: ' + JSON.stringify(reserved));
  }

  const stranger = auth.generateIdentity('groq');
  const bad = box.claim(
    'groq',
    auth.sign(stranger.privateKey, auth.claimMessage('groq')),
    stranger.publicKey
  );
  if (bad.ok && bad.status === 201) {
    test.check('second signed key may claim after owner (peer-by-key)');
  } else {
    test.fail('stranger claim: ' + JSON.stringify(bad));
  }

  const sendSig = auth.sign(id.privateKey, auth.sendMessage('andy', 'relay', 'status?'));
  const sent = box.send('andy', 'relay', 'status?', sendSig);
  if (sent.ok) {
    test.check('owner can send to reserved name relay');
  } else {
    test.fail('send to relay: ' + JSON.stringify(sent));
  }

  const box2 = createRelay(home);
  const inbox = box2.inbox('andy');
  const fromRelay = (inbox.messages || []).filter(function (m) { return m.from === 'relay'; });
  if (fromRelay.length === 1 && /owner=andy/.test(fromRelay[0].text)) {
    test.check('relay replies in owner inbox with status');
  } else {
    test.fail('inbox: ' + JSON.stringify(inbox));
  }

  const stSig = auth.sign(id.privateKey, auth.statusMessage('andy'));
  const st = box2.status('andy', stSig);
  if (st.ok && st.report && st.report.owner === 'andy' && st.report.mode === 'keys') {
    test.check('owner-only status report');
  } else {
    test.fail('status: ' + JSON.stringify(st));
  }

  const nosig = box2.status('andy', '');
  if (!nosig.ok && nosig.status === 403) {
    test.check('status without sig is refused');
  } else {
    test.fail('status nosig: ' + JSON.stringify(nosig));
  }
}

{
  const home = tmpHome();
  const box = createRelay(home);
  const unsigned = box.claim('andy', null, null);
  if (!unsigned.ok && unsigned.status === 400) {
    test.check('open mailbox rejects unsigned first claim');
  } else {
    test.fail('unsigned first: ' + JSON.stringify(unsigned));
  }
}

{
  const home = tmpHome();
  auth.writePendingOwner(home, 'andy');
  const box = createRelay(home);
  const other = auth.generateIdentity('eve');
  const eve = box.claim(
    'eve',
    auth.sign(other.privateKey, auth.claimMessage('eve')),
    other.publicKey
  );
  if (!eve.ok && eve.status === 403) {
    test.check('pending owner name blocks a stranger name');
  } else {
    test.fail('eve vs pending andy: ' + JSON.stringify(eve));
  }
  const id = auth.generateIdentity('andy');
  const ok = box.claim(
    'andy',
    auth.sign(id.privateKey, auth.claimMessage('andy')),
    id.publicKey
  );
  if (ok.ok && ok.owner) {
    test.check('pending name andy + laptop key becomes owner');
  } else {
    test.fail('pending andy claim: ' + JSON.stringify(ok));
  }
  if (auth.loadPendingOwner(home) === null) {
    test.check('pending-owner.json cleared after first claim');
  } else {
    test.fail('pending owner still on disk');
  }
}

test.reportSuccessFailureCount();

