'use strict';
// spirit/run/spirit/app/chat/chat.js
// CHAT, ONE FILE FOR THE PAGE AND THE NODE (goal/G43.31; Andy: "chat.js splits between browser and node.... the usual
// pattern"), as spirit/app/desk/desk.js is: the node starts this name, and a shell opening the Chat app loads it. On a page
// it loads ./element.js, the app's element spirit.element.spirit.app.chat.element (Andy: "the app-element must be spirit/app/chat/element.js");
// in a node ./nodeChat.js, the chat server. Its contract and its test: ./test/chat.md and ./test/chat.js.
(function () {
  var S = typeof window !== 'undefined' && window.spirit ? window.spirit : require('../../spirit.js');
  if (S.isBrowser()) S.require('spirit/app/chat/element.js');
  else require('../../spirit.js').require('spirit/app/chat/nodeChat.js');
}());
