'use strict';
// spirit/run/spirit/relay/script.js
// THE spirit.relay BRANCH (goal/G49.25, box v25: "the api portion of the spirit.relay branch is removed from spirit/relay/processor and
// implemented properly as a system branch in the tree"; "the entire set of relay verbs moves into spirit.relay.<verb>, with only ONE,
// SINGLE door: /spirit"). Written to spirit.js's standard: every verb the relay mounts for this branch, each argument with its rule
// ('?' optional); the server checks each call against them before its handler. A verb added to the branch is added here, in the same
// commit. Its node work is ./server/script.js; on a node it is no branch (box v25: "the fs watcher, when !spirit.IS_RELAY, will never
// mark spirit.relay as a branch"), and a node's own code calls its relays' verbs.
//
// THE NAMES (Q13, Andy: "yes"):
//   members           post, reply (the signed packet as today), stream (the members' stream)
//   the home node     faceAnswer, faceFeed: its uploads to its face, named in a header, the raw upload the body (Q10)
//   a face's browser  faceCall, faceEvents (its live stream), faceState, faceLogin, faceLogout (no faceFile: the GET it stood for had
//                     no caller left; a face asks a file in its faceCall, { get }, sealed as every call)
//   its own           card, claim, join, joinConfirm, face, search, rename, removePeer, invite, revoke, config, debug, monitor,
//                     relayLabel, api (join and joinConfirm: Andy, "EVERY relay verb is in a node-branch"): each
//                     today's signed packet, { from, text, sig }, its text { call, args } naming the verb (Q11, Andy: "same as today.")
//
// ITS COMPANION client/script.js, REQUIRED HERE AND NOWHERE ELSE (goal/G47.1; Andy's rule: every branch's script requires its
// client): whoever requires this branch has its client with it.
if (typeof require === 'function') require('../script.js').requireScript('spirit/relay/client/script.js'); else window.spirit.requireScript('spirit/relay/client/script.js');
var KEY = 'spirit/type/string/IDNew/script.js';
var SIG = 'spirit/type/string/signature/script.js';
var TEXT = 'spirit/type/string/fileContent/script.js';
var MS = 'spirit/type/number/integer/script.js?';
// Today's signed packet, the arguments of every verb of its own.
// to: the relay's own key, or none (a stranger addresses the relay with no key, since it does not know it yet).
var PACKET = { from: KEY, to: KEY + '?', text: TEXT, sig: SIG, budgetMs: MS };
module.exports = {
  verbs: {
    post: { from: KEY, to: KEY + '?', text: TEXT, sig: SIG, budgetMs: MS },
    reply: { from: KEY, hash: TEXT, text: TEXT, sig: SIG },
    stream: { key: KEY, sig: SIG },
    faceAnswer: {},
    faceFeed: {},
    // The face's request to its home node, whole: sealed, a { get } for a file, or a piece of a large one; the relay reads none of it.
    faceCall: { request: 'spirit/type/object/payload/script.js' },
    faceEvents: { here: 'spirit/type/boolean/script.js?', key: TEXT + '?' },
    faceState: {},
    faceLogin: { text: TEXT },
    faceLogout: {},
    card: PACKET, claim: PACKET, join: PACKET, joinConfirm: PACKET, face: PACKET, search: PACKET, rename: PACKET, removePeer: PACKET, invite: PACKET,
    revoke: PACKET, config: PACKET, debug: PACKET, monitor: PACKET, relayLabel: PACKET, api: PACKET,
  },
};
