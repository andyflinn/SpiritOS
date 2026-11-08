# Info's two relay forms

goal/G43.27, requirements 9 and 10, `spirit/run/spirit/element/test/nodeInfoForms.js`.

Andy: "setting a star on a relay is what makes the face-form appear in \"info\", the email form must always show in \"info\"".

nodeInfo.js runs on a bare window, with the real joinForm.js and faceForm.js. The rowForm is a stand-in. relay.status answers as the relay family's own `status` does: `{ status, text, body: { rows, ... } }`. Its rows are a seat on A (claimed), one on O (owned), and B, which is only listed. A star is a row's `mine`, the field faceForm reads (faceForm.js:33).

## Requirements

- **9. The email form always shows.**
  - It shows with seats and no star.
  - It shows with A starred.
  - It shows with no seat on any relay.
- **10. The face form only for a starred relay.**
  - With no relay starred, there is no face form.
  - With A starred, the face form shows, and it offers A alone.
