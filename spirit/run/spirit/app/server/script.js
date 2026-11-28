'use strict';
// spirit/run/spirit/app/server/script.js
// THE spirit.app BRANCH'S NODE WORK (goal/G49.25, Q5; Andy: "WHY THE FUCK WOULD IT NOT???" to "Does a branch's node work live at
// spirit/<branch>/server/script.js, handing its verbs' answers to the scan"): the answers the node server held until this item,
// moved whole. serveCommon's scan mounts them under spirit.app, each call checked against spirit/app/script.js first.
//
//   verbs(node) -> { <verb>: { reply, handler } }; node is what the node server hands every branch (spirit/server/script.js,
//                  branchNode): here its app table, spirit/app/manager/script.js's. A relay serves no apps: none there.
//
// THE app FAMILY (goal/G43.2; Andy, box: "the "app" api-family will sit nicely beside all other families"): its verbs, "just a
// search string", over the plugins in its folder. A face with no star may call it (Andy, box). Their names on the wire,
// spirit.app.<verb> (goal/G49.20; Andy: "yes, and this applies to ALL migrated/migrating branches").
require('../../script.js');

function verbs(node) {
  if (spirit.IS_RELAY) return {};
  const apps = node.appFamily;
  return {
    'search': { reply: node.LIST, handler: node.proxyVerb(function (b) { return apps.search(b); }) },
    // goal/G43.9, peer review wsl, Andy's yes on Q1. Off the face with no star: spirit/faceHome/script.js.
    'active': { reply: {}, handler: node.proxyVerb(function (b) { return apps.active(b); }) },
    'label': { reply: {}, handler: node.proxyVerb(function (b) { return apps.label(b); }) },
    'icon': { reply: {}, handler: node.proxyVerb(function (b) { return apps.icon(b); }) },
  };
}

// What it hands out: an object holding its function (goal/G49.16; Andy: "A FUNCTION MUST ALWAYS BE INSTALLED INSIDE A CONTAINING OBJECT. PERIOD!").
module.exports = { verbs: verbs };
