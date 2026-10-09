# Desk rules, active (written by the desk server on every rule change, goal/G5.8)

## ui

### rule/8 (version 18): Shell and Application Elements

Shell and application elements, should bring their subscriptions with them, so that they're automatically subscribed to the events that update them

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

### rule/10 (version 23): full harness only runs for goal completion

full harness only runs for goal completion. it is too time consuming to run the full harness for getting an item 'done'. verify still must be done with the suite for the item.

### rule/9 (version 20): Bulk goal creation on order only

An agent creates a goal with all its items in one call only when Andy has ordered it explicitly for that goal. Otherwise goals and items are added one at a time, through the same verbs Andy uses, and the desk names every id.

### rule/7 (version 16): Agents grants for splitting items

And agent may not autonomously split, create, delete or modify items, unless specifically authorized by the user. 

### rule/6 (version 14): Dependencies when splitting a desk item

when splitting an item, only the new, explicit blocking relationship is automatically added, the implicit blocking does not need to be specified, it clutters the list display with confusing "blocks" and "waits on", and is not needed for a dependency graph.

### rule/4 (version 9): The full harness run only to close the current goal.

when closing an item, verify only with the items red. the full harness runs only to get the 'Done' button for the current goal.

