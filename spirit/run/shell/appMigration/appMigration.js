// spirit/run/shell/appMigration/appMigration.js
// A THROW-AWAY FACE APP (goal/G43.2). Andy, box: "appMigration becomes JUST a wrapper for "run/spirit/ui.js"", and "when all
// apps and processes are migrated, andy will simply delete the folder". So nothing outside this folder names it.
var appMigrationMade = null;
var appMigrationGone = false;
spirit.shell.activateApp({
  mount: function (container) {
    appMigrationGone = false;
    container.classList.add('fill');
    window.spirit.require('spirit/app/appTiles.js').then(function () {
      if (!appMigrationGone) appMigrationMade = window.spirit.app.appTiles.createApp(container);
    });
  },
  unmount: function () {
    appMigrationGone = true;
    if (appMigrationMade) appMigrationMade.destroy();
    appMigrationMade = null;
  },
});
