'use strict';
// spirit/run/spirit/fs/filter/branch/script.js
// THE NEW BRANCH'S MARK (goal/G49.15, box v16: "branch (new, script.js and client/script.js)"). A folder is a new-shape
// branch when it holds script.js and client/script.js. A script.js alone is no branch: contact's, fs's and job's own
// script.js are not branch interfaces. The fs cache's writer keeps the answer on the folder's row as branch.
//
//   (dir, has) -> true when dir holds dir/script.js and dir/client/script.js
function branch(dir, has) {
  return !!dir && has(dir + '/script.js') && has(dir + '/client/script.js');
}
// What it hands out: an object holding its function (goal/G49.16; Andy: "A FUNCTION MUST ALWAYS BE INSTALLED INSIDE A CONTAINING OBJECT. PERIOD!").
module.exports = { branch: branch };
