# The CodeMirror library in spirit/element/codeMirror/

goal/G43.5: `spirit/element/codeMirror.js`'s part of the element move. Its test is `./codeMirror-library.js`. `spirit/element/codeMirror/` is the element's own folder: the library it brings.

## Requirements

- *"ALL move the fucking library inside run::/spirit/element/codeMirror/"*. CodeMirror's 15 files, licence included, stand there and `shell/node_modules` is gone. On a real page the element draws from there with its sheet and search, and asks no other place.
- *"all, only access to codeMirror library is through the element!"* The page starts with no `window.CodeMirror`, and no product file but `spirit/element/codeMirror.js` names the library's folder. The element brings the library, its sheets and its search add-ons itself.

The rest of the element move is `spirit/test/spirit-elementMove.md`.
