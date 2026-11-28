'use strict';
// spirit/run/spirit/grant/server/script.js
// THE spirit.grant BRANCH'S NODE WORK (goal/G49.25, Q5; Andy: "WHY THE FUCK WOULD IT NOT???" to "Does a branch's node work live at
// spirit/<branch>/server/script.js, handing its verbs' answers to the scan"): the answers the node server held until this item,
// moved whole. serveCommon's scan mounts them under spirit.grant, each call checked against spirit/grant/script.js first.
//
//   verbs(node) -> { <verb>: { reply, handler } }; node is what the node server hands every branch (spirit/server/script.js,
//                  branchNode): here the owner's allow-table, spirit/grant/auth/script.js's, and its answer wrapper. A relay keeps
//                  no grants of this kind: none there.
//
// THE AUTH TABLES, A BRANCH EACH (goal/G49.21, box v24; Andy: "the table verbs imply move to the tables and become
// spirit.<table>.<verb>"): search, get, add and delete. Local (wire: false).
require('../../script.js');

function verbs(node) {
  if (spirit.IS_RELAY) return {};
  const auth = node.apiAuth;
  return {
    'search': { reply: node.LIST, handler: node.authVerb(auth.search) },
    'get': { reply: { allowed: false }, handler: node.authVerb(auth.query) },
    'add': { reply: { key: '', label: '', path: '' }, handler: node.authVerb(auth.grant) },
    'delete': { reply: { revoked: true }, handler: node.authVerb(auth.revoke) },
  };
}

// What it hands out: an object holding its function (goal/G49.16; Andy: "A FUNCTION MUST ALWAYS BE INSTALLED INSIDE A CONTAINING OBJECT. PERIOD!").
module.exports = { verbs: verbs };
