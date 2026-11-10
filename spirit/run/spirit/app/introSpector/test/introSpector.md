# spirit/app/introSpector/introSpector.js, the app

Its test is `./introSpector.js`. The box (goal/G43.29, v3): *"spirit/app/introSpector/ holds introSpector, now in shell/introSpector/"*. Andy: *"fill in the box, same icons, shell:mount only."*, *"a wrapper for separate spirit/element/ files"*, *"both apps will be intrinsic"*.

## Requirements

- `introSpector.json`: its icon 👓, its name introSpector; intrinsic; shell mount true, tile true; node mount false, nothing run. Its folder holds `introSpector.js`, no `api.js` and no `data.js`.
- `introSpector.js` brings `spirit/element/introSpector.js` and draws nothing itself: no innerHTML, no old shell helper (activateApp, callDialog, factRow).
- It registers `spirit.element.spirit.app.introSpector.introSpector.create(container, { open })`, which draws its element and answers `{ destroy }`; destroy empties its container.
- Its tile is there, intrinsic and on, and opens it.
