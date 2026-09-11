'use strict';

// spirit/run/js/presenceNode.js
// The personal node's half of presence: one held connection to every
// relay it holds a row on, merged into one table, published to the shell
// as a permanent job.
//
// A third permanent job beside fs-watcher and server-stats, and for the
// same reason those are jobs: long-lived node state whose updates the
// shell already receives. `/api/events` carries it as `job-updated`, so
// NO NEW SHELL-FACING CHANNEL EXISTS AT ALL — which is the whole reason
// for the shape (design/relay/PRESENCE.md §3).
//
// It lives here rather than in jobs.js because jobs.js is generic
// infrastructure and this knows about relays, keys and signatures.

const path = require('path');
const auth = require('./relayAuth');
const ownerBadge = require('./ownerBadge');
const sseClient = require('./sseClient');

function streamUrl(relayUrl, key) {
  return String(relayUrl).replace(/\/+$/, '') +
    '/api/relay/stream?key=' + encodeURIComponent(key);
}

// opts: { rootDir, jobs, connectImpl, probeImpl, now }
function createPresence(opts) {
  opts = opts || {};
  const rootDir = opts.rootDir || path.join(__dirname, '..');
  const jobs = opts.jobs;
  const openStream = opts.connectImpl || sseClient.connect;

  // relay url -> { key -> bool }. THE PER-RELAY DETAIL LIVES HERE AND
  // NOWHERE ELSE. Andy's ruling: the shell gets one merged set and apps
  // filter it. Deciding needs the breakdown, so the node keeps it; the
  // shell is told the verdict (PRESENCE.md §4).
  let byRelay = Object.create(null);
  let streams = Object.create(null);
  let job = null;
  let lastJson = '';
  let identity = null;

  // 🟢 any relay says present; 🔴 some relay says absent and none says
  // present; ⚪ no relay mentions this key at all.
  //
  // White needs no entry: a key absent from this map is one no relay
  // named, which is exactly "not known". That is why the relay's
  // snapshot has to be the roster WITH STATES — if it listed only the
  // connected, every away member would silently become white.
  function merge() {
    const out = Object.create(null);
    Object.keys(byRelay).forEach(function (url) {
      const set = byRelay[url];
      Object.keys(set).forEach(function (key) {
        if (set[key]) out[key] = true;
        else if (out[key] === undefined) out[key] = false;
      });
    });
    return out;
  }

  // ONLY WHEN THE SET ACTUALLY CHANGES. fs-watcher learned this the
  // expensive way — "a rescan that says the same thing is not news" —
  // and presence has the same hazard from the other end: every app
  // subscribed to jobs sees every job-updated, so a quiet relay must not
  // repaint the Jobs screen forever.
  function publish(logMessage) {
    if (!job || !jobs) return false;
    const next = merge();
    const asJson = JSON.stringify(next);
    if (asJson === lastJson && !logMessage) return false;
    lastJson = asJson;
    jobs.updateJob(job.id, {
      data: { presence: next },
      logMessage: logMessage,
    });
    return true;
  }

  function onRoster(url, body) {
    const set = Object.create(null);
    ((body && body.members) || []).forEach(function (m) {
      if (m && m.key) set[m.key] = !!m.present;
    });
    byRelay[url] = set;
    publish();
  }

  function onChange(url, body) {
    if (!body || !body.key) return;
    if (!byRelay[url]) byRelay[url] = Object.create(null);
    byRelay[url][body.key] = !!body.present;
    publish();
  }

  // A relay we cannot reach knows nothing, so it must stop asserting.
  // Leaving its last roster in place would keep peers green minutes
  // after the connection died — the relay would not be lying, we would.
  function forget(url) {
    if (!byRelay[url]) return;
    delete byRelay[url];
    publish();
  }

  function openTo(url) {
    if (streams[url]) return;
    const sig = auth.sign(identity.privateKey, auth.streamMessage(identity.publicKey));
    streams[url] = openStream({
      url: streamUrl(url, identity.publicKey),
      // The signature is a HEADER. A query string lands in every access
      // log the request passes, and the relay refuses one there even
      // when the header is good.
      headers: { 'X-Spirit-Sig': sig },
      onEvent: function (msg) {
        if (msg.event === 'roster') onRoster(url, msg.data);
        else if (msg.event === 'presence') onChange(url, msg.data);
      },
      onOpen: function () { publish('connected to ' + url); },
      onClose: function (reason) { forget(url); publish('lost ' + url + ': ' + reason); },
    });
  }

  // Which relays this node holds a ROW on, which since B2 is not the
  // same as the ones it owns. A peer owns nothing and still has presence
  // to receive.
  function start(probe) {
    identity = auth.loadIdentity(rootDir);
    if (!identity || !identity.publicKey || !identity.privateKey) {
      return Promise.resolve([]);
    }
    if (!job && jobs) {
      job = jobs.createJob('permanent', 'relay-presence', { presence: {} });
    }
    const ask = probe || opts.probeImpl;
    if (!ask) return Promise.resolve([]);
    return Promise.resolve()
      .then(function () {
        return ownerBadge.probe(rootDir, identity.name, ask, identity.publicKey);
      })
      .then(function (summary) {
        const urls = (summary && summary.claimedUrls) || [];
        urls.forEach(openTo);
        return urls;
      })
      .catch(function () { return []; });
  }

  function stop() {
    Object.keys(streams).forEach(function (url) {
      try { streams[url].close(); } catch (e) { /* already gone */ }
    });
    streams = Object.create(null);
    byRelay = Object.create(null);
    lastJson = '';
  }

  return {
    start: start,
    stop: stop,
    // In-process readers, for tests and for whatever needs the answer
    // without waiting for a job event.
    table: merge,
    detail: function () { return byRelay; },
    jobId: function () { return job && job.id; },
    // Fed by tests standing in for a relay.
    _roster: onRoster,
    _change: onChange,
    _forget: forget,
  };
}

module.exports = { createPresence: createPresence, streamUrl: streamUrl };
