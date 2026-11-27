'use strict';
// spirit/run/spirit/contact/script.js
// THE contact FAMILY ON THE SPIRIT OBJECT (goal/G32.1): the node's book of peers. Written to spirit.js's standard: every verb the
// node mounts for this family, each argument with its rule ('?' optional); the spirit object makes each one a checked
// async call, spirit.contact.<verb>(args). A verb added to the family is added here, in the same commit.
// It names no family of its own: the node maps it (goal/G32.3), answering this text to api {family}.
// ITS COMPANION data.js, REQUIRED HERE AND NOWHERE ELSE (goal/G47.1; Andy's rule: "every api.js requires it's companion
// data.js, and is the only script to require that data.js"): whoever requires this branch has its data with it, on a page
// (spirit.js runs this file there, with no require of its own, and waits for what it asks) and in node.
if (typeof require === 'function') require('../script.js').requireScript('spirit/contact/client/script.js'); else window.spirit.requireScript('spirit/contact/client/script.js');
module.exports = {
  verbs: {
    // The one table, people and relays (goal/G40.11): a yes-filter per flag.
    search: { q: 'spirit/type/string/descriptionSelect/script.js?', keep: 'spirit/type/boolean/script.js?', mine: 'spirit/type/boolean/script.js?', relay: 'spirit/type/boolean/script.js?', seated: 'spirit/type/boolean/script.js?', blocked: 'spirit/type/boolean/script.js?' },
    get: { key: 'spirit/type/string/IDNew/script.js' },
    block: { publicKey: 'spirit/type/string/IDNew/script.js', publicLabel: 'spirit/type/string/label/script.js?' },
    unblock: { publicKey: 'spirit/type/string/ID/script.js' },
    accept: { publicKey: 'spirit/type/string/ID/script.js' },
    label: { publicKey: 'spirit/type/string/ID/script.js', myLabel: 'spirit/type/string/label/script.js' },
    forget: { publicKey: 'spirit/type/string/ID/script.js' },
    // goal/G47.4, box v33: "😏 is the row field faceable, set by the new verb contact.faceable {key, faceable}, for a relay
    // this node holds a seat on only; it does what own did", "contact.own goes". Never from a face, never from a peer.
    faceable: { key: 'spirit/type/string/ID/script.js', faceable: 'spirit/type/boolean/script.js' },
    // A RELAY ROW'S VERBS (goal/G49.11, box v9: the node's relay branch goes, each verb "moves to the contact branch"): each names
    // the relay by its row's public key; add alone takes the url, since the relay is no row until its card answers.
    add: { url: 'spirit/type/string/URL/script.js', label: 'spirit/type/string/label/script.js?' },
    claim: { key: 'spirit/type/string/ID/script.js', name: 'spirit/type/string/label/script.js', invite: 'spirit/type/string/word/script.js?', inviteLabel: 'spirit/type/string/label/script.js?' },
    face: { key: 'spirit/type/string/ID/script.js', name: 'spirit/type/string/label/script.js' },
    // link: the caller's link the relay mails, its code and key added (goal/G40.10; Andy: "{email, URL, card}").
    join: { key: 'spirit/type/string/ID/script.js', email: 'spirit/type/string/email/script.js', code: 'spirit/type/string/word/script.js?', link: 'spirit/type/string/URL/script.js?' },
    leave: { key: 'spirit/type/string/ID/script.js' },
  },
};
