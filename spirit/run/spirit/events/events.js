'use strict';

// spirit/run/spirit/events/events.js
// THE NODE'S ONE DISPATCHER OF EVENTS (goal/G40.6). Andy, 2026-10-25: "two verbs on events - publish - subscribe", and
// "from now on. ONE path for everybody to publish events. decision. and don't come later and say that i never said
// that." /api/events was a door outside any api; it is this family now, owner only on the node's loopback table, like fs.
//
// The sources feed it, the subscribers subscribe:
//   sources       the jobs (every job created, changed or deleted, a server's published object among them), what a
//                 relay this node owns did, the packets that arrive, the contact renames
//   subscribers   the node's own pages, its own processes (both through events.subscribe, a stream), and the owner's
//                 face (faceHome, in the node, through subscribe below)
//
//   events.subscribe {}   a stream: what is known now (the jobs as they stand, and the file tree as commands), then every
//                         event as it happens, each with its kind. A process says it is one (X-Spirit-Reader: server): it
//                         watches the packets pass and takes none, so the owner's waiting lines stay his.
//   events.publish {id, status?, data?, logMessage?, app?}   a process publishes on its own job (SPIRIT_JOB_ID): its state
//                         or its object (app). The job is changed and every subscriber hears it; jobs keeps the last
//                         state and object, so a page that opens later is handed them in its snapshot.
//
// It holds nothing of its own: the jobs keep the jobs.

// The spirit object first, as the global spirit (goal/G40.1).
require('../../spirit.js');
const limits = require('../limits');

// o: { jobs, relayEvents, arrivals, renames, readJsonBody, bodyRefused, pageStreams }
function createEvents(o) {
  // ONE SUBSCRIPTION, IN THE NODE: fn(kind, data) for every event from every source. packets: 'take' (a page: the
  // backlog handed, each marked taken), 'witness' (a process: each new one seen, none taken) or 'none' (the face's
  // home side, which carries no packets).
  function subscribe(fn, opts) {
    const packets = (opts && opts.packets) || 'none';
    const tell = function (kind) { return function (data) { try { fn(kind, data); } catch (e) { /* one subscriber's fault */ } }; };
    const onJobUpdated = tell('job-updated');
    const onJobDeleted = tell('job-deleted');
    o.jobs.events.on('job-updated', onJobUpdated);
    o.jobs.events.on('job-deleted', onJobDeleted);
    const offRelayEvent = o.relayEvents.subscribe(tell('relay-event'));
    // Written the page's shape, without the envelope a witness is handed, so both readers parse one wire.
    const onPacket = function (message) {
      const plain = Object.assign({}, message);
      delete plain.envelope;
      tell('packet')(plain);
    };
    const offArrival = packets === 'take' ? o.arrivals.subscribe(onPacket) : packets === 'witness' ? o.arrivals.witness(onPacket) : function () {};
    const offContactRename = o.renames.subscribe(tell('contact.rename'));
    let off = false;
    return function unsubscribe() {
      if (off) return;
      off = true;
      o.jobs.events.off('job-updated', onJobUpdated);
      o.jobs.events.off('job-deleted', onJobDeleted);
      offArrival();
      offRelayEvent();
      offContactRename();
    };
  }

  // events.subscribe, the stream (was server.js handleSseConnection).
  function handleSubscribe(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    const write = function (kind, data) { res.write('event: ' + kind + '\ndata: ' + JSON.stringify(data) + '\n\n'); };

    write('snapshot', { jobs: o.jobs.listJobs() });
    // THE TREE ARRIVES AS COMMANDS (goal/G4.25; Andy: "the beginning can be a stream of changes that build the tree
    // (MAX_PAYLOAD)", "forget about batching"). The snapshot's fs-watcher job carries no file list; right after it, one
    // fs-watcher job-updated per entry, a createDirectory before what is inside it, then one carrying data.treeComplete,
    // so the shell knows the tree is whole before it discovers apps from it.
    const fsJob = o.jobs.listJobs().filter(function (j) { return j.type === 'fs-watcher'; })[0];
    if (fsJob) {
      o.jobs.fsTreeCommands().forEach(function (command) { write('job-updated', Object.assign({}, fsJob, { data: { command: command } })); });
      write('job-updated', Object.assign({}, fsJob, { data: { treeComplete: true } }));
    }

    // A SERVER IS NOT A PAGE (goal/G16.9). A page is handed the backlog and marks what it takes, so the owner sees each
    // line once. A loopback server awaiting one reply (spirit.peerPost says so with X-Spirit-Reader: server) witnesses
    // instead: it sees each new packet, gets no backlog and marks nothing taken, or every post it made would eat the
    // owner's waiting lines.
    const asServer = req.headers['x-spirit-reader'] === 'server';
    const off = subscribe(write, { packets: asServer ? 'witness' : 'take' });

    o.pageStreams.add(res);
    const heartbeat = setInterval(function () { res.write(':\n\n'); }, 20000);

    // Bound to 'error' as well as 'close': a socket that dies without a clean close (a killed browser, a dropped
    // network) never fired 'close', leaving the heartbeat writing to a dead response forever and every listener
    // attached. Guarded so it runs once whichever fires first.
    let torndown = false;
    function teardown() {
      if (torndown) return;
      torndown = true;
      o.pageStreams.delete(res);
      clearInterval(heartbeat);
      off();
    }
    req.on('close', teardown);
    req.on('error', teardown);
    res.on('error', teardown);
  }

  // events.publish, a process's state or object on its own job (was server.js handleJobUpdate, jobs.update). The id is
  // a field, and the rest of the call's args is the patch (the door hands the args on as the body, goal/G41.15).
  function handlePublish(req, res) {
    o.readJsonBody(req).then(function (whole) {
      const id = String((whole && whole.id) || '');
      const body = Object.assign({}, whole);
      delete body.id;
      // An object over MAX_PAYLOAD is refused here by name, with its size and the limit, never kept or streamed.
      const appBytes = body.app && typeof body.app === 'object' ? Buffer.byteLength(JSON.stringify(body.app), 'utf8') : 0;
      if (appBytes > limits.PAYLOAD_MAX) {
        res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, code: 'app-request-too-large', error: 'the published object is too large', extra: { bytes: appBytes, max: limits.PAYLOAD_MAX } }));
        return;
      }
      const job = o.jobs.updateJob(id, body);
      if (!job) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(job));
    }).catch(function (e) { o.bodyRefused(req, res, e); });
  }

  return { subscribe: subscribe, handleSubscribe: handleSubscribe, handlePublish: handlePublish };
}

module.exports = { createEvents: createEvents };
