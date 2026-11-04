// spirit/run/spirit/ui.js
// A SHELL ELEMENT (goal/G43.2): the tiles of the apps in the app family, each opening on top of them. Its contract and its
// test: ./test/ui.md and ./test/ui.js. Andy, box: "do the appSelector search under the hood, by calling spirit.app.search(""),
// and display the icons it finds as tiles". The call takes an object, so it is { q: '' }.
//
//   spirit.elements.ui.create(container) -> { destroy() }
//
// A PRESSED TILE OPENS THAT APP ON TOP OF IT, here alone: "NO SHELL WILL FUCKING TOUCH WHAT's inside". The internal
// appContainer (his "appCountainer"): "a titlebar, and a pane below, into which the "elements" are mounted"; on the bar's left
// edge the tile's icon and label, on its right a close icon, which closes the app and brings the tiles back.
(function () {
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
  window.spirit.require('spirit/element/icon.js');
  window.spirit.cacheManager('app');

  function create(container) {
    var gone = false;
    var closeOpen = null;
    var root = document.createElement('div');
    root.className = 'fill';
    var box = document.createElement('div');
    // The desktop's own grid and tile (shell.css), so these look the same with no new style.
    var GRID = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:16px;align-content:start;overflow:auto;flex:1;min-height:0';
    box.style.cssText = GRID;
    root.appendChild(box);
    container.appendChild(root);

    function open(row) {
      var shell = document.createElement('div');
      shell.className = 'app-container fill';
      shell.innerHTML = '<div class="app-container-bar" style="display:flex;align-items:center;justify-content:space-between;flex:none;padding:0.25em 0">' +
        '<span class="app-container-head" style="display:flex;align-items:center;gap:0.5em"><span class="icon"></span><span class="label"></span></span>' +
        '<button type="button" class="app-container-close" title="Close">✕</button></div>' +
        '<div class="app-container-pane fill"></div>';
      window.spirit.element.icon.create(shell.querySelector('.icon'), { glyph: row.icon });
      shell.querySelector('.label').textContent = row.label;
      box.style.display = 'none';
      root.appendChild(shell);
      var made = null;
      var closed = false;
      closeOpen = function () {
        closed = true;
        closeOpen = null;
        if (made) made.destroy();
        root.removeChild(shell);
        box.style.cssText = GRID;
      };
      shell.querySelector('.app-container-close').addEventListener('click', function () { closeOpen(); });
      var name = String(row.key);
      window.spirit.require('spirit/app/' + name + '/' + name + '.js').then(function () {
        // goal/G43.6, Andy, box: "The app tiles open it from spirit.app." server stays on spirit.elements.
        if (!closed) made = (window.spirit.app[name] || window.spirit.elements[name]).create(shell.querySelector('.app-container-pane'));
      });
    }
    function draw() {
      var rows = window.spirit.appData.rows();
      box.innerHTML = '';
      Object.keys(rows).forEach(function (key) {
        // Its row kept as drawn: a connect empties the cache the rows live in, and a press before the search answers still opens.
        var row = rows[key];
        var tile = document.createElement('div');
        tile.className = 'app-icon';
        tile.innerHTML = '<span class="icon"></span><span class="label"></span>';
        window.spirit.element.icon.create(tile.querySelector('.icon'), { glyph: row.icon });
        tile.querySelector('.label').textContent = row.label;
        tile.addEventListener('click', function () { open(row); });
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
    // WHO PAINTS, LISTENS (Andy, G41.32): a change on the stream redraws, and a connect forgetting what is kept (a word with
    // no row, spiritData's forget) asks again.
    var off = window.spirit.appData.watch(function (key) { if (key) draw(); else search(); });
    search();
    return {
      destroy: function () {
        gone = true;
        off();
        if (closeOpen) closeOpen();
        container.innerHTML = '';
      },
    };
  }

  (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  window.spirit.elements.ui = { create: create };
}());
