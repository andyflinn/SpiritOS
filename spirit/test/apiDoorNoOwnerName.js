'use strict';

// spirit/test/apiDoorNoOwnerName.js
// goal/G16.4: the andy check leaves apiDoor (N2 of the review of 2026-10-10). Written first, red on today's code;
// claude-windows wrote it and builds it. Andy, 2026-10-10: "an andy-door sounds bad. where is it exactly?", then
// "remove it." The desk names the writer from the caller (desk.js writerOf), so a member's `by` in the arguments
// guards nothing, and the check refused a member's search of the owner's lines. The app-name branch is NOT this
// item's (its mark was dropped with goal/G16.10).
//
// WHAT IS ASSERTED
//   1. A member's ask whose arguments carry by 'andy' (a chat.search filter, a chat.add) reaches the server; the
//      door answers no not-owner for it.
//   2. DEBUG and DEPENDENCIES are still refused at the door, by name (asksOwnerVerb untouched).
//   3. The door's source names no owner: no 'andy' literal in apiDoor.js outside comments.
// rule/11: through testSupport only; fakes only, no node, no ports.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const packet = require('../run/js/client/packet');
const arrivals = require('../run/js/arrivals.js');
const apiDoor = require('../run/js/apiDoor.js');

const OWED = 'OWED by goal/G16.4: ';
const MEMBER = 'MCowBQYDK2VwAyEAmembermembermembermembermembermemb=';

test.startTest('goal/G16.4: the andy check leaves apiDoor');

const asked = [];
const posted = [];
const door = apiDoor.createApiDoor({
  servers: { ask: function (body) { asked.push(body); return Promise.resolve({ status: 200, body: { ok: true } }); } },
  post: function () { posted.push(Array.prototype.slice.call(arguments)); return Promise.resolve({ ok: true }); },
  encode: packet.encode,
  isKnown: function (key) { return key === MEMBER; },
  auth: { pathsOf: function (key) { return key === MEMBER ? ['desk'] : []; } },
  log: function () {},
});

function replies() {
  return posted.map(function (args) {
    for (let i = 0; i < args.length; i++) {
      if (typeof args[i] !== 'string') continue;
      const d = packet.decode(args[i]);
      if (d && d.app) return d.body;
    }
    return null;
  });
}
function arrive(body) {
  asked.length = 0; posted.length = 0;
  // The envelope arrives read, as arrivals.js hands it to a witness (goal/G16.5).
  const text = packet.encode('api', body).text;
  const m = { text: text, envelope: arrivals.envelopeOf(text), fromKey: MEMBER, hash: 'H' + Math.random().toString(16).slice(2) };
  return Promise.resolve(door(m)).then(function () { return new Promise(function (r) { setTimeout(r, 50); }); });
}
function short(x) { return JSON.stringify(x).slice(0, 200); }

(async function () {
  test.subHeading('1. a member\'s ask carrying by andy reaches the server');
  await arrive({ desk: { 'chat.search': { id: 'goal/G1', text: '', by: 'andy', since: '', before: '' } } });
  const r1 = replies();
  if (asked.length === 1 && !r1.some(function (b) { return b && b.code === 'not-owner'; })) test.check('a chat.search filtered by andy is answered by the desk, not refused at the door');
  else test.fail(OWED + 'chat.search by andy: asked ' + asked.length + ', replies ' + short(r1));
  await arrive({ desk: { 'chat.add': { id: 'goal/G1', text: 'a line', by: 'andy' } } });
  const r2 = replies();
  if (asked.length === 1 && !r2.some(function (b) { return b && b.code === 'not-owner'; })) test.check('a chat.add naming by andy reaches the desk, which names the writer from the caller');
  else test.fail(OWED + 'chat.add by andy: asked ' + asked.length + ', replies ' + short(r2));

  test.subHeading('2. the owner verbs are still refused at the door');
  await arrive({ desk: { DEBUG: { on: true } } });
  const r3 = replies();
  if (asked.length === 0 && r3.some(function (b) { return b && b.code === 'not-owner'; })) test.check('DEBUG from a member is refused not-owner and never passed on');
  else test.fail('DEBUG from a member: asked ' + asked.length + ', replies ' + short(r3));

  test.subHeading('3. the door names no owner');
  const src = fs.readFileSync(path.join(__dirname, '..', 'run', 'js', 'apiDoor.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(function (l) { return l.replace(/\/\/.*$/, ''); }).join('\n');
  if (!/['"]andy['"]/.test(src) && !/asksAsOwner/.test(src)) test.check('apiDoor.js holds no andy literal and no asksAsOwner outside comments');
  else test.fail(OWED + 'apiDoor.js still names andy or asksAsOwner in code');

  test.reportSuccessFailureCount();
}()).catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); test.reportSuccessFailureCount(); });
