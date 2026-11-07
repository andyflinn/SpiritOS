// spirit/run/spirit/app/info/info.js
// WHAT THIS NODE SAYS ABOUT ITSELF — the owner's screen, an app of spirit/app/ (goal/G43.24). Its contract and its test:
// ./test/info.md and ./test/info.js.
//
//   Andy: "i want an intrinsic app info, in which, for now the user can maintain both fields in this file, more to come.",
//   and on G43.24: "no i want those apps to basically be wrappers for spirit/element/ things....", "box that these apps must
//   mount in the new format of the new shell."
//
//   spirit.elements.info.create(container, { open }) -> { destroy() }
//
// A WRAPPER, MOUNTED THE NEW SHELL'S WAY, as spirit/app/file/file.js is: it loads nodeInfo (spirit/element/nodeInfo.js),
// which holds all of Info, and mounts it, handing on the stack its mounter opens layers in.
(function () {
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
  var parts = S.require('spirit/element/nodeInfo.js');

  function create(container, opts) {
    var o = opts || {};
    var gone = false;
    var made = null;
    container.innerHTML = '';
    parts.then(function () {
      if (gone) return;
      made = S.elements.nodeInfo.create(container, { open: o.open });
    }, function () { if (!gone) container.textContent = 'Info could not be loaded.'; });
    return {
      destroy: function () {
        gone = true;
        if (made) made.destroy();
        made = null;
        container.innerHTML = '';
      },
    };
  }

  S.elements = S.elements || {};
  S.elements.info = { create: create };
}());
