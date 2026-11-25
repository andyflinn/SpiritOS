'use strict';
// spirit/run/spirit/fs/filter/live/script.js
// AN APP SWITCHED ON (goal/G49.15, box v16: "A third flag, live, on an app folder's row, set from
// spirit/state/<app>/node.json when that file changes"). An app folder, spirit/app/<name>, is live when its node.json,
// spirit/state/<name>/node.json, holds active: true: the owner's switch (spirit/app/script.js writes it). No such file, or
// not true: not live. Any other folder is never live. The fs cache's writer keeps the answer on the app folder's row.
//
//   (dir, read) -> true when dir is spirit/app/<name> and read(spirit/state/<name>/node.json) is JSON with active true;
//                  read(path) answers that file's text, or null
function live(dir, read) {
  const m = /^spirit\/app\/([^/]+)$/.exec(String(dir || ''));
  if (!m) return false;
  const text = read('spirit/state/' + m[1] + '/node.json');
  if (text == null) return false;
  try { return JSON.parse(String(text)).active === true; } catch (e) { return false; }
}
// What it hands out: an object holding its function (goal/G49.16; Andy: "A FUNCTION MUST ALWAYS BE INSTALLED INSIDE A CONTAINING OBJECT. PERIOD!").
module.exports = { live: live };
