// spirit/run/spirit/app/tiles.js
// THE APPS AS TILES (goal/G43.2, goal/G43.6). Andy, box: "spirit/app/tiles.js: an element, a probabilitySearch variant, that displays
// its list as tiles, with extra info in a tooltip." Its contract and its test: ./test/tiles.md and ./test/tiles.js. What a tile
// looks like is probabilitySearch's face tiles.
//
//   spirit.app.tiles.createApp(container) -> { destroy() }
//
// A PRESSED TILE OPENS THAT APP ON TOP OF IT, here alone: "NO SHELL WILL FUCKING TOUCH WHAT's inside". The internal
// appContainer (his "appCountainer"): "a titlebar, and a pane below, into which the "elements" are mounted"; on the bar's left
// edge the tile's icon and label, on its right a close icon, which closes the app and brings the tiles back.
(function () {
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
  var parts = Promise.all([S.require('spirit/element/probabilitySearch.js'), S.require('spirit/element/icon.js'), S.cacheManager('app')]);

  function create(container) {
    var gone = false;
    var closeOpen = null;
    var list = null;
    var off = null;
    var root = document.createElement('div');
    root.className = 'fill';
    var box = document.createElement('div');
    box.className = 'fill';
    root.appendChild(box);
    container.appendChild(root);

    function open(row) {
      var shell = document.createElement('div');
      shell.className = 'app-container fill';
      shell.innerHTML = '<div class="app-container-bar" style="display:flex;align-items:center;justify-content:space-between;flex:none;padding:0.25em 0">' +
        '<span class="app-container-head" style="display:flex;align-items:center;gap:0.5em"><span class="icon"></span><span class="label"></span></span>' +
        '<button type="button" class="app-container-close" title="Close">✕</button></div>' +
        '<div class="app-container-pane fill"></div>';
      S.element.icon.create(shell.querySelector('.icon'), { glyph: row.icon });
      shell.querySelector('.label').textContent = row.label;
      box.hidden = true;
      root.appendChild(shell);
      var made = null;
      var closed = false;
      closeOpen = function () {
        closed = true;
        closeOpen = null;
        if (made) made.destroy();
        root.removeChild(shell);
        box.hidden = false;
      };
      shell.querySelector('.app-container-close').addEventListener('click', function () { closeOpen(); });
      var name = String(row.key);
      S.require('spirit/app/' + name + '/' + name + '.js').then(function () {
        // Andy, box: "The app tiles open it from spirit.app." server stays on spirit.elements.
        var pane = shell.querySelector('.app-container-pane');
        if (!closed) made = S.app[name] ? S.app[name].createApp(pane) : S.elements[name].create(pane);
      });
    }
    function search() {
      return S.ready.then(function (s) { return s.app.searchApp({ q: '' }); }).then(function (got) {
        if (!gone) S.data.seatRows(S.data.app.data.branch, got.items);
      });
    }
    parts.then(function () {
      if (gone) return;
      list = S.element.probabilitySearch.create(box, {
        face: 'tiles',
        data: S.data.app.data.branch,
        columns: [{ field: 'label', label: 'App' }],
        pick: function (row) { if (row) open(row); },
        empty: 'No app matches.',
      });
      // WHO PAINTS, LISTENS (Andy, G41.32): the list is a view of the cache, and a connect forgetting what is kept (a word with
      // no row, spirit/data.js's forget) asks again.
      off = S.data.app.data.watch(function (key) { if (!key) search(); });
      search();
    });
    return {
      destroy: function () {
        gone = true;
        if (off) off();
        if (closeOpen) closeOpen();
        if (list) list.destroy();
        container.innerHTML = '';
      },
    };
  }

  (S.app = S.app || {}).tiles = { createApp: create };
}());
