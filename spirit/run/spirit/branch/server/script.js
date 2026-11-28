'use strict';
// spirit/run/spirit/branch/server/script.js
// THE spirit.branch BRANCH'S NODE WORK (goal/G49.25, Q5; Andy: "WHY THE FUCK WOULD IT NOT???" to "Does a branch's node work live
// at spirit/<branch>/server/script.js, handing its verbs' answers to the scan"): the answers the node server held until this item,
// moved whole. serveCommon's scan mounts them under spirit.branch, each call checked against spirit/branch/script.js first.
//
//   verbs(node) -> { <verb>: { reply, handler } }; node is what the node server hands every branch (spirit/server/node/script.js,
//                  branchNode): here the owner's allow-table, spirit/grant/auth/script.js's, which takes one operation per verb.
//                  A relay keeps no branch table: none there.
//
// THE AUTH TABLES, A BRANCH EACH (goal/G49.21, box v24): search, get, add and delete. Local (wire: false).
require('../../script.js');

function verbs(node) {
  if (spirit.IS_RELAY) return {};
  const auth = node.apiAuth;
  const op = function (name) { return node.authVerb(function (b) { return auth.branch(Object.assign({}, b, { op: name })); }); };
  return {
    'search': { reply: node.LIST, handler: op('search') },
    'get': { reply: {}, handler: op('get') },
    'add': { reply: {}, handler: op('add') },
    'delete': { reply: {}, handler: op('delete') },
  };
}

// What it hands out: an object holding its function (goal/G49.16; Andy: "A FUNCTION MUST ALWAYS BE INSTALLED INSIDE A CONTAINING OBJECT. PERIOD!").
module.exports = { verbs: verbs };
