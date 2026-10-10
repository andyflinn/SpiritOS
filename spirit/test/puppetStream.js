'use strict';

// spirit/test/puppetStream.js
// goal/G14.5: the stream from a puppet to its master. Written first, red on today's code (ff2dfd3f); claude-windows
// wrote it and builds it (one agent, Andy's word). The rulings are the item's box, Andy's of 2026-10-10:
//
//   "a puppet has a special, puppet command: stream (which starts a stream of posts to the master); the master
//    that sends this to a puppet, then throws the streamed events into the node-broadcast for it's apps"
//   "inside the puppet, the publisher then publishes to the master as well. Let's make sure this is the most
//    simple thing possible."
//   "let's drop the specific app stream mechanism for now, and just send all app Server events."
//   "only while the master is live and reachable."
//   "and the appServer publisings will be serialized at their source? they are peerposts after all."
//
// WHAT IS ASSERTED (the box, SHAPE 1 to 3)
//   1. spirit/run/js/puppetStream.js: createPuppetStream({puppet, route, post, encode, log}).onJob(job): on a
//      puppet, a job-updated carrying a changed app object of a process/js module posts {module, app} to the owner
//      as a packet named published, once per change; the same object again, a log line, a job without an app, a
//      module not under process/js, and a node that is not a puppet post nothing.
//   2. only while the master is reachable: an unreachable route posts nothing, logs nothing and queues nothing;
//      the next change tries the route again.
//   3. serialized at the source: one post in flight; a module publishing again meanwhile keeps only its newest
//      object, posted when the one out returns; two modules keep their order; a refused post is one log line and
//      is not retried.
//   4. the wiring: server.js builds the stream with puppetIn, hub's chooseRoute over presence and peerRouter's
//      post, and hands job-updated to it; shell.js routes a packet named published to the onPublished handlers of
//      the module's app with the sender's key, and replays the last streamed object to an app that subscribes
//      later.
// rule/11: through testSupport only; nothing live, no ports.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const packet = require('../run/js/client/packet.js');

const OWED = 'OWED by goal/G14.5: ';
const RUN = path.join(__dirname, '..', 'run');
const OWNER = 'MCowBQYDK2VwAyEAgrEcBu0FkTzmGKs+oBS+OllzvZh+d/0Rr6fO/fXD+0c=';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function code(rel) {
  try { return fs.readFileSync(path.join(RUN, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1'); }
  catch (e) { return ''; }
}

// THE FAKES: a puppet switch, a route, a post that holds its answer until told, the real packet codec.
function world(opts) {
  const o = opts || {};
  const posted = [];
  const logged = [];
  let puppet = { puppet: true, owner: OWNER };
  let route = { relayUrl: 'https://relay.test', hints: undefined };
  let hold = null;      // when set, posts wait on this promise
  let answer = { ok: true, hash: 'h' };
  let mod = null;
  try { mod = require('../run/js/puppetStream.js'); } catch (e) { mod = null; }
  const stream = mod && typeof mod.createPuppetStream === 'function' ? mod.createPuppetStream({
    puppet: function () { return puppet; },
    route: function (to) { return to === OWNER ? route : { unreachable: true }; },
    post: function (relayUrl, toKey, text, hints) {
      const info = packet.decode(text);
      posted.push({ relayUrl: relayUrl, to: toKey, app: info && info.app, body: info && info.body, hints: hints });
      return (hold || Promise.resolve()).then(function () { return answer; });
    },
    encode: packet.encode,
    log: function (line) { logged.push(String(line)); },
  }) : null;
  return {
    stream: stream, posted: posted, logged: logged,
    setPuppet: function (p) { puppet = p; },
    setRoute: function (r) { route = r; },
    setAnswer: function (a) { answer = a; },
    holdPosts: function () { let release; hold = new Promise(function (r) { release = r; }); return function () { hold = null; release(); }; },
    job: function (module, app, extra) { return Object.assign({ id: 'j-' + module, module: module, status: 'running', app: app }, extra || {}); },
  };
}

test.startTest('goal/G14.5: a puppet streams what its servers publish to its master');

(async function () {
  // ── 1. ON A PUPPET, A CHANGED APP OBJECT IS POSTED ONCE ─────────────────
  test.subHeading('1. a changed published object goes to the owner as a packet named published, once');
  {
    const w = world();
    if (!w.stream) { test.fail(OWED + 'no spirit/run/js/puppetStream.js with createPuppetStream'); }
    else {
      w.stream.onJob(w.job('process/js/deskUnsloth', { connected: true, model: 'm1' }));
      await sleep(20);
      const p = w.posted[0];
      if (w.posted.length === 1 && p.to === OWNER && p.relayUrl === 'https://relay.test' && p.app === 'published' && p.body && p.body.module === 'process/js/deskUnsloth' && p.body.app && p.body.app.model === 'm1') {
        test.check('a job-updated with an app object posts {module, app} to the owner, over the chosen relay, as a packet named published');
      } else test.fail(OWED + 'posted ' + JSON.stringify(w.posted).slice(0, 300));
      w.stream.onJob(w.job('process/js/deskUnsloth', { connected: true, model: 'm1' }));
      w.stream.onJob(w.job('process/js/deskUnsloth', { connected: true, model: 'm1' }, { data: { logMessage: 'a line' } }));
      w.stream.onJob(w.job('process/js/deskUnsloth', undefined));
      w.stream.onJob(w.job('shell/desk', { x: 1 }));
      await sleep(20);
      if (w.posted.length === 1) test.check('the same object again, a log line beside it, a job without an app and a module not under process/js post nothing');
      else test.fail(OWED + 'extra posts: ' + JSON.stringify(w.posted.slice(1)).slice(0, 300));
      w.stream.onJob(w.job('process/js/deskUnsloth', { connected: false, model: 'm1' }));
      await sleep(20);
      if (w.posted.length === 2 && w.posted[1].body.app.connected === false) test.check('a changed object posts again');
      else test.fail(OWED + 'a change posted ' + w.posted.length + ' in all');
      w.setPuppet({ puppet: false, owner: '' });
      w.stream.onJob(w.job('process/js/deskUnsloth', { connected: true, model: 'm2' }));
      await sleep(20);
      if (w.posted.length === 2) test.check('a node that is not a puppet posts nothing');
      else test.fail(OWED + 'a non-puppet posted');
    }
  }

  // ── 2. ONLY WHILE THE MASTER IS REACHABLE ──────────────────────────────
  test.subHeading('2. an unreachable master: nothing posted, nothing logged, nothing queued');
  {
    const w = world();
    if (w.stream) {
      w.setRoute({ unreachable: true });
      w.stream.onJob(w.job('process/js/deskUnsloth', { connected: true, model: 'm1' }));
      w.stream.onJob(w.job('process/js/pushOrigin', { pushed: 3 }));
      await sleep(20);
      if (!w.posted.length && !w.logged.length) test.check('with the route unreachable two changes post nothing and log nothing');
      else test.fail(OWED + 'unreachable: posted ' + w.posted.length + ', logged ' + JSON.stringify(w.logged));
      w.setRoute({ relayUrl: 'https://relay.test' });
      await sleep(20);
      if (!w.posted.length) test.check('nothing was queued for later: the route coming back posts nothing by itself');
      else test.fail(OWED + 'queued posts went out when the route came back: ' + w.posted.length);
      w.stream.onJob(w.job('process/js/deskUnsloth', { connected: true, model: 'm3' }));
      await sleep(20);
      if (w.posted.length === 1 && w.posted[0].body.app.model === 'm3') test.check('the next change tries the route again and goes');
      else test.fail(OWED + 'after the route came back: ' + JSON.stringify(w.posted).slice(0, 200));
    }
  }

  // ── 3. SERIALIZED AT THE SOURCE ────────────────────────────────────────
  test.subHeading('3. one post in flight; the newest object per module waits; a refused post is one log line');
  {
    const w = world();
    if (w.stream) {
      const release = w.holdPosts();
      for (let n = 1; n <= 5; n++) w.stream.onJob(w.job('process/js/deskUnsloth', { n: n }));
      w.stream.onJob(w.job('process/js/pushOrigin', { pushed: 1 }));
      w.stream.onJob(w.job('process/js/pushOrigin', { pushed: 2 }));
      await sleep(20);
      const before = w.posted.length;
      release();
      await sleep(50);
      const seq = w.posted.map(function (p) { return p.body.module.replace('process/js/', '') + ':' + JSON.stringify(p.body.app); });
      if (before === 1 && seq.join(' ') === 'deskUnsloth:{"n":1} deskUnsloth:{"n":5} pushOrigin:{"pushed":2}') {
        test.check('while the first post was out only it had gone; released, the newest of each module followed, one at a time, modules in order: ' + seq.join(' '));
      } else test.fail(OWED + 'before release ' + before + ' post(s); sequence ' + seq.join(' '));
      w.setAnswer({ ok: false, status: 503, error: 'relay busy' });
      w.stream.onJob(w.job('process/js/deskUnsloth', { n: 6 }));
      await sleep(30);
      w.setAnswer({ ok: true, hash: 'h' });
      await sleep(30);
      const refused = w.logged.filter(function (l) { return /deskUnsloth/.test(l) && /busy|not posted|refused/.test(l); }).length;
      if (w.posted.length === 4 && refused === 1) test.check('a post the relay refuses is said once in the log and not posted again');
      else test.fail(OWED + 'after a refusal: ' + w.posted.length + ' posts, log ' + JSON.stringify(w.logged));
    }
  }

  // ── 4. THE WIRING ──────────────────────────────────────────────────────
  test.subHeading('4. server.js hands job-updated to the stream; shell.js routes a published packet to onPublished');
  {
    const srv = code('js/server.js');
    if (/puppetStream/.test(srv) && /createPuppetStream\(/.test(srv) && /jobs\.events\.on\('job-updated',\s*\w+\.onJob\)/.test(srv) && /puppetIn\(/.test(srv)) {
      test.check('server.js builds the stream with puppetIn, chooseRoute and the router\'s post, and listens to job-updated');
    } else test.fail(OWED + 'server.js: requires puppetStream ' + /puppetStream/.test(srv) + ', listens to job-updated with onJob ' + /jobs\.events\.on\('job-updated',\s*\w+\.onJob\)/.test(srv));
    const sh = code('js/client/shell.js');
    if (/info\.app === 'published'/.test(sh) && /streamedLast/.test(sh) && /publishedHandlers\['shell\/' \+/.test(sh)) {
      test.check('shell.js routes a packet named published to the published handlers of the module\'s app and keeps the last streamed object for a late subscriber');
    } else test.fail(OWED + 'shell.js: routes published packets ' + /info\.app === 'published'/.test(sh) + ', keeps the last streamed ' + /streamedLast/.test(sh));
    if (/fn\(job\.app,\s*\{\s*from: ''/.test(sh) || /handler\(job\.app,\s*\{\s*from: ''/.test(sh)) test.check('a local published object is handed over with from empty, so one handler tells local from streamed');
    else test.fail(OWED + 'shell.js hands local published objects over without a from');
  }

  test.reportSuccessFailureCount();
  process.exit(0);
}());
