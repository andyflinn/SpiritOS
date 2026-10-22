// spirit/run/js/jobs/api.js
// THE jobs FAMILY ON THE SPIRIT OBJECT (goal/G32.1): the node's jobs and the servers it runs. Written to face/spirit.js's standard: every verb the
// node mounts for this family, each argument with its rule ('?' optional); the spirit object makes each one a checked
// async call, spirit.jobs.<verb>(args). A verb added to the family is added here, in the same commit.
(function (root) {
  var def = {
    family: 'jobs',
    verbs: {
      search: { q: 'text?' },
      get: { key: 'id' },
      create: { command: 'id', args: 'list?', type: 'text?' },
      update: { id: 'id', status: 'text?', data: 'object?', logMessage: 'text?', app: 'object?' },
      cancel: { id: 'id' },
      delete: { id: 'id' },
    },
  };
  ((root.spirit = root.spirit || {}).families = (root.spirit || {}).families || {})['jobs'] = def;
  if (typeof module === 'object' && module.exports) module.exports = def;
}(typeof window !== 'undefined' ? window : globalThis));
