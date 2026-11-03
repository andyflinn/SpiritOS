// spirit/run/shell/appMigration/appMigration.js
// A THROW-AWAY FACE APP (goal/G43.2). Andy, box: "all this applet does is: mount a wrapped ... appSelector.js", and "when all
// apps and processes are migrated, andy will simply delete the folder". So nothing outside this folder names it, and it
// has no manifest: "including the face-shells approach no manifest". The face's own wrapper wraps it, as every app.
var appMigrationMade = null;
spirit.shell.activateApp({
  mount: function (container) {
    container.classList.add('fill');
    window.spirit.require('spirit/app/appSelector.js').then(function () {
      appMigrationMade = window.spirit.elements.appSelector.create(container, { face: 'pane' });
    });
  },
  unmount: function () {
    if (appMigrationMade) appMigrationMade.destroy();
    appMigrationMade = null;
  },
});
