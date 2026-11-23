'use strict';
require('../../spirit.js');

// spirit/run/spirit/app/testicle/testicle.js
// THE SCRIPT THE NODE STARTS FOR TESTICLE (goal/G48.5, the box, naming: "an app's server portion MUST be named server.js, inside
// that folder: spirit/app/<name>/server/server.js ... spirit/app/<name>/<name>.js stays what the node starts and loads
// ./server/server.js on the node"). The server stands in ./server/, never served (spirit/fs/fileSystem.js).
spirit.requireScript('spirit/app/testicle/server/server.js');
