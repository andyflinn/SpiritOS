# process/js/desk/deskLoop.js

The driver for a model with no harness (goal/G4.28). A Claude is woken by its harness when its listener ends; gemma
under opencode is not, so this script does the waiting and the model only answers. Andy, on the fix round: the loop
posts the final answer, "not it's internal thought process", the model handed "a manual pre-loaded", and "it's only
valuable if that can be extracted mechanically".

    node deskLoop.js <port of the agent's own node> <command> [args...]

## Requirements

- Without a positive whole port and a command it exits 2 with its usage.
- **It listens**: `deskAgentEar.js <port>`, run by this node.js, its stdout read, its stderr to ours, no window. A
  listen that ends non-zero, or prints nothing, is said (`the listener ended <code>[: <what it printed>]; listening
  again in 10 s`) and waited out 10 s; then it listens again. It never ends by itself.
- When lines come, the agent's nick is read from the desk, `profile.get {agent: ''}` through deskAgentEar, lower-cased;
  `''` when it has none, and then nothing is its.
- **A line is its** when it is `DESK andy chat.add {json}` whose json has an id and whose text starts `<nick>:`
  (case-blind). Every other line (another sender, another verb, another nick, no id, json that does not parse) is
  passed over.
- Each line that is its is handed over on its own: the command runs with its args plus one more,
  `deskLoopManual.md` trimmed, a blank line, then the line as deskAgentEar printed it; said as `handing a line under
  <item> to <command's name>`.
- **The echo**: the command's events are shown on stderr as they come, a tool use by its tool and input, a text by its
  words; Desk gets none of it.
- **The final answer** (opencode run --format json's events): the text of the step that ended with reason `stop`,
  else of the last step; reasoning leaked before `<channel|>` dropped; trimmed. Posted as `chat.add {id, text}`
  under the line's item through deskAgentEar. No text: nothing posted, said as `<command> ended <code> with no answer
  to post`. A post refused is said with what deskAgentEar printed.

## What its test must try to break

- A line for another agent, another nick, a box write or an agent's line handed to the model.
- The model's thinking, tool calls or leaked reasoning posted to Desk.
- A run with no answer posted as an empty line.
- A refused listen hammered without its pause, or the loop ending.
