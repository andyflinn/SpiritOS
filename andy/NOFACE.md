# Item to do in faceless code

## spirit/run/process/js/pushOrigin/pushOrigin.js

during the creation of spirit/run/process/js/deskClient/publishData.js, when that script was run simultaneously on three platforms, by three instances of claude, conflicts arose when trying to push new measurment documents to github.

A fix was applied to publishData.js that fixed the problem automatically

That fix would be extremely useful for deskServer as well. I propose to isolate that fixed section and make it available as spirit/run/process/js/deskClient/publishData.js so desk can use it when updating in goalShare.js, which mabe already carries the fix (duplicated) as well.

## spirit/run/process/js/fileServer/fileServer.js

I want to revise this one a bit

1. There will be only one label (file-name) per verb-hash. All the label arbitration will disappear.
2. there will be slots in fileServer that are reserved by the node itself, like PROFILE_PICTURE.

## spirit/run/process/js/desk/desk.js

- when 'go' was pressed/consumed on an item, and no agent is working on that item, (all agents idle, ) and no 'Done' button is visible, no grants or red questions pending, then the item sits in 'limbo'. this limbo-state is actionable for agents.then an agent must 'take' that situation, add either a red grant request button, or a red question, or present a 'Done' button. 