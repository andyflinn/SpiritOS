'use strict';

// The mailbox answers words (CYCLE-RELAY-CONSOLE-IMPL.md).
//
// Two halves are tested here, and the second is the one that could hurt:
//
//   1. relayConsole.js as a module — it opens nothing, decides no
//      permission, and every command is a function of what it was handed.
//   2. relay.js's send path — the same owner gate as the census it
//      replaces, and NOTHING of a console exchange persisted, because
//      `messages` is a 200-entry ring shared with every peer's
//      undelivered mail and a console writing two entries per command
//      would evict the oldest real thing anyone said.
//
// What must never appear in a reply: an invite token, a peer's whole
// key, anything out of allow.json.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const invites = require('../run/js/invites');
const relayConsole = require('../run/js/relayConsole');
const { createRelay } = require('../run/js/relay');

function tmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-console-'));
}

// A mailbox with a key of its own (made on the first --relay boot in
// production; here by hand), an owner, and one invited friend.
function ownedBox() {
  const home = tmpHome();
  auth.saveIdentity(home, auth.generateIdentity('relay'));
  const box = createRelay(home);
  const owner = auth.generateIdentity('andy');
  box.claim('andy', auth.sign(owner.privateKey, auth.claimMessage('andy')), owner.publicKey, '10.0.0.1');
  return { home: home, box: box, owner: owner };
}

function say(box, id, label, text) {
  return box.send(label, 'relay', text, auth.sign(id.privateKey, auth.sendMessage(label, 'relay', text)), '10.0.0.9');
}

function ringSize(home) {
  try {
    return JSON.parse(fs.readFileSync(path.join(home, 'relay-state', 'mailbox.json'), 'utf8')).messages.length;
  } catch (e) {
    return -1;
  }
}

function ctx(over) {
  const base = {
    isOwner: true,
    snapshot: { mode: 'keys', owner: 'andy', peers: [{ publicLabel: 'andy' }], messages: 3 },
    peers: [],
    invites: [],
    mailboxPublicKey: 'MAILBOX-KEY',
    now: Date.parse('2026-09-07T12:00:00.000Z'),
    version: '0.0.1',
    senderKey: 'SENDER-KEY',
    senderLabel: 'andy',
  };
  Object.keys(over || {}).forEach(function (k) { base[k] = over[k]; });
  return base;
}

test.startTest('Relay console — the mailbox answers words');

test.subHeading('Who may say what');

{
  const ownerWords = relayConsole.wordsFor(true);
  const publicWords = relayConsole.wordsFor(false);

  if (ownerWords.indexOf('status') !== -1 && publicWords.indexOf('status') === -1) {
    test.check('help lists an owner word for the owner and not for anyone else');
  } else {
    test.fail('words: ' + JSON.stringify({ owner: ownerWords, other: publicWords }));
  }

  if (publicWords.indexOf('help') !== -1 && publicWords.indexOf('whoami') !== -1 && publicWords.length === 2) {
    test.check('a friend is offered exactly help and whoami');
  } else {
    test.fail('public words: ' + JSON.stringify(publicWords));
  }

  // Not "unknown word": a friend who typed a real word did not mistype,
  // and this repo is public, so the list is no secret. Silence would only
  // confuse the one person who is not an attacker.
  const refused = relayConsole.handle('status', ctx({ isOwner: false }));
  if (refused.reply === "that one is the owner's") {
    test.check('a friend typing an owner word is told whose it is, not that it does not exist');
  } else {
    test.fail('refusal: ' + JSON.stringify(refused));
  }

  const leaked = relayConsole.OWNER_WORDS.filter(function (word) {
    const answer = relayConsole.handle(word + ' x', ctx({ isOwner: false }));
    return answer.reply !== "that one is the owner's";
  });
  if (leaked.length === 0) {
    test.check('every owner word refuses a friend, args or no args');
  } else {
    test.fail('leaked to a non-owner: ' + leaked.join(', '));
  }

  // whoami is about the sender and nobody else, which is how a friend
  // whose claim went wrong finds out what the mailbox thinks they are.
  const mine = relayConsole.handle('whoami', ctx({ isOwner: false, senderLabel: 'saint', senderKey: 'SAINT-KEY' }));
  if (mine.reply.indexOf('saint') !== -1 && mine.reply.indexOf('SAINT-KEY') !== -1 &&
      mine.reply.indexOf('owner') === -1) {
    test.check('whoami answers a friend about themselves');
  } else {
    test.fail('whoami: ' + JSON.stringify(mine));
  }
}

test.subHeading('What a reply may carry');

{
  const token = 'blue-fish-secret';
  const live = [
    { token: token, label: 'saint', expiresAt: '2026-09-20T00:00:00.000Z', invitedBy: 'andy', consumedAt: null },
    { token: 'burned', label: 'gone', expiresAt: '2026-09-20T00:00:00.000Z', invitedBy: 'andy', consumedAt: '2026-09-07T00:00:00.000Z' },
    { token: 'stale', label: 'expired', expiresAt: '2026-09-01T00:00:00.000Z', invitedBy: 'andy', consumedAt: null },
  ];

  const answer = relayConsole.handle('invites', ctx({ invites: live }));
  if (answer.reply.indexOf(token) === -1 && answer.reply.indexOf('burned') === -1 && answer.reply.indexOf('stale') === -1) {
    test.check('no invite token reaches the thread — that is the only secret in the row');
  } else {
    test.fail('invites reply carried a token: ' + answer.reply);
  }

  if (answer.reply.indexOf('saint') !== -1 && answer.reply.indexOf('gone') === -1 && answer.reply.indexOf('expired') === -1) {
    test.check('and a consumed or expired invite is not advertised as a way in');
  } else {
    test.fail('invites reply: ' + answer.reply);
  }

  if (/^1 live/.test(answer.reply)) {
    test.check('the count is the live count');
  } else {
    test.fail('count line: ' + answer.reply.split('\n')[0]);
  }

  // A peer row is what `who` already publishes: caption, and whether a
  // key is there. Not the key itself, and never myLabel — that lives on
  // a personal node the mailbox has never seen.
  const peers = [{ publicLabel: 'andy', publicKey: 'MCowBQYDK2VwAyEAWHOLEKEY', owner: true }];
  const listed = relayConsole.handle('peers', ctx({ peers: peers }));
  if (listed.reply.indexOf('MCowBQYDK2VwAyEAWHOLEKEY') === -1 && listed.reply.indexOf('andy') !== -1 &&
      listed.reply.indexOf('key') !== -1) {
    test.check('peers says a key is present without printing it');
  } else {
    test.fail('peers reply: ' + listed.reply);
  }
}

test.subHeading('Caps, in rows and in bytes');

{
  const many = [];
  for (let i = 0; i < 200; i++) many.push({ publicLabel: 'peer' + i, publicKey: 'K' + i });

  const capped = relayConsole.handle('peers', ctx({ peers: many, cap: { rows: 5, bytes: 10000 } }));
  const lines = capped.reply.split('\n');
  if (lines.length === 6 && /^… 195 more$/.test(lines[5])) {
    test.check('a long list is cut to the row cap and says how much it cut');
  } else {
    test.fail('rows: ' + JSON.stringify(lines));
  }

  // Rows alone is not a cap: on a busy mailbox the bytes are what would
  // land in a reply nothing checks the length of.
  const long = [];
  for (let i = 0; i < 50; i++) long.push({ publicLabel: 'x'.repeat(200) + i });
  const byBytes = relayConsole.handle('peers', ctx({ peers: long, cap: { rows: 50, bytes: 800 } }));
  if (byBytes.reply.length <= 900 && /more$/.test(byBytes.reply)) {
    test.check('and the byte cap cuts a reply the row cap would have let through');
  } else {
    test.fail('bytes: ' + byBytes.reply.length);
  }
}

test.subHeading('Search');

{
  const peers = [
    { publicLabel: 'andy', publicKey: 'MCowBQYDK2VwAyEAaaaaaaaaTAIL-ONE-1' },
    { publicLabel: 'saint', publicKey: 'MCowBQYDK2VwAyEAbbbbbbbbTAIL-TWO-2' },
    { publicLabel: 'sandy', publicKey: 'MCowBQYDK2VwAyEAccccccccTAIL-THREE' },
  ];

  const hits = relayConsole.handle('search andy', ctx({ peers: peers }));
  if (hits.reply.indexOf('andy') !== -1 && hits.reply.indexOf('sandy') !== -1 && hits.reply.indexOf('saint') === -1) {
    test.check('a needle matches a caption anywhere in it');
  } else {
    test.fail('search andy: ' + hits.reply);
  }

  // Long enough to mean it: a key tail matches, and a two-letter
  // fragment of one does not, because that is a coincidence.
  const byTail = relayConsole.handle('search TAIL-TWO-2', ctx({ peers: peers }));
  if (byTail.reply.indexOf('saint') !== -1 && byTail.reply.indexOf('andy') === -1) {
    test.check('a long key tail finds the peer it belongs to');
  } else {
    test.fail('search by tail: ' + byTail.reply);
  }

  // Short is a coincidence, not a search: a two-letter fragment of a key
  // would match most of the mailbox, so only a needle long enough to
  // mean it is tried against keys at all.
  const tooShort = relayConsole.handle('search bbb', ctx({ peers: peers }));
  if (/nobody here matches/.test(tooShort.reply)) {
    test.check('a short fragment is not treated as a key tail');
  } else {
    test.fail('short fragment matched: ' + tooShort.reply);
  }

  const nothing = relayConsole.handle('search nobodyhere', ctx({ peers: peers }));
  if (/nobody here matches/.test(nothing.reply)) {
    test.check('no match says so rather than answering with an empty line');
  } else {
    test.fail('empty search: ' + nothing.reply);
  }

  const bare = relayConsole.handle('search', ctx({ peers: peers }));
  if (/search what/.test(bare.reply)) {
    test.check('search with nothing to search for asks for a needle');
  } else {
    test.fail('bare search: ' + bare.reply);
  }
}

test.subHeading('The rest of the first cut');

{
  const status = relayConsole.handle('status', ctx());
  if (/mode keys/.test(status.reply) && /owner andy/.test(status.reply) && /messages 3/.test(status.reply)) {
    test.check('status is the census: mode, owner, peers, messages');
  } else {
    test.fail('status: ' + status.reply);
  }

  const key = relayConsole.handle('key', ctx());
  if (key.reply === 'MAILBOX-KEY') {
    test.check('key is the mailbox key, which is the half meant to be handed out');
  } else {
    test.fail('key: ' + key.reply);
  }

  const noKey = relayConsole.handle('key', ctx({ mailboxPublicKey: null }));
  if (/no key of its own/.test(noKey.reply)) {
    test.check('and a mailbox without one says so rather than answering blank');
  } else {
    test.fail('keyless: ' + noKey.reply);
  }

  if (relayConsole.handle('version', ctx()).reply === '0.0.1') {
    test.check('version answers "did my update land?" without an SSH session');
  } else {
    test.fail('version: ' + relayConsole.handle('version', ctx()).reply);
  }

  const unknown = relayConsole.handle('wibble', ctx());
  if (/I do not know/.test(unknown.reply) && /words I answer/.test(unknown.reply)) {
    test.check('an unknown word answers with help');
  } else {
    test.fail('unknown: ' + unknown.reply);
  }

  if (relayConsole.handle('   ', ctx()) === null && relayConsole.handle(null, ctx()) === null) {
    test.check('nothing typed is nothing answered');
  } else {
    test.fail('empty input produced a reply');
  }

  // The command is the first word, whatever case it was typed in.
  if (relayConsole.handle('STATUS', ctx()).reply === relayConsole.handle('status', ctx()).reply) {
    test.check('the word is read case-insensitively');
  } else {
    test.fail('case sensitivity in the parser');
  }
}

test.subHeading('Through relay.js: the gate, and the ring');

{
  const r = ownedBox();
  const before = ringSize(r.home);

  const answered = say(r.box, r.owner, 'andy', 'status');
  if (answered.ok && answered.consoleReply && /owner andy/.test(answered.consoleReply.text)) {
    test.check('the owner typing at the mailbox gets the census back');
  } else {
    test.fail('owner status: ' + JSON.stringify(answered));
  }

  // The gate that mattered before this cycle and matters after it: the
  // census is the owner's, and a peer who merely claimed a key is not
  // the owner.
  const mint = r.box.mint('andy', 'saint', 7, auth.sign(r.owner.privateKey, invites.mintMessage('saint', 7)));
  const saint = auth.generateIdentity('saint');
  r.box.claim('saint', auth.sign(saint.privateKey, auth.claimMessage('saint')), saint.publicKey, '10.0.0.2', mint.invite.token);

  const friend = say(r.box, saint, 'saint', 'status');
  if (friend.ok && friend.consoleReply && friend.consoleReply.text === "that one is the owner's") {
    test.check('a claimed non-owner gets no census out of it');
  } else {
    test.fail('friend status: ' + JSON.stringify(friend));
  }

  const friendPeers = say(r.box, saint, 'saint', 'peers');
  if (friendPeers.consoleReply.text.indexOf('andy') === -1) {
    test.check('and cannot enumerate the mailbox by asking for peers');
  } else {
    test.fail('peers leaked to a friend: ' + friendPeers.consoleReply.text);
  }

  if (ringSize(r.home) === before) {
    test.check('none of it was persisted — the 200-message ring has not grown');
  } else {
    test.fail('ring grew from ' + before + ' to ' + ringSize(r.home));
  }

  // The ring is where a friend's undelivered mail waits. A console that
  // stored its own chatter would evict the oldest real thing said.
  const bert = auth.generateIdentity('bert');
  const bertInvite = r.box.mint('andy', 'bert', 7, auth.sign(r.owner.privateKey, invites.mintMessage('bert', 7)));
  r.box.claim('bert', auth.sign(bert.privateKey, auth.claimMessage('bert')), bert.publicKey, '10.0.0.3', bertInvite.invite.token);
  r.box.send('andy', 'bert', 'real mail', auth.sign(r.owner.privateKey, auth.sendMessage('andy', 'bert', 'real mail')), '10.0.0.1');
  const withMail = ringSize(r.home);

  ['help', 'status', 'peers', 'version', 'whoami', 'key'].forEach(function (word) {
    say(r.box, r.owner, 'andy', word);
  });

  if (ringSize(r.home) === withMail) {
    test.check('six commands later the ring still holds exactly the real mail');
  } else {
    test.fail('ring went from ' + withMail + ' to ' + ringSize(r.home));
  }

  const bertInbox = r.box.inbox('bert', auth.sign(bert.privateKey, auth.inboxMessage('bert')));
  if (bertInbox.ok && bertInbox.messages.length === 1 && bertInbox.messages[0].text === 'real mail') {
    test.check("and the friend's undelivered line is still there to read");
  } else {
    test.fail('bert inbox: ' + JSON.stringify(bertInbox));
  }
}

test.subHeading('A reply follows the key, not the caption');

{
  const r = ownedBox();
  const answered = say(r.box, r.owner, 'andy', 'help');
  const reply = answered.consoleReply;

  if (reply.toKey === r.owner.publicKey && reply.fromKey === r.box.mailboxPublicKey()) {
    test.check('the reply carries the sender key and the mailbox key');
  } else {
    test.fail('reply keys: ' + JSON.stringify({ toKey: reply.toKey, fromKey: reply.fromKey }));
  }

  // Two peers can share a public caption. A label-addressed reply would
  // be unreadable by both of them (inbox refuses an ambiguous label), so
  // the key is what a personal node files it under.
  if (answered.message.toKey === r.box.mailboxPublicKey() && answered.message.from === 'andy') {
    test.check('and the command itself is addressed to the mailbox key');
  } else {
    test.fail('command keys: ' + JSON.stringify(answered.message));
  }

  // Ordinary mail is untouched by any of this.
  const bert = auth.generateIdentity('bert');
  const bertInvite = r.box.mint('andy', 'bert', 7, auth.sign(r.owner.privateKey, invites.mintMessage('bert', 7)));
  r.box.claim('bert', auth.sign(bert.privateKey, auth.claimMessage('bert')), bert.publicKey, '10.0.0.3', bertInvite.invite.token);
  const plain = r.box.send('andy', 'bert', 'hello', auth.sign(r.owner.privateKey, auth.sendMessage('andy', 'bert', 'hello')), '10.0.0.1');
  if (plain.ok && plain.message && !plain.consoleReply && plain.message.id === '1') {
    test.check('a message to a person is still mail, numbered and stored');
  } else {
    test.fail('ordinary send: ' + JSON.stringify(plain));
  }
}

test.reportSuccessFailureCount();
