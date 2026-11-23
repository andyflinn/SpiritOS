'use strict';
require('../../spirit.js');

// spirit/run/spirit/app/agent/agent.js
// THE AGENT'S SERVER SCRIPT (goal/G43.13). Its contract and its test: ./test/agent.md and ./test/agent.js. The node starts this
// name (goal/G43.12, Q1): it loads ./server/server.js, the agent server. The page loads the app's main element, ./element.js, itself
// (goal/G43.32, rule 4: "if the application has a face, its main screen element must be spirit/app/[name]/element.js").
spirit.requireScript('spirit/app/agent/server/server.js');
