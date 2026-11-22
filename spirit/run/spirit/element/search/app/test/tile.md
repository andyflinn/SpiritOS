# spirit/element/search/app/tile.js

One app as a tile (goal/G47.4), the app search's tile part. Its test is `./tile.js`.

    spirit.required.spirit.element.search.app.tile.create(row, { press(row, key) }) -> the tile's node; row { key, label, icon }

- The box: *"Tile mode is a search's own: a search that has a tile.js, beside its row.js, has tile mode. Its tile.js draws its tile and decides what a press does."*
- The tile as the app search always drew it (goal/G43.6, Andy: *"A tile: its image, the relevance, its label."*): the app's icon through the icon element, then a `tile-bar` the shared search fills with the relevance, then the label.
- A press on it is `press(row, key)`; the app search picks the app, as a press on its row does.
