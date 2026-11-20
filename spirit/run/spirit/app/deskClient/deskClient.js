'use strict';
require('../../spirit.js');

// spirit/run/spirit/app/deskClient/deskClient.js
// THE SCRIPT THE NODE STARTS FOR DESKCLIENT (goal/G48.5, the box, naming: "an app's server portion MUST be named server.js, inside
// that folder: spirit/app/<name>/server/server.js ... spirit/app/<name>/<name>.js stays what the node starts and loads
// ./server/server.js on the node"). The server stands in ./server/, never served (spirit/fileSystem.js).
spirit.require('spirit/app/deskClient/server/server.js');
