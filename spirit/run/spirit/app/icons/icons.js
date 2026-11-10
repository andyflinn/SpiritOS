'use strict';
require('../../spirit.js');

// spirit/run/spirit/app/icons/icons.js
// THE ICONS APP'S NODE SCRIPT (goal/G43.19, box v16, 7). Its contract and its test: ./test/icons.md and ./test/icons.js.
// A one-shot run (Andy: "the node must execute spirit/app/<name>/<name>.js with the request, instead of routing it to a server,
// like a cgi-script, and that process lives only as long as the request."): it requires ./nodeIcons.js, which answers the one
// call. The page loads the app's main element, ./element.js, itself (goal/G43.32, rule 4).
spirit.require('spirit/app/icons/nodeIcons.js');
