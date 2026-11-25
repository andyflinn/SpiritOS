'use strict';
// spirit/run/spirit/fs/filter/app/script.js
// AN APP'S MARK (goal/G49.15, box v16: "app (<name>/<name>.json)"; goal/G49.1, Q1, Andy: "yes. testicle already checks
// validity of an app.json": spirit/app/job, job.json and no job.js, is an app). A folder <name> is an app when it holds
// its manifest <name>/<name>.json. The fs cache's writer keeps the answer on the folder's row as app.
//
//   (dir, has) -> true when dir holds dir/<its own name>.json
function app(dir, has) {
  const name = String(dir || '').slice(String(dir || '').lastIndexOf('/') + 1);
  return !!name && has(dir + '/' + name + '.json');
}
// What it hands out: an object holding its function (goal/G49.16; Andy: "A FUNCTION MUST ALWAYS BE INSTALLED INSIDE A CONTAINING OBJECT. PERIOD!").
module.exports = { app: app };
