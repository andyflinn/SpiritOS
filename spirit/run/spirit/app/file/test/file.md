# spirit/app/file/file.js

Files in `spirit/app/file/`, as Andy sees it (goal/G43.17). Its test is `./file.js`: the tree read as it is, then a real node on a scratch copy of the tracked files with a planted folder `zzFiles/`, and real clicks in a real Chrome on the appSelector, on the face shell Andy uses, `/face.html`.

Andy: *"file should be the same as files is. i don't want to loose all the nice stuff files has..."*

## Requirements

### The move

- `shell/files/` is gone and no code names `shell/files`; `spirit/app/file/file.js` is there.
- `file.json`: icon 📁, label Files, intrinsic true, `shell.mount` and `shell.tile` true, `node.mount` false, no server.
- New never requires old: no script of `spirit/app/file/` names the old shell or a `shell/` path.
- The list of files stays where every app shares it (Q8): `file.js` draws with `spirit/element/files/listElement.js`.
- `spirit.elements.file.create(container)` draws into it and answers `{ destroy }`; destroy leaves it empty.

### What Files has today

- Intrinsic: its tile is there with nothing pressed, and it opens the list.
- Name, Size and Changed headers, each a sort; pressing Name again turns the order round.
- The tree while the search is empty: a folder starts shut, 📁; a press opens it, 📂, and opens nothing over the list.
- Search in names finds a file in a shut folder; in contents it finds the files holding the word, the one with more matches first.

### New

- A tiles mode, with the toggle between pane and tiles.
- A file's icon by its kind, in the pane and the tiles alike: text 📜, video 📹, image 🌇, audio 🔊, a folder 📁, any other ❔, never 📄.
- A press opens the file over the list, under its own title bar below the Files bar, the list out of view: text for text, media as `img`, `video` or `audio`, fstat alone for anything else. Text and media handed a file show no file picker.
- A contents match opens text with the words marked; its ✕ shows the list as it was left, its words kept.
- fstat, top down: the name, the text in its pane, MIME type, size, changed, created, the annotations. Alone, nothing shows between the name and the facts; no Open with (Q9).
- Nothing throws on the page.
