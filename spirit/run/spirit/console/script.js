'use strict';
// spirit/run/spirit/console/script.js
// THE CONSOLE'S ONE WAY IN FROM A SYSTEM SHELL (goal/G48.2, the box: "there is only one system shell way into console:
// \"node spirit/console/script.js\", the console itself knows that it must enter the loop if no arguments was specified."). The
// console is core (Andy: "console is core."); its spirit object a client of this checkout's node, as an app server's or a
// one-shot job's is.
//
//   node spirit/run/spirit/console/script.js <line>   the line to ./console/command.js once: what it answers is printed, and the
//                                               script ends, 1 when it refused
//   node spirit/run/spirit/console/script.js          ./console/loop.js, the prompt
// The hello world's card is gone (the box, ## reversals: "the card feature from 48.1 will be completely dropped").
require('../spirit.js');
if (require.main === module) {
  const words = process.argv.slice(2).join(' ');
  // Its parts through spirit.requireScript, as every file of the tree loads another (the general rules).
  if (!words) spirit.requireScript('spirit/console/loop.js').start();
  // A WAIT ENDS WITH ITS OWN CODE ON A TIMEOUT, AND MOVES ITS POINTER ONLY ONCE IT PRINTED (goal/G48.6, the box): exit and
  // printed are the command's to hand back.
  else spirit.requireScript('spirit/console/command.js').run(words).then(function (r) {
    if (r.out) console.log(r.out);
    if (typeof r.printed === 'function') r.printed();
    process.exit(Number.isInteger(r.exit) ? r.exit : (r.ok ? 0 : 1));
  });
}
