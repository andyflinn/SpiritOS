# deskRunStatus stays in shell/shared/, on spirit.elements

goal/G43.5: `shell/shared/js/deskRunStatus.js`'s part of the element move. Its test is `./deskRunStatus-home.js`, a real page on a scratch node.

## Requirements

- *"shell/shared/ will not be moved or touched. thos elements do NOT belong in spirit.element."* The desk's shared elements stay on `spirit.elements`: `deskRunStatus.js`, required on a page, stands on `spirit.elements` and not on `spirit.element`, and `shell/shared/js` keeps its one file since goal/G43.23, `deskRunStatus.js`.

The element move itself is `spirit/test/spirit-elementMove.md`.
