'use strict';

// spirit/test/stackFrameTestItems.js
// THE DOORS WANTED OF THE STACK-FRAME TEST, ONE TEST PER ITEM (goal/G22, READ FROM THE PLUGIN'S LIST SINCE goal/G22.3).
//
// Decided by Andy, 2026-10-13 (goal/G22.2's box): an item whose purpose is to add a door to the stack-frame test
// (oneDoorStacks.js) puts its red here, and each test asserts that its item's door exists.
//
// DECIDED BY ANDY, 2026-10-13 (goal/G22.3's box), not this file's to loosen: the stackFrameChecks plugin keeps the doors
// in spirit/run/process/js/desk/plugins/js/stackFrameChecks/stackFrameList.json, and the stack-frame test reads it to
// know which checks to run. THE GATE IS NARROW, one file::function: a whole module named as the gate is cheating. THE
// ENDPOINT IS WIDE, a whole module, or Node's own bottom (node:http+https+fetch) filtered to paths.
//
// So the hand entries are gone: ONE TEST PER ITEM NAMED IN THE LIST, asserting each of its doors has a gate of the
// file::function form and an endpoint of a wide form. What a door then finds failing is oneDoorStacks.js's verdict.
//
// THE DOORS ALREADY ASKED FOR STAY ASKED FOR. An item in WANTED is tested whether the list names it or not, so a door
// struck from the list goes red here rather than vanishing with its test.

const test = require('./testSupport.js');
const wirePaths = require('./tools/wirePaths.js');

const PEER_POST = 'spirit/run/js/peerPost.js';
const GATE_RE = /^spirit\/run\/[A-Za-z0-9_\-/.]+\.js::[A-Za-z_$][A-Za-z0-9_$]*$/;

// The items that asked for a door before the list existed, and what each asked: goal/G19.14 the two components of
// peerPost, goal/G22.2 the relay (Node's http, https and fetch, filtered to /api/relay/), each gated inside peerPost.
const WANTED = {
  'goal/G19.14': [
    { endpoint: 'spirit/run/js/presenceNode.js' },
    { endpoint: 'spirit/run/js/postQueue.js' },
  ],
  'goal/G22.2': [
    { endpoint: 'node:http+https+fetch', paths: ['/api/relay/'] },
  ],
};

function endpointWide(d) {
  if (/::/.test(String(d.endpoint))) return 'its endpoint names a function, ' + d.endpoint + ': an endpoint is a whole module';
  if (/^spirit\/run\/[A-Za-z0-9_\-/.]+\.js$/.test(String(d.endpoint))) return '';
  if (/^node:[a-z+]+$/.test(String(d.endpoint))) return Array.isArray(d.paths) && d.paths.length ? '' : 'a Node endpoint with no paths to filter on';
  return 'its endpoint ' + JSON.stringify(d.endpoint) + ' is neither spirit/run/<file>.js nor node:<kinds>';
}

test.startTest('goal/G22: the doors wanted of the stack-frame test, one per item, from the plugin\'s list');

let doors = null;
let why = '';
try { doors = wirePaths.doors(); } catch (e) { why = (e && e.message) || String(e); }
if (Array.isArray(doors)) test.check('the list reads: ' + doors.length + ' door(s) in the plugin\'s stackFrameList.json');
else test.fail('OWED by goal/G22.3: the list of doors does not read: ' + (why || 'wirePaths has no doors()'));
doors = Array.isArray(doors) ? doors : [];

const items = Object.keys(WANTED);
doors.forEach(function (d) { if (d && d.item && items.indexOf(d.item) === -1) items.push(d.item); });

items.forEach(function (item) {
  const mine = doors.filter(function (d) { return d && d.item === item; });
  const title = item + ': its door(s) are in the list, each gated by one file::function';
  if (!mine.length) { test.fail(title, 'OWED by ' + item + ': the list names no door for it'); return; }
  const wrong = [];
  mine.forEach(function (d) {
    if (!GATE_RE.test(String(d.gate))) wrong.push('gate ' + JSON.stringify(d.gate) + ' is not file::function (a whole module as the gate is cheating)');
    const w = endpointWide(d);
    if (w) wrong.push(w);
  });
  (WANTED[item] || []).forEach(function (want) {
    const has = mine.some(function (d) {
      return d.endpoint === want.endpoint && String(d.gate).indexOf(PEER_POST + '::') === 0 &&
        JSON.stringify(d.paths || null) === JSON.stringify(want.paths || null) && Array.isArray(d.suites) && d.suites.length > 0;
    });
    if (!has) wrong.push('no door gated in ' + PEER_POST + ' reaching ' + want.endpoint + (want.paths ? ' on ' + want.paths.join(',') : '') + ' with suites that drive it');
  });
  if (wrong.length) test.fail(title, wrong.join('; '));
  else test.check(title, mine.map(function (d) { return d.gate + ' -> ' + d.endpoint + (d.paths ? ' ' + d.paths.join(',') : ''); }).join('; '));
});

test.reportSuccessFailureCount();
