// spirit/run/process/js/chatClerver/chatClerver.family/api.js
// THE chatClerver SERVER'S INTERFACE (goal/G32.3): every verb it serves, each argument with its rule (spirit.js's
// standard, '?' optional). The node answers this text to api {family} without the server hearing of it, and maps it
// to its name: it names no family of its own. The rules are written by hand from the handlers in chatClerver.js, not
// from the request shapes: an argument a handler cannot do without is required, and each carries the tightest rule
// every value the handler takes still passes. The server checks everything again. A verb added to the server is added
// here, in the same commit.
module.exports = {
  verbs: {
    // One chat, by the peer's key; before and after are the writer's times ('' for none), after wins.
    'chat.read': { peer: 'key', before: 'text?', after: 'text?' },
    // One chat searched: text ('' matches every line), who 'me', 'them', 'both' or ''.
    'chat.search': { peer: 'key', text: 'text?', who: 'text?' },
    'chats.search': {},
    // A peer's line, posted by its chatClerver: the writer is the sealed caller, so no key travels. seq above 0;
    // re {writer, seq} names the line answered, none when left out.
    'line.receive': { seq: 'number', at: 'text', text: 'text', re: 'object?' },
    // The owner writes to a peer, named by its key (the chatClerver matches no label); re as above.
    'line.write': { to: 'key', text: 'text', re: 'object?' },
  },
};
