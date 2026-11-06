# The relay login

goal/G43.18, box v29, *The relay login*. Its test is `./faceLogin.js`: a real scratch node and relay, a face on a starred relay (box v29: a face only on one), its real login, and a real Chrome on the face at `<name>.localhost`.

Andy's box: *"The relay serves a logged-out face one plain page, the one-field form, with spirit.js and seal.js only, which make the sealed link home. boot.js, shell.css, face.css and every other part of the shell come from the home node over that link."* and *"The login is spirit.login, in spirit.js, no app. It holds the relay's own calls, state, login and logout on /face/api, and draws the one field when logged out. shell/login/ and its login.json go."*

## Requirements

- `shell/login/` is gone.
- The relay serves the face its page, `/spirit.js` and `/shell/seal.js`. Logged out or in, it does not itself serve `/shell/boot.js`, `/shell.css`, `/shell/face.css`, `/shell/login/login.js` or `/shell/login/login.json`.
- On the face, `spirit.login` holds `state`, `login` and `logout`. Logged out, the page shows one field and loads nothing but `spirit.js` and `seal.js` (its favicon and `/face/api` aside).
- Logged in, the face draws the home node's shell (Contacts on its list), and none of `boot.js`, `shell.css` or `face.css` came as the relay's own file.
- After `spirit.login.logout()`, the page shows the one field again, and the relay holds the login no more.
