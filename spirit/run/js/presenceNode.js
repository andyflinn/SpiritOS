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
// Which key a relay answers to, pinned when this node took its seat.
const relayKeys = require('./relayKeys');

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
  // Establishes which key a relay answers with, and refuses it if that
  // changed. Injected rather than required, so this file keeps knowing
  // nothing about enrolment — see pinRelay below for why it is here.
  const pin = typeof opts.pinRelay === 'function' ? opts.pinRelay : null;
  // THE NODE FILTERS (Andy, 2026-09-19: "the relay broadcasts, the node
  // filters"). A relay tells every member who comes and goes; this node
  // keeps only the keys it has a use for — its own contacts — so its
  // picture grows with its book, not with the relay's roll. Absent, it
  // keeps everything (the in-process suites).
  const knows = typeof opts.knows === 'function' ? opts.knows : null;
  // Given rather than made here, because a node has ONE of these and the
  // hub needs the same instance to post from — an outbound request and
  // the answer that matches it must meet in the same table.
  //
  // REQUIRED, and loudly. This read `opts.router || null`, and both event
  // lines below were guarded `&& router` — so a stream built without the
  // post half accepted every `request` and `reply` and dropped them on the
  // floor. That is the exact failure router.js's own header names as the
  // worst available: answerable but undeliverable, nobody erroring,
  // nothing logged, and the only symptom is silence for the length of
  // somebody's patience.
  //
  // The invariant was stated here in a comment and enforced nowhere, which
  // held while server.js was the only caller. A relay is about to be the
  // second one (AGENT.md, Comms) and must not be able to construct half an
  // interface. Andy: "the post mechanism has to be tied to a reply-by-
  // stream... it obviously must provide the matching post mechanism."
  const router = opts.router;
  if (!router || typeof router.onReply !== 'function' || typeof router.onRequest !== 'function') {
    throw new Error(
      'createPresence needs `router`: the stream is the INBOUND HALF of one ' +
      'interface and a reply arriving here has to settle in the same table ' +
      'the post opened. Pass the peerPost instance you post from.');
  }

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
  // named, which is exactly "not known".
  //
  // *This corrects an earlier note*, which said the relay's snapshot had
  // to be the roster with states, "or every away member would silently
  // become white". There is no roster (cycle 3), and search answers the
  // connected only (2026-09-19), so a contact nobody has mentioned since
  // this stream opened IS white, and that is the honest answer — Andy:
  // "we won't be bothered with what we can't find or know." Red comes
  // only from a relay saying so (a `present: false` broadcast); green from
  // a broadcast. Deciding a contact is offline is the node's own
  // conclusion from not finding them.
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

  // The last thing each owned relay said about itself. Deliberately not
  // a job and not a file: it is a live reading, it is worthless the
  // moment it is stale, and writing it down would make a node keep a
  // history of a box that is supposed to keep nothing.
  const statusByRelay = Object.create(null);
  const onRelayEvent = opts.onRelayEvent || null;

  // The report nudge's pacing (cycle 1): url -> { last, pending }. At most
  // one nudge a second per relay, and a trailing one for whatever arrived
  // while it waited. Timers are unref'd — a pending nudge must never keep
  // a stopping node alive.
  const nudges = Object.create(null);
  const NUDGE_MS = 1000;
  function nudgeStatus(url) {
    if (!onRelayEvent) return;
    const n = nudges[url] || (nudges[url] = { last: 0, pending: null });
    const fire = function () {
      n.last = Date.now();
      n.pending = null;
      try { onRelayEvent({ kind: 'status', relay: url }); } catch (e) { /* a witness */ }
    };
    if (n.pending) return;
    const wait = NUDGE_MS - (Date.now() - n.last);
    if (wait <= 0) { fire(); return; }
    n.pending = setTimeout(fire, wait);
    if (n.pending && typeof n.pending.unref === 'function') n.pending.unref();
  }
  // The membership half — see the `owner-event` branch below for why it
  // is a separate hook and not a kind on the one above.
  const onOwnerEvent = opts.onOwnerEvent || null;
  // A route a relay proved and announced. A third hook rather than a kind
  // on either of the others, for the same reason they are two: this one
  // is about a PEER and not about a relay, nobody addressed it to this
  // node, and it must never reach the traffic log.
  const onRoute = opts.onRoute || null;

  // onRoster STOOD HERE. The relay no longer sends the whole roll on
  // connect (cycle 3, 0012 widened): a relay's picture starts from what
  // this node already knows about it (seedRelay) and grows by broadcasts.

  // What is true the moment a stream opens: the relay itself is there
  // (its key, pinned at the seat — so a post addressed to the relay finds
  // it), and so is this node.
  function seedRelay(url) {
    const set = Object.create(null);
    const relayKey = relayKeys.pinned(rootDir, url);
    if (relayKey) set[relayKey] = true;
    if (identity && identity.publicKey) set[identity.publicKey] = true;
    byRelay[url] = set;
  }

  function onChange(url, body) {
    if (!body || !body.key) return;
    if (!byRelay[url]) byRelay[url] = Object.create(null);
    // Not somebody this node knows, and not already on its picture: not
    // this node's business (the relay broadcasts, the node filters).
    if (knows && !knows(body.key) && byRelay[url][body.key] === undefined) return;

    // `gone` is not `present: false`. Absent means a member of that relay
    // is not connected — red, and honestly so. Gone means the relay no
    // longer has a row for this key at all, and the only truthful thing
    // left is to stop answering for them: the key leaves this relay's
    // set, and if no other relay names it the merge drops it entirely,
    // which is white.
    //
    // Keeping the key at `false` would show a removed person as merely
    // away, for ever, on the strength of a relay that has forgotten them.
    if (body.gone) delete byRelay[url][body.key];
    else byRelay[url][body.key] = !!body.present;

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

  // WHO THAT RELAY IS, established BEFORE the stream carries anything.
  //
  // A device enrolment arrives as a post from the relay in its own name,
  // and hub.frontDoor admits it only if this node has accepted that
  // relay's key (relayKeys.js). The pin used to be established lazily,
  // by answerRelay on the first enrolment — which deadlocked: the door
  // refused the offer because nothing was pinned, so the code that pins
  // never ran, so nothing was ever pinned. A node could never accept its
  // first enrolment.
  //
  // It belongs here for a reason stronger than fixing that. AN OFFER CAN
  // ONLY ARRIVE ON A STREAM THIS NODE ALREADY HOLDS, so pinning as the
  // stream opens is not merely earlier — it is exactly sufficient. There
  // is no window in which an offer can arrive unpinned.
  //
  // Trust on FIRST use and only first. A relay answering a key other than
  // the one on record keeps carrying peer traffic — that is signed end to
  // end and it cannot forge any of it — and loses only its standing as a
  // PARTY, which is the one thing its own key buys. Proportionate: a
  // substituted relay stops being able to drive an enrolment and does not
  // take the node offline.
  function pinRelay(url) {
    if (!pin) return Promise.resolve();
    return Promise.resolve()
      .then(function () { return pin(url); })
      .catch(function () { /* a relay that will not say is simply not pinned */ });
  }

  function openTo(url) {
    if (streams[url]) return;
    // Fired alongside the connect rather than awaited: the stream is what
    // presence is for, and a census that is slow to answer must not delay
    // it. The pin lands before anything can be posted down the stream,
    // because a post needs the stream to be open at the far end first.
    pinRelay(url);
    streams[url] = openStream({
      url: streamUrl(url, identity.publicKey),
      // SIGNED PER ATTEMPT, not once. streamMessage carries a unix
      // minute and is checked ±1, so a signature captured at connect
      // time is refused by every reconnect more than two minutes later —
      // and a held connection is reconnected for years.
      //
      // This shipped as a constant and was caught only on the live relay,
      // because the lab never runs long enough for the minute to roll.
      //
      // A HEADER, never the query string: a query lands in every access
      // log the request passes, and the relay refuses one there even when
      // the header is good.
      headers: function () {
        return {
          'X-Spirit-Sig': auth.sign(
            identity.privateKey,
            auth.streamMessage(identity.publicKey)
          ),
        };
      },
      onEvent: function (msg) {
        if (msg.event === 'presence') onChange(url, msg.data);
        // -- A ROUTE THIS RELAY PROVED, FOR SOMEBODY WE MAY KNOW --------
        //
        // Not correspondence, so it never reaches the traffic log: that
        // file is what this node sent and what it received, and nobody
        // addressed this to us. Presence has always been handled the same
        // way, one line above.
        //
        // The relay says `{ key, at }` -- a peer, and the partner it was
        // reached through. `onRoute` matches an EXISTING contact row and
        // writes the route on it; a key nobody here knows is dropped
        // where it lands.
        else if (msg.event === 'route' && onRoute) onRoute(url, msg.data);
        // The same socket carries the router now (ROUTER.md). This file
        // owns the connection and nothing else about them: it hands each
        // one to peerPost and forms no opinion, which is why the fence
        // in PRESENCE.md §6 could be opened without this module growing
        // a second subject.
        // No `&& router` any more — it is required at construction, so a
        // guard here could only ever have hidden the absence.
        else if (msg.event === 'request') router.onRequest(url, msg.data);
        else if (msg.event === 'reply') router.onReply(msg.data);
        // A RELAY TELLING ITS OWNER HOW IT IS DOING. Only a relay this
        // node OWNS ever sends one — the rule is enforced at the far end,
        // where the owner's key is, and this side does not second-guess
        // it: a relay that sent one to a non-owner would be a relay
        // publishing its own invite labels, which is its bug to have and
        // not something a node can undo by ignoring the message.
        //
        // Kept, not acted on. The latest report per relay, overwritten
        // each time, so nothing accumulates and a node that never looks
        // holds exactly one object per relay it owns.
        else if (msg.event === 'relay-status') {
          statusByRelay[url] = msg.data;
          // AND THE PAGE IS NUDGED TO REDRAW (cycle 1). A Governor's lever
          // move arrives only as a fresh report, and a monitor that
          // redrew only on membership events would sit frozen through the
          // very shed it exists to show. The nudge carries no report — the
          // screen asks for what is true, as it always has — and it goes
          // down this node's own page channel, not the relay wire: no new
          // word in the protocol register.
          //
          // PACED, at most one a second per relay. A stress run pushes a
          // report on every member connect — hundreds a minute — and a
          // page reloading on each would spend the owner's node watching.
          // The last report in a burst always gets its nudge, so the
          // screen never settles on a stale picture.
          nudgeStatus(url);
        }
        // A WATCHED RELAY REPORTING ONE THING IT DID. Only arrives while
        // this node asked for it, and only from a relay it owns — the
        // rule is enforced at the far end where the owner's key is.
        // Handed straight on: nothing here forms an opinion about it.
        else if (msg.event === 'relay-event' && onRelayEvent) {
          var row = {};
          Object.keys(msg.data || {}).forEach(function (k) { row[k] = msg.data[k]; });
          row.relay = url;
          try { onRelayEvent(row); } catch (e) { /* a witness, never a participant */ }
        }
        // WHAT A RELAY THIS NODE OWNS DID ABOUT ITS MEMBERSHIP (R2).
        //
        //   Andy: "There is a category of events on the relay that the
        //   owner should have a log of."
        //
        // A SECOND EVENT NAME, not a kind on the first, and that is the
        // point rather than tidiness. `relay-event` is the monitor:
        // traffic, opt-in, live, and deliberately forgotten. This is
        // membership: always sent, and KEPT. One name for two retention
        // rules would mean the thing that decides whether somebody's
        // words are written to disk is a string comparison inside a
        // switch, which is exactly the kind of place the ring hid.
        //
        // Only a relay this node OWNS sends one — enforced at the far end
        // where the owner's key is, the same way `relay-status` is. This
        // side does not second-guess it.
        //
        // `relay` is stamped here because a node on several relays cannot
        // otherwise tell which box a claim happened on, and that is
        // routing information only this side holds.
        else if (msg.event === 'owner-event' && onOwnerEvent) {
          var ev = {};
          Object.keys(msg.data || {}).forEach(function (k) { ev[k] = msg.data[k]; });
          ev.relay = url;
          try { onOwnerEvent(ev); } catch (e) { /* a witness, never a participant */ }
        }
      },
      onOpen: function () { seedRelay(url); publish('connected to ' + url); },
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
        return ownerBadge.probe(rootDir, ask, identity.publicKey);
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
    // Which relay to send through. A node on two relays can reach a peer
    // by either, so the caller says nothing and this answers with the
    // ones that currently name that key as present.
    relaysNaming: function (key) {
      return Object.keys(byRelay).filter(function (url) {
        return byRelay[url][key] === true;
      });
    },
    // In-process readers, for tests and for whatever needs the answer
    // without waiting for a job event.
    table: merge,
    detail: function () { return byRelay; },
    // What each owned relay last said about itself, or {} before any
    // report has arrived. A caller must treat an absent entry as "not
    // told yet" rather than as "nothing to tell" — they look identical
    // here and mean very different things.
    relayStatus: function () { return statusByRelay; },
    jobId: function () { return job && job.id; },
    // FOUR UNDERSCORE HOOKS STOOD HERE — _roster, _status, _change and
    // _forget — captioned "fed by tests standing in for a relay". Nothing
    // called any of them.
    //
    //   Andy: "their internal mechanics shouldn't even be reachable."
    //
    // A door opened for a caller that never arrived is worse than one in
    // use: it looks sanctioned, so the next person needing a shortcut takes
    // it instead of asking why the real path is hard. The suites that would
    // have used these drive the stream instead, which is what a relay
    // actually does to this module.
  };
}

module.exports = { createPresence: createPresence, streamUrl: streamUrl };
