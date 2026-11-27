'use strict';
// spirit/run/spirit/console/loop/script.js
// THE CONSOLE'S INTERACTIVE USER LOOP (goal/G48.2, the box: "the script run://spirit/console/loop/script.js will be the consoles
// interactive user loop"). It shows the prompt, the path in dot form ("spirit: ", "spirit.app.agent: "), hands each line
// as typed to ../command/script.js (the box: "the command sent to spirit/console/command/script.js is \"path agent\", the command processor
// works out current-path + navigation") and prints what it answers; exit leaves the loop and the script.
// THE UP AND DOWN KEYS (the box: "only those history items will be offered that can be used from the current path. since the
// log stores all commands as if typed from root prompt \"spirit: \", the loop must translate those back into its scope"):
// a logged "path app.agent" is offered at spirit.app as "path agent", at the root as it is, and nowhere else; "path <<"
// everywhere but the root.
//
///   start() -> runs until exit, or until its input ends
require('../../script.js');
const readline = require('readline');
// The processor, through spirit.requireScript (the general rules).
const command = spirit.requireScript('spirit/console/command/script.js');

function promptOf(p) { return (p ? 'spirit.' + p : 'spirit') + ': '; }

// A logged line as it reads from where the loop stands, or null when it cannot be used there.
// EVERY OTHER COMMAND (Andy: "the up key isn't for navigation only, it's for every command that is successful"): logged
// with the path it ran at ahead of it, "app.desk item.get id=goal/G48", it is offered only at that path, without it.
function inScope(line, here) {
  const m = /^path (.+)$/.exec(line);
  if (!m) return here && line.indexOf(here + ' ') === 0 ? line.slice(here.length + 1) : null;
  if (m[1] === '<<') return here ? line : null;
  if (!here) return line;
  return m[1].indexOf(here + '.') === 0 ? 'path ' + m[1].slice(here.length + 1) : null;
}
// The keys' history for where the loop stands, newest first, each line once.
function historyAt(here) {
  const seen = {};
  return command.state().history.slice().reverse().map(function (l) { return inScope(l, here); })
    .filter(function (l) { if (!l || seen[l]) return false; seen[l] = true; return true; });
}

function start() {
  let here = command.state().path;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: promptOf(here), history: historyAt(here), historySize: command.HISTORY_MAX });
  // The lines in the order typed, each answered before the next.
  let queue = Promise.resolve();
  let closed = false;
  const again = function () { rl.setPrompt(promptOf(here)); rl.history = historyAt(here); rl.prompt(); };
  rl.prompt();
  rl.on('line', function (text) {
    queue = queue.then(function () {
      if (String(text).trim() === 'exit') process.exit(0);
      return command.run(text).then(function (r) {
        if (r.out) console.log(r.out);
        here = r.path;
        if (!closed) again();
      });
    });
  });
  // Input ended without exit (a pipe drained): what was typed is answered, then the script ends.
  rl.on('close', function () { closed = true; queue.then(function () { process.exit(0); }); });
}

module.exports = { start: start, inScope: inScope };
