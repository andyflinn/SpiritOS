'use strict';

// spirit/run/spirit/event/event.js
// THE NODE'S ONE DISPATCHER OF EVENTS (goal/G40.6). Andy, 2026-10-25: "two verbs on events - publish - subscribe", and
// "from now on. ONE path for everybody to publish events. decision. and don't come later and say that i never said
// that." /api/events was a door outside any api; it is this family now, owner only on the node's loopback table, like fs.
//
// The sources feed it, the subscribers subscribe:
//   sources       the jobs (every job created, changed or deleted, a server's published object among them), what a
//                 relay this node owns did, the packets that arrive, the contact renames
//   subscribers   the node's own pages, its own processes (both through event.subscribe, a stream), and the owner's
//                 face (faceHome, in the node, through subscribe below)
//
//   event.subscribe {}   a stream: what is known now (the jobs as they stand, and the file tree as commands), then every
//                         event as it happens, each with its kind. A process says it is one (X-Spirit-Reader: server): it
//                         watches the packets pass and takes none, so the owner's waiting lines stay his.
//   event.publish {id, status?, data?, logMessage?, app?}   a process publishes on its own job (SPIRIT_JOB_ID): its state
//                         or its object (app). The job is changed and every subscriber hears it; jobs keeps the last
//                         state and object, so a page that opens later is handed them in its snapshot.
//
// It holds nothing of its own: the jobs keep the jobs.

// The spirit object first, as the global spirit (goal/G40.1).
require('../script.js');
const limits = spirit.requireScript('spirit/limits/script.js');

// o: { jobs, relayEvents, arrivals, renames, readJsonBody, bodyRefused, pageStreams, pageConnected? }
//   pageConnected()   called at each page's connect (goal/G47.5, part 2), after it is subscribed
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

  // event.subscribe, the stream (was server.js handleSseConnection).
  function handleSubscribe(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    // When it last wrote anything, so the beat below goes only into a quiet second.
    let wroteAt = Date.now();
    // A PAGE GETS THE SERVABLE TREE ONLY (goal/G49.2; Andy: "it is at publish-to-clients time that !fileServable be the
    // filter", "the node knows if a browser is the loopback client, that's really the only place"): the node's tree is whole,
    // and a reader that is no process of a node (no X-Spirit-Reader: server) is handed no spirit.fs command of a path the serve
    // rule refuses. A process of the node gets every one.
    const asServer = req.headers['x-spirit-reader'] === 'server';
    const fileServable = spirit.requireScript('spirit/fs/fileSystem/script.js').fileServable;
    const hidden = function (kind, data) {
      const c = kind === 'job-updated' && data && data.id === 'spirit.fs' && data.data ? data.data.command : null;
      return !asServer && !!c && !!c.path && !fileServable(String(c.path));
    };
    // The spirit.fs job keeps its last command; in a page's snapshot one of a refused path goes out of it.
    const pageJob = function (j) {
      const c = !asServer && j && j.id === 'spirit.fs' && j.data ? j.data.command : null;
      return c && c.path && !fileServable(String(c.path)) ? Object.assign({}, j, { data: {} }) : j;
    };
    const write = function (kind, data) {
      if (hidden(kind, data)) return;
      if (kind === 'snapshot' && data && Array.isArray(data.jobs)) data = Object.assign({}, data, { jobs: data.jobs.map(pageJob) });
      wroteAt = Date.now();
      res.write('event: ' + kind + '\ndata: ' + JSON.stringify(data) + '\n\n');
    };

    write('snapshot', { jobs: o.jobs.listJobs() });
    // THE NODE'S OWN JOBS, EACH KIND OF NEWS ONCE (goal/G43.20): a job of one family carries one kind of news per event, so
    // right after the snapshot the newest news of every kind comes as its own job-updated, as a page that was there heard it.
    o.jobs.listJobs().filter(function (j) { return j.kind === 'permanent' && j.id !== 'spirit.fs'; }).forEach(function (j) {
      (typeof o.jobs.newsOf === 'function' ? o.jobs.newsOf(j) : [j]).forEach(function (one) { write('job-updated', one); });
    });
    // THE TREE ARRIVES AS COMMANDS (goal/G4.25; Andy: "the beginning can be a stream of changes that build the tree
    // (MAX_PAYLOAD)", "forget about batching"). The snapshot's spirit.fs job carries no file list; right after it, one
    // spirit.fs job-updated per entry, a createDirectory before what is inside it, then one carrying data.treeComplete,
    // so the shell knows the tree is whole before it discovers apps from it.
    const fsJob = o.jobs.getJob ? o.jobs.getJob('spirit.fs') : null;
    if (fsJob) {
      spirit.requireScript('spirit/fs/dataset/script.js').commands().forEach(function (command) { write('job-updated', Object.assign({}, fsJob, { data: { command: command } })); });
      write('job-updated', Object.assign({}, fsJob, { data: { treeComplete: true } }));
    }

    // A SERVER IS NOT A PAGE (goal/G16.9). A page is handed the backlog and marks what it takes, so the owner sees each
    // line once. A loopback server awaiting one reply (spirit.peerPost says so with X-Spirit-Reader: server) witnesses
    // instead: it sees each new packet, gets no backlog and marks nothing taken, or every post it made would eat the
    // owner's waiting lines.
    const off = subscribe(write, { packets: asServer ? 'witness' : 'take' });
    // A PAGE'S CONNECT IS PASSED ON TO THE APP SERVERS (goal/G47.5, part 2; Andy: "the node forwards a loopback connect to the
    // as server as a normal request, so that spirit/server/app/script.js knows a loopback client connected"): a page, never a
    // process, once its snapshot is written and it is subscribed, so what a server publishes in answer reaches it.
    if (!asServer && typeof o.pageConnected === 'function') { try { o.pageConnected(); } catch (e) { /* the page has its snapshot */ } }

    o.pageStreams.add(res);
    // A QUIET NODE IS NEVER TAKEN FOR DEAD (goal/G47.1, box v148: "the node beats each second when it has nothing else to send,
    // on the page's stream (spirit/event/event.js, every 20 s today)"): a page resets a stream that brought nothing for 5 s, so a
    // second that wrote nothing ends with a beat, a comment line no reader takes for an event.
    const BEAT_MS = 1000;
    // Looked at four times a second, so no quiet gap grows much past the second.
    const heartbeat = setInterval(function () { if (Date.now() - wroteAt >= BEAT_MS) { wroteAt = Date.now(); res.write(':\n\n'); } }, BEAT_MS / 4);

    // Bound to 'error' as well as 'close': a socket that dies without a clean close (a killed browser, a dropped
    // network) never fired 'close', leaving the heartbeat writing to a dead response forever and every listener
    // attached. Guarded so it runs once whichever fires first.
    // THE RESPONSE'S CLOSE, NOT THE REQUEST'S (goal/G43.3; Andy: "this is a severe core-bug"): the door reads the body
    // before this runs, so the request's close has already fired, and every stream that ended stayed subscribed for good.
    let torndown = false;
    function teardown() {
      if (torndown) return;
      torndown = true;
      o.pageStreams.delete(res);
      clearInterval(heartbeat);
      off();
    }
    res.on('close', teardown);
    req.on('error', teardown);
    res.on('error', teardown);
  }

  // event.publish, a process's state or object on its own job (was server.js handleJobUpdate, job.update). The id is
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
