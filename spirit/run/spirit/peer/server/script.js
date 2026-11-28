'use strict';
// spirit/run/spirit/peer/server/script.js
// THE peer BRANCH'S NODE WORK (goal/G49.25, Q5; Andy: "WHY THE FUCK WOULD IT NOT???" to "Does a branch's node work live at
// spirit/<branch>/server/script.js, handing its verbs' answers to the scan"): the answers the node server held until this item,
// moved whole. serveCommon's scan mounts them under peer, the old-shape branch's own word (its api.js beside its data.js).
//
//   verbs(node) -> { <verb>: { request, reply, handler } }; node is what the node server hands every branch (spirit/server/node/
//                  script.js, branchNode): here the hub and the router, built once the node is up and so asked for at each call.
//                  A relay posts its own way: none there.
//
// ANYBODY WHO IS NOT THIS NODE (stage 4d, 2026-09-15). Uniformly wire, and every one of these fails the same way when the box is
// offline, which is the whole reason the flag is on the namespace.
//   peer.post     the only thing on this node that reaches router.post
//   peer.acquire  a human confirmed one of those keys: it asks the relay whether that key is really there, and only then writes
//                 a row; wire because the asking can fail, and the write never happens when it does.
// (peer.list, peer.find and peer.search are gone: who is out there is contact.search, its network tier asking the relays; Andy:
// "interface change/reduction approved.")
require('../../script.js');

function verbs(node) {
  if (spirit.IS_RELAY) return {};
  return {
    'post': { request: { to: '', text: '', via: '', patienceMs: 0, kind: '' }, reply: { ok: true, status: 0, hash: '', from: '', text: '', sig: '', receipt: false }, handler: function (rq, rs) {
      node.hub.handlePost(rq, rs, node.readJsonBody, { router: node.router() });
    } },
    'acquire': { request: { publicKey: '', publicLabel: '', url: '' }, reply: { publicKey: '', publicLabel: '', keep: false }, handler: function (rq, rs) { node.hub.handleContact(rq, rs, node.readJsonBody); } },
  };
}

// What it hands out: an object holding its function (goal/G49.16; Andy: "A FUNCTION MUST ALWAYS BE INSTALLED INSIDE A CONTAINING OBJECT. PERIOD!").
module.exports = { verbs: verbs };
