'use strict';

// spirit/run/process/js/agent/table/test/data.js
// The tests of process/js/agent/table/data.js, and of no other module: what it makes of the agent server's stream for
// spirit.data (spec: ./data.md; goal/G41.4). The browser file runs in node on a window of its own, over the faceless
// layer it registers with, shell/js/spiritData.js, whose take hands it a job as the stream does.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));

const FILE = path.join(__dirname, '..', 'data.js');
function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function load(file) { vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file }); }
// One row of the agent server as its job brings it.
function job(agent, module) { return { id: 'job-agent', module: module || 'process/js/agent', data: {}, app: { agent: agent } }; }

test.startTest('data.js: the agent tables\' translator');

test.subHeading('its file');
if (!fs.existsSync(FILE)) { test.fail('process/js/agent/table/data.js is not there'); test.reportSuccessFailureCount(); process.exit(0); }
global.window = { spirit: {} };
load(path.join(RUN, 'shell', 'js', 'spiritData.js'));
const D = global.window.spirit.data;
// Rows streamed before the translator loads are handed to it whole (spiritData.js, goal/G41.3) on a page; here they
// come after it.
load(FILE);
const A = global.window.spirit.agentData;
ok(A && typeof A.branchOf === 'function' && typeof A.keyOf === 'function' && typeof A.published === 'function',
  'it registers spirit.agentData { branchOf, keyOf, published }', 'agentData: ' + short(A && Object.keys(A)));
if (!A) { test.reportSuccessFailureCount(); process.exit(0); }
ok(A.branchOf('provider') === 'agent.provider' && A.branchOf('grant') === 'agent.grant', 'a table is the branch agent.<table>', 'branchOf: ' + short(A.branchOf('provider')));
ok(A.keyOf('job', { id: 'KJ' }) === 'KJ' && A.keyOf('grant', { job_id: 'KJ', path: 'files.read' }) === 'KJ|files.read',
  'a row is keyed by its id, a grant by job_id|path', 'keyOf: ' + short([A.keyOf('job', { id: 'KJ' }), A.keyOf('grant', { job_id: 'KJ', path: 'files.read' })]));

test.subHeading('a row added or changed is set in its table\'s branch');
const heard = [];
const off = D.watch('agent.provider', function (p, v) { heard.push([p, v]); });
D.take(job({ table: 'provider', row: { id: 'KP', label: 'First', apiKeySet: true } }));
ok(D.get('agent.provider/KP') && D.get('agent.provider/KP').label === 'First', 'a provider row lands at agent.provider/<id>', 'agent.provider: ' + short(D.get('agent.provider')));
ok(heard.length === 1 && heard[0][0] === 'agent.provider/KP', 'and the branch\'s watcher hears it: every view of the table redraws by itself', 'heard: ' + short(heard));
D.take(job({ table: 'provider', row: { id: 'KP', label: 'Renamed' } }));
ok(D.get('agent.provider/KP').label === 'Renamed' && D.get('agent.provider/KP').apiKeySet === true, 'a changed row is merged: what it names changes, what it does not stays', 'row: ' + short(D.get('agent.provider/KP')));

test.subHeading('a grant is keyed by its job and its path, and keeps its job\'s label');
D.set('agent.grant/KJ|files.read', { job_id: 'KJ', path: 'files.read', job: 'Reader', label: 'Reader: files.read' });
D.take(job({ table: 'grant', row: { job_id: 'KJ', path: 'files.read' } }));
ok(D.get('agent.grant/KJ|files.read') && D.get('agent.grant/KJ|files.read').job === 'Reader', 'a grant from the stream keeps the job\'s label a search seated', 'grant: ' + short(D.get('agent.grant/KJ|files.read')));
D.take(job({ table: 'grant', row: { job_id: 'KJ', path: 'files.write' } }));
ok(D.get('agent.grant/KJ|files.write') && D.get('agent.grant/KJ|files.write').path === 'files.write', 'a new grant lands at agent.grant/<job_id>|<path>', 'agent.grant: ' + short(Object.keys(D.get('agent.grant') || {})));

test.subHeading('a row gone is deleted from its branch');
D.take(job({ table: 'provider', id: 'KP', removed: true }));
ok(D.get('agent.provider/KP') === undefined || D.get('agent.provider/KP') === null, 'a removed row by its id is gone', 'agent.provider/KP: ' + short(D.get('agent.provider/KP')));
ok(heard.length === 3 && heard[2][0] === 'agent.provider/KP', 'and its watcher hears the delete', 'heard: ' + short(heard));
D.take(job({ table: 'grant', row: { job_id: 'KJ', path: 'files.write' }, removed: true }));
ok(!D.get('agent.grant/KJ|files.write') && D.get('agent.grant/KJ|files.read'), 'a removed grant by its job and path is gone, the others stay', 'agent.grant: ' + short(Object.keys(D.get('agent.grant') || {})));
off();

test.subHeading('it takes nothing that is not an agent table\'s row');
const before = JSON.stringify(D.data);
D.take(job({ table: 'provider', row: { id: 'KX', label: 'Other' } }, 'process/js/desk'));
D.take(job({ debug: true }));
D.take(job({ table: '', row: { id: 'KY' } }));
D.take(job({ table: 'provider', row: 'not a row' }));
D.take(job({ table: 'provider', row: { label: 'no id' } }));
D.take({ id: 'job-agent', module: 'process/js/agent', data: {}, app: null });
ok(JSON.stringify(D.data) === before, 'another module\'s row, the debug state, a row with no table, no row, or no id: nothing is written',
  'written: ' + short(D.data));
D.take(job({ table: 'grant', row: {} }));
D.take(job({ table: 'grant', row: { job_id: 'KJ' } }));
ok(JSON.stringify(D.data) === before, 'a grant with no job_id or no path is not written either: no grant is keyed by a missing half',
  'written: ' + short(Object.keys(D.get('agent.grant') || {})));

test.reportSuccessFailureCount();
