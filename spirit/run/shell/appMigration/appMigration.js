// spirit/run/shell/appMigration/appMigration.js
// A THROW-AWAY FACE APP (goal/G43.2). Andy, box: "appMigration will now do the appSelector search under the hood, by calling
// spirit.app.search(""), and display the icons it finds as tiles", and "when all apps and processes are migrated, andy will
// simply delete the folder". So nothing outside this folder names it. The call takes an object, so it is { q: '' }.
// A TILE DOES NOTHING WHEN PRESSED (Andy, Q6: "NOTHING. we go ONE STEP AT THE TIME.").
var appMigrationOff = null;
spirit.shell.activateApp({
  mount: function (container) {
    var gone = false;
    var off = null;
    appMigrationOff = function () { gone = true; if (off) off(); };
    var box = document.createElement('div');
    // The desktop's own grid and tile (shell.css), so these look the same with no new style.
    box.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:16px;align-content:start;overflow:auto;flex:1;min-height:0';
    container.classList.add('fill');
    container.appendChild(box);
    function draw() {
      var rows = window.spirit.appData.rows();
      box.innerHTML = '';
      Object.keys(rows).forEach(function (key) {
        var tile = document.createElement('div');
        tile.className = 'app-icon';
        tile.innerHTML = '<span class="icon"></span><span class="label"></span>';
        window.spirit.elements.icon.create(tile.querySelector('.icon'), { glyph: rows[key].icon });
        tile.querySelector('.label').textContent = rows[key].label;
        box.appendChild(tile);
      });
    }
    function search() {
      return spirit.ready.then(function (s) { return s.app.search({ q: '' }); }).then(function (got) {
        if (gone) return;
        window.spirit.data.seat(window.spirit.appData.branch, got.items);
        draw();
      });
    }
    // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26). WHO PAINTS, LISTENS (Andy, G41.32): a change on the stream redraws, and
    // a connect forgetting what is kept (a word with no row, spiritData's forget) asks again.
    Promise.all([window.spirit.require('shell/js/icon.js'), window.spirit.cacheManager('app')]).then(function () {
      if (gone) return;
      off = window.spirit.appData.watch(function (key) { if (key) draw(); else search(); });
      search();
    });
  },
  unmount: function () {
    if (appMigrationOff) appMigrationOff();
    appMigrationOff = null;
  },
});
