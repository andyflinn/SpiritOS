'use strict';
// spirit/run/spirit/console.js
// THE CONSOLE, ITS HELLO WORLD (goal/G48.1; Andy: "we need a hallo word version first with extremely modest feature
// requirements. that way we can experiment with the prototype...."; "console is core."). Its spirit object is a client
// of this checkout's node, as an app server's or a one-shot job's is (Andy: "it's js spirit object is in node-client
// mode, same as app servers or one shot jobs"): the node it asks is the one spirit/state/environment.json names.
//
//   node spirit/run/spirit/console.js card   prints the node's card, JSON.stringify(card, 0, 2), and ends
//   node spirit/run/spirit/console.js        the "spirit: " prompt; at it, card prints the card and the prompt stays,
//                                             exit leaves the loop and the script
//
// Its words are the namespace's own (Andy: "to keep with the namespace"): card is the node's card verb, asked as it is
// named, nothing translated.
require('./spirit.js');
const readline = require('readline');

// The node's card, as its card verb answers it; a node that does not answer refuses it.
function card() {
  return spirit.require(spirit.familyPath('node')).then(function (n) { return n.card({}); });
}
const COMMANDS = { card: function () { return card().then(function (c) { return JSON.stringify(c, 0, 2); }); } };

// One line: its command's output, or what is wrong with it.
function line(text) {
  const word = String(text || '').trim();
  if (!word) return Promise.resolve('');
  if (!Object.prototype.hasOwnProperty.call(COMMANDS, word)) return Promise.resolve('no such command: ' + word);
  return COMMANDS[word]().then(null, function (e) { return 'refused: ' + ((e && e.message) || e); });
}

function prompt() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'spirit: ' });
  // The lines in the order typed, each answered before the next, so a quick 'card' then 'exit' prints the card first.
  let queue = Promise.resolve();
  let closed = false;
  rl.prompt();
  rl.on('line', function (text) {
    queue = queue.then(function () {
      if (String(text).trim() === 'exit') process.exit(0);
      return line(text).then(function (out) { if (out) console.log(out); if (!closed) rl.prompt(); });
    });
  });
  // Input ended without exit (a pipe drained): what was typed is answered, then the script ends.
  rl.on('close', function () { closed = true; queue.then(function () { process.exit(0); }); });
}

if (require.main === module) {
  const words = process.argv.slice(2).join(' ');
  if (!words) prompt();
  else line(words).then(function (out) { if (out) console.log(out); process.exit(/^(no such command|refused): /.test(out) ? 1 : 0); });
}

module.exports = { line: line };
