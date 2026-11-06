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
- Opened from its tile it covers all of the tiles: one bar in view, `📁 Files`, and Files named nowhere else (*"No title line in file"*).
- Name, Size and Changed headers, each a sort; pressing Name again turns the order round.
- The tree while the search is empty: a folder starts shut, 📁; a press opens it, 📂, and opens nothing over the list.
- Search in names finds a file in a shut folder; in contents it finds the files holding the word, the one with more matches first.

### New

- A tiles mode, with the toggle between pane and tiles.
- A file's icon by its kind, in the pane and the tiles alike: text 📜, video 📹, image 🌇, audio 🔊, a folder 📁, any other ❔, never 📄.
- A press opens the file over all of file, one bar in view, the list out of view: text for text, media as `img`, `video` or `audio`, fstat only for a file of unknown kind. Text and media handed a file show no file picker.
- The bars: `✏️ Text Editor: notes.txt`; `🌇 Media Viewer: pic.png`, `📹 Media Viewer: clip.mp4`, `🔊 Media Viewer: song.mp3`, the file's own icon (Q15); fstat's ends in the file's name.
- A contents match opens text with the words marked; its ✕ shows the list as it was left, its words kept.
- Text and media are separate from fstat: the file's name only in the bar, no facts. Text's Save sits in a bubble of the kind rowForm uses, `.shell-bubble`, and in a pane 120px wide nothing of that row goes past its edge.
- A real picture, 2400 by 1600, in panes 300×200, 1200×300 and 300×900: inside the pane both ways, the bar still in view, not cropped (`object-fit` not `cover`).
- fstat, for `blob.zzq`: no text, no media, its name only in the bar; top down MIME type, size, changed, created, then the annotations; no Open with (Q9).
- Nothing throws on the page.
