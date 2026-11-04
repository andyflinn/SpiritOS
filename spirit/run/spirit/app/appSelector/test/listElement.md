# appSelector/listElement.js

The app list (goal/G43.2), as `spirit/element/bundleSelector/listElement.js` is the bundle list: the probabilitySearch the selector draws. Its test is `./listElement.js`.

    spirit.elements.appList.create(host, opts) -> { list, refresh(), destroy() }; opts.face, opts.pick(row, key)

- It draws what `app.search` finds, asking with a search string and nothing more.
- A press hands the row to `pick`. `refresh` asks again. `destroy` empties its host.
