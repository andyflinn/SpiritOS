'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const invites = require('../run/js/invites');
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

  // A second signed key is still how peer-by-key works, but since cycle 4
  // it needs an invite the owner minted for that label. Signed but
  // uninvited is refused.
  const stranger = auth.generateIdentity('groq');
  const uninvited = box.claim(
    'groq',
    auth.sign(stranger.privateKey, auth.claimMessage('groq')),
    stranger.publicKey
  );
  if (!uninvited.ok && uninvited.status === 403 && uninvited.error === 'invite required') {
    test.check('second key without an invite is refused');
  } else {
    test.fail('uninvited claim: ' + JSON.stringify(uninvited));
  }

  const groqInvite = box.mint(
    'andy',
    'groq',
    7,
    auth.sign(id.privateKey, invites.mintMessage('groq', 7))
  );
  const bad = box.claim(
    'groq',
    auth.sign(stranger.privateKey, auth.claimMessage('groq')),
    stranger.publicKey,
    '10.0.0.7',
    groqInvite.ok && groqInvite.invite.token
  );
  if (bad.ok && bad.status === 201) {
    test.check('second signed key with an invite claims after owner (peer-by-key)');
  } else {
    test.fail('invited claim: ' + JSON.stringify({ mint: groqInvite, claim: bad }));
  }

  // Chatting to the mailbox is a console now (CYCLE-RELAY-CONSOLE): the
  // gate is the same isOwner() the census always used, and the answer
  // comes home in the send response instead of the mailbox — nothing of
  // a console exchange is persisted, because `messages` is a 200-entry
  // ring holding every peer's undelivered mail.
  const sendSig = auth.sign(id.privateKey, auth.sendMessage('andy', 'relay', 'status'));
  const sent = box.send('andy', 'relay', 'status', sendSig);
  if (sent.ok) {
    test.check('owner can send to reserved name relay');
  } else {
    test.fail('send to relay: ' + JSON.stringify(sent));
  }

  if (sent.consoleReply && /owner andy/.test(sent.consoleReply.text)) {
    test.check('and the mailbox answers the owner with the census');
  } else {
    test.fail('console reply: ' + JSON.stringify(sent));
  }

  // Not in the mailbox: the owner's own inbox holds no console traffic,
  // so a friend's undelivered line is never evicted by one.
  const box2 = createRelay(home);
  const inbox = box2.inbox('andy', auth.sign(id.privateKey, auth.inboxMessage('andy')));
  const fromRelay = (inbox.messages || []).filter(function (m) { return m.from === 'relay'; });
  if (inbox.ok && fromRelay.length === 0) {
    test.check('and none of it was stored in the mailbox');
  } else {
    test.fail('inbox: ' + JSON.stringify(inbox));
  }

  // A second signed key on the mailbox is fine (that is how two johns
  // work) but it is not the owner, so chatting to `relay` gets it
  // nothing but the console saying whose word that is.
  const strangerSend = box2.send(
    'groq', 'relay', 'status',
    auth.sign(stranger.privateKey, auth.sendMessage('groq', 'relay', 'status'))
  );
  const strangerInbox = box2.inbox('groq', auth.sign(stranger.privateKey, auth.inboxMessage('groq')));
  const census = (strangerInbox.messages || []).filter(function (m) { return m.from === 'relay'; });
  const refused = strangerSend.consoleReply && strangerSend.consoleReply.text;
  if (strangerSend.ok && census.length === 0 && !/owner=|owner andy/.test(String(refused))) {
    test.check('a non-owner sending to relay gets no status line back');
  } else {
    test.fail('stranger census: ' + JSON.stringify(census) + ' send ' + JSON.stringify(strangerSend));
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

