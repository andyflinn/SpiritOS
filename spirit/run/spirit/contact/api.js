'use strict';
// spirit/run/spirit/contact/api.js
// THE contact FAMILY ON THE SPIRIT OBJECT (goal/G32.1): the node's book of peers. Written to spirit.js's standard: every verb the
// node mounts for this family, each argument with its rule ('?' optional); the spirit object makes each one a checked
// async call, spirit.contact.<verb>(args). A verb added to the family is added here, in the same commit.
// It names no family of its own: the node maps it (goal/G32.3), answering this text to api {family}.
// ITS COMPANION data.js, REQUIRED HERE AND NOWHERE ELSE (goal/G47.1; Andy's rule: "every api.js requires it's companion
// data.js, and is the only script to require that data.js"): whoever requires this branch has its data with it, on a page
// (spirit.js runs this file there, with no require of its own, and waits for what it asks) and in node.
if (typeof require === 'function') require('../spirit.js').require('spirit/contact/data.js'); else window.spirit.require('spirit/contact/data.js');
module.exports = {
  verbs: {
    // The one table, people and relays (goal/G40.11): a yes-filter per flag.
    search: { q: 'spirit.type.string.lineSelect?', keep: 'spirit.type.boolean?', mine: 'spirit.type.boolean?', relay: 'spirit.type.boolean?', seated: 'spirit.type.boolean?', blocked: 'spirit.type.boolean?' },
    get: { key: 'spirit.type.string.IDNew' },
    block: { publicKey: 'spirit.type.string.IDNew', publicLabel: 'name?' },
    unblock: { publicKey: 'spirit.type.string.ID' },
    accept: { publicKey: 'spirit.type.string.ID' },
    label: { publicKey: 'spirit.type.string.ID', myLabel: 'spirit.type.string.label' },
    forget: { publicKey: 'spirit.type.string.ID' },
    // goal/G47.4, box v33: "😏 is the row field faceable, set by the new verb contact.faceable {key, faceable}, for a relay
    // this node holds a seat on only; it does what own did", "contact.own goes". Never from a face, never from a peer.
    faceable: { key: 'spirit.type.string.ID', faceable: 'spirit.type.boolean' },
  },
};
