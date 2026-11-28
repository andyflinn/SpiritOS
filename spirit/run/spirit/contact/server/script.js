'use strict';
// spirit/run/spirit/contact/server/script.js
// THE spirit.contact BRANCH'S NODE WORK (goal/G49.25, Q5; Andy: "WHY THE FUCK WOULD IT NOT???" to "Does a branch's node work live
// at spirit/<branch>/server/script.js, handing its verbs' answers to the scan"): the answers the node server held until this item,
// moved whole. serveCommon's scan mounts them under spirit.contact, each call checked against spirit/contact/script.js first.
//
//   verbs(node) -> { <verb>: { reply, handler } }; node is what the node server hands every branch (spirit/server/node/script.js,
//                  branchNode): here the hub (spirit/hub/script.js), the router, built once the node is up and so asked for at each
//                  call, the job table, the port, and the relay rows by key. A relay keeps no contacts: none there.
//
// THIS NODE'S OWN ADDRESS BOOK (stage 4c, 2026-09-15; Andy: "The user sees it as contact: which is kind of what i prefer."). Every
// verb reads or writes the one table on this machine; contact.search's network tier (goal/G30.19) is the one part that asks the
// relays. "all verbs do the ... same shit they did before" (goal/G49.22, box v16).
require('../../script.js');

function verbs(node) {
  if (spirit.IS_RELAY) return {};
  const hub = node.hub;
  const readJsonBody = node.readJsonBody;
  const router = node.router;
  const port = function () { return Number(node.port) || spirit.DEFAULT_SPIRIT_PORT; };
  const probe = function () { return spirit.requireScript('spirit/hub/script.js').relayKeyAsk(router()); };
  const peer = function (what, extra) { return function (rq, rs) { hub.handlePeer(rq, rs, readJsonBody, what, extra && extra()); }; };
  const STANDING = { publicKey: '', keep: false, blocked: false };
  return {
    // The one table, searched (goal/G40.11): people and relays, with a yes-filter per flag. peer.list is gone (puppets/G2); the
    // network search it starts asks the relays.
    'search': { reply: { ok: true, items: [{ key: '', label: '' }], more: false }, handler: node.proxyVerb(function (b) { return hub.contactSearch(b, { jobs: node.jobs, router: router() }); }) },
    // A RELAY ROW TOO (goal/G49.11, box v9: "a semi-duplicate of contact.get. will merge with contact.get"): for a relay row it adds
    // that relay's last stream report, which the router holds in memory.
    'get': { reply: { ok: true, key: '', person: {}, relay: {}, report: {} }, handler: node.proxyVerb(function (b) { return hub.contactGet(b, { router: router() }); }) },
    'block': { reply: STANDING, handler: peer('block') },
    'unblock': { reply: STANDING, handler: peer('unblock') },
    'accept': { reply: STANDING, handler: peer('accept') },
    'label': { reply: { publicKey: '', myLabel: '', caption: '' }, handler: peer('label') },
    // goal/G47.4, box v33: "contact.faceable {key, faceable}", "contact.own goes".
    'faceable': { reply: { key: '', faceable: false }, handler: function (rq, rs) { hub.handleFaceable(rq, rs, readJsonBody); } },
    // THE RELAY ROW'S VERBS (goal/G49.11, box v9: the node's relay branch goes, each verb "moves to the contact branch"). Each names
    // the relay by its row's public key; add alone takes the url, since the relay is no row until its card answers.
    'add': { reply: { ok: true, url: '', relayKey: '' }, handler: node.proxyVerb(function (b) { return hub.relayAdd(b, { router: router() }); }) },
    // The relay's own claim, posted: the node then marks the relay its own and opens the stream to the new seat (handleClaim).
    'claim': { reply: { mine: false }, handler: function (rq, rs) {
      readJsonBody(rq).then(function (got) {
        const body = node.relayBody(got);
        if (!body.url) {
          rs.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          rs.end(JSON.stringify({ ok: false, error: 'no relay on this node under that key' }));
          return;
        }
        hub.handleClaim(rq, rs, function () { return Promise.resolve(body); }, { router: router(), probe: probe() });
      }).catch(function (e) { node.bodyRefused(rq, rs, e, true); });
    } },
    // A face name asked of the relay (goal/G30.1); its signed answer is kept on the row.
    'face': { reply: { ok: true, url: '', name: '', email: '' }, handler: node.onRelayRow(function (b) { return hub.relayFace(b, { router: router() }); }) },
    // Joining the relay by email, then by the mailed code (goal/G30.2): "becomes contact.join, only works for relay-rows".
    'join': { reply: { ok: true, url: '' }, handler: node.onRelayRow(function (b) { return hub.relayJoin(b, { router: router(), port: port(), probe: probe() }); }) },
    // Giving up this node's seat (goal/G40.10): the relay's removePeer posted, then the seat and the face cleared; the row stays.
    'leave': { reply: { ok: true, key: '' }, handler: node.onRelayRow(function (b) { return hub.relayLeave({ key: b.url }, { router: router() }); }) },
    // A relay's row is taken off the list first, with remove's refusals (goal/G49.11): hub.js's forget, handed the router.
    'forget': { reply: { publicKey: '', forgotten: true, stillBlocked: false }, handler: peer('forget', function () { return { router: router() }; }) },
  };
}

// What it hands out: an object holding its function (goal/G49.16; Andy: "A FUNCTION MUST ALWAYS BE INSTALLED INSIDE A CONTAINING OBJECT. PERIOD!").
module.exports = { verbs: verbs };
