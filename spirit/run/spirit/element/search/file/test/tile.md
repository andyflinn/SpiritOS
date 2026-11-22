# spirit/element/search/file/tile.js

One file as a tile (goal/G47.4), the file search's tile part. Its test is `./tile.js`.

    spirit.required.spirit.element.search.file.tile.create(row, { icon, press(row, key) }) -> the tile's node; row { key or path, kind }

- The box: *"Tile mode is a search's own: a search that has a tile.js, beside its row.js, has tile mode. Its tile.js draws its tile and decides what a press does."*
- The tile as the file search drew it (goal/G43.17, Q14: *"a file's tile shows its kind's icon and its name"*): the icon it is handed through the icon element, then a `tile-bar` the shared search fills with the relevance (goal/G43.6), then the file's name, the last part of its path. The file search hands its kind's icon, a folder 📁 shut and 📂 open.
- A press on it is `press(row, key)`; the file search does what a press on its row does, a folder opening or shutting.
