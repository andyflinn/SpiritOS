# UI stuff

i want to note, that the following general visual rules are being followed sloppily:

- **horizontal spacing**: Items in a (button/info) row: each item carries a spacing of 1em **after** itself.

- **vertical spacing**: every **div/block** carries with itself a **leading** vertical space of 1em. Exection to this rule will be specified.

- shell app apps/dialog apps can have a **header area**. this **header area** behaves like the **header area** in both desk and deskDetails. we want a shell element that facilitates that.

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

