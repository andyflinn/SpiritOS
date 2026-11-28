'use strict';
// spirit/run/spirit/fs/script.js
// THE fs FAMILY ON THE SPIRIT OBJECT (goal/G32.1): the files under the node's run folder. Written to spirit.js's standard: every verb the
// node mounts for this family, each argument with its rule ('?' optional); the spirit object makes each one a checked
// async call, spirit.fs.<verb>(args). A verb added to the family is added here, in the same commit.
// It names no family of its own: the node maps it (goal/G32.3), answering this text to api {family}.
// ITS COMPANION data.js, REQUIRED HERE AND NOWHERE ELSE (goal/G47.1; Andy's rule: "every api.js requires it's companion
// data.js, and is the only script to require that data.js"): whoever requires this branch has its data with it, on a page
// (spirit.js runs this file there, with no require of its own, and waits for what it asks) and in node.
if (typeof require === 'function') require('../script.js').requireScript('spirit/fs/client/script.js'); else window.spirit.requireScript('spirit/fs/client/script.js');
module.exports = {
  // THE NODE HALF (goal/G49.2; Andy: "fix spirit.fs NOW"): in a node process spirit.js answers these verbs through this
  // file, on the process's own disc, and sends only what it does not answer to the node.
  node: 'spirit/fs/node/script.js',
  verbs: {
    search: { q: 'spirit/type/string/descriptionSelect/script.js?', contents: 'spirit/type/boolean/script.js?' },
    stat: { path: 'spirit/type/string/file/script.js' },
    load: { path: 'spirit/type/string/file/script.js' },
    save: { path: 'spirit/type/string/file/script.js', content: 'spirit/type/string/fileContent/script.js' },
    delete: { path: 'spirit/type/string/file/script.js' },
  },
  // THE KERNEL'S NAMES, async (Andy listed them): what the old shell's apps call, so an app ports by adding await.
  // loadFile and statFile answer null where the node refuses, as the kernel's did; a malformed call still refuses.
  // saveFile and deleteFile answer {ok: false, reason} with the refusal's own words (goal/G33.1), never a bare code.
  names: function (call, tools) {
    function orNull(p) { return p.then(function (b) { return b; }, function (e) { if (e && e.status) return null; throw e; }); }
    return {
      // A REFUSAL IS NOT "NOTHING THERE" (goal/G41.30; Andy, of a face with no star: "not found (or empty) — you can still Save to
      // create it"): only a file that is not there answers null; any other refusal rejects, in the node's own words.
      loadFile: function (path) {
        return call('load', { path: path }).then(function (b) { return b && typeof b.text === 'string' ? b.text : null; }, function (e) {
          if (e && e.status === 404) return null;
          throw e;
        });
      },
      // Not there is the stat's own no, { ok: false } (goal/G49.25, Q18): null, as before.
      statFile: function (path) { return orNull(call('stat', { path: path })).then(function (b) { return b && b.ok === false ? null : b; }); },
      saveFile: function (path, content) { return call('save', { path: path, content: content }).then(function () { return { ok: true }; }, function (e) { if (e && e.status) return { ok: false, reason: e.message || e.code }; throw e; }); },
      deleteFile: function (path) { return call('delete', { path: path }).then(function () { return { ok: true }; }, function (e) { if (e && e.status) return { ok: false, reason: e.message || e.code }; throw e; }); },
      // A data: url of the file, read as the page reads a file (on the face, in its sealed pieces); null if refused.
      loadDataUrl: function (path) {
        var bad = tools.check('spirit.fs.loadDataUrl', { path: 'spirit/type/string/file/script.js' }, { path: path });
        if (bad) return Promise.reject(bad);
        return tools.file(path).then(function (r) {
          if (!r || r.status !== 200) return null;
          var bin = '';
          for (var i = 0; i < r.bytes.length; i++) bin += String.fromCharCode(r.bytes[i]);
          var b64 = typeof btoa === 'function' ? btoa(bin) : Buffer.from(r.bytes).toString('base64');
          return 'data:' + (r.type || 'application/octet-stream') + ';base64,' + b64;
        }, function () { return null; });
      },
    };
  },
};
