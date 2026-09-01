> **Archived.** The strongly-typed "hxm" layer this document develops was
> the design thinking behind the type system later deliberately deleted
> from kernel.js. Kept as a record of the thinking, not as a description
> of anything current or planned.

# migration to type script vision details

**Author:** Andy Flinn  
**Repository:** https://github.com/andyflinn/SpiritOS

This might be the very first detailed design document.

> This document tries to convey a strategy that gets us migrated from a 10 years old vision, hacked together by a parents garage objeration, > Tages ago...
> 
> ... to a **SpiritOS** that has a somewhat longer life time.


Our [design vision document](../VISION.md) has a few potential implications that i'll use to preface to this document.
1. The lowest layer of the architechure implements the concept that **one single human** client communicates with **one single machine** using **one single, conceptual json object**. The machine side might be an LLM or it might be an arduino pinout.
2. This layer in itself should be a package, lets call it **hxm**, *human times machine, our power or influence multipled* and have zero knowledge of http and other such thingamagics.
3. In fact, these lowest level type definitions, are, in essence, the protocol.


- For **SpiritOS** we might use a public domain concepts, that let us define the object down to the bit level, for all programming languages, for all machine types, from LLM to Arduino pinout.
- 
when thinking about a strongly typed type system, this train of thought distinguishes between **objects** (containers), and primitive **values**. Lets start with...

# Primitive **Values**

A primitive **value** is the lowest level dataset

## bit

this **boolean** type can only reflect two states, states: **true** and **false**, where **false** is the intrinsic default **value**. it can also be thought of as a pin in a pinout

## ***number***

- All numbers have an intrinsic **default value of 0**. 

### integer

This is a number that can only hold integral values. 0, 1, 2, 3, 4... or -1, -2, -3... 

### float

This has the same features as a "C" language float, the intrinsic **default value is 0.0**.

## string

strings contain human readable language. the **default value is always an empty string ""**.

### Basic, Short Strings

These are values that are generally presented to the user in a simple string input box, and usually have a length limit of up to 256 characters. Here are the vital subtypes of of the js string type

#### name

A **name** is a string. A **name** may only contain characters from lowercase 'a' to lowercase 'z'. this one is crucial to the design of **SpiritOS**. 

- All Objects in the **hxm** layer are addressable through a path composed of names.
- A path identifying a value contained with in the **one and only hxm json file** may look something like this: **machine.state.running**
- by limiting the **hxm** name space to names with the above character restriction. the name space can be extended to filesystem storage in a variety of ways. **The filesystem interface, however, is NOT within the scope of the hxm core** 

### longer more complex strings

These are values that are generally presented to the user in an html text input, and usually have a length limit of up to 65536 characters Here are the vital subtypes of of the **hxm** text type.

# Objects

As mentionned before, and in other places, the **one single human client** communticates with the **one single server machine** using **one single conceptual json object**.

 for example:

```json
{
    "a":{},
    "b"{
        "c":true,
        "d":{},
    },
    "e":"string data",
    "f":{
        "g":2560154,
    },
}
```



