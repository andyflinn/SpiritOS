// spirit/run/js/fs/api.js
// THE fs FAMILY ON THE SPIRIT OBJECT (goal/G32.1): the files under the node's run folder. Written to face/spirit.js's standard: every verb the
// node mounts for this family, each argument with its rule ('?' optional); the spirit object makes each one a checked
// async call, spirit.fs.<verb>(args). A verb added to the family is added here, in the same commit.
// It names no family of its own: the node maps it (goal/G32.3), answering this text to api {family}.
module.exports = {
  verbs: {
    search: { q: 'text?', contents: 'flag?' },
    stat: { path: 'path' },
    load: { path: 'path' },
    annotations: { path: 'path' },
    save: { path: 'path', content: 'text' },
    delete: { path: 'path' },
    annotate: { path: 'path', payload: 'object' },
  },
  // THE KERNEL'S NAMES, async (Andy listed them): what the old shell's apps call, so an app ports by adding await.
  // loadFile and statFile answer null where the node refuses, as the kernel's did; a malformed call still refuses.
  names: function (call, tools) {
    function orNull(p) { return p.then(function (b) { return b; }, function (e) { if (e && e.status) return null; throw e; }); }
    return {
      loadFile: function (path) { return orNull(call('load', { path: path })).then(function (b) { return b && typeof b.text === 'string' ? b.text : null; }); },
      statFile: function (path) { return orNull(call('stat', { path: path })); },
      getAnnotations: function (path) { return call('annotations', { path: path }); },
      saveFile: function (path, content) { return call('save', { path: path, content: content }).then(function () { return { ok: true }; }, function (e) { if (e && e.status) return { ok: false, reason: e.code }; throw e; }); },
      deleteFile: function (path) { return call('delete', { path: path }).then(function () { return { ok: true }; }, function (e) { if (e && e.status) return { ok: false, reason: e.code }; throw e; }); },
      // A data: url of the file, read as the page reads a file (on the face, in its sealed pieces); null if refused.
      loadDataUrl: function (path) {
        var bad = tools.check('fs.loadDataUrl', { path: 'path' }, { path: path });
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
