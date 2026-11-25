'use strict';

// spirit/run/spirit/streamSink/test/script.js
// The tests of spirit/streamSink/script.js, and of no other module (spec: ./script.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, the cycle "the top 10 reds of Andy's testicle", 10: streamSink
// was red in the garbage rule because it had none).
//
// createStreamSink(res, opts) is the sink a relay hands relay.js for one held stream. Here res is a hand that keeps what
// is done to it, and its writableLength is set by the test, so a reader that stops reading is planted, not waited for.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
const S = require(path.join(RUN, 'spirit', 'script.js'));
const test = S.requireScript('spirit/test/testReport.js');
const { createStreamSink } = S.requireScript('spirit/streamSink/script.js');

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
  return A.heads.length === 0 || false;
}, test.limit.quick);
test.run('the sink\'s first write writes the head, status 200 for an event stream that is not cached and kept alive', 0.2, function () {
  a.write('event: hello\n\n');
  const h = A.heads[0] || {};
  const hd = h.headers || {};
  return (A.heads.length === 1 && h.status === 200 && hd['Content-Type'] === 'text/event-stream' && hd['Cache-Control'] === 'no-cache' && hd['Connection'] === 'keep-alive') || false;
}, test.limit.quick);
test.run('the sink\'s first write also writes the chunk itself', 0.2, function () {
  return (A.chunks.length === 1 && A.chunks[0] === 'event: hello\n\n') || false;
}, test.limit.quick);
test.run('a second write writes no second head', 0.2, function () {
  a.write('event: again\n\n');
  return (A.heads.length === 1 && A.chunks.length === 2) || false;
}, test.limit.quick);
test.run('a reader that reads is not stalled', 0.2, function () {
  return (a.stalled() === false && A.destroyed === 0) || false;
}, test.limit.quick);
test.run('closing the sink ends the response', 0.2, function () {
  a.close();
  return A.ended === 1 || false;
}, test.limit.quick);

// A READER THAT STOPPED READING: the backlog past its cap after a write
const B = res();
const told = [];
const b = createStreamSink(B, { backlogMax: 100, onStall: function (n) { told.push(n); } });
let thrown = null, toldAtOnce = -1;
test.run('a write is made that leaves 150 bytes unread behind it, past a cap of 100', 0.2, function () {
  b.write('event: one\n\n');
  B.writableLength = 150;
  try { b.write('event: two\n\n'); } catch (e) { thrown = e; }
  toldAtOnce = told.length;
  return true;
}, test.limit.quick);
test.run('the write past the cap throws, so the packet that tipped it is not delivered', 0.2, function () {
  return (!!thrown && /stream cut/.test(String(thrown.message))) || false;
}, test.limit.quick);
test.run('past the cap the response is destroyed, cut loose with no goodbye written', 0.2, function () {
  return (B.destroyed === 1 && B.chunks.length === 2 && !/disconnect|goodbye/i.test(B.chunks.join(''))) || false;
}, test.limit.quick);
test.run('a sink cut past its cap says it is stalled', 0.2, function () {
  return b.stalled() === true || false;
}, test.limit.quick);
test.run('onStall is not called inside the write', 0.2, function () {
  return toldAtOnce === 0 || false;
}, test.limit.quick);
test.run('onStall is called once, on the next turn, with the backlog that tripped it', 0.2, async function () {
  await tick();
  await tick();
  return (told.length === 1 && told[0] === 150) || false;
}, test.limit.quick);
test.run('a cut sink takes nothing more, so a later write throws and writes nothing', 0.2, function () {
  let again = null;
  try { b.write('event: three\n\n'); } catch (e) { again = e; }
  return (!!again && B.chunks.length === 2) || false;
}, test.limit.quick);

// THE CAP BY DEFAULT: limits.STREAM_BACKLOG_MAX
test.run('with no cap given, the cap is the stream backlog maximum set in limits.js', 0.2, function () {
  const limits = S.requireScript('spirit/limits/script.js');
  const max = limits.STREAM_BACKLOG_MAX;
  if (!(max > 0)) return false;
  const C = res();
  const c = createStreamSink(C);
  C.writableLength = max;
  let at = null, over = null;
  try { c.write('x'); } catch (e) { at = e; }
  C.writableLength = max + 1;
  try { c.write('y'); } catch (e) { over = e; }
  return (!at && !!over) || false;
}, test.limit.quick);
