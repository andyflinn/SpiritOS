'use strict';
// spirit/run/spirit/fs/filter/api/script.js
// THE OLD BRANCH'S MARK (goal/G49.15, box v16: "One condition per flag, each its own small script: api (old, api.js and
// data.js)"; "the flag conditions live in spirit/fs/filter/<flagName>/script.js and will be required by the fs portion of
// the node process"). A folder is an old-shape branch when it holds api.js and data.js. The fs cache's writer
// (spirit/fs/server/script.js) asks it for each folder and keeps the answer on the folder's row as api.
//
//   (dir, has) -> true when dir holds dir/api.js and dir/data.js; has(path) answers whether the tree holds that path
module.exports = function api(dir, has) {
  return !!dir && has(dir + '/api.js') && has(dir + '/data.js');
};
