'use strict';
// spirit/run/spirit/fs/node/script.js
// THE NODE HALF OF spirit.fs (goal/G49.2; Andy: "fix spirit.fs NOW", "the architechture in the old kernel.js was exactly that
// it would insert different versions of spirit.fs functions depending on isNode() and isBrowser()", "THE REASON that
// spirit.fs was conceived in the first place was so many modules can live unchanged on both node and browser"): in a node
// process, spirit.fs does the work on its own disc, through this branch's fileSystem.js, the same functions the node's own
// fs verbs call; no node needs to run. On a page spirit.fs stays the call to the node. spirit/fs/script.js names this file,
// and spirit.js uses it in node only.
//
// answer(verb, args) -> { status, body }, exactly what the node's verb answers (server/node.js handleFsStat, handleFsLoad,
// handleFsSave, handleFsDelete), so spirit.js hands back the same answers and the same refusals on both sides; or
// undefined for a verb this half does not answer, which then goes to the node as before. search is such a verb: it ranks
// the node's file tree, which the node holds.
// The spirit object first, the tree through spirit.requireScript (the general module rules; wsl's find): in node it hands a
// script's module.exports back at once.
require('../../script.js');
const FS = spirit.requireScript('spirit/fs/fileSystem/script.js');

function path(args) { return String((args && args.path) || ''); }
function written(r) {
  if (r && r.ok) return { status: 204, body: {} };
  const why = r && r.reason;
  if (why === 'forbidden') return { status: 403, body: { code: 'forbidden' } };
  if (why === 'file-not-found') return { status: 404, body: { code: 'not-found' } };
  if (why === 'bad-path') return { status: 400, body: { code: 'bad-path' } };
  return { status: 500, body: { code: 'failed' } };
}

function answer(verb, args) {
  if (verb === 'stat') {
    const s = FS.statFile(path(args));
    return s ? { status: 200, body: s } : { status: 404, body: { code: 'not-found' } };
  }
  if (verb === 'load') {
    const p = path(args);
    const text = FS.loadFile(p);
    return text === null ? { status: 404, body: { code: 'not-found' } } : { status: 200, body: { path: p, text: text } };
  }
  if (verb === 'save') return written(FS.saveFile(args && args.path, args && args.content));
  if (verb === 'delete') return written(FS.deleteFile(args && args.path));
  return undefined;
}

module.exports = { answer: answer };
