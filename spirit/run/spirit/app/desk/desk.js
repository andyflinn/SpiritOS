'use strict';
require('../../spirit.js');

// spirit/run/spirit/app/desk/desk.js
// THE DESK'S SERVER SCRIPT (goal/G43.27, requirement 23; Andy: "look at agent.js, that's how it's done..."). The node starts this
// name: it loads ./nodeDesk.js, the desk server. The page loads the app's main element, ./element.js, itself (goal/G43.32, rule 4).
spirit.require('spirit/app/desk/nodeDesk.js');
