'use strict';

// spirit/run/js/puppetStream.js
// A PUPPET STREAMS WHAT ITS SERVERS PUBLISH TO ITS MASTER (goal/G14.5).
//
//   Andy, 2026-10-10: "a puppet has a special, puppet command: stream (which starts a stream of posts to the
//   master); the master that sends this to a puppet, then throws the streamed events into the node-broadcast for
//   it's apps". Then: "inside the puppet, the publisher then publishes to the master as well. Let's make sure this
//   is the most simple thing possible." "let's drop the specific app stream mechanism for now, and just send all
//   app Server events." "only while the master is live and reachable." "and the appServer publisings will be
//   serialized at their source? they are peerposts after all."
//
// THE ONE POINT. A server publishes by jobs.report {app}; the node keeps the object on the job record and emits
// job-updated (jobs.js), which every open page gets. This listens to that same event and, on a puppet (owner.json
// names another key, puppetMode.puppetIn), posts {module, app} to the owner as a packet named published, so the
// master's pages get it as its own would (shell.js routes it to onPublished). No verb, no subscription, nothing
// switched on: every server's objects, always.
//
// WHAT IS NOT POSTED: the same object again (a job-updated for a log line carries the same app), a job with no app,
// anything not under process/js, anything from a node that is not a puppet. Over PAYLOAD_MAX never reaches the job
// record (jobs.js refuses it), so never this.
//
// ONLY WHILE THE MASTER IS REACHABLE: the same route check the owner door's sending end makes (hub.chooseRoute over
// presence). Unreachable means no post, no log line and NOTHING QUEUED: what was waiting is dropped, and the next
// change tries the route again. A relay that refuses is one line in the log, and that object is not posted again.
//
// SERIALIZED AT THE SOURCE: one post in flight at a time. A module that publishes again meanwhile keeps only its
// newest object, posted when the one out returns; modules keep the order they first came in. So a burst collapses
// and the relay never sees two posts from one puppet at once.

function createPuppetStream(opts) {
  const o = opts || {};
  const say = typeof o.log === 'function' ? o.log : function () {};
  const last = Object.create(null);     // module -> the last object seen, as JSON
  let waiting = Object.create(null);    // module -> the newest object not yet posted
  let order = [];                       // modules waiting, first come first
  let inFlight = false;

  function module(job) {
    const m = String((job && job.module) || '');
    return /^process\/js\/[^/]+$/.test(m) ? m : '';
  }

  function drop() { waiting = Object.create(null); order = []; }

  function drain() {
    if (inFlight) return;
    const m = order.shift();
    if (!m) return;
    const app = waiting[m];
    delete waiting[m];
    const p = o.puppet();
    if (!p || !p.puppet || !p.owner) { drop(); return; }
    const route = o.route(p.owner);
    if (!route || route.unreachable || !route.relayUrl) { drop(); return; }
    const made = o.encode('published', { module: m, app: app });
    if (!made || !made.text) {
      say('puppet stream: ' + m + ' not posted: its object could not be packed');
      drain();
      return;
    }
    inFlight = true;
    Promise.resolve(o.post(route.relayUrl, p.owner, made.text, route.hints)).then(function (r) {
      if (!r || r.ok === false) say('puppet stream: ' + m + ' not posted: ' + ((r && (r.error || r.code)) || 'no answer'));
    }, function (e) {
      say('puppet stream: ' + m + ' not posted: ' + ((e && e.message) || e));
    }).then(function () {
      inFlight = false;
      drain();
    });
  }

  // One job-updated, as the node emits it. Only a changed app object of a process/js module counts.
  function onJob(job) {
    const m = module(job);
    if (!m || !job.app || typeof job.app !== 'object' || Array.isArray(job.app)) return;
    let seen = '';
    try { seen = JSON.stringify(job.app); } catch (e) { return; }
    if (last[m] === seen) return;
    last[m] = seen;
    const p = o.puppet();
    if (!p || !p.puppet || !p.owner) return;
    if (!(m in waiting)) order.push(m);
    waiting[m] = job.app;
    drain();
  }

  return { onJob: onJob };
}

module.exports = { createPuppetStream: createPuppetStream };
