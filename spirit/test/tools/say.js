#!/usr/bin/env node

// spirit/test/tools/say.js
// SEND ONE MESSAGE TO THE OTHER AGENT, FROM A FIXED FILE, WITH A COMMAND
// THAT NEVER CHANGES.
//
//   Andy, 2026-09-24, three times, the third during a close he had called:
//   "i still get prompts from wsl during close-operations." And, on the
//   attempt to send him the diagnosis of that very problem: "Yes (PromPT!)"
//
// ── THE MESSAGE WAS THE PROBLEM, NOT THE MEASUREMENT ────────────────
//
// Every message this agent sent today was composed as a heredoc and piped
// into the agents app in one freshly-written shell command. AN INLINE
// PIPELINE IS UNMATCHABLE BY CONSTRUCTION: each is a new string, so each
// is a new approval dialog. Dozens of messages, dozens of dialogs, and
// the last one fired while sending him the analysis of why he was getting
// dialogs.
//
// The habit was already half-learned for the wrong reason — compose in a
// file, because a shell ate three sentences in one day. That fixed the
// QUOTING and left the command varying, which is the half that costs him.
//
// ── SO THE COMMAND IS A CONSTANT ────────────────────────────────────
//
//     node spirit/test/tools/say.js
//
// No arguments that change, no interpolated text, no hash on the command
// line. Everything variable lives in the outbox file and is read from it:
//
//     to: claude-windows
//     kind: answer            (note | ask | answer | report)
//     re: 63022c679cc6        (optional)
//     ---
//     the message text
//
// One approval, once, for every message after it. The same reasoning as
// vaultGuardBattery.js at a stable path, and it is the general form of
// the cure: WORK THAT WILL BE REPEATED LIVES AT A PATH, NOT IN A STRING.

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// ── THE PATH IS FIXED; WHICH BOX IT IS ON IS NOT ────────────────────
//
// A varying path in the command is a varying command, so the OUTBOX must
// not be an argument. But the first version of this file named ONE box's
// outbox, and a file at a shared path is not shared if its contents name
// one box — so the other agent could not use the cure for the problem
// they both had. SPIRIT_OUTBOX lets a box say where its own is; the
// constant below is this file's LAST resort, never an override.
// The order is box.js's: SPIRIT_OUTBOX, then `.spiritbox` at the checkout
// root, then this file's last resort. A box that has said once does not say
// again, and the command stays the constant it exists to be.
const box = require('./box.js');
const said = box.resolve();
const OUTBOX = String(process.env.SPIRIT_OUTBOX || (said.ok && said.outbox) || '').trim() ||
  '/tmp/claude-1000/-home-andy-SpiritOS/66737044-2a29-4977-b5a6-c9ad520c6b2e/scratchpad/outbox.txt';

const RUN = path.join(__dirname, '..', '..', 'run');
const AGENTS = path.join(RUN, 'process', 'js', 'agents', 'agents.js');

// ── THE ENVIRONMENT BEATS THE CONSTANTS, WHICH IS THE WHOLE CORRECTION ──
//
// This was `Object.assign({}, process.env, {...})` — the constants LAST,
// so they overrode the environment and no caller could point this file at
// another box. wsl-claude, handing it over: "Defaults that override the
// environment are not defaults." They are a lock.
//
// So the constants go FIRST and process.env wins. A box that has already
// configured its agent — and both have, since `agents.js:98-109` reads
// exactly these names — answers this question by having been set up, and
// this file stops having an opinion about which box it is on.
const ENV = Object.assign({
  AGENTS_NODE: 'http://127.0.0.1:45441',
  AGENTS_SELF: 'wsl-claude',
  AGENTS_PEERS: 'claude-windows=MCowBQYDK2VwAyEAMP7RU9Q6++SG+UPagCp1uOYQFtJM/kr1b+76Fj+AtJ0=,' +
    'claude-windows-2=MCowBQYDK2VwAyEAAJJk0G0jq2/1LToJhzZOZuLKUf2sP+aNrPKFRJo9BXQ=',
  AGENTS_CONTROL: 'MCowBQYDK2VwAyEAgrEcBu0FkTzmGKs+oBS+OllzvZh+d/0Rr6fO/fXD+0c=',
}, process.env);

const KINDS = ['note', 'ask', 'answer', 'report'];

function fail(why) {
  process.stderr.write('say: ' + why + '\n');
  process.exit(1);
}

let raw = '';
try { raw = fs.readFileSync(OUTBOX, 'utf8'); } catch (e) {
  fail('no outbox at ' + OUTBOX + ' — write the message there first, or set ' +
    'SPIRIT_OUTBOX to this box\'s own outbox. It is named rather than guessed: ' +
    'a send to the wrong peer is worse than a send that did not happen.');
}

// THE HEADER IS PARSED, NEVER GUESSED. A message sent to the wrong peer or
// with the wrong kind is worse than one not sent: the log then carries a
// fact about a conversation that did not happen.
const cut = raw.indexOf('\n---\n');
if (cut === -1) fail('the outbox needs a header, then a line of exactly ---, then the text.');
const header = raw.slice(0, cut);
const text = raw.slice(cut + 5).replace(/^\n+/, '');

if (!text.trim()) fail('the message body is empty; the app refuses an empty send and so does this.');

function field(name) {
  const m = new RegExp('^' + name + ':\\s*(.+)$', 'm').exec(header);
  return m ? m[1].trim() : '';
}

const to = field('to');
const kind = field('kind');
const re = field('re');

if (!to) fail('header has no `to:`');
if (KINDS.indexOf(kind) === -1) fail('header `kind:` must be one of ' + KINDS.join(', '));

const args = [AGENTS, 'send', to, kind, text];
if (re) args.push('--re', re);

// The text goes as an ARGV entry and never through a shell, which is the
// other half of the old habit: a paragraph executed as a command was
// silently removed from one report before it was ever sent.
try {
  const out = execFileSync(process.execPath, args, { cwd: RUN, env: ENV, encoding: 'utf8' });
  process.stdout.write(out.trim().split('\n').slice(-1)[0] + '\n');
} catch (e) {
  fail('the send failed: ' + String((e && e.message) || e));
}
