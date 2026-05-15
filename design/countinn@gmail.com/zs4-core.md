# The core zs4 architecture


## The zs4 client / server concept

The server is, ,conceptually, the keeper on one single json file. When a client loads, the one server page, it receives an essential subset of the json file, a nested zs4 object, including tools that allow the client to read and modify the one json file. 

### client server interaction

when the client requests a change in the json file the server basically responds with the changed subset of the entire (conceptual) json file, always enclosed in the root braces 


**{type:{user:{config:{driver:"mongodb"}}}}.** 

this driver value, like all components of this json file (object tree) of course has a zs4 path

**zs4.type.user.config.driver**

The client api automatically merges that reply into it's mirror of the servers json file (object tree).


### Claude objservations
- The page loads once — all subsequent interaction is client-side, no page reloads
- Internal path variable — the client maintains a zs4.location.path that reflects the current display context (which scope is being shown)
- the client posts JSON as tree structure — {zs4: {type: {app: {array: {a: {}}}}}} implicitly encodes the path. The nesting IS the path. Server and client always communicate from the tree root.
- On-page navigation = display context only — changing what scope is visible doesn't need to communicate with the server. It's purely a UI state change.
- The API translates item location — the nested JSON structure itself tells the server which object the client is operating on.
- So zs4.navigate(path) should only update what's displayed on the UI, not trigger any server requests—the server already has all the context it needs from the tree structure of the POST itself. I'm looking at my current implementation and realizing it's making unnecessary server calls when it should just be switching the display context.
- **The key insight is that on initial page load, the client needs to fetch the scope's data, but once zs4.THIS is populated with the full tree, subsequent navigation just needs to change which scope is visible—the data's already there.**


### the conceptual shape of the zs4 object 

```
zs4:
{
    head:{ // the object head is common to zs4 objects, enherited by various object types
        author: "author@author.com", // the user who created this object
        uuid: "universally-unique-identifier", // assigned at creation time, immutable from then on.
        bits: 235426, // a set of names bits in an integer, controlling behaviour of this object
        description: "this is.... bla bla bla",
        created: date, updated: date,
    },

    // type specific object members
    moretext:"bla bla",
    
    cookware: {
        zs4:{
            head:{
                /* same fileds as all head objects */
            }

        },
        // type specific
        isPot: true,
        isPan: false,
    }
}
```


