'use strict';
// spirit/run/spirit/app/desk/desk.js
// THE DESK, ONE FILE FOR THE PAGE AND THE NODE (goal/G43.27, requirement 23). Andy: "look at agent.js, that's how it's done...",
// "NO FUCKING HACKS.", "FUCKING FIX IT". As spirit/app/agent/agent.js is: the node starts this name, and a shell opening the Desk
// app loads it. On a page it loads ./browserDesk.js, the element spirit.element.spirit.app.desk.browserDesk; in a node ./nodeDesk.js, the desk server.
(function () {
  var S = typeof window !== 'undefined' && window.spirit ? window.spirit : require('../../spirit.js');
  if (S.isBrowser()) S.require('spirit/app/desk/browserDesk.js');
  else require('../../spirit.js').require('spirit/app/desk/nodeDesk.js');
}());
