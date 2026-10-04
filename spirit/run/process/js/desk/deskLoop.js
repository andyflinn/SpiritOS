'use strict';

// spirit/run/process/js/desk/deskLoop.js
// THE LOOP FOR A MODEL WITH NO HARNESS — goal/G4.28.
//
//   Andy, 2026-10-04: "how do we git it to stick to that loop that you are in when working over desk?"; to "open one,
//   with your Go?": "yes. open one". A Claude is woken by its harness when its listener ends; gemma under opencode is
//   not, and opencode's shell tool stops any command after 120 s. So this script does the waiting, and the model only
//   answers.
//
//   node spirit/run/process/js/desk/deskLoop.js <port of the agent's own node> <command> [args...]
//
// Each time the listener (deskEar.js <port>) prints lines, the command runs with its args plus one more: the lines as
// deskEar printed them. The loop waits for it to end, then listens again; it never ends by itself. For gemma:
//
//   node spirit/run/process/js/desk/deskLoop.js 11111 <path to opencode.exe> run --session <its session id>
//
// so the model keeps one session, and answers in Desk with deskEar chat.add. On Windows give opencode.exe itself
// (npm's node_modules/opencode-ai/bin/opencode.exe), not the opencode.cmd shim: a .cmd runs through cmd.exe, which
// cannot carry the lines' newlines and quotes as one argument.
//
// A refusal of the listener's (unblocked, no node) is printed and waited out, then it listens again: the refusal
// names what is missing, and the loop must not hammer the node while it is fixed.

const path = require('path');
const { spawn } = require('child_process');

const USAGE = 'usage: node deskLoop.js <port of the agent\'s own node> <command> [args...]';
const EAR = path.join(__dirname, 'deskEar.js');
const REFUSED_PAUSE_MS = 10000;

const port = Number(process.argv[2]);
const command = String(process.argv[3] || '');
const args = process.argv.slice(4);
if (!Number.isInteger(port) || port <= 0 || !command) { console.error(USAGE); process.exit(2); }

function say(text) { console.error('deskLoop: ' + text); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// One run of a program to its end: {code, out}. Its stderr goes to ours.
function run(file, argv) {
  return new Promise(function (resolve) {
    let out = '';
    const kid = spawn(file, argv, { stdio: ['ignore', 'pipe', 'inherit'], windowsHide: true });
    kid.stdout.on('data', function (b) { out += b; });
    kid.on('error', function (e) { resolve({ code: -1, out: String((e && e.message) || e) }); });
    kid.on('close', function (code) { resolve({ code: code, out: out }); });
  });
}

async function loop() {
  for (;;) {
    const heard = await run(process.execPath, [EAR, String(port)]);
    const lines = heard.out.trim();
    if (heard.code !== 0 || !lines) {
      say('the listener ended ' + heard.code + (lines ? ': ' + lines : '') + '; listening again in ' + REFUSED_PAUSE_MS / 1000 + ' s');
      await sleep(REFUSED_PAUSE_MS);
      continue;
    }
    say('handing ' + lines.split('\n').length + ' line(s) to ' + path.basename(command));
    const answered = await run(command, args.concat([lines]));
    if (answered.code !== 0) say(path.basename(command) + ' ended ' + answered.code + (answered.code === -1 ? ': ' + answered.out : ''));
    else if (answered.out.trim()) console.log(answered.out.trim());
  }
}

loop();
