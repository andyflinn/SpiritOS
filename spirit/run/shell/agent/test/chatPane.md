# shell/agent/chatPane.js

The chat with a persona, in the Agent app's centre (goal/G41.26). The Agent app opens it when a persona is picked in
its 💬 Select Persona panel (`./agent.md`). Its test is `./chatPane.js`.

Andy, box: *"the chat pane shows up in the center pane of workBench, titled: \"💬 Chat with
<selected-persona-label>\". The title is pinned to the top of the center pane."*, *"pinned to the bottom or that pane is
a input block, which contains, for now a chat input line, which sends when Enter is pressed, and adds \"\n\" when
SHIFT.Enter is pressed, and a send button on the right edge of that row."*, *"the space between the Title row and the
Chat input row is filled by an upward scrolling chat log."*, *"how the chat will work, is oos for this item."*, and
*"NO component from \"desk\" will be used."*

## API

`window.spirit.elements.chatPane.create(container, { persona })` draws the pane into the container and answers it
(goal/G41.19: *"every element gets a container and appends itself"*), with `destroy()`.

- `persona` the persona row picked, `{ id, label }`.

## Requirements

- **Its title**, `💬 Chat with <the persona's label>`, the label escaped, pinned to the top of the container.
- **Its input row**, pinned to the bottom: an input line that takes newlines (a textarea), and a Send button at the
  row's right edge, the line left of it.
- **The log** fills the space between the title and the input row, and scrolls in itself.
- **Enter is the send**: its newline is held back from the line. **Shift+Enter** is left to the line, which adds the
  newline. What a send does is out of scope for this item.
- **No component of the desk**: its code names none.

Asked of a real browser, since pinned rows and a filling log are layout: `./chatPane-laid.html`, opened at
`/DEBUG/shell/agent/test/chatPane-laid.html` on a scratch node with its DEBUG on (`test/headLessChrome.js`), the pane
in a centre of 500 by 400.

## What its test must try to break

- A title not at the top, or with the label unescaped; an input row not at the bottom; Send not at its right edge.
- A log that leaves a gap or overlaps the title or the row, or does not scroll.
- A one-line input; Enter that writes a newline; Shift+Enter held back.
- A desk component used.
