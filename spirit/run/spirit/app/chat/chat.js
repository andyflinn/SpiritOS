'use strict';
require('../../spirit.js');

// spirit/run/spirit/app/chat/chat.js
// CHAT'S SERVER SCRIPT (goal/G43.31; Andy: "chat.js splits between browser and node.... the usual pattern"). The node starts this
// name: it loads ./nodeChat.js, the chat server. The page loads the app's main element, ./element.js, itself (Andy: "the
// app-element must be spirit/app/chat/element.js"; goal/G43.32, rule 4). Its contract and its test: ./test/chat.md and ./test/chat.js.
spirit.require('spirit/app/chat/nodeChat.js');
