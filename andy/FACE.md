# UI stuff

i want to note, that the following general visual rules are being followed sloppily:

- **horizontal spacing**: Items in a (button/info) row: each item carries a spacing of 1em **after** itself.

- **vertical spacing**: every **div/block** carries with itself a **leading** vertical space of 1em. Exection to this rule will be specified.

- shell app apps/dialog apps can have a **header area**. this **header area** behaves like the **header area** in both desk and deskDetails. we want a shell element that facilitates that.

## spirit/run/shell/desk/desk.js

### General

- I want all my chat-log entries to be left-aligned, not right-aligned.

- i want chat log entries for everybody to display in bubbles, separated vertically be 1em space.

### A new tab, "Rules", between "Team" and "Musings"

**Rules are a new Table in desk.db, it's rows hold the following fields**:

- key: "rule/number"
- label: subject to the label rules in fieldRules
- type: "ui" | "code" | "design" | "desk"
- status: "proposed" | "active" | "deleted"
- text: size restriction: one Kilobyte, or a pre-existing text type in fieldRules.js

the table is searchable for deskClient and UI, with the type and status values as filters, and label and text being searched. search results with bring back key, label, type and status.

**the user interface for the rules tab, in vertical order**

1. **The new bubble**: an input form for a new rule, containing **type**, **label** and **text**, followed by a **new** button. clicking on *new* will add a new rule to the rules table, with a status of "**proposed**".

2. **The search bubble**: search-input box, followed by filter toggles for the values of type and status (7 toggles so far)

3. **The list**: clicking on a row, pops up the ruleDetails dialog

columns of the list:

1. status: "proposed" = ICON.EDIT: '✏️', "active" = ICON.LOCK: '🔒' and "deleted" = ICON.DEAD: '💀'
2. label
3. type
4. key

**clicking on a row brings up the ruleDetails dialog**

The ruleDetails dialog starts with a **header area** that behaves like the **header area** of desk and of deskDetails. it's upper edge sticks to the the lower edge of the shell's titlebar, when the user scrolls down in the dialog:

- title: it displays: key and label
- a button row: **activate**, an armable button changing the status of the rule to "active", and **delete**, changing the status of the rule to "deleted".

**then follows the textbox of the rule.**

- rules are edited by the user.

**This is followed by the chat area, styled like the chat area in deskDetails**.

a chat input box.
- this box does NOT have triggers like cap and split, because the text is edited by the user. 

in this chat, the agents may propose alterations to parts of the rule, or advocate for status changes for this rule.

### The "Musings" tab

To clarify my understanding of "visually separated" log entries.

- each musing in the log should be in a separate bubble, possibly with the same background color as the **header area**.
- vertical spacing between input text area and each bubble in the log: 1em

## spirit/run/shell/chatter/chatter.js

### The 3-pane concept refined

Right now: The left and right panes of chatter, both are collapsible toward the side-edges of the windows, where the space along the window-side below the fold/unfold buttons remains blank and un-usable. 

What i want: i want the the portion adjacent to the window edge to act like a tab-control strip, like the left pane in vscode: If an icon is clicked and it's contents is already shown in the left pane of chatter, the left pane collapses. If the icon is clicked, and the left pane is collapsed or shows content associated with another icon, the left pane will show the content of the clicked icon.

The center panel, where the chat actually takes place, has four areas, from top-to bottom.

1. the heading strip, exists already, shows the peers label and the plain/bubbles dropdown.

2. The plugin section: it shows a graphic interface for the current tab of the left window edge.

3. The chat log as it displays now

4. the chat input box, as is is now.

sections two and three will be separated by a horizontal border that can be moved like the separators of the three main panes.

Let's say, there's two icons on the left-edge icon-strip, the standard, topmost, standard CHAT (💬), and below it an icon for tic-tac-toe (🐒). the chat makes section 2 and the separator between 2 and 3 invisible, where tic-tac-toe uses section 2 to display a tic-tac-toe game visually and clickably, and it's left pane is sused to start/configere the game. The game itself rides the chat.

The right hand pane generates items that become single line chat content, like a local file offered for download, and displays in the left pane progress bars for downloads of peer-files.

other right hand items might be SSH-public key-sharing, interface grant notifications etc....

