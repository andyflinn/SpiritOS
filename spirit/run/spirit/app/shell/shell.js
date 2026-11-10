'use strict';
// spirit/run/spirit/app/shell/shell.js
// THE SHELL APP (goal/G43.18, box v29, "The shell"; Andy: "i propose an app called shell, that wraps
// spirit/element/search/app.js search as shell"): the default shell for home and face on a first boot (Q12), and the one a
// node with no spirit/state/shell.json loads. boot.js loads the shell the node names (node.shell) and hands it the page's app
// area; this one draws the app search as tiles, through the app selector, whose tiles launch an app over it in one stack
// (spirit/element/panel.js). Its contract and its test: ./test/shell.md and ./test/shell.js.
//
//   spirit.elements.shell.create(container) -> { destroy() }
//
// A shell must be able to replace itself (the RULE): the app detail it opens carries the Home shell and Face shell rows.
// It knows nothing of Join (Q18, Andy: "join. not the shells job."): Join shows itself.
(function () {
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): the app search, and the app selector over it.
  var parts = Promise.all(['spirit/element/search/app.js', 'spirit/app/appSelector.js'].map(function (p) { return window.spirit.require(p); }));

  function create(container) {
    var gone = false;
    var made = null;
    var box = document.createElement('div');
    box.className = 'fill';
    container.appendChild(box);
    parts.then(function () {
      if (gone) return;
      // As appMigration draws it (Andy: "it should look like the latest thing we had using appMigration", an app gone since 64e2d054): tiles, with the toggle.
      // And never itself (Andy: "the shell should exclude itself completely from the app-list, haha...").
      made = window.spirit.element.spirit.app.appSelector.create(box, { face: 'tiles', toggle: true, hide: ['shell'] });
    }, function () { box.textContent = 'The shell could not be loaded.'; });
    return {
      destroy: function () {
        gone = true;
        if (made && typeof made.destroy === 'function') made.destroy();
        made = null;
        container.innerHTML = '';
      },
    };
  }

  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/app/shell/shell.js', { create: create }); });
}());
