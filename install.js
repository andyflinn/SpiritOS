#!/usr/bin/env node
'use strict';

// install.js — make the owner invite for a public relay. Run over SSH.
//
//   node install.js            asks for the owner's name
//   node install.js andy       the same, without asking
//
// Decided by Andy (NODE-AND-RELAY, "The first claim needs a token"):
//
//   "Ideally there is an install.js console program that guides the
//   owner-on-ssh through defining first claim name with a sufficiently
//   complex token, which can be copied from the bash window and pasted into
//   the node-shell's claim interface."
//
// An UNCLAIMED relay (no owner in relay-state/allow.json) accepts exactly
// one claim: the one presenting the owner invite this mints (0003 amended:
// first invited claim is owner). The token is a long random one — the same
// generator ordinary invites use — and it is printed HERE, in the SSH
// session, and nowhere else: never by the relay at boot, where systemd's
// journal would keep it.
//
// VPS ONLY. Lab and test relays mint their owner invite in process
// (invites.mintOwner), as the harness builds relays.
//
// It replaces install-public-relay.js, which reserved a NAME with no secret
// behind it (pending-owner.json): whoever guessed the name took the box.
//
// Safe beside a running relay: it writes one row into relay.db, which the
// relay reads per question.

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const RUN_DIR = path.join(__dirname, 'spirit', 'run');
const JS = path.join(RUN_DIR, 'js');
// Same exit code as the relay's own refusals (relayServer.js): a state a
// retry cannot fix.
const REFUSED = 78;
// A day. The owner claims within minutes of running this; a token that
// outlives the need for it is only a token somebody else might find.
const OWNER_INVITE_DAYS = 1;

function refuse(why) {
  console.error('install.js: ' + why);
  process.exit(REFUSED);
}

if (!fs.existsSync(path.join(JS, 'relayStore.js'))) {
  refuse('run this from the SpiritOS repo root (spirit/run/js/relayStore.js not found)');
}

const relayStore = require(path.join(JS, 'relayStore.js'));
const relayAuth = require(path.join(JS, 'relayAuth.js'));
const invites = require(path.join(JS, 'invites.js'));
const labelRule = require(path.join(JS, 'labelRule.js'));

if (!relayStore.available()) {
  refuse('node:sqlite is not available in Node ' + process.version + ' — a relay needs 22.13 or later');
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(function (resolve) {
    rl.question(question, function (answer) { rl.close(); resolve(String(answer || '').trim()); });
  });
}

async function main() {
  const allow = relayAuth.loadAllow(RUN_DIR);
  if (allow.mode === 'keys') {
    refuse('this relay already has an owner (' + relayAuth.ownerName(allow) + '). An owner is ' +
      'changed over SSH by editing relay-state/allow.json, never by a second invite.');
  }
  const members = relayStore.open(RUN_DIR).members.count();
  if (members > 0) {
    refuse('relay-state/relay.db holds ' + members + ' member(s) but allow.json names no owner. ' +
      'That is a lost allow.json, not a new relay: restore it; an invite would hand the box ' +
      'and everyone on it to whoever redeems it.');
  }

  let name = String(process.argv[2] || '').trim();
  if (!name) {
    console.log('This relay has no owner yet. Its first claim will be yours.');
    name = await ask('Owner name (1-32 letters, digits, . _ -): ');
  }
  // The invite's label is SPOKEN — typed on the claim screen as the
  // second half of the invite — so it keeps the tight spoken rule every
  // invite label keeps (relay.js mint).
  if (!labelRule.spokenOk(name)) {
    refuse('"' + name + '" is not a valid invite name: 1-32 letters, digits, . _ -');
  }

  const row = invites.mintOwner(RUN_DIR, name, OWNER_INVITE_DAYS);
  relayStore.closeAll();
  if (process.platform !== 'win32') {
    try { fs.chmodSync(path.join(RUN_DIR, 'relay-state'), 0o700); } catch (e) { /* best effort */ }
  }

  console.log('');
  console.log('  Owner invite for this relay — copy both lines:');
  console.log('');
  console.log('    name:   ' + row.label);
  console.log('    token:  ' + row.token);
  console.log('');
  console.log('  Paste them into your node\'s claim screen (Natter, "claim with an invite").');
  console.log('  That claim becomes the owner. Valid until ' + row.expiresAt + '.');
  console.log('  Running this again replaces the token. It is shown here and nowhere else.');
  console.log('');
}

main().catch(function (e) { refuse(String(e && e.message ? e.message : e)); });
