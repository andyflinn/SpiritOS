# initial AI chat App Plugin

## Concept

-   this is a chat that Utilizes chat API's from various AI suppliers.
-   i can address/send messages to AI's separately or clectively my input element in the ui is followed by toggle-buttons, on for every AI in the chat, followed by a send button. 
-   replies from various AI's are not shared with other AI's so there will be no explosion or chain reaction of AI   compute budgets.
-   i can however forward a reply to an other AI, except the AI that gave me the reply.
-   the forwarding interace, has toggle buttons for every online AI except the originator of the reply. by default oll them default to "off", on every forwarding interaction
-   the app allows me to store session logs. ideally in a json file, which i then can publish via, for example gitlab.com and make them easily accessible for AI's to read

-   the management of api credentials for api access, might haveto be an important subsystem for the zs4 framework. this may apply to all kinds service providers: google and dropbox type storage, AI compute, etc...