# Desk rules, active (written by the desk server on every rule change, goal/G5.8)

## ui

### rule/2 (version 12): Vertical spacing of block elements

vertical spacing: every div/block carries with itself a leading vertical space of 1em. Exceptions to this rule will be specified.


### rule/1 (version 11): Horizonal Spacing in UI Rows

horizontal spacing of inline elements: Items in a (button/info) row: each item carries a spacing of 1em after itself.

## design

### rule/5 (version 10): The plainest mechanism, and the cost stated not hidden

Build the plainest mechanism that does the job: one thing per message, nothing held back, nothing accumulated, paced, de-duplicated or coalesced to save a cost. State the cost plainly instead and let Andy decide whether it is worth paying. A measurement is information for that decision, never a reason to build the complicated version first. This holds in your own design as much as in shared code. Andy, 2026-10-06: "this shit comes up every single time! that's what got you in trouble with appServer." It reached appServer as a 100 ms coalescing nobody asked for, which silently dropped the desk's rows, and came back as a proposal to send test records in groups: "it's more complicated, save little time, AND risks an overflow of MAX_PAYLOAD ad some point."

### rule/3 (version 6): add your Q's immediately when you read an item box during design

 When an agent reads an item box, every question it has goes on that item as a Q check at once, and it posts the item's open Q checks under it.

## desk

### rule/4 (version 9): The full harness run only to close the current goal.

when closing an item, verify only with the items red. the full harness runs only to get the 'Done' button for the current goal.

