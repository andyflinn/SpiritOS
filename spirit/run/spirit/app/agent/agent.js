'use strict';
// spirit/run/spirit/app/agent/agent.js
// THE AGENT, ONE FILE FOR THE PAGE AND THE NODE (goal/G43.13). Its contract and its test: ./test/agent.md and ./test/agent.js.
// The node starts this name (goal/G43.12, Q1), and a tile loads it. Andy, G43.12 Q2: "it only needs an isBrowser()/isNode()
// split, and can implement the divergent modes in separate scriptFilese.js": on a page it loads ./browserAgent.js, the element
// spirit.element.spirit.app.agent.browserAgent; in a node ./nodeAgent.js, the agent server.
(function () {
  var S = typeof window !== 'undefined' && window.spirit ? window.spirit : require('../../spirit.js');
  if (S.isBrowser()) S.require('spirit/app/agent/browserAgent.js');
  else require('../../spirit.js').require('spirit/app/agent/nodeAgent.js');
}());
