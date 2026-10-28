# Desk rules, active (written by the desk server on every rule change, goal/G5.8)

## ui

### rule/1 (version 52): Horizonal Spacing in UI Rows

horizontal spacing of inline elements: Items in a (button/info) row: each item carries a spacing of 1em after itself.

### rule/2 (version 51): Vertical spacing of block elements

vertical spacing: every div/block carries with itself a leading vertical space of 1em. Exceptions to this rule will be specified.


### rule/19 (version 48): a ui only updates state via the server.

any user interface page can only update it's state via the server. the ui must propose all state changes to the server and only draw changes contained in the servers update/change stream.

### rule/16 (version 42): A list gets a box of a stated size

Every probabilitySearch (shell/js/probabilitySearch.js, and the lists made on it) is mounted in a box that states its size: class fill (shell.css), inside a pane that fills its app, the way the Apps and Icons face apps do. Never in a stat-tile or another box that is only as tall as its content.

### rule/12 (version 29): Inputs validate with the field rules

every input in the shell, system or app level, whose value a field rule governs is marked with that rule (data-field="label", "paragraph", ...) and validated as typed with the same rule the node uses (fieldRules.js, window.spiritFieldRules in the browser): bytes left shown beside it, its action refused while the rule says no.
The node still checks every value; the input check spares the wire and says why at once, it never replaces the node check.

### rule/8 (version 18): Shell and Application Elements

Shell and application elements, should bring their subscriptions with them, so that they're automatically subscribed to the events that update them

## code

### rule/13 (version 31): A node boot ends with a key and a default name

No node-boot is done until the node has a key and a default name. The node makes its one permanent identity first thing at boot, the machine name as its default name, before anything else may ask for it; nothing later makes another.

### rule/11 (version 27): tests report to deskVerify

tests must be written so deskVerify can judge them. 

1. a suite reports only through testSupport check and fail, never by printing its own results; that is the only way its results reach deskVerify. 

2. the red test file goes on the item file list; an item with no test file, or a listed file that is missing, has nothing for deskVerify to run. 

3. a suite that starts a server gives it its own environment file and port; the default 65432 is the owner live node, and a test must never reach it.

## design

### rule/5 (version 10): The plainest mechanism, and the cost stated not hidden

Build the plainest mechanism that does the job: one thing per message, nothing held back, nothing accumulated, paced, de-duplicated or coalesced to save a cost. State the cost plainly instead and let Andy decide whether it is worth paying. A measurement is information for that decision, never a reason to build the complicated version first. This holds in your own design as much as in shared code. Andy, 2026-10-06: "this shit comes up every single time! that's what got you in trouble with appServer." It reached appServer as a 100 ms coalescing nobody asked for, which silently dropped the desk's rows, and came back as a proposal to send test records in groups: "it's more complicated, save little time, AND risks an overflow of MAX_PAYLOAD ad some point."

### rule/3 (version 6): add your Q's immediately when you read an item box during design

 When an agent reads an item box, every question it has goes on that item as a Q check at once, and it posts the item's open Q checks under it.

## desk

### rule/25 (version 62): The USER owns the box.

The USER owns the box.

you may NOT touch the box without the USERS permission, 
you may NOT REMOVE or NEGLECT requirements in the box.

### rule/24 (version 60): Answer the fucking Question.

Whenever the user asks you a question, you answer the damn question short and precise and DON'T babble on about SHIT you were NOT asked.

### rule/23 (version 58): gaming test suites

under NO circumstances will you implement imperfect code on purpose.
- not for passing faulty tests
- not for ANYTHING.

### rule/22 (version 56): No Agent touches the desks verifier

No Agent touches the desks verifier. the may only use the verifier on their own FUCKING node.

### rule/21 (version 54): always look for existing code.

always look for existing code in the tree when facing a design, test or implementation issue. if you don't find existing code, raise a red question to address the issue.

### rule/18 (version 46): when being woken, read the news

an agent being woken by desk and its client MUST diligently read the news coming with the wake and adjust accordingly.

### rule/17 (version 44): Diligence

Before claiming completion of ANY task, test-writing, coding, or verifying, the agent MUST make sure that every single point in the items box is satisfied.

### rule/15 (version 39): An agent never just goes idle

An agent never goes idle without 
- checking for available work first.
- checking for new chatlines to respond to, first.


### rule/14 (version 34): When blocked by unmade decisions, post a red Q

When an agent is blocked during any phase of an item, by unmade decisions, contradictions etc, post a red Question on the item, to get the users attention.

### rule/6 (version 25): Dependencies when splitting a desk item

whenever an item is added or split, only the new, explicit blocking relationships are automatically added, the implicit blocking ones do not need to be specified, it clutters the list display with confusing "blocks" and "waits on", and is not needed for a dependency graph.

### rule/10 (version 23): full harness only runs for goal completion

full harness only runs for goal completion. it is too time consuming to run the full harness for getting an item 'done'. verify still must be done with the suite for the item.

### rule/9 (version 20): Bulk goal creation on order only

An agent creates a goal with all its items in one call only when Andy has ordered it explicitly for that goal. Otherwise goals and items are added one at a time, through the same verbs Andy uses, and the desk names every id.

### rule/7 (version 16): Agents grants for splitting items

And agent may not autonomously split, create, delete or modify items, unless specifically authorized by the user. 

### rule/4 (version 9): The full harness run only to close the current goal.

when closing an item, verify only with the items red. the full harness runs only to get the 'Done' button for the current goal.

## test

### rule/20 (version 50): verification of test folders in product tree

do not claim verification of a product script is done is green until

- the proper ./test folder and test/documentation files exists
- the test completely verifies the behavior of that script, in line with all the requirements of the item
- the doc.md file describes the new or changed behavior of that script completely and precisely in accordance with the items requirements

