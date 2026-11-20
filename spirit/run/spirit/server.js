'use strict';
// spirit/run/spirit/server.js
// THE LAUNCHER (goal/G48.5, the box, placement: "spirit/server.js, the launcher: requires spirit.js, makes it available to all
// modules in spirit/server/, and starts one server by its mode: --node (the default), --relay or --app"). It loads nothing of a
// server but the one module its mode names, so a relay carries no node code (cycle 0, design/principles/NODE-AND-RELAY.md):
//
//   node spirit/server.js [--node] [args]        a personal node, spirit/server/node.js
//   node spirit/server.js --relay [args]         a public relay, spirit/server/relay.js
//   node spirit/server.js --app <script> [args]  one server process, spirit/server/app.js, the app's script after it
//
// THE START COMMANDS IN USE STAY VALID (the box, implications: "no Flag Day"): a node starts with "node spirit/server.js", a
// relay with "node spirit/server.js --relay" (bash/systemd/spirit-relay.service), and --relay may stand anywhere among the
// arguments, as it could before. --app stands first, so the node's start check reads it in a fixed place (spirit/job.js, RH1).
// ONE MODE, AN UNKNOWN ONE REFUSED; every argument after the mode reaches the module unchanged (--port, --email, --help).
// A relay that refuses to start exits 78 by itself (spirit/server/relay.js STARTUP_REFUSED); nothing here catches it.
require('./spirit.js');

const MODES = ['--node', '--relay', '--app'];
// The options the node and the relay read (spirit/server/node.js, spirit/server/relay.js, spirit/server/serveCommon.js): any
// other argument that starts with a dash is an unknown mode, refused.
const OPTIONS = ['--port', '--email', '--help', '-h', '--ram', '--disc'];

function refuse(why) {
  console.error('spirit/server.js: ' + why + '. Modes: ' + MODES.join(', ') + ' (none is --node).');
  process.exit(2);
}

const args = process.argv.slice(2);
if (args[0] === '--app') {
  // One server process: its script is the argument after --app, and it reads its own arguments after that.
  const script = args[1];
  if (!script) refuse('--app needs the app\'s script after it');
  process.argv.splice(1, 2);
  spirit.require('spirit/server/app.js').start(script);
} else {
  const modes = args.filter(function (a) { return MODES.indexOf(a) !== -1; });
  if (modes.length > 1) refuse('one mode only, not ' + modes.join(' and '));
  if (modes[0] === '--app') refuse('--app stands first, the script after it');
  const unknown = args.filter(function (a) { return /^-/.test(a) && MODES.indexOf(a) === -1 && OPTIONS.indexOf(a.split('=')[0]) === -1; });
  if (unknown.length) refuse('no such mode or option: ' + unknown.join(' '));
  // The mode word itself is the launcher's; the module reads the rest as it always read its arguments.
  if (modes.length) process.argv.splice(2 + args.indexOf(modes[0]), 1);
  spirit.require(modes[0] === '--relay' ? 'spirit/server/relay.js' : 'spirit/server/node.js');
}
