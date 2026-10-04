'use strict';

// spirit/run/process/js/desk/deskLoop.js
// THE DRIVER FOR A MODEL WITH NO HARNESS — goal/G4.28.
//
//   Andy, 2026-10-04: "how do we git it to stick to that loop that you are in when working over desk?"; to "open one,
//   with your Go?": "yes. open one". A Claude is woken by its harness when its listener ends; gemma under opencode is
//   not, and opencode's shell tool stops any command after 120 s. So this script does the waiting, and the model only
//   answers.
//   THE FIX ROUND, his rulings: to the loop posting what the model prints, "not it's internal thought process. claude's
//   don't print to me what you print in your vscode window"; "yes, like it needs a manual pre-loaded......"; and "it's
//   only valuable if that can be extracted mechanically". So the model is handed only his lines for it, with a manual,
//   and the loop posts its final answer, never its thinking or tool calls.
//
//   node spirit/run/process/js/desk/deskLoop.js <port of the agent's own node> <command> [args...]
//
// Each time the listener (deskEar.js <port>) prints lines, the agent's nick is read from the desk (profile.get, the
// one Andy set in its pane, goal/G4.23), and each line of his that starts "<nick>:" is handed over on its own: the
// command runs with its args plus one more, deskLoopManual.md followed by the line as deskEar printed it. Every other
// line is for somebody else and is passed over. The command must print opencode run --format json's events; the text
// of the step that ends the run (reason stop, else the last step) is posted under the line's item, through the agent's
// own deskEar, and nothing of the steps before it. Then it listens again; it never ends by itself. For gemma:
//
//   node spirit/run/process/js/desk/deskLoop.js 11111 <path to opencode.exe> run --format json --session <its id>
//
// On Windows give opencode.exe itself (npm's node_modules/opencode-ai/bin/opencode.exe), not the opencode.cmd shim: a
// .cmd runs through cmd.exe, which cannot carry the lines' newlines and quotes as one argument.
//
// A refusal of the listener's (unblocked, no node) is printed and waited out, then it listens again: the refusal
// names what is missing, and the loop must not hammer the node while it is fixed.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const USAGE = 'usage: node deskLoop.js <port of the agent\'s own node> <command> [args...]';
const EAR = path.join(__dirname, 'deskEar.js');
const MANUAL = path.join(__dirname, 'deskLoopManual.md');
const REFUSED_PAUSE_MS = 10000;
// A model's reasoning can leak into its text, ending at this marker (seen in gemma's output, 2026-10-04).
const THINKING_ENDS = '<channel|>';

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
function ear(verb, body) { return run(process.execPath, [EAR, String(port), verb, JSON.stringify(body)]); }

// The agent's nick, as Andy set it; '' when it has none (then nothing is its).
async function nick() {
  const r = await ear('profile.get', { agent: '' });
  try { return String(JSON.parse(r.out).nick || '').toLowerCase(); } catch (e) { return ''; }
}

// A line deskEar printed, "DESK <who> <verb> <json>", taken apart; null when it is not his chat.add for this nick.
function forMe(line, mine) {
  const m = /^DESK (\S+) (\S+) (\{.*\})$/.exec(line);
  if (!m || m[1] !== 'andy' || m[2] !== 'chat.add' || !mine) return null;
  let b = null;
  try { b = JSON.parse(m[3]); } catch (e) { return null; }
  const text = String((b && b.text) || '');
  if (!b || !b.id || text.slice(0, mine.length + 1).toLowerCase() !== mine + ':') return null;
  return { id: String(b.id), line: line };
}

// The final answer in opencode run --format json's events: the text of the step that ended with reason stop, else of
// the last step; reasoning leaked before THINKING_ENDS is dropped.
function finalText(out) {
  let step = '';
  let last = '';
  let stopped = null;
  out.split('\n').forEach(function (l) {
    let e = null;
    try { e = JSON.parse(l); } catch (x) { return; }
    const p = (e && e.part) || {};
    if (e.type === 'step_start') step = '';
    else if (e.type === 'text' && typeof p.text === 'string') step += p.text;
    else if (e.type === 'step_finish') { last = step; if (p.reason === 'stop') stopped = step; }
  });
  let text = stopped !== null ? stopped : (last || step);
  const cut = text.lastIndexOf(THINKING_ENDS);
  if (cut !== -1) text = text.slice(cut + THINKING_ENDS.length);
  return text.trim();
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
    const mine = await nick();
    const asks = lines.split('\n').map(function (l) { return forMe(l.trim(), mine); }).filter(Boolean);
    if (!asks.length) continue;
    let manual = '';
    try { manual = fs.readFileSync(MANUAL, 'utf8').trim(); } catch (e) { manual = ''; }
    for (const a of asks) {
      say('handing a line under ' + a.id + ' to ' + path.basename(command));
      const answered = await run(command, args.concat([manual + '\n\n' + a.line]));
      const text = finalText(answered.out);
      if (!text) { say(path.basename(command) + ' ended ' + answered.code + ' with no answer to post'); continue; }
      const posted = await ear('chat.add', { id: a.id, text: text });
      if (posted.code !== 0) say('the answer was not posted under ' + a.id + ': ' + posted.out.trim());
    }
  }
}

loop();
