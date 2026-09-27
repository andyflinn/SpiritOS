'use strict';

// spirit/test/processServerPending.js
// G19, STEP ONE: THE SERVER TYPE, BROUGHT INSIDE THE PROCESS SUBSYSTEM'S CONTRACT.
//
//   Andy, 2026-09-27, team chat: "the app-Servers must runn in the
//   process-subsystem", and "look at the code for our image tagging systems
//   to see how processes access node interfaces". The first step of G19 as
//   broken down in PUBLIC-APP-SERVER.md.
//
// The 'server' job kind (jobs.startServerJob, built for the app servers)
// entered the tree outside the process contract: a 'process' job is spawned
// with SPIRIT_JOB_ID and SPIRIT_CALLBACK_URL (jobs.js startProcessJob) and
// reports through spirit.core.jobs, a 'server' job is spawned with neither.
// Each declaration names a unit ABSENT today and goes red the moment it is
// built, which is the handover to its assertion. claude-windows builds on
// Andy's Go!; wsl-claude asserts.
//
// NOT DECLARED YET: the node starting a manifest-declared server app that is
// not a faceServer. Its manifest field and entry are not named, and a probe
// that guesses a name is a probe that can never flip.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const RUN = path.join(__dirname, '..', 'run');
function source(rel) {
  try { return fs.readFileSync(path.join(RUN, rel), 'utf8'); } catch (e) { return ''; }
}
// The text of one function, from its declaration to the next one at the
// same indent, so a probe reads that function and not its neighbours.
function body(src, name) {
  const at = src.indexOf('function ' + name + '(');
  if (at === -1) return '';
  const indent = (/[ \t]*$/.exec(src.slice(0, at)) || [''])[0];
  const next = src.indexOf('\n' + indent + 'function ', at + 1);
  return src.slice(at, next === -1 ? src.length : next);
}

test.startTest('G19, step one: the server type inside the process contract, what is still owed');

const jobs = source('js/jobs.js');
const kernel = source('js/kernel.js');
const jobsApp = source('app/jobs/jobs.js');

test.awaiting('public-app-server/G19', 'a server job spawned with SPIRIT_JOB_ID and SPIRIT_CALLBACK_URL',
  /SPIRIT_CALLBACK_URL/.test(body(jobs, 'startServerJob')) && /SPIRIT_JOB_ID/.test(body(jobs, 'startServerJob')),
  'the same two variables a process job gets, so a server can spirit.core.jobs.log into its own job and reach ' +
  'the node\'s door, as the image jobs do',
  { there: 0, cost: 'a few lines' });

(function () {
  const at = kernel.indexOf('spirit.core.ask = function');
  const ask = at === -1 ? '' : kernel.slice(at, kernel.indexOf('\n  };', at));
  test.awaiting('public-app-server/G19', 'spirit.core.ask working outside a page, through SPIRIT_CALLBACK_URL',
    /SPIRIT_CALLBACK_URL/.test(ask),
    'ask posts to the relative /api/spirit, which only a page can resolve; in a process it must post to the ' +
    'callback URL, so a server calls node verbs (owner.command) the way a page does',
    { there: 0, cost: 'one line' });
}());

test.awaiting('public-app-server/G19', 'a server job cancellable from the jobs app',
  /canCancel\s*=[^;]*'server'/.test(jobsApp),
  'the jobs app offers Cancel only for kind \'process\' (canCancel), so a running server shows but cannot be stopped',
  { there: 0, cost: 'one line, plus what stopping a kept-alive job means' });

test.reportSuccessFailureCount();

module.exports = test;
