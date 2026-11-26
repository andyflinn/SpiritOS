'use strict';
// spirit/run/spirit/fs/filter/app/script.js
// AN APP'S MARK. The fs cache's writer keeps the answer on the folder's row as app. Two formats, while apps move one by one
// (goal/G49.20, box v31; Andy: "the fs-cache needs to support both the old and the new, so that we can migrate one after the
// other"):
//
// A NEW-STYLE APP, CHECKED FIRST (box v31, "WHAT IS AN APP?"; Andy: "we check FIRST if an app is the new format, where there
// can be no <name>/<name>.json"): it holds <name>/manifest.json, valid by spirit/type/object/manifest/script.js, and no
// <name>/<name>.json; and, by what its manifest says:
//   - node mount true: <name>/script.js AND <name>/server/script.js AND <name>/client/script.js ("only then is it also a
//     branch", which the branch flag says by itself);
//   - node run true: <name>/server/script.js and <name>/script.js, but NO <name>/client/script.js;
//   - shell mount true: <name>/element/script.js.
//
// AN OLD APP (goal/G49.15, box v16: "app (<name>/<name>.json)"; goal/G49.1, Q1, Andy: "yes. testicle already checks validity
// of an app.json"): a folder <name> holding <name>/<name>.json, unchecked. Andy, box v31: "an old app is know as old app
// because it satifies the current checks for what-is-an app. after all apps are migrated, this won't matter."
//
//   (dir, has, read) -> true when dir is an app of either format; has(path): the tree holds that path; read(path): that
//                       file's text, or null
const manifestType = spirit.requireScript('spirit/type/object/manifest/script.js');

function manifestOf(text) {
  if (text == null) return null;
  let m = null;
  try { m = JSON.parse(String(text)); } catch (e) { return null; }
  try { manifestType.isValid(m); } catch (e) { return null; }
  return m;
}
function newStyle(dir, has, read) {
  if (!has(dir + '/manifest.json')) return false;
  const m = manifestOf(read(dir + '/manifest.json'));
  if (!m) return false;
  const node = m.node && typeof m.node === 'object' ? m.node : {};
  const shell = m.shell && typeof m.shell === 'object' ? m.shell : {};
  if (node.mount === true && !(has(dir + '/script.js') && has(dir + '/server/script.js') && has(dir + '/client/script.js'))) return false;
  if (node.run === true && !(has(dir + '/server/script.js') && has(dir + '/script.js') && !has(dir + '/client/script.js'))) return false;
  if (shell.mount === true && !has(dir + '/element/script.js')) return false;
  return true;
}
function app(dir, has, read) {
  const name = String(dir || '').slice(String(dir || '').lastIndexOf('/') + 1);
  if (!name) return false;
  const old = has(dir + '/' + name + '.json');
  if (!old && typeof read === 'function' && newStyle(dir, has, read)) return true;
  return old;
}
// What it hands out: an object holding its function (goal/G49.16; Andy: "A FUNCTION MUST ALWAYS BE INSTALLED INSIDE A CONTAINING OBJECT. PERIOD!").
module.exports = { app: app };
