'use strict';

// spirit/run/spirit/test/streamSink.js
// The tests of spirit/streamSink.js, and of no other module (spec: ./streamSink.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, the cycle "the top 10 reds of Andy's testicle", 10: streamSink
// was red in the garbage rule because it had none).
//
// createStreamSink(res, opts) is the sink a relay hands relay.js for one held stream. Here res is a hand that keeps what
// is done to it, and its writableLength is set by the test, so a reader that stops reading is planted, not waited for.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { createStreamSink } = require(path.join(RUN, 'spirit', 'streamSink.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// A held response, as the relay holds one: what was written, its head, whether it was destroyed or ended.
function res() {
  return { heads: [], chunks: [], writableLength: 0, destroyed: 0, ended: 0,
    writeHead: function (status, headers) { this.heads.push({ status: status, headers: headers }); },
    write: function (c) { this.chunks.push(String(c)); return true; },
    destroy: function () { this.destroyed += 1; },
    end: function () { this.ended += 1; } };
}
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };

// THE HEAD, WRITTEN LAZILY
const A = res();
const a = createStreamSink(A, { backlogMax: 100 });
test.run('a sink made writes no head until its first write', 0.2, function () {
  return A.heads.length === 0 || 'heads written before any write: ' + short(A.heads);
}, test.limit.quick);
test.run('its first write writes the head: 200, an event stream, not cached, kept alive', 0.2, function () {
  a.write('event: hello\n\n');
  const h = A.heads[0] || {};
  const hd = h.headers || {};
  return (A.heads.length === 1 && h.status === 200 && hd['Content-Type'] === 'text/event-stream' && hd['Cache-Control'] === 'no-cache' && hd['Connection'] === 'keep-alive') || 'heads: ' + short(A.heads);
}, test.limit.quick);
test.run('and the chunk itself', 0.2, function () {
  return (A.chunks.length === 1 && A.chunks[0] === 'event: hello\n\n') || 'chunks: ' + short(A.chunks);
}, test.limit.quick);
test.run('a second write writes no second head', 0.2, function () {
  a.write('event: again\n\n');
  return (A.heads.length === 1 && A.chunks.length === 2) || 'heads ' + A.heads.length + ', chunks ' + A.chunks.length;
}, test.limit.quick);
test.run('a reader that reads is not stalled', 0.2, function () {
  return (a.stalled() === false && A.destroyed === 0) || 'stalled ' + a.stalled() + ', destroyed ' + A.destroyed;
}, test.limit.quick);
test.run('close ends the response', 0.2, function () {
  a.close();
  return A.ended === 1 || 'ended ' + A.ended + ' times';
}, test.limit.quick);

// A READER THAT STOPPED READING: the backlog past its cap after a write
const B = res();
const told = [];
const b = createStreamSink(B, { backlogMax: 100, onStall: function (n) { told.push(n); } });
let thrown = null, toldAtOnce = -1;
test.run('the world: a write leaves 150 bytes unread behind it, past a cap of 100', 0.2, function () {
  b.write('event: one\n\n');
  B.writableLength = 150;
  try { b.write('event: two\n\n'); } catch (e) { thrown = e; }
  toldAtOnce = told.length;
  return true;
}, test.limit.quick);
test.run('that write throws: the packet that tipped it is not delivered', 0.2, function () {
  return (!!thrown && /stream cut/.test(String(thrown.message))) || 'thrown: ' + short(thrown && thrown.message);
}, test.limit.quick);
test.run('the response is destroyed, cut loose with no goodbye written', 0.2, function () {
  return (B.destroyed === 1 && B.chunks.length === 2 && !/disconnect|goodbye/i.test(B.chunks.join(''))) || 'destroyed ' + B.destroyed + ', chunks ' + short(B.chunks);
}, test.limit.quick);
test.run('stalled says so', 0.2, function () {
  return b.stalled() === true || 'stalled: ' + b.stalled();
}, test.limit.quick);
test.run('onStall is not called inside the write', 0.2, function () {
  return toldAtOnce === 0 || 'onStall called ' + toldAtOnce + ' times inside the write';
}, test.limit.quick);
test.run('onStall is called once, on the next turn, with the backlog that tripped it', 0.2, async function () {
  await tick();
  await tick();
  return (told.length === 1 && told[0] === 150) || 'onStall told ' + short(told);
}, test.limit.quick);
test.run('a cut sink takes nothing more: a later write throws and writes nothing', 0.2, function () {
  let again = null;
  try { b.write('event: three\n\n'); } catch (e) { again = e; }
  return (!!again && B.chunks.length === 2) || 'thrown ' + short(again && again.message) + ', chunks ' + B.chunks.length;
}, test.limit.quick);

// THE CAP BY DEFAULT: limits.STREAM_BACKLOG_MAX
test.run('with no cap given, the cap is limits.STREAM_BACKLOG_MAX', 0.2, function () {
  const limits = require(path.join(RUN, 'spirit', 'limits.js'));
  const max = limits.STREAM_BACKLOG_MAX;
  if (!(max > 0)) return 'limits.STREAM_BACKLOG_MAX is ' + short(max) + ': nothing judged';
  const C = res();
  const c = createStreamSink(C);
  C.writableLength = max;
  let at = null, over = null;
  try { c.write('x'); } catch (e) { at = e; }
  C.writableLength = max + 1;
  try { c.write('y'); } catch (e) { over = e; }
  return (!at && !!over) || 'at the cap: ' + short(at && at.message) + '; one byte past: ' + short(over && over.message);
}, test.limit.quick);
