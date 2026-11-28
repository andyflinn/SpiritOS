'use strict';
// spirit/run/spirit/owner/server/script.js
// THE owner BRANCH'S NODE WORK (goal/G49.25, Q5; Andy: "WHY THE FUCK WOULD IT NOT???" to "Does a branch's node work live at
// spirit/<branch>/server/script.js, handing its verbs' answers to the scan"): the answers the node server held until this item,
// moved whole. serveCommon's scan mounts them under owner, the old-shape branch's own word (its api.js beside its data.js).
//
//   verbs(node) -> { <verb>: { request, reply, handler } }; node is what the node server hands every branch (spirit/server/node/
//                  script.js, branchNode): here the owner's boxes and the puppet command's sender, both made once the node is up
//                  and so asked for at each call. A relay has no puppets: none there.
//
// owner.command: A COMMAND FOR ONE OF THIS NODE'S PUPPETS (puppets/G4). { to, verb, body }: the page names the puppet and the verb
// it would call locally ("It's a remote control"); peerOwnerPost signs, sends and waits for the one answer with that command's
// hash. WIRE, because the puppet can be unreachable. ownerPost stays where it is for now (goal/G49.24, Andy).
require('../../script.js');

function verbs(node) {
  if (spirit.IS_RELAY) return {};
  return {
    // WHAT HIS BOXES CARRY, grouped by box, on demand (G10). Andy: "that must be visible-on-demand in a UI", and over-committed is
    // a warning. owner.boxes is gone: a list is a search (puppets/G2, boxes.js).
    'boxSearch': { request: { q: '' }, reply: node.LIST, handler: node.proxyVerb(function (b) {
      const boxes = node.boxes();
      const r = boxes ? boxes.search(b && b.q) : { items: [], more: false };
      return { ok: true, status: 200, items: r.items, more: r.more };
    }) },
    'boxGet': { request: { key: '' }, reply: { ok: true, key: '', box: {} }, handler: node.proxyVerb(function (b) {
      const key = String((b && b.key) || '');
      if (!key) return { ok: false, status: 400, error: 'key required' };
      const boxes = node.boxes();
      const box = boxes ? boxes.get(key) : null;
      if (!box) return { ok: false, status: 404, error: 'no such box' };
      return spirit.requireScript('spirit/limits/script.js').boundedGet({ ok: true, status: 200, key: key, box: box });
    }) },
    // The puppet's answer as it came, its hash beside it.
    'command': { request: { to: '', command: '', body: {} }, reply: { hash: '' }, handler: function (rq, rs) {
      node.readJsonBody(rq).then(function (body) {
        const send = node.ownerPost();
        if (!send) {
          rs.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
          rs.end(JSON.stringify({ ok: false, error: 'this node is not connected to a relay' }));
          return null;
        }
        return send(body && body.to, body && body.command, body && body.body).then(function (said) {
          const answer = said || { ok: false, status: 503, error: 'peer not reachable' };
          rs.writeHead(answer.ok === false && answer.status ? answer.status : 200, { 'Content-Type': 'application/json; charset=utf-8' });
          rs.end(JSON.stringify(answer));
        });
      }).catch(function (e) { node.bodyRefused(rq, rs, e, true); });
    } },
  };
}

// What it hands out: an object holding its function (goal/G49.16; Andy: "A FUNCTION MUST ALWAYS BE INSTALLED INSIDE A CONTAINING OBJECT. PERIOD!").
module.exports = { verbs: verbs };
