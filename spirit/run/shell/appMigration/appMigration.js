// spirit/run/shell/appMigration/appMigration.js
// A THROW-AWAY FACE APP (goal/G43.2). Andy, box: "appMigration will now do the appSelector search under the hood, by calling
// spirit.app.search(""), and display the icons it finds as tiles", and "when all apps and processes are migrated, andy will
// simply delete the folder". So nothing outside this folder names it. The call takes an object, so it is { q: '' }.
//
// A PRESSED TILE OPENS THAT APP ON TOP OF IT, here alone: "NO SHELL WILL FUCKING TOUCH WHAT's inside of appMigration. this all
// plays out as if appMigration was the shell." The internal appContainer (his "appCountainer"): "a titlebar, and a pane below,
// into which the "elements" are mounted"; on the bar's left edge the tile's icon and label, on its right a close icon.
var appMigrationOff = null;
spirit.shell.activateApp({
  mount: function (container) {
    var gone = false;
    var off = null;
    var closeOpen = null;
    appMigrationOff = function () { gone = true; if (off) off(); if (closeOpen) closeOpen(); };
    container.classList.add('fill');
    var box = document.createElement('div');
    // The desktop's own grid and tile (shell.css), so these look the same with no new style.
    box.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:16px;align-content:start;overflow:auto;flex:1;min-height:0';
    container.appendChild(box);

    function open(row) {
      var shell = document.createElement('div');
      shell.className = 'app-container fill';
      shell.innerHTML = '<div class="app-container-bar" style="display:flex;align-items:center;justify-content:space-between;flex:none;padding:0.25em 0">' +
        '<span class="app-container-head" style="display:flex;align-items:center;gap:0.5em"><span class="icon"></span><span class="label"></span></span>' +
        '<button type="button" class="app-container-close" title="Close">✕</button></div>' +
        '<div class="app-container-pane fill"></div>';
      window.spirit.elements.icon.create(shell.querySelector('.icon'), { glyph: row.icon });
      shell.querySelector('.label').textContent = row.label;
      box.hidden = true;
      box.style.display = 'none';
      container.appendChild(shell);
      var made = null;
      var closed = false;
      closeOpen = function () {
        closed = true;
        closeOpen = null;
        if (made) made.destroy();
        shell.parentNode.removeChild(shell);
        box.hidden = false;
        box.style.display = 'grid';
      };
      shell.querySelector('.app-container-close').addEventListener('click', function () { closeOpen(); });
      var name = String(row.key);
      window.spirit.require('spirit/app/' + name + '/' + name + '.js').then(function () {
        if (!closed) made = window.spirit.elements[name].create(shell.querySelector('.app-container-pane'));
      });
    }
    function draw() {
      var rows = window.spirit.appData.rows();
      box.innerHTML = '';
      Object.keys(rows).forEach(function (key) {
        var tile = document.createElement('div');
        tile.className = 'app-icon';
        tile.innerHTML = '<span class="icon"></span><span class="label"></span>';
        window.spirit.elements.icon.create(tile.querySelector('.icon'), { glyph: rows[key].icon });
        tile.querySelector('.label').textContent = rows[key].label;
        tile.addEventListener('click', function () { open(rows[key]); });
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
